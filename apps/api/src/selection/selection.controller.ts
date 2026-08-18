import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { PermissionsService } from "../permissions/permissions.service";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { SelectionService } from "./selection.service";
import {
  LockSelectionDto,
  SaveDeliveryOptionsDto,
  SaveSelectionDto,
  SavePricingCostDto,
  AddPricingOptionDto,
  SavePricingOptionMarkupDto,
} from "./dto/selection.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller("inquiries/:id/selection")
export class SelectionController {
  constructor(
    private readonly service: SelectionService,
    private readonly permissions: PermissionsService,
  ) {}

  @RequirePermissions("selection.view")
  @Get()
  get(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getSelection(id);
  }

  @RequirePermissions("selection.select_offer")
  @Patch()
  async save(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SaveSelectionDto,
    @CurrentUser() user: RequestUser,
  ) {
    // markup/final فقط با کلید جدا — گیت فیلدی داخل سرویس
    const canSetMarkup = await this.permissions.hasPermission(user.userId, "selection.set_markup");
    return this.service.save(id, dto, canSetMarkup, user.userId);
  }

  @RequirePermissions("selection.set_markup")
  @Put("delivery-options")
  saveDeliveryOptions(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SaveDeliveryOptionsDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.saveDeliveryOptions(id, dto.options, user.userId);
  }

  @RequirePermissions("selection.lock")
  @Post("lock")
  lock(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: LockSelectionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.lock(id, dto.managerNoteToSales, user.userId);
  }

  @RequirePermissions("selection.lock")
  @Post("unlock")
  unlock(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.service.unlock(id, user.userId);
  }

  // ------------------------------------------------------------
  // فاز ۶۰ (اصلاح) — قیمت‌گذاری بازرگانی به تفکیک ترم تحویل، همین‌جا (نه در تب پیشنهاد به مشتری)
  // ------------------------------------------------------------

  @RequirePermissions("selection.view")
  @Get("pricing-costs")
  listPricingCosts(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.listPricingCosts(id);
  }

  @RequirePermissions("selection.set_markup")
  @Post("pricing-costs")
  createPricingCost(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SavePricingCostDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.createPricingCost(id, dto, user.userId);
  }

  @RequirePermissions("selection.set_markup")
  @Patch("pricing-costs/:costId")
  updatePricingCost(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("costId", ParseUUIDPipe) costId: string,
    @Body() dto: SavePricingCostDto,
  ) {
    return this.service.updatePricingCost(id, costId, dto);
  }

  @RequirePermissions("selection.set_markup")
  @Delete("pricing-costs/:costId")
  deletePricingCost(@Param("id", ParseUUIDPipe) id: string, @Param("costId", ParseUUIDPipe) costId: string) {
    return this.service.deletePricingCost(id, costId);
  }

  @RequirePermissions("selection.view")
  @Get("pricing-options")
  listPricingOptions(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.listPricingOptions(id);
  }

  @RequirePermissions("selection.set_markup")
  @Post("pricing-options")
  addPricingOption(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: AddPricingOptionDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.addPricingOption(id, dto, user.userId);
  }

  @RequirePermissions("selection.set_markup")
  @Delete("pricing-options/:optionId")
  removePricingOption(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("optionId", ParseUUIDPipe) optionId: string,
  ) {
    return this.service.removePricingOption(id, optionId);
  }

  /** «اعمال به همه» + override تک‌تک اقلام */
  @RequirePermissions("selection.set_markup")
  @Patch("pricing-options/:optionId/markup")
  saveMarkup(
    @Param("id", ParseUUIDPipe) id: string,
    @Param("optionId", ParseUUIDPipe) optionId: string,
    @Body() dto: SavePricingOptionMarkupDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.saveMarkup(id, optionId, dto, user.userId);
  }
}
