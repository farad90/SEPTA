import { Controller, Param, ParseUUIDPipe, Post, Query, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { ProposalDocumentsService } from "./proposal-documents.service";
import { GenerateProposalDocumentDto } from "./dto/generate-document.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("inquiries/:id/proposal")
export class ProposalDocumentsController {
  constructor(private readonly service: ProposalDocumentsService) {}

  @RequirePermissions("proposal.generate")
  @Post("financial/generate")
  generateFinancial(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: GenerateProposalDocumentDto,
  ) {
    return this.service.generate(id, "financial", query.format, query.lang, query.deliveryOptionId);
  }

  @RequirePermissions("proposal.generate")
  @Post("technical/generate")
  generateTechnical(
    @Param("id", ParseUUIDPipe) id: string,
    @Query() query: GenerateProposalDocumentDto,
  ) {
    return this.service.generate(id, "technical", query.format, query.lang);
  }
}
