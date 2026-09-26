"use client";
import { useState } from "react";

interface LastIntent {
  title: string;
  at: string;
  corr: string;
  contract: string;
  events: { type: string; at: string }[];
}

export default function Page() {
  const [last, setLast] = useState<LastIntent | null>(() => {
    try {
      if (typeof window === "undefined") return null;
      const raw = localStorage.getItem("neon:last-intent");
      return raw ? (JSON.parse(raw) as LastIntent) : null;
    } catch {
      return null;
    }
  });
  return (
    <div>
      <h1>Strategy Room</h1>
      <p style={{ opacity: 0.8 }}>
        QR指令の実行結果をここで管理する。Ask→Research→Debate→Falsify→
        Synthesize→Decide→Plan→Execute→Learn の各stageは /s の実行画面に表示され、
        台帳・評価は縦フローに記録される。
      </p>
      <p><a href="/share" style={{ color: "#f0abfc" }}>QR指令を作る → /share</a></p>
      {last ? (
        <div style={{ background: "#0f172a", padding: 16, borderRadius: 8, marginTop: 12 }}>
          <p><strong>最新の指令:</strong> {last.title}</p>
          <p style={{ fontSize: 13, opacity: 0.7 }}>実行 {last.at} · corr={last.corr} · 契約 {last.contract}</p>
          <p style={{ fontSize: 13 }}>イベント {last.events.length}件: {last.events.map((e) => e.type).join(" → ")}</p>
        </div>
      ) : (
        <p style={{ opacity: 0.6 }}>まだ実行履歴がこの端末にない。/share でQRを作ってスキャンしてほしい。</p>
      )}
    </div>
  );
}
