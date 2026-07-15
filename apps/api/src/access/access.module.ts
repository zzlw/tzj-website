import { Global, Module } from '@nestjs/common';
import { AccessController } from './access.controller';
import { AccessService } from './access.service';
import { RolesService } from './roles.service';

@Global()
@Module({
  controllers: [AccessController],
  providers: [AccessService, RolesService],
  exports: [RolesService],
})
export class AccessModule {}
