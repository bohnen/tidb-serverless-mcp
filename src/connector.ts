import { readFileSync } from 'fs';
import mysql from "mysql2/promise";

export interface TiDBConfig {
  databaseUrl?: string;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  tls?: boolean;
  tlsCaPath?: string;
}

export class TiDBConnector {
  private pool: mysql.Pool;
  private config: TiDBConfig;

  constructor(config: TiDBConfig) {
    this.config = config;
    this.pool = this.createPool(config);
  }

  private createPool(config: TiDBConfig): mysql.Pool {
    const getSslConfig = () => {
      if (config.tls === false) {
        return false;
      }
      
      const sslConfig: any = {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true,
      };
      
      if (config.tlsCaPath) {
        sslConfig.ca = readFileSync(config.tlsCaPath);
      }
      
      return sslConfig;
    };

    if (config.databaseUrl) {
      return mysql.createPool({
        uri: config.databaseUrl,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
        ssl: getSslConfig(),
        connectTimeout: 30000,
      });
    }

    const { host, port, username, password, database } = config;
    const poolConfig: mysql.PoolOptions = {
      host,
      port,
      user: username,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      ssl: getSslConfig(),
      connectTimeout: 30000,
    };
    
    // Set password - treat empty strings as passwordless connections
    if (password !== undefined && password !== '') {
      poolConfig.password = password;
    }
    
    return mysql.createPool(poolConfig);
  }

  async showDatabases(): Promise<any[]> {
    const [rows] = await this.pool.execute("SHOW DATABASES");
    return rows as any[];
  }

  async switchDatabase(dbName: string, username?: string, password?: string): Promise<void> {
    // Close the current pool
    await this.pool.end();
    
    // Create new pool with updated config
    const newConfig = {
      ...this.config,
      database: dbName,
      username: username || this.config.username,
      password: password !== undefined ? password : this.config.password,
    };
    this.pool = this.createPool(newConfig);
    this.config = newConfig;
    
    // Test the connection
    const connection = await this.pool.getConnection();
    await connection.ping();
    connection.release();
  }

  async showTables(): Promise<string[]> {
    const [rows] = await this.pool.execute("SHOW TABLES");
    return (rows as any[]).map((row: any) => Object.values(row)[0] as string);
  }

  async query(sqlStmt: string, params?: any[]): Promise<any[]> {
    // Validate that the SQL statement is a read-only operation
    const trimmedSql = sqlStmt.trim().toLowerCase();
    const readOnlyKeywords = ['select', 'show', 'describe', 'explain', 'with'];
    const isReadOnly = readOnlyKeywords.some(keyword => trimmedSql.startsWith(keyword));
    
    if (!isReadOnly) {
      throw new Error('Query method only supports read-only operations. Use execute() for modifications.');
    }
    
    const [rows] = params ? 
      await this.pool.execute(sqlStmt, params) : 
      await this.pool.execute(sqlStmt);
    return rows as any[];
  }

  async execute(sqlStmts: string | string[]): Promise<any[]> {
    const results: any[] = [];
    const statements = Array.isArray(sqlStmts) ? sqlStmts : [sqlStmts];

    const connection = await this.pool.getConnection();
    await connection.beginTransaction();
    
    try {
      for (const stmt of statements) {
        const [result] = await connection.execute(stmt);
        const resultHeader = result as mysql.ResultSetHeader;
        results.push({
          statement: stmt,
          affectedRows: resultHeader.affectedRows || 0,
          lastInsertId: resultHeader.insertId || null,
        });
      }
      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }

    return results;
  }

  get isServerless(): boolean {
    const host = this.config.host || "";
    return host.includes("tidbcloud.com");
  }

  async currentUsername(): Promise<string> {
    const [rows] = await this.pool.execute("SELECT CURRENT_USER()");
    return Object.values((rows as any[])[0])[0] as string;
  }

  async createUser(username: string, password: string): Promise<string> {
    // Input validation
    if (!username || username.trim().length === 0) {
      throw new Error('Username cannot be empty');
    }
    
    let fullUsername = username.trim();
    
    if (this.isServerless && !username.includes(".")) {
      const currentUser = await this.currentUsername();
      const prefix = currentUser.split(".")[0];
      fullUsername = `${prefix}.${username}`;
    }

    // Use mysql2's value escaping for security (DDL doesn't support parameterized queries)
    const connection = await this.pool.getConnection();
    try {
      const escapedUsername = connection.escape(fullUsername);
      const escapedPassword = connection.escape(password);
      await connection.execute(`CREATE USER ${escapedUsername} IDENTIFIED BY ${escapedPassword}`);
    } finally {
      connection.release();
    }
    return fullUsername;
  }

  async removeUser(username: string): Promise<void> {
    // Input validation
    if (!username || username.trim().length === 0) {
      throw new Error('Username cannot be empty');
    }
    
    let fullUsername = username.trim();
    
    if (this.isServerless && !username.includes(".")) {
      const currentUser = await this.currentUsername();
      const prefix = currentUser.split(".")[0];
      fullUsername = `${prefix}.${username}`;
    }

    // Use mysql2's value escaping for security (DDL doesn't support parameterized queries)
    const connection = await this.pool.getConnection();
    try {
      const escapedUsername = connection.escape(fullUsername);
      await connection.execute(`DROP USER ${escapedUsername}`);
    } finally {
      connection.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}