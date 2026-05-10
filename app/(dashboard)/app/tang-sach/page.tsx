import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import { GiftBookContent } from "@/components/dashboard/GiftBookContent";

export const dynamic = "force-dynamic";

export default async function TangSachDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("full_name, referral_code, gift_remaining, gift_total")
    .eq("id", user.id)
    .single();

  // Fallback: nếu profile.referral_code null, kiểm tra referral_codes table
  let referralCode: string | null = profile?.referral_code ?? null;
  if (!referralCode) {
    const { data: existingRef } = await service
      .from("referral_codes")
      .select("code")
      .eq("user_id", user.id)
      .eq("code_type", "referral")
      .maybeSingle();
    if (existingRef?.code) {
      referralCode = existingRef.code;
      await service
        .from("profiles")
        .update({ referral_code: existingRef.code })
        .eq("id", user.id);
    }
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://bodix.fit";
  const total = profile?.gift_total ?? 10;
  const remaining = profile?.gift_remaining ?? 10;

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        href="/app"
        className="mb-4 inline-flex items-center gap-1 text-sm text-neutral-600 hover:text-primary"
      >
        <ChevronLeft className="h-4 w-4" />
        Quay lại
      </Link>

      <h1 className="font-heading text-2xl font-bold text-primary sm:text-3xl">
        📚 Tặng sách cho bạn bè
      </h1>
      <p className="mt-2 text-neutral-600">
        Chia sẻ sách &quot;Tại sao nhịn ăn không giúp bạn gọn hơn&quot; cho bạn bè – hoàn toàn miễn phí.
      </p>

      <div className="mt-6">
        <GiftBookContent
          fullName={profile?.full_name ?? null}
          referralCode={referralCode}
          remaining={remaining}
          total={total}
          baseUrl={baseUrl}
        />
      </div>
    </div>
  );
}
