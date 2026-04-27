import * as nodePty from "node-pty";
import { v4 as uuidv4 } from "uuid";
import { RingBuffer } from "./ring-buffer.js";
import { TerminalEmulator, type ScreenState } from "./terminal-emulator.js";
import { resolveKey } from "./key-map.js";

export interface SessionOptions {
  shell?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
  scrollback?: number;
}

export interface SessionInfo {
  sessionId: string;
  shell: string;
  cwd: string;
  cols: number;
  rows: number;
  pid: number;
  createdAt: string;
  lastActivityAt: string;
}

interface WaitHandle {
  pattern?: RegExp;
  settleMs: number;
  timeoutMs: number;
  sinceGeneration?: number;
  resolve: (result: WaitResult) => void;
  settleTimer?: ReturnType<typeof setTimeout>;
  timeoutTimer?: ReturnType<typeof setTimeout>;
}

export interface WaitResult {
  matched: boolean;
  matchText?: string;
  timedOut: boolean;
  exited: boolean;
  generation: number;
  screen: string;
}

/**
 * A single persistent PTY session.
 * Owns: node-pty process + xterm/headless terminal emulator + scrollback ring buffer.
 */
export class PtySession {
  readonly id: string;
  private readonly pty: nodePty.IPty;
  private readonly emulator: TerminalEmulator;
  private readonly scrollbackBuf: RingBuffer<string>;
  readonly createdAt: Date;
  lastActivity: Date;
  private lastModified: Date;
  private generation = 0;
  private readonly shellPath: string;
  private readonly cwdPath: string;
  private readonly waiters: Set<WaitHandle> = new Set();
  private exited = false;

  constructor(options: SessionOptions = {}) {
    this.id = uuidv4();
    this.createdAt = new Date();
    this.lastActivity = new Date();
    this.lastModified = new Date();

    const cols = options.cols ?? parseInt(process.env.PTYAI_DEFAULT_COLS ?? "220", 10);
    const rows = options.rows ?? parseInt(process.env.PTYAI_DEFAULT_ROWS ?? "50", 10);
    const scrollbackCap = options.scrollback ?? parseInt(process.env.PTYAI_DEFAULT_SCROLLBACK ?? "1000", 10);

    this.shellPath = options.shell ?? defaultShell();
    this.cwdPath = options.cwd ?? process.env.HOME ?? process.cwd();

    this.emulator = new TerminalEmulator(cols, rows, 0);
    this.scrollbackBuf = new RingBuffer<string>(scrollbackCap);

    const env: Record<string, string> = {
      ...process.env as Record<string, string>,
      TERM: "xterm-256color",
      COLORTERM: "truecolor",
      ...options.env,
    };

    this.pty = nodePty.spawn(this.shellPath, options.args ?? [], {
      name: "xterm-256color",
      cols,
      rows,
      cwd: this.cwdPath,
      env,
    });

    this.pty.onData((data) => this.handleData(data));
    this.pty.onExit(() => {
      this.exited = true;
      const screen = this.emulator.getScreen().screen;
      for (const waiter of [...this.waiters]) {
        this.resolveWaiter(waiter, { matched: false, timedOut: false, exited: true, generation: this.generation, screen });
      }
    });
  }

  private handleData(data: string): void {
    this.lastActivity = new Date();
    void this.emulator.write(data).then(() => {
      this.generation++;
      this.lastModified = new Date();
      const lines = data.split(/\r?\n/);
      for (let i = 0; i < lines.length - 1; i++) {
        this.scrollbackBuf.push(lines[i]!);
      }
      this.notifyWaiters();
    });
  }

  private notifyWaiters(): void {
    const screenText = this.emulator.getScreen().screen;
    const gen = this.generation;

    for (const waiter of this.waiters) {
      if (waiter.sinceGeneration !== undefined && gen <= waiter.sinceGeneration) {
        // No new output yet relative to the caller's snapshot; keep waiting
        this.resetSettleTimer(waiter, screenText, gen);
        continue;
      }
      if (waiter.pattern) {
        const match = screenText.match(waiter.pattern);
        if (match) {
          this.resolveWaiter(waiter, { matched: true, matchText: match[0], timedOut: false, exited: false, generation: gen, screen: screenText });
        } else {
          this.resetSettleTimer(waiter, screenText, gen);
        }
      } else {
        this.resetSettleTimer(waiter, screenText, gen);
      }
    }
  }

  private resetSettleTimer(waiter: WaitHandle, screenText: string, generation: number): void {
    if (waiter.settleTimer) clearTimeout(waiter.settleTimer);
    waiter.settleTimer = setTimeout(() => {
      this.resolveWaiter(waiter, { matched: false, timedOut: false, exited: false, generation, screen: screenText });
    }, waiter.settleMs);
  }

  private resolveWaiter(waiter: WaitHandle, result: WaitResult): void {
    if (!this.waiters.has(waiter)) return;
    this.waiters.delete(waiter);
    if (waiter.settleTimer) clearTimeout(waiter.settleTimer);
    if (waiter.timeoutTimer) clearTimeout(waiter.timeoutTimer);
    waiter.resolve(result);
  }

  /** Write raw text/bytes to the PTY stdin. */
  write(input: string): number {
    if (this.exited) throw new Error(`Session ${this.id} has exited`);
    this.lastActivity = new Date();
    this.pty.write(input);
    return Buffer.byteLength(input, "utf8");
  }

  /** Send a named special key (e.g. "ctrl+c", "up", "f1"). */
  sendKey(key: string): string {
    const seq = resolveKey(key);
    if (!seq) throw new Error(`Unknown key: "${key}". Use pty_list_keys to see valid key names.`);
    this.write(seq);
    return seq;
  }

  /** Read the current screen state. */
  read(scrollbackLines?: number): ScreenState & { scrollback: string[]; generation: number; lastModified: Date } {
    const state = this.emulator.getScreen();
    const scrollback = scrollbackLines !== undefined
      ? this.scrollbackBuf.tail(scrollbackLines)
      : this.scrollbackBuf.toArray();
    return { ...state, scrollback, generation: this.generation, lastModified: this.lastModified };
  }

  /** Wait for output to match a pattern or settle, then return the screen. */
  wait(options: {
    pattern?: string;
    timeoutMs?: number;
    settleMs?: number;
    sinceGeneration?: number;
  }): Promise<WaitResult> {
    const timeoutMs = options.timeoutMs ?? parseInt(process.env.PTYAI_WAIT_TIMEOUT_MS ?? "10000", 10);
    const settleMs = options.settleMs ?? parseInt(process.env.PTYAI_WAIT_SETTLE_MS ?? "300", 10);
    const pattern = options.pattern ? new RegExp(options.pattern) : undefined;
    const sinceGeneration = options.sinceGeneration;

    return new Promise<WaitResult>((resolve) => {
      const waiter: WaitHandle = { pattern, settleMs, timeoutMs, sinceGeneration, resolve };
      this.waiters.add(waiter);

      // Check immediately — only if we're not waiting for a future generation
      if (pattern && (sinceGeneration === undefined || this.generation > sinceGeneration)) {
        const screen = this.emulator.getScreen().screen;
        const match = screen.match(pattern);
        if (match) {
          this.resolveWaiter(waiter, { matched: true, matchText: match[0], timedOut: false, exited: false, generation: this.generation, screen });
          return;
        }
      }

      this.resetSettleTimer(waiter, this.emulator.getScreen().screen, this.generation);

      waiter.timeoutTimer = setTimeout(() => {
        const screen = this.emulator.getScreen().screen;
        this.resolveWaiter(waiter, { matched: false, timedOut: true, exited: false, generation: this.generation, screen });
      }, timeoutMs);
    });
  }

  /** Resize the terminal. */
  resize(cols: number, rows: number): void {
    this.emulator.resize(cols, rows);
    this.pty.resize(cols, rows);
    this.lastActivity = new Date();
  }

  /** Kill the PTY process and release resources. */
  kill(signal: string = "SIGTERM"): void {
    const screen = this.emulator.getScreen().screen;
    for (const waiter of this.waiters) {
      this.resolveWaiter(waiter, { matched: false, timedOut: true, exited: true, generation: this.generation, screen });
    }
    try {
      this.pty.kill(signal);
    } catch {
      // Already dead
    }
    this.emulator.dispose();
  }

  get info(): SessionInfo {
    return {
      sessionId: this.id,
      shell: this.shellPath,
      cwd: this.cwdPath,
      cols: this.emulator.cols,
      rows: this.emulator.rows,
      pid: this.pty.pid,
      createdAt: this.createdAt.toISOString(),
      lastActivityAt: this.lastActivity.toISOString(),
    };
  }

  get isExited(): boolean {
    return this.exited;
  }

  get currentGeneration(): number {
    return this.generation;
  }
}

function defaultShell(): string {
  if (process.env.PTYAI_DEFAULT_SHELL) return process.env.PTYAI_DEFAULT_SHELL;
  if (process.platform === "win32") {
    return process.env.ComSpec ?? "cmd.exe";
  }
  return process.env.SHELL ?? "/bin/bash";
}
