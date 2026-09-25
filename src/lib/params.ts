/** Helpers for reading Next.js searchParams objects. */
export type SP = Record<string, string | string[] | undefined>;

export function str(sp: SP, key: string, fallback = ""): string {
  const v = sp[key];
  return typeof v === "string" ? v : fallback;
}

export function page(sp: SP): number {
  const n = Number(str(sp, "page", "1"));
  return Number.isInteger(n) && n > 0 ? n : 1;
}

export function withParams(
  base: string,
  sp: SP,
  patch: Record<string, string | number | undefined>,
) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v) p.set(k, v);
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined || v === "") p.delete(k);
    else p.set(k, String(v));
  }
  const q = p.toString();
  return q ? `${base}?${q}` : base;
}
