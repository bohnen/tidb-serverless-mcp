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
  tlsCaPath: process.env.TIDB_TLS_CA_CERT_PATH || undefined
};

interface TestResult {
  result: number;
}

interface DatabaseRow {
  Database: string;
}

interface TableRow {
  name: string;
  id: number;
  created_at: Date;
}

// Main test runner
async function runBasicOperationsTests() {
  await describeAsync("Basic Operations Tests", async () => {
    let testTableName: string;
    let connector: TiDBConnector;
    
    // Setup
    testTableName = `test_table_${Date.now()}`;
    connector = new TiDBConnector(config);
    
    itAsync("should connect and execute basic query", async () => {
      try {
        const result = await connector.query("SELECT 1 as result") as TestResult[];
        assert.strictEqual(result[0].result, 1);
      } finally {
        // Keep connection open for other tests
      }
    });
    
    itAsync("should show databases", async () => {
      const databases = await connector.showDatabases() as DatabaseRow[];
      assert(Array.isArray(databases));
      assert(databases.length > 0);
    });
    
    itAsync("should show tables", async () => {
      const tables = await connector.showTables();
      assert(Array.isArray(tables));
    });
    
    itAsync("should get current user", async () => {
      const currentUser = await connector.currentUsername();
      assert(typeof currentUser === "string");
    });
    
    itAsync("should create table", async () => {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS ${testTableName} (
          id INT PRIMARY KEY AUTO_INCREMENT,
          name VARCHAR(255),
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `;
      const createResult = await connector.execute(createTableSQL);
      assert(Array.isArray(createResult));
    });
    
    itAsync("should insert data", async () => {
      const insertResult = await connector.execute(
        `INSERT INTO ${testTableName} (name) VALUES ('test_data')`
      );
      assert.strictEqual(insertResult[0].affectedRows, 1);
    });
    
    itAsync("should query data", async () => {
      const queryResult = await connector.query(
        `SELECT * FROM ${testTableName} WHERE name = 'test_data'`
      ) as TableRow[];
      assert(queryResult.length > 0);
      assert.strictEqual(queryResult[0].name, "test_data");
    });
    
    itAsync("should execute transaction with multiple statements", async () => {
      const txResult = await connector.execute([
        `INSERT INTO ${testTableName} (name) VALUES ('tx1')`,
        `INSERT INTO ${testTableName} (name) VALUES ('tx2')`,
        `UPDATE ${testTableName} SET name = CONCAT(name, '_updated') WHERE name LIKE 'tx%'`
      ]);
      assert.strictEqual(txResult.length, 3);
      assert.strictEqual(txResult[0].affectedRows, 1);
      assert.strictEqual(txResult[1].affectedRows, 1);
      assert.strictEqual(txResult[2].affectedRows, 2);
    });
    
    itAsync("should detect serverless and validate user format", async () => {
      const isServerless = connector.isServerless;
      const currentUser = await connector.currentUsername();
      
      if (isServerless) {
        assert(currentUser.includes("."));
      }
    });
    
    itAsync("should cleanup test table", async () => {
      try {
        await connector.execute(`DROP TABLE IF EXISTS ${testTableName}`);
      } finally {
        await connector.close();
      }
    });
  });
}

// Run the tests
runBasicOperationsTests().catch(error => {
  console.error("Test execution failed:", error);
  process.exit(1);
});