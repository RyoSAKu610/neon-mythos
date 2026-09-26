import { NextResponse } from "next/server";
import { emptyEconomy, runHireFlow, balanceOf, fundRequester } from "@neon/domain";
import { intentPayloadSchema } from "@neon/contracts";
import { logEvent, correlationId } from "@neon/observability";

// POST /api/intents/execute — run a QR-scanned intent through the vertical flow.
// Body: { t, b, k, p } (intent payload). Verdict is simulated pass for v1;
// verification detail arrives with human review in v2.
export async function POST(req: Request) {
  const corr = correlationId();
  try {
    let body: unknown = {};
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ corr, error: "invalid_input", ephemeral: true }, { status: 400 });
    }
    const parsed = intentPayloadSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ corr, error: "invalid_input", ephemeral: true }, { status: 400 });
    }
    const { t, b, k, p } = parsed.data;
    const worldId = "sim:fast-001";
    const clock = () => new Date().toISOString();
    const state = emptyEconomy();
    const base = { worldId, createdAt: clock() };
    const requester = { id: "qr_user", kind: "human" as const, displayName: "QR Commander", ...base };
    const provider = { id: "agent_exec", kind: "agent" as const, displayName: "Executor Agent", ...base };
    const verifier = { id: "agent_judge", kind: "agent" as const, displayName: "Judge Agent", ...base };
    fundRequester(state, {
      worldId,
      toPrincipalId: requester.id,
      amountCredits: Math.min(p + 1000, 2147483647),
    });
    const { contract, task, artifact, verification } = runHireFlow(state, {
      worldId,
      requester,
      provider,
      verifier,
      capabilityId: "strategy.analyze",
      serviceTitle: t,
      priceCredits: p,
      kind: k,
      requestTitle: t,
      taskTitle: b.slice(0, 200),
      artifactContent: { brief: b, plan: "staged execution complete" },
      verdict: "pass",
      clock,
    });
    logEvent("intent.executed", { corr, contract: contract.id, kind: k });
    return NextResponse.json({
      corr,
      ephemeral: true,
      kind: k,
      contract: { id: contract.id, status: contract.status, price: contract.priceCredits },
      task: { id: task.id, status: task.status },
      artifact: { id: artifact.id, hash: artifact.contentHash },
      verification: { verdict: verification.verdict },
      balances: {
        requester: balanceOf(state.ledger, requester.id, worldId),
        provider: balanceOf(state.ledger, provider.id, worldId),
      },
      reputation: state.reputations.find((r) => r.principalId === provider.id),
      events: state.events.map((e) => ({ type: e.type, at: e.createdAt })),
    });
  } catch (e) {
    logEvent("intent.failed", { corr, message: e instanceof Error ? e.message : "unknown" });
    return NextResponse.json({ corr, error: "execute_failed", ephemeral: true }, { status: 500 });
  }
}
