import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";

/**
 * Layout khu quản trị — route group `(admin)`, KHÔNG lồng trong `(dashboard)`.
 * Trước đây /admin nằm ở app/(dashboard)/admin nên DashboardShell bọc AdminShell
 * → hiện 2 left menu chồng nhau. Tách sang (admin) để chỉ còn đúng 1 menu admin.
 *
 * Bảo vệ 2 lớp: proxy.ts (edge) chặn /admin khi chưa đăng nhập; layout này chặn
 * user không phải role='admin'.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/app");
  }

  return <AdminShell>{children}</AdminShell>;
}
