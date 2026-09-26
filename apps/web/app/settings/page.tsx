"use client";
import { useEffect, useState } from "react";
import { z } from "zod";

// 信頼できない入力（localStorage）は zod で検証する。
const WORLD_KEY = "neon:world";
const FLAGS_KEY = "neon:flags";

const worldSchema = z.enum(["production", "sim:fast-001"]);
const flagsSchema = z.object({
  "economy-sim": z.boolean(),
  "neon-city": z.boolean(),
});

type WorldId = z.infer<typeof worldSchema>;
type Flags = z.infer<typeof flagsSchema>;

const DEFAULT_FLAGS: Flags = { "economy-sim": true, "neon-city": true };

function readWorld(): WorldId {
  try {
    const parsed = worldSchema.safeParse(localStorage.getItem(WORLD_KEY));
    return parsed.success ? parsed.data : "production";
  } catch {
    return "production";
  }
}

function readFlags(): Flags {
  try {
    const raw = localStorage.getItem(FLAGS_KEY);
    if (raw === null) return DEFAULT_FLAGS;
    const parsed = flagsSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : DEFAULT_FLAGS;
  } catch {
    return DEFAULT_FLAGS;
  }
}

export default function SettingsPage() {
  // 遅延初期化でストレージ値を直接読む（effect 内 setState を避ける）。
  const [world, setWorld] = useState<WorldId>(readWorld);
  const [flags, setFlags] = useState<Flags>(readFlags);
  const [adapter, setAdapter] = useState<string | null>(null);
  const [adapterError, setAdapterError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function loadHealth() {
      try {
        const r = await fetch("/api/health", { headers: { Accept: "application/json" } });
        const j = (await r.json().catch(() => null)) as { env?: string } | null;
        if (cancelled) return;
        if (r.ok && j && typeof j.env === "string") setAdapter(j.env);
        else setAdapterError(`health取得失敗 (status ${r.status})`);
      } catch (e) {
        if (!cancelled) setAdapterError(e instanceof Error ? e.message : "unknown");
      }
    }
    void loadHealth();
    return () => {
      cancelled = true;
    };
  }, []);

  function changeWorld(next: WorldId) {
    setWorld(next);
    try {
      localStorage.setItem(WORLD_KEY, next);
    } catch {
      // storage unavailable: state-only fallback
    }
  }

  function toggleFlag(key: keyof Flags) {
    setFlags((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      try {
        localStorage.setItem(FLAGS_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  }

  const isVirtual = adapter === null || adapter === "virtual";

  return (
    <div>
      <h1>設定</h1>
      <p style={{ opacity: 0.8 }}>表示・接続まわりの設定。台帳そのものは変更しません。</p>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 16 }}>ワールド選択</h2>
        <div role="radiogroup" aria-label="ワールド" style={{ display: "flex", gap: 8 }}>
          {(["production", "sim:fast-001"] as const).map((w) => (
            <button
              key={w}
              role="radio"
              aria-checked={world === w}
              onClick={() => changeWorld(w)}
              style={{
                padding: "6px 14px",
                borderRadius: 8,
                border: "1px solid #164e63",
                background: world === w ? "#0e7490" : "#0f172a",
                color: "white",
                cursor: "pointer",
              }}
            >
              {w}
            </button>
          ))}
        </div>
        <p style={{ fontSize: 13, opacity: 0.7 }}>保存済み: {world}</p>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 16 }}>決済アダプタ</h2>
        {adapterError ? (
          <p role="alert" style={{ color: "#fda4af" }}>
            {adapterError}
          </p>
        ) : adapter === null ? (
          <p>読み込み中…</p>
        ) : (
          <p style={{ fontSize: 14 }}>
            現在: <strong>{adapter}</strong> —{" "}
            {isVirtual
              ? "仮想台帳（実決済なし・x402未使用）"
              : "x402実決済アダプタ（実資金が動きます）"}
          </p>
        )}
      </section>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 16 }}>AIプロバイダ</h2>
        <p style={{ fontSize: 14 }}>
          現在: <strong>mock</strong> — 厳格モード: 本番推論なし・外部送信なし
        </p>
      </section>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 16 }}>機能フラグ</h2>
        {(Object.keys(DEFAULT_FLAGS) as Array<keyof Flags>).map((key) => (
          <label key={key} style={{ display: "flex", gap: 8, alignItems: "center", margin: "6px 0" }}>
            <input type="checkbox" checked={flags[key]} onChange={() => toggleFlag(key)} />
            {key} ({flags[key] ? "有効" : "無効"})
          </label>
        ))}
        <p style={{ fontSize: 13, opacity: 0.7 }}>保存済み: {JSON.stringify(flags)}</p>
      </section>

      <section
        style={{
          marginTop: 16,
          padding: 12,
          border: "1px solid #7f1d1d",
          borderRadius: 8,
          background: "#1c0a0a",
        }}
      >
        <h2 style={{ fontSize: 16, color: "#fca5a5" }}>注意</h2>
        <p style={{ fontSize: 13 }}>
          イベント台帳は追加専用（append-only）です。削除・更新はできません。誤りは新規エントリで修正します。
        </p>
      </section>
    </div>
  );
}
