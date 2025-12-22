import {
    Injectable,
    BadGatewayException,
    GatewayTimeoutException,
    OnModuleInit,
    OnModuleDestroy,
    Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as mqtt from 'mqtt';
import { IGateDeviceService } from './gate-device.interface';
import { McuCallResult, McuCallMetadata } from './gate-device.service';

interface MqttCommandMessage {
    requestId: string;
    command: 'open';
    userId: string;
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
    private client: mqtt.MqttClient | null = null;
    private readonly timeoutMs: number;
    private readonly retryCount: number;
    private readonly retryDelayMs: number;
    private readonly mqttUrl: string;
    private readonly mqttUsername: string;
    private readonly mqttPassword: string;
    private readonly cmdTopic: string;
    private readonly ackTopic: string;
    private readonly statusTopic: string;
    private readonly pendingRequests = new Map<string, PendingRequest>();
    private isConnected = false;
    private connectionPromise: Promise<void> | null = null;

    constructor(private readonly configService: ConfigService) {
        this.timeoutMs = this.configService.get<number>('MCU_TIMEOUT_MS', 2500);
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
    }

    async onModuleInit() {
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

                this.client = mqtt.connect(this.mqttUrl, {
                    username: this.mqttUsername,
                    password: this.mqttPassword,
                    clientId: `pgr-server-${Date.now()}`,
                    reconnectPeriod: 5000,
                    connectTimeout: 10000,
                });

                this.client.on('connect', () => {
                    this.isConnected = true;
                    this.logger.log('MQTT client connected');

                    // Subscribe to ACK and status topics
                    const topics: mqtt.ISubscriptionMap = {
                        [this.ackTopic]: { qos: 1 },
                        [this.statusTopic]: { qos: 1 },
                    };

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
                            `Subscribed to topics: ${this.ackTopic}, ${this.statusTopic}`,
                        );
                        resolve();
                    });
                });

                this.client.on('message', (topic: string, message: Buffer) => {
                    this.handleMessage(topic, message);
                });

                this.client.on('error', (error: Error) => {
                    this.logger.error(`MQTT client error: ${error.message}`);
                    this.isConnected = false;
                });

                this.client.on('close', () => {
                    this.logger.warn('MQTT client connection closed');
                    this.isConnected = false;
                });

                this.client.on('reconnect', () => {
                    this.logger.log('MQTT client reconnecting...');
                });

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
                this.handleStatusMessage(payload);
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
            this.logger.warn(
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

    private handleStatusMessage(status: unknown): void {
        // Log status messages but don't act on them for now
        this.logger.debug(`Received status message: ${JSON.stringify(status)}`);
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
                    'שגיאה בתקשורת עם מכשיר השער: לא ניתן להתחבר ל-MQTT broker',
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

        throw new BadGatewayException('שגיאה בתקשורת עם מכשיר השער');
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
            };

            const timeout = setTimeout(() => {
                const pending = this.pendingRequests.get(requestId);
                if (pending) {
                    this.pendingRequests.delete(requestId);
                    pending.reject(
                        new GatewayTimeoutException(
                            'תקשורת עם מכשיר השער ארכה יותר מדי זמן',
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
                                'שגיאה בשליחת פקודה למכשיר השער',
                            ),
                        );
                        return;
                    }

                    this.logger.log(
                        `Published command for requestId ${requestId} to topic ${this.cmdTopic}`,
                    );
                },
            );
        });
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
