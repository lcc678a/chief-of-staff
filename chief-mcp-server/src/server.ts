#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import type { ZodTypeAny } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { planTasks, planTasksInputSchema } from "./tools/plan_tasks.js";
import { dispatchWorker, dispatchWorkerInputSchema } from "./tools/dispatch_worker.js";
import { getWorkerStatus, getWorkerStatusInputSchema } from "./tools/get_worker_status.js";
import { getWorkerSummary, getWorkerSummaryInputSchema } from "./tools/get_worker_summary.js";
import {
  prepareCursorAgentTask,
  prepareCursorAgentTaskInputSchema
} from "./tools/prepare_cursor_agent_task.js";
import { submitWorkerResult, submitWorkerResultInputSchema } from "./tools/submit_worker_result.js";
import { chiefDoctor, chiefDoctorInputSchema } from "./tools/chief_doctor.js";
import { chiefRepair, chiefRepairInputSchema } from "./tools/chief_repair.js";
import { getWorkerBoard, getWorkerBoardInputSchema } from "./tools/get_worker_board.js";
import { chiefConfigHelp, chiefConfigHelpInputSchema } from "./tools/chief_config_help.js";
import {
  chiefExternalPreflight,
  chiefExternalPreflightInputSchema
} from "./tools/chief_external_preflight.js";
import { chiefNextAction, chiefNextActionInputSchema } from "./tools/chief_next_action.js";
import { chiefAudit, chiefAuditInputSchema } from "./tools/chief_audit.js";
import { ensureDefaultConfigFile } from "./lib/config.js";

function toJsonSchema(schema: ZodTypeAny): object {
  return zodToJsonSchema(schema, { target: "jsonSchema7" });
}

const server = new Server(
  {
    name: "chief-mcp-server",
    version: "0.1.3"
  },
  {
    capabilities: {
      tools: {}
    }
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "plan_tasks",
        description: "Append planned tasks into .chief/tasks.json",
        inputSchema: toJsonSchema(planTasksInputSchema)
      },
      {
        name: "dispatch_worker",
        description:
          "Spawn a detached External API Worker child process for one pending task. Returns immediately (background); Chief should NOT block the user waiting for the worker. Final result lands in `.chief/results/<task>.md` (`result_file`) plus a one-line `summary`; logs stream to `.chief/logs/<task>.log`. Provider key in config is free-form; the worker script path is resolved relative to the installed package, not the user project.",
        inputSchema: toJsonSchema(dispatchWorkerInputSchema)
      },
      {
        name: "get_worker_status",
        description:
          "Read worker task status (status / pid / provider / model / result_file / log_file) plus a short log tail. Default Chief usage: read this when the user asks 'is it done yet?'. Do NOT auto-open `result_file` or read the full log unless the user explicitly asks.",
        inputSchema: toJsonSchema(getWorkerStatusInputSchema)
      },
      {
        name: "get_worker_summary",
        description:
          "Read final outcome paths and the one-line `summary` for a task (status / outcome / result_file / log_file / summary / error). Default Chief usage: report these fields back to the user; do NOT inline the full result file content unless the user explicitly asks for it.",
        inputSchema: toJsonSchema(getWorkerSummaryInputSchema)
      },
      {
        name: "prepare_cursor_agent_task",
        description: "Prepare one pending task for Cursor Agent Worker handoff",
        inputSchema: toJsonSchema(prepareCursorAgentTaskInputSchema)
      },
      {
        name: "submit_worker_result",
        description: "Submit Cursor Agent Worker execution result back to chief",
        inputSchema: toJsonSchema(submitWorkerResultInputSchema)
      },
      {
        name: "chief_doctor",
        description: "Inspect Chief-of-Staff project health and task progress",
        inputSchema: toJsonSchema(chiefDoctorInputSchema)
      },
      {
        name: "chief_repair",
        description:
          "Initialize or repair missing .chief layout (dirs, empty tasks.json, default config); dry_run to preview only",
        inputSchema: toJsonSchema(chiefRepairInputSchema)
      },
      {
        name: "get_worker_board",
        description: "Get lane-based worker board for current tasks",
        inputSchema: toJsonSchema(getWorkerBoardInputSchema)
      },
      {
        name: "chief_config_help",
        description:
          "Read-only guide: external API provider config, model mapping, API key env presence (no values, no network)",
        inputSchema: toJsonSchema(chiefConfigHelpInputSchema)
      },
      {
        name: "chief_external_preflight",
        description:
          "Read-only preflight before dispatch_worker: task/config/deps/route hints; no writes, no network, no secrets",
        inputSchema: toJsonSchema(chiefExternalPreflightInputSchema)
      },
      {
        name: "chief_next_action",
        description:
          "Read-only next-step advisor from task queue (blocked/failed/waiting/running/pending/done); no writes or dispatch",
        inputSchema: toJsonSchema(chiefNextActionInputSchema)
      },
      {
        name: "chief_audit",
        description:
          "Read-only consistency audit: duplicate ids, dependency links, missing artifacts, overlaps, orphans; no writes",
        inputSchema: toJsonSchema(chiefAuditInputSchema)
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const args = request.params.arguments ?? {};
  let text: string;

  switch (request.params.name) {
    case "plan_tasks":
      text = await planTasks(args);
      break;
    case "dispatch_worker":
      text = await dispatchWorker(args);
      break;
    case "get_worker_status":
      text = await getWorkerStatus(args);
      break;
    case "get_worker_summary":
      text = await getWorkerSummary(args);
      break;
    case "prepare_cursor_agent_task":
      text = await prepareCursorAgentTask(args);
      break;
    case "submit_worker_result":
      text = await submitWorkerResult(args);
      break;
    case "chief_doctor":
      text = await chiefDoctor(args);
      break;
    case "chief_repair":
      text = await chiefRepair(args);
      break;
    case "get_worker_board":
      text = await getWorkerBoard(args);
      break;
    case "chief_config_help":
      text = await chiefConfigHelp(args);
      break;
    case "chief_external_preflight":
      text = await chiefExternalPreflight(args);
      break;
    case "chief_next_action":
      text = await chiefNextAction(args);
      break;
    case "chief_audit":
      text = await chiefAudit(args);
      break;
    default:
      throw new Error(`Unknown tool: ${request.params.name}`);
  }

  return {
    content: [
      {
        type: "text",
        text
      }
    ]
  };
});

async function main(): Promise<void> {
  const cliArgs = process.argv.slice(2);
  const cmd = cliArgs[0];
  if (cmd === "init") {
    const { runInit } = await import("./cli/init.js");
    process.exit(await runInit());
  }
  if (cmd === "help" || cmd === "--help" || cmd === "-h") {
    const { printHelp } = await import("./cli/help.js");
    printHelp();
    process.exit(0);
  }

  await ensureDefaultConfigFile();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
