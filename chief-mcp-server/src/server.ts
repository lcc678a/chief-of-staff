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
import { getWorkerBoard, getWorkerBoardInputSchema } from "./tools/get_worker_board.js";
import { ensureDefaultConfigFile } from "./lib/config.js";

function toJsonSchema(schema: ZodTypeAny): object {
  return zodToJsonSchema(schema, { target: "jsonSchema7" });
}

const server = new Server(
  {
    name: "chief-mcp-server",
    version: "0.1.0"
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
        description: "Dispatch one pending task to worker process",
        inputSchema: toJsonSchema(dispatchWorkerInputSchema)
      },
      {
        name: "get_worker_status",
        description: "Get worker task status with latest log tail",
        inputSchema: toJsonSchema(getWorkerStatusInputSchema)
      },
      {
        name: "get_worker_summary",
        description: "Get final summary or error for a task",
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
        name: "get_worker_board",
        description: "Get lane-based worker board for current tasks",
        inputSchema: toJsonSchema(getWorkerBoardInputSchema)
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
    case "get_worker_board":
      text = await getWorkerBoard(args);
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
  await ensureDefaultConfigFile();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
