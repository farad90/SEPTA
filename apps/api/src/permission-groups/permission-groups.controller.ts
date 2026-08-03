import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { PermissionGroupsService } from "./permission-groups.service";
import { CreateGroupDto, UpdateGroupDto } from "./dto/group.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions("users.manage")
@Controller()
export class PermissionGroupsController {
  constructor(private readonly service: PermissionGroupsService) {}

  @Get("permissions")
  getPermissionCatalog() {
    return this.service.getPermissionCatalog();
  }

  @Get("permission-groups")
  list() {
    return this.service.list();
  }

  @Post("permission-groups")
  create(@Body() dto: CreateGroupDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user.userId);
  }

  @Get("permission-groups/:id")
  getById(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.getById(id);
  }

  @Patch("permission-groups/:id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateGroupDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.service.update(id, dto, user.userId);
  }

  @Delete("permission-groups/:id")
  remove(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.service.remove(id, user.userId);
  }
}
