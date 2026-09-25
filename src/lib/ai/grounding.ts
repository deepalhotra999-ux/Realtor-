/**
 * Cheap guard for model rewrites: every number in the output must already
 * appear in the grounding text (facts + deterministic draft). Rewrites that
 * introduce a new figure are rejected and the deterministic draft is used.
 */
function numbersIn(s: string): Set<string> {
  const out = new Set<string>();
  for (const m of s.replace(/(\d),(\d{3})/g, "$1$2").matchAll(/\d+(?:\.\d+)?/g)) {
    out.add(String(Number(m[0])));
  }
  return out;
}

export function numbersGrounded(output: string, grounding: string): boolean {
  const allowed = numbersIn(grounding);
  for (const n of numbersIn(output)) if (!allowed.has(n)) return false;
  return true;
}
