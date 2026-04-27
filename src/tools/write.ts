import { z } from "zod";
import { manager } from "../session-manager.js";

export const writeSchema = {
  session_id: z.string().describe("Session ID returned by pty_create."),
  input: z.string().describe(
    "Text or escape sequences to write to the PTY stdin. " +
    "Use \\r for Enter, \\x03 for Ctrl+C, \\x1B for Escape. " +
    "For named keys use pty_sendkey instead."
  ),
  wait_for: z.string().optional().describe(
    "If provided, wait for this regex pattern to appear on screen before returning. " +
    "Combines pty_write + pty_wait in a single round-trip. " +
    "Uses since_generation internally so stale screen content never causes a false match."
  ),
  settle_ms: z.number().int().min(50).max(10000).optional().describe(
    "When waiting, milliseconds of silence that counts as settled. Default: 300ms."
  ),
  timeout_ms: z.number().int().min(100).max(300000).optional().describe(
    "When waiting, maximum time to wait in milliseconds. Default: 10000ms."
  ),
  include_screen: z.boolean().optional().describe(
    "Whether to include the rendered screen in the response when waiting. Default: true. " +
    "Set to false to save tokens when you only need matched/timed_out/generation."
  ),
};

function unescapeInput(input: string): string {
  return input.replace(/\\(r|n|t|\\|x[0-9a-fA-F]{2}|u[0-9a-fA-F]{4})/g, (_, seq: string) => {
    switch (seq[0]) {
      case "r": return "\r";
      case "n": return "\n";
      case "t": return "\t";
      case "\\": return "\\";
      case "x": return String.fromCharCode(parseInt(seq.slice(1), 16));
      case "u": return String.fromCharCode(parseInt(seq.slice(1), 16));
      default: return seq;
    }
  });
}

export async function handleWrite(args: {
  session_id: string;
  input: string;
  wait_for?: string;
  settle_ms?: number;
  timeout_ms?: number;
  include_screen?: boolean;
}) {
  const session = manager.get(args.session_id);
  // Capture generation before writing so the implicit wait only resolves on new output
  const genBeforeWrite = session.currentGeneration;
  const bytesWritten = session.write(unescapeInput(args.input));

  if (args.wait_for !== undefined || args.settle_ms !== undefined || args.timeout_ms !== undefined) {
    const result = await session.wait({
      pattern: args.wait_for,
      timeoutMs: args.timeout_ms,
      settleMs: args.settle_ms,
      sinceGeneration: genBeforeWrite,
    });
    const includeScreen = args.include_screen !== false;
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({
          bytes_written: bytesWritten,
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

  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({ bytes_written: bytesWritten }),
    }],
  };
}
