import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { LocalStorageProvider } from "./local";
import { safeKey } from "./types";

describe("storage", () => {
  it("rejects traversal and odd keys", () => {
    expect(safeKey("/listings/a/b.jpg")).toBe("listings/a/b.jpg");
    expect(() => safeKey("../etc/passwd")).toThrow();
    expect(() => safeKey("a//b")).toThrow();
    expect(() => safeKey("a/b c.jpg")).toThrow();
  });

  it("round-trips files on local disk", async () => {
    const dir = mkdtempSync(path.join(tmpdir(), "dw-storage-"));
    const s = new LocalStorageProvider(dir);
    const obj = await s.put("listings/x/photo.png", new Uint8Array([1, 2, 3]), "image/png");
    expect(obj.url).toBe("/api/files/listings/x/photo.png");
    const got = await s.get("listings/x/photo.png");
    expect(got?.contentType).toBe("image/png");
    expect([...got!.body]).toEqual([1, 2, 3]);
    await s.delete("listings/x/photo.png");
    expect(await s.get("listings/x/photo.png")).toBeNull();
  });
});
