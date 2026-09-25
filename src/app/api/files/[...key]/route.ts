import { getStorage } from "@/providers";

/** Serves objects from the local StorageProvider (S3/MinIO serve their own URLs). */
export async function GET(_req: Request, ctx: RouteContext<"/api/files/[...key]">) {
  const { key } = await ctx.params;
  let object;
  try {
    object = await getStorage().get(key.join("/"));
  } catch {
    return new Response("Bad request", { status: 400 });
  }
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(Buffer.from(object.body), {
    headers: {
      "content-type": object.contentType,
      "cache-control": "public, max-age=86400",
      "x-content-type-options": "nosniff",
    },
  });
}
