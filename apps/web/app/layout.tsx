import Link from "next/link";

export const metadata = {
  title: "Neon Mythos",
  description: "Collective-intelligence OS with an economic core",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const links: Array<[string, string]> = [
    ["Home", "/"],
    ["Economy", "/economy"],
    ["Missions", "/missions"],
    ["Strategy", "/strategy-room"],
    ["Agents", "/agents"],
    ["Sources", "/sources"],
    ["Intel", "/intelligence"],
    ["Decisions", "/decisions"],
    ["Plans", "/plans"],
    ["Sims", "/simulations"],
    ["Neon City", "/neon-city"],
    ["Activity", "/activity"],
    ["Settings", "/settings"],
  ];
  return (
    <html lang="en">
      <body style={{ background: "#05070f", color: "#e2e8f0", fontFamily: "system-ui", margin: 0 }}>
        <header style={{ borderBottom: "1px solid #164e63", padding: "12px 20px", display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <strong style={{ color: "#22d3ee" }}>Neon Mythos</strong>
          <span style={{ fontSize: 12, opacity: 0.7 }}>vertical economy first · virtual ledger</span>
          <nav style={{ display: "flex", gap: 12, marginLeft: 16, flexWrap: "wrap" }}>
            {links.map(([label, href]) => (
              <Link key={href} href={href} style={{ color: "#a5f3fc", fontSize: 13 }}>{label}</Link>
            ))}
          </nav>
        </header>
        <main style={{ padding: 24, maxWidth: 960 }}>{children}</main>
      </body>
    </html>
  );
}
