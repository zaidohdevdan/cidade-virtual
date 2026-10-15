// apps/api/src/modules/cognition/cognition.module.ts
import { Module } from '@nestjs/common';
import { MemoryModule } from '../memory/memory.module';
import { CognitionService } from './cognition.service';

@Module({
  imports: [MemoryModule],
  providers: [CognitionService],
  exports: [CognitionService],
})
export class CognitionModule {}
