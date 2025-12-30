#include "PppManager.h"
// TinyGSM is already included in PppManager.h

// Connection state machine
enum PppConnState {
    PPP_STATE_INIT,
    PPP_STATE_WAIT_SIM,
    PPP_STATE_WAIT_REGISTRATION,
    PPP_STATE_SET_APN,
    PPP_STATE_ACTIVATE_NETWORK,
    PPP_STATE_GET_IP,
    PPP_STATE_CONNECTED
};

static PppConnState connState = PPP_STATE_INIT;

PppManager::PppManager(ModemManager* modemManager)
    : modemManager(modemManager), pppUp(false),
      pppFailStreak(0), pppStartTime(0), pppStarting(false),
      tinyGsmModem(nullptr), tinyGsmClient(nullptr), modemSerial(nullptr) {
}

bool PppManager::start() {
    if (pppStarting || pppUp) {
        return pppUp;
    }

    Serial.println("[PPP] Starting PPP session with TinyGSM...");

    // Initialize TinyGSM
    if (!initializeTinyGsm()) {
        Serial.println("[PPP] Failed to initialize TinyGSM");
        incrementFailStreak();
        return false;
    }

    connState = PPP_STATE_INIT;
    pppStarting = true;
    pppStartTime = millis();
    Serial.println("[PPP] PPP connection initiated");
    return true;
}


void PppManager::stop() {
    if (!pppUp && !pppStarting) {
        return;
    }

    Serial.println("[PPP] Stopping PPP session...");

    // Disconnect network if TinyGSM is initialized
    if (tinyGsmModem != nullptr) {
        Serial.println("[PPP] Disconnecting network...");
        tinyGsmModem->gprsDisconnect();
        delay(500);
        yield();
    }

    // Deinitialize TinyGSM
    deinitializeTinyGsm();

    connState = PPP_STATE_INIT;
    pppUp = false;
    pppStarting = false;
    Serial.println("[PPP] PPP session stopped");
}

bool PppManager::waitForPppUp(unsigned long timeoutMs) {
    if (pppUp) {
        return true;
    }

    if (!pppStarting || tinyGsmModem == nullptr) {
        return false;
    }

    unsigned long now = millis();
    if (now - pppStartTime > timeoutMs) {
        Serial.println("[PPP] Timeout waiting for PPP to come up");
        stop();
        incrementFailStreak();
        return false;
    }

    // State machine matching POC flow
    // Note: ModemManager already verified modem works and saw +CPIN: READY at boot
    // So we skip SIM check and go straight to network registration
    switch (connState) {
        case PPP_STATE_INIT:
            Serial.println("[PPP] Skipping SIM check (ModemManager already verified)");
            Serial.println("[PPP] Starting network registration...");
            connState = PPP_STATE_WAIT_REGISTRATION;
            break;

        case PPP_STATE_WAIT_SIM:
            // Unused - kept for enum consistency
            connState = PPP_STATE_WAIT_REGISTRATION;
            break;

        case PPP_STATE_WAIT_REGISTRATION: {
            static unsigned long lastRegCheck = 0;
            if (now - lastRegCheck < 1000) {
                break;  // Check once per second
            }
            lastRegCheck = now;

            RegStatus status = tinyGsmModem->getRegistrationStatus();
            int16_t sq = tinyGsmModem->getSignalQuality();

            switch (status) {
                case REG_UNREGISTERED:
                case REG_SEARCHING:
                case REG_NO_RESULT:
                    Serial.printf("[PPP] Waiting for network registration... Signal: %d\n", sq);
                    break;
                case REG_DENIED:
                    Serial.println("[PPP] Network registration denied!");
                    return false;
                case REG_OK_HOME:
                    Serial.println("[PPP] Registered on home network");
                    connState = PPP_STATE_SET_APN;
                    break;
                case REG_OK_ROAMING:
                    Serial.println("[PPP] Registered (roaming)");
                    connState = PPP_STATE_SET_APN;
                    break;
                default:
                    Serial.printf("[PPP] Registration status: %d\n", status);
                    break;
            }
            break;
        }

        case PPP_STATE_SET_APN:
            Serial.print("[PPP] Setting APN: ");
            Serial.println(CELLULAR_APN);
            if (tinyGsmModem->setNetworkAPN(CELLULAR_APN)) {
                Serial.println("[PPP] APN set successfully");
                connState = PPP_STATE_ACTIVATE_NETWORK;
            } else {
                Serial.println("[PPP] Failed to set APN, retrying...");
                delay(1000);
            }
            break;

        case PPP_STATE_ACTIVATE_NETWORK: {
            Serial.println("[PPP] Activating network...");
            static int retryCount = 0;
            if (tinyGsmModem->setNetworkActive()) {
                Serial.println("[PPP] Network activated");
                delay(5000);  // Wait for IP assignment (like POC)
                yield();
                connState = PPP_STATE_GET_IP;
                retryCount = 0;
            } else {
                retryCount++;
                Serial.printf("[PPP] Network activation failed, retry %d/3...\n", retryCount);
                if (retryCount >= 3) {
                    Serial.println("[PPP] Network activation failed after 3 retries");
                    retryCount = 0;
                    return false;
                }
                delay(3000);
            }
            break;
        }

        case PPP_STATE_GET_IP: {
            String ipAddress = tinyGsmModem->getLocalIP();
            if (ipAddress.length() > 0 && ipAddress != "0.0.0.0") {
                Serial.print("[PPP] IP address: ");
                Serial.println(ipAddress);
                connState = PPP_STATE_CONNECTED;
                pppUp = true;
                pppStarting = false;
                resetPppFailStreak();
                Serial.println("[PPP] PPP is UP");
                return true;
            } else {
                // Retry getting IP
                static int ipRetry = 0;
                ipRetry++;
                if (ipRetry >= 5) {
                    Serial.println("[PPP] Failed to get IP after 5 retries");
                    ipRetry = 0;
                    return false;
                }
                Serial.printf("[PPP] Waiting for IP... retry %d/5\n", ipRetry);
                delay(2000);
            }
            break;
        }

        case PPP_STATE_CONNECTED:
            return true;
    }

    return false;
}

bool PppManager::isUp() const {
    // For skeleton implementation, just check the flag
    // TODO: In real implementation, check actual PPP interface status
    return pppUp;
}

uint8_t PppManager::getPppFailStreak() const {
    return pppFailStreak;
}

void PppManager::resetPppFailStreak() {
    if (pppFailStreak > 0) {
        Serial.print("[PPP] Resetting failure streak (was ");
        Serial.print(pppFailStreak);
        Serial.println(")");
    }
    pppFailStreak = 0;
}

void PppManager::incrementFailStreak() {
    pppFailStreak++;
    Serial.print("[PPP] Failure streak: ");
    Serial.println(pppFailStreak);

    if (shouldHardReset()) {
        Serial.println("[PPP] Failure threshold exceeded, will trigger modem hard reset");
    }
}

bool PppManager::shouldHardReset() const {
    return pppFailStreak >= PPP_FAILS_BEFORE_MODEM_RESET;
}

bool PppManager::checkIpAssigned() {
    if (tinyGsmModem == nullptr) {
        return false;
    }

    static unsigned long lastCheck = 0;
    unsigned long now = millis();

    // Only check every 2 seconds
    if (now - lastCheck < 2000) {
        return pppUp;
    }
    lastCheck = now;

    // Use TinyGSM to get IP address
    String ipAddress = tinyGsmModem->getLocalIP();
    if (ipAddress.length() > 0 && ipAddress != "0.0.0.0") {
        if (!pppUp) {
            Serial.print("[PPP] IP address assigned: ");
            Serial.println(ipAddress);
        }
        return true;
    }

    return false;
}

bool PppManager::initializeTinyGsm() {
    if (tinyGsmModem != nullptr) {
        return true;  // Already initialized
    }

    Serial.println("[PPP] Initializing TinyGSM...");

    // Get serial port from ModemManager
    modemSerial = modemManager->getSerial();
    if (modemSerial == nullptr) {
        Serial.println("[PPP] ERROR: Modem serial port not available");
        return false;
    }

    // Create TinyGSM modem instance (like POC: TinyGsm modem(SerialAT))
    tinyGsmModem = new TinyGsm(*modemSerial);
    if (tinyGsmModem == nullptr) {
        Serial.println("[PPP] ERROR: Failed to create TinyGSM modem");
        return false;
    }

    // Create TinyGsmClient instance (like POC: TinyGsmClient gsmClient(modem))
    tinyGsmClient = new TinyGsmClient(*tinyGsmModem);
    if (tinyGsmClient == nullptr) {
        Serial.println("[PPP] ERROR: Failed to create TinyGsmClient");
        delete tinyGsmModem;
        tinyGsmModem = nullptr;
        return false;
    }

    Serial.println("[PPP] TinyGSM initialized");
    return true;
}

void PppManager::deinitializeTinyGsm() {
    if (tinyGsmClient != nullptr) {
        delete tinyGsmClient;
        tinyGsmClient = nullptr;
    }

    if (tinyGsmModem != nullptr) {
        delete tinyGsmModem;
        tinyGsmModem = nullptr;
    }

    modemSerial = nullptr;
}

TinyGsm* PppManager::getModem() {
    return tinyGsmModem;
}

TinyGsmClient* PppManager::getClient() {
    return tinyGsmClient;
}

ModemManager* PppManager::getModemManager() {
    return modemManager;
}

