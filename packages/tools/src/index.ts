import { createHash } from "node:crypto";
import { z } from "zod";
import { stableStringify } from "@neon/domain";

export type ToolPermission = "read" | "write" | "consequential";

export interface ToolDef<I, O> {
  name: string;
  permission: ToolPermission;
  input: z.ZodType<I>;
  run(input: I): Promise<O>;
  requiresApproval: boolean;
}

export interface Approval {
  action: string;
  paramsHash: string;
  status: "approved" | "rejected" | "pending";
}

export function hashParams(params: unknown): string {
  // Canonical form: key order must not affect the binding.
  return createHash("sha256").update(stableStringify(params), "utf8").digest("hex");
}

/** Verify an approval binds to this exact action + params (AGENTS.md boundary). */
export function assertApproval(action: string, params: unknown, approval: Approval): void {
  if (approval.action !== action) {
    throw new Error(`approval action mismatch: ${approval.action} != ${action}`);
  }
  if (approval.paramsHash !== hashParams(params)) {
    throw new Error("approval params mismatch: approval does not bind to these params");
  }
  if (approval.status !== "approved") {
    throw new Error(`approval not granted (status=${approval.status})`);
  }
}

export const readLedger: ToolDef<{ principalId: string }, { note: string }> = {
  name: "ledger.read",
  permission: "read",
  input: z.object({ principalId: z.string().min(1).max(120) }),
  async run() {
    throw new Error("not implemented: wire to GET /api/ledger?principalId=…");
  },
  requiresApproval: false,
};

export const settleContract: ToolDef<
  { contractId: string; approval: Approval },
  { queued: boolean }
> = {
  name: "contract.settle",
  permission: "consequential",
  input: z.object({
    contractId: z.string().min(1).max(120),
    approval: z.object({
      action: z.string(),
      paramsHash: z.string(),
      status: z.enum(["approved", "rejected", "pending"]),
    }),
  }),
  async run(input) {
    assertApproval("contract.settle", { contractId: input.contractId }, input.approval);
    return { queued: true };
  },
  requiresApproval: true, // human approval boundary
};

export const registry = [readLedger, settleContract];
