"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

interface FAQItemProps {
  question: string;
  answer: string;
}

export function FAQItem({ question, answer }: FAQItemProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-neutral-300 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-4 py-3 sm:py-4 text-left text-sm sm:text-base font-medium text-primary hover:text-primary-dark transition-colors"
      >
        {question}
        <ChevronDown
          className={`h-5 w-5 shrink-0 text-primary transition-transform ${isOpen ? "rotate-180" : ""}`}
        />
      </button>
      {isOpen && (
        <div className="pb-4 text-sm sm:text-base text-neutral-600 leading-relaxed">{answer}</div>
      )}
    </div>
  );
}
