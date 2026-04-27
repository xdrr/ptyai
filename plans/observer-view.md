# Observer View ("Pianola")

Give users a live visual of what Claude Code is doing in PTY sessions — terminal output rendering in real time alongside the conversation.

## Mechanism

ptyai runs a lightweight HTTP + WebSocket server (`PTYAI_OBSERVE_PORT`, opt-in). Every byte written to a PTY session is forwarded to connected WebSocket clients. A served HTML page renders the stream with xterm.js in read-only mode.

The Claude Code Desktop **preview pane** (an embedded browser) opens `http://localhost:<port>` and can be dragged next to the chat pane — no plugin API needed.

## What the view shows

- **Terminal pane**: live xterm.js rendering of all active PTY sessions (tabbed or tiled by `session_id`)
- **Event log**: structured trace of MCP tool calls as they happen (`pty_create`, `pty_write "npm test\r"`, `pty_wait "✓"`, …) — the "AI narration" layer

## Integration points

- `PtySession.handleData` already fires on every PTY byte — fan-out to WebSocket clients is a one-liner there
- `src/observer.ts` — new module, starts lazily when `PTYAI_OBSERVE_PORT` is set, zero impact on the MCP stdio path
- Each tool handler emits a structured event (tool name + args) to the observer alongside the normal MCP response

## Claude Code plugin surface (current limits)

The plugin system (skills, agents, hooks, MCP servers, monitors) has no UI extension API — custom panes cannot be injected into the Claude Code app. The preview pane is the only viable in-app display surface today.

A **Monitor** entry could additionally stream event log lines as Claude notifications, feeding the LLM rather than the human viewer — complementary, not a substitute.
