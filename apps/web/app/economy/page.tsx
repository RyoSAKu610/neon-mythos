"use client";
import { useState } from "react";

export default function EconomyPage() {
  const [result, setResult] = useState<unknown>(null);
  const [loading, setLoading] = useState(false);
  async function runDemo() {
    setLoading(true);
    try {
      const r = await fetch("/api/economy/demo", { method: "POST" });
      setResult(await r.json());
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
      {result ? (
        <pre style={{ background: "#0f172a", padding: 16, borderRadius: 8, overflow: "auto", marginTop: 16 }}>
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : (
        <p style={{ opacity: 0.6 }}>No run yet. Empty state.</p>
      )}
    </div>
  );
}
