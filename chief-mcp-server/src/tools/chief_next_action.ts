import { access } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { CHIEF_DIR, CONFIG_FILE, PROJECT_ROOT, TASKS_FILE } from "../lib/paths.js";
import { readTasks } from "../lib/tasks_store.js";
import type { Task } from "../types.js";

export const chiefNextActionInputSchema = z.object({
  lane: z.string().optional(),
  limit: z.number().int().min(1).max(10).optional()
});

function laneFilterLabel(lane?: string): string {
  const t = lane?.trim();
  return t ?? "";
}

function normalizeTaskLane(task: Task): string {
  return task.lane?.trim() || "general";
}

function matchesLane(task: Task, filter?: string): boolean {
  const f = filter?.trim();
  if (!f) {
    return true;
  }
  return normalizeTaskLane(task) === f;
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

function depsMet(task: Task, allTasks: Task[]): boolean {
  for (const id of task.depends_on ?? []) {
    const dep = allTasks.find((x) => x.id === id);
    if (!dep || dep.status !== "done") {
      return false;
    }
  }
  return true;
}

function describeUnmetDeps(task: Task, allTasks: Task[]): string[] {
  const lines: string[] = [];
  for (const id of task.depends_on ?? []) {
    const dep = allTasks.find((x) => x.id === id);
    if (!dep) {
      lines.push(`依赖 \`${id}\`：未找到`);
    } else if (dep.status !== "done") {
      lines.push(`依赖 \`${id}\`：当前为 ${dep.status}（需 done）`);
    }
  }
  return lines;
}

async function optionalEnvHints(): Promise<string[]> {
  const hints: string[] = [];
  const agentTasksDir = path.join(CHIEF_DIR, "agent-tasks");
  const resultsDir = path.join(CHIEF_DIR, "results");
  const rulesFile = path.join(PROJECT_ROOT, ".cursor", "rules", "chief-of-staff.mdc");

  if (!(await pathExists(CONFIG_FILE))) {
    hints.push("- `.chief/config.json`：不存在（外部 API 工兵需要配置时可运行 `chief_repair` / `chief_config_help`）。");
  }
  if (!(await pathExists(rulesFile))) {
    hints.push("- `.cursor/rules/chief-of-staff.mdc`：不存在（请从仓库恢复规则）。");
  }
  if (!(await pathExists(agentTasksDir))) {
    hints.push("- `.chief/agent-tasks/`：不存在（可先 `chief_repair`）。");
  }
  if (!(await pathExists(resultsDir))) {
    hints.push("- `.chief/results/`：不存在（可先 `chief_repair`）。");
  }
  return hints.length > 0 ? hints : [];
}

export async function chiefNextAction(rawInput: unknown): Promise<string> {
  const input = chiefNextActionInputSchema.parse(rawInput);
  const laneFilter = laneFilterLabel(input.lane);
  const limit = Math.min(10, Math.max(1, input.limit ?? 5));

  if (!(await pathExists(TASKS_FILE))) {
    return `# 下一步建议

建议下一步：运行 \`chief_repair\` 初始化基础结构。

## 原因

\`.chief/tasks.json\` 不存在，当前无法判断任务队列。
`;
  }

  let tasks: Task[];
  try {
    tasks = await readTasks();
  } catch {
    return `# 下一步建议

建议下一步：人工修复 \`.chief/tasks.json\`。

## 原因

任务文件无法解析，\`chief_repair\` 不会覆盖已有损坏任务文件。
`;
  }

  const filtered = tasks.filter((t) => matchesLane(t, laneFilter || undefined));
  const laneNote = laneFilter ? `（任务线：${laneFilter}）` : "";

  if (filtered.length === 0) {
    return `# 下一步建议

建议下一步：登记一个新任务。

## 原因

当前任务队列${laneNote}为空。

## 可执行动作

使用 \`plan_tasks\` 拆解你的目标。
`;
  }

  const envHints = await optionalEnvHints();

  const blocked = filtered.filter((t) => t.status === "blocked").slice(0, limit);
  if (blocked.length > 0) {
    const lines = buildBlockedSection(blocked);
    return (
      `# 下一步建议\n\n建议下一步：**先处理 blocked 任务**。${laneNote}\n\n## 原因\n\n有 ${blocked.length} 个任务被阻塞，需要用户或参谋补充信息，否则队列不会自动前进。\n\n## 优先任务\n\n${lines}\n\n## 可执行动作\n\n查看各任务的 needs / blocked_by：补充信息后可用 \`submit_worker_result\`（Cursor 工兵）或调整任务并重发；必要时 \`chief_doctor\` 查看全貌。\n` +
      appendEnvHints(envHints)
    );
  }

  const failed = filtered.filter((t) => t.status === "failed").slice(0, limit);
  if (failed.length > 0) {
    const lines = failed
      .map((t) => {
        const err = t.error?.trim() || "";
        const sum = t.summary?.trim() || "";
        const tail = err ? `error：${truncate(err)}` : sum ? `摘要：${truncate(sum)}` : "（无 error/summary）";
        return `- **${t.id}**：${tail}`;
      })
      .join("\n");

    return (
      `# 下一步建议\n\n建议下一步：**先查看 failed 任务原因**。${laneNote}\n\n## 原因\n\n有失败任务需要先处理后才能继续。\n\n## 优先任务\n\n${lines}\n\n## 可执行动作\n\n修正原因后拆小任务、重登记或重新派发（外部 API：派发前可先 \`chief_external_preflight\`，再 \`dispatch_worker\`）；可用 \`get_worker_summary\` 查看详情。\n` +
      appendEnvHints(envHints)
    );
  }

  const waiting = filtered.filter((t) => t.status === "waiting_for_cursor_agent").slice(0, limit);
  if (waiting.length > 0) {
    const lines = waiting
      .map((t) => {
        const parts = [`- **${t.id}**`];
        parts.push(`lane：${normalizeTaskLane(t)}`);
        if (t.window_hint?.trim()) {
          parts.push(`建议窗口：${t.window_hint.trim()}`);
        }
        if (t.agent_task_file?.trim()) {
          parts.push(`任务包参考路径：${t.agent_task_file.trim()}（可复制内容到 Agents）`);
        }
        return parts.join("；");
      })
      .join("\n");

    return (
      `# 下一步建议\n\n建议下一步：**去 Cursor Agents 页面执行 waiting 的任务包**。${laneNote}\n\n## 原因\n\n这些任务在等待 Cursor 工兵执行。\n\n## 优先任务\n\n${lines}\n\n## 可执行动作\n\n在 Agents 页面打开对应 Agent，按需 **右键 → Rename** 对齐建议窗口名；未拿到任务包时可调用 \`prepare_cursor_agent_task\` 重新准备。\n\n说明：系统**不会**自动打开或自动重命名窗口。\n` +
      appendEnvHints(envHints)
    );
  }

  const running = filtered.filter((t) => t.status === "running").slice(0, limit);
  if (running.length > 0) {
    const lines = running
      .map((t) => {
        const pm =
          t.provider || t.model
            ? `${t.provider ?? "?"}/${t.model ?? "?"}`
            : "（路线见任务字段）";
        return `- **${t.id}**：${pm}`;
      })
      .join("\n");

    return (
      `# 下一步建议\n\n建议下一步：**等待运行中的任务结束或查看进度**。${laneNote}\n\n## 原因\n\n有任务正在执行。\n\n## 进行中任务\n\n${lines}\n\n## 可执行动作\n\n使用 \`get_worker_status\` / \`get_worker_summary\` 查看日志与结果；外部工兵勿重复 \`dispatch_worker\`。\n` +
      appendEnvHints(envHints)
    );
  }

  const pendingAll = filtered.filter((t) => t.status === "pending");
  const pendingUnmet = pendingAll.filter(
    (t) => (t.depends_on?.length ?? 0) > 0 && !depsMet(t, tasks)
  );
  if (pendingUnmet.length > 0) {
    const slice = pendingUnmet.slice(0, limit);
    const lines = slice
      .map((t) => {
        const u = describeUnmetDeps(t, tasks).join("；");
        return `- **${t.id}**：${u}`;
      })
      .join("\n");

    return (
      `# 下一步建议\n\n建议下一步：**先完成前置依赖任务**。${laneNote}\n\n## 原因\n\n有待派发任务依赖尚未 done，前置未完成则不应继续。\n\n## 优先任务\n\n${lines}\n\n## 可执行动作\n\n推进依赖任务至 **done** 后再准备 Cursor 任务包或派发外部工兵；不确定时用 \`chief_external_preflight\` 只做只读检查。\n` +
      appendEnvHints(envHints)
    );
  }

  const pendingReady = pendingAll.filter((t) => depsMet(t, tasks));
  if (pendingReady.length > 0) {
    const slice = pendingReady.slice(0, limit);
    return formatReadyPending(slice, tasks, laneNote, envHints);
  }

  const allDone =
    filtered.length > 0 && filtered.every((t) => t.status === "done");
  if (allDone) {
    return (
      `# 下一步建议\n\n建议下一步：**本批次任务已全部完成**。${laneNote}\n\n## 原因\n\n队列中在该范围内的任务均为 done。\n\n## 可执行动作\n\n按需 \`get_worker_summary\` 查阅结果，或用 \`plan_tasks\` 登记下一批任务。\n` +
      appendEnvHints(envHints)
    );
  }

  return (
    `# 下一步建议\n\n建议下一步：运行 \`chief_doctor\` 查看异常状态。\n\n## 原因\n\n当前筛选范围内没有匹配的 blocked/failed/waiting/running/pending 建议分支。\n` +
    appendEnvHints(envHints)
  );
}

function truncate(s: string, max = 120): string {
  if (s.length <= max) {
    return s;
  }
  return `${s.slice(0, max)}…`;
}

function buildBlockedSection(blocked: Task[]): string {
  return blocked
    .map((t) => {
      const needs = t.needs?.trim() ? `needs：${truncate(t.needs.trim(), 200)}` : "";
      const bb =
        t.blocked_by?.length ? `blocked_by：${t.blocked_by.join("、")}` : "";
      const extra = [needs, bb].filter(Boolean).join("；");
      return `- **${t.id}**${extra ? `：${extra}` : ""}`;
    })
    .join("\n");
}

function appendEnvHints(hints: string[]): string {
  if (hints.length === 0) {
    return "";
  }
  return `\n## 环境提示\n\n${hints.join("\n")}\n`;
}

function formatReadyPending(
  slice: Task[],
  _allTasks: Task[],
  laneNote: string,
  envHints: string[]
): string {
  const routes = new Set(slice.map((t) => t.worker_route));

  const headline =
    slice.length === 1 || routes.size === 1 ?
      `建议下一步：${singleReadyHead(slice[0])}${laneNote}`
    : `建议下一步：**按列表逐项处理可调派的 pending**（路线不一致）。${laneNote}`;

  const list = slice
    .map((t) => {
      const hint =
        t.allowed_files?.length ?
          "（含 allowed_files：通常更适合 Cursor 工兵本地改代码）"
        : "";
      const route = t.worker_route ?? "（未标记）";
      return `- **${t.id}** worker_route=${route}${hint}`;
    })
    .join("\n");

  const actionText =
    routes.size === 1 ? buildReadyActions(slice[0]) : buildMixedReadyActions(slice);

  return (
    `# 下一步建议\n\n${headline}\n\n## 原因\n\n有待执行任务，且依赖已满足或无依赖。\n\n## 优先任务\n\n${list}\n\n## 可执行动作\n\n${actionText}\n` +
    appendEnvHints(envHints)
  );
}

function singleReadyHead(t: Task): string {
  if (t.worker_route === "cursor_agent") {
    return "**准备 Cursor 工兵任务包**";
  }
  if (t.worker_route === "external") {
    return "**先做 chief_external_preflight，再 dispatch_worker（外部 API）**";
  }
  return "**选择工兵路线并准备派发**";
}

function buildMixedReadyActions(slice: Task[]): string {
  const lines = slice.map((t) => `- **${t.id}**：${briefReadyLine(t)}`).join("\n");
  return `${lines}\n\n逐项执行；外部路线务必先 \`chief_external_preflight\`，Cursor 工兵用 \`prepare_cursor_agent_task\`。`;
}

function briefReadyLine(t: Task): string {
  if (t.worker_route === "cursor_agent") {
    return `\`prepare_cursor_agent_task\` → 粘贴到 Agents`;
  }
  if (t.worker_route === "external") {
    return `\`chief_external_preflight\` → \`dispatch_worker\``;
  }
  return "在 Cursor 工兵与 external 之间选定路线后再准备派发";
}

function buildReadyActions(sample: Task): string {
  const extra =
    sample.allowed_files?.length ?
      `\n涉及文件范围时优先考虑 **Cursor 工兵**；若以自定义模型/API 批量为主用 **external**（前先 \`chief_external_preflight\`）。\n`
    : "";

  if (sample.worker_route === "cursor_agent") {
    return `调用 \`prepare_cursor_agent_task\`（指定对应 \`task_id\`），将任务包粘贴到 Cursor Agents。**不要假设**系统会自动打开窗口。\n${extra}`;
  }
  if (sample.worker_route === "external") {
    return `先 \`chief_external_preflight\`（带 \`task_id\`），条件满足后再 \`dispatch_worker\`。\n${extra}`;
  }
  return `- **Cursor 工兵**：本地交互改代码 → \`prepare_cursor_agent_task\`。\n- **外部 API 工兵**：自定义模型、自动化、长任务 → 先 \`chief_external_preflight\` 再 \`dispatch_worker\`。\n${extra}`;
}

