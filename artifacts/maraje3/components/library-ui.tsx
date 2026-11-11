import { Feather } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import colors from "@/constants/colors";
import { CATEGORY_LABELS } from "@/types/catalog";
import type { Material, MaterialCategory } from "@/types/catalog";

const c = colors.light;
export const font = {
  regular: "Cairo_400Regular",
  medium: "Cairo_500Medium",
  semibold: "Cairo_600SemiBold",
  bold: "Cairo_700Bold",
};

export function AppScreen({
  children,
  contentStyle,
  refreshing,
  onRefresh,
}: {
  children: React.ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  refreshing?: boolean;
  onRefresh?: () => void;
}) {
  return (
    <SafeAreaView
      edges={["top", "left", "right"]}
      style={styles.safe}
      testID="screen"
    >
      <ScrollView
        contentContainerStyle={[
          styles.screenContent,
          Platform.OS === "web" && styles.webTopInset,
          contentStyle,
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={Boolean(refreshing)}
              onRefresh={onRefresh}
              tintColor={c.primary}
            />
          ) : undefined
        }
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function ScreenHeading({
  title,
  subtitle,
  back,
  right,
}: {
  title: string;
  subtitle?: string;
  back?: () => void;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.screenHeading}>
      {back ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="رجوع"
          onPress={back}
          style={styles.iconButton}
          testID="back-button"
        >
          <Feather name="arrow-right" size={20} color={c.foreground} />
        </Pressable>
      ) : null}
      <View style={styles.headingText}>
        <Text style={styles.headingTitle}>{title}</Text>
        {subtitle ? <Text style={styles.headingSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export function SectionHeading({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.sectionHeading}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          testID="section-action"
        >
          <Text style={styles.actionText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SearchField({
  value,
  onChangeText,
  onPress,
  placeholder = "ابحث عن مادة أو موضوع",
  editable = true,
}: {
  value: string;
  onChangeText?: (value: string) => void;
  onPress?: () => void;
  placeholder?: string;
  editable?: boolean;
}) {
  return (
    <Pressable
      onPress={editable ? undefined : onPress}
      style={styles.searchField}
      accessibilityRole={editable ? undefined : "button"}
      testID="catalog-search"
    >
      <Feather name="search" size={20} color={c.mutedForeground} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.mutedForeground}
        style={styles.searchInput}
        textAlign="right"
        editable={editable}
        pointerEvents={editable ? "auto" : "none"}
        returnKeyType="search"
        clearButtonMode="while-editing"
        autoCorrect={false}
        testID="catalog-search-input"
      />
      {value.length > 0 && onChangeText ? (
        <Pressable
          accessibilityLabel="مسح البحث"
          onPress={() => onChangeText("")}
          hitSlop={10}
        >
          <Feather name="x-circle" size={18} color={c.mutedForeground} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

export function InlineNotice({
  title,
  description,
  tone = "neutral",
  icon = "info",
  onAction,
  actionLabel,
}: {
  title: string;
  description?: string;
  tone?: "neutral" | "warning" | "success";
  icon?: keyof typeof Feather.glyphMap;
  onAction?: () => void;
  actionLabel?: string;
}) {
  const toneStyle =
    tone === "warning"
      ? styles.noticeWarning
      : tone === "success"
        ? styles.noticeSuccess
        : styles.noticeNeutral;
  return (
    <View style={[styles.notice, toneStyle]}>
      <Feather
        name={icon}
        size={18}
        color={tone === "warning" ? c.destructive : c.accentForeground}
      />
      <View style={styles.noticeBody}>
        <Text style={styles.noticeTitle}>{title}</Text>
        {description ? (
          <Text style={styles.noticeDescription}>{description}</Text>
        ) : null}
        {onAction && actionLabel ? (
          <Pressable
            onPress={onAction}
            style={styles.noticeAction}
            accessibilityRole="button"
          >
            <Text style={styles.actionText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function DemoBadge({ compact = false }: { compact?: boolean }) {
  return (
    <View style={[styles.demoBadge, compact && styles.demoBadgeCompact]}>
      <Feather name="info" size={compact ? 11 : 13} color={c.accentForeground} />
      <Text style={[styles.demoBadgeText, compact && styles.demoBadgeSmall]}>
        تجريبي
      </Text>
    </View>
  );
}

export function MaterialCard({
  material,
  context,
  onPress,
  trailing,
}: {
  material: Material;
  context?: string;
  onPress: () => void;
  trailing?: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.materialCard,
        pressed && styles.pressed,
      ]}
      testID={`material-card-${material.id}`}
    >
      <View style={styles.materialIcon}>
        <Feather
          name={material.documentUrl ? "file-text" : "file"}
          size={20}
          color={c.accentForeground}
        />
      </View>
      <View style={styles.materialBody}>
        <View style={styles.materialTitleLine}>
          <Text style={styles.materialTitle} numberOfLines={2}>
            {material.titleAr}
          </Text>
          {material.isDemo ? <DemoBadge compact /> : null}
        </View>
        {context ? (
          <Text style={styles.materialContext} numberOfLines={1}>
            {context}
          </Text>
        ) : null}
        <View style={styles.materialMetaLine}>
          <Text style={styles.materialType}>
            {CATEGORY_LABELS[material.category]}
          </Text>
          <View style={styles.metaDot} />
          <Text style={styles.materialFormat}>{material.fileFormat}</Text>
          {!material.documentUrl ? (
            <>
              <View style={styles.metaDot} />
              <Text style={styles.unavailableLabel}>غير متاح</Text>
            </>
          ) : null}
        </View>
      </View>
      {trailing}
      <Feather name="chevron-left" size={17} color={c.mutedForeground} />
    </Pressable>
  );
}

export function SubjectCard({
  title,
  subtitle,
  resourceCount,
  isDemo,
  onPress,
}: {
  title: string;
  subtitle: string;
  resourceCount: number;
  isDemo?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [styles.subjectCard, pressed && styles.pressed]}
      testID="subject-card"
    >
      <View style={styles.subjectIcon}>
        <Feather name="book-open" size={21} color={c.primary} />
      </View>
      <View style={styles.subjectBody}>
        <View style={styles.materialTitleLine}>
          <Text style={styles.subjectTitle}>{title}</Text>
          {isDemo ? <DemoBadge compact /> : null}
        </View>
        <Text style={styles.subjectSubtitle}>{subtitle}</Text>
        <Text style={styles.resourceCount}>
          {resourceCount === 0 ? "لا توجد موارد منشورة بعد" : `${resourceCount} موارد`}
        </Text>
      </View>
      <Feather name="chevron-left" size={17} color={c.mutedForeground} />
    </Pressable>
  );
}

export function FilterPicker({
  label,
  value,
  options,
  onChange,
  allLabel = "الكل",
  allowAll = true,
}: {
  label: string;
  value?: number | string;
  options: Array<{ id: number | string; label: string }>;
  onChange: (value: number | string | undefined) => void;
  allLabel?: string;
  allowAll?: boolean;
}) {
  const [visible, setVisible] = React.useState(false);
  const activeLabel =
    options.find((item) => item.id === value)?.label ?? allLabel;
  return (
    <>
      <Pressable
        onPress={() => setVisible(true)}
        style={[styles.filterPill, value !== undefined && styles.filterPillActive]}
        accessibilityRole="button"
        testID={`filter-${label}`}
      >
        <Text
          style={[
            styles.filterPillText,
            value !== undefined && styles.filterPillTextActive,
          ]}
          numberOfLines={1}
        >
          {label}: {activeLabel}
        </Text>
        <Feather
          name="chevron-down"
          size={14}
          color={value !== undefined ? c.accentForeground : c.mutedForeground}
        />
      </Pressable>
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => setVisible(false)}
            accessibilityLabel="إغلاق"
          />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeading}>
              <Text style={styles.sheetTitle}>اختيار {label}</Text>
              <Pressable onPress={() => setVisible(false)} hitSlop={10}>
                <Feather name="x" size={20} color={c.foreground} />
              </Pressable>
            </View>
            <FlatList
              data={[
                ...(allowAll ? [{ id: "__all", label: allLabel }] : []),
                ...options,
              ]}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const selected =
                  item.id === "__all"
                    ? value === undefined
                    : item.id === value;
                return (
                  <Pressable
                    onPress={() => {
                      onChange(item.id === "__all" ? undefined : item.id);
                      setVisible(false);
                    }}
                    style={styles.sheetOption}
                  >
                    <Text style={styles.sheetOptionText}>{item.label}</Text>
                    {selected ? (
                      <Feather name="check" size={18} color={c.accentForeground} />
                    ) : null}
                  </Pressable>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

export function EmptyState({
  icon = "book-open",
  title,
  description,
  actionLabel,
  onAction,
}: {
  icon?: keyof typeof Feather.glyphMap;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Feather name={icon} size={24} color={c.accentForeground} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyDescription}>{description}</Text>
      {actionLabel && onAction ? (
        <Pressable style={styles.primaryButton} onPress={onAction}>
          <Text style={styles.primaryButtonText}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function TextEntry({
  label,
  value,
  onChangeText,
  placeholder,
  multiline = false,
  keyboardType,
  secureTextEntry,
  style,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  keyboardType?: "default" | "numeric" | "url";
  secureTextEntry?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <View style={styles.entryWrap}>
      <Text style={styles.entryLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.mutedForeground}
        style={[styles.entryInput, multiline && styles.multilineInput, style]}
        multiline={multiline}
        textAlign="right"
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
        autoCapitalize={keyboardType === "url" ? "none" : "sentences"}
        testID={`entry-${label}`}
      />
    </View>
  );
}

export function PrimaryButton({
  label,
  onPress,
  loading,
  disabled,
  icon,
  variant = "primary",
  testID,
}: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Feather.glyphMap;
  variant?: "primary" | "secondary" | "destructive";
  testID?: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.primaryButton,
        variant === "secondary" && styles.secondaryButton,
        variant === "destructive" && styles.destructiveButton,
        (disabled || loading) && styles.disabledButton,
        pressed && !(disabled || loading) && styles.pressed,
      ]}
      accessibilityRole="button"
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color={variant === "secondary" ? c.primary : "#fff"} />
      ) : icon ? (
        <Feather
          name={icon}
          size={17}
          color={variant === "secondary" ? c.primary : "#fff"}
        />
      ) : null}
      <Text
        style={[
          styles.primaryButtonText,
          variant === "secondary" && styles.secondaryButtonText,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function CategoryPill({
  category,
  active,
  onPress,
}: {
  category: MaterialCategory;
  active?: boolean;
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.categoryPill, active && styles.categoryPillActive]}
    >
      <Text
        style={[
          styles.categoryText,
          active && styles.categoryTextActive,
        ]}
      >
        {CATEGORY_LABELS[category]}
      </Text>
    </Pressable>
  );
}

export function formatFileSize(bytes: number | null): string | null {
  if (!bytes || bytes <= 0) return null;
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} كيلوبايت`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} ميجابايت`;
}

export function LoadingState({ label = "جارٍ تحميل المكتبة..." }: { label?: string }) {
  return (
    <View style={styles.loadingState}>
      <ActivityIndicator size="large" color={c.primary} />
      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
}

export const uiColors = c;

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.background },
  screenContent: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 34, gap: 18 },
  webTopInset: { paddingTop: 67, paddingBottom: 84 },
  screenHeading: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52 },
  headingText: { flex: 1, gap: 1, alignItems: "flex-start" },
  headingTitle: { color: c.foreground, fontFamily: font.bold, fontSize: 23, textAlign: "right" },
  headingSubtitle: { color: c.mutedForeground, fontFamily: font.regular, fontSize: 13, textAlign: "right" },
  iconButton: { width: 42, height: 42, borderRadius: 15, borderWidth: 1, borderColor: c.border, backgroundColor: c.card, alignItems: "center", justifyContent: "center" },
  sectionHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 4 },
  sectionTitle: { color: c.foreground, fontFamily: font.bold, fontSize: 17, textAlign: "right" },
  actionText: { color: c.accentForeground, fontFamily: font.semibold, fontSize: 13 },
  searchField: { minHeight: 54, paddingHorizontal: 15, borderWidth: 1, borderColor: c.border, borderRadius: 17, backgroundColor: c.card, flexDirection: "row", alignItems: "center", gap: 11 },
  searchInput: { flex: 1, fontFamily: font.regular, fontSize: 14, color: c.foreground, paddingVertical: 12, writingDirection: "rtl" },
  notice: { borderRadius: 16, padding: 14, flexDirection: "row", alignItems: "flex-start", gap: 10, borderWidth: 1 },
  noticeNeutral: { backgroundColor: c.secondary, borderColor: "#d3e4dc" },
  noticeWarning: { backgroundColor: "#f7e8e4", borderColor: "#ead2cb" },
  noticeSuccess: { backgroundColor: "#e5f0e7", borderColor: "#d1e3d3" },
  noticeBody: { flex: 1, gap: 3, alignItems: "flex-start" },
  noticeTitle: { color: c.foreground, fontFamily: font.semibold, fontSize: 13, textAlign: "right" },
  noticeDescription: { color: c.mutedForeground, fontFamily: font.regular, fontSize: 12, lineHeight: 19, textAlign: "right" },
  noticeAction: { marginTop: 5 },
  demoBadge: { alignSelf: "flex-start", flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 9, paddingVertical: 4, borderRadius: 30, backgroundColor: c.accent },
  demoBadgeCompact: { paddingHorizontal: 6, paddingVertical: 2, gap: 3 },
  demoBadgeText: { color: c.accentForeground, fontFamily: font.semibold, fontSize: 11 },
  demoBadgeSmall: { fontSize: 10 },
  materialCard: { flexDirection: "row", alignItems: "center", gap: 11, padding: 13, borderRadius: 17, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, minHeight: 88 },
  materialIcon: { width: 42, height: 42, borderRadius: 13, alignItems: "center", justifyContent: "center", backgroundColor: c.secondary },
  materialBody: { flex: 1, gap: 4, alignItems: "flex-start" },
  materialTitleLine: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "stretch" },
  materialTitle: { flexShrink: 1, color: c.foreground, fontFamily: font.semibold, fontSize: 14, textAlign: "right" },
  materialContext: { color: c.mutedForeground, fontFamily: font.regular, fontSize: 11, textAlign: "right" },
  materialMetaLine: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 },
  materialType: { color: c.accentForeground, fontFamily: font.medium, fontSize: 10 },
  materialFormat: { color: c.mutedForeground, fontFamily: font.medium, fontSize: 10 },
  unavailableLabel: { color: c.destructive, fontFamily: font.medium, fontSize: 10 },
  metaDot: { width: 3, height: 3, borderRadius: 2, backgroundColor: c.mutedForeground },
  subjectCard: { flexDirection: "row", alignItems: "center", gap: 11, padding: 13, borderRadius: 17, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, minHeight: 88 },
  subjectIcon: { width: 44, height: 44, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: "#e8eee7" },
  subjectBody: { flex: 1, gap: 2, alignItems: "flex-start" },
  subjectTitle: { color: c.foreground, fontFamily: font.semibold, fontSize: 14, flexShrink: 1, textAlign: "right" },
  subjectSubtitle: { color: c.mutedForeground, fontFamily: font.regular, fontSize: 11, textAlign: "right" },
  resourceCount: { color: c.accentForeground, fontFamily: font.semibold, fontSize: 10, marginTop: 2 },
  pressed: { opacity: 0.78, transform: [{ scale: 0.99 }] },
  filterPill: { minHeight: 36, borderRadius: 20, backgroundColor: c.card, borderWidth: 1, borderColor: c.border, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 5 },
  filterPillActive: { backgroundColor: c.accent, borderColor: "#c2dcd0" },
  filterPillText: { color: c.mutedForeground, fontFamily: font.medium, fontSize: 11 },
  filterPillTextActive: { color: c.accentForeground },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,36,39,0.3)" },
  sheet: { maxHeight: "78%", paddingHorizontal: 20, paddingTop: 12, paddingBottom: 30, borderTopLeftRadius: 25, borderTopRightRadius: 25, backgroundColor: c.background },
  sheetHandle: { alignSelf: "center", width: 38, height: 4, borderRadius: 3, backgroundColor: "#bdc6bf", marginBottom: 18 },
  sheetHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: c.border },
  sheetTitle: { color: c.foreground, fontFamily: font.bold, fontSize: 17 },
  sheetOption: { minHeight: 50, borderBottomWidth: 1, borderBottomColor: c.border, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetOptionText: { color: c.foreground, fontFamily: font.medium, fontSize: 14, textAlign: "right" },
  emptyState: { minHeight: 245, justifyContent: "center", alignItems: "center", paddingHorizontal: 22, gap: 9, borderRadius: 20, backgroundColor: c.card, borderWidth: 1, borderColor: c.border },
  emptyIcon: { width: 52, height: 52, borderRadius: 18, backgroundColor: c.secondary, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  emptyTitle: { color: c.foreground, fontFamily: font.bold, fontSize: 17, textAlign: "center" },
  emptyDescription: { color: c.mutedForeground, fontFamily: font.regular, fontSize: 13, lineHeight: 21, textAlign: "center" },
  entryWrap: { gap: 6 },
  entryLabel: { color: c.foreground, fontFamily: font.semibold, fontSize: 13, textAlign: "right" },
  entryInput: { borderWidth: 1, borderColor: c.border, borderRadius: 13, backgroundColor: c.card, paddingHorizontal: 13, paddingVertical: 11, color: c.foreground, fontFamily: font.regular, fontSize: 14, textAlign: "right", writingDirection: "rtl" },
  multilineInput: { minHeight: 88, textAlignVertical: "top" },
  primaryButton: { minHeight: 48, borderRadius: 14, paddingHorizontal: 16, backgroundColor: c.primary, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  primaryButtonText: { color: "#ffffff", fontFamily: font.semibold, fontSize: 14 },
  secondaryButton: { backgroundColor: c.secondary, borderWidth: 1, borderColor: c.border },
  secondaryButtonText: { color: c.primary },
  destructiveButton: { backgroundColor: c.destructive },
  disabledButton: { opacity: 0.45 },
  categoryPill: { paddingHorizontal: 13, paddingVertical: 8, borderRadius: 24, borderWidth: 1, borderColor: c.border, backgroundColor: c.card },
  categoryPillActive: { backgroundColor: c.primary, borderColor: c.primary },
  categoryText: { color: c.mutedForeground, fontFamily: font.medium, fontSize: 12 },
  categoryTextActive: { color: c.primaryForeground },
  loadingState: { minHeight: 220, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: c.mutedForeground, fontFamily: font.medium, fontSize: 13 },
});
