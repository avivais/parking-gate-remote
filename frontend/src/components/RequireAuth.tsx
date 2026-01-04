"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { USER_STATUS } from "@/types/auth";

interface RequireAuthProps {
    children: React.ReactNode;
    requireApproved?: boolean;
    requireAdmin?: boolean;
}

export function RequireAuth({
    children,
    requireApproved = true,
    requireAdmin = false,
}: RequireAuthProps) {
    const { user, loading, isReady } = useAuth();
    const router = useRouter();

    useEffect(() => {
        // Wait for initial auth check to complete
        if (!isReady || loading) return;

        if (!user) {
            router.push("/login");
            return;
        }

        if (requireApproved && user.status !== USER_STATUS.APPROVED) {
            router.push("/pending");
            return;
        }

        if (requireAdmin && user.role !== "admin") {
            router.push("/");
            return;
        }
    }, [user, loading, isReady, requireApproved, requireAdmin, router]);

    // Show loading state until ready
    if (!isReady || loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-lg">טוען...</div>
            </div>
        );
    }

    // Check auth status after ready
    if (!user) {
        return null;
    }

    if (requireApproved && user.status !== USER_STATUS.APPROVED) {
        return null;
    }

    if (requireAdmin && user.role !== "admin") {
        return null;
    }

    return <>{children}</>;
}

