"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AnimatedSection } from "./AnimatedSection";
import { motion, AnimatePresence } from "framer-motion";

const faqs = [
  {
    question: "Có cần hoàn thành BodiX 21 trước không?",
    answer:
      "Khuyến nghị có. Nếu bạn chưa từng hoàn thành một chương trình tập luyện nào, BodiX 21 sẽ giúp bạn xây nền tảng kỷ luật trước. Tuy nhiên, nếu bạn đã có nền tảng tập luyện ổn định (3-4 buổi/tuần trong ít nhất 1 tháng), bạn có thể bắt đầu trực tiếp với 6W.",
  },
  {
    question: "Cường độ có cao không?",
    answer:
      "Cao hơn BodiX 21. Mỗi buổi tập khoảng 30-40 phút, với tempo nhanh hơn và thời gian nghỉ ngắn hơn. Tuy nhiên, bạn vẫn có thể chọn mức Light trong những ngày cần thiết.",
  },
  {
    question: "Nếu mệt có được chọn Light không?",
    answer:
      "Được. Triết lý Completion First vẫn áp dụng trong 6W. Tuy nhiên, để đạt kết quả tốt nhất, bạn nên tập mức Hard ít nhất 70% số buổi.",
  },
  {
    question: "Có cần dụng cụ gì không?",
    answer:
      "Cần thảm tập và tạ nhẹ (1-3kg mỗi bên). Nếu không có tạ, có thể thay bằng chai nước đầy.",
  },
  {
    question: "Mỗi ngày tập bao lâu?",
    answer:
      "Mức Hard khoảng 35-40 phút. Mức Light khoảng 25-30 phút.",
  },
];

function FAQItem({
  question,
  answer,
  isOpen,
  onToggle,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border-b border-neutral-300 last:border-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 py-4 text-left font-semibold text-primary transition-colors hover:text-primary-dark"
      >
        {question}
        <ChevronDown
          className={`h-5 w-5 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <p className="pb-4 text-neutral-600 leading-relaxed">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Bodix6wFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="bg-secondary py-12 md:py-20">
      <div className="container mx-auto max-w-[1200px] px-4">
        <AnimatedSection>
          <SectionHeading title="Câu hỏi thường gặp về BodiX 6W" />
        </AnimatedSection>
        <div className="mx-auto mt-12 max-w-2xl">
          {faqs.map((faq, index) => (
            <FAQItem
              key={faq.question}
              question={faq.question}
              answer={faq.answer}
              isOpen={openIndex === index}
              onToggle={() => setOpenIndex(openIndex === index ? null : index)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
