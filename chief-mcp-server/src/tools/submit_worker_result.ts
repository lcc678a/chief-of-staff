import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { PROJECT_ROOT } from "../lib/paths.js";
import { getTask, updateTask } from "../lib/tasks_store.js";

export const submitWorkerResultInputSchema = z.object({
  task_id: z.string(),
  reported_model: z.string().optional(),
  summary: z.string(),
  details: z.string()
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

export async function submitWorkerResult(rawInput: unknown): Promise<string> {
  const input: SubmitWorkerResultInput = submitWorkerResultInputSchema.parse(rawInput);
  const task = await getTask(input.task_id);
  if (!task) {
    return `任务不存在：${input.task_id}`;
  }
  if (task.status !== "waiting_for_cursor_agent") {
    return `任务 ${input.task_id} 当前状态是 ${task.status}，只有 waiting_for_cursor_agent 才能提交 Cursor 工兵结果。`;
  }

  const rawTrimmed = input.reported_model?.trim() ?? "";
  const storedReported = rawTrimmed === "" ? "unknown" : rawTrimmed;

  const { effectiveModel, usedSuggestedFallback } = computeEffectiveModel({
    suggested_model: task.suggested_model,
    reported_model_raw: storedReported
  });

  const resultRelativePath = toResultRelativePath(task.id);
  const resultAbsolutePath = path.join(PROJECT_ROOT, resultRelativePath);
  await mkdir(path.dirname(resultAbsolutePath), { recursive: true });

  const metaLines = [
    `- suggested_model: ${task.suggested_model ?? "(none)"}`,
    `- reported_model: ${storedReported}`,
    `- effective_model: ${effectiveModel}`
  ];
  if (storedReported === "unknown" && usedSuggestedFallback) {
    metaLines.push("- 说明：实际模型未由 Cursor 暴露，按建议模型记录。");
  }
  metaLines.push(`- submitted_at: ${new Date().toISOString()}`);

  const detailsContent = [
    `# ${task.id} Cursor Agent Result`,
    "",
    ...metaLines,
    "",
    "## Details",
    "",
    input.details
  ].join("\n");

  await writeFile(resultAbsolutePath, detailsContent, "utf-8");

  await updateTask(task.id, {
    status: "done",
    worker_route: "cursor_agent",
    reported_model: storedReported,
    result_file: resultRelativePath,
    summary: input.summary,
    provider: "cursor_agent",
    model: effectiveModel,
    finished_at: new Date().toISOString(),
    error: undefined
  });

  const modelHint =
    storedReported === "unknown" && usedSuggestedFallback
      ? `\n- 说明：实际模型未由 Cursor 暴露，按建议模型记录`
      : "";

  return `已提交 Cursor 工兵结果：${task.id}

- 状态：done
- 工兵路线：Cursor Agent Worker
- reported_model（原始）：${storedReported}
- effective_model：${effectiveModel}${modelHint}
- 结果文件：${resultRelativePath}`;
}
