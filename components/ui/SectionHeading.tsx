interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function SectionHeading({ title, subtitle, className = "" }: SectionHeadingProps) {
  return (
    <div className={`text-center ${className}`}>
      <h2 className="font-heading text-lg font-bold text-primary sm:text-xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-3 max-w-2xl mx-auto text-neutral-800 text-base sm:text-lg px-2">
          {subtitle}
        </p>
      )}
    </div>
  );
}
