import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

/**
 * Verifies the current user is admin. Use in API routes.
 * Returns { user, profile } if admin, else returns NextResponse with 403.
 */
export async function verifyAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 }) };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "admin") {
    return { error: NextResponse.json({ error: "Không có quyền truy cập." }, { status: 403 }) };
  }

  return { user, profile };
}
