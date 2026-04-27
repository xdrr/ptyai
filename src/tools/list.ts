import { manager } from "../session-manager.js";

export const listSchema = {};

export function handleList(_args: Record<string, never>) {
  const sessions = manager.list();
  return {
    content: [{
      type: "text" as const,
      text: JSON.stringify({ sessions }),
    }],
  };
}
