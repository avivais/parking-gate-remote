/* Token and device ID management */
import { v4 as uuidv4 } from "uuid";

const TOKEN_KEY = "pgr_access_token";
const DEVICE_ID_KEY = "pgr_device_id";

export function getToken(): string | null {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
    if (typeof window === "undefined") return;
    localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(TOKEN_KEY);
}

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
