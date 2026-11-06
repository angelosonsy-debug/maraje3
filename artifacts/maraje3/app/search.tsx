import { Feather } from "@expo/vector-icons";
import {
  getSearchCatalogQueryKey,
  useSearchCatalog,
  type SearchCatalogParams,
} from "@workspace/api-client-react";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import {
  AppScreen,
  CategoryPill,
  EmptyState,
  FilterPicker,
  InlineNotice,
  MaterialCard,
  ScreenHeading,
  SearchField,
  font,
  uiColors,
} from "@/components/library-ui";
import { ListBannerAd } from "@/components/ad-banner";
import { searchMaterials } from "@/lib/catalog";
import { useLibrary } from "@/state/library-context";
import { CATEGORY_LABELS, type CatalogFilters } from "@/types/catalog";
import { categoriesInOrder } from "@/lib/catalog";

const c = uiColors;

export default function SearchScreen() {
  const router = useRouter();
  const { catalog, source, preference } = useLibrary();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [restrictToFaculty, setRestrictToFaculty] = useState(
    Boolean(preference),
  );
  const [universityId, setUniversityId] = useState<number | undefined>(
    preference ? preference.universityId : undefined,
  );
  const [facultyId, setFacultyId] = useState<number | undefined>(
    preference ? preference.facultyId : undefined,
  );
  const [academicYearId, setAcademicYearId] = useState<number | undefined>();
  const [semesterId, setSemesterId] = useState<number | undefined>();
  const [category, setCategory] = useState<CatalogFilters["category"]>();

  const toggleRestrictToFaculty = () => {
    if (!preference) return;
    if (restrictToFaculty) {
      setRestrictToFaculty(false);
      setUniversityId(undefined);
      setFacultyId(undefined);
    } else {
      setRestrictToFaculty(true);
      setUniversityId(preference.universityId);
      setFacultyId(preference.facultyId);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query.trim()), 260);
    return () => clearTimeout(timer);
  }, [query]);

  const facultyOptions = catalog.faculties
    .filter(
      (faculty) =>
        universityId === undefined || faculty.universityId === universityId,
    )
    .map((faculty) => ({ id: faculty.id, label: faculty.nameAr }));
  const yearOptions = catalog.academicYears
    .filter(
      (year) => facultyId === undefined || year.facultyId === facultyId,
    )
    .filter((year) => {
      if (universityId === undefined || facultyId !== undefined) return true;
      return catalog.faculties.find((item) => item.id === year.facultyId)
        ?.universityId === universityId;
    })
    .map((year) => ({ id: year.id, label: year.labelAr }));
  const semesterOptions = catalog.semesters
    .filter((item) => {
      const year = catalog.academicYears.find(
        (academicYear) => academicYear.id === item.academicYearId,
      );
      if (!year) return false;
      if (academicYearId !== undefined) return year.id === academicYearId;
      if (facultyId !== undefined) return year.facultyId === facultyId;
      if (universityId !== undefined) {
        return catalog.faculties.find(
          (faculty) => faculty.id === year.facultyId,
        )?.universityId === universityId;
      }
      return true;
    })
    .map((item) => ({ id: item.id, label: item.labelAr }));

  const filters: CatalogFilters = {
    universityId,
    facultyId,
    academicYearId,
    semesterId,
    category,
  };
  const params = useMemo<SearchCatalogParams>(
    () => ({
      ...(debouncedQuery ? { q: debouncedQuery } : {}),
      ...(universityId ? { universityId } : {}),
      ...(facultyId ? { facultyId } : {}),
      ...(academicYearId ? { academicYearId } : {}),
      ...(semesterId ? { semesterId } : {}),
      ...(category ? { category } : {}),
    }),
    [
      academicYearId,
      category,
      debouncedQuery,
      facultyId,
      semesterId,
      universityId,
    ],
  );
  const shouldSearchServer =
    source === "server" &&
    Boolean(
      debouncedQuery ||
        universityId ||
        facultyId ||
        academicYearId ||
        semesterId ||
        category,
    );
  const searchQuery = useSearchCatalog(params, {
    query: {
      queryKey: getSearchCatalogQueryKey(params),
      enabled: shouldSearchServer,
      staleTime: 30_000,
    },
  });
  const localResults = searchMaterials(catalog, query, filters);
  const results = searchQuery.data
    ? searchQuery.data.materials
        .map(
          (remote) =>
            catalog.materials.find((material) => material.id === remote.id) ??
            remote,
        )
        .filter((material) => {
          return !material.isDemo || source !== "server";
        })
    : localResults;

  const clearFilters = () => {
    setRestrictToFaculty(false);
    setUniversityId(undefined);
    setFacultyId(undefined);
    setAcademicYearId(undefined);
    setSemesterId(undefined);
    setCategory(undefined);
  };

  return (
    <AppScreen>
      <ScreenHeading
        title="البحث"
        subtitle="ابحث بالعربية أو الإنجليزية"
        back={() => router.back()}
      />
      <SearchField value={query} onChangeText={setQuery} />
      {source !== "server" ? (
        <InlineNotice
          icon={source === "cache" ? "wifi-off" : "info"}
          title={
            source === "cache"
              ? "البحث في النسخة المحفوظة"
              : "البحث في بيانات التجربة"
          }
          description="تعمل التصفية والبحث على البيانات المتاحة على هذا الجهاز."
        />
      ) : null}
      {preference ? (
        <Pressable
          onPress={toggleRestrictToFaculty}
          style={[
            styles.facultyToggle,
            restrictToFaculty && styles.facultyToggleActive,
          ]}
          accessibilityRole="button"
          accessibilityLabel="تقييد نتائج البحث بكليتي"
          testID="restrict-to-faculty-toggle"
        >
          <Feather
            name={restrictToFaculty ? "check-circle" : "circle"}
            size={15}
            color={restrictToFaculty ? c.accentForeground : c.mutedForeground}
          />
          <Text
            style={[
              styles.facultyToggleText,
              restrictToFaculty && styles.facultyToggleTextActive,
            ]}
          >
            تقييد بكليتي
          </Text>
        </Pressable>
      ) : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        <FilterPicker
          label="الجامعة"
          value={universityId}
          options={catalog.universities.map((item) => ({
            id: item.id,
            label: item.nameAr,
          }))}
          onChange={(value) => {
            setRestrictToFaculty(false);
            setUniversityId(typeof value === "number" ? value : undefined);
            setFacultyId(undefined);
            setAcademicYearId(undefined);
            setSemesterId(undefined);
          }}
        />
        <FilterPicker
          label="الكلية"
          value={facultyId}
          options={facultyOptions}
          onChange={(value) => {
            setRestrictToFaculty(false);
            setFacultyId(typeof value === "number" ? value : undefined);
            setAcademicYearId(undefined);
            setSemesterId(undefined);
          }}
        />
        <FilterPicker
          label="الفرقة"
          value={academicYearId}
          options={yearOptions}
          onChange={(value) => {
            setAcademicYearId(typeof value === "number" ? value : undefined);
            setSemesterId(undefined);
          }}
        />
        <FilterPicker
          label="الفصل"
          value={semesterId}
          options={semesterOptions}
          onChange={(value) =>
            setSemesterId(typeof value === "number" ? value : undefined)
          }
        />
      </ScrollView>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categories}
      >
        {categoriesInOrder().map((item) => (
          <CategoryPill
            key={item}
            category={item}
            active={category === item}
            onPress={() => setCategory(category === item ? undefined : item)}
          />
        ))}
      </ScrollView>
      <View style={styles.resultHeading}>
        <Text style={styles.resultTitle}>
          {query.trim() ? `نتائج البحث عن «${query.trim()}»` : "كل المواد"}
        </Text>
        <Text style={styles.resultCount}>{results.length}</Text>
      </View>
      {searchQuery.isError && source === "server" ? (
        <InlineNotice
          tone="warning"
          icon="wifi-off"
          title="تعذر البحث في الكتالوج المشترك"
          description="يمكنك متابعة البحث في نسخة الكتالوج المحفوظة."
        />
      ) : null}
      {results.length === 0 ? (
        <EmptyState
          icon="search"
          title="لم نعثر على نتائج"
          description="جرّب كلمة مختلفة، أو أزل بعض خيارات التصفية."
          actionLabel="مسح التصفية"
          onAction={clearFilters}
        />
      ) : (
        <View style={styles.resultList}>
          {results.map((material) => (
            <MaterialCard
              key={material.id}
              material={material}
              context={
                catalog.subjects.find(
                  (subject) => subject.id === material.subjectId,
                )?.nameAr ?? CATEGORY_LABELS[material.category]
              }
              onPress={() =>
                router.push(`/material/${material.id}` as `/material/${string}`)
              }
            />
          ))}
        </View>
      )}
      {results.length > 0 ? <ListBannerAd /> : null}
      {searchQuery.isFetching ? (
        <View style={styles.searching}>
          <Feather name="refresh-cw" size={14} color={c.mutedForeground} />
          <Text style={styles.searchingText}>جارٍ تحديث النتائج...</Text>
        </View>
      ) : null}
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  facultyToggle: {
    flexDirection: "row",
    alignSelf: "flex-start",
    alignItems: "center",
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: c.border,
    backgroundColor: c.card,
  },
  facultyToggleActive: {
    borderColor: c.accentForeground,
    backgroundColor: c.secondary,
  },
  facultyToggleText: {
    color: c.mutedForeground,
    fontFamily: font.medium,
    fontSize: 12,
  },
  facultyToggleTextActive: {
    color: c.accentForeground,
    fontFamily: font.semibold,
  },
  filters: { gap: 7 },
  categories: { gap: 7, paddingVertical: 2 },
  resultHeading: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  resultTitle: { flex: 1, color: c.foreground, fontFamily: font.semibold, fontSize: 14, textAlign: "right" },
  resultCount: { color: c.mutedForeground, fontFamily: font.medium, fontSize: 12, minWidth: 24, textAlign: "left" },
  resultList: { gap: 9 },
  searching: { flexDirection: "row", justifyContent: "center", gap: 7, paddingVertical: 6 },
  searchingText: { color: c.mutedForeground, fontFamily: font.regular, fontSize: 11 },
});
