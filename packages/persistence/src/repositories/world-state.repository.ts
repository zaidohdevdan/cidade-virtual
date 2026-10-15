import { eq, sql } from 'drizzle-orm';
import { AppDatabase } from '../client';
import { worldStateTable, WorldStateRow, NewWorldStateRow } from '../schema';

export class WorldStateRepository {
  constructor(private readonly db: AppDatabase) {}

  async getById(id: string): Promise<WorldStateRow | null> {
    const rows = await this.db
      .select()
      .from(worldStateTable)
      .where(eq(worldStateTable.id, id))
      .limit(1);

    return rows.length > 0 ? rows[0] : null;
  }

  async upsert(data: NewWorldStateRow): Promise<WorldStateRow> {
    const rows = await this.db
      .insert(worldStateTable)
      .values(data)
      .onConflictDoUpdate({
        target: worldStateTable.id,
        set: {
          name: data.name,
          tickCount: data.tickCount,
          timeOfDay: data.timeOfDay,
          weather: data.weather,
          updatedAt: sql`NOW()`,
        },
      })
      .returning();

    return rows[0];
  }

  async incrementTick(id: string, amount: number = 1): Promise<WorldStateRow | null> {
    const rows = await this.db
      .update(worldStateTable)
      .set({
        tickCount: sql`${worldStateTable.tickCount} + ${amount}`,
        updatedAt: sql`NOW()`,
      })
      .where(eq(worldStateTable.id, id))
      .returning();

    return rows.length > 0 ? rows[0] : null;
  }

  async updateEnvironment(id: string, timeOfDay: number, weather: string): Promise<WorldStateRow | null> {
    const rows = await this.db
      .update(worldStateTable)
      .set({
        timeOfDay,
        weather,
        updatedAt: sql`NOW()`,
      })
      .where(eq(worldStateTable.id, id))
      .returning();

    return rows.length > 0 ? rows[0] : null;
  }
}
