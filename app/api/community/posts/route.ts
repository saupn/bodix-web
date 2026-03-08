import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

function truncate(str: string | null | undefined, maxLen: number): string {
  if (!str?.trim()) return "";
  const s = str.trim();
  return s.length <= maxLen ? s : s.slice(0, maxLen - 3) + "...";
}

const PAGE_SIZE = 20;
const SIGNED_URL_TTL = 3600;

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  }

  const cohortId = request.nextUrl.searchParams.get("cohort_id");
  const page = Math.max(0, parseInt(request.nextUrl.searchParams.get("page") ?? "0", 10));

  if (!cohortId) {
    return NextResponse.json({ error: "Thiếu cohort_id." }, { status: 400 });
  }

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("cohort_id", cohortId)
    .in("status", ["active", "completed"])
    .maybeSingle();

  if (!enrollment) {
    return NextResponse.json({ error: "Bạn không thuộc cohort này." }, { status: 403 });
  }

  const { data: posts, error } = await supabase
    .from("community_posts")
    .select("id, user_id, post_type, content, media_urls, milestone_type, created_at")
    .eq("cohort_id", cohortId)
    .eq("is_hidden", false)
    .order("created_at", { ascending: false })
    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

  if (error) {
    console.error("[community/posts] GET:", error);
    return NextResponse.json({ error: "Lỗi truy vấn." }, { status: 500 });
  }

  const postList = posts ?? [];
  const userIds = [...new Set(postList.map((p) => p.user_id))];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", userIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]));

  const postIds = postList.map((p) => p.id);
  const service = createServiceClient();

  const { data: reactions } = await service
    .from("community_reactions")
    .select("post_id, user_id, reaction_type")
    .in("post_id", postIds);

  const reactionCounts = new Map<string, Record<string, number>>();
  const myReactions = new Map<string, string>();
  for (const r of reactions ?? []) {
    const key = r.post_id;
    if (!reactionCounts.has(key)) reactionCounts.set(key, { heart: 0, clap: 0, fire: 0, like: 0 });
    const counts = reactionCounts.get(key)!;
    const t = r.reaction_type as "heart" | "clap" | "fire" | "like";
    if (t in counts) counts[t]++;
    if (r.user_id === user.id) myReactions.set(key, r.reaction_type);
  }

  const rows = await Promise.all(
    postList.map(async (p) => {
      const profile = profileMap.get(p.user_id);
      const name = profile?.full_name?.trim() ?? "Ẩn danh";
      const parts = name.split(/\s+/);
      const displayName =
        parts.length >= 2
          ? `${parts[0]} ${parts[parts.length - 1][0]}.`
          : name;

      const mediaPaths = (p.media_urls ?? []) as string[];
      const signedMedia: string[] = [];
      for (const path of mediaPaths) {
        const { data } = await service.storage
          .from("progress-photos")
          .createSignedUrl(path, SIGNED_URL_TTL);
        if (data?.signedUrl) signedMedia.push(data.signedUrl);
      }

    return {
      id: p.id,
      user_id: p.user_id,
      display_name: displayName,
      avatar_url: profile?.avatar_url ?? null,
      post_type: p.post_type,
      content: p.content,
      media_urls: signedMedia,
      milestone_type: p.milestone_type,
      created_at: p.created_at,
      reaction_counts: reactionCounts.get(p.id) ?? { heart: 0, clap: 0, fire: 0, like: 0 },
      my_reaction: myReactions.get(p.id) ?? null,
    };
    })
  );

  return NextResponse.json({
    posts: rows,
    has_more: postList.length === PAGE_SIZE,
    page,
  });
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

  let body: {
    cohort_id: string;
    post_type: string;
    content?: string;
    media_urls?: string[];
    milestone_type?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const { cohort_id, post_type, content, media_urls } = body;

  if (!cohort_id || !post_type) {
    return NextResponse.json({ error: "Thiếu cohort_id hoặc post_type." }, { status: 400 });
  }

  const validTypes = [
    "completion_share",
    "milestone_share",
    "progress_photo",
    "motivation",
    "question",
    "program_complete",
  ];
  if (!validTypes.includes(post_type)) {
    return NextResponse.json({ error: "post_type không hợp lệ." }, { status: 400 });
  }

  const { data: enrollment } = await supabase
    .from("enrollments")
    .select("id")
    .eq("user_id", user.id)
    .eq("cohort_id", cohort_id)
    .in("status", ["active", "completed"])
    .maybeSingle();

  if (!enrollment) {
    return NextResponse.json({ error: "Bạn không thuộc cohort này." }, { status: 403 });
  }

  const urls = Array.isArray(media_urls) ? media_urls.slice(0, 3) : [];

  const { data: post, error } = await supabase
    .from("community_posts")
    .insert({
      user_id: user.id,
      cohort_id,
      post_type,
      content: content?.trim() ?? null,
      media_urls: urls.length > 0 ? urls : null,
      milestone_type: body.milestone_type ?? null,
    })
    .select()
    .single();

  if (error) {
    console.error("[community/posts] POST:", error);
    return NextResponse.json({ error: "Không thể tạo bài viết." }, { status: 500 });
  }

  // ── Notify cohort members (except poster) ─────────────────────────────────
  const { data: posterProfile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();
  const displayName = posterProfile?.full_name?.trim() || "Một thành viên";
  const preview = truncate(content, 60);

  const { data: cohortMembers } = await supabase
    .from("enrollments")
    .select("user_id")
    .eq("cohort_id", cohort_id)
    .in("status", ["active", "completed"])
    .neq("user_id", user.id);

  if (cohortMembers?.length) {
    const service = createServiceClient();
    const notifications = cohortMembers.map((m) => ({
      user_id: m.user_id,
      type: "community_post",
      channel: "in_app",
      title: `${displayName} vừa chia sẻ`,
      content: preview ? `: ${preview}` : "",
      metadata: { action_url: "/app/community?tab=feed", post_id: post.id },
    }));
    await service.from("notifications").insert(notifications);
  }

  return NextResponse.json({ post });
}
