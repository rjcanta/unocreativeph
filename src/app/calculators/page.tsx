import type { Metadata } from "next";
import { MortgageCalculator } from "@/components/mortgage-calculator";
import { Faq } from "@/components/faq";
import { CtaBand, PageHero, Section, SectionHeading } from "@/components/ui";

export const metadata: Metadata = {
  title: "Mortgage Calculator",
  description:
    "Estimate your full monthly payment — principal, interest, Arizona property taxes, insurance, PMI and HOA — with an interactive Phoenix mortgage calculator.",
};

const costs = [
  {
    title: "Down payment",
    body: "3% to 20%+ of the purchase price. Conventional starts at 3%, FHA at 3.5%, VA and USDA at zero for qualifying buyers.",
  },
  {
    title: "Closing costs",
    body: "Roughly 2% to 3% of the loan for a buyer in Arizona: lender fees, title, escrow, appraisal and recording.",
  },
  {
    title: "Prepaid escrows",
    body: "Lenders collect several months of taxes and a year of homeowners insurance up front at closing.",
  },
  {
    title: "Inspections",
    body: "$400 to $900 for a general inspection, plus sewer scope, roof, pool or termite where the property warrants it.",
  },
  {
    title: "Property taxes",
    body: "Maricopa County effective rates run near 0.6% of value annually — well below the national average.",
  },
  {
    title: "Insurance & HOA",
    body: "Budget $1,200 to $2,500 a year for homeowners insurance. HOA dues in the metro commonly run $80 to $400 a month.",
  },
];

const faqs = [
  {
    question: "How much house can I actually afford?",
    answer:
      "Lenders typically want your total monthly debt under 43% of gross income, and housing alone under about 28%. That's their ceiling, not your target. I'd rather see clients buy comfortably below the maximum approval — the approval number assumes nothing else in your life ever changes.",
  },
  {
    question: "What's included in the payment this calculator shows?",
    answer:
      "Principal and interest, property taxes, homeowners insurance, PMI when you're under 20% down, and HOA dues if you enter them. That's the full monthly figure most buyers actually care about, rather than the P&I number most calculators show alone.",
  },
  {
    question: "When does PMI go away?",
    answer:
      "On a conventional loan, you can request removal at 20% equity and it's automatically cancelled at 22%. FHA loans originated after 2013 with less than 10% down carry mortgage insurance for the life of the loan — refinancing out is usually the only exit.",
  },
  {
    question: "Should I buy points to lower my rate?",
    answer:
      "It depends on how long you'll hold the loan. Divide the cost of the points by the monthly savings to get your break-even in months. If you'd sell or refinance before then, skip it. Bring me the loan estimate and we'll do that math together.",
  },
  {
    question: "Is a 15-year mortgage worth it?",
    answer:
      "The interest savings are substantial — often hundreds of thousands over the loan. The payment is also considerably higher, and that inflexibility matters. A middle path many clients take: a 30-year loan with voluntary extra principal payments, keeping the option to stop in a lean year.",
  },
];

export default function CalculatorsPage() {
  return (
    <>
      <PageHero
        eyebrow="Interactive tools"
        title={
          <>
            What will it actually
            <span className="block text-gold-light">cost per month?</span>
          </>
        }
        intro="Most calculators show you principal and interest and stop there. This one includes Arizona property taxes, insurance, PMI and HOA — the number that actually hits your account."
        image="https://images.unsplash.com/photo-1554224155-6726b3ff858f?auto=format&fit=crop&w=1800&q=85"
      />

      <Section>
        <MortgageCalculator />
      </Section>

      <Section className="bg-sand">
        <SectionHeading
          eyebrow="Beyond the payment"
          title="What buying actually costs"
          intro="The monthly payment is one line. These are the others worth planning for."
        />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {costs.map((cost) => (
            <div key={cost.title} className="border border-line bg-white p-6">
              <h3 className="text-xl">{cost.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{cost.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading eyebrow="Financing questions" title="What people ask me" align="left" />
        <Faq items={faqs} />
      </Section>

      <CtaBand
        eyebrow="Next step"
        title="Want the real number?"
        intro="I'll introduce you to two or three lenders worth comparing and help you read the loan estimates side by side."
        primary={{ href: "/contact", label: "Request lender introductions" }}
        secondary={{ href: "/buy", label: "Start my home search" }}
      />
    </>
  );
}
