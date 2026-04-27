// Import types only from the type declarations
import type { Terminal as TerminalType } from "@xterm/headless";
// @xterm/headless is a CJS module — load the runtime value via createRequire
import { createRequire } from "module";
const _require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-require-imports
const XtermHeadless = _require("@xterm/headless") as { Terminal: new (...args: ConstructorParameters<typeof TerminalType>) => TerminalType };

export interface ScreenState {
  /** Visible terminal rows as plain text, joined by \n */
  screen: string;
  /** 0-indexed cursor column */
  cursorX: number;
  /** 0-indexed cursor row (within visible viewport) */
  cursorY: number;
  cols: number;
  rows: number;
  /** True when an alternate screen buffer is active (vim, htop, less, etc.) */
  altScreen: boolean;
}

/**
 * Wraps @xterm/headless Terminal to provide a server-side VT100/ANSI/UTF-8
 * terminal emulator. Accepts raw PTY output and exposes a rendered screen.
 */
export class TerminalEmulator {
  private term: TerminalType;
  private _altScreen = false;

  constructor(cols: number, rows: number, scrollback: number = 0) {
    // scrollback=0 because we manage scrollback in our own RingBuffer;
    // xterm's internal scrollback is not needed (and would double memory use).
    this.term = new XtermHeadless.Terminal({
      cols,
      rows,
      scrollback,
      allowProposedApi: true,
    });

    // Track alternate screen switches by watching OSC/DEC private sequences
    // xterm fires an onData-like event for write; we detect alt screen via buffer type
  }

  /** Feed raw PTY output into the emulator. Resolves when xterm has finished processing. */
  write(data: string): Promise<void> {
    return new Promise<void>((resolve) => {
      this.term.write(data, () => {
        this._altScreen = this.term.buffer.active === this.term.buffer.alternate;
        resolve();
      });
    });
  }

  /** Get the current screen state (visible viewport only). */
  getScreen(): ScreenState {
    const buf = this.term.buffer.active;
    const lines: string[] = [];

    for (let y = 0; y < this.term.rows; y++) {
      const line = buf.getLine(y + buf.viewportY);
      if (!line) {
        lines.push("");
        continue;
      }
      let row = "";
      for (let x = 0; x < this.term.cols; x++) {
        const cell = line.getCell(x);
        row += cell ? cell.getChars() || " " : " ";
      }
      // Trim trailing spaces to reduce noise in agent output
      lines.push(row.trimEnd());
    }

    return {
      screen: lines.join("\n"),
      cursorX: buf.cursorX,
      cursorY: buf.cursorY,
      cols: this.term.cols,
      rows: this.term.rows,
      altScreen: this._altScreen,
    };
  }

  /** Resize the terminal. */
  resize(cols: number, rows: number): void {
    this.term.resize(cols, rows);
  }

  /** True if an alternate screen buffer is currently active. */
  get isAltScreen(): boolean {
    return this._altScreen;
  }

  /** Current terminal dimensions. */
  get cols(): number { return this.term.cols; }
  get rows(): number { return this.term.rows; }

  dispose(): void {
    this.term.dispose();
  }
}
