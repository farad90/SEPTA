import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module";
import { ChatController } from "./chat.controller";
import { ChatService } from "./chat.service";

@Module({
  imports: [PermissionsModule],
  controllers: [ChatController],
  providers: [ChatService],
})
export class ChatModule {}
