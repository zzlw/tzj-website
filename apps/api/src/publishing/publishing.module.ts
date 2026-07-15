import { Module } from '@nestjs/common';
import { PublishingService } from './publishing.service';

@Module({
  providers: [PublishingService],
})
export class PublishingModule {}
