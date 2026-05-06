import { appendFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { readConfig } from "../lib/config.js";
import { LOGS_DIR, RESULTS_DIR } from "../lib/paths.js";
import { getTask, updateTask } from "../lib/tasks_store.js";
import { getProvider } from "./providers/index.js";

function extractSummary(fullText: string): string {
  const lines = fullText.trim().split(/\r?\n/).map((line) => line.trim());
  for (let index = lines.length - 1; index >= 0; index -= 1) {
    const line = lines[index];
    if (line.startsWith("SUMMARY:")) {
      const summary = line.slice("SUMMARY:".length).trim();
      if (summary) {
        return summary;
      }
    }
  }
  const collapsed = fullText.replace(/\s+/g, " ").trim();
  return collapsed.length > 200 ? `${collapsed.slice(0, 200)}…` : collapsed;
}

/**
 * Serialize all log writes through a single chained Promise so streaming
 * chunks land on disk in the same order they arrived from the provider.
 *
 * The previous implementation issued `void appendLog(...)` from within an
 * `onChunk` callback. Multiple in-flight `appendFile` calls could resolve
 * out of order, so streaming output could be jumbled or partially lost.
 */
function makeLogQueue(logPath: string): {
  enqueue: (text: string) => void;
  flush: () => Promise<void>;
} {
  let queue: Promise<void> = Promise.resolve();
  const enqueue = (text: string): void => {
    queue = queue.then(() => appendFile(logPath, text, "utf-8")).catch(() => {
      // Logging failure must never crash the worker; the actual task error
      // path will surface real failures to the task ledger.
    });
  };
  const flush = async (): Promise<void> => {
    await queue;
  };
  return { enqueue, flush };
}

function buildResultFileBody(params: {
  taskId: string;
  provider: string;
  model: string;
  description: string;
  startedAt: string;
  finishedAt: string;
  summary: string;
  fullText: string;
}): string {
  return [
    `# ${params.taskId} External API Worker Result`,
    "",
    `- task_id: ${params.taskId}`,
    `- worker_route: external`,
    `- provider: ${params.provider}`,
    `- model: ${params.model}`,
    `- started_at: ${params.startedAt}`,
    `- finished_at: ${params.finishedAt}`,
    `- summary: ${params.summary}`,
    "",
    "## Task description",
    "",
    params.description,
    "",
    "## Full output",
    "",
    params.fullText.trimEnd(),
    ""
  ].join("\n");
}

async function main(): Promise<void> {
  const taskId = process.argv[2];
  if (!taskId) {
    return;
  }

  const relativeLogFile = path.posix.join(".chief", "logs", `${taskId}.log`);
  const absoluteLogFile = path.join(LOGS_DIR, `${taskId}.log`);
  const relativeResultFile = path.posix.join(".chief", "results", `${taskId}.md`);
  const absoluteResultFile = path.join(RESULTS_DIR, `${taskId}.md`);

  await mkdir(LOGS_DIR, { recursive: true });
  await mkdir(RESULTS_DIR, { recursive: true });

  const startedAt = new Date().toISOString();
  const log = makeLogQueue(absoluteLogFile);
  log.enqueue(
    `\n=== worker start ===\ntask_id=${taskId}\nstarted_at=${startedAt}\n`
  );

  try {
    const task = await getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const config = await readConfig();
    const providerName = task.provider?.trim() || config.default_provider;
    const providerConfig = config.providers[providerName];
    if (!providerConfig) {
      throw new Error(
        `Provider config missing for "${providerName}" (check .chief/config.json)`
      );
    }
    const model = task.model?.trim() || providerConfig.models[task.model_level];
    if (!model || model.trim() === "") {
      throw new Error(
        `Model not resolved for provider "${providerName}" / model_level=${task.model_level}`
      );
    }
    const provider = getProvider(providerName, config);

    await updateTask(taskId, {
      provider: providerName,
      model
    });

    log.enqueue(`provider=${provider.name}\nmodel=${model}\n\n`);

    const systemPrompt = [
      "You are a worker assistant. The user gives you a task description.",
      "Produce a clear, actionable result. Reply in the same language as the task description.",
      "At the very end, output one line starting with 'SUMMARY:' followed by a one-sentence summary."
    ].join(" ");

    const fullText = await provider.complete({
      model,
      system: systemPrompt,
      user: task.description,
      onChunk: (text) => {
        log.enqueue(text);
      }
    });

    const finishedAt = new Date().toISOString();
    const summary = extractSummary(fullText);

    log.enqueue(`\n\n=== worker done ===\nfinished_at=${finishedAt}\n`);
    await log.flush();

    const resultBody = buildResultFileBody({
      taskId,
      provider: provider.name,
      model,
      description: task.description,
      startedAt,
      finishedAt,
      summary,
      fullText
    });
    await writeFile(absoluteResultFile, resultBody, "utf-8");

    await updateTask(taskId, {
      status: "done",
      finished_at: finishedAt,
      summary,
      result_file: relativeResultFile,
      log_file: relativeLogFile,
      error: undefined,
      pid: undefined
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    log.enqueue(`\n\n=== worker failed ===\n${message}\n`);
    await log.flush();
    await updateTask(taskId, {
      status: "failed",
      finished_at: new Date().toISOString(),
      error: message,
      log_file: relativeLogFile,
      pid: undefined
    });
  }
}

void main();
