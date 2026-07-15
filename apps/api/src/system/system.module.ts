import { Module } from '@nestjs/common';
import { HealthModule } from '../health/health.module';
import { SystemController } from './system.controller';
import { SystemService } from './system.service';

@Module({
  imports: [HealthModule],
  controllers: [SystemController],
  providers: [SystemService],
})
export class SystemModule {}
