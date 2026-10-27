export class ConfigError extends Error {}

function readEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new ConfigError(`${name} environment variable is required but was not set.`);
  }
  return value;
}

export function readBotToken(): string {
  return readEnv("TELEGRAM_BOT_TOKEN");
}

export function readBotApiSecret(): string {
  return readEnv("BOT_API_SECRET");
}

/** The مراجعي API server's own base URL, e.g. https://maraje3.example.com (no trailing slash, no /api). */
export function readApiBaseUrl(): string {
  return readEnv("MARAJE3_API_BASE_URL").replace(/\/+$/, "");
}

export const DAILY_SUBMISSION_HINT =
  "بنفس حدود التطبيق — حد أقصى عدد معيّن من الملفات يومياً لكل مستخدم.";
