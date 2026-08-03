import { NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { BroadcastMessagesService } from "./broadcast-messages.service";

function buildPrisma() {
  return {
    broadcastMessage: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    broadcastMessageDismissal: {
      upsert: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  };
}

describe("BroadcastMessagesService", () => {
  it("create() برای targetType='user' فقط targetUserId رو نگه می‌داره، targetGroupId رو null می‌کنه", async () => {
    const prisma = buildPrisma();
    const service = new BroadcastMessagesService(prisma as unknown as PrismaService);

    await service.create(
      { message: "سلام", targetType: "user", targetUserId: "user-2", targetGroupId: "group-9" },
      "creator-1",
    );

    expect(prisma.broadcastMessage.create).toHaveBeenCalledWith({
      data: {
        imageUrl: undefined,
        message: "سلام",
        targetType: "user",
        targetUserId: "user-2",
        targetGroupId: null,
        createdBy: "creator-1",
      },
    });
  });

  it("create() برای targetType='group' فقط targetGroupId رو نگه می‌داره", async () => {
    const prisma = buildPrisma();
    const service = new BroadcastMessagesService(prisma as unknown as PrismaService);

    await service.create(
      { message: "پیام گروهی", targetType: "group", targetGroupId: "group-9" },
      "creator-1",
    );

    expect(prisma.broadcastMessage.create).toHaveBeenCalledWith({
      data: {
        imageUrl: undefined,
        message: "پیام گروهی",
        targetType: "group",
        targetUserId: null,
        targetGroupId: "group-9",
        createdBy: "creator-1",
      },
    });
  });

  it("create() برای targetType='all' هم targetUserId هم targetGroupId رو null می‌کنه", async () => {
    const prisma = buildPrisma();
    const service = new BroadcastMessagesService(prisma as unknown as PrismaService);

    await service.create({ message: "به همه", targetType: "all" }, "creator-1");

    expect(prisma.broadcastMessage.create).toHaveBeenCalledWith({
      data: {
        imageUrl: undefined,
        message: "به همه",
        targetType: "all",
        targetUserId: null,
        targetGroupId: null,
        createdBy: "creator-1",
      },
    });
  });

  it("deactivate() وقتی پیام یافت نشد NotFound می‌ده", async () => {
    const prisma = buildPrisma();
    prisma.broadcastMessage.findUnique.mockResolvedValue(null);
    const service = new BroadcastMessagesService(prisma as unknown as PrismaService);

    await expect(service.deactivate("missing")).rejects.toBeInstanceOf(NotFoundException);
    expect(prisma.broadcastMessage.update).not.toHaveBeenCalled();
  });

  it("getPending() فقط پیام‌های active با target=all یا user یا گروه خود کاربر رو می‌گیره، دیده‌شده‌ها رو حذف می‌کنه", async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue({ permissionGroupId: "group-9" });
    const service = new BroadcastMessagesService(prisma as unknown as PrismaService);

    await service.getPending("user-1");

    expect(prisma.broadcastMessage.findMany).toHaveBeenCalledWith({
      where: {
        active: true,
        OR: [
          { targetType: "all" },
          { targetType: "user", targetUserId: "user-1" },
          { targetType: "group", targetGroupId: "group-9" },
        ],
        dismissals: { none: { userId: "user-1" } },
      },
      orderBy: { createdAt: "asc" },
    });
  });

  it("getPending() وقتی کاربر گروه دسترسی نداره، شرط گروه اضافه نمی‌شه", async () => {
    const prisma = buildPrisma();
    prisma.user.findUnique.mockResolvedValue({ permissionGroupId: null });
    const service = new BroadcastMessagesService(prisma as unknown as PrismaService);

    await service.getPending("user-1");

    expect(prisma.broadcastMessage.findMany).toHaveBeenCalledWith({
      where: {
        active: true,
        OR: [{ targetType: "all" }, { targetType: "user", targetUserId: "user-1" }],
        dismissals: { none: { userId: "user-1" } },
      },
      orderBy: { createdAt: "asc" },
    });
  });

  it("dismiss() با upsert idempotent — بستن دوباره خطا نمی‌ده و رکورد تکراری نمی‌سازه", async () => {
    const prisma = buildPrisma();
    const service = new BroadcastMessagesService(prisma as unknown as PrismaService);

    await service.dismiss("broadcast-1", "user-1");

    expect(prisma.broadcastMessageDismissal.upsert).toHaveBeenCalledWith({
      where: { broadcastMessageId_userId: { broadcastMessageId: "broadcast-1", userId: "user-1" } },
      update: {},
      create: { broadcastMessageId: "broadcast-1", userId: "user-1" },
    });
  });
});
