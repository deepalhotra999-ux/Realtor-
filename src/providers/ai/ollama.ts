import {
  AIUnavailableError,
  type AIProvider,
  type CompletionRequest,
  type CompletionResult,
} from "./types";

export interface OllamaOptions {
  baseUrl: string;
  model: string;
  embedModel: string;
  timeoutMs: number;
  fetchImpl?: typeof fetch;
}

/** Local open-source models via Ollama (https://ollama.com) — Llama, Qwen, Mistral, … */
export class OllamaProvider implements AIProvider {
  readonly name = "ollama";
  readonly kind = "llm" as const;
  readonly model: string;
  private readonly fetch: typeof fetch;
  private availability: { value: boolean; checkedAt: number } | null = null;

  constructor(private readonly opts: OllamaOptions) {
    this.model = opts.model;
    this.fetch = opts.fetchImpl ?? fetch;
  }

  private url(path: string) {
    return `${this.opts.baseUrl.replace(/\/$/, "")}${path}`;
  }

  /** Cached for 30s so a missing Ollama never slows down page renders. */
  async isAvailable(): Promise<boolean> {
    const now = Date.now();
    if (this.availability && now - this.availability.checkedAt < 30_000)
      return this.availability.value;
    let value = false;
    try {
      const res = await this.fetch(this.url("/api/tags"), { signal: AbortSignal.timeout(1500) });
      if (res.ok) {
        const body = (await res.json()) as { models?: { name: string }[] };
        const wanted = this.model.includes(":") ? this.model : `${this.model}:`;
        value = (body.models ?? []).some((m) => m.name === this.model || m.name.startsWith(wanted));
      }
    } catch {
      value = false;
    }
    this.availability = { value, checkedAt: now };
    return value;
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const signal = req.signal
      ? AbortSignal.any([req.signal, AbortSignal.timeout(this.opts.timeoutMs)])
      : AbortSignal.timeout(this.opts.timeoutMs);
    let res: Response;
    try {
      res = await this.fetch(this.url("/api/chat"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal,
        body: JSON.stringify({
          model: this.model,
          messages: req.messages,
          stream: false,
          ...(req.json ? { format: "json" } : {}),
          options: {
            temperature: req.temperature ?? 0.2,
            ...(req.maxTokens ? { num_predict: req.maxTokens } : {}),
          },
        }),
      });
    } catch (err) {
      this.availability = { value: false, checkedAt: Date.now() };
      throw new AIUnavailableError(`Ollama request failed: ${(err as Error).message}`);
    }
    if (!res.ok) throw new AIUnavailableError(`Ollama returned ${res.status}`);
    const body = (await res.json()) as { message?: { content?: string }; model?: string };
    return { text: body.message?.content ?? "", model: body.model ?? this.model };
  }

  async embed(texts: string[]): Promise<number[][]> {
    const res = await this.fetch(this.url("/api/embed"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      signal: AbortSignal.timeout(this.opts.timeoutMs),
      body: JSON.stringify({ model: this.opts.embedModel, input: texts }),
    });
    if (!res.ok) throw new AIUnavailableError(`Ollama embed returned ${res.status}`);
    const body = (await res.json()) as { embeddings: number[][] };
    return body.embeddings;
  }
}
