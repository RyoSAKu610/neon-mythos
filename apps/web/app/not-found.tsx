import Link from "next/link";
export default function NotFound() {
  return (
    <div>
      <h1>Not found</h1>
      <p style={{ opacity: 0.8 }}>That route does not exist yet.</p>
      <Link href="/" style={{ color: "#a5f3fc" }}>Back home</Link>
    </div>
  );
}
