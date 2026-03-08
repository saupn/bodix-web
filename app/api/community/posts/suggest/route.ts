import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── GET — Post suggestions for the current user ──────────────────────────────
//
// Returns a list of suggestions based on:
//   1. Earned milestones not yet shared as milestone_share posts
//   2. Completed weeks not yet shared as completion_share posts
//   3. Program completion not yet shared as program_complete post

export async function GET() {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  // ── Get active/completed enrollment ──────────────────────────────────────
  const { data: enrollment, error: enrollError } = await supabase
    .from('enrollments')
    .select('id, cohort_id, current_day, status, programs(duration_days)')
    .eq('user_id', user.id)
    .in('status', ['active', 'completed'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (enrollError) {
    console.error('[community/posts/suggest] enrollment:', enrollError)
    return NextResponse.json({ error: 'Lỗi truy vấn.' }, { status: 500 })
  }

  if (!enrollment) {
    return NextResponse.json({ suggestions: [] })
  }

  // ── Parallel fetch: milestones + existing posts + weekly_reviews ──────────
  const [milestonesRes, sharedPostsRes, weeklyReviewsRes] = await Promise.all([
    supabase
      .from('completion_milestones')
      .select('milestone_type, earned_at')
      .eq('enrollment_id', enrollment.id)
      .order('earned_at', { ascending: false }),

    supabase
      .from('community_posts')
      .select('post_type, milestone_type, created_at')
      .eq('user_id', user.id)
      .eq('cohort_id', enrollment.cohort_id),

    supabase
      .from('weekly_reviews')
      .select('week_number, submitted_at')
      .eq('enrollment_id', enrollment.id)
      .order('week_number', { ascending: false }),
  ])

  const milestones = milestonesRes.data ?? []
  const sharedPosts = sharedPostsRes.data ?? []
  const weeklyReviews = weeklyReviewsRes.data ?? []

  // ── Track what's already been shared ─────────────────────────────────────
  const sharedMilestoneTypes = new Set(
    sharedPosts
      .filter(p => p.post_type === 'milestone_share' && p.milestone_type)
      .map(p => p.milestone_type as string)
  )

  const sharedWeeks = new Set(
    sharedPosts
      .filter(p => p.post_type === 'completion_share')
      .map(p => {
        // Derive week from created_at — approximate by order
        return null // we'll handle this differently below
      })
      .filter(Boolean)
  )

  const hasProgramCompletePost = sharedPosts.some(p => p.post_type === 'program_complete')

  // ── Build suggestions ─────────────────────────────────────────────────────
  type Suggestion = {
    type: 'milestone_share' | 'completion_share' | 'program_complete'
    milestone_type?: string
    week_number?: number
    earned_at?: string
    prompt: string
  }

  const suggestions: Suggestion[] = []

  // 1. Unshared milestones (most recent first, max 3)
  const MILESTONE_LABELS: Record<string, string> = {
    first_checkin: 'buổi tập đầu tiên',
    three_day_streak: 'streak 3 ngày',
    week_1_complete: 'tuần 1 hoàn thành',
    halfway: 'nửa chặng đường',
    week_2_complete: 'tuần 2 hoàn thành',
    week_3_complete: 'tuần 3 hoàn thành',
    seven_day_streak: 'streak 7 ngày',
    fourteen_day_streak: 'streak 14 ngày',
    twenty_one_day_streak: 'streak 21 ngày',
    program_complete: 'hoàn thành chương trình',
    comeback: 'comeback sau gián đoạn',
  }

  for (const m of milestones) {
    if (!sharedMilestoneTypes.has(m.milestone_type)) {
      const label = MILESTONE_LABELS[m.milestone_type] ?? m.milestone_type
      suggestions.push({
        type: 'milestone_share',
        milestone_type: m.milestone_type,
        earned_at: m.earned_at,
        prompt: `Chia sẻ thành tích: ${label} 🏆`,
      })
      if (suggestions.filter(s => s.type === 'milestone_share').length >= 3) break
    }
  }

  // 2. Completed weeks not yet shared (most recent first, max 2)
  // We check weekly_reviews submitted, then see if a completion_share post exists
  // around the same time — use a simple set of already-shared week numbers from
  // posts where content mentions "Tuần X" (heuristic). Instead, track via metadata.
  // Simpler: just suggest sharing the most recent completed week if no completion_share
  // post exists in the last 8 days.
  const completedWeeks = Math.floor((enrollment.current_day ?? 0) / 7)
  if (completedWeeks >= 1) {
    const lastCompletionShareDate = sharedPosts
      .filter(p => p.post_type === 'completion_share')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]?.created_at

    const daysSinceLastShare = lastCompletionShareDate
      ? (Date.now() - new Date(lastCompletionShareDate).getTime()) / (1000 * 60 * 60 * 24)
      : Infinity

    // Suggest sharing the current week if not shared recently (within 8 days)
    if (daysSinceLastShare > 8) {
      suggestions.push({
        type: 'completion_share',
        week_number: completedWeeks,
        prompt: `Chia sẻ tiến độ tuần ${completedWeeks} của bạn 💪`,
      })
    }
  }

  // 3. Program complete but not yet shared
  const programDays = (enrollment.programs as unknown as { duration_days: number } | null)?.duration_days
  if (
    enrollment.status === 'completed' ||
    (programDays && enrollment.current_day >= programDays)
  ) {
    if (!hasProgramCompletePost) {
      suggestions.push({
        type: 'program_complete',
        prompt: 'Bạn đã hoàn thành chương trình! Chia sẻ hành trình của bạn 🎉',
      })
    }
  }

  return NextResponse.json({
    suggestions,
    enrollment_id: enrollment.id,
    cohort_id: enrollment.cohort_id,
  })
}
