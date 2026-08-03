import { Module } from "@nestjs/common";
import { PermissionsModule } from "../permissions/permissions.module";
import { InquiriesModule } from "../inquiries/inquiries.module";
import { SelectionModule } from "../selection/selection.module";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";

@Module({
  imports: [PermissionsModule, InquiriesModule, SelectionModule],
  controllers: [OrderController],
  providers: [OrderService],
})
export class OrderModule {}
