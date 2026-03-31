import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ verified: false }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("phone_verified")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[check-phone-verified]", error);
    return NextResponse.json({ verified: false }, { status: 500 });
  }

  return NextResponse.json({ verified: data?.phone_verified === true });
}
