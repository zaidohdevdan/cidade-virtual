// apps/api/src/modules/cognition/cognition.module.ts
import { Module } from '@nestjs/common';
import { createDefaultLLMAdapter } from '@cidade-virtual/llm-adapters';
import { MemoryModule } from '../memory/memory.module';
import { CognitionService } from './cognition.service';

@Module({
  imports: [MemoryModule],
  providers: [
    {
      provide: 'LLM_ADAPTER',
      useFactory: () => createDefaultLLMAdapter(),
    },
    CognitionService,
  ],
  exports: [CognitionService, 'LLM_ADAPTER'],
})
export class CognitionModule {}

