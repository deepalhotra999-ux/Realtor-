import type { AIProvider, CompletionRequest, CompletionResult } from "./types";

/**
 * Development / offline provider. It never generates free-form content — the
 * AI feature layer detects `kind: "deterministic"` and uses rule-based,
 * fact-grounded implementations instead, so the app is fully functional with
 * no model installed and nothing is ever invented.
 */
export class MockAIProvider implements AIProvider {
  readonly name = "mock";
  readonly kind = "deterministic" as const;
  readonly model = "rules-v1";

  async isAvailable() {
    return true;
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const last = [...req.messages].reverse().find((m) => m.role === "user");
    const text = req.json
      ? JSON.stringify({ note: "mock provider: deterministic features handle this request" })
      : `(mock AI) ${last?.content.slice(0, 200) ?? ""}`;
    return { text, model: this.model };
  }

  /** Cheap, deterministic hashed bag-of-words embedding (64 dims) for dev similarity. */
  async embed(texts: string[]): Promise<number[][]> {
    return texts.map((t) => {
      const v = new Array<number>(64).fill(0);
      for (const word of t.toLowerCase().split(/\W+/).filter(Boolean)) {
        let h = 2166136261;
        for (let i = 0; i < word.length; i++) h = Math.imul(h ^ word.charCodeAt(i), 16777619);
        v[Math.abs(h) % 64] += 1;
      }
      const norm = Math.hypot(...v) || 1;
      return v.map((x) => x / norm);
    });
  }
}

/**
 * Chooses Ollama when it is reachable and falls back to the mock otherwise.
 * `resolve()` is what AI features call before each request.
 */
export class AutoAIProvider {
  constructor(
    private readonly primary: AIProvider,
    private readonly fallback: AIProvider,
  ) {}

  async resolve(): Promise<AIProvider> {
    return (await this.primary.isAvailable()) ? this.primary : this.fallback;
  }

  get fallbackProvider() {
    return this.fallback;
  }
}
