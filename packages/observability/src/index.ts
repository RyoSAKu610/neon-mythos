const SECRET_KEY = /(password|passwd|pwd|token|secret|api[_-]?key|auth|cookie|session|service[_-]?role|private[_-]?key|access[_-]?key)/i;
const MAX_VALUE_CHARS = 4096;

function scrub(value: unknown, seen: Set<object>): unknown {
  if (value === null || value === undefined) return value;
  const t = typeof value;
  if (t === "string") {
    const s = value as string;
    return s.length > MAX_VALUE_CHARS ? `${s.slice(0, MAX_VALUE_CHARS)}…[truncated]` : s;
  }
  if (t === "number" || t === "boolean") return value;
  if (t !== "object") return "[redacted:non-serializable]";
  if (seen.has(value as object)) return "[circular]";
  seen.add(value as object);
  if (Array.isArray(value)) return (value as unknown[]).map((x) => scrub(x, seen));
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = SECRET_KEY.test(k) ? "[redacted]" : scrub(v, seen);
  }
  return out;
}

export function correlationId(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  const id = g.crypto?.randomUUID
    ? g.crypto.randomUUID().replace(/-/g, "").slice(0, 12)
    : Math.floor(Math.random() * 0xffffffff).toString(36);
  return `corr_${id}`;
}

export function logEvent(type: string, fields: Record<string, unknown> = {}): void {
  console.log(
    JSON.stringify({ ts: new Date().toISOString(), type, ...(scrub(fields, new Set()) as object) }),
  );
}
