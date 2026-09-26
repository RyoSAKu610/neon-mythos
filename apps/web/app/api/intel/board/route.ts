import { NextResponse } from "next/server";
import { z } from "zod";
import { emptyEconomy, fundRequester, runHireFlow } from "@neon/domain";

const querySchema = z.object({
  worldId: z
    .string()
    .min(1)
    .max(64)
    .regex(/^[A-Za-z0-9:_-]+$/)
    .optional(),
});

const hypothesisSchema = z.object({
  id: z.string(),
  claim: z.string(),
  confidence: z.number(),
  evidence: z.array(z.string()),
  verdict: z.string(),
  contractStatus: z.string(),
  contractId: z.string(),
});

const critiqueSchema = z.object({
  id: z.string(),
  targetId: z.string(),
  point: z.string(),
  severity: z.string(),
});

function avg(scores: Record<string, number>): number {
  const vals = Object.values(scores);
  if (vals.length === 0) return 0;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function severityFor(score: number): string {
  if (score <= 2) return "高";
  if (score <= 3) return "中";
  return "低";
}

const RUBRIC_LABEL: Record<string, string> = {
  correctness: "正確性",
  coverage: "網羅性",
  evidence: "証拠の厚み",
};

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const parsed = querySchema.safeParse({
      worldId: url.searchParams.get("worldId") ?? undefined,
    });
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_input" }, { status: 400 });
    }
    const worldId = parsed.data.worldId ?? "sim:intel-board";
    const clock = () => new Date().toISOString();
    const state = emptyEconomy();
    const base = { worldId, createdAt: clock() };
    const requester = {
      id: "intel_requester",
      kind: "agent" as const,
      displayName: "調査依頼者",
      ...base,
    };
    const provider = {
      id: "intel_provider",
      kind: "agent" as const,
      displayName: "調査員",
      ...base,
    };
    const verifier = {
      id: "intel_verifier",
      kind: "agent" as const,
      displayName: "検証者",
      ...base,
    };

    fundRequester(state, {
      worldId,
      toPrincipalId: requester.id,
      amountCredits: 1000,
      memo: "intel board funding",
    });

    const passRubric = { correctness: 5, coverage: 4, evidence: 3 };
    const partialRubric = { correctness: 3, coverage: 2, evidence: 2 };

    const r1 = runHireFlow(state, {
      worldId,
      requester,
      provider,
      verifier,
      capabilityId: "intel.investigate",
      serviceTitle: "競合リリース調査",
      priceCredits: 120,
      kind: "mission_investigation",
      requestTitle: "仮説A: 競合3社のリリース動向",
      taskTitle: "競合3社の決済機能投入を調査",
      artifactContent: {
        hypothesis: "競合3社はQ3に決済機能を投入する",
        sources: 5,
        summary: "5件の一次情報を突合し、投入時期が一致",
      },
      verdict: "pass",
      rubricScores: passRubric,
      comment: "5件の一次情報で裏付け",
      clock,
    });

    const r2 = runHireFlow(state, {
      worldId,
      requester,
      provider,
      verifier,
      capabilityId: "intel.investigate",
      serviceTitle: "新興勢力の資金調達調査",
      priceCredits: 80,
      kind: "mission_investigation",
      requestTitle: "仮説B: 新興勢力の資金調達と採用拡大",
      taskTitle: "新興2社の調達と採用動向を調査",
      artifactContent: {
        hypothesis: "新興2社は大型調達後に採用を拡大する",
        sources: 2,
        summary: "2件のみで裏付け不足、追加調査が必要",
      },
      verdict: "partial",
      rubricScores: partialRubric,
      comment: "情報源が2件で不十分",
      clock,
    });

    const flows = [
      { key: "hyp_1", result: r1, rubric: passRubric },
      { key: "hyp_2", result: r2, rubric: partialRubric },
    ];

    const hypotheses = flows.map(({ key, result, rubric }) => {
      const content = result.artifact.content as {
        hypothesis?: string;
        sources?: number;
        summary?: string;
      };
      const claim =
        typeof content.hypothesis === "string" && content.hypothesis.length > 0
          ? content.hypothesis
          : result.task.title;
      const confidence = round2(avg(rubric) / 5);
      const evidence = [
        `情報源: ${String(content.sources ?? "?")}件 — ${content.summary ?? ""}`.trim(),
        `成果物ハッシュ: ${result.artifact.contentHash}`,
        `検証コメント: ${result.verification.comment}`,
        `検証内訳: ${Object.entries(rubric)
          .map(([k, v]) => `${RUBRIC_LABEL[k] ?? k}=${v}/5`)
          .join(", ")}`,
      ];
      return {
        id: key,
        claim,
        confidence,
        evidence,
        verdict: result.verification.verdict,
        contractStatus: result.contract.status,
        contractId: result.contract.id,
      };
    });

    const critiques: Array<{
      id: string;
      targetId: string;
      point: string;
      severity: string;
    }> = [];
    flows.forEach(({ key, result, rubric }) => {
      for (const [rubricKey, score] of Object.entries(rubric)) {
        if (score <= 3) {
          const label = RUBRIC_LABEL[rubricKey] ?? rubricKey;
          critiques.push({
            id: `crt_${critiques.length + 1}`,
            targetId: key,
            point: `${label}が${score}/5 — 検証「${result.verification.comment}」(verdict=${result.verification.verdict})に基づく指摘`,
            severity: severityFor(score),
          });
        }
      }
    });

    const body = {
      hypotheses,
      critiques,
      contractIds: [r1.contract.id, r2.contract.id],
      events: state.events.map((e) => ({
        seq: e.seq,
        type: e.type,
        entityId: e.entityId,
      })),
    };

    // Output shape guard (honest derivation check).
    const shape = z
      .object({
        hypotheses: z.array(hypothesisSchema),
        critiques: z.array(critiqueSchema),
        contractIds: z.array(z.string()),
        events: z.array(
          z.object({ seq: z.number(), type: z.string(), entityId: z.string() }),
        ),
      })
      .safeParse(body);
    if (!shape.success) {
      return NextResponse.json({ error: "board_shape_invalid" }, { status: 500 });
    }

    return NextResponse.json(body);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "board_failed" },
      { status: 500 },
    );
  }
}
