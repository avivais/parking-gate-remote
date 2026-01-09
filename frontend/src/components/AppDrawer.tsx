"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { FRONTEND_VERSION } from "@/lib/version";

export function AppDrawer() {
    const { user, logout } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);
    const drawerRef = useRef<HTMLDivElement>(null);
    const toggleRef = useRef<HTMLButtonElement>(null);
    const drawerId = "app-drawer";

    // Toggle drawer
    const toggleDrawer = () => {
        setIsOpen((prev) => !prev);
    };

    // Close drawer
    const closeDrawer = () => {
        setIsOpen(false);
    };

    // Click outside handler
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (
                drawerRef.current &&
                !drawerRef.current.contains(e.target as Node) &&
                toggleRef.current &&
                !toggleRef.current.contains(e.target as Node)
            ) {
                closeDrawer();
            }
        };

        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    // ESC key handler
    useEffect(() => {
        if (!isOpen) return;

        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                closeDrawer();
            }
        };

        document.addEventListener("keydown", handleEsc);
        return () => document.removeEventListener("keydown", handleEsc);
    }, [isOpen]);

    // Lock body scroll when drawer is open
    useEffect(() => {
        if (!isOpen) return;

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [isOpen]);

    // Focus trap - focus first focusable element when opening
    useEffect(() => {
        if (!isOpen || !drawerRef.current) return;

        const focusableElements = drawerRef.current.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        const firstElement = focusableElements[0] as HTMLElement;
        if (firstElement) {
            firstElement.focus();
        }
    }, [isOpen]);

    const handleLogout = async () => {
        closeDrawer();
        await logout();
    };

    const handleNavigate = (path: string) => {
        closeDrawer();
        router.push(path);
    };

    const isActive = (path: string) => pathname === path;

    return (
        <>
            {/* Toggle Button (Hamburger) */}
            <button
                ref={toggleRef}
                onClick={toggleDrawer}
                className="rounded-theme-md p-2 transition-colors hover:bg-surface-2 relative z-50"
                aria-label="תפריט"
                aria-expanded={isOpen}
                aria-controls={drawerId}
            >
                <svg
                    className="h-6 w-6"
                    style={{ color: isOpen ? "var(--primary)" : "var(--muted)" }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    {isOpen ? (
                        // X icon when open
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                        />
                    ) : (
                        // Hamburger icon when closed
                        <>
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M4 6h16M4 12h16M4 18h16"
                            />
                        </>
                    )}
                </svg>
            </button>

            {/* Backdrop - blur effect to see content behind */}
            {isOpen && (
                <div
                    className="fixed top-14 left-0 right-0 bottom-0 z-40"
                    onClick={closeDrawer}
                    aria-hidden="true"
                    style={{
                        backgroundColor: "rgba(0, 0, 0, 0.2)",
                        backdropFilter: "blur(4px)",
                        WebkitBackdropFilter: "blur(4px)",
                        animation: "fadeIn 150ms ease-out"
                    }}
                />
            )}

            {/* Drawer */}
            {isOpen && (
                <div
                    ref={drawerRef}
                    id={drawerId}
                    role="dialog"
                    aria-modal="true"
                    aria-label="תפריט אפליקציה"
                    className="fixed right-0 top-14 bottom-0 z-50 w-[80%] max-w-[360px] md:w-96 border-l border-theme bg-surface shadow-theme-lg flex flex-col"
                    style={{ animation: "slideInRight 200ms ease-out" }}
                >
                    <div className="py-2 flex-1 overflow-y-auto pb-16">
                        {/* פתח שער */}
                        <button
                            onClick={() => handleNavigate("/")}
                            className={`w-full rounded-theme-md px-4 py-3 text-right text-sm font-medium transition-colors ${
                                isActive("/")
                                    ? "bg-primary text-primary-contrast"
                                    : "btn-outline"
                            }`}
                            style={!isActive("/") ? { color: "var(--text)" } : undefined}
                        >
                            פתח שער
                        </button>

                        {/* Divider */}
                        <div className="h-[1px] my-3 mx-4" style={{ backgroundColor: "var(--border-strong)" }} />

                        {/* אזור אישי */}
                        <button
                            onClick={() => handleNavigate("/me")}
                            className={`w-full rounded-theme-md px-4 py-3 text-right text-sm font-medium transition-colors ${
                                isActive("/me")
                                    ? "bg-primary text-primary-contrast"
                                    : "btn-outline"
                            }`}
                            style={!isActive("/me") ? { color: "var(--text)" } : undefined}
                        >
                            אזור אישי
                        </button>

                        {/* ניהול (admin only) */}
                        {user?.role === "admin" && (
                            <>
                                {/* Divider */}
                                <div className="h-[1px] my-2 mx-4" style={{ backgroundColor: "var(--border)" }} />
                                <button
                                    onClick={() => handleNavigate("/admin")}
                                    className={`w-full rounded-theme-md px-4 py-3 text-right text-sm font-medium transition-colors ${
                                        isActive("/admin")
                                            ? "bg-primary text-primary-contrast"
                                            : "btn-outline"
                                    }`}
                                    style={!isActive("/admin") ? { color: "var(--text)" } : undefined}
                                >
                                    ניהול
                                </button>
                            </>
                        )}

                        {/* Divider */}
                        <div className="h-[1px] my-3 mx-4" style={{ backgroundColor: "var(--border-strong)" }} />

                        {/* התנתק */}
                        <button
                            onClick={handleLogout}
                            className="btn-outline w-full rounded-theme-md px-4 py-3 text-right text-sm font-medium"
                            style={{
                                color: "var(--danger)",
                            }}
                        >
                            התנתק
                        </button>

                        {/* Version - at bottom of drawer */}
                        <div className="absolute bottom-0 left-0 right-0 px-4 py-3 border-t border-theme bg-surface-2">
                            <div className="text-xs text-muted text-center">
                                גרסה {FRONTEND_VERSION}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

