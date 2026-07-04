import { Module } from "@nestjs/common";
import { MediaService } from "./media.service";
import { MediaGuardService } from "./media-guard.service";
import { MediaController } from "./media.controller";
import { StorageModule } from "../storage/storage.module";

@Module({
  imports: [StorageModule],
  controllers: [MediaController],
  providers: [MediaService, MediaGuardService],
})
export class MediaModule {}
