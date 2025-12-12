"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

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
    const { user, loading } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (loading) return;

        const token = typeof window !== "undefined"
            ? localStorage.getItem("pgr_access_token")
            : null;

        if (!token) {
            router.push("/login");
            return;
        }

        if (!user) {
            router.push("/login");
            return;
        }

        if (requireApproved && !user.approved) {
            router.push("/pending");
            return;
        }

        if (requireAdmin && user.role !== "admin") {
            router.push("/");
            return;
        }
    }, [user, loading, requireApproved, requireAdmin, router]);

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <div className="text-lg">טוען...</div>
            </div>
        );
    }

    const token = typeof window !== "undefined"
        ? localStorage.getItem("pgr_access_token")
        : null;

    if (!token || !user) {
        return null;
    }

    if (requireApproved && !user.approved) {
        return null;
    }

    if (requireAdmin && user.role !== "admin") {
        return null;
    }

    return <>{children}</>;
}
