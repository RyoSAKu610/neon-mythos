"use client";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { decodeIntent, type IntentPayload } from "@neon/contracts";

// Display mapping: domain events → collective-intelligence stages.
const STAGES: { name: string; events: string[] }[] = [
  { name: "Ask", events: ["principal.registered", "request.created"] },
  { name: "Research", events: ["service.published", "task.created", "task.running"] },
  { name: "Debate", events: ["contract.offered", "contract.agreed"] },
  { name: "Falsify", events: ["contract.active", "artifact.submitted"] },
  { name: "Synthesize", events: ["verification.recorded"] },
  { name: "Decide", events: ["task.succeeded", "task.failed"] },
  { name: "Plan", events: ["contract.fulfilled"] },
  { name: "Execute", events: ["ledger.funded", "ledger.credited"] },
  { name: "Learn", events: ["contract.settled", "reputation.updated"] },
];

interface ExecResult {
  corr: string;
  contract: { id: string; status: string; price: number };
  balances: { requester: number; provider: number };
  reputation: { score: number; jobsCompleted: number; jobsFailed: number };
  events: { type: string; at: string }[];
}

function ScanView() {
  const params = useSearchParams();
  const raw = params.get("m") ?? "";
  const { intent, error: decodeError } = useMemo(() => {
    try {
      return { intent: decodeIntent(raw) as IntentPayload, error: null as string | null };
    } catch (e) {
      return { intent: null, error: e instanceof Error ? e.message : "decode failed" };
    }
  }, [raw]);
  const [result, setResult] = useState<ExecResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function execute() {
    if (!intent) return;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/intents/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(intent),
      });
      const j = (await r.json().catch(() => null)) as ExecResult | null;
      if (!r.ok || !j) {
        setError(`実行失敗 (status ${r.status})`);
        return;
      }
      setResult(j);
      try {
        localStorage.setItem("neon:last-intent", JSON.stringify({ title: intent.t, at: new Date().toISOString(), corr: j.corr, contract: j.contract.id, events: j.events }));
      } catch { /* storage optional */ }
    } catch (e) {
      setError(`通信失敗: ${e instanceof Error ? e.message : "unknown"}`);
    } finally {
      setLoading(false);
    }
  }

  if (decodeError || !intent) {
    return <p role="alert" style={{ color: "#fda4af" }}>QRを読み取れません: {decodeError} — /share で作り直してください。</p>;
  }

  const done = new Set(result?.events.map((e) => e.type) ?? []);

  return (
    <div>
      <h1>QR指令の確認</h1>
      <div style={{ background: "#0f172a", padding: 16, borderRadius: 8 }}>
        <p><strong>{intent.t}</strong></p>
        <p style={{ opacity: 0.85 }}>{intent.b}</p>
        <p style={{ fontSize: 13, opacity: 0.7 }}>種別 {intent.k} · 予算 {intent.p} credits</p>
      </div>
      {!result ? (
        <button onClick={execute} disabled={loading} style={{ marginTop: 12, background: "#0e7490", color: "white", padding: "10px 18px", borderRadius: 8, border: 0, cursor: "pointer" }}>
          {loading ? "実行中…" : "この内容でAgentに実行させる"}
        </button>
      ) : (
        <div style={{ marginTop: 16 }}>
          <p>契約 {result.contract.id} · {result.contract.status} · corr={result.corr}</p>
          <ol>
            {STAGES.map((s) => (
              <li key={s.name} style={{ margin: "6px 0", opacity: s.events.some((e) => done.has(e)) ? 1 : 0.45 }}>
                {s.events.some((e) => done.has(e)) ? "✓" : "·"} <strong>{s.name}</strong>{" "}
                <span style={{ fontSize: 12, opacity: 0.7 }}>{s.events.filter((e) => done.has(e)).join(", ")}</span>
              </li>
            ))}
          </ol>
          <p style={{ fontSize: 13, opacity: 0.8 }}>
            台帳: Commander {result.balances.requester} / Executor {result.balances.provider} ·
            評価 {result.reputation.score} (完遂{result.reputation.jobsCompleted}/失敗{result.reputation.jobsFailed})
          </p>
          <p><a href="/strategy-room" style={{ color: "#f0abfc" }}>Strategy Roomで見る →</a></p>
        </div>
      )}
      {error && <p role="alert" style={{ color: "#fda4af" }}>{error}</p>}
    </div>
  );
}

export default function ScanPage() {
  return (
    <Suspense fallback={<p>読み込み中…</p>}>
      <ScanView />
    </Suspense>
  );
}
