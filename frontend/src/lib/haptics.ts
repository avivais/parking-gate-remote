/* Simple haptics helpers with safe guards */

const supportsVibrate = () =>
    typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

export function light(): void {
    if (!supportsVibrate()) return;
    navigator.vibrate(10);
}

export function success(): void {
    if (!supportsVibrate()) return;
    navigator.vibrate([10, 30, 10]);
}

export function error(): void {
    if (!supportsVibrate()) return;
    navigator.vibrate([30, 40, 30]);
}


