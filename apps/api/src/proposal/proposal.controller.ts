import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Put, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { ProposalService } from "./proposal.service";
import {
  ReviseFinancialDto,
  SaveFinancialProposalDto,
  SaveTechnicalProposalDto,
  SetProposalFileDto,
} from "./dto/proposal.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("inquiries/:id/proposal")
export class ProposalController {
  constructor(private readonly service: ProposalService) {}

  @RequirePermissions("proposal.view")
  @Get()
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getProposal(id);
  }

  @RequirePermissions("proposal.view")
  @Get("financial/history")
  financialHistory(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getHistory(id, "financial");
  }

  @RequirePermissions("proposal.view")
  @Get("technical/history")
  technicalHistory(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getHistory(id, "technical");
  }

  @RequirePermissions("proposal.edit_price")
  @Put("financial")
  saveFinancial(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SaveFinancialProposalDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.saveFinancial(id, dto, user.userId);
  }

  @RequirePermissions("proposal.generate")
  @Patch("financial/file")
  setFinancialFile(@Param("id", ParseUUIDPipe) id: string, @Body() dto: SetProposalFileDto) {
    return this.service.setFinancialFile(id, dto.fileUrl);
  }

  @RequirePermissions("proposal.send_final")
  @Post("financial/send")
  sendFinancial(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.service.sendFinancial(id, user.userId);
  }

  @RequirePermissions("proposal.edit_price")
  @Post("financial/revise")
  reviseFinancial(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ReviseFinancialDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.reviseFinancial(id, user.userId, dto);
  }

  @RequirePermissions("proposal.edit_price")
  @Put("technical")
  saveTechnical(@Param("id", ParseUUIDPipe) id: string, @Body() dto: SaveTechnicalProposalDto) {
    return this.service.saveTechnical(id, dto);
  }

  @RequirePermissions("proposal.generate")
  @Patch("technical/file")
  setTechnicalFile(@Param("id", ParseUUIDPipe) id: string, @Body() dto: SetProposalFileDto) {
    return this.service.setTechnicalFile(id, dto.fileUrl);
  }

  @RequirePermissions("proposal.send_final")
  @Post("technical/send")
  sendTechnical(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.service.sendTechnical(id, user.userId);
  }

  @RequirePermissions("proposal.edit_price")
  @Post("technical/revise")
  reviseTechnical(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.service.reviseTechnical(id, user.userId);
  }
}

// فاز ۳۵-ج — تأیید/رد درخواست کاهش قیمت، دقیقاً هم‌الگوی ShipmentEditRequestsController (فاز ۲۷)
@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("proposal-price-change-requests")
export class ProposalPriceChangeRequestsController {
  constructor(private readonly service: ProposalService) {}

  @RequirePermissions("proposal.approve_price_reduction")
  @Post(":id/approve")
  approve(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.service.decidePriceChangeRequest(id, "approved", user.userId);
  }

  @RequirePermissions("proposal.approve_price_reduction")
  @Post(":id/reject")
  reject(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.service.decidePriceChangeRequest(id, "rejected", user.userId);
  }
}
