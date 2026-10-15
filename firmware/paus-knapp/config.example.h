#pragma once
// Kopiera denna fil till config.h och fyll i. config.h är gitignorad (inga hemligheter i git).
//   cp config.example.h config.h

// --- Nätverk ---
#define WIFI_SSID    "DITT_WIFI"
#define WIFI_PASS    "DITT_LOSEN"
#define MQTT_BROKER  "192.168.1.50"     // broker-lådans fasta IP (samma som riggen/servern)
#define MQTT_PORT    1883
#define MQTT_CLIENT  "ecoloco-paus-knapp"

// --- Knapp ---
// GPIO4 = icke-strapping, säker på både classic ESP32 och ESP32-S3.
// Arkadknapp mellan denna GPIO och GND. INPUT_PULLUP → ingen extern resistor.
#define BUTTON_PIN   4
#define DEBOUNCE_MS  50                 // avstudsningstid i ms
