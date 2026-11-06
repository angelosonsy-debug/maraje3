import { Client as ReplitObjectStorageClient } from "@replit/object-storage";
import type { StorageDriver } from "./types";

export type ReplitStorageConfig = {
  bucketId?: string;
  publicServerUrl: string;
  basePath: string;
};

export function readReplitConfigFromEnv(): ReplitStorageConfig | null {
  const publicServerUrl = process.env["PUBLIC_SERVER_URL"]?.trim();
  if (!publicServerUrl) return null;
  const basePath = (process.env["BASE_PATH"] ?? "/api").trim() || "/api";
  const bucketId = process.env["REPLIT_BUCKET_ID"]?.trim() || undefined;
  return { bucketId, publicServerUrl, basePath };
}

/**
 * `@replit/object-storage` (v1.0.0) has no presigned-URL capability — its
 * Client only exposes direct in-process upload/download methods. So this
 * driver relays both the upload (via the app's PUT going through our own
 * server) and the download (via `GET {basePath}/uploads/file/:key` on our
 * server, which streams the bytes back from the bucket).
 */
export class ReplitStorageDriver implements StorageDriver {
  readonly mode = "relay" as const;
  private readonly client: ReplitObjectStorageClient;
  private readonly publicServerUrl: string;
  private readonly basePath: string;

  constructor(config: ReplitStorageConfig) {
    this.client = new ReplitObjectStorageClient(
      config.bucketId ? { bucketId: config.bucketId } : undefined,
    );
    this.publicServerUrl = config.publicServerUrl.replace(/\/+$/, "");
    this.basePath = `/${config.basePath.replace(/^\/+|\/+$/g, "")}`;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async createPresignedPutUrl(): Promise<string> {
    throw new Error(
      "ReplitStorageDriver has no presigned uploads; use putObject via the relay route.",
    );
  }

  async putObject(key: string, bytes: Buffer): Promise<void> {
    const result = await this.client.uploadFromBytes(key, bytes, {
      compress: false,
    });
    if (!result.ok) {
      throw new Error(
        `Replit Object Storage upload failed for "${key}": ${result.error.message}`,
      );
    }
  }

  async getObject(key: string): Promise<Buffer> {
    const result = await this.client.downloadAsBytes(key, {
      decompress: false,
    });
    if (!result.ok) {
      throw new Error(
        `Replit Object Storage download failed for "${key}": ${result.error.message}`,
      );
    }
    return result.value[0];
  }

  async deleteObject(key: string): Promise<void> {
    const result = await this.client.delete(key, { ignoreNotFound: true });
    if (!result.ok) {
      throw new Error(
        `Replit Object Storage delete failed for "${key}": ${result.error.message}`,
      );
    }
  }

  getDownloadUrl(key: string): string {
    // `key` is always one of our own generated `uploads/<uuid>/<uuid>.<ext>`
    // strings (see routes/uploads.ts) — safe to place directly in the path,
    // and must NOT be percent-encoded as a whole or its slashes would stop
    // matching the `/uploads/file/*key` wildcard route as separate segments.
    return `${this.publicServerUrl}${this.basePath}/uploads/file/${key}`;
  }
}
