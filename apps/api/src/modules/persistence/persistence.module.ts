import { Module, Global, OnModuleDestroy } from '@nestjs/common';
import {
  createDatabaseConnection,
  WorldStateRepository,
  AgentIdentityRepository,
  ExperienceRepository,
} from '@cidade-virtual/persistence';

export const DATABASE_CONNECTION = 'DATABASE_CONNECTION';

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_CONNECTION,
      useFactory: () => {
        return createDatabaseConnection();
      },
    },
    {
      provide: WorldStateRepository,
      useFactory: (conn: ReturnType<typeof createDatabaseConnection>) => {
        return new WorldStateRepository(conn.db);
      },
      inject: [DATABASE_CONNECTION],
    },
    {
      provide: AgentIdentityRepository,
      useFactory: (conn: ReturnType<typeof createDatabaseConnection>) => {
        return new AgentIdentityRepository(conn.db);
      },
      inject: [DATABASE_CONNECTION],
    },
    {
      provide: ExperienceRepository,
      useFactory: (conn: ReturnType<typeof createDatabaseConnection>) => {
        return new ExperienceRepository(conn.db);
      },
      inject: [DATABASE_CONNECTION],
    },
  ],
  exports: [
    DATABASE_CONNECTION,
    WorldStateRepository,
    AgentIdentityRepository,
    ExperienceRepository,
  ],
})
export class PersistenceModule implements OnModuleDestroy {
  constructor() {}

  async onModuleDestroy() {
    // Graceful shutdown can be performed if needed
  }
}
