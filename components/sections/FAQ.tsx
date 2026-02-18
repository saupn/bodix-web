import { SectionHeading } from "@/components/ui/SectionHeading";
import { FAQItem } from "@/components/ui/FAQItem";
import { FAQS } from "@/lib/constants";

export function FAQ() {
  return (
    <section id="faq" className="py-12 md:py-20 lg:py-24 bg-secondary">
      <div className="container mx-auto px-4 sm:px-6">
        <SectionHeading title="Câu hỏi thường gặp" />
        <div className="mt-8 sm:mt-12 max-w-[800px] mx-auto">
          {FAQS.map((faq) => (
            <FAQItem
              key={faq.question}
              question={faq.question}
              answer={faq.answer}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
