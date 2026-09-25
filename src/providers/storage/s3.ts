import { Client } from "minio";
import { safeKey, type StorageProvider, type StoredObject } from "./types";

export interface S3Options {
  endPoint: string;
  port: number;
  useSSL: boolean;
  accessKey: string;
  secretKey: string;
  bucket: string;
  publicUrl: string;
}

/** Any S3-compatible object store. MinIO (free, self-hosted) ships in docker-compose. */
export class S3StorageProvider implements StorageProvider {
  readonly name = "s3";
  private readonly client: Client;
  private bucketReady: Promise<void> | null = null;

  constructor(private readonly opts: S3Options) {
    this.client = new Client({
      endPoint: opts.endPoint,
      port: opts.port,
      useSSL: opts.useSSL,
      accessKey: opts.accessKey,
      secretKey: opts.secretKey,
    });
  }

  private ensureBucket() {
    this.bucketReady ??= (async () => {
      if (!(await this.client.bucketExists(this.opts.bucket))) {
        await this.client.makeBucket(this.opts.bucket);
      }
    })();
    return this.bucketReady;
  }

  publicUrl(key: string) {
    return `${this.opts.publicUrl.replace(/\/$/, "")}/${safeKey(key)}`;
  }

  async put(key: string, body: Uint8Array, contentType: string): Promise<StoredObject> {
    await this.ensureBucket();
    const k = safeKey(key);
    await this.client.putObject(this.opts.bucket, k, Buffer.from(body), body.byteLength, {
      "Content-Type": contentType,
    });
    return { key: k, url: this.publicUrl(k), size: body.byteLength, contentType };
  }

  async get(key: string) {
    try {
      const k = safeKey(key);
      const stat = await this.client.statObject(this.opts.bucket, k);
      const stream = await this.client.getObject(this.opts.bucket, k);
      const chunks: Buffer[] = [];
      for await (const chunk of stream) chunks.push(chunk as Buffer);
      return {
        body: new Uint8Array(Buffer.concat(chunks)),
        contentType: (stat.metaData?.["content-type"] as string) ?? "application/octet-stream",
      };
    } catch {
      return null;
    }
  }

  async delete(key: string) {
    await this.client.removeObject(this.opts.bucket, safeKey(key));
  }
}
