// apps/api/src/modules/citizens/citizens.module.ts
import { Module } from '@nestjs/common';
import { CitizensService } from './citizens.service';

@Module({
  providers: [CitizensService],
  exports: [CitizensService],
})
export class CitizensModule {}
