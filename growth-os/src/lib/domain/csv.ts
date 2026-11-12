/**
 * CSV import: RFC 4180 parsing, header mapping, and per-row validation.
 * Pure functions so the browser preview and the server import share one truth.
 */
import { isValidMonthDay } from "./dates";
import { isValidEmail, normalizeEmail, normalizePhone } from "./normalize";
import type { ClientRole, ConsentStatus, ContactType, Tier, Channel } from "./types";

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const s = text.replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim() !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  row.push(field);
  if (row.some((f) => f.trim() !== "")) rows.push(row);
  return rows;
}

export const IMPORT_FIELDS = {
  firstName: ["first name", "firstname", "first", "given name"],
  lastName: ["last name", "lastname", "last", "surname", "family name"],
  fullName: ["name", "full name", "contact name"],
  email: ["email", "email address", "e mail", "e mail address"],
  phone: ["phone", "phone number", "mobile", "cell", "mobile phone"],
  contactType: ["contact type", "type", "category", "relationship"],
  clientRole: ["client role", "role", "transaction side", "side"],
  tier: ["tier", "relationship tier", "priority"],
  birthday: ["birthday", "birth date", "date of birth", "dob"],
  closingDate: ["closing date", "close date", "home purchase date", "purchase date", "closed"],
  propertyAddress: ["property address", "address", "street address", "home address"],
  neighborhood: ["neighborhood", "area", "subdivision", "community"],
  city: ["city"],
  preferredChannel: ["preferred channel", "preferred contact", "contact preference"],
  emailConsent: ["email consent", "marketing consent", "email opt in", "opt in", "consent"],
  consentSource: ["consent source", "opt in source"],
  consentDate: ["consent date", "opt in date", "consent timestamp"],
  lastCommunication: ["last communication", "last contacted", "last contact", "last touch"],
  notes: ["notes", "relationship notes", "note"],
  tags: ["tags", "labels"],
} as const;

export type ImportField = keyof typeof IMPORT_FIELDS;

export type HeaderMapping = { index: number; header: string; field: ImportField | null }[];

const clean = (h: string) => h.trim().toLowerCase().replace(/[_\-]+/g, " ").replace(/\s+/g, " ");

export function mapHeaders(headers: string[]): HeaderMapping {
  const used = new Set<ImportField>();
  return headers.map((header, index) => {
    const h = clean(header);
    const field = (Object.keys(IMPORT_FIELDS) as ImportField[]).find(
      (f) => !used.has(f) && (IMPORT_FIELDS[f] as readonly string[]).includes(h),
    );
    if (field) used.add(field);
    return { index, header, field: field ?? null };
  });
}

export type ParsedImportRow = {
  rowNumber: number; // 1-based, matching the spreadsheet row (header = row 1)
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  contactType: ContactType;
  clientRole: ClientRole | null;
  tier: Tier;
  birthdayMonth: number | null;
  birthdayDay: number | null;
  birthdayYear: number | null;
  closingDate: string | null; // YYYY-MM-DD
  propertyAddress: string | null;
  neighborhood: string | null;
  city: string | null;
  preferredChannel: Channel;
  emailConsent: ConsentStatus;
  consentSource: string | null;
  consentDate: string | null;
  lastCommunication: string | null;
  notes: string | null;
  tags: string[];
};

export type RowValidation = {
  row: ParsedImportRow;
  errors: string[];
  warnings: string[];
};

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Accepts MM/DD, MM/DD/YYYY, YYYY-MM-DD, --MM-DD, "March 4", "Mar 4, 1985". */
export function parseMonthDay(raw: string): { month: number; day: number; year: number | null } | null {
  const v = raw.trim();
  if (!v) return null;
  let m: RegExpExecArray | null;
  let month: number, day: number, year: number | null = null;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(v))) [year, month, day] = [Number(m[1]), Number(m[2]), Number(m[3])];
  else if ((m = /^--(\d{1,2})-(\d{1,2})$/.exec(v))) [month, day] = [Number(m[1]), Number(m[2])];
  else if ((m = /^(\d{1,2})[\/.-](\d{1,2})(?:[\/.-](\d{2,4}))?$/.exec(v))) {
    month = Number(m[1]);
    day = Number(m[2]);
    if (m[3]) year = m[3].length === 2 ? (Number(m[3]) > 30 ? 1900 : 2000) + Number(m[3]) : Number(m[3]);
  } else if ((m = /^([a-z]+)\.?\s+(\d{1,2})(?:,?\s+(\d{4}))?$/i.exec(v))) {
    const idx = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    if (idx < 0) return null;
    month = idx + 1;
    day = Number(m[2]);
    if (m[3]) year = Number(m[3]);
  } else return null;
  if (!isValidMonthDay(month, day)) return null;
  if (year !== null && month === 2 && day === 29 && !(year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0))) return null;
  return { month, day, year };
}

export function parseFullDate(raw: string): string | null {
  const md = parseMonthDay(raw);
  if (!md || md.year === null) return null;
  return `${md.year}-${String(md.month).padStart(2, "0")}-${String(md.day).padStart(2, "0")}`;
}

function parseContactType(raw: string): ContactType | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (["past client", "client", "past clients", "buyer", "seller", "past buyer", "past seller", "pc"].includes(v)) return "PAST_CLIENT";
  if (["sphere", "sphere of influence", "soi", "friend", "family", "neighbor", "coworker", "referral partner"].includes(v)) return "SPHERE";
  return null;
}

function parseRole(raw: string): ClientRole | null {
  const v = raw.trim().toLowerCase();
  if (["buyer", "bought", "purchase"].includes(v)) return "BUYER";
  if (["seller", "sold", "listing"].includes(v)) return "SELLER";
  if (["both", "buyer & seller", "buyer and seller", "buyer/seller"].includes(v)) return "BUYER_SELLER";
  return null;
}

function parseTier(raw: string): Tier | null {
  const v = raw.trim().toLowerCase().replace(/[_-]/g, " ");
  if (!v) return null;
  if (v === "vip" || v === "a") return "VIP";
  if (v === "active" || v === "b") return "ACTIVE";
  if (v === "standard" || v === "c") return "STANDARD";
  if (v === "needs reconnection" || v === "reconnect" || v === "inactive" || v === "d") return "NEEDS_RECONNECTION";
  return null;
}

function parseChannel(raw: string): Channel {
  const v = raw.trim().toLowerCase();
  if (v.startsWith("sms") || v.startsWith("text")) return "SMS";
  if (v.startsWith("phone") || v.startsWith("call")) return "PHONE";
  if (v.startsWith("email") || v.startsWith("e-mail")) return "EMAIL";
  return v === "none" ? "NONE" : "EMAIL";
}

function parseConsent(raw: string): ConsentStatus {
  const v = raw.trim().toLowerCase();
  if (["yes", "y", "true", "granted", "opted in", "opt in", "subscribed", "1"].includes(v)) return "GRANTED";
  if (["no", "n", "false", "revoked", "opted out", "unsubscribed", "0"].includes(v)) return "REVOKED";
  return "UNKNOWN";
}

export function validateRows(records: string[][], mapping: HeaderMapping, today: string): RowValidation[] {
  return records.map((cells, i) => {
    const get = (f: ImportField) => {
      const col = mapping.find((m) => m.field === f);
      return col ? (cells[col.index] ?? "").trim() : "";
    };
    const errors: string[] = [];
    const warnings: string[] = [];

    let firstName = get("firstName");
    let lastName = get("lastName");
    const full = get("fullName");
    if (!firstName && full) {
      const parts = full.split(/\s+/);
      firstName = parts.shift() ?? "";
      lastName = lastName || parts.join(" ");
    }
    if (!firstName) errors.push("First name is required.");

    const emailRaw = get("email");
    const email = emailRaw ? normalizeEmail(emailRaw) : null;
    if (emailRaw && !isValidEmail(emailRaw)) errors.push(`Email "${emailRaw}" is not valid.`);

    const phoneRaw = get("phone");
    const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
    if (phoneRaw && !phone) warnings.push(`Phone "${phoneRaw}" could not be read and will be left blank.`);
    if (!emailRaw && !phoneRaw) warnings.push("No email or phone — this contact can only receive personal outreach tasks.");

    const typeRaw = get("contactType");
    let contactType = parseContactType(typeRaw);
    if (!contactType) {
      if (typeRaw) warnings.push(`Unrecognized contact type "${typeRaw}" — imported as Sphere of Influence.`);
      else warnings.push("No contact type — imported as Sphere of Influence.");
      contactType = "SPHERE";
    }
    const roleRaw = get("clientRole") || (["buyer", "seller", "past buyer", "past seller"].includes(typeRaw.toLowerCase()) ? typeRaw.replace(/past /i, "") : "");
    const clientRole = contactType === "PAST_CLIENT" ? parseRole(roleRaw) : null;

    const tierRaw = get("tier");
    const tier = parseTier(tierRaw) ?? "STANDARD";
    if (tierRaw && !parseTier(tierRaw)) warnings.push(`Unrecognized tier "${tierRaw}" — set to Standard.`);

    const bdayRaw = get("birthday");
    const bday = bdayRaw ? parseMonthDay(bdayRaw) : null;
    if (bdayRaw && !bday) errors.push(`Birthday "${bdayRaw}" could not be read (try MM/DD or YYYY-MM-DD).`);

    const closingRaw = get("closingDate");
    const closingDate = closingRaw ? parseFullDate(closingRaw) : null;
    if (closingRaw && !closingDate) errors.push(`Closing date "${closingRaw}" needs a full date including the year.`);
    if (closingDate && closingDate > today) errors.push(`Closing date ${closingDate} is in the future.`);

    const consent = parseConsent(get("emailConsent"));
    const consentSource = get("consentSource") || null;
    const consentDateRaw = get("consentDate");
    const consentDate = consentDateRaw ? parseFullDate(consentDateRaw) : null;
    if (consent === "GRANTED" && !consentSource) warnings.push("Email consent marked yes without a consent source — the import file will be recorded as the source.");
    if (consent === "UNKNOWN") warnings.push("No email consent recorded — newsletters stay suppressed until consent is captured.");

    const lastRaw = get("lastCommunication");
    const lastCommunication = lastRaw ? parseFullDate(lastRaw) : null;
    if (lastRaw && !lastCommunication) warnings.push(`Last communication "${lastRaw}" could not be read.`);

    return {
      row: {
        rowNumber: i + 2,
        firstName,
        lastName,
        email,
        phone,
        contactType,
        clientRole,
        tier,
        birthdayMonth: bday?.month ?? null,
        birthdayDay: bday?.day ?? null,
        birthdayYear: bday?.year ?? null,
        closingDate,
        propertyAddress: get("propertyAddress") || null,
        neighborhood: get("neighborhood") || null,
        city: get("city") || null,
        preferredChannel: parseChannel(get("preferredChannel")),
        emailConsent: consent,
        consentSource,
        consentDate,
        lastCommunication,
        notes: get("notes") || null,
        tags: get("tags")
          .split(/[;|,]/)
          .map((t) => t.trim())
          .filter(Boolean),
      },
      errors,
      warnings,
    };
  });
}

export const CSV_TEMPLATE_HEADERS = [
  "First Name",
  "Last Name",
  "Email",
  "Phone",
  "Contact Type",
  "Client Role",
  "Tier",
  "Birthday",
  "Closing Date",
  "Property Address",
  "Neighborhood",
  "City",
  "Preferred Channel",
  "Email Consent",
  "Consent Source",
  "Consent Date",
  "Last Communication",
  "Notes",
  "Tags",
];
