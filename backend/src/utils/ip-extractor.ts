import { Request } from 'express';

/**
 * Extracts the real client IP address from request headers.
 * Priority:
 * 1. CF-Connecting-IP (Cloudflare header)
 * 2. X-Forwarded-For (first IP in the chain)
 * 3. req.ip (fallback)
 *
 * @param req Express request object
 * @returns The client IP address
 */
export function getClientIp(req: Request): string {
    // Cloudflare sends the real client IP in CF-Connecting-IP header
    const cfConnectingIp = req.headers['cf-connecting-ip'] as string | undefined;
    if (cfConnectingIp) {
        return cfConnectingIp;
    }

    // Fallback to X-Forwarded-For (first IP in the chain)
    const xForwardedFor = req.headers['x-forwarded-for'] as string | undefined;
    if (xForwardedFor) {
        // X-Forwarded-For can contain multiple IPs separated by commas
        // The first IP is typically the original client IP
        const firstIp = xForwardedFor.split(',')[0].trim();
        if (firstIp) {
            return firstIp;
        }
    }

    // Fallback to req.ip (may be the proxy IP if trust proxy is not configured)
    return req.ip || 'unknown';
}
