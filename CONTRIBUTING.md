# Contributing

Contributions are welcome. Here's how to get started.

## Setup

```bash
git clone https://github.com/YOUR_USERNAME/ptyai
cd ptyai
npm install
npm run build
npm test
```

All 28+ tests use real PTY processes — no mocking of node-pty or xterm. They have a 30s timeout to accommodate slow CI environments.

## Development workflow

```bash
npm run dev       # watch mode TypeScript compile
npm test          # run full test suite
npm run test:watch # vitest watch mode (great for TDD)
```

Run a single test file:
```bash
npx vitest run tests/session.test.ts
```

## Project structure

```
src/
  index.ts            # entry point — starts MCP stdio server
  server.ts           # registers all 9 tools
  pty-session.ts      # PtySession: node-pty + xterm + RingBuffer
  terminal-emulator.ts # headless xterm wrapper (async write!)
  session-manager.ts  # singleton, idle sweep, session map
  ring-buffer.ts      # fixed-capacity circular scrollback buffer
  key-map.ts          # symbolic key names → escape sequences
  tools/              # one file per MCP tool (Zod schema + handler)
tests/
  *.test.ts           # vitest integration tests
```

## Important: async write

`TerminalEmulator.write()` is async. Always `await` it before reading screen state or resolving waiters. This is the most common source of subtle bugs in this codebase — see `src/pty-session.ts` for the correct pattern.

## Submitting a PR

1. Fork the repo and create a branch from `main`
2. Make your changes and add or update tests as appropriate
3. Run `npm run build && npm test` — all tests must pass
4. Update `CHANGELOG.md` under `[Unreleased]`
5. Open a PR with a clear description of what changed and why

## Reporting bugs

Use the bug report issue template. Include your OS, Node version, and a minimal reproduction if possible.
