"use client";
import { useState } from "react";

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

interface StoredIntent {
  title: string;
  at: string;
  corr: string;
  contract: string;
  events: { type: string; at: string }[];
}

export default function PlansPage() {
  const [last] = useState<StoredIntent | null>(() => {
    try {
      if (typeof window === "undefined") return null;
      const raw = localStorage.getItem("neon:last-intent");
      return raw ? (JSON.parse(raw) as StoredIntent) : null;
    } catch {
      return null;
    }
  });
  const done = new Set(last?.events.map((e) => e.type) ?? []);

  return (
    <div>
      <h1>プラン追跡</h1>
      {!last ? (
        <div>
          <p style={{ opacity: 0.8 }}>
            この端末にはまだ実行履歴がない。/s
            の実行で記録される。まず /share でQR指令を作って実行してほしい。
          </p>
          <p>
            <a href="/share" style={{ color: "#f0abfc" }}>
              /share でQR指令を作る →
            </a>
          </p>
        </div>
      ) : (
        <div>
          <div style={{ background: "#0f172a", padding: 16, borderRadius: 8 }}>
            <p>
              <strong>{last.title}</strong>
            </p>
            <p style={{ fontSize: 13, opacity: 0.7 }}>
              契約 {last.contract} · corr={last.corr} · 実行 {last.at}
            </p>
          </div>
          <ol style={{ marginTop: 12 }}>
            {STAGES.map((s) => {
              const hit = s.events.filter((e) => done.has(e));
              const isDone = hit.length > 0;
              return (
                <li key={s.name} style={{ margin: "6px 0", opacity: isDone ? 1 : 0.45 }}>
                  {isDone ? "✓" : "·"} <strong>{s.name}</strong>{" "}
                  <span style={{ fontSize: 12, opacity: 0.7 }}>{hit.join(", ")}</span>
                </li>
              );
            })}
          </ol>
          <p>
            <a href="/strategy-room" style={{ color: "#f0abfc" }}>
              /strategy-room で全体を見る →
            </a>
          </p>
        </div>
      )}

      <hr style={{ margin: "24px 0", borderColor: "#1e293b" }} />
      <section>
        <h2>プランの型（参考テンプレート）</h2>
        <p style={{ opacity: 0.8 }}>
          実行履歴がなくても使える雛形。目的・段階・終了条件の3点で書く。
        </p>
        <h3>目的 (objective)</h3>
        <p style={{ opacity: 0.85 }}>
          例: 直近3か月の競合リリースを集め、脅威度順に3点へ圧縮する。
        </p>
        <h3>段階 (stages)</h3>
        <p style={{ opacity: 0.85 }}>
          Ask → Research → Debate → Falsify → Synthesize → Decide → Plan →
          Execute → Learn の9段階で進める。各段階は対応するドメインイベントで完了判定する。
        </p>
        <h3>終了条件 (exit criteria)</h3>
        <ul>
          <li>契約が settled（または fail 時は disputed として明示）</li>
          <li>台帳に支払いが記録される（pass=全額 / partial=半額 / fail=ゼロ）</li>
          <li>評価が更新される（pass=+3 / partial=+1 / fail=−5）</li>
        </ul>
      </section>
    </div>
  );
}
