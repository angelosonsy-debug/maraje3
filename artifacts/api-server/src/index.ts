import app from "./app";
import { logger } from "./lib/logger";

const adminTokenLength =
  process.env["MARAJE3_ADMIN_TOKEN"]?.trim().length ?? 0;
if (adminTokenLength < 24) {
  const warning =
    "MARAJE3_ADMIN_TOKEN is missing or shorter than 24 characters; production requires a longer token.";
  if (process.env["NODE_ENV"] === "production") {
    logger.fatal(warning);
    process.exit(1);
  }
  logger.warn(warning);
}

const sessionSecretLength = process.env["SESSION_SECRET"]?.trim().length ?? 0;
if (sessionSecretLength < 32) {
  const warning =
    "SESSION_SECRET is missing or shorter than 32 characters; contributor sign-in will be unavailable until it is set.";
  if (process.env["NODE_ENV"] === "production") {
    logger.fatal(warning);
    process.exit(1);
  }
  logger.warn(warning);
}

if (!process.env["GOOGLE_CLIENT_IDS"]?.trim()) {
  logger.warn(
    "GOOGLE_CLIENT_IDS is not configured; Google sign-in will return 503 until it is set.",
  );
}

const storageDriver = process.env["STORAGE_DRIVER"]?.trim().toLowerCase();
if (!storageDriver) {
  logger.warn(
    "STORAGE_DRIVER is not configured; student uploads will return 503 until it is set to r2 or replit.",
  );
} else if (storageDriver === "r2") {
  for (const key of [
    "R2_ACCOUNT_ID",
    "R2_ACCESS_KEY_ID",
    "R2_SECRET_ACCESS_KEY",
    "R2_BUCKET_NAME",
    "R2_PUBLIC_BASE_URL",
  ]) {
    if (!process.env[key]?.trim()) {
      logger.warn(
        `STORAGE_DRIVER=r2 but ${key} is not set; uploads will return 503 until it is set.`,
      );
    }
  }
} else if (storageDriver === "replit") {
  if (!process.env["PUBLIC_SERVER_URL"]?.trim()) {
    logger.warn(
      "STORAGE_DRIVER=replit but PUBLIC_SERVER_URL is not set; uploads will return 503 until it is set.",
    );
  }
} else {
  logger.warn(
    `STORAGE_DRIVER="${storageDriver}" is not recognized (expected r2 or replit); uploads will return 503.`,
  );
}

if (!process.env["BOT_API_SECRET"]?.trim()) {
  logger.warn(
    "BOT_API_SECRET is not configured; the Telegram bot bridge (internal submissions/account linking) will return 503 until it is set.",
  );
}

if (
  !process.env["GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"]?.trim() ||
  !process.env["ANDROID_PACKAGE_NAME"]?.trim()
) {
  logger.warn(
    "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON/ANDROID_PACKAGE_NAME are not both configured; Premium purchase verification (POST /premium/verify-purchase) will return 503 until both are set.",
  );
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
});
