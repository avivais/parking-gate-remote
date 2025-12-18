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
        if (pathname === "/admin") {
            if (user.role !== "admin") {
                router.replace("/");
            }
            return;
        }

        // All other routes are allowed for authenticated, approved users
    }, [user, loading, isReady, pathname, router]);

    // Show loading screen while auth state is resolving
    if (!isReady || loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <div className="text-lg">טוען...</div>
            </div>
        );
    }

    return <>{children}</>;
}

