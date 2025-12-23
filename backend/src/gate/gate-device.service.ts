import {
    Injectable,
    BadGatewayException,
    GatewayTimeoutException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IGateDeviceService } from './gate-device.interface';

export interface McuCallResult {
    ok: true;
}

export interface McuCallMetadata {
    attempted: boolean;
    timeout: boolean;
    retries: number;
}

@Injectable()
export class GateDeviceService implements IGateDeviceService {
    private readonly timeoutMs: number;
    private readonly retryCount: number;
    private readonly retryDelayMs: number;

    constructor(private readonly configService: ConfigService) {
        this.timeoutMs = this.configService.get<number>('MCU_TIMEOUT_MS', 5000);
        this.retryCount = this.configService.get<number>('MCU_RETRY_COUNT', 1);
        this.retryDelayMs = this.configService.get<number>(
            'MCU_RETRY_DELAY_MS',
            250,
        );
    }

    async openGate(
        requestId: string,
        userId: string,
    ): Promise<{ result: McuCallResult; metadata: McuCallMetadata }> {
        // Parameters are required by interface but unused in stub implementation
        void requestId;
        void userId;

        const metadata: McuCallMetadata = {
            attempted: true,
            timeout: false,
            retries: 0,
        };

        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= this.retryCount; attempt++) {
            if (attempt > 0) {
                metadata.retries = attempt;
                await this.delay(this.retryDelayMs);
            }

            try {
                const result = await this.callMcuWithTimeout();
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

    private async callMcuWithTimeout(): Promise<McuCallResult> {
        return Promise.race([
            this.simulateMcuCall(),
            this.createTimeoutPromise(),
        ]);
    }

    private async simulateMcuCall(): Promise<McuCallResult> {
        // Simulate MCU call with random delay between 100-500ms
        const delay = Math.floor(Math.random() * 400) + 100;

        await this.delay(delay);

        // Simulate occasional failures (5% chance)
        if (Math.random() < 0.05) {
            throw new BadGatewayException('שגיאה בתקשורת עם מכשיר השער');
        }

        return { ok: true };
    }

    private createTimeoutPromise(): Promise<never> {
        return new Promise((_, reject) => {
            setTimeout(() => {
                reject(
                    new GatewayTimeoutException(
                        'תקשורת עם מכשיר השער ארכה יותר מדי זמן',
                    ),
                );
            }, this.timeoutMs);
        });
    }

    private delay(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
