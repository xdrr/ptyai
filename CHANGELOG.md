# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.1] - 2026-04-27
- First release. Published to NPMjs.

### Fixed
- MacOS: posix-helper failures caused by missing exec flag on the helper binary. An upstream issue with the @microsoft package.

## [0.1.0] - 2026-04-24

### Added
- Initial release
- `pty_create` — create persistent PTY sessions with configurable shell, dimensions, and scrollback
- `pty_write` — send raw text or escape sequences to a session
- `pty_sendkey` — send named special keys (ctrl+c, arrows, function keys, etc.)
- `pty_read` — read the current rendered terminal screen with cursor position
- `pty_wait` — wait for output to match a regex pattern or settle
- `pty_resize` — resize the terminal (SIGWINCH / ConPTY)
- `pty_kill` — terminate and destroy a session
- `pty_list` — list all active sessions
- `pty_list_keys` — list all supported key names for `pty_sendkey`
- Full VT100/VT220/xterm-256color emulation via `@xterm/headless`
- Alternate screen support (vim, htop, less, etc.)
- Ring buffer scrollback
- Idle session sweep with configurable timeout
- Environment variable configuration (`PTYAI_*`)
- `ptyai install` CLI for auto-configuring Claude Code
- Cross-platform support: Linux, macOS, Windows (ConPTY)

[unreleased]: https://github.com/xdrr/ptyai/compare/v0.1.1...HEAD
[0.1.1]: https://github.com/xdrr/ptyai/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/xdrr/ptyai/releases/tag/v0.1.0
