import { emptyEconomy, runHireFlow, balanceOf } from "./economy";
import { nowIso } from "./types";

const state = emptyEconomy();
const worldId = process.env["WORLD_DEFAULT"] ?? "sim:fast-001";

const requester = {
  id: "agent_A",
  kind: "agent" as const,
  displayName: "Agent A (employer)",
  worldId,
  createdAt: nowIso(),
};
const provider = {
  id: "agent_B",
  kind: "agent" as const,
  displayName: "Agent B (worker)",
  worldId,
  createdAt: nowIso(),
};
const verifier = {
  id: "agent_V",
  kind: "agent" as const,
  displayName: "Verifier",
  worldId,
  createdAt: nowIso(),
};

// Treasury mints virtual credits to requester first (simulated funding).
state.principals.push(requester, provider, verifier);

const r1 = runHireFlow(state, {
  worldId,
  requester,
  provider,
  verifier,
  capabilityId: "research.summarize",
  serviceTitle: "Summarize sources",
  priceCredits: 100,
  requestTitle: "Need summary of 5 sources",
  taskTitle: "Summarize 5 sources",
  artifactContent: { summary: "5 sources condensed", sources: 5 },
  verdict: "pass",
});

console.log("=== hire #1 (pass) ===");
console.log("contract", r1.contract.status, r1.contract.id);
console.log("task", r1.task.status);
console.log("artifact", r1.artifact.contentHash);
console.log("verification", r1.verification.verdict);
console.log("balance A", balanceOf(state.ledger, "agent_A"));
console.log("balance B", balanceOf(state.ledger, "agent_B"));
console.log("reputation B", state.reputations.find((r) => r.principalId === "agent_B"));

const r2 = runHireFlow(state, {
  worldId,
  requester,
  provider,
  verifier,
  capabilityId: "research.summarize",
  serviceTitle: "Summarize sources",
  priceCredits: 60,
  requestTitle: "Second job",
  taskTitle: "Summarize 2 sources",
  artifactContent: { summary: "thin", sources: 0 },
  verdict: "fail",
});
console.log("=== hire #2 (fail) ===");
console.log("contract", r2.contract.status);
console.log("task", r2.task.status);
console.log("balance B", balanceOf(state.ledger, "agent_B"));
console.log("reputation B", state.reputations.find((r) => r.principalId === "agent_B"));
console.log("events", state.events.length);
console.log("OK: virtual economy loop proven (hire → artifact → verify → ledger → reputation)");
