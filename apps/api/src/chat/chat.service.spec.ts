import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { ChatService } from "./chat.service";

const USER_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_ID = "22222222-2222-2222-2222-222222222222";
const CONV_ID = "33333333-3333-3333-3333-333333333333";

function buildPrisma() {
  return {
    user: { count: jest.fn().mockResolvedValue(1) },
    chatConversation: { findMany: jest.fn(), create: jest.fn(), findUniqueOrThrow: jest.fn() },
    chatParticipant: { findUnique: jest.fn(), findMany: jest.fn(), update: jest.fn() },
    chatMessage: {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn((args) => ({ id: "msg-1", ...args.data })),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn((args) => ({ id: args.where.id, ...args.data })),
    },
  };
}

function buildService(prisma: ReturnType<typeof buildPrisma>) {
  return new ChatService(prisma as unknown as PrismaService);
}

const EXISTING_CONVERSATION = {
  id: CONV_ID,
  conversationType: "direct",
  groupName: null,
  createdAt: new Date("2026-06-01T00:00:00Z"),
  participants: [
    { userId: USER_ID, lastReadAt: null, user: { id: USER_ID, fullName: "فرشید محمدی" } },
    { userId: OTHER_ID, lastReadAt: null, user: { id: OTHER_ID, fullName: "علی محمدی" } },
  ],
  messages: [],
};

describe("ChatService", () => {
  it("returns the existing direct conversation instead of creating a duplicate", async () => {
    const prisma = buildPrisma();
    prisma.chatConversation.findMany.mockResolvedValue([EXISTING_CONVERSATION]);
    prisma.chatConversation.findUniqueOrThrow.mockResolvedValue(EXISTING_CONVERSATION);
    const service = buildService(prisma);

    const result = await service.createConversation(
      { conversationType: "direct", participantIds: [OTHER_ID] },
      USER_ID,
    );

    expect(prisma.chatConversation.create).not.toHaveBeenCalled();
    expect(result.id).toBe(CONV_ID);
  });

  it("creates a new direct conversation when none exists yet", async () => {
    const prisma = buildPrisma();
    prisma.chatConversation.findMany.mockResolvedValue([]);
    prisma.chatConversation.create.mockResolvedValue({ id: CONV_ID });
    prisma.chatConversation.findUniqueOrThrow.mockResolvedValue(EXISTING_CONVERSATION);
    const service = buildService(prisma);

    const result = await service.createConversation(
      { conversationType: "direct", participantIds: [OTHER_ID] },
      USER_ID,
    );

    expect(prisma.chatConversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          conversationType: "direct",
          participants: { create: [{ userId: USER_ID }, { userId: OTHER_ID }] },
        }),
      }),
    );
    expect(result.id).toBe(CONV_ID);
  });

  it("rejects a direct conversation with more than one other participant", async () => {
    const prisma = buildPrisma();
    prisma.user.count.mockResolvedValue(2);
    const service = buildService(prisma);

    await expect(
      service.createConversation(
        { conversationType: "direct", participantIds: [OTHER_ID, "44444444-4444-4444-4444-444444444444"] },
        USER_ID,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it("computes unreadCount from messages after the participant's lastReadAt, excluding own messages", async () => {
    const prisma = buildPrisma();
    const lastReadAt = new Date("2026-07-01T00:00:00Z");
    prisma.chatParticipant.findMany.mockResolvedValue([
      {
        conversationId: CONV_ID,
        lastReadAt,
        conversation: {
          id: CONV_ID,
          conversationType: "direct",
          groupName: null,
          createdAt: new Date("2026-06-01T00:00:00Z"),
          participants: EXISTING_CONVERSATION.participants,
          messages: [],
        },
      },
    ]);
    prisma.chatMessage.count.mockResolvedValue(3);
    const service = buildService(prisma);

    const result = await service.listMine(USER_ID);

    expect(prisma.chatMessage.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          conversationId: CONV_ID,
          senderId: { not: USER_ID },
          createdAt: { gt: lastReadAt },
        }),
      }),
    );
    expect(result[0].unreadCount).toBe(3);
  });

  it("exposes each participant's lastReadAt for read-receipt computation (فاز ۲۹)", async () => {
    const prisma = buildPrisma();
    prisma.chatParticipant.findMany.mockResolvedValue([
      {
        conversationId: CONV_ID,
        lastReadAt: null,
        conversation: {
          id: CONV_ID,
          conversationType: "direct",
          groupName: null,
          createdAt: new Date("2026-06-01T00:00:00Z"),
          participants: EXISTING_CONVERSATION.participants,
          messages: [],
        },
      },
    ]);
    const service = buildService(prisma);

    const result = await service.listMine(USER_ID);

    expect(result[0].participants).toEqual([
      { id: USER_ID, fullName: "فرشید محمدی", lastReadAt: null },
      { id: OTHER_ID, fullName: "علی محمدی", lastReadAt: null },
    ]);
  });
});

describe("ChatService — پیوست فایل و استیکر (فاز ۲۸)", () => {
  it("sends a plain text message as before", async () => {
    const prisma = buildPrisma();
    prisma.chatParticipant.findUnique.mockResolvedValue({ conversationId: CONV_ID, userId: USER_ID });
    const service = buildService(prisma);

    await service.sendMessage(CONV_ID, { messageText: "سلام" }, USER_ID);

    expect(prisma.chatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ messageText: "سلام", fileUrl: undefined }) }),
    );
  });

  it("sends an attachment-only message using the caller-supplied fallback text", async () => {
    const prisma = buildPrisma();
    prisma.chatParticipant.findUnique.mockResolvedValue({ conversationId: CONV_ID, userId: USER_ID });
    const service = buildService(prisma);

    await service.sendMessage(CONV_ID, { messageText: "invoice.pdf", fileUrl: "2026/07/uuid.pdf" }, USER_ID);

    expect(prisma.chatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ messageText: "invoice.pdf", fileUrl: "2026/07/uuid.pdf" }),
      }),
    );
  });

  it("falls back to a generic label when only fileUrl is sent with no caption", async () => {
    const prisma = buildPrisma();
    prisma.chatParticipant.findUnique.mockResolvedValue({ conversationId: CONV_ID, userId: USER_ID });
    const service = buildService(prisma);

    await service.sendMessage(CONV_ID, { fileUrl: "2026/07/uuid.pdf" }, USER_ID);

    expect(prisma.chatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ messageText: "📎 پیوست", fileUrl: "2026/07/uuid.pdf" }),
      }),
    );
  });

  it("sends a sticker as a plain-text message (no special handling needed backend-side)", async () => {
    const prisma = buildPrisma();
    prisma.chatParticipant.findUnique.mockResolvedValue({ conversationId: CONV_ID, userId: USER_ID });
    const service = buildService(prisma);

    await service.sendMessage(CONV_ID, { messageText: "👍" }, USER_ID);

    expect(prisma.chatMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ messageText: "👍", fileUrl: undefined }) }),
    );
  });

  it("rejects a message with neither text nor attachment", async () => {
    const prisma = buildPrisma();
    prisma.chatParticipant.findUnique.mockResolvedValue({ conversationId: CONV_ID, userId: USER_ID });
    const service = buildService(prisma);

    await expect(service.sendMessage(CONV_ID, {}, USER_ID)).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.chatMessage.create).not.toHaveBeenCalled();
  });

  it("rejects a message with only whitespace text and no attachment", async () => {
    const prisma = buildPrisma();
    prisma.chatParticipant.findUnique.mockResolvedValue({ conversationId: CONV_ID, userId: USER_ID });
    const service = buildService(prisma);

    await expect(service.sendMessage(CONV_ID, { messageText: "   " }, USER_ID)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});

describe("ChatService — ویرایش و حذف پیام (فاز ۳۰)", () => {
  const MSG_ID = "44444444-4444-4444-4444-444444444444";

  it("allows the sender to edit their own message", async () => {
    const prisma = buildPrisma();
    prisma.chatMessage.findUnique.mockResolvedValue({
      id: MSG_ID,
      senderId: USER_ID,
      messageText: "متن اولیه",
      deletedAt: null,
    });
    const service = buildService(prisma);

    const result = await service.editMessage(MSG_ID, { messageText: "متن ویرایش‌شده" }, USER_ID);

    expect(prisma.chatMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: MSG_ID },
        data: expect.objectContaining({ messageText: "متن ویرایش‌شده" }),
      }),
    );
    expect(result.messageText).toBe("متن ویرایش‌شده");
  });

  it("rejects editing someone else's message", async () => {
    const prisma = buildPrisma();
    prisma.chatMessage.findUnique.mockResolvedValue({
      id: MSG_ID,
      senderId: OTHER_ID,
      messageText: "متن اولیه",
      deletedAt: null,
    });
    const service = buildService(prisma);

    await expect(service.editMessage(MSG_ID, { messageText: "دستکاری" }, USER_ID)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.chatMessage.update).not.toHaveBeenCalled();
  });

  it("rejects editing an already-deleted message", async () => {
    const prisma = buildPrisma();
    prisma.chatMessage.findUnique.mockResolvedValue({
      id: MSG_ID,
      senderId: USER_ID,
      messageText: "متن اولیه",
      deletedAt: new Date(),
    });
    const service = buildService(prisma);

    await expect(service.editMessage(MSG_ID, { messageText: "دستکاری" }, USER_ID)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it("allows the sender to soft-delete their own message", async () => {
    const prisma = buildPrisma();
    prisma.chatMessage.findUnique.mockResolvedValue({
      id: MSG_ID,
      senderId: USER_ID,
      messageText: "متن اولیه",
      deletedAt: null,
    });
    const service = buildService(prisma);

    await service.deleteMessage(MSG_ID, USER_ID);

    expect(prisma.chatMessage.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: MSG_ID },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
  });

  it("rejects deleting someone else's message", async () => {
    const prisma = buildPrisma();
    prisma.chatMessage.findUnique.mockResolvedValue({
      id: MSG_ID,
      senderId: OTHER_ID,
      messageText: "متن اولیه",
      deletedAt: null,
    });
    const service = buildService(prisma);

    await expect(service.deleteMessage(MSG_ID, USER_ID)).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.chatMessage.update).not.toHaveBeenCalled();
  });

  it("rejects editing/deleting a message that doesn't exist", async () => {
    const prisma = buildPrisma();
    prisma.chatMessage.findUnique.mockResolvedValue(null);
    const service = buildService(prisma);

    await expect(service.deleteMessage(MSG_ID, USER_ID)).rejects.toBeInstanceOf(NotFoundException);
  });
});
