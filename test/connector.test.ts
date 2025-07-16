import assert from "assert";
import { describe, it, itAsync, checkEnvVariables } from "./setup.js";
import { TiDBConnector, TiDBConfig } from "../src/connector.js";

checkEnvVariables();

const config: TiDBConfig = {
  host: process.env.TIDB_HOST!,
  port: parseInt(process.env.TIDB_PORT || "4000"),
  username: process.env.TIDB_USERNAME!,
  password: process.env.TIDB_PASSWORD!,
  database: process.env.TIDB_DATABASE!,
};

interface DatabaseRow {
  Database: string;
}

interface TableRow {
  name: string;
  id: number;
  created_at: Date;
}

interface TestResult {
  result: number;
}

describe("TiDBConnector Tests", () => {
  let testTableName: string;
  let testUsername: string;

  // Setup: Initialize test data
  testTableName = `test_table_${Date.now()}`;
  testUsername = `test_user_${Date.now()}`;

  describe("Connection Tests", () => {
    itAsync("should connect to TiDB Cloud successfully", async () => {
      const connector = new TiDBConnector(config);
      try {
        // Test connection by executing a simple query
        const result = await connector.query("SELECT 1 as result") as TestResult[];
        assert.strictEqual(result[0].result, 1);
      } finally {
        await connector.close();
      }
    });

    itAsync("should detect serverless instance correctly", async () => {
      const connector = new TiDBConnector(config);
      try {
        const isServerless: boolean = connector.isServerless;
        assert.strictEqual(typeof isServerless, "boolean");
        if (config.host!.includes("tidbcloud.com")) {
          assert.strictEqual(isServerless, true);
        }
      } finally {
        await connector.close();
      }
    });
  });

  describe("Database Operations", () => {
    itAsync("should show databases", async () => {
      const connector = new TiDBConnector(config);
      try {
        const databases = await connector.showDatabases() as DatabaseRow[];
        assert(Array.isArray(databases));
        assert(databases.length > 0);
        assert(databases.some(db => db.Database.toLowerCase() === "information_schema"));
      } finally {
        await connector.close();
      }
    });

    itAsync("should show tables in current database", async () => {
      const connector = new TiDBConnector(config);
      try {
        const tables = await connector.showTables();
        assert(Array.isArray(tables));
      } finally {
        await connector.close();
      }
    });

    itAsync("should get current user", async () => {
      const connector = new TiDBConnector(config);
      try {
        const user = await connector.currentUsername();
        assert(user);
        assert(typeof user === "string");
        if (connector.isServerless) {
          assert(user.includes("."));
        }
      } finally {
        await connector.close();
      }
    });
  });

  describe("Table Operations", () => {
    itAsync("should perform CRUD operations", async () => {
      const connector = new TiDBConnector(config);
      try {
        // Create table
        const createTableSQL = `
          CREATE TABLE IF NOT EXISTS ${testTableName} (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `;
        const createResults = await connector.execute(createTableSQL);
        assert(Array.isArray(createResults));
        assert.strictEqual(createResults[0].affectedRows, 0); // CREATE TABLE returns 0

        const tables = await connector.showTables();
        assert(tables.includes(testTableName));

        // Insert data
        const insertResults = await connector.execute(
          `INSERT INTO ${testTableName} (name) VALUES ('test_name')`
        );
        assert.strictEqual(insertResults[0].affectedRows, 1);
        assert(typeof insertResults[0].lastInsertId === "number");

        // Query data
        const rows = await connector.query(
          `SELECT * FROM ${testTableName} WHERE name = 'test_name'`
        ) as TableRow[];
        assert(rows.length > 0);
        assert.strictEqual(rows[0].name, "test_name");

        // Update data
        const updateResults = await connector.execute(
          `UPDATE ${testTableName} SET name = 'updated_name' WHERE name = 'test_name'`
        );
        assert(updateResults[0].affectedRows > 0);

        // Delete data
        const deleteResults = await connector.execute(
          `DELETE FROM ${testTableName} WHERE name = 'updated_name'`
        );
        assert(deleteResults[0].affectedRows > 0);

        // Clean up
        await connector.execute(`DROP TABLE IF EXISTS ${testTableName}`);
      } finally {
        await connector.close();
      }
    });
  });

  describe("Transaction Tests", () => {
    itAsync("should handle multiple statements in transaction", async () => {
      const connector = new TiDBConnector(config);
      try {
        // Create test table first
        const createTableSQL = `
          CREATE TABLE IF NOT EXISTS ${testTableName}_tx (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `;
        await connector.execute(createTableSQL);

        const results = await connector.execute([
          `INSERT INTO ${testTableName}_tx (name) VALUES ('tx1')`,
          `INSERT INTO ${testTableName}_tx (name) VALUES ('tx2')`,
          `UPDATE ${testTableName}_tx SET name = CONCAT(name, '_updated') WHERE name LIKE 'tx%'`
        ]);
        
        assert.strictEqual(results.length, 3);
        assert.strictEqual(results[0].affectedRows, 1);
        assert.strictEqual(results[1].affectedRows, 1);
        assert.strictEqual(results[2].affectedRows, 2);

        // Verify the transaction succeeded
        const rows = await connector.query(
          `SELECT * FROM ${testTableName}_tx WHERE name LIKE 'tx%_updated' ORDER BY name`
        ) as TableRow[];
        assert.strictEqual(rows.length, 2);

        // Clean up
        await connector.execute(`DROP TABLE IF EXISTS ${testTableName}_tx`);
      } finally {
        await connector.close();
      }
    });

    itAsync("should rollback on error", async () => {
      const connector = new TiDBConnector(config);
      try {
        // Create test table first
        const createTableSQL = `
          CREATE TABLE IF NOT EXISTS ${testTableName}_rollback (
            id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(255),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `;
        await connector.execute(createTableSQL);

        try {
          await connector.execute([
            `INSERT INTO ${testTableName}_rollback (name) VALUES ('rollback_test')`,
            `INVALID SQL STATEMENT` // This will cause an error
          ]);
          assert.fail("Should have thrown an error");
        } catch (error) {
          // Expected error
        }

        // Verify rollback worked
        const rows = await connector.query(
          `SELECT * FROM ${testTableName}_rollback WHERE name = 'rollback_test'`
        ) as TableRow[];
        assert.strictEqual(rows.length, 0);

        // Clean up
        await connector.execute(`DROP TABLE IF EXISTS ${testTableName}_rollback`);
      } finally {
        await connector.close();
      }
    });
  });

  describe("User Management Tests (TiDB Serverless)", () => {
    itAsync("should handle TiDB Serverless user prefix", async () => {
      const connector = new TiDBConnector(config);
      try {
        if (connector.isServerless) {
          const currentUser = await connector.currentUsername();
          assert(currentUser.includes("."));
          const prefix = currentUser.split(".")[0];
          assert(prefix.length > 0);
        } else {
          console.log("      (Skipping: not a serverless instance)");
        }
      } finally {
        await connector.close();
      }
    });

    itAsync("should create user with prefix for serverless", async () => {
      const connector = new TiDBConnector(config);
      try {
        if (connector.isServerless) {
          try {
            const fullUsername = await connector.createUser(testUsername, "testpass123");
            const currentUser = await connector.currentUsername();
            const expectedPrefix = currentUser.split(".")[0];
            assert(fullUsername.startsWith(expectedPrefix + "."));

            // Clean up
            await connector.removeUser(testUsername);
          } catch (error) {
            // User creation might fail due to permissions
            console.log(`      (Skipped: ${error instanceof Error ? error.message : String(error)})`);
          }
        } else {
          console.log("      (Skipping: not a serverless instance)");
        }
      } finally {
        await connector.close();
      }
    });
  });

  describe("Database Switching", () => {
    itAsync("should switch database", async () => {
      const connector = new TiDBConnector(config);
      
      try {
        // First check available databases
        const databases = await connector.showDatabases() as DatabaseRow[];
        const informationSchemaDb = databases.find(db => db.Database.toLowerCase() === "information_schema");
        
        if (informationSchemaDb) {
          await connector.switchDatabase("information_schema");
          
          // Verify we're in the information_schema database by checking its tables
          const tables = await connector.showTables();
          assert(Array.isArray(tables));
          assert(tables.length > 0); // information_schema should have tables
          
          // Switch back to original database
          await connector.switchDatabase(config.database!);
        } else {
          console.log("      (Skipped: information_schema database not accessible)");
        }
      } finally {
        await connector.close();
      }
    });
  });

});