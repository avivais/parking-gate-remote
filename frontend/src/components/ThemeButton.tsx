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

    // Lock body scroll when drawer is open
    useEffect(() => {
        if (!isOpen) return;

        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = originalOverflow;
        };
    }, [isOpen]);

    return (
        <>
            {/* Gear Button */}
            <button
                ref={buttonRef}
                onClick={togglePopover}
                className="rounded-theme-md p-2 transition-colors hover:bg-surface-2 relative z-50"
                aria-label="הגדרות עיצוב"
                aria-expanded={isOpen}
                aria-controls={popoverId}
                onFocus={(e) => {
                    if (e.target === document.activeElement && !e.target.matches(':focus-visible')) {
                        e.target.blur();
                    }
                }}
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
                        // Gear icon when closed
                        <>
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
                        </>
                    )}
                </svg>
            </button>

            {/* Backdrop - blur effect to see content behind */}
            {isOpen && (
                <div
                    className="fixed top-14 left-0 right-0 bottom-0 z-40"
                    onClick={closePopover}
                    aria-hidden="true"
                    style={{
                        backgroundColor: "rgba(0, 0, 0, 0.2)",
                        backdropFilter: "blur(4px)",
                        WebkitBackdropFilter: "blur(4px)",
                        animation: "fadeIn 150ms ease-out"
                    }}
                />
            )}

            {/* Drawer from left */}
            {isOpen && (
                <div
                    ref={popoverRef}
                    id={popoverId}
                    role="dialog"
                    aria-modal="true"
                    aria-label="בחירת עיצוב"
                    className="fixed left-0 top-14 bottom-0 z-50 w-[80%] max-w-[360px] md:w-96 overflow-y-auto border-r border-theme bg-surface shadow-theme-lg"
                    style={{ animation: "slideInLeft 200ms ease-out" }}
                >
                    <div className="py-2">
                        {/* Theme Selection */}
                        <div className="px-4 py-2">
                            <div className="mb-2 text-xs font-medium text-muted">עיצוב</div>
                            <div className="flex flex-col gap-2">
                                {(Object.keys(THEMES) as ThemeId[]).map((id) => {
                                    const theme = THEMES[id];
                                    const isActive = themeId === id;
                                    return (
                                        <button
                                            key={id}
                                            onClick={
                                                isActive
                                                    ? undefined
                                                    : () => {
                                                          setTheme(id);
                                                          closePopover();
                                                      }
                                            }
                                            disabled={isActive}
                                            className={`rounded-theme-sm px-3 py-2 text-xs font-medium transition-colors text-right ${
                                                isActive
                                                    ? "btn-primary bg-primary text-primary-contrast nav-item-active"
                                                    : "btn-outline bg-surface-2 text-muted nav-item-inactive"
                                            }`}
                                        >
                                            {theme.labelHe}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Divider */}
                        <div className="h-[1px] my-3 mx-4" style={{ backgroundColor: "var(--border-strong)" }} />

                        {/* Dark/Light Toggle */}
                        <button
                            onClick={() => {
                                toggleMode();
                                closePopover();
                            }}
                            className="btn-outline w-full rounded-theme-md px-4 py-3 text-right text-sm font-medium"
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
        </>
    );
}

