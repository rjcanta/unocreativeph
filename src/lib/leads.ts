export type LeadType =
  | "home-valuation"
  | "buyer"
  | "seller"
  | "contact"
  | "listing-inquiry"
  | "commercial"
  | "investor";

export type LeadPayload = {
  type: LeadType;
  name: string;
  email: string;
  phone?: string;
  message?: string;
  /** Anything form-specific: address, beds, timeline, budget, listing slug, etc. */
  details?: Record<string, string | number | boolean | undefined>;
};

export const leadTypeLabels: Record<LeadType, string> = {
  "home-valuation": "Home Valuation Request",
  buyer: "Buyer Consultation Request",
  seller: "Seller Consultation Request",
  contact: "General Contact",
  "listing-inquiry": "Listing Inquiry",
  commercial: "Commercial Inquiry",
  investor: "Investor Inquiry",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateLead(input: unknown): {
  ok: true;
  lead: LeadPayload;
} | {
  ok: false;
  error: string;
} {
  if (typeof input !== "object" || input === null) {
    return { ok: false, error: "Invalid request body." };
  }

  const body = input as Record<string, unknown>;
  const type = String(body.type ?? "contact") as LeadType;

  if (!(type in leadTypeLabels)) {
    return { ok: false, error: "Unknown request type." };
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const message = String(body.message ?? "").trim();

  if (name.length < 2) {
    return { ok: false, error: "Please enter your name." };
  }
  if (!EMAIL_RE.test(email)) {
    return { ok: false, error: "Please enter a valid email address." };
  }
  if (name.length > 120 || email.length > 200 || message.length > 4000) {
    return { ok: false, error: "One of your entries is too long." };
  }

  const details: Record<string, string> = {};
  if (typeof body.details === "object" && body.details !== null) {
    for (const [key, value] of Object.entries(body.details)) {
      if (value === undefined || value === null || value === "") continue;
      details[key.slice(0, 60)] = String(value).slice(0, 500);
    }
  }

  return {
    ok: true,
    lead: { type, name, email, phone, message, details },
  };
}

/**
 * Delivers a lead. With LEAD_WEBHOOK_URL set, the payload is POSTed there
 * (Zapier / Make / n8n / a CRM endpoint / a Slack incoming webhook). Without
 * it, the lead is logged so nothing is lost during development.
 */
export async function deliverLead(lead: LeadPayload) {
  const webhook = process.env.LEAD_WEBHOOK_URL;

  const payload = {
    ...lead,
    label: leadTypeLabels[lead.type],
    notify: process.env.LEAD_NOTIFY_EMAIL ?? null,
    submittedAt: new Date().toISOString(),
  };

  if (!webhook) {
    console.info("[lead] no LEAD_WEBHOOK_URL configured — logging instead", payload);
    return { delivered: false as const };
  }

  const response = await fetch(webhook, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Webhook responded ${response.status}`);
  }

  return { delivered: true as const };
}
