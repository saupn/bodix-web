import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { REFERRAL_COPY } from "@/lib/copy/referral";
import { AFFILIATE_COPY } from "@/lib/copy/affiliate";

function maskPhone(phone: string): string {
  if (phone.length < 6) return phone;
  return phone.slice(0, 4) + "***" + phone.slice(-3);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("vi-VN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const GENDER_LABEL: Record<string, string> = {
  female: "Nữ",
  male: "Nam",
  other: "Khác",
};

/**
 * fitness_goal đến ở 3 dạng do lịch sử lưu data:
 *   - Array (vd ["Giảm mỡ", "Tăng sức bền"]) — onboarding gửi multi-select array
 *   - JSON string (vd '["Giảm mỡ", ...]') — Postgres coerce array vào cột text
 *   - Plain text (vd "Giảm mỡ") — single value cũ
 * Helper trả về mảng các goal đã parse sạch.
 */
function parseFitnessGoals(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string" && v.trim() !== "");
  }
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.filter(
            (v): v is string => typeof v === "string" && v.trim() !== "",
          );
        }
      } catch {
        // not valid JSON — fall through
      }
    }
    // Postgres array literal "{a,b}" — Supabase trả về raw nếu cột là text[]
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      return trimmed
        .slice(1, -1)
        .split(",")
        .map((s) => s.replace(/^"(.*)"$/, "$1").trim())
        .filter(Boolean);
    }
    return [trimmed];
  }
  return [];
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const service = createServiceClient();

  const [{ data: profile }, { data: vouchers }, { data: affiliateProfile }] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, email, phone, phone_verified, date_of_birth, gender, fitness_goal")
      .eq("id", user.id)
      .single(),
    service
      .from("vouchers")
      .select("id, code, amount, remaining_amount, status, expires_at")
      .eq("user_id", user.id)
      .in("status", ["active"])
      .order("created_at", { ascending: false })
      .limit(10),
    service
      .from("affiliate_profiles")
      .select("id, is_approved")
      .eq("user_id", user.id)
      .eq("is_approved", true)
      .maybeSingle(),
  ]);

  const totalVoucherBalance = (vouchers ?? []).reduce(
    (sum, v) => sum + (v.remaining_amount ?? 0),
    0
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
          Hồ sơ
        </h1>
        <p className="mt-1 text-neutral-600">Thông tin tài khoản của bạn.</p>
      </div>

      {/* Thông tin cá nhân */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6">
        <h2 className="font-heading text-base font-semibold text-primary mb-4">
          Thông tin cá nhân
        </h2>
        <dl className="space-y-4">
          <div>
            <dt className="text-sm font-medium text-neutral-600">Họ tên</dt>
            <dd className="mt-1 text-neutral-800">
              {profile?.full_name || user.user_metadata?.full_name || "–"}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-neutral-600">Email</dt>
            <dd className="mt-1 text-neutral-800">{user.email}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-neutral-600">Số điện thoại</dt>
            <dd className="mt-1 flex items-center gap-2 text-neutral-800">
              {profile?.phone ? maskPhone(profile.phone) : "–"}
              {profile?.phone_verified && (
                <span className="inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
                  ✓ Đã xác minh
                </span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-neutral-600">Ngày sinh</dt>
            <dd className="mt-1 text-neutral-800">
              {profile?.date_of_birth ? formatDate(profile.date_of_birth) : "–"}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-neutral-600">Giới tính</dt>
            <dd className="mt-1 text-neutral-800">
              {profile?.gender ? (GENDER_LABEL[profile.gender] ?? profile.gender) : "–"}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-neutral-600">Mục tiêu</dt>
            <dd className="mt-1 text-neutral-800">
              {(() => {
                const goals = parseFitnessGoals(profile?.fitness_goal);
                return goals.length > 0 ? goals.join(", ") : "–";
              })()}
            </dd>
          </div>
        </dl>
      </section>

      {/* Vouchers */}
      <section className="rounded-xl border border-neutral-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-base font-semibold text-primary">
            Voucher
          </h2>
          {totalVoucherBalance > 0 && (
            <span className="rounded-full bg-success/15 px-3 py-1 text-sm font-medium text-success">
              Số dư: {totalVoucherBalance.toLocaleString("vi-VN")}đ
            </span>
          )}
        </div>
        {!vouchers?.length ? (
          <p className="py-4 text-center text-sm text-neutral-600">
            {REFERRAL_COPY.emptyVouchersOnProfile}
          </p>
        ) : (
          <ul className="space-y-3">
            {vouchers.map((v) => (
              <li
                key={v.id}
                className="flex items-center justify-between rounded-lg border border-neutral-200 px-4 py-3"
              >
                <div>
                  <p className="font-mono text-sm font-semibold text-primary">{v.code}</p>
                  <p className="mt-0.5 text-xs text-neutral-600">
                    Còn {(v.remaining_amount ?? 0).toLocaleString("vi-VN")}đ
                    {v.expires_at && (
                      <> – HSD: {new Date(v.expires_at).toLocaleDateString("vi-VN")}</>
                    )}
                  </p>
                </div>
                <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-xs font-medium text-success">
                  Active
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Actions */}
      <div className="flex flex-wrap gap-3">
        <Link
          href="/app/profile/notifications"
          className="inline-flex items-center rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:border-primary hover:text-primary"
        >
          Cài đặt thông báo
        </Link>
      </div>

      {/* Affiliate link */}
      {!affiliateProfile && (
        <div className="border-t border-neutral-200 pt-6">
          <Link
            href="/app/affiliate"
            className="inline-flex items-center rounded-lg border-2 border-primary/20 bg-primary/5 px-4 py-3 text-sm font-medium text-primary transition-colors hover:border-primary/40 hover:bg-primary/10"
          >
            Trở thành Đối tác – Nhận {AFFILIATE_COPY.commissionRateDisplay} hoa hồng &rarr;
          </Link>
        </div>
      )}
    </div>
  );
}
