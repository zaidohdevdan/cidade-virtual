import { eq, desc } from 'drizzle-orm';
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

  async getByAgentId(agentId: string, limit: number = 50): Promise<AgentExperienceRow[]> {
    return this.db
      .select()
      .from(agentExperiencesTable)
      .where(eq(agentExperiencesTable.agentId, agentId))
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
}
