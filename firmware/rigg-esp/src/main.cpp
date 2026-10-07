// Förstärkningsriggen — dum renderare. Lyssnar på granulära topics (lager 2 i RIGG-KONTRAKT.md)
// och ritar/animerar lokalt. All "mening" (öhälsa→färg, vilken sida per award) bor i hjärnan.
// Samma kod på ESP8266 (prototyp) och ESP32 (drift) via FastLED.

#include <Arduino.h>
#include <FastLED.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include "config.h"

#if defined(ESP8266)
  #include <ESP8266WiFi.h>
#else
  #include <WiFi.h>
#endif

CRGB leds[NUM_LEDS];
const int sideStarts[4] = SIDE_STARTS;
const int sideEnds[4]   = SIDE_ENDS;
const int spotPins[4]   = SPOT_PINS;

struct SideLook { float h=0, s=0, v=0, puls=0, blink=0; };
SideLook sideLook[4];
String fxMode = "none";
int    fxSpeed = 50;

WiFiClient wifiClient;
PubSubClient mqtt(wifiClient);

CRGB toRGB(float h, float s, float v) {
  return CHSV((uint8_t)(h * 255.0 / 360.0), (uint8_t)(s * 2.55), (uint8_t)(v * 2.55));
}
void setSpot(int i, bool on) {
  bool level = SPOT_ACTIVE_LOW ? !on : on;
  digitalWrite(spotPins[i], level ? HIGH : LOW);
}

// puls = mjuk sinus på v; blink = hård av/på. Högre värde = snabbare/djupare.
float modV(SideLook &L, unsigned long now) {
  if (L.blink > 0) {
    float period = max(140.0f, 520.0f - L.blink * 3.0f);
    return (((now / (unsigned long)period) % 2) == 0) ? L.v : 0;
  }
  if (L.puls > 0) {
    float amp = (L.puls / 100.0) * 0.6;
    float w = sinf(2 * PI * now / 1200.0) * 0.5 + 0.5;
    return L.v * (1 - amp) + L.v * amp * w;
  }
  return L.v;
}

void render() {
  unsigned long now = millis();

  // countdown = hela slingan vit, pulsar i lagom takt (~1 Hz). Överlagrar allt.
  if (fxMode == "countdown") {
    float v = 20 + (sinf(2 * PI * now / 900.0) * 0.5 + 0.5) * 80;
    fill_solid(leds, NUM_LEDS, toRGB(0, 0, v));
    FastLED.show();
    return;
  }

  // grundlook per sida
  for (int s = 0; s < 4; s++) {
    CRGB c = toRGB(sideLook[s].h, sideLook[s].s, modV(sideLook[s], now));
    for (int i = sideStarts[s]; i <= sideEnds[s] && i < NUM_LEDS; i++) leds[i] = c;
  }

  // wave = guld-komet som snurrar runt kvadraten (tombola). Lägs ovanpå grundlooken.
  if (fxMode == "wave") {
    float pxPerMs = 0.02 + (fxSpeed / 100.0) * 0.10;
    int head = ((int)(now * pxPerMs)) % NUM_LEDS;
    for (int o = 0; o < 6; o++) {
      int idx = (head - o + NUM_LEDS) % NUM_LEDS;
      uint8_t b = (uint8_t)(255 * (1.0 - o / 6.0));
      leds[idx] += CRGB(b, (uint8_t)(b * 0.7), (uint8_t)(b * 0.12));
    }
  }

  FastLED.show();
}

void onMsg(char *topic, byte *payload, unsigned int len) {
  String t(topic);
  char buf[256]; if (len > 255) len = 255; memcpy(buf, payload, len); buf[len] = 0;
  Serial.print(F("[rigg] ")); Serial.print(t); Serial.print(F(" <- ")); Serial.println(buf);

  if (t.startsWith("ecoloco/rigg/out/led/")) {
    int n = t.substring(21).toInt(); if (n < 1 || n > 4) return;
    JsonDocument d; if (deserializeJson(d, buf)) return;
    SideLook &L = sideLook[n - 1];
    L.h = d["h"] | 0.0f; L.s = d["s"] | 0.0f; L.v = d["v"] | 0.0f;
    L.puls = d["puls"] | 0.0f; L.blink = d["blink"] | 0.0f;
  } else if (t == "ecoloco/rigg/out/fx") {
    JsonDocument d; if (deserializeJson(d, buf)) return;
    fxMode = String((const char *)(d["fx"] | "none"));
    fxSpeed = d["speed"] | 50;
  } else if (t.startsWith("ecoloco/rigg/out/spot/")) {
    int n = t.substring(22).toInt(); if (n < 1 || n > 4) return;
    setSpot(n - 1, buf[0] == '1');
  }
}

void connectMqtt() {
  int tries = 0;
  while (!mqtt.connected() && tries++ < 5) {
    if (mqtt.connect(MQTT_CLIENT)) {
      Serial.println(F("[rigg] MQTT connected + subscribed"));
      mqtt.subscribe("ecoloco/rigg/out/led/+");
      mqtt.subscribe("ecoloco/rigg/out/fx");
      mqtt.subscribe("ecoloco/rigg/out/spot/+");
    } else { Serial.print(F("[rigg] MQTT fail rc=")); Serial.println(mqtt.state()); delay(1000); }
  }
}

void setup() {
  Serial.begin(115200);
  delay(50);
  Serial.println(F("\n[rigg] start"));
  FastLED.addLeds<WS2812B, LED_PIN, GRB>(leds, NUM_LEDS);
  FastLED.setBrightness(255);
  for (int i = 0; i < 4; i++) { pinMode(spotPins[i], OUTPUT); setSpot(i, false); }

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 20000) { delay(200); }
  if (WiFi.status() == WL_CONNECTED) { Serial.print(F("[rigg] WiFi OK, IP ")); Serial.println(WiFi.localIP()); }
  else Serial.println(F("[rigg] WiFi FAILED — kolla SSID/lösen"));

  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  mqtt.setCallback(onMsg);
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) { WiFi.reconnect(); delay(200); }
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();
  render();
  yield();   // håll ESP8266:s wifi-stack glad
}
