import type { Metadata } from "next";
import { Montserrat, Playfair_Display } from "next/font/google";
import "./globals.css";

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
        {children}
      </body>
    </html>
  );
}
