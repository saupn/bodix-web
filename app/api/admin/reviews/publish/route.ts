import { NextRequest, NextResponse } from "next/server";
import { verifyAdmin } from "@/lib/admin/verify-admin";
import { createServiceClient } from "@/lib/supabase/service";
import { sendMessage } from "@/lib/messaging";

// POST: Xuất bản video review + gửi cho cohort
export async function POST(request: NextRequest) {
  const admin = await verifyAdmin();
  if ("error" in admin) return admin.error;

  const body = await request.json();
  const { review_video_id } = body;

  if (!review_video_id) {
    return NextResponse.json({ error: "Missing review_video_id" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // 1. Lấy video info
  const { data: video, error: videoError } = await supabase
    .from("review_videos")
    .select("*")
    .eq("id", review_video_id)
    .single();

  if (videoError || !video) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  // 2. Publish video
  await supabase
    .from("review_videos")
    .update({ status: "published", published_at: new Date().toISOString() })
    .eq("id", review_video_id);

  // 3. Lấy tất cả enrollments active trong cohort
  const { data: enrollments, error: enrollError } = await supabase
    .from("enrollments")
    .select("id, user_id, current_day, profiles!user_id(full_name, channel_user_id, preferred_channel)")
    .eq("cohort_id", video.cohort_id)
    .in("status", ["active", "trial"]);

  if (enrollError || !enrollments || enrollments.length === 0) {
    return NextResponse.json({ error: "No active enrollments in cohort" }, { status: 404 });
  }

  const weekNumber = video.week_number;
  const dayStart = (weekNumber - 1) * 7 + 1;
  const dayEnd = weekNumber * 7;
  let sentCount = 0;
  let errorCount = 0;

  for (const enrollment of enrollments) {
    try {
      // 4. Tính data cá nhân từ daily_checkins tuần đó
      const { data: checkins } = await supabase
        .from("daily_checkins")
        .select("mode")
        .eq("enrollment_id", enrollment.id)
        .gte("day_number", dayStart)
        .lte("day_number", dayEnd);

      const stats = {
        completed: checkins?.length || 0,
        hard: checkins?.filter((c) => c.mode === "hard").length || 0,
        light: checkins?.filter((c) => c.mode === "light").length || 0,
        easy: checkins?.filter((c) => c.mode === "easy").length || 0,
      };

      // 5. Tính streak hiện tại
      const { data: streakData } = await supabase
        .from("streaks")
        .select("current_streak")
        .eq("enrollment_id", enrollment.id)
        .single();

      const currentStreak = streakData?.current_streak || 0;

      // 6. So sánh tuần trước (nếu >= tuần 2)
      let prevCompleted: number | null = null;
      if (weekNumber >= 2) {
        const prevDayStart = (weekNumber - 2) * 7 + 1;
        const prevDayEnd = (weekNumber - 1) * 7;
        const { data: prevCheckins } = await supabase
          .from("daily_checkins")
          .select("id")
          .eq("enrollment_id", enrollment.id)
          .gte("day_number", prevDayStart)
          .lte("day_number", prevDayEnd);
        prevCompleted = prevCheckins?.length || 0;
      }

      // 7. Lưu weekly_reviews
      await supabase.from("weekly_reviews").upsert(
        {
          enrollment_id: enrollment.id,
          user_id: enrollment.user_id,
          week_number: weekNumber,
          week_hard_count: stats.hard,
          week_light_count: stats.light,
          week_easy_count: stats.easy,
          week_completion_rate: stats.completed / 5,
          current_streak: currentStreak,
          review_video_id: review_video_id,
        },
        { onConflict: "enrollment_id,week_number" }
      );

      // 8. Soạn tin nhắn cá nhân hóa
      const profile = enrollment.profiles as unknown as {
        full_name: string;
        channel_user_id: string;
        preferred_channel: string;
      };

      if (!profile?.channel_user_id) continue;

      const displayName = profile.full_name || "Bạn";
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bodix.fit";
      const reviewPageUrl = `${appUrl}/app/review/video/${review_video_id}`;

      // Tin nhắn động theo kết quả
      let dynamicMsg = "";
      if (stats.completed === 5 && stats.hard === 5) {
        dynamicMsg = "Tuần hoàn hảo! Bạn thuộc nhóm rất ít người làm được điều này.";
      } else if (stats.completed === 5) {
        dynamicMsg = "5/5 – bạn không bỏ buổi nào. Đó là kỷ luật thật sự.";
      } else if (stats.completed === 4) {
        dynamicMsg = "4/5 – gần hoàn hảo! 1 buổi thiếu không làm mất đi 4 buổi bạn đã làm.";
      } else if (stats.completed === 3) {
        dynamicMsg = "3/5 – quá nửa rồi. Tuần tới thử thêm 1 buổi nhé?";
      } else if (stats.completed >= 1) {
        dynamicMsg = "Tuần này khó khăn – nhưng bạn vẫn ở đây. Đó đã là khác biệt.";
      } else {
        dynamicMsg = "Tuần này bạn nghỉ ngơi. Không sao – tuần tới là cơ hội mới.";
      }

      // Bonus messages
      if (stats.easy > 0) {
        dynamicMsg += "\nViệc chọn 1 lượt những ngày khó – đó là thông minh, không phải yếu đuối.";
      }
      if (currentStreak >= 14) {
        dynamicMsg += `\nStreak ${currentStreak} ngày! Cơ thể bạn đang thay đổi từ bên trong.`;
      } else if (currentStreak >= 7) {
        dynamicMsg += `\nStreak ${currentStreak} ngày! Bạn đang xây dựng thói quen thật sự.`;
      }

      // So sánh tuần trước
      let compareMsg = "";
      if (prevCompleted !== null) {
        compareMsg = `\nSo với tuần trước: ${prevCompleted} → ${stats.completed} buổi`;
      }

      const messageText =
        `Chào ${displayName}! REVIEW TUẦN ${weekNumber}\n\n` +
        `Video review tuần này:\n${reviewPageUrl}\n\n` +
        `Kết quả tuần này của bạn:\n` +
        `- Hoàn thành: ${stats.completed}/5 buổi tập\n` +
        `- 3 lượt: ${stats.hard} buổi\n` +
        `- 2 lượt: ${stats.light} buổi\n` +
        `- 1 lượt: ${stats.easy} buổi\n` +
        `- Streak: ${currentStreak} ngày liên tiếp\n` +
        compareMsg +
        `\n${dynamicMsg}\n\n` +
        `Cho mình biết cảm nhận tuần này nhé:\n` +
        `Reply số: 5=Rất tốt 4=Tốt 3=Bình thường 2=Hơi mệt 1=Rất mệt`;

      await sendMessage({
        userId: enrollment.user_id,
        channel: (profile.preferred_channel as "zalo") || "zalo",
        channelUserId: profile.channel_user_id,
        text: messageText,
      });

      sentCount++;
    } catch (err) {
      console.error(`[publish] Error sending to user ${enrollment.user_id}:`, err);
      errorCount++;
    }
  }

  // Update video status to 'sent'
  await supabase
    .from("review_videos")
    .update({ status: "sent" })
    .eq("id", review_video_id);

  // Mark answered_in_video questions
  await supabase
    .from("user_questions")
    .update({ status: "answered_in_video" })
    .eq("cohort_id", video.cohort_id)
    .eq("week_number", weekNumber)
    .eq("status", "reviewed");

  return NextResponse.json({ ok: true, sent: sentCount, errors: errorCount });
}
