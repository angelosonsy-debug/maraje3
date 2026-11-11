import React, { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { KeyboardProvider } from "react-native-keyboard-controller";
import { I18nManager } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Cairo_400Regular, Cairo_500Medium, Cairo_600SemiBold, Cairo_700Bold, useFonts } from "@expo-google-fonts/cairo";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { AuthProvider } from "@/state/auth-context";
import { LibraryProvider } from "@/state/library-context";
import { initializeAds } from "@/lib/ads";
import { setBaseUrl } from "@workspace/api-client-react";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

I18nManager.allowRTL(true);
if (!I18nManager.isRTL) I18nManager.forceRTL(true);

const domain = process.env.EXPO_PUBLIC_DOMAIN;
if (domain) setBaseUrl(`https://${domain}`);

const queryClient = new QueryClient();

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false, headerBackTitle: "رجوع" }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="search" />
      <Stack.Screen name="subject/[id]" />
      <Stack.Screen name="material/[id]" />
      <Stack.Screen name="profile" />
      <Stack.Screen name="upload" />
      <Stack.Screen name="contributor/[id]" />
      <Stack.Screen name="leaderboard" />
      <Stack.Screen name="requests" />
      <Stack.Screen name="new-request" />
      <Stack.Screen name="exams" />
      <Stack.Screen name="flashcards/[subjectId]" />
      <Stack.Screen name="flashcards/deck/[id]" />
      <Stack.Screen name="flashcards/new" />
      <Stack.Screen name="premium" />
      <Stack.Screen name="about" />
      <Stack.Screen name="admin" />
    </Stack>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Cairo_400Regular,
    Cairo_500Medium,
    Cairo_600SemiBold,
    Cairo_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  useEffect(() => {
    void initializeAds();
  }, []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <LibraryProvider>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </LibraryProvider>
          </AuthProvider>
        </QueryClientProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
