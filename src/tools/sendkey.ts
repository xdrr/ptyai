import { z } from "zod";
import { manager } from "../session-manager.js";
import { knownKeys } from "../key-map.js";

export const sendkeySchema = {
  session_id: z.string().describe("Session ID returned by pty_create."),
  key: z.string().optional().describe(
    "Symbolic key name. Examples: 'ctrl+c', 'ctrl+d', 'ctrl+z', 'enter', 'escape', 'tab', " +
    "'shift+tab', 'up', 'down', 'left', 'right', 'backspace', 'delete', 'home', 'end', " +
    "'pageup', 'pagedown', 'f1'-'f12', 'ctrl+left', 'ctrl+right', 'alt+up', 'alt+down'. " +
    "Use pty_list_keys to see all supported names. Provide either key or keys, not both."
  ),
  keys: z.array(z.string()).optional().describe(
    "Send multiple keys in sequence in a single call. Each element is a symbolic key name " +
    "as accepted by the key parameter. Use this instead of multiple pty_sendkey calls."
  ),
};

export function handleSendkey(args: { session_id: string; key?: string; keys?: string[] }) {
  const session = manager.get(args.session_id);
  if (args.keys !== undefined) {
    for (const k of args.keys) {
      session.sendKey(k);
    }
    return {
      content: [{
        type: "text" as const,
        text: JSON.stringify({ keys_sent: args.keys }),
      }],
    };
  }
  if (args.key === undefined) {
    throw new Error("Either key or keys must be provided.");
  }
  session.sendKey(args.key);
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({ key_sent: args.key }),
    }],
  };
}

export const listkeySchema = {};

export function handleListKeys(_args: Record<string, never>) {
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({ keys: knownKeys().sort() }),
    }],
  };
}
