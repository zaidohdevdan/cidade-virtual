import { eq, sql, notInArray } from 'drizzle-orm';
import { AppDatabase } from '../client';
import { agentIdentitiesTable, AgentIdentityRow, NewAgentIdentityRow } from '../schema';

export class AgentIdentityRepository {
  constructor(private readonly db: AppDatabase) {}

  async getById(id: string): Promise<AgentIdentityRow | null> {
    const rows = await this.db
      .select()
      .from(agentIdentitiesTable)
      .where(eq(agentIdentitiesTable.id, id))
      .limit(1);

    return rows.length > 0 ? rows[0] : null;
  }

  async listAll(): Promise<AgentIdentityRow[]> {
    return this.db.select().from(agentIdentitiesTable);
  }

  async upsert(data: NewAgentIdentityRow): Promise<AgentIdentityRow> {
    const rows = await this.db
      .insert(agentIdentitiesTable)
      .values(data)
      .onConflictDoUpdate({
        target: agentIdentitiesTable.id,
        set: {
          name: data.name,
          archetype: data.archetype,
          profileData: data.profileData,
          activeGoals: data.activeGoals,
          preferences: data.preferences,
          currentLocation: data.currentLocation,
          emotionState: data.emotionState,
          updatedAt: sql`NOW()`,
        },
      })
      .returning();

    return rows[0];
  }

  async updateLocation(
    id: string,
    currentLocation: { x: number; y: number; z: number }
  ): Promise<AgentIdentityRow | null> {
    const rows = await this.db
      .update(agentIdentitiesTable)
      .set({
        currentLocation,
        updatedAt: sql`NOW()`,
      })
      .where(eq(agentIdentitiesTable.id, id))
      .returning();

    return rows.length > 0 ? rows[0] : null;
  }

  async updateEmotion(id: string, emotionState: string): Promise<AgentIdentityRow | null> {
    const rows = await this.db
      .update(agentIdentitiesTable)
      .set({
        emotionState,
        updatedAt: sql`NOW()`,
      })
      .where(eq(agentIdentitiesTable.id, id))
      .returning();

    return rows.length > 0 ? rows[0] : null;
  }

  /** Remove identidades fora do roster vigente (limpeza de órfãos). */
  async deleteNotIn(keepIds: string[]): Promise<number> {
    const deleted = await this.db
      .delete(agentIdentitiesTable)
      .where(keepIds.length > 0 ? notInArray(agentIdentitiesTable.id, keepIds) : sql`true`)
      .returning({ id: agentIdentitiesTable.id });
    return deleted.length;
  }
}
