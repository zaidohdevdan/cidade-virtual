// apps/api/src/modules/memory/memory.service.ts
import { Injectable } from '@nestjs/common';
import { MemoryService as CoreMemoryService } from '@cidade-virtual/memory';

/**
 * Serviço de memória da API que estende o CoreMemoryService, garantindo
 * compatibilidade de tipos em todo o monorepo.
 */
@Injectable()
export class MemoryService extends CoreMemoryService {}
