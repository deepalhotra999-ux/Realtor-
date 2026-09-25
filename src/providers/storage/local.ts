import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { safeKey, type StorageProvider, type StoredObject } from "./types";

const EXT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  avif: "image/avif",
  svg: "image/svg+xml",
  pdf: "application/pdf",
};

/** Stores files on local disk and serves them through /api/files/[...key]. */
export class LocalStorageProvider implements StorageProvider {
  readonly name = "local";
  private readonly root: string;

  constructor(dir: string) {
    this.root = path.resolve(dir);
  }

  private resolve(key: string) {
    const full = path.resolve(this.root, safeKey(key));
    if (!full.startsWith(this.root + path.sep)) throw new Error("Path escapes storage root");
    return full;
  }

  publicUrl(key: string) {
    return `/api/files/${safeKey(key)}`;
  }

  async put(key: string, body: Uint8Array, contentType: string): Promise<StoredObject> {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body);
    return { key: safeKey(key), url: this.publicUrl(key), size: body.byteLength, contentType };
  }

  async get(key: string) {
    try {
      const full = this.resolve(key);
      const body = await readFile(full);
      const ext = path.extname(full).slice(1).toLowerCase();
      return { body: new Uint8Array(body), contentType: EXT_TYPES[ext] ?? "application/octet-stream" };
    } catch {
      return null;
    }
  }

  async delete(key: string) {
    await rm(this.resolve(key), { force: true });
  }
}
