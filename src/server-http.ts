import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import * as dotenv from "dotenv";
import { TiDBConnector } from "./connector.js";
import { validateConfig, getDefaultConfig } from "./server-common.js";

dotenv.config();

const DEFAULT_HTTP_PORT = 3000;

function createMcpServer(): McpServer {
  return new McpServer({
    name: "tidb-unofficial-mcp",
    version: "0.2.0",
  });
}

function setupMcpServer(server: McpServer, tidbConnector: TiDBConnector) {
  // Register all tools
  server.registerTool(
    "show_databases",
    {
      title: "Show Databases",
      description: "Show all databases in the TiDB cluster",
      inputSchema: {},
    },
    async () => {
      const databases = await tidbConnector.showDatabases();
      return {
        content: [{
          type: "text",
          text: JSON.stringify(databases, null, 2),
        }],
      };
    }
  );

  server.registerTool(
    "switch_database",
    {
      title: "Switch Database",
      description: "Switch to a specific database",
      inputSchema: {
        db_name: z.string().describe("Name of the database to switch to"),
        username: z.string().optional().describe("Optional username"),
        password: z.string().optional().describe("Optional password"),
      },
    },
    async ({ db_name, username, password }) => {
      await tidbConnector.switchDatabase(db_name, username, password);
      return {
        content: [{
          type: "text",
          text: `Successfully switched to database: ${db_name}`,
        }],
      };
    }
  );

  server.registerTool(
    "show_tables",
    {
      title: "Show Tables",
      description: "Show all tables in the current database",
      inputSchema: {},
    },
    async () => {
      const tables = await tidbConnector.showTables();
      return {
        content: [{
          type: "text",
          text: JSON.stringify(tables, null, 2),
        }],
      };
    }
  );

  server.registerTool(
    "db_query",
    {
      title: "Database Query",
      description: "Execute SQL queries",
      inputSchema: {
        sql_stmt: z.string().describe("SQL query statement"),
      },
    },
    async ({ sql_stmt }) => {
      const result = await tidbConnector.query(sql_stmt);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(result, null, 2),
        }],
      };
    }
  );

  server.registerTool(
    "db_execute",
    {
      title: "Database Execute",
      description: "Execute SQL operations",
      inputSchema: {
        sql_stmts: z.union([z.string(), z.array(z.string())]).describe("SQL statement(s) to execute"),
      },
    },
    async ({ sql_stmts }) => {
      const results = await tidbConnector.execute(sql_stmts);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(results, null, 2),
        }],
      };
    }
  );

  server.registerTool(
    "db_create_user",
    {
      title: "Create Database User",
      description: "Create a new database user",
      inputSchema: {
        username: z.string().describe("Username for new user"),
        password: z.string().describe("Password for new user"),
      },
    },
    async ({ username, password }) => {
      const fullUsername = await tidbConnector.createUser(username, password);
      return {
        content: [{
          type: "text",
          text: `Successfully created user: ${fullUsername}`,
        }],
      };
    }
  );

  server.registerTool(
    "db_remove_user",
    {
      title: "Remove Database User",
      description: "Remove a database user",
      inputSchema: {
        username: z.string().describe("Username to remove"),
      },
    },
    async ({ username }) => {
      await tidbConnector.removeUser(username);
      return {
        content: [{
          type: "text",
          text: `Successfully removed user: ${username}`,
        }],
      };
    }
  );

  return server;
}

async function main() {
  try {
    console.error("Starting TiDB Cloud Serverless MCP server (Streamable HTTP)...");

    const config = getDefaultConfig();
    validateConfig(config);

    const tidbConnector = new TiDBConnector(config);
    console.error(`Connected to TiDB: ${config.host}:${config.port}/${config.database}`);

    const port = parseInt(process.env.MCP_HTTP_PORT || DEFAULT_HTTP_PORT.toString());
    const app = express();
    
    // Configure CORS
    app.use(cors({
      origin: process.env.MCP_CORS_ORIGIN || "*",
      exposedHeaders: ["Mcp-Session-Id"],
      allowedHeaders: ["Content-Type", "mcp-session-id"],
      credentials: true,
    }));
    
    app.use(express.json());
    
    // Map to store transports by session ID
    const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};
    
    // Handle POST requests for client-to-server communication
    app.post('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      let transport: StreamableHTTPServerTransport;
      
      if (sessionId && transports[sessionId]) {
        // Reuse existing transport
        transport = transports[sessionId];
      } else if (!sessionId && isInitializeRequest(req.body)) {
        // New initialization request
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sessionId) => {
            transports[sessionId] = transport;
          },
        });
        
        // Clean up transport when closed
        transport.onclose = () => {
          if (transport.sessionId) {
            delete transports[transport.sessionId];
          }
        };
        
        const server = createMcpServer();
        setupMcpServer(server, tidbConnector);
        
        // Connect to the MCP server
        await server.connect(transport);
      } else {
        // Invalid request
        res.status(400).json({
          jsonrpc: '2.0',
          error: {
            code: -32000,
            message: 'Bad Request: No valid session ID provided',
          },
          id: null,
        });
        return;
      }
      
      // Handle the request
      await transport.handleRequest(req, res, req.body);
    });
    
    // Handle GET requests for server-to-client notifications via SSE
    app.get('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      if (!sessionId || !transports[sessionId]) {
        res.status(400).send('Invalid or missing session ID');
        return;
      }
      
      const transport = transports[sessionId];
      await transport.handleRequest(req, res);
    });
    
    // Handle DELETE requests for session termination
    app.delete('/mcp', async (req, res) => {
      const sessionId = req.headers['mcp-session-id'] as string | undefined;
      if (!sessionId || !transports[sessionId]) {
        res.status(400).send('Invalid or missing session ID');
        return;
      }
      
      const transport = transports[sessionId];
      await transport.handleRequest(req, res);
    });
    
    app.listen(port, () => {
      console.error(`MCP server running on Streamable HTTP port ${port}`);
      console.error(`Endpoint: http://localhost:${port}/mcp`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on("SIGINT", async () => {
  console.error("Shutting down...");
  process.exit(0);
});

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});