/** Runtime-validated AI contracts. Every AI response is parsed with these. */
import { z } from "zod";
import { REPLY_CLASSIFICATIONS } from "@/lib/domain/types";

export const newsletterDraftSchema = z.object({
  subject: z.string().min(3).max(120),
  previewText: z.string().max(160),
  body: z.string().min(40).max(6000),
  topicsCovered: z.array(z.string()).max(8),
  notes: z.array(z.string()).max(8),
});
export type NewsletterDraft = z.infer<typeof newsletterDraftSchema>;

export const greetingDraftSchema = z.object({
  subject: z.string().min(3).max(120),
  body: z.string().min(20).max(2000),
});
export type GreetingDraft = z.infer<typeof greetingDraftSchema>;

export const replyClassificationSchema = z.object({
  classification: z.enum(REPLY_CLASSIFICATIONS),
  secondary: z.array(z.enum(REPLY_CLASSIFICATIONS)).max(3),
  confidence: z.number().min(0).max(1),
  summary: z.string().min(3).max(400),
  timeframe: z.string().max(80).nullable(),
  mentionedPerson: z.string().max(120).nullable(),
  evidenceQuote: z.string().max(500),
  recommendedAction: z.string().min(3).max(300),
  suggestedReply: z.string().max(1200),
});
export type ReplyClassificationResult = z.infer<typeof replyClassificationSchema>;

/** Hand-written JSON Schemas for OpenAI strict structured outputs. */
export const jsonSchemas = {
  newsletter: {
    type: "object",
    additionalProperties: false,
    required: ["subject", "previewText", "body", "topicsCovered", "notes"],
    properties: {
      subject: { type: "string" },
      previewText: { type: "string" },
      body: { type: "string" },
      topicsCovered: { type: "array", items: { type: "string" } },
      notes: { type: "array", items: { type: "string" } },
    },
  },
  greeting: {
    type: "object",
    additionalProperties: false,
    required: ["subject", "body"],
    properties: { subject: { type: "string" }, body: { type: "string" } },
  },
  reply: {
    type: "object",
    additionalProperties: false,
    required: [
      "classification",
      "secondary",
      "confidence",
      "summary",
      "timeframe",
      "mentionedPerson",
      "evidenceQuote",
      "recommendedAction",
      "suggestedReply",
    ],
    properties: {
      classification: { type: "string", enum: [...REPLY_CLASSIFICATIONS] },
      secondary: { type: "array", items: { type: "string", enum: [...REPLY_CLASSIFICATIONS] } },
      confidence: { type: "number" },
      summary: { type: "string" },
      timeframe: { type: ["string", "null"] },
      mentionedPerson: { type: ["string", "null"] },
      evidenceQuote: { type: "string" },
      recommendedAction: { type: "string" },
      suggestedReply: { type: "string" },
    },
  },
} as const;
