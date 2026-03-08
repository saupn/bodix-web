import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

export async function POST(request: NextRequest) {
  let body: {
    full_name?: string;
    date_of_birth?: string | null;
    gender?: string;
    fitness_goal?: string[];
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: "Phiên đăng nhập hết hạn." },
      { status: 401 }
    );
  }

  const now = new Date();
  const trialEnds = new Date(now);
  trialEnds.setDate(trialEnds.getDate() + 3);

  const service = createServiceClient();
  const { error } = await service
    .from("profiles")
    .update({
      full_name: body.full_name?.trim() || null,
      date_of_birth: body.date_of_birth || null,
      gender: body.gender || null,
      fitness_goal: body.fitness_goal || [],
      onboarding_completed: true,
      trial_started_at: now.toISOString(),
      trial_ends_at: trialEnds.toISOString(),
    })
    .eq("id", user.id);

  if (error) {
    console.error("[complete-onboarding]", error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ success: true });
}
