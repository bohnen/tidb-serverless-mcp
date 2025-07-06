# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Desktop Extension (DXT) that provides a Model Context Protocol (MCP) server for TiDB Cloud Serverless database operations. The extension enables AI assistants to interact with TiDB databases through a comprehensive set of tools for database management, SQL execution, and user management.

## Architecture

The project follows the DXT extension pattern with these key components:

- **manifest.json**: DXT extension manifest defining tools, configuration, and metadata
- **src/server.ts**: Main MCP server implementation using @modelcontextprotocol/sdk
- **TiDBConnector class**: Database connection and operations abstraction
- **dist/**: Compiled JavaScript output (entry point: dist/server.js)

The server communicates via stdio transport and implements 7 database tools: show_databases, switch_database, show_tables, db_query, db_execute, db_create_user, db_remove_user.

## Build and Development Commands

```bash
# Build the project
npm run build

# Development mode with watch
npm run dev

# Start the server
npm start

# Clean build artifacts
npm run clean

# Install dependencies
npm install
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

1. Build the extension: `npm run build`
2. Set up `.env` file with valid TiDB credentials
3. Run: `npm start`
4. Test via stdio transport communication

## Dependencies

- **@modelcontextprotocol/sdk**: MCP protocol implementation
- **@tidbcloud/serverless**: TiDB Cloud Serverless JS SDK
- **dotenv**: Environment variable management
- **TypeScript**: Development and compilation

## Vector Search Support

The extension fully supports TiDB's vector search capabilities with VECTOR columns and functions like VEC_COSINE_DISTANCE and VEC_L2_DISTANCE for similarity search operations.