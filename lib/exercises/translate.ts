import type { SupabaseClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/service';

export type ExerciseTranslationMap = Map<string, string>;

export async function loadExerciseTranslations(
  supabase: SupabaseClient,
): Promise<ExerciseTranslationMap> {
  const { data } = await supabase
    .from('exercise_translations')
    .select('name_en, name_vi');
  return buildTranslationMap(
    (data ?? []) as Array<{ name_en: string; name_vi: string | null }>,
  );
}

function buildTranslationMap(
  rows: Array<{ name_en: string; name_vi: string | null }>,
): ExerciseTranslationMap {
  const map: ExerciseTranslationMap = new Map();
  for (const row of rows) {
    // Edge case: nếu name_vi trùng name_en (case-insensitive) → chỉ hiển thị
    // 1 lần, tránh ngoặc thừa như "Burpee nhẹ (Burpee nhẹ)".
    const hasVi = !!row.name_vi;
    const viDiffersFromEn =
      hasVi && row.name_vi!.toLowerCase().trim() !== row.name_en.toLowerCase().trim();
    const display = viDiffersFromEn
      ? `${row.name_vi} (${row.name_en})`
      : (row.name_vi ?? row.name_en);
    map.set(row.name_en.toLowerCase().trim(), display);
  }
  return map;
}

export function translateExerciseName(
  nameEn: string,
  translationMap: ExerciseTranslationMap,
): string {
  const key = nameEn.toLowerCase().trim();
  return translationMap.get(key) ?? nameEn;
}

/**
 * Dịch tại chỗ tên bài trong workout_templates.exercises.items sang
 * "Tiếng Việt (English)". Mutate object để API trả thẳng tên đã dịch — trang
 * phiên tập chỉ render `item.name`. Bài chưa có name_vi → giữ tiếng Anh.
 */
export async function translateWorkoutItems(
  supabase: SupabaseClient,
  exercises: { items?: Array<{ name: string }> } | null | undefined,
): Promise<void> {
  if (!exercises?.items?.length) return;
  const map = await loadExerciseTranslations(supabase);
  exercises.items = exercises.items.map((it) => ({
    ...it,
    name: translateExerciseName(it.name, map),
  }));
}

// ---------------------------------------------------------------------------
// Bản cache: bảng dịch giống nhau cho mọi người và hiếm khi đổi → lưu trong
// Next data cache 10 phút thay vì tải nguyên bảng ở MỖI lần mở buổi tập.
// Chỉ chứa tên bài tập (dữ liệu công khai), không có gì riêng của user.
// ---------------------------------------------------------------------------

const getTranslationRows = unstable_cache(
  async () => {
    const { data } = await createServiceClient()
      .from('exercise_translations')
      .select('name_en, name_vi');
    return (data ?? []) as Array<{ name_en: string; name_vi: string | null }>;
  },
  ['exercise-translations-v1'],
  { revalidate: 600, tags: ['exercise-translations'] },
);

export async function getCachedExerciseTranslationMap(): Promise<ExerciseTranslationMap> {
  return buildTranslationMap(await getTranslationRows());
}

/** Như translateWorkoutItems nhưng dùng map đã có (để tải map song song). */
export function applyWorkoutTranslations(
  exercises: { items?: Array<{ name: string }> } | null | undefined,
  map: ExerciseTranslationMap,
): void {
  if (!exercises?.items?.length) return;
  exercises.items = exercises.items.map((it) => ({
    ...it,
    name: translateExerciseName(it.name, map),
  }));
}
