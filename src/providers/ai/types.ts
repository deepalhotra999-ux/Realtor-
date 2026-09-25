export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface CompletionRequest {
  messages: ChatMessage[];
  temperature?: number;
  /** Ask the model for a single JSON object. */
  json?: boolean;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface CompletionResult {
  text: string;
  model: string;
}

/**
 * A language-model backend. Implementations: Ollama (local, default) and a
 * deterministic mock. Add OpenAI-compatible, vLLM, llama.cpp or hosted
 * adapters by implementing this interface and registering in providers/index.ts.
 */
export interface AIProvider {
  readonly name: string;
  /**
   * `llm` providers generate free text. `deterministic` providers cannot, so
   * AI features use their rule-based paths instead (and never fabricate).
   */
  readonly kind: "llm" | "deterministic";
  readonly model: string;
  isAvailable(): Promise<boolean>;
  complete(req: CompletionRequest): Promise<CompletionResult>;
  embed?(texts: string[]): Promise<number[][]>;
}

export class AIUnavailableError extends Error {
  constructor(message = "AI provider unavailable") {
    super(message);
    this.name = "AIUnavailableError";
  }
}
