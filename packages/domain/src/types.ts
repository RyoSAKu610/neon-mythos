// Neon Mythos vertical economy: Principal → Capability → Service → Request →
// Contract → Task → Artifact → Verification → Ledger → Reputation
// World + Event Ledger are cross-cutting partitions.

export type PrincipalKind = "human" | "agent" | "org";
export type WorldId = string; // e.g. "production" | "sim:fast-001"

export interface Principal {
  id: string;
  kind: PrincipalKind;
  displayName: string;
  worldId: WorldId;
  createdAt: string;
}

export interface Capability {
  id: string; // e.g. "research.summarize", "code.review"
  name: string;
  version: string;
  inputSchemaRef: string;
  outputSchemaRef: string;
}

export interface Service {
  id: string;
  providerId: string; // Principal
  capabilityId: string;
  title: string;
  description: string;
  priceCredits: number;
  agentCard?: AgentCard; // A2A-compatible discovery
  active: boolean;
}

// Minimal A2A Agent Card subset for external discovery boundary.
export interface AgentCard {
  name: string;
  url: string;
  capabilities: string[];
}

export type RequestKind = "service_hire" | "mission_investigation" | "custom";
export type RequestStatus = "open" | "matched" | "closed" | "cancelled";

export interface Request {
  id: string;
  requesterId: string;
  kind: RequestKind;
  capabilityId: string;
  title: string;
  details: string;
  budgetCredits: number;
  status: RequestStatus;
  worldId: WorldId;
  createdAt: string;
}

export type ContractStatus =
  | "draft"
  | "offered"
  | "agreed"
  | "active"
  | "fulfilled"
  | "settled"
  | "disputed"
  | "cancelled";

export interface Contract {
  id: string;
  requestId: string;
  serviceId: string;
  requesterId: string;
  providerId: string;
  priceCredits: number;
  terms: string;
  status: ContractStatus;
  worldId: WorldId;
  createdAt: string;
  updatedAt: string;
}

export type TaskStatus =
  | "pending"
  | "running"
  | "awaiting_verification"
  | "succeeded"
  | "failed"
  | "cancelled";

export interface Task {
  id: string;
  contractId: string;
  title: string;
  input: unknown;
  status: TaskStatus;
  assigneeId: string;
  worldId: WorldId;
  createdAt: string;
  updatedAt: string;
}

export interface Artifact {
  id: string;
  taskId: string;
  contractId: string;
  producerId: string;
  content: unknown;
  contentHash: string;
  mediaType: string;
  worldId: WorldId;
  createdAt: string;
}

export type VerificationVerdict = "pass" | "partial" | "fail";

export interface Verification {
  id: string;
  artifactId: string;
  contractId: string;
  verifierId: string;
  verdict: VerificationVerdict;
  rubricScores: Record<string, number>;
  comment: string;
  worldId: WorldId;
  createdAt: string;
}

export interface LedgerEntry {
  id: string;
  worldId: WorldId;
  contractId: string | null;
  fromPrincipalId: string;
  toPrincipalId: string;
  amountCredits: number;
  memo: string;
  settlementRef: string | null; // x402 ref when adapter != virtual
  createdAt: string;
}

export interface Reputation {
  principalId: string;
  worldId: WorldId;
  score: number; // 0..100
  jobsCompleted: number;
  jobsFailed: number;
  lastUpdated: string;
}

export interface DomainEvent {
  seq: number;
  id: string;
  worldId: WorldId;
  type: string;
  entityId: string;
  payload: unknown;
  actorId: string;
  createdAt: string;
}

/** Fixed UUID identifying the mint. Must exist as a principals row in SQL seeds. */
export const TREASURY_ID = "00000000-0000-0000-0000-000000000000";

/** Max credits per transfer. Matches Postgres `integer` upper bound. */
export const MAX_CREDITS = 2147483647;

/** Cap for hashed artifact payloads (1 MiB of canonical JSON). */
export const MAX_ARTIFACT_BYTES = 1024 * 1024;

export type Clock = () => string;

export function nowIso(): string {
  return new Date().toISOString();
}

export class EconomyError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(`[${code}] ${message}`);
    this.name = "EconomyError";
    this.code = code;
  }
}

/** Collision-resistant id. Uses crypto.randomUUID when available. */
export function uid(prefix: string): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) {
    return `${prefix}_${g.crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
  }
  // Fallback: 128-bit-ish entropy from Math.random + time + counter.
  uidCounter += 1;
  const r = () =>
    Math.floor(Math.random() * 0xffffffff)
      .toString(36)
      .padStart(7, "0");
  return `${prefix}_${r()}${r()}${Date.now().toString(36)}${uidCounter.toString(36)}`.slice(0, 24);
}
let uidCounter = 0;
