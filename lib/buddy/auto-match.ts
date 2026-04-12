import type { SupabaseClient } from '@supabase/supabase-js'
import { sendViaZalo } from '@/lib/messaging/adapters/zalo'

interface AutoMatchResult {
  matched: number
  unpaired: number
  zalo_sent: number
  zalo_errors: number
}

/**
 * Auto-match buddy pairs cho một cohort.
 * Sort theo date_of_birth, ghép cặp liền kề.
 * Gửi Zalo thông báo cho từng cặp.
 */
export async function autoMatchCohort(
  service: SupabaseClient,
  cohortId: string
): Promise<AutoMatchResult> {
  // Lấy tất cả enrollments active trong cohort
  const { data: enrollments } = await service
    .from('enrollments')
    .select('user_id')
    .eq('cohort_id', cohortId)
    .eq('status', 'active')

  if (!enrollments?.length) {
    return { matched: 0, unpaired: 0, zalo_sent: 0, zalo_errors: 0 }
  }

  const allUserIds = enrollments.map(e => e.user_id)

  // Loại bỏ user đã có buddy
  const { data: existingPairs } = await service
    .from('buddy_pairs')
    .select('user_a, user_b')
    .eq('cohort_id', cohortId)
    .eq('status', 'active')

  const pairedIds = new Set<string>()
  for (const p of existingPairs ?? []) {
    pairedIds.add(p.user_a)
    pairedIds.add(p.user_b)
  }

  const unpairedIds = allUserIds.filter(id => !pairedIds.has(id))

  if (unpairedIds.length < 2) {
    return { matched: 0, unpaired: unpairedIds.length, zalo_sent: 0, zalo_errors: 0 }
  }

  // Lấy profiles với date_of_birth để sort
  const { data: profiles } = await service
    .from('profiles')
    .select('id, full_name, date_of_birth, channel_user_id')
    .in('id', unpairedIds)

  // Sort theo date_of_birth (gần tuổi nhau → ghép cùng nhau)
  const sorted = (profiles ?? []).sort((a, b) => {
    const da = a.date_of_birth ?? '1990-01-01'
    const db = b.date_of_birth ?? '1990-01-01'
    return da.localeCompare(db)
  })

  // Ghép theo cặp liền kề
  const pairs: { cohort_id: string; user_a: string; user_b: string; status: string; matched_by: string }[] = []

  for (let i = 0; i + 1 < sorted.length; i += 2) {
    pairs.push({
      cohort_id: cohortId,
      user_a: sorted[i].id,
      user_b: sorted[i + 1].id,
      status: 'active',
      matched_by: 'auto',
    })
  }

  if (pairs.length === 0) {
    return { matched: 0, unpaired: sorted.length, zalo_sent: 0, zalo_errors: 0 }
  }

  const { error: insertError } = await service
    .from('buddy_pairs')
    .insert(pairs)

  if (insertError) {
    console.error('[buddy/auto-match] insert:', insertError)
    throw new Error(`Lỗi khi ghép buddy: ${insertError.message}`)
  }

  // Gửi Zalo thông báo cho từng cặp
  const profileMap = new Map(sorted.map(p => [p.id, p]))
  const zaloStats = { sent: 0, errors: 0 }

  const buildMessage = (recipientName: string, partnerName: string) =>
    `🤝 ${recipientName} ơi, bạn đã được ghép đôi với ${partnerName}! ` +
    `Hai bạn sẽ cùng nhau hoàn thành hành trình. Hãy nhắn cho nhau để làm quen nha!`

  for (const pair of pairs) {
    const profileA = profileMap.get(pair.user_a)
    const profileB = profileMap.get(pair.user_b)
    const nameA = profileA?.full_name ?? 'Bạn'
    const nameB = profileB?.full_name ?? 'Bạn'

    if (profileA?.channel_user_id) {
      try {
        const r = await sendViaZalo(profileA.channel_user_id, buildMessage(nameA, nameB))
        if (r.success) zaloStats.sent++; else zaloStats.errors++
      } catch { zaloStats.errors++ }
    }

    if (profileB?.channel_user_id) {
      try {
        const r = await sendViaZalo(profileB.channel_user_id, buildMessage(nameB, nameA))
        if (r.success) zaloStats.sent++; else zaloStats.errors++
      } catch { zaloStats.errors++ }
    }

    await new Promise(r => setTimeout(r, 100))
  }

  const leftover = sorted.length % 2 === 1 ? 1 : 0

  return {
    matched: pairs.length,
    unpaired: leftover,
    zalo_sent: zaloStats.sent,
    zalo_errors: zaloStats.errors,
  }
}
