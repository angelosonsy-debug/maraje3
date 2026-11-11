import AsyncStorage from "@react-native-async-storage/async-storage";
import { useIdTokenAuthRequest } from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  ApiError,
  deleteCurrentUser as apiDeleteCurrentUser,
  getCurrentUser as apiGetCurrentUser,
  signInWithGoogle as apiSignInWithGoogle,
  updateCurrentUser as apiUpdateCurrentUser,
  setAuthTokenGetter,
} from "@workspace/api-client-react";
import type { UserProfile } from "@/types/auth";

// Required so the in-app browser sheet used during the OAuth round trip
// closes itself and hands control back to the app.
WebBrowser.maybeCompleteAuthSession();

const STORAGE_KEYS = {
  token: "maraje3.session-token.v1",
  user: "maraje3.session-user.v1",
};

type AuthContextValue = {
  user: UserProfile | null;
  isAuthLoading: boolean;
  isSignInInProgress: boolean;
  isGoogleSignInReady: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  updateHideIdentity: (hideIdentity: boolean) => Promise<void>;
  // Re-fetches /auth/me and updates both state and storage — used after a
  // server-side change to the account the client didn't itself PATCH, e.g.
  // Premium purchase verification (routes/premium.ts).
  refreshUser: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  // Only for requests the generated API client can't make for us — e.g. the
  // raw-bytes upload relay route, which needs the bearer token as a manual
  // header on a FileSystem.uploadAsync call rather than a JSON fetch.
  getSessionToken: () => string | null;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function parseStoredUser(value: string | null): UserProfile | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    if (
      typeof record.id !== "string" ||
      typeof record.displayName !== "string"
    ) {
      return null;
    }
    return parsed as UserProfile;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [isSignInInProgress, setIsSignInInProgress] = useState(false);
  const tokenRef = useRef<string | null>(null);

  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  // Wired once into the shared API client so every generated hook/request
  // automatically carries the session token when one is set.
  useEffect(() => {
    setAuthTokenGetter(() => tokenRef.current);
    return () => setAuthTokenGetter(null);
  }, []);

  const persistSession = useCallback(
    async (nextToken: string, nextUser: UserProfile) => {
      setToken(nextToken);
      setUser(nextUser);
      await Promise.all([
        AsyncStorage.setItem(STORAGE_KEYS.token, nextToken),
        AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(nextUser)),
      ]);
    },
    [],
  );

  const clearSession = useCallback(async () => {
    setToken(null);
    setUser(null);
    await Promise.all([
      AsyncStorage.removeItem(STORAGE_KEYS.token),
      AsyncStorage.removeItem(STORAGE_KEYS.user),
    ]);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      const [storedToken, storedUser] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEYS.token),
        AsyncStorage.getItem(STORAGE_KEYS.user),
      ]);
      if (!active) return;
      const parsedUser = parseStoredUser(storedUser);
      if (storedToken && parsedUser) {
        tokenRef.current = storedToken;
        setToken(storedToken);
        setUser(parsedUser);
        // Refresh from the server in the background; only sign out on a
        // definite "session is invalid" response, never on a network error.
        try {
          const freshUser = await apiGetCurrentUser();
          if (active) setUser(freshUser);
        } catch (error) {
          if (active && error instanceof ApiError && error.status === 401) {
            await clearSession();
          }
        }
      }
      if (active) setIsAuthLoading(false);
    })();
    return () => {
      active = false;
    };
    // Runs once on mount only; clearSession is stable (empty deps).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

  const [request, response, promptAsync] = useIdTokenAuthRequest({
    androidClientId,
    iosClientId,
    webClientId,
    scopes: ["openid", "profile", "email"],
  });

  const isGoogleSignInReady =
    Boolean(request) && Boolean(androidClientId || iosClientId || webClientId);

  const exchangeIdToken = useCallback(
    async (idToken: string) => {
      const result = await apiSignInWithGoogle({ idToken });
      await persistSession(result.token, result.user);
    },
    [persistSession],
  );

  // Handles the case where the OAuth response resolves asynchronously
  // outside of the promptAsync() call below (some platforms/redirect modes).
  useEffect(() => {
    if (response?.type !== "success") return;
    const idToken = response.params?.["id_token"];
    if (!idToken) return;
    void exchangeIdToken(idToken);
    // Only react to a *new* response object.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [response]);

  const signInWithGoogle = useCallback(async () => {
    if (!request) {
      throw new Error("تسجيل الدخول بجوجل غير متاح على هذا الجهاز حاليًا.");
    }
    setIsSignInInProgress(true);
    try {
      const result = await promptAsync();
      if (result.type === "success") {
        const idToken = result.params?.["id_token"];
        if (!idToken) {
          throw new Error("لم يصل رمز الدخول من جوجل.");
        }
        await exchangeIdToken(idToken);
      } else if (result.type !== "cancel" && result.type !== "dismiss") {
        throw new Error("تعذر إكمال تسجيل الدخول بجوجل.");
      }
    } finally {
      setIsSignInInProgress(false);
    }
  }, [request, promptAsync, exchangeIdToken]);

  const signOut = useCallback(async () => {
    await clearSession();
  }, [clearSession]);

  const updateHideIdentity = useCallback(async (hideIdentity: boolean) => {
    const updated = await apiUpdateCurrentUser({ hideIdentity });
    setUser(updated);
    await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(updated));
  }, []);

  const refreshUser = useCallback(async () => {
    const fresh = await apiGetCurrentUser();
    setUser(fresh);
    await AsyncStorage.setItem(STORAGE_KEYS.user, JSON.stringify(fresh));
  }, []);

  const deleteAccount = useCallback(async () => {
    await apiDeleteCurrentUser();
    await clearSession();
  }, [clearSession]);

  const getSessionToken = useCallback(() => tokenRef.current, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthLoading,
      isSignInInProgress,
      isGoogleSignInReady,
      signInWithGoogle,
      signOut,
      updateHideIdentity,
      refreshUser,
      deleteAccount,
      getSessionToken,
    }),
    [
      user,
      isAuthLoading,
      isSignInInProgress,
      isGoogleSignInReady,
      signInWithGoogle,
      signOut,
      updateHideIdentity,
      refreshUser,
      deleteAccount,
      getSessionToken,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }
  return context;
}
