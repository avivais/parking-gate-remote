#include "PppManager.h"

PppManager::PppManager(ModemManager* modemManager)
    : modemManager(modemManager), pppUp(false),
      pppFailStreak(0), pppStartTime(0), pppStarting(false) {
}

bool PppManager::start() {
    if (pppStarting || pppUp) {
        return pppUp;
    }

    Serial.println("[PPP] Starting PPP session...");

    // Note: Actual PPP connection is initiated via AT commands to modem
    // The modem should be configured to use PPP mode (AT+CGDCONT, AT+CGACT, etc.)
    // In a real implementation, you would:
    // 1. Send AT+CGDCONT to configure APN
    // 2. Send AT+CGACT=1 to activate PDP context
    // 3. Start PPP on the serial interface using ESP32 PPP API

    // For skeleton, send AT commands to configure PPP
    if (sendPppAtCommands()) {
        pppStarting = true;
        pppStartTime = millis();
        Serial.println("[PPP] PPP connection initiated");
        return true;
    } else {
        Serial.println("[PPP] Failed to configure PPP via AT commands");
        incrementFailStreak();
        return false;
    }
}

bool PppManager::sendPppAtCommands() {
    if (modemManager == nullptr) {
        Serial.println("[PPP] ModemManager not available");
        return false;
    }

    Serial.println("[PPP] Configuring APN for Cellcom Israel...");

    // Configure PDP context with APN (Cellcom: internetg)
    // AT+CGDCONT=1,"IP","internetg"
    char cgdcontCmd[64];
    snprintf(cgdcontCmd, sizeof(cgdcontCmd), "AT+CGDCONT=1,\"IP\",\"%s\"", CELLULAR_APN);

    if (!modemManager->sendATCommand(cgdcontCmd, "OK", AT_CMD_TIMEOUT_MS)) {
        Serial.println("[PPP] Failed to configure PDP context");
        return false;
    }
    Serial.println("[PPP] PDP context configured");

    // Activate PDP context
    // AT+CGACT=1,1
    if (!modemManager->sendATCommand("AT+CGACT=1,1", "OK", AT_CMD_TIMEOUT_MS)) {
        Serial.println("[PPP] Failed to activate PDP context");
        return false;
    }
    Serial.println("[PPP] PDP context activated");

    // Note: Actual PPP connection will be established by ESP32 PPP stack
    // using the serial interface from ModemManager::getSerial()

    return true;
}

void PppManager::stop() {
    if (!pppUp && !pppStarting) {
        return;
    }

    Serial.println("[PPP] Stopping PPP session...");

    // TODO: Send AT commands to deactivate PDP context
    // AT+CGACT=0 to deactivate

    pppUp = false;
    pppStarting = false;
    Serial.println("[PPP] PPP session stopped");
}

bool PppManager::waitForPppUp(unsigned long timeoutMs) {
    if (pppUp) {
        return true;
    }

    if (!pppStarting) {
        return false;
    }

    unsigned long now = millis();
    if (now - pppStartTime > timeoutMs) {
        Serial.println("[PPP] Timeout waiting for PPP to come up");
        stop();
        incrementFailStreak();
        return false;
    }

    // Check if IP is assigned
    if (checkIpAssigned()) {
        pppUp = true;
        pppStarting = false;
        resetPppFailStreak();
        Serial.println("[PPP] PPP is UP");
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
    // TODO: Implement proper PPP IP check using ESP32 network interface API
    // For now, this is a placeholder - in a real implementation, you would:
    // 1. Use esp_netif_get_ip_info() to get PPP interface IP
    // 2. Check if IP is valid (not 0.0.0.0)
    // For skeleton, we'll use a simple flag-based approach
    // This should be replaced with actual PPP interface checking
    return pppUp;
}

