import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { PROJECT_ROOT } from "../lib/paths.js";
import { getTask, updateTask } from "../lib/tasks_store.js";
import type { Task, TaskStatus } from "../types.js";

export const submitWorkerResultInputSchema = z.object({
  task_id: z.string(),
  outcome: z.enum(["done", "blocked", "failed"]).optional(),
  reported_model: z.string().optional(),
  summary: z.string(),
  details: z.string(),
  needs: z.string().optional()
});

type SubmitWorkerResultInput = z.infer<typeof submitWorkerResultInputSchema>;

function toResultRelativePath(taskId: string): string {
  return `.chief/results/${taskId}.md`;
}

function computeEffectiveModel(task: {
  suggested_model?: string;
  reported_model_raw: string;
}): { effectiveModel: string; usedSuggestedFallback: boolean } {
  const raw = task.reported_model_raw;
  const isUnknown = raw === "" || raw === "unknown";

  if (!isUnknown) {
    return { effectiveModel: raw, usedSuggestedFallback: false };
  }

  const suggested = task.suggested_model;
  if (suggested && suggested !== "user-selected") {
    return { effectiveModel: suggested, usedSuggestedFallback: true };
  }

  return { effectiveModel: "unknown", usedSuggestedFallback: false };
}

function buildBlockedError(details: string, needs: string | undefined, summary: string): string {
  const d = details.trim();
  const n = needs?.trim() ?? "";
  const s = summary.trim();
  if (d) return d;
  if (n) return n;
  return s;
}

function buildResultFileContent(params: {
  taskId: string;
  task: Task;
  outcome: "done" | "blocked" | "failed";
  status: TaskStatus;
  storedReported: string;
  effectiveModel: string;
  usedSuggestedFallback: boolean;
  summary: string;
  detailsBody: string;
  needsDisplay: string | undefined;
  submittedAt: string;
}): string {
  const lines: string[] = [
    `# ${params.taskId} Cursor Agent Result`,
    "",
    `- task_id: ${params.taskId}`,
    `- outcome: ${params.outcome}`,
    `- status: ${params.status}`,
    `- worker_route: cursor_agent`,
    `- suggested_model: ${params.task.suggested_model ?? "(none)"}`,
    `- reported_model: ${params.storedReported}`,
    `- effective_model: ${params.effectiveModel}`
  ];

  if (params.storedReported === "unknown" && params.usedSuggestedFallback) {
    lines.push("- 说明：实际模型未由 Cursor 暴露，按建议模型记录。");
  }

  lines.push(`- summary: ${params.summary}`);

  if (params.needsDisplay !== undefined) {
    lines.push(`- needs: ${params.needsDisplay}`);
  }

  lines.push(`- submitted_at: ${params.submittedAt}`);
  lines.push("");
  lines.push("## Details");
  lines.push("");
  lines.push(params.detailsBody);

  return lines.join("\n");
}

export async function submitWorkerResult(rawInput: unknown): Promise<string> {
  const input: SubmitWorkerResultInput = submitWorkerResultInputSchema.parse(rawInput);
  const task = await getTask(input.task_id);
  if (!task) {
    return `任务不存在：${input.task_id}`;
  }
  if (task.status !== "waiting_for_cursor_agent") {
    return `任务 ${input.task_id} 当前状态是 ${task.status}，只有 waiting_for_cursor_agent 才能提交 Cursor 工兵结果。`;
  }

  const outcome = input.outcome ?? "done";

  const rawTrimmed = input.reported_model?.trim() ?? "";
  const storedReported = rawTrimmed === "" ? "unknown" : rawTrimmed;

  const { effectiveModel, usedSuggestedFallback } = computeEffectiveModel({
    suggested_model: task.suggested_model,
    reported_model_raw: storedReported
  });

  const resultRelativePath = toResultRelativePath(task.id);
  const resultAbsolutePath = path.join(PROJECT_ROOT, resultRelativePath);
  await mkdir(path.dirname(resultAbsolutePath), { recursive: true });

  const submittedAt = new Date().toISOString();

  if (outcome === "done") {
    const content = buildResultFileContent({
      taskId: task.id,
      task,
      outcome: "done",
      status: "done",
      storedReported,
      effectiveModel,
      usedSuggestedFallback,
      summary: input.summary,
      detailsBody: input.details,
      needsDisplay: undefined,
      submittedAt
    });

    await writeFile(resultAbsolutePath, content, "utf-8");

    await updateTask(task.id, {
      status: "done",
      outcome: "done",
      worker_route: "cursor_agent",
      reported_model: storedReported,
      result_file: resultRelativePath,
      summary: input.summary,
      provider: "cursor_agent",
      model: effectiveModel,
      finished_at: submittedAt,
      error: undefined,
      needs: undefined
    });

    const modelHint =
      storedReported === "unknown" && usedSuggestedFallback
        ? `\n- 说明：实际模型未由 Cursor 暴露，按建议模型记录`
        : "";

    return `已提交 Cursor 工兵结果：${task.id}

- 状态：done
- outcome：done
- 工兵路线：Cursor Agent Worker
- reported_model（原始）：${storedReported}
- effective_model：${effectiveModel}${modelHint}
- 结果文件：${resultRelativePath}`;
  }

  if (outcome === "blocked") {
    const needsVal = input.needs?.trim() ?? "";
    const needsDisplay = needsVal || "(empty)";
    const err = buildBlockedError(input.details, input.needs, input.summary);

    const content = buildResultFileContent({
      taskId: task.id,
      task,
      outcome: "blocked",
      status: "blocked",
      storedReported,
      effectiveModel,
      usedSuggestedFallback,
      summary: input.summary,
      detailsBody: input.details,
      needsDisplay,
      submittedAt
    });

    await writeFile(resultAbsolutePath, content, "utf-8");

    await updateTask(task.id, {
      status: "blocked",
      outcome: "blocked",
      worker_route: "cursor_agent",
      provider: "cursor_agent",
      model: effectiveModel,
      reported_model: storedReported,
      result_file: resultRelativePath,
      summary: input.summary,
      needs: needsVal || undefined,
      finished_at: submittedAt,
      error: err
    });

    const needsHint =
      !needsVal
        ? "\n\n提示：`needs` 为空，建议在 `submit_worker_result` 中补充「需要用户或参谋确认什么」。"
        : "";

    return `工兵已回传阻塞：${task.id}

- 状态：blocked
- 摘要：${input.summary}
- 需要：${needsVal || "（未填）"}
- 结果文件：${resultRelativePath}${needsHint}`;
  }

  const errFailed = input.details.trim() || input.summary.trim();

  const content = buildResultFileContent({
    taskId: task.id,
    task,
    outcome: "failed",
    status: "failed",
    storedReported,
    effectiveModel,
    usedSuggestedFallback,
    summary: input.summary,
    detailsBody: input.details,
    needsDisplay: undefined,
    submittedAt
  });

  await writeFile(resultAbsolutePath, content, "utf-8");

  await updateTask(task.id, {
    status: "failed",
    outcome: "failed",
    worker_route: "cursor_agent",
    provider: "cursor_agent",
    model: effectiveModel,
    reported_model: storedReported,
    result_file: resultRelativePath,
    summary: input.summary,
    finished_at: submittedAt,
    error: errFailed,
    needs: undefined
  });

  return `工兵已回传失败：${task.id}

- 状态：failed
- 摘要：${input.summary}
- 结果文件：${resultRelativePath}`;
}
