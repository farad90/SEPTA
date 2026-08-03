import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, UseGuards } from "@nestjs/common";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard";
import { CurrentUser, RequestUser } from "../auth/decorators/current-user.decorator";
import { PermissionsGuard } from "../permissions/permissions.guard";
import { RequirePermissions } from "../permissions/require-permissions.decorator";
import { ChatService } from "./chat.service";
import { CreateConversationDto, SendMessageDto, UpdateMessageDto } from "./dto/chat.dto";

// پیام‌رسانی سراسری — دادهٔ شخصی کاربرن، طبق الگوی users/colleagues بدون کلید دسترسی جدید
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions()
@Controller("chat")
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get("conversations")
  listMine(@CurrentUser() user: RequestUser) {
    return this.chatService.listMine(user.userId);
  }

  @Post("conversations")
  createConversation(@Body() dto: CreateConversationDto, @CurrentUser() user: RequestUser) {
    return this.chatService.createConversation(dto, user.userId);
  }

  @Get("conversations/:id/messages")
  getMessages(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.chatService.getMessages(id, user.userId);
  }

  @Post("conversations/:id/messages")
  sendMessage(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.chatService.sendMessage(id, dto, user.userId);
  }

  @Post("conversations/:id/read")
  markRead(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.chatService.markRead(id, user.userId);
  }

  @Patch("messages/:id")
  editMessage(
    @Param("id", ParseUUIDPipe) id: string,
    @Body() dto: UpdateMessageDto,
    @CurrentUser() user: RequestUser,
  ) {
    return this.chatService.editMessage(id, dto, user.userId);
  }

  @Delete("messages/:id")
  deleteMessage(@Param("id", ParseUUIDPipe) id: string, @CurrentUser() user: RequestUser) {
    return this.chatService.deleteMessage(id, user.userId);
  }
}
