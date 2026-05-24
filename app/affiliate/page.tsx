import type { Metadata } from "next";
import { AffiliateRegistrationClient } from "./AffiliateRegistrationClient";
import { AFFILIATE_COPY } from "@/lib/copy/affiliate";

export const metadata: Metadata = {
  title: "Chương trình Đối tác BodiX",
  description: AFFILIATE_COPY.metaDescription,
};

export default function AffiliateRegistrationPage() {
  return <AffiliateRegistrationClient />;
}
