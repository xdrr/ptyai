#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createServer } from "./server.js";
import { manager } from "./session-manager.js";

const cliArgs = process.argv.slice(2);

if (cliArgs.length > 0 || process.stdin.isTTY) {
  // CLI mode: explicit command, or running interactively in a terminal
  const { runCLI, printHelp } = await import("./cli.js");
  if (cliArgs.length > 0) {
    await runCLI(cliArgs);
  } else {
    printHelp();
  }
} else {
  // MCP server mode: stdin is a pipe (invoked by Claude Code or another MCP host)
  const server = createServer();
  const transport = new StdioServerTransport();

  process.on("SIGINT",  () => { manager.shutdown(); process.exit(0); });
  process.on("SIGTERM", () => { manager.shutdown(); process.exit(0); });

  await server.connect(transport);
}
