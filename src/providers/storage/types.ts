export interface StoredObject {
  key: string;
  url: string;
  size: number;
  contentType: string;
}

/**
 * Binary object storage for photos, floor plans and documents.
 * Implementations: local filesystem (default) and S3-compatible (MinIO,
 * Garage, SeaweedFS, AWS S3, R2 …).
 */
export interface StorageProvider {
  readonly name: string;
  put(key: string, body: Uint8Array, contentType: string): Promise<StoredObject>;
  get(key: string): Promise<{ body: Uint8Array; contentType: string } | null>;
  delete(key: string): Promise<void>;
  publicUrl(key: string): string;
}

/** Normalise and validate an object key — no traversal, no absolute paths. */
export function safeKey(key: string): string {
  const cleaned = key.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!cleaned || cleaned.split("/").some((p) => p === ".." || p === "." || p === "")) {
    throw new Error(`Invalid storage key: ${key}`);
  }
  if (!/^[\w\-./]+$/.test(cleaned)) throw new Error(`Invalid characters in storage key: ${key}`);
  return cleaned;
}

export const ALLOWED_UPLOAD_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "application/pdf": "pdf",
};
