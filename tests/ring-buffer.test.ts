import { describe, it, expect } from "vitest";
import { RingBuffer } from "../src/ring-buffer.js";

describe("RingBuffer", () => {
  it("starts empty", () => {
    const buf = new RingBuffer<number>(5);
    expect(buf.size).toBe(0);
    expect(buf.toArray()).toEqual([]);
  });

  it("returns items oldest-first", () => {
    const buf = new RingBuffer<number>(5);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    expect(buf.toArray()).toEqual([1, 2, 3]);
  });

  it("evicts oldest when full", () => {
    const buf = new RingBuffer<number>(3);
    buf.push(1);
    buf.push(2);
    buf.push(3);
    buf.push(4); // evicts 1
    expect(buf.toArray()).toEqual([2, 3, 4]);
    buf.push(5); // evicts 2
    expect(buf.toArray()).toEqual([3, 4, 5]);
  });

  it("handles capacity=1", () => {
    const buf = new RingBuffer<string>(1);
    buf.push("a");
    buf.push("b");
    expect(buf.toArray()).toEqual(["b"]);
    expect(buf.size).toBe(1);
  });

  it("tail returns last N items", () => {
    const buf = new RingBuffer<number>(10);
    for (let i = 1; i <= 7; i++) buf.push(i);
    expect(buf.tail(3)).toEqual([5, 6, 7]);
    expect(buf.tail(10)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(buf.tail(0)).toEqual([]);
  });

  it("clear resets state", () => {
    const buf = new RingBuffer<number>(5);
    buf.push(1);
    buf.push(2);
    buf.clear();
    expect(buf.size).toBe(0);
    expect(buf.toArray()).toEqual([]);
    buf.push(3);
    expect(buf.toArray()).toEqual([3]);
  });

  it("survives many wraps", () => {
    const buf = new RingBuffer<number>(3);
    for (let i = 0; i < 100; i++) buf.push(i);
    const arr = buf.toArray();
    expect(arr).toHaveLength(3);
    expect(arr).toEqual([97, 98, 99]);
  });
});
