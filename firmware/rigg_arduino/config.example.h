#pragma once
// Kopiera denna fil till config.h och fyll i. config.h är gitignorad (inga hemligheter i git).
//   cp src/config.example.h src/config.h

// --- Nätverk ---
#define WIFI_SSID    "DITT_WIFI"
#define WIFI_PASS    "DITT_LOSEN"
#define MQTT_BROKER  "192.168.1.50"   // broker-lådans fasta IP
#define MQTT_PORT    1883
#define MQTT_CLIENT  "rigg-esp"

// --- LED (WS2812B) — EN list, 8 logiska segment ---
#define LED_PIN   21                  // ESP32-S3: t.ex. 21. ESP8266 NodeMCU: D1 = GPIO5.
#define NUM_LEDS  60                  // sätt efter din faktiska list (bänk 1 m = 60; drift = större)

// 8 segment, ytterkoordinater i lysdiodsindex:
//   4 AMBIENT (led/1..4) = öhälso-/award-färg + fx-chase
//   4 PIL/chevron (spot/1..4) = ljusvåg som sveper inåt mot spetsen (segmentets MITT)
// Default för 60-LED 1m-test. Justera efter fysisk chevron-layout.
#define AMBIENT_STARTS  { 0,  5, 10, 15 }   // 4 ambient à 5 LED  (index 0..19)
#define AMBIENT_ENDS    { 4,  9, 14, 19 }
#define ARROW_STARTS    { 20, 30, 40, 50 }  // 4 pilar à 10 LED   (index 20..59, L jämnt)
#define ARROW_ENDS      { 29, 39, 49, 59 }
#define ARROW_SWEEP_MS  800                 // tid för svep ytterände → spets
#define ARROW_BAND      1.5                 // mjukt bands bredd (LED)
#define ARROW_DEFAULT_H 0                   // pil utan led/N-färg = vitt dämpat
#define ARROW_DEFAULT_S 0
#define ARROW_DEFAULT_V 40

// --- Spottar (relä av/på) ---
#define SPOT_PINS       { 14, 12, 13, 5 }   // NodeMCU D5 D6 D7 D1.  ESP32: byt till fria GPIO.
#define SPOT_ACTIVE_LOW true                // billig relämodul = true. LED-mock på pinnen = false.

// --- Saftblandare (på/av, EN kanal, AKTIV HÖG — driver MOSFET) ---
// 255 = ej inkopplad (firmwaren hoppar över den). Sätt en fri GPIO när drivsteget kopplas in.
// Förslag ESP32-S3-DevKitC-1: 15 (ligger intill spot-pinnarna 4-7 på underraden).
// GPIO HIGH = PÅ. VARNING: last-/nätsidan är Eriks drivsteg (MOSFET) — dimensioneras efter
// blandarens effekt (motorns startström/inrush), byggs in och säkras. Mjukvaran sätter bara pinnen.
#define BLANDARE_PIN         255
#define BLANDARE_ACTIVE_HIGH true
