import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";

const STORAGE_KEY = "maraje3.anonymous-device-id.v1";

let cached: string | null = null;

/**
 * A random id persisted on-device, used only to let the server rate-limit
 * and de-duplicate reports submitted by someone who isn't signed in. Not
 * tied to any account — generated locally, never derived from hardware
 * identifiers.
 */
export async function getAnonymousDeviceId(): Promise<string> {
  if (cached) return cached;
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (stored) {
      cached = stored;
      return stored;
    }
  } catch {
    // fall through to generating a fresh one for this session
  }
  const generated = Crypto.randomUUID();
  cached = generated;
  try {
    await AsyncStorage.setItem(STORAGE_KEY, generated);
  } catch {
    // best-effort persistence only
  }
  return generated;
}
