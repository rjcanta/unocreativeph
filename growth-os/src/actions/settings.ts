"use server";

import { bool, list, runAction, str, type ActionResult } from "@/lib/server/action";
import { seedDemoWorkspace } from "@/lib/demo/seed";
import { brandVoiceSchema, complianceSchema, schedulingSchema } from "@/lib/domain/settings";
import { AppError } from "@/lib/server/errors";
import * as integrations from "@/lib/server/integrations";
import * as settings from "@/lib/server/settings";

const lines = (v: string) => v.split("\n").map((l) => l.trim()).filter(Boolean);

export async function brandVoiceAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    await settings.updateBrandVoice(
      s,
      brandVoiceSchema.parse({
        agentName: str(fd, "agentName"),
        teamName: str(fd, "teamName"),
        signature: String(fd.get("signature") ?? "").trim(),
        tone: str(fd, "tone"),
        phrasesToUse: lines(String(fd.get("phrasesToUse") ?? "")),
        phrasesToAvoid: lines(String(fd.get("phrasesToAvoid") ?? "")),
        marketArea: str(fd, "marketArea"),
      }),
    );
    return "Brand voice saved. New drafts will use it.";
  });
}

export async function complianceAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    await settings.updateCompliance(
      s,
      complianceSchema.parse({
        physicalAddress: str(fd, "physicalAddress"),
        senderName: str(fd, "senderName"),
        senderEmail: str(fd, "senderEmail"),
        unsubscribeText: str(fd, "unsubscribeText"),
        smsEnabled: bool(fd, "smsEnabled"),
        smsLegalReviewCompletedAt: str(fd, "smsLegalReviewCompletedAt") || null,
        requireApprovalForMilestones: bool(fd, "requireApprovalForMilestones"),
      }),
    );
    return "Compliance settings saved.";
  });
}

export async function schedulingAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    const n = (k: string) => Number(str(fd, k));
    await settings.updateScheduling(
      s,
      schedulingSchema.parse({
        maxRoutinePerMonth: n("maxRoutinePerMonth"),
        milestoneBufferDays: n("milestoneBufferDays"),
        seasonalReplacesNewsletter: bool(fd, "seasonalReplacesNewsletter"),
        seasonalReplaceWindowDays: n("seasonalReplaceWindowDays"),
        routineConflictAction: str(fd, "routineConflictAction"),
        sendWindowStartHour: n("sendWindowStartHour"),
        sendWindowEndHour: n("sendWindowEndHour"),
        marketingDays: list(fd, "marketingDays").map(Number),
        milestoneLookaheadDays: n("milestoneLookaheadDays"),
        milestoneSendHour: n("milestoneSendHour"),
        leapDayRule: str(fd, "leapDayRule"),
        reconnectAfterDays: n("reconnectAfterDays"),
        newsletterDays: [n("newsletterDay1"), n("newsletterDay2")],
      }),
      str(fd, "timezone"),
      str(fd, "marketRegion"),
    );
    return "Scheduling rules saved.";
  });
}

export async function pauseSendingAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    const paused = str(fd, "paused") === "true";
    await settings.setSendingPaused(s, paused);
    return paused ? "All sending paused immediately." : "Sending resumed.";
  });
}

export async function liveSendingAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    const enabled = str(fd, "enabled") === "true";
    await settings.setLiveSending(s, enabled);
    return enabled ? "Live sending enabled for this workspace." : "Live sending disabled.";
  });
}

export async function resetDemoAction(_: ActionResult | null, fd: FormData) {
  void fd;
  return runAction(
    async (s) => {
      if (!s.isDemo) throw new AppError("Only the demo workspace can be reset.", "POLICY", false);
      await seedDemoWorkspace({ reset: true });
      return "Demo data reset.";
    },
    { processJobs: false },
  );
}

export async function connectMockAction(_: ActionResult | null, fd: FormData) {
  void fd;
  return runAction(async (s) => {
    await integrations.connectMock(s);
    return "Mock HighLevel adapter connected.";
  });
}

export async function connectLiveAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    await integrations.connectLive(s, { token: str(fd, "token"), locationId: str(fd, "locationId") });
    return "Connected to HighLevel.";
  });
}

export async function syncAction(_: ActionResult | null, fd: FormData) {
  void fd;
  return runAction(async (s) => {
    const r = await integrations.syncContacts(s);
    return `Sync complete: ${r.created} new, ${r.linked} matched, ${r.updated} updated, ${r.unchanged} unchanged, ${r.conflicts} conflicts.`;
  });
}

export async function disconnectAction(_: ActionResult | null, fd: FormData) {
  void fd;
  return runAction(async (s) => {
    await integrations.disconnect(s);
    return "Disconnected and credentials deleted.";
  });
}

export async function integrationLiveSendAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    await integrations.setIntegrationLiveSend(s, str(fd, "enabled") === "true");
    return "Updated.";
  });
}
