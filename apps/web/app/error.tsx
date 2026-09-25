"use client";
export default function ErrorBoundary({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div>
      <h1>Something broke</h1>
      <p style={{ opacity: 0.8 }}>{error.message}</p>
      <button onClick={reset} style={{ background: "#0e7490", color: "white", padding: "8px 16px", borderRadius: 8, border: 0 }}>
        Retry
      </button>
    </div>
  );
}
