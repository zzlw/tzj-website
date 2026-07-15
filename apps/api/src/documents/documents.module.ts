import { Module } from '@nestjs/common';
import { DocFoldersService } from './doc-folders.service';
import { DocTagsService } from './doc-tags.service';
import { DocumentPermissionsService } from './document-permissions.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';

@Module({
  controllers: [DocumentsController],
  providers: [DocumentsService, DocFoldersService, DocTagsService, DocumentPermissionsService],
  exports: [DocumentsService, DocFoldersService, DocTagsService, DocumentPermissionsService],
})
export class DocumentsModule {}
