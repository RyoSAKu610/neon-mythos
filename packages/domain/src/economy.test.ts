import { describe, expect, it } from "vitest";
import {
  balanceOf,
  emptyEconomy,
  runHireFlow,
  transitionContract,
} from "./economy";
import { nowIso } from "./types";

function principals(worldId: string) {
  return {
    requester: { id: "A", kind: "agent" as const, displayName: "A", worldId, createdAt: nowIso() },
    provider: { id: "B", kind: "agent" as const, displayName: "B", worldId, createdAt: nowIso() },
    verifier: { id: "V", kind: "human" as const, displayName: "V", worldId, createdAt: nowIso() },
  };
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
  it("pass settles ledger and raises reputation", () => {
    const s = emptyEconomy();
    const p = principals("production");
    const { contract, task } = runHireFlow(s, {
      worldId: "production",
      ...p,
      capabilityId: "code.review",
      serviceTitle: "Review",
      priceCredits: 100,
      requestTitle: "Review PR",
      taskTitle: "Review PR #1",
      artifactContent: { ok: true },
      verdict: "pass",
    });
    expect(contract.status).toBe("settled");
    expect(task.status).toBe("succeeded");
    expect(balanceOf(s.ledger, "B")).toBe(100);
    expect(balanceOf(s.ledger, "A")).toBe(-100);
    expect(s.reputations.find((r) => r.principalId === "B")!.score).toBe(53);
  });

  it("fail disputes without payment and lowers reputation", () => {
    const s = emptyEconomy();
    const p = principals("production");
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
    expect(balanceOf(s.ledger, "B")).toBe(0);
    expect(s.reputations.find((r) => r.principalId === "B")!.score).toBe(45);
  });

  it("worlds are isolated (sim vs production)", () => {
    const s = emptyEconomy();
    const mk = (w: string) => ({
      requester: { id: "A", kind: "agent" as const, displayName: "A", worldId: w, createdAt: nowIso() },
      provider: { id: "B", kind: "agent" as const, displayName: "B", worldId: w, createdAt: nowIso() },
      verifier: { id: "V", kind: "human" as const, displayName: "V", worldId: w, createdAt: nowIso() },
    });
    runHireFlow(s, {
      worldId: "production", ...mk("production"),
      capabilityId: "c", serviceTitle: "s", priceCredits: 10,
      requestTitle: "t", taskTitle: "t", artifactContent: {}, verdict: "pass",
    });
    runHireFlow(s, {
      worldId: "sim:fast-001", ...mk("sim:fast-001"),
      capabilityId: "c", serviceTitle: "s", priceCredits: 999,
      requestTitle: "t", taskTitle: "t", artifactContent: {}, verdict: "pass",
    });
    const prod = s.ledger.filter((e) => e.worldId === "production");
    const sim = s.ledger.filter((e) => e.worldId === "sim:fast-001");
    expect(prod[0]!.amountCredits).toBe(10);
    expect(sim[0]!.amountCredits).toBe(999);
  });
});
