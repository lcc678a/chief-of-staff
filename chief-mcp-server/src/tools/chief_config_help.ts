import { access, readFile } from "node:fs/promises";
import { z } from "zod";
import type { ChiefConfig, ModelLevel } from "../types.js";
import { CONFIG_FILE } from "../lib/paths.js";

export const chiefConfigHelpInputSchema = z.object({
  provider: z.string().optional()
});

type LoadResult =
  | { status: "missing" }
  | { status: "invalid" }
  | { status: "ok"; config: ChiefConfig };

const MODEL_LEVELS: ModelLevel[] = ["cheap", "smart", "genius"];

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadConfig(): Promise<LoadResult> {
  if (!(await pathExists(CONFIG_FILE))) {
    return { status: "missing" };
  }
  try {
    const raw = await readFile(CONFIG_FILE, "utf-8");
    const cleaned = raw.replace(/^\uFEFF/, "");
    const parsed = JSON.parse(cleaned) as unknown;
    if (!parsed || typeof parsed !== "object") {
      return { status: "invalid" };
    }
    const obj = parsed as Record<string, unknown>;
    if (typeof obj.default_provider !== "string" || obj.default_provider.trim() === "") {
      return { status: "invalid" };
    }
    if (!obj.providers || typeof obj.providers !== "object" || Array.isArray(obj.providers)) {
      return { status: "invalid" };
    }
    return { status: "ok", config: parsed as ChiefConfig };
  } catch {
    return { status: "invalid" };
  }
}

function apiKeyLabel(envName: string | undefined): string {
  if (!envName || envName.trim() === "") {
    return "未检查（未配置 api_key_env）";
  }
  return process.env[envName] ? "已配置（不显示内容）" : "未配置";
}

function baseUrlLabel(url: string | undefined): string {
  if (!url || url.trim() === "") {
    return "未配置";
  }
  return "已配置";
}

function modelLabel(models: ChiefConfig["providers"][string]["models"] | undefined, level: ModelLevel): string {
  const v = models?.[level];
  if (!v || String(v).trim() === "") {
    return "未配置";
  }
  return String(v);
}

export async function chiefConfigHelp(rawInput: unknown): Promise<string> {
  const input = chiefConfigHelpInputSchema.parse(rawInput);
  const filterProvider = input.provider?.trim();

  const loaded = await loadConfig();

  if (loaded.status === "missing") {
    return `# 外部 API 工兵配置

## 说明

- \`.chief/config.json\`：**不存在**
- **Cursor 工兵**：无需 API Key，可直接使用 Cursor Agent / 任务包流程。
- **外部 API 工兵**：需要配置 provider、模型与 API Key（环境变量）。

## 建议下一步

- 可先运行 \`chief_repair\` 创建默认配置模板；或按项目文档手动新建 \`.chief/config.json\`。
- 配置完成后用本工具（\`chief_config_help\`）复查环境变量与模型映射。
`;
  }

  if (loaded.status === "invalid") {
    return `# 外部 API 工兵配置

## 说明

- \`.chief/config.json\`：**无法解析**或结构不符合预期。
- **不会**自动覆盖该文件；请人工修复 JSON 内容。

## 建议下一步

- 修正 JSON 语法与结构（需包含 \`default_provider\` 与 \`providers\`）。
- 修复后用 \`chief_config_help\` 再次检查。
`;
  }

  const config = loaded.config;
  const providerIds = Object.keys(config.providers ?? {}).sort();
  const defaultProvider = config.default_provider;

  if (filterProvider) {
    if (!config.providers[filterProvider]) {
      return `# 外部 API 工兵配置

- **请求的 provider**：\`${filterProvider}\`
- **结果**：未在 \`.chief/config.json\` 的 \`providers\` 中找到。

## 建议下一步

- 在 \`providers\` 中添加该 provider；或改用已有 provider，并确认 \`default_provider\` 与之匹配。
`;
    }
    return buildFocusedReport(config, filterProvider, providerIds);
  }

  return buildFullReport(config, providerIds, defaultProvider);
}

function buildFocusedReport(
  config: ChiefConfig,
  providerId: string,
  allProviderIds: string[]
): string {
  const lines: string[] = [
    `# 外部 API 工兵配置`,
    ``,
    `## 总览`,
    ``,
    `- **默认 provider**：${config.default_provider}`,
    `- **已配置 providers**：${allProviderIds.length > 0 ? allProviderIds.join("、") : "（无）"}`,
    `- **当前聚焦**：\`${providerId}\``,
    `- **Cursor 工兵**：无需 API Key，可直接使用 Cursor Agent。`,
    `- **外部 API 工兵**：需要 provider / model / API Key（环境变量）。`,
    ``,
    `## Provider: ${providerId}`,
    ``
  ];

  appendProviderSection(lines, providerId, config.providers[providerId]);

  lines.push(
    ``,
    `## 需要注意`,
    ``,
    `- 本工具**只读配置与环境变量是否存在**，**不会**发起真实 API 请求。`,
    `- 「API Key 已配置」**不代表**外部 API 一定可用（仅表示对应环境变量已设置）。`,
    `- OpenAI-compatible 类 provider 通常需正确填写 **base_url**、**api_key_env** 与 **models**。`,
    ``,
    `## 建议下一步`,
    ``,
    appendSuggestions(config, [providerId])
  );

  return lines.join("\n").trimEnd() + "\n";
}

function buildFullReport(config: ChiefConfig, providerIds: string[], defaultProvider: string): string {
  const lines: string[] = [
    `# 外部 API 工兵配置`,
    ``,
    `## 总览`,
    ``,
    `- **默认 provider**：${defaultProvider}`,
    `- **已配置 providers**：${providerIds.length > 0 ? providerIds.join("、") : "（无）"}`,
    `- **Cursor 工兵**：无需 API Key，可直接使用 Cursor Agent。`,
    `- **外部 API 工兵**：需要 provider / model / API Key（环境变量）。`,
    ``
  ];

  const defaultDef = config.providers[defaultProvider];
  const defaultMismatchNote =
    defaultDef === undefined
      ? `- **default_provider** 为 \`${defaultProvider}\`，但 **providers** 中无此项，外部工兵将无法按默认路由工作。\n`
      : "";

  for (const pid of providerIds) {
    lines.push(`## Provider: ${pid}`, ``);
    appendProviderSection(lines, pid, config.providers[pid]);
    lines.push(``);
  }

  if (providerIds.length === 0) {
    lines.push(`（当前无任何 provider 条目。）`, ``);
  }

  lines.push(`## 需要注意`, ``);
  if (defaultMismatchNote) {
    lines.push(defaultMismatchNote.trimEnd(), ``);
  }
  lines.push(
    `- 本工具**只读配置与环境变量是否存在**，**不会**发起真实 API 请求。`,
    `- 「API Key 已配置」**不代表**外部 API 一定可调用。`,
    `- **不要**把环境变量值贴进聊天；仅检查是否已设置。`,
    ``
  );

  const focus = providerIds.includes(defaultProvider) ? [defaultProvider] : providerIds;
  lines.push(`## 建议下一步`, ``);
  lines.push(appendSuggestions(config, focus.length > 0 ? focus : providerIds));

  return lines.join("\n").trimEnd() + "\n";
}

function appendProviderSection(
  lines: string[],
  providerId: string,
  def: ChiefConfig["providers"][string] | undefined
): void {
  if (!def) {
    lines.push(`（无此 provider 定义）`);
    return;
  }
  const envName = def.api_key_env?.trim();
  lines.push(`- **base_url**：${baseUrlLabel(def.base_url)}`);
  lines.push(`- **api_key_env**：${envName ? `\`${envName}\`` : "（未配置）"}`);
  lines.push(`- **API Key**：${apiKeyLabel(envName)}`);
  lines.push(`- **models**：`);
  for (const level of MODEL_LEVELS) {
    lines.push(`  - ${level}：${modelLabel(def.models, level)}`);
  }
}

function appendSuggestions(config: ChiefConfig, relevantIds: string[]): string {
  const parts: string[] = [];
  const defaultDef = config.providers[config.default_provider];

  if (!defaultDef) {
    parts.push(`- 修正 \`default_provider\` 与 \`providers\` 键名一致。`);
  }

  let needKey = false;
  let needModel = false;
  for (const pid of relevantIds) {
    const p = config.providers[pid];
    if (!p) continue;
    if (p.api_key_env && !process.env[p.api_key_env]) {
      needKey = true;
    }
    for (const level of MODEL_LEVELS) {
      if (!p.models?.[level] || String(p.models[level]).trim() === "") {
        needModel = true;
      }
    }
    if (!p.base_url?.trim()) {
      parts.push(`- provider \`${pid}\`：补齐 **base_url**（OpenAI-compatible 端点必填）。`);
    }
  }

  if (needKey) {
    parts.push(
      `- API Key：在系统或终端中为对应 **api_key_env** 设置值（**勿**把密钥粘贴到聊天）。示例（占位符）：`,
      `  - PowerShell：\`$env:DASHSCOPE_API_KEY="<你的密钥>"\`（将变量名换成配置中的 api_key_env）`,
      `  - bash：\`export DASHSCOPE_API_KEY="<你的密钥>"\``
    );
  }
  if (needModel) {
    parts.push(`- 在 \`providers.*.models\` 中补齐 **cheap** / **smart** / **genius** 对应的模型名。`);
  }

  if (parts.length === 0) {
    parts.push(
      `- 配置项基本齐全；派发外部任务前仍可用 \`dispatch_worker\` 试跑（若失败再查日志）。`,
      `- 若主要做本地改代码，可继续使用 **Cursor 工兵**，无需外部 API Key。`
    );
  } else {
    parts.push(`- 若任务以本地交互为主，可继续使用 **Cursor 工兵**，不依赖外部 API。`);
  }

  return parts.join("\n");
}
