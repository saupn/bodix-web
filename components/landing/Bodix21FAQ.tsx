"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { AnimatedSection } from "./AnimatedSection";
import { motion, AnimatePresence } from "framer-motion";

const faqs = [
  {
    question: "Có cần đến phòng gym không?",
    answer:
      "Không. BodiX 21 được thiết kế để tập hoàn toàn tại nhà. Bạn không cần bất kỳ thiết bị nào – chỉ cần một khoảng trống đủ để bạn nằm xuống và dang tay.",
  },
  {
    question: "Nếu hôm nào bận quá thì sao?",
    answer:
      "Bạn chọn mức Light hoặc Easy – chỉ mất 10-14 phút. Quan trọng là bạn vẫn hoàn thành ngày đó, giữ được chuỗi. Một buổi tập ngắn vẫn tốt hơn một buổi tập bị bỏ.",
  },
  {
    question: "Tôi chưa từng tập luyện, có theo được không?",
    answer:
      "Được. BodiX 21 được thiết kế cho người mới. Mỗi động tác đều có hướng dẫn chi tiết, và bạn luôn có thể chọn mức nhẹ hơn nếu cần.",
  },
  {
    question: "Mỗi ngày tập bao lâu?",
    answer:
      "Mức Hard (3 lượt) khoảng 21 phút. Mức Light (2 lượt) khoảng 14 phút. Mức Easy (1 lượt) khoảng 7 phút. Tất cả đã bao gồm khởi động và giãn cơ.",
  },
  {
    question: "Tôi nhận bài tập như thế nào?",
    answer:
      "Sau khi đăng ký, bạn sẽ được thêm vào nhóm Zalo. Mỗi ngày bạn nhận được tin nhắn nhắc tập và link đến video bài tập của ngày hôm đó.",
  },
  {
    question: "Chi phí bao nhiêu?",
    answer:
      "Chi phí cả chương trình 21 ngày không bằng một buổi tập với PT. Xem chi tiết khi click đăng ký.",
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
    <div className="border-b border-neutral-200 last:border-0">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-4 py-4 text-left font-medium text-primary transition-colors hover:text-primary-dark"
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

export function Bodix21FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faq" className="bg-white py-12 md:py-20">
      <div className="container mx-auto max-w-[1200px] px-4">
        <AnimatedSection>
          <SectionHeading title="Câu hỏi thường gặp về BodiX 21" />
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
