import { Feather } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import React from "react";
import { Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { AppScreen, ScreenHeading, font, uiColors } from "@/components/library-ui";

const c = uiColors;

function readPublicBaseUrl(): string | null {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}` : null;
}

function readContactEmail(): string | null {
  return process.env.EXPO_PUBLIC_CONTACT_EMAIL || null;
}

// Stage 8 — Google Play's "عن التطبيق" requirement: version + links to the
// policy pages (routes/pages.ts) + a way to reach the team, all in one
// place the person can find from Profile without digging.
export default function AboutScreen() {
  const router = useRouter();
  const base = readPublicBaseUrl();
  const contactEmail = readContactEmail();
  const version = Constants.expoConfig?.version ?? "1.0.0";

  const open = async (path: string) => {
    if (!base) return;
    try {
      await Linking.openURL(`${base}${path}`);
    } catch {
      // Best-effort — nothing to recover from if the device can't open a
      // browser link.
    }
  };

  const links: Array<{
    icon: keyof typeof Feather.glyphMap;
    label: string;
    onPress: () => void;
    disabled?: boolean;
  }> = [
    { icon: "shield", label: "سياسة الخصوصية", onPress: () => void open("/privacy") },
    { icon: "file-text", label: "شروط الاستخدام", onPress: () => void open("/terms") },
    {
      icon: "flag",
      label: "الإبلاغ عن محتوى (زر الإبلاغ متاح على كل ملف وبروفايل)",
      onPress: () => router.push("/(tabs)/explore"),
    },
    { icon: "copy", label: "طلب إزالة محتوى (حقوق ملكية)", onPress: () => void open("/takedown") },
    { icon: "trash-2", label: "حذف الحساب", onPress: () => router.push("/profile") },
  ];

  return (
    <AppScreen>
      <ScreenHeading title="عن التطبيق" back={() => router.back()} />

      <View style={styles.identity}>
        <Text style={styles.appName}>مراجعي | Maraje3</Text>
        <Text style={styles.version}>الإصدار {version}</Text>
        <Text style={styles.tagline}>
          مكتبة مصادر دراسية مجانية، يرفعها الطلاب لطلاب آخرين.
        </Text>
      </View>

      <View style={styles.list}>
        {links.map((link) => (
          <Pressable
            key={link.label}
            onPress={link.onPress}
            disabled={link.disabled}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.row,
              pressed && styles.rowPressed,
              link.disabled && styles.rowDisabled,
            ]}
          >
            <Feather name={link.icon} size={17} color={c.accentForeground} />
            <Text style={styles.rowText}>{link.label}</Text>
            <Feather name="chevron-left" size={16} color={c.mutedForeground} />
          </Pressable>
        ))}
      </View>

      {contactEmail ? (
        <Pressable
          onPress={() => void Linking.openURL(`mailto:${contactEmail}`)}
          style={styles.contactRow}
          accessibilityRole="button"
          testID="about-contact-email"
        >
          <Feather name="mail" size={15} color={c.mutedForeground} />
          <Text style={styles.contactText}>{contactEmail}</Text>
        </Pressable>
      ) : null}

      {!base ? (
        <Text style={styles.offlineNotice}>
          روابط الخصوصية والشروط غير متاحة بدون اتصال بخادم منشور.
        </Text>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  identity: { alignItems: "center", gap: 4, paddingVertical: 8 },
  appName: { color: c.foreground, fontFamily: font.bold, fontSize: 18 },
  version: { color: c.mutedForeground, fontFamily: font.medium, fontSize: 12 },
  tagline: {
    color: c.mutedForeground,
    fontFamily: font.regular,
    fontSize: 12,
    textAlign: "center",
    marginTop: 6,
    maxWidth: 260,
  },
  list: { gap: 8 },
  row: {
    flexDirection: "row-reverse",
    alignItems: "center",
    gap: 10,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  rowPressed: { opacity: 0.85 },
  rowDisabled: { opacity: 0.5 },
  rowText: { flex: 1, color: c.foreground, fontFamily: font.semibold, fontSize: 13, textAlign: "right" },
  contactRow: {
    flexDirection: "row-reverse",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
  },
  contactText: { color: c.mutedForeground, fontFamily: font.regular, fontSize: 12 },
  offlineNotice: {
    color: c.mutedForeground,
    fontFamily: font.regular,
    fontSize: 11,
    textAlign: "center",
  },
});
