import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { BroadcastMessagesService } from "./broadcast-messages.service";
import { CreateBroadcastMessageDto } from "./dto/create-broadcast-message.dto";

@UseGuards(JwtAuthGuard)
@Controller("broadcast-messages")
export class BroadcastMessagesController {
  constructor(private readonly service: BroadcastMessagesService) {}

  // پنل مدیریتی — پشت مجوز جدا
  @UseGuards(PermissionsGuard)
  @RequirePermissions("broadcast_messages.manage")
  @Get()
  listAll() {
    return this.service.listAll();
  }

  @UseGuards(PermissionsGuard)
  @RequirePermissions("broadcast_messages.manage")
  @Post()
  create(@Body() dto: CreateBroadcastMessageDto, @CurrentUser() user: RequestUser) {
    return this.service.create(dto, user.userId);
  }

  @UseGuards(PermissionsGuard)
  @RequirePermissions("broadcast_messages.manage")
  @Post(":id/deactivate")
  deactivate(@Param("id", ParseUUIDPipe) id: string) {
    return this.service.deactivate(id);
  }

  // برای همه کاربران لاگین‌شده — بدون نیاز به مجوز خاص
  @Get("pending")
  getPending(@CurrentUser() user: RequestUser) {
    return this.service.getPending(user.userId);
  }

  @Post(":id/dismiss")
  dismiss(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.service.dismiss(id, user.userId);
  }
}
