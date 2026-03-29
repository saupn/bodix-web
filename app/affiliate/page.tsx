import type { Metadata } from "next";
import { AffiliateRegistrationClient } from "./AffiliateRegistrationClient";

export const metadata: Metadata = {
  title: "Chương trình Đối tác BodiX",
  description: "Nhận 40% hoa hồng cho mỗi người đăng ký thành công qua bạn. Dành cho PT, KOL, blogger, chủ phòng gym.",
};

export default function AffiliateRegistrationPage() {
  return <AffiliateRegistrationClient />;
}
