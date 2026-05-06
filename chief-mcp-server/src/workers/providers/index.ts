import type { ChiefConfig } from "../../types.js";
import { OpenAICompatibleProvider } from "./openai_compatible.js";
import type { LLMProvider } from "./types.js";

/**
 * Resolve a provider by its config key.
 *
 * The provider name is whatever the user wrote as a key under
 * `config.providers` (e.g. `dashscope`, `openai`, `deepseek`, `moonshot`, ...).
 * It is **not** a fixed allow-list. Anything that exposes an OpenAI-compatible
 * `/chat/completions` endpoint with `Authorization: Bearer <key>` works.
 */
export function getProvider(name: string, config: ChiefConfig): LLMProvider {
  if (!config.providers[name]) {
    throw new Error(`Provider "${name}" not found in .chief/config.json`);
  }
  return new OpenAICompatibleProvider(name, config);
}
