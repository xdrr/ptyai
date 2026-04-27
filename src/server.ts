import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { handleCreate, createSchema } from "./tools/create.js";
import { handleWrite, writeSchema } from "./tools/write.js";
import { handleSendkey, sendkeySchema, handleListKeys, listkeySchema } from "./tools/sendkey.js";
import { handleRead, readSchema } from "./tools/read.js";
import { handleWait, waitSchema } from "./tools/wait.js";
import { handleResize, resizeSchema } from "./tools/resize.js";
import { handleKill, killSchema } from "./tools/kill.js";
import { handleList, listSchema } from "./tools/list.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "ptyai",
    version: "0.1.0",
  });

  server.tool(
    "pty_create",
    "Create a new persistent PTY (pseudo-terminal) session. Returns a session_id used by all other pty_* tools. " +
    "The PTY supports full VT100/ANSI/xterm emulation, interactive applications (vim, htop, python REPL, telnet, ssh, etc.), " +
    "UTF-8, and 256-color. Sessions persist until explicitly killed or until idle for 30 minutes.",
    createSchema,
    handleCreate
  );

  server.tool(
    "pty_write",
    "Write raw text or escape sequences to the PTY stdin. " +
    "Use \\r for Enter, \\x03 for Ctrl+C, \\x1B for Escape. " +
    "For named special keys (arrow keys, function keys, etc.) use pty_sendkey instead. " +
    "Optionally combine with a wait in one call by supplying wait_for (regex), settle_ms, or timeout_ms — " +
    "this is the preferred way to send a command and wait for the result without a separate pty_wait call.",
    writeSchema,
    handleWrite
  );

  server.tool(
    "pty_sendkey",
    "Send one or more named special keys to the PTY. More ergonomic than embedding raw escape sequences in pty_write. " +
    "Use key for a single key or keys (array) to send multiple in sequence without separate calls. " +
    "Examples: 'ctrl+c' to interrupt, 'up'/'down' for history/navigation, 'escape' to exit modes in vim, " +
    "'tab' for completion, 'f1'-'f12' for function keys. Use pty_list_keys to see all supported key names.",
    sendkeySchema,
    handleSendkey
  );

  server.tool(
    "pty_list_keys",
    "List all symbolic key names supported by pty_sendkey.",
    listkeySchema,
    handleListKeys
  );

  server.tool(
    "pty_read",
    "Read the current rendered terminal screen. Returns the visible viewport as plain text (rows joined by newline), " +
    "cursor position, terminal dimensions, whether an alternate screen (vim/htop/less) is active, " +
    "a generation counter (increments on every PTY output event), a last_modified timestamp, " +
    "and optionally the scrollback history. " +
    "Pass generation to pty_wait's since_generation to avoid matching stale screen content.",
    readSchema,
    handleRead
  );

  server.tool(
    "pty_wait",
    "Wait for the PTY output to match a regex pattern or to settle (no new output for settle_ms milliseconds), " +
    "then return the current screen. Returns exited=true if the process exited while waiting. " +
    "Use since_generation (from a prior pty_read or pty_write) to ensure the match comes from new output, " +
    "not stale content already on screen. " +
    "Set pattern to a shell prompt regex like '\\\\$\\\\s*$' or '>>> ' for Python. " +
    "If no pattern is given, waits for output to go quiet.",
    waitSchema,
    handleWait
  );

  server.tool(
    "pty_resize",
    "Resize the terminal window. Sends SIGWINCH to the process on Linux/macOS, or uses ConPTY resize on Windows. " +
    "Useful before running TUI applications that need specific dimensions.",
    resizeSchema,
    handleResize
  );

  server.tool(
    "pty_kill",
    "Terminate and destroy a PTY session. Sends SIGTERM by default (SIGKILL if the process doesn't respond). " +
    "Always kill sessions when done to free resources.",
    killSchema,
    handleKill
  );

  server.tool(
    "pty_list",
    "List all active PTY sessions with metadata: session_id, shell, cwd, dimensions, PID, creation time, last activity.",
    listSchema,
    handleList
  );

  return server;
}
