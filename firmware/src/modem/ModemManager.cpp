#include "ModemManager.h"

ModemManager::ModemManager()
    : modemSerial(MODEM_UART_NUM), ready(false), initStartTime(0), initState(INIT_POWER_ON) {
    pinMode(MODEM_PWR_PIN, OUTPUT);
    pinMode(MODEM_RESET_PIN, OUTPUT);
    pinMode(MODEM_PWRKEY_PIN, OUTPUT);

    // Initialize pins to default states
    digitalWrite(MODEM_PWR_PIN, LOW);
    digitalWrite(MODEM_RESET_PIN, HIGH);  // Reset is active LOW
    digitalWrite(MODEM_PWRKEY_PIN, LOW);

    modemSerial.begin(MODEM_UART_BAUD, SERIAL_8N1, MODEM_RX_PIN, MODEM_TX_PIN);
}

bool ModemManager::init() {
    unsigned long now = millis();

    switch (initState) {
        case INIT_POWER_ON:
            Serial.println("[Modem] Powering on modem...");
            powerOn();
            initState = INIT_WAIT_POWER;
            initStartTime = now;
            break;

        case INIT_WAIT_POWER:
            // Wait for modem to boot (typically 3-5 seconds)
            if (now - initStartTime > 5000) {
                Serial.println("[Modem] Starting AT handshake...");
                flushSerial();
                initState = INIT_AT_HANDSHAKE;
                initStartTime = now;
            }
            break;

        case INIT_AT_HANDSHAKE:
            if (sendATCommand("AT", "OK", AT_CMD_TIMEOUT_MS)) {
                Serial.println("[Modem] AT handshake OK");
                initState = INIT_DISABLE_ECHO;
            } else if (now - initStartTime > AT_INIT_TIMEOUT_MS) {
                Serial.println("[Modem] AT handshake timeout");
                initState = INIT_POWER_ON;  // Retry from power on
                return false;
            }
            break;

        case INIT_DISABLE_ECHO:
            if (sendATCommand("ATE0", "OK", AT_CMD_TIMEOUT_MS)) {
                Serial.println("[Modem] Echo disabled");
                initState = INIT_QUERY_SIM;
            } else {
                Serial.println("[Modem] Failed to disable echo");
                initState = INIT_POWER_ON;
                return false;
            }
            break;

        case INIT_QUERY_SIM:
            if (sendATCommand("AT+CCID", "OK", AT_CMD_TIMEOUT_MS)) {
                Serial.println("[Modem] SIM query OK");
                initState = INIT_QUERY_NETWORK;
            } else {
                Serial.println("[Modem] SIM query failed (non-critical)");
                initState = INIT_QUERY_NETWORK;  // Continue anyway
            }
            break;

        case INIT_QUERY_NETWORK:
            if (sendATCommand("AT+CREG?", "OK", AT_CMD_TIMEOUT_MS)) {
                Serial.println("[Modem] Network registration query OK");
                initState = INIT_QUERY_RSSI;
            } else {
                Serial.println("[Modem] Network query failed (non-critical)");
                initState = INIT_QUERY_RSSI;  // Continue anyway
            }
            break;

        case INIT_QUERY_RSSI:
            if (sendATCommand("AT+CSQ", "OK", AT_CMD_TIMEOUT_MS)) {
                Serial.println("[Modem] Signal strength query OK");
                initState = INIT_COMPLETE;
            } else {
                Serial.println("[Modem] RSSI query failed (non-critical)");
                initState = INIT_COMPLETE;  // Continue anyway
            }
            break;

        case INIT_COMPLETE:
            ready = true;
            Serial.println("[Modem] Initialization complete");
            return true;
    }

    return false;
}

void ModemManager::powerCycle() {
    Serial.println("[Modem] Power cycling...");
    powerOff();
    delay(2000);
    powerOn();
    ready = false;
    initState = INIT_POWER_ON;
    initStartTime = 0;
}

void ModemManager::hardReset() {
    Serial.println("[Modem] Hard reset...");
    resetPin();
    delay(100);
    digitalWrite(MODEM_RESET_PIN, HIGH);
    delay(2000);
    ready = false;
    initState = INIT_POWER_ON;
    initStartTime = 0;
    flushSerial();
}

bool ModemManager::isReady() const {
    return ready;
}

HardwareSerial* ModemManager::getSerial() {
    return &modemSerial;
}

bool ModemManager::sendATCommand(const char* cmd, const char* expectedResponse, unsigned long timeoutMs) {
    flushSerial();
    modemSerial.print(cmd);
    modemSerial.print("\r\n");
    return waitForResponse(expectedResponse, timeoutMs);
}

bool ModemManager::waitForResponse(const char* expectedResponse, unsigned long timeoutMs) {
    unsigned long startTime = millis();
    String response = "";

    while (millis() - startTime < timeoutMs) {
        while (modemSerial.available()) {
            char c = modemSerial.read();
            response += c;

            // Check for expected response
            if (response.indexOf(expectedResponse) >= 0) {
                Serial.print("[Modem] Response: ");
                Serial.println(response);
                return true;
            }

            // Check for ERROR
            if (response.indexOf("ERROR") >= 0) {
                Serial.print("[Modem] Error response: ");
                Serial.println(response);
                return false;
            }
        }
        delay(10);
    }

    Serial.print("[Modem] Timeout waiting for: ");
    Serial.print(expectedResponse);
    Serial.print(", got: ");
    Serial.println(response);
    return false;
}

void ModemManager::powerOn() {
    digitalWrite(MODEM_PWR_PIN, HIGH);
    delay(100);
    digitalWrite(MODEM_PWRKEY_PIN, HIGH);
    delay(500);
    digitalWrite(MODEM_PWRKEY_PIN, LOW);
}

void ModemManager::powerOff() {
    digitalWrite(MODEM_PWR_PIN, LOW);
    digitalWrite(MODEM_PWRKEY_PIN, LOW);
}

void ModemManager::resetPin() {
    digitalWrite(MODEM_RESET_PIN, LOW);
}

void ModemManager::flushSerial() {
    while (modemSerial.available()) {
        modemSerial.read();
    }
}

