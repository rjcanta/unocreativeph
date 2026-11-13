"use server";

import type { LocalDate } from "@/lib/domain/dates";
import { segmentSchema } from "@/lib/domain/segmentation";
import type { NewsletterKind, SeasonalKind } from "@/lib/domain/types";
import { bool, list, opt, runAction, str, type ActionResult } from "@/lib/server/action";
import * as campaigns from "@/lib/server/campaigns";
import * as messaging from "@/lib/server/messaging";

export async function createNewsletterAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    const c = await campaigns.createNewsletterDraft(s, {
      kind: str(fd, "kind") as NewsletterKind,
      sendDate: str(fd, "sendDate") as LocalDate,
      verifiedMarketData: opt(fd, "verifiedMarketData"),
      segment: { contactTypes: list(fd, "contactTypes") as ("PAST_CLIENT" | "SPHERE")[] },
    });
    return { message: "AI draft ready for your review.", data: { id: c.id } };
  });
}

export async function createSeasonalAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    const year = Number(str(fd, "year"));
    const kind = opt(fd, "kind") as SeasonalKind | null;
    if (kind) {
      const c = await campaigns.createSeasonalCampaign(s, { kind, year });
      return { message: "Seasonal campaign created.", data: { id: c.id } };
    }
    const list = await campaigns.ensureSeasonalCampaigns(s, year);
    return `Seasonal campaigns for ${year} are ready (${list.length}).`;
  });
}

export async function saveCampaignAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    await campaigns.updateCampaign(s, str(fd, "id"), {
      name: str(fd, "name"),
      subject: str(fd, "subject"),
      previewText: str(fd, "previewText"),
      body: String(fd.get("body") ?? ""),
      sendDate: (opt(fd, "sendDate") as LocalDate | null) ?? null,
      segment: segmentSchema.parse({
        contactTypes: list(fd, "contactTypes"),
        tiers: list(fd, "tiers"),
        clientRoles: list(fd, "clientRoles"),
        tagsAny: list(fd, "tagsAny"),
        neighborhoods: list(fd, "neighborhoods"),
      }),
      replacesNewsletter: bool(fd, "replacesNewsletter"),
      verifiedMarketData: opt(fd, "verifiedMarketData"),
    });
    return "Saved. Approve the campaign when you're happy with it.";
  });
}

export async function regenerateAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    await campaigns.regenerateNewsletter(s, str(fd, "id"), opt(fd, "verifiedMarketData"));
    return "New AI draft generated. Review it before approving.";
  });
}

export async function approveCampaignAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    await campaigns.approveCampaign(s, str(fd, "id"));
    return "Approved. Messages were prepared for eligible recipients using your scheduling rules.";
  });
}

export async function scheduleCampaignAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    await campaigns.scheduleCampaign(s, str(fd, "id"), str(fd, "sendDate") as LocalDate);
    return "Send date saved.";
  });
}

export async function pauseCampaignAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    const paused = str(fd, "paused") === "true";
    await campaigns.setCampaignPaused(s, str(fd, "id"), paused);
    return paused ? "Campaign paused. Nothing will be delivered until you resume." : "Campaign resumed.";
  });
}

export async function cancelCampaignAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    await campaigns.cancelCampaign(s, str(fd, "id"));
    return "Campaign cancelled. Unsent messages were cancelled.";
  });
}

export async function testSendAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => (await campaigns.sendCampaignTest(s, str(fd, "id"))).message);
}

export async function approveMessageAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    await messaging.approveMessage(s, str(fd, "id"));
    return "Approved and scheduled.";
  });
}

export async function editMessageAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    await messaging.editMessage(s, str(fd, "id"), { subject: str(fd, "subject"), body: String(fd.get("body") ?? "") });
    return "Saved. Approve it to schedule delivery.";
  });
}

export async function cancelMessageAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    await messaging.cancelMessage(s, str(fd, "id"));
    return "Message cancelled.";
  });
}
