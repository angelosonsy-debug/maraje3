import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { StorageDriver } from "./types";

const PRESIGN_TTL_SECONDS = 5 * 60;

export type R2Config = {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicBaseUrl: string;
};

export function readR2ConfigFromEnv(): R2Config | null {
  const accountId = process.env["R2_ACCOUNT_ID"]?.trim();
  const accessKeyId = process.env["R2_ACCESS_KEY_ID"]?.trim();
  const secretAccessKey = process.env["R2_SECRET_ACCESS_KEY"]?.trim();
  const bucketName = process.env["R2_BUCKET_NAME"]?.trim();
  const publicBaseUrl = process.env["R2_PUBLIC_BASE_URL"]?.trim();

  if (
    !accountId ||
    !accessKeyId ||
    !secretAccessKey ||
    !bucketName ||
    !publicBaseUrl
  ) {
    return null;
  }

  return { accountId, accessKeyId, secretAccessKey, bucketName, publicBaseUrl };
}

export class R2StorageDriver implements StorageDriver {
  readonly mode = "presigned" as const;
  private readonly client: S3Client;
  private readonly bucketName: string;
  private readonly publicBaseUrl: string;

  constructor(config: R2Config) {
    this.bucketName = config.bucketName;
    this.publicBaseUrl = config.publicBaseUrl.replace(/\/+$/, "");
    this.client = new S3Client({
      region: "auto",
      endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
    });
  }

  async createPresignedPutUrl(params: {
    key: string;
    contentType: string;
  }): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: params.key,
      ContentType: params.contentType,
    });
    return getSignedUrl(this.client, command, {
      expiresIn: PRESIGN_TTL_SECONDS,
    });
  }

  async putObject(
    key: string,
    bytes: Buffer,
    contentType: string,
  ): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: bytes,
        ContentType: contentType,
      }),
    );
  }

  async getObject(key: string): Promise<Buffer> {
    const result = await this.client.send(
      new GetObjectCommand({ Bucket: this.bucketName, Key: key }),
    );
    const bytes = await result.Body?.transformToByteArray();
    if (!bytes) {
      throw new Error(`R2 object "${key}" has no body.`);
    }
    return Buffer.from(bytes);
  }

  async deleteObject(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucketName, Key: key }),
    );
  }

  getDownloadUrl(key: string): string {
    return `${this.publicBaseUrl}/${key}`;
  }
}
