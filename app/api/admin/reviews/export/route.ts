import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createServiceClient } from "@/lib/supabase/service";

// GET: Export nội dung review cho dựng video
export async function GET(request: NextRequest) {
  const admin = await verifyAdmin();
  if ("error" in admin) return admin.error;

  const { searchParams } = new URL(request.url);
  const cohortId = searchParams.get("cohort_id");
  const week = searchParams.get("week");

  if (!cohortId || !week) {
    return NextResponse.json(
      { error: "Missing cohort_id or week" },
      { status: 400 }
    );
  }

  const weekNumber = parseInt(week);
  const supabase = createServiceClient();

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. Lấy thông tin cohort
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const { data: cohort } = await supabase
    .from("cohorts")
    .select("id, start_date, end_date, status, programs(name, slug)")
    .eq("id", cohortId)
    .single();

  if (!cohort) {
    return NextResponse.json({ error: "Cohort not found" }, { status: 404 });
  }

  const cohortName =
    (cohort.programs as unknown as { name: string })?.name || "Cohort";

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. Lấy enrollments active trong cohort
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const { data: enrollments } = await supabase
    .from("enrollments")
    .select("id, user_id, profiles!user_id(full_name)")
    .eq("cohort_id", cohortId)
    .in("status", ["active", "trial"]);

  const totalMembers = enrollments?.length || 0;

  if (totalMembers === 0) {
    return NextResponse.json({
      stats: {
        cohort_name: cohortName,
        week_number: weekNumber,
        total_members: 0,
        completed_5: 0,
        completed_3_4: 0,
        completed_1_2: 0,
        completed_0: 0,
        pct_5: 0,
        pct_3_4: 0,
        pct_1_2: 0,
        pct_0: 0,
        hard_rate: 0,
        light_rate: 0,
        easy_rate: 0,
        avg_streak: 0,
        max_streak: 0,
        max_streak_user: "",
      },
      questions: [],
      script_suggestion: "",
      media: [],
    });
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. Lấy daily_checkins tuần đó cho tất cả enrollments
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const dayStart = (weekNumber - 1) * 7 + 1;
  const dayEnd = weekNumber * 7;
  const enrollmentIds = enrollments!.map((e) => e.id);

  const { data: checkins } = await supabase
    .from("daily_checkins")
    .select("enrollment_id, mode")
    .in("enrollment_id", enrollmentIds)
    .gte("day_number", dayStart)
    .lte("day_number", dayEnd);

  // Group checkins by enrollment
  const checkinsByEnrollment = new Map<
    string,
    { total: number; hard: number; light: number; easy: number }
  >();
  for (const c of checkins || []) {
    const existing = checkinsByEnrollment.get(c.enrollment_id) || {
      total: 0,
      hard: 0,
      light: 0,
      easy: 0,
    };
    existing.total++;
    if (c.mode === "hard") existing.hard++;
    else if (c.mode === "light") existing.light++;
    else if (c.mode === "easy") existing.easy++;
    checkinsByEnrollment.set(c.enrollment_id, existing);
  }

  // Tính stats
  let completed5 = 0;
  let completed3_4 = 0;
  let completed1_2 = 0;
  let completed0 = 0;
  let totalHard = 0;
  let totalLight = 0;
  let totalEasy = 0;
  let totalCheckins = 0;

  for (const enrollment of enrollments!) {
    const data = checkinsByEnrollment.get(enrollment.id);
    const count = data?.total || 0;
    if (count >= 5) completed5++;
    else if (count >= 3) completed3_4++;
    else if (count >= 1) completed1_2++;
    else completed0++;

    totalHard += data?.hard || 0;
    totalLight += data?.light || 0;
    totalEasy += data?.easy || 0;
    totalCheckins += count;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. Lấy streak data
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const { data: streaks } = await supabase
    .from("streaks")
    .select("enrollment_id, current_streak")
    .in("enrollment_id", enrollmentIds);

  let totalStreak = 0;
  let maxStreak = 0;
  let maxStreakEnrollmentId = "";

  for (const s of streaks || []) {
    totalStreak += s.current_streak;
    if (s.current_streak > maxStreak) {
      maxStreak = s.current_streak;
      maxStreakEnrollmentId = s.enrollment_id;
    }
  }

  const avgStreak =
    streaks && streaks.length > 0
      ? Math.round((totalStreak / streaks.length) * 10) / 10
      : 0;

  // Tìm tên user có streak cao nhất
  let maxStreakUser = "";
  if (maxStreakEnrollmentId) {
    const e = enrollments!.find((e) => e.id === maxStreakEnrollmentId);
    maxStreakUser =
      (e?.profiles as unknown as { full_name: string })?.full_name || "";
  }

  const pct = (n: number) =>
    totalMembers > 0 ? Math.round((n / totalMembers) * 100) : 0;

  const hardRate =
    totalCheckins > 0 ? Math.round((totalHard / totalCheckins) * 100) : 0;
  const lightRate =
    totalCheckins > 0 ? Math.round((totalLight / totalCheckins) * 100) : 0;
  const easyRate =
    totalCheckins > 0 ? Math.round((totalEasy / totalCheckins) * 100) : 0;

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 5. Lấy câu hỏi
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const { data: questions } = await supabase
    .from("user_questions")
    .select("*, profiles!user_id(full_name)")
    .eq("cohort_id", cohortId)
    .eq("week_number", weekNumber)
    .order("category")
    .order("created_at");

  const formattedQuestions = (questions || []).map((q) => ({
    id: q.id,
    category: q.category,
    content: q.content,
    user_name:
      (q.profiles as unknown as { full_name: string })?.full_name || "User",
    message_type: q.message_type,
    media_url: q.media_url,
  }));

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 6. Lấy media từ user_questions
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const mediaQuestions = (questions || []).filter(
    (q) =>
      q.media_url &&
      (q.message_type === "image" || q.message_type === "video")
  );

  const media = mediaQuestions.map((q) => ({
    url: q.media_url as string,
    type: q.message_type as "image" | "video",
    user_name:
      (q.profiles as unknown as { full_name: string })?.full_name || "User",
  }));

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 7. Tạo script gợi ý
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const scriptSuggestion = generateScript({
    cohortName,
    weekNumber,
    totalMembers,
    completed5,
    completed3_4,
    pct5: pct(completed5),
    avgStreak,
    maxStreak,
    maxStreakUser,
    questions: formattedQuestions,
  });

  return NextResponse.json({
    stats: {
      cohort_name: cohortName,
      week_number: weekNumber,
      total_members: totalMembers,
      completed_5: completed5,
      completed_3_4: completed3_4,
      completed_1_2: completed1_2,
      completed_0: completed0,
      pct_5: pct(completed5),
      pct_3_4: pct(completed3_4),
      pct_1_2: pct(completed1_2),
      pct_0: pct(completed0),
      hard_rate: hardRate,
      light_rate: lightRate,
      easy_rate: easyRate,
      avg_streak: avgStreak,
      max_streak: maxStreak,
      max_streak_user: maxStreakUser,
    },
    questions: formattedQuestions,
    script_suggestion: scriptSuggestion,
    media,
  });
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// Script generator
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
interface ScriptInput {
  cohortName: string;
  weekNumber: number;
  totalMembers: number;
  completed5: number;
  completed3_4: number;
  pct5: number;
  avgStreak: number;
  maxStreak: number;
  maxStreakUser: string;
  questions: { category: string; content: string | null; user_name: string }[];
}

function generateScript(input: ScriptInput): string {
  const {
    cohortName,
    weekNumber,
    totalMembers,
    completed5,
    pct5,
    avgStreak,
    maxStreak,
    maxStreakUser,
    questions,
  } = input;

  const lines: string[] = [];

  // PHẦN 1 — MỞ ĐẦU
  lines.push("PHẦN 1 — MỞ ĐẦU (~30 giây)");
  lines.push(
    `"Chào mừng các bạn đến với Review Tuần ${weekNumber} của ${cohortName}."`
  );

  let completionComment = "";
  if (pct5 >= 80) {
    completionComment = "Một tuần tuyệt vời!";
  } else if (pct5 >= 50) {
    completionComment = "Đa số các bạn đã hoàn thành rất tốt.";
  } else if (pct5 >= 30) {
    completionComment = "Có tiến bộ — nhưng chúng ta có thể làm tốt hơn.";
  } else {
    completionComment =
      "Tuần này hơi khó khăn — nhưng quan trọng là các bạn vẫn ở đây.";
  }

  lines.push(
    `"Tuần này, ${pct5}% thành viên đã hoàn thành đủ 5 buổi tập — ${completionComment}"`
  );

  if (maxStreak >= 7 && maxStreakUser) {
    lines.push(
      `"Streak cao nhất tuần này là ${maxStreak} ngày từ ${maxStreakUser} — xin chúc mừng!"`
    );
  }
  lines.push("");

  // PHẦN 2 — GIẢI ĐÁP CÂU HỎI
  const categoryMap: Record<string, string> = {
    form_check: "Form / Tư thế",
    pain_injury: "Đau / Chấn thương",
    nutrition: "Dinh dưỡng",
    motivation: "Động lực",
    schedule: "Lịch tập",
    other: "Khác",
  };

  const questionsByCategory = new Map<string, typeof questions>();
  for (const q of questions) {
    if (!q.content) continue;
    const cat = q.category || "other";
    const existing = questionsByCategory.get(cat) || [];
    existing.push(q);
    questionsByCategory.set(cat, existing);
  }

  if (questionsByCategory.size > 0) {
    lines.push("PHẦN 2 — GIẢI ĐÁP CÂU HỎI (~3-5 phút)");

    const categoryOrder = [
      "form_check",
      "pain_injury",
      "nutrition",
      "motivation",
      "schedule",
      "other",
    ];

    for (const cat of categoryOrder) {
      const catQuestions = questionsByCategory.get(cat);
      if (!catQuestions || catQuestions.length === 0) continue;

      const catLabel = categoryMap[cat] || cat;

      if (cat === "form_check") {
        lines.push(
          `\n[${catLabel}] "Một số bạn hỏi về tư thế tập. Mình sẽ giải đáp..."`
        );
      } else if (cat === "pain_injury") {
        lines.push(`\n[${catLabel}] "Về vấn đề đau nhức..."`);
      } else if (cat === "nutrition") {
        lines.push(`\n[${catLabel}] "Về dinh dưỡng..."`);
      } else if (cat === "motivation") {
        lines.push(
          `\n[${catLabel}] "Một số bạn chia sẻ rằng tuần này hơi khó khăn..."`
        );
      } else if (cat === "schedule") {
        lines.push(
          `\n[${catLabel}] "Về việc sắp xếp lịch tập..."`
        );
      } else {
        lines.push(`\n[${catLabel}]`);
      }

      for (const q of catQuestions) {
        lines.push(`  - "${q.content}" — ${q.user_name}`);
        lines.push("    → [Gợi ý trả lời: ...]");
      }
    }
    lines.push("");
  } else {
    lines.push("PHẦN 2 — GIẢI ĐÁP CÂU HỎI");
    lines.push("(Không có câu hỏi tuần này — có thể bỏ qua phần này)");
    lines.push("");
  }

  // PHẦN 3 — NHẬN XÉT CHUNG
  lines.push("PHẦN 3 — NHẬN XÉT CHUNG (~1 phút)");
  if (weekNumber === 1) {
    lines.push(
      `"Tuần đầu tiên luôn là tuần quan trọng nhất. Các bạn đã bước qua rào cản lớn nhất — đó là bắt đầu."`
    );
    lines.push(
      `"Tuần tới, hãy tập trung vào việc duy trì thói quen. Không cần hoàn hảo — chỉ cần đều đặn."`
    );
  } else if (weekNumber === 2) {
    lines.push(
      `"Tuần 2 là lúc cơ thể bắt đầu quen dần. Nếu bạn thấy bớt đau cơ hơn tuần 1 — đó là dấu hiệu tốt."`
    );
    lines.push(
      `"Hãy bắt đầu chú ý đến form nhiều hơn — vì giờ cơ thể đã đủ sức để tập đúng hơn."`
    );
  } else if (weekNumber === 3) {
    lines.push(
      `"Tuần 3 — đây là thời điểm mà nhiều người bắt đầu cảm thấy 'bình thường hóa' việc tập. Đó chính là thói quen đang hình thành."`
    );
    lines.push(
      `"Streak trung bình hiện tại là ${avgStreak} ngày — với ${totalMembers} thành viên, đó là con số đáng tự hào."`
    );
  } else {
    lines.push(
      `"Chúng ta đã ở tuần ${weekNumber}. Nhìn lại chặng đường ${weekNumber} tuần, các bạn đã thay đổi rất nhiều — dù có thể chưa nhận ra."`
    );
    lines.push(
      `"Streak trung bình: ${avgStreak} ngày. ${completed5}/${totalMembers} người hoàn thành đủ 5 buổi. Đó là kỷ luật."`
    );
  }
  lines.push("");

  // PHẦN 4 — PREVIEW TUẦN TỚI
  lines.push("PHẦN 4 — PREVIEW TUẦN TỚI (~30 giây)");
  lines.push(
    `"Tuần ${weekNumber + 1}, chúng ta sẽ..."`
  );
  lines.push("[Điền nội dung tuần tới]");

  return lines.join("\n");
}
