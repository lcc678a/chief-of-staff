import type { ChiefConfig } from "../../types.js";
import type { LLMProvider } from "./types.js";

/**
 * Generic OpenAI-compatible Chat Completions provider.
 *
 * The provider key in `config.providers` is treated as a free-form identifier
 * (e.g. `dashscope`, `openai`, `deepseek`, `moonshot`, ...). The provider does
 * not hardcode any specific vendor name; it just reads `base_url` /
 * `api_key_env` / models from the matching `providers[<name>]` entry.
 */
export class OpenAICompatibleProvider implements LLMProvider {
  readonly name: string;
  private readonly apiKeyEnv: string;
  private readonly baseUrl: string;

  constructor(name: string, config: ChiefConfig) {
    this.name = name;
    const provider = config.providers[name];
    if (!provider) {
      throw new Error(`Provider config for "${name}" is missing in .chief/config.json`);
    }
    if (!provider.api_key_env || provider.api_key_env.trim() === "") {
      throw new Error(`Provider "${name}" has no api_key_env configured`);
    }
    if (!provider.base_url || provider.base_url.trim() === "") {
      throw new Error(`Provider "${name}" has no base_url configured`);
    }
    this.apiKeyEnv = provider.api_key_env;
    this.baseUrl = provider.base_url.replace(/\/+$/, "");
  }

  async complete(args: {
    model: string;
    system: string;
    user: string;
    onChunk: (text: string) => void;
  }): Promise<string> {
    const apiKey = process.env[this.apiKeyEnv];
    if (!apiKey) {
      throw new Error(`Environment variable ${this.apiKeyEnv} is not set`);
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: args.model,
        messages: [
          { role: "system", content: args.system },
          { role: "user", content: args.user }
        ],
        stream: true
      })
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(
        `Provider "${this.name}" request failed (${response.status}): ${body.slice(0, 500)}`
      );
    }
    if (!response.body) {
      throw new Error(`Provider "${this.name}" response body is empty`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const event of events) {
        const lines = event.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data:")) {
            continue;
          }
          const payload = line.slice(5).trim();
          if (!payload || payload === "[DONE]") {
            continue;
          }

          let parsed: unknown;
          try {
            parsed = JSON.parse(payload);
          } catch {
            continue;
          }

          const content = extractDeltaContent(parsed);
          if (!content) {
            continue;
          }
          fullText += content;
          args.onChunk(content);
        }
      }
    }

    return fullText;
  }
}

function extractDeltaContent(value: unknown): string {
  if (!value || typeof value !== "object" || !("choices" in value)) {
    return "";
  }
  const choices = (value as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) {
    return "";
  }
  const first = choices[0] as { delta?: { content?: unknown } };
  const content = first?.delta?.content;
  return typeof content === "string" ? content : "";
}
