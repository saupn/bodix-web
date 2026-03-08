import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024 // 5 MB
const SIGNED_URL_TTL = 3600 // 1 hour (frontend should refresh when needed)

const VALID_PHOTO_TYPES = ['before', 'midpoint', 'after', 'weekly'] as const
type PhotoType = (typeof VALID_PHOTO_TYPES)[number]

function fileExtension(mimeType: string): string {
  if (mimeType === 'image/png') return 'png'
  if (mimeType === 'image/webp') return 'webp'
  return 'jpg'
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: 'Chưa đăng nhập.' }, { status: 401 })
  }

  // ── Parse multipart form data ────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data.' }, { status: 400 })
  }

  const file = formData.get('file')
  const enrollmentId = formData.get('enrollment_id') as string | null
  const photoTypeRaw = formData.get('photo_type') as string | null
  const weekNumberRaw = formData.get('week_number') as string | null
  const notes = formData.get('notes') as string | null
  const isPublicRaw = formData.get('is_public') as string | null

  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Thiếu file.' }, { status: 400 })
  }
  if (!enrollmentId) {
    return NextResponse.json({ error: 'Thiếu enrollment_id.' }, { status: 400 })
  }
  if (!photoTypeRaw || !(VALID_PHOTO_TYPES as readonly string[]).includes(photoTypeRaw)) {
    return NextResponse.json({ error: 'photo_type không hợp lệ. Chấp nhận: before, midpoint, after, weekly.' }, { status: 400 })
  }

  const photoType = photoTypeRaw as PhotoType
  const weekNumber = weekNumberRaw ? parseInt(weekNumberRaw, 10) : null
  const isPublic = isPublicRaw === 'true'

  if ((photoType === 'weekly' || photoType === 'midpoint') && !weekNumber) {
    return NextResponse.json({ error: 'week_number bắt buộc cho photo_type "weekly" và "midpoint".' }, { status: 400 })
  }

  // ── Validate file ────────────────────────────────────────────────────────
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'File phải là JPEG, PNG hoặc WebP.' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'File không được vượt quá 5 MB.' }, { status: 400 })
  }

  // ── Verify enrollment belongs to user ────────────────────────────────────
  const { data: enrollment, error: enrollError } = await supabase
    .from('enrollments')
    .select('id')
    .eq('id', enrollmentId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (enrollError || !enrollment) {
    return NextResponse.json({ error: 'Enrollment không tồn tại.' }, { status: 404 })
  }

  // ── Build storage path ───────────────────────────────────────────────────
  const timestamp = Date.now()
  const ext = fileExtension(file.type)
  const weekSuffix = weekNumber ? `_w${weekNumber}` : ''
  const storagePath = `${user.id}/${enrollmentId}/${photoType}${weekSuffix}_${timestamp}.${ext}`

  // ── Upload to Supabase Storage ───────────────────────────────────────────
  const service = createServiceClient()
  const buffer = new Uint8Array(await file.arrayBuffer())

  const { error: uploadError } = await service.storage
    .from('progress-photos')
    .upload(storagePath, buffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    console.error('[photos/upload] storage upload:', uploadError)
    return NextResponse.json({ error: 'Không thể upload ảnh. Vui lòng thử lại.' }, { status: 500 })
  }

  // ── Generate signed URL for immediate use ────────────────────────────────
  const { data: signedUrlData, error: signedUrlError } = await service.storage
    .from('progress-photos')
    .createSignedUrl(storagePath, SIGNED_URL_TTL)

  if (signedUrlError) {
    console.error('[photos/upload] signed URL:', signedUrlError)
    // Non-fatal — record is saved, URL can be refreshed later
  }

  // ── Insert record into progress_photos ───────────────────────────────────
  const { data: photo, error: insertError } = await service
    .from('progress_photos')
    .insert({
      enrollment_id: enrollmentId,
      user_id: user.id,
      photo_type: photoType,
      photo_url: storagePath, // store path; generate signed URL on demand
      week_number: weekNumber,
      notes: notes ?? null,
      is_public: isPublic,
    })
    .select()
    .single()

  if (insertError) {
    console.error('[photos/upload] progress_photos insert:', insertError)
    // Upload succeeded but DB record failed — clean up storage
    await service.storage.from('progress-photos').remove([storagePath])
    return NextResponse.json({ error: 'Không thể lưu thông tin ảnh.' }, { status: 500 })
  }

  return NextResponse.json({
    photo_id: photo.id,
    photo_url: storagePath,              // permanent storage path
    signed_url: signedUrlData?.signedUrl ?? null, // valid for 1 hour
    photo_type: photoType,
    uploaded_at: photo.uploaded_at,
  })
}
