import { describe, expect, it, vi } from "vitest";
import { OllamaProvider } from "./ollama";
import { AutoAIProvider, MockAIProvider } from "./mock";
import { AIUnavailableError } from "./types";

const opts = {
  baseUrl: "http://ollama:11434",
  model: "llama3.2",
  embedModel: "nomic",
  timeoutMs: 1000,
};

describe("OllamaProvider", () => {
  it("detects availability from /api/tags including the model", async () => {
    const fetchImpl = vi.fn(async () => Response.json({ models: [{ name: "llama3.2:latest" }] }));
    expect(await new OllamaProvider({ ...opts, fetchImpl }).isAvailable()).toBe(true);
    const missing = vi.fn(async () => Response.json({ models: [{ name: "qwen2.5:7b" }] }));
    expect(await new OllamaProvider({ ...opts, fetchImpl: missing }).isAvailable()).toBe(false);
    const down = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    expect(await new OllamaProvider({ ...opts, fetchImpl: down }).isAvailable()).toBe(false);
  });

  it("sends chat requests and surfaces failures as AIUnavailableError", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect(body).toMatchObject({ model: "llama3.2", stream: false, format: "json" });
      return Response.json({ message: { content: '{"ok":true}' }, model: "llama3.2" });
    });
    const p = new OllamaProvider({ ...opts, fetchImpl: fetchImpl as typeof fetch });
    const res = await p.complete({ messages: [{ role: "user", content: "hi" }], json: true });
    expect(res.text).toBe('{"ok":true}');
    const failing = new OllamaProvider({
      ...opts,
      fetchImpl: (async () => new Response("", { status: 500 })) as typeof fetch,
    });
    await expect(failing.complete({ messages: [] })).rejects.toBeInstanceOf(AIUnavailableError);
  });

  it("auto provider falls back to the mock when Ollama is down", async () => {
    const down = new OllamaProvider({
      ...opts,
      fetchImpl: (async () => {
        throw new Error("down");
      }) as typeof fetch,
    });
    const auto = new AutoAIProvider(down, new MockAIProvider());
    expect((await auto.resolve()).name).toBe("mock");
  });
});
