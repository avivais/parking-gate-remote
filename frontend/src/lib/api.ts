/* Fetch wrapper for API calls with JWT from localStorage */
import { getToken } from "./auth";

const API_BASE_URL = "http://localhost:3001/api";

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

export async function apiRequest<T>(
    path: string,
    { method = "GET", body, headers = {}, auth = true }: ApiOptions = {},
): Promise<T> {
    const token = auth ? getToken() : null;

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

    if (auth && token) {
        finalHeaders["Authorization"] = `Bearer ${token}`;
    }

    let response: Response;
    try {
        response = await fetch(url, {
            method,
            headers: finalHeaders,
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
    } catch (err) {
        throw new ApiError("שגיאת רשת, נסו שוב.", undefined, err);
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

