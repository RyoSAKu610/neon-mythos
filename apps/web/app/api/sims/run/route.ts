import { NextResponse } from "next/server";
import { z } from "zod";
import {
  emptyEconomy,
  runHireFlow,
  fundRequester,
  payableFor,
} from "@neon/domain";
import { logEvent, correlationId } from "@neon/observability";

const simRunSchema = z.object({
  runs: z.number().int().min(1).max(5).default(3),
  priceCredits: z.number().int().min(1).max(10000).default(100),
  worldId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9:_-]+$/, "worldId must match [A-Za-z0-9:_-]")
    .default("sim:fast-001"),
});

const VERDICTS = ["pass", "partial", "fail"] as const;

// POST /api/sims/run — N in-memory hire flows, verdicts cycled pass/partial/fail.
export async function POST(req: Request) {
  const corr = correlationId();
  try {
    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }
    const parsed = simRunSchema.safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json(
        { corr, error: "invalid_input", ephemeral: true },
        { status: 400 },
      );
    }
    const { runs, priceCredits, worldId } = parsed.data;
    const clock = () => new Date().toISOString();
    const state = emptyEconomy();
    const base = { worldId, createdAt: clock() };
    const requester = {
      id: "sim_requester",
      kind: "agent" as const,
      displayName: "Sim Requester",
      ...base,
    };
    const provider = {
      id: "sim_provider",
      kind: "agent" as const,
      displayName: "Sim Provider",
      ...base,
    };
    const verifier = {
      id: "sim_verifier",
      kind: "agent" as const,
      displayName: "Sim Verifier",
      ...base,
    };
    fundRequester(state, {
      worldId,
      toPrincipalId: requester.id,
      amountCredits: Math.min(runs * priceCredits + 1000, 2147483647),
    });

    const results: {
      verdict: string;
      contractStatus: string;
      paid: number;
      reputationAfter: number;
    }[] = [];
    let paidTotal = 0;
    for (let i = 0; i < runs; i++) {
      const verdict = VERDICTS[i % VERDICTS.length];
      const { contract } = runHireFlow(state, {
        worldId,
        requester,
        provider,
        verifier,
        capabilityId: "sim.benchmark",
        serviceTitle: `Sim run ${i + 1}`,
        priceCredits,
        requestTitle: `Sim run ${i + 1}`,
        taskTitle: `Sim task ${i + 1}`,
        artifactContent: { run: i + 1, verdict },
        verdict,
        clock,
      });
      const paid = payableFor(priceCredits, verdict);
      paidTotal += paid;
      const rep = state.reputations.find(
        (r) => r.principalId === provider.id && r.worldId === worldId,
      );
      results.push({
        verdict,
        contractStatus: contract.status,
        paid,
        reputationAfter: rep?.score ?? 50,
      });
    }

    const repEnd = state.reputations.find(
      (r) => r.principalId === provider.id && r.worldId === worldId,
    );
    logEvent("sims.run", { corr, runs, worldId });
    return NextResponse.json({
      corr,
      ephemeral: true,
      worldId,
      priceCredits,
      runs: results,
      totals: {
        paidTotal,
        reputationEnd: repEnd?.score ?? 50,
        eventsTotal: state.events.length,
      },
    });
  } catch (e) {
    logEvent("sims.run_failed", {
      corr,
      message: e instanceof Error ? e.message : "unknown",
    });
    return NextResponse.json(
      { corr, error: "sim_failed", ephemeral: true },
      { status: 500 },
    );
  }
}
