/**
 * Storage driver abstraction for student-uploaded files.
 *
 * Two real backends exist and they are NOT symmetric:
 *  - R2 (Cloudflare, S3-compatible): supports true presigned PUT URLs, so the
 *    app can upload bytes directly to the bucket, and objects can be served
 *    from a public base URL without touching our server again.
 *  - Replit Object Storage (`@replit/object-storage`): its SDK has no
 *    presigned-URL capability at all — only direct in-process
 *    upload/download methods. So for this driver the app PUTs bytes through
 *    our own API server ("relay" mode), and downloads are also served by
 *    our server streaming/redirecting the bytes ("relay" download).
 *
 * `mode` tells route handlers which flow applies; both modes are real and
 * supported end-to-end, not a stub.
 */
export type StorageMode = "presigned" | "relay";

export class StorageNotConfiguredError extends Error {}

export interface StorageDriver {
  readonly mode: StorageMode;

  /**
   * For the "presigned" mode: returns a PUT URL the app can upload directly
   * to. Never called for a "relay" driver (relay uploads go through
   * `putObject` instead, via the server's own upload-relay route).
   */
  createPresignedPutUrl(params: {
    key: string;
    contentType: string;
  }): Promise<string>;

  /** Used by the upload-relay route handler for "relay" mode drivers. */
  putObject(key: string, bytes: Buffer, contentType: string): Promise<void>;

  /**
   * Re-downloads the object so the server can verify its real magic bytes
   * and content hash before creating the material record — used for both
   * modes so validation is uniform regardless of how the bytes arrived.
   */
  getObject(key: string): Promise<Buffer>;

  deleteObject(key: string): Promise<void>;

  /**
   * The absolute URL stored as `materials.documentUrl` once a material is
   * created. For R2 this is a direct public bucket URL; for Replit it is a
   * URL on our own server that relays the bytes (see `routes/uploads.ts`).
   */
  getDownloadUrl(key: string): string;
}
