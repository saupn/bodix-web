# BodiX Test Checklist v4

> Cập nhật: 2026-03-31 — Sau CC-01 → CC-13
> Dựa trên codebase thực tế, không liệt kê tính năng chưa tồn tại.

---

## 1. ĐĂNG KÝ & ĐĂNG NHẬP

- [ ] **Đăng ký email mới → vào onboarding**
  - Làm: Vào `/signup` → nhập email + password + xác nhận password → Submit
  - Đúng: Redirect sang `/onboarding`, hiện step 1/5
  - DB: `SELECT id, email, onboarding_completed FROM profiles WHERE email = 'test@email.com'` → `onboarding_completed = false`

- [ ] **Đăng nhập đúng password**
  - Làm: Vào `/login` → nhập email + password đã đăng ký → Submit
  - Đúng: Redirect sang `/onboarding` (nếu chưa xong) hoặc `/app` (nếu đã xong)
  - DB: `SELECT id, onboarding_completed FROM profiles WHERE email = 'test@email.com'`

- [ ] **Đăng nhập sai password → báo lỗi**
  - Làm: Vào `/login` → nhập email đúng + password sai → Submit
  - Đúng: Hiện thông báo lỗi, KHÔNG redirect
  - DB: Không cần verify

- [ ] **Đăng nhập user đã onboard xong → thẳng /app (không loop)**
  - Làm: Đăng nhập với tài khoản đã hoàn thành onboarding
  - Đúng: Redirect thẳng `/app`, KHÔNG quay lại `/onboarding`
  - DB: `SELECT onboarding_completed FROM profiles WHERE id = '<user_id>'` → `true`

---

## 2. ONBOARDING (Smart Skip)

- [ ] **User mới: bắt đầu step 1**
  - Làm: Đăng ký xong → vào `/onboarding`
  - Đúng: Hiện "Bước 1 / 5 — Thông tin cơ bản" với fields: Họ tên, Ngày sinh, Giới tính (Nữ/Nam/Khác)
  - DB: `SELECT gender, fitness_goal FROM profiles WHERE id = '<user_id>'` → cả hai NULL

- [ ] **Step 1: giới tính → profiles.gender có giá trị**
  - Làm: Nhập họ tên + chọn giới tính → "Tiếp tục"
  - Đúng: Chuyển sang step 2
  - DB: `SELECT full_name, gender FROM profiles WHERE id = '<user_id>'` → `gender` = 'female'/'male'/'other'

- [ ] **Step 2: fitness goal → profiles.fitness_goal có giá trị**
  - Làm: Chọn 1+ mục tiêu (Giảm mỡ, Săn chắc cơ thể, Tăng sức bền, Cải thiện vóc dáng, Tạo thói quen tập luyện) → "Tiếp tục"
  - Đúng: Chuyển sang step 3
  - DB: `SELECT fitness_goal FROM profiles WHERE id = '<user_id>'` → mảng JSON có giá trị

- [ ] **Step 3: Verify Zalo — BẮT BUỘC, KHÔNG CÓ NÚT BỎ QUA**
  - Làm: Nhập SĐT 10 số bắt đầu bằng 0 → Nhận verify code 5 ký tự → Mở Zalo OA BodiX → Gửi code → Website tự detect (polling 3 giây/lần)
  - Đúng: Hiện "Đã kết nối Zalo thành công!" với icon xanh, tự chuyển sang step 4 sau 1.5 giây
  - DB: `SELECT phone, phone_verified, channel_user_id FROM profiles WHERE id = '<user_id>'` → `phone_verified = true`, `channel_user_id IS NOT NULL`

- [ ] **Step 3: SĐT sai format → báo lỗi**
  - Làm: Nhập SĐT < 10 số hoặc không bắt đầu bằng 0
  - Đúng: Hiện lỗi "SĐT phải bắt đầu bằng 0." hoặc "SĐT phải đủ 10 số."
  - DB: Không cần verify

- [ ] **Step 4: Chào mừng — hiện thông tin chương trình**
  - Làm: Tự động chuyển từ step 3 (hoặc smart skip)
  - Đúng: Hiện "Chào mừng [fullName]!" + "Bạn có 3 ngày trải nghiệm miễn phí" + 3 chương trình cards
  - DB: Không cần verify (step thông tin, không lưu gì)

- [ ] **Step 5: Referral — hiện mã theo tên + lợi ích**
  - Làm: Tự động chuyển từ step 4
  - Đúng: Hiện 2 cards lợi ích (Voucher 100.000đ, Bạn bè giảm 10%) + mã referral (tự sinh từ tên) + copy link + chia sẻ Zalo. Link format: `bodix.fit?ref=CODE`
  - DB: `SELECT * FROM referral_codes WHERE owner_id = '<user_id>' AND code_type = 'referral'` → có record

- [ ] **Smart skip: quay lại onboarding → nhảy đến step chưa xong**
  - Làm: Hoàn thành step 1-2, đóng tab, mở lại `/onboarding`
  - Đúng: Nhảy thẳng đến step 3 (Zalo verify — step chưa xong đầu tiên)
  - DB: `SELECT gender, fitness_goal, phone_verified FROM profiles WHERE id = '<user_id>'` → gender + fitness_goal có giá trị, phone_verified = false

- [ ] **Hoàn thành tất cả steps → vào /app KHÔNG loop**
  - Làm: Hoàn thành step 5 → bấm "Tiếp tục"
  - Đúng: Gọi `/api/auth/complete-onboarding` → redirect `/app`
  - DB: `SELECT onboarding_completed FROM profiles WHERE id = '<user_id>'` → `true`

- [ ] **User đã xong tất cả steps → redirect /app ngay**
  - Làm: Truy cập `/onboarding` với user đã `onboarding_completed = true`
  - Đúng: Redirect thẳng `/app`, không hiện form
  - DB: `SELECT onboarding_completed FROM profiles WHERE id = '<user_id>'` → `true`

---

## 3. DASHBOARD (chưa có enrollment)

- [ ] **Hiện card giới thiệu chương trình + nút "Đăng ký tập thử 3 ngày"**
  - Làm: Đăng nhập user đã onboard, chưa có enrollment nào
  - Đúng: Hiện TrialSignupCard với title "BodiX 21 — 21 ngày thay đổi thật sự", nút "Đăng ký tập thử 3 ngày (miễn phí)"
  - DB: `SELECT * FROM enrollments WHERE user_id = '<user_id>'` → 0 rows

- [ ] **Nếu phone_verified = false → banner nhắc kết nối Zalo**
  - Làm: Đăng nhập user có `phone_verified = false`
  - Đúng: Hiện ZaloConnectBanner "Kết nối Zalo để nhận nhắc tập mỗi ngày" + nút "Kết nối ngay" → link `/onboarding`
  - DB: `SELECT phone_verified FROM profiles WHERE id = '<user_id>'` → `false`

- [ ] **ZaloConnectBanner dismiss 3 lần → không hiện lại**
  - Làm: Bấm X trên banner 3 lần
  - Đúng: Banner biến mất vĩnh viễn (localStorage key `zalo_banner_dismiss_count`)
  - DB: Không cần verify (client-side localStorage)

- [ ] **Buddy card: "Tìm người đồng hành" (chưa có buddy)**
  - Làm: Đăng nhập user đang active trong cohort, chưa có buddy
  - Đúng: BuddyCard hiện search input + nút "Ghép ngẫu nhiên"
  - DB: `SELECT * FROM buddy_pairs WHERE (user_a = '<user_id>' OR user_b = '<user_id>') AND status = 'active'` → 0 rows

---

## 4. TRIAL 3 NGÀY

- [ ] **Bấm "Đăng ký tập thử" → enrollment status = 'trial'**
  - Làm: Bấm "Đăng ký tập thử 3 ngày (miễn phí)" trên TrialSignupCard
  - Đúng: API POST `/api/trial/start` thành công → redirect `/app/trial`. Nếu có Zalo, nhận tin: "🎉 {name} đã đăng ký tập thử 3 ngày!"
  - DB: `SELECT status, program_id FROM enrollments WHERE user_id = '<user_id>'` → `status = 'trial'`; `SELECT trial_started_at, trial_ends_at FROM profiles WHERE id = '<user_id>'` → cả hai có giá trị

- [ ] **Trang trial hiện 3 workout cards**
  - Làm: Vào `/app/trial` sau khi đăng ký
  - Đúng: Hiện 3 cards cho Day 1, Day 2, Day 3 với tiêu đề + thời lượng
  - DB: Không cần verify (UI check)

- [ ] **Click workout → KHÔNG 404 (CC-01 đã fix)**
  - Làm: Click vào card Day 1 → navigate đến `/app/trial/workout/1`
  - Đúng: Trang hiện đầy đủ: tiêu đề, mode selection (HARD/LIGHT/RECOVERY), video, danh sách bài tập
  - DB: Không cần verify (UI check)

- [ ] **Xem video Vimeo embed**
  - Làm: Chọn mode (HARD/LIGHT/RECOVERY) trên trang workout
  - Đúng: Video Vimeo hiện đúng trong iframe, không lỗi embed
  - DB: Không cần verify (UI check)

- [ ] **Mode selection: HARD (3 rounds), LIGHT (2 rounds), RECOVERY (1 round)**
  - Làm: Bấm từng nút mode trên trang trial workout
  - Đúng: HARD hiện "3 rounds (~X phút) 💪", LIGHT hiện "2 rounds (~X phút) 🌿", RECOVERY hiện "1 round (~X phút) 🧘"
  - DB: Không cần verify (UI check)

- [ ] **Check-in qua Zalo: reply 1/2/3 → daily_checkins có record**
  - Làm: Mở Zalo OA BodiX → gửi "3" (HARD) hoặc "2" (LIGHT) hoặc "1" (EASY)
  - Đúng: Zalo webhook nhận, tạo check-in record, Zalo KHÔNG gửi tin phản hồi (im lặng)
  - DB: `SELECT * FROM daily_checkins WHERE enrollment_id = '<enrollment_id>' ORDER BY day_number DESC LIMIT 1` → có record với mode tương ứng

- [ ] **Sau check-in: Zalo KHÔNG gửi tin phản hồi (im lặng)**
  - Làm: Reply 1/2/3 trong Zalo cho check-in ngày bình thường
  - Đúng: Không nhận tin trả lời từ OA (chỉ lưu DB, không reply)
  - DB: Không cần verify (kiểm tra Zalo không có tin mới)

- [ ] **Hoàn thành D3 → status = 'trial_completed'**
  - Làm: Check-in cả 3 ngày trial qua Zalo
  - Đúng: Ngày check-in D3, enrollment tự chuyển sang `trial_completed`
  - DB: `SELECT status FROM enrollments WHERE user_id = '<user_id>'` → `trial_completed`

- [ ] **Zalo nhận tin: "3 ngày tập thử hoàn thành!"**
  - Làm: Check-in D3 qua Zalo
  - Đúng: Nhận tin Zalo: "🎯 3 ngày tập thử hoàn thành! Bạn sẽ được thông báo khi đợt tiếp theo mở."
  - DB: Không cần verify (kiểm tra Zalo)

- [ ] **Đăng ký trial lần 2 → bị từ chối (chỉ 1 lần/tài khoản)**
  - Làm: Sau khi trial xong, thử gọi POST `/api/trial/start` lại
  - Đúng: API trả lỗi — user đã có enrollment (status in trial/trial_completed/pending_payment/paid_waiting_cohort/active/completed)
  - DB: `SELECT count(*) FROM enrollments WHERE user_id = '<user_id>'` → >= 1

---

## 5. CHỜ ĐƯỢC CHỌN + THANH TOÁN

- [ ] **Sau trial → dashboard hiện "Tập thử hoàn thành!" + chờ thông báo**
  - Làm: Đăng nhập user có enrollment `trial_completed`
  - Đúng: Dashboard hiện card "Tập thử hoàn thành!" với thông báo chờ admin chọn
  - DB: `SELECT status FROM enrollments WHERE user_id = '<user_id>'` → `trial_completed`

- [ ] **Admin chọn user → status = 'pending_payment'**
  - Làm: Admin gọi POST `/api/admin/enrollment/select` với `enrollment_ids`
  - Đúng: Enrollment chuyển sang `pending_payment`
  - DB: `SELECT status FROM enrollments WHERE id = '<enrollment_id>'` → `pending_payment`

- [ ] **User nhận Zalo: "Chúc mừng! Bạn đã được chọn tham gia!"**
  - Làm: Admin select user
  - Đúng: User nhận Zalo: "🎉 Chúc mừng {name}! Bạn đã được chọn tham gia {program}! Thanh toán tại bodix.fit/checkout để giữ chỗ."
  - DB: Không cần verify (kiểm tra Zalo)

- [ ] **Dashboard hiện CTA thanh toán**
  - Làm: Đăng nhập user có enrollment `pending_payment`
  - Đúng: Dashboard hiện card "Bạn đã được chọn!" với link đến checkout
  - DB: `SELECT status FROM enrollments WHERE user_id = '<user_id>'` → `pending_payment`

- [ ] **Checkout hiện đúng giá**
  - Làm: Vào trang checkout
  - Đúng: Hiện đúng giá chương trình (lấy từ `programs.price_vnd`), thông tin chuyển khoản
  - DB: `SELECT price_vnd FROM programs WHERE slug = 'bodix-21'`

- [ ] **Nếu có ref code → giảm 10%**
  - Làm: Checkout có referral code (từ cookie `bodix_ref` hoặc nhập thủ công)
  - Đúng: Giá giảm 10%, hiện dòng "Giảm 10% từ mã giới thiệu". Validate realtime qua `/api/referral/validate` (debounce 400ms)
  - DB: `SELECT referral_discount_amount FROM enrollments WHERE id = '<enrollment_id>'` → có giá trị

- [ ] **Voucher code → trừ thêm vào giá**
  - Làm: Nhập mã voucher (V-XXXXX) vào ô voucher trên checkout
  - Đúng: Validate qua `/api/voucher/validate`, trừ remaining_amount vào giá (max = giá sau referral discount)
  - DB: `SELECT voucher_discount_amount FROM enrollments WHERE id = '<enrollment_id>'` → có giá trị

- [ ] **Bank transfer: hiện thông tin chuyển khoản**
  - Làm: Chọn phương thức "Chuyển khoản ngân hàng"
  - Đúng: Hiện thông tin tài khoản ngân hàng để chuyển khoản
  - DB: Không cần verify (UI check)

- [ ] **Admin confirm → status = 'paid_waiting_cohort'**
  - Làm: Admin gọi POST `/api/checkout/confirm` xác nhận thanh toán
  - Đúng: Enrollment chuyển sang `paid_waiting_cohort`
  - DB: `SELECT status, amount_paid, paid_at FROM enrollments WHERE id = '<enrollment_id>'` → `status = 'paid_waiting_cohort'`, `paid_at IS NOT NULL`

- [ ] **User nhận Zalo xác nhận thanh toán**
  - Làm: Admin confirm order
  - Đúng: User nhận Zalo: "✅ Thanh toán xác nhận! Bạn sẽ được thông báo ngày bắt đầu..."
  - DB: Không cần verify (kiểm tra Zalo)

- [ ] **Referrer nhận voucher 100K khi bạn bè thanh toán**
  - Làm: User B đăng ký qua ref code của User A → thanh toán
  - Đúng: User A nhận Zalo: "🎁 Bạn bè vừa đăng ký qua link của bạn! Voucher 100.000đ: V-XXXXX..." Voucher hạn 6 tháng.
  - DB: `SELECT * FROM referral_rewards WHERE referrer_id = '<user_a_id>' AND reward_type = 'credit'` → có record; `SELECT * FROM user_credits WHERE user_id = '<user_a_id>'` → có voucher credit

---

## 6. COHORT + TẬP LUYỆN

- [ ] **Admin mở cohort → enrollments status = 'active', current_day = 0**
  - Làm: Admin gọi POST `/api/admin/cohort/activate` với `cohort_id`
  - Đúng: Tất cả enrollments `paid_waiting_cohort` trong cohort → `active`, `current_day = 0`
  - DB: `SELECT status, current_day, started_at FROM enrollments WHERE cohort_id = '<cohort_id>' AND status = 'active'` → `current_day = 0`, `started_at` có giá trị

- [ ] **User nhận Zalo: "Cohort đã sẵn sàng!"**
  - Làm: Admin activate cohort
  - Đúng: Mỗi user nhận Zalo: "🚀 Ngày {date}, bạn bắt đầu Ngày 1 cùng {n} người! Sáng hôm đó bạn sẽ nhận tin nhắc tập đầu tiên. Chuẩn bị tinh thần nhé! 💪"
  - DB: Không cần verify (kiểm tra Zalo)

- [ ] **Dashboard hiện card "Bài tập hôm nay"**
  - Làm: Đăng nhập user có enrollment `active` trong cohort đang chạy
  - Đúng: DashboardHomeContent hiện Today's Workout card với day number, title, duration, workout type + link đến `/app/program/workout/{day}`
  - DB: `SELECT current_day FROM enrollments WHERE user_id = '<user_id>' AND status = 'active'`

- [ ] **Video Vimeo embed hiện đúng (CC-03 seed data)**
  - Làm: Vào trang workout của ngày hiện tại
  - Đúng: Video Vimeo render đúng trong iframe, không lỗi
  - DB: `SELECT hard_version, light_version FROM workout_templates WHERE program_id = '<program_id>' AND day_number = <day>` → JSON có `video_url` Vimeo

---

## 7. ZALO MESSAGING

- [ ] **Token chưa hết hạn**
  - Làm: Chạy `npx tsx scripts/test-zalo.ts` option 5 (check token)
  - Đúng: Token còn hạn, không cần refresh
  - DB: `SELECT expires_at FROM zalo_tokens ORDER BY created_at DESC LIMIT 1` → `expires_at > NOW()`

- [ ] **Verify code: gửi code → nhận "Xác minh thành công ✅"**
  - Làm: Gửi mã xác minh 5 ký tự (A-Z0-9) vào Zalo OA
  - Đúng: Nhận: "Xác minh thành công! ✅\nChào mừng bạn đến với BodiX..."
  - DB: `SELECT status FROM phone_verifications WHERE verify_code = '<code>'` → `verified`; `SELECT phone_verified, channel_user_id FROM profiles WHERE id = '<user_id>'` → `phone_verified = true`

- [ ] **Check-in: reply 3 → im lặng. Reply 2 → im lặng. Reply 1 → im lặng.**
  - Làm: Gửi "3", "2", hoặc "1" vào Zalo OA khi đang có enrollment active
  - Đúng: Không nhận tin phản hồi từ OA (im lặng). Check-in được lưu vào DB.
  - DB: `SELECT mode, day_number FROM daily_checkins WHERE enrollment_id = '<enrollment_id>' ORDER BY created_at DESC LIMIT 1` → mode = 'hard'/'light'/'easy'

- [ ] **Check-in trùng → "Bạn đã check-in ngày X rồi!"**
  - Làm: Gửi "3" lại lần 2 trong cùng ngày
  - Đúng: Nhận: "Bạn đã check-in ngày X rồi!"
  - DB: `SELECT count(*) FROM daily_checkins WHERE enrollment_id = '<enrollment_id>' AND day_number = <day>` → 1 (không tăng)

- [ ] **Reply không hợp lệ → ghi nhận câu hỏi**
  - Làm: Gửi text bất kỳ không match check-in keywords, không match verify code, không match feeling score
  - Đúng: Nhận: "Cảm ơn bạn! Mình đã ghi nhận và sẽ giải đáp trong video review cuối tuần nhé."
  - DB: `SELECT * FROM user_questions WHERE user_id = '<user_id>' ORDER BY created_at DESC LIMIT 1` → có record

- [ ] **Feeling score: reply 5 sau tin review → phản hồi phù hợp**
  - Làm: Khi có `weekly_reviews` row chưa có feeling_score → gửi "5" vào Zalo
  - Đúng: Nhận: "Tuyệt vời! Tuần tới sẽ còn tốt hơn nữa."
  - DB: `SELECT feeling_score, feeling_replied_at FROM weekly_reviews WHERE enrollment_id = '<enrollment_id>' ORDER BY week_number DESC LIMIT 1` → `feeling_score = 5`, `feeling_replied_at IS NOT NULL`

- [ ] **Feeling score thấp 2 tuần liên tiếp → dropout signal**
  - Làm: Reply feeling ≤ 2 trong 2 tuần liên tiếp
  - Đúng: Tự động tạo dropout signal
  - DB: `SELECT * FROM dropout_signals WHERE enrollment_id = '<enrollment_id>' AND signal_type = 'low_feeling_trend'` → có record với `risk_score = 70`

- [ ] **Check-in keywords đa dạng: HARD, H, 3, FULL, DONE, XONG, ✅, DA TAP → hard mode**
  - Làm: Gửi bất kỳ keyword trên vào Zalo
  - Đúng: Ghi nhận check-in mode = 'hard'
  - DB: `SELECT mode FROM daily_checkins WHERE enrollment_id = '<enrollment_id>' ORDER BY created_at DESC LIMIT 1` → `hard`

- [ ] **Hoàn thành chương trình qua Zalo → tin chúc mừng**
  - Làm: Check-in ngày cuối cùng của chương trình qua Zalo
  - Đúng: Nhận: "🏆 CHÚC MỪNG! Bạn đã hoàn thành {programName}!"
  - DB: `SELECT status FROM enrollments WHERE id = '<enrollment_id>'` → `completed`

---

## 8. CRON JOBS

- [ ] **Vercel Dashboard → Crons: hiện 2 cron jobs**
  - Làm: Vào Vercel Dashboard → Project → Settings → Crons
  - Đúng: Hiện 2 jobs: `/api/cron/morning-messages` (30 23 * * *) và `/api/cron/rescue-check` (0 15 * * *)
  - DB: Không cần verify (Vercel Dashboard check)

- [ ] **Test thủ công morning-messages**
  - Làm: `curl -H "Authorization: Bearer [CRON_SECRET]" https://bodix.fit/api/cron/morning-messages`
  - Đúng: Response 200 OK, tin nhắn đến Zalo của active users
  - DB: `SELECT * FROM nudge_logs WHERE nudge_type = 'morning_workout' ORDER BY created_at DESC LIMIT 5` → có records mới

- [ ] **Nội dung tin morning thân mật**
  - Làm: Kiểm tra tin nhắn Zalo nhận được từ morning cron
  - Đúng: Format: "Hi [tên]! 🌸 Ngày X/Y — hôm nay tập [focus] nhé!" + danh sách bài tập + link video + hướng dẫn check-in "3 → đủ 3 lượt, 2 → 2 lượt, 1 → 1 lượt"
  - DB: Không cần verify (kiểm tra Zalo)

- [ ] **Morning message có session mapping đúng**
  - Làm: Kiểm tra nội dung tin cho các ngày khác nhau
  - Đúng: Session A (Thân dưới: Squat, Lunge...), B (Thân trên: Push-up...), C (Cardio), D (Cơ trung tâm), E (Toàn thân), F (Giãn cơ) — đúng theo ngày
  - DB: Không cần verify (kiểm tra nội dung tin)

- [ ] **Test thủ công rescue-check**
  - Làm: `curl -H "Authorization: Bearer [CRON_SECRET]" https://bodix.fit/api/cron/rescue-check`
  - Đúng: Response 200 OK, users miss 2+ ngày nhận tin rescue
  - DB: `SELECT * FROM rescue_interventions ORDER BY created_at DESC LIMIT 5` → có records mới (nếu có user miss)

- [ ] **Recovery day → tin nhẹ nhàng**
  - Làm: Kiểm tra tin morning vào ngày recovery
  - Đúng: "Hi [tên]! 🧘 Ngày X/Y — hôm nay nhẹ nhàng thôi nha." + "Recovery giúp cơ thể phục hồi. 1 lượt (~7 phút)."
  - DB: Không cần verify (kiểm tra Zalo)

---

## 9. RESCUE

- [ ] **User miss 2 ngày → nhận tin rescue cấp 1 (nhẹ nhàng)**
  - Làm: User không check-in 2 ngày liên tiếp, đợi rescue-check cron chạy
  - Đúng: Nhận Zalo: "{name} ơi, mình thấy bạn chưa check-in 2 ngày rồi. Chỉ cần 1 lượt (~7 phút) là chuỗi ngày tập vẫn giữ. Nhắn 1 khi xong nha!"
  - DB: `SELECT * FROM nudge_logs WHERE user_id = '<user_id>' AND content_template = 'rescue_l1' ORDER BY created_at DESC LIMIT 1` → có record

- [ ] **User miss 3 ngày → nhận tin rescue cấp 2 (thông cảm)**
  - Làm: User không check-in 3 ngày liên tiếp
  - Đúng: Nhận Zalo: "{name} ơi, bạn đã đi được {completedDays} ngày rồi... Chỉ cần 1 lượt — 7 phút — chuỗi ngày tập vẫn giữ. Quan trọng là không dừng lại nha."
  - DB: `SELECT * FROM nudge_logs WHERE user_id = '<user_id>' AND content_template = 'rescue_l2' ORDER BY created_at DESC LIMIT 1` → có record

- [ ] **User miss 4+ ngày → BUDDY nhận tin nhắn nhờ động viên**
  - Làm: User không check-in 4+ ngày, có buddy trong cùng cohort
  - Đúng: Buddy nhận Zalo: "{buddyName} ơi, buddy {userName} đã nghỉ {daysMissed} ngày rồi. Bạn có thể nhắn hoặc gọi cho {userName} để động viên không? 🙏"
  - DB: `SELECT * FROM nudge_logs WHERE content_template = 'rescue_l3_buddy' ORDER BY created_at DESC LIMIT 1` → có record

- [ ] **Nếu không có buddy → rescue_interventions log cho admin**
  - Làm: User miss 4+ ngày, KHÔNG có buddy
  - Đúng: Không gửi tin cho ai, tạo intervention record cho admin xử lý
  - DB: `SELECT * FROM rescue_interventions WHERE enrollment_id = '<enrollment_id>' AND action_taken = 'coach_intervention'` → có record; `SELECT * FROM nudge_logs WHERE content_template = 'rescue_l3_no_buddy' AND delivered = false` → có record

- [ ] **Rescue cooldown: L1 không gửi lại trong 7 ngày**
  - Làm: Rescue L1 đã gửi → chạy rescue-check cron lại ngày hôm sau
  - Đúng: KHÔNG gửi tin rescue L1 lần nữa trong vòng 7 ngày
  - DB: `SELECT count(*) FROM nudge_logs WHERE user_id = '<user_id>' AND content_template = 'rescue_l1' AND created_at > NOW() - INTERVAL '7 days'` → 1

---

## 10. REFERRAL

- [ ] **Mã theo tên (NGUYENLAN hoặc tương tự)**
  - Làm: Hoàn thành onboarding step 5, kiểm tra mã được tạo tự động
  - Đúng: Mã referral tự sinh từ tên user (uppercase, bỏ dấu, bỏ khoảng trắng). Nếu trùng thì thêm số 1-9.
  - DB: `SELECT code FROM referral_codes WHERE owner_id = '<user_id>' AND code_type = 'referral'` → có mã tương ứng với tên

- [ ] **Link bodix.fit?ref=CODE mở được**
  - Làm: Mở `https://bodix.fit?ref=CODE` trong browser
  - Đúng: Landing page hiện bình thường, không 404
  - DB: Không cần verify (UI check)

- [ ] **Mở link trong incognito → RefCookieSetter hoạt động**
  - Làm: Mở link ref trong incognito browser
  - Đúng: RefCookieSetter set cookie `bodix_ref` 30 ngày + lưu localStorage + track click event qua POST `/api/referral/track`
  - DB: `SELECT * FROM referral_tracking WHERE referral_code_id = '<code_id>' AND status = 'clicked' ORDER BY created_at DESC LIMIT 1` → có record

- [ ] **Copy link hoạt động**
  - Làm: Bấm nút "Copy link" trong onboarding step 5 hoặc trang referral
  - Đúng: Clipboard có link đúng format `https://bodix.fit?ref=CODE`
  - DB: Không cần verify (clipboard check)

- [ ] **Chia sẻ Zalo: link đúng format**
  - Làm: Bấm nút "Chia sẻ Zalo" trong onboarding step 5
  - Đúng: Mở Zalo share với link `https://bodix.fit?ref=CODE` và tin nhắn giảm giá
  - DB: Không cần verify (Zalo check)

---

## 11. AFFILIATE

- [ ] **Dashboard → Profile → link "Trở thành Đối tác"**
  - Làm: Vào `/app/profile` với user chưa đăng ký affiliate
  - Đúng: Hiện CTA "Trở thành Đối tác — Nhận 40% hoa hồng →" link đến `/app/affiliate`
  - DB: `SELECT * FROM affiliate_profiles WHERE user_id = '<user_id>'` → 0 rows

- [ ] **Click → thông tin 40% hoa hồng + form nhập ngân hàng**
  - Làm: Vào `/app/affiliate` khi chưa đăng ký
  - Đúng: Hiện bảng hoa hồng (BodiX 21: ~200K, 6W: ~480K, 12W: ~800K) + form 3 trường: Tên ngân hàng, Số tài khoản, Tên chủ tài khoản
  - DB: Không cần verify (UI check)

- [ ] **Submit → affiliate_profiles.is_approved = true ngay (auto-approve)**
  - Làm: Điền form ngân hàng → bấm "Trở thành Đối tác ngay"
  - Đúng: API POST `/api/affiliate/apply` → auto-approve với `affiliate_tier = 'basic'` (40%)
  - DB: `SELECT is_approved, affiliate_tier, approved_at FROM affiliate_profiles WHERE user_id = '<user_id>'` → `is_approved = true`, `affiliate_tier = 'basic'`, `approved_at IS NOT NULL`

- [ ] **Nhận Zalo xác nhận đối tác**
  - Làm: Submit form affiliate
  - Đúng: Nhận Zalo: "🤝 Chúc mừng {name}! Bạn là Đối tác BodiX! Hoa hồng 40% cho mỗi đơn hàng qua link của bạn."
  - DB: Không cần verify (kiểm tra Zalo)

- [ ] **Menu "Đối tác" hiện trong sidebar sau khi đăng ký**
  - Làm: Refresh trang sau khi đăng ký affiliate thành công
  - Đúng: Sidebar hiện link "Đối tác" (`/app/affiliate`) — DashboardShell chỉ hiện khi `isAffiliate === true`
  - DB: `SELECT is_approved FROM affiliate_profiles WHERE user_id = '<user_id>'` → `true`

- [ ] **User thường KHÔNG thấy menu Đối tác**
  - Làm: Đăng nhập user chưa đăng ký affiliate
  - Đúng: Sidebar KHÔNG hiện link "Đối tác"
  - DB: `SELECT * FROM affiliate_profiles WHERE user_id = '<user_id>'` → 0 rows hoặc `is_approved = false`

- [ ] **Affiliate dashboard hiện stats + QR code + biểu đồ**
  - Làm: Vào `/app/affiliate` với user đã được duyệt
  - Đúng: Hiện 4 KPI cards (Doanh thu tháng, Hoa hồng tháng, Chờ thanh toán, Đã thanh toán) + mã referral + link + QR code + biểu đồ hàng tháng + bảng conversions
  - DB: `SELECT * FROM affiliate_profiles WHERE user_id = '<user_id>'`

---

## 12. BUDDY

- [ ] **Dashboard hiện BuddyCard**
  - Làm: Đăng nhập user có enrollment active trong cohort
  - Đúng: BuddyCard hiển thị (không hiện nếu không có cohort)
  - DB: `SELECT cohort_id FROM enrollments WHERE user_id = '<user_id>' AND status = 'active'` → có `cohort_id`

- [ ] **Chưa có buddy → "Tìm người đồng hành" + search + "Ghép ngẫu nhiên"**
  - Làm: User chưa có buddy, xem BuddyCard
  - Đúng: Hiện search input (debounce 300ms, min 2 ký tự) + nút "Ghép ngẫu nhiên"
  - DB: `SELECT * FROM buddy_pairs WHERE (user_a = '<user_id>' OR user_b = '<user_id>') AND status = 'active'` → 0 rows

- [ ] **Search tên → hiện kết quả cùng cohort**
  - Làm: Nhập tên (2+ ký tự) vào search
  - Đúng: Hiện danh sách user cùng cohort + nút "Chọn"
  - DB: Không cần verify (UI check, API GET `/api/buddy/search?q=...`)

- [ ] **Chọn buddy → buddy_pairs record**
  - Làm: Bấm "Chọn" trên kết quả search
  - Đúng: API POST `/api/buddy/choose` thành công
  - DB: `SELECT * FROM buddy_pairs WHERE (user_a = '<user_id>' OR user_b = '<user_id>') AND status = 'active'` → 1 row, `matched_by = 'manual'`

- [ ] **Có buddy → hiện tên + "Đã tập ✅" / "Chưa tập"**
  - Làm: User đã có buddy, check BuddyCard
  - Đúng: Hiện tên buddy + trạng thái check-in hôm nay + streak "🔥 X ngày"
  - DB: `SELECT * FROM daily_checkins WHERE enrollment_id = '<buddy_enrollment_id>' AND workout_date = CURRENT_DATE` → có row = "Đã tập ✅", không có = "Chưa tập"

- [ ] **Nút "Nhắc buddy" → buddy nhận Zalo**
  - Làm: Buddy chưa check-in hôm nay + có Zalo → bấm nút "Nhắc {buddyFirstName}"
  - Đúng: API POST `/api/buddy/nudge` → buddy nhận Zalo: "{buddyName} ơi, buddy {myName} đang chờ! Nhắn 1 để tập nha 💪"
  - DB: Không cần verify (kiểm tra Zalo của buddy)

- [ ] **Nút "Nhắc buddy" disabled sau khi nhắc**
  - Làm: Bấm "Nhắc buddy"
  - Đúng: Nút chuyển sang "Đã nhắc!" và disabled 5 giây
  - DB: Không cần verify (UI check)

---

## 13. UI/UX

- [ ] **Sidebar: "Giới thiệu bạn bè" (không phải "Giới thiệu")**
  - Làm: Kiểm tra sidebar trong DashboardShell
  - Đúng: Hiện "🎁 Giới thiệu bạn bè" với link `/app/referral`
  - DB: Không cần verify (UI check)

- [ ] **Sidebar: "Đối tác" chỉ hiện khi đã đăng ký affiliate**
  - Làm: Đăng nhập user thường → kiểm tra sidebar → đăng ký affiliate → kiểm tra lại
  - Đúng: Trước đăng ký: không hiện. Sau đăng ký: hiện "Đối tác" link `/app/affiliate`
  - DB: `SELECT is_approved FROM affiliate_profiles WHERE user_id = '<user_id>'`

- [ ] **Hồ sơ: hiện SĐT (ẩn), ngày sinh, giới tính, mục tiêu, vouchers**
  - Làm: Vào `/app/profile`
  - Đúng: SĐT masked "0123***890" + badge "✓ Đã xác minh", ngày sinh format "D tháng M, Y", giới tính (Nữ/Nam/Khác), mục tiêu fitness, danh sách vouchers (nếu có)
  - DB: `SELECT full_name, email, phone, phone_verified, date_of_birth, gender, fitness_goal FROM profiles WHERE id = '<user_id>'`

- [ ] **Vouchers: hiện mã, số dư còn lại, ngày hết hạn**
  - Làm: User có voucher → vào profile
  - Đúng: Hiện code monospace + remaining amount + expiration date. Tổng balance ở header badge.
  - DB: `SELECT code, remaining_amount, expires_at, status FROM user_credits WHERE user_id = '<user_id>' AND status = 'active'`

- [ ] **Cộng đồng: completion board "Hôm nay ai đã tập?"**
  - Làm: Vào `/app/community` tab "Bảng hoàn thành"
  - Đúng: Header "Hôm nay ai đã tập?" + progress bar "X/Y đã hoàn thành hôm nay" + danh sách đã tập (sorted: hard → light → recovery → skip) + danh sách "Đang chờ..." (opacity-60)
  - DB: `SELECT dc.*, p.full_name FROM daily_checkins dc JOIN profiles p ON dc.user_id = p.id WHERE dc.workout_date = CURRENT_DATE AND dc.enrollment_id IN (SELECT id FROM enrollments WHERE cohort_id = '<cohort_id>')`

- [ ] **Cộng đồng: Streak Leaderboard top 10**
  - Làm: Xem sidebar trên trang community
  - Đúng: Hiện 🥇🥈🥉 cho top 3 + số thứ tự cho người còn lại. Chỉ hiện members với streak > 0. Current user được highlight.
  - DB: `SELECT s.current_streak, p.full_name FROM streaks s JOIN enrollments e ON s.enrollment_id = e.id JOIN profiles p ON e.user_id = p.id WHERE e.cohort_id = '<cohort_id>' AND s.current_streak > 0 ORDER BY s.current_streak DESC LIMIT 10`

- [ ] **Cộng đồng: Bảng tin (Feed) + tạo bài đăng + reactions**
  - Làm: Vào tab "Bảng tin" → bấm "Chia sẻ" → chọn loại bài → nhập nội dung → post
  - Đúng: Bài đăng hiện với avatar + tên + thời gian + nội dung + reactions (❤️ 👏 🔥 💪)
  - DB: `SELECT * FROM community_posts WHERE cohort_id = '<cohort_id>' ORDER BY created_at DESC LIMIT 10`

- [ ] **Real-time: check-in mới hiện trên completion board**
  - Làm: User A check-in → User B đang xem community
  - Đúng: Board tự động cập nhật (Supabase realtime subscription trên `daily_checkins` INSERT)
  - DB: Không cần verify (UI real-time check)

- [ ] **Community badge: số thông báo chưa đọc**
  - Làm: Có bài đăng mới trong cohort → kiểm tra sidebar
  - Đúng: Badge số trên icon "Cộng đồng" trong sidebar (realtime subscription trên `notifications`)
  - DB: `SELECT count(*) FROM notifications WHERE user_id = '<user_id>' AND type = 'community_post' AND is_read = false`

---

## 14. ADMIN

- [ ] **Admin pages chỉ accessible role = 'admin'**
  - Làm: Truy cập `/admin` với user thường
  - Đúng: Redirect hoặc 403 error
  - DB: `SELECT role FROM profiles WHERE id = '<user_id>'` → phải là `'admin'`

- [ ] **Admin: Chọn user (trial_completed → pending_payment)**
  - Làm: POST `/api/admin/enrollment/select` với `enrollment_ids` của users có `status = 'trial_completed'`
  - Đúng: Response `{ selected: N, zalo_sent: M }`, enrollments chuyển status
  - DB: `SELECT status FROM enrollments WHERE id IN ('<ids>')` → tất cả `pending_payment`

- [ ] **Admin: Confirm order**
  - Làm: POST `/api/admin/confirm-order` với `order_code`
  - Đúng: Order `payment_status = 'paid'`, profile updated
  - DB: `SELECT payment_status, confirmed_at, confirmed_by FROM orders WHERE order_code = '<code>'` → `payment_status = 'paid'`

- [ ] **Admin: Mở cohort (gán users → active)**
  - Làm: POST `/api/admin/cohort/activate` với `cohort_id`
  - Đúng: Response `{ activated: N, cohort_status: 'active' }`, all paid_waiting_cohort → active
  - DB: `SELECT status FROM cohorts WHERE id = '<cohort_id>'` → `active`; `SELECT count(*) FROM enrollments WHERE cohort_id = '<cohort_id>' AND status = 'active'` → N

- [ ] **Admin: Rescue cấp 3 — danh sách user miss 4+ ngày**
  - Làm: Vào admin nudging page → risk monitor
  - Đúng: Hiện danh sách users với risk score cao, missed 4+ ngày
  - DB: `SELECT * FROM rescue_interventions WHERE action_taken = 'coach_intervention' AND outcome = 'pending' ORDER BY created_at DESC`

- [ ] **Admin: Manual intervention**
  - Làm: POST `/api/admin/nudging/manual-intervention` với `enrollment_id` + `message`
  - Đúng: Intervention record được tạo
  - DB: `SELECT * FROM rescue_interventions WHERE enrollment_id = '<enrollment_id>' AND trigger_reason = 'manual_coach' ORDER BY created_at DESC LIMIT 1`

- [ ] **Admin: Referral stats**
  - Làm: GET `/api/admin/referral/overview`
  - Đúng: Tổng quan referral: total clicks, signups, conversions, revenue
  - DB: `SELECT sum(total_clicks), sum(total_signups), sum(total_conversions) FROM referral_codes`

- [ ] **Admin: Affiliate danh sách + stats**
  - Làm: GET `/api/admin/affiliate`
  - Đúng: Danh sách affiliates với tier, total_earned, pending_balance, is_approved
  - DB: `SELECT * FROM affiliate_profiles ORDER BY total_earned DESC`

- [ ] **Admin: Dashboard KPIs**
  - Làm: Vào `/admin` với admin user
  - Đúng: Hiện KPI cards: D7 Adherence, Completion 21, Referral Share, NPS, Upgrade 21→6W, Churn Rate, Visible Change, Monthly Revenue
  - DB: `SELECT * FROM mv_cohort_analytics` và `SELECT * FROM mv_program_analytics`

---

## BẢNG TỔNG HỢP

| # | Category | Tests | Pass | Fail | Notes |
|---|----------|-------|------|------|-------|
| 1 | Đăng ký & Đăng nhập | 4 | | | |
| 2 | Onboarding (Smart Skip) | 10 | | | |
| 3 | Dashboard (chưa có enrollment) | 4 | | | |
| 4 | Trial 3 ngày | 10 | | | |
| 5 | Chờ được chọn + Thanh toán | 11 | | | |
| 6 | Cohort + Tập luyện | 4 | | | |
| 7 | Zalo Messaging | 9 | | | |
| 8 | Cron Jobs | 6 | | | |
| 9 | Rescue | 5 | | | |
| 10 | Referral | 5 | | | |
| 11 | Affiliate | 7 | | | |
| 12 | Buddy | 7 | | | |
| 13 | UI/UX | 9 | | | |
| 14 | Admin | 9 | | | |
| **TỔNG** | | **100** | | | |
