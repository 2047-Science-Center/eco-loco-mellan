#pragma once
// Kopiera denna fil till config.h och fyll i. config.h är gitignorad (inga hemligheter i git).
//   cp src/config.example.h src/config.h

// --- Nätverk ---
#define WIFI_SSID    "DITT_WIFI"
#define WIFI_PASS    "DITT_LOSEN"
#define MQTT_BROKER  "192.168.1.50"   // broker-lådans fasta IP
#define MQTT_PORT    1883
#define MQTT_CLIENT  "rigg-esp"

// --- LED (WS2812B 60/m) ---
#define LED_PIN   5                   // NodeMCU D1 = GPIO5 (rymdlists pin).  ESP32: t.ex. 18.
#define NUM_LEDS  60                  // 1 m @ 60/m. Byt vid annan längd.

// Sidor = punktintervall (inklusive). 4 sidor på metern = 15 punkter var.
// DET ENDA du ändrar när antalet punkter ändras / slingan dras i kvadrat:
#define SIDE_STARTS { 0, 15, 30, 45 }
#define SIDE_ENDS   { 14, 29, 44, 59 }

// --- Spottar (relä av/på) ---
#define SPOT_PINS       { 14, 12, 13, 5 }   // NodeMCU D5 D6 D7 D1.  ESP32: byt till fria GPIO.
#define SPOT_ACTIVE_LOW true                // billig relämodul = true. LED-mock på pinnen = false.
