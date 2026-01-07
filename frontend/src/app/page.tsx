"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { apiRequest, ApiError, AUTH_UNAUTHORIZED, AUTH_FORBIDDEN } from "@/lib/api";
import { GateButton } from "@/components/GateButton";
import * as haptics from "@/lib/haptics";
import toast from "react-hot-toast";
import type { DeviceStatusResponse } from "@/types/auth";

type FeedbackState = "idle" | "loading" | "success" | "error";

export default function HomePage() {
    const router = useRouter();
    const { user, loading, isReady } = useAuth();
    const [status, setStatus] = useState<FeedbackState>("idle");
    const [isOffline, setIsOffline] = useState(false);
    const [deviceOnline, setDeviceOnline] = useState<boolean | null>(null);

    // Browser offline detection
    useEffect(() => {
        const updateOnlineStatus = () => {
            setIsOffline(!navigator.onLine);
        };

        updateOnlineStatus();
        window.addEventListener("online", updateOnlineStatus);
        window.addEventListener("offline", updateOnlineStatus);

        return () => {
            window.removeEventListener("online", updateOnlineStatus);
            window.removeEventListener("offline", updateOnlineStatus);
        };
    }, []);

    // Check gate device status
    useEffect(() => {
        const checkDeviceStatus = async () => {
            try {
                const data = await apiRequest<DeviceStatusResponse>("/admin/device-status");
                // Check if any device is truly online
                // Device must be marked online AND seen within last 60 seconds
                const now = Date.now();
                const STALE_THRESHOLD_MS = 60000; // 60 seconds
                const anyOnline = data.items.some(device => {
                    if (!device.online) return false;
                    const lastSeen = new Date(device.lastSeenAt).getTime();
                    return (now - lastSeen) < STALE_THRESHOLD_MS;
                });
                setDeviceOnline(anyOnline);
            } catch {
                // If API fails, assume unknown status
                setDeviceOnline(null);
            }
        };

        // Check immediately and then every 5 seconds
        checkDeviceStatus();
        const interval = setInterval(checkDeviceStatus, 5000);

        return () => clearInterval(interval);
    }, []);

    const handleOpenGate = useCallback(async () => {
        if (status === "loading" || isOffline) return;

        haptics.light();
        setStatus("loading");

        try {
            await apiRequest("/gate/open", { method: "POST" });

            haptics.success();
            toast.success("השער נפתח");
            setStatus("success");
            setTimeout(() => setStatus("idle"), 2000);
        } catch (err) {
            haptics.error();

            if (err instanceof ApiError) {
                if (err.message === AUTH_UNAUTHORIZED) {
                    toast.error("נדרש להתחבר מחדש");
                    setStatus("error");
                    setTimeout(() => router.push("/login"), 1500);
                    throw err; // Re-throw only for AUTH_UNAUTHORIZED to signal re-login requirement
                } else if (err.message === AUTH_FORBIDDEN) {
                    toast.error("אין לך הרשאה לפתוח שער");
                } else if (err.status === 409) {
                    toast.error("המשתמש מחובר כבר ממכשיר אחר");
                } else if (err.status && err.status >= 500) {
                    toast.error("אין תקשורת עם השרת, נסה שוב");
                } else {
                    toast.error(err.message || "שגיאה בפתיחת השער");
                }
            } else {
                toast.error("אין תקשורת עם השרת, נסה שוב");
            }

            // For recoverable errors, set error state and reset after 2s
            // Don't re-throw as they've already been handled with user feedback
            setStatus("error");
            setTimeout(() => setStatus("idle"), 2000);
        }
    }, [status, isOffline, router]);

    const isLoading = status === "loading";

    // Don't render button until auth is ready to prevent flashing
    // Middleware handles redirect, but we still need to wait for client-side auth to load user data
    if (!isReady || loading || !user) {
        return null; // Return nothing - middleware already redirected if not authenticated
    }

    const displayName = user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.firstName || user.email?.split('@')[0] || 'משתמש';

    // Time-based greeting
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour >= 5 && hour < 12) return "בוקר טוב";
        if (hour >= 12 && hour < 17) return "צהריים טובים";
        if (hour >= 17 && hour < 22) return "ערב טוב";
        return "לילה טוב";
    };

    return (
        <div className="flex min-h-screen flex-col" style={{ backgroundColor: "var(--bg)" }}>
            {/* User name display below header */}
            <div className="fixed top-14 left-0 right-0 z-30 px-4 pt-2 pb-1">
                <div className="mx-auto max-w-7xl">
                    <span className="inline-flex items-center text-sm" style={{ color: "var(--muted)", transform: "translateY(-1px)" }}>
                        {/* Connection status indicator */}
                        <span
                            className="inline-block w-2 h-2 rounded-full"
                            style={{
                                backgroundColor: deviceOnline === false ? "var(--danger)" : deviceOnline === true ? "var(--success)" : "var(--muted)",
                                opacity: deviceOnline === false ? 1 : deviceOnline === true ? 1 : 0.5,
                                marginLeft: "6px",
                                transform: "translateY(1.5px)"
                            }}
                            title={deviceOnline === false ? "השער לא מקוון" : deviceOnline === true ? "השער מקוון" : "מצב לא ידוע"}
                        />
                        {getGreeting()}, {displayName}
                        {user.apartmentNumber && user.floor && (
                            <span className="text-xs" style={{ opacity: 0.8 }}>
                                &nbsp;· דירה {user.apartmentNumber}, קומה {user.floor}
                            </span>
                        )}
                    </span>
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center px-4 pt-24 pb-12">
                <div className="w-full max-w-md space-y-6">
                        {isOffline && (
                            <div className="rounded-theme-md border px-4 py-3 text-center" style={{ backgroundColor: "var(--warning)", borderColor: "var(--warning)", opacity: 0.1 }}>
                                <p className="text-sm font-medium" style={{ color: "var(--warning)" }}>
                                    אין אינטרנט
                                </p>
                            </div>
                        )}

                        <GateButton
                            onOpen={handleOpenGate}
                            loading={isLoading}
                            disabled={isOffline}
                        />

                        {status === "loading" && (
                            <div className="text-center min-h-[24px] text-sm" style={{ color: "var(--muted)" }}>
                                פותח שער…
                            </div>
                        )}
                        {status === "error" && (
                            <div className="text-center min-h-[24px] text-sm" style={{ color: "var(--danger)" }}>
                                נכשל, נסה שוב
                            </div>
                        )}
                </div>
            </div>
        </div>
    );
}

