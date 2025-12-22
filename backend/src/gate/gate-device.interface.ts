import { McuCallResult, McuCallMetadata } from './gate-device.service';

export interface IGateDeviceService {
    openGate(
        requestId: string,
        userId: string,
    ): Promise<{ result: McuCallResult; metadata: McuCallMetadata }>;
}
