import type { Metadata } from "next";
import Link from "next/link";
import { LeadForm } from "@/components/lead-form";
import { Eyebrow, PageHero, Section } from "@/components/ui";
import { site } from "@/data/site";

export const metadata: Metadata = {
  title: "Contact Kelly Rojas",
  description:
    "Get in touch with Kelly Rojas about buying, selling, investing or commercial real estate in Greater Phoenix.",
};

const quickLinks = [
  {
    href: "/home-value",
    title: "I want to know what my home is worth",
    body: "Two-minute form, written valuation within one business day.",
  },
  {
    href: "/buy",
    title: "I'm looking to buy",
    body: "Send your criteria and get curated matches, including off-market.",
  },
  {
    href: "/sell",
    title: "I'm thinking about selling",
    body: "Request a listing consultation and a net-proceeds estimate.",
  },
  {
    href: "/commercial",
    title: "I have a commercial question",
    body: "Acquisitions, dispositions, leasing and 1031 exchanges.",
  },
];

export default function ContactPage() {
  return (
    <>
      <PageHero
        eyebrow="Get in touch"
        title={
          <>
            Let&apos;s start with
            <span className="block text-gold-light">a conversation.</span>
          </>
        }
        intro="No pressure, no obligation and no call center. Every message comes directly to me, and I respond within one business day."
        image="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1800&q=85"
      />

      <Section>
        <div className="grid gap-10 lg:grid-cols-[1.15fr_0.85fr] lg:items-start">
          <div>
            <Eyebrow tone="ink">Send a message</Eyebrow>
            <h2 className="mt-3 text-3xl md:text-4xl">How can I help?</h2>
            <p className="mt-4 max-w-xl leading-relaxed text-ink-soft">
              Tell me a bit about your situation and what you&apos;re trying to
              accomplish. The more context you give me, the more useful my first
              response will be.
            </p>
            <div className="mt-8">
              <LeadForm
                type="contact"
                submitLabel="Send message"
                extraFields={[
                  {
                    name: "topic",
                    label: "What's this about?",
                    type: "select",
                    options: [
                      "Buying a home",
                      "Selling a home",
                      "Home valuation",
                      "Investment property",
                      "Commercial real estate",
                      "Relocation",
                      "Something else",
                    ],
                  },
                  {
                    name: "preferredContact",
                    label: "Best way to reach you",
                    type: "select",
                    options: ["Email", "Phone call", "Text message"],
                  },
                ]}
              />
            </div>
          </div>

          <aside className="space-y-4 lg:sticky lg:top-28">
            <div className="bg-ink p-7 text-white">
              <p className="eyebrow text-gold-light">Direct contact</p>
              <a
                href={site.phoneHref}
                className="mt-4 block font-serif text-3xl hover:text-gold-light"
              >
                {site.phone}
              </a>
              <a
                href={`mailto:${site.email}`}
                className="mt-3 block break-all text-sm text-white/70 hover:text-gold-light"
              >
                {site.email}
              </a>
              <div className="mt-6 border-t border-white/15 pt-5 text-sm text-white/60">
                <p>{site.brokerage}</p>
                <p className="mt-1">{site.city}</p>
                <p className="mt-3">{site.license}</p>
              </div>
              <div className="mt-6 border-t border-white/15 pt-5">
                <p className="eyebrow text-gold-light">Typical hours</p>
                <p className="mt-3 text-sm text-white/70">
                  Mon–Fri 8am–6pm · Sat 9am–4pm
                  <br />
                  Sunday by appointment
                </p>
              </div>
            </div>

            <div className="border border-line bg-white p-7">
              <p className="eyebrow text-gold">Or jump straight to it</p>
              <ul className="mt-4 divide-y divide-line">
                {quickLinks.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="group block py-4">
                      <span className="block font-serif text-lg group-hover:text-gold">
                        {link.title}
                      </span>
                      <span className="mt-1 block text-sm text-ink-soft">
                        {link.body}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </aside>
        </div>
      </Section>
    </>
  );
}
