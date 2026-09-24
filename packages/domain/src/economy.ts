import {
  Artifact,
  Contract,
  ContractStatus,
  DomainEvent,
  LedgerEntry,
  Principal,
  Reputation,
  Request,
  Service,
  Task,
  Verification,
  WorldId,
  nowIso,
  uid,
} from "./types";

// Contract state machine: allowed transitions.
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

export function transitionContract(c: Contract, next: ContractStatus): Contract {
  const allowed = CONTRACT_TRANSITIONS[c.status] ?? [];
  if (!allowed.includes(next)) {
    throw new Error(`invalid contract transition ${c.status} -> ${next}`);
  }
  return { ...c, status: next, updatedAt: nowIso() };
}

export function hashContent(content: unknown): string {
  const s = typeof content === "string" ? content : JSON.stringify(content);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `fnv1a:${h.toString(16).padStart(8, "0")}:${s.length}`;
}

// Reputation update rule: pass=+3 (cap 100), partial=+1, fail=-5 (floor 0).
// jobsCompleted increments on pass/partial, jobsFailed on fail.
export function applyVerificationToReputation(
  rep: Reputation,
  v: Verification,
): Reputation {
  let score = rep.score;
  let completed = rep.jobsCompleted;
  let failed = rep.jobsFailed;
  if (v.verdict === "pass") {
    score = Math.min(100, score + 3);
    completed += 1;
  } else if (v.verdict === "partial") {
    score = Math.min(100, score + 1);
    completed += 1;
  } else {
    score = Math.max(0, score - 5);
    failed += 1;
  }
  return { ...rep, score, jobsCompleted: completed, jobsFailed: failed, lastUpdated: nowIso() };
}

export function defaultReputation(principalId: string, worldId: WorldId): Reputation {
  return {
    principalId,
    worldId,
    score: 50,
    jobsCompleted: 0,
    jobsFailed: 0,
    lastUpdated: nowIso(),
  };
}

// Ledger invariant helper: sum by principal.
export function balanceOf(entries: LedgerEntry[], principalId: string): number {
  let b = 0;
  for (const e of entries) {
    if (e.toPrincipalId === principalId) b += e.amountCredits;
    if (e.fromPrincipalId === principalId) b -= e.amountCredits;
  }
  return b;
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
  };
}

let eventSeq = 0;
function emit(
  state: EconomyState,
  worldId: WorldId,
  type: string,
  entityId: string,
  payload: unknown,
  actorId: string,
): void {
  eventSeq += 1;
  state.events.push({
    seq: eventSeq,
    id: uid("evt"),
    worldId,
    type,
    entityId,
    payload,
    actorId,
    createdAt: nowIso(),
  });
}

// Vertical hiring flow. Throws on invariant violation; appends events.
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
    requestTitle: string;
    taskTitle: string;
    artifactContent: unknown;
    verdict: "pass" | "partial" | "fail";
  },
): { contract: Contract; task: Task; artifact: Artifact; verification: Verification } {
  const w = args.worldId;
  for (const p of [args.requester, args.provider, args.verifier]) {
    if (!state.principals.find((x) => x.id === p.id)) {
      state.principals.push(p);
      emit(state, w, "principal.registered", p.id, { kind: p.kind }, p.id);
    }
    if (!state.reputations.find((r) => r.principalId === p.id && r.worldId === w)) {
      state.reputations.push(defaultReputation(p.id, w));
    }
  }

  const service: Service = {
    id: uid("svc"),
    providerId: args.provider.id,
    capabilityId: args.capabilityId,
    title: args.serviceTitle,
    description: `Service for ${args.capabilityId}`,
    priceCredits: args.priceCredits,
    active: true,
  };
  state.services.push(service);
  emit(state, w, "service.published", service.id, service, args.provider.id);

  const request: Request = {
    id: uid("req"),
    requesterId: args.requester.id,
    kind: "service_hire",
    capabilityId: args.capabilityId,
    title: args.requestTitle,
    details: args.requestTitle,
    budgetCredits: args.priceCredits,
    status: "open",
    worldId: w,
    createdAt: nowIso(),
  };
  state.requests.push(request);
  emit(state, w, "request.created", request.id, request, args.requester.id);

  let contract: Contract = {
    id: uid("ctr"),
    requestId: request.id,
    serviceId: service.id,
    requesterId: args.requester.id,
    providerId: args.provider.id,
    priceCredits: args.priceCredits,
    terms: `Deliver ${args.taskTitle} for ${args.priceCredits} credits`,
    status: "draft",
    worldId: w,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  state.contracts.push(contract);
  emit(state, w, "contract.drafted", contract.id, contract, args.requester.id);

  const advance = (next: Contract["status"], actor: string) => {
    contract = transitionContract(contract, next);
    const idx = state.contracts.findIndex((c) => c.id === contract.id);
    state.contracts[idx] = contract;
    emit(state, w, `contract.${next}`, contract.id, { status: next }, actor);
  };
  advance("offered", args.provider.id);
  advance("agreed", args.requester.id);
  advance("active", args.requester.id);
  request.status = "matched";

  let task: Task = {
    id: uid("tsk"),
    contractId: contract.id,
    title: args.taskTitle,
    input: { requestId: request.id },
    status: "pending",
    assigneeId: args.provider.id,
    worldId: w,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
  state.tasks.push(task);
  emit(state, w, "task.created", task.id, task, args.requester.id);
  task = { ...task, status: "running", updatedAt: nowIso() };
  state.tasks[state.tasks.findIndex((t) => t.id === task.id)] = task;
  emit(state, w, "task.running", task.id, {}, args.provider.id);

  const artifact: Artifact = {
    id: uid("art"),
    taskId: task.id,
    contractId: contract.id,
    producerId: args.provider.id,
    content: args.artifactContent,
    contentHash: hashContent(args.artifactContent),
    mediaType: "application/json",
    worldId: w,
    createdAt: nowIso(),
  };
  state.artifacts.push(artifact);
  task = { ...task, status: "awaiting_verification", updatedAt: nowIso() };
  state.tasks[state.tasks.findIndex((t) => t.id === task.id)] = task;
  emit(state, w, "artifact.submitted", artifact.id, { hash: artifact.contentHash }, args.provider.id);

  const verification: Verification = {
    id: uid("ver"),
    artifactId: artifact.id,
    contractId: contract.id,
    verifierId: args.verifier.id,
    verdict: args.verdict,
    rubricScores: { correctness: args.verdict === "pass" ? 5 : args.verdict === "partial" ? 3 : 1 },
    comment: `verdict=${args.verdict}`,
    worldId: w,
    createdAt: nowIso(),
  };
  state.verifications.push(verification);
  emit(state, w, "verification.recorded", verification.id, verification, args.verifier.id);

  // Task outcome follows verification.
  const taskOk = args.verdict !== "fail";
  task = {
    ...task,
    status: taskOk ? "succeeded" : "failed",
    updatedAt: nowIso(),
  };
  state.tasks[state.tasks.findIndex((t) => t.id === task.id)] = task;
  emit(state, w, taskOk ? "task.succeeded" : "task.failed", task.id, {}, args.verifier.id);

  // Contract fulfillment + settlement (virtual ledger: requester -> provider on pass/partial).
  if (taskOk) {
    advance("fulfilled", args.provider.id);
    const entry: LedgerEntry = {
      id: uid("led"),
      worldId: w,
      contractId: contract.id,
      fromPrincipalId: args.requester.id,
      toPrincipalId: args.provider.id,
      amountCredits: args.priceCredits,
      memo: `settlement contract=${contract.id} verdict=${args.verdict}`,
      settlementRef: null,
      createdAt: nowIso(),
    };
    state.ledger.push(entry);
    emit(state, w, "ledger.credited", entry.id, entry, "ledger");
    advance("settled", "ledger");
  } else {
    advance("disputed", args.verifier.id);
  }

  // Reputation always updates from verification (provider affected).
  const rIdx = state.reputations.findIndex(
    (r) => r.principalId === args.provider.id && r.worldId === w,
  );
  state.reputations[rIdx] = applyVerificationToReputation(state.reputations[rIdx], verification);
  emit(state, w, "reputation.updated", args.provider.id, state.reputations[rIdx], "reputation");

  return { contract, task, artifact, verification };
}
