# AI

All AI runs on **local, open-source models via Ollama** by default (Llama 3.x, Qwen 2.5, Mistral, …). No OpenAI or
Anthropic key is required or used.

## Provider selection (`AI_PROVIDER`)

| Value    | Behaviour                                                                      |
| -------- | ------------------------------------------------------------------------------ |
| `auto`   | Use Ollama when it is reachable _and_ the model is pulled; otherwise the mock. |
| `ollama` | Always call Ollama (request errors still fall back to deterministic paths).    |
| `mock`   | Never call a model. Fully offline and deterministic.                           |

Availability is cached for 30 seconds, so a missing Ollama never slows page renders.

## Grounding rules — never invent property information

1. Every AI feature builds its prompt from **database facts only** (listing fields, amenities, price history).
2. System prompts instruct the model to answer only from the supplied facts and to say when something is unknown.
3. Structured outputs (e.g. search filters) are requested as JSON and validated with zod; invalid output is
   discarded in favour of the deterministic result.
4. Numbers shown to users (prices, sizes, payments, distances) always come from the database or from code — never
   from model text.
5. When no model is available, features use deterministic, rule-based implementations over the same facts.

## Features

| Feature                    | Deterministic path                                       | LLM path adds                          |
| -------------------------- | -------------------------------------------------------- | -------------------------------------- |
| Natural-language search    | Rule-based parser → `SearchQuery`                        | Refines ambiguous phrasing (validated) |
| AI Home Finder             | Preference extraction + transparent match scoring        | Conversational follow-ups              |
| Property Q&A               | Keyword → fact lookup, "not listed" when unknown         | Natural phrasing of grounded answers   |
| Listing description writer | Template composition from facts                          | Richer prose from the same facts       |
| Agent assistant            | Templated follow-ups from lead + listing data            | Tone-aware drafts                      |
| Comparison summaries       | Computed differences (price/sqft, size, fees, amenities) | Narrative summary of computed diffs    |

Every AI request is logged to `ai_requests` (feature, provider, model, latency, success) for Admin → AI.
