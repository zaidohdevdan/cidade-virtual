import { eq, sql, notInArray } from 'drizzle-orm';
import { AppDatabase } from '../client';
import { agentMindsTable, AgentMindRow, NewAgentMindRow } from '../schema';

export class AgentMindRepository {
  constructor(private readonly db: AppDatabase) {}

  async getByAgentId(agentId: string): Promise<AgentMindRow | null> {
    const rows = await this.db
      .select()
      .from(agentMindsTable)
      .where(eq(agentMindsTable.agentId, agentId))
      .limit(1);

    return rows.length > 0 ? rows[0] : null;
  }

  async listAll(): Promise<AgentMindRow[]> {
    return this.db.select().from(agentMindsTable);
  }

  async upsert(data: NewAgentMindRow): Promise<AgentMindRow> {
    const rows = await this.db
      .insert(agentMindsTable)
      .values(data)
      .onConflictDoUpdate({
        target: agentMindsTable.agentId,
        set: {
          needs: data.needs,
          memory: data.memory,
          currentIntention: data.currentIntention,
          currentActivity: data.currentActivity,
          updatedAt: sql`NOW()`,
        },
      })
      .returning();

    return rows[0];
  }

  async saveAll(rows: NewAgentMindRow[]): Promise<void> {
    if (rows.length === 0) return;

    for (const row of rows) {
      await this.upsert(row);
    }
  }

  async deleteByAgentId(agentId: string): Promise<boolean> {
    const rows = await this.db
      .delete(agentMindsTable)
      .where(eq(agentMindsTable.agentId, agentId))
      .returning();

    return rows.length > 0;
  }

  async deleteAll(): Promise<void> {
    await this.db.delete(agentMindsTable);
  }

  /** Remove mentes fora do roster vigente (evita restauração de agentes removidos). */
  async deleteNotIn(keepAgentIds: string[]): Promise<number> {
    const deleted = await this.db
      .delete(agentMindsTable)
      .where(keepAgentIds.length > 0 ? notInArray(agentMindsTable.agentId, keepAgentIds) : sql`true`)
      .returning({ agentId: agentMindsTable.agentId });
    return deleted.length;
  }
}
