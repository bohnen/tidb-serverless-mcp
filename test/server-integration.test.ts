import assert from "assert";
import { describeAsync, itAsync, checkEnvVariables } from "./setup.js";
import { TiDBConnector, TiDBConfig } from "../src/connector.js";

checkEnvVariables();

const config: TiDBConfig = {
  host: process.env.TIDB_HOST!,
  port: parseInt(process.env.TIDB_PORT || "4000"),
  username: process.env.TIDB_USERNAME!,
  password: process.env.TIDB_PASSWORD!,
  database: process.env.TIDB_DATABASE || "test",
  tls: process.env.TIDB_TLS === 'true',
  tlsCaPath: process.env.TIDB_TLS_CA_CERT_PATH || undefined,
};

interface MCPContent {
  type: string;
  text: string;
}

interface MCPResponse {
  content: MCPContent[];
}

interface DatabaseRow {
  Database: string;
}

interface TableRow {
  name: string;
  id: number;
  created_at: Date;
}

// Mock MCP server tools following the actual implementation
class MockMCPServer {
  private connector: TiDBConnector;

  constructor() {
    this.connector = new TiDBConnector(config);
  }

  async showDatabases(): Promise<MCPResponse> {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(await this.connector.showDatabases(), null, 2)
        }
      ]
    };
  }

  async switchDatabase(dbName: string): Promise<MCPResponse> {
    await this.connector.switchDatabase(dbName);
    return {
      content: [
        {
          type: "text",
          text: `Successfully switched to database: ${dbName}`
        }
      ]
    };
  }

  async showTables(): Promise<MCPResponse> {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(await this.connector.showTables(), null, 2)
        }
      ]
    };
  }

  async dbQuery(query: string): Promise<MCPResponse> {
    const result = await this.connector.query(query);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  async dbExecute(statements: string | string[]): Promise<MCPResponse> {
    const result = await this.connector.execute(statements);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }

  async dbCreateUser(username: string, password: string): Promise<MCPResponse> {
    const fullUsername = await this.connector.createUser(username, password);
    return {
      content: [
        {
          type: "text",
          text: `User created successfully: ${fullUsername}`
        }
      ]
    };
  }

  async dbRemoveUser(username: string): Promise<MCPResponse> {
    await this.connector.removeUser(username);
    return {
      content: [
        {
          type: "text",
          text: `User removed successfully: ${username}`
        }
      ]
    };
  }

  async close(): Promise<void> {
    await this.connector.close();
  }
}

// Main test runner
async function runServerIntegrationTests() {
  await describeAsync("MCP Server Integration Tests", async () => {
    let server: MockMCPServer;
    let testTableName: string;
    
    // Setup
    server = new MockMCPServer();
    testTableName = `test_table_${Date.now()}`;
    
    itAsync("should show databases via MCP tool", async () => {
      const dbsResult = await server.showDatabases();
      assert(dbsResult.content);
      assert(dbsResult.content[0].type === "text");
      const databases = JSON.parse(dbsResult.content[0].text) as DatabaseRow[];
      assert(Array.isArray(databases));
      assert(databases.length > 0);
    });
    
    itAsync("should show tables via MCP tool", async () => {
      const tablesResult = await server.showTables();
      assert(tablesResult.content);
      assert(tablesResult.content[0].type === "text");
      const tables = JSON.parse(tablesResult.content[0].text) as string[];
      assert(Array.isArray(tables));
    });
    
    itAsync("should create table via db_execute tool", async () => {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS ${testTableName} (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      const createResult = await server.dbExecute(createTableSQL);
      assert(createResult.content);
      const createData = JSON.parse(createResult.content[0].text);
      assert(Array.isArray(createData));
    });
    
    itAsync("should insert data via db_execute tool", async () => {
      const insertResult = await server.dbExecute(
        `INSERT INTO ${testTableName} (name) VALUES ('server_test')`
      );
      assert(insertResult.content);
      const insertData = JSON.parse(insertResult.content[0].text);
      assert(insertData[0].affectedRows === 1);
    });
    
    itAsync("should query data via db_query tool", async () => {
      const queryResult = await server.dbQuery(
        `SELECT * FROM ${testTableName} WHERE name = 'server_test'`
      );
      assert(queryResult.content);
      const queryData = JSON.parse(queryResult.content[0].text) as TableRow[];
      assert(queryData.length > 0);
      assert(queryData[0].name === "server_test");
    });
    
    itAsync("should execute transaction via db_execute tool", async () => {
      const txResult = await server.dbExecute([
        `INSERT INTO ${testTableName} (name) VALUES ('tx1')`,
        `INSERT INTO ${testTableName} (name) VALUES ('tx2')`,
        `UPDATE ${testTableName} SET name = CONCAT(name, '_processed') WHERE name LIKE 'tx%'`
      ]);
      assert(txResult.content);
      const txData = JSON.parse(txResult.content[0].text);
      assert(txData.length === 3);
      assert(txData[0].affectedRows === 1);
      assert(txData[1].affectedRows === 1);
      assert(txData[2].affectedRows === 2);
    });
    
    itAsync("should verify transaction results", async () => {
      const verifyResult = await server.dbQuery(
        `SELECT * FROM ${testTableName} WHERE name LIKE '%_processed' ORDER BY name`
      );
      assert(verifyResult.content);
      const verifyData = JSON.parse(verifyResult.content[0].text) as TableRow[];
      assert(verifyData.length === 2);
    });
    
    itAsync("should manage users via MCP tools", async () => {
      const testUsername = `tu_${Date.now().toString().slice(-8)}`; // Keep under 32 chars
      
      // Create user
      const createUserResult = await server.dbCreateUser(testUsername, "testpass123");
      assert(createUserResult.content);
      assert(createUserResult.content[0].text.includes("User created successfully"));
      
      // Remove user
      const removeUserResult = await server.dbRemoveUser(testUsername);
      assert(removeUserResult.content);
      assert(removeUserResult.content[0].text.includes("User removed successfully"));
    });
    
    itAsync("should cleanup test table", async () => {
      try {
        await server.dbExecute(`DROP TABLE IF EXISTS ${testTableName}`);
      } finally {
        await server.close();
      }
    });
  });
}

// Run the tests
runServerIntegrationTests().catch(error => {
  console.error("Test execution failed:", error);
  process.exit(1);
});