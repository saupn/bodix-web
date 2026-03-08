"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export function Bodix21Hero() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-neutral-50 to-secondary-light py-12 md:py-20">
      <div className="container mx-auto max-w-[1200px] px-4 text-center">
        <motion.span
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-block rounded-full bg-secondary px-5 py-2 text-2xl font-medium text-primary"
        >
          Chương trình 21 ngày
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-6 font-heading text-2xl font-bold text-primary md:text-3xl lg:text-4xl"
        >
          BodiX 21 – 21 ngày để cơ thể bắt đầu thay đổi
        </motion.h1>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 space-y-2 text-lg text-neutral-700 md:text-xl"
        >
          <p>Không cần phòng gym.</p>
          <p>Không cần động lực bùng nổ.</p>
          <p>Chỉ cần bạn hoàn thành mỗi ngày.</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center"
        >
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-8 py-4 text-base font-medium text-secondary-light transition-colors hover:bg-primary-dark"
          >
            Đăng ký miễn phí
          </Link>
          <Link
            href="#video"
            className="inline-flex items-center justify-center rounded-lg border-2 border-primary px-8 py-4 text-base font-medium text-primary transition-colors hover:bg-primary hover:text-secondary-light"
          >
            Xem video giới thiệu ↓
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
