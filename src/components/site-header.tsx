"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { isNavGroup, navLinks, site, type NavLeaf } from "@/data/site";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteHeader() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Any navigation closes everything.
  useEffect(() => {
    setMobileOpen(false);
    setOpenGroup(null);
  }, [pathname]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  // Escape closes the open dropdown; a click outside the nav does too.
  useEffect(() => {
    if (!openGroup) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenGroup(null);
    }
    function onPointerDown(event: PointerEvent) {
      if (!navRef.current?.contains(event.target as Node)) setOpenGroup(null);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [openGroup]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  }, []);

  function openNow(label: string) {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpenGroup(label);
  }

  // A small delay stops the menu vanishing while the pointer crosses the gap
  // between the trigger and the panel.
  function closeSoon() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setOpenGroup(null), 120);
  }

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

          <nav ref={navRef} className="hidden items-center gap-1 lg:flex">
            {navLinks.map((item) => {
              if (!isNavGroup(item)) {
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`px-4 py-2 text-[0.875rem] transition-colors hover:text-gold ${
                      isActive(pathname, item.href) ? "text-gold" : "text-ink"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              }

              const groupActive = item.items.some((child) =>
                isActive(pathname, child.href),
              );
              const expanded = openGroup === item.label;

              return (
                <div
                  key={item.label}
                  className="relative"
                  onMouseEnter={() => openNow(item.label)}
                  onMouseLeave={closeSoon}
                >
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-haspopup="true"
                    onClick={() =>
                      setOpenGroup(expanded ? null : item.label)
                    }
                    className={`flex items-center gap-1.5 px-4 py-2 text-[0.875rem] transition-colors hover:text-gold ${
                      groupActive || expanded ? "text-gold" : "text-ink"
                    }`}
                  >
                    {item.label}
                    <svg
                      viewBox="0 0 12 8"
                      aria-hidden="true"
                      className={`h-2 w-2 fill-current transition-transform ${
                        expanded ? "rotate-180" : ""
                      }`}
                    >
                      <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.5" fill="none" />
                    </svg>
                  </button>

                  {expanded ? (
                    <div className="absolute left-0 top-full w-[19rem] border border-line bg-white p-2 shadow-[0_18px_40px_-24px_rgba(0,0,0,0.4)]">
                      {item.items.map((child: NavLeaf) => (
                        <Link
                          key={child.href}
                          href={child.href}
                          className={`block px-4 py-3 transition-colors hover:bg-cream ${
                            isActive(pathname, child.href) ? "bg-cream" : ""
                          }`}
                        >
                          <span
                            className={`block font-serif text-lg ${
                              isActive(pathname, child.href) ? "text-gold" : "text-ink"
                            }`}
                          >
                            {child.label}
                          </span>
                          {child.description ? (
                            <span className="mt-0.5 block text-xs leading-relaxed text-ink-soft">
                              {child.description}
                            </span>
                          ) : null}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </div>
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
              onClick={() => setMobileOpen((v) => !v)}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav"
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              className="flex h-11 w-11 items-center justify-center border border-line lg:hidden"
            >
              <span className="relative block h-3.5 w-5">
                <span
                  className={`absolute left-0 block h-px w-5 bg-ink transition-transform ${
                    mobileOpen ? "top-1.5 rotate-45" : "top-0"
                  }`}
                />
                <span
                  className={`absolute left-0 top-1.5 block h-px w-5 bg-ink transition-opacity ${
                    mobileOpen ? "opacity-0" : "opacity-100"
                  }`}
                />
                <span
                  className={`absolute left-0 block h-px w-5 bg-ink transition-transform ${
                    mobileOpen ? "top-1.5 -rotate-45" : "top-3"
                  }`}
                />
              </span>
            </button>
          </div>
        </div>

        {mobileOpen ? (
          <nav
            id="mobile-nav"
            className="max-h-[calc(100vh-74px)] overflow-y-auto border-t border-line bg-white px-6 pb-8 pt-2 lg:hidden"
          >
            {navLinks.map((item) =>
              isNavGroup(item) ? (
                <div key={item.label} className="border-b border-line py-4">
                  <p className="eyebrow text-gold">{item.label}</p>
                  <ul className="mt-2">
                    {item.items.map((child) => (
                      <li key={child.href}>
                        <Link href={child.href} className="block py-2 font-serif text-lg">
                          {child.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <Link
                  key={item.href}
                  href={item.href}
                  className="block border-b border-line py-4 font-serif text-lg"
                >
                  {item.label}
                </Link>
              ),
            )}

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
