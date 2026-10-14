// pin-finder.ino (omgång 3) — testar de sista otestade pinnarna: GPIO35/36/37.
// GPIO38 = kortets INBYGGDA RGB-ljus (kontroll: titta på själva kortet då).
//
// VIKTIGT innan flash: Tools -> PSRAM = DISABLED (standard). På ett R8-modul med PSRAM
// PÅ är 35/36/37 upptagna och detta kan hänga. Är PSRAM av (default) är de fria att testa.
//
// Board: ESP32S3 Dev Module · USB CDC On Boot: Enabled · 115200 baud.

#include <FastLED.h>

#define N 16
#define BRIGHT 70

CRGB leds[N];

const int PINS[]     = {   38,   35,   36,   37 };
const bool ONBOARD[] = { true, false,false,false };
const int NP = sizeof(PINS) / sizeof(PINS[0]);

void setup() {
  Serial.begin(115200);
  delay(400);
  Serial.println(F("\n\n[pin-finder v3] start — sista pinnarna 35/36/37"));
  Serial.println(F("GPIO38 = inbyggt ljus (titta på kortet). 35/36/37 = titta på stripen.\n"));

  FastLED.addLeds<WS2812B, 38, GRB>(leds, N);
  FastLED.addLeds<WS2812B, 35, GRB>(leds, N);
  FastLED.addLeds<WS2812B, 36, GRB>(leds, N);
  FastLED.addLeds<WS2812B, 37, GRB>(leds, N);
}

void loop() {
  static int idx = -1;
  static uint32_t t = 0;

  if (millis() - t > 2500) {
    if (idx >= 0) { fill_solid(leds, N, CRGB::Black); FastLED[idx].showLeds(BRIGHT); }
    idx = (idx + 1) % NP;
    t = millis();
    Serial.printf(">>>>>>  TESTAR NU GPIO %d  %s\n",
                  PINS[idx], ONBOARD[idx] ? "(INBYGGT ljus på kortet)" : "(stripen)");
  }

  fill_solid(leds, N, CRGB::White);
  FastLED[idx].showLeds(BRIGHT);
  delay(30);
}
