// blandare_test — FRISTÅENDE bänktest av blandarens drivutgång. INGEN wifi, INGET MQTT.
// Syfte: Erik flashar detta på valfri Arduino/ESP32, kopplar in sitt drivsteg (MOSFET) + last,
// och bekräftar att utgången slår på/av innan något nätverk är inblandat. Lägsta rungen.
//
// UTGÅNGEN ÄR AKTIV HÖG: GPIO HIGH = PÅ (enklare drivsteg med MOSFET, enligt Erik).
// KNAPP-INGÅNGEN ÄR AKTIV LÅG: INPUT_PULLUP, tryck = GND (praktiskt för ingångar).
//
// Styr via:
//   * Serie-monitorn (115200 baud): 1 = PÅ, 0 = AV, t = toggla, p = puls 3 s
//   * (valfritt) knapp mot BUTTON_PIN och GND — varje tryck togglar
// Inbyggd LED speglar utgångens läge (yes/no) så man ser tillståndet även utan last inkopplad.

// ---------------- KONFIG (ändra här) ----------------
const int  OUT_PIN         = 8;      // GPIO till MOSFET-gaten (via gate-resistor). Uno/Nano: t.ex. 8. ESP32-S3: t.ex. 15.
const bool OUT_ACTIVE_HIGH = true;   // true = GPIO HIGH slår PÅ (MOSFET). false = aktiv låg.
const int  BUTTON_PIN      = -1;     // knapp mot GND (aktiv låg, INPUT_PULLUP). -1 = ingen knapp.
const unsigned long PULSE_MS = 3000; // längd på "p"-pulsen (ms)
// ----------------------------------------------------

#ifndef LED_BUILTIN
  #define LED_BUILTIN 2              // de flesta ESP32 har inbyggd LED på GPIO2; justera vid behov
#endif

bool outOn = false;
unsigned long pulseUntil = 0;
int lastButton = HIGH;

void applyOutput(bool on) {
  outOn = on;
  digitalWrite(OUT_PIN, (OUT_ACTIVE_HIGH ? on : !on) ? HIGH : LOW);
  digitalWrite(LED_BUILTIN, on ? HIGH : LOW);
  Serial.print(F("[blandare] utgang = "));
  Serial.println(on ? F("PA (yes)") : F("AV (no)"));
}

void setup() {
  Serial.begin(115200);
  delay(50);
  // Boot-säkert: lägg utgången AV innan pinnen blir OUTPUT (lasten ska inte rycka till vid start).
  digitalWrite(OUT_PIN, OUT_ACTIVE_HIGH ? LOW : HIGH);
  pinMode(OUT_PIN, OUTPUT);
  pinMode(LED_BUILTIN, OUTPUT);
  if (BUTTON_PIN >= 0) pinMode(BUTTON_PIN, INPUT_PULLUP);
  applyOutput(false);
  Serial.println(F("\n[blandare] banktest igang. Kommandon: 1=PA  0=AV  t=toggla  p=puls 3s"));
}

void loop() {
  // Serie-kommandon
  while (Serial.available()) {
    char c = Serial.read();
    if      (c == '1' || c == 'y') applyOutput(true);
    else if (c == '0' || c == 'n') applyOutput(false);
    else if (c == 't')             applyOutput(!outOn);
    else if (c == 'p') { applyOutput(true); pulseUntil = millis() + PULSE_MS; }
  }
  // Puls klar -> slå av
  if (pulseUntil && (long)(millis() - pulseUntil) >= 0) { pulseUntil = 0; applyOutput(false); }

  // Knapp (valfri, aktiv låg), enkel avstudsning
  if (BUTTON_PIN >= 0) {
    int b = digitalRead(BUTTON_PIN);
    if (b == LOW && lastButton == HIGH) { applyOutput(!outOn); delay(30); }
    lastButton = b;
  }
}
