import { PROPERTY_TYPES } from "@/lib/domain";
import { renderDemoImage, SCENES, type Scene } from "@/lib/demo-media";

/** Serves deterministic SVG illustrations for fictional demo listings. */
export async function GET(_req: Request, ctx: RouteContext<"/demo-media/[type]/[seed]/[scene]">) {
  const { type, seed, scene: file } = await ctx.params;
  const scene = file.replace(/\.svg$/, "") as Scene;
  if (
    !(PROPERTY_TYPES as readonly string[]).includes(type) ||
    !SCENES.includes(scene) ||
    !/^[\w-]{1,40}$/.test(seed)
  ) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(renderDemoImage(type, seed, scene), {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "cache-control": "public, max-age=31536000, immutable",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'",
    },
  });
}
