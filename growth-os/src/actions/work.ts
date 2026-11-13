"use server";

import type { TaskType } from "@/lib/domain/types";
import { opt, runAction, str, type ActionResult } from "@/lib/server/action";
import { setInsightStatus } from "@/lib/server/insights";
import { processDueJobs, rescheduleJob, retryJob, setJobStatus } from "@/lib/server/jobs-runner";
import { runDailyPlanner } from "@/lib/server/planner";
import * as replies from "@/lib/server/replies";
import * as tasks from "@/lib/server/tasks";
import { appMode } from "@/lib/server/context";
import { AppError } from "@/lib/server/errors";

export async function taskStatusAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    const status = str(fd, "status") as "DONE" | "DISMISSED" | "OPEN";
    await tasks.setTaskStatus(s, str(fd, "id"), status);
    return status === "DONE" ? "Nice work — marked done." : status === "DISMISSED" ? "Dismissed." : "Reopened.";
  });
}

export async function snoozeTaskAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    const days = Number(str(fd, "days") || "3");
    await tasks.snoozeTask(s, str(fd, "id"), days, s.timezone);
    return `Snoozed for ${days} days.`;
  });
}

export async function createTaskAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    await tasks.createManualTask(s, { title: str(fd, "title"), contactId: opt(fd, "contactId"), dueDate: opt(fd, "dueDate"), type: (opt(fd, "type") as TaskType) ?? "FOLLOW_UP", description: str(fd, "description") }, s.timezone);
    return "Task added to your queue.";
  });
}

export async function insightAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    await setInsightStatus(s, str(fd, "id"), str(fd, "status") === "ACTED" ? "ACTED" : "DISMISSED");
    return "Updated.";
  });
}

export async function triageReplyAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    await replies.setReplyTriage(s, str(fd, "id"), str(fd, "triage") as "REVIEWED");
    return "Updated.";
  });
}

export async function logReplyAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    await replies.logManualReply(s, str(fd, "id"), str(fd, "body"));
    return "Logged your personal reply on the timeline.";
  });
}

export async function simulateReplyAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    if (!s.isDemo && appMode() !== "demo") throw new AppError("Reply simulation is only available in Demo Mode.", "POLICY", false);
    const preset = replies.SIMULATED_REPLIES.find((r) => r.key === str(fd, "preset"));
    const text = str(fd, "text") || preset?.text || "";
    const { duplicate } = await replies.ingestInboundReply(s, { contactId: str(fd, "contactId"), text, subject: "Re: your last note", source: "SIMULATION", externalId: `sim-${Date.now()}` });
    return duplicate ? "Duplicate event ignored." : "Fictional reply received and classified.";
  });
}

export async function opportunityAction(_: ActionResult | null, fd: FormData) {
  return runAction(async (s) => {
    const action = str(fd, "action") as "CONFIRM" | "DISMISS" | "APPOINTMENT" | "WON" | "LOST";
    await replies.updateOpportunity(s, str(fd, "id"), action, opt(fd, "appointmentAt") ?? undefined);
    return { CONFIRM: "Confirmed as a real opportunity.", DISMISS: "Dismissed.", APPOINTMENT: "Appointment recorded.", WON: "Marked won.", LOST: "Marked lost." }[action];
  });
}

export async function runPlannerAction(_: ActionResult | null, fd: FormData) {
  void fd;
  return runAction(async (s) => {
    const r = await runDailyPlanner(s);
    return `Daily review complete: ${r.contactsReviewed} contacts reviewed, ${r.milestoneJobs} milestone jobs queued, ${r.tasksCreated} tasks created, ${r.newslettersDrafted} newsletter drafts.`;
  });
}

export async function processJobsAction(_: ActionResult | null, fd: FormData) {
  return runAction(
    async (s) => {
      const at = opt(fd, "at");
      let now = new Date();
      if (at) {
        if (!s.isDemo) throw new AppError("Time simulation is only available in the demo workspace.", "POLICY", false);
        now = new Date(at);
        if (Number.isNaN(now.getTime())) throw new AppError("Invalid date/time.", "VALIDATION", false);
        if (now.getTime() < Date.now() - 60_000) throw new AppError("Simulated time must be in the future.", "VALIDATION", false);
      }
      const r = await processDueJobs({ workspaceId: s.workspaceId, now, limit: 500, workerId: at ? "simulation" : "manual" });
      return `Processed ${r.processed} job${r.processed === 1 ? "" : "s"}${at ? ` as of ${now.toLocaleString("en-US", { timeZone: s.timezone })}` : ""}: ${r.succeeded} succeeded, ${r.deferred} deferred, ${r.retrying} retrying, ${r.failed} failed.`;
    },
    { processJobs: false },
  );
}

export async function jobControlAction(_: ActionResult | null, fd: FormData) {
  return runAction(
    async (s) => {
      const id = str(fd, "id");
      const op = str(fd, "op");
      if (op === "retry") await retryJob(s, id);
      else if (op === "pause") await setJobStatus(s, id, "PAUSED");
      else if (op === "resume") await setJobStatus(s, id, "PENDING");
      else if (op === "cancel") await setJobStatus(s, id, "CANCELLED");
      else if (op === "reschedule") {
        const at = new Date(str(fd, "runAt"));
        if (Number.isNaN(at.getTime())) throw new AppError("Choose a valid time.", "VALIDATION", false);
        await rescheduleJob(s, id, at);
      }
      return "Job updated.";
    },
    { processJobs: false },
  );
}
