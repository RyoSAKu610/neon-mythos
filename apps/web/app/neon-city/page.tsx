"use client";
import { useEffect, useState } from "react";

export interface FeedEvent {
  seq: number;
  worldId: string;
  type: string;
  entityId: string;
  at: string;
}

export interface CityNode {
  id: string;
  label: string;
  district: string;
  x: number;
  y: number;
}

export interface CityLink {
  id: string;
  source: string;
  target: string;
  label: string;
  kind: "contract" | "ledger";
}

const BASE_NODES: CityNode[] = [
  { id: "agent_A", label: "エージェントA", district: "市場", x: 110, y: 150 },
  { id: "agent_B", label: "エージェントB", district: "研究所", x: 330, y: 130 },
  { id: "verifier", label: "検証者", district: "評議会", x: 540, y: 150 },
  { id: "treasury", label: "国庫", district: "市場", x: 110, y: 300 },
];

/** Deterministic position for unknown entities (hash → grid cell). */
function positionFor(id: string): { x: number; y: number } {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return { x: 60 + (h % 520), y: 90 + ((h >> 4) % 220) };
}

/** Pure mapping: events → nodes/links. Renders with zero events (base grid, no links). */
export function buildCityGraph(events: FeedEvent[]): { nodes: CityNode[]; links: CityLink[] } {
  const nodes: CityNode[] = [...BASE_NODES];
  const known = new Set(nodes.map((n) => n.id));
  for (const e of events) {
    const key = shortId(e.entityId);
    if (!known.has(key) && !known.has(e.entityId)) {
      // Unknown entity → deterministic node so the map stays stable.
      const pos = positionFor(e.entityId);
      nodes.push({ id: e.entityId, label: e.entityId.slice(0, 18), district: "市場", x: pos.x, y: pos.y });
      known.add(e.entityId);
    }
  }
  const links: CityLink[] = [];
  for (const e of events) {
    if (e.type.startsWith("contract.")) {
      links.push({
        id: `link-${e.seq}`,
        source: "agent_A",
        target: "agent_B",
        label: `${e.type} (${e.worldId})`,
        kind: "contract",
      });
    } else if (e.type.startsWith("ledger.")) {
      const isFunding = e.type === "ledger.funded";
      links.push({
        id: `link-${e.seq}`,
        source: isFunding ? "treasury" : "agent_A",
        target: isFunding ? "agent_A" : "agent_B",
        label: `${e.type} (${e.worldId})`,
        kind: "ledger",
      });
    }
  }
  return { nodes, links };
}

function shortId(entityId: string): string {
  return entityId.includes(":") ? (entityId.split(":").pop() ?? entityId) : entityId;
}

function nodeById(nodes: CityNode[], id: string): CityNode | undefined {
  return nodes.find((n) => n.id === id);
}

const DISTRICTS = [
  { label: "市場", x: 10, w: 200, color: "#0e7490" },
  { label: "研究所", x: 220, w: 210, color: "#6d28d9" },
  { label: "評議会", x: 440, w: 200, color: "#0f766e" },
];

export default function NeonCityPage() {
  const [events, setEvents] = useState<FeedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
  }, []);

  const { nodes, links } = buildCityGraph(events);

  return (
    <div>
      <h1>ネオンシティ — 都市マップ</h1>
      <p style={{ opacity: 0.8 }}>
        読み取り専用・ビジネスロジックなし。World + Event Ledger の可視化のみ。
      </p>
      {loading && <p>読み込み中…</p>}
      {error && (
        <p role="alert" style={{ color: "#fda4af" }}>
          {error}
        </p>
      )}
      {!loading && !error && events.length === 0 && (
        <p>イベントがありません — 空のグリッドを表示しています。</p>
      )}
      {!loading && !error && events.length > 0 && (
        <p style={{ fontSize: 13, opacity: 0.7 }}>{events.length}件のイベントを可視化中</p>
      )}
      <svg
        data-testid="city-svg"
        viewBox="0 0 650 380"
        width="100%"
        role="img"
        aria-label="ネオンシティ地図"
        style={{ background: "#0b1120", borderRadius: 12, border: "1px solid #164e63" }}
      >
        {DISTRICTS.map((d) => (
          <g key={d.label}>
            <rect
              x={d.x}
              y={20}
              width={d.w}
              height={340}
              rx={10}
              fill="none"
              stroke={d.color}
              strokeDasharray="6 4"
              opacity={0.8}
            />
            <text x={d.x + 12} y={48} fill={d.color} fontSize={16} fontWeight="bold">
              {d.label}
            </text>
          </g>
        ))}
        {links.map((l) => {
          const s = nodeById(nodes, l.source);
          const t = nodeById(nodes, l.target);
          if (!s || !t) return null;
          const color = l.kind === "contract" ? "#22d3ee" : "#fbbf24";
          return (
            <g key={l.id} data-testid="city-link">
              <line
                x1={s.x}
                y1={s.y}
                x2={t.x}
                y2={t.y}
                stroke={color}
                strokeWidth={1.5}
                strokeDasharray="5 4"
                opacity={0.75}
              >
                <animate attributeName="stroke-dashoffset" from="0" to="18" dur="1.2s" repeatCount="indefinite" />
              </line>
              <title>{l.label}</title>
            </g>
          );
        })}
        {nodes.map((n) => (
          <g key={n.id} data-testid="city-node">
            <circle cx={n.x} cy={n.y} r={14} fill="#0f172a" stroke="#22d3ee" strokeWidth={2} />
            <circle cx={n.x} cy={n.y} r={4} fill="#22d3ee" />
            <text x={n.x} y={n.y + 30} fill="#e2e8f0" fontSize={12} textAnchor="middle">
              {n.label}
            </text>
            <title>{`${n.label} (${n.district})`}</title>
          </g>
        ))}
      </svg>
      <p style={{ fontSize: 12, opacity: 0.6 }}>
        ノード=エージェント / リンク=contract・ledgerイベント。データ源: /api/activity/feed。
      </p>
    </div>
  );
}
