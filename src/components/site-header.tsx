"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { navLinks, site } from "@/data/site";

export function SiteHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      <div className="hidden items-center justify-between bg-ink px-6 py-2 text-[0.688rem] tracking-wide text-white/70 md:flex lg:px-16">
        <span>
          {site.name} · {site.city}
        </span>
        <span className="flex items-center gap-5">
          <a className="hover:text-gold-light" href={site.phoneHref}>
            {site.phone}
          </a>
          <a className="hover:text-gold-light" href={`mailto:${site.email}`}>
            {site.email}
          </a>
        </span>
      </div>

      <header className="sticky top-0 z-50 border-b border-line bg-white/95 backdrop-blur">
        <div className="flex h-[74px] items-center justify-between px-6 lg:px-16">
          <Link href="/" className="shrink-0">
            <span className="block font-serif text-xl tracking-[0.13em] md:text-2xl">
              KELLY ROJAS
            </span>
            <span className="mt-1 block text-[0.5rem] tracking-[0.2em] text-gold">
              ARIZONA INTERNATIONAL REAL ESTATE
            </span>
          </Link>

          <nav className="hidden items-center gap-6 xl:flex">
            {navLinks.map((link) => {
              const active =
                pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`text-[0.813rem] transition-colors hover:text-gold ${
                    active ? "text-gold" : "text-ink"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href="/contact"
              className="hidden bg-ink px-5 py-3 text-[0.688rem] font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-gold md:inline-block"
            >
              Book a Consultation
            </Link>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? "Close menu" : "Open menu"}
              className="flex h-11 w-11 items-center justify-center border border-line xl:hidden"
            >
              <span className="relative block h-3.5 w-5">
                <span
                  className={`absolute left-0 block h-px w-5 bg-ink transition-transform ${
                    open ? "top-1.5 rotate-45" : "top-0"
                  }`}
                />
                <span
                  className={`absolute left-0 top-1.5 block h-px w-5 bg-ink transition-opacity ${
                    open ? "opacity-0" : "opacity-100"
                  }`}
                />
                <span
                  className={`absolute left-0 block h-px w-5 bg-ink transition-transform ${
                    open ? "top-1.5 -rotate-45" : "top-3"
                  }`}
                />
              </span>
            </button>
          </div>
        </div>

        {open ? (
          <nav
            id="mobile-nav"
            className="border-t border-line bg-white px-6 pb-8 pt-4 xl:hidden"
          >
            <ul className="flex flex-col">
              {navLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="block border-b border-line py-4 font-serif text-lg"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
              <li>
                <Link
                  href="/calculators"
                  className="block border-b border-line py-4 font-serif text-lg"
                >
                  Mortgage Calculator
                </Link>
              </li>
            </ul>
            <Link
              href="/contact"
              className="mt-6 block bg-ink px-5 py-4 text-center text-[0.688rem] font-bold uppercase tracking-[0.14em] text-white"
            >
              Book a Consultation
            </Link>
            <a
              href={site.phoneHref}
              className="mt-3 block border border-line px-5 py-4 text-center text-[0.688rem] font-bold uppercase tracking-[0.14em]"
            >
              Call {site.phone}
            </a>
          </nav>
        ) : null}
      </header>
    </>
  );
}
