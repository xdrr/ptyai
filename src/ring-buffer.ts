/**
 * Fixed-capacity circular buffer. When full, pushing a new item evicts the oldest.
 */
export class RingBuffer<T> {
  private readonly buf: (T | undefined)[];
  private head = 0; // index of next write slot
  private count = 0;

  constructor(readonly capacity: number) {
    this.buf = new Array(capacity);
  }

  push(item: T): void {
    this.buf[this.head] = item;
    this.head = (this.head + 1) % this.capacity;
    if (this.count < this.capacity) this.count++;
  }

  /** Returns items oldest-first. */
  toArray(): T[] {
    if (this.count === 0) return [];
    const result: T[] = [];
    const start = this.count < this.capacity ? 0 : this.head;
    for (let i = 0; i < this.count; i++) {
      result.push(this.buf[(start + i) % this.capacity] as T);
    }
    return result;
  }

  /** Returns the last `n` items (or all if count < n), oldest-first. */
  tail(n: number): T[] {
    const all = this.toArray();
    return n >= all.length ? all : all.slice(all.length - n);
  }

  get size(): number {
    return this.count;
  }

  clear(): void {
    this.head = 0;
    this.count = 0;
  }
}
