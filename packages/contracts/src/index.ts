import { z } from "zod";

export const MAX_CREDITS = 2147483647;
const worldIdSchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[A-Za-z0-9:_-]+$/, "worldId must match [A-Za-z0-9:_-]");
const creditsSchema = z.number().int().min(0).max(MAX_CREDITS);

export const principalSchema = z.object({
  kind: z.enum(["human", "agent", "org"]),
  displayName: z.string().min(1).max(120),
  worldId: worldIdSchema.default("production"),
});

export const serviceSchema = z.object({
  providerId: z.string().min(1).max(120),
  capabilityId: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  priceCredits: z.number().int().min(1).max(MAX_CREDITS),
});

export const requestSchema = z.object({
  requesterId: z.string().min(1).max(120),
  kind: z.enum(["service_hire", "mission_investigation", "custom"]).default("service_hire"),
  capabilityId: z.string().min(1).max(120),
  title: z.string().min(1).max(200),
  details: z.string().max(5000).default(""),
  budgetCredits: creditsSchema,
  worldId: worldIdSchema.default("production"),
});

export const contractTermsSchema = z.object({
  requestId: z.string().min(1),
  serviceId: z.string().min(1),
  priceCredits: z.number().int().min(1).max(MAX_CREDITS),
  terms: z.string().min(1).max(5000),
});

// JSON-only artifact content: rejects undefined/functions/symbols/BigInt/circular.
const jsonContent = z.unknown().superRefine((v, ctx) => {
  try {
    const s = JSON.stringify(v);
    if (s === undefined) {
      ctx.addIssue({ code: "custom", message: "content is not JSON-serializable" });
    } else if (s.length > 1024 * 1024) {
      ctx.addIssue({ code: "custom", message: "content exceeds 1 MiB" });
    }
  } catch {
    ctx.addIssue({ code: "custom", message: "content is not JSON-serializable (circular?)" });
  }
});

export const artifactSchema = z.object({
  taskId: z.string().min(1),
  contractId: z.string().min(1),
  content: jsonContent,
  mediaType: z.string().default("application/json"),
});

export const verificationSchema = z
  .object({
    artifactId: z.string().min(1),
    contractId: z.string().min(1),
    verdict: z.enum(["pass", "partial", "fail"]),
    rubricScores: z.record(z.string(), z.number().min(0).max(5)).default({}),
    comment: z.string().max(2000).default(""),
  })
  .superRefine((v, ctx) => {
    const scores = Object.values(v.rubricScores);
    if (v.verdict === "pass" && scores.length > 0 && scores.some((s) => s < 3)) {
      ctx.addIssue({ code: "custom", message: "pass requires all rubric scores >= 3" });
    }
    if (v.verdict === "fail" && scores.length > 0 && scores.every((s) => s > 1)) {
      ctx.addIssue({ code: "custom", message: "fail requires at least one rubric score <= 1" });
    }
  });

// Demo hire request body for POST /api/economy/demo.
export const demoHireSchema = z.object({
  worldId: worldIdSchema.default("sim:fast-001"),
  priceCredits: z.number().int().min(1).max(MAX_CREDITS).default(100),
  verdict: z.enum(["pass", "partial", "fail"]).default("pass"),
});

// QR intent payload (v1, self-contained): scanned at /s?m=<payload>.
// Short keys keep the QR small; encoded length is capped for scan reliability.
export const intentPayloadSchema = z.object({
  v: z.literal(1),
  t: z.string().min(1).max(120), // title
  b: z.string().min(1).max(600), // brief (idea text)
  k: z.enum(["service_hire", "mission_investigation", "custom"]).default("service_hire"),
  p: z.number().int().min(1).max(MAX_CREDITS).default(100), // price
});

export type IntentPayload = z.infer<typeof intentPayloadSchema>;

/** Max base64url chars accepted in ?m= (≈1.3KB → reliable QR scan). */
export const MAX_INTENT_CHARS = 1800;

function b64urlEncode(s: string): string {
  const b64 =
    typeof Buffer !== "undefined"
      ? Buffer.from(s, "utf8").toString("base64")
      : btoa(String.fromCharCode(...new TextEncoder().encode(s)));
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  if (typeof Buffer !== "undefined") return Buffer.from(b64, "base64").toString("utf8");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

export function encodeIntent(payload: IntentPayload): string {
  const parsed = intentPayloadSchema.parse(payload);
  const out = b64urlEncode(JSON.stringify(parsed));
  if (out.length > MAX_INTENT_CHARS) {
    throw new Error(`intent too large for QR (${out.length} > ${MAX_INTENT_CHARS} chars)`);
  }
  return out;
}

export function decodeIntent(raw: string): IntentPayload {
  if (typeof raw !== "string" || raw.length < 1 || raw.length > MAX_INTENT_CHARS) {
    throw new Error("invalid intent payload");
  }
  let json: unknown;
  try {
    json = JSON.parse(b64urlDecode(raw));
  } catch {
    throw new Error("invalid intent payload");
  }
  return intentPayloadSchema.parse(json);
}

export type PrincipalInput = z.infer<typeof principalSchema>;
export type ServiceInput = z.infer<typeof serviceSchema>;
export type RequestInput = z.infer<typeof requestSchema>;
export type DemoHireInput = z.infer<typeof demoHireSchema>;
