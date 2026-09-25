import { describe, expect, it } from "vitest";
import {
  balanceOf,
  emptyEconomy,
  fundRequester,
  hashContent,
  payableFor,
  resolveDispute,
  runHireFlow,
  stableStringify,
  transitionContract,
} from "./economy";
import { nowIso, uid } from "./types";

function principals(worldId: string) {
  return {
    requester: { id: "A", kind: "agent" as const, displayName: "A", worldId, createdAt: nowIso() },
    provider: { id: "B", kind: "agent" as const, displayName: "B", worldId, createdAt: nowIso() },
    verifier: { id: "V", kind: "human" as const, displayName: "V", worldId, createdAt: nowIso() },
  };
}

function fundedHire(worldId: string, over: Record<string, unknown> = {}) {
  const s = emptyEconomy();
  const p = principals(worldId);
  fundRequester(s, { worldId, toPrincipalId: p.requester.id, amountCredits: 10000 });
  const r = runHireFlow(s, {
    worldId,
    ...p,
    capabilityId: "code.review",
    serviceTitle: "Review",
    priceCredits: 100,
    requestTitle: "Review PR",
    taskTitle: "Review PR #1",
    artifactContent: { ok: true },
    verdict: "pass",
    ...over,
  });
  return { s, p, r };
}

describe("contract state machine", () => {
  it("rejects invalid transition", () => {
    const c: Parameters<typeof transitionContract>[0] = {
      id: "ctr_x",
      requestId: "r",
      serviceId: "s",
      requesterId: "A",
      providerId: "B",
      priceCredits: 10,
      terms: "t",
      status: "draft",
      worldId: "production",
      createdAt: nowIso(),
      updatedAt: nowIso(),
    };
    expect(() => transitionContract(c, "settled")).toThrow();
    expect(transitionContract(c, "offered").status).toBe("offered");
  });
});

describe("vertical hire flow", () => {
  it("pass settles full price and raises reputation", () => {
    const { s, r } = fundedHire("production");
    expect(r.contract.status).toBe("settled");
    expect(r.task.status).toBe("succeeded");
    expect(balanceOf(s.ledger, "B", "production")).toBe(100);
    expect(balanceOf(s.ledger, "A", "production")).toBe(10000 - 100);
    expect(s.reputations.find((x) => x.principalId === "B")!.score).toBe(53);
  });

  it("partial pays half and raises reputation by 1", () => {
    const { s, r } = fundedHire("production", {
      verdict: "partial",
      artifactContent: { half: true },
    });
    expect(r.contract.status).toBe("settled");
    expect(balanceOf(s.ledger, "B", "production")).toBe(50);
    expect(s.reputations.find((x) => x.principalId === "B")!.score).toBe(51);
  });

  it("fail disputes without payment, lowers reputation, resolves to cancelled", () => {
    const s = emptyEconomy();
    const p = principals("production");
    fundRequester(s, { worldId: "production", toPrincipalId: p.requester.id, amountCredits: 1000 });
    const { contract } = runHireFlow(s, {
      worldId: "production",
      ...p,
      capabilityId: "code.review",
      serviceTitle: "Review",
      priceCredits: 50,
      requestTitle: "Bad job",
      taskTitle: "Bad job",
      artifactContent: {},
      verdict: "fail",
    });
    expect(contract.status).toBe("disputed");
    expect(balanceOf(s.ledger, "B", "production")).toBe(0);
    expect(s.reputations.find((r) => r.principalId === "B")!.score).toBe(45);
    const resolved = resolveDispute(s, {
      contractId: contract.id,
      worldId: "production",
      actorId: p.verifier.id,
      resolution: "cancelled",
    });
    expect(resolved.status).toBe("cancelled");
  });

  it("rejects unfunded requester (no negative balances)", () => {
    const s = emptyEconomy();
    const p = principals("production");
    expect(() =>
      runHireFlow(s, {
        worldId: "production",
        ...p,
        capabilityId: "code.review",
        serviceTitle: "Review",
        priceCredits: 50,
        requestTitle: "t",
        taskTitle: "t",
        artifactContent: {},
        verdict: "pass",
      }),
    ).toThrow(/insufficient-funds/);
    expect(s.contracts.length).toBe(0); // atomic: nothing committed
  });

  it("rejects self-dealing (same id twice)", () => {
    const s = emptyEconomy();
    const p = principals("production");
    fundRequester(s, { worldId: "production", toPrincipalId: p.requester.id, amountCredits: 1000 });
    expect(() =>
      runHireFlow(s, {
        worldId: "production",
        requester: p.requester,
        provider: p.requester,
        verifier: p.verifier,
        capabilityId: "c",
        serviceTitle: "s",
        priceCredits: 10,
        requestTitle: "t",
        taskTitle: "t",
        artifactContent: {},
        verdict: "pass",
      }),
    ).toThrow(/self-dealing/);
  });

  it("rejects negative/zero/oversize prices and budget<price", () => {
    const s = emptyEconomy();
    const p = principals("production");
    fundRequester(s, { worldId: "production", toPrincipalId: p.requester.id, amountCredits: 1000 });
    for (const price of [0, -5, Number.NaN, Number.POSITIVE_INFINITY, 1.5, 2147483648]) {
      expect(() =>
        runHireFlow(s, {
          worldId: "production",
          ...p,
          capabilityId: "c",
          serviceTitle: "s",
          priceCredits: price,
          requestTitle: "t",
          taskTitle: "t",
          artifactContent: {},
          verdict: "pass",
        }),
      ).toThrow();
    }
    expect(() =>
      runHireFlow(s, {
        worldId: "production",
        ...p,
        capabilityId: "c",
        serviceTitle: "s",
        priceCredits: 100,
        budgetCredits: 10,
        requestTitle: "t",
        taskTitle: "t",
        artifactContent: {},
        verdict: "pass",
      }),
    ).toThrow(/insufficient-budget/);
  });

  it("rejects circular and non-serializable artifacts atomically", () => {
    const s = emptyEconomy();
    const p = principals("production");
    fundRequester(s, { worldId: "production", toPrincipalId: p.requester.id, amountCredits: 1000 });
    const circ: Record<string, unknown> = {};
    circ["self"] = circ;
    expect(() =>
      runHireFlow(s, {
        worldId: "production",
        ...p,
        capabilityId: "c",
        serviceTitle: "s",
        priceCredits: 10,
        requestTitle: "t",
        taskTitle: "t",
        artifactContent: circ,
        verdict: "pass",
      }),
    ).toThrow(/circular/);
    expect(s.contracts.length).toBe(0);
    expect(() =>
      runHireFlow(s, {
        worldId: "production",
        ...p,
        capabilityId: "c",
        serviceTitle: "s",
        priceCredits: 10,
        requestTitle: "t",
        taskTitle: "t",
        artifactContent: { x: 10n },
        verdict: "pass",
      }),
    ).toThrow(/non-serializable/);
  });

  it("worlds are isolated (ledger, principals, reputations)", () => {
    const s = emptyEconomy();
    const mk = (w: string, suffix: string) => ({
      requester: { id: `A${suffix}`, kind: "agent" as const, displayName: "A", worldId: w, createdAt: nowIso() },
      provider: { id: `B${suffix}`, kind: "agent" as const, displayName: "B", worldId: w, createdAt: nowIso() },
      verifier: { id: `V${suffix}`, kind: "agent" as const, displayName: "V", worldId: w, createdAt: nowIso() },
    });
    const prod = mk("production", "p");
    const sim = mk("sim:fast-001", "s");
    fundRequester(s, { worldId: "production", toPrincipalId: prod.requester.id, amountCredits: 100 });
    fundRequester(s, { worldId: "sim:fast-001", toPrincipalId: sim.requester.id, amountCredits: 100 });
    runHireFlow(s, {
      worldId: "production", ...prod,
      capabilityId: "c", serviceTitle: "s", priceCredits: 10,
      requestTitle: "t", taskTitle: "t", artifactContent: {}, verdict: "pass",
    });
    runHireFlow(s, {
      worldId: "sim:fast-001", ...sim,
      capabilityId: "c", serviceTitle: "s", priceCredits: 20,
      requestTitle: "t", taskTitle: "t", artifactContent: {}, verdict: "pass",
    });
    expect(balanceOf(s.ledger, prod.provider.id, "production")).toBe(10);
    expect(balanceOf(s.ledger, sim.provider.id, "sim:fast-001")).toBe(20);
    // cross-world queries return 0, never bleed
    expect(balanceOf(s.ledger, prod.provider.id, "sim:fast-001")).toBe(0);
    expect(s.principals.filter((x) => x.worldId === "production").length).toBeGreaterThan(0);
    expect(s.principals.filter((x) => x.worldId === "sim:fast-001").length).toBeGreaterThan(0);
    // per-world event seqs are contiguous from 1
    for (const w of ["production", "sim:fast-001"]) {
      const seqs = s.events.filter((e) => e.worldId === w).map((e) => (e.payload as { _worldSeq: number })._worldSeq).sort((a, b) => a - b);
      expect(seqs[0]).toBe(1);
      expect(seqs[seqs.length - 1]).toBe(seqs.length);
    }
  });
});

describe("hashing", () => {
  it("is key-order stable and sha256", () => {
    expect(stableStringify({ b: 2, a: 1 })).toBe(stableStringify({ a: 1, b: 2 }));
    expect(hashContent({ a: 1 })).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(hashContent({ a: 1 })).toBe(hashContent({ a: 1 }));
  });
  it("payableFor splits partial 50%", () => {
    expect(payableFor(100, "pass")).toBe(100);
    expect(payableFor(100, "partial")).toBe(50);
    expect(payableFor(1, "partial")).toBe(1);
    expect(payableFor(100, "fail")).toBe(0);
  });
  it("uid has 128-bit entropy shape", () => {
    const ids = new Set(Array.from({ length: 5000 }, () => uid("t")));
    expect(ids.size).toBe(5000);
  });
});
