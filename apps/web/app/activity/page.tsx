"use client";
import { useEffect, useState } from "react";

interface FeedEvent {
  seq: number;
  worldId: string;
  type: string;
  entityId: string;
  at: string;
}

type WorldFilter = "all" | "production" | "sim:fast-001";

const FILTERS: Array<{ id: WorldFilter; label: string }> = [
  { id: "all", label: "すべて" },
  { id: "production", label: "production" },
  { id: "sim:fast-001", label: "sim:fast-001" },
];

export default function ActivityPage() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<WorldFilter>("all");
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch("/api/activity/feed", { headers: { Accept: "application/json" } });
        const j = (await r.json().catch(() => null)) as { events?: FeedEvent[] } | null;
        if (cancelled) return;
        if (!r.ok || !j || !Array.isArray(j.events)) {
          setError(`読み込み失敗 (status ${r.status})`);
          return;
        }
        setEvents(j.events);
      } catch (e) {
        if (!cancelled) setError(`通信エラー: ${e instanceof Error ? e.message : "unknown"}`);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [tick]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => setTick((t) => t + 1), 5000);
    return () => clearInterval(id);
  }, [autoRefresh]);

  const filtered = filter === "all" ? events : events.filter((e) => e.worldId === filter);

  return (
    <div>
      <h1>アクティビティ — イベント台帳</h1>
      <p style={{ opacity: 0.8 }}>
        契約・タスク・成果物・台帳・評価の変更はすべてイベント化されます。読み取り専用ビューです。
      </p>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", margin: "12px 0" }}>
        {FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            aria-pressed={filter === f.id}
            style={{
              padding: "6px 14px",
              borderRadius: 8,
              border: "1px solid #164e63",
              background: filter === f.id ? "#0e7490" : "#0f172a",
              color: "white",
              cursor: "pointer",
            }}
          >
            {f.label}
          </button>
        ))}
        <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
          />
          自動更新（5秒）
        </label>
        <button
          onClick={() => setTick((t) => t + 1)}
          style={{
            padding: "6px 14px",
            borderRadius: 8,
            border: "1px solid #164e63",
            background: "#1e293b",
            color: "white",
            cursor: "pointer",
          }}
        >
          更新
        </button>
      </div>
      {loading && <p>読み込み中…</p>}
      {error && (
        <p role="alert" style={{ color: "#fda4af" }}>
          {error}
        </p>
      )}
      {!loading && !error && filtered.length === 0 && <p>イベントがありません。</p>}
      {!loading && !error && filtered.length > 0 && (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
          <thead>
            <tr style={{ textAlign: "left", borderBottom: "1px solid #164e63" }}>
              <th style={{ padding: 6 }}>seq</th>
              <th style={{ padding: 6 }}>world</th>
              <th style={{ padding: 6 }}>type</th>
              <th style={{ padding: 6 }}>entity</th>
              <th style={{ padding: 6 }}>time</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((e) => (
              <tr key={e.seq} style={{ borderBottom: "1px solid #0f172a" }}>
                <td style={{ padding: 6 }}>{e.seq}</td>
                <td style={{ padding: 6 }}>{e.worldId}</td>
                <td style={{ padding: 6 }}>{e.type}</td>
                <td style={{ padding: 6, wordBreak: "break-all" }}>{e.entityId}</td>
                <td style={{ padding: 6 }}>{e.at}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
