import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { NavigationGuard } from "@/components/NavigationGuard";
import { AppTopBarWrapper } from "@/components/AppTopBarWrapper";
import "./globals.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: "מצפה 6-8 • פתיחת שער חניה",
    description: "אפליקציה לפתיחת שער חניה",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="he" dir="rtl">
            <body
                className={`${geistSans.variable} ${geistMono.variable} antialiased overflow-x-hidden`}
            >
                <ThemeProvider>
                    <AuthProvider>
                        <NavigationGuard>
                            <AppTopBarWrapper />
                            {children}
                        </NavigationGuard>
                        <Toaster
                            position="top-center"
                            toastOptions={{
                                className: "toast-theme",
                                style: {
                                    background: "var(--surface)",
                                    color: "var(--text)",
                                    border: "1px solid var(--border)",
                                    borderRadius: "var(--radius-md)",
                                    boxShadow: "var(--shadow-md)",
                                },
                                success: {
                                    iconTheme: {
                                        primary: "var(--success)",
                                        secondary: "var(--surface)",
                                    },
                                },
                                error: {
                                    iconTheme: {
                                        primary: "var(--danger)",
                                        secondary: "var(--surface)",
                                    },
                                },
                            }}
                        />
                    </AuthProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}

