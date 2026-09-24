import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env["SUPABASE_URL"] && process.env["SUPABASE_SERVICE_ROLE_KEY"]);
}

export function getServiceClient(): SupabaseClient | null {
  if (!isSupabaseConfigured()) return null;
  if (!cached) {
    cached = createClient(
      process.env["SUPABASE_URL"]!,
      process.env["SUPABASE_SERVICE_ROLE_KEY"]!,
      { auth: { persistSession: false } },
    );
  }
  return cached;
}

// Settlement Adapter interface: virtual first, x402 later.
// Virtual adapter appends to ledger_entries; x402 adapter will attach settlementRef.
export interface SettlementAdapter {
  name: "virtual" | "x402";
  settle(entry: {
    worldId: string;
    contractId: string | null;
    fromPrincipalId: string;
    toPrincipalId: string;
    amountCredits: number;
    memo: string;
  }): Promise<{ settlementRef: string | null }>;
}

export const virtualSettlement: SettlementAdapter = {
  name: "virtual",
  async settle() {
    return { settlementRef: null };
  },
};

export function getSettlementAdapter(): SettlementAdapter {
  return virtualSettlement; // Stage 3 will swap to x402 without changing domain.
}
