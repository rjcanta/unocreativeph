/**
 * Fictional demo workspace: "KM Rojas Group — Arizona Real Estate".
 *
 * Every person, email (example.com/.net/.org), phone (555-01xx fictional range)
 * and address below is invented for testing. No real client data.
 *
 * Dates are relative to "now" so birthdays, anniversaries and scheduling
 * conflicts are always upcoming whenever the seed runs. Derived data (tasks,
 * insights, prepared messages, reply classifications, opportunities) is
 * produced by running the real planner and job pipeline — not inserted by hand.
 */
import { defaultSeasonalDate, SEASONAL_DEFAULTS } from "@/lib/domain/calendar";
import { addDays, isLeapYear, localToDateOnly, makeLocalDate, parseLocalDate, toLocalDate, zonedTimeToUtc, type LocalDate } from "@/lib/domain/dates";
import { normalizeEmail, normalizePhone } from "@/lib/domain/normalize";
import { DEFAULT_SCHEDULING } from "@/lib/domain/settings";
import type { SeasonalKind } from "@/lib/domain/types";
import { approveCampaign, createSeasonalCampaign, scheduleCampaign, updateCampaign } from "@/lib/server/campaigns";
import { DEMO_WORKSPACE_SLUG, type Ctx } from "@/lib/server/context";
import { syncMilestones } from "@/lib/server/contacts";
import { prisma } from "@/lib/server/db";
import { processDueJobs } from "@/lib/server/jobs-runner";
import { runDailyPlanner } from "@/lib/server/planner";
import { ingestInboundReply, updateOpportunity } from "@/lib/server/replies";
import { segmentSchema } from "@/lib/domain/segmentation";

const TZ = "America/Phoenix";

type Consent = "MARKETING" | "RELATIONSHIP" | "NONE" | "REVOKED";
type Seed = {
  first: string;
  last: string;
  type: "PAST_CLIENT" | "SPHERE";
  role?: "BUYER" | "SELLER" | "BUYER_SELLER";
  tier: "VIP" | "ACTIVE" | "STANDARD" | "NEEDS_RECONNECTION";
  /** Birthday as days from today, or a fixed [month, day]. */
  bday?: number | [number, number];
  bdayYear?: number;
  bdayUnverified?: boolean;
  /** Home anniversary as days from today, with years since closing. */
  anniv?: { inDays: number; years: number; unverified?: boolean };
  closedYearsAgo?: number;
  consent: Consent;
  lastContactDaysAgo: number | null;
  hood: string;
  city: string;
  street?: string;
  email?: string | null;
  phone?: string | null;
  tags?: string[];
  note?: string;
  flags?: ("UNSUBSCRIBED" | "DND" | "REDUCED" | "NO_NEWSLETTERS")[];
  channel?: "EMAIL" | "SMS" | "PHONE";
  createdMonthsAgo: number;
  assistant?: boolean;
};

const HOODS: [string, string][] = [
  ["Arcadia", "Phoenix"],
  ["Ahwatukee", "Phoenix"],
  ["Desert Ridge", "Phoenix"],
  ["North Central", "Phoenix"],
  ["Val Vista Lakes", "Gilbert"],
  ["Ocotillo", "Chandler"],
  ["Kiwanis Park", "Tempe"],
  ["McCormick Ranch", "Scottsdale"],
  ["Vistancia", "Peoria"],
  ["Arrowhead Ranch", "Glendale"],
  ["Eastmark", "Mesa"],
  ["Cactus Wren Estates", "Paradise Valley"],
];
const h = (i: number) => ({ hood: HOODS[i % HOODS.length][0], city: HOODS[i % HOODS.length][1] });

// The newsletter-conflict scenario is placed relative to the next newsletter slot.
function nextNewsletterSlot(today: LocalDate): LocalDate {
  const { year, month } = parseLocalDate(today);
  const candidates: LocalDate[] = [];
  for (let i = 0; i < 3; i++) {
    const y = month + i > 12 ? year + 1 : year;
    const m = ((month + i - 1) % 12) + 1;
    for (const d of DEFAULT_SCHEDULING.newsletterDays) candidates.push(makeLocalDate(y, m, d));
  }
  return candidates.find((d) => d > addDays(today, 3))!;
}

function contacts(today: LocalDate): Seed[] {
  const slot = nextNewsletterSlot(today);
  const toSlot = (offset: number) => Math.round((Date.parse(addDays(slot, offset)) - Date.parse(today)) / 86_400_000);
  return [
    // ── VIP past clients ───────────────────────────────────────────────────
    { first: "Elena", last: "Marquez", type: "PAST_CLIENT", role: "BUYER_SELLER", tier: "VIP", bday: 4, bdayYear: 1979, anniv: { inDays: 41, years: 6 }, consent: "MARKETING", lastContactDaysAgo: 48, ...h(0), street: "4120 E Saguaro Bloom Ln", email: "elena.marquez@example.com", phone: "+16025550101", tags: ["Referral source", "Golf"], note: "Referred the Patels and the Okonkwos. Loves the Phoenix Open every year.", createdMonthsAgo: 26 },
    { first: "Priya", last: "Natarajan", type: "PAST_CLIENT", role: "SELLER", tier: "VIP", bday: [2, 29], anniv: { inDays: 9, years: 3 }, consent: "MARKETING", lastContactDaysAgo: 120, ...h(7), street: "8833 N Quiet Mesa Dr", email: "priya.natarajan@example.com", phone: "+16025550103", tags: ["Referral source"], note: "Sold in McCormick Ranch, bought in Arcadia. Leap-day birthday (Feb 29).", createdMonthsAgo: 24 },
    { first: "Robert", last: "Achterberg", type: "PAST_CLIENT", role: "BUYER", tier: "VIP", bday: toSlot(-2), bdayYear: 1966, consent: "MARKETING", lastContactDaysAgo: 30, ...h(11), street: "6201 E Ocotillo Shadow Rd", email: "robert.achterberg@example.net", phone: "+14805550110", tags: ["Investor"], note: "Owns two rentals in Mesa; mentioned wanting to buy another rental property next spring.", createdMonthsAgo: 22 },
    { first: "Grace", last: "Okonkwo", type: "PAST_CLIENT", role: "BUYER", tier: "VIP", anniv: { inDays: 2, years: 5 }, bday: [8, 14], consent: "MARKETING", lastContactDaysAgo: 15, ...h(4), street: "2297 S Lakeshore Heron Way", email: "grace.okonkwo@example.org", phone: "+14805550111", tags: ["Referral source"], createdMonthsAgo: 20 },
    { first: "Daniel", last: "Whitfield", type: "PAST_CLIENT", role: "SELLER", tier: "VIP", bday: 11, bdayYear: 1958, consent: "RELATIONSHIP", lastContactDaysAgo: 200, ...h(9), street: "17840 N Palo Verde Ridge", email: "daniel.whitfield@example.com", phone: "+16235550112", note: "Prefers phone calls. Retired in 2024.", channel: "PHONE", createdMonthsAgo: 23 },
    { first: "Sofia", last: "Castellanos", type: "PAST_CLIENT", role: "BUYER", tier: "VIP", bday: 26, anniv: { inDays: 75, years: 2 }, consent: "MARKETING", lastContactDaysAgo: 60, ...h(1), street: "15012 S Foothill Quail Ct", email: "sofia.castellanos@example.net", phone: "+14805550113", createdMonthsAgo: 19 },

    // ── Active past clients ────────────────────────────────────────────────
    { first: "Marcus", last: "Bell", type: "PAST_CLIENT", role: "BUYER", tier: "ACTIVE", bday: toSlot(1), bdayYear: 1985, anniv: { inDays: 160, years: 4 }, consent: "MARKETING", lastContactDaysAgo: 40, ...h(2), street: "21455 N Desert Lark Pkwy", email: "marcus.bell@example.net", phone: "+16025550102", tags: ["Pickleball"], createdMonthsAgo: 21 },
    { first: "Hannah", last: "Lindqvist", type: "PAST_CLIENT", role: "BUYER", tier: "ACTIVE", anniv: { inDays: 6, years: 1 }, bday: [5, 3], consent: "MARKETING", lastContactDaysAgo: 22, ...h(10), street: "10422 E Sunflower Path", email: "hannah.lindqvist@example.com", phone: "+14805550114", tags: ["First-time buyer"], createdMonthsAgo: 14 },
    { first: "Tomás", last: "Herrera", type: "PAST_CLIENT", role: "SELLER", tier: "ACTIVE", bday: 7, consent: "MARKETING", lastContactDaysAgo: 75, ...h(5), street: "3611 S Mesquite Grove Dr", email: "tomas.herrera@example.org", phone: "+14805550115", createdMonthsAgo: 18 },
    { first: "Aisha", last: "Rahman", type: "PAST_CLIENT", role: "BUYER", tier: "ACTIVE", bday: 19, anniv: { inDays: 12, years: 2, unverified: true }, consent: "MARKETING", lastContactDaysAgo: 35, ...h(6), street: "1907 E Cholla Breeze St", email: "aisha.rahman@example.com", phone: "+14805550116", note: "Thinking about downsizing once the kids finish school.", createdMonthsAgo: 16 },
    { first: "Kevin", last: "O'Donnell", type: "PAST_CLIENT", role: "BUYER_SELLER", tier: "ACTIVE", bday: [3, 21], anniv: { inDays: 210, years: 3 }, consent: "MARKETING", lastContactDaysAgo: 90, ...h(3), street: "5520 N Ironwood Bluff Ave", email: "kevin.odonnell@example.net", phone: "+16025550117", createdMonthsAgo: 17 },
    { first: "Mei", last: "Tanaka", type: "PAST_CLIENT", role: "BUYER", tier: "ACTIVE", bday: 3, bdayUnverified: true, consent: "MARKETING", lastContactDaysAgo: 28, ...h(8), street: "28104 N Sage Thrasher Ln", email: "mei.tanaka@example.org", phone: "+16235550118", createdMonthsAgo: 12 },
    { first: "Jamal", last: "Washington", type: "PAST_CLIENT", role: "SELLER", tier: "ACTIVE", bday: [7, 9], anniv: { inDays: 95, years: 5 }, consent: "MARKETING", lastContactDaysAgo: 55, ...h(9), street: "6730 W Arroyo Wind Dr", email: "jamal.washington@example.com", phone: "+16235550119", createdMonthsAgo: 25 },
    { first: "Laura", last: "Bianchi", type: "PAST_CLIENT", role: "BUYER", tier: "ACTIVE", bday: [10, 30], anniv: { inDays: 13, years: 7 }, consent: "NONE", lastContactDaysAgo: 65, ...h(0), street: "4418 E Jacaranda Glow Rd", email: "laura.bianchi@example.net", phone: "+16025550120", createdMonthsAgo: 24 },

    // ── Standard past clients ──────────────────────────────────────────────
    { first: "Owen", last: "Fitzgerald", type: "PAST_CLIENT", role: "BUYER", tier: "STANDARD", bday: [1, 17], anniv: { inDays: 140, years: 4 }, consent: "MARKETING", lastContactDaysAgo: 150, ...h(6), street: "1123 W Creosote Hollow", email: "owen.fitzgerald@example.org", phone: "+16025550104", createdMonthsAgo: 22 },
    { first: "Natalie", last: "Brooks", type: "PAST_CLIENT", role: "BUYER", tier: "STANDARD", bday: 9, consent: "NONE", lastContactDaysAgo: 110, ...h(10), street: "9915 E Brittlebush Ct", email: "natalie.brooks@example.com", phone: "+14805550121", createdMonthsAgo: 13 },
    { first: "Victor", last: "Nguyen", type: "PAST_CLIENT", role: "SELLER", tier: "STANDARD", bday: [6, 2], anniv: { inDays: 250, years: 6 }, consent: "MARKETING", lastContactDaysAgo: 130, ...h(5), street: "2604 S Desert Willow Way", email: "victor.nguyen@example.net", phone: "+14805550122", createdMonthsAgo: 23 },
    { first: "Rachel", last: "Goldberg", type: "PAST_CLIENT", role: "BUYER", tier: "STANDARD", bday: [9, 12], anniv: { inDays: 5, years: 8 }, consent: "MARKETING", lastContactDaysAgo: 160, ...h(3), street: "3842 N Agave Moon Pl", email: "rachel.goldberg@example.org", phone: "+16025550123", flags: ["REDUCED"], createdMonthsAgo: 24 },
    { first: "Carlos", last: "Medina", type: "PAST_CLIENT", role: "BUYER", tier: "STANDARD", bday: [12, 24], anniv: { inDays: 300, years: 2 }, consent: "REVOKED", lastContactDaysAgo: 140, ...h(11), street: "7011 E Starflower Ln", email: "carlos.medina@example.com", phone: "+14805550124", createdMonthsAgo: 18 },
    { first: "Ingrid", last: "Solberg", type: "PAST_CLIENT", role: "SELLER", tier: "STANDARD", bday: [4, 8], consent: "MARKETING", lastContactDaysAgo: 100, ...h(7), street: "8120 E Coyote Song Rd", email: "ingrid.solberg@example.net", phone: "+14805550125", flags: ["NO_NEWSLETTERS"], createdMonthsAgo: 15 },
    { first: "Andre", last: "Dupont", type: "PAST_CLIENT", role: "BUYER", tier: "STANDARD", bday: 21, anniv: { inDays: 22, years: 1 }, consent: "MARKETING", lastContactDaysAgo: 45, ...h(4), street: "1740 E Bluebonnet Trail", email: "andre.dupont@example.org", phone: "+14805550126", createdMonthsAgo: 11 },
    { first: "Brianna", last: "Cole", type: "PAST_CLIENT", role: "BUYER", tier: "STANDARD", bday: [11, 2], consent: "MARKETING", lastContactDaysAgo: 85, ...h(8), street: "30211 N Ocotillo Dawn Dr", email: "brianna.cole@example.com", phone: "+16235550127", flags: ["UNSUBSCRIBED"], createdMonthsAgo: 16 },

    // ── Needs reconnection (long inactive past clients) ────────────────────
    { first: "Gregory", last: "Hale", type: "PAST_CLIENT", role: "SELLER", tier: "NEEDS_RECONNECTION", bday: [8, 30], closedYearsAgo: 9, consent: "MARKETING", lastContactDaysAgo: 540, ...h(9), email: "gregory.hale@example.net", phone: "+16235550128", createdMonthsAgo: 24 },
    { first: "Patricia", last: "Moreno", type: "PAST_CLIENT", role: "BUYER", tier: "NEEDS_RECONNECTION", anniv: { inDays: 8, years: 10 }, consent: "MARKETING", lastContactDaysAgo: 610, ...h(1), street: "14410 S Canyon Wren Dr", email: "patricia.moreno@example.org", phone: "+14805550129", createdMonthsAgo: 24 },
    { first: "Steven", last: "Kowalski", type: "PAST_CLIENT", role: "BUYER", tier: "NEEDS_RECONNECTION", bday: [5, 27], closedYearsAgo: 7, consent: "NONE", lastContactDaysAgo: 720, ...h(2), email: "steven.kowalski@example.com", phone: "+16025550130", createdMonthsAgo: 24 },
    { first: "Denise", last: "Fairbanks", type: "PAST_CLIENT", role: "SELLER", tier: "NEEDS_RECONNECTION", bday: 13, closedYearsAgo: 8, consent: "MARKETING", lastContactDaysAgo: 450, ...h(5), email: "denise.fairbanks@example.net", phone: "+14805550131", createdMonthsAgo: 23 },
    { first: "Martin", last: "Ybarra", type: "PAST_CLIENT", role: "BUYER", tier: "NEEDS_RECONNECTION", bday: [2, 11], closedYearsAgo: 6, consent: "MARKETING", lastContactDaysAgo: null, ...h(10), email: "martin.ybarra@example.org", phone: "+14805550132", createdMonthsAgo: 22 },
    { first: "Colleen", last: "Murphy", type: "PAST_CLIENT", role: "BUYER", tier: "NEEDS_RECONNECTION", bday: [10, 5], closedYearsAgo: 5, consent: "MARKETING", lastContactDaysAgo: 400, ...h(6), email: "colleen.murphy@example.com", phone: null, flags: ["DND"], createdMonthsAgo: 21 },

    // ── Sphere: VIP & active ───────────────────────────────────────────────
    { first: "Benjamin", last: "Adeyemi", type: "SPHERE", tier: "VIP", bday: 6, consent: "MARKETING", lastContactDaysAgo: 20, ...h(0), email: "ben.adeyemi@example.net", phone: "+16025550133", tags: ["Lender partner"], note: "Mortgage lender friend; we co-host a homebuyer seminar each spring.", createdMonthsAgo: 26 },
    { first: "Olivia", last: "Park", type: "SPHERE", tier: "ACTIVE", bday: toSlot(0), consent: "MARKETING", lastContactDaysAgo: 14, ...h(2), email: "olivia.park@example.com", phone: "+16025550134", tags: ["Pickleball", "Neighbor"], createdMonthsAgo: 18 },
    { first: "Ethan", last: "Ramirez", type: "SPHERE", tier: "ACTIVE", bday: [12, 2], consent: "MARKETING", lastContactDaysAgo: 33, ...h(4), email: "ethan.ramirez@example.org", phone: "+14805550135", tags: ["Church"], note: "His sister is thinking about moving to Scottsdale from Denver next summer.", createdMonthsAgo: 15 },
    { first: "Chloe", last: "Dubois", type: "SPHERE", tier: "ACTIVE", bday: 17, consent: "MARKETING", lastContactDaysAgo: 25, ...h(7), email: "chloe.dubois@example.net", phone: "+14805550136", tags: ["Book club"], createdMonthsAgo: 10 },
    { first: "Samuel", last: "Osei", type: "SPHERE", tier: "ACTIVE", bday: [3, 14], consent: "RELATIONSHIP", lastContactDaysAgo: 50, ...h(3), email: "samuel.osei@example.com", phone: "+16025550137", tags: ["Gym"], createdMonthsAgo: 9 },
    { first: "Isabella", last: "Russo", type: "SPHERE", tier: "VIP", bday: [1, 30], consent: "MARKETING", lastContactDaysAgo: 95, ...h(11), email: "isabella.russo@example.org", phone: "+14805550138", tags: ["Referral source"], createdMonthsAgo: 20 },
    { first: "Noah", last: "Bergstrom", type: "SPHERE", tier: "ACTIVE", bday: 24, consent: "MARKETING", lastContactDaysAgo: 18, ...h(8), email: "noah.bergstrom@example.net", phone: "+16235550139", tags: ["Youth soccer"], createdMonthsAgo: 8 },

    // ── Sphere: standard ───────────────────────────────────────────────────
    { first: "Fatima", last: "Haddad", type: "SPHERE", tier: "STANDARD", bday: [4, 19], consent: "MARKETING", lastContactDaysAgo: 70, ...h(5), email: "fatima.haddad@example.com", phone: "+14805550140", createdMonthsAgo: 12 },
    { first: "Liam", last: "Gallagher", type: "SPHERE", tier: "STANDARD", bday: [7, 22], consent: "NONE", lastContactDaysAgo: 120, ...h(6), email: "liam.gallagher@example.org", phone: "+14805550141", tags: ["Neighbor"], createdMonthsAgo: 11 },
    { first: "Zoe", last: "Papadopoulos", type: "SPHERE", tier: "STANDARD", bday: 15, consent: "MARKETING", lastContactDaysAgo: 80, ...h(9), email: "zoe.papadopoulos@example.net", phone: "+16235550142", createdMonthsAgo: 7 },
    { first: "Henry", last: "Lockwood", type: "SPHERE", tier: "STANDARD", bday: [9, 3], consent: "MARKETING", lastContactDaysAgo: 140, ...h(1), email: "henry.lockwood@example.com", phone: "+14805550143", tags: ["Golf"], createdMonthsAgo: 14 },
    { first: "Amara", last: "Eze", type: "SPHERE", tier: "STANDARD", bday: [6, 18], consent: "MARKETING", lastContactDaysAgo: 60, ...h(10), email: "amara.eze@example.org", phone: "+14805550144", createdMonthsAgo: 6 },
    { first: "Lucas", last: "Moreau", type: "SPHERE", tier: "STANDARD", bday: [11, 8], consent: "MARKETING", lastContactDaysAgo: 100, ...h(3), email: "lucas.moreau@example.net", phone: "+16025550145", createdMonthsAgo: 5 },
    { first: "Ava", last: "Sorensen", type: "SPHERE", tier: "STANDARD", bday: 28, consent: "MARKETING", lastContactDaysAgo: 45, ...h(4), email: "ava.sorensen@example.com", phone: "+14805550146", tags: ["Youth soccer"], createdMonthsAgo: 4, assistant: true },
    { first: "Mateo", last: "Silva", type: "SPHERE", tier: "STANDARD", bday: [2, 25], consent: "NONE", lastContactDaysAgo: 200, ...h(11), email: null, phone: "+14805550147", channel: "SMS", createdMonthsAgo: 4, assistant: true },
    { first: "Harper", last: "Delgado", type: "SPHERE", tier: "STANDARD", bday: [5, 12], consent: "MARKETING", lastContactDaysAgo: 90, ...h(0), email: "harper.delgado@example.org", phone: "+16025550148", createdMonthsAgo: 3, assistant: true },
    { first: "Jasper", last: "Whitmore", type: "SPHERE", tier: "STANDARD", bday: [10, 21], consent: "MARKETING", lastContactDaysAgo: 75, ...h(7), email: "jasper.whitmore@example.net", phone: "+14805550149", tags: ["Book club"], createdMonthsAgo: 3 },
    { first: "Nina", last: "Kovacs", type: "SPHERE", tier: "STANDARD", bday: 1, consent: "MARKETING", lastContactDaysAgo: 30, ...h(2), email: "nina.kovacs@example.com", phone: "+16025550150", tags: ["Pickleball"], createdMonthsAgo: 2 },
    { first: "Diego", last: "Fuentes", type: "SPHERE", tier: "STANDARD", bday: [8, 7], consent: "MARKETING", lastContactDaysAgo: 110, ...h(5), email: "diego.fuentes@example.org", phone: "+14805550151", createdMonthsAgo: 2 },
    { first: "Ruth", last: "Abernathy", type: "SPHERE", tier: "NEEDS_RECONNECTION", bday: [3, 3], consent: "MARKETING", lastContactDaysAgo: 500, ...h(9), email: "ruth.abernathy@example.net", phone: "+16235550152", createdMonthsAgo: 24 },
    { first: "Wesley", last: "Tran", type: "SPHERE", tier: "NEEDS_RECONNECTION", bday: [12, 15], consent: "NONE", lastContactDaysAgo: 380, ...h(8), email: "wesley.tran@example.com", phone: "+16235550153", createdMonthsAgo: 20 },
    { first: "Yasmin", last: "Farouk", type: "SPHERE", tier: "STANDARD", bday: [1, 6], consent: "MARKETING", lastContactDaysAgo: 65, ...h(6), email: "yasmin.farouk@example.org", phone: "+14805550154", createdMonthsAgo: 1 },
    { first: "Caleb", last: "Hutchins", type: "SPHERE", tier: "STANDARD", bday: [4, 1], consent: "MARKETING", lastContactDaysAgo: 40, ...h(1), email: "caleb.hutchins@example.net", phone: "+14805550155", createdMonthsAgo: 1 },
    { first: "Imani", last: "Brooks", type: "SPHERE", tier: "STANDARD", bday: [9, 27], consent: "MARKETING", lastContactDaysAgo: 20, ...h(10), email: "imani.brooks@example.com", phone: "+14805550156", note: "Natalie Brooks' sister-in-law.", createdMonthsAgo: 0 },
  ];
}

export type SeedResult = { workspaceId: string; contacts: number; planner: unknown; jobs: unknown };

async function wipeWorkspace(workspaceId: string) {
  // Cascades remove every tenant-owned row of the demo workspace only.
  await prisma.workspace.delete({ where: { id: workspaceId } });
}

export async function seedDemoWorkspace(opts: { reset?: boolean; now?: Date } = {}): Promise<SeedResult> {
  const now = opts.now ?? new Date();
  const today = toLocalDate(now, TZ);
  const existing = await prisma.workspace.findUnique({ where: { slug: DEMO_WORKSPACE_SLUG } });
  if (existing) {
    if (!existing.isDemo) throw new Error("Refusing to reset: workspace with the demo slug is not marked as a demo workspace.");
    if (!opts.reset) throw new Error("Demo workspace already exists. Run `npm run demo:reset` to recreate it.");
    await wipeWorkspace(existing.id);
  }

  const ws = await prisma.workspace.create({
    data: {
      name: "KM Rojas Group — Arizona Real Estate",
      slug: DEMO_WORKSPACE_SLUG,
      timezone: TZ,
      marketRegion: "US-AZ",
      isDemo: true,
      brandVoiceJson: JSON.stringify({
        agentName: "Kelly Rojas",
        teamName: "KM Rojas Group",
        signature: "Kelly Rojas\nKM Rojas Group · Arizona Real Estate",
        tone: "Warm, professional, conversational, natural, relationship-focused and non-salesy. Sounds like a trusted neighbor who happens to know real estate.",
        phrasesToUse: ["I'm always happy to help", "just a reply away"],
        phrasesToAvoid: ["act now", "don't miss out", "hot market", "limited time", "just checking in to see if you're ready"],
        marketArea: "the Phoenix metro",
      }),
      complianceJson: JSON.stringify({
        physicalAddress: "100 Demo Plaza, Suite 200, Phoenix, AZ 85004 (fictional demo address)",
        senderName: "Kelly Rojas · KM Rojas Group",
        senderEmail: "demo-agent@example.com",
        smsEnabled: false,
        smsLegalReviewCompletedAt: null,
        requireApprovalForMilestones: true,
      }),
      schedulingJson: JSON.stringify(DEFAULT_SCHEDULING),
    },
  });
  const owner = await prisma.user.create({ data: { workspaceId: ws.id, email: "demo-agent@example.com", name: "Kelly Rojas", role: "OWNER", title: "Team Lead (demo)" } });
  const assistant = await prisma.user.create({ data: { workspaceId: ws.id, email: "demo-assistant@example.com", name: "Jordan Ellis", role: "AGENT", title: "Buyer's Agent (demo)" } });
  const ctx: Ctx = { workspaceId: ws.id, userId: owner.id, actorType: "USER" };

  // Templates
  const templates = [
    { key: "NEWSLETTER_MARKET_INSIGHTS", category: "NEWSLETTER", name: "Market Insights", description: "1st newsletter each month: local trends, market updates, homeowner tips, neighborhood insights.", subjectTemplate: "{{first_name}}, a quick read on the market", bodyTemplate: "Hi {{first_name}},\n\n…" },
    { key: "NEWSLETTER_LIFESTYLE_COMMUNITY", category: "NEWSLETTER", name: "Lifestyle & Community", description: "2nd newsletter each month: community happenings, local highlights, seasonal advice, relationship stories.", subjectTemplate: "This month around {{city}}", bodyTemplate: "Hi {{first_name}},\n\n…" },
    {
      key: "SEASONAL_Q1",
      category: "SEASONAL",
      name: SEASONAL_DEFAULTS.SEASONAL_Q1.name,
      description: "A warm new-year check-in. No market pitch.",
      subjectTemplate: "Happy New Year, {{first_name}}!",
      bodyTemplate: "Hi {{first_name}},\n\nHappy New Year! As the year gets started I've been thinking about the people who made last year so meaningful — and you're one of them.\n\nI'd love to hear what's new with you. If anything about your home is on your mind this year — projects, questions, or just curiosity about what it's worth — I'm always happy to help.\n\nWishing you a healthy, happy year ahead,\nKelly",
    },
    {
      key: "SEASONAL_Q2",
      category: "SEASONAL",
      name: SEASONAL_DEFAULTS.SEASONAL_Q2.name,
      description: "Spring thank-you with practical pre-summer home tips.",
      subjectTemplate: "A little spring thank-you, {{first_name}}",
      bodyTemplate: "Hi {{first_name}},\n\nSpring in the desert goes by fast, so I wanted to send a quick thank-you before the heat arrives. Clients and friends like you are the reason I love what I do.\n\nA few pre-summer reminders:\n• Book an HVAC check before the first 100° week.\n• Replace air filters and check attic insulation.\n• Adjust irrigation for warmer temperatures.\n\nIf I can help with anything — even a contractor recommendation — just reply.\n\nWarmly,\nKelly",
    },
    {
      key: "SEASONAL_Q3",
      category: "SEASONAL",
      name: SEASONAL_DEFAULTS.SEASONAL_Q3.name,
      description: "Summer community connection — staying cool and connected.",
      subjectTemplate: "Staying cool and connected this summer",
      bodyTemplate: "Hi {{first_name}},\n\nSummer is here! I hope you're finding ways to stay cool and enjoy the long evenings.\n\nI'd love to hear your favorite local spots for beating the heat — reply and I'll share the best ones with our community later this summer.\n\nA few monsoon-season reminders:\n• Clear roof drains and gutters.\n• Trim trees near the house.\n• Keep surge protectors on key electronics.\n\nTalk soon,\nKelly",
    },
    {
      key: "SEASONAL_Q4",
      category: "SEASONAL",
      name: SEASONAL_DEFAULTS.SEASONAL_Q4.name,
      description: "Thanksgiving gratitude / client appreciation. Replaces a nearby routine newsletter.",
      subjectTemplate: "Grateful for you, {{first_name}}",
      bodyTemplate: "Hi {{first_name}},\n\nAs Thanksgiving approaches, I wanted to pause and say thank you. Helping you find, buy or sell a home is something I never take for granted, and staying in touch with you has been one of the best parts of my year.\n\nWishing you and your family a warm, relaxing Thanksgiving.\n\nWith gratitude,\nKelly",
    },
    { key: "MILESTONE_BIRTHDAY", category: "MILESTONE", name: "Birthday greeting", description: "Personal birthday note. Never needs a birth year.", subjectTemplate: "Happy birthday, {{first_name}}!", bodyTemplate: "Hi {{first_name}},\n\nWishing you a very happy birthday!" },
    { key: "MILESTONE_HOME_ANNIVERSARY", category: "MILESTONE", name: "Home anniversary", description: "Uses the verified closing date only.", subjectTemplate: "Happy home anniversary, {{first_name}}!", bodyTemplate: "Hi {{first_name}},\n\nHappy home anniversary!" },
  ];
  for (const t of templates) await prisma.campaignTemplate.create({ data: { ...t, workspaceId: ws.id } });

  // Contacts
  const seeds = contacts(today);
  const ids = new Map<string, string>();
  for (const [i, s] of seeds.entries()) {
    let birthdayMonth: number | null = null;
    let birthdayDay: number | null = null;
    if (typeof s.bday === "number") {
      const d = parseLocalDate(addDays(today, s.bday));
      birthdayMonth = d.month;
      birthdayDay = d.day;
    } else if (s.bday) [birthdayMonth, birthdayDay] = s.bday;

    let closingDate: Date | null = null;
    if (s.anniv) {
      const occ = parseLocalDate(addDays(today, s.anniv.inDays));
      const year = occ.year - s.anniv.years;
      const leapSafeDay = occ.month === 2 && occ.day === 29 && !isLeapYear(year) ? 28 : occ.day;
      closingDate = localToDateOnly(makeLocalDate(year, occ.month, leapSafeDay));
    } else if (s.closedYearsAgo) {
      const d = parseLocalDate(addDays(today, 120 + i * 7));
      closingDate = localToDateOnly(makeLocalDate(d.year - s.closedYearsAgo, d.month, Math.min(d.day, 28)));
    }
    const email = s.email === undefined ? `${s.first}.${s.last}`.toLowerCase().replace(/[^a-z.]/g, "") + "@example.com" : s.email;
    const createdAt = new Date(now.getTime() - (s.createdMonthsAgo * 30 + (i % 9)) * 86_400_000);
    const c = await prisma.contact.create({
      data: {
        workspaceId: ws.id,
        firstName: s.first,
        lastName: s.last,
        email,
        emailNormalized: normalizeEmail(email),
        phone: s.phone ?? null,
        phoneNormalized: normalizePhone(s.phone),
        contactType: s.type,
        clientRole: s.type === "PAST_CLIENT" ? (s.role ?? "BUYER") : null,
        tier: s.tier,
        birthdayMonth,
        birthdayDay,
        birthdayYear: s.bdayYear ?? null,
        birthdayVerified: birthdayMonth !== null && !s.bdayUnverified,
        closingDate,
        closingDateVerified: !!closingDate && !s.anniv?.unverified,
        relationshipStartDate: s.type === "SPHERE" ? localToDateOnly(addDays(today, -(s.createdMonthsAgo * 30 + 400))) : null,
        propertyAddress: s.type === "PAST_CLIENT" && s.street ? `${s.street}, ${s.city}, AZ` : null,
        neighborhood: s.hood,
        city: s.city,
        lastCommunicationAt: s.lastContactDaysAgo === null ? null : new Date(now.getTime() - s.lastContactDaysAgo * 86_400_000),
        preferredChannel: s.channel ?? "EMAIL",
        doNotContact: s.flags?.includes("DND") ?? false,
        unsubscribedAt: s.flags?.includes("UNSUBSCRIBED") ? new Date(now.getTime() - 50 * 86_400_000) : null,
        assignedAgentId: s.assistant ? assistant.id : owner.id,
        source: "SEED",
        createdAt,
        preference: {
          create: {
            workspaceId: ws.id,
            receiveNewsletters: !s.flags?.includes("NO_NEWSLETTERS"),
            frequency: s.flags?.includes("REDUCED") ? "REDUCED" : "NORMAL",
          },
        },
      },
    });
    ids.set(`${s.first} ${s.last}`, c.id);
    await syncMilestones(prisma, c);

    const consentAt = new Date(createdAt.getTime() + 86_400_000);
    if (s.consent === "MARKETING" || s.consent === "REVOKED") {
      await prisma.contactConsentRecord.create({
        data: { workspaceId: ws.id, contactId: c.id, channel: "EMAIL", purpose: "MARKETING", status: "GRANTED", source: s.type === "PAST_CLIENT" ? "Closing paperwork: email newsletter opt-in checkbox (demo)" : "Open house sign-in sheet opt-in (demo)", capturedAt: consentAt, capturedBy: owner.id },
      });
    }
    if (s.consent === "REVOKED") {
      await prisma.contactConsentRecord.create({
        data: { workspaceId: ws.id, contactId: c.id, channel: "EMAIL", purpose: "MARKETING", status: "REVOKED", source: "Asked by phone to stop newsletters (demo)", capturedAt: new Date(now.getTime() - 30 * 86_400_000), capturedBy: owner.id },
      });
    }
    if (s.consent === "RELATIONSHIP") {
      await prisma.contactConsentRecord.create({
        data: { workspaceId: ws.id, contactId: c.id, channel: "EMAIL", purpose: "RELATIONSHIP", status: "GRANTED", source: "Verbal: OK with personal notes, not newsletters (demo)", capturedAt: consentAt, capturedBy: owner.id },
      });
    }
    if (s.flags?.includes("UNSUBSCRIBED")) {
      await prisma.contactConsentRecord.create({
        data: { workspaceId: ws.id, contactId: c.id, channel: "EMAIL", purpose: "MARKETING", status: "REVOKED", source: "Clicked unsubscribe link (demo)", capturedAt: new Date(now.getTime() - 50 * 86_400_000), capturedBy: "system" },
      });
    }
    if (s.note) {
      await prisma.contactNote.create({ data: { workspaceId: ws.id, contactId: c.id, body: s.note, authorId: owner.id, createdAt: new Date(now.getTime() - 20 * 86_400_000) } });
    }
    for (const name of s.tags ?? []) {
      const tag = await prisma.tag.upsert({ where: { workspaceId_name: { workspaceId: ws.id, name } }, create: { workspaceId: ws.id, name }, update: {} });
      await prisma.contactTag.create({ data: { workspaceId: ws.id, contactId: c.id, tagId: tag.id } });
    }
  }

  // Relationships (spouses / referrals) — fictional
  const rel = async (a: string, b: string, type: string) =>
    prisma.contactRelationship.create({ data: { workspaceId: ws.id, contactId: ids.get(a)!, relatedContactId: ids.get(b)!, relationshipType: type } });
  await rel("Grace Okonkwo", "Elena Marquez", "REFERRED_BY");
  await rel("Imani Brooks", "Natalie Brooks", "FAMILY");
  await rel("Olivia Park", "Marcus Bell", "NEIGHBOR");
  await rel("Hannah Lindqvist", "Benjamin Adeyemi", "REFERRED_BY");

  // History: three months of simulated newsletters (twice monthly) to consenting contacts.
  const consenting = await prisma.contact.findMany({ where: { workspaceId: ws.id, unsubscribedAt: null, doNotContact: false, consentRecords: { some: { status: "GRANTED", purpose: "MARKETING" } } } });
  for (let monthsAgo = 3; monthsAgo >= 1; monthsAgo--) {
    for (const [idx, day] of DEFAULT_SCHEDULING.newsletterDays.entries()) {
      const base = parseLocalDate(today);
      const m = ((base.month - monthsAgo - 1 + 12) % 12) + 1;
      const y = base.month - monthsAgo <= 0 ? base.year - 1 : base.year;
      const date = makeLocalDate(y, m, day);
      const sentAt = zonedTimeToUtc(date, 9, 0, TZ);
      const kind = idx === 0 ? "MARKET_INSIGHTS" : "LIFESTYLE_COMMUNITY";
      const campaign = await prisma.campaign.create({
        data: {
          workspaceId: ws.id,
          category: "NEWSLETTER",
          kind,
          name: `${kind === "MARKET_INSIGHTS" ? "Market Insights" : "Lifestyle & Community"} — ${date}`,
          subject: kind === "MARKET_INSIGHTS" ? "What's worth knowing about your home this month" : "This month around the Valley",
          body: "Hi {{first_name}},\n\n(Historical demo newsletter.)\n\nKelly",
          status: "SENT",
          scheduledFor: sentAt,
          sentAt,
          contentSource: "AI_MOCK",
          approvedContentVersion: 1,
          approvedById: owner.id,
          approvedAt: new Date(sentAt.getTime() - 3 * 86_400_000),
          createdAt: new Date(sentAt.getTime() - 7 * 86_400_000),
        },
      });
      for (const c of consenting) {
        if (c.createdAt > sentAt) continue;
        const msg = await prisma.scheduledMessage.create({
          data: { workspaceId: ws.id, contactId: c.id, campaignId: campaign.id, category: "NEWSLETTER", kind, subject: campaign.subject, body: campaign.body, status: "SIMULATED", scheduledFor: sentAt, sentAt, occurrenceKey: campaign.id, idempotencyKey: `${ws.id}:campaign:${campaign.id}:${c.id}`, contentSource: "AI_MOCK", approvedById: owner.id, approvedAt: campaign.approvedAt },
        });
        await prisma.communicationEvent.create({ data: { workspaceId: ws.id, contactId: c.id, scheduledMessageId: msg.id, direction: "OUTBOUND", channel: "EMAIL", type: "SIMULATED_SEND", subject: campaign.subject, occurredAt: sentAt, source: "DEMO" } });
        await prisma.campaignRecipient.create({ data: { workspaceId: ws.id, campaignId: campaign.id, contactId: c.id, status: "SENT", plannedFor: sentAt } });
      }
    }
  }

  // A few completed personal touches for analytics history.
  const done = ["Elena Marquez", "Grace Okonkwo", "Benjamin Adeyemi", "Olivia Park", "Hannah Lindqvist", "Marcus Bell", "Tomás Herrera", "Chloe Dubois"];
  for (const [i, name] of done.entries()) {
    const at = new Date(now.getTime() - (10 + i * 6) * 86_400_000);
    await prisma.agentTask.create({
      data: { workspaceId: ws.id, contactId: ids.get(name)!, type: i % 3 === 0 ? "CALL" : "PERSONAL_MESSAGE", title: `${i % 3 === 0 ? "Called" : "Sent a note to"} ${name}`, status: "DONE", completedAt: at, priority: 40, dedupeKey: `seed-history:${i}`, sourceType: i % 2 ? "MILESTONE" : "MANUAL", createdAt: new Date(at.getTime() - 2 * 86_400_000) },
    });
    await prisma.communicationEvent.create({ data: { workspaceId: ws.id, contactId: ids.get(name)!, direction: "OUTBOUND", channel: i % 3 === 0 ? "PHONE" : "EMAIL", type: i % 3 === 0 ? "CALL" : "MANUAL_REPLY", body: "Personal touch (demo history)", occurredAt: at, source: "DEMO" } });
  }

  // Seasonal campaigns: the next upcoming one is approved and scheduled for Past Clients;
  // the rest stay as editable drafts.
  const year = parseLocalDate(today).year;
  let scheduledSeasonal = false;
  for (const y of [year, year + 1]) {
    for (const kind of Object.keys(SEASONAL_DEFAULTS) as SeasonalKind[]) {
      const date = defaultSeasonalDate(kind, y, "US-AZ");
      if (date <= addDays(today, 3) || date > addDays(today, 400)) continue;
      const c = await createSeasonalCampaign(ctx, { kind, year: y }, now);
      if (!scheduledSeasonal && kind === "SEASONAL_Q4") {
        await updateCampaign(ctx, c.id, {
          name: c.name,
          subject: c.subject,
          previewText: "A short note of thanks before the holiday.",
          body: c.body,
          sendDate: date,
          segment: segmentSchema.parse({ contactTypes: ["PAST_CLIENT"] }),
          replacesNewsletter: true,
          verifiedMarketData: null,
        }, now);
        await approveCampaign(ctx, c.id);
        await scheduleCampaign(ctx, c.id, date, now);
        scheduledSeasonal = true;
      }
    }
  }

  // Fictional inbound replies (recent + older) that flow through reply intelligence.
  const replies: [string, string, number][] = [
    ["Aisha Rahman", "Thanks for the newsletter! We may sell next year because we're planning to move closer to my parents in Tucson.", 1],
    ["Ethan Ramirez", "Great tips as always. My sister is relocating from Denver to Scottsdale this spring and needs a realtor — okay if I give her your number?", 2],
    ["Hannah Lindqvist", "We love the house! Starting to think about buying a bigger home in a couple of years once the baby arrives.", 3],
    ["Robert Achterberg", "Good read. I'm thinking about buying another rental property next spring — can we set up a call after the holidays?", 2],
    ["Olivia Park", "Thank you for the sweet note, it made my day!", 4],
    ["Wesley Tran", "Please remove me from your list.", 5],
    ["Tomás Herrera", "Can we grab coffee next week? I have questions about refinancing versus moving.", 40],
    ["Chloe Dubois", "My coworker is moving to Tempe and asked if I knew a good agent. Passing along your info!", 55],
  ];
  for (const [i, [name, text, daysAgo]] of replies.entries()) {
    await ingestInboundReply(ctx, { contactId: ids.get(name)!, text, subject: "Re: newsletter", source: "DEMO", externalId: `demo-reply-${i}`, occurredAt: new Date(now.getTime() - daysAgo * 86_400_000) });
  }

  // Run the real pipeline: daily review + job processing.
  const planner = await runDailyPlanner(ctx, now);
  const jobs = await processDueJobs({ now: new Date(Math.max(Date.now(), now.getTime())), workspaceId: ws.id, limit: 500, workerId: "seed" });

  // Older appointment attributed to nurture (from the coffee request 40 days ago).
  const oldReply = await prisma.communicationEvent.findFirst({ where: { workspaceId: ws.id, externalId: "demo-reply-6" } });
  if (oldReply) {
    await prisma.agentTask.updateMany({ where: { workspaceId: ws.id, dedupeKey: `review-reply:${oldReply.id}` }, data: { status: "DONE", completedAt: new Date(now.getTime() - 38 * 86_400_000) } });
    await prisma.communicationEvent.update({ where: { id: oldReply.id }, data: { triageStatus: "REVIEWED" } });
    const opp = await prisma.opportunity.create({
      data: { workspaceId: ws.id, contactId: oldReply.contactId, type: "SELLER", status: "APPOINTMENT_SET", summary: "Met for coffee to compare refinancing with selling (demo).", evidence: oldReply.body, sourceEventId: oldReply.id, timeframe: "next year", appointmentAt: new Date(now.getTime() - 33 * 86_400_000), confirmedById: owner.id, confirmedAt: new Date(now.getTime() - 38 * 86_400_000), createdAt: new Date(now.getTime() - 39 * 86_400_000) },
    });
    void opp;
  }
  const oldReferral = await prisma.communicationEvent.findFirst({ where: { workspaceId: ws.id, externalId: "demo-reply-7" } });
  if (oldReferral) {
    await prisma.communicationEvent.update({ where: { id: oldReferral.id }, data: { triageStatus: "REVIEWED" } });
    const opp = await prisma.opportunity.findFirst({ where: { sourceEventId: oldReferral.id } });
    if (opp) await updateOpportunity(ctx, opp.id, "CONFIRM");
    await prisma.agentTask.updateMany({ where: { workspaceId: ws.id, sourceId: { in: [oldReferral.id, opp?.id ?? "-"] } }, data: { status: "DONE", completedAt: new Date(now.getTime() - 50 * 86_400_000) } });
  }

  return { workspaceId: ws.id, contacts: seeds.length, planner, jobs: { processed: jobs.processed, succeeded: jobs.succeeded, failed: jobs.failed } };
}
