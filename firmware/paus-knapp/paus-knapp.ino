/*
 * Eco Loco — PAUS-KNAPP (fristående ESP32) · Arduino-IDE-sketch
 * ===================================================================
 * DUM PUBLICERARE. En fysisk arkadknapp som pausar/startar spelet över
 * MQTT. Frånkopplad från Blocks/riggen — knappen pratar DIREKT med
 * spelservern. Ingen spel-logik här: vid varje tryck publiceras EN gång
 * till ecoloco/spel/pause med payload "t" (= toggla), så servern sköter
 * all mening (server/server.js: setPaused — "1"=pausa, "0"=fortsätt,
 * annat=toggla).
 *
 *   UT (knapp → server):
 *     ecoloco/spel/pause   "t"   vid varje nedtryck (server togglar)
 *
 * Knappen följer Färgkapsels/utmana-riggens beprövade mönster:
 * INPUT_PULLUP, tryck = LOW, tidsbaserad debounce. WiFi/MQTT-reconnect
 * speglar firmware/rigg_arduino.
 *
 * ARDUINO IDE:
 *   Kort:     "ESP32 Dev Module" (generisk ESP32; funkar även på ESP32-S3,
 *             välj då "ESP32S3 Dev Module" + USB CDC On Boot: Enabled)
 *   Bibliotek (Library Manager): PubSubClient
 *
 * Testa utan knapp: skicka 't' i seriemonitorn (= ett simulerat tryck).
 *
 * config.h (hemligheter, GITIGNORE:AD) krävs. Första gången:
 *   cp config.example.h config.h   (och fyll i WiFi/broker)
 */

#include <Arduino.h>
#include <PubSubClient.h>
#include "config.h"

#if defined(ESP8266)
  #include <ESP8266WiFi.h>
#else
  #include <WiFi.h>
#endif

// Topicen servern redan prenumererar på (server/server.js: attachGmChannel).
// Payload "t" = toggla (allt som inte är "1"/"0" togglar paus).
#define PAUSE_TOPIC   "ecoloco/spel/pause"
#define PAUSE_PAYLOAD "t"

// Inbyggd LED: visar wifi+MQTT-ansluten (lyser = klart att trycka).
// Vissa ESP32-kort saknar inbyggd LED → lämna oförändrat, skadar inget.
#ifndef LED_BUILTIN
  #define LED_BUILTIN 2
#endif

WiFiClient   wifiClient;
PubSubClient mqtt(wifiClient);

// knapp-debounce (Färgkapsel-/utmana-mönstret): aktiv-låg, tidsbaserad.
int lastReading = HIGH, btnState = HIGH;
unsigned long lastChange = 0;

void publishPause() {
  mqtt.publish(PAUSE_TOPIC, PAUSE_PAYLOAD);
  Serial.print(F("[paus] tryck -> ")); Serial.print(F(PAUSE_TOPIC));
  Serial.print(F(" ")); Serial.println(F(PAUSE_PAYLOAD));
}

void connectMqtt() {
  int tries = 0;
  while (!mqtt.connected() && tries++ < 5) {
    if (mqtt.connect(MQTT_CLIENT)) {
      Serial.println(F("[paus] MQTT connected"));
    } else {
      Serial.print(F("[paus] MQTT fail rc=")); Serial.println(mqtt.state());
      delay(1000);
    }
  }
}

void setStatusLed() {
  // LED PÅ endast när både WiFi och MQTT är uppe.
  bool ok = (WiFi.status() == WL_CONNECTED) && mqtt.connected();
  digitalWrite(LED_BUILTIN, ok ? HIGH : LOW);
}

void setup() {
  Serial.begin(115200);
  delay(50);
  Serial.println(F("\n[paus] start"));

  pinMode(BUTTON_PIN, INPUT_PULLUP);
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, LOW);

  WiFi.mode(WIFI_STA);
  // Stäng av wifi-strömsparläget → lägre latens, stabilare reconnect (som rigg_arduino).
#if defined(ESP8266)
  WiFi.setSleepMode(WIFI_NONE_SLEEP);
#else
  WiFi.setSleep(false);
#endif
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  unsigned long t0 = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t0 < 20000) { delay(200); Serial.print("."); }
  if (WiFi.status() == WL_CONNECTED) { Serial.print(F("\n[paus] WiFi OK, IP ")); Serial.println(WiFi.localIP()); }
  else Serial.println(F("\n[paus] WiFi FAILED — kollar igen i loop"));

  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
}

void readButton() {
  int reading = digitalRead(BUTTON_PIN);
  if (reading != lastReading) { lastChange = millis(); lastReading = reading; }
  if (millis() - lastChange > DEBOUNCE_MS && reading != btnState) {
    btnState = reading;
    if (btnState == LOW) publishPause();   // nedtryck (aktiv-låg) = EN publicering
  }
}

void loop() {
  if (WiFi.status() != WL_CONNECTED) { WiFi.reconnect(); delay(200); }
  if (!mqtt.connected()) connectMqtt();
  mqtt.loop();

  // seriemonitor-trigger: 't' = simulerat tryck (test utan knapp)
  while (Serial.available()) { char k = Serial.read(); if (k == 't' || k == 'T') publishPause(); }

  readButton();
  setStatusLed();
  yield();
}
