export default function RootLayout({ children }: { children: React.ReactNode }) {
  const links = [
    ["Home", "/"],
    ["Economy", "/economy"],
    ["Missions", "/missions"],
    ["Neon City", "/neon-city"],
    ["Activity", "/activity"],
  ];
  return (
    <html lang="en">
      <body style={{ background: "#05070f", color: "#e2e8f0", fontFamily: "system-ui", margin: 0 }}>
        <header style={{ borderBottom: "1px solid #164e63", padding: "12px 20px", display: "flex", gap: 16, alignItems: "center" }}>
          <strong style={{ color: "#22d3ee" }}>Neon Mythos</strong>
          <span style={{ fontSize: 12, opacity: 0.7 }}>vertical economy first · virtual ledger</span>
          <nav style={{ display: "flex", gap: 12, marginLeft: 16 }}>
            {links.map(([label, href]) => (
              <a key={href} href={href} style={{ color: "#a5f3fc", fontSize: 14 }}>{label}</a>
            ))}
          </nav>
        </header>
        <main style={{ padding: 24, maxWidth: 960 }}>{children}</main>
      </body>
    </html>
  );
}
