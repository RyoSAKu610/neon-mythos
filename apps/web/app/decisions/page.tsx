"use client";
import { useCallback, useState } from "react";
import { assertApproval, hashParams } from "@neon/tools";

const STORAGE_KEY = "neon:decisions";

type DecisionStatus = "pending" | "approved" | "rejected";

interface Decision {
  id: string;
  action: string;
  params: Record<string, unknown>;
  paramsHash: string;
  status: DecisionStatus;
}

function seedDecisions(): Decision[] {
  const p1 = { contractId: "ctr_demo_001" };
  const p2 = { contractId: "ctr_demo_002", amountCredits: 60 };
  return [
    {
      id: "dec_1",
      action: "contract.settle",
      params: p1,
      paramsHash: hashParams(p1),
      status: "pending",
    },
    {
      id: "dec_2",
      action: "contract.settle",
      params: p2,
      paramsHash: hashParams(p2),
      status: "pending",
    },
  ];
}

function readStored(): Decision[] {
  if (typeof window === "undefined") return seedDecisions();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Decision[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Rebind hash to guard against stale/tampered storage.
        return parsed.map((d) => ({
          ...d,
          paramsHash: hashParams(d.params),
        }));
      }
    }
  } catch {
    // Corrupt storage → reseed below.
  }
  const seed = seedDecisions();
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  } catch {
    // Storage unavailable → keep in-memory only.
  }
  return seed;
}

function statusLabel(s: DecisionStatus): string {
  if (s === "approved") return "承認済み";
  if (s === "rejected") return "却下済み";
  return "未処理";
}

export default function DecisionsPage() {
  const [decisions, setDecisions] = useState<Decision[]>(readStored);
  const [error, setError] = useState<string | null>(null);

  const persist = useCallback((next: Decision[]) => {
    setDecisions(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore quota/private-mode errors; state remains in memory
    }
  }, []);

  const approve = useCallback(
    (id: string) => {
      setError(null);
      const target = decisions.find((d) => d.id === id);
      if (!target) return;
      try {
        assertApproval(target.action, target.params, {
          action: target.action,
          paramsHash: target.paramsHash,
          status: "approved",
        });
      } catch (e) {
        setError(
          `承認の紐付けに失敗しました: ${e instanceof Error ? e.message : "unknown"}`,
        );
        return;
      }
      persist(
        decisions.map((d) =>
          d.id === id ? { ...d, status: "approved" as DecisionStatus } : d,
        ),
      );
    },
    [decisions, persist],
  );

  const reject = useCallback(
    (id: string) => {
      setError(null);
      persist(
        decisions.map((d) =>
          d.id === id ? { ...d, status: "rejected" as DecisionStatus } : d,
        ),
      );
    },
    [decisions, persist],
  );

  const clearFinished = useCallback(() => {
    persist(decisions.filter((d) => d.status === "pending"));
  }, [decisions, persist]);

  const reset = useCallback(() => {
    setError(null);
    persist(seedDecisions());
  }, [persist]);

  return (
    <div>
      <h1>決定キュー</h1>
      <p style={{ opacity: 0.8 }}>
        重要な操作は人の承認が必要です。承認はアクション＋パラメータに紐付き、他の操作の権限にはなりません（approved !=
        permission）。
      </p>

      {error && (
        <p role="alert" style={{ color: "#fda4af" }}>
          {error}
        </p>
      )}

      {decisions.length === 0 ? (
        <div style={{ marginTop: 16 }}>
          <p style={{ opacity: 0.6 }}>決定キューは空です。</p>
          <button
            onClick={reset}
            style={{
              background: "#0e7490",
              color: "white",
              padding: "8px 16px",
              borderRadius: 8,
              border: 0,
              cursor: "pointer",
            }}
          >
            初期データに戻す
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
          {decisions.map((d) => (
            <article
              key={d.id}
              style={{ background: "#0f172a", padding: 16, borderRadius: 8 }}
            >
              <h3 style={{ margin: "0 0 8px" }}>{d.id}</h3>
              <p style={{ fontSize: 13, margin: "4px 0" }}>操作: {d.action}</p>
              <p style={{ fontSize: 13, margin: "4px 0" }}>
                パラメータ: {JSON.stringify(d.params)}
              </p>
              <p style={{ fontSize: 13, margin: "4px 0" }}>
                ハッシュ: {d.paramsHash.slice(0, 16)}… / 状態: {statusLabel(d.status)}
              </p>
              {d.status === "pending" ? (
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button
                    onClick={() => approve(d.id)}
                    style={{
                      background: "#15803d",
                      color: "white",
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: 0,
                      cursor: "pointer",
                    }}
                  >
                    承認
                  </button>
                  <button
                    onClick={() => reject(d.id)}
                    style={{
                      background: "#475569",
                      color: "white",
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: 0,
                      cursor: "pointer",
                    }}
                  >
                    却下
                  </button>
                </div>
              ) : (
                <p style={{ fontSize: 13, opacity: 0.7 }}>
                  処理済み（{statusLabel(d.status)}）
                </p>
              )}
            </article>
          ))}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={clearFinished}
              style={{
                background: "transparent",
                color: "#e2e8f0",
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #475569",
                cursor: "pointer",
              }}
            >
              完了済みをクリア
            </button>
            <button
              onClick={reset}
              style={{
                background: "transparent",
                color: "#e2e8f0",
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid #475569",
                cursor: "pointer",
              }}
            >
              リセット
            </button>
          </div>
          <p style={{ fontSize: 12, opacity: 0.6 }}>
            注: この承認は「{decisions[0]?.action}＋当該パラメータ」にのみ有効で、別アクションや別パラメータの実行権限にはなりません。
          </p>
        </div>
      )}
    </div>
  );
}
