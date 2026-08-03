import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module";
import { BroadcastMessagesController } from "./broadcast-messages.controller";
import { BroadcastMessagesService } from "./broadcast-messages.service";

@Module({
  imports: [PermissionsModule],
  controllers: [BroadcastMessagesController],
  providers: [BroadcastMessagesService],
})
export class BroadcastMessagesModule {}
