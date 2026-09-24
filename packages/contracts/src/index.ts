import { z } from "zod";

export const principalSchema = z.object({
  kind: z.enum(["human", "agent", "org"]),
  displayName: z.string().min(1).max(120),
  worldId: z.string().min(1).default("production"),
});

export const serviceSchema = z.object({
  providerId: z.string().min(1),
  capabilityId: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).default(""),
  priceCredits: z.number().int().min(0),
});

export const requestSchema = z.object({
  requesterId: z.string().min(1),
  kind: z.enum(["service_hire", "mission_investigation", "custom"]).default("service_hire"),
  capabilityId: z.string().min(1),
  title: z.string().min(1).max(200),
  details: z.string().max(5000).default(""),
  budgetCredits: z.number().int().min(0),
  worldId: z.string().min(1).default("production"),
});

export const contractTermsSchema = z.object({
  requestId: z.string().min(1),
  serviceId: z.string().min(1),
  priceCredits: z.number().int().min(0),
  terms: z.string().min(1).max(5000),
});

export const artifactSchema = z.object({
  taskId: z.string().min(1),
  contractId: z.string().min(1),
  content: z.unknown(),
  mediaType: z.string().default("application/json"),
});

export const verificationSchema = z.object({
  artifactId: z.string().min(1),
  contractId: z.string().min(1),
  verdict: z.enum(["pass", "partial", "fail"]),
  rubricScores: z.record(z.string(), z.number().min(0).max(5)).default({}),
  comment: z.string().max(2000).default(""),
});

export type PrincipalInput = z.infer<typeof principalSchema>;
export type ServiceInput = z.infer<typeof serviceSchema>;
export type RequestInput = z.infer<typeof requestSchema>;
