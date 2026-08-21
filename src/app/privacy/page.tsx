import type { Metadata } from "next";
import { Section } from "@/components/ui";
import { site } from "@/data/site";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `How ${site.name} collects, uses and protects information submitted through this website.`,
  robots: { index: false, follow: true },
};

const sections = [
  {
    heading: "What we collect",
    body: [
      "We collect only what you choose to submit through the forms on this site: your name, email address, phone number, and the details you provide about a property, your timeline or your goals.",
      "Standard server logs (IP address, browser type, pages requested) are retained by our hosting provider for security and performance purposes.",
    ],
  },
  {
    heading: "How we use it",
    body: [
      "Information you submit is used to respond to your request — preparing a valuation, sending listing matches, scheduling a consultation — and to follow up about that request.",
      "We do not sell your information, and we do not share it with third-party lead-generation services.",
    ],
  },
  {
    heading: "Who we share it with",
    body: [
      "Information may be shared with service providers strictly as needed to serve you: our brokerage, a lender or title company you ask to be introduced to, or a transaction management platform used for your file.",
      "We may disclose information where required by law or by real estate licensing obligations in the State of Arizona.",
    ],
  },
  {
    heading: "Your choices",
    body: [
      "You may ask us at any time to correct or delete the information you have submitted, or to stop contacting you. Email the address below and we will act on the request promptly.",
      "By submitting a form you consent to be contacted about that request by email, phone or text. Message and data rates may apply. Reply STOP to any text message to opt out.",
    ],
  },
  {
    heading: "Cookies",
    body: [
      "This site uses only the cookies required for it to function. If analytics or advertising tools are added in the future, this policy will be updated before they are enabled.",
    ],
  },
  {
    heading: "Fair housing",
    body: [
      "We are committed to the letter and spirit of U.S. policy for the achievement of equal housing opportunity throughout the nation. We do not discriminate on the basis of race, color, religion, sex, handicap, familial status, national origin, or any other class protected under Arizona or federal law.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <Section>
      <div className="max-w-3xl">
        <p className="eyebrow text-gold">Legal</p>
        <h1 className="mt-3 font-serif text-4xl md:text-5xl">Privacy Policy</h1>
        <p className="mt-4 text-sm text-ink-soft">
          Last updated {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
        </p>

        <div className="mt-12 space-y-10">
          {sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-2xl">{section.heading}</h2>
              <div className="mt-3 space-y-3 leading-relaxed text-ink-soft">
                {section.body.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </section>
          ))}

          <section>
            <h2 className="text-2xl">Contact</h2>
            <p className="mt-3 leading-relaxed text-ink-soft">
              Questions about this policy can be directed to{" "}
              <a href={`mailto:${site.email}`} className="text-gold underline underline-offset-4">
                {site.email}
              </a>{" "}
              or {site.phone}.
            </p>
            <p className="mt-3 text-sm text-ink-soft">
              {site.name} · {site.brokerage} · {site.license}
            </p>
          </section>
        </div>
      </div>
    </Section>
  );
}
