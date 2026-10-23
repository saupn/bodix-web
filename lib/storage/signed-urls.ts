import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Ký nhiều đường dẫn trong MỘT request (createSignedUrls) thay vì mỗi ảnh
 * một request. Trả Map path → signed URL; path lỗi thì không có trong Map.
 */
export async function signStoragePaths(
  client: SupabaseClient,
  bucket: string,
  paths: string[],
  ttlSeconds: number
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;

  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrls(unique, ttlSeconds);
  if (error) {
    console.error(`[signStoragePaths] ${bucket}:`, error.message);
    return map;
  }
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) map.set(item.path, item.signedUrl);
  }
  return map;
}
