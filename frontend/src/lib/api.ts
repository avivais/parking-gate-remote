/* Fetch wrapper for API calls with httpOnly refresh cookies */
import type { RefreshResponse } from "@/types/auth";

export const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE || "http://localhost:3001/api";

// Standardized auth error messages
export const AUTH_UNAUTHORIZED = "AUTH_UNAUTHORIZED";
export const AUTH_FORBIDDEN = "AUTH_FORBIDDEN";

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
    isRefreshCall?: boolean; // Internal flag to prevent refresh-on-refresh recursion
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
 * This function uses apiRequest with isRefreshCall=true to prevent recursion
 */
async function refreshAccessToken(): Promise<string | null> {
    // If a refresh is already in progress, wait for it
    if (refreshPromise) {
        return refreshPromise;
    }

    // Start a new refresh using apiRequest to ensure single source of truth
    refreshPromise = (async () => {
        try {
            const data = await apiRequest<RefreshResponse>("/auth/refresh", {
                method: "POST",
                auth: false,
                isRefreshCall: true,
            });

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

/**
 * Helper function to refresh the token (for use by AuthContext and pending page)
 * Returns the refresh response data and automatically sets the access token
 */
export async function refreshToken(): Promise<RefreshResponse> {
    const data = await apiRequest<RefreshResponse>("/auth/refresh", {
        method: "POST",
        auth: false,
        isRefreshCall: true,
    });
    // Set the access token from the refresh response
    accessToken = data.tokens.accessToken;
    return data;
}

export async function apiRequest<T>(
    path: string,
    { method = "GET", body, headers = {}, auth = true, isRefreshCall = false }: ApiOptions = {},
): Promise<T> {
    const url = path.startsWith("http")
        ? path
        : `${API_BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;

    // Generate X-Request-Id for POST /gate/open if not already provided
    const isGateOpen = path === "/gate/open" && method === "POST";
    let requestId: string | undefined;

    if (isGateOpen) {
        // Check if X-Request-Id is already in headers
        const existingRequestId = (headers as Record<string, string>)?.["X-Request-Id"] ||
                                  (headers as Record<string, string>)?.["x-request-id"];

        if (existingRequestId) {
            requestId = existingRequestId;
        } else {
            // Generate new UUID
            requestId = crypto.randomUUID();
        }
    }

    const finalHeaders: Record<string, string> = {
        Accept: "application/json",
        ...(headers as Record<string, string>),
    };

    // Add X-Request-Id for gate/open requests
    if (isGateOpen && requestId) {
        finalHeaders["X-Request-Id"] = requestId;
    }

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
    // Skip refresh logic if this is already a refresh call to prevent recursion
    if (response.status === 401 && auth && !isRefreshCall) {
        const newToken = await refreshAccessToken();

        if (newToken) {
            // Retry the original request with the new token
            // Preserve X-Request-Id on retry
            finalHeaders["Authorization"] = `Bearer ${newToken}`;
            if (isGateOpen && requestId) {
                finalHeaders["X-Request-Id"] = requestId;
            }

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
        // Handle other errors first to extract message
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

        // Standardize auth errors after extracting message
        if (response.status === 401) {
            throw new ApiError(AUTH_UNAUTHORIZED, 401, data);
        }
        if (response.status === 403) {
            // For 403, use the actual message (which may include rejectionReason in data)
            throw new ApiError(message, 403, data);
        }

        throw new ApiError(message, response.status, data);
    }

    return data as T;
}

