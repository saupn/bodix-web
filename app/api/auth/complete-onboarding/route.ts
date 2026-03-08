import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (raw.startsWith("+84") && digits.length === 11) return `+84${digits.slice(2)}`;
  if (digits.startsWith("0") && digits.length === 10) return `+84${digits.slice(1)}`;
  if (digits.length === 9) return `+84${digits}`;
  return null;
}

export async function POST(request: NextRequest) {
  let body: {
    full_name?: string;
    date_of_birth?: string | null;
    gender?: string;
    fitness_goal?: string[];
    phone?: string | null;
    phone_verified?: boolean;
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

  // Build update object — always include phone if provided
  const updateData: Record<string, unknown> = {
    full_name: body.full_name?.trim() || null,
    date_of_birth: body.date_of_birth || null,
    gender: body.gender || null,
    fitness_goal: body.fitness_goal || [],
    onboarding_completed: true,
    trial_started_at: now.toISOString(),
    trial_ends_at: trialEnds.toISOString(),
  };

  if (body.phone) {
    const normalizedPhone = normalizePhone(body.phone);
    if (normalizedPhone) {
      updateData.phone = normalizedPhone;
      updateData.phone_verified = body.phone_verified ?? false;
    }
  }

  const { error } = await service
    .from("profiles")
    .update(updateData)
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
