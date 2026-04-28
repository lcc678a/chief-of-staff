import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { CHIEF_DIR, CONFIG_FILE, PROJECT_ROOT, TASKS_FILE } from "../lib/paths.js";
import type { Task, TaskStatus } from "../types.js";

export const chiefAuditInputSchema = z.object({
  lane: z.string().optional(),
  include_orphans: z.boolean().optional(),
  limit: z.number().int().min(1).max(20).optional()
});

const STATUSES: TaskStatus[] = [
  "pending",
  "running",
  "waiting_for_cursor_agent",
  "blocked",
  "done",
  "failed"
];

const MODEL_LEVELS = ["cheap", "smart", "genius"] as const;
const KNOWN_ROUTES = new Set(["external", "cursor_agent", "host_assisted"]);

const ACTIVE_STATUSES = new Set<TaskStatus>([
  "pending",
  "waiting_for_cursor_agent",
  "running",
  "blocked"
]);

const AGENT_TASKS_DIR = path.join(CHIEF_DIR, "agent-tasks");
const RESULTS_DIR = path.join(CHIEF_DIR, "results");
const RULES_FILE = path.join(PROJECT_ROOT, ".cursor", "rules", "chief-of-staff.mdc");

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
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

function takeLimited(items: string[], limit: number): { shown: string[]; rest: number } {
  if (items.length <= limit) {
    return { shown: items, rest: 0 };
  }
  return { shown: items.slice(0, limit), rest: items.length - limit };
}

function formatLimitedSection(title: string, items: string[], limit: number): string[] {
  const { shown, rest } = takeLimited(items, limit);
  const lines: string[] = [`## ${title}`, ``];
  for (const s of shown) {
    lines.push(`- ${s}`);
  }
  if (rest > 0) {
    lines.push(`- 另有 ${rest} 条未显示`);
  }
  lines.push(``);
  return lines;
}

function absProjectPath(relOrAbs: string): string {
  if (path.isAbsolute(relOrAbs)) {
    return relOrAbs;
  }
  return path.join(PROJECT_ROOT, relOrAbs.replace(/^\//, ""));
}

export async function chiefAudit(rawInput: unknown): Promise<string> {
  const input = chiefAuditInputSchema.parse(rawInput);
  const laneFilter = input.lane?.trim() ?? "";
  const limit = Math.min(20, Math.max(1, input.limit ?? 10));
  const includeOrphans = input.include_orphans !== false;

  if (!(await pathExists(TASKS_FILE))) {
    return `# Chief-of-Staff 审计

结论：无法审计

## 阻断问题

- \`.chief/tasks.json\` 不存在

## 建议

先运行 \`chief_repair\`。
`;
  }

  let rawParsed: unknown;
  try {
    const raw = await readFile(TASKS_FILE, "utf-8");
    rawParsed = JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch {
    return `# Chief-of-Staff 审计

结论：无法审计

## 阻断问题

- \`.chief/tasks.json\` 无法解析

## 建议

人工修复 tasks.json；\`chief_repair\` 不会覆盖已有损坏任务文件。
`;
  }

  if (!Array.isArray(rawParsed)) {
    return `# Chief-of-Staff 审计

结论：无法审计

## 阻断问题

- tasks.json 顶层不是数组

## 建议

人工修复 tasks.json。
`;
  }

  const rawArray = rawParsed as unknown[];
  const blockers: string[] = [];

  const idToIndices = new Map<string, number[]>();
  const stringIds: string[] = [];

  for (let i = 0; i < rawArray.length; i++) {
    const item = rawArray[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      blockers.push(`索引 ${i}：项不是对象`);
      continue;
    }
    const o = item as Record<string, unknown>;
    const idRaw = o.id;
    if (typeof idRaw !== "string" || !idRaw.trim()) {
      blockers.push(`索引 ${i}：task id 缺失或不是字符串`);
      continue;
    }
    const tid = idRaw.trim();
    stringIds.push(tid);
    const arr = idToIndices.get(tid) ?? [];
    arr.push(i);
    idToIndices.set(tid, arr);
  }

  for (const [tid, indices] of idToIndices) {
    if (indices.length > 1) {
      blockers.push(`${tid}：task id 重复（出现 ${indices.length} 次）`);
    }
  }

  const idSet = new Set(stringIds);

  for (let i = 0; i < rawArray.length; i++) {
    const item = rawArray[i];
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      continue;
    }
    const o = item as Record<string, unknown>;
    const idRaw = o.id;
    if (typeof idRaw !== "string" || !idRaw.trim()) {
      continue;
    }
    const tid = idRaw.trim();

    const st = o.status;
    if (typeof st !== "string" || !STATUSES.includes(st as TaskStatus)) {
      blockers.push(`${tid}：status 缺失或不是已知状态`);
    }

    const ml = o.model_level;
    if (typeof ml !== "string" || !MODEL_LEVELS.includes(ml as (typeof MODEL_LEVELS)[number])) {
      blockers.push(`${tid}：model_level 缺失或不是 cheap/smart/genius`);
    }

    const deps = o.depends_on;
    if (Array.isArray(deps)) {
      if (deps.includes(tid)) {
        blockers.push(`${tid}：depends_on 包含自身 id`);
      }
      for (const d of deps) {
        if (typeof d !== "string" || !d.trim()) {
          blockers.push(`${tid}：depends_on 含非法项`);
          continue;
        }
        if (!idSet.has(d.trim())) {
          blockers.push(`${tid}：depends_on 指向不存在任务 ${d.trim()}`);
        }
      }
    }

    const bb = o.blocked_by;
    if (Array.isArray(bb)) {
      for (const b of bb) {
        if (typeof b !== "string" || !b.trim()) {
          blockers.push(`${tid}：blocked_by 含非法项`);
          continue;
        }
        if (!idSet.has(b.trim())) {
          blockers.push(`${tid}：blocked_by 指向不存在任务 ${b.trim()}`);
        }
      }
    }
  }

  let tasks: Task[] = [];
  try {
    tasks = rawArray.filter((x) => x && typeof x === "object" && !Array.isArray(x)) as Task[];
  } catch {
    tasks = [];
  }

  const scoped = laneFilter ? tasks.filter((t) => matchesLane(t, laneFilter)) : tasks;

  const warnings: string[] = [];
  const infos: string[] = [];

  const configExists = await pathExists(CONFIG_FILE);
  const rulesExist = await pathExists(RULES_FILE);
  const agentDirExists = await pathExists(AGENT_TASKS_DIR);
  const resultsDirExists = await pathExists(RESULTS_DIR);

  if (!agentDirExists) {
    warnings.push(".chief/agent-tasks 目录不存在（可运行 chief_repair）");
  }
  if (!resultsDirExists) {
    warnings.push(".chief/results 目录不存在（可运行 chief_repair）");
  }
  if (!rulesExist) {
    warnings.push(".cursor/rules/chief-of-staff.mdc 缺失");
  }

  const externalInScope = scoped.filter((t) => t.worker_route === "external");
  if (!configExists && externalInScope.length > 0) {
    warnings.push(
      `存在 external 路线任务但 .chief/config.json 缺失（${laneFilter ? `当前 lane 范围内 ${externalInScope.length} 个` : `${externalInScope.length} 个`}）`
    );
  }

  for (const t of scoped) {
    const wr = t.worker_route;
    if (wr !== undefined && typeof wr === "string" && !KNOWN_ROUTES.has(wr)) {
      warnings.push(`${t.id}：worker_route 未知值 "${wr}"`);
    }

    if (t.status === "waiting_for_cursor_agent") {
      const ag = t.agent_task_file?.trim();
      if (!ag) {
        warnings.push(`${t.id}：waiting_for_cursor_agent 但 agent_task_file 缺失`);
      } else if (!(await pathExists(absProjectPath(ag)))) {
        warnings.push(`${t.id}：agent_task_file 指向文件不存在（${ag}）`);
      }
    }

    if (t.status === "done") {
      const rf = t.result_file?.trim();
      if (!rf) {
        warnings.push(`${t.id}：status=done 但 result_file 缺失`);
      } else if (!(await pathExists(absProjectPath(rf)))) {
        warnings.push(`${t.id}：result_file 指向文件不存在（${rf}）`);
      }
    }

    if (t.status === "blocked") {
      if (!t.needs?.trim()) {
        warnings.push(`${t.id}：blocked 但 needs 缺失或为空`);
      }
    }

    if (t.status === "failed") {
      const hasErr = Boolean(t.error?.trim());
      const hasSum = Boolean(t.summary?.trim());
      const rawDet = (t as unknown as Record<string, unknown>)["details"];
      const hasDet = typeof rawDet === "string" && Boolean(rawDet.trim());
      if (!hasErr && !hasSum && !hasDet) {
        warnings.push(`${t.id}：failed 但 error/summary/details 均缺失`);
      }
    }

    if (t.worker_route === "external") {
      if (!t.provider?.trim() && !t.model?.trim()) {
        warnings.push(`${t.id}：worker_route=external 但 provider 与 model 均缺失`);
      }
    }

    if (t.worker_route === "cursor_agent") {
      if (!t.lane?.trim() || !t.window_hint?.trim()) {
        warnings.push(`${t.id}：worker_route=cursor_agent 但 lane 或 window_hint 缺失`);
      }
    }

    if (t.status === "running" && t.worker_route === "external") {
      if (!t.provider?.trim() && !t.model?.trim()) {
        warnings.push(`${t.id}：running 且 external 但 provider/model 均缺失`);
      }
    }
  }

  const activeScoped = scoped.filter((t) => ACTIVE_STATUSES.has(t.status));
  for (let i = 0; i < activeScoped.length; i++) {
    for (let j = i + 1; j < activeScoped.length; j++) {
      const a = activeScoped[i];
      const b = activeScoped[j];
      const af = a.allowed_files ?? [];
      const bf = b.allowed_files ?? [];
      for (const p of af) {
        if (bf.includes(p)) {
          warnings.push(`${a.id} 与 ${b.id} allowed_files 重叠：${p}`);
        }
      }
    }
  }

  if (includeOrphans) {
    if (agentDirExists) {
      try {
        const names = await readdir(AGENT_TASKS_DIR);
        for (const name of names) {
          if (!name.endsWith(".md")) {
            continue;
          }
          const stem = path.basename(name, ".md");
          if (!idSet.has(stem)) {
            infos.push(`孤儿任务包：${path.join(".chief/agent-tasks", name)}`);
          }
        }
      } catch {
        infos.push("无法列出 .chief/agent-tasks 目录");
      }
    }

    if (resultsDirExists) {
      try {
        const names = await readdir(RESULTS_DIR);
        for (const name of names) {
          const stem = path.basename(name, path.extname(name));
          if (!idSet.has(stem)) {
            infos.push(`孤儿结果文件：${path.join(".chief/results", name)}`);
          }
        }
      } catch {
        infos.push("无法列出 .chief/results 目录");
      }
    }
  }

  const bc = blockers.length;
  const wc = warnings.length;
  const ic = infos.length;

  const laneSet = new Set(scoped.map((t) => normalizeTaskLane(t)));
  const lanesLabel = [...laneSet].sort().join("、") || "—";

  const counts: Record<TaskStatus, number> = {
    pending: 0,
    running: 0,
    waiting_for_cursor_agent: 0,
    blocked: 0,
    done: 0,
    failed: 0
  };
  let cursorCount = 0;
  let externalCount = 0;
  let hostAssistedCount = 0;
  let unknownRoute = 0;
  let unspecifiedRoute = 0;

  for (const t of scoped) {
    if (STATUSES.includes(t.status)) {
      counts[t.status] += 1;
    }
    const r = t.worker_route;
    if (!r) {
      unspecifiedRoute += 1;
    } else if (r === "cursor_agent") {
      cursorCount += 1;
    } else if (r === "external") {
      externalCount += 1;
    } else if (r === "host_assisted") {
      hostAssistedCount += 1;
    } else if (!KNOWN_ROUTES.has(r)) {
      unknownRoute += 1;
    }
  }

  const conclusion =
    bc === 0 && wc === 0 && ic === 0 ?
      "未发现阻断问题或警告。"
    : bc === 0 && wc === 0 ?
      `未发现阻断问题或警告；有 ${ic} 条信息。`
    : `发现 ${bc} 个阻断问题，${wc} 个警告${ic > 0 ? `，${ic} 条信息` : ""}。`;

  const lines: string[] = [`# Chief-of-Staff 审计`, ``, `结论：${conclusion}`, ``];

  lines.push(`## 总览`, ``);
  lines.push(`- 任务总数（${laneFilter ? `lane=${laneFilter}` : "全部"}）：${scoped.length}`);
  lines.push(`- lanes：${lanesLabel}`);
  lines.push(`- pending：${counts.pending}`);
  lines.push(`- waiting_for_cursor_agent：${counts.waiting_for_cursor_agent}`);
  lines.push(`- running：${counts.running}`);
  lines.push(`- done：${counts.done}`);
  lines.push(`- blocked：${counts.blocked}`);
  lines.push(`- failed：${counts.failed}`);
  lines.push(`- Cursor 工兵任务（worker_route=cursor_agent）：${cursorCount}`);
  lines.push(`- external 工兵任务：${externalCount}`);
  lines.push(`- host_assisted：${hostAssistedCount}`);
  lines.push(`- worker_route 未知字符串：${unknownRoute}`);
  lines.push(`- 未指定 worker_route：${unspecifiedRoute}`);
  lines.push(``);

  if (bc > 0) {
    lines.push(...formatLimitedSection("阻断问题", blockers, limit));
  }
  if (wc > 0) {
    lines.push(...formatLimitedSection("警告", warnings, limit));
  }
  if (ic > 0) {
    lines.push(...formatLimitedSection("信息", infos, limit));
  }

  lines.push(`## 建议下一步`, ``);
  if (bc > 0) {
    lines.push(`先修复阻断问题；然后处理警告。可运行 \`chief_next_action\` 获取执行顺序，或用 \`chief_repair\` 补齐缺失基础目录。`);
  } else if (wc > 0) {
    lines.push(`处理警告后可运行 \`chief_next_action\`。`);
  } else {
    lines.push(`可以运行 \`chief_next_action\` 获取下一步建议。`);
  }

  return lines.join("\n").trimEnd() + "\n";
}
