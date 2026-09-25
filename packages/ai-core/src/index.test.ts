import { describe, expect, it, vi, afterEach } from "vitest";
import { getProvider, mockProvider } from "./index";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("mockProvider", () => {
  it("returns the fallback with mock meta", async () => {
    const r = await mockProvider.generateStructured({
      system: "s",
      prompt: "p",
      schemaName: "x",
      fallback: { ok: true },
    });
    expect(r.data).toEqual({ ok: true });
    expect(r.meta.provider).toBe("mock");
    expect(r.meta.mock).toBe(true);
  });

  it("refuses in strict production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AI_STRICT", "1");
    await expect(
      mockProvider.generateStructured({ system: "s", prompt: "p", schemaName: "x", fallback: 1 }),
    ).rejects.toThrow(/strict production/);
  });
});

describe("getProvider", () => {
  it("returns mock by default and fails loudly for unwired vendors", () => {
    delete process.env["AI_PROVIDER"];
    expect(getProvider().name).toBe("mock");
    vi.stubEnv("AI_PROVIDER", "openai");
    expect(() => getProvider()).toThrow(/not wired yet/);
  });
});
