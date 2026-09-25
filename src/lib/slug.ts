import { hashString } from "@/lib/random";

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

/** Human-readable slug with a short stable suffix to guarantee uniqueness. */
export function listingSlug(
  parts: { street: string; unit?: string | null; city: string; state: string },
  key: string,
) {
  const base = slugify(
    [parts.street, parts.unit, parts.city, parts.state].filter(Boolean).join(" "),
  );
  return `${base}-${hashString(key).toString(36).slice(0, 6)}`;
}
