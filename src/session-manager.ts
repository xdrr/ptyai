import { PtySession, type SessionOptions, type SessionInfo } from "./pty-session.js";

/**
 * Singleton registry of all active PTY sessions.
 * Handles creation, lookup, cleanup, and idle-timeout eviction.
 */
export class SessionManager {
  private readonly sessions = new Map<string, PtySession>();
  private readonly idleTimer: ReturnType<typeof setInterval>;
  private readonly maxSessions: number;
  private readonly idleTimeoutMs: number;

  constructor() {
    this.maxSessions = parseInt(process.env.PTYAI_MAX_SESSIONS ?? "50", 10);
    this.idleTimeoutMs = parseInt(process.env.PTYAI_IDLE_TIMEOUT_MS ?? "1800000", 10);

    // Sweep for idle/exited sessions every minute
    this.idleTimer = setInterval(() => this.sweep(), 60_000);
    // Don't let this timer prevent process exit
    this.idleTimer.unref?.();
  }

  create(options: SessionOptions = {}): PtySession {
    if (this.sessions.size >= this.maxSessions) {
      throw new Error(
        `Maximum session limit (${this.maxSessions}) reached. Kill an existing session first.`
      );
    }
    const session = new PtySession(options);
    this.sessions.set(session.id, session);
    return session;
  }

  get(sessionId: string): PtySession {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Session not found: ${sessionId}`);
    return session;
  }

  remove(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  list(): SessionInfo[] {
    return Array.from(this.sessions.values()).map((s) => s.info);
  }

  private sweep(): void {
    const now = Date.now();
    for (const [id, session] of this.sessions) {
      const idle = now - session.lastActivity.getTime();
      if (session.isExited || idle > this.idleTimeoutMs) {
        try { session.kill(); } catch { /* already dead */ }
        this.sessions.delete(id);
      }
    }
  }

  shutdown(): void {
    clearInterval(this.idleTimer);
    for (const [id, session] of this.sessions) {
      try { session.kill(); } catch { /* ignore */ }
      this.sessions.delete(id);
    }
  }
}

// Module-level singleton
export const manager = new SessionManager();
