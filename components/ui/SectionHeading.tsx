interface SectionHeadingProps {
  title: string;
  subtitle?: string;
  className?: string;
}

export function SectionHeading({ title, subtitle, className = "" }: SectionHeadingProps) {
  return (
    <div className={`text-center ${className}`}>
      <h2 className="font-heading text-2xl font-bold text-primary sm:text-3xl md:text-4xl">
        {title}
      </h2>
      {subtitle && (
        <p className="mt-3 max-w-2xl mx-auto text-neutral-600 text-base sm:text-lg px-2">
          {subtitle}
        </p>
      )}
    </div>
  );
}
