import {
    Injectable,
    BadGatewayException,
    GatewayTimeoutException,
    OnModuleInit,
    OnModuleDestroy,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import mqtt from 'mqtt';
import { IGateDeviceService } from './gate-device.interface';
import { McuCallResult, McuCallMetadata } from './gate-device.service';
import { DeviceStatus } from './schemas/device-status.schema';
import {
    DeviceDiagnosticLog,
} from './schemas/device-diagnostic-log.schema';

interface MqttCommandMessage {
    requestId: string;
    command: 'open';
    userId: string;
    issuedAt: number;
}

interface MqttAckMessage {
    requestId: string;
    ok: boolean;
    errorCode?: string;
}

interface PendingRequest {
    resolve: (result: McuCallResult) => void;
    reject: (error: Error) => void;
    timeout: NodeJS.Timeout;
    requestId: string;
    startTime: number;
}

@Injectable()
export class MqttGateDeviceService
    implements IGateDeviceService, OnModuleInit, OnModuleDestroy
{
    private readonly logger = new Logger(MqttGateDeviceService.name);
    private client: any = null;
    private readonly timeoutMs: number;
    private readonly retryCount: number;
    private readonly retryDelayMs: number;
    private readonly mqttUrl: string;
    private readonly mqttUsername: string;
    private readonly mqttPassword: string;
    private readonly cmdTopic: string;
    private readonly ackTopic: string;
    private readonly statusTopic: string;
    private readonly diagnosticsTopic: string;
    private readonly pendingRequests = new Map<string, PendingRequest>();
    private isConnected = false;
    private connectionPromise: Promise<void> | null = null;

    constructor(
        private readonly configService: ConfigService,
        @InjectModel(DeviceStatus.name)
        private readonly deviceStatusModel: Model<DeviceStatus>,
        @InjectModel(DeviceDiagnosticLog.name)
        private readonly deviceDiagnosticLogModel: Model<DeviceDiagnosticLog>,
    ) {
        this.timeoutMs = this.configService.get<number>('MCU_TIMEOUT_MS', 5000);
        this.retryCount = this.configService.get<number>('MCU_RETRY_COUNT', 1);
        this.retryDelayMs = this.configService.get<number>(
            'MCU_RETRY_DELAY_MS',
            250,
        );
        this.mqttUrl =
            this.configService.get<string>('MQTT_URL') ||
            'mqtt://localhost:1883';
        this.mqttUsername =
            this.configService.get<string>('MQTT_USERNAME') || 'pgr_server';
        this.mqttPassword =
            this.configService.get<string>('MQTT_PASSWORD') ||
            'pgr_dev_password_change_me';
        this.cmdTopic =
            this.configService.get<string>('MQTT_CMD_TOPIC') ||
            'pgr/mitspe6/gate/cmd';
        this.ackTopic =
            this.configService.get<string>('MQTT_ACK_TOPIC') ||
            'pgr/mitspe6/gate/ack';
        this.statusTopic =
            this.configService.get<string>('MQTT_STATUS_TOPIC') ||
            'pgr/mitspe6/gate/status';
        this.diagnosticsTopic =
            this.configService.get<string>('MQTT_DIAGNOSTICS_TOPIC') ||
            'pgr/mitspe6/gate/diagnostics';
    }

    async onModuleInit() {
        const mode = this.configService.get<string>('GATE_DEVICE_MODE', 'stub');
        if (mode !== 'mqtt') {
            return; // Skip MQTT connection when using stub
        }
        await this.connect();
    }

    async onModuleDestroy() {
        await this.disconnect();
    }

    private async connect(): Promise<void> {
        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        this.connectionPromise = new Promise<void>((resolve, reject) => {
            try {
                this.logger.log(`Connecting to MQTT broker at ${this.mqttUrl}`);

                // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                this.client = mqtt.connect(this.mqttUrl, {
                    username: this.mqttUsername,
                    password: this.mqttPassword,
                    clientId: `pgr-server-${Date.now()}`,
                    reconnectPeriod: 5000,
                    connectTimeout: 10000,
                    rejectUnauthorized: false, // Accept self-signed certificates for MQTT TLS
                });

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                this.client.on('connect', () => {
                    this.isConnected = true;
                    this.logger.log('MQTT client connected');

                    const topics = {
                        [this.ackTopic]: { qos: 1 },
                        [this.statusTopic]: { qos: 1 },
                        [this.diagnosticsTopic]: { qos: 1 },
                    };

                    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                    this.client!.subscribe(topics, (err: Error | null) => {
                        if (err) {
                            const errMessage =
                                err instanceof Error
                                    ? err.message
                                    : String(err);
                            this.logger.error(
                                `Failed to subscribe to topics: ${errMessage}`,
                            );
                            reject(
                                err instanceof Error
                                    ? err
                                    : new Error(String(err)),
                            );
                            return;
                        }
                        this.logger.log(
                            `Subscribed to topics: ${this.ackTopic}, ${this.statusTopic}, ${this.diagnosticsTopic}`,
                        );
                        resolve();
                    });
                });

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                this.client.on('message', (topic: string, message: Buffer) => {
                    this.handleMessage(topic, message);
                });

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                this.client.on('error', (error: Error) => {
                    this.logger.error(`MQTT client error: ${error.message}`);
                    this.isConnected = false;
                });

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                this.client.on('close', () => {
                    this.logger.warn('MQTT client connection closed');
                    this.isConnected = false;
                });

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                this.client.on('reconnect', () => {
                    this.logger.log('MQTT client reconnecting...');
                });

                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                this.client.on('offline', () => {
                    this.logger.warn('MQTT client offline');
                    this.isConnected = false;
                });
            } catch (error) {
                const err = error as Error;
                this.logger.error(
                    `Failed to create MQTT client: ${err.message}`,
                );
                reject(err);
            }
        });

        try {
            await this.connectionPromise;
        } catch (error) {
            this.connectionPromise = null;
            throw error;
        }
    }

    private async disconnect(): Promise<void> {
        // Clear all pending requests
        for (const [, pending] of this.pendingRequests.entries()) {
            clearTimeout(pending.timeout);
            pending.reject(
                new BadGatewayException('MQTT client disconnecting'),
            );
        }
        this.pendingRequests.clear();

        if (this.client) {
            return new Promise<void>((resolve) => {
                // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
                this.client!.end(false, {}, () => {
                    this.logger.log('MQTT client disconnected');
                    this.client = null;
                    this.isConnected = false;
                    this.connectionPromise = null;
                    resolve();
                });
            });
        }
    }

    private handleMessage(topic: string, message: Buffer): void {
        try {
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const payload = JSON.parse(message.toString());

            if (topic === this.ackTopic) {
                this.handleAckMessage(payload as MqttAckMessage);
            } else if (topic === this.statusTopic) {
                this.handleStatusMessage(payload).catch((error) => {
                    this.logger.error(
                        `Unhandled error in handleStatusMessage: ${error}`,
                    );
                });
            } else if (topic === this.diagnosticsTopic) {
                this.handleDiagnosticsMessage(payload).catch((error) => {
                    this.logger.error(
                        `Unhandled error in handleDiagnosticsMessage: ${error}`,
                    );
                });
            }
        } catch (error) {
            this.logger.warn(
                `Failed to parse message from topic ${topic}: ${error}`,
            );
        }
    }

    private handleAckMessage(ack: MqttAckMessage): void {
        const pending = this.pendingRequests.get(ack.requestId);
        if (!pending) {
            this.logger.debug(
                `Received ACK for unknown requestId: ${ack.requestId}`,
            );
            return;
        }

        clearTimeout(pending.timeout);
        this.pendingRequests.delete(ack.requestId);

        if (ack.ok) {
            const duration = Date.now() - pending.startTime;
            this.logger.log(
                `Received ACK for requestId ${ack.requestId} (duration: ${duration}ms)`,
            );
            pending.resolve({ ok: true });
        } else {
            const errorMsg = ack.errorCode
                ? `MCU error: ${ack.errorCode}`
                : 'MCU returned error';
            this.logger.warn(
                `Received error ACK for requestId ${ack.requestId}: ${errorMsg}`,
            );
            pending.reject(new BadGatewayException(errorMsg));
        }
    }

    private async handleStatusMessage(status: unknown): Promise<void> {
        try {
            this.logger.debug(`Received status message: ${JSON.stringify(status)}`);

            const statusPayload = status as {
                deviceId?: string;
                online?: boolean;
                updatedAt?: number;
                rssi?: number;
                fwVersion?: string;
                [key: string]: unknown;
            };

            // Validate required fields
            if (
                !statusPayload.deviceId ||
                typeof statusPayload.online !== 'boolean' ||
                !statusPayload.updatedAt ||
                typeof statusPayload.updatedAt !== 'number'
            ) {
                this.logger.warn(
                    `Invalid status message: missing required fields (deviceId, online, updatedAt). Received: ${JSON.stringify(status)}`,
                );
                return;
            }

            // Upsert device status
            await this.deviceStatusModel.findOneAndUpdate(
                { deviceId: statusPayload.deviceId },
                {
                    deviceId: statusPayload.deviceId,
                    online: statusPayload.online,
                    updatedAt: statusPayload.updatedAt,
                    lastSeenAt: new Date(),
                    rssi: statusPayload.rssi,
                    fwVersion: statusPayload.fwVersion,
                    raw: statusPayload,
                },
                { upsert: true, new: true },
            );

            this.logger.log(
                `Updated device status for ${statusPayload.deviceId}: online=${statusPayload.online}`,
            );
        } catch (error) {
            const err = error as Error;
            this.logger.error(
                `Failed to persist device status: ${err.message}`,
            );
        }
    }

    private async handleDiagnosticsMessage(payload: unknown): Promise<void> {
        try {
            const raw =
                typeof payload === 'string' ? payload : JSON.stringify(payload);
            this.logger.log(
                `Diagnostics received: ${raw.length} chars, deviceId=${(payload as { deviceId?: string })?.deviceId}, entries=${Array.isArray((payload as { entries?: unknown[] })?.entries) ? (payload as { entries: unknown[] }).entries.length : 0}`,
            );
            const body = payload as {
                deviceId?: string;
                fwVersion?: string;
                sessionId?: string;
                entries?: Array<{
                    ts: number;
                    level: string;
                    event: string;
                    message?: string;
                }>;
            };

            if (
                !body.deviceId ||
                typeof body.deviceId !== 'string' ||
                !Array.isArray(body.entries)
            ) {
                this.logger.warn(
                    `Invalid diagnostics message: missing deviceId or entries. Received: ${JSON.stringify(body).slice(0, 200)}`,
                );
                return;
            }

            const deviceId = String(body.deviceId).slice(0, 128);
            const levelToString = (v: unknown): string => {
                if (v === 0 || v === 'info') return 'info';
                if (v === 1 || v === 'warn') return 'warn';
                if (v === 2 || v === 'error') return 'error';
                return String(v).slice(0, 16);
            };
            const entries = body.entries
                .slice(0, 100)
                .filter(
                    (e): e is { ts: number; level: string; event: string; message?: string } =>
                        typeof e?.ts === 'number' &&
                        e?.event !== undefined &&
                        typeof e?.event === 'string',
                )
                .map((e) => ({
                    ts: e.ts,
                    level: levelToString(e.level as unknown).slice(0, 16),
                    event: String(e.event).slice(0, 64),
                    message:
                        e.message != null
                            ? String(e.message).slice(0, 256)
                            : undefined,
                }));

            if (entries.length === 0) {
                this.logger.warn('Diagnostics message had no valid entries');
                return;
            }

            await this.deviceDiagnosticLogModel.create({
                deviceId,
                receivedAt: new Date(),
                sessionId:
                    body.sessionId != null
                        ? String(body.sessionId).slice(0, 64)
                        : undefined,
                fwVersion:
                    body.fwVersion != null
                        ? String(body.fwVersion).slice(0, 32)
                        : undefined,
                entries,
            });

            this.logger.log(
                `Stored diagnostic log for ${deviceId}: ${entries.length} entries`,
            );
        } catch (error) {
            const err = error as Error;
            this.logger.error(
                `Failed to persist device diagnostic log: ${err.message}`,
            );
        }
    }

    async openGate(
        requestId: string,
        userId: string,
    ): Promise<{ result: McuCallResult; metadata: McuCallMetadata }> {
        const metadata: McuCallMetadata = {
            attempted: true,
            timeout: false,
            retries: 0,
        };

        // Ensure connected
        if (!this.isConnected || !this.client) {
            try {
                await this.connect();
            } catch (error) {
                const err = error as Error;
                this.logger.error(
                    `Failed to connect to MQTT broker: ${err.message}`,
                );
                throw new BadGatewayException(
                    'שגיאה בתקשורת עם השער: לא ניתן להתחבר ל-MQTT broker',
                );
            }
        }

        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= this.retryCount; attempt++) {
            if (attempt > 0) {
                metadata.retries = attempt;
                await this.delay(this.retryDelayMs);
            }

            try {
                const result = await this.publishCommandAndWaitForAck(
                    requestId,
                    userId,
                );
                return { result, metadata };
            } catch (error) {
                lastError = error as Error;

                if (error instanceof GatewayTimeoutException) {
                    metadata.timeout = true;
                    // On timeout, don't retry - throw immediately
                    throw error;
                }

                // For other errors, continue to retry if attempts remain
                if (attempt < this.retryCount) {
                    this.logger.warn(
                        `Retry ${attempt + 1}/${this.retryCount} for requestId ${requestId}`,
                    );
                    continue;
                }
            }
        }

        // All retries exhausted
        if (lastError instanceof GatewayTimeoutException) {
            throw lastError;
        }

        throw new BadGatewayException('שגיאה בתקשורת עם השער');
    }

    private publishCommandAndWaitForAck(
        requestId: string,
        userId: string,
    ): Promise<McuCallResult> {
        return new Promise<McuCallResult>((resolve, reject) => {
            if (!this.client || !this.isConnected) {
                reject(new BadGatewayException('MQTT client not connected'));
                return;
            }

            const command: MqttCommandMessage = {
                requestId,
                command: 'open',
                userId,
                issuedAt: Date.now(),
            };

            const timeout = setTimeout(() => {
                const pending = this.pendingRequests.get(requestId);
                if (pending) {
                    this.pendingRequests.delete(requestId);
                    pending.reject(
                        new GatewayTimeoutException(
                            'תקשורת עם השער ארכה יותר מדי זמן',
                        ),
                    );
                }
            }, this.timeoutMs);

            const pending: PendingRequest = {
                resolve,
                reject,
                timeout,
                requestId,
                startTime: Date.now(),
            };

            this.pendingRequests.set(requestId, pending);

            // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
            this.client.publish(
                this.cmdTopic,
                JSON.stringify(command),
                { qos: 1, retain: false },
                (error?: Error) => {
                    if (error) {
                        clearTimeout(timeout);
                        this.pendingRequests.delete(requestId);

                        const errorMessage =
                            error instanceof Error
                                ? error.message
                                : String(error);
                        this.logger.error(
                            `Failed to publish command for requestId ${requestId}: ${errorMessage}`,
                        );
                        reject(
                            new BadGatewayException(
                                'שגיאה בשליחת פקודה להשער',
                            ),
                        );
                        return;
                    }

                    this.logger.log(
                        `Published command '${command.command}' for requestId ${requestId} to topic ${this.cmdTopic}`,
                    );
                },
            );
        });
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
