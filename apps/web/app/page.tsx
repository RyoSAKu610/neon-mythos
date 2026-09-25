import Link from "next/link";
export default function Home() {
  const steps = [
    ["Principal", "human / agent / org. Owns budget and reputation."],
    ["Capability", "discoverable skill in registry (A2A Agent Card compatible)."],
    ["Service", "priced offer backed by a capability."],
    ["Request", "demand with budget. Mission is one request kind."],
    ["Contract", "request + service match with terms. draft→offered→agreed→active→fulfilled→settled."],
    ["Task", "durable executable unit under contract (A2A Task compatible)."],
    ["Artifact", "task output with hash + provenance (A2A Artifact compatible)."],
    ["Verification", "pass/partial/fail vs terms. Drives task outcome."],
    ["Ledger", "append-only virtual credits. Settlement Adapter swaps to x402 later."],
    ["Reputation", "derived from verifications. Changes next behavior."],
    ["World / Event Ledger", "production vs simulation partitions; every transition is an event."],
  ];
  return (
    <div>
      <h1>Neon Mythos — economic subjects, not a swarm</h1>
      <p style={{ opacity: 0.8 }}>
        The most important build is one vertical flow. 10 → 10,000 agents stay legible
        because every job moves through the same pipeline below.
      </p>
      <ol>
        {steps.map(([t, d]) => (
          <li key={t} style={{ margin: "8px 0" }}>
            <strong style={{ color: "#22d3ee" }}>{t}</strong> → {d}
          </li>
        ))}
      </ol>
      <p>
        <Link href="/economy" style={{ color: "#f0abfc" }}>Open the live vertical demo → /economy</Link>
      </p>
      <p style={{ fontSize: 13, opacity: 0.7 }}>
        Downgraded by design: fixed 8-agent core, Mission-as-parent, Solana/x402-as-economy,
        Neon City business logic. New core: Principal, Capability Registry, Contract, Artifact,
        Ledger, Reputation, World, Event Ledger.
      </p>
    </div>
  );
}
