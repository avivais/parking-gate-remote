"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

type GateButtonProps = {
    onOpen: () => Promise<void>;
    disabled?: boolean;
    loading?: boolean;
};

type Status = "idle" | "loading" | "success" | "error";

export function GateButton({ onOpen, disabled = false, loading }: GateButtonProps) {
    const [status, setStatus] = useState<Status>("idle");

    const isLoading = loading ?? status === "loading";
    const isDisabled = disabled || isLoading;

    const handlePress = useCallback(async () => {
        if (isDisabled) return;

        setStatus("loading");
        try {
            await onOpen();
            setStatus("success");
            setTimeout(() => setStatus("idle"), 700);
        } catch {
            setStatus("error");
            setTimeout(() => setStatus("idle"), 900);
        }
    }, [isDisabled, onOpen]);

    const handleKeyDown = (event: React.KeyboardEvent) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            handlePress();
        }
    };

    const variants = {
        idle: { scale: 1, x: 0 },
        loading: {
            scale: [1, 1.02, 1],
            transition: { repeat: Infinity, duration: 1.2 },
        },
        success: { scale: [1, 1.05, 1], transition: { duration: 0.4 } },
        error: {
            x: [-6, 6, -4, 4, 0],
            transition: { duration: 0.4 },
        },
    };

    const renderContent = () => {
        if (isLoading) {
            return (
                <span className="flex items-center justify-center gap-2">
                    <svg
                        className="h-5 w-5 animate-spin"
                        style={{ color: "var(--primary-contrast)" }}
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                        ></circle>
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                    </svg>
                    פותח...
                </span>
            );
        }

        if (status === "success") {
            return (
                <span className="flex items-center justify-center gap-2">
                    <svg
                        className="h-5 w-5"
                        style={{ color: "var(--primary-contrast)" }}
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M5 13l4 4L19 7"
                        />
                    </svg>
                    נפתח
                </span>
            );
        }

        if (status === "error") {
            return <span>שגיאה</span>;
        }

        return "פתח שער";
    };

    return (
        <motion.button
            type="button"
            onClick={handlePress}
            onKeyDown={handleKeyDown}
            disabled={isDisabled}
            aria-disabled={isDisabled}
            aria-busy={isLoading}
            className="w-full rounded-theme-lg px-6 py-8 text-2xl font-bold shadow-theme-lg focus-theme disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            style={{
                backgroundColor: "var(--success)",
                color: "var(--primary-contrast)",
            }}
            onMouseEnter={(e) => {
                if (!isDisabled) {
                    e.currentTarget.style.opacity = "0.9";
                }
            }}
            onMouseLeave={(e) => {
                e.currentTarget.style.opacity = isDisabled ? "0.5" : "1";
            }}
            animate={status === "idle" ? "idle" : status}
            variants={variants}
        >
            <AnimatePresence mode="wait">
                <motion.span
                    key={status === "loading" ? "loading" : status}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.15 }}
                    className="block"
                >
                    {renderContent()}
                </motion.span>
            </AnimatePresence>
        </motion.button>
    );
}


