import { Module } from "@nestjs/common";
import { SecurityController } from "./security.controller";
import { SecurityService } from "./security.service";
import { IpBanService } from "./ip-ban.service";

@Module({
  controllers: [SecurityController],
  providers: [SecurityService, IpBanService],
  exports: [IpBanService, SecurityService],
})
export class SecurityModule {}
