# Audit báo cáo: Discount data — 2026-05-23

Audit chạy trên Supabase project `bodix-production` (`xuwueaigkhegwfapnbcu`).

## Tổng quan

| Bảng | Tổng row | Row dirty | % dirty |
|------|----------|-----------|---------|
| `referral_codes` | 2 | 0 | 0 % |
| `vouchers` | 0 | 0 | – |
| `profiles.referral_code` (legacy) | 1 | 1 | 100 % |

**Tổng row cần backfill: 1** (profiles legacy → cần tạo row trong `referral_codes`).

## Phát hiện quan trọng so với task spec

1. **KHÔNG có table `affiliate_codes`** — task spec viết SQL cho bảng này nhưng schema không có. Affiliates dùng chung `referral_codes` với `code_type='affiliate'` (kèm `is_affiliate=true`). Hiện 0 row affiliate trong production.
2. **`vouchers` KHÔNG có cột `discount_type`/`discount_value`** — vouchers luôn là **fixed amount**, schema chỉ có `amount` (NOT NULL) + `remaining_amount` (NOT NULL). Không tồn tại "dirty vouchers" cho 2 field này.
3. **Sentry KHÔNG được cài** trong `package.json` mặc dù CLAUDE.md có nhắc tới. Task B.2 → skip integration, dùng DB log + Vercel console.
4. **Chỉ có 1 Supabase project** (bodix-production). Không có staging riêng. Plan dùng Supabase branch (~$0.01344/giờ) để test migration.

## Chi tiết referral_codes (2 rows)

| code | code_type | is_affiliate | referee_reward_type | referee_reward_value | is_active | created_at |
|------|-----------|--------------|---------------------|----------------------|-----------|------------|
| NGOCSAU | referral | false | discount_percent | 10 | true | 2026-05-23 |
| TRUONGTIEN | referral | false | discount_percent | 10 | true | 2026-05-22 |

→ Cả 2 đều đầy đủ. Không cần backfill `referral_codes`.

## Chi tiết profiles.referral_code legacy

| user | full_name | referral_code | created_at |
|------|-----------|---------------|------------|
| c4c71619-3018-4bf5-8fab-e820966ede36 | Phạm Ngọc Sáu | PHAMSAU | 2026-05-09 |

**Hành vi hiện tại**: Khi user khác nhập `PHAMSAU` ở checkout, `/api/checkout/validate-code` không tìm thấy row trong `referral_codes` → fallback vào `profiles.referral_code` → `resolveReferralReward` thấy thiếu `referee_reward_type`/`value` → trả về `source='fallback_constant'` + log warning.

**Sau backfill**: Tạo row trong `referral_codes` cho `PHAMSAU` với:
- `user_id` = `c4c71619-3018-4bf5-8fab-e820966ede36`
- `code` = `PHAMSAU`
- `code_type` = `referral`
- `referee_reward_type` = `discount_percent`
- `referee_reward_value` = 10
- `is_active` = `true`

Sau đó resolve sẽ trả `source='db'`, không còn fallback.

## Phân bố theo created_at

| Bảng | Mới nhất | Cũ nhất |
|------|----------|---------|
| `referral_codes` | 2026-05-23 | 2026-05-22 |
| `profiles.referral_code` | 2026-05-09 | 2026-05-09 |

Production còn rất mới (đầu vận hành), dataset nhỏ → migration backfill chạy gần như tức thì, không có rủi ro lock bảng.

## Default values đã confirm với chủ dự án

| Bảng / nguồn | Default reward_type | Default reward_value | Lý do |
|--------------|---------------------|----------------------|-------|
| `referral_codes` (code_type=referral) | `discount_percent` | 10 | Khớp `REFERRAL_DISCOUNT_PERCENT` trong `lib/affiliate/config.ts` |
| `referral_codes` (code_type=affiliate) | `discount_percent` | 10 | Khớp `AFFILIATE_DISCOUNT_PERCENT` trong `lib/affiliate/config.ts` |
| `profiles.referral_code` legacy | tạo row mới trong `referral_codes` theo default ở trên |

## Estimate thời gian migration trên production

- Số row affected: **1** (chỉ INSERT vào `referral_codes` cho PHAMSAU)
- Phụ thuộc bảng: cần `user_id` tham chiếu profiles (đã tồn tại)
- Lock: chỉ tạo backup + INSERT 1 row + DDL `CREATE TABLE discount_fallback_log` → **< 1 giây**
- Khung giờ đề xuất: bất kỳ — vì impact gần như zero. Nếu muốn an toàn: 2:00 AM ICT.

## Critical advisory (KHÔNG thuộc task này, cần task riêng)

Supabase advisory phát hiện 6 tables có RLS DISABLED:
- `public.orders` — chứa giao dịch khách hàng (quan trọng!)
- `public.leads`
- `public.otp_verifications`
- `public.zalo_tokens`
- `public.sessions`
- `public.chat_messages`

Bất kỳ ai có anon key đều đọc/ghi được. **Đề xuất tách thành ticket bảo mật riêng** — không động vào trong task BD-DATA-HYGIENE này.
