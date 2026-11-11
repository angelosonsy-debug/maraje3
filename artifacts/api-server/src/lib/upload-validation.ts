import { createHash } from "node:crypto";

export const ALLOWED_UPLOAD_CONTENT_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type AllowedUploadContentType =
  (typeof ALLOWED_UPLOAD_CONTENT_TYPES)[number];

export function isAllowedUploadContentType(
  value: string,
): value is AllowedUploadContentType {
  return (ALLOWED_UPLOAD_CONTENT_TYPES as readonly string[]).includes(value);
}

export function readMaxUploadBytes(): number {
  const raw = process.env["MAX_UPLOAD_BYTES"]?.trim();
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 25 * 1024 * 1024;
}

export function readDailyUploadQuota(): number {
  const raw = process.env["UPLOAD_DAILY_QUOTA"]?.trim();
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10;
}

export function readSuspensionStrikeThreshold(): number {
  const raw = process.env["UPLOAD_SUSPENSION_STRIKE_THRESHOLD"]?.trim();
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
}

export function readSuspensionDays(): number {
  const raw = process.env["UPLOAD_SUSPENSION_DAYS"]?.trim();
  const parsed = raw ? Number(raw) : NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 7;
}

/**
 * Sniffs the real file type from its magic bytes — never trusts the
 * client-declared contentType/extension. Returns null if the bytes don't
 * match any allowed format.
 */
export function sniffAllowedFileType(
  bytes: Buffer,
): AllowedUploadContentType | null {
  if (bytes.length >= 5 && bytes.subarray(0, 5).toString("ascii") === "%PDF-") {
    return "application/pdf";
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return "image/jpeg";
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

export function hashFileContents(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export function fileExtensionFor(contentType: AllowedUploadContentType): string {
  switch (contentType) {
    case "application/pdf":
      return "pdf";
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
  }
}
