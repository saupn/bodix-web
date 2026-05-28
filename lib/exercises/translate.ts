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
