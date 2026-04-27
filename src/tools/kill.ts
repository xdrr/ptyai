import { z } from "zod";
import { manager } from "../session-manager.js";

export const killSchema = {
  session_id: z.string().describe("Session ID returned by pty_create."),
  signal: z.enum(["SIGTERM", "SIGKILL", "SIGHUP"]).optional().describe(
    "Signal to send. Default: SIGTERM. Use SIGKILL only if SIGTERM doesn't work."
  ),
};

export function handleKill(args: { session_id: string; signal?: string }) {
  const session = manager.get(args.session_id);
  session.kill(args.signal ?? "SIGTERM");
  manager.remove(args.session_id);
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({ killed: true, session_id: args.session_id }),
    }],
  };
}
