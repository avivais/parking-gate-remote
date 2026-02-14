const mqtt = require('mqtt');

// Environment variables with defaults
// Use container name when running separately, service name when using both compose files together
const MQTT_URL = process.env.MQTT_URL || 'mqtt://parking-mosquitto:1883';
const MQTT_CMD_TOPIC = process.env.MQTT_CMD_TOPIC || 'pgr/mitspe6/gate/cmd';
const MQTT_ACK_TOPIC = process.env.MQTT_ACK_TOPIC || 'pgr/mitspe6/gate/ack';
const MQTT_STATUS_TOPIC = process.env.MQTT_STATUS_TOPIC || 'pgr/mitspe6/gate/status';
const MQTT_DIAGNOSTICS_TOPIC = process.env.MQTT_DIAGNOSTICS_TOPIC || 'pgr/mitspe6/gate/diagnostics';
const MQTT_DEVICE_USERNAME = process.env.MQTT_DEVICE_USERNAME || 'pgr_device_mitspe6';
const MQTT_DEVICE_PASSWORD = process.env.MQTT_DEVICE_PASSWORD;
const MCU_DEVICE_ID = process.env.MCU_DEVICE_ID || 'mitspe6-gate-001';
const MCU_ACK_DELAY_MS = parseInt(process.env.MCU_ACK_DELAY_MS || '100', 10);
const MCU_ACK_MODE = process.env.MCU_ACK_MODE || 'success';
const MCU_STATUS_INTERVAL_MS = parseInt(process.env.MCU_STATUS_INTERVAL_MS || '5000', 10);
const MCU_FW_VERSION = process.env.MCU_FW_VERSION || 'sim-0.1.0';
const MCU_RSSI = parseInt(process.env.MCU_RSSI || '-65', 10);
const MCU_DIAGNOSTICS_ON_RECONNECT = process.env.MCU_DIAGNOSTICS_ON_RECONNECT === 'true' || process.env.MCU_DIAGNOSTICS_ON_RECONNECT === '1';
const MCU_DISCONNECT_AFTER_MS = process.env.MCU_DISCONNECT_AFTER_MS ? parseInt(process.env.MCU_DISCONNECT_AFTER_MS, 10) : null;
const MCU_SESSION_ID = process.env.MCU_SESSION_ID || `sim-${Date.now()}`;

if (!MQTT_DEVICE_PASSWORD) {
    console.error('ERROR: MQTT_DEVICE_PASSWORD is required');
    process.exit(1);
}

// Wait for MQTT broker to be ready (when running separately)
async function waitForBroker(maxAttempts = 30, delayMs = 1000) {
    console.log(`Waiting for MQTT broker at ${MQTT_URL}...`);

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            // Try to create a test connection
            const testClient = mqtt.connect(MQTT_URL, {
                username: MQTT_DEVICE_USERNAME,
                password: MQTT_DEVICE_PASSWORD,
                clientId: `mcu-sim-test-${Date.now()}`,
                connectTimeout: 2000,
            });

            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => {
                    testClient.end();
                    reject(new Error('Connection timeout'));
                }, 2000);

                testClient.on('connect', () => {
                    clearTimeout(timeout);
                    testClient.end();
                    resolve();
                });

                testClient.on('error', (err) => {
                    clearTimeout(timeout);
                    testClient.end();
                    reject(err);
                });
            });

            console.log('✓ MQTT broker is ready');
            return;
        } catch (error) {
            if (attempt < maxAttempts) {
                console.log(`  Attempt ${attempt}/${maxAttempts} failed, retrying in ${delayMs}ms...`);
                await new Promise(resolve => setTimeout(resolve, delayMs));
            } else {
                console.error(`✗ Failed to connect to MQTT broker after ${maxAttempts} attempts`);
                throw error;
            }
        }
    }
}

// Main function
async function main() {
    console.log('MCU Simulator starting...');
    console.log(`MQTT URL: ${MQTT_URL}`);
    console.log(`Device ID: ${MCU_DEVICE_ID}`);
    console.log(`ACK Mode: ${MCU_ACK_MODE}`);
    console.log(`ACK Delay: ${MCU_ACK_DELAY_MS}ms`);
    console.log(`Status Interval: ${MCU_STATUS_INTERVAL_MS}ms`);
    if (MCU_DIAGNOSTICS_ON_RECONNECT) console.log('Diagnostics on reconnect: enabled');
    if (MCU_DISCONNECT_AFTER_MS != null) console.log(`Disconnect after: ${MCU_DISCONNECT_AFTER_MS}ms (e2e)`);

    // Wait for broker to be ready (when running separately)
    try {
        await waitForBroker();
    } catch (error) {
        console.error('Failed to connect to MQTT broker:', error.message);
        process.exit(1);
    }

    // Connect to MQTT broker
    const client = mqtt.connect(MQTT_URL, {
        username: MQTT_DEVICE_USERNAME,
        password: MQTT_DEVICE_PASSWORD,
        clientId: `mcu-sim-${MCU_DEVICE_ID}-${Date.now()}`,
        reconnectPeriod: 5000,
        connectTimeout: 10000,
    });

    let statusInterval = null;
    let connectionLostAt = null;
    let didScheduleDisconnect = false;

    function publishDiagnostics() {
        const entries = [];
        if (connectionLostAt != null) {
            entries.push({ ts: connectionLostAt, level: 'warn', event: 'connection_lost' });
        }
        entries.push({ ts: Date.now(), level: 'info', event: 'connection_restored' });

        const payload = {
            deviceId: MCU_DEVICE_ID,
            entries,
        };
        if (MCU_FW_VERSION) payload.fwVersion = MCU_FW_VERSION;
        if (MCU_SESSION_ID) payload.sessionId = MCU_SESSION_ID;

        client.publish(MQTT_DIAGNOSTICS_TOPIC, JSON.stringify(payload), { qos: 1, retain: false }, (err) => {
            if (err) {
                console.error('[DIAGNOSTICS] Failed to publish:', err);
            } else {
                console.log('[DIAGNOSTICS] Published on reconnect:', JSON.stringify(payload, null, 2));
            }
        });
        connectionLostAt = null;
    }

    client.on('connect', () => {
        console.log('✓ Connected to MQTT broker');

        if (MCU_DIAGNOSTICS_ON_RECONNECT) {
            publishDiagnostics();
        }

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

        if (MCU_DISCONNECT_AFTER_MS != null && MCU_DISCONNECT_AFTER_MS > 0 && !didScheduleDisconnect) {
            didScheduleDisconnect = true;
            console.log(`[SIM] Will voluntarily disconnect in ${MCU_DISCONNECT_AFTER_MS}ms for e2e testing`);
            setTimeout(() => {
                connectionLostAt = Date.now();
                console.log('[SIM] Voluntary disconnect (e2e mode)');
                client.end();
            }, MCU_DISCONNECT_AFTER_MS);
        }
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
        if (connectionLostAt == null) connectionLostAt = Date.now();
        if (statusInterval) {
            clearInterval(statusInterval);
            statusInterval = null;
        }
    });

    client.on('offline', () => {
        console.warn('MQTT client offline');
        if (connectionLostAt == null) connectionLostAt = Date.now();
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
}

// Start the simulator
main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
});
