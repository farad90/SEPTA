import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { BusinessPartnersService } from "./business-partners.service";
import {
  CreatePartnerDto,
  ListPartnersQueryDto,
  SimilarPartnersQueryDto,
  UpdatePartnerDto,
} from "./dto/partner.dto";
import { CreateContactDto, UpdateContactDto } from "./dto/contact.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class BusinessPartnersController {
  constructor(private readonly service: BusinessPartnersService) {}

  // بدون کلید ثابت — چون سه کلید ممکنه دسترسی بده (view/view_customers/view_suppliers)
  // و RequirePermissions فقط AND پشتیبانی می‌کنه؛ چک واقعی داخل سرویسه
  @RequirePermissions()
  @Get("business-partners")
  list(@Query() query: ListPartnersQueryDto, @CurrentUser() user: RequestUser) {
    return this.service.list(user.userId, query);
  }

  @RequirePermissions("partners.create")
  @Get("business-partners/similar")
  findSimilar(@Query() query: SimilarPartnersQueryDto) {
    return this.service.findSimilar(query.name);
  }

  @RequirePermissions("partners.create")
  @Post("business-partners")
  create(@Body() dto: CreatePartnerDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user.userId);
  }

  @RequirePermissions()
  @Get("business-partners/:id")
  getById(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.service.getById(id, user.userId);
  }

  @RequirePermissions("partners.edit")
  @Patch("business-partners/:id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdatePartnerDto) {
    return this.service.update(id, dto);
  }

  @RequirePermissions("partners.delete")
  @Delete("business-partners/:id")
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }

  @RequirePermissions("partners.create")
  @Post("business-partners/:id/contacts")
  addContact(@Param("id", ParseUUIDPipe) id: string, @Body() dto: CreateContactDto) {
    return this.service.addContact(id, dto);
  }

  @RequirePermissions("partners.edit")
  @Patch("partner-contacts/:id")
  updateContact(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateContactDto) {
    return this.service.updateContact(id, dto);
  }

  @RequirePermissions("partners.delete")
  @Delete("partner-contacts/:id")
  removeContact(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.removeContact(id);
  }
}
