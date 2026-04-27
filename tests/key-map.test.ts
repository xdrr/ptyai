import { describe, it, expect } from "vitest";
import { resolveKey, knownKeys } from "../src/key-map.js";

describe("key-map", () => {
  it("resolves ctrl+c to 0x03", () => {
    expect(resolveKey("ctrl+c")).toBe("\x03");
  });

  it("resolves enter to carriage return", () => {
    expect(resolveKey("enter")).toBe("\r");
  });

  it("resolves arrow keys to ANSI sequences", () => {
    expect(resolveKey("up")).toBe("\x1B[A");
    expect(resolveKey("down")).toBe("\x1B[B");
    expect(resolveKey("right")).toBe("\x1B[C");
    expect(resolveKey("left")).toBe("\x1B[D");
  });

  it("is case-insensitive", () => {
    expect(resolveKey("CTRL+C")).toBe("\x03");
    expect(resolveKey("Up")).toBe("\x1B[A");
    expect(resolveKey("ENTER")).toBe("\r");
  });

  it("returns undefined for unknown keys", () => {
    expect(resolveKey("unknownkey")).toBeUndefined();
    expect(resolveKey("")).toBeUndefined();
  });

  it("resolves all function keys f1-f12", () => {
    for (let i = 1; i <= 12; i++) {
      expect(resolveKey(`f${i}`)).toBeTruthy();
    }
  });

  it("resolves escape", () => {
    expect(resolveKey("escape")).toBe("\x1B");
    expect(resolveKey("esc")).toBe("\x1B");
  });

  it("resolves tab and shift+tab", () => {
    expect(resolveKey("tab")).toBe("\t");
    expect(resolveKey("shift+tab")).toBe("\x1B[Z");
  });

  it("resolves ctrl+z to SIGTSTP sequence", () => {
    expect(resolveKey("ctrl+z")).toBe("\x1A");
  });

  it("resolves ctrl+d to EOF", () => {
    expect(resolveKey("ctrl+d")).toBe("\x04");
  });

  it("knownKeys returns a non-empty array", () => {
    const keys = knownKeys();
    expect(keys.length).toBeGreaterThan(20);
    expect(keys).toContain("ctrl+c");
    expect(keys).toContain("enter");
    expect(keys).toContain("up");
  });
});
