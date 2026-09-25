// Provider abstraction: business logic calls generateStructured(), never a vendor SDK.
export interface GenerateOptions<T> {
  system: string;
  prompt: string;
  schemaName: string;
  fallback: T;
}

export interface ProviderMeta {
  provider: string;
  mock: boolean;
  model?: string;
  latencyMs?: number;
  tokens?: number;
}

export interface AIProvider {
  name: string;
  generateStructured<T>(opts: GenerateOptions<T>): Promise<{ data: T; meta: ProviderMeta }>;
}

export const mockProvider: AIProvider = {
  name: "mock",
  async generateStructured<T>(opts: GenerateOptions<T>) {
    if (process.env["NODE_ENV"] === "production" && process.env["AI_STRICT"] === "1") {
      throw new Error("mock provider refused in strict production (set AI_PROVIDER or unset AI_STRICT)");
    }
    if (process.env["NODE_ENV"] === "production") {
      console.warn("[ai-core] WARNING: mock provider serving fallback in production");
    }
    const started = Date.now();
    return {
      data: opts.fallback,
      meta: { provider: "mock", mock: true, model: "fallback", latencyMs: Date.now() - started },
    };
  },
};

export function getProvider(): AIProvider {
  const name = process.env["AI_PROVIDER"] ?? "mock";
  // Vendor providers (openai/anthropic/…) plug in here without changing callers.
  // Until wired, anything non-mock fails loudly instead of silently returning fallback.
  if (name !== "mock") {
    throw new Error(`AI provider "${name}" not wired yet (see docs/operations/runbook.md)`);
  }
  return mockProvider;
}
