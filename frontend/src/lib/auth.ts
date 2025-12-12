/* Device ID management */
import { v4 as uuidv4 } from "uuid";

const DEVICE_ID_KEY = "pgr_device_id";

export function getOrCreateDeviceId(): string {
    if (typeof window === "undefined") {
        return uuidv4();
    }

    let deviceId = localStorage.getItem(DEVICE_ID_KEY);

    if (!deviceId) {
        deviceId = uuidv4();
        localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }

    return deviceId;
}

