import { NextResponse } from "next/server";
import { emptyEconomy, runHireFlow, balanceOf, nowIso } from "@neon/domain";
import { logEvent, correlationId } from "@neon/observability";

export async function POST() {
  const corr = correlationId();
  try {
    const worldId = "sim:fast-001";
    const state = emptyEconomy();
    const base = { worldId, createdAt: nowIso() };
    const requester = { id: "agent_A", kind: "agent" as const, displayName: "Agent A", ...base };
    const provider = { id: "agent_B", kind: "agent" as const, displayName: "Agent B", ...base };
    const verifier = { id: "verifier", kind: "agent" as const, displayName: "Verifier", ...base };
    const { contract, task, artifact, verification } = runHireFlow(state, {
      worldId,
      requester,
      provider,
      verifier,
      capabilityId: "research.summarize",
      serviceTitle: "Summarize sources",
      priceCredits: 100,
      requestTitle: "Summarize 5 sources",
      taskTitle: "Summarize 5 sources",
      artifactContent: { summary: "condensed", sources: 5 },
      verdict: "pass",
    });
    logEvent("economy.demo", { corr, contract: contract.id });
    return NextResponse.json({
      corr,
      contract: { id: contract.id, status: contract.status, price: contract.priceCredits },
      task: { id: task.id, status: task.status },
      artifact: { id: artifact.id, hash: artifact.contentHash },
      verification: { verdict: verification.verdict },
      balances: { A: balanceOf(state.ledger, "agent_A"), B: balanceOf(state.ledger, "agent_B") },
      reputationB: state.reputations.find((r) => r.principalId === "agent_B"),
      events: state.events.length,
    });
  } catch (e) {
    return NextResponse.json({ corr, error: String(e) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, flow: "Principal→Capability→Service→Request→Contract→Task→Artifact→Verification→Ledger→Reputation" });
}
