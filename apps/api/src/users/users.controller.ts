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
  Query,
  UseGuards,
} from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { UsersService } from "./users.service";
import { ApproveUserDto } from "./dto/approve-user.dto";
import { CreateUserDto } from "./dto/create-user.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { ResetUserPasswordDto } from "./dto/reset-user-password.dto";
import { UpdateProfileDto, UpsertIdentityDocumentDto } from "./dto/update-profile.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";

@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions("users.manage")
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  listAll() {
    return this.usersService.listAll();
  }

  // @RequirePermissions() خالی روی متد، متادیتای کلاس (users.manage) رو override می‌کنه —
  // این endpoint برای همه کاربران لاگین‌شده آزاده (لیست Mention در گفتگوی پرونده)
  @RequirePermissions()
  @Get("colleagues")
  listColleagues(@Query("forAssignment") forAssignment?: string) {
    return this.usersService.listColleagues(forAssignment === "true");
  }

  @Get("pending")
  listPending() {
    return this.usersService.listPending();
  }

  // پروفایل خودم (فاز ۱۵) — self-service، بدون کلید دسترسی جدید (مثل colleagues)
  @RequirePermissions()
  @Get("me")
  getMyProfile(@CurrentUser() user: RequestUser) {
    return this.usersService.getMyProfile(user.userId);
  }

  @RequirePermissions()
  @Patch("me")
  updateMyProfile(@Body() dto: UpdateProfileDto, @CurrentUser() user: RequestUser) {
    return this.usersService.updateMyProfile(user.userId, dto);
  }

  @RequirePermissions()
  @Post("me/change-password")
  changeMyPassword(@Body() dto: ChangePasswordDto, @CurrentUser() user: RequestUser) {
    return this.usersService.changeMyPassword(user.userId, dto);
  }

  @RequirePermissions()
  @Put("me/identity-documents")
  upsertMyIdentityDocument(@Body() dto: UpsertIdentityDocumentDto, @CurrentUser() user: RequestUser) {
    return this.usersService.upsertIdentityDocument(user.userId, dto);
  }

  @RequirePermissions()
  @Delete("me/identity-documents/:id")
  deleteMyIdentityDocument(
    @Param("id", ParseUUIDPipe) id: string,
    @CurrentUser() user: RequestUser,
  ) {
    return this.usersService.deleteIdentityDocument(user.userId, id);
  }

  @Post()
  create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  @Post(":id/approve")
  approve(@Param("id", ParseUUIDPipe) id: string, @Body() dto: ApproveUserDto) {
    return this.usersService.approve(id, dto.permissionGroupId);
  }

  @Patch(":id")
  update(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.usersService.update(id, dto, user.userId);
  }

  // P0-E3-F3-T6 — currentUserId enables the hierarchy check in the service.
  @Post(":id/reset-password")
  resetPassword(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: ResetUserPasswordDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.usersService.resetPassword(id, dto, user.userId);
  }
}
