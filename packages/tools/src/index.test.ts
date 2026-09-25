import { describe, expect, it } from "vitest";
import { assertApproval, hashParams, settleContract } from "./index";

describe("hashParams", () => {
  it("is key-order independent", () => {
    expect(hashParams({ a: 1, b: 2 })).toBe(hashParams({ b: 2, a: 1 }));
  });
  it("differs on value change", () => {
    expect(hashParams({ a: 1 })).not.toBe(hashParams({ a: 2 }));
  });
});

describe("settleContract approval boundary", () => {
  it("runs with a bound approval", async () => {
    const params = { contractId: "ctr_x" };
    const r = await settleContract.run({
      contractId: "ctr_x",
      approval: { action: "contract.settle", paramsHash: hashParams(params), status: "approved" },
    });
    expect(r).toEqual({ queued: true });
  });
  it("rejects mismatched action, params, and non-approved status", async () => {
    const good = { action: "contract.settle", paramsHash: hashParams({ contractId: "ctr_x" }), status: "approved" as const };
    await expect(
      settleContract.run({ contractId: "ctr_x", approval: { ...good, action: "other" } }),
    ).rejects.toThrow(/action mismatch/);
    await expect(
      settleContract.run({ contractId: "ctr_y", approval: good }),
    ).rejects.toThrow(/params mismatch/);
    await expect(
      settleContract.run({ contractId: "ctr_x", approval: { ...good, status: "pending" } }),
    ).rejects.toThrow(/not granted/);
  });
});
