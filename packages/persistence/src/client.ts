import { Pool, PoolConfig } from 'pg';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export type AppDatabase = NodePgDatabase<typeof schema>;

export interface DatabaseConfig {
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  connectionString?: string;
}

export function getDefaultDatabaseConfig(): DatabaseConfig {
  return {
    host: process.env.POSTGRES_HOST || 'localhost',
    port: Number(process.env.POSTGRES_PORT || 5433),
    user: process.env.POSTGRES_USER || 'synapse',
    password: process.env.POSTGRES_PASSWORD || 'synapse_secret_password',
    database: process.env.POSTGRES_DB || 'synapse_city',
  };
}

export function createDatabaseConnection(config?: DatabaseConfig): {
  pool: Pool;
  db: AppDatabase;
  close: () => Promise<void>;
} {
  const cfg = config || getDefaultDatabaseConfig();
  const poolConfig: PoolConfig = cfg.connectionString
    ? { connectionString: cfg.connectionString }
    : {
        host: cfg.host,
        port: cfg.port,
        user: cfg.user,
        password: cfg.password,
        database: cfg.database,
      };

  const pool = new Pool(poolConfig);
  const db = drizzle(pool, { schema });

  return {
    pool,
    db,
    close: async () => {
      await pool.end();
    },
  };
}
