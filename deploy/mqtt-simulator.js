#!/usr/bin/env node

/**
 * MQTT Device Simulator
 * Simulates the MCU device by listening for commands and sending ACKs
 */

const mqtt = require('mqtt');
const fs = require('fs');

// Configuration from environment or defaults
const MQTT_URL = process.env.MQTT_URL || 'mqtts://localhost:8883';
const MQTT_USERNAME = process.env.MQTT_USERNAME || 'pgr_device_mitspe6';
const MQTT_PASSWORD = process.env.MQTT_PASSWORD || 'CHANGE_ME';
const MQTT_CMD_TOPIC = process.env.MQTT_CMD_TOPIC || 'pgr/mitspe6/gate/cmd';
const MQTT_ACK_TOPIC = process.env.MQTT_ACK_TOPIC || 'pgr/mitspe6/gate/ack';
const MQTT_STATUS_TOPIC = process.env.MQTT_STATUS_TOPIC || 'pgr/mitspe6/gate/status';
const CA_CERT_PATH = process.env.CA_CERT_PATH || '/opt/parking-gate-remote/mqtt/certs/ca.crt';

console.log('MQTT Device Simulator Starting...');
console.log(`MQTT URL: ${MQTT_URL}`);
console.log(`Command Topic: ${MQTT_CMD_TOPIC}`);
console.log(`ACK Topic: ${MQTT_ACK_TOPIC}`);

// Read CA certificate if it exists
let caCert = null;
if (fs.existsSync(CA_CERT_PATH)) {
    try {
        caCert = fs.readFileSync(CA_CERT_PATH);
        console.log(`Loaded CA certificate from ${CA_CERT_PATH}`);
    } catch (err) {
        console.warn(`Warning: Could not read CA certificate: ${err.message}`);
    }
}

// MQTT connection options
const options = {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    clientId: `pgr-device-simulator-${Date.now()}`,
    reconnectPeriod: 5000,
    connectTimeout: 10000,
    rejectUnauthorized: false, // Accept self-signed certificates
    ...(caCert && { ca: caCert }),
};

// Connect to MQTT broker
const client = mqtt.connect(MQTT_URL, options);

client.on('connect', () => {
    console.log('✓ Connected to MQTT broker');

    // Subscribe to command topic
    client.subscribe(MQTT_CMD_TOPIC, (err) => {
        if (err) {
            console.error(`✗ Failed to subscribe to ${MQTT_CMD_TOPIC}:`, err);
            process.exit(1);
        }
        console.log(`✓ Subscribed to ${MQTT_CMD_TOPIC}`);
    });

    // Publish initial status
    publishStatus();

    // Publish status every 30 seconds
    setInterval(publishStatus, 30000);
});

client.on('message', (topic, message) => {
    if (topic === MQTT_CMD_TOPIC) {
        try {
            const cmd = JSON.parse(message.toString());
            console.log(`📨 Received command:`, cmd);

            // Send ACK after a short delay (simulating device processing)
            setTimeout(() => {
                const ack = {
                    requestId: cmd.requestId,
                    ok: true,
                    timestamp: Date.now(),
                };

                client.publish(MQTT_ACK_TOPIC, JSON.stringify(ack), (err) => {
                    if (err) {
                        console.error(`✗ Failed to publish ACK:`, err);
                    } else {
                        console.log(`✓ Sent ACK for requestId: ${cmd.requestId}`);
                    }
                });
            }, 100); // 100ms delay to simulate processing
        } catch (err) {
            console.error(`✗ Failed to parse command:`, err);
        }
    }
});

client.on('error', (err) => {
    console.error('✗ MQTT error:', err);
});

client.on('close', () => {
    console.log('⚠ MQTT connection closed');
});

client.on('offline', () => {
    console.log('⚠ MQTT client offline');
});

function publishStatus() {
    const status = {
        deviceId: 'simulator-device-001',
        online: true,
        updatedAt: Date.now(),
        rssi: -45,
        fwVersion: '1.0.0-simulator',
    };

    client.publish(MQTT_STATUS_TOPIC, JSON.stringify(status), (err) => {
        if (err) {
            console.error(`✗ Failed to publish status:`, err);
        } else {
            console.log(`✓ Published status: online=true`);
        }
    });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down simulator...');
    client.end();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down simulator...');
    client.end();
    process.exit(0);
});

console.log('Simulator running. Press Ctrl+C to stop.');

