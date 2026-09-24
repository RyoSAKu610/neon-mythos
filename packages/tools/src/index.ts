import { z } from "zod";

export type ToolPermission = "read" | "write" | "consequential";

export interface ToolDef<I, O> {
  name: string;
  permission: ToolPermission;
  input: z.ZodType<I>;
  run(input: I): Promise<O>;
  requiresApproval: boolean;
}

export const readLedger: ToolDef<{ principalId: string }, { note: string }> = {
  name: "ledger.read",
  permission: "read",
  input: z.object({ principalId: z.string() }),
  async run() { return { note: "read via API route" }; },
  requiresApproval: false,
};

export const settleContract: ToolDef<{ contractId: string }, { queued: boolean }> = {
  name: "contract.settle",
  permission: "consequential",
  input: z.object({ contractId: z.string() }),
  async run() { return { queued: true }; },
  requiresApproval: true, // human approval boundary
};

export const registry = [readLedger, settleContract];
