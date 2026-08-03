import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { OurEntitiesService } from "./our-entities.service";
import { CreateOurEntityDto, UpdateOurEntityDto } from "./dto/our-entity.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@Controller()
export class OurEntitiesController {
  constructor(private readonly service: OurEntitiesService) {}

  // Master Data کمکی — برای همه کاربران لاگین‌شده (دراپ‌داون RFQ/PO)، فقط فعال‌ها
  @Get("our-entities")
  listActive() {
    return this.service.listActive();
  }

  // پنل مدیریتی «شرکت‌های ما» — فعال و غیرفعال
  @RequirePermissions("our_entities.manage")
  @Get("our-entities-admin")
  listAll() {
    return this.service.listAll();
  }

  @RequirePermissions("our_entities.manage")
  @Get("our-entities-admin/:id")
  getById(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getById(id);
  }

  @RequirePermissions("our_entities.manage")
  @Post("our-entities-admin")
  create(@Body() dto: CreateOurEntityDto) {
    return this.service.create(dto);
  }

  @RequirePermissions("our_entities.manage")
  @Patch("our-entities-admin/:id")
  update(@Param("id", ParseUUIDPipe) id: string, @Body() dto: UpdateOurEntityDto) {
    return this.service.update(id, dto);
  }

  @RequirePermissions("our_entities.manage")
  @Delete("our-entities-admin/:id")
  remove(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
