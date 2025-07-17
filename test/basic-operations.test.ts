// Basic operations test for TiDB Cloud connection (TypeScript version)
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

async function runBasicOperationsTest(): Promise<void> {
  console.log('# Basic Operations Test (TypeScript)');
  
  const connector = new TiDBConnector(config);
  const testTableName = `test_table_${Date.now()}`;
  
  try {
    // Test 1: Connection and basic query
    console.log('## Test 1: Connection and basic query');
    const result = await connector.query('SELECT 1 as result') as TestResult[];
    assert.strictEqual(result[0].result, 1);
    console.log('✓ Connection successful');
    
    // Test 2: Show databases
    console.log('## Test 2: Show databases');
    const databases = await connector.showDatabases() as DatabaseRow[];
    assert(Array.isArray(databases));
    assert(databases.length > 0);
    console.log(`✓ Found ${databases.length} databases`);
    
    // Test 3: Show tables
    console.log('## Test 3: Show tables');
    const tables = await connector.showTables();
    assert(Array.isArray(tables));
    console.log(`✓ Found ${tables.length} tables`);
    
    // Test 4: Get current user
    console.log('## Test 4: Get current user');
    const currentUser = await connector.currentUsername();
    assert(typeof currentUser === 'string');
    console.log(`✓ Current user: ${currentUser}`);
    
    // Test 5: Create table
    console.log('## Test 5: Create table');
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS ${testTableName} (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    const createResult = await connector.execute(createTableSQL);
    assert(Array.isArray(createResult));
    console.log('✓ Table created successfully');
    
    // Test 6: Insert data
    console.log('## Test 6: Insert data');
    const insertResult = await connector.execute(
      `INSERT INTO ${testTableName} (name) VALUES ('test_data')`
    );
    assert.strictEqual(insertResult[0].affectedRows, 1);
    console.log('✓ Data inserted successfully');
    
    // Test 7: Query data
    console.log('## Test 7: Query data');
    const queryResult = await connector.query(
      `SELECT * FROM ${testTableName} WHERE name = 'test_data'`
    ) as TableRow[];
    assert(queryResult.length > 0);
    assert.strictEqual(queryResult[0].name, 'test_data');
    console.log('✓ Data queried successfully');
    
    // Test 8: Transaction with multiple statements
    console.log('## Test 8: Transaction with multiple statements');
    const txResult = await connector.execute([
      `INSERT INTO ${testTableName} (name) VALUES ('tx1')`,
      `INSERT INTO ${testTableName} (name) VALUES ('tx2')`,
      `UPDATE ${testTableName} SET name = CONCAT(name, '_updated') WHERE name LIKE 'tx%'`
    ]);
    assert.strictEqual(txResult.length, 3);
    assert.strictEqual(txResult[0].affectedRows, 1);
    assert.strictEqual(txResult[1].affectedRows, 1);
    assert.strictEqual(txResult[2].affectedRows, 2);
    console.log('✓ Transaction executed successfully');
    
    // Test 9: Serverless detection
    console.log('## Test 9: Serverless detection');
    const isServerless: boolean = connector.isServerless;
    console.log(`✓ Is serverless: ${isServerless}`);
    if (isServerless) {
      assert(currentUser.includes('.'));
      console.log('✓ Serverless user format validated');
    }
    
    // Test 10: Cleanup
    console.log('## Test 10: Cleanup');
    await connector.execute(`DROP TABLE IF EXISTS ${testTableName}`);
    console.log('✓ Test table cleaned up');
    
    console.log('\n## All tests passed! ✓');
    
  } catch (error) {
    console.error(`\n✗ Test failed: ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  } finally {
    await connector.close();
  }
}

runBasicOperationsTest().catch(console.error);