import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { homedir } from "os";
import { basename, dirname, join, resolve } from "path";
import { createInterface } from "readline";
import { spawnSync } from "child_process";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── color helpers ─────────────────────────────────────────────────────────────

const tty = process.stdout.isTTY && !process.env.NO_COLOR && process.env.TERM !== "dumb";
const esc = (code: string, s: string) => (tty ? `\x1b[${code}m${s}\x1b[0m` : s);

const bold   = (s: string) => esc("1", s);
const dim    = (s: string) => esc("2", s);
const yellow = (s: string) => esc("33", s);
const green  = (s: string) => esc("32", s);
const cyan   = (s: string) => esc("36", s);
const red    = (s: string) => esc("31", s);

// ── types ─────────────────────────────────────────────────────────────────────

interface McpServerConfig {
  type: "stdio";
  command: string;
  args: string[];
}

interface McpJson {
  mcpServers?: Record<string, McpServerConfig>;
  [key: string]: unknown;
}

interface ClaudeSettings {
  mcpServers?: Record<string, McpServerConfig>;
  permissions?: {
    allow?: string[];
    deny?: string[];
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

// ── constants ─────────────────────────────────────────────────────────────────

const MCP_TOOLS = [
  "mcp__ptyai__pty_create",
  "mcp__ptyai__pty_write",
  "mcp__ptyai__pty_sendkey",
  "mcp__ptyai__pty_wait",
  "mcp__ptyai__pty_read",
  "mcp__ptyai__pty_resize",
  "mcp__ptyai__pty_kill",
  "mcp__ptyai__pty_list",
  "mcp__ptyai__pty_list_keys",
];

const MARKER_START = "<!-- ptyai-start -->";
const MARKER_END   = "<!-- ptyai-end -->";

const CLAUDE_MD_SECTION = `\
${MARKER_START}
## Shell / Terminal

Use \`ptyai\` MCP tools instead of \`Bash\` for all shell operations. ptyai provides
persistent PTY sessions with full VT100/xterm emulation.

**Basic workflow:**
1. \`pty_create\` — open a session, get \`session_id\`
2. \`pty_write(session_id, "cmd\\r")\` — send input (\`\\r\` = Enter)
3. \`pty_wait(session_id, pattern)\` — wait for a regex to appear on screen
4. \`pty_read(session_id)\` — inspect the rendered screen
5. \`pty_kill(session_id)\` — clean up when done

\`pty_write\` with \`wait_for\` combines write + wait in one round-trip; also accepts \`timeout_ms\`, \`settle_ms\`,
and \`include_screen: false\` to skip the screen payload and save tokens.
Named keys (\`ctrl+c\`, \`tab\`, arrow keys, \`f1\`–\`f12\`, etc.) go through \`pty_sendkey\`.
${MARKER_END}`;

// ── entry point ───────────────────────────────────────────────────────────────

export async function runCLI(args: string[]): Promise<void> {
  const cmd = args[0];
  switch (cmd) {
    case "install":
      await cmdInstall(args.slice(1));
      break;
    case "--version":
    case "-v":
      printVersion();
      break;
    case "--help":
    case "-h":
    case "help":
      printHelp();
      break;
    default:
      console.error(`Unknown command: ${cmd}\n`);
      printHelp();
      process.exit(1);
  }
}

export function printHelp(): void {
  console.log(`
${bold("ptyai")} — persistent PTY sessions for Claude Code

${bold("Usage:")}
  ptyai              Start the MCP server (for mcpServers config)
  ptyai install      Configure Claude Code to use ptyai globally
  ptyai install --project   Register ptyai in .mcp.json for the current project

${bold("Install flags:")}
  --project          Write .mcp.json in the current directory instead of global install
  --dry-run          Show what would change without writing anything
  --uninstall        Remove ptyai from the relevant config
  --local            Use local dist/ path instead of npx ptyai
  --force            Overwrite even if ptyai is already configured
`);
}

function printVersion(): void {
  try {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf-8")) as { version: string };
    console.log(pkg.version);
  } catch {
    console.log("unknown");
  }
}

// ── install command ───────────────────────────────────────────────────────────

async function cmdInstall(flags: string[]): Promise<void> {
  const dryRun    = flags.includes("--dry-run");
  const uninstall = flags.includes("--uninstall");
  const local     = flags.includes("--local");
  const force     = flags.includes("--force");
  const project   = flags.includes("--project");

  const settingsPath = join(homedir(), ".claude", "settings.json");
  const claudeMdPath = join(homedir(), ".claude", "CLAUDE.md");
  const mcpJsonPath  = join(process.cwd(), ".mcp.json");
  const [cmd, cmdArgs] = resolveServerCommand(local);

  if (uninstall) {
    await doUninstall(settingsPath, claudeMdPath, mcpJsonPath, dryRun, project);
    return;
  }

  if (!force && !dryRun) {
    if (project) {
      const existing = readJson<McpJson>(mcpJsonPath);
      if (existing?.mcpServers?.ptyai) {
        console.log(yellow(`ptyai is already configured in ${mcpJsonPath}`));
        console.log(`Use ${bold("--force")} to overwrite.`);
        process.exit(0);
      }
    } else {
      const result = spawnSync("claude", ["mcp", "list", "--scope", "user"], { encoding: "utf-8" });
      if (result.stdout?.includes("ptyai")) {
        console.log(yellow("ptyai is already registered as a user-scoped MCP server."));
        console.log(`Use ${bold("--force")} to overwrite.`);
        process.exit(0);
      }
    }
  }

  // Warning banner
  const serverLine = `${cmd}${cmdArgs.length ? " " + cmdArgs.join(" ") : ""}`;
  if (project) {
    console.log(`
${bold(yellow("⚠  Warning"))}

This will update your configuration:

  ${cyan(mcpJsonPath)}
    ${dim("•")} Register ptyai as an MCP server ${dim(`(${serverLine})`)}
    ${dim("•")} ${dim("Available in this project only")}

  ${cyan(settingsPath)}
    ${dim("•")} Grant permissions for all 9 ptyai tools
    ${dim("•")} ${bold("Disable the built-in Bash tool")}

  ${cyan(claudeMdPath)}
    ${dim("•")} Append ptyai shell usage instructions

${dim("Backups saved to *.ptyai-backup before any changes.")}
`);
  } else {
    console.log(`
${bold(yellow("⚠  Warning"))}

This will update your Claude Code user configuration:

  ${dim("Global MCP server")} ${dim(`(${serverLine})`)}
    ${dim("•")} Register ptyai as an MCP server via ${cyan("claude mcp add --scope user")}
    ${dim("•")} ${dim("Available in all projects")}

  ${cyan(settingsPath)}
    ${dim("•")} Grant permissions for all 9 ptyai tools
    ${dim("•")} ${bold("Disable the built-in Bash tool")}

  ${cyan(claudeMdPath)}
    ${dim("•")} Append ptyai shell usage instructions

${dim("Backups saved to *.ptyai-backup before any changes.")}
`);
  }

  if (dryRun) {
    showDryRun(settingsPath, claudeMdPath, mcpJsonPath, cmd, cmdArgs, project);
    return;
  }

  const answer = await prompt(bold("Proceed? [N/y] "));
  if (answer.trim().toLowerCase() !== "y") {
    console.log("\nAborted.");
    process.exit(0);
  }

  if (project) {
    applyProjectInstall(mcpJsonPath, settingsPath, claudeMdPath, cmd, cmdArgs);
  } else {
    applyGlobalInstall(settingsPath, claudeMdPath, cmd, cmdArgs);
  }

  console.log(`\n${bold(green("✓ Installed."))} Restart Claude Code to activate.`);
}

// ── apply install ─────────────────────────────────────────────────────────────

function applyGlobalInstall(settingsPath: string, claudeMdPath: string, cmd: string, cmdArgs: string[]): void {
  // Register with claude mcp add --scope user — this is the only correct global mechanism.
  // claude writes to ~/.claude.json in a format it manages internally.
  const result = spawnSync(
    "claude",
    ["mcp", "add", "--scope", "user", "ptyai", "--", cmd, ...cmdArgs],
    { stdio: "inherit" },
  );
  if (result.status !== 0 || result.error) {
    console.error(red("\n✗ `claude mcp add` failed.") + " Is `claude` in your PATH?");
    console.error(dim(`Manual: claude mcp add --scope user ptyai -- ${serverLine(cmd, cmdArgs)}`));
    process.exit(1);
  }

  applySettingsAndMd(settingsPath, claudeMdPath);
}

function applyProjectInstall(
  mcpJsonPath: string,
  settingsPath: string,
  claudeMdPath: string,
  cmd: string,
  cmdArgs: string[],
): void {
  if (existsSync(mcpJsonPath)) copyFileSync(mcpJsonPath, `${mcpJsonPath}.ptyai-backup`);
  const mcp = readJson<McpJson>(mcpJsonPath) ?? {};
  mcp.mcpServers = mcp.mcpServers ?? {};
  mcp.mcpServers.ptyai = { type: "stdio", command: cmd, args: cmdArgs };
  writeFileSync(mcpJsonPath, JSON.stringify(mcp, null, 2) + "\n", "utf-8");

  applySettingsAndMd(settingsPath, claudeMdPath);
}

function applySettingsAndMd(settingsPath: string, claudeMdPath: string): void {
  mkdirSync(dirname(settingsPath), { recursive: true });
  if (existsSync(settingsPath)) copyFileSync(settingsPath, `${settingsPath}.ptyai-backup`);

  const settings = readJson<ClaudeSettings>(settingsPath) ?? {};
  // Clean up any stale mcpServers.ptyai a previous (incorrect) install may have written
  if (settings.mcpServers?.ptyai) {
    delete settings.mcpServers.ptyai;
    if (Object.keys(settings.mcpServers).length === 0) delete settings.mcpServers;
  }
  settings.permissions = settings.permissions ?? {};
  settings.permissions.allow = unique([...(settings.permissions.allow ?? []), ...MCP_TOOLS]);
  settings.permissions.deny  = unique([...(settings.permissions.deny  ?? []), "Bash"]);
  writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");

  mkdirSync(dirname(claudeMdPath), { recursive: true });
  if (existsSync(claudeMdPath)) copyFileSync(claudeMdPath, `${claudeMdPath}.ptyai-backup`);
  const md = existsSync(claudeMdPath) ? readFileSync(claudeMdPath, "utf-8") : "";
  writeFileSync(claudeMdPath, upsertSection(md, CLAUDE_MD_SECTION) + "\n", "utf-8");
}

// ── uninstall ─────────────────────────────────────────────────────────────────

async function doUninstall(
  settingsPath: string,
  claudeMdPath: string,
  mcpJsonPath: string,
  dryRun: boolean,
  project: boolean,
): Promise<void> {
  console.log(`\n${bold("Uninstalling ptyai…")}\n`);

  if (dryRun) {
    if (project) {
      console.log(dim(`[dry-run] Would modify: ${mcpJsonPath}`));
    } else {
      console.log(dim("[dry-run] Would run: claude mcp remove --scope user ptyai"));
    }
    console.log(dim(`[dry-run] Would modify: ${settingsPath}`));
    console.log(dim(`[dry-run] Would modify: ${claudeMdPath}`));
    return;
  }

  if (project) {
    if (existsSync(mcpJsonPath)) {
      copyFileSync(mcpJsonPath, `${mcpJsonPath}.ptyai-backup`);
      const mcp = readJson<McpJson>(mcpJsonPath) ?? {};
      delete mcp.mcpServers?.ptyai;
      writeFileSync(mcpJsonPath, JSON.stringify(mcp, null, 2) + "\n", "utf-8");
    }
  } else {
    const result = spawnSync("claude", ["mcp", "remove", "--scope", "user", "ptyai"], { stdio: "inherit" });
    if (result.status !== 0 || result.error) {
      console.error(red("✗ `claude mcp remove` failed.") + " Continuing with settings cleanup.");
    }
  }

  const settings = readJson<ClaudeSettings>(settingsPath);
  if (settings) {
    copyFileSync(settingsPath, `${settingsPath}.ptyai-backup`);
    if (settings.permissions) {
      settings.permissions.allow = (settings.permissions.allow ?? []).filter(t => !MCP_TOOLS.includes(t));
      settings.permissions.deny  = (settings.permissions.deny  ?? []).filter(t => t !== "Bash");
    }
    if (settings.mcpServers?.ptyai) {
      delete settings.mcpServers.ptyai;
      if (Object.keys(settings.mcpServers).length === 0) delete settings.mcpServers;
    }
    writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + "\n", "utf-8");
  }

  if (existsSync(claudeMdPath)) {
    copyFileSync(claudeMdPath, `${claudeMdPath}.ptyai-backup`);
    const md = readFileSync(claudeMdPath, "utf-8");
    writeFileSync(claudeMdPath, removeSection(md).trimEnd() + "\n", "utf-8");
  }

  console.log(`${bold(green("✓ Uninstalled."))} Restart Claude Code to apply changes.`);
}

// ── dry-run preview ───────────────────────────────────────────────────────────

function showDryRun(
  settingsPath: string,
  claudeMdPath: string,
  mcpJsonPath: string,
  cmd: string,
  cmdArgs: string[],
  project: boolean,
): void {
  console.log(dim("[dry-run] No files will be written.\n"));

  if (project) {
    const mcp = readJson<McpJson>(mcpJsonPath) ?? {};
    mcp.mcpServers = { ...(mcp.mcpServers ?? {}), ptyai: { type: "stdio", command: cmd, args: cmdArgs } };
    console.log(cyan(mcpJsonPath));
    console.log(JSON.stringify(mcp, null, 2));
  } else {
    console.log(dim(`Would run: claude mcp add --scope user ptyai -- ${serverLine(cmd, cmdArgs)}`));
  }

  const settings = readJson<ClaudeSettings>(settingsPath) ?? {};
  if (settings.mcpServers?.ptyai) delete settings.mcpServers.ptyai;
  settings.permissions = settings.permissions ?? {};
  settings.permissions.allow = unique([...(settings.permissions.allow ?? []), ...MCP_TOOLS]);
  settings.permissions.deny  = unique([...(settings.permissions.deny  ?? []), "Bash"]);
  console.log(`\n${cyan(settingsPath)}`);
  console.log(JSON.stringify(settings, null, 2));
  console.log(`\n${cyan(claudeMdPath)}`);
  console.log(dim("(ptyai usage instructions would be appended)"));
}

// ── helpers ───────────────────────────────────────────────────────────────────

function resolveServerCommand(local: boolean): [string, string[]] {
  if (local) return ["node", [resolve(__dirname, "index.js")]];
  if (basename(process.argv[1] ?? "") === "ptyai") return ["ptyai", []];
  return ["npx", ["-y", "ptyai"]];
}

function serverLine(cmd: string, args: string[]): string {
  return [cmd, ...args].join(" ");
}

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T;
  } catch {
    return null;
  }
}

function unique(arr: string[]): string[] {
  return [...new Set(arr)];
}

function upsertSection(md: string, section: string): string {
  const base = removeSection(md).trimEnd();
  return base.length > 0 ? `${base}\n\n${section}` : section;
}

function removeSection(md: string): string {
  const s = escapeRe(MARKER_START);
  const e = escapeRe(MARKER_END);
  return md.replace(new RegExp(`\\n?${s}[\\s\\S]*?${e}\\n?`, "g"), "");
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function prompt(question: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => { rl.close(); resolve(answer); });
  });
}
