"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export function Bodix6wHero() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-primary-light to-neutral-50 py-12 md:py-20">
      <div className="container mx-auto max-w-[1200px] px-4 text-center">
        <motion.span
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-block rounded-full bg-primary/20 px-5 py-2 text-2xl font-semibold text-primary"
        >
          Chương trình 6 tuần
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-6 font-heading text-2xl font-bold text-primary md:text-3xl lg:text-4xl"
        >
          BodiX 6W – 6 tuần để bắt đầu thấy form rõ rệt
        </motion.h1>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 space-y-2 text-lg font-medium text-neutral-800 md:text-xl"
        >
          <p>Không còn chỉ là bắt đầu.</p>
          <p>Đây là giai đoạn cơ thể thay đổi thấy rõ.</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center"
        >
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-8 py-4 text-base font-semibold text-secondary-light transition-colors hover:bg-primary-dark"
          >
            Đăng ký miễn phí
          </Link>
          <Link
            href="#compare"
            className="inline-flex items-center justify-center rounded-lg border-2 border-primary px-8 py-4 text-base font-semibold text-primary transition-colors hover:bg-primary hover:text-secondary-light"
          >
            So sánh với BodiX 21 ↓
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
