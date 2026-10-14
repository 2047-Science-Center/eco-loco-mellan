#pragma once
// config-s3-eth.h  →  KOPIERA till firmware/rigg_arduino/config.h och fyll i wifi + broker-IP.
//   cp overlamning-erik/config-s3-eth.h firmware/rigg_arduino/config.h
//
// MÅLKORT: Waveshare ESP32-S3-ETH (W5500). Pinnarna nedan UNDVIKER:
//   ethernet W5500  GPIO 9,10,11,12,13,14   · SD-kort  GPIO 4,5,6,7
//   USB  GPIO 19,20 · UART0  GPIO 43,44      · strapping  GPIO 0,3,45,46
// Flasha i Arduino IDE: Board = "ESP32S3 Dev Module", USB CDC On Boot = Enabled, 115200 baud.

// --- Nätverk (ÄNDRA DESSA TRE) ---
#define WIFI_SSID    "DITT_WIFI"
#define WIFI_PASS    "DITT_LOSEN"
#define MQTT_BROKER  "192.168.1.50"   // IP på datorn som kör mosquitto (broker). Se README.
#define MQTT_PORT    1883
#define MQTT_CLIENT  "rigg-esp"

// --- LED (WS2812B) — EN list, 8 logiska segment ---
#define LED_PIN   21                  // WS2812 DIN (data)
#define NUM_LEDS  60                  // bänk 1 m @ 60/m = 60; drift = större
#define AMBIENT_STARTS  { 0,  5, 10, 15 }   // 4 ambient à 5 LED  (index 0..19)
#define AMBIENT_ENDS    { 4,  9, 14, 19 }
#define ARROW_STARTS    { 20, 30, 40, 50 }  // 4 pilar à 10 LED   (index 20..59)
#define ARROW_ENDS      { 29, 39, 49, 59 }
#define ARROW_SWEEP_MS  800
#define ARROW_BAND      1.5
#define ARROW_DEFAULT_H 0
#define ARROW_DEFAULT_S 0
#define ARROW_DEFAULT_V 40

// --- Spot-reläer (VALFRIA — pil-segmenten i LED-listen gör samma "peka mot lag"-jobb) ---
#define SPOT_PINS       { 17, 16, 18, 15 }   // aker, skog, tundra, stad
#define SPOT_ACTIVE_LOW true                 // billig relämodul = true

// --- Saftblandare (relä/MOSFET, aktiv hög) ---
#define BLANDARE_PIN         42              // 255 = ej inkopplad (firmwaren hoppar över den)
#define BLANDARE_ACTIVE_HIGH true            // GPIO HIGH = PÅ
