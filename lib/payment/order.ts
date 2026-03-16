import crypto from "crypto";

export function generateOrderCode(): string {
  const timestamp = Date.now().toString().slice(-6);
  const random = crypto.randomInt(100, 999);
  return "BDX" + timestamp + random;
}
