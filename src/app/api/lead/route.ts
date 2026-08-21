import { NextResponse } from "next/server";
import { deliverLead, validateLead } from "@/lib/leads";

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  // Honeypot: real visitors never fill this hidden field.
  if (typeof body === "object" && body !== null && (body as Record<string, unknown>).company) {
    return NextResponse.json({ ok: true });
  }

  const result = validateLead(body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  try {
    await deliverLead(result.lead);
  } catch (error) {
    console.error("[lead] delivery failed", error);
    return NextResponse.json(
      { error: "We couldn't submit your request. Please call or email instead." },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
