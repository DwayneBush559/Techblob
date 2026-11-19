// An in-memory stand-in for the Redis commands TechBlob uses, for the local preview only (TECHBLOB_PREVIEW=1): no
// server, no network. Same return shapes as ioredis (multi().exec() gives [[err, result], ...]). Expiry is honored.

type Value = string | Map<string, string> | string[];

export class PreviewRedis {
  private data = new Map<string, Value>();
  private expiresAt = new Map<string, number>();

  on(): this {
    return this;
  }

  private live(key: string): Value | undefined {
    const exp = this.expiresAt.get(key);
    if (exp !== undefined && exp <= Date.now()) {
      this.data.delete(key);
      this.expiresAt.delete(key);
    }
    return this.data.get(key);
  }

  private hash(key: string): Map<string, string> {
    const v = this.live(key);
    if (v instanceof Map) return v;
    const m = new Map<string, string>();
    this.data.set(key, m);
    return m;
  }

  private list(key: string): string[] {
    const v = this.live(key);
    if (Array.isArray(v)) return v;
    const l: string[] = [];
    this.data.set(key, l);
    return l;
  }

  async get(key: string): Promise<string | null> {
    const v = this.live(key);
    return typeof v === "string" ? v : null;
  }

  async set(key: string, value: string, ...args: (string | number)[]): Promise<"OK" | null> {
    const nx = args.some((a) => String(a).toUpperCase() === "NX");
    if (nx && this.live(key) !== undefined) return null;
    this.data.set(key, value);
    this.expiresAt.delete(key);
    const ex = args.findIndex((a) => String(a).toUpperCase() === "EX");
    if (ex >= 0) this.expiresAt.set(key, Date.now() + Number(args[ex + 1]) * 1000);
    return "OK";
  }

  async del(...keys: string[]): Promise<number> {
    let n = 0;
    for (const k of keys) if (this.data.delete(k)) n += 1;
    return n;
  }

  async expire(key: string, seconds: number): Promise<number> {
    if (this.live(key) === undefined) return 0;
    this.expiresAt.set(key, Date.now() + seconds * 1000);
    return 1;
  }

  async incr(key: string): Promise<number> {
    const n = Number((await this.get(key)) ?? 0) + 1;
    this.data.set(key, String(n));
    return n;
  }

  async hincrby(key: string, field: string, by: number): Promise<number> {
    const h = this.hash(key);
    const n = Number(h.get(field) ?? 0) + by;
    h.set(field, String(n));
    return n;
  }

  async hget(key: string, field: string): Promise<string | null> {
    const v = this.live(key);
    return v instanceof Map ? v.get(field) ?? null : null;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const v = this.live(key);
    return v instanceof Map ? Object.fromEntries(v) : {};
  }

  async lpush(key: string, ...values: string[]): Promise<number> {
    const l = this.list(key);
    l.unshift(...values.reverse());
    return l.length;
  }

  async lpop(key: string, count?: number): Promise<string[] | string | null> {
    const v = this.live(key);
    if (!Array.isArray(v) || v.length === 0) return null;
    if (count === undefined) return v.shift() ?? null;
    return v.splice(0, count);
  }

  async rename(from: string, to: string): Promise<"OK"> {
    const v = this.live(from);
    if (v === undefined) throw new Error("ERR no such key");
    this.data.set(to, v);
    this.data.delete(from);
    return "OK";
  }

  multi() {
    const ops: (() => Promise<unknown>)[] = [];
    const chain = {
      hincrby: (k: string, f: string, by: number) => (ops.push(() => this.hincrby(k, f, by)), chain),
      incr: (k: string) => (ops.push(() => this.incr(k)), chain),
      expire: (k: string, s: number) => (ops.push(() => this.expire(k, s)), chain),
      lpush: (k: string, ...v: string[]) => (ops.push(() => this.lpush(k, ...v)), chain),
      set: (k: string, v: string, ...a: (string | number)[]) => (ops.push(() => this.set(k, v, ...a)), chain),
      del: (...k: string[]) => (ops.push(() => this.del(...k)), chain),
      exec: async (): Promise<[Error | null, unknown][]> => {
        const out: [Error | null, unknown][] = [];
        for (const op of ops) out.push([null, await op()]);
        return out;
      },
    };
    return chain;
  }
}
