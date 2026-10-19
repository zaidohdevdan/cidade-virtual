// apps/api/src/modules/simulation/simulation.module.ts
import { Module } from '@nestjs/common';
import { AutonomousSimulationService } from './simulation.service';
import { GatewayModule } from '../../gateways/gateway.module';
import { CognitionModule } from '../cognition/cognition.module';
import { CitizensModule } from '../citizens/citizens.module';
import { WorldModule } from '../world/world.module';
import { PersistenceModule } from '../persistence/persistence.module';
import { MemoryModule } from '../memory/memory.module';

@Module({
  imports: [
    PersistenceModule,
    GatewayModule,
    CognitionModule,
    CitizensModule,
    WorldModule,
    MemoryModule,
  ],
  providers: [AutonomousSimulationService],
  exports: [AutonomousSimulationService],
})
export class SimulationModule {}
