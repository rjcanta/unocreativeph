"use client";

import { useState } from "react";

export type FaqItem = { question: string; answer: string };

export function Faq({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((item, index) => {
        const expanded = open === index;
        return (
          <div key={item.question}>
            <button
              type="button"
              onClick={() => setOpen(expanded ? null : index)}
              aria-expanded={expanded}
              className="flex w-full items-center justify-between gap-6 py-6 text-left"
            >
              <span className="font-serif text-lg md:text-xl">{item.question}</span>
              <span
                className={`shrink-0 text-xl text-gold transition-transform ${
                  expanded ? "rotate-45" : ""
                }`}
                aria-hidden="true"
              >
                +
              </span>
            </button>
            {expanded ? (
              <p className="max-w-3xl pb-6 text-[0.938rem] leading-relaxed text-ink-soft">
                {item.answer}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
