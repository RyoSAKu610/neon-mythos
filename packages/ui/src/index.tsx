import type { ReactNode } from "react";

export function Card({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-cyan-400/20 bg-slate-950/70 p-4 shadow">
      {children}
    </div>
  );
}

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-block rounded-full border border-fuchsia-400/30 px-2 py-0.5 text-xs">
      {children}
    </span>
  );
}

export function FlowStep({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="flex gap-3">
      <div className="font-mono text-cyan-300">▸</div>
      <div>
        <div className="font-semibold">{title}</div>
        <div className="text-sm opacity-70">{desc}</div>
      </div>
    </div>
  );
}
