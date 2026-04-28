import { access, readFile } from "node:fs/promises";
import { z } from "zod";
import type { ChiefConfig, ModelLevel, Task } from "../types.js";
import { CONFIG_FILE, TASKS_FILE } from "../lib/paths.js";
import { readTasks } from "../lib/tasks_store.js";

export const chiefExternalPreflightInputSchema = z.object({
  task_id: z.string().optional(),
  provider: z.string().optional(),
  model: z.string().optional()
});

type ConfigLoad =
  | { status: "missing" }
  | { status: "invalid" }
  | { status: "ok"; config: ChiefConfig };

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadConfig(): Promise<ConfigLoad> {
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

function normalizeModelLevel(task: Task): ModelLevel {
  const l = task.model_level;
  if (l === "cheap" || l === "smart" || l === "genius") {
    return l;
  }
  return "smart";
}

/** 与 dispatch_worker 一致：input.provider → task.provider → config.default_provider */
function resolveDispatchProvider(
  inputProvider: string | undefined,
  task: Task | undefined,
  config: ChiefConfig
): string {
  return inputProvider ?? task?.provider ?? config.default_provider;
}

/**
 * 与 dispatch_worker 一致：
 * 有 task：input.model → task.model → providerConfig.models[task.model_level]
 * 无 task：input.model → models.smart → models.cheap
 */
function resolveDispatchModel(
  inputModel: string | undefined,
  task: Task | undefined,
  providerConfig: ChiefConfig["providers"][string]
): string | undefined {
  if (task) {
    return inputModel ?? task.model ?? providerConfig.models[normalizeModelLevel(task)];
  }
  return inputModel ?? providerConfig.models.smart ?? providerConfig.models.cheap ?? undefined;
}

function apiKeyLabel(envName: string | undefined): string {
  if (!envName || envName.trim() === "") {
    return "未检查（未配置 api_key_env）";
  }
  return process.env[envName] ? "已配置（不显示内容）" : "未配置";
}

function checkDependsOn(allTasks: Task[], task: Task): { ok: boolean; lines: string[] } {
  const deps = task.depends_on ?? [];
  if (deps.length === 0) {
    return { ok: true, lines: [] };
  }
  const lines: string[] = [];
  let ok = true;
  const byId = new Map(allTasks.map((t) => [t.id, t]));
  for (const depId of deps) {
    const dep = byId.get(depId);
    if (!dep) {
      ok = false;
      lines.push(`未找到依赖任务 \`${depId}\``);
    } else if (dep.status !== "done") {
      ok = false;
      lines.push(`依赖任务 \`${depId}\` 状态为 ${dep.status}（需为 done）`);
    }
  }
  return { ok, lines };
}

export async function chiefExternalPreflight(rawInput: unknown): Promise<string> {
  const input = chiefExternalPreflightInputSchema.parse(rawInput);
  const taskId = input.task_id?.trim();
  const hasExplicitProviderModel = input.provider !== undefined || input.model !== undefined;

  const cfg = await loadConfig();
  if (cfg.status === "missing") {
    return failureHeader() + `## 问题

- **外部 API 配置不存在**：\`.chief/config.json\` 未找到。

## 建议下一步

- 运行 \`chief_repair\` 或按文档创建配置；再用 \`chief_config_help\` 查看字段说明。
- **Cursor 工兵**仍可在不配置外部 API 的情况下使用。
`;
  }
  if (cfg.status === "invalid") {
    return failureHeader() + `## 问题

- **config.json 无法解析**或结构无效；**不会**自动覆盖。

## 建议下一步

- 人工修复 JSON 后重试；可配合 \`chief_config_help\`。
`;
  }

  const config = cfg.config;
  let task: Task | undefined;
  let allTasks: Task[] = [];

  if (taskId) {
    if (!(await pathExists(TASKS_FILE))) {
      return failureHeader() + `## 问题

- **tasks.json 不存在**：无法加载任务 \`${taskId}\`。

## 建议下一步

- 运行 \`chief_repair\` 初始化；或确认项目路径正确。
`;
    }
    try {
      allTasks = await readTasks();
    } catch {
      return failureHeader() + `## 问题

- **tasks.json 无法解析**：请人工修复后再预检。
`;
    }
    task = allTasks.find((t) => t.id === taskId);
    if (!task) {
      return failureHeader() + `## 问题

- **未找到任务**：\`${taskId}\`。

## 建议下一步

- 确认 \`task_id\`；或先用 \`chief_doctor\` / \`get_worker_board\` 查看任务列表。
`;
    }
  }

  const providerName = resolveDispatchProvider(input.provider, task, config);
  const providerConfig = config.providers[providerName];
  const resolvedModel = providerConfig
    ? resolveDispatchModel(input.model, task, providerConfig)
    : undefined;

  const issues: string[] = [];
  const hints: string[] = [];

  if (!providerConfig) {
    issues.push(`**provider** \`${providerName}\` 未在 \`config.providers\` 中定义（请检查 \`default_provider\` 或任务字段）。`);
  } else {
    if (!providerConfig.base_url?.trim()) {
      issues.push(`**base_url** 未配置（provider：\`${providerName}\`）。`);
    }
    if (!providerConfig.api_key_env?.trim()) {
      issues.push(`**api_key_env** 未配置（provider：\`${providerName}\`）。`);
    } else if (!process.env[providerConfig.api_key_env]) {
      issues.push(
        `**API Key 环境变量未设置**：\`${providerConfig.api_key_env}\`（不在输出中显示变量值）。`
      );
    }
    if (!resolvedModel || String(resolvedModel).trim() === "") {
      issues.push(
        `**model** 无法解析：请指定 \`model\` 或在配置中为对应 \`model_level\` 配置模型（当前解析结果为空）。`
      );
    }
  }

  if (task) {
    const depResult = checkDependsOn(allTasks, task);
    if (!depResult.ok) {
      issues.push(...depResult.lines.map((l) => `**依赖未完成**：${l}`));
    }

    if (task.worker_route === "cursor_agent" && !hasExplicitProviderModel) {
      hints.push(
        "该任务当前标记为 **Cursor 工兵**（`worker_route`）；若仍要以 **外部 API** 派发，请在本工具参数中**显式传入** `provider` 和/或 `model`，或先在任务上调整路线。"
      );
    }
    if (task.allowed_files && task.allowed_files.length > 0) {
      hints.push(
        "任务包含 **文件范围**（`allowed_files`）；若主要需要**本地代码修改**，**Cursor 工兵**通常更合适（仅为建议，不代替配置与依赖检查）。"
      );
    }
  }

  const canDispatch = issues.length === 0;
  const conclusion = canDispatch ? "可以派发" : "暂不建议派发";

  const lines: string[] = [
    `# 外部 API 工兵预检查`,
    ``,
    `**结论**：${conclusion}`,
    ``
  ];

  if (taskId && task) {
    lines.push(
      `- **task**：\`${task.id}\``,
      `- **worker_route**（当前字段）：${task.worker_route ?? "（未设置）"}`,
      `- **provider**：${providerName}`,
      `- **model**：${resolvedModel ?? "（未解析）"}`,
      `- **API Key**：${providerConfig ? apiKeyLabel(providerConfig.api_key_env) : "—"}`,
      `- **base_url**：${providerConfig?.base_url?.trim() ? "已配置" : "未配置"}`,
      `- **依赖**：${
        !task.depends_on?.length ? "无" : canDispatch ? "已满足" : "未满足（见「问题」）"
      }`,
      ``
    );
  } else {
    lines.push(
      `- **task**：（未指定 \`task_id\`，仅检查默认 external 配置路径）`,
      `- **provider**：${providerName}`,
      `- **model**：${resolvedModel ?? "（未解析）"}`,
      `- **API Key**：${providerConfig ? apiKeyLabel(providerConfig.api_key_env) : "—"}`,
      `- **base_url**：${providerConfig?.base_url?.trim() ? "已配置" : "未配置"}`,
      ``
    );
  }

  if (!canDispatch) {
    lines.push(`## 问题`, ``);
    for (const issue of issues) {
      lines.push(`- ${issue}`);
    }
    lines.push(``);
  }

  if (hints.length > 0) {
    lines.push(`## 提醒`, ``);
    for (const h of hints) {
      lines.push(`- ${h}`);
    }
    lines.push(``);
  }

  lines.push(
    `## 说明`,
    ``,
    `- 本工具**只读**，未发起真实 **API** 请求；**API Key「已配置」不代表接口一定可用**。`,
    `- **chief_config_help**：侧重解释配置文件结构；**chief_external_preflight**：判断指定任务/参数下 external 派发是否就绪。`,
    ``
  );

  lines.push(`## 建议下一步`, ``);
  if (canDispatch) {
    lines.push(
      `- 可调用 \`dispatch_worker\` 派发外部工兵（仍需自行承担调用费用与失败风险）。`,
      `- 若以本地编辑为主，可继续使用 **Cursor 工兵**。`
    );
  } else {
    lines.push(
      `- 按「问题」逐项修复（环境变量、依赖、provider/model 配置等）。`,
      `- 若只需改本地代码，可改用 **Cursor 工兵**（\`prepare_cursor_agent_task\`）。`,
      `- 配置不明时可运行 \`chief_config_help\`。`
    );
  }

  return lines.join("\n").trimEnd() + "\n";
}

function failureHeader(): string {
  return `# 外部 API 工兵预检查

**结论**：暂不建议派发

`;
}
