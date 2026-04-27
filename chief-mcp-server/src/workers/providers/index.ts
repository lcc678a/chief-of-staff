import type { ChiefConfig } from "../../types.js";
import { DashscopeProvider } from "./dashscope.js";
import type { LLMProvider } from "./types.js";

export function getProvider(name: string, config: ChiefConfig): LLMProvider {
  if (name === "dashscope") {
    return new DashscopeProvider(config);
  }
  throw new Error(`Unknown provider: ${name}`);
}
