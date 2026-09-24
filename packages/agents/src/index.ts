// Agents are NOT fixed core. They register capabilities; orchestration is capability-routed.
// Adding an agent = adding a module here + a Service row, no central rewrite.
import { getProvider } from "@neon/ai-core";

export interface AgentDef {
  id: string;
  capabilityIds: string[];
  role: string;
  instructions: string;
  run(input: unknown): Promise<unknown>;
}

export const scout: AgentDef = {
  id: "scout",
  capabilityIds: ["research.summarize"],
  role: "Collect candidate sources",
  instructions: "Return source list as JSON.",
  async run(input) {
    const p = getProvider();
    const r = await p.generateStructured({
      system: "scout", prompt: String(input ?? ""),
      schemaName: "scout", fallback: { sources: [] },
    });
    return r.data;
  },
};

export const researcher: AgentDef = {
  id: "researcher",
  capabilityIds: ["research.summarize", "strategy.analyze"],
  role: "Independent analysis",
  instructions: "Analyze without seeing other agents first.",
  async run(input) {
    const p = getProvider();
    const r = await p.generateStructured({
      system: "researcher", prompt: String(input ?? ""),
      schemaName: "research", fallback: { claims: [] },
    });
    return r.data;
  },
};

export const verifierAgent: AgentDef = {
  id: "verifier",
  capabilityIds: ["verify.judge"],
  role: "Judge artifact vs contract terms",
  instructions: "Return pass|partial|fail with rubric.",
  async run(input) {
    const p = getProvider();
    const r = await p.generateStructured({
      system: "verifier", prompt: String(input ?? ""),
      schemaName: "verify", fallback: { verdict: "partial", rubric: {} },
    });
    return r.data;
  },
};

export const registry: AgentDef[] = [scout, researcher, verifierAgent];
