/**
 * Maps symbolic key names to their terminal escape sequences.
 * Agents use these names in pty_sendkey; the sequences are written to the PTY.
 */

// Application/normal cursor key sequences (DECCKM off = normal mode)
const KEY_MAP: Record<string, string> = {
  // Control characters
  "ctrl+@": "\x00",
  "ctrl+a": "\x01",
  "ctrl+b": "\x02",
  "ctrl+c": "\x03",
  "ctrl+d": "\x04",
  "ctrl+e": "\x05",
  "ctrl+f": "\x06",
  "ctrl+g": "\x07",
  "ctrl+h": "\x08",
  "ctrl+i": "\x09",
  "ctrl+j": "\x0A",
  "ctrl+k": "\x0B",
  "ctrl+l": "\x0C",
  "ctrl+m": "\x0D",
  "ctrl+n": "\x0E",
  "ctrl+o": "\x0F",
  "ctrl+p": "\x10",
  "ctrl+q": "\x11",
  "ctrl+r": "\x12",
  "ctrl+s": "\x13",
  "ctrl+t": "\x14",
  "ctrl+u": "\x15",
  "ctrl+v": "\x16",
  "ctrl+w": "\x17",
  "ctrl+x": "\x18",
  "ctrl+y": "\x19",
  "ctrl+z": "\x1A",
  "ctrl+[": "\x1B",
  "ctrl+\\": "\x1C",
  "ctrl+]": "\x1D",
  "ctrl+^": "\x1E",
  "ctrl+_": "\x1F",

  // Common named keys
  "enter": "\r",
  "return": "\r",
  "tab": "\t",
  "shift+tab": "\x1B[Z",
  "backspace": "\x7F",
  "escape": "\x1B",
  "esc": "\x1B",
  "space": " ",
  "delete": "\x1B[3~",
  "insert": "\x1B[2~",

  // Arrow keys (VT100 / xterm normal mode)
  "up": "\x1B[A",
  "down": "\x1B[B",
  "right": "\x1B[C",
  "left": "\x1B[D",

  // Arrow keys with modifiers
  "shift+up": "\x1B[1;2A",
  "shift+down": "\x1B[1;2B",
  "shift+right": "\x1B[1;2C",
  "shift+left": "\x1B[1;2D",
  "ctrl+up": "\x1B[1;5A",
  "ctrl+down": "\x1B[1;5B",
  "ctrl+right": "\x1B[1;5C",
  "ctrl+left": "\x1B[1;5D",
  "alt+up": "\x1B[1;3A",
  "alt+down": "\x1B[1;3B",
  "alt+right": "\x1B[1;3C",
  "alt+left": "\x1B[1;3D",

  // Navigation
  "home": "\x1B[H",
  "end": "\x1B[F",
  "pageup": "\x1B[5~",
  "page_up": "\x1B[5~",
  "pagedown": "\x1B[6~",
  "page_down": "\x1B[6~",

  // Function keys (xterm sequences)
  "f1": "\x1BOP",
  "f2": "\x1BOQ",
  "f3": "\x1BOR",
  "f4": "\x1BOS",
  "f5": "\x1B[15~",
  "f6": "\x1B[17~",
  "f7": "\x1B[18~",
  "f8": "\x1B[19~",
  "f9": "\x1B[20~",
  "f10": "\x1B[21~",
  "f11": "\x1B[23~",
  "f12": "\x1B[24~",

  // Shifted function keys
  "shift+f1": "\x1B[1;2P",
  "shift+f2": "\x1B[1;2Q",
  "shift+f3": "\x1B[1;2R",
  "shift+f4": "\x1B[1;2S",
  "shift+f5": "\x1B[15;2~",
  "shift+f6": "\x1B[17;2~",
  "shift+f7": "\x1B[18;2~",
  "shift+f8": "\x1B[19;2~",
  "shift+f9": "\x1B[20;2~",
  "shift+f10": "\x1B[21;2~",
  "shift+f11": "\x1B[23;2~",
  "shift+f12": "\x1B[24;2~",

  // Alt + common keys
  "alt+enter": "\x1B\r",
  "alt+backspace": "\x1B\x7F",
};

/**
 * Look up the escape sequence for a symbolic key name.
 * Returns undefined if the key is not recognized.
 */
export function resolveKey(key: string): string | undefined {
  return KEY_MAP[key.toLowerCase()];
}

/** All known key names, for documentation/help. */
export function knownKeys(): string[] {
  return Object.keys(KEY_MAP);
}
