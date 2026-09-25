import { createClient, type SupabaseClient } from "@supabase/supabase-js";

function assertServer(): void {
  if (typeof window !== "undefined") {
    throw new Error("@neon/db is server-only: service-role key must never enter a client bundle");
  }
}

let cached: { url: string; key: string; client: SupabaseClient } | null = null;

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env["SUPABASE_URL"] && process.env["SUPABASE_SERVICE_ROLE_KEY"]);
}

export function getServiceClient(): SupabaseClient | null {
  assertServer();
  if (!isSupabaseConfigured()) return null;
  const url = process.env["SUPABASE_URL"]!;
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]!;
  if (!cached || cached.url !== url || cached.key !== key) {
    cached = {
      url,
      key,
      client: createClient(url, key, {
        auth: { persistSession: false },
      }),
    };
  }
  return cached.client;
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
  async settle(entry) {
    console.warn(
      `[db] virtual settlement (no external ref): ${entry.fromPrincipalId} -> ${entry.toPrincipalId} ${entry.amountCredits}`,
    );
    return { settlementRef: null };
  },
};

export function getSettlementAdapter(): SettlementAdapter {
  const name = process.env["SETTLEMENT_ADAPTER"] ?? "virtual";
  if (name !== "virtual") {
    throw new Error(`settlement adapter "${name}" not wired yet; domain unchanged when it is`);
  }
  return virtualSettlement; // Stage 3 will swap to x402 without changing domain.
}
