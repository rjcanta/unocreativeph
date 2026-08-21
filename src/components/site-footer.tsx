import Link from "next/link";
import { footerColumns, site } from "@/data/site";

export function SiteFooter() {
  return (
    <footer className="bg-[#0d0d0d] px-6 pb-10 pt-16 text-white/60 md:px-10 lg:px-16">
      <div className="mx-auto max-w-6xl">
        <div className="grid gap-10 border-b border-white/10 pb-12 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className="block font-serif text-xl tracking-[0.13em] text-white">
              KELLY ROJAS
            </span>
            <span className="mt-1 block text-[0.5rem] tracking-[0.2em] text-gold">
              ARIZONA INTERNATIONAL REAL ESTATE
            </span>
            <p className="mt-5 max-w-xs text-sm leading-relaxed">
              Helping individuals, families and investors make smarter real estate
              decisions throughout Greater Phoenix.
            </p>
            <div className="mt-5 space-y-1 text-sm">
              <a className="block hover:text-gold-light" href={site.phoneHref}>
                {site.phone}
              </a>
              <a className="block hover:text-gold-light" href={`mailto:${site.email}`}>
                {site.email}
              </a>
            </div>
          </div>

          {footerColumns.map((column) => (
            <div key={column.title}>
              <p className="eyebrow text-white">{column.title}</p>
              <ul className="mt-5 space-y-3 text-sm">
                {column.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="hover:text-gold-light">
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-3 pt-8 text-xs md:flex-row md:items-center md:justify-between">
          <p>
            © {new Date().getFullYear()} {site.name} · {site.brokerage}
          </p>
          <p>{site.license} · Equal Housing Opportunity</p>
        </div>
      </div>
    </footer>
  );
}
