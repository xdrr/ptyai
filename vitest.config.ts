import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    globals: false,
    environment: "node",
    testTimeout: 30000,
  },
  resolve: {
    extensionsToTry: [".ts", ".js"],
  },
});
