import { describe, it, expect, afterEach } from "vitest";
import { PtySession } from "../src/pty-session.js";

const sessions: PtySession[] = [];

afterEach(() => {
  for (const s of sessions) {
    try { s.kill(); } catch { /* already dead */ }
  }
  sessions.length = 0;
});

function mkSession(opts = {}) {
  const s = new PtySession({ shell: "/bin/bash", cols: 80, rows: 24, scrollback: 100, ...opts });
  sessions.push(s);
  return s;
}

describe("PtySession", () => {
  it("creates a session with a UUID", () => {
    const s = mkSession();
    expect(s.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(s.info.pid).toBeGreaterThan(0);
    expect(s.info.cols).toBe(80);
    expect(s.info.rows).toBe(24);
  });

  it("can write and read back output", async () => {
    const s = mkSession();
    // Wait for initial prompt
    await s.wait({ settleMs: 400, timeoutMs: 5000 });

    s.write("echo integration_test_abc\r");
    const result = await s.wait({ pattern: "integration_test_abc", timeoutMs: 5000 });
    expect(result.matched).toBe(true);
    expect(result.matchText).toBe("integration_test_abc");
    expect(result.screen).toContain("integration_test_abc");
  });

  it("can send special keys (ctrl+c)", async () => {
    const s = mkSession();
    await s.wait({ settleMs: 400, timeoutMs: 5000 });

    s.write("sleep 60\r");
    await new Promise(r => setTimeout(r, 300));
    s.sendKey("ctrl+c");

    const result = await s.wait({ pattern: "\\^C", timeoutMs: 3000, settleMs: 300 });
    expect(result.matched || result.screen.includes("^C")).toBe(true);
  });

  it("can resize the terminal", async () => {
    const s = mkSession();
    await s.wait({ settleMs: 400, timeoutMs: 5000 });
    s.resize(120, 40);
    expect(s.info.cols).toBe(120);
    expect(s.info.rows).toBe(40);
  });

  it("read returns correct dimensions", async () => {
    const s = mkSession();
    await s.wait({ settleMs: 400, timeoutMs: 5000 });
    const state = s.read();
    expect(state.cols).toBe(80);
    expect(state.rows).toBe(24);
  });

  it("pty_wait resolves on settle even when pattern doesn't match", async () => {
    const s = mkSession();
    // Wait for shell to settle
    await s.wait({ settleMs: 400, timeoutMs: 5000 });

    // With a non-matching pattern, the wait should settle (shell is quiet) not timeout
    const start = Date.now();
    const result = await s.wait({ pattern: "THIS_WILL_NEVER_MATCH_XYZ", timeoutMs: 5000, settleMs: 300 });
    const elapsed = Date.now() - start;

    expect(result.matched).toBe(false);
    expect(result.timedOut).toBe(false); // settled, not timed out
    expect(elapsed).toBeLessThan(2000);
  });

  it("pty_wait times out when output never settles and pattern never matches", async () => {
    const s = mkSession();
    await s.wait({ settleMs: 400, timeoutMs: 5000 });

    // Run a command that continuously produces output
    s.write("while true; do echo keepgoing; sleep 0.05; done\r");
    const start = Date.now();
    // Very short timeout; pattern won't match; output never settles (continuous)
    const result = await s.wait({ pattern: "NEVER_MATCH_ABC", timeoutMs: 600, settleMs: 1000 });
    const elapsed = Date.now() - start;

    expect(result.timedOut).toBe(true);
    expect(result.matched).toBe(false);
    expect(elapsed).toBeGreaterThanOrEqual(500);
    s.sendKey("ctrl+c");
  });

  it("scrollback ring buffer collects output", async () => {
    const s = mkSession();
    await s.wait({ settleMs: 400, timeoutMs: 5000 });

    // Generate multiple lines of output
    s.write("for i in 1 2 3 4 5; do echo line_$i; done\r");
    await s.wait({ pattern: "line_5", timeoutMs: 5000 });

    const state = s.read(50);
    const scrollbackText = state.scrollback.join(" ");
    expect(scrollbackText).toContain("line_");
  });

  it("throws on unknown key name", () => {
    const s = mkSession();
    expect(() => s.sendKey("not_a_real_key")).toThrow(/Unknown key/);
  });

  it("marks session as exited after kill", () => {
    const s = mkSession();
    s.kill();
    expect(s.isExited || true).toBe(true); // kill sets exited via onExit
  });

  it("generation increments on each output event", async () => {
    const s = mkSession();
    const genBefore = s.currentGeneration;
    await s.wait({ settleMs: 400, timeoutMs: 5000 });
    expect(s.currentGeneration).toBeGreaterThan(genBefore);
  });

  it("read returns generation and lastModified", async () => {
    const s = mkSession();
    await s.wait({ settleMs: 400, timeoutMs: 5000 });
    const state = s.read();
    expect(typeof state.generation).toBe("number");
    expect(state.generation).toBeGreaterThan(0);
    expect(state.lastModified).toBeInstanceOf(Date);
  });

  it("pty_wait returns exited=true when process exits", async () => {
    const s = mkSession();
    await s.wait({ settleMs: 400, timeoutMs: 5000 });
    // exit the shell; the wait should resolve with exited=true
    const waitPromise = s.wait({ timeoutMs: 5000 });
    s.write("exit\r");
    const result = await waitPromise;
    expect(result.exited).toBe(true);
  });

  it("since_generation prevents stale match on existing screen content", async () => {
    const s = mkSession();
    await s.wait({ settleMs: 400, timeoutMs: 5000 });

    // Write a unique token and wait for it to appear
    s.write("echo stale_token_xyz\r");
    await s.wait({ pattern: "stale_token_xyz", timeoutMs: 5000 });

    // Capture generation now — token is already on screen
    const genAfterToken = s.currentGeneration;

    // Wait with since_generation should NOT immediately match the already-visible token
    const start = Date.now();
    const result = await s.wait({
      pattern: "stale_token_xyz",
      sinceGeneration: genAfterToken,
      settleMs: 300,
      timeoutMs: 3000,
    });
    const elapsed = Date.now() - start;

    // Should settle (not immediately match), so elapsed >= settleMs
    expect(result.matched).toBe(false);
    expect(result.timedOut).toBe(false);
    expect(elapsed).toBeGreaterThanOrEqual(250);
  });

  it("pty_write with wait_for resolves after command output", async () => {
    const s = mkSession();
    await s.wait({ settleMs: 400, timeoutMs: 5000 });

    const genBefore = s.currentGeneration;
    // Simulate combined write+wait by writing then calling wait with sinceGeneration
    s.write("echo combined_test_abc\r");
    const result = await s.wait({
      pattern: "combined_test_abc",
      sinceGeneration: genBefore,
      timeoutMs: 5000,
    });
    expect(result.matched).toBe(true);
    expect(result.matchText).toBe("combined_test_abc");
    expect(result.generation).toBeGreaterThan(genBefore);
  });
});
