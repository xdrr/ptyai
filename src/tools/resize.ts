import { z } from "zod";
import { manager } from "../session-manager.js";

export const resizeSchema = {
  session_id: z.string().describe("Session ID returned by pty_create."),
  cols: z.number().int().min(10).max(500).describe("New terminal width in columns."),
  rows: z.number().int().min(5).max(200).describe("New terminal height in rows."),
};

export function handleResize(args: { session_id: string; cols: number; rows: number }) {
  const session = manager.get(args.session_id);
  session.resize(args.cols, args.rows);
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({ cols: args.cols, rows: args.rows }),
    }],
  };
}
