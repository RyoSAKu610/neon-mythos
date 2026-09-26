import { Suspense } from "react";
import { registry } from "@neon/agents";

export const metadata = {
  title: "エージェント登録 | Neon Mythos",
  description: "ケーパビリティ登録制のエージェント一覧とA2A Agent Cardプレビュー",
};

function toAgentCard(agent: (typeof registry)[number]) {
  // 表示専用の導出値。取得や登録のAPI呼び出しは行わない。
  return {
    name: agent.id,
    url: `/api/agents/${agent.id}`,
    version: "1.0.0",
    description: agent.role,
    capabilities: agent.capabilityIds,
  };
}

function RegistryList() {
  if (registry.length === 0) {
    return <p>登録されたエージェントがありません。新しいモジュールを追加して再読み込みしてください。</p>;
  }

  const capabilityMap = new Map<string, string[]>();
  for (const agent of registry) {
    for (const capabilityId of agent.capabilityIds) {
      capabilityMap.set(capabilityId, [...(capabilityMap.get(capabilityId) ?? []), agent.id]);
    }
  }
  const capabilities = [...capabilityMap.entries()].sort(([a], [b]) => a.localeCompare(b));

  return (
    <div>
      <section aria-label="ケーパビリティ対応表">
        <h2>ケーパビリティ対応表</h2>
        <ul>
          {capabilities.map(([capabilityId, agentIds]) => (
            <li key={capabilityId}>
              <code>{capabilityId}</code> → {agentIds.join(", ")}
            </li>
          ))}
        </ul>
      </section>
      <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 16 }}>
        {registry.map((agent) => (
          <li
            key={agent.id}
            style={{ background: "#0f172a", padding: 16, borderRadius: 8, border: "1px solid #155e75" }}
          >
            <article aria-label={`エージェント: ${agent.id}`}>
              <h2 style={{ margin: "0 0 4px" }}>{agent.id}</h2>
              <p style={{ margin: "4px 0" }}>役割: {agent.role}</p>
              <p style={{ margin: "4px 0" }}>対応ケーパビリティ: {agent.capabilityIds.join(", ")}</p>
              <p style={{ margin: "4px 0", opacity: 0.85 }}>指示: {agent.instructions}</p>
              <h3 style={{ margin: "12px 0 4px", fontSize: 14 }}>A2A Agent Card（表示専用プレビュー）</h3>
              <pre
                aria-label={`A2A Agent Card: ${agent.id}`}
                style={{ background: "#020617", padding: 12, borderRadius: 8, overflow: "auto", fontSize: 12 }}
              >
                {JSON.stringify(toAgentCard(agent), null, 2)}
              </pre>
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function AgentsPage() {
  return (
    <div>
      <h1>エージェント登録 — Agent Registry</h1>
      <p style={{ opacity: 0.8 }}>
        エージェントは固定の中核ではありません。各エージェントがケーパビリティを登録し、
        オーケストレーションはケーパビリティ指定で振り分けられます。
      </p>
      <section aria-label="追加方法の説明">
        <h2>追加方法</h2>
        <p style={{ opacity: 0.85 }}>
          新しいエージェントの追加 = レジストリへの新モジュール + Service
          行の追加です。中央の書き換えは不要で、機能は増えても結合は増えません。
        </p>
      </section>
      <section aria-label="登録エージェント一覧">
        <h2>登録エージェント ({registry.length})</h2>
        <Suspense fallback={<p>読み込み中…</p>}>
          <RegistryList />
        </Suspense>
      </section>
    </div>
  );
}
