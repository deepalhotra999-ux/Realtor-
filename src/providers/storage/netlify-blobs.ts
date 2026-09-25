import { getStore } from "@netlify/blobs";
import { safeKey, type StorageProvider, type StoredObject } from "./types";

/**
 * Netlify Blobs (free, built into every Netlify site). Used on Netlify, whose
 * functions have no writable disk. Objects are served through the same
 * /api/files/[...key] route as local storage, so `private/` keys stay private.
 */
export class NetlifyBlobsStorageProvider implements StorageProvider {
  readonly name = "netlify-blobs";

  // "strong" so a photo is readable immediately after upload.
  private store = () => getStore({ name: "uploads", consistency: "strong" });

  publicUrl(key: string) {
    return `/api/files/${safeKey(key)}`;
  }

  async put(key: string, body: Uint8Array, contentType: string): Promise<StoredObject> {
    const k = safeKey(key);
    const bytes = body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer;
    await this.store().set(k, bytes, { metadata: { contentType } });
    return { key: k, url: this.publicUrl(k), size: body.byteLength, contentType };
  }

  async get(key: string) {
    const res = await this.store().getWithMetadata(safeKey(key), { type: "arrayBuffer" });
    if (!res) return null;
    const contentType = typeof res.metadata.contentType === "string" ? res.metadata.contentType : "application/octet-stream";
    return { body: new Uint8Array(res.data), contentType };
  }

  async delete(key: string) {
    await this.store().delete(safeKey(key));
  }
}
