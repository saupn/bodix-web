import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

const STORAGE_BUCKET = "guides";
const STORAGE_PATH = "bodix-fuel-guide.pdf";
const FALLBACK_URL = "/guides/bodix-fuel-guide.pdf";
const SIGNED_URL_TTL_SECONDS = 3600;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  const service = createServiceClient();
  const { data: signed, error } = await service.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(STORAGE_PATH, SIGNED_URL_TTL_SECONDS);

  if (error || !signed?.signedUrl) {
    return NextResponse.redirect(new URL(FALLBACK_URL, process.env.NEXT_PUBLIC_APP_URL || "https://bodix.fit"));
  }

  return NextResponse.redirect(signed.signedUrl);
}
