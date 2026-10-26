// ============================================================================
// Eco Loco — kontrollbord (bänk) · ESP32-S3 · MQTT-version (DRIFT)
// ----------------------------------------------------------------------------
// Bygger på testfirmwaren (kontrollbord.ino) — SAMMA display/LED-kod som Erik
// redan verifierat via serie — men matas nu av MQTT i stället för serie-kommandon.
//
// LÖSNING A (benchId): identisk kod på alla fyra bänkar, enda skillnaden är
// raden BENCH_ID nedan. Bygg/flasha en gång per bänk med rätt id:
//     eco1 = Åker/Oxen · eco2 = Skog/Björnen · eco3 = Tundra/Räven · eco4 = Stad/Örnen
//   (måste matcha spelets BENCH-karta i src/mqtt.js OCH den fysiska placeringen.)
//
// Prenumererar på  ecoloco/<BENCH_ID>/#  och driver:
//   …/money      → Money-displayen (0x11)        …/resources → Resources (0x12)
//   …/winner  1  → LED-logga GRÖN (laget leder)   …/looser 1 → LED-logga GUL (klimatbov)
//   (winner & looser = 0) → LED-logga VIT (normal)
//   …/displaymoney, …/displayresources → ignoreras (no-op i firmware)
//
// NÄTVERK: WiFi (speglar den beprövade rigg-firmwaren rigg_arduino.ino).
//   Vill ni köra TRÅDBUNDET (W5500/ETH) i stället — se block "ALTERNATIV: ETH" nedan.
//
// Bibliotek: Adafruit NeoPixel + PubSubClient (Bibliotekshanteraren).
// Kort: "ESP32S3 Dev Module". USB CDC On Boot: Enabled. 115200 baud.
// ============================================================================

#include <Wire.h>
#include <Adafruit_NeoPixel.h>
#include <WiFi.h>
#include <PubSubClient.h>

// ---- PER BÄNK: ändra BARA denna rad (lösning A) ----------------------------
#define BENCH_ID   "eco1"          // eco1 / eco2 / eco3 / eco4

// ---- Nätverk + broker -----------------------------------------------------
#define WIFI_SSID   "DITT_WIFI"    // ← fyll i (committas aldrig med riktiga värden)
#define WIFI_PASS   "DITT_LOSEN"
#define MQTT_HOST   "192.168.0.23" // 2047-brokern
#define MQTT_PORT   1883

// ---- Hårdvara (Eriks spec, ESP32-S3-ETH — pinnar fria från W5500/SD) -------
#define LED_PIN        15
#define LEDS_PER_SIGN  32
#define NUM_SIGNS      2
#define NUM_LEDS       (LEDS_PER_SIGN * NUM_SIGNS)   // 64
#define I2C_SCL        16
#define I2C_SDA        18
#define MONEY_ADDR     0x11
#define RES_ADDR       0x12
#define I2C_HZ         100000
#define LED_TYPE       (NEO_GRBW + NEO_KHZ800)       // SK6812-RGBW; byt NEO_RGBW om färger fel
bool invertSeg = false;                              // true om displayen är true-kodad

Adafruit_NeoPixel strip(NUM_LEDS, LED_PIN, LED_TYPE);
WiFiClient net;
PubSubClient mqtt(net);
char subTopic[40];                                   // "ecoloco/<id>/#"
bool ledWinner = false, ledLooser = false;

// ---- 7-segment-font (EGBFA.DC, aktiv låg) — EXAKT Eriks tabell -------------
const uint8_t FONT[] = {
  0b01000100,0b11011110,0b00010101,0b10010100,0b10001110,0b10100100,0b00100100,0b11010110, // 0-7
  0b00000100,0b10000100,0b11111111,0b10111111,0b11110111,0b11111101,0b00000111,0b00100101, // 8,9,släck,-,-,-,P,E
  0b00101101,0b00001110,0b00111110,0b00111100,0b01111100,0b00111101,0b00111111,0b01101101, // t,H,n,o,u,c,r,L
  0b01100101,0b00011100,0b00101110,0b00000111 };                                            // C,d,h,F
#define CODE_BLANK 0x0A

void sendSeg(uint8_t addr, uint8_t s1, uint8_t s2, uint8_t s3, uint8_t s4) {
  if (invertSeg) { s1^=0xFF; s2^=0xFF; s3^=0xFF; s4^=0xFF; }
  Wire.beginTransmission(addr);
  Wire.write(s1); Wire.write(s2); Wire.write(s3); Wire.write(s4);
  Wire.endTransmission();
}
void showNumber(uint8_t addr, long v) {              // 0..9999, släckta inledande nollor
  if (v < 0) v = 0; if (v > 9999) v = 9999;
  uint8_t c[4] = { (uint8_t)(v%10), (uint8_t)((v/10)%10), (uint8_t)((v/100)%10), (uint8_t)((v/1000)%10) };
  bool lead = true;
  for (int i = 3; i >= 1; i--) { if (lead && c[i]==0) c[i]=CODE_BLANK; else lead=false; }
  sendSeg(addr, FONT[c[0]], FONT[c[1]], FONT[c[2]], FONT[c[3]]);   // siffra 1 (höger) först
}

// ---- LED-logga: vit normalt, grön = leder, gul = klimatbov ----------------
void setAll(uint8_t r,uint8_t g,uint8_t b,uint8_t w){ for(int i=0;i<NUM_LEDS;i++) strip.setPixelColor(i,strip.Color(r,g,b,w)); strip.show(); }
void ledWhite()  { setAll(0xFF,0x70,0x00,0xFF); }    // vitt i loggan
void ledGreen()  { setAll(0x00,0xFF,0x00,0x00); }    // leder
void ledYellow() { setAll(0xFF,0x30,0x00,0x00); }    // varning/klimatbov
void updateLeds() {                                  // prioritet: gul (varning) > grön > vit
  if (ledLooser) ledYellow(); else if (ledWinner) ledGreen(); else ledWhite();
}

// ---- MQTT-callback: ecoloco/<id>/<vad> ------------------------------------
void onMsg(char* topic, byte* payload, unsigned int len) {
  char buf[12]; unsigned int n = len < sizeof(buf)-1 ? len : sizeof(buf)-1;
  memcpy(buf, payload, n); buf[n] = 0;
  long val = atol(buf);
  String t(topic);
  int slash = t.lastIndexOf('/');
  String what = slash >= 0 ? t.substring(slash+1) : t;
  if      (what == "money")     showNumber(MONEY_ADDR, val);
  else if (what == "resources") showNumber(RES_ADDR,   val);
  else if (what == "winner")  { ledWinner = (buf[0]=='1'); updateLeds(); }
  else if (what == "looser")  { ledLooser = (buf[0]=='1'); updateLeds(); }
  // displaymoney / displayresources → medvetet no-op
}

void connectMqtt() {
  while (!mqtt.connected()) {
    String cid = String("bank-") + BENCH_ID;
    if (mqtt.connect(cid.c_str())) {
      mqtt.subscribe(subTopic);                      // ecoloco/<id>/#  (retained värden kommer direkt)
      Serial.print("[mqtt] ansluten + prenumererar "); Serial.println(subTopic);
    } else { Serial.print("[mqtt] fail rc="); Serial.println(mqtt.state()); delay(1000); }
  }
}
void connectWifi() {
  WiFi.mode(WIFI_STA); WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("[wifi] ansluter");
  while (WiFi.status() != WL_CONNECTED) { delay(400); Serial.print("."); }
  Serial.print(" OK, IP "); Serial.println(WiFi.localIP());
}

void setup() {
  Serial.begin(115200); delay(300);
  Serial.print("\nEco Loco kontrollbord (MQTT) — benchId="); Serial.println(BENCH_ID);
  Wire.begin(I2C_SDA, I2C_SCL, I2C_HZ);
  strip.begin(); strip.setBrightness(255); strip.clear(); strip.show();
  // kort självtest så man ser att hårdvaran lever innan nät kopplas
  ledWhite(); showNumber(MONEY_ADDR, 1); showNumber(RES_ADDR, 2);
  snprintf(subTopic, sizeof(subTopic), "ecoloco/%s/#", BENCH_ID);
  connectWifi();
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMsg);
  connectMqtt();
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) connectWifi();
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();
}

// ============================================================================
// ALTERNATIV: TRÅDBUNDET (W5500 / ETH) i stället för WiFi
// ----------------------------------------------------------------------------
// Kortet (ESP32-S3-ETH) har W5500-Ethernet på SPI. Rigg-firmwaren kör dock WiFi
// (beprövat), så WiFi ovan är "safe default". Vill ni ha trådbundet:
//   1) #include <ETH.h>  och ersätt WiFiClient net; med  NetworkClient net;
//   2) I setup(), byt connectWifi() mot ETH-init. W5500-pinnar på detta kort:
//        CS=GPIO14 · IRQ=GPIO10 · RST=GPIO9 · SCLK=GPIO13 · MISO=GPIO12 · MOSI=GPIO11
//      Exakt ETH.begin()-signatur skiljer sig mellan ESP32-core-versioner →
//      MÅSTE stämmas av mot Waveshares ESP32-S3-ETH Arduino-exempel (din core-version).
//   3) Vänta på ETH-link (WiFi.status-raderna i loop() byts mot ETH-koll).
//   Display/LED/MQTT-logiken ovan är OFÖRÄNDRAD — bara transportlagret byts.
// ============================================================================
