import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const VALID_TYPES = ['like', 'fire', 'clap', 'heart'] as const

// ─── POST — Toggle reaction ────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  const { id: postId } = await params

  let body: { reaction_type: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const { reaction_type } = body

  if (!reaction_type || !(VALID_TYPES as readonly string[]).includes(reaction_type)) {
    return NextResponse.json({
      error: `reaction_type không hợp lệ. Chấp nhận: ${VALID_TYPES.join(', ')}.`,
    }, { status: 400 })
  }

  // ── Verify post exists and is visible ────────────────────────────────────
  const { data: post } = await supabase
    .from('community_posts')
    .select('id')
    .eq('id', postId)
    .eq('is_hidden', false)
    .maybeSingle()

  if (!post) {
    return NextResponse.json({ error: 'Post không tồn tại.' }, { status: 404 })
  }

  // ── Check existing reaction ───────────────────────────────────────────────
  const { data: existing } = await supabase
    .from('community_reactions')
    .select('id, reaction_type')
    .eq('post_id', postId)
    .eq('user_id', user.id)
    .maybeSingle()

  const service = createServiceClient()

  if (existing) {
    if (existing.reaction_type === reaction_type) {
      // Same type → remove (toggle off)
      const { error: deleteError } = await supabase
        .from('community_reactions')
        .delete()
        .eq('id', existing.id)

      if (deleteError) {
        console.error('[posts/[id]/reactions] delete:', deleteError)
        return NextResponse.json({ error: 'Không thể xóa reaction.' }, { status: 500 })
      }

      await syncLikesCount(service, postId)
      return NextResponse.json({ action: 'removed', reaction_type: null })
    }

    // Different type → update
    const { error: updateError } = await supabase
      .from('community_reactions')
      .update({ reaction_type })
      .eq('id', existing.id)

    if (updateError) {
      console.error('[posts/[id]/reactions] update:', updateError)
      return NextResponse.json({ error: 'Không thể cập nhật reaction.' }, { status: 500 })
    }

    await syncLikesCount(service, postId)
    return NextResponse.json({ action: 'updated', reaction_type })
  }

  // No existing reaction → insert
  const { error: insertError } = await supabase
    .from('community_reactions')
    .insert({ post_id: postId, user_id: user.id, reaction_type })

  if (insertError) {
    if (insertError.code === '23505') {
      // Race condition — react was inserted concurrently; treat as success
      return NextResponse.json({ action: 'added', reaction_type })
    }
    console.error('[posts/[id]/reactions] insert:', insertError)
    return NextResponse.json({ error: 'Không thể thêm reaction.' }, { status: 500 })
  }

  await syncLikesCount(service, postId)
  return NextResponse.json({ action: 'added', reaction_type }, { status: 201 })
}

// ─── Sync likes_count on community_posts ─────────────────────────────────────

async function syncLikesCount(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: any,
  postId: string
): Promise<void> {
  const { count } = await service
    .from('community_reactions')
    .select('*', { count: 'exact', head: true })
    .eq('post_id', postId)

  if (count != null) {
    const { error } = await service
      .from('community_posts')
      .update({ likes_count: count })
      .eq('id', postId)

    if (error) console.error('[posts/[id]/reactions] syncLikesCount:', error)
  }
}
