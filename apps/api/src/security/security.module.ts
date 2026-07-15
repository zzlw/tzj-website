import { Module } from '@nestjs/common';
import { IpBanService } from './ip-ban.service';
import { SecurityController } from './security.controller';
import { SecurityService } from './security.service';

@Module({
  controllers: [SecurityController],
  providers: [SecurityService, IpBanService],
  exports: [IpBanService, SecurityService],
})
export class SecurityModule {}
