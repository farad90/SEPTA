import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module";
import { ProposalModule } from "../proposal/proposal.module";
import { FilesModule } from "../files/files.module";
import { ProposalDocumentsController } from "./proposal-documents.controller";
import { ProposalDocumentsService } from "./proposal-documents.service";
import { PdfRendererService } from "./pdf-renderer.service";
import { ExcelRendererService } from "./excel-renderer.service";

@Module({
  imports: [PermissionsModule, ProposalModule, FilesModule],
  controllers: [ProposalDocumentsController],
  providers: [ProposalDocumentsService, PdfRendererService, ExcelRendererService],
})
export class ProposalDocumentsModule {}
