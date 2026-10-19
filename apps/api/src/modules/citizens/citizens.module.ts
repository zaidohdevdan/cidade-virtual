import { Module } from '@nestjs/common';
import { CitizensService } from './citizens.service';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [MemoryModule],
  providers: [CitizensService],
  exports: [CitizensService],
})
export class CitizensModule {}
