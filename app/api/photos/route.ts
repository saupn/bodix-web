import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const SIGNED_URL_TTL = 3600 // 1 hour

// ─── GET — List photos for an enrollment ─────────────────────────────────────

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  const enrollmentId = request.nextUrl.searchParams.get('enrollment_id')
  if (!enrollmentId) {
    return NextResponse.json({ error: 'Thiếu enrollment_id.' }, { status: 400 })
  }

  // ── Verify enrollment belongs to user ────────────────────────────────────
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id')
    .eq('id', enrollmentId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!enrollment) {
    return NextResponse.json({ error: 'Enrollment không tồn tại.' }, { status: 404 })
  }

  // ── Fetch photos ──────────────────────────────────────────────────────────
  const { data: photos, error: photosError } = await supabase
    .from('progress_photos')
    .select('id, photo_type, photo_url, week_number, notes, is_public, uploaded_at')
    .eq('enrollment_id', enrollmentId)
    .eq('user_id', user.id)
    .order('uploaded_at', { ascending: false })

  if (photosError) {
    console.error('[photos] GET:', photosError)
    return NextResponse.json({ error: 'Lỗi truy vấn.' }, { status: 500 })
  }

  if (!photos?.length) {
    return NextResponse.json({ photos: [] })
  }

  // ── Generate signed URLs in parallel ─────────────────────────────────────
  const service = createServiceClient()

  const photosWithUrls = await Promise.all(
    photos.map(async (photo) => {
      const { data: signedData } = await service.storage
        .from('progress-photos')
        .createSignedUrl(photo.photo_url, SIGNED_URL_TTL)

      return {
        id: photo.id,
        photo_type: photo.photo_type,
        photo_url: photo.photo_url,          // storage path
        signed_url: signedData?.signedUrl ?? null,
        week_number: photo.week_number,
        notes: photo.notes,
        is_public: photo.is_public,
        uploaded_at: photo.uploaded_at,
      }
    })
  )

  return NextResponse.json({ photos: photosWithUrls })
}

// ─── DELETE — Remove a photo ──────────────────────────────────────────────────

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  const photoId = request.nextUrl.searchParams.get('photo_id')
  if (!photoId) {
    return NextResponse.json({ error: 'Thiếu photo_id.' }, { status: 400 })
  }

  // ── Fetch photo (RLS ensures ownership) ──────────────────────────────────
  const { data: photo, error: fetchError } = await supabase
    .from('progress_photos')
    .select('id, photo_url, user_id')
    .eq('id', photoId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (fetchError) {
    console.error('[photos] DELETE fetch:', fetchError)
    return NextResponse.json({ error: 'Lỗi truy vấn.' }, { status: 500 })
  }

  if (!photo) {
    return NextResponse.json({ error: 'Ảnh không tồn tại.' }, { status: 404 })
  }

  // ── Delete DB record first ────────────────────────────────────────────────
  const { error: deleteError } = await supabase
    .from('progress_photos')
    .delete()
    .eq('id', photoId)
    .eq('user_id', user.id)

  if (deleteError) {
    console.error('[photos] DELETE db:', deleteError)
    return NextResponse.json({ error: 'Không thể xóa ảnh.' }, { status: 500 })
  }

  // ── Remove from storage (non-fatal if fails — record is already gone) ─────
  const service = createServiceClient()
  const { error: storageError } = await service.storage
    .from('progress-photos')
    .remove([photo.photo_url])

  if (storageError) {
    console.error('[photos] DELETE storage (non-fatal):', storageError)
  }

  return NextResponse.json({ deleted: true, photo_id: photoId })
}
