import { z } from "zod";
import { manager } from "../session-manager.js";

export const readSchema = {
  session_id: z.string().describe("Session ID returned by pty_create."),
  include_scrollback: z.boolean().optional().describe(
    "Include scrollback history in the response. Default: false."
  ),
  scrollback_lines: z.number().int().min(1).optional().describe(
    "Number of scrollback lines to return (most recent N). " +
    "Only used when include_scrollback is true. Default: all buffered lines."
  ),
};

export function handleRead(args: {
  session_id: string;
  include_scrollback?: boolean;
  scrollback_lines?: number;
}) {
  const session = manager.get(args.session_id);
  const scrollbackLines = args.include_scrollback ? args.scrollback_lines : 0;
  const state = session.read(scrollbackLines);

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        screen: state.screen,
        cursor_col: state.cursorX,
        cursor_row: state.cursorY,
        cols: state.cols,
        rows: state.rows,
        alt_screen: state.altScreen,
        generation: state.generation,
        last_modified: state.lastModified.toISOString(),
        ...(args.include_scrollback ? { scrollback: state.scrollback } : {}),
      }),
    }],
  };
}
