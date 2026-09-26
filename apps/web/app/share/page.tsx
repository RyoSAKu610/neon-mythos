"use client";
import { useMemo, useState } from "react";
import QRCode from "qrcode";
import { encodeIntent } from "@neon/contracts";

const KINDS = [
  ["mission_investigation", "戦略調査 (Ask→…→Learn)"],
  ["service_hire", "単発発注"],
  ["custom", "カスタム"],
] as const;

export default function SharePage() {
  const [title, setTitle] = useState("競合の新機能を調査せよ");
  const [brief, setBrief] = useState("直近3か月の競合リリースを集め、脅威度順に3点へ圧縮せよ");
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>("mission_investigation");
  const [price, setPrice] = useState(100);
  const [qr, setQr] = useState<string | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const valid = useMemo(
    () => title.trim().length > 0 && brief.trim().length > 0 && brief.length <= 600 && price >= 1,
    [title, brief, price],
  );

  async function make() {
    setError(null);
    try {
      const m = encodeIntent({ v: 1, t: title.trim(), b: brief.trim(), k: kind, p: price });
      const origin = window.location.origin;
      const url = `${origin}/s?m=${m}`;
      setLink(url);
      setQr(await QRCode.toDataURL(url, { width: 280, margin: 2 }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "encode failed");
      setQr(null);
      setLink(null);
    }
  }

  const input = (v: string, f: (x: string) => void) => ({
    value: v,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => f(e.target.value),
    style: { width: "100%", padding: 8, borderRadius: 8, border: "1px solid #155e75", background: "#0f172a", color: "#e2e8f0" },
  });

  return (
    <div>
      <h1>QR指令 — アイデアをAgentへ</h1>
      <p style={{ opacity: 0.8 }}>入力 → QR生成 → スマホでスキャン → 確認タップで実行。全て縦フローに記録される。</p>
      <div style={{ display: "grid", gap: 12, maxWidth: 560 }}>
        <label>タイトル<input {...input(title, setTitle)} /></label>
        <label>指示文 (600字以内)<textarea {...input(brief, setBrief)} rows={4} /></label>
        <label>種別
          <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)} style={{ width: "100%", padding: 8, borderRadius: 8, background: "#0f172a", color: "#e2e8f0" }}>
            {KINDS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </label>
        <label>予算 (credits)<input type="number" min={1} value={price} onChange={(e) => setPrice(Number(e.target.value))} style={{ width: "100%", padding: 8, borderRadius: 8, background: "#0f172a", color: "#e2e8f0" }} /></label>
        <button onClick={make} disabled={!valid} style={{ background: "#0e7490", color: "white", padding: "10px 18px", borderRadius: 8, border: 0, cursor: "pointer" }}>
          QRを生成
        </button>
      </div>
      {error && <p role="alert" style={{ color: "#fda4af" }}>{error}</p>}
      {qr && link && (
        <div style={{ marginTop: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="intent QR" width={280} height={280} />
          <p style={{ fontSize: 12, wordBreak: "break-all", opacity: 0.7 }}>{link}</p>
          <p><a href={link} style={{ color: "#f0abfc" }}>この端末で開く →</a></p>
        </div>
      )}
    </div>
  );
}
