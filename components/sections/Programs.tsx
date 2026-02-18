import { SectionHeading } from "@/components/ui/SectionHeading";
import { ProgramCard } from "@/components/ui/ProgramCard";
import { PROGRAMS } from "@/lib/constants";

export function Programs() {
  return (
    <section id="programs" className="py-12 md:py-20 lg:py-24 bg-secondary">
      <div className="container mx-auto px-4 sm:px-6">
        <SectionHeading
          title="Chọn hành trình phù hợp với bạn"
          subtitle="BodiX có 3 chương trình với độ dài và mục tiêu khác nhau. Dù bạn mới bắt đầu hay đã sẵn sàng cho thử thách lớn hơn, đều có chương trình dành cho bạn."
        />
        <div className="mt-8 sm:mt-12 grid gap-6 sm:gap-8 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {PROGRAMS.map((program) => (
            <ProgramCard
              key={program.id}
              name={program.name}
              duration={program.duration}
              tagline={program.tagline}
              description={program.description}
              features={program.features}
              cta={program.cta}
              href={program.slug}
              highlighted={program.highlighted}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
