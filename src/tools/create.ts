import { z } from "zod";
import { manager } from "../session-manager.js";

export const createSchema = {
  shell: z.string().optional().describe("Shell executable path. Defaults to $SHELL on Unix, cmd.exe on Windows."),
  args: z.array(z.string()).optional().describe("Additional arguments to pass to the shell."),
  cwd: z.string().optional().describe("Working directory for the session. Defaults to $HOME."),
  env: z.record(z.string(), z.string()).optional().describe("Environment variables to merge into the session environment."),
  cols: z.number().int().min(10).max(500).optional().describe("Terminal width in columns. Default: 220."),
  rows: z.number().int().min(5).max(200).optional().describe("Terminal height in rows. Default: 50."),
  scrollback: z.number().int().min(0).max(100000).optional().describe("Scrollback buffer size in lines. Default: 1000."),
};

export function handleCreate(args: {
  shell?: string;
  args?: string[];
  cwd?: string;
  env?: Record<string, string>;
  cols?: number;
  rows?: number;
  scrollback?: number;
}) {
  const session = manager.create({
    shell: args.shell,
    args: args.args,
    cwd: args.cwd,
    env: args.env,
    cols: args.cols,
    rows: args.rows,
    scrollback: args.scrollback,
  });
  const info = session.info;
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        session_id: info.sessionId,
        shell: info.shell,
        cwd: info.cwd,
        cols: info.cols,
        rows: info.rows,
        pid: info.pid,
      }),
    }],
  };
}
