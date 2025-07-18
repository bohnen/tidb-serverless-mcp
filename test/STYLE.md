# Test Coding Style Guide

This document describes the coding standards for all tests in the TiDB Cloud Serverless MCP extension project.

## Philosophy

Following philosophy, we maintain a minimal custom test framework that:

- Provides clear, readable test output
- Runs tests sequentially for deterministic results
- Uses standard Node.js assertions
- Avoids external test runner dependencies

## Test Structure

### 1. File Organization

```typescript
// Imports
import assert from "assert";
import { describeAsync, itAsync, checkEnvVariables } from "./setup.js";
import { TiDBConnector, TiDBConfig } from "../src/connector.js";

// Environment check
checkEnvVariables();

// Configuration
const config: TiDBConfig = {
  // config properties
};

// Type definitions
interface TypeName {
  // properties
}

// Helper classes (if needed)
class HelperClass {
  // implementation
}

// Main test runner
async function runTestNameTests() {
  await describeAsync("Test Suite Name", async () => {
    // Setup variables
    let variable: Type;

    // Setup initialization
    variable = initialValue;

    // Test cases
    itAsync("should do something", async () => {
      // test implementation
    });
  });
}

// Execute tests
runTestNameTests().catch((error) => {
  console.error("Test execution failed:", error);
  process.exit(1);
});
```

### 2. Test Runner Pattern

All test files must use an anonymous async function pattern:

```typescript
async function runTestNameTests() {
  await describeAsync("Test Suite Name", async () => {
    // tests
  });
}

runTestNameTests().catch((error) => {
  console.error("Test execution failed:", error);
  process.exit(1);
});
```

### 3. Test Organization

- Use `describeAsync` for test suites (supports nesting)
- Use `itAsync` for individual test cases
- All async operations must be awaited
- Tests run sequentially in the order they are defined

### 4. Naming Conventions

- Test runner functions: `run<Feature>Tests()` (e.g., `runConnectorTests`)
- Test suites: Descriptive names ending with "Tests" (e.g., "Connection Tests")
- Test cases: Start with "should" (e.g., "should connect to TiDB Cloud successfully")
- Test data: Use timestamps for uniqueness (e.g., `test_table_${Date.now()}`)

## Code Standards

### 1. Imports

- Use ES module imports with `.js` extensions
- Import order:
  1. Node.js built-in modules
  2. Test utilities from `./setup.js`
  3. Project modules from `../src/`
  4. Type imports

### 2. Environment Setup

- Always call `checkEnvVariables()` after imports
- Use environment variables from `process.env`
- Provide sensible defaults where appropriate

### 3. Type Safety

- Define interfaces for all data structures
- Use TypeScript type annotations
- Cast query results to appropriate types

### 4. Error Handling

- Use try-finally blocks for cleanup operations
- Let the test framework handle assertion failures
- Close database connections in finally blocks
- Avoid catching errors unless testing error scenarios

### 5. Test Data

- Generate unique names using timestamps
- Clean up created resources in the last test or finally block
- Use meaningful prefixes (e.g., `test_table_`, `tu_` for users)

## Best Practices

### 1. Test Independence

- Each test file should be independently runnable
- Avoid dependencies between test files
- Clean up all created resources

### 2. Assertions

- Use Node.js built-in `assert` module
- Prefer strict equality checks (`assert.strictEqual`)
- Include meaningful assertion messages when needed

### 3. Database Connections

- Create connections at the appropriate scope
- Close connections in finally blocks
- Reuse connections within a test suite when appropriate

### 4. Async Operations

- Always await async operations
- Use async/await instead of promises
- Ensure proper sequential execution

### 5. Console Output

- Let the test framework handle output formatting
- Avoid direct console.log in tests
- Use descriptive test names for clarity

## Example Test Case

```typescript
itAsync("should perform CRUD operations", async () => {
  const connector = new TiDBConnector(config);
  try {
    // Create
    await connector.execute(`CREATE TABLE test_table (id INT PRIMARY KEY)`);

    // Insert
    const insertResult = await connector.execute(
      `INSERT INTO test_table (id) VALUES (1)`
    );
    assert.strictEqual(insertResult[0].affectedRows, 1);

    // Read
    const rows = (await connector.query(
      `SELECT * FROM test_table`
    )) as TestRow[];
    assert.strictEqual(rows.length, 1);

    // Update
    const updateResult = await connector.execute(
      `UPDATE test_table SET id = 2 WHERE id = 1`
    );
    assert.strictEqual(updateResult[0].affectedRows, 1);

    // Delete
    const deleteResult = await connector.execute(
      `DELETE FROM test_table WHERE id = 2`
    );
    assert.strictEqual(deleteResult[0].affectedRows, 1);
  } finally {
    await connector.execute(`DROP TABLE IF EXISTS test_table`);
    await connector.close();
  }
});
```

## Migration Guide

When converting existing tests to this style:

1. Replace single async function with test runner pattern
2. Convert sequential test blocks to `itAsync` calls
3. Wrap test groups in `describeAsync`
4. Update imports to use test utilities
5. Ensure proper cleanup in finally blocks
6. Remove direct console.log statements
7. Add type annotations where missing
