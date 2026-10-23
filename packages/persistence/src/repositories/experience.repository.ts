import { eq, desc, gte, inArray, notInArray, and } from 'drizzle-orm';
import { sql } from 'drizzle-orm';
import { AppDatabase } from '../client';
import { agentExperiencesTable, AgentExperienceRow, NewAgentExperienceRow } from '../schema';

export class ExperienceRepository {
  constructor(private readonly db: AppDatabase) {}

  async record(data: NewAgentExperienceRow): Promise<AgentExperienceRow> {
    const rows = await this.db
      .insert(agentExperiencesTable)
      .values(data)
      .returning();

    return rows[0];
  }

  async getByAgentId(agentId: string, limit: number = 50, sourceType?: string): Promise<AgentExperienceRow[]> {
    const conditions = [eq(agentExperiencesTable.agentId, agentId)];
    if (sourceType) {
      conditions.push(eq(agentExperiencesTable.sourceType, sourceType));
    }
    return this.db
      .select()
      .from(agentExperiencesTable)
      .where(and(...conditions))
      .orderBy(desc(agentExperiencesTable.occurredAt))
      .limit(limit);
  }

  async getRecent(limit: number = 100): Promise<AgentExperienceRow[]> {
    return this.db
      .select()
      .from(agentExperiencesTable)
      .orderBy(desc(agentExperiencesTable.occurredAt))
      .limit(limit);
  }

  async getByDateRange(since: Date, limit: number = 200): Promise<AgentExperienceRow[]> {
    return this.db
      .select()
      .from(agentExperiencesTable)
      .where(gte(agentExperiencesTable.occurredAt, since))
      .orderBy(desc(agentExperiencesTable.occurredAt))
      .limit(limit);
  }

  async deleteByIds(ids: string[]): Promise<number> {
    if (ids.length === 0) return 0;
    const deleted = await this.db
      .delete(agentExperiencesTable)
      .where(inArray(agentExperiencesTable.id, ids))
      .returning({ id: agentExperiencesTable.id });
    return deleted.length;
  }

  /** Remove experiências de agentes fora do roster vigente (limpeza de órfãos). */
  async deleteByAgentIdsNotIn(keepAgentIds: string[]): Promise<number> {
    const deleted = await this.db
      .delete(agentExperiencesTable)
      .where(
        keepAgentIds.length > 0
          ? notInArray(agentExperiencesTable.agentId, keepAgentIds)
          : sql`true`,
      )
      .returning({ id: agentExperiencesTable.id });
    return deleted.length;
  }
}
