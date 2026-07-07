import { Module } from "@nestjs/common";
import { DocumentsController } from "./documents.controller";
import { DocumentsService } from "./documents.service";
import { DocFoldersService } from "./doc-folders.service";
import { DocTagsService } from "./doc-tags.service";
import { DocumentPermissionsService } from "./document-permissions.service";

@Module({
  controllers: [DocumentsController],
  providers: [
    DocumentsService,
    DocFoldersService,
    DocTagsService,
    DocumentPermissionsService,
  ],
  exports: [
    DocumentsService,
    DocFoldersService,
    DocTagsService,
    DocumentPermissionsService,
  ],
})
export class DocumentsModule {}
