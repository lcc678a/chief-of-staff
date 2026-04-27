import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { zodToJsonSchema } from "zod-to-json-schema";
import { planTasks, planTasksInputSchema } from "./tools/plan_tasks.js";

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
        inputSchema: zodToJsonSchema(planTasksInputSchema, {
          target: "jsonSchema7"
        })
      }
    ]
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name !== "plan_tasks") {
    throw new Error(`Unknown tool: ${request.params.name}`);
  }

  const markdownTable = await planTasks(request.params.arguments ?? {});
  return {
    content: [
      {
        type: "text",
        text: markdownTable
      }
    ]
  };
});

async function main(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
