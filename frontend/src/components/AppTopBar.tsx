"use client";

import { usePathname } from "next/navigation";
import { AppDrawer } from "./AppDrawer";
import { ThemeButton } from "./ThemeButton";

interface AppTopBarProps {
    title?: string;
}

function getPageTitle(pathname: string): string {
    switch (pathname) {
        case "/":
            return "מצפה 6-8 · פתח שער";
        case "/admin":
            return "מצפה 6-8 · ניהול";
        case "/me":
            return "מצפה 6-8 · אזור אישי";
        default:
            return "מצפה 6-8";
    }
}

export function AppTopBar({ title }: AppTopBarProps) {
    const pathname = usePathname();
    const displayTitle = title || getPageTitle(pathname);

    return (
        <header
            className="fixed top-0 left-0 right-0 z-40 border-b border-theme bg-surface shadow-theme-sm"
            style={{ height: "56px" }}
        >
            <div className="mx-auto flex h-14 max-w-7xl items-center justify-between">
                {/* Right side (RTL) - Hamburger Menu */}
                <div className="flex-shrink-0" style={{ paddingRight: "6px" }}>
                    <AppDrawer />
                </div>

                {/* Center - Title */}
                <h1
                    className="flex-1 truncate text-center text-lg font-semibold whitespace-nowrap px-4"
                    style={{ color: "var(--text)" }}
                >
                    {displayTitle}
                </h1>

                {/* Left side (RTL) - Theme Button */}
                <div className="flex-shrink-0" style={{ paddingLeft: "6px" }}>
                    <ThemeButton />
                </div>
            </div>
        </header>
    );
}

