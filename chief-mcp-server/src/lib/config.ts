import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ChiefConfig } from "../types.js";
import { CONFIG_FILE, PROJECT_ROOT } from "./paths.js";

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

export async function readConfigSafe(): Promise<ChiefConfig | null> {
  try {
    return await readConfig();
  } catch {
    return null;
  }
}

export async function ensureDefaultConfigFileAt(projectRoot: string): Promise<void> {
  const configFile = path.join(projectRoot, ".chief", "config.json");
  try {
    await readFile(configFile, "utf-8");
  } catch (error: unknown) {
    if (isErrnoException(error) && error.code === "ENOENT") {
      await mkdir(path.dirname(configFile), { recursive: true });
      await writeFile(configFile, JSON.stringify(DEFAULT_CONFIG, null, 2), "utf-8");
      return;
    }
    throw error;
  }
}

export async function ensureDefaultConfigFile(): Promise<void> {
  return ensureDefaultConfigFileAt(PROJECT_ROOT);
}
