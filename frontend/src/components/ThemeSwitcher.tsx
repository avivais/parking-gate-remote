"use client";

import { useTheme } from "@/context/ThemeContext";
import { ThemeId, THEMES } from "@/theme/themes";

export function ThemeSwitcher() {
    const { themeId, mode, setTheme, toggleMode } = useTheme();

    return (
        <div className="flex items-center gap-3">
            {/* Theme Selection */}
            <div className="flex items-center gap-2 rounded-lg border border-theme bg-surface p-1">
                {(Object.keys(THEMES) as ThemeId[]).map((id) => {
                    const theme = THEMES[id];
                    const isActive = themeId === id;
                    return (
                        <button
                            key={id}
                            onClick={() => setTheme(id)}
                            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                                isActive
                                    ? "bg-primary text-primary-contrast"
                                    : "text-muted hover:bg-surface-2"
                            }`}
                        >
                            {theme.labelHe}
                        </button>
                    );
                })}
            </div>

            {/* Dark Mode Toggle */}
            <button
                onClick={toggleMode}
                className="rounded-lg border border-theme bg-surface px-3 py-2 text-xs font-medium text-muted hover:bg-surface-2 focus-theme"
                aria-label={mode === "light" ? "החלף למצב כהה" : "החלף למצב בהיר"}
            >
                {mode === "light" ? "🌙" : "☀️"} מצב {mode === "light" ? "כהה" : "בהיר"}
            </button>
        </div>
    );
}


