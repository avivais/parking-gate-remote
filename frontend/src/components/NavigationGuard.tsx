"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export function NavigationGuard({ children }: { children: React.ReactNode }) {
    const { user, loading, isReady } = useAuth();
    const pathname = usePathname();
    const router = useRouter();

    useEffect(() => {
        // Wait for auth state to be ready
        if (!isReady || loading) {
            return;
        }

        // Rule 1: If NOT authenticated - allow only /login and /register
        if (!user) {
            if (pathname !== "/login" && pathname !== "/register") {
                router.replace("/login");
            }
            return;
        }

        // Rule 2: If authenticated but status is rejected or archived - redirect to login
        if (user.status === "rejected" || user.status === "archived") {
            if (pathname !== "/login") {
                router.replace("/login");
            }
            return;
        }

        // Rule 3: If authenticated but status is pending - allow only /pending
        if (user.status !== "approved") {
            if (pathname !== "/pending") {
                router.replace("/pending");
            }
            return;
        }

        // Rule 4: If authenticated AND approved
        // Redirect /pending, /login, /register to /
        if (pathname === "/pending" || pathname === "/login" || pathname === "/register") {
            router.replace("/");
            return;
        }

        // Rule 5: Admin route - allow only if user.role === 'admin' AND approved
        // Handle both /admin and /admin/* routes
        if (pathname === "/admin" || pathname.startsWith("/admin/")) {
            if (user.role !== "admin") {
                router.replace("/");
            }
            return;
        }

        // All other routes are allowed for authenticated, approved users
    }, [user, loading, isReady, pathname, router]);

    // Middleware handles the initial redirect for unauthenticated users
    // This guard handles client-side navigation and status checks

    // While auth is loading, render nothing (middleware already protected the route)
    if (!isReady || loading) {
        return null;
    }

    // Additional client-side checks for user status
    if (!user) {
        // Not authenticated - middleware should have redirected, but handle edge cases
        if (pathname !== "/login" && pathname !== "/register") {
            return null;
        }
    } else {
        // Authenticated - check status
        if (user.status === "rejected" || user.status === "archived") {
            if (pathname !== "/login") {
                return null;
            }
        } else if (user.status !== "approved") {
            // Pending status
            if (pathname !== "/pending") {
                return null;
            }
        }
    }

    return <>{children}</>;
}


