import { R2StorageDriver, readR2ConfigFromEnv } from "./r2-driver";
import {
  ReplitStorageDriver,
  readReplitConfigFromEnv,
} from "./replit-driver";
import { StorageNotConfiguredError, type StorageDriver } from "./types";

export { StorageNotConfiguredError } from "./types";
export type { StorageDriver, StorageMode } from "./types";

let cachedDriver: StorageDriver | null | undefined;

/**
 * Returns the configured storage driver (STORAGE_DRIVER=r2|replit), or
 * throws StorageNotConfiguredError if unset or missing required env vars.
 * Memoized — the underlying SDK clients are cheap to reuse across requests.
 */
export function getStorageDriver(): StorageDriver {
  if (cachedDriver === undefined) {
    cachedDriver = buildStorageDriver();
  }
  if (!cachedDriver) {
    throw new StorageNotConfiguredError(
      "File uploads are not configured on this server (STORAGE_DRIVER).",
    );
  }
  return cachedDriver;
}

/** Only for tests / explicit re-init after env changes. */
export function resetStorageDriverCache(): void {
  cachedDriver = undefined;
}

function buildStorageDriver(): StorageDriver | null {
  const selected = process.env["STORAGE_DRIVER"]?.trim().toLowerCase();

  if (selected === "r2") {
    const config = readR2ConfigFromEnv();
    return config ? new R2StorageDriver(config) : null;
  }

  if (selected === "replit") {
    const config = readReplitConfigFromEnv();
    return config ? new ReplitStorageDriver(config) : null;
  }

  return null;
}
