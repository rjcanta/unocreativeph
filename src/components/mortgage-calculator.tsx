"use client";

import { useMemo, useState } from "react";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function MortgageCalculator({
  initialPrice = 650000,
}: {
  initialPrice?: number;
}) {
  const [price, setPrice] = useState(initialPrice);
  const [downPercent, setDownPercent] = useState(20);
  const [rate, setRate] = useState(6.5);
  const [years, setYears] = useState(30);
  const [taxRate, setTaxRate] = useState(0.62); // Maricopa County effective average
  const [insurance, setInsurance] = useState(1500);
  const [hoa, setHoa] = useState(0);

  const result = useMemo(() => {
    const down = (price * downPercent) / 100;
    const principal = Math.max(price - down, 0);
    const monthlyRate = rate / 100 / 12;
    const payments = years * 12;

    const principalAndInterest =
      monthlyRate === 0
        ? principal / payments
        : (principal * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -payments));

    const monthlyTax = (price * (taxRate / 100)) / 12;
    const monthlyInsurance = insurance / 12;
    // Conventional PMI applies below 20% down; ~0.6% of the loan annually.
    const monthlyPmi = downPercent < 20 ? (principal * 0.006) / 12 : 0;

    const total =
      principalAndInterest + monthlyTax + monthlyInsurance + monthlyPmi + hoa;
    const totalInterest = principalAndInterest * payments - principal;

    return {
      down,
      principal,
      principalAndInterest,
      monthlyTax,
      monthlyInsurance,
      monthlyPmi,
      total,
      totalInterest,
    };
  }, [price, downPercent, rate, years, taxRate, insurance, hoa]);

  const breakdown = [
    { label: "Principal & interest", value: result.principalAndInterest, color: "bg-gold" },
    { label: "Property taxes", value: result.monthlyTax, color: "bg-gold-light" },
    { label: "Homeowners insurance", value: result.monthlyInsurance, color: "bg-white/70" },
    ...(result.monthlyPmi > 0
      ? [{ label: "Mortgage insurance (PMI)", value: result.monthlyPmi, color: "bg-white/40" }]
      : []),
    ...(hoa > 0 ? [{ label: "HOA dues", value: hoa, color: "bg-white/20" }] : []),
  ];

  return (
    <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
      <div className="border border-line bg-white p-6 md:p-8">
        <p className="eyebrow text-gold">Adjust the numbers</p>
        <h3 className="mt-2 text-2xl">Your scenario</h3>

        <div className="mt-7 space-y-7">
          <Slider
            label="Home price"
            value={price}
            min={100000}
            max={5000000}
            step={5000}
            display={currency.format(price)}
            onChange={setPrice}
          />
          <Slider
            label="Down payment"
            value={downPercent}
            min={0}
            max={50}
            step={0.5}
            display={`${downPercent}% · ${currency.format(result.down)}`}
            onChange={setDownPercent}
          />
          <Slider
            label="Interest rate"
            value={rate}
            min={2}
            max={12}
            step={0.05}
            display={`${rate.toFixed(2)}%`}
            onChange={setRate}
          />

          <div>
            <span className="label">Loan term</span>
            <div className="flex flex-wrap gap-2">
              {[15, 20, 30].map((term) => (
                <button
                  key={term}
                  type="button"
                  onClick={() => setYears(term)}
                  className={`border px-5 py-2.5 text-sm transition-colors ${
                    years === term
                      ? "border-gold bg-gold text-white"
                      : "border-line hover:border-ink/30"
                  }`}
                >
                  {term} years
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <div>
              <label className="label" htmlFor="taxRate">
                Tax rate (%)
              </label>
              <input
                id="taxRate"
                className="field"
                type="number"
                step="0.01"
                value={taxRate}
                onChange={(e) => setTaxRate(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="label" htmlFor="insurance">
                Insurance / yr
              </label>
              <input
                id="insurance"
                className="field"
                type="number"
                step="50"
                value={insurance}
                onChange={(e) => setInsurance(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <label className="label" htmlFor="hoa">
                HOA / mo
              </label>
              <input
                id="hoa"
                className="field"
                type="number"
                step="5"
                value={hoa}
                onChange={(e) => setHoa(Number(e.target.value) || 0)}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-ink p-6 text-white md:p-8">
        <p className="eyebrow text-gold-light">Estimated monthly payment</p>
        <p className="mt-3 font-serif text-5xl leading-none">
          {currency.format(result.total)}
        </p>
        <p className="mt-2 text-sm text-white/60">per month, all in</p>

        <div className="mt-7 flex h-2 overflow-hidden">
          {breakdown.map((item) => (
            <span
              key={item.label}
              className={item.color}
              style={{ width: `${(item.value / result.total) * 100}%` }}
            />
          ))}
        </div>

        <dl className="mt-6 space-y-3 text-sm">
          {breakdown.map((item) => (
            <div key={item.label} className="flex items-center justify-between gap-4">
              <dt className="flex items-center gap-2 text-white/70">
                <span className={`h-2.5 w-2.5 ${item.color}`} />
                {item.label}
              </dt>
              <dd>{currency.format(item.value)}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-7 space-y-3 border-t border-white/15 pt-6 text-sm">
          <div className="flex justify-between">
            <span className="text-white/70">Loan amount</span>
            <span>{currency.format(result.principal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/70">Cash due at down payment</span>
            <span>{currency.format(result.down)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/70">Total interest over {years} yrs</span>
            <span>{currency.format(result.totalInterest)}</span>
          </div>
        </div>

        {downPercent < 20 ? (
          <p className="mt-6 border border-gold/40 bg-gold/10 px-4 py-3 text-xs leading-relaxed text-gold-light">
            Under 20% down, this estimate includes conventional PMI at roughly 0.6% of
            the loan per year. It typically drops off once you reach 20% equity.
          </p>
        ) : null}

        <p className="mt-6 text-xs leading-relaxed text-white/45">
          Estimates only. Actual rates, taxes and insurance vary by lender, property
          and credit profile. Not a loan commitment or a quote.
        </p>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  display,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <span className="label mb-0">{label}</span>
        <span className="font-serif text-lg">{display}</span>
      </div>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-1 w-full cursor-pointer appearance-none bg-sand accent-[#b98945]"
      />
    </div>
  );
}
