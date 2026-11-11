import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import type { ExamType } from "@/types/catalog";

const STORAGE_KEY = "maraje3.upcoming-exams.v1";
const NOTIFICATION_PERMISSION_ASKED_KEY = "maraje3.exam-notif-permission-asked.v1";

export type UpcomingExam = {
  id: string;
  subjectId: number;
  /** ISO date (yyyy-mm-dd), midnight local — no time-of-day input in the UI. */
  examDate: string;
  examType: ExamType;
  /** expo-notifications identifiers scheduled for this exam, so they can be cancelled on delete. */
  notificationIds: string[];
};

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function readExams(): Promise<UpcomingExam[]> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    const parsed: unknown = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? (parsed as UpcomingExam[]) : [];
  } catch {
    return [];
  }
}

async function writeExams(exams: UpcomingExam[]): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(exams));
}

export function daysUntil(examDate: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(`${examDate}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

const EXAM_TYPE_LABELS: Record<ExamType, string> = {
  midterm: "منتصف الفصل",
  final: "نهائي",
  quiz: "اختبار قصير",
  sheet: "ورقة أسئلة",
  other: "أخرى",
};
export function examTypeLabel(type: ExamType): string {
  return EXAM_TYPE_LABELS[type] ?? type;
}

/**
 * Requested only when the student adds their FIRST exam — never on app
 * open — per the Stage 6 spec. Safe to call again later; Expo no-ops a
 * repeat request once the user has already answered.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  const already = await AsyncStorage.getItem(NOTIFICATION_PERMISSION_ASKED_KEY);
  const { status: current } = await Notifications.getPermissionsAsync();
  if (current === "granted") return true;
  if (already === "1" && current !== "undetermined") {
    // Already asked once and the user declined — don't nag on every add.
    return false;
  }
  await AsyncStorage.setItem(NOTIFICATION_PERMISSION_ASKED_KEY, "1");
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("exam-reminders", {
      name: "تذكير الامتحانات",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

async function scheduleReminders(
  subjectLabel: string,
  examDate: string,
): Promise<string[]> {
  const granted = (await Notifications.getPermissionsAsync()).status === "granted";
  if (!granted) return [];

  const target = new Date(`${examDate}T08:00:00`);
  const offsets = [
    { days: 7, body: `باقي 7 أيام على امتحان ${subjectLabel}` },
    { days: 3, body: `باقي 3 أيام على امتحان ${subjectLabel}` },
    { days: 1, body: `باقي يوم واحد على امتحان ${subjectLabel}` },
    { days: 0, body: `امتحان ${subjectLabel} النهارده — بالتوفيق 🤍` },
  ];

  const ids: string[] = [];
  for (const offset of offsets) {
    const triggerDate = new Date(target.getTime() - offset.days * 86_400_000);
    if (triggerDate.getTime() <= Date.now()) continue;
    const id = await Notifications.scheduleNotificationAsync({
      content: { title: "مراجعي", body: offset.body },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: triggerDate,
      },
    });
    ids.push(id);
  }
  return ids;
}

export async function addExam(params: {
  subjectId: number;
  subjectLabel: string;
  examDate: string;
  examType: ExamType;
}): Promise<UpcomingExam> {
  const notificationIds = await scheduleReminders(
    params.subjectLabel,
    params.examDate,
  );
  const exam: UpcomingExam = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    subjectId: params.subjectId,
    examDate: params.examDate,
    examType: params.examType,
    notificationIds,
  };
  const exams = await readExams();
  const next = [...exams, exam].sort((a, b) => a.examDate.localeCompare(b.examDate));
  await writeExams(next);
  return exam;
}

export async function removeExam(id: string): Promise<void> {
  const exams = await readExams();
  const target = exams.find((exam) => exam.id === id);
  if (target) {
    await Promise.all(
      target.notificationIds.map((notificationId) =>
        Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => undefined),
      ),
    );
  }
  await writeExams(exams.filter((exam) => exam.id !== id));
}
