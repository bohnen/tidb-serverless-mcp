import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { spawn, ChildProcess } from "child_process";
import { readFileSync } from "fs";
import * as dotenv from "dotenv";

// Load test configuration
dotenv.config();
const config = {
  TIDB_HOST: process.env.TIDB_HOST,
  TIDB_PORT: process.env.TIDB_PORT,
  TIDB_USERNAME: process.env.TIDB_USERNAME,
  TIDB_PASSWORD: process.env.TIDB_PASSWORD,
  TIDB_DATABASE: process.env.TIDB_DATABASE,
  TIDB_TLS: process.env.TIDB_TLS || "true",
};

const HTTP_PORT = 3457 + Math.floor(Math.random() * 1000);
const SERVER_URL = `http://localhost:${HTTP_PORT}`;

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function startHttpServer(): Promise<ChildProcess> {
  const server = spawn("node", ["dist/server-http.js"], {
    env: {
      ...process.env,
      ...config,
      MCP_HTTP_PORT: HTTP_PORT.toString(),
      MCP_CORS_ORIGIN: "*",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  // Wait for server to start
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Server startup timeout"));
    }, 10000);

    server.stderr?.on("data", (data) => {
      const message = data.toString();
      console.error("Server stderr:", message);
      if (message.includes(`MCP server running on Streamable HTTP port ${HTTP_PORT}`)) {
        clearTimeout(timeout);
        resolve();
      }
    });

    server.on("error", (err) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  return server;
}

async function stopHttpServer(server: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    server.on("close", () => resolve());
    server.kill("SIGINT");
  });
}

async function runTests() {
  console.log("Starting HTTP server integration tests...");
  
  let server: ChildProcess | null = null;
  let client: Client | null = null;

  try {
    // Start HTTP server
    console.log("Starting HTTP server...");
    server = await startHttpServer();
    
    // Create Streamable HTTP client transport
    const transport = new StreamableHTTPClientTransport(new URL(`${SERVER_URL}/mcp`));
    
    // Create client
    client = new Client({
      name: "test-client",
      version: "1.0.0",
    }, {
      capabilities: {},
    });

    await client.connect(transport);
    console.log("Connected to HTTP server");

    // Test 1: List available tools
    console.log("\nTest 1: Listing available tools...");
    const toolsResponse = await client.listTools();
    console.log(`Found ${toolsResponse.tools.length} tools`);
    
    const expectedTools = [
      "show_databases",
      "switch_database", 
      "show_tables",
      "db_query",
      "db_execute",
      "db_create_user",
      "db_remove_user",
    ];
    
    for (const toolName of expectedTools) {
      if (!toolsResponse.tools.find((t: any) => t.name === toolName)) {
        throw new Error(`Expected tool '${toolName}' not found`);
      }
    }
    console.log("✓ All expected tools available");

    // Test 2: Show databases
    console.log("\nTest 2: Showing databases...");
    const dbsResult = await client.callTool({
      name: "show_databases",
      arguments: {},
    });
    
    if (!dbsResult.content || (dbsResult.content as any[]).length === 0) {
      throw new Error("No databases returned");
    }
    
    const databases = JSON.parse(((dbsResult.content as any[])[0] as any).text);
    console.log(`✓ Found ${databases.length} databases`);

    // Test 3: Create and query test table
    console.log("\nTest 3: Creating test table...");
    const testTableName = `test_http_${Date.now()}`;
    
    await client.callTool({
      name: "db_execute",
      arguments: {
        sql_stmts: `CREATE TABLE ${testTableName} (id INT PRIMARY KEY, name VARCHAR(50))`,
      },
    });
    console.log("✓ Table created");

    // Insert test data
    console.log("\nTest 4: Inserting test data...");
    const insertResult = await client.callTool({
      name: "db_execute",
      arguments: {
        sql_stmts: [
          `INSERT INTO ${testTableName} (id, name) VALUES (1, 'HTTP Test 1')`,
          `INSERT INTO ${testTableName} (id, name) VALUES (2, 'HTTP Test 2')`,
        ],
      },
    });
    console.log("✓ Data inserted");

    // Query data
    console.log("\nTest 5: Querying data...");
    const queryResult = await client.callTool({
      name: "db_query",
      arguments: {
        sql_stmt: `SELECT * FROM ${testTableName} ORDER BY id`,
      },
    });
    
    const rows = JSON.parse(((queryResult.content as any[])[0] as any).text);
    if (rows.length !== 2) {
      throw new Error(`Expected 2 rows, got ${rows.length}`);
    }
    console.log("✓ Data queried successfully");

    // Cleanup
    console.log("\nTest 6: Cleaning up...");
    await client.callTool({
      name: "db_execute",
      arguments: {
        sql_stmts: `DROP TABLE ${testTableName}`,
      },
    });
    console.log("✓ Table dropped");

    // Test 7: Error handling
    console.log("\nTest 7: Testing error handling...");
    try {
      const errorResult = await client.callTool({
        name: "db_query",
        arguments: {
          sql_stmt: "SELECT * FROM non_existent_table_xyz",
        },
      });
      
      // Check if the result contains error information
      const content = (errorResult.content as any[])[0];
      if (content && content.text && 
          (content.text.includes("non_existent_table_xyz") || 
           content.text.includes("doesn't exist") ||
           content.text.includes("Table") ||
           content.text.includes("error"))) {
        console.log("✓ Error handling works correctly");
      } else {
        throw new Error("Expected error for non-existent table");
      }
    } catch (error: any) {
      if (error.message.includes("non_existent_table_xyz") || 
          error.message.includes("doesn't exist") ||
          error.message.includes("Table") ||
          error.code) {
        console.log("✓ Error handling works correctly");
      } else {
        console.log("Error details:", error);
        throw new Error("Expected error for non-existent table");
      }
    }

    console.log("\n✅ All HTTP server tests passed!");

  } catch (error) {
    console.error("\n❌ Test failed:", error);
    process.exit(1);
  } finally {
    // Cleanup
    if (client) {
      try {
        await client.close();
      } catch (e) {
        console.error("Error closing client:", e);
      }
    }
    
    if (server) {
      console.log("\nStopping HTTP server...");
      await stopHttpServer(server);
    }
  }
}

runTests().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});