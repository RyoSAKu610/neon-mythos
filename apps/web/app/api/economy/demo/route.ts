import { NextResponse } from "next/server";
import { emptyEconomy, runHireFlow, balanceOf, fundRequester } from "@neon/domain";
import { demoHireSchema } from "@neon/contracts";
import { logEvent, correlationId } from "@neon/observability";

export async function POST(req: Request) {
  const corr = correlationId();
  try {
    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const parsed = demoHireSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { corr, error: "invalid_input", ephemeral: true },
        { status: 400 },
      );
    }
    const { worldId, priceCredits, verdict } = parsed.data;
    const clock = () => new Date().toISOString();
    const state = emptyEconomy();
    const base = { worldId, createdAt: clock() };
    const requester = { id: "agent_A", kind: "agent" as const, displayName: "Agent A", ...base };
    const provider = { id: "agent_B", kind: "agent" as const, displayName: "Agent B", ...base };
    const verifier = { id: "verifier", kind: "agent" as const, displayName: "Verifier", ...base };
    fundRequester(state, {
      worldId,
      toPrincipalId: requester.id,
      // Covers the hire price plus a buffer; capped so price≈MAX can't overflow.
      amountCredits: Math.min(priceCredits + 1000, 2147483647),
    });
    const { contract, task, artifact, verification } = runHireFlow(state, {
      worldId,
      requester,
      provider,
      verifier,
      capabilityId: "research.summarize",
      serviceTitle: "Summarize sources",
      priceCredits,
      requestTitle: "Summarize 5 sources",
      taskTitle: "Summarize 5 sources",
      artifactContent: { summary: "condensed", sources: 5 },
      verdict,
      clock,
    });
    logEvent("economy.demo", { corr, contract: contract.id, worldId });
    return NextResponse.json({
      corr,
      ephemeral: true,
      contract: { id: contract.id, status: contract.status, price: contract.priceCredits },
      task: { id: task.id, status: task.status },
      artifact: { id: artifact.id, hash: artifact.contentHash },
      verification: { verdict: verification.verdict },
      balances: {
        A: balanceOf(state.ledger, "agent_A", worldId),
        B: balanceOf(state.ledger, "agent_B", worldId),
      },
      reputationB: state.reputations.find((r) => r.principalId === "agent_B"),
      events: state.events.length,
    });
  } catch (e) {
    logEvent("economy.demo_failed", { corr, message: e instanceof Error ? e.message : "unknown" });
    return NextResponse.json({ corr, error: "demo_failed", ephemeral: true }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    ephemeral: true,
    flow: "Principal→Capability→Service→Request→Contract→Task→Artifact→Verification→Ledger→Reputation",
    note: "Demo runs in-memory per request; Supabase persistence lands with DB wiring (see 004_hardening.sql).",
  });
}
