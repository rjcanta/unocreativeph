import { ButtonLink, Section } from "@/components/ui";

export default function NotFound() {
  return (
    <Section>
      <div className="mx-auto max-w-xl py-16 text-center">
        <p className="eyebrow text-gold">404</p>
        <h1 className="mt-3 font-serif text-4xl md:text-5xl">
          This page has been taken off the market.
        </h1>
        <p className="mt-5 leading-relaxed text-ink-soft">
          The page you were looking for doesn&apos;t exist or has moved. Here&apos;s
          where most people are headed.
        </p>
        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/listings">Browse listings</ButtonLink>
          <ButtonLink href="/home-value" variant="outline">
            Get my home value
          </ButtonLink>
          <ButtonLink href="/" variant="outline">
            Back home
          </ButtonLink>
        </div>
      </div>
    </Section>
  );
}
