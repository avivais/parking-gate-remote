#include "ModemManager.h"

ModemManager::ModemManager()
    : modemSerial(1), ready(false), initStartTime(0), initState(INIT_POWER_ON) {
    // Use Serial1 (UART 1) to match POC
    // Defer hardware initialization to avoid blocking in constructor
    // Hardware will be initialized in init() method
    // This prevents watchdog resets during object construction
}

bool ModemManager::init() {
    unsigned long now = millis();

    switch (initState) {
        case INIT_POWER_ON:
            // Initialize hardware on first call (deferred from constructor)
            // Follow the working POC sequence exactly
            Serial.println("[Modem] Initializing hardware...");
            Serial.flush();
            yield();

            // STEP 1: Initialize Serial FIRST (before GPIO) - matches POC
            Serial.println("[Modem] Initializing UART (Serial1)...");
            Serial.print("[Modem] TX: ");
            Serial.print(MODEM_TX_PIN);
            Serial.print(", RX: ");
            Serial.print(MODEM_RX_PIN);
            Serial.print(", Baud: ");
            Serial.println(MODEM_UART_BAUD);
            Serial.flush();
            yield();

            modemSerial.begin(MODEM_UART_BAUD, SERIAL_8N1, MODEM_RX_PIN, MODEM_TX_PIN);
            yield();
            delay(2000);  // Give modem time to start (matches POC)
            yield();

            Serial.println("[Modem] UART initialized");
            Serial.flush();
            yield();

            // STEP 2: Configure BOARD_POWERON_PIN (must be HIGH for modem power)
            #ifdef BOARD_POWERON_PIN
            Serial.println("[Modem] Setting BOARD_POWERON_PIN HIGH...");
            Serial.flush();
            yield();
            pinMode(BOARD_POWERON_PIN, OUTPUT);
            yield();
            digitalWrite(BOARD_POWERON_PIN, HIGH);
            yield();
            delay(100);
            yield();
            #endif

            // STEP 3: Reset modem sequence (matches POC)
            Serial.println("[Modem] Resetting modem...");
            Serial.flush();
            yield();
            pinMode(MODEM_RESET_PIN, OUTPUT);
            yield();
            digitalWrite(MODEM_RESET_PIN, !MODEM_RESET_LEVEL);
            yield();
            delay(100);
            yield();
            digitalWrite(MODEM_RESET_PIN, MODEM_RESET_LEVEL);
            yield();
            delay(2600);  // Matches POC delay
            yield();
            digitalWrite(MODEM_RESET_PIN, !MODEM_RESET_LEVEL);
            yield();
            delay(100);
            yield();

            // STEP 4: Set DTR pin LOW (prevents sleep state)
            #ifdef MODEM_DTR_PIN
            Serial.println("[Modem] Setting MODEM_DTR_PIN LOW...");
            Serial.flush();
            yield();
            pinMode(MODEM_DTR_PIN, OUTPUT);
            yield();
            digitalWrite(MODEM_DTR_PIN, LOW);
            yield();
            delay(100);
            yield();
            #endif

            // STEP 5: Power on sequence (matches POC)
            Serial.println("[Modem] Powering on modem...");
            Serial.flush();
            yield();
            pinMode(BOARD_PWRKEY_PIN, OUTPUT);
            yield();
            digitalWrite(BOARD_PWRKEY_PIN, LOW);
            yield();
            delay(100);
            yield();
            digitalWrite(BOARD_PWRKEY_PIN, HIGH);
            yield();
            delay(MODEM_POWERON_PULSE_WIDTH_MS);
            yield();
            digitalWrite(BOARD_PWRKEY_PIN, LOW);
            yield();
            delay(100);
            yield();

            Serial.println("[Modem] Hardware initialized, waiting for modem to boot...");
            Serial.flush();
            yield();

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

String ModemManager::sendATCommandGetResponse(const char* cmd, const char* expectedResponse, unsigned long timeoutMs) {
    flushSerial();
    modemSerial.print(cmd);
    modemSerial.print("\r\n");

    unsigned long startTime = millis();
    String response = "";

    while (millis() - startTime < timeoutMs) {
        while (modemSerial.available()) {
            char c = modemSerial.read();
            response += c;

            // Check for expected response
            if (response.indexOf(expectedResponse) >= 0) {
                // Continue reading until OK or ERROR
                delay(100);  // Wait for remaining data
                while (modemSerial.available()) {
                    response += (char)modemSerial.read();
                }
                return response;
            }

            // Check for ERROR
            if (response.indexOf("ERROR") >= 0) {
                return response;  // Return error response
            }
        }
        delay(10);
    }

    return response;  // Return whatever we got (may be empty on timeout)
}

void ModemManager::powerOn() {
    // Power on sequence matches POC
    // Note: BOARD_POWERON_PIN is set HIGH in init() sequence
    // This method is kept for compatibility but power-on is done in init()
    yield();
    digitalWrite(BOARD_PWRKEY_PIN, LOW);
    yield();
    delay(100);
    yield();
    digitalWrite(BOARD_PWRKEY_PIN, HIGH);
    yield();
    delay(MODEM_POWERON_PULSE_WIDTH_MS);
    yield();
    digitalWrite(BOARD_PWRKEY_PIN, LOW);
    yield();
}

void ModemManager::powerOff() {
    #ifdef BOARD_POWERON_PIN
    digitalWrite(BOARD_POWERON_PIN, LOW);
    #endif
    digitalWrite(BOARD_PWRKEY_PIN, LOW);
}

void ModemManager::resetPin() {
    digitalWrite(MODEM_RESET_PIN, !MODEM_RESET_LEVEL);
    delay(100);
    digitalWrite(MODEM_RESET_PIN, MODEM_RESET_LEVEL);
    delay(2600);  // Matches POC delay
    digitalWrite(MODEM_RESET_PIN, !MODEM_RESET_LEVEL);
}

void ModemManager::flushSerial() {
    while (modemSerial.available()) {
        modemSerial.read();
    }
}

