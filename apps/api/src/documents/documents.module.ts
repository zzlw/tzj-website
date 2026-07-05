import { Module } from "@nestjs/common";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";
import { DocFoldersService } from "./doc-folders.service";
import { DocTagsService } from "./doc-tags.service";

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, DocFoldersService, DocTagsService],
  exports: [DocumentsService, DocFoldersService, DocTagsService],
})
export class DocumentsModule {}
