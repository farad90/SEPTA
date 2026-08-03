import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../generated/prisma";
import { PrismaService } from "../prisma/prisma.service";
import { CreateBroadcastMessageDto } from "./dto/create-broadcast-message.dto";

@Injectable()
export class BroadcastMessagesService {
  constructor(private readonly prisma: PrismaService) {}

  // پنل مدیریتی — همه پیام‌ها (فعال و غیرفعال)، جدیدترین اول
  listAll() {
    return this.prisma.broadcastMessage.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        creator: { select: { id: true, fullName: true } },
        targetUser: { select: { id: true, fullName: true } },
        targetGroup: { select: { id: true, groupName: true } },
      },
    });
  }

  create(dto: CreateBroadcastMessageDto, createdByUserId: string) {
    return this.prisma.broadcastMessage.create({
      data: {
        imageUrl: dto.imageUrl,
        message: dto.message,
        targetType: dto.targetType,
        targetUserId: dto.targetType === "user" ? dto.targetUserId : null,
        targetGroupId: dto.targetType === "group" ? dto.targetGroupId : null,
        createdBy: createdByUserId,
      },
    });
  }

  async deactivate(id: string) {
    const existing = await this.prisma.broadcastMessage.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException("پیام اعلامی یافت نشد");
    }
    return this.prisma.broadcastMessage.update({ where: { id }, data: { active: false } });
  }

  // پیام‌های فعالی که این کاربر هنوز ندیده — بدون فن‌اوت رکورد، در لحظه بررسی می‌شه
  async getPending(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { permissionGroupId: true },
    });

    const orConditions: Prisma.BroadcastMessageWhereInput[] = [
      { targetType: "all" },
      { targetType: "user", targetUserId: userId },
    ];
    if (user?.permissionGroupId) {
      orConditions.push({ targetType: "group", targetGroupId: user.permissionGroupId });
    }

    return this.prisma.broadcastMessage.findMany({
      where: {
        active: true,
        OR: orConditions,
        dismissals: { none: { userId } },
      },
      orderBy: { createdAt: "asc" },
    });
  }

  // یک‌بار نمایش — بعد از بستن، دیگه هرگز تکرار نمی‌شه (idempotent)
  async dismiss(broadcastMessageId: string, userId: string) {
    await this.prisma.broadcastMessageDismissal.upsert({
      where: { broadcastMessageId_userId: { broadcastMessageId, userId } },
      update: {},
      create: { broadcastMessageId, userId },
    });
  }
}
