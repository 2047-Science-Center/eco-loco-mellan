// ============================================================================
// Eco Loco — kontrollbord (bänk) · ESP32-S3
// ----------------------------------------------------------------------------
// TESTFIRMWARE: flasha, öppna Seriell Monitor (115200), och verifiera hårdvaran
// utan nätverk. Du styr allt via textkommandon, t.ex:
//     money 30         → visar 30 på Money-displayen (0x11)
//     resources 128    → visar 128 på Resources-displayen (0x12)
//     led white        → tänder hela stripen i lagloggans vita
//     led green        → grönt (leder) · led yellow → gult (varning) · led off
//     money text Eco    (upp till 4 tecken) · resources text Loco
//     invert on|off    → invertera 7-seg (om displayen är true-kodad)
//     raw money 0x44 0x44 0x44 0x44   → skicka råa segment-bytes (font-debug)
//     scan             → I2C-skanning (ska hitta 0x11 och 0x12)
//     help
//
// Vid boot körs ett SJÄLVTEST: stripen sveper vit→grön→gul, displayerna visar
// "Eco "/"Loco" och sedan 1/2 (som Joels uppstart) — så du SER direkt att allt lever.
//
// Hårdvara (Eriks spec) — kort: Waveshare ESP32-S3-ETH (W5500):
//   LED-strip (RGBW, SK6812-typ): GPIO15, 2 skyltar à 32 LED = 64 totalt
//   I2C-displayer: SCL=GPIO16, SDA=GPIO18 · Money=0x11, Resources=0x12
//   OBS pinout: GPIO15/16/18 är FRIA på ESP32-S3-ETH — krockar ej med W5500
//   (Ethernet: GPIO9-14) eller SD-kortet (GPIO4-7). USB=19/20, UART=43/44.
//   Varje display tar 4 bytes: siffra 1 (längst till höger) .. siffra 4 (vänster)
//   Talet mappas till segment HÄR i ESP:n (skickas aldrig som decimalt värde).
//
// Kräver bibliotek: Adafruit NeoPixel (Bibliotekshanteraren). Kort: "ESP32S3 Dev Module".
// ============================================================================

#include <Wire.h>
#include <Adafruit_NeoPixel.h>

// ---- Konfiguration (ändra här vid behov) ----------------------------------
#define LED_PIN        15
#define LEDS_PER_SIGN  32
#define NUM_SIGNS      2
#define NUM_LEDS       (LEDS_PER_SIGN * NUM_SIGNS)   // 64
#define I2C_SCL        16
#define I2C_SDA        18
#define MONEY_ADDR     0x11
#define RES_ADDR       0x12
#define I2C_HZ         100000       // sänk till 50000 om långa kablar strular

// NeoPixel-färgordning: SK6812-RGBW är oftast GRBW. Ser färgerna fel ut → testa NEO_RGBW.
#define LED_TYPE       (NEO_GRBW + NEO_KHZ800)

// 7-seg aktiv-låg (0 = tänt segment) enligt Eriks tabell. Är displayen true-kodad
// (1 = tänt) → sätt `invert on` i seriell monitor, eller ändra default här till true.
bool invertSeg = false;

Adafruit_NeoPixel strip(NUM_LEDS, LED_PIN, LED_TYPE);

// ---- 7-segment-font (EGBFA.DC, aktiv låg) — EXAKT Eriks tabell -------------
// Bitordning MSB→LSB: E G B F A . D C   (bit 0 = tänt segment)
const uint8_t FONT[] = {
  0b01000100, // 0x00  '0'
  0b11011110, // 0x01  '1'
  0b00010101, // 0x02  '2'
  0b10010100, // 0x03  '3'
  0b10001110, // 0x04  '4'
  0b10100100, // 0x05  '5'
  0b00100100, // 0x06  '6'
  0b11010110, // 0x07  '7'
  0b00000100, // 0x08  '8'
  0b10000100, // 0x09  '9'
  0b11111111, // 0x0A  (släckt)
  0b10111111, // 0x0B  '-' mittenstreck
  0b11110111, // 0x0C  högt streck
  0b11111101, // 0x0D  lågt streck
  0b00000111, // 0x0E  'P'
  0b00100101, // 0x0F  'E'
  0b00101101, // 0x10  't'
  0b00001110, // 0x11  'H'
  0b00111110, // 0x12  'n'
  0b00111100, // 0x13  'o'
  0b01111100, // 0x14  'u'
  0b00111101, // 0x15  'c'
  0b00111111, // 0x16  'r'
  0b01101101, // 0x17  'L'
  0b01100101, // 0x18  'C'
  0b00011100, // 0x19  'd'
  0b00101110, // 0x1A  'h'
  0b00000111, // 0x1B  'F'
};
#define CODE_BLANK 0x0A

// Tecken → font-kod. Okänt tecken → släckt.
uint8_t charToCode(char c) {
  if (c >= '0' && c <= '9') return c - '0';
  switch (c) {
    case ' ': return 0x0A;
    case '-': return 0x0B;
    case 'P': case 'p': return 0x0E;
    case 'E': case 'e': return 0x0F;
    case 'T': case 't': return 0x10;
    case 'H':           return 0x11;
    case 'N': case 'n': return 0x12;
    case 'O': case 'o': return 0x13;
    case 'U': case 'u': return 0x14;
    case 'c':           return 0x15;   // liten c
    case 'C':           return 0x18;   // stor C
    case 'R': case 'r': return 0x16;
    case 'L': case 'l': return 0x17;
    case 'D': case 'd': return 0x19;
    case 'h':           return 0x1A;
    case 'F': case 'f': return 0x1B;
    default:            return 0x0A;   // släckt
  }
}

// ---- Display (I2C) ---------------------------------------------------------
// Skickar 4 bytes i ordning siffra 1 (höger) → siffra 4 (vänster).
void sendSeg(uint8_t addr, uint8_t s1, uint8_t s2, uint8_t s3, uint8_t s4) {
  if (invertSeg) { s1 ^= 0xFF; s2 ^= 0xFF; s3 ^= 0xFF; s4 ^= 0xFF; }
  Wire.beginTransmission(addr);
  Wire.write(s1); Wire.write(s2); Wire.write(s3); Wire.write(s4);
  uint8_t err = Wire.endTransmission();
  if (err) { Serial.print("  [I2C-fel "); Serial.print(err); Serial.print(" mot 0x");
             Serial.print(addr, HEX); Serial.println(" — svarar displayen?]"); }
}

// Visa ett heltal (0..9999) med släckta inledande nollor, men alltid minst "0".
void showNumber(uint8_t addr, long v) {
  if (v < 0) v = 0;
  if (v > 9999) v = 9999;
  uint8_t code[4];                       // code[0] = siffra 1 (höger)
  code[0] = v % 10;
  code[1] = (v / 10) % 10;
  code[2] = (v / 100) % 10;
  code[3] = (v / 1000) % 10;
  bool lead = true;                      // släck inledande nollor (vänster)
  for (int i = 3; i >= 1; i--) {
    if (lead && code[i] == 0) code[i] = CODE_BLANK;
    else lead = false;
  }
  sendSeg(addr, FONT[code[0]], FONT[code[1]], FONT[code[2]], FONT[code[3]]);
}

// Visa upp till 4 tecken, läst vänster→höger (t.ex. "Eco "). Skickas höger först.
void showText(uint8_t addr, const char* s) {
  char c[4] = { ' ', ' ', ' ', ' ' };   // c[0] = vänster
  for (int i = 0; i < 4 && s[i]; i++) c[i] = s[i];
  sendSeg(addr, FONT[charToCode(c[3])], FONT[charToCode(c[2])],
                FONT[charToCode(c[1])], FONT[charToCode(c[0])]);
}

// ---- LED-strip -------------------------------------------------------------
void setAll(uint8_t r, uint8_t g, uint8_t b, uint8_t w) {
  for (int i = 0; i < NUM_LEDS; i++) strip.setPixelColor(i, strip.Color(r, g, b, w));
  strip.show();
}
void setSign(int sign, uint8_t r, uint8_t g, uint8_t b, uint8_t w) {  // sign = 1 eller 2
  int lo = (sign == 2) ? LEDS_PER_SIGN : 0, hi = lo + LEDS_PER_SIGN;
  for (int i = lo; i < hi && i < NUM_LEDS; i++) strip.setPixelColor(i, strip.Color(r, g, b, w));
  strip.show();
}
// Lagloggans färger (Eriks värden):
void ledWhite(int s = 0)  { if (s) setSign(s, 0xFF, 0x70, 0x00, 0xFF); else setAll(0xFF, 0x70, 0x00, 0xFF); } // vitt i loggan
void ledGreen(int s = 0)  { if (s) setSign(s, 0x00, 0xFF, 0x00, 0x00); else setAll(0x00, 0xFF, 0x00, 0x00); } // leder
void ledYellow(int s = 0) { if (s) setSign(s, 0xFF, 0x30, 0x00, 0x00); else setAll(0xFF, 0x30, 0x00, 0x00); } // varning
void ledOff(int s = 0)    { if (s) setSign(s, 0, 0, 0, 0);             else setAll(0, 0, 0, 0); }

// ---- I2C-skanning ----------------------------------------------------------
void i2cScan() {
  Serial.println("I2C-skanning…");
  int n = 0;
  for (uint8_t a = 1; a < 127; a++) {
    Wire.beginTransmission(a);
    if (Wire.endTransmission() == 0) {
      Serial.print("  hittade enhet på 0x"); Serial.println(a, HEX); n++;
    }
  }
  if (!n) Serial.println("  (ingen enhet svarade — kolla SDA=18 / SCL=16 / ström / pullups)");
}

// ---- Självtest vid boot ----------------------------------------------------
void selfTest() {
  Serial.println("Självtest: LED-svep + display-text…");
  ledWhite();  delay(600);
  ledGreen();  delay(600);
  ledYellow(); delay(600);
  showText(MONEY_ADDR, "Eco ");
  showText(RES_ADDR,   "Loco");
  delay(1500);
  showNumber(MONEY_ADDR, 1);
  showNumber(RES_ADDR,   2);
  ledWhite();  // vila i lagloggans vita
  Serial.println("Självtest klart. Skriv 'help' för kommandon.");
}

// ---- Kommandotolk (seriell) ------------------------------------------------
long parseNum(const String& s) { return strtol(s.c_str(), nullptr, 0); }  // stödjer 0x..

uint8_t addrFor(const String& who) {
  if (who == "money")      return MONEY_ADDR;
  if (who == "resources" || who == "res") return RES_ADDR;
  return 0;
}

void printHelp() {
  Serial.println(F("Kommandon:"));
  Serial.println(F("  money <n> | resources <n>        visa tal (0-9999)"));
  Serial.println(F("  money text <abcd> | resources text <abcd>"));
  Serial.println(F("  led white|green|yellow|off       hela stripen"));
  Serial.println(F("  led <1|2> white|green|yellow|off en skylt"));
  Serial.println(F("  raw money|resources b1 b2 b3 b4  råa segment-bytes (0x.. ok)"));
  Serial.println(F("  invert on|off                    invertera 7-seg"));
  Serial.println(F("  scan                             I2C-skanning"));
  Serial.println(F("  test                             kör självtestet igen"));
}

void handleLine(String line) {
  line.trim();
  if (!line.length()) return;
  // dela upp i upp till 6 tokens
  String tok[6]; int n = 0;
  while (line.length() && n < 6) {
    int sp = line.indexOf(' ');
    if (sp < 0) { tok[n++] = line; break; }
    tok[n++] = line.substring(0, sp);
    line = line.substring(sp + 1); line.trim();
  }
  String cmd = tok[0]; cmd.toLowerCase();

  if (cmd == "help") { printHelp(); return; }
  if (cmd == "scan") { i2cScan(); return; }
  if (cmd == "test") { selfTest(); return; }

  if (cmd == "invert") { invertSeg = (tok[1] == "on"); Serial.print("invert = "); Serial.println(invertSeg ? "on" : "off"); return; }

  if (cmd == "led") {
    // 'led <färg>' eller 'led <1|2> <färg>'
    int sign = 0; String col = tok[1];
    if (tok[1] == "1" || tok[1] == "2") { sign = tok[1].toInt(); col = tok[2]; }
    col.toLowerCase();
    if (col == "white")  ledWhite(sign);
    else if (col == "green")  ledGreen(sign);
    else if (col == "yellow") ledYellow(sign);
    else if (col == "off")    ledOff(sign);
    else { Serial.println("  okänd färg (white/green/yellow/off)"); return; }
    Serial.print("LED "); if (sign) { Serial.print("skylt "); Serial.print(sign); Serial.print(" "); }
    Serial.println(col);
    return;
  }

  uint8_t addr = addrFor(cmd);
  if (addr) {
    if (tok[1] == "text") { showText(addr, tok[2].c_str()); Serial.print(cmd); Serial.print(" text '"); Serial.print(tok[2]); Serial.println("'"); return; }
    if (tok[1] == "raw")  { sendSeg(addr, parseNum(tok[2]), parseNum(tok[3]), parseNum(tok[4]), parseNum(tok[5])); Serial.println("raw skickat"); return; }
    long v = parseNum(tok[1]); showNumber(addr, v); Serial.print(cmd); Serial.print(" = "); Serial.println(v); return;
  }

  // alternativ: 'raw money b1..b4'
  if (cmd == "raw") {
    uint8_t a = addrFor(tok[1]);
    if (a) { sendSeg(a, parseNum(tok[2]), parseNum(tok[3]), parseNum(tok[4]), parseNum(tok[5])); Serial.println("raw skickat"); return; }
  }

  Serial.print("okänt kommando: "); Serial.println(cmd);
}

// ---- setup / loop ----------------------------------------------------------
void setup() {
  Serial.begin(115200);
  delay(300);
  Serial.println("\nEco Loco kontrollbord — testfirmware (ESP32-S3)");
  Wire.begin(I2C_SDA, I2C_SCL, I2C_HZ);
  strip.begin();
  strip.setBrightness(255);
  strip.clear(); strip.show();
  i2cScan();
  selfTest();
}

void loop() {
  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    handleLine(line);
  }
}
