"use server";

import { bool, list, num, opt, runAction, str, type ActionResult } from "@/lib/server/action";
import * as contacts from "@/lib/server/contacts";

function contactFromForm(fd: FormData): contacts.ContactInput {
  return {
    firstName: str(fd, "firstName"),
    lastName: str(fd, "lastName"),
    email: opt(fd, "email"),
    phone: opt(fd, "phone"),
    contactType: str(fd, "contactType") as "PAST_CLIENT" | "SPHERE",
    clientRole: (opt(fd, "clientRole") as "BUYER" | "SELLER" | "BUYER_SELLER" | null) ?? null,
    tier: str(fd, "tier") as "VIP",
    birthdayMonth: num(fd, "birthdayMonth"),
    birthdayDay: num(fd, "birthdayDay"),
    birthdayYear: num(fd, "birthdayYear"),
    birthdayVerified: bool(fd, "birthdayVerified"),
    closingDate: opt(fd, "closingDate"),
    closingDateVerified: bool(fd, "closingDateVerified"),
    propertyAddress: opt(fd, "propertyAddress"),
    neighborhood: opt(fd, "neighborhood"),
    city: opt(fd, "city"),
    preferredChannel: (str(fd, "preferredChannel") || "EMAIL") as "EMAIL",
    opportunityStatus: (str(fd, "opportunityStatus") || "NONE") as "NONE",
    assignedAgentId: opt(fd, "assignedAgentId"),
    lastCommunicationAt: opt(fd, "lastCommunicationAt"),
    emailConsent: (opt(fd, "emailConsent") as "GRANTED" | "REVOKED" | "UNKNOWN" | null) ?? undefined,
    consentSource: opt(fd, "consentSource"),
    tags: str(fd, "tags")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean),
  };
}

export async function createContactAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    const c = await contacts.createContact(s, contactFromForm(fd));
    return { message: `${c.firstName} ${c.lastName} added.`, data: { id: c.id } };
  });
}

export async function updateContactAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    const id = str(fd, "id");
    await contacts.updateContact(s, id, contactFromForm(fd));
    return { message: "Contact saved.", data: { id } };
  });
}

export async function archiveContactsAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    const n = await contacts.softDeleteContacts(s, list(fd, "ids"));
    return { message: `${n} contact${n === 1 ? "" : "s"} archived. Pending messages were cancelled.` };
  });
}

export async function bulkTagAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    const mode = str(fd, "mode") === "remove" ? "remove" : "add";
    const n = await contacts.bulkTag(s, list(fd, "ids"), str(fd, "tag"), mode);
    return `${mode === "add" ? "Tagged" : "Removed tag from"} ${n} contact${n === 1 ? "" : "s"}.`;
  });
}

export async function addNoteAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    await contacts.addNote(s, str(fd, "contactId"), str(fd, "body"), str(fd, "kind") || "NOTE");
    return "Saved to the timeline.";
  });
}

export async function recordConsentAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    await contacts.recordConsent(s, str(fd, "contactId"), {
      channel: str(fd, "channel") as "EMAIL",
      purpose: str(fd, "purpose") as "MARKETING",
      status: str(fd, "status") as "GRANTED",
      source: str(fd, "source"),
      evidence: str(fd, "evidence"),
    });
    return "Consent recorded in the audit trail.";
  });
}

export async function unsubscribeAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    const r = await contacts.unsubscribeContact(s, str(fd, "contactId"), "Unsubscribed by agent");
    return r.alreadyUnsubscribed ? "Already unsubscribed." : "Unsubscribed from all email. Pending emails were cancelled.";
  });
}

export async function doNotContactAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    const value = str(fd, "value") === "true";
    await contacts.setDoNotContact(s, str(fd, "contactId"), value, value ? "Set by agent" : "Cleared by agent");
    return value ? "Marked do-not-contact. All pending outreach cancelled." : "Do-not-contact cleared.";
  });
}

export async function preferencesAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    await contacts.updatePreferences(s, str(fd, "contactId"), {
      receiveNewsletters: bool(fd, "receiveNewsletters"),
      receiveSeasonal: bool(fd, "receiveSeasonal"),
      receiveMilestones: bool(fd, "receiveMilestones"),
      frequency: str(fd, "frequency") || "NORMAL",
      preferredChannel: str(fd, "preferredChannel") || "EMAIL",
    });
    return "Preferences saved.";
  });
}

export async function verifyDateAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    const verified = str(fd, "verified") === "true";
    await contacts.setMilestoneVerified(s, str(fd, "contactId"), str(fd, "type") as "BIRTHDAY", verified);
    return verified ? "Date verified. Automated greetings are now enabled." : "Marked unverified. No automatic messages will use this date.";
  });
}

export async function customMilestoneAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    await contacts.addCustomMilestone(s, str(fd, "contactId"), { label: str(fd, "label"), month: Number(str(fd, "month")), day: Number(str(fd, "day")), verified: bool(fd, "verified") });
    return "Milestone saved.";
  });
}

export async function previewImportAction(_: ActionResult | null, fd: FormData) {
  return runAction(
    async (s) => {
      const preview = await contacts.previewImport(s, str(fd, "csv"), str(fd, "fileName") || "pasted.csv", s.timezone);
      return { message: `Checked ${preview.rows.length} rows.`, data: preview };
    },
    { processJobs: false, revalidate: [] },
  );
}

export async function commitImportAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    const r = await contacts.commitImport(s, str(fd, "csv"), str(fd, "fileName") || "pasted.csv", s.timezone, {
      datesVerified: bool(fd, "datesVerified"),
      duplicateStrategy: str(fd, "duplicateStrategy") === "FILL_EMPTY" ? "FILL_EMPTY" : "SKIP",
      tag: str(fd, "tag"),
    });
    return { message: `Imported ${r.created} new contact${r.created === 1 ? "" : "s"}${r.merged ? `, filled details on ${r.merged}` : ""}, skipped ${r.skipped.length}.`, data: r };
  });
}
