import { eq } from "drizzle-orm";
import { getCurrentUser } from "@/server/auth/session";
import { getDb } from "@/server/db";
import { verifications } from "@/server/db/schema";
import { recordAudit } from "@/server/audit";
import { getStorage } from "@/providers";

/**
 * Verification evidence, for admins only. Every view is audited. Keys are
 * looked up from the verification record, never taken from the URL.
 */
export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/admin/verification-docs/[id]/[index]">,
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "admin") return new Response("Not found", { status: 404 });
  const { id, index } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Not found", { status: 404 });
  const [v] = await getDb()
    .select({ keys: verifications.documentKeys, userId: verifications.userId })
    .from(verifications)
    .where(eq(verifications.id, id))
    .limit(1);
  const key = v?.keys[Number(index)];
  if (!key)
    return new Response("Not found (documents are deleted after the retention period)", {
      status: 404,
    });
  const object = await getStorage().get(key);
  if (!object) return new Response("Not found", { status: 404 });
  await recordAudit({
    actor: { type: "admin", id: user.id },
    action: "verification.document_viewed",
    target: { type: "verification", id },
    meta: { userId: v.userId, index: Number(index) },
  });
  return new Response(Buffer.from(object.body), {
    headers: {
      "content-type": object.contentType,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-disposition": "inline",
    },
  });
}
