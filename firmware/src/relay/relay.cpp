#include "relay.h"

void Relay::init() {
    pinMode(RELAY_PIN, OUTPUT);
    digitalWrite(RELAY_PIN, LOW);
    Serial.print("[Relay] Initialized GPIO ");
    Serial.print(RELAY_PIN);
    Serial.println(" (LOW - safe state)");
}

bool Relay::activatePulse() {
    Serial.print("[Relay] Activating pulse on GPIO ");
    Serial.print(RELAY_PIN);
    Serial.print(" for ");
    Serial.print(RELAY_PULSE_MS);
    Serial.println("ms");

    digitalWrite(RELAY_PIN, HIGH);
    delay(RELAY_PULSE_MS);
    digitalWrite(RELAY_PIN, LOW);

    Serial.println("[Relay] Pulse completed, pin set to LOW");

    return true;
}

