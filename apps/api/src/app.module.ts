// apps/api/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WorldModule } from './modules/world/world.module';
import { CitizensModule } from './modules/citizens/citizens.module';
import { CognitionModule } from './modules/cognition/cognition.module';
import { MemoryModule } from './modules/memory/memory.module';
import { WorldGateway } from './gateways/world.gateway';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    WorldModule,
    CitizensModule,
    CognitionModule,
    MemoryModule,
  ],
  providers: [WorldGateway],
})
export class AppModule {}
