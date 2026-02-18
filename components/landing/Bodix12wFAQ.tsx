"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AnimatedSection } from "./AnimatedSection";
import { motion, AnimatePresence } from "framer-motion";

const faqs = [
  {
    question: "Có thể re-run chương trình không?",
    answer:
      "Có. Nhiều người chọn re-run 12W sau khi hoàn thành lần đầu, với cường độ cao hơn (tạ nặng hơn, tempo nhanh hơn). Mỗi lần run là một level mới.",
  },
  {
    question: "Nếu miss 1 buổi thì sao?",
    answer:
      "Bạn tập bù vào ngày review của tuần đó. Mỗi tuần có 1 ngày review có thể dùng làm buffer. Tuy nhiên, nếu miss nhiều hơn 1 buổi/tuần liên tục, hiệu quả sẽ giảm đáng kể.",
  },
  {
    question: "Có hỗ trợ trong quá trình tập không?",
    answer:
      "Có. Bạn sẽ được thêm vào nhóm Zalo riêng cho 12W với những người cùng tham gia. Có hệ thống check-in hàng ngày và hỗ trợ từ team BodiX.",
  },
  {
    question:
      "Nếu tôi chưa hoàn thành 21 hoặc 6W, có thể tham gia 12W không?",
    answer:
      "Có thể, nếu bạn đã có nền tảng tập luyện ổn định (ít nhất 2-3 tháng tập đều đặn). Tuy nhiên, khuyến nghị mạnh là hoàn thành ít nhất BodiX 21 để quen với triết lý Completion First.",
  },
  {
    question: "Cường độ có quá cao không?",
    answer:
      "Cao hơn 21 và 6W. Mỗi buổi 40-50 phút, 6 ngày/tuần. Tuy nhiên, bạn vẫn có mức Light và Recovery khi cần. Quan trọng là hoàn thành đủ 84 ngày.",
  },
  {
    question: "Chi phí như thế nào?",
    answer:
      "Chi phí 12 tuần vẫn rẻ hơn nhiều so với thuê PT trong 3 tháng. Xem chi tiết khi click đăng ký.",
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
    <div className="border-b border-neutral-400 last:border-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 py-4 text-left font-bold text-primary transition-colors hover:text-primary-dark"
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
            <p className="pb-4 text-neutral-700 leading-relaxed">{answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function Bodix12wFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="bg-secondary py-12 md:py-20">
      <div className="container mx-auto max-w-[1200px] px-4">
        <AnimatedSection>
          <SectionHeading title="Câu hỏi thường gặp về BodiX 12W" />
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
