/**
 * Theme registry - single source of truth for all design tokens
 *
 * To add a new theme:
 * 1. Add a new entry to the ThemeId type (e.g., "newtheme")
 * 2. Add a new entry to the THEMES object with labelHe and tokens
 * 3. Define both light and dark token sets
 * 4. The UI will automatically display it in ThemeSwitcher
 */

export type ThemeId = "luxury" | "clean" | "pro";
export type ThemeMode = "light" | "dark";

export interface ThemeTokens {
    // Colors
    bg: string;
    surface: string;
    "surface-2": string;
    text: string;
    muted: string;
    primary: string;
    "primary-hover": string;
    "primary-contrast": string;
    success: string;
    danger: string;
    warning: string;
    // Borders
    border: string;
    "border-strong": string;
    // Shadows
    "shadow-sm": string;
    "shadow-md": string;
    "shadow-lg": string;
    // Radius
    "radius-sm": string;
    "radius-md": string;
    "radius-lg": string;
    // Spacing
    "space-1": string;
    "space-2": string;
    "space-3": string;
    "space-4": string;
    "space-5": string;
    "space-6": string;
    "space-7": string;
    "space-8": string;
    // Typography
    "font-sans": string;
    "font-weight-normal": string;
    "font-weight-semibold": string;
    "font-weight-bold": string;
    "letter-spacing-tight": string;
    "letter-spacing-normal": string;
    "letter-spacing-wide": string;
    "headline-weight": string;
    "headline-size": string;
    // Button styles
    "button-style": "filled" | "soft" | "outlined";
    "button-padding-x": string;
    "button-padding-y": string;
    // Table styles
    "table-header-bg": string;
    "table-header-text": string;
    "table-row-hover": string;
    "table-border": string;
    // Focus
    "focus-ring": string;
}

export interface ThemeDefinition {
    labelHe: string;
    tokens: {
        light: ThemeTokens;
        dark: ThemeTokens;
    };
}

export const THEMES: Record<ThemeId, ThemeDefinition> = {
    luxury: {
        labelHe: "יוקרתי",
        tokens: {
            light: {
                bg: "#fafafa",
                surface: "#ffffff",
                "surface-2": "#f5f5f5",
                text: "#1d1d1f",
                muted: "#86868b",
                primary: "#007aff",
                "primary-hover": "#0051d5",
                "primary-contrast": "#ffffff",
                success: "#34c759",
                danger: "#ff3b30",
                warning: "#ff9500",
                border: "#d2d2d7",
                "border-strong": "#a1a1a6",
                "shadow-sm": "0 1px 3px rgba(0, 0, 0, 0.08)",
                "shadow-md": "0 4px 12px rgba(0, 0, 0, 0.1)",
                "shadow-lg": "0 8px 24px rgba(0, 0, 0, 0.12)",
                "radius-sm": "12px",
                "radius-md": "16px",
                "radius-lg": "24px",
                "space-1": "4px",
                "space-2": "8px",
                "space-3": "12px",
                "space-4": "16px",
                "space-5": "24px",
                "space-6": "32px",
                "space-7": "40px",
                "space-8": "48px",
                "font-sans": '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                "font-weight-normal": "400",
                "font-weight-semibold": "600",
                "font-weight-bold": "700",
                "letter-spacing-tight": "-0.01em",
                "letter-spacing-normal": "0",
                "letter-spacing-wide": "0.02em",
                "headline-weight": "700",
                "headline-size": "2.25rem",
                "button-style": "filled",
                "button-padding-x": "16px",
                "button-padding-y": "12px",
                "table-header-bg": "#f5f5f5",
                "table-header-text": "#1d1d1f",
                "table-row-hover": "#fafafa",
                "table-border": "#d2d2d7",
                "focus-ring": "#007aff",
            },
            dark: {
                bg: "#000000",
                surface: "#1c1c1e",
                "surface-2": "#2c2c2e",
                text: "#f5f5f7",
                muted: "#98989d",
                primary: "#0a84ff",
                "primary-hover": "#409cff",
                "primary-contrast": "#ffffff",
                success: "#30d158",
                danger: "#ff453a",
                warning: "#ff9f0a",
                border: "#38383a",
                "border-strong": "#48484a",
                "shadow-sm": "0 1px 3px rgba(0, 0, 0, 0.3)",
                "shadow-md": "0 4px 12px rgba(0, 0, 0, 0.4)",
                "shadow-lg": "0 8px 24px rgba(0, 0, 0, 0.5)",
                "radius-sm": "12px",
                "radius-md": "16px",
                "radius-lg": "24px",
                "space-1": "4px",
                "space-2": "8px",
                "space-3": "12px",
                "space-4": "16px",
                "space-5": "24px",
                "space-6": "32px",
                "space-7": "40px",
                "space-8": "48px",
                "font-sans": '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
                "font-weight-normal": "400",
                "font-weight-semibold": "600",
                "font-weight-bold": "700",
                "letter-spacing-tight": "-0.01em",
                "letter-spacing-normal": "0",
                "letter-spacing-wide": "0.02em",
                "headline-weight": "700",
                "headline-size": "2.25rem",
                "button-style": "filled",
                "button-padding-x": "16px",
                "button-padding-y": "12px",
                "table-header-bg": "#2c2c2e",
                "table-header-text": "#f5f5f7",
                "table-row-hover": "#1c1c1e",
                "table-border": "#38383a",
                "focus-ring": "#0a84ff",
            },
        },
    },
    clean: {
        labelHe: "נקי",
        tokens: {
            light: {
                bg: "#fafafa",
                surface: "#ffffff",
                "surface-2": "#f5f5f5",
                text: "#212121",
                muted: "#757575",
                primary: "#1976d2",
                "primary-hover": "#1565c0",
                "primary-contrast": "#ffffff",
                success: "#388e3c",
                danger: "#d32f2f",
                warning: "#f57c00",
                border: "#e0e0e0",
                "border-strong": "#bdbdbd",
                "shadow-sm": "0 1px 3px rgba(0, 0, 0, 0.12), 0 1px 2px rgba(0, 0, 0, 0.24)",
                "shadow-md": "0 3px 6px rgba(0, 0, 0, 0.16), 0 3px 6px rgba(0, 0, 0, 0.23)",
                "shadow-lg": "0 10px 20px rgba(0, 0, 0, 0.19), 0 6px 6px rgba(0, 0, 0, 0.23)",
                "radius-sm": "4px",
                "radius-md": "8px",
                "radius-lg": "12px",
                "space-1": "4px",
                "space-2": "8px",
                "space-3": "12px",
                "space-4": "16px",
                "space-5": "24px",
                "space-6": "32px",
                "space-7": "40px",
                "space-8": "48px",
                "font-sans": '"Roboto", "Helvetica", "Arial", sans-serif',
                "font-weight-normal": "400",
                "font-weight-semibold": "500",
                "font-weight-bold": "700",
                "letter-spacing-tight": "-0.005em",
                "letter-spacing-normal": "0",
                "letter-spacing-wide": "0.01em",
                "headline-weight": "500",
                "headline-size": "2rem",
                "button-style": "filled",
                "button-padding-x": "16px",
                "button-padding-y": "10px",
                "table-header-bg": "#f5f5f5",
                "table-header-text": "#212121",
                "table-row-hover": "#fafafa",
                "table-border": "#e0e0e0",
                "focus-ring": "#1976d2",
            },
            dark: {
                bg: "#121212",
                surface: "#1e1e1e",
                "surface-2": "#2c2c2c",
                text: "#ffffff",
                muted: "#b0b0b0",
                primary: "#90caf9",
                "primary-hover": "#64b5f6",
                "primary-contrast": "#000000",
                success: "#66bb6a",
                danger: "#ef5350",
                warning: "#ffa726",
                border: "#424242",
                "border-strong": "#616161",
                "shadow-sm": "0 1px 3px rgba(0, 0, 0, 0.5)",
                "shadow-md": "0 3px 6px rgba(0, 0, 0, 0.6)",
                "shadow-lg": "0 10px 20px rgba(0, 0, 0, 0.7)",
                "radius-sm": "4px",
                "radius-md": "8px",
                "radius-lg": "12px",
                "space-1": "4px",
                "space-2": "8px",
                "space-3": "12px",
                "space-4": "16px",
                "space-5": "24px",
                "space-6": "32px",
                "space-7": "40px",
                "space-8": "48px",
                "font-sans": '"Roboto", "Helvetica", "Arial", sans-serif',
                "font-weight-normal": "400",
                "font-weight-semibold": "500",
                "font-weight-bold": "700",
                "letter-spacing-tight": "-0.005em",
                "letter-spacing-normal": "0",
                "letter-spacing-wide": "0.01em",
                "headline-weight": "500",
                "headline-size": "2rem",
                "button-style": "filled",
                "button-padding-x": "16px",
                "button-padding-y": "10px",
                "table-header-bg": "#2c2c2c",
                "table-header-text": "#ffffff",
                "table-row-hover": "#1e1e1e",
                "table-border": "#424242",
                "focus-ring": "#90caf9",
            },
        },
    },
    pro: {
        labelHe: "מקצועי",
        tokens: {
            light: {
                bg: "#f6f9fc",
                surface: "#ffffff",
                "surface-2": "#f8fafc",
                text: "#0a2540",
                muted: "#6b7c93",
                primary: "#635bff",
                "primary-hover": "#5851e6",
                "primary-contrast": "#ffffff",
                success: "#00d97e",
                danger: "#df1c41",
                warning: "#ffb020",
                border: "#e3e8ef",
                "border-strong": "#cbd5e0",
                "shadow-sm": "0 1px 2px rgba(0, 0, 0, 0.05)",
                "shadow-md": "0 4px 6px rgba(0, 0, 0, 0.07), 0 1px 3px rgba(0, 0, 0, 0.06)",
                "shadow-lg": "0 10px 15px rgba(0, 0, 0, 0.1), 0 4px 6px rgba(0, 0, 0, 0.05)",
                "radius-sm": "6px",
                "radius-md": "10px",
                "radius-lg": "16px",
                "space-1": "4px",
                "space-2": "8px",
                "space-3": "12px",
                "space-4": "16px",
                "space-5": "20px",
                "space-6": "24px",
                "space-7": "32px",
                "space-8": "40px",
                "font-sans": '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
                "font-weight-normal": "400",
                "font-weight-semibold": "600",
                "font-weight-bold": "700",
                "letter-spacing-tight": "-0.02em",
                "letter-spacing-normal": "0",
                "letter-spacing-wide": "0.01em",
                "headline-weight": "600",
                "headline-size": "1.875rem",
                "button-style": "filled",
                "button-padding-x": "14px",
                "button-padding-y": "8px",
                "table-header-bg": "#f8fafc",
                "table-header-text": "#0a2540",
                "table-row-hover": "#f6f9fc",
                "table-border": "#e3e8ef",
                "focus-ring": "#635bff",
            },
            dark: {
                bg: "#0a2540",
                surface: "#1a365d",
                "surface-2": "#2d3748",
                text: "#f7fafc",
                muted: "#a0aec0",
                primary: "#7c3aed",
                "primary-hover": "#6d28d9",
                "primary-contrast": "#ffffff",
                success: "#10b981",
                danger: "#ef4444",
                warning: "#f59e0b",
                border: "#2d3748",
                "border-strong": "#4a5568",
                "shadow-sm": "0 1px 2px rgba(0, 0, 0, 0.3)",
                "shadow-md": "0 4px 6px rgba(0, 0, 0, 0.4), 0 1px 3px rgba(0, 0, 0, 0.3)",
                "shadow-lg": "0 10px 15px rgba(0, 0, 0, 0.5), 0 4px 6px rgba(0, 0, 0, 0.4)",
                "radius-sm": "6px",
                "radius-md": "10px",
                "radius-lg": "16px",
                "space-1": "4px",
                "space-2": "8px",
                "space-3": "12px",
                "space-4": "16px",
                "space-5": "20px",
                "space-6": "24px",
                "space-7": "32px",
                "space-8": "40px",
                "font-sans": '-apple-system, BlinkMacSystemFont, "Segoe UI", "Helvetica Neue", Arial, sans-serif',
                "font-weight-normal": "400",
                "font-weight-semibold": "600",
                "font-weight-bold": "700",
                "letter-spacing-tight": "-0.02em",
                "letter-spacing-normal": "0",
                "letter-spacing-wide": "0.01em",
                "headline-weight": "600",
                "headline-size": "1.875rem",
                "button-style": "filled",
                "button-padding-x": "14px",
                "button-padding-y": "8px",
                "table-header-bg": "#2d3748",
                "table-header-text": "#f7fafc",
                "table-row-hover": "#1a365d",
                "table-border": "#2d3748",
                "focus-ring": "#7c3aed",
            },
        },
    },
};

export const DEFAULT_THEME: ThemeId = "luxury";
export const DEFAULT_MODE: ThemeMode = "light";


