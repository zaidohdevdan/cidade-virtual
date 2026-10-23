// apps/api/src/modules/marketplace/marketplace.module.ts
import { Module } from '@nestjs/common';
import { MarketplaceRepository } from '@cidade-virtual/persistence';
import { MarketplaceService } from './marketplace.service';
import { MarketplaceRagService } from './marketplace-rag.service';
import { MarketplaceController } from './marketplace.controller';
import { createDefaultLLMAdapter } from '@cidade-virtual/llm-adapters';

@Module({
  controllers: [MarketplaceController],
  providers: [
    MarketplaceService,
    {
      provide: MarketplaceRagService,
      useFactory: (repo: MarketplaceRepository) => {
        const llmAdapter = createDefaultLLMAdapter();
        return new MarketplaceRagService(repo, llmAdapter);
      },
      inject: [MarketplaceRepository],
    },
  ],
  exports: [MarketplaceService, MarketplaceRagService],
})
export class MarketplaceModule {}
