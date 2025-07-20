# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Desktop Extension (DXT) that provides a Model Context Protocol (MCP) server for TiDB Cloud Serverless database operations. The extension enables AI assistants to interact with TiDB databases through a comprehensive set of tools for database management, SQL execution, and user management.

## Architecture

The project follows the DXT extension pattern with these key components:

- **manifest.json**: DXT extension manifest defining tools, configuration, and metadata
- **src/server.ts**: Main MCP server implementation for stdio transport
- **src/server-http.ts**: Streamable HTTP server implementation
- **src/server-common.ts**: Shared server logic and utilities
- **src/connector.ts**: TiDBConnector class for database operations
- **dist/**: Compiled JavaScript output (entry points: dist/server.js, dist/server-http.js)

The server supports two transport modes:
1. **stdio** (default): Used by MCP Studio and stdio-based clients
2. **Streamable HTTP**: Stateful session-based HTTP protocol with SSE support

Both modes implement 7 database tools: show_databases, switch_database, show_tables, db_query, db_execute, db_create_user, db_remove_user.

## Build and Development Commands

```bash
# Build the project
npm run build

# Development mode with watch
npm run dev

# Start the server (stdio mode)
npm start

# Start the server (Streamable HTTP mode)
npm run start:http

# Clean build artifacts
npm run clean

# Install dependencies
npm install

# Run all tests
npm test

# Run individual tests
npm run test:basic      # Basic operations test
npm run test:connector  # Connector class test
npm run test:server     # MCP server integration test (stdio)
npm run test:http       # MCP server integration test (Streamable HTTP)
```

## Configuration

The extension supports both environment variables and DXT user configuration:

### Environment Variables (.env file)

```env
TIDB_HOST=gateway01.us-west-2.prod.aws.tidbcloud.com
TIDB_PORT=4000
TIDB_USERNAME=your_username
TIDB_PASSWORD=your_password
TIDB_DATABASE=test

# Streamable HTTP server configuration (optional)
MCP_HTTP_PORT=3000        # HTTP server port (default: 3000)
MCP_CORS_ORIGIN=*         # CORS origin (default: *)
```

### DXT User Configuration

Defined in manifest.json under `user_config`: host, port, username, password (sensitive), database. The manifest automatically injects these as environment variables when the extension runs.

## Key Implementation Details

- **Connection Management**: TiDBConnector handles both URL-based and parameter-based connections
- **Transaction Support**: db_execute tool wraps multiple statements in transactions
- **TiDB Serverless**: Automatic username prefixing for serverless environments
- **Error Handling**: Comprehensive error handling with proper MCP error codes
- **Tool Validation**: Each tool has strict input schema validation

## Testing

The project includes comprehensive TypeScript tests following philosophy:

1. **Setup**: Create `.env` file with TiDB Cloud credentials
2. **Build**: Run `npm run build` to compile TypeScript
3. **Test**: Execute `npm test` to run all tests

### Test Coverage

- **Basic Operations**: Connection, CRUD operations, transactions
- **Connector Class**: All public methods, error handling, TiDB Serverless features
- **MCP Integration**: All 7 database tools, response format validation
- **Type Safety**: TypeScript type definitions and compile-time checks
- **Transport Modes**: Both stdio and Streamable HTTP transport testing

### Test Files

- `test/basic-operations.test.ts`: Core database functionality
- `test/connector.test.ts`: TiDBConnector class methods
- `test/server-integration.test.ts`: MCP server tools (stdio transport)
- `test/server-http.test.ts`: MCP server tools (Streamable HTTP transport)
- `test/setup.ts`: Test utilities and helpers

See `test/README.md` for detailed test documentation.

## Dependencies

- **@modelcontextprotocol/sdk**: MCP protocol implementation
- **mysql2**: MySQL/TiDB connection driver with Promise support
- **dotenv**: Environment variable management
- **express**: HTTP server framework for Streamable HTTP mode
- **cors**: CORS middleware for HTTP server
- **zod**: Schema validation for tool inputs
- **TypeScript**: Development and compilation
- **tsx**: TypeScript execution tool for tests

## Vector Search Support

The extension fully supports TiDB's vector search capabilities with VECTOR columns and functions like VEC_COSINE_DISTANCE and VEC_L2_DISTANCE for similarity search operations.
