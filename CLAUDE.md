# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build       # compile TypeScript → dist/
npm run dev         # watch mode compile
npm test            # run all tests (vitest)
npm run test:watch  # vitest watch mode
```

Run a single test file:
```bash
npx vitest run tests/session.test.ts
```

## Architecture

**Entry point:** `src/index.ts` starts the MCP stdio server via `src/server.ts`, which registers all 9 tools using the `@modelcontextprotocol/sdk`.

**Core layer:**
- `src/pty-session.ts` — `PtySession` class: owns a `node-pty` process, a `TerminalEmulator`, and a `RingBuffer` for scrollback. The `wait()` method uses a `Set<WaitHandle>` of promise resolvers that are triggered from the `handleData` callback after xterm finishes async processing.
- `src/terminal-emulator.ts` — wraps `@xterm/headless` Terminal. xterm is a CJS module loaded via `createRequire` (ESM interop). `write()` returns a `Promise<void>` because xterm's write is async — **always await it before reading screen state or notifying waiters**.
- `src/session-manager.ts` — singleton `manager` instance; holds all sessions in a `Map`, enforces `PTYAI_MAX_SESSIONS`, and runs a 60s idle-sweep interval.
- `src/ring-buffer.ts` — fixed-capacity circular buffer for scrollback lines.
- `src/key-map.ts` — maps symbolic key names (`ctrl+c`, `up`, `f1`, etc.) to escape sequences for `pty_sendkey`.

**Tools layer** (`src/tools/*.ts`): each file exports a Zod schema and a handler function. Handlers call `manager.get(session_id)` then delegate to `PtySession` methods.

**Async write gotcha:** `emulator.write(data)` is async. In `PtySession.handleData`, scrollback pushes and waiter notifications happen inside `.then()` — after xterm has fully processed the data. This ordering is critical for correct `pty_wait` behavior.

## Key design points

- `TerminalEmulator` passes `scrollback: 0` to xterm — scrollback is managed entirely by `RingBuffer` to avoid double memory use.
- Alt-screen detection (`_altScreen`) is updated in `write()` by comparing `buffer.active === buffer.alternate` after xterm processes data.
- All environment-variable defaults (`PTYAI_DEFAULT_COLS`, `PTYAI_IDLE_TIMEOUT_MS`, etc.) are read at construction time in `PtySession` and `SessionManager`, not at module load.
- Tests use `vitest` with a 30s timeout (real PTY processes); no mocking of node-pty or xterm.
