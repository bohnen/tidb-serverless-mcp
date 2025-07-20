import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as dotenv from "dotenv";
import { TiDBConnector } from "./connector.js";
import { createServer, setupToolHandlers, validateConfig, getDefaultConfig } from "./server-common.js";

dotenv.config();

let tidbConnector: TiDBConnector | null = null;

const server = createServer();

setupToolHandlers(server, () => tidbConnector);

async function main() {
  try {
    console.error("Starting TiDB Cloud Serverless MCP server (stdio)...");

    const config = getDefaultConfig();
    validateConfig(config);

    tidbConnector = new TiDBConnector(config);
    console.error(`Connected to TiDB: ${config.host}:${config.port}/${config.database}`);

    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("MCP server running on stdio transport");
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.error("Shutting down...");
  if (tidbConnector) {
    await tidbConnector.close();
  }
  process.exit(0);
});

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});