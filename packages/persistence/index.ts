export interface PersistenceAdapter {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  query<T = any>(sql: string, params?: unknown[]): Promise<T[]>;
}
