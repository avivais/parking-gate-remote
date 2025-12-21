"use client";

import { useState, useEffect, useRef } from "react";
import { useTheme } from "@/context/ThemeContext";
import { ThemeId, THEMES } from "@/theme/themes";

export function ThemeButton() {
    const { themeId, mode, setTheme, toggleMode } = useTheme();
    const [isOpen, setIsOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);
    const buttonRef = useRef<HTMLButtonElement>(null);
    const popoverId = "theme-popover";

    const togglePopover = () => {
        setIsOpen((prev) => !prev);
    };

    const closePopover = () => {
        setIsOpen(false);
    };

    // Click outside handler
    useEffect(() => {
        if (!isOpen) return;

        const handleClickOutside = (e: MouseEvent) => {
            if (
                popoverRef.current &&
                !popoverRef.current.contains(e.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(e.target as Node)
            ) {
                closePopover();
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
                closePopover();
            }
        };

        document.addEventListener("keydown", handleEsc);
        return () => document.removeEventListener("keydown", handleEsc);
    }, [isOpen]);

    return (
        <div className="relative">
            {/* Gear Button */}
            <button
                ref={buttonRef}
                onClick={togglePopover}
                className="rounded-theme-md p-2 transition-colors hover:bg-surface-2"
                aria-label="הגדרות עיצוב"
                aria-expanded={isOpen}
                aria-controls={popoverId}
            >
                <svg
                    className="h-6 w-6"
                    style={{ color: isOpen ? "var(--primary)" : "var(--muted)" }}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                >
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                </svg>
            </button>

            {/* Popover */}
            {isOpen && (
                <div
                    ref={popoverRef}
                    id={popoverId}
                    role="dialog"
                    aria-modal="true"
                    aria-label="בחירת עיצוב"
                    className="absolute left-0 top-full mt-2 z-50 w-64 rounded-theme-lg border border-theme bg-surface shadow-theme-lg p-4"
                    style={{
                        animation: "slideDown 150ms ease-out",
                        maxWidth: "calc(100vw - 24px)",
                        right: "auto",
                    }}
                >
                    <div className="space-y-4">
                        {/* Theme Selection */}
                        <div>
                            <div className="mb-2 text-xs font-medium text-muted">עיצוב</div>
                            <div className="flex flex-col gap-2">
                                {(Object.keys(THEMES) as ThemeId[]).map((id) => {
                                    const theme = THEMES[id];
                                    const isActive = themeId === id;
                                    return (
                                        <button
                                            key={id}
                                            onClick={() => {
                                                setTheme(id);
                                                closePopover();
                                            }}
                                            className={`rounded-theme-sm px-3 py-2 text-xs font-medium transition-colors text-right ${
                                                isActive
                                                    ? "bg-primary text-primary-contrast"
                                                    : "bg-surface-2 text-muted hover:bg-surface"
                                            }`}
                                        >
                                            {theme.labelHe}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Dark/Light Toggle */}
                        <button
                            onClick={() => {
                                toggleMode();
                                closePopover();
                            }}
                            className="w-full rounded-theme-md px-4 py-3 text-right text-sm font-medium transition-colors hover:bg-surface-2"
                            style={{ color: "var(--text)" }}
                        >
                            <span className="flex items-center justify-between">
                                <span>מצב {mode === "light" ? "כהה" : "בהיר"}</span>
                                <span>{mode === "light" ? "🌙" : "☀️"}</span>
                            </span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

