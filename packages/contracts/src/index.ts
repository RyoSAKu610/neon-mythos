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

export type PrincipalInput = z.infer<typeof principalSchema>;
export type ServiceInput = z.infer<typeof serviceSchema>;
export type RequestInput = z.infer<typeof requestSchema>;
export type DemoHireInput = z.infer<typeof demoHireSchema>;
