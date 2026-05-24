"use client";

import Link from "next/link";
import Image from "next/image";
import { AFFILIATE_COPY } from "@/lib/copy/affiliate";

const COPY = AFFILIATE_COPY.publicRegistration;

export function AffiliateRegistrationClient() {
  return (
    <div className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex h-14 max-w-3xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2">
            <Image
              src="/images/logo.png"
              alt="BodiX"
              width={100}
              height={34}
              className="object-contain"
            />
          </Link>
          <Link
            href="/login?next=/app/affiliate"
            className="text-sm font-medium text-primary hover:underline"
          >
            Đăng nhập
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10">
        {/* Hero */}
        <div className="text-center">
          <h1 className="font-heading text-3xl font-bold text-primary sm:text-4xl">
            {COPY.heroTitle}
          </h1>
          <p className="mt-3 text-lg text-neutral-600">{COPY.heroSubtitle()}</p>
        </div>

        {/* Benefits */}
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {COPY.benefits.map((b, i) => (
            <div
              key={i}
              className="rounded-xl border border-neutral-200 bg-white p-5 text-center"
            >
              <p className="text-3xl font-bold text-primary">{b.big}</p>
              <p className="mt-1 text-sm text-neutral-600">{b.small}</p>
            </div>
          ))}
        </div>

        {/* 3 bước nhận hoa hồng */}
        <section className="mt-10 rounded-xl border border-neutral-200 bg-white p-6">
          <h2 className="font-heading text-lg font-semibold text-primary">
            Quy trình nhận hoa hồng
          </h2>
          <ol className="mt-4 space-y-4">
            {AFFILIATE_COPY.flowSteps.map((step, i) => (
              <li key={i} className="flex gap-4">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {i + 1}
                </span>
                <div className="flex-1">
                  <p className="font-medium text-neutral-800">{step.title}</p>
                  <p className="mt-1 text-sm text-neutral-600">{step.body}</p>
                  <span className="mt-2 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                    {step.pillLabel}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </section>

        {/* Audience */}
        <div className="mt-8 rounded-xl border border-neutral-200 bg-white p-6">
          <h2 className="font-heading text-lg font-semibold text-primary">
            {COPY.audienceTitle}
          </h2>
          <ul className="mt-3 space-y-2 text-neutral-600">
            {COPY.audienceList.map((item, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="mt-0.5 text-primary">&#x2713;</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        {/* Điều kiện chi tiết */}
        <details className="mt-8 rounded-xl border border-neutral-200 bg-white p-6">
          <summary className="cursor-pointer list-none font-heading font-semibold text-primary marker:hidden">
            <span className="inline-flex items-center gap-2">
              <span className="text-neutral-400">▸</span>
              Điều kiện chi tiết
            </span>
          </summary>
          <ul className="mt-4 space-y-2 text-sm text-neutral-700">
            {AFFILIATE_COPY.conditions.map((c, i) => (
              <li key={i} className="flex gap-2">
                <span className="mt-1 text-primary">•</span>
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </details>

        {/* FAQ */}
        <section className="mt-8 rounded-xl border border-neutral-200 bg-white p-6">
          <h2 className="mb-4 font-heading text-lg font-semibold text-primary">
            Câu hỏi thường gặp
          </h2>
          <div className="space-y-2">
            {AFFILIATE_COPY.faq.map((item, i) => (
              <details
                key={i}
                className="rounded-lg border border-neutral-100 px-4 py-3 open:bg-neutral-50"
              >
                <summary className="cursor-pointer list-none text-sm font-medium text-neutral-800 marker:hidden">
                  <span className="inline-flex items-center gap-2">
                    <span className="text-neutral-400">▸</span>
                    {item.q}
                  </span>
                </summary>
                <p className="mt-2 pl-5 text-sm text-neutral-600">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="mt-10 rounded-xl border-2 border-primary/20 bg-primary/5 p-6 text-center">
          <p className="font-heading text-xl font-semibold text-primary">
            Sẵn sàng trở thành Đối tác BodiX?
          </p>
          <p className="mt-2 text-sm text-neutral-600">
            Đăng ký 1 click trong dashboard sau khi đăng nhập. Tự động duyệt
            ngay – không cần chờ xét.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/signup?next=/app/affiliate"
              className="inline-flex w-full items-center justify-center rounded-xl bg-primary px-6 py-3.5 font-semibold text-secondary-light transition-colors hover:bg-primary-dark sm:w-auto"
            >
              {COPY.submitButton}
            </Link>
            <Link
              href="/login?next=/app/affiliate"
              className="inline-flex w-full items-center justify-center rounded-xl border border-primary px-6 py-3.5 font-semibold text-primary transition-colors hover:bg-primary/5 sm:w-auto"
            >
              Đã có tài khoản – Đăng nhập
            </Link>
          </div>
        </div>

        <p className="mt-8 text-center text-sm text-neutral-400">
          Có câu hỏi? Liên hệ{" "}
          <a
            href="mailto:partner@bodix.fit"
            className="text-primary hover:underline"
          >
            partner@bodix.fit
          </a>
        </p>
      </main>
    </div>
  );
}
