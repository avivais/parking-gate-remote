import { Injectable, Logger } from '@nestjs/common';
import { spawn, IPty } from 'node-pty';

interface TerminalSession {
    pty: IPty;
    userId: string;
    createdAt: Date;
    lastActivity: Date;
}

@Injectable()
export class TerminalService {
    private readonly logger = new Logger(TerminalService.name);
    private sessions = new Map<string, TerminalSession>();

    createTerminal(sessionId: string, userId: string, outputCallback?: (data: string) => void): void {
        if (this.sessions.has(sessionId)) {
            this.logger.warn(`Session ${sessionId} already exists`);
            return;
        }

        try {
            this.logger.log(`Connecting to ubuntu@host.docker.internal via SSH`);

            // SSH to the host as ubuntu user
            // Use -tt to force TTY allocation (double t = force even if not a terminal)
            const command = 'ssh';
            const commandArgs = [
                '-tt', // Force TTY allocation (needed for interactive shell)
                '-o',
                'StrictHostKeyChecking=no', // Disable host key checking for simplicity
                '-o',
                'UserKnownHostsFile=/dev/null', // Don't store host keys
                '-o',
                'LogLevel=ERROR', // Suppress SSH warnings to stderr
                '-i',
                '/app/ssh-keys/container_key', // Path to the private key mounted in the container
                'ubuntu@host.docker.internal', // Use host.docker.internal to reach the host
                '/bin/bash', // Full path to bash
                '-i', // Interactive shell
                '-l', // Login shell
            ];

            const pty = spawn(command, commandArgs, {
                name: 'xterm-color',
                cols: 80,
                rows: 24,
                cwd: '/tmp', // Working directory in container (SSH handles remote home directory)
                env: {
                    ...process.env,
                    TERM: 'xterm-256color',
                    COLORTERM: 'truecolor',
                },
            });

            // Set up output handler immediately to capture all output
            if (outputCallback) {
                pty.onData(outputCallback);
            }

            const session: TerminalSession = {
                pty,
                userId,
                createdAt: new Date(),
                lastActivity: new Date(),
            };

            this.sessions.set(sessionId, session);

            this.logger.log(
                `Terminal session created: ${sessionId} for user ${userId} (SSH to host)`,
            );

            // Cleanup on exit
            pty.onExit((exitCode) => {
                this.logger.log(
                    `Terminal session ${sessionId} exited with code ${exitCode}`,
                );
                this.destroyTerminal(sessionId);
            });
        } catch (error) {
            this.logger.error(
                `Failed to create terminal session ${sessionId}:`,
                error,
            );
            throw error;
        }
    }

    writeToTerminal(sessionId: string, data: string): void {
        const session = this.sessions.get(sessionId);
        if (!session) {
            this.logger.warn(`Session ${sessionId} not found`);
            return;
        }

        try {
            session.pty.write(data);
            session.lastActivity = new Date();
        } catch (error) {
            this.logger.error(`Failed to write to terminal ${sessionId}:`, error);
        }
    }

    resizeTerminal(sessionId: string, cols: number, rows: number): void {
        const session = this.sessions.get(sessionId);
        if (!session) {
            this.logger.warn(`Session ${sessionId} not found`);
            return;
        }

        try {
            session.pty.resize(cols, rows);
            session.lastActivity = new Date();
        } catch (error) {
            this.logger.error(
                `Failed to resize terminal ${sessionId}:`,
                error,
            );
        }
    }

    getTerminalOutput(
        sessionId: string,
        callback: (data: string) => void,
    ): void {
        const session = this.sessions.get(sessionId);
        if (!session) {
            this.logger.warn(`Session ${sessionId} not found`);
            return;
        }

        session.pty.onData((data: string) => {
            callback(data);
        });
    }

    destroyTerminal(sessionId: string): void {
        const session = this.sessions.get(sessionId);
        if (!session) {
            return;
        }

        try {
            session.pty.kill();
            this.sessions.delete(sessionId);
            this.logger.log(`Terminal session ${sessionId} destroyed`);
        } catch (error) {
            this.logger.error(
                `Failed to destroy terminal ${sessionId}:`,
                error,
            );
        }
    }

    hasSession(sessionId: string): boolean {
        return this.sessions.has(sessionId);
    }

    getSessionUserId(sessionId: string): string | undefined {
        return this.sessions.get(sessionId)?.userId;
    }

    cleanupInactiveSessions(maxInactiveMinutes: number = 30): void {
        const now = new Date();
        const maxInactiveMs = maxInactiveMinutes * 60 * 1000;

        for (const [sessionId, session] of this.sessions.entries()) {
            const inactiveMs = now.getTime() - session.lastActivity.getTime();
            if (inactiveMs > maxInactiveMs) {
                this.logger.log(
                    `Cleaning up inactive session ${sessionId} (inactive for ${Math.round(inactiveMs / 60000)} minutes)`,
                );
                this.destroyTerminal(sessionId);
            }
        }
    }
}
