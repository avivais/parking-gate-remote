"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, ApiError, setAccessToken, clearAccessToken, refreshToken, AUTH_UNAUTHORIZED } from "@/lib/api";
import { getOrCreateDeviceId } from "@/lib/auth";
import type {
    User,
    AuthUserResponse,
    MeResponse,
} from "@/types/auth";

interface AuthContextType {
    user: User | null;
    token: MeResponse["token"];
    loading: boolean;
    isReady: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (
        email: string,
        password: string,
        firstName: string,
        lastName: string,
        phone: string,
        apartmentNumber: number,
        floor: number,
    ) => Promise<void>;
    logout: () => Promise<void>;
    refresh: () => Promise<void>;
    updateUser: (updates: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setTokenInfo] = useState<MeResponse["token"]>(null);
    const [loading, setLoading] = useState(true);
    const [isReady, setIsReady] = useState(false);
    const router = useRouter();

    const refresh = async () => {
        try {
            // Attempt silent refresh using httpOnly cookie
            // refreshToken() automatically sets the access token
            await refreshToken();

            // Fetch user info
            const meData = await apiRequest<MeResponse>("/auth/me");
            setUser(meData.user);
            setTokenInfo(meData.token);
        } catch (err) {
            // If refresh fails with AUTH_UNAUTHORIZED or /auth/me fails, treat as logged out
            if (err instanceof ApiError && err.message === AUTH_UNAUTHORIZED) {
                // Refresh token expired or invalid
                clearAccessToken();
                setUser(null);
                setTokenInfo(null);
            } else {
                // Other errors (network, etc.) - also treat as logged out
                clearAccessToken();
                setUser(null);
                setTokenInfo(null);
            }
        } finally {
            setIsReady(true);
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

        // Store access token in memory
        setAccessToken(data.tokens.accessToken);
        setUser(data.user);

        // Get token info from /auth/me
        try {
            const meData = await apiRequest<MeResponse>("/auth/me");
            setTokenInfo(meData.token);
        } catch (err) {
            // If /auth/me fails, continue anyway
        }
        setLoading(false);
        router.replace("/");
    };

    const register = async (
        email: string,
        password: string,
        firstName: string,
        lastName: string,
        phone: string,
        apartmentNumber: number,
        floor: number,
    ) => {
        await apiRequest("/auth/register", {
            method: "POST",
            body: {
                email,
                password,
                firstName,
                lastName,
                phone,
                apartmentNumber,
                floor,
            },
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
            clearAccessToken();
            setUser(null);
            setTokenInfo(null);
            router.push("/login");
        }
    };

    const updateUser = async (updates: Partial<User>) => {
        const updatedUser = await apiRequest<User>("/auth/users/me", {
            method: "PATCH",
            body: updates,
        });
        setUser(updatedUser);
    };

    useEffect(() => {
        refresh();
    }, []);

    return (
        <AuthContext.Provider
            value={{ user, token, loading, isReady, login, register, logout, refresh, updateUser }}
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

