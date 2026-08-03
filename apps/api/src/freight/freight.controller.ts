import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from "@nestjs/common";
import { IsEmail } from "class-validator";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { FreightService } from "./freight.service";
import { CreateFreightRfqDto, SaveFreightOfferDto } from "./dto/freight.dto";

class ResendEmailDto {
  @IsEmail({}, { message: "ایمیل گیرنده معتبر نیست" })
  recipientEmail!: string;
}

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions("shipping.manage_freight_rfq")
@Controller()
export class FreightController {
  constructor(private readonly service: FreightService) {}

  @Get("packages/ready-for-freight")
  listReadyPackages() {
    return this.service.listReadyPackages();
  }

  @Get("freight-rfqs")
  list() {
    return this.service.listRfqs();
  }

  @Post("freight-rfqs")
  create(@Body() dto: CreateFreightRfqDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user.userId);
  }

  @Get("freight-rfqs/:id/email-preview")
  emailPreview(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.emailPreview(id);
  }

  @Post("freight-rfqs/:id/resend")
  resend(@Param("id", ParseUUIDPipe) id: string, @Body() dto: ResendEmailDto) {
    return this.service.resendEmail(id, dto.recipientEmail);
  }

  @Put("freight-rfqs/:id/offer")
  saveOffer(@Param("id", ParseUUIDPipe) id: string, @Body() dto: SaveFreightOfferDto) {
    return this.service.saveOffer(id, dto);
  }

  @Post("freight-rfqs/:id/select-winner")
  selectWinner(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.service.selectWinner(id, user.userId);
  }
}
