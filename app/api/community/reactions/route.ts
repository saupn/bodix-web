import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const VALID_TYPES = ["heart", "clap", "fire", "like"] as const;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  let body: { post_id: string; reaction_type: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { post_id, reaction_type } = body;

  if (!post_id || !reaction_type) {
    return NextResponse.json({ error: "Thiếu post_id hoặc reaction_type." }, { status: 400 });
  }

  if (!(VALID_TYPES as readonly string[]).includes(reaction_type)) {
    return NextResponse.json({ error: "reaction_type không hợp lệ." }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("community_reactions")
    .select("id, reaction_type")
    .eq("post_id", post_id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing) {
    if (existing.reaction_type === reaction_type) {
      await supabase
        .from("community_reactions")
        .delete()
        .eq("id", existing.id);
      return NextResponse.json({ action: "removed", reaction_type: null });
    }
    await supabase
      .from("community_reactions")
      .update({ reaction_type })
      .eq("id", existing.id);
    return NextResponse.json({ action: "updated", reaction_type });
  }

  await supabase.from("community_reactions").insert({
    post_id,
    user_id: user.id,
    reaction_type,
  });

  return NextResponse.json({ action: "added", reaction_type });
}
