"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import { ThemeId, ThemeMode, DEFAULT_THEME, DEFAULT_MODE, THEMES } from "@/theme/themes";

interface ThemeContextType {
    themeId: ThemeId;
    mode: ThemeMode;
    setTheme: (themeId: ThemeId) => void;
    setMode: (mode: ThemeMode) => void;
    toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [themeId, setThemeIdState] = useState<ThemeId>(DEFAULT_THEME);
    const [mode, setModeState] = useState<ThemeMode>(DEFAULT_MODE);
    const [mounted, setMounted] = useState(false);

    // Load from localStorage on mount
    useEffect(() => {
        const storedThemeId = localStorage.getItem("pgr_theme_id") as ThemeId | null;
        const storedMode = localStorage.getItem("pgr_theme_mode") as ThemeMode | null;

        if (storedThemeId && THEMES[storedThemeId]) {
            setThemeIdState(storedThemeId);
        }

        if (storedMode === "light" || storedMode === "dark") {
            setModeState(storedMode);
        }

        setMounted(true);
    }, []);

    // Apply CSS variables when theme or mode changes
    useEffect(() => {
        if (!mounted) return;

        const root = document.documentElement;
        const theme = THEMES[themeId];
        const tokens = theme.tokens[mode];

        // Set data attributes
        root.setAttribute("data-theme", themeId);
        root.setAttribute("data-mode", mode);

        // Apply CSS variables
        Object.entries(tokens).forEach(([key, value]) => {
            root.style.setProperty(`--${key}`, value);
        });
    }, [themeId, mode, mounted]);

    const setTheme = (newThemeId: ThemeId) => {
        setThemeIdState(newThemeId);
        localStorage.setItem("pgr_theme_id", newThemeId);
    };

    const setMode = (newMode: ThemeMode) => {
        setModeState(newMode);
        localStorage.setItem("pgr_theme_mode", newMode);
    };

    const toggleMode = () => {
        const newMode = mode === "light" ? "dark" : "light";
        setMode(newMode);
    };

    return (
        <ThemeContext.Provider
            value={{
                themeId,
                mode,
                setTheme,
                setMode,
                toggleMode,
            }}
        >
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (context === undefined) {
        throw new Error("useTheme must be used within a ThemeProvider");
    }
    return context;
}


