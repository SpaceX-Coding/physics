/* Six-zone toy-car light road: classic 5 V Arduino UNO R3 / Nano.
   Sensors: 3-pin, active-LOW, 5 V IR obstacle modules (VCC/GND/OUT).
   Every ordinary LED requires its OWN 470-ohm series resistor.
   Power the Arduino through USB; no external high-current LED supply.
   No libraries needed. Read the accompanying build guide first.
*/
const byte N = 6;
const byte sensorPins[N] = {2, 4, 7, 8, 12, A0};
const byte ledPins[N]    = {3, 5, 6, 9, 10, 11}; // Hardware PWM pins.

const bool TRAIL = true;    // false = light only while car is detected.
const unsigned long HOLD_MS = 150;
const unsigned long FADE_MS = 450; // Keep greater than zero.

unsigned long lastSeen[N] = {};
bool active[N] = {};

void setup() {
  for (byte i = 0; i < N; i++) {
    pinMode(sensorPins[i], INPUT_PULLUP);
    pinMode(ledPins[i], OUTPUT);
    analogWrite(ledPins[i], 0);
  }
}

void loop() {
  const unsigned long now = millis();
  for (byte i = 0; i < N; i++) {
    const bool detected = (digitalRead(sensorPins[i]) == LOW);
    byte brightness = 0;

    if (detected) {
      lastSeen[i] = now;
      active[i] = true;
      brightness = 255;
    } else if (TRAIL && active[i]) {
      const unsigned long age = now - lastSeen[i];
      if (age < HOLD_MS) {
        brightness = 255;
      } else if (age < HOLD_MS + FADE_MS) {
        brightness = (255UL * (HOLD_MS + FADE_MS - age)) / FADE_MS;
      } else {
        active[i] = false;
      }
    } else {
      active[i] = false;
    }

    analogWrite(ledPins[i], brightness);
  }
  // No delay: every zone is sampled repeatedly, including while others fade.
}
