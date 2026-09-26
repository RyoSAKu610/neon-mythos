"use client";
import { useState } from "react";

interface SimRun {
  verdict: string;
  contractStatus: string;
  paid: number;
  reputationAfter: number;
}

interface SimResponse {
  corr: string;
  worldId: string;
  priceCredits: number;
  runs: SimRun[];
  totals: { paidTotal: number; reputationEnd: number; eventsTotal: number };
}

export default function SimulationsPage() {
  const [runs, setRuns] = useState(3);
  const [price, setPrice] = useState(100);
  const [result, setResult] = useState<SimResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function run() {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/sims/run", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ runs, priceCredits: price }),
      });
      const j = (await r.json().catch(() => null)) as SimResponse | null;
      if (!r.ok || !j) {
        setError(`シミュレーション失敗 (status ${r.status})`);
        setResult(null);
        return;
      }
      setResult(j);
    } catch (e) {
      setError(`通信失敗: ${e instanceof Error ? e.message : "unknown"}`);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>シミュレーション・コンソール</h1>
      <p style={{ opacity: 0.8 }}>
        pass/partial/fail の判定を循環させて hire
        フローをN回実行し、支払い（全額/半額/ゼロ）を比較する。
      </p>
      <div style={{ display: "flex", gap: 12, alignItems: "end", flexWrap: "wrap" }}>
        <label>
          実行回数 (1–5)
          <input
            type="number"
            min={1}
            max={5}
            value={runs}
            onChange={(e) => setRuns(Number(e.target.value))}
            style={{ display: "block", padding: 8, borderRadius: 8, background: "#0f172a", color: "#e2e8f0", border: "1px solid #155e75" }}
          />
        </label>
        <label>
          単価 (credits)
          <input
            type="number"
            min={1}
            max={10000}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value))}
            style={{ display: "block", padding: 8, borderRadius: 8, background: "#0f172a", color: "#e2e8f0", border: "1px solid #155e75" }}
          />
        </label>
        <button
          onClick={run}
          disabled={loading}
          style={{ background: "#0e7490", color: "white", padding: "10px 18px", borderRadius: 8, border: 0, cursor: "pointer" }}
        >
          {loading ? "実行中…" : "シミュレーション実行"}
        </button>
      </div>
      {loading && <p>読み込み中…</p>}
      {error && (
        <p role="alert" style={{ color: "#fda4af" }}>
          {error}
        </p>
      )}
      {!loading && !error && !result && (
        <p style={{ opacity: 0.6 }}>まだ実行していない。条件を決めて実行ボタンを押してほしい。</p>
      )}
      {result && (
        <div style={{ marginTop: 16 }}>
          <p style={{ fontSize: 13, opacity: 0.7 }}>
            corr={result.corr} · world={result.worldId} · 単価={result.priceCredits}
          </p>
          <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: 640, marginTop: 8 }}>
            <thead>
              <tr>
                <th style={{ borderBottom: "1px solid #334155", textAlign: "left", padding: 8 }}>#</th>
                <th style={{ borderBottom: "1px solid #334155", textAlign: "left", padding: 8 }}>判定</th>
                <th style={{ borderBottom: "1px solid #334155", textAlign: "left", padding: 8 }}>契約状態</th>
                <th style={{ borderBottom: "1px solid #334155", textAlign: "right", padding: 8 }}>支払い</th>
                <th style={{ borderBottom: "1px solid #334155", textAlign: "right", padding: 8 }}>評価(累積)</th>
              </tr>
            </thead>
            <tbody>
              {result.runs.map((row, i) => (
                <tr key={i}>
                  <td style={{ padding: 8, borderBottom: "1px solid #1e293b" }}>{i + 1}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #1e293b" }}>{row.verdict}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #1e293b" }}>{row.contractStatus}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #1e293b", textAlign: "right" }}>{row.paid}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid #1e293b", textAlign: "right" }}>{row.reputationAfter}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={3} style={{ padding: 8, fontWeight: "bold" }}>
                  合計 / 最終 (イベント {result.totals.eventsTotal}件)
                </td>
                <td style={{ padding: 8, textAlign: "right", fontWeight: "bold" }}>{result.totals.paidTotal}</td>
                <td style={{ padding: 8, textAlign: "right", fontWeight: "bold" }}>{result.totals.reputationEnd}</td>
              </tr>
            </tbody>
          </table>
          <p style={{ fontSize: 13, opacity: 0.75, marginTop: 12 }}>
            pass=全額 / partial=半額(切り捨て・最低1) / fail=ゼロ。fail
            は契約が disputed で残る。sim:* ワールドは本番と同じ
            Contract/Ledger スキーマで動くため、検証結果はそのまま本番設計に反映できる。
          </p>
        </div>
      )}
    </div>
  );
}
