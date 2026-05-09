import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getSePayQRUrl, SEPAY_CONFIG } from "@/lib/sepay";
import { PaymentClient } from "./PaymentClient";

const PROGRAM_NAME: Record<string, string> = {
  "bodix-21": "BodiX 21",
  "bodix-6w": "BodiX 6W",
  "bodix-12w": "BodiX 12W",
  bodix21: "BodiX 21",
  bodix6w: "BodiX 6W",
  bodix12w: "BodiX 12W",
};

export default async function SePayCheckoutPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const numericId = Number(orderId);
  if (!Number.isFinite(numericId) || numericId <= 0) redirect("/app");

  const service = createServiceClient();

  const { data: order } = await service
    .from("orders")
    .select(
      "id, user_id, program, amount, payment_status, payment_code, payment_sequence, sepay_paid_at, created_at",
    )
    .eq("id", numericId)
    .maybeSingle();

  if (!order || order.user_id !== user.id) redirect("/app");

  if (order.payment_status === "paid") {
    redirect(`/checkout/success?order=${order.id}`);
  }

  if (!order.payment_code) {
    redirect("/app");
  }

  const programName = PROGRAM_NAME[order.program] ?? order.program;
  const qrUrl = getSePayQRUrl(order.amount, order.payment_code, "compact");

  return (
    <PaymentClient
      orderId={String(order.id)}
      paymentCode={order.payment_code}
      amount={order.amount}
      programName={programName}
      qrUrl={qrUrl}
      bankAccount={SEPAY_CONFIG.bankAccount}
      bankCode={SEPAY_CONFIG.bankCode}
      bankAccountName={SEPAY_CONFIG.bankAccountName}
    />
  );
}
