import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ChiefConfig } from "../types.js";
import { CONFIG_FILE } from "./paths.js";

export const DEFAULT_CONFIG: ChiefConfig = {
  default_provider: "dashscope",
  providers: {
    dashscope: {
      api_key_env: "DASHSCOPE_API_KEY",
      base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
      models: {
        cheap: "qwen-turbo",
        smart: "qwen-plus",
        genius: "qwen-max"
      }
    }
  }
};

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error;
}

export async function readConfig(): Promise<ChiefConfig> {
  const raw = await readFile(CONFIG_FILE, "utf-8");
  return JSON.parse(raw) as ChiefConfig;
}

export async function ensureDefaultConfigFile(): Promise<void> {
  try {
    await readFile(CONFIG_FILE, "utf-8");
  } catch (error: unknown) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      await mkdir(path.dirname(CONFIG_FILE), { recursive: true });
      await writeFile(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2), "utf-8");
      return;
    }
    throw error;
  }
}
