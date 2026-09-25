/** Small deterministic PRNG (mulberry32) so seed data is reproducible. */
export function createRng(seed: number | string) {
  let s = typeof seed === "number" ? seed >>> 0 : hashString(seed);
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    float: (min: number, max: number) => next() * (max - min) + min,
    bool: (p = 0.5) => next() < p,
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    /** Pick with weights: [[value, weight], ...] */
    weighted: <T>(pairs: readonly (readonly [T, number])[]): T => {
      const total = pairs.reduce((s, [, w]) => s + w, 0);
      let r = next() * total;
      for (const [v, w] of pairs) {
        if ((r -= w) <= 0) return v;
      }
      return pairs[pairs.length - 1][0];
    },
    sample: <T>(arr: readonly T[], n: number): T[] => {
      const copy = [...arr];
      const out: T[] = [];
      while (out.length < n && copy.length)
        out.push(copy.splice(Math.floor(next() * copy.length), 1)[0]);
      return out;
    },
    /** Approximately normal via Box–Muller. */
    normal: (mean: number, sd: number) => {
      const u = 1 - next();
      const v = next();
      return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    },
  };
  return rng;
}

export type Rng = ReturnType<typeof createRng>;

export function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return h >>> 0;
}
