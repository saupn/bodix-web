import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, phone, date_of_birth, gender, fitness_goal")
    .eq("id", user.id)
    .single();

  return (
    <div>
      <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
        Hồ sơ
      </h1>
      <p className="mt-4 text-neutral-600">
        Thông tin tài khoản của bạn.
      </p>
      <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-6">
        <dl className="space-y-4">
          <div>
            <dt className="text-sm font-medium text-neutral-500">Họ tên</dt>
            <dd className="mt-1 text-neutral-800">
              {profile?.full_name || user.user_metadata?.full_name || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-neutral-500">Email</dt>
            <dd className="mt-1 text-neutral-800">{user.email}</dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-neutral-500">Số điện thoại</dt>
            <dd className="mt-1 text-neutral-800">
              {profile?.phone || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-neutral-500">Ngày sinh</dt>
            <dd className="mt-1 text-neutral-800">
              {profile?.date_of_birth || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-neutral-500">Giới tính</dt>
            <dd className="mt-1 text-neutral-800">
              {profile?.gender === "female"
                ? "Nữ"
                : profile?.gender === "male"
                ? "Nam"
                : profile?.gender === "other"
                ? "Khác"
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-sm font-medium text-neutral-500">Mục tiêu</dt>
            <dd className="mt-1 text-neutral-800">
              {Array.isArray(profile?.fitness_goal) && profile.fitness_goal.length > 0
                ? profile.fitness_goal.join(", ")
                : "—"}
            </dd>
          </div>
        </dl>
      </div>
      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/app/profile/notifications"
          className="inline-flex items-center rounded-lg border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 transition-colors hover:border-primary hover:text-primary"
        >
          Cài đặt thông báo
        </Link>
      </div>

      {/* Affiliate link */}
      <div className="mt-8 border-t border-neutral-200 pt-6">
        <Link
          href="/affiliate"
          className="text-sm text-neutral-500 hover:text-primary transition-colors"
        >
          Trở thành đối tác BodiX &rarr;
        </Link>
      </div>
    </div>
  );
}
