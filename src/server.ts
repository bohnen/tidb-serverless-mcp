import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import * as dotenv from "dotenv";
import { TiDBConfig, TiDBConnector } from "./connector.js";

// Type definitions for better type safety
interface ToolArgs {
  [key: string]: any;
}

interface SwitchDatabaseArgs extends ToolArgs {
  db_name: string;
  username?: string;
  password?: string;
}

interface QueryArgs extends ToolArgs {
  sql_stmt: string;
}

interface ExecuteArgs extends ToolArgs {
  sql_stmts: string | string[];
}

interface CreateUserArgs extends ToolArgs {
  username: string;
  password: string;
}

interface RemoveUserArgs extends ToolArgs {
  username: string;
}

dotenv.config();

let tidbConnector: TiDBConnector | null = null;

const server = new Server(
  {
    name: "tidb-unofficial-mcp",
    version: "0.2.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "show_databases",
      description: "Show all databases in the TiDB cluster",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    {
      name: "switch_database",
      description: "Switch to a specific database. Note: The user has already specified the database in the configuration, so you don't need to switch database before you execute the sql statements.",
      inputSchema: {
        type: "object",
        properties: {
          db_name: {
            type: "string",
            description: "The name of the database to switch to",
          },
          username: {
            type: "string",
            description: "Optional username for the new connection",
          },
          password: {
            type: "string",
            description: "Optional password for the new connection",
          },
        },
        required: ["db_name"],
      },
    },
    {
      name: "show_tables",
      description: "Show all tables in the current database",
      inputSchema: {
        type: "object",
        properties: {},
        required: [],
      },
    },
    {
      name: "db_query",
      description: "Query data from TiDB database via SQL. Best practices: use LIMIT for SELECT statements to avoid too many rows returned. Use this for SELECT/SHOW/DESCRIBE/EXPLAIN read-only statements.",
      inputSchema: {
        type: "object",
        properties: {
          sql_stmt: {
            type: "string",
            description: "The SQL query statement to execute",
          },
        },
        required: ["sql_stmt"],
      },
    },
    {
      name: "db_execute",
      description: "Execute operations on TiDB database via SQL. Use this for INSERT/UPDATE/DELETE/CREATE/DROP statements. Can accept a single statement or an array of statements that will be executed in a transaction.",
      inputSchema: {
        type: "object",
        properties: {
          sql_stmts: {
            oneOf: [
              { type: "string", description: "A single SQL statement" },
              { type: "array", items: { type: "string" }, description: "Array of SQL statements" },
            ],
            description: "SQL statement(s) to execute",
          },
        },
        required: ["sql_stmts"],
      },
    },
    {
      name: "db_create_user",
      description: "Create a new database user. Will return the username with prefix for TiDB Serverless.",
      inputSchema: {
        type: "object",
        properties: {
          username: {
            type: "string",
            description: "The username for the new user",
          },
          password: {
            type: "string",
            description: "The password for the new user",
          },
        },
        required: ["username", "password"],
      },
    },
    {
      name: "db_remove_user",
      description: "Remove a database user from the TiDB cluster",
      inputSchema: {
        type: "object",
        properties: {
          username: {
            type: "string",
            description: "The username to remove",
          },
        },
        required: ["username"],
      },
    },
  ],
}));

/**
 * Validates and sanitizes user input arguments
 */
function validateToolArgs<T extends ToolArgs>(args: any, requiredFields: string[]): T {
  if (!args || typeof args !== 'object') {
    throw new McpError(ErrorCode.InvalidParams, 'Invalid arguments provided');
  }

  for (const field of requiredFields) {
    if (!(field in args) || args[field] === undefined || args[field] === null) {
      throw new McpError(ErrorCode.InvalidParams, `Missing required field: ${field}`);
    }
  }

  return args as T;
}

/**
 * Sanitizes error messages to prevent information disclosure
 */
function sanitizeError(error: any): string {
  // Remove sensitive information from error messages
  const message = error.message || 'Unknown error occurred';
  
  // Remove connection details, file paths, and other sensitive info
  return message
    .replace(/host=[^,\s]+/gi, 'host=***')
    .replace(/password=[^,\s]+/gi, 'password=***')
    .replace(/user=[^,\s]+/gi, 'user=***')
    .replace(/\/[^\s]+\//g, '/***/')
    .substring(0, 200); // Limit error message length
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (!tidbConnector) {
    throw new McpError(
      ErrorCode.InternalError,
      "TiDB connection not initialized. Please check your configuration."
    );
  }

  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "show_databases": {
        const databases = await tidbConnector.showDatabases();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(databases, null, 2),
            },
          ],
        };
      }

      case "switch_database": {
        const validatedArgs = validateToolArgs<SwitchDatabaseArgs>(args, ['db_name']);
        const { db_name, username, password } = validatedArgs;
        await tidbConnector.switchDatabase(db_name, username, password);
        return {
          content: [
            {
              type: "text",
              text: `Successfully switched to database: ${db_name}`,
            },
          ],
        };
      }

      case "show_tables": {
        const tables = await tidbConnector.showTables();
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(tables, null, 2),
            },
          ],
        };
      }

      case "db_query": {
        const validatedArgs = validateToolArgs<QueryArgs>(args, ['sql_stmt']);
        const { sql_stmt } = validatedArgs;
        const result = await tidbConnector.query(sql_stmt);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      }

      case "db_execute": {
        const validatedArgs = validateToolArgs<ExecuteArgs>(args, ['sql_stmts']);
        const { sql_stmts } = validatedArgs;
        const results = await tidbConnector.execute(sql_stmts);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(results, null, 2),
            },
          ],
        };
      }

      case "db_create_user": {
        const validatedArgs = validateToolArgs<CreateUserArgs>(args, ['username', 'password']);
        const { username, password } = validatedArgs;
        const fullUsername = await tidbConnector.createUser(username, password);
        return {
          content: [
            {
              type: "text",
              text: `Successfully created user: ${fullUsername}`,
            },
          ],
        };
      }

      case "db_remove_user": {
        const validatedArgs = validateToolArgs<RemoveUserArgs>(args, ['username']);
        const { username } = validatedArgs;
        await tidbConnector.removeUser(username);
        return {
          content: [
            {
              type: "text",
              text: `Successfully removed user: ${username}`,
            },
          ],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error: any) {
    console.error(`Error executing tool ${name}:`, error);
    const sanitizedMessage = sanitizeError(error);
    throw new McpError(
      ErrorCode.InternalError,
      `Failed to execute ${name}: ${sanitizedMessage}`
    );
  }
});

/**
 * Validates TiDB configuration
 */
function validateConfig(config: TiDBConfig): void {
  if (!config.databaseUrl && !config.host) {
    throw new Error('Either DATABASE_URL or HOST must be provided');
  }
  
  if (!config.databaseUrl && !config.username) {
    throw new Error('USERNAME is required when not using DATABASE_URL');
  }
  
  if (config.port && (config.port < 1 || config.port > 65535)) {
    throw new Error('Invalid port number');
  }
}

async function main() {
  try {
    console.error("Starting TiDB Cloud Serverless MCP server...");

    const config: TiDBConfig = {
      databaseUrl: process.env.TIDB_DATABASE_URL,
      host: process.env.TIDB_HOST || "gateway01.us-west-2.prod.aws.tidbcloud.com",
      port: parseInt(process.env.TIDB_PORT || "4000"),
      username: process.env.TIDB_USERNAME || "root",
      password: process.env.TIDB_PASSWORD, // Don't default to empty string
      database: process.env.TIDB_DATABASE || "test",
      tls: process.env.TIDB_TLS ? process.env.TIDB_TLS.toLowerCase() === "true" : true,
      tlsCaPath: process.env.TIDB_TLS_CA_CERT_PATH || undefined,
    };

    // Validate configuration before proceeding
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