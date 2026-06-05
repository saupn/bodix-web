import type { SupabaseClient } from '@supabase/supabase-js';

export type ExerciseTranslationMap = Map<string, string>;

export async function loadExerciseTranslations(
  supabase: SupabaseClient,
): Promise<ExerciseTranslationMap> {
  const { data } = await supabase
    .from('exercise_translations')
    .select('name_en, name_vi');

  const map: ExerciseTranslationMap = new Map();
  for (const row of (data ?? []) as Array<{ name_en: string; name_vi: string | null }>) {
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
