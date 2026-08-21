import Link from "next/link";
import type { ReactNode } from "react";

export function Eyebrow({
  children,
  tone = "gold",
}: {
  children: ReactNode;
  tone?: "gold" | "ink";
}) {
  return (
    <p className={`eyebrow ${tone === "gold" ? "text-gold-light" : "text-gold"}`}>
      {children}
    </p>
  );
}

export function Section({
  children,
  className = "",
  id,
}: {
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`px-6 py-20 md:px-10 md:py-24 lg:px-16 ${className}`}>
      <div className="mx-auto max-w-6xl">{children}</div>
    </section>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  intro,
  align = "center",
  tone = "ink",
}: {
  eyebrow?: string;
  title: string;
  intro?: string;
  align?: "center" | "left";
  tone?: "ink" | "light";
}) {
  return (
    <div
      className={
        align === "center"
          ? "mx-auto mb-12 max-w-2xl text-center"
          : "mb-12 max-w-2xl"
      }
    >
      {eyebrow ? (
        <p className={`eyebrow ${tone === "light" ? "text-gold-light" : "text-gold"}`}>
          {eyebrow}
        </p>
      ) : null}
      <h2
        className={`mt-3 text-3xl leading-tight md:text-4xl lg:text-[2.75rem] ${
          tone === "light" ? "text-white" : "text-ink"
        }`}
      >
        {title}
      </h2>
      {intro ? (
        <p
          className={`mt-4 text-[0.975rem] leading-relaxed ${
            tone === "light" ? "text-white/70" : "text-ink-soft"
          }`}
        >
          {intro}
        </p>
      ) : null}
    </div>
  );
}

type ButtonVariant = "gold" | "dark" | "outline" | "light";

const buttonStyles: Record<ButtonVariant, string> = {
  gold: "bg-gold text-white hover:bg-[#a3763a]",
  dark: "bg-ink text-white hover:bg-black",
  outline: "border border-ink/25 text-ink hover:border-ink hover:bg-ink hover:text-white",
  light: "border border-white/50 text-white hover:bg-white hover:text-ink",
};

export function ButtonLink({
  href,
  children,
  variant = "gold",
  className = "",
}: {
  href: string;
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
}) {
  const classes = `inline-flex items-center justify-center px-6 py-3.5 text-[0.688rem] font-bold uppercase tracking-[0.14em] transition-colors ${buttonStyles[variant]} ${className}`;

  if (href.startsWith("http") || href.startsWith("mailto:") || href.startsWith("tel:")) {
    return (
      <a href={href} className={classes}>
        {children}
      </a>
    );
  }

  return (
    <Link href={href} className={classes}>
      {children}
    </Link>
  );
}

export function StatBand({
  stats,
}: {
  stats: readonly { readonly value: string; readonly label: string }[];
}) {
  return (
    <section className="grid grid-cols-2 border-y border-line bg-white lg:grid-cols-4">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="border-b border-line px-6 py-8 text-center last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0 [&:nth-child(2)]:lg:border-r [&:nth-child(2n)]:border-r-0 [&:nth-child(2n)]:lg:border-r"
        >
          <p className="font-serif text-[2.25rem] leading-none text-ink">{stat.value}</p>
          <p className="eyebrow mt-3 text-ink-soft">{stat.label}</p>
        </div>
      ))}
    </section>
  );
}

export function CtaBand({
  eyebrow = "Let's build your future",
  title = "Ready to take the next step?",
  intro = "Whether you're buying, selling, investing or exploring commercial real estate, start with a strategy conversation — no pressure, no obligation.",
  primary = { href: "/contact", label: "Book a Consultation" },
  secondary = { href: "/home-value", label: "Get My Home Value" },
}: {
  eyebrow?: string;
  title?: string;
  intro?: string;
  primary?: { href: string; label: string };
  secondary?: { href: string; label: string } | null;
}) {
  return (
    <section className="bg-ink px-6 py-20 text-center md:px-10 md:py-24">
      <div className="mx-auto max-w-2xl">
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className="mt-3 text-3xl text-white md:text-[2.75rem]">{title}</h2>
        <p className="mt-4 leading-relaxed text-white/70">{intro}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink href={primary.href}>{primary.label}</ButtonLink>
          {secondary ? (
            <ButtonLink href={secondary.href} variant="light">
              {secondary.label}
            </ButtonLink>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function Card({
  title,
  children,
  href,
  index,
}: {
  title: string;
  children: ReactNode;
  href?: string;
  index?: string;
}) {
  const inner = (
    <div className="flex h-full flex-col border border-line bg-white p-7 transition-colors hover:border-gold">
      {index ? <span className="eyebrow text-gold">{index}</span> : null}
      <h3 className="mt-2 text-2xl">{title}</h3>
      <p className="mt-3 text-sm leading-relaxed text-ink-soft">{children}</p>
      {href ? (
        <span className="mt-auto pt-5 text-[0.688rem] font-bold uppercase tracking-[0.14em] text-gold">
          Learn more →
        </span>
      ) : null}
    </div>
  );

  return href ? (
    <Link href={href} className="h-full">
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function PageHero({
  eyebrow,
  title,
  intro,
  image,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  intro?: string;
  image: string;
  children?: ReactNode;
}) {
  return (
    <section
      className="relative flex min-h-[380px] items-center px-6 py-20 md:min-h-[440px] md:px-10 md:py-24 lg:px-16"
      style={{
        backgroundImage: `linear-gradient(90deg, rgba(0,0,0,0.85), rgba(0,0,0,0.45)), url('${image}')`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      <div className="mx-auto w-full max-w-6xl">
        <div className="max-w-2xl text-white">
          <Eyebrow>{eyebrow}</Eyebrow>
          <h1 className="mt-4 font-serif text-4xl leading-[1.05] md:text-5xl lg:text-[3.5rem]">
            {title}
          </h1>
          {intro ? (
            <p className="mt-5 text-base leading-relaxed text-white/80">{intro}</p>
          ) : null}
          {children ? <div className="mt-8 flex flex-wrap gap-3">{children}</div> : null}
        </div>
      </div>
    </section>
  );
}
