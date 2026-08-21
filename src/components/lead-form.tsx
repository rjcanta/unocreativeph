"use client";

import { useState } from "react";
import type { LeadType } from "@/lib/leads";

type ExtraField = {
  name: string;
  label: string;
  type?: "text" | "select" | "tel";
  options?: string[];
  placeholder?: string;
  required?: boolean;
};

export function LeadForm({
  type,
  extraFields = [],
  hidden = {},
  submitLabel = "Send Request",
  successTitle = "Thanks — your message is in.",
  successBody = "Kelly reads every inquiry personally and responds within one business day.",
  messageLabel = "How can I help?",
  messagePlaceholder = "Tell me a little about what you're looking for…",
  compact = false,
}: {
  type: LeadType;
  extraFields?: ExtraField[];
  hidden?: Record<string, string>;
  submitLabel?: string;
  successTitle?: string;
  successBody?: string;
  messageLabel?: string;
  messagePlaceholder?: string;
  compact?: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const seed: Record<string, string> = {
      name: "",
      email: "",
      phone: "",
      message: "",
      company: "",
    };
    for (const field of extraFields) {
      seed[field.name] = field.type === "select" ? (field.options?.[0] ?? "") : "";
    }
    return seed;
  });
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState<string | null>(null);

  function set(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setError(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setStatus("sending");
    setError(null);

    const details: Record<string, string> = { ...hidden };
    for (const field of extraFields) {
      details[field.name] = values[field.name] ?? "";
    }

    try {
      const response = await fetch("/api/lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          type,
          name: values.name,
          email: values.email,
          phone: values.phone,
          message: values.message,
          company: values.company,
          details,
        }),
      });

      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error ?? "Something went wrong.");

      setStatus("done");
    } catch (err) {
      setStatus("idle");
      setError(
        err instanceof Error ? err.message : "We couldn't send that. Please try again.",
      );
    }
  }

  if (status === "done") {
    return (
      <div className="border border-line bg-white p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gold/15 text-xl text-gold">
          ✓
        </div>
        <h3 className="mt-5 text-2xl">{successTitle}</h3>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-ink-soft">
          {successBody}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className={compact ? "" : "border border-line bg-white p-6 md:p-8"}>
      <input
        type="text"
        name="company"
        value={values.company}
        onChange={(e) => set("company", e.target.value)}
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="absolute left-[-9999px] h-0 w-0 opacity-0"
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="label" htmlFor={`${type}-name`}>
            Full name
          </label>
          <input
            id={`${type}-name`}
            className="field"
            required
            value={values.name}
            onChange={(e) => set("name", e.target.value)}
            autoComplete="name"
          />
        </div>
        <div>
          <label className="label" htmlFor={`${type}-phone`}>
            Phone
          </label>
          <input
            id={`${type}-phone`}
            className="field"
            type="tel"
            value={values.phone}
            onChange={(e) => set("phone", e.target.value)}
            autoComplete="tel"
          />
        </div>
      </div>

      <div className="mt-5">
        <label className="label" htmlFor={`${type}-email`}>
          Email address
        </label>
        <input
          id={`${type}-email`}
          className="field"
          type="email"
          required
          value={values.email}
          onChange={(e) => set("email", e.target.value)}
          autoComplete="email"
        />
      </div>

      {extraFields.length ? (
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          {extraFields.map((field) => (
            <div key={field.name}>
              <label className="label" htmlFor={`${type}-${field.name}`}>
                {field.label}
              </label>
              {field.type === "select" ? (
                <select
                  id={`${type}-${field.name}`}
                  className="field"
                  value={values[field.name]}
                  onChange={(e) => set(field.name, e.target.value)}
                >
                  {field.options?.map((option) => (
                    <option key={option}>{option}</option>
                  ))}
                </select>
              ) : (
                <input
                  id={`${type}-${field.name}`}
                  className="field"
                  type={field.type ?? "text"}
                  placeholder={field.placeholder}
                  required={field.required}
                  value={values[field.name]}
                  onChange={(e) => set(field.name, e.target.value)}
                />
              )}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-5">
        <label className="label" htmlFor={`${type}-message`}>
          {messageLabel}
        </label>
        <textarea
          id={`${type}-message`}
          className="field min-h-32 resize-y"
          placeholder={messagePlaceholder}
          value={values.message}
          onChange={(e) => set("message", e.target.value)}
        />
      </div>

      {error ? (
        <p role="alert" className="mt-5 border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={status === "sending"}
        className="mt-6 w-full bg-gold px-6 py-4 text-[0.688rem] font-bold uppercase tracking-[0.14em] text-white transition-colors hover:bg-[#a3763a] disabled:opacity-60 sm:w-auto"
      >
        {status === "sending" ? "Sending…" : submitLabel}
      </button>

      <p className="mt-4 text-xs leading-relaxed text-ink-soft">
        Your information is used only to respond to this request. It is never sold or
        shared with third-party lead services.
      </p>
    </form>
  );
}
