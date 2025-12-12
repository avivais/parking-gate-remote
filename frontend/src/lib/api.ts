/* Fetch wrapper for API calls with httpOnly refresh cookies */
import type { RefreshResponse } from "@/types/auth";

export const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3001/api";

// In-memory access token storage
let accessToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

export class ApiError extends Error {
    status?: number;
    data?: unknown;

    constructor(message: string, status?: number, data?: unknown) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.data = data;
    }
}

interface ApiOptions {
    method?: string;
    body?: unknown;
    headers?: HeadersInit;
    auth?: boolean;
}

/**
 * Set the access token in memory (called by AuthContext)
 */
export function setAccessToken(token: string | null): void {
    accessToken = token;
}

/**
 * Clear the access token from memory (called by AuthContext)
 */
export function clearAccessToken(): void {
    accessToken = null;
}

/**
 * Refresh the access token using the httpOnly refresh cookie
 */
async function refreshAccessToken(): Promise<string | null> {
    // If a refresh is already in progress, wait for it
    if (refreshPromise) {
        return refreshPromise;
    }

    // Start a new refresh
    refreshPromise = (async () => {
        try {
            const url = `${API_BASE_URL}/auth/refresh`;
            const response = await fetch(url, {
                method: "POST",
                credentials: "include",
                headers: {
                    Accept: "application/json",
                },
            });

            if (!response.ok) {
                accessToken = null;
                return null;
            }

            const data: RefreshResponse = await response.json();
            accessToken = data.tokens.accessToken;
            return accessToken;
        } catch (err) {
            accessToken = null;
            return null;
        } finally {
            refreshPromise = null;
        }
    })();

    return refreshPromise;
}

export async function apiRequest<T>(
    path: string,
    { method = "GET", body, headers = {}, auth = true }: ApiOptions = {},
): Promise<T> {
    const url = path.startsWith("http")
        ? path
        : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

    const finalHeaders: Record<string, string> = {
        Accept: "application/json",
        ...(headers as Record<string, string>),
    };

    if (body !== undefined) {
        finalHeaders["Content-Type"] = "application/json";
    }

    // Add Authorization header if auth is required and we have a token
    if (auth && accessToken) {
        finalHeaders["Authorization"] = `Bearer ${accessToken}`;
    }

    let response: Response;
    try {
        response = await fetch(url, {
            method,
            headers: finalHeaders,
            body: body !== undefined ? JSON.stringify(body) : undefined,
            credentials: "include",
        });
    } catch (err) {
        throw new ApiError("שגיאת רשת, נסו שוב.", undefined, err);
    }

    // Handle 401 Unauthorized - try to refresh and retry once
    if (response.status === 401 && auth) {
        const newToken = await refreshAccessToken();

        if (newToken) {
            // Retry the original request with the new token
            finalHeaders["Authorization"] = `Bearer ${newToken}`;

            try {
                response = await fetch(url, {
                    method,
                    headers: finalHeaders,
                    body: body !== undefined ? JSON.stringify(body) : undefined,
                    credentials: "include",
                });
            } catch (err) {
                throw new ApiError("שגיאת רשת, נסו שוב.", undefined, err);
            }
        }
    }

    const isJson =
        response.headers.get("content-type")?.includes("application/json") ??
        false;
    const data = isJson ? await response.json() : null;

    if (!response.ok) {
        let message = "שגיאת שרת";

        if (data && typeof data === "object") {
            // Handle NestJS validation errors (array format)
            if (Array.isArray(data.message)) {
                message = data.message.join(", ");
            } else if ("message" in data && typeof data.message === "string") {
                message = data.message;
            }
        }

        // Fallback to status text if no message found
        if (!message || message === "שגיאת שרת") {
            message = response.statusText || "שגיאת שרת";
        }

        throw new ApiError(message, response.status, data);
    }

    return data as T;
}

