"use client";
import { useEffect, useState } from "react";

interface Hypothesis {
  id: string;
  claim: string;
  confidence: number;
  evidence: string[];
  verdict: string;
  contractStatus: string;
  contractId: string;
}

interface Critique {
  id: string;
  targetId: string;
  point: string;
  severity: string;
}

interface Board {
  hypotheses: Hypothesis[];
  critiques: Critique[];
  contractIds: string[];
  events: Array<{ seq: number; type: string; entityId: string }>;
}

export default function IntelligencePage() {
  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  // Mount + retry fetch. State updates happen only in async callbacks
  // (subscription-style), never synchronously in the effect body.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/intel/board", { headers: { Accept: "application/json" } })
      .then(async (r) => {
        const j = (await r.json().catch(() => null)) as
          | (Board & { error?: string })
          | null;
        if (cancelled) return;
        if (!r.ok || !j || !("hypotheses" in j) || !Array.isArray(j.hypotheses)) {
          const msg =
            j && "error" in j && typeof j.error === "string"
              ? j.error
              : `status ${r.status}`;
          setError(`調査ボードの取得に失敗しました（${msg}）`);
        } else {
          setBoard(j);
          setError(null);
        }
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(`通信エラー: ${e instanceof Error ? e.message : "unknown"}`);
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [nonce]);

  const retry = () => {
    setLoading(true);
    setError(null);
    setNonce((n) => n + 1);
  };

  const claimOf = (id: string) =>
    board?.hypotheses.find((h) => h.id === id)?.claim ?? id;

  return (
    <div>
      <h1>インテリジェンス調査ボード</h1>
      <p style={{ opacity: 0.8 }}>
        任務調査（mission_investigation）の成果物から仮説を導出し、検証ルーブリックから反論を生成します。DBは使わず、その場のドメインフローで構築しています。
      </p>

      {loading && (
        <div aria-label="読み込み中" style={{ display: "grid", gap: 12, marginTop: 16 }}>
          {[0, 1].map((i) => (
            <div
              key={i}
              style={{
                background: "#0f172a",
                borderRadius: 8,
                padding: 16,
                opacity: 0.6,
              }}
            >
              <div
                style={{ background: "#334155", height: 16, borderRadius: 4, width: "60%" }}
              />
              <div
                style={{
                  background: "#334155",
                  height: 12,
                  borderRadius: 4,
                  width: "90%",
                  marginTop: 8,
                }}
              />
              <p style={{ opacity: 0.7 }}>読み込み中…</p>
            </div>
          ))}
        </div>
      )}

      {!loading && error && (
        <div role="alert" style={{ marginTop: 16 }}>
          <p style={{ color: "#fda4af" }}>{error}</p>
          <button
            onClick={retry}
            style={{
              background: "#0e7490",
              color: "white",
              padding: "8px 16px",
              borderRadius: 8,
              border: 0,
              cursor: "pointer",
            }}
          >
            再試行
          </button>
        </div>
      )}

      {!loading && !error && board && board.hypotheses.length === 0 && (
        <p style={{ opacity: 0.6, marginTop: 16 }}>仮説がありません。</p>
      )}

      {!loading && !error && board && board.hypotheses.length > 0 && (
        <div style={{ display: "grid", gap: 16, marginTop: 16 }}>
          <section>
            <h2>仮説（{board.hypotheses.length}件）</h2>
            <div style={{ display: "grid", gap: 12 }}>
              {board.hypotheses.map((h) => (
                <article
                  key={h.id}
                  style={{
                    background: "#0f172a",
                    padding: 16,
                    borderRadius: 8,
                  }}
                >
                  <h3 style={{ margin: "0 0 8px" }}>
                    {h.id}: {h.claim}
                  </h3>
                  <p style={{ fontSize: 13, opacity: 0.8, margin: "4px 0" }}>
                    確信度: {Math.round(h.confidence * 100)}% / 検証: {h.verdict} /
                    契約: {h.contractStatus}（{h.contractId}）
                  </p>
                  <div
                    role="progressbar"
                    aria-valuenow={Math.round(h.confidence * 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${h.id} 確信度`}
                    style={{
                      background: "#1e293b",
                      borderRadius: 4,
                      height: 10,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${Math.round(h.confidence * 100)}%`,
                        background: "#0e7490",
                        height: "100%",
                      }}
                    />
                  </div>
                  <ul style={{ fontSize: 13, opacity: 0.85, paddingLeft: 18 }}>
                    {h.evidence.map((ev, i) => (
                      <li key={i}>{ev}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          <section>
            <h2>反論（{board.critiques.length}件）</h2>
            {board.critiques.length === 0 ? (
              <p style={{ opacity: 0.6 }}>反論はありません。</p>
            ) : (
              <ul style={{ display: "grid", gap: 8, paddingLeft: 18 }}>
                {board.critiques.map((c) => (
                  <li key={c.id} style={{ fontSize: 14 }}>
                    <strong>{c.id}</strong> → 対象「{claimOf(c.targetId)}」: {c.point}{" "}
                    <span style={{ opacity: 0.7 }}>（深刻度: {c.severity}）</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <p style={{ fontSize: 13, opacity: 0.7 }}>
            契約: {board.contractIds.join(", ")} / イベント数: {board.events.length}
          </p>
        </div>
      )}
    </div>
  );
}
