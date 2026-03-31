import type { Metadata } from "next";
import { Montserrat, Playfair_Display } from "next/font/google";
import "./globals.css";
import { Suspense } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { RefCookieSetter } from "@/components/referral/RefCookieSetter";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin", "vietnamese"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair-display",
  subsets: ["latin", "vietnamese"],
});

export const metadata: Metadata = {
  title: "BodiX - Completion First Fitness",
  description: "Không phải tập cho vui. Tập để hoàn thành. Chương trình tập luyện fitness cho phụ nữ Việt Nam.",
  icons: {
    icon: "/images/logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body
        className={`${montserrat.variable} ${playfairDisplay.variable} font-body antialiased`}
      >
        <a href="#main-content" className="sr-only">
          Bỏ qua đến nội dung chính
        </a>
        <Suspense>
          <RefCookieSetter />
        </Suspense>
        <ToastProvider>{children}</ToastProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
