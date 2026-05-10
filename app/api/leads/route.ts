import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

function isValidVnPhone(raw: string): boolean {
  const digits = raw.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 11 && digits.startsWith("0");
}

function formatPhoneStorage(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (!isValidVnPhone(raw)) return null;
  return `84${digits.slice(1)}`;
}

export async function POST(request: NextRequest) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = json as { phone?: unknown; source?: unknown };
  const phoneRaw = typeof body.phone === "string" ? body.phone.trim() : "";
  const source = typeof body.source === "string" ? body.source : "landing_lead_form";

  if (!phoneRaw || !isValidVnPhone(phoneRaw)) {
    return NextResponse.json({ error: "Invalid phone" }, { status: 400 });
  }

  const formattedPhone = formatPhoneStorage(phoneRaw);
  if (!formattedPhone) {
    return NextResponse.json({ error: "Invalid phone" }, { status: 400 });
  }

  const service = createServiceClient();

  const { error } = await service.from("leads").insert({
    phone: formattedPhone,
    email: null,
    source,
  });

  if (error) {
    console.error("[leads] insert:", error);
    return NextResponse.json({ error: "Save failed" }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
