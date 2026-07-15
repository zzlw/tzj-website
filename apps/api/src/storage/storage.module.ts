import { Module } from '@nestjs/common';
import { S3Service } from './s3.service';
import { StorageController } from './storage.controller';

@Module({
  controllers: [StorageController],
  providers: [S3Service],
  exports: [S3Service],
})
export class StorageModule {}
