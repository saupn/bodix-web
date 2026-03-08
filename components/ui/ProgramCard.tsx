import Link from "next/link";
import { Check } from "lucide-react";

interface ProgramCardProps {
  name: string;
  duration: string;
  tagline: string;
  description: string;
  features: readonly string[];
  cta: string;
  href: string;
  highlighted?: boolean;
}

export function ProgramCard({
  name,
  duration,
  tagline,
  description,
  features,
  cta,
  href,
  highlighted = false,
}: ProgramCardProps) {
  return (
    <div
      className={`rounded-xl border-2 bg-white p-4 sm:p-6 shadow-sm transition-all duration-200 card-lift ${
        highlighted
          ? "border-accent"
          : "border-neutral-200"
      }`}
    >
      <div className="flex items-baseline justify-between">
        <h3 className="font-heading text-lg sm:text-xl font-semibold text-primary">
          {name}
        </h3>
        <span className="text-sm font-medium text-accent">{duration}</span>
      </div>
      <p className="mt-1 text-sm text-neutral-500">{tagline}</p>
      <p className="mt-3 sm:mt-4 text-neutral-600 text-sm sm:text-base leading-relaxed">{description}</p>
      <ul className="mt-6 space-y-2">
        {features.map((feature) => (
          <li key={feature} className="flex items-start gap-2 text-xs sm:text-sm text-neutral-600">
            <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            {feature}
          </li>
        ))}
      </ul>
      <div className="mt-8">
        <Link
          href={href}
          className={`inline-flex items-center justify-center rounded-lg px-5 py-2.5 text-sm font-medium transition-colors ${
            highlighted
              ? "bg-primary text-secondary-light hover:bg-primary-dark"
              : "border-2 border-primary text-primary hover:bg-primary hover:text-secondary-light"
          }`}
        >
          {cta}
        </Link>
      </div>
    </div>
  );
}
