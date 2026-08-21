"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

type FormState = {
  address: string;
  city: string;
  zip: string;
  propertyType: string;
  beds: string;
  baths: string;
  sqft: string;
  yearBuilt: string;
  condition: string;
  updates: string[];
  timeline: string;
  reason: string;
  name: string;
  email: string;
  phone: string;
  notes: string;
  company: string; // honeypot
};

const initialState: FormState = {
  address: "",
  city: "",
  zip: "",
  propertyType: "Single family",
  beds: "3",
  baths: "2",
  sqft: "",
  yearBuilt: "",
  condition: "Good — well maintained",
  updates: [],
  timeline: "3–6 months",
  reason: "Considering selling",
  name: "",
  email: "",
  phone: "",
  notes: "",
  company: "",
};

const propertyTypes = [
  "Single family",
  "Townhome",
  "Condo",
  "Multi-family",
  "Land",
  "Commercial",
];

const conditions = [
  "Excellent — recently renovated",
  "Good — well maintained",
  "Average — some updates needed",
  "Needs work — significant repairs",
];

const updateOptions = [
  "Kitchen remodel",
  "Bathroom remodel",
  "New roof",
  "New HVAC",
  "Pool added",
  "Solar installed",
  "Flooring replaced",
  "Windows replaced",
  "Landscaping / hardscape",
  "Casita or addition",
];

const timelines = [
  "ASAP — ready now",
  "1–3 months",
  "3–6 months",
  "6–12 months",
  "Just curious about value",
];

const reasons = [
  "Considering selling",
  "Buying my next home",
  "Refinancing",
  "Investment analysis",
  "Divorce or estate",
  "Relocating out of state",
];

const steps = [
  { id: 1, title: "Property", caption: "Where is it?" },
  { id: 2, title: "Details", caption: "Tell me about it" },
  { id: 3, title: "Condition", caption: "What's been done?" },
  { id: 4, title: "Timeline", caption: "What's your plan?" },
  { id: 5, title: "Contact", caption: "Where do I send it?" },
];

export function ValuationWizard() {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState<FormState>(initialState);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  function toggleUpdate(option: string) {
    setForm((prev) => ({
      ...prev,
      updates: prev.updates.includes(option)
        ? prev.updates.filter((u) => u !== option)
        : [...prev.updates, option],
    }));
  }

  const stepValid = useMemo(() => {
    switch (step) {
      case 1:
        return form.address.trim().length > 4 && form.city.trim().length > 1;
      case 2:
        return form.sqft.trim().length > 0;
      case 5:
        return (
          form.name.trim().length > 1 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(form.email)
        );
      default:
        return true;
    }
  }, [step, form]);

  function next() {
    if (!stepValid) {
      setError("Please complete the highlighted fields before continuing.");
      return;
    }
    setError(null);
    setStep((s) => Math.min(s + 1, steps.length));
  }

  function back() {
    setError(null);
    setStep((s) => Math.max(s - 1, 1));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!stepValid) {
      setError("Please add your name and a valid email address.");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type: "home-valuation",
          name: form.name,
          email: form.email,
          phone: form.phone,
          message: form.notes,
          company: form.company,
          details: {
            address: form.address,
            city: form.city,
            zip: form.zip,
            propertyType: form.propertyType,
            beds: form.beds,
            baths: form.baths,
            sqft: form.sqft,
            yearBuilt: form.yearBuilt,
            condition: form.condition,
            updates: form.updates.join(", "),
            timeline: form.timeline,
            reason: form.reason,
          },
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error ?? "Something went wrong.");
      }

      setDone(true);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "We couldn't submit your request. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="border border-line bg-white p-8 text-center md:p-12">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-gold/15 text-2xl text-gold">
          ✓
        </div>
        <h2 className="mt-6 text-3xl">Your valuation is on its way.</h2>
        <p className="mx-auto mt-4 max-w-lg leading-relaxed text-ink-soft">
          I&apos;ll pull the recent comparable sales for {form.address || "your property"} and
          send a written valuation to <strong className="text-ink">{form.email}</strong> within
          one business day. If anything about your property needs a closer look, I&apos;ll call
          you first.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href="/sell"
            className="bg-gold px-6 py-3.5 text-[0.688rem] font-bold uppercase tracking-[0.14em] text-white"
          >
            See the selling process
          </Link>
          <Link
            href="/listings"
            className="border border-ink/25 px-6 py-3.5 text-[0.688rem] font-bold uppercase tracking-[0.14em]"
          >
            Browse listings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-line bg-white">
      {/* Progress */}
      <div className="border-b border-line px-6 pt-6 md:px-10">
        <div className="flex items-center justify-between gap-2">
          {steps.map((s) => (
            <div key={s.id} className="flex-1">
              <div
                className={`h-1 w-full transition-colors ${
                  s.id <= step ? "bg-gold" : "bg-sand"
                }`}
              />
              <p
                className={`mt-2 hidden text-[0.625rem] font-bold uppercase tracking-[0.12em] md:block ${
                  s.id <= step ? "text-gold" : "text-ink-soft/50"
                }`}
              >
                {s.title}
              </p>
            </div>
          ))}
        </div>
        <p className="py-4 text-xs text-ink-soft md:hidden">
          Step {step} of {steps.length} — {steps[step - 1].title}
        </p>
      </div>

      <form onSubmit={submit} className="px-6 py-8 md:px-10 md:py-10">
        <input
          type="text"
          name="company"
          value={form.company}
          onChange={(e) => set("company", e.target.value)}
          tabIndex={-1}
          autoComplete="off"
          aria-hidden="true"
          className="absolute left-[-9999px] h-0 w-0 opacity-0"
        />

        <p className="eyebrow text-gold">Step {step} of {steps.length}</p>
        <h2 className="mt-2 text-2xl md:text-3xl">{steps[step - 1].caption}</h2>

        <div className="mt-8 space-y-6">
          {step === 1 ? (
            <>
              <div>
                <label className="label" htmlFor="address">
                  Property address
                </label>
                <input
                  id="address"
                  className="field"
                  placeholder="4512 E Calle Redonda"
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  autoComplete="street-address"
                />
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="city">
                    City
                  </label>
                  <input
                    id="city"
                    className="field"
                    placeholder="Phoenix"
                    value={form.city}
                    onChange={(e) => set("city", e.target.value)}
                    autoComplete="address-level2"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="zip">
                    ZIP code
                  </label>
                  <input
                    id="zip"
                    className="field"
                    placeholder="85018"
                    inputMode="numeric"
                    value={form.zip}
                    onChange={(e) => set("zip", e.target.value)}
                    autoComplete="postal-code"
                  />
                </div>
              </div>
              <div>
                <label className="label">Property type</label>
                <div className="flex flex-wrap gap-2">
                  {propertyTypes.map((type) => (
                    <ChoiceChip
                      key={type}
                      label={type}
                      selected={form.propertyType === type}
                      onClick={() => set("propertyType", type)}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="beds">
                    Bedrooms
                  </label>
                  <select
                    id="beds"
                    className="field"
                    value={form.beds}
                    onChange={(e) => set("beds", e.target.value)}
                  >
                    {["Studio", "1", "2", "3", "4", "5", "6+", "N/A"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label" htmlFor="baths">
                    Bathrooms
                  </label>
                  <select
                    id="baths"
                    className="field"
                    value={form.baths}
                    onChange={(e) => set("baths", e.target.value)}
                  >
                    {["1", "1.5", "2", "2.5", "3", "3.5", "4", "5+", "N/A"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="sqft">
                    Approximate square feet
                  </label>
                  <input
                    id="sqft"
                    className="field"
                    inputMode="numeric"
                    placeholder="2,400"
                    value={form.sqft}
                    onChange={(e) => set("sqft", e.target.value)}
                  />
                </div>
                <div>
                  <label className="label" htmlFor="yearBuilt">
                    Year built (optional)
                  </label>
                  <input
                    id="yearBuilt"
                    className="field"
                    inputMode="numeric"
                    placeholder="1998"
                    value={form.yearBuilt}
                    onChange={(e) => set("yearBuilt", e.target.value)}
                  />
                </div>
              </div>
              <p className="text-sm text-ink-soft">
                An estimate is fine — I verify square footage against county records
                and the MLS before finalizing anything.
              </p>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <div>
                <label className="label">Overall condition</label>
                <div className="grid gap-2">
                  {conditions.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => set("condition", c)}
                      className={`border px-4 py-3.5 text-left text-sm transition-colors ${
                        form.condition === c
                          ? "border-gold bg-gold/10 text-ink"
                          : "border-line hover:border-ink/30"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">
                  Updates in the last 5 years (select all that apply)
                </label>
                <div className="flex flex-wrap gap-2">
                  {updateOptions.map((option) => (
                    <ChoiceChip
                      key={option}
                      label={option}
                      selected={form.updates.includes(option)}
                      onClick={() => toggleUpdate(option)}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <div>
                <label className="label">When are you thinking of selling?</label>
                <div className="grid gap-2 sm:grid-cols-2">
                  {timelines.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => set("timeline", t)}
                      className={`border px-4 py-3.5 text-left text-sm transition-colors ${
                        form.timeline === t
                          ? "border-gold bg-gold/10"
                          : "border-line hover:border-ink/30"
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="label">What&apos;s driving the question?</label>
                <div className="flex flex-wrap gap-2">
                  {reasons.map((r) => (
                    <ChoiceChip
                      key={r}
                      label={r}
                      selected={form.reason === r}
                      onClick={() => set("reason", r)}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : null}

          {step === 5 ? (
            <>
              <div className="grid gap-6 sm:grid-cols-2">
                <div>
                  <label className="label" htmlFor="name">
                    Full name
                  </label>
                  <input
                    id="name"
                    className="field"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    autoComplete="name"
                  />
                </div>
                <div>
                  <label className="label" htmlFor="phone">
                    Phone (optional)
                  </label>
                  <input
                    id="phone"
                    className="field"
                    type="tel"
                    value={form.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    autoComplete="tel"
                  />
                </div>
              </div>
              <div>
                <label className="label" htmlFor="email">
                  Email address
                </label>
                <input
                  id="email"
                  className="field"
                  type="email"
                  value={form.email}
                  onChange={(e) => set("email", e.target.value)}
                  autoComplete="email"
                />
              </div>
              <div>
                <label className="label" htmlFor="notes">
                  Anything I should know? (optional)
                </label>
                <textarea
                  id="notes"
                  className="field min-h-28 resize-y"
                  placeholder="Tenant in place, unpermitted addition, HOA questions…"
                  value={form.notes}
                  onChange={(e) => set("notes", e.target.value)}
                />
              </div>

              <div className="border border-line bg-cream p-5">
                <p className="eyebrow text-gold">Your submission</p>
                <dl className="mt-3 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  <Summary label="Address" value={`${form.address}, ${form.city} ${form.zip}`} />
                  <Summary label="Type" value={form.propertyType} />
                  <Summary label="Size" value={`${form.beds} bd / ${form.baths} ba / ${form.sqft || "—"} sqft`} />
                  <Summary label="Condition" value={form.condition} />
                  <Summary label="Timeline" value={form.timeline} />
                  <Summary label="Reason" value={form.reason} />
                </dl>
              </div>

              <p className="text-xs leading-relaxed text-ink-soft">
                By submitting, you agree to be contacted about this valuation request.
                No spam, no lead sharing — your information stays with Kelly.
              </p>
            </>
          ) : null}
        </div>

        {error ? (
          <p role="alert" className="mt-6 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-6">
          <button
            type="button"
            onClick={back}
            disabled={step === 1}
            className="px-5 py-3 text-[0.688rem] font-bold uppercase tracking-[0.14em] text-ink-soft transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
          >
            ← Back
          </button>

          {step < steps.length ? (
            <button
              type="button"
              onClick={next}
              className="bg-ink px-7 py-3.5 text-[0.688rem] font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-gold"
            >
              Continue →
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="bg-gold px-7 py-3.5 text-[0.688rem] font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-[#a3763a] disabled:opacity-60"
            >
              {submitting ? "Sending…" : "Get my valuation"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}

function ChoiceChip({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={`border px-4 py-2.5 text-sm transition-colors ${
        selected
          ? "border-gold bg-gold text-white"
          : "border-line bg-white hover:border-ink/30"
      }`}
    >
      {label}
    </button>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[0.625rem] font-bold uppercase tracking-[0.12em] text-ink-soft">
        {label}
      </dt>
      <dd className="mt-0.5">{value || "—"}</dd>
    </div>
  );
}
