// Provider abstraction: business logic calls generateStructured(), never a vendor SDK.
export interface GenerateOptions<T> {
  system: string;
  prompt: string;
  schemaName: string;
  fallback: T;
}

export interface AIProvider {
  name: string;
  generateStructured<T>(opts: GenerateOptions<T>): Promise<{ data: T; meta: { provider: string; mock: boolean } }>;
}

export const mockProvider: AIProvider = {
  name: "mock",
  async generateStructured<T>(opts: GenerateOptions<T>) {
    return { data: opts.fallback, meta: { provider: "mock", mock: true } };
  },
};

export function getProvider(): AIProvider {
  return mockProvider; // OPENAI/Anthropic wired via env in Stage 2 without changing callers.
}
