import { createHash } from "node:crypto";
import {
  Artifact,
  Clock,
  Contract,
  ContractStatus,
  DomainEvent,
  EconomyError,
  LedgerEntry,
  MAX_ARTIFACT_BYTES,
  MAX_CREDITS,
  Principal,
  Reputation,
  Request,
  Service,
  Task,
  TREASURY_ID,
  Verification,
  VerificationVerdict,
  WorldId,
  nowIso,
  uid,
} from "./types";

// Contract state machine: allowed transitions.
// NOTE: disputed->settled MUST append a ledger entry first; use resolveDispute()
// rather than transitionContract for that edge so money and state stay in sync.
const CONTRACT_TRANSITIONS: Record<ContractStatus, ContractStatus[]> = {
  draft: ["offered", "cancelled"],
  offered: ["agreed", "cancelled"],
  agreed: ["active", "cancelled"],
  active: ["fulfilled", "disputed", "cancelled"],
  fulfilled: ["settled", "disputed"],
  settled: [],
  disputed: ["settled", "cancelled"],
  cancelled: [],
};

export function transitionContract(
  c: Contract,
  next: ContractStatus,
  clock: Clock = nowIso,
): Contract {
  const allowed = CONTRACT_TRANSITIONS[c.status] ?? [];
  if (!allowed.includes(next)) {
    throw new EconomyError(
      "invalid-transition",
      `contract ${c.id}: invalid transition ${c.status} -> ${next}`,
    );
  }
  return { ...c, status: next, updatedAt: clock() };
}

// Canonical JSON: sorted keys, deterministic numbers, circular guard,
// explicit rejection of non-serializable values BEFORE any state mutation.
export function stableStringify(value: unknown): string {
  const seen = new Set<object>();
  const render = (v: unknown): string => {
    if (v === null) return "null";
    const t = typeof v;
    if (t === "string") return JSON.stringify(v) as string;
    if (t === "number") {
      if (!Number.isFinite(v)) {
        throw new EconomyError("unserializable", "artifact content contains non-finite number");
      }
      return JSON.stringify(v) as string;
    }
    if (t === "boolean") return v ? "true" : "false";
    if (t === "bigint" || t === "function" || t === "symbol" || t === "undefined") {
      throw new EconomyError(
        "unserializable",
        `artifact content contains non-serializable ${t}`,
      );
    }
    if (Array.isArray(v)) {
      return `[${v.map((x) => render(x)).join(",")}]`;
    }
    if (t === "object") {
      const o = v as Record<string, unknown>;
      if (seen.has(o)) {
        throw new EconomyError("unserializable", "artifact content is circular");
      }
      seen.add(o);
      const keys = Object.keys(o).sort();
      const body = keys
        .map((k) => {
          const val = (o as Record<string, unknown>)[k];
          if (typeof val === "undefined" || typeof val === "function" || typeof val === "symbol") {
            throw new EconomyError(
              "unserializable",
              `artifact field ${k} is non-serializable`,
            );
          }
          return `${JSON.stringify(k)}:${render(val)}`;
        })
        .join(",");
      seen.delete(o);
      return `{${body}}`;
    }
    throw new EconomyError("unserializable", `artifact content has type ${t}`);
  };
  const out = render(value);
  if (out.length > MAX_ARTIFACT_BYTES) {
    throw new EconomyError(
      "artifact-too-large",
      `artifact canonical size ${out.length} exceeds ${MAX_ARTIFACT_BYTES} bytes`,
    );
  }
  return out;
}

/** SHA-256 over canonical bytes. Format: sha256:<hex>. */
export function hashContent(content: unknown): string {
  const canonical = typeof content === "string" ? content : stableStringify(content);
  if (canonical.length > MAX_ARTIFACT_BYTES) {
    throw new EconomyError(
      "artifact-too-large",
      `artifact size ${canonical.length} exceeds ${MAX_ARTIFACT_BYTES} bytes`,
    );
  }
  return `sha256:${createHash("sha256").update(canonical, "utf8").digest("hex")}`;
}

export function inferMediaType(content: unknown): string {
  return typeof content === "string" ? "text/plain" : "application/json";
}

// Reputation update rule: pass=+3 (cap 100), partial=+1, fail=-5 (floor 0).
// jobsCompleted increments on pass/partial, jobsFailed on fail.
export function applyVerificationToReputation(
  rep: Reputation,
  v: Verification,
  clock: Clock = nowIso,
): Reputation {
  const base = clampScore(rep.score);
  switch (v.verdict) {
    case "pass":
      return {
        ...rep,
        score: Math.min(100, base + 3),
        jobsCompleted: rep.jobsCompleted + 1,
        lastUpdated: clock(),
      };
    case "partial":
      return {
        ...rep,
        score: Math.min(100, base + 1),
        jobsCompleted: rep.jobsCompleted + 1,
        lastUpdated: clock(),
      };
    case "fail":
      return {
        ...rep,
        score: Math.max(0, base - 5),
        jobsFailed: rep.jobsFailed + 1,
        lastUpdated: clock(),
      };
    default:
      throw new EconomyError(
        "invalid-verdict",
        `unknown verdict ${(v as { verdict: unknown }).verdict}`,
      );
  }
}

function clampScore(s: number): number {
  if (!Number.isFinite(s)) return 50;
  return Math.min(100, Math.max(0, Math.round(s)));
}

export function defaultReputation(
  principalId: string,
  worldId: WorldId,
  clock: Clock = nowIso,
): Reputation {
  return {
    principalId,
    worldId,
    score: 50,
    jobsCompleted: 0,
    jobsFailed: 0,
    lastUpdated: clock(),
  };
}

/** World-scoped balance. Always pass worldId: cross-world sums are a bug. */
export function balanceOf(
  entries: LedgerEntry[],
  principalId: string,
  worldId: WorldId,
): number {
  let b = 0;
  for (const e of entries) {
    if (e.worldId !== worldId) continue;
    if (e.toPrincipalId === principalId) b += e.amountCredits;
    if (e.fromPrincipalId === principalId) b -= e.amountCredits;
  }
  return b;
}

/** Mint virtual credits from treasury. Requester funding must precede hiring. */
export function fundRequester(
  state: EconomyState,
  args: { worldId: WorldId; toPrincipalId: string; amountCredits: number; memo?: string },
  clock: Clock = nowIso,
): LedgerEntry {
  assertWorldId(args.worldId);
  assertCredits(args.amountCredits);
  ensurePrincipal(state, {
    id: TREASURY_ID,
    kind: "org",
    displayName: "Treasury",
    worldId: args.worldId,
    createdAt: clock(),
  });
  const entry: LedgerEntry = {
    id: uniqueId(state, "led"),
    worldId: args.worldId,
    contractId: null,
    fromPrincipalId: TREASURY_ID,
    toPrincipalId: args.toPrincipalId,
    amountCredits: args.amountCredits,
    memo: args.memo ?? "treasury funding",
    settlementRef: null,
    createdAt: clock(),
  };
  state.ledger.push(entry);
  emit(state, args.worldId, "ledger.funded", entry.id, entry, TREASURY_ID, clock);
  return entry;
}

export interface EconomyState {
  principals: Principal[];
  services: Service[];
  requests: Request[];
  contracts: Contract[];
  tasks: Task[];
  artifacts: Artifact[];
  verifications: Verification[];
  ledger: LedgerEntry[];
  reputations: Reputation[];
  events: DomainEvent[];
  /** per-state event counters (no module globals; serverless-safe). */
  nextSeq: number;
  nextSeqByWorld: Record<string, number>;
}

export function emptyEconomy(): EconomyState {
  return {
    principals: [],
    services: [],
    requests: [],
    contracts: [],
    tasks: [],
    artifacts: [],
    verifications: [],
    ledger: [],
    reputations: [],
    events: [],
    nextSeq: 1,
    nextSeqByWorld: {},
  };
}

function emit(
  state: EconomyState,
  worldId: WorldId,
  type: string,
  entityId: string,
  payload: unknown,
  actorId: string,
  clock: Clock = nowIso,
): void {
  const worldSeq = (state.nextSeqByWorld[worldId] ?? 0) + 1;
  state.nextSeqByWorld[worldId] = worldSeq;
  state.events.push({
    seq: state.nextSeq++,
    id: uniqueId(state, "evt"),
    worldId,
    type,
    entityId,
    payload: { ...asRecord(payload), _worldSeq: worldSeq },
    actorId,
    createdAt: clock(),
  });
}

function asRecord(v: unknown): Record<string, unknown> {
  if (v !== null && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return { value: v };
}

/** Generate an id not already present in this state (guards collisions). */
function uniqueId(state: EconomyState, prefix: string): string {
  for (let i = 0; i < 10; i++) {
    const id = uid(prefix);
    if (!idExists(state, id)) return id;
  }
  throw new EconomyError("id-collision", `could not mint unique ${prefix} id`);
}

function idExists(state: EconomyState, id: string): boolean {
  return (
    state.services.some((x) => x.id === id) ||
    state.requests.some((x) => x.id === id) ||
    state.contracts.some((x) => x.id === id) ||
    state.tasks.some((x) => x.id === id) ||
    state.artifacts.some((x) => x.id === id) ||
    state.verifications.some((x) => x.id === id) ||
    state.ledger.some((x) => x.id === id) ||
    state.events.some((x) => x.id === id)
  );
}

function assertWorldId(w: string): void {
  if (typeof w !== "string" || w.length < 1 || w.length > 64 || !/^[A-Za-z0-9:_-]+$/.test(w)) {
    throw new EconomyError("invalid-world", `invalid worldId ${JSON.stringify(w)}`);
  }
}

function assertCredits(n: number): void {
  if (!Number.isSafeInteger(n) || n < 1 || n > MAX_CREDITS) {
    throw new EconomyError("invalid-amount", `amountCredits must be int 1..${MAX_CREDITS}`);
  }
}

function assertNonEmpty(name: string, v: string, max = 500): void {
  if (typeof v !== "string" || v.trim().length === 0 || v.length > max) {
    throw new EconomyError("invalid-input", `${name} must be 1..${max} chars`);
  }
}

function ensurePrincipal(state: EconomyState, p: Principal): boolean {
  const exists = state.principals.some((x) => x.id === p.id && x.worldId === p.worldId);
  if (!exists) state.principals.push(p);
  return !exists;
}

export interface SettlementIntent {
  worldId: WorldId;
  contractId: string | null;
  fromPrincipalId: string;
  toPrincipalId: string;
  amountCredits: number;
  memo: string;
}

export type SettleFn = (intent: SettlementIntent) => { settlementRef: string | null };

const virtualSettle: SettleFn = () => ({ settlementRef: null });

// Payable fraction: pass=100%, partial=50% (floor, min 1), fail=0%.
export function payableFor(priceCredits: number, verdict: VerificationVerdict): number {
  switch (verdict) {
    case "pass":
      return priceCredits;
    case "partial":
      return Math.max(1, Math.floor(priceCredits / 2));
    case "fail":
      return 0;
    default:
      throw new EconomyError("invalid-verdict", `unknown verdict ${verdict}`);
  }
}

// Vertical hiring flow. Validates everything BEFORE mutating (atomic commit).
export function runHireFlow(
  state: EconomyState,
  args: {
    worldId: WorldId;
    requester: Principal;
    provider: Principal;
    verifier: Principal;
    capabilityId: string;
    serviceTitle: string;
    priceCredits: number;
    budgetCredits?: number;
    requestTitle: string;
    taskTitle: string;
    artifactContent: unknown;
    verdict: VerificationVerdict;
    rubricScores?: Record<string, number>;
    comment?: string;
    mediaType?: string;
    settle?: SettleFn;
    clock?: Clock;
  },
): { contract: Contract; task: Task; artifact: Artifact; verification: Verification } {
  const clock = args.clock ?? nowIso;
  const settle = args.settle ?? virtualSettle;
  const w = args.worldId;

  // ---- Phase 0: all throwing validation BEFORE any mutation ----
  assertWorldId(w);
  assertCredits(args.priceCredits);
  assertNonEmpty("capabilityId", args.capabilityId, 120);
  assertNonEmpty("serviceTitle", args.serviceTitle, 200);
  assertNonEmpty("requestTitle", args.requestTitle, 200);
  assertNonEmpty("taskTitle", args.taskTitle, 200);
  for (const [n, p] of [
    ["requester", args.requester],
    ["provider", args.provider],
    ["verifier", args.verifier],
  ] as const) {
    assertNonEmpty(`${n}.id`, p.id, 120);
    assertNonEmpty(`${n}.displayName`, p.displayName, 120);
    if (p.worldId !== w) {
      throw new EconomyError("world-mismatch", `${n} world ${p.worldId} != flow world ${w}`);
    }
  }
  const roles = new Set([args.requester.id, args.provider.id, args.verifier.id]);
  if (roles.size !== 3) {
    throw new EconomyError("self-dealing", "requester, provider, verifier must be distinct");
  }
  const budget = args.budgetCredits ?? args.priceCredits;
  assertCredits(budget);
  if (budget < args.priceCredits) {
    throw new EconomyError("insufficient-budget", `budget ${budget} < price ${args.priceCredits}`);
  }
  if (!["pass", "partial", "fail"].includes(args.verdict)) {
    throw new EconomyError("invalid-verdict", `unknown verdict ${args.verdict}`);
  }
  const rubric = args.rubricScores ?? defaultRubric(args.verdict);
  for (const [k, v] of Object.entries(rubric)) {
    if (typeof v !== "number" || v < 0 || v > 5) {
      throw new EconomyError("invalid-rubric", `rubric ${k} must be 0..5`);
    }
  }
  // Hashing can throw (circular / non-serializable / too large) — do it now.
  const contentHash = hashContent(args.artifactContent);
  const requesterBalance = balanceOf(state.ledger, args.requester.id, w);
  if (requesterBalance < args.priceCredits) {
    throw new EconomyError(
      "insufficient-funds",
      `requester ${args.requester.id} balance ${requesterBalance} < price ${args.priceCredits}; fund via fundRequester first`,
    );
  }
  const payable = payableFor(args.priceCredits, args.verdict);

  // ---- Phase 1: commit (no throwing operations except id mint) ----
  for (const p of [args.requester, args.provider, args.verifier]) {
    if (ensurePrincipal(state, p)) {
      emit(state, w, "principal.registered", principalKey(p), { kind: p.kind }, p.id, clock);
    }
    if (!state.reputations.some((r) => r.principalId === p.id && r.worldId === w)) {
      state.reputations.push(defaultReputation(p.id, w, clock));
    }
  }

  const service: Service = {
    id: uniqueId(state, "svc"),
    providerId: args.provider.id,
    capabilityId: args.capabilityId,
    title: args.serviceTitle,
    description: `Service for ${args.capabilityId}`,
    priceCredits: args.priceCredits,
    active: true,
  };
  state.services.push(service);
  emit(state, w, "service.published", service.id, service, args.provider.id, clock);

  const request: Request = {
    id: uniqueId(state, "req"),
    requesterId: args.requester.id,
    kind: "service_hire",
    capabilityId: args.capabilityId,
    title: args.requestTitle,
    details: args.requestTitle,
    budgetCredits: budget,
    status: "open",
    worldId: w,
    createdAt: clock(),
  };
  state.requests.push(request);
  emit(state, w, "request.created", request.id, request, args.requester.id, clock);

  let contract: Contract = {
    id: uniqueId(state, "ctr"),
    requestId: request.id,
    serviceId: service.id,
    requesterId: args.requester.id,
    providerId: args.provider.id,
    priceCredits: args.priceCredits,
    terms: `Deliver ${args.taskTitle} for ${args.priceCredits} credits` +
      (args.verdict === "partial" ? " (partial pays 50%)" : ""),
    status: "draft",
    worldId: w,
    createdAt: clock(),
    updatedAt: clock(),
  };
  state.contracts.push(contract);
  emit(state, w, "contract.drafted", contract.id, contract, args.requester.id, clock);

  const advance = (next: ContractStatus, actor: string) => {
    contract = transitionContract(contract, next, clock);
    const idx = state.contracts.findIndex((c) => c.id === contract.id);
    if (idx < 0) throw new EconomyError("internal", `contract ${contract.id} vanished`);
    state.contracts[idx] = contract;
    emit(state, w, `contract.${next}`, contract.id, { status: next }, actor, clock);
  };
  advance("offered", args.provider.id);
  advance("agreed", args.requester.id);
  advance("active", args.requester.id);
  request.status = "matched";

  let task: Task = {
    id: uniqueId(state, "tsk"),
    contractId: contract.id,
    title: args.taskTitle,
    input: { requestId: request.id },
    status: "pending",
    assigneeId: args.provider.id,
    worldId: w,
    createdAt: clock(),
    updatedAt: clock(),
  };
  state.tasks.push(task);
  emit(state, w, "task.created", task.id, task, args.requester.id, clock);
  task = { ...task, status: "running", updatedAt: clock() };
  updateTask(state, task);
  emit(state, w, "task.running", task.id, {}, args.provider.id, clock);

  const artifact: Artifact = {
    id: uniqueId(state, "art"),
    taskId: task.id,
    contractId: contract.id,
    producerId: args.provider.id,
    content: args.artifactContent,
    contentHash,
    mediaType: args.mediaType ?? inferMediaType(args.artifactContent),
    worldId: w,
    createdAt: clock(),
  };
  state.artifacts.push(artifact);
  task = { ...task, status: "awaiting_verification", updatedAt: clock() };
  updateTask(state, task);
  emit(state, w, "artifact.submitted", artifact.id, { hash: contentHash }, args.provider.id, clock);

  const verification: Verification = {
    id: uniqueId(state, "ver"),
    artifactId: artifact.id,
    contractId: contract.id,
    verifierId: args.verifier.id,
    verdict: args.verdict,
    rubricScores: rubric,
    comment: args.comment ?? `verdict=${args.verdict}`,
    worldId: w,
    createdAt: clock(),
  };
  state.verifications.push(verification);
  emit(state, w, "verification.recorded", verification.id, verification, args.verifier.id, clock);

  const taskOk = args.verdict !== "fail";
  task = { ...task, status: taskOk ? "succeeded" : "failed", updatedAt: clock() };
  updateTask(state, task);
  emit(state, w, taskOk ? "task.succeeded" : "task.failed", task.id, {}, args.verifier.id, clock);

  if (taskOk) {
    advance("fulfilled", args.provider.id);
    const ref = payable > 0
      ? settle({
        worldId: w,
        contractId: contract.id,
        fromPrincipalId: args.requester.id,
        toPrincipalId: args.provider.id,
        amountCredits: payable,
        memo: `settlement contract=${contract.id} verdict=${args.verdict}`,
      }).settlementRef
      : null;
    const entry: LedgerEntry = {
      id: uniqueId(state, "led"),
      worldId: w,
      contractId: contract.id,
      fromPrincipalId: args.requester.id,
      toPrincipalId: args.provider.id,
      amountCredits: payable,
      memo: `settlement contract=${contract.id} verdict=${args.verdict}`,
      settlementRef: ref,
      createdAt: clock(),
    };
    state.ledger.push(entry);
    emit(state, w, "ledger.credited", entry.id, entry, "ledger", clock);
    advance("settled", "ledger");
  } else {
    advance("disputed", args.verifier.id);
  }

  const rIdx = state.reputations.findIndex(
    (r) => r.principalId === args.provider.id && r.worldId === w,
  );
  if (rIdx < 0) throw new EconomyError("internal", "provider reputation vanished");
  state.reputations[rIdx] = applyVerificationToReputation(
    state.reputations[rIdx],
    verification,
    clock,
  );
  emit(state, w, "reputation.updated", args.provider.id, state.reputations[rIdx], "reputation", clock);

  return { contract, task, artifact, verification };
}

function updateTask(state: EconomyState, task: Task): void {
  const idx = state.tasks.findIndex((t) => t.id === task.id);
  if (idx < 0) throw new EconomyError("internal", `task ${task.id} vanished`);
  state.tasks[idx] = task;
}

function defaultRubric(v: VerificationVerdict): Record<string, number> {
  return { correctness: v === "pass" ? 5 : v === "partial" ? 3 : 1 };
}

function principalKey(p: Principal): string {
  return `${p.worldId}:${p.id}`;
}

/** Resolve a disputed contract. Reputation was already applied at verification;
 *  resolution moves money (paid) or closes without payment (cancelled). */
export function resolveDispute(
  state: EconomyState,
  args: {
    contractId: string;
    worldId: WorldId;
    actorId: string;
    resolution: "pay-full" | "pay-partial" | "cancelled";
    settle?: SettleFn;
    clock?: Clock;
  },
): Contract {
  const clock = args.clock ?? nowIso;
  assertWorldId(args.worldId);
  const idx = state.contracts.findIndex(
    (c) => c.id === args.contractId && c.worldId === args.worldId,
  );
  if (idx < 0) throw new EconomyError("not-found", `contract ${args.contractId} not found`);
  const c = state.contracts[idx];
  if (c.status !== "disputed") {
    throw new EconomyError("invalid-state", `contract ${c.id} is ${c.status}, not disputed`);
  }
  if (args.resolution === "cancelled") {
    const next = transitionContract(c, "cancelled", clock);
    state.contracts[idx] = next;
    emit(state, args.worldId, "contract.cancelled", c.id, { from: "disputed" }, args.actorId, clock);
    return next;
  }
  // pay-full / pay-partial: record ledger then settle.
  // (disputed->settled is a legal direct edge in CONTRACT_TRANSITIONS.)
  const amount = args.resolution === "pay-full"
    ? c.priceCredits
    : Math.max(1, Math.floor(c.priceCredits / 2));
  assertCredits(amount);
  if (balanceOf(state.ledger, c.requesterId, args.worldId) < amount) {
    throw new EconomyError(
      "insufficient-funds",
      `requester ${c.requesterId} cannot cover dispute payment ${amount}`,
    );
  }
  const settle = args.settle ?? virtualSettle;
  const ref = settle({
    worldId: args.worldId,
    contractId: c.id,
    fromPrincipalId: c.requesterId,
    toPrincipalId: c.providerId,
    amountCredits: amount,
    memo: `dispute resolution ${args.resolution} contract=${c.id}`,
  }).settlementRef;
  state.ledger.push({
    id: uniqueId(state, "led"),
    worldId: args.worldId,
    contractId: c.id,
    fromPrincipalId: c.requesterId,
    toPrincipalId: c.providerId,
    amountCredits: amount,
    memo: `dispute resolution ${args.resolution} contract=${c.id}`,
    settlementRef: ref,
    createdAt: clock(),
  });
  emit(state, args.worldId, "ledger.credited", c.id, { amount, resolution: args.resolution }, "ledger", clock);
  const settled = transitionContract(c, "settled", clock);
  state.contracts[state.contracts.findIndex((x) => x.id === c.id)] = settled;
  emit(state, args.worldId, "contract.settled", c.id, { from: "disputed", amount }, args.actorId, clock);
  return settled;
}
