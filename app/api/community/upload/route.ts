import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;
const SIGNED_URL_TTL = 3600;

function fileExtension(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  return "jpg";
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data." }, { status: 400 });
  }

  const file = formData.get("file");
  const index = formData.get("index") as string | null;

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Thiếu file." }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: "File phải là JPEG, PNG hoặc WebP." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File không được vượt quá 5 MB." }, { status: 400 });
  }

  const timestamp = Date.now();
  const ext = fileExtension(file.type);
  const idx = index ?? "0";
  const storagePath = `${user.id}/community/${timestamp}_${idx}.${ext}`;

  const service = createServiceClient();
  const buffer = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await service.storage
    .from("progress-photos")
    .upload(storagePath, buffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    console.error("[community/upload]", uploadError);
    return NextResponse.json({ error: "Không thể upload ảnh." }, { status: 500 });
  }

  const { data: signed } = await service.storage
    .from("progress-photos")
    .createSignedUrl(storagePath, SIGNED_URL_TTL);

  return NextResponse.json({
    path: storagePath,
    signed_url: signed?.signedUrl ?? null,
  });
}
