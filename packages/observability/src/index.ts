export function correlationId(): string {
  return `corr_${Math.random().toString(36).slice(2, 10)}`;
}

export function logEvent(type: string, fields: Record<string, unknown> = {}): void {
  const safe = { ...fields };
  for (const k of ["password", "token", "secret", "serviceRole"]) delete safe[k];
  console.log(JSON.stringify({ ts: new Date().toISOString(), type, ...safe }));
}
