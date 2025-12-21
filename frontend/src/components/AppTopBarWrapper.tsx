"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { AppTopBar } from "./AppTopBar";

export function AppTopBarWrapper() {
    const pathname = usePathname();
    const { user, loading, isReady } = useAuth();

    // Don't show TopBar on login/register pages
    if (pathname === "/login" || pathname === "/register") {
        return null;
    }

    // Don't show TopBar while loading or if not authenticated
    if (!isReady || loading || !user) {
        return null;
    }

    // Show TopBar on all other pages (authenticated users)
    return <AppTopBar />;
}

