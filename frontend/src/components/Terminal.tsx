"use client";

import { useEffect, useRef, useState } from "react";
import { Terminal as XTerm } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebLinksAddon } from "@xterm/addon-web-links";
import { io, Socket } from "socket.io-client";
import { API_BASE_URL, getAccessToken } from "@/lib/api";
import "@xterm/xterm/css/xterm.css";

interface TerminalProps {
    className?: string;
}

export function Terminal({ className }: TerminalProps) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const [connected, setConnected] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!terminalRef.current) return;

        // Initialize xterm.js
        const xterm = new XTerm({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: "'Courier New', monospace",
            theme: {
                background: "#1e1e1e",
                foreground: "#d4d4d4",
                cursor: "#aeafad",
                selectionBackground: "#264f78",
            },
        });

        const fitAddon = new FitAddon();
        const webLinksAddon = new WebLinksAddon();

        xterm.loadAddon(fitAddon);
        xterm.loadAddon(webLinksAddon);

        xterm.open(terminalRef.current);
        fitAddon.fit();

        xtermRef.current = xterm;
        fitAddonRef.current = fitAddon;

        // Get WebSocket URL from API base URL
        const apiUrl = API_BASE_URL.replace(/^https?:\/\//, "").replace(/\/api$/, "");
        const wsProtocol = API_BASE_URL.startsWith("https") ? "wss" : "ws";
        const wsUrl = `${wsProtocol}://${apiUrl}`;

        // Get access token
        const token = getAccessToken();

        if (!token) {
            setError("No access token available. Please log in.");
            return;
        }

        // Connect to WebSocket
        const socket = io(`${wsUrl}/terminal`, {
            auth: {
                token: token,
            },
            transports: ["websocket", "polling"],
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5,
        });

        socketRef.current = socket;

        // Handle connection
        socket.on("connect", () => {
            setConnected(true);
            setError(null);
            xterm.writeln("\r\n\x1b[32m✓ Connected to terminal\x1b[0m\r\n");
        });

        socket.on("disconnect", (reason) => {
            setConnected(false);
            if (reason === "io server disconnect") {
                // Server disconnected, try to reconnect
                socket.connect();
            }
        });

        socket.on("connect_error", (err) => {
            setConnected(false);
            setError(err.message || "Connection error");
            xterm.writeln(`\r\n\x1b[31m✗ Connection error: ${err.message}\x1b[0m\r\n`);
        });

        // Handle terminal output
        socket.on("terminal-output", (data: string) => {
            xterm.write(data);
        });

        // Handle errors
        socket.on("error", (err: { message?: string }) => {
            const message = err.message || "Unknown error";
            setError(message);
            xterm.writeln(`\r\n\x1b[31m✗ Error: ${message}\x1b[0m\r\n`);
        });

        // Handle terminal input
        xterm.onData((data: string) => {
            if (socket.connected) {
                socket.emit("terminal-input", { input: data });
            }
        });

        // Handle terminal resize
        const handleResize = () => {
            if (fitAddonRef.current && xtermRef.current) {
                fitAddonRef.current.fit();
                const dimensions = xtermRef.current;
                if (socket.connected) {
                    socket.emit("terminal-resize", {
                        cols: dimensions.cols,
                        rows: dimensions.rows,
                    });
                }
            }
        };

        window.addEventListener("resize", handleResize);

        // Initial resize message
        if (socket.connected && xtermRef.current) {
            socket.emit("terminal-resize", {
                cols: xtermRef.current.cols,
                rows: xtermRef.current.rows,
            });
        }

        // Cleanup
        return () => {
            window.removeEventListener("resize", handleResize);
            socket.disconnect();
            xterm.dispose();
        };
    }, []);

    return (
        <div className={`flex flex-col h-full ${className || ""}`} dir="ltr">
            <div
                className="flex-1 overflow-hidden bg-[#1e1e1e] rounded-theme-md p-2"
                style={{ minHeight: "400px" }}
            >
                <div
                    ref={terminalRef}
                    className="h-full w-full"
                    style={{ height: "100%", direction: "ltr", textAlign: "left" }}
                />
            </div>
            {error && (
                <div className="mt-2 p-2 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-theme-md text-sm">
                    {error}
                </div>
            )}
            {connected && (
                <div className="mt-2 text-xs text-muted">
                    <span className="text-green-600 dark:text-green-400">●</span> Connected
                </div>
            )}
        </div>
    );
}
