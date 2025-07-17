// MCP Server integration test (TypeScript version)
import { TiDBConnector, TiDBConfig } from '../src/connector.js';
import assert from 'assert';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Test configuration
const config: TiDBConfig = {
  host: process.env.TIDB_HOST!,
  port: parseInt(process.env.TIDB_PORT || '4000'),
  username: process.env.TIDB_USERNAME!,
  password: process.env.TIDB_PASSWORD!,
  database: process.env.TIDB_DATABASE || 'test',
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

async function runServerIntegrationTest(): Promise<void> {
  console.log('# MCP Server Integration Test (TypeScript)');
  
  const server = new MockMCPServer();
  const testTableName = `test_table_${Date.now()}`;
  
  try {
    // Test 1: show_databases tool
    console.log('## Test 1: show_databases tool');
    const dbsResult = await server.showDatabases();
    assert(dbsResult.content);
    assert(dbsResult.content[0].type === 'text');
    const databases = JSON.parse(dbsResult.content[0].text) as DatabaseRow[];
    assert(Array.isArray(databases));
    console.log(`✓ Found ${databases.length} databases`);
    
    // Test 2: show_tables tool
    console.log('## Test 2: show_tables tool');
    const tablesResult = await server.showTables();
    assert(tablesResult.content);
    assert(tablesResult.content[0].type === 'text');
    const tables = JSON.parse(tablesResult.content[0].text) as string[];
    assert(Array.isArray(tables));
    console.log(`✓ Found ${tables.length} tables`);
    
    // Test 3: db_execute tool (create table)
    console.log('## Test 3: db_execute tool (create table)');
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
    console.log('✓ Table created via db_execute');
    
    // Test 4: db_execute tool (insert data)
    console.log('## Test 4: db_execute tool (insert data)');
    const insertResult = await server.dbExecute(
      `INSERT INTO ${testTableName} (name) VALUES ('server_test')`
    );
    assert(insertResult.content);
    const insertData = JSON.parse(insertResult.content[0].text);
    assert(insertData[0].affectedRows === 1);
    console.log('✓ Data inserted via db_execute');
    
    // Test 5: db_query tool
    console.log('## Test 5: db_query tool');
    const queryResult = await server.dbQuery(
      `SELECT * FROM ${testTableName} WHERE name = 'server_test'`
    );
    assert(queryResult.content);
    const queryData = JSON.parse(queryResult.content[0].text) as TableRow[];
    assert(queryData.length > 0);
    assert(queryData[0].name === 'server_test');
    console.log('✓ Data queried via db_query');
    
    // Test 6: db_execute tool (transaction)
    console.log('## Test 6: db_execute tool (transaction)');
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
    console.log('✓ Transaction executed via db_execute');
    
    // Test 7: Verify transaction result
    console.log('## Test 7: Verify transaction result');
    const verifyResult = await server.dbQuery(
      `SELECT * FROM ${testTableName} WHERE name LIKE '%_processed' ORDER BY name`
    );
    assert(verifyResult.content);
    const verifyData = JSON.parse(verifyResult.content[0].text) as TableRow[];
    assert(verifyData.length === 2);
    console.log('✓ Transaction results verified');
    
    // Test 8: User management
    console.log('## Test 8: User management');
    const testUsername = `tu_${Date.now().toString().slice(-8)}`; // Keep under 32 chars
    const createUserResult = await server.dbCreateUser(testUsername, 'testpass123');
    assert(createUserResult.content);
    assert(createUserResult.content[0].text.includes('User created successfully'));
    console.log('✓ User created via db_create_user');
    
    const removeUserResult = await server.dbRemoveUser(testUsername);
    assert(removeUserResult.content);
    assert(removeUserResult.content[0].text.includes('User removed successfully'));
    console.log('✓ User removed via db_remove_user');
    
    // Test 9: Cleanup
    console.log('## Test 9: Cleanup');
    await server.dbExecute(`DROP TABLE IF EXISTS ${testTableName}`);
    console.log('✓ Test table cleaned up');
    
    console.log('\n## All MCP server integration tests passed! ✓');
    
  } catch (error) {
    console.error(`\n✗ Test failed: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await server.close();
  }
}

runServerIntegrationTest().catch(console.error);