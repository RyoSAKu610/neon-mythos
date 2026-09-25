import { emptyEconomy, runHireFlow, balanceOf, fundRequester, resolveDispute } from "./economy";
import { nowIso } from "./types";

export function main(): void {
  const state = emptyEconomy();
  const worldId = process.env["WORLD_DEFAULT"] ?? "sim:fast-001";
  const clock = nowIso;

  const requester = {
    id: "agent_A",
    kind: "agent" as const,
    displayName: "Agent A (employer)",
    worldId,
    createdAt: clock(),
  };
  const provider = {
    id: "agent_B",
    kind: "agent" as const,
    displayName: "Agent B (worker)",
    worldId,
    createdAt: clock(),
  };
  const verifier = {
    id: "agent_V",
    kind: "agent" as const,
    displayName: "Verifier",
    worldId,
    createdAt: clock(),
  };

  // Treasury funds the employer first: balances must never go negative.
  fundRequester(state, { worldId, toPrincipalId: requester.id, amountCredits: 1000 });

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

  console.log("=== hire #1 (pass, full price) ===");
  console.log("contract", r1.contract.status, r1.contract.id);
  console.log("task", r1.task.status);
  console.log("artifact", r1.artifact.contentHash);
  console.log("verification", r1.verification.verdict);
  console.log("balance A", balanceOf(state.ledger, "agent_A", worldId));
  console.log("balance B", balanceOf(state.ledger, "agent_B", worldId));
  console.log("reputation B", state.reputations.find((r) => r.principalId === "agent_B" && r.worldId === worldId));

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
  console.log("=== hire #2 (fail -> disputed, no payment) ===");
  console.log("contract", r2.contract.status);
  console.log("task", r2.task.status);
  console.log("balance B", balanceOf(state.ledger, "agent_B", worldId));

  const resolved = resolveDispute(state, {
    contractId: r2.contract.id,
    worldId,
    actorId: verifier.id,
    resolution: "cancelled",
  });
  console.log("=== dispute resolved ===");
  console.log("contract", resolved.status);
  console.log("reputation B", state.reputations.find((r) => r.principalId === "agent_B" && r.worldId === worldId));
  console.log("events", state.events.length);
  console.log("OK: virtual economy loop proven (fund → hire → artifact → verify → ledger → reputation → dispute)");
}

try {
  main();
} catch (e) {
  console.error("demo failed:", e);
  process.exit(1);
}
