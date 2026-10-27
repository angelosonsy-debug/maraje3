import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Platform } from "react-native";
import {
  getGetCatalogTreeQueryKey,
  getGetMaterialsQueryKey,
  recordMaterialDownload,
  useGetCatalogTree,
  useGetMaterials,
} from "@workspace/api-client-react";
import { DEMO_CATALOG } from "@/data/demo-catalog";
import { getAnonymousDeviceId } from "@/lib/device-id";
import { isCatalogData } from "@/lib/catalog";
import type {
  AppCatalog,
  CatalogResponse,
  CatalogTreeResponse,
  CatalogSource,
  DownloadRecord,
  Material,
  UserStudyPreference,
} from "@/types/catalog";

const STORAGE_KEYS = {
  bookmarks: "maraje3.bookmarks.v1",
  recents: "maraje3.recents.v1",
  downloads: "maraje3.downloads.v1",
  catalog: "maraje3.catalog-cache.v2",
  legacyCatalog: "maraje3.catalog-cache.v1",
  preference: "maraje3.study-preference.v1",
};

type LibraryContextValue = {
  catalog: AppCatalog;
  source: CatalogSource;
  isRefreshing: boolean;
  isOffline: boolean;
  refreshCatalog: () => Promise<void>;
  preference: UserStudyPreference | null;
  isPreferenceLoaded: boolean;
  savePreference: (preference: UserStudyPreference) => Promise<void>;
  rememberMaterials: (materials: Material[]) => void;
  savedIds: number[];
  recentIds: number[];
  downloads: DownloadRecord[];
  isSaved: (id: number) => boolean;
  toggleSaved: (id: number) => Promise<void>;
  recordRecent: (id: number) => void;
  downloadMaterial: (material: Material) => Promise<void>;
  openDownloaded: (record: DownloadRecord) => Promise<void>;
  removeDownload: (record: DownloadRecord) => Promise<void>;
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

function readIdList(value: string | null): number[] {
  if (!value) return [];
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is number => Number.isInteger(item))
      : [];
  } catch {
    return [];
  }
}

function isCatalogTree(value: unknown): value is CatalogTreeResponse {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return [
    "universities",
    "faculties",
    "academicYears",
    "semesters",
    "subjects",
  ].every((key) => Array.isArray(record[key]));
}

function treeFromCatalog(catalog: CatalogResponse): CatalogTreeResponse {
  return {
    universities: catalog.universities,
    faculties: catalog.faculties,
    academicYears: catalog.academicYears,
    semesters: catalog.semesters,
    subjects: catalog.subjects.map((subject) => ({
      ...subject,
      materialCount: catalog.materials.filter(
        (material) =>
          material.subjectId === subject.id &&
          material.publicationStatus === "published",
      ).length,
    })),
  };
}

function mergeMaterials(current: Material[], incoming: Material[]): Material[] {
  const byId = new Map(current.map((material) => [material.id, material]));
  for (const material of incoming) byId.set(material.id, material);
  return [...byId.values()].sort(
    (a, b) => Date.parse(String(b.createdAt)) - Date.parse(String(a.createdAt)),
  );
}

function parsePreference(value: string | null): UserStudyPreference | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!parsed || typeof parsed !== "object") return null;
    const record = parsed as Record<string, unknown>;
    if (
      !Number.isInteger(record.universityId) ||
      !Number.isInteger(record.facultyId) ||
      !Number.isInteger(record.academicYearId) ||
      (record.semesterId !== undefined && !Number.isInteger(record.semesterId))
    ) {
      return null;
    }
    return {
      universityId: record.universityId as number,
      facultyId: record.facultyId as number,
      academicYearId: record.academicYearId as number,
      ...(typeof record.semesterId === "number"
        ? { semesterId: record.semesterId }
        : {}),
    };
  } catch {
    return null;
  }
}

function fileNameFor(material: Material): string {
  const safeName = material.titleEn
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 56);
  return `maraje3-${material.id}-${safeName || "document"}.pdf`;
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const treeQuery = useGetCatalogTree({
    query: {
      queryKey: getGetCatalogTreeQueryKey(),
      staleTime: 60_000,
      retry: 1,
    },
  });
  const firstMaterialsQuery = useGetMaterials(
    { page: 1, limit: 50 },
    {
      query: {
        queryKey: getGetMaterialsQueryKey({ page: 1, limit: 50 }),
        staleTime: 60_000,
        retry: 1,
      },
    },
  );
  const [cachedTree, setCachedTree] = useState<CatalogTreeResponse | null>(null);
  const [cachedMaterials, setCachedMaterials] = useState<Material[]>([]);
  const [preference, setPreference] = useState<UserStudyPreference | null>(null);
  const [isPreferenceLoaded, setIsPreferenceLoaded] = useState(false);
  const [savedIds, setSavedIds] = useState<number[]>([]);
  const [recentIds, setRecentIds] = useState<number[]>([]);
  const [downloads, setDownloads] = useState<DownloadRecord[]>([]);

  useEffect(() => {
    let active = true;
    void Promise.all([
      AsyncStorage.getItem(STORAGE_KEYS.bookmarks),
      AsyncStorage.getItem(STORAGE_KEYS.recents),
      AsyncStorage.getItem(STORAGE_KEYS.downloads),
      AsyncStorage.getItem(STORAGE_KEYS.catalog),
      AsyncStorage.getItem(STORAGE_KEYS.legacyCatalog),
      AsyncStorage.getItem(STORAGE_KEYS.preference),
    ])
      .then(([saved, recents, downloaded, catalog, legacyCatalog, savedPreference]) => {
        if (!active) return;
        setSavedIds(readIdList(saved));
        setRecentIds(readIdList(recents));
        setPreference(parsePreference(savedPreference));
        if (downloaded) {
          try {
            const parsed: unknown = JSON.parse(downloaded);
            if (Array.isArray(parsed)) {
              setDownloads(
                parsed.filter(
                  (item): item is DownloadRecord =>
                    Boolean(item) &&
                    typeof item === "object" &&
                    Number.isInteger((item as DownloadRecord).materialId) &&
                    typeof (item as DownloadRecord).localUri === "string",
                ),
              );
            }
          } catch {
            setDownloads([]);
          }
        }
        if (catalog) {
          try {
            const parsed: unknown = JSON.parse(catalog);
            if (
              parsed &&
              typeof parsed === "object" &&
              isCatalogTree((parsed as CachedCatalog).tree) &&
              Array.isArray((parsed as CachedCatalog).materials)
            ) {
              setCachedTree((parsed as CachedCatalog).tree);
              setCachedMaterials((parsed as CachedCatalog).materials);
            }
          } catch {
            setCachedTree(null);
            setCachedMaterials([]);
          }
        } else if (legacyCatalog) {
          try {
            const parsed: unknown = JSON.parse(legacyCatalog);
            if (isCatalogData(parsed)) {
              setCachedTree(treeFromCatalog(parsed));
              setCachedMaterials(parsed.materials);
            }
          } catch {
            setCachedTree(null);
            setCachedMaterials([]);
          }
        }
      })
      .finally(() => {
        if (active) setIsPreferenceLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!treeQuery.data) {
      return;
    }
    setCachedTree(treeQuery.data);
    void AsyncStorage.setItem(
      STORAGE_KEYS.catalog,
      JSON.stringify({ tree: treeQuery.data, materials: cachedMaterials }),
    );
  }, [cachedMaterials, treeQuery.data]);

  const persistMaterials = useCallback(
    (tree: CatalogTreeResponse | null, materials: Material[]) => {
      if (!tree) return;
      void AsyncStorage.setItem(
        STORAGE_KEYS.catalog,
        JSON.stringify({ tree, materials }),
      );
    },
    [],
  );
  const rememberMaterials = useCallback(
    (materials: Material[]) => {
      setCachedMaterials((current) => {
        const next = mergeMaterials(current, materials);
        persistMaterials(treeQuery.data ?? cachedTree, next);
        return next;
      });
    },
    [cachedTree, persistMaterials, treeQuery.data],
  );

  useEffect(() => {
    if (firstMaterialsQuery.data?.materials) {
      rememberMaterials(firstMaterialsQuery.data.materials);
    }
  }, [firstMaterialsQuery.data, rememberMaterials]);

  const demoTree = useMemo(() => treeFromCatalog(DEMO_CATALOG), []);
  const selectedTree = treeQuery.data ?? cachedTree ?? demoTree;
  const catalog: AppCatalog = {
    ...selectedTree,
    materials:
      treeQuery.data || cachedTree
        ? mergeMaterials(
            cachedMaterials,
            firstMaterialsQuery.data?.materials ?? [],
          )
        : DEMO_CATALOG.materials,
  };
  const source: CatalogSource = treeQuery.data
    ? "server"
    : cachedTree
      ? "cache"
      : "demo";
  const savePreference = useCallback(
    async (next: UserStudyPreference) => {
      setPreference(next);
      await AsyncStorage.setItem(STORAGE_KEYS.preference, JSON.stringify(next));
    },
    [],
  );

  const isSaved = useCallback(
    (id: number) => savedIds.includes(id),
    [savedIds],
  );

  const toggleSaved = useCallback(async (id: number) => {
    setSavedIds((current) => {
      const next = current.includes(id)
        ? current.filter((savedId) => savedId !== id)
        : [id, ...current];
      void AsyncStorage.setItem(STORAGE_KEYS.bookmarks, JSON.stringify(next));
      return next;
    });
  }, []);

  const recordRecent = useCallback((id: number) => {
    setRecentIds((current) => {
      const next = [id, ...current.filter((recentId) => recentId !== id)].slice(
        0,
        8,
      );
      void AsyncStorage.setItem(STORAGE_KEYS.recents, JSON.stringify(next));
      return next;
    });
  }, []);

  const downloadMaterial = useCallback(
    async (material: Material) => {
      if (!material.documentUrl) {
        throw new Error("لا يوجد ملف متاح لهذا المورد.");
      }
      if (!material.documentUrl.startsWith("https://")) {
        throw new Error("رابط المستند غير آمن.");
      }
      if (Platform.OS === "web") {
        throw new Error("تنزيل الملفات متاح من تطبيق الهاتف.");
      }
      const directory = FileSystem.documentDirectory;
      if (!directory) {
        throw new Error("مساحة التخزين المحلية غير متاحة.");
      }

      const fileName = fileNameFor(material);
      const localUri = `${directory}${fileName}`;
      const alreadyDownloaded = downloads.find(
        (record) => record.materialId === material.id,
      );
      if (alreadyDownloaded) {
        const info = await FileSystem.getInfoAsync(alreadyDownloaded.localUri);
        if (info.exists) return;
        await removeDownload(alreadyDownloaded);
      }

      const result = await FileSystem.downloadAsync(
        material.documentUrl,
        localUri,
      );
      if (result.status < 200 || result.status >= 300) {
        await FileSystem.deleteAsync(result.uri, { idempotent: true });
        throw new Error("لم يكتمل التنزيل. تحقق من الاتصال وحاول مرة أخرى.");
      }

      const pdfHeader = await FileSystem.readAsStringAsync(result.uri, {
        encoding: FileSystem.EncodingType.Base64,
        position: 0,
        length: 8,
      });
      if (!pdfHeader.startsWith("JVBERi0")) {
        await FileSystem.deleteAsync(result.uri, { idempotent: true });
        throw new Error("الرابط لم يُرجع ملف PDF صالحاً.");
      }

      // Best-effort: counts toward the contributor's download stats/title
      // and the leaderboard. Never blocks or fails the download itself —
      // demo materials (negative ids) have no backend row to record against.
      if (material.id > 0) {
        void (async () => {
          try {
            const deviceId = await getAnonymousDeviceId();
            await recordMaterialDownload(material.id, {
              headers: { "X-Device-Id": deviceId },
            });
          } catch {
            // Non-critical — the local download already succeeded.
          }
        })();
      }

      const info = await FileSystem.getInfoAsync(result.uri);
      const record: DownloadRecord = {
        materialId: material.id,
        titleAr: material.titleAr,
        fileName,
        localUri: result.uri,
        downloadedAt: new Date().toISOString(),
        fileSizeBytes:
          info.exists && "size" in info && typeof info.size === "number"
            ? info.size
            : material.fileSizeBytes,
      };
      setDownloads((current) => {
        const next = [
          record,
          ...current.filter((item) => item.materialId !== material.id),
        ];
        void AsyncStorage.setItem(STORAGE_KEYS.downloads, JSON.stringify(next));
        return next;
      });
    },
    [downloads],
  );

  const removeDownload = useCallback(async (record: DownloadRecord) => {
    try {
      await FileSystem.deleteAsync(record.localUri, { idempotent: true });
    } catch {
      // The list entry should still be removable if the file was already lost.
    }
    setDownloads((current) => {
      const next = current.filter(
        (item) => item.materialId !== record.materialId,
      );
      void AsyncStorage.setItem(STORAGE_KEYS.downloads, JSON.stringify(next));
      return next;
    });
  }, []);

  const openDownloaded = useCallback(async (record: DownloadRecord) => {
    const info = await FileSystem.getInfoAsync(record.localUri);
    if (!info.exists) {
      throw new Error("الملف غير موجود على هذا الجهاز. احذفه وأعد تنزيله.");
    }
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error("لا يتوفر عارض أو تطبيق مشاركة لهذا الملف.");
    }
    await Sharing.shareAsync(record.localUri, {
      mimeType: "application/pdf",
      dialogTitle: record.titleAr,
      UTI: "com.adobe.pdf",
    });
  }, []);

  const refreshCatalog = useCallback(async () => {
    await Promise.all([treeQuery.refetch(), firstMaterialsQuery.refetch()]);
  }, [firstMaterialsQuery.refetch, treeQuery.refetch]);

  const value = useMemo<LibraryContextValue>(
    () => ({
      catalog,
      source,
      isRefreshing: treeQuery.isFetching || firstMaterialsQuery.isFetching,
      isOffline: treeQuery.isError && !treeQuery.data,
      refreshCatalog,
      preference,
      isPreferenceLoaded,
      savePreference,
      rememberMaterials,
      savedIds,
      recentIds,
      downloads,
      isSaved,
      toggleSaved,
      recordRecent,
      downloadMaterial,
      openDownloaded,
      removeDownload,
    }),
    [
      catalog,
      source,
      treeQuery.isFetching,
      treeQuery.isError,
      treeQuery.data,
      firstMaterialsQuery.isFetching,
      refreshCatalog,
      preference,
      isPreferenceLoaded,
      savePreference,
      rememberMaterials,
      savedIds,
      recentIds,
      downloads,
      isSaved,
      toggleSaved,
      recordRecent,
      downloadMaterial,
      openDownloaded,
      removeDownload,
    ],
  );

  return (
    <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>
  );
}

export function useLibrary(): LibraryContextValue {
  const context = useContext(LibraryContext);
  if (!context) {
    throw new Error("useLibrary must be used inside LibraryProvider");
  }
  return context;
}
