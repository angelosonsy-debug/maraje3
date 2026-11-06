import { setAuthTokenGetter } from "@workspace/api-client-react";

let currentAdminToken: string | null = null;

export function configureAdminSession(token: string | null): void {
  currentAdminToken = token?.trim() || null;
  setAuthTokenGetter(() => currentAdminToken);
}

export function clearAdminSession(): void {
  currentAdminToken = null;
  setAuthTokenGetter(null);
}
