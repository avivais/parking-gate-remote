#include "Protocol.h"
#include <ArduinoJson.h>

bool Protocol::parseCommand(const char* json, CommandResult& result) {
    result.valid = false;

    // Parse JSON
    StaticJsonDocument<512> doc;
    DeserializationError error = deserializeJson(doc, json);

    if (error) {
        Serial.print("[Protocol] JSON parse error: ");
        Serial.println(error.c_str());
        return false;
    }

    // Validate and extract required fields
    if (!doc.containsKey("requestId") || !doc["requestId"].is<const char*>()) {
        Serial.println("[Protocol] Missing or invalid requestId");
        return false;
    }

    if (!doc.containsKey("command") || !doc["command"].is<const char*>()) {
        Serial.println("[Protocol] Missing or invalid command");
        return false;
    }

    if (!doc.containsKey("userId") || !doc["userId"].is<const char*>()) {
        Serial.println("[Protocol] Missing or invalid userId");
        return false;
    }

    // Check issuedAt - accept any numeric type (int64, uint64, or double)
    if (!doc.containsKey("issuedAt") || !doc["issuedAt"].is<long long>() && !doc["issuedAt"].is<unsigned long long>() && !doc["issuedAt"].is<double>()) {
        Serial.println("[Protocol] Missing or invalid issuedAt");
        return false;
    }

    // Copy fields
    strncpy(result.requestId, doc["requestId"].as<const char*>(), sizeof(result.requestId) - 1);
    result.requestId[sizeof(result.requestId) - 1] = '\0';

    strncpy(result.command, doc["command"].as<const char*>(), sizeof(result.command) - 1);
    result.command[sizeof(result.command) - 1] = '\0';

    strncpy(result.userId, doc["userId"].as<const char*>(), sizeof(result.userId) - 1);
    result.userId[sizeof(result.userId) - 1] = '\0';

    // Parse issuedAt - handle different numeric types
    if (doc["issuedAt"].is<unsigned long long>()) {
        result.issuedAt = doc["issuedAt"].as<unsigned long long>();
    } else if (doc["issuedAt"].is<long long>()) {
        result.issuedAt = static_cast<unsigned long long>(doc["issuedAt"].as<long long>());
    } else if (doc["issuedAt"].is<double>()) {
        result.issuedAt = static_cast<unsigned long long>(doc["issuedAt"].as<double>());
    } else {
        Serial.println("[Protocol] issuedAt is not a valid number");
        return false;
    }
    result.valid = true;

    return true;
}

void Protocol::createAck(const char* requestId, bool ok, const char* errorCode,
                        char* output, size_t outputSize) {
    StaticJsonDocument<256> doc;
    doc["requestId"] = requestId;
    doc["ok"] = ok;

    if (!ok && errorCode != nullptr) {
        doc["errorCode"] = errorCode;
    }

    serializeJson(doc, output, outputSize);
}

void Protocol::createStatus(const char* deviceId, bool online, unsigned long updatedAt,
                          int rssi, const char* fwVersion, char* output, size_t outputSize) {
    StaticJsonDocument<256> doc;
    doc["deviceId"] = deviceId;
    doc["online"] = online;
    doc["updatedAt"] = updatedAt;

    if (rssi != 0) {
        doc["rssi"] = rssi;
    }

    if (fwVersion != nullptr) {
        doc["fwVersion"] = fwVersion;
    }

    serializeJson(doc, output, outputSize);
}

