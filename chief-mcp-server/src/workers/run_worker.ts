import { appendFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { readConfig } from "../lib/config.js";
import { LOGS_DIR } from "../lib/paths.js";
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
  return fullText.replace(/\s+/g, " ").trim().slice(0, 100);
}

async function appendLog(logPath: string, text: string): Promise<void> {
  await appendFile(logPath, text, "utf-8");
}

async function main(): Promise<void> {
  const taskId = process.argv[2];
  if (!taskId) {
    return;
  }

  const relativeLogFile = path.posix.join(".chief", "logs", `${taskId}.log`);
  const absoluteLogFile = path.join(LOGS_DIR, `${taskId}.log`);

  await mkdir(LOGS_DIR, { recursive: true });
  await appendLog(
    absoluteLogFile,
    `\n=== worker start ===\ntask_id=${taskId}\nstarted_at=${new Date().toISOString()}\n`
  );

  try {
    const task = await getTask(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const config = await readConfig();
    const providerName = config.default_provider;
    const providerConfig = config.providers[providerName];
    if (!providerConfig) {
      throw new Error(`Provider config missing for ${providerName}`);
    }
    const model = providerConfig.models[task.model_level];
    const provider = getProvider(providerName, config);

    await updateTask(taskId, {
      provider: providerName,
      model
    });

    await appendLog(absoluteLogFile, `provider=${provider.name}\nmodel=${model}\n\n`);

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
        void appendLog(absoluteLogFile, text);
      }
    });

    const summary = extractSummary(fullText);
    await appendLog(absoluteLogFile, `\n\n=== worker done ===\nfinished_at=${new Date().toISOString()}\n`);

    await updateTask(taskId, {
      status: "done",
      finished_at: new Date().toISOString(),
      summary,
      log_file: relativeLogFile,
      error: undefined,
      pid: undefined
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.stack ?? error.message : String(error);
    await appendLog(absoluteLogFile, `\n\n=== worker failed ===\n${message}\n`);
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
