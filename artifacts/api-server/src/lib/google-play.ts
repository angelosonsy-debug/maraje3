import { JWT } from "google-auth-library";

export class GooglePlayNotConfiguredError extends Error {}
export class GooglePlayVerificationError extends Error {}

const ANDROID_PUBLISHER_SCOPE =
  "https://www.googleapis.com/auth/androidpublisher";

function readServiceAccountJson(): Record<string, unknown> {
  const raw = process.env["GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"]?.trim();
  if (!raw) {
    throw new GooglePlayNotConfiguredError(
      "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not set.",
    );
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new GooglePlayNotConfiguredError(
      "GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not valid JSON.",
    );
  }
}

function readPackageName(): string {
  const packageName = process.env["ANDROID_PACKAGE_NAME"]?.trim();
  if (!packageName) {
    throw new GooglePlayNotConfiguredError("ANDROID_PACKAGE_NAME is not set.");
  }
  return packageName;
}

let cachedClient: JWT | null = null;

function getClient(): JWT {
  if (cachedClient) return cachedClient;
  const credentials = readServiceAccountJson();
  cachedClient = new JWT({
    email: credentials["client_email"] as string | undefined,
    key: credentials["private_key"] as string | undefined,
    scopes: [ANDROID_PUBLISHER_SCOPE],
  });
  return cachedClient;
}

type ProductPurchase = {
  purchaseState?: number; // 0 = purchased, 1 = canceled, 2 = pending
  acknowledgementState?: number; // 0 = not acknowledged, 1 = acknowledged
  purchaseTimeMillis?: string;
};

/**
 * Verifies a one-time (non-consumable) Google Play purchase via the Android
 * Publisher API and, if it's valid and unacknowledged, acknowledges it (Play
 * Billing auto-refunds a non-consumable purchase left unacknowledged for 3
 * days). Throws GooglePlayNotConfiguredError if GOOGLE_PLAY_SERVICE_ACCOUNT_JSON
 * / ANDROID_PACKAGE_NAME aren't set, GooglePlayVerificationError if the
 * purchase isn't valid/paid for this product.
 *
 * NOT exercised against a live Google Play account in this environment — no
 * real service account credentials or product were available to test
 * against. Code-complete, typechecked, but unverified end-to-end.
 */
export async function verifyAndAcknowledgePurchase(params: {
  productId: string;
  purchaseToken: string;
}): Promise<void> {
  const packageName = readPackageName();
  const client = getClient();

  const getUrl = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
    packageName,
  )}/purchases/products/${encodeURIComponent(params.productId)}/tokens/${encodeURIComponent(
    params.purchaseToken,
  )}`;

  const getResponse = await client.request<ProductPurchase>({ url: getUrl });
  const purchase = getResponse.data;

  if (purchase.purchaseState !== 0) {
    throw new GooglePlayVerificationError(
      "Purchase is not in a completed/paid state.",
    );
  }

  if (purchase.acknowledgementState === 0) {
    const ackUrl = `${getUrl}:acknowledge`;
    await client.request({ url: ackUrl, method: "POST", data: {} });
  }
}
