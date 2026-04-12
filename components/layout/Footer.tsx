import Link from "next/link";
import { FOOTER_DATA } from "@/lib/constants";

export function Footer() {
  return (
    <footer className="bg-neutral-800 text-white">
      <div className="container mx-auto px-4 sm:px-6 py-12 sm:py-16">
        <div className="grid gap-8 sm:gap-12 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
          {/* Brand */}
          <div>
            <Link href="/" className="font-heading text-xl font-bold">
              {FOOTER_DATA.brand.name}
            </Link>
            <p className="mt-2 text-sm text-neutral-400">
              {FOOTER_DATA.brand.tagline}
            </p>
          </div>

          {/* Columns */}
          {FOOTER_DATA.columns.map((column) => (
            <div key={column.title}>
              <h4 className="font-heading text-sm font-semibold uppercase tracking-wider text-neutral-300">
                {column.title}
              </h4>
              <ul className="mt-4 space-y-2">
                {column.links.map((link) => {
                  const openInNewTab = link.href.startsWith("http");
                  return (
                    <li key={link.label}>
                      <Link
                        href={link.href}
                        {...(openInNewTab
                          ? {
                              target: "_blank",
                              rel: "noopener noreferrer",
                            }
                          : {})}
                        className="text-sm text-neutral-400 hover:text-white transition-colors"
                      >
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        <p className="mt-12 pt-8 border-t border-neutral-700 text-center text-sm text-neutral-500">
          {FOOTER_DATA.copyright}
        </p>
      </div>
    </footer>
  );
}
