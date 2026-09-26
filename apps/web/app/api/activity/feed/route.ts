import { NextResponse } from "next/server";
import { emptyEconomy, fundRequester, runHireFlow } from "@neon/domain";
import type { DomainEvent, VerificationVerdict } from "@neon/domain";

export const dynamic = "force-dynamic";

function runFlow(worldId: string, verdict: VerificationVerdict, priceCredits: number): DomainEvent[] {
  const clock = () => new Date().toISOString();
  const state = emptyEconomy();
  const base = { worldId, createdAt: clock() };
  const requester = { id: "agent_A", kind: "agent" as const, displayName: "Agent A", ...base };
  const provider = { id: "agent_B", kind: "agent" as const, displayName: "Agent B", ...base };
  const verifier = { id: "verifier", kind: "agent" as const, displayName: "Verifier", ...base };
  // Requester funding must precede hiring (domain invariant).
  fundRequester(state, {
    worldId,
    toPrincipalId: requester.id,
    amountCredits: Math.min(priceCredits + 1000, 2147483647),
  });
  runHireFlow(state, {
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
  return state.events;
}

export async function GET() {
  try {
    // Two in-memory domain flows: one pass (sim), one fail (production).
    const simEvents = runFlow("sim:fast-001", "pass", 100);
    const prodEvents = runFlow("production", "fail", 80);
    const merged = [...simEvents, ...prodEvents];
    const items = merged.map((e, i) => ({
      seq: i + 1,
      worldId: e.worldId,
      type: e.type,
      entityId: e.entityId,
      at: e.createdAt,
    }));
    // Newest-first for feed consumers.
    const events = [...items].reverse();
    const counts = {
      "sim:fast-001": simEvents.length,
      production: prodEvents.length,
      total: merged.length,
    };
    return NextResponse.json({ events, counts });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "feed_failed" },
      { status: 500 },
    );
  }
}
