import { describe, expect, it } from "vitest";
import {
  artifactSchema,
  decodeIntent,
  demoHireSchema,
  encodeIntent,
  MAX_INTENT_CHARS,
  principalSchema,
  serviceSchema,
  verificationSchema,
} from "./index";

describe("principalSchema", () => {
  it("accepts valid input with default world", () => {
    const r = principalSchema.safeParse({ kind: "agent", displayName: "A" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.worldId).toBe("production");
  });
  it("rejects bad kind, empty name, and hostile worldId", () => {
    expect(principalSchema.safeParse({ kind: "bot", displayName: "A" }).success).toBe(false);
    expect(principalSchema.safeParse({ kind: "agent", displayName: "" }).success).toBe(false);
    expect(
      principalSchema.safeParse({ kind: "agent", displayName: "A", worldId: "../../etc" }).success,
    ).toBe(false);
  });
});

describe("serviceSchema", () => {
  it("rejects zero/negative price", () => {
    const base = { providerId: "p", capabilityId: "c", title: "t" };
    expect(serviceSchema.safeParse({ ...base, priceCredits: 0 }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...base, priceCredits: -5 }).success).toBe(false);
    expect(serviceSchema.safeParse({ ...base, priceCredits: 100 }).success).toBe(true);
  });
});

describe("verificationSchema rubric rules", () => {
  const base = { artifactId: "a", contractId: "c" };
  it("pass requires scores >= 3", () => {
    expect(
      verificationSchema.safeParse({ ...base, verdict: "pass", rubricScores: { q: 5 } }).success,
    ).toBe(true);
    expect(
      verificationSchema.safeParse({ ...base, verdict: "pass", rubricScores: { q: 2 } }).success,
    ).toBe(false);
  });
  it("fail requires a score <= 1", () => {
    expect(
      verificationSchema.safeParse({ ...base, verdict: "fail", rubricScores: { q: 4 } }).success,
    ).toBe(false);
    expect(
      verificationSchema.safeParse({ ...base, verdict: "fail", rubricScores: { q: 1 } }).success,
    ).toBe(true);
  });
});

describe("artifactSchema", () => {
  it("rejects circular and oversized content", () => {
    const circ: Record<string, unknown> = {};
    circ.self = circ;
    expect(
      artifactSchema.safeParse({ taskId: "t", contractId: "c", content: circ }).success,
    ).toBe(false);
    expect(
      artifactSchema.safeParse({
        taskId: "t",
        contractId: "c",
        content: "x".repeat(1024 * 1024 + 1),
      }).success,
    ).toBe(false);
    expect(
      artifactSchema.safeParse({ taskId: "t", contractId: "c", content: { ok: true } }).success,
    ).toBe(true);
  });
});

describe("demoHireSchema", () => {
  it("defaults world/price/verdict and bounds price", () => {
    const r = demoHireSchema.safeParse({});
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.worldId).toBe("sim:fast-001");
      expect(r.data.priceCredits).toBe(100);
      expect(r.data.verdict).toBe("pass");
    }
    expect(demoHireSchema.safeParse({ priceCredits: 0 }).success).toBe(false);
    expect(demoHireSchema.safeParse({ verdict: "maybe" }).success).toBe(false);
  });
});

describe("intent codec", () => {
  it("round-trips incl. multibyte text", () => {
    const p = { v: 1 as const, t: "AI市場を調査せよ", b: " Proofs あいう ", k: "mission_investigation" as const, p: 120 };
    const enc = encodeIntent(p);
    expect(enc.length).toBeLessThanOrEqual(MAX_INTENT_CHARS);
    expect(decodeIntent(enc)).toEqual({ ...p });
  });
  it("rejects oversized briefs and garbage", () => {
    expect(() =>
      encodeIntent({ v: 1, t: "t", b: "あ".repeat(600), k: "service_hire", p: 10 }),
    ).toThrow(/too large/);
    expect(() => decodeIntent("!!!not-base64!!!")).toThrow();
    expect(() => decodeIntent("e30=")).toThrow(); // {} fails schema
  });
});
