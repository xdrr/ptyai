# ptyai

An MCP server that gives AI agents (namely, Claude Code) a persistent PTY (pseudo-terminal) with full VT100/ANSI/xterm emulation. Replaces one-shot `Bash()` tool calls with a persistent terminal that supports interactive applications.

## Features

- **Persistent sessions** — UUID-based, survive across multiple tool calls
- **Full terminal emulation** — VT100/VT220/xterm-256color via `@xterm/headless`
- **Alternate screen support** — vim, htop, less, and similar TUI apps work correctly
- **Interactive apps** — telnet, ssh, python REPL, vim, htop, etc.
- **ANSI + UTF-8** — full color and multibyte character support
- **Ring buffer scrollback** — configurable per-session history
- **Concurrent sessions** — multiple agents can each hold their own session
- **Cross-platform** — Linux, macOS, Windows (ConPTY, Win 10 1809+)

## Installation

```bash
npm install -g ptyai
```

Then run the installer to configure Claude Code:

```bash
ptyai install
```

This runs `claude mcp add --scope user` to register ptyai as a user-scoped MCP server —
available in every project you open, with no per-project `.mcp.json` required. It also
updates `~/.claude/settings.json` (tool permissions, Bash tool disabled) and appends
usage instructions to `~/.claude/CLAUDE.md`. Each developer on a shared team runs
`ptyai install` once on their own machine. A confirmation prompt is shown before any
files are written.

To register ptyai for a single project instead (writes `.mcp.json` in the current
directory):

```bash
ptyai install --project
```

### Install flags

| Flag | Description |
|------|-------------|
| `--project` | Write `.mcp.json` in the current directory instead of global install |
| `--dry-run` | Preview changes without writing anything |
| `--uninstall` | Remove ptyai from the relevant config |
| `--local` | Use local dist/ path instead of `npx ptyai` |
| `--force` | Overwrite even if ptyai is already configured |

The installer:
- Never overwrites unrelated settings — always merges
- Backs up each modified file to `*.ptyai-backup` before writing
- Is idempotent — safe to run multiple times

## Manual Setup

### Claude Code (global)

Register as a user-scoped MCP server (available in all projects):

```bash
claude mcp add --scope user ptyai -- npx -y ptyai
```

Then add tool permissions to `~/.claude/settings.json`:

```json
{
  "permissions": {
    "allow": [
      "mcp__ptyai__pty_create", "mcp__ptyai__pty_write", "mcp__ptyai__pty_sendkey",
      "mcp__ptyai__pty_wait",   "mcp__ptyai__pty_read",  "mcp__ptyai__pty_resize",
      "mcp__ptyai__pty_kill",   "mcp__ptyai__pty_list",  "mcp__ptyai__pty_list_keys"
    ],
    "deny": ["Bash"]
  }
}
```

### Claude Code (project-scoped)

Add to `.mcp.json` in your project root:

```json
{
  "mcpServers": {
    "ptyai": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "ptyai"]
    }
  }
}
```

### Local development

```bash
git clone https://github.com/xdrr/ptyai
cd ptyai
npm install
npm run build
```

Then in your MCP config:
```json
{
  "mcpServers": {
    "ptyai": {
      "command": "node",
      "args": ["/path/to/ptyai/dist/index.js"],
      "type": "stdio"
    }
  }
}
```

## Tools

### `pty_create`
Create a new PTY session. Returns a `session_id` used by all other tools.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `shell` | string | `$SHELL` / `cmd.exe` | Shell executable |
| `args` | string[] | `[]` | Extra shell arguments |
| `cwd` | string | `$HOME` | Working directory |
| `env` | object | `{}` | Extra environment variables |
| `cols` | number | 220 | Terminal width |
| `rows` | number | 50 | Terminal height |
| `scrollback` | number | 1000 | Scrollback buffer size |

### `pty_write`
Send raw text or escape sequences to the PTY stdin. Optionally waits for output, combining `pty_write` + `pty_wait` in a single round-trip.

Use `\r` for Enter, `\x03` for Ctrl+C, `\x1B` for Escape. For named keys, use `pty_sendkey`.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `input` | string | — | Text or escape sequences to write |
| `wait_for` | string | — | Regex to wait for after writing. Uses `since_generation` internally so stale screen content never causes a false match |
| `timeout_ms` | number | 10000 | Max wait time in ms (only used when waiting) |
| `settle_ms` | number | 300 | ms of silence that counts as settled (only used when waiting) |
| `include_screen` | boolean | true | Include rendered screen in response when waiting. Set to `false` to save tokens when you only need `matched`/`timed_out`/`generation` |

### `pty_sendkey`
Send one or more named special keys. Use `key` for a single key or `keys` (array) to send multiple in one call.

Examples:
- `ctrl+c` — interrupt (SIGINT)
- `ctrl+d` — EOF
- `ctrl+z` — suspend (SIGTSTP)
- `up`, `down`, `left`, `right` — arrow keys
- `escape` — Escape key
- `tab`, `shift+tab` — Tab / reverse tab
- `f1`–`f12` — function keys
- `home`, `end`, `pageup`, `pagedown`
- `ctrl+left`, `ctrl+right` — word navigation

Use `pty_list_keys` to see all supported names.

### `pty_read`
Read the current rendered terminal screen.

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `include_scrollback` | boolean | false | Include scrollback history in the response |
| `scrollback_lines` | number | all | Number of most-recent scrollback lines to return (only used when `include_scrollback: true`) |

Returns:
- `screen` — visible rows as plain text (rows joined by `\n`)
- `cursor_row`, `cursor_col` — cursor position (0-indexed)
- `cols`, `rows` — terminal dimensions
- `alt_screen` — true when vim/htop/less alternate screen is active
- `generation` — increments on every PTY output event; pass to `pty_wait`'s `since_generation` to avoid stale matches
- `last_modified` — ISO timestamp of last PTY output
- `scrollback` — historical lines from ring buffer (when `include_scrollback: true`)

### `pty_wait`
Wait for output to match a regex pattern **or** settle (go quiet), then return the screen.

This is the key tool for interactive workflows:
1. Write a command with `pty_write`
2. Call `pty_wait` with a pattern (e.g. `\\$\\s*$` for a bash prompt)
3. Call `pty_read` to inspect the result

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `pattern` | string | — | Regex to match against screen text. If omitted, waits for output to settle |
| `timeout_ms` | number | 10000 | Max wait time in ms |
| `settle_ms` | number | 300 | ms of silence = "settled" |
| `since_generation` | number | — | Only resolve on output newer than this generation. Pass the `generation` from a prior `pty_read` or `pty_write` to avoid matching stale screen content |
| `include_screen` | boolean | true | Include rendered screen in response. Set to `false` to save tokens in polling loops where you'll call `pty_read` separately |

### `pty_resize`
Resize the terminal (sends SIGWINCH on Linux/macOS, ConPTY resize on Windows).

### `pty_kill`
Terminate and destroy a session (SIGTERM by default, or SIGKILL).

### `pty_list`
List all active sessions with metadata.

### `pty_list_keys`
List all symbolic key names supported by `pty_sendkey`.

## Example Workflow

```
# Create a bash session
pty_create() → { session_id: "abc-123", ... }

# Wait for initial prompt
pty_wait(session_id: "abc-123", pattern: "\\$\\s*$", timeout_ms: 5000)

# Run a command
pty_write(session_id: "abc-123", input: "python3\r")

# Wait for Python REPL prompt
pty_wait(session_id: "abc-123", pattern: ">>> ", timeout_ms: 5000)

# Interact with Python
pty_write(session_id: "abc-123", input: "print('hello world')\r")
pty_wait(session_id: "abc-123", pattern: ">>> ", timeout_ms: 5000)

# Read the result
pty_read(session_id: "abc-123")
→ { screen: ">>> print('hello world')\nhello world\n>>> ", ... }

# Exit Python
pty_sendkey(session_id: "abc-123", key: "ctrl+d")

# Clean up
pty_kill(session_id: "abc-123")
```

## Configuration (Environment Variables)

| Variable | Default | Description |
|----------|---------|-------------|
| `PTYAI_DEFAULT_SHELL` | `$SHELL` / `cmd.exe` | Default shell |
| `PTYAI_DEFAULT_COLS` | `220` | Default terminal width |
| `PTYAI_DEFAULT_ROWS` | `50` | Default terminal height |
| `PTYAI_DEFAULT_SCROLLBACK` | `1000` | Default scrollback lines |
| `PTYAI_MAX_SESSIONS` | `50` | Max concurrent sessions |
| `PTYAI_IDLE_TIMEOUT_MS` | `1800000` | Session idle timeout (30m) |
| `PTYAI_WAIT_TIMEOUT_MS` | `10000` | Default pty_wait timeout |
| `PTYAI_WAIT_SETTLE_MS` | `300` | Default settle silence window |

## Platform Notes

### Windows
Requires Windows 10 version 1809 or later (ConPTY support).
`node-pty` must be rebuilt for your Node.js version — run `npm rebuild` after installation.

### macOS
Works out of the box. Default shell is `$SHELL` (usually `/bin/zsh`).

### Linux
Works out of the box. Default shell is `$SHELL` (usually `/bin/bash` or `/bin/zsh`).

## Development

```bash
npm run build     # compile TypeScript
npm run dev       # watch mode
npm test          # run tests (vitest)
npm run test:watch # watch mode tests
```
