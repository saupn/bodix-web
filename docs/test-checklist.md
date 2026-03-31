# BodiX — Test Checklist (Manual QA)

> Cập nhật: 2026-03-29
> Chạy trên: Production (bodix.fit) hoặc Preview (Vercel)
> DB verify: Supabase Dashboard > SQL Editor

---

## 1. ĐĂNG KÝ & ĐĂNG NHẬP

- [ ] **1.1 Đăng ký email mới**
  - Làm gì: Mở /signup → Nhập họ tên, email mới, password (>=8 ký tự), xác nhận password → Bấm "Đăng ký"
  - Kết quả đúng: Redirect đến /onboarding. Các ô bắt buộc hiện dấu * đỏ. Cuối form hiện "(*) Bắt buộc".
  - Verify DB:
    ```sql
    SELECT id, email FROM auth.users WHERE email = '<email>';
    SELECT id, full_name, onboarding_completed FROM profiles WHERE id = '<user_id>';
    ```

- [ ] **1.2 Đăng ký với Google**
  - Làm gì: Mở /signup → Bấm "Đăng ký với Google" → Chọn tài khoản Google
  - Kết quả đúng: Redirect về /onboarding (hoặc /app nếu đã onboard trước đó)
  - Verify DB: Như 1.1

- [ ] **1.3 Đăng ký với referral code**
  - Làm gì: Mở /signup?ref=TESTCODE → Trường "Mã giới thiệu" tự điền TESTCODE → Hiện validation (tên người giới thiệu + mô tả reward)
  - Kết quả đúng: Hiện "✓ [Tên] đã giới thiệu bạn! Bạn được giảm 15%..."
  - Verify DB:
    ```sql
    SELECT * FROM referral_tracking WHERE referred_id = '<new_user_id>' ORDER BY created_at DESC LIMIT 1;
    ```

- [ ] **1.4 Đăng nhập đúng password**
  - Làm gì: Mở /login → Nhập email + password đúng → Bấm "Đăng nhập"
  - Kết quả đúng: Redirect đến /app (nếu đã onboard) hoặc /onboarding (nếu chưa)

- [ ] **1.5 Đăng nhập sai password**
  - Làm gì: Mở /login → Nhập email đúng + password sai → Bấm "Đăng nhập"
  - Kết quả đúng: Hiện thông báo lỗi, không redirect

- [ ] **1.6 Đã đăng nhập vào /login**
  - Làm gì: Đã đăng nhập → Truy cập /login trực tiếp
  - Kết quả đúng: Redirect về /app (xử lý bởi proxy.ts)

---

## 2. ONBOARDING (5 steps + skip logic)

- [ ] **2.1 Step 1 — Thông tin cơ bản**
  - Làm gì: Nhập họ tên, ngày sinh, chọn giới tính → Bấm "Tiếp tục"
  - Kết quả đúng: Chuyển sang Step 2. Progress bar 1/5.

- [ ] **2.2 Step 2 — Mục tiêu**
  - Làm gì: Chọn 1+ mục tiêu (Giảm mỡ, Săn chắc, ...) → Bấm "Tiếp tục"
  - Kết quả đúng: Chuyển sang Step 3. Progress bar 2/5.

- [ ] **2.3 Step 3 — Kết nối Zalo (full flow)**
  - Làm gì: Nhập SĐT Zalo (10 số, bắt đầu bằng 0) → Bấm "Tiếp tục" → Hiện mã 5 ký tự → Mở Zalo, tìm OA BodiX → Gửi mã → Quay lại web
  - Kết quả đúng: Web tự detect (polling 3s) → Hiện "Đã kết nối Zalo thành công!" → Tự chuyển Step 4 sau 1.5s
  - Verify DB:
    ```sql
    SELECT * FROM phone_verifications WHERE phone LIKE '%<phone>' ORDER BY created_at DESC LIMIT 1;
    SELECT phone_verified, channel_user_id FROM profiles WHERE id = '<user_id>';
    ```

- [ ] **2.4 Step 3 — Bỏ qua Zalo**
  - Làm gì: Ở step 3, bấm "Bỏ qua, kết nối sau →"
  - Kết quả đúng: Chuyển sang Step 4 mà không verify phone

- [ ] **2.5 Step 4 — Giới thiệu chương trình**
  - Làm gì: Xem 3 chương trình (BodiX 21, 6W, 12W) → Bấm "Tiếp tục"
  - Kết quả đúng: Chuyển sang Step 5. Progress bar 4/5.

- [ ] **2.6 Step 5 — Chia sẻ BodiX, nhận quà**
  - Làm gì: Kiểm tra UI hiển thị: tiêu đề có dấu ("Chia sẻ BodiX, nhận quà"), 2 benefit cards (Voucher 100.000đ + Bạn bè giảm 15%), mã giới thiệu auto-generate, link chia sẻ, nút Zalo
  - Kết quả đúng: Text tiếng Việt CÓ DẤU. Mã referral hiện lớn font-mono. Có nút Copy link + Chia sẻ qua Zalo.
  - Verify DB:
    ```sql
    SELECT referral_code FROM profiles WHERE id = '<user_id>';
    SELECT code, code_type FROM referral_codes WHERE user_id = '<user_id>';
    ```

- [ ] **2.7 Step 5 — Copy link**
  - Làm gì: Bấm "Copy link" → Paste ở nơi khác
  - Kết quả đúng: Clipboard chứa URL `https://bodix.fit/r/<CODE>`. Nút đổi thành "Đã copy!".

- [ ] **2.8 Step 5 — Chia sẻ Zalo**
  - Làm gì: Bấm "Chia sẻ qua Zalo"
  - Kết quả đúng: Mở tab mới với URL `https://zalo.me/share?url=...&title=...`

- [ ] **2.9 Step 5 → Hoàn thành onboarding**
  - Làm gì: Bấm "Tiếp tục" ở step 5
  - Kết quả đúng: Redirect đến /app. KHÔNG bị loop redirect.
  - Verify DB:
    ```sql
    SELECT onboarding_completed, full_name, gender, fitness_goal FROM profiles WHERE id = '<user_id>';
    -- onboarding_completed phải = true
    ```

- [ ] **2.10 Skip logic — Quay lại onboarding sau khi đã hoàn thành**
  - Làm gì: Đã xong onboarding → Truy cập /onboarding trực tiếp
  - Kết quả đúng: Redirect về /app (không hiện form)

- [ ] **2.11 Skip logic — Quay lại onboarding khi mới xong step 1-2**
  - Làm gì: Xong step 1 + 2, chưa verify phone → Đóng tab → Mở lại /onboarding
  - Kết quả đúng: Nhảy thẳng đến step 3 (step đầu tiên chưa hoàn thành). Hiện loading skeleton trước khi nhảy.

- [ ] **2.12 KHÔNG bị redirect loop /app ↔ /onboarding**
  - Làm gì: Hoàn thành onboarding → Mở /app
  - Kết quả đúng: Hiện dashboard bình thường. Mở DevTools Network → Không có redirect 307/302 liên tục.

---

## 3. ZALO MESSAGING

- [ ] **3.1 Token còn hạn**
  - Làm gì: Chạy `npx tsx scripts/test-zalo.ts` → Chọn option 5 (Check Token)
  - Kết quả đúng: Hiện access_token, expires_at, và "Token còn hạn X giờ"
  - Verify DB:
    ```sql
    SELECT id, expires_at, updated_at FROM zalo_tokens ORDER BY updated_at DESC LIMIT 1;
    -- expires_at phải > now()
    ```

- [ ] **3.2 Gửi verify code qua Zalo → Nhận phản hồi**
  - Làm gì: Trong onboarding step 3, nhập SĐT → Nhận mã → Mở Zalo → Gửi mã đến OA BodiX
  - Kết quả đúng: OA trả lời "Xác minh thành công! ✅\n\nChào mừng bạn đến với BodiX. Khi tham gia chương trình tập luyện, bạn sẽ nhận được tin nhắn nhắc tập và hỗ trợ qua Zalo."

- [ ] **3.3 Gửi text không phải verify code**
  - Làm gì: Đã follow OA → Gửi tin nhắn bất kỳ (ví dụ "xin chào")
  - Kết quả đúng: Nếu chưa link tài khoản → OA trả lời hướng dẫn đăng ký. Nếu đã link → OA phản hồi tùy context (check-in keywords: HARD/LIGHT/EASY, hoặc hướng dẫn).

- [ ] **3.4 Webhook nhận event**
  - Làm gì: Gửi tin nhắn trên Zalo → Kiểm tra Vercel Function logs
  - Kết quả đúng: Log hiện `=== DEBUG handleUserMessage ===` với raw message text, trimmed+uppercase, regex match result.

---

## 4. REFERRAL

- [ ] **4.1 Mã referral auto-generate**
  - Làm gì: Hoàn thành onboarding → Kiểm tra profiles + referral_codes
  - Verify DB:
    ```sql
    SELECT referral_code FROM profiles WHERE id = '<user_id>';
    SELECT code, code_type, reward_type, referee_reward_type, referee_reward_value
    FROM referral_codes WHERE user_id = '<user_id>';
    -- referee_reward_value phải = 15 (15% discount)
    ```

- [ ] **4.2 Landing page /r/[code]**
  - Làm gì: Mở `https://bodix.fit/r/<CODE>` (dùng code thật từ DB)
  - Kết quả đúng: Hiện trang landing với tên người giới thiệu, 3 chương trình với giá đã giảm 15%, nút đăng ký

- [ ] **4.3 Dashboard referral /app/referral**
  - Làm gì: Đăng nhập → Vào /app/referral
  - Kết quả đúng: Hiện mã referral, link chia sẻ, QR code, stats (clicks, signups, conversions), lịch sử

- [ ] **4.4 Nút Copy link trong /app/referral**
  - Làm gì: Bấm "Copy link" trong trang referral
  - Kết quả đúng: Clipboard chứa URL đúng format

---

## 5. AFFILIATE

- [ ] **5.1 Trang đăng ký affiliate public**
  - Làm gì: Mở /affiliate (không cần đăng nhập)
  - Kết quả đúng: Hiện trang "Chương trình Đối tác BodiX" với lợi ích (40%, 10%, 500K), form đăng ký (họ tên, SĐT, email, loại đối tác, kênh, social link, audience, lý do)

- [ ] **5.2 Submit form affiliate**
  - Làm gì: Điền đầy đủ form → Bấm "Gửi đăng ký"
  - Kết quả đúng: Hiện "Cảm ơn bạn đã đăng ký! Chúng tôi sẽ xem xét và phản hồi trong 1-2 ngày làm việc."
  - Verify DB:
    ```sql
    SELECT id, full_name, phone, email, partner_type, primary_channel, is_approved, rejected
    FROM affiliate_profiles WHERE email = '<email>';
    -- is_approved = false, rejected = false
    ```

- [ ] **5.3 User thường KHÔNG thấy Affiliate trong navigation**
  - Làm gì: Đăng nhập user thường → Kiểm tra sidebar navigation
  - Kết quả đúng: Menu có: Trang chủ, Chương trình, Review, Giới thiệu, Cộng đồng, Tiến độ, Hồ sơ. KHÔNG có "Đối tác".

- [ ] **5.4 Link affiliate trong Profile**
  - Làm gì: Vào /app/profile
  - Kết quả đúng: Cuối trang có link "Trở thành đối tác BodiX →" trỏ đến /affiliate

- [ ] **5.5 Admin approve affiliate**
  - Làm gì: Đăng nhập admin → /admin/affiliate → Tab "Đơn đăng ký" → Bấm "Duyệt" → Nhập commission rate (40) → Confirm
  - Kết quả đúng: Đơn chuyển sang tab "Active". Affiliate code auto-generate (AFF-XXXXXX).
  - Verify DB:
    ```sql
    SELECT is_approved, approved_at, affiliate_tier FROM affiliate_profiles WHERE email = '<email>';
    SELECT code, commission_rate FROM referral_codes WHERE user_id = '<affiliate_user_id>' AND code_type = 'affiliate';
    ```

- [ ] **5.6 Admin reject affiliate**
  - Làm gì: Admin → /admin/affiliate → Tab "Đơn đăng ký" → Bấm "Từ chối" → Nhập lý do → Confirm
  - Kết quả đúng: Đơn biến mất khỏi danh sách pending
  - Verify DB:
    ```sql
    SELECT rejected, rejected_at FROM affiliate_profiles WHERE email = '<email>';
    -- rejected = true
    ```

---

## 6. THANH TOÁN & CHECKOUT

- [ ] **6.1 Mở checkout page**
  - Làm gì: Vào /app/programs → Bấm chọn chương trình → Vào /app/checkout/bodix-21
  - Kết quả đúng: Hiện form checkout với thông tin liên hệ (readonly), mã giới thiệu, voucher, phương thức thanh toán (bank transfer + MoMo coming soon), tóm tắt đơn hàng

- [ ] **6.2 Giá hiển thị đúng**
  - Làm gì: Kiểm tra tóm tắt đơn hàng
  - Kết quả đúng: BodiX 21 = 499.000đ, BodiX 6W = 1.199.000đ, BodiX 12W = 1.999.000đ

- [ ] **6.3 Referral discount 15%**
  - Làm gì: Nhập mã referral hợp lệ (code_type = 'referral') vào ô "Mã giới thiệu"
  - Kết quả đúng: Hiện "✓ Giảm 15% từ mã giới thiệu [Tên] — Giảm XXXđ". Tóm tắt đơn hàng hiện dòng "Giảm từ mã giới thiệu: -XXXđ". Tổng thanh toán = giá gốc - 15%.
  - Ví dụ: BodiX 21: 499.000 - 74.850 = 424.150đ

- [ ] **6.4 Affiliate discount 10%**
  - Làm gì: Nhập mã affiliate hợp lệ (code_type = 'affiliate') vào ô "Mã giới thiệu / đối tác"
  - Kết quả đúng: Hiện "✓ Giảm 10% từ đối tác [Tên] — Giảm XXXđ". Tóm tắt hiện "Giảm từ đối tác: -XXXđ".
  - Ví dụ: BodiX 21: 499.000 - 49.900 = 449.100đ

- [ ] **6.5 Voucher áp dụng**
  - Làm gì: Nhập voucher code hợp lệ (V-XXXXX) vào ô "Voucher"
  - Kết quả đúng: Hiện "✓ Voucher hợp lệ — Giảm XXXđ". Tóm tắt hiện dòng "Voucher: -XXXđ". Tổng = giá - % discount - voucher.

- [ ] **6.6 Submit checkout → Tạo enrollment**
  - Làm gì: Bấm "Xác nhận đăng ký"
  - Kết quả đúng: Redirect đến /app/checkout/success
  - Verify DB:
    ```sql
    SELECT id, status, amount_paid, referral_code_id, referral_discount_amount, voucher_id, voucher_discount_amount
    FROM enrollments WHERE user_id = '<user_id>' ORDER BY created_at DESC LIMIT 1;
    -- status = 'pending_payment'
    ```

- [ ] **6.7 Admin confirm order**
  - Làm gì: Admin → /admin/orders → Tìm order → Bấm "Xác nhận đã thanh toán"
  - Kết quả đúng: Enrollment status chuyển thành 'active'. User được assign vào cohort.
  - Verify DB:
    ```sql
    SELECT status, paid_at, cohort_id, amount_paid FROM enrollments WHERE id = '<enrollment_id>';
    -- status = 'active', paid_at IS NOT NULL
    ```

- [ ] **6.8 Referral reward sau thanh toán**
  - Làm gì: Sau khi admin confirm order có referral code
  - Verify DB:
    ```sql
    -- Voucher tạo cho người giới thiệu
    SELECT * FROM vouchers WHERE source_type = 'referral_reward' ORDER BY created_at DESC LIMIT 1;
    -- Referral reward record
    SELECT * FROM referral_rewards ORDER BY created_at DESC LIMIT 1;
    -- Referral tracking updated
    SELECT status, conversion_amount FROM referral_tracking WHERE referred_id = '<buyer_id>' ORDER BY created_at DESC LIMIT 1;
    -- status = 'converted'
    ```

---

## 7. DASHBOARD (sau enrollment active)

- [ ] **7.1 Trang chủ /app**
  - Làm gì: Đăng nhập user có enrollment active → Vào /app
  - Kết quả đúng: Hiện thông tin chương trình, ngày hiện tại, streak, navigation sidebar

- [ ] **7.2 Workout page**
  - Làm gì: Vào /app/program → Bấm vào ngày tập
  - Kết quả đúng: Hiện bài tập ngày đó với Hard version + Light version. Có nút check-in.

- [ ] **7.3 Check-in trên web**
  - Làm gì: Ở workout page → Chọn mode (Hard/Light/Easy) → Chọn feeling (1-5) → Submit
  - Kết quả đúng: Hiện animation thành công. Streak tăng.
  - Verify DB:
    ```sql
    SELECT * FROM daily_checkins WHERE enrollment_id = '<enrollment_id>' ORDER BY workout_date DESC LIMIT 1;
    SELECT current_streak, total_completed_days FROM streaks WHERE enrollment_id = '<enrollment_id>';
    ```

- [ ] **7.4 Progress page**
  - Làm gì: Vào /app/progress
  - Kết quả đúng: Hiện streak hiện tại, tổng ngày đã tập, calendar view, milestones đã đạt

- [ ] **7.5 Community page**
  - Làm gì: Vào /app/community
  - Kết quả đúng: Hiện feed bài đăng trong cohort, tabs (Feed/Media), nút tạo bài mới

- [ ] **7.6 Check-in qua Zalo**
  - Làm gì: Gửi "HARD" hoặc "LIGHT" hoặc "EASY" trên Zalo cho OA BodiX
  - Kết quả đúng: OA xác nhận check-in thành công, streak cập nhật
  - Verify DB: Như 7.3

---

## 8. ADMIN

- [ ] **8.1 Admin access control**
  - Làm gì: Đăng nhập user thường → Truy cập /admin
  - Kết quả đúng: Redirect về /app (không truy cập được)

- [ ] **8.2 Admin dashboard /admin**
  - Làm gì: Đăng nhập admin → Vào /admin
  - Kết quả đúng: Hiện KPI scoreboard (D7 Adherence, Completion 21, NPS, ...), Today's Pulse (check-ins, signups, revenue, voucher outstanding, affiliate pending), charts, alerts

- [ ] **8.3 Admin users /admin/users**
  - Làm gì: Vào /admin/users → Tìm user bằng email
  - Kết quả đúng: Hiện danh sách users với name, email, phone, status, program, streak, risk score. Có filter theo status + program.

- [ ] **8.4 Admin orders /admin/orders**
  - Làm gì: Vào /admin/orders
  - Kết quả đúng: Hiện danh sách enrollments pending_payment. Có nút confirm.

- [ ] **8.5 Admin referral /admin/referral**
  - Làm gì: Vào /admin/referral
  - Kết quả đúng: 3 tabs: Overview (stats + chart), Referral Codes (table), Conversions (table). Overview có thêm section Voucher Statistics.

- [ ] **8.6 Admin affiliate /admin/affiliate**
  - Làm gì: Vào /admin/affiliate
  - Kết quả đúng: 4 tabs: Đơn đăng ký (pending), Active (approved), Withdrawals, Payouts. Đơn đăng ký hiện đầy đủ: tên, SĐT, email, loại đối tác, kênh, social link, audience, motivation.

- [ ] **8.7 Admin analytics**
  - Làm gì: Vào /admin/analytics/overview, /admin/analytics/revenue, /admin/analytics/funnel, /admin/analytics/dropout
  - Kết quả đúng: Mỗi trang hiện charts và metrics tương ứng

- [ ] **8.8 Admin Zalo /admin/zalo**
  - Làm gì: Vào /admin/zalo
  - Kết quả đúng: Hiện trạng thái Zalo OA, token info, gửi tin nhắn test

---

## 9. EDGE CASES & ERROR HANDLING

- [ ] **9.1 Self-referral blocked**
  - Làm gì: Ở checkout, nhập mã referral của chính mình
  - Kết quả đúng: Hiện "Mã không hợp lệ" (không cho dùng code của chính mình)

- [ ] **9.2 Duplicate enrollment blocked**
  - Làm gì: Đã có enrollment pending/active cho chương trình → Thử tạo lại
  - Kết quả đúng: API trả lỗi "Bạn đã đăng ký chương trình này."

- [ ] **9.3 Expired voucher rejected**
  - Làm gì: Nhập voucher code đã hết hạn vào checkout
  - Kết quả đúng: Hiện "Voucher không hợp lệ hoặc đã hết hạn"

- [ ] **9.4 Health check**
  - Làm gì: GET /api/health
  - Kết quả đúng: HTTP 200, response chứa status OK

---

## Bảng tóm tắt kết quả test

| # | Test | Pass/Fail | Ghi chú |
|---|------|-----------|---------|
| 1.1 | Đăng ký email mới | | |
| 1.2 | Đăng ký Google | | |
| 1.3 | Đăng ký với referral code | | |
| 1.4 | Đăng nhập đúng | | |
| 1.5 | Đăng nhập sai | | |
| 1.6 | Đã đăng nhập vào /login | | |
| 2.1 | Step 1 — Thông tin cơ bản | | |
| 2.2 | Step 2 — Mục tiêu | | |
| 2.3 | Step 3 — Kết nối Zalo (full) | | |
| 2.4 | Step 3 — Bỏ qua | | |
| 2.5 | Step 4 — Giới thiệu chương trình | | |
| 2.6 | Step 5 — Chia sẻ, nhận quà (UI) | | |
| 2.7 | Step 5 — Copy link | | |
| 2.8 | Step 5 — Chia sẻ Zalo | | |
| 2.9 | Step 5 → Hoàn thành | | |
| 2.10 | Skip: đã xong → /onboarding | | |
| 2.11 | Skip: chưa xong → step đúng | | |
| 2.12 | KHÔNG redirect loop | | |
| 3.1 | Zalo token còn hạn | | |
| 3.2 | Verify code → phản hồi Zalo | | |
| 3.3 | Text thường → phản hồi | | |
| 3.4 | Webhook logs | | |
| 4.1 | Referral auto-generate | | |
| 4.2 | Landing /r/[code] | | |
| 4.3 | Dashboard /app/referral | | |
| 4.4 | Copy link referral | | |
| 5.1 | Trang affiliate public | | |
| 5.2 | Submit form affiliate | | |
| 5.3 | Navigation ẩn Affiliate | | |
| 5.4 | Link affiliate trong Profile | | |
| 5.5 | Admin approve affiliate | | |
| 5.6 | Admin reject affiliate | | |
| 6.1 | Checkout page hiển thị | | |
| 6.2 | Giá đúng | | |
| 6.3 | Referral discount 15% | | |
| 6.4 | Affiliate discount 10% | | |
| 6.5 | Voucher áp dụng | | |
| 6.6 | Submit → enrollment | | |
| 6.7 | Admin confirm order | | |
| 6.8 | Referral reward | | |
| 7.1 | Dashboard /app | | |
| 7.2 | Workout page | | |
| 7.3 | Check-in web | | |
| 7.4 | Progress page | | |
| 7.5 | Community page | | |
| 7.6 | Check-in Zalo | | |
| 8.1 | Admin access control | | |
| 8.2 | Admin dashboard | | |
| 8.3 | Admin users | | |
| 8.4 | Admin orders | | |
| 8.5 | Admin referral | | |
| 8.6 | Admin affiliate | | |
| 8.7 | Admin analytics | | |
| 8.8 | Admin Zalo | | |
| 9.1 | Self-referral blocked | | |
| 9.2 | Duplicate enrollment | | |
| 9.3 | Expired voucher | | |
| 9.4 | Health check | | |
