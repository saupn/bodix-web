import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { redirect } from "next/navigation";
import OnboardingForm from "./onboarding-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function OnboardingPage() {
  // Auth check with session-aware client
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // Profile check with service client (bypasses RLS)
  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("onboarding_completed, full_name")
    .eq("id", user.id)
    .single();

  console.log("[onboarding/page] user:", user.id, "onboarding_completed:", profile?.onboarding_completed);

  // Đã onboard → redirect /app
  if (profile?.onboarding_completed === true) {
    redirect("/app");
  }

  return (
    <OnboardingForm
      userId={user.id}
      initialName={profile?.full_name || user.user_metadata?.full_name || ""}
    />
  );
}
