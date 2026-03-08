"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export function Bodix12wHero() {
  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-neutral-800 to-neutral-900 py-12 md:py-20">
      <div className="container mx-auto max-w-[1200px] px-4 text-center">
        <motion.span
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-block rounded-full border border-white/30 bg-white/10 px-5 py-2 text-2xl font-semibold text-white"
        >
          Chương trình 12 tuần
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="mt-6 font-heading text-2xl font-bold text-white md:text-3xl lg:text-4xl"
        >
          BodiX 12W – 12 tuần để thay đổi rõ rệt
        </motion.h1>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 space-y-2 text-lg font-semibold text-white/90 md:text-xl"
        >
          <p>Không dành cho tất cả.</p>
          <p>Chỉ dành cho người sẵn sàng cam kết.</p>
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-10 flex flex-col gap-4 sm:flex-row sm:justify-center"
        >
          <Link
            href="/signup"
            className="inline-flex items-center justify-center rounded-lg bg-accent px-8 py-4 text-base font-bold text-white transition-colors hover:bg-accent-dark"
          >
            Bắt đầu hành trình
          </Link>
          <Link
            href="#requirements"
            className="inline-flex items-center justify-center rounded-lg border-2 border-white/50 px-8 py-4 text-base font-semibold text-white transition-colors hover:bg-white/10"
          >
            Xem điều kiện tham gia ↓
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
