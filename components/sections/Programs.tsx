import { SectionHeading } from "@/components/ui/SectionHeading";
import { ProgramCard } from "@/components/ui/ProgramCard";
import { PROGRAMS } from "@/lib/constants";

export function Programs() {
  return (
    <section id="programs" className="py-10 md:py-12 lg:py-16 bg-secondary">
      <div className="container mx-auto px-4 sm:px-6">
        <SectionHeading
          title="3 hành trình – Chọn hành trình phù hợp với bạn"
        />
        <div className="mt-8 sm:mt-12 grid gap-6 sm:gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {PROGRAMS.map((program) => (
            <ProgramCard
              key={program.id}
              name={program.name}
              duration={program.duration}
              badge={program.badge}
              tagline={program.tagline}
              description={program.description}
              features={program.features}
              cta={program.cta}
              href="/signup"
              highlighted={program.highlighted}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
