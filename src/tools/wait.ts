import { z } from "zod";
import { manager } from "../session-manager.js";

export const waitSchema = {
  session_id: z.string().describe("Session ID returned by pty_create."),
  pattern: z.string().optional().describe(
    "JavaScript regex pattern to match against the current screen text. " +
    "If omitted, waits for the output to settle (no new data for settle_ms)."
  ),
  timeout_ms: z.number().int().min(100).max(300000).optional().describe(
    "Maximum time to wait in milliseconds. Default: 10000 (10 seconds)."
  ),
  settle_ms: z.number().int().min(50).max(10000).optional().describe(
    "Milliseconds of silence (no new output) that counts as 'settled'. Default: 300ms."
  ),
  since_generation: z.number().int().min(0).optional().describe(
    "Only resolve when output newer than this generation arrives. " +
    "Pass the generation from a previous pty_read or pty_write response to avoid " +
    "matching stale screen content from before your last command."
  ),
  include_screen: z.boolean().optional().describe(
    "Whether to include the rendered screen in the response. Default: true. " +
    "Set to false when you only need matched/timed_out/generation and want to save tokens, " +
    "e.g. in polling loops where you will call pty_read separately."
  ),
};

export async function handleWait(args: {
  session_id: string;
  pattern?: string;
  timeout_ms?: number;
  settle_ms?: number;
  since_generation?: number;
  include_screen?: boolean;
}) {
  const session = manager.get(args.session_id);
  const result = await session.wait({
    pattern: args.pattern,
    timeoutMs: args.timeout_ms,
    settleMs: args.settle_ms,
    sinceGeneration: args.since_generation,
  });

  const includeScreen = args.include_screen !== false;
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({
        matched: result.matched,
        match_text: result.matchText,
        timed_out: result.timedOut,
        exited: result.exited,
        generation: result.generation,
        ...(includeScreen ? { screen: result.screen } : {}),
      }),
    }],
  };
}
