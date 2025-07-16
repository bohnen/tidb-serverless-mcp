import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load environment variables from the project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "..", ".env") });

// Simple test utilities following t-wada's philosophy
export function describe(name: string, fn: () => void): void {
  console.log(`\n## ${name}`);
  fn();
}

export function it(name: string, fn: () => void): void {
  console.log(`  - ${name}`);
  try {
    fn();
    console.log(`    ✓`);
  } catch (error) {
    console.error(`    ✗ ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      console.error(`      ${error.stack.split('\n').slice(1).join('\n      ')}`);
    }
    process.exit(1);
  }
}

export async function itAsync(name: string, fn: () => Promise<void>): Promise<void> {
  console.log(`  - ${name}`);
  try {
    await fn();
    console.log(`    ✓`);
  } catch (error) {
    console.error(`    ✗ ${error instanceof Error ? error.message : String(error)}`);
    if (error instanceof Error && error.stack) {
      console.error(`      ${error.stack.split('\n').slice(1).join('\n      ')}`);
    }
    process.exit(1);
  }
}

// Verify required environment variables
export function checkEnvVariables(): void {
  const required = ['TIDB_HOST', 'TIDB_PORT', 'TIDB_USERNAME', 'TIDB_PASSWORD', 'TIDB_DATABASE'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    console.error('Please create a .env file with the required variables');
    process.exit(1);
  }
}