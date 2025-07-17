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
        const fs = require('fs');
        sslConfig.ca = fs.readFileSync(config.tlsCaPath);
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
    return mysql.createPool({
      host,
      port,
      user: username,
      password,
      database,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      ssl: getSslConfig(),
      connectTimeout: 30000,
    });
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
      password: password || this.config.password,
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

  async query(sqlStmt: string): Promise<any[]> {
    const [rows] = await this.pool.execute(sqlStmt);
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
    let fullUsername = username;
    
    if (this.isServerless && !username.includes(".")) {
      const currentUser = await this.currentUsername();
      const prefix = currentUser.split(".")[0];
      fullUsername = `${prefix}.${username}`;
    }

    await this.pool.execute(`CREATE USER '${fullUsername}' IDENTIFIED BY '${password}'`);
    return fullUsername;
  }

  async removeUser(username: string): Promise<void> {
    let fullUsername = username;
    
    if (this.isServerless && !username.includes(".")) {
      const currentUser = await this.currentUsername();
      const prefix = currentUser.split(".")[0];
      fullUsername = `${prefix}.${username}`;
    }

    await this.pool.execute(`DROP USER '${fullUsername}'`);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}