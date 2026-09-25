import { getSearch } from "@/providers";

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("q")?.slice(0, 80) ?? "";
  try {
    const suggestions = await getSearch().suggest(q, 8);
    return Response.json({ suggestions }, { headers: { "cache-control": "private, max-age=30" } });
  } catch {
    return Response.json({ suggestions: [] });
  }
}
