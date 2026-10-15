// apps/api/src/modules/world/world.module.ts
import { Module } from '@nestjs/common';
import { WorldService } from './world.service';

@Module({
  providers: [WorldService],
  exports: [WorldService],
})
export class WorldModule {}
