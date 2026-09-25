"use client";
import { useState } from "react";

interface DemoResult {
  corr: string;
  contract: { id: string; status: string; price: number };
  task: { id: string; status: string };
  artifact: { id: string; hash: string };
  verification: { verdict: string };
  balances: { A: number; B: number };
  events: number;
}

export default function EconomyPage() {
  const [result, setResult] = useState<DemoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  async function runDemo() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/economy/demo", {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ worldId: "sim:fast-001", priceCredits: 100, verdict: "pass" }),
      });
      const j = (await r.json().catch(() => null)) as (DemoResult & { corr?: string }) | null;
      if (!r.ok || !j) {
        setError(`Request failed (status ${r.status}) corr=${j?.corr ?? "n/a"}`);
        return;
      }
      setResult(j as DemoResult);
    } catch (e) {
      setError(`Network error: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setLoading(false);
    }
  }
  return (
    <div>
      <h1>Vertical flow — virtual economy proof</h1>
      <p style={{ opacity: 0.8 }}>
        Agent A hires Agent B → artifact → verification → ledger → reputation.
        Same Contract/Ledger schema will later settle via x402 adapter.
      </p>
      <button
        onClick={runDemo}
        disabled={loading}
        style={{ background: "#0e7490", color: "white", padding: "10px 18px", borderRadius: 8, border: 0, cursor: "pointer" }}
      >
        {loading ? "Running…" : "Run hire → verify → settle"}
      </button>
      {error && (
        <p role="alert" style={{ color: "#fda4af" }}>
          {error}
        </p>
      )}
      {result ? (
        <div>
          <p style={{ fontSize: 13, opacity: 0.7 }}>corr={result.corr} · events={result.events}</p>
          <pre style={{ background: "#0f172a", padding: 16, borderRadius: 8, overflow: "auto", marginTop: 8 }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      ) : (
        !error && <p style={{ opacity: 0.6 }}>No run yet. Empty state.</p>
      )}
    </div>
  );
}
