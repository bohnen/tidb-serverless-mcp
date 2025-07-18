import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load environment variables from the project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "..", "..", ".env") });

// Test execution context to collect async tests
interface TestContext {
  tests: Array<{ name: string; fn: () => Promise<void> }>;
}

let currentContext: TestContext | null = null;

// Simple test utilities
export function describe(name: string, fn: () => void): void {
  console.log(`\n## ${name}`);
  fn();
}

export async function describeAsync(
  name: string,
  fn: () => void | Promise<void>
): Promise<void> {
  console.log(`\n## ${name}`);

  // Create a new context for collecting tests
  const previousContext = currentContext;
  currentContext = { tests: [] };

  // Execute the describe function to collect tests
  await fn();

  // Execute all collected tests sequentially
  const testsToRun = currentContext.tests;
  currentContext = previousContext;

  for (const test of testsToRun) {
    await test.fn();
  }
}

export function it(name: string, fn: () => void): void {
  console.log(`  - ${name}`);
  try {
    fn();
    console.log(`    ✓`);
  } catch (error) {
    console.error(
      `    ✗ ${error instanceof Error ? error.message : String(error)}`
    );
    if (error instanceof Error && error.stack) {
      console.error(
        `      ${error.stack.split("\n").slice(1).join("\n      ")}`
      );
    }
    process.exit(1);
  }
}

export async function itAsync(
  name: string,
  fn: () => Promise<void>
): Promise<void> {
  // If we're in a describeAsync context, collect the test
  if (currentContext) {
    currentContext.tests.push({
      name,
      fn: async () => {
        console.log(`  - ${name}`);
        try {
          await fn();
          console.log(`    ✓`);
        } catch (error) {
          console.error(
            `    ✗ ${error instanceof Error ? error.message : String(error)}`
          );
          if (error instanceof Error && error.stack) {
            console.error(
              `      ${error.stack.split("\n").slice(1).join("\n      ")}`
            );
          }
          process.exit(1);
        }
      },
    });
    return;
  }

  // Otherwise, execute immediately (backward compatibility)
  console.log(`  - ${name}`);
  try {
    await fn();
    console.log(`    ✓`);
  } catch (error) {
    console.error(
      `    ✗ ${error instanceof Error ? error.message : String(error)}`
    );
    if (error instanceof Error && error.stack) {
      console.error(
        `      ${error.stack.split("\n").slice(1).join("\n      ")}`
      );
    }
    process.exit(1);
  }
}

// Verify required environment variables
export function checkEnvVariables(): void {
  const required = ["TIDB_HOST", "TIDB_PORT", "TIDB_USERNAME", "TIDB_DATABASE"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    console.error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
    console.error("Please create a .env file with the required variables");
    process.exit(1);
  }

  // TIDB_PASSWORD can be empty for local development
  if (process.env.TIDB_PASSWORD === undefined) {
    process.env.TIDB_PASSWORD = "";
  }
}
