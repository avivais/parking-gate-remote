"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, ApiError } from "@/lib/api";
import { getToken, setToken, clearToken, getOrCreateDeviceId } from "@/lib/auth";
import type {
    User,
    AuthUserResponse,
    MeResponse,
} from "@/types/auth";

interface AuthContextType {
    user: User | null;
    token: MeResponse["token"];
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (email: string, password: string) => Promise<void>;
    logout: () => Promise<void>;
    refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setTokenInfo] = useState<MeResponse["token"]>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    const refresh = async () => {
        const storedToken = getToken();
        if (!storedToken) {
            setLoading(false);
            return;
        }

        try {
            const data = await apiRequest<MeResponse>("/auth/me");
            setUser(data.user);
            setTokenInfo(data.token);
        } catch (err) {
            if (err instanceof ApiError) {
                if (err.status === 401 || err.status === 403) {
                    clearToken();
                    setUser(null);
                    setTokenInfo(null);
                    router.push("/login");
                }
            }
        } finally {
            setLoading(false);
        }
    };

    const login = async (email: string, password: string) => {
        const deviceId = getOrCreateDeviceId();
        const data = await apiRequest<AuthUserResponse>("/auth/login", {
            method: "POST",
            body: { email, password, deviceId },
            auth: false,
        });

        setToken(data.tokens.accessToken);
        setUser(data.user);
        // Get token info from /auth/me
        try {
            const meData = await apiRequest<MeResponse>("/auth/me");
            setTokenInfo(meData.token);
        } catch (err) {
            // If /auth/me fails, continue anyway
        }
        setLoading(false);
        router.push("/");
    };

    const register = async (email: string, password: string) => {
        await apiRequest("/auth/register", {
            method: "POST",
            body: { email, password },
            auth: false,
        });
    };

    const logout = async () => {
        try {
            await apiRequest("/auth/logout", {
                method: "POST",
            });
        } catch (err) {
            // Continue even if logout fails
        } finally {
            clearToken();
            setUser(null);
            setTokenInfo(null);
            router.push("/login");
        }
    };

    useEffect(() => {
        refresh();
    }, []);

    return (
        <AuthContext.Provider
            value={{ user, token, loading, login, register, logout, refresh }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
}
