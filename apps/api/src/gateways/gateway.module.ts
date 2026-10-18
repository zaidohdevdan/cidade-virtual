import { Module, Global } from '@nestjs/common';
import { WorldGateway } from './world.gateway';

@Global()
@Module({
  providers: [WorldGateway],
  exports: [WorldGateway],
})
export class GatewayModule {}
