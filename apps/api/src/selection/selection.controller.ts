import {
  Body,
  Controller,
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
}
