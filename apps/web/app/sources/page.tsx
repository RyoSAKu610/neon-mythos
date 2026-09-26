"use client";
import { useState } from "react";
import { z } from "zod";

// 信頼できない入力（フォーム値・localStorage）は zod で検証する。
// @neon/contracts と同じ zod バリデーション方針に従う。
const STORAGE_KEY = "neon:sources";

const SOURCE_TYPES = ["公式", "報道", "論文", "ブログ", "その他"] as const;

const sourceInputSchema = z.object({
  title: z.string().trim().min(1, "タイトルは必須です").max(120, "タイトルは120文字以内で入力してください"),
  url: z.string().trim().url("有効なURLを入力してください（例: https://example.com）"),
  type: z.enum(SOURCE_TYPES, "種類を選択してください"),
  credibility: z.coerce
    .number()
    .min(0, "信頼度は0〜100で入力してください")
    .max(100, "信頼度は0〜100で入力してください"),
  notes: z.string().trim().max(500, "メモは500文字以内で入力してください"),
});

const storedSourcesSchema = z.array(
  z.object({
    id: z.string().min(1),
    title: z.string().min(1).max(120),
    url: z.string().url(),
    type: z.enum(SOURCE_TYPES),
    credibility: z.number().min(0).max(100),
    notes: z.string().max(500),
  }),
);

type Source = z.infer<typeof storedSourcesSchema>[number];
type SourceType = (typeof SOURCE_TYPES)[number];

const SEED_SOURCES: Source[] = [
  {
    id: "seed-nist-ai-rmf",
    title: "NIST AI Risk Management Framework",
    url: "https://www.nist.gov/itl/ai-risk-management-framework",
    type: "公式",
    credibility: 95,
    notes: "米国立標準技術研究所のAIリスク管理枠組み。ガバナンス・検証の一次資料。",
  },
  {
    id: "seed-gpt4-system-card",
    title: "GPT-4 System Card",
    url: "https://openai.com/index/gpt-4-system-card/",
    type: "公式",
    credibility: 90,
    notes: "開発元による安全性評価・制限事項の一次資料。主張の裏取りに利用。",
  },
  {
    id: "seed-arxiv-gpt4-report",
    title: "GPT-4 Technical Report",
    url: "https://arxiv.org/abs/2303.08774",
    type: "論文",
    credibility: 75,
    notes: "能力と評価結果をまとめた技術報告。査読前のため一次資料と突き合わせる。",
  },
];

const inputStyle = {
  width: "100%",
  padding: 8,
  borderRadius: 8,
  border: "1px solid #155e75",
  background: "#0f172a",
  color: "#e2e8f0",
} as const;

const buttonStyle = {
  background: "#0e7490",
  color: "white",
  padding: "8px 16px",
  borderRadius: 8,
  border: 0,
  cursor: "pointer",
} as const;

function loadStored(): { sources: Source[] } | { error: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_SOURCES));
      return { sources: SEED_SOURCES };
    }
    const parsed = storedSourcesSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) {
      return { error: "保存データが壊れています。初期データに戻します。" };
    }
    return { sources: parsed.data };
  } catch {
    return { error: "保存データの読み込みに失敗しました。" };
  }
}

interface StoreInit {
  list: Source[];
  storageError: string | null;
  ready: boolean;
}

// strategy-room と同じく、localStorage は useState の遅延初期化で読む
// （レンダー時1回のみ。effect 内 setState を避けて lint 準拠）。
function initStore(): StoreInit {
  if (typeof window === "undefined") return { list: [], storageError: null, ready: false };
  const result = loadStored();
  if ("error" in result) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(SEED_SOURCES));
    } catch {
      /* ストレージ任意 */
    }
    return { list: SEED_SOURCES, storageError: result.error, ready: true };
  }
  return { list: result.sources, storageError: null, ready: true };
}

export default function SourcesPage() {
  const [initial] = useState(initStore);
  const [sources, setSources] = useState<Source[]>(initial.list);
  const [storageError, setStorageError] = useState<string | null>(initial.storageError);
  const [ready] = useState(initial.ready);
  const [formError, setFormError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [type, setType] = useState<SourceType>("公式");
  const [credibility, setCredibility] = useState("70");
  const [notes, setNotes] = useState("");

  function persist(next: Source[]) {
    setSources(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      setStorageError("保存に失敗しました（ブラウザのストレージを確認してください）。");
    }
  }

  function handleAdd() {
    setFormError(null);
    const parsed = sourceInputSchema.safeParse({ title, url, type, credibility, notes });
    if (!parsed.success) {
      setFormError(parsed.error.issues.map((i) => i.message).join(" / "));
      return;
    }
    const next: Source[] = [
      ...sources,
      {
        id: `src_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
        title: parsed.data.title,
        url: parsed.data.url,
        type: parsed.data.type,
        credibility: parsed.data.credibility,
        notes: parsed.data.notes,
      },
    ];
    persist(next);
    setTitle("");
    setUrl("");
    setType("公式");
    setCredibility("70");
    setNotes("");
  }

  function handleDelete(id: string) {
    persist(sources.filter((s) => s.id !== id));
  }

  function handleAdjust(id: string, delta: number) {
    persist(
      sources.map((s) =>
        s.id === id ? { ...s, credibility: Math.min(100, Math.max(0, s.credibility + delta)) } : s,
      ),
    );
  }

  if (!ready) {
    return (
      <div>
        <h1>ソース管理 — Sources</h1>
        <p>読み込み中…</p>
      </div>
    );
  }

  return (
    <div>
      <h1>ソース管理 — Sources</h1>
      <p style={{ opacity: 0.8 }}>
        調査の根拠となる情報源を登録・管理します。ブラウザのlocalStorage（キー neon:sources）に保存されます。
      </p>
      {storageError && (
        <p role="alert" style={{ color: "#fda4af" }}>
          {storageError}
        </p>
      )}

      <section aria-label="ソース追加フォーム">
        <h2>ソースを追加</h2>
        <div style={{ display: "grid", gap: 12, maxWidth: 560 }}>
          <label htmlFor="source-title">
            タイトル
            <input
              id="source-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="例: 総務省 AI事業者ガイドライン"
              style={inputStyle}
            />
          </label>
          <label htmlFor="source-url">
            URL
            <input
              id="source-url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              inputMode="url"
              placeholder="https://example.com/article"
              style={inputStyle}
            />
          </label>
          <label htmlFor="source-type">
            種類
            <select
              id="source-type"
              value={type}
              onChange={(e) => setType(e.target.value as SourceType)}
              style={inputStyle}
            >
              {SOURCE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label htmlFor="source-credibility">
            信頼度（0〜100）
            <input
              id="source-credibility"
              type="number"
              min={0}
              max={100}
              value={credibility}
              onChange={(e) => setCredibility(e.target.value)}
              style={inputStyle}
            />
          </label>
          <label htmlFor="source-notes">
            メモ
            <textarea
              id="source-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={500}
              placeholder="この情報源の位置づけ・注意点"
              style={inputStyle}
            />
          </label>
          <button type="button" onClick={handleAdd} aria-label="ソースを追加" style={buttonStyle}>
            追加
          </button>
        </div>
        {formError && (
          <p role="alert" style={{ color: "#fda4af" }}>
            {formError}
          </p>
        )}
      </section>

      <section aria-label="登録ソース一覧" style={{ marginTop: 24 }}>
        <h2>登録ソース ({sources.length})</h2>
        {sources.length === 0 ? (
          <p>ソースがありません。上のフォームから最初のソースを追加してください。</p>
        ) : (
          <ul style={{ listStyle: "none", padding: 0, display: "grid", gap: 12 }}>
            {sources.map((s) => (
              <li
                key={s.id}
                style={{ background: "#0f172a", padding: 16, borderRadius: 8, border: "1px solid #155e75" }}
              >
                <article aria-label={`ソース: ${s.title}`}>
                  <p style={{ margin: "0 0 4px", fontWeight: "bold" }}>{s.title}</p>
                  <p style={{ margin: "4px 0", fontSize: 13 }}>
                    <a href={s.url} target="_blank" rel="noreferrer" style={{ color: "#a5f3fc", wordBreak: "break-all" }}>
                      {s.url}
                    </a>
                  </p>
                  <p style={{ margin: "4px 0", fontSize: 13, opacity: 0.85 }}>
                    種類: {s.type} · 信頼度: {s.credibility}
                  </p>
                  {s.notes && <p style={{ margin: "4px 0", fontSize: 13, opacity: 0.8 }}>{s.notes}</p>}
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <button
                      type="button"
                      onClick={() => handleAdjust(s.id, 5)}
                      aria-label={`信頼度を上げる: ${s.title}`}
                      style={{ ...buttonStyle, padding: "4px 12px" }}
                    >
                      +5
                    </button>
                    <button
                      type="button"
                      onClick={() => handleAdjust(s.id, -5)}
                      aria-label={`信頼度を下げる: ${s.title}`}
                      style={{ ...buttonStyle, padding: "4px 12px" }}
                    >
                      −5
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s.id)}
                      aria-label={`削除: ${s.title}`}
                      style={{ ...buttonStyle, padding: "4px 12px", background: "#9f1239" }}
                    >
                      削除
                    </button>
                  </div>
                </article>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
