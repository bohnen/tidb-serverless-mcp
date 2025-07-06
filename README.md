# TiDB Cloud Serverless DXT Extension

A Desktop Extension (DXT) that provides a Model Context Protocol (MCP) server for TiDB Cloud Serverless database operations. This extension enables AI assistants to interact with TiDB Cloud Serverless databases through a comprehensive set of database management tools.

## Features

- **Database Management**: List databases, switch between databases
- **Table Operations**: Show tables in the current database
- **SQL Execution**: Execute queries and operations with full SQL support
- **User Management**: Create and remove database users
- **Vector Search**: Full support for TiDB's vector search capabilities
- **Transaction Support**: Execute multiple operations in transactions
- **Secure Configuration**: Environment variable and user configuration support

## Installation

1. **Clone or download this repository**
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Build the extension**:
   ```bash
   npm run build
   ```

## Configuration

The extension can be configured using either environment variables or DXT user configuration.

### Environment Variables

Create a `.env` file in the root directory:

```env
# Option 1: Use a full database URL
TIDB_DATABASE_URL=mysql://username:password@gateway01.us-west-2.prod.aws.tidbcloud.com:4000/database

# Option 2: Use individual connection parameters
TIDB_HOST=gateway01.us-west-2.prod.aws.tidbcloud.com
TIDB_PORT=4000
TIDB_USERNAME=your_username
TIDB_PASSWORD=your_password
TIDB_DATABASE=test
```

### DXT User Configuration

When installing the extension, you can configure the following options:

- `host`: TiDB host address (default: gateway01.us-west-2.prod.aws.tidbcloud.com)
- `port`: TiDB port number (default: 4000)
- `username`: TiDB username
- `password`: TiDB password
- `database`: Default database name (default: test)

## Available Tools

### `show_databases`
Shows all databases in the TiDB cluster.

### `switch_database`
Switches to a specific database with optional credentials.
- `db_name` (required): Name of the database to switch to
- `username` (optional): Username for the new connection
- `password` (optional): Password for the new connection

### `show_tables`
Shows all tables in the current database.

### `db_query`
Executes SELECT queries on the TiDB database. Best for read-only operations.
- `sql_stmt` (required): The SQL query statement to execute

### `db_execute`
Executes INSERT, UPDATE, DELETE, CREATE, DROP operations. Can handle single statements or arrays of statements in a transaction.
- `sql_stmts` (required): SQL statement(s) to execute (string or array)

### `db_create_user`
Creates a new database user. Returns the username with prefix for TiDB Serverless.
- `username` (required): The username for the new user
- `password` (required): The password for the new user

### `db_remove_user`
Removes a database user from the TiDB cluster.
- `username` (required): The username to remove

## Usage Examples

### Basic Query Operations
```sql
-- Show all databases
SHOW DATABASES;

-- Show tables in current database
SHOW TABLES;

-- Query data with limit
SELECT * FROM users LIMIT 10;

-- Insert data
INSERT INTO users (name, email) VALUES ('John Doe', 'john@example.com');
```

### Vector Search (TiDB Specific)
```sql
-- Create a table with vector column
CREATE TABLE documents (
    id INT PRIMARY KEY,
    content TEXT,
    embedding VECTOR(768),
    VECTOR INDEX idx_embedding ((VEC_COSINE_DISTANCE(embedding)))
);

-- Insert vector data
INSERT INTO documents (id, content, embedding) VALUES 
(1, 'Sample document', '[0.1, 0.2, 0.3, ...]');

-- Search for similar vectors
SELECT id, content, 1 - VEC_COSINE_DISTANCE(embedding, '[0.1, 0.2, 0.3, ...]') AS similarity
FROM documents
ORDER BY similarity DESC
LIMIT 5;
```

## Development

### Building
```bash
npm run build
```

### Development Mode
```bash
npm run dev  # Watch mode for development
```

### Testing
To test the extension locally:

1. Build the extension: `npm run build`
2. Set up your `.env` file with valid TiDB credentials
3. Run the server: `npm start`
4. The server will communicate via stdio transport

## Security

- Always use environment variables or secure configuration for database credentials
- The extension supports parameterized queries to prevent SQL injection
- User management operations are restricted to the current user's prefix in TiDB Serverless

## Troubleshooting

### Connection Issues
- Verify your TiDB Cloud Serverless credentials
- Check that your database URL format is correct
- Ensure your IP is whitelisted in TiDB Cloud Console

### Permission Errors
- Verify that your user has the necessary permissions for the operations you're attempting
- For user management operations, ensure you have admin privileges

## License

MIT License

## Contributing

Contributions are welcome! Please feel free to submit issues and pull requests.