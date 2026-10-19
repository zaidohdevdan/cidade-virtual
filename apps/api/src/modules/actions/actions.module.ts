// apps/api/src/modules/actions/actions.module.ts
import { Module } from '@nestjs/common';
import { ActionsService } from './actions.service';
import { ActionsController } from './actions.controller';
import { GatewayModule } from '../../gateways/gateway.module';

@Module({
  imports: [GatewayModule],
  controllers: [ActionsController],
  providers: [ActionsService],
  exports: [ActionsService],
})
export class ActionsModule {}
