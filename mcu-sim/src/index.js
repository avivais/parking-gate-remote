const mqtt = require('mqtt');

// Environment variables with defaults
const MQTT_URL = process.env.MQTT_URL || 'mqtt://mosquitto:1883';
const MQTT_CMD_TOPIC = process.env.MQTT_CMD_TOPIC || 'pgr/mitspe6/gate/cmd';
const MQTT_ACK_TOPIC = process.env.MQTT_ACK_TOPIC || 'pgr/mitspe6/gate/ack';
const MQTT_STATUS_TOPIC = process.env.MQTT_STATUS_TOPIC || 'pgr/mitspe6/gate/status';
const MQTT_DEVICE_USERNAME = process.env.MQTT_DEVICE_USERNAME || 'pgr_device_mitspe6';
const MQTT_DEVICE_PASSWORD = process.env.MQTT_DEVICE_PASSWORD;
const MCU_DEVICE_ID = process.env.MCU_DEVICE_ID || 'mitspe6-gate-001';
const MCU_ACK_DELAY_MS = parseInt(process.env.MCU_ACK_DELAY_MS || '100', 10);
const MCU_ACK_MODE = process.env.MCU_ACK_MODE || 'success';
const MCU_STATUS_INTERVAL_MS = parseInt(process.env.MCU_STATUS_INTERVAL_MS || '5000', 10);
const MCU_FW_VERSION = process.env.MCU_FW_VERSION || 'sim-0.1.0';
const MCU_RSSI = parseInt(process.env.MCU_RSSI || '-65', 10);

if (!MQTT_DEVICE_PASSWORD) {
    console.error('ERROR: MQTT_DEVICE_PASSWORD is required');
    process.exit(1);
}

console.log('MCU Simulator starting...');
console.log(`MQTT URL: ${MQTT_URL}`);
console.log(`Device ID: ${MCU_DEVICE_ID}`);
console.log(`ACK Mode: ${MCU_ACK_MODE}`);
console.log(`ACK Delay: ${MCU_ACK_DELAY_MS}ms`);
console.log(`Status Interval: ${MCU_STATUS_INTERVAL_MS}ms`);

// Connect to MQTT broker
const client = mqtt.connect(MQTT_URL, {
    username: MQTT_DEVICE_USERNAME,
    password: MQTT_DEVICE_PASSWORD,
    clientId: `mcu-sim-${MCU_DEVICE_ID}-${Date.now()}`,
    reconnectPeriod: 5000,
    connectTimeout: 10000,
});

let statusInterval = null;

client.on('connect', () => {
    console.log('✓ Connected to MQTT broker');

    // Subscribe to command topic
    client.subscribe(MQTT_CMD_TOPIC, { qos: 1 }, (err) => {
        if (err) {
            console.error(`✗ Failed to subscribe to ${MQTT_CMD_TOPIC}:`, err);
            process.exit(1);
        }
        console.log(`✓ Subscribed to ${MQTT_CMD_TOPIC}`);

        // Start status heartbeat
        publishStatus();
        statusInterval = setInterval(publishStatus, MCU_STATUS_INTERVAL_MS);
    });
});

client.on('message', (topic, message) => {
    if (topic === MQTT_CMD_TOPIC) {
        handleCommand(message);
    }
});

client.on('error', (error) => {
    console.error('MQTT client error:', error);
});

client.on('close', () => {
    console.warn('MQTT client connection closed');
    if (statusInterval) {
        clearInterval(statusInterval);
        statusInterval = null;
    }
});

client.on('offline', () => {
    console.warn('MQTT client offline');
    if (statusInterval) {
        clearInterval(statusInterval);
        statusInterval = null;
    }
});

function handleCommand(message) {
    try {
        const command = JSON.parse(message.toString());
        console.log(`[CMD] Received command:`, JSON.stringify(command, null, 2));

        const { requestId, command: cmd, userId, issuedAt } = command;

        if (!requestId) {
            console.warn('[CMD] Missing requestId, ignoring command');
            return;
        }

        // Apply delay
        setTimeout(() => {
            processAck(requestId, cmd);
        }, MCU_ACK_DELAY_MS);
    } catch (error) {
        console.error('[CMD] Failed to parse command:', error);
    }
}

function processAck(requestId, cmd) {
    if (MCU_ACK_MODE === 'timeout') {
        console.log(`[ACK] Mode: timeout - NOT sending ACK for requestId: ${requestId}`);
        return;
    }

    if (MCU_ACK_MODE === 'jitter') {
        const jitterDelay = Math.floor(Math.random() * (6000 - 100 + 1)) + 100;
        console.log(`[ACK] Mode: jitter - delaying ACK by ${jitterDelay}ms for requestId: ${requestId}`);
        setTimeout(() => {
            sendAck(requestId, true);
        }, jitterDelay);
        return;
    }

    if (MCU_ACK_MODE === 'fail') {
        console.log(`[ACK] Mode: fail - sending error ACK for requestId: ${requestId}`);
        sendAck(requestId, false, 'SIM_FAIL');
        return;
    }

    // Default: success
    console.log(`[ACK] Mode: success - sending success ACK for requestId: ${requestId}`);
    sendAck(requestId, true);
}

function sendAck(requestId, ok, errorCode) {
    const ack = {
        requestId,
        ok,
    };

    if (!ok && errorCode) {
        ack.errorCode = errorCode;
    }

    client.publish(MQTT_ACK_TOPIC, JSON.stringify(ack), { qos: 1, retain: false }, (err) => {
        if (err) {
            console.error(`[ACK] Failed to publish ACK for requestId ${requestId}:`, err);
        } else {
            console.log(`[ACK] Published ACK:`, JSON.stringify(ack, null, 2));
        }
    });
}

function publishStatus() {
    const status = {
        deviceId: MCU_DEVICE_ID,
        online: true,
        updatedAt: Date.now(),
    };

    if (MCU_RSSI !== undefined && !isNaN(MCU_RSSI)) {
        status.rssi = MCU_RSSI;
    }

    if (MCU_FW_VERSION) {
        status.fwVersion = MCU_FW_VERSION;
    }

    client.publish(MQTT_STATUS_TOPIC, JSON.stringify(status), { qos: 1, retain: false }, (err) => {
        if (err) {
            console.error('[STATUS] Failed to publish status:', err);
        } else {
            console.log(`[STATUS] Published status:`, JSON.stringify(status, null, 2));
        }
    });
}

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down...');
    if (statusInterval) {
        clearInterval(statusInterval);
    }
    client.end();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down...');
    if (statusInterval) {
        clearInterval(statusInterval);
    }
    client.end();
    process.exit(0);
});

