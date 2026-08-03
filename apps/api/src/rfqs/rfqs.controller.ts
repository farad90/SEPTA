import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { IsEmail } from "class-validator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { RfqsService } from "./rfqs.service";
import {
  AddOfferDocumentDto,
  CreateOfferDto,
  CreateRfqDeleteRequestDto,
  CreateRfqDto,
  RejectRfqDto,
  TechnicalQuestionDto,
  UpdateRfqStatusDto,
} from "./dto/rfq.dto";

class ResendEmailDto {
  @IsEmail({}, { message: "ایمیل گیرنده معتبر نیست" })
  recipientEmail!: string;
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class RfqsController {
  constructor(private readonly service: RfqsService) {}

  // Master Data کمکی — برای همه کاربران لاگین‌شده
  @Get("currencies")
  listCurrencies() {
    return this.service.listCurrencies();
  }

  @RequirePermissions("rfq.view")
  @Get("inquiries/:id/rfqs")
  listForInquiry(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.listForInquiry(id);
  }

  @RequirePermissions("rfq.send")
  @Post("inquiries/:id/rfqs")
  create(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateRfqDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.create(id, dto, user.userId);
  }

  @RequirePermissions("rfq.view")
  @Get("rfqs/:id/email-preview")
  emailPreview(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.emailPreview(id);
  }

  @RequirePermissions("rfq.send")
  @Post("rfqs/:id/resend-email")
  resendEmail(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ResendEmailDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.resendEmail(id, dto.recipientEmail, user.userId);
  }

  @RequirePermissions("rfq.record_offer")
  @Patch("rfqs/:id/status")
  updateStatus(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateRfqStatusDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateStatus(id, dto.status, user.userId);
  }

  @RequirePermissions("rfq.record_offer")
  @Post("rfqs/:id/technical-question")
  technicalQuestion(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: TechnicalQuestionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.recordTechnicalQuestion(id, dto, user.userId);
  }

  @RequirePermissions("rfq.record_offer")
  @Post("rfqs/:id/reject")
  reject(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: RejectRfqDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.recordRejection(id, dto, user.userId);
  }

  @RequirePermissions("rfq.record_offer")
  @Post("rfqs/:id/offers")
  createOffer(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateOfferDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.createOffer(id, dto, user.userId);
  }

  @RequirePermissions("rfq.record_offer")
  @Patch("supplier-offers/:id")
  updateOffer(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateOfferDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.updateOffer(id, dto, user.userId);
  }

  @RequirePermissions("rfq.record_offer")
  @Post("supplier-offers/:id/documents")
  addOfferDocument(@Param("id", ParseUUIDPipe) id: string, @Body() dto: AddOfferDocumentDto) {
    return this.service.addOfferDocument(id, dto);
  }

  // فاز ۵۷ — درخواست حذف RFQ (فقط بدون آفر دریافتی)
  @RequirePermissions("rfq.send")
  @Post("rfqs/:id/delete-requests")
  createDeleteRequest(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: CreateRfqDeleteRequestDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.createDeleteRequest(id, dto, user.userId);
  }
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("rfq-delete-requests")
export class RfqDeleteRequestsController {
  constructor(private readonly service: RfqsService) {}

  @RequirePermissions("rfq.approve_delete")
  @Post(":id/approve")
  approve(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.service.decideDeleteRequest(id, "approved", user.userId);
  }

  @RequirePermissions("rfq.approve_delete")
  @Post(":id/reject")
  reject(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.service.decideDeleteRequest(id, "rejected", user.userId);
  }
}
