// apps/api/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { WorldModule } from './modules/world/world.module';
import { CitizensModule } from './modules/citizens/citizens.module';
import { CognitionModule } from './modules/cognition/cognition.module';
import { MemoryModule } from './modules/memory/memory.module';
import { PersistenceModule } from './modules/persistence/persistence.module';
import { GatewayModule } from './gateways/gateway.module';
import { APP_FILTER } from '@nestjs/core';
import { AuthModule } from './auth/auth.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    AuthModule,
    PersistenceModule,
    GatewayModule,
    WorldModule,
    CitizensModule,
    CognitionModule,
    MemoryModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
  ],
})
export class AppModule {}
