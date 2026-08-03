import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CreateConversationDto, SendMessageDto, UpdateMessageDto } from "./dto/chat.dto";

const USER_SELECT = { id: true, fullName: true } as const;

@Injectable()
export class ChatService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(userId: string) {
    const participations = await this.prisma.chatParticipant.findMany({
      where: { userId },
      include: {
        conversation: {
          include: {
            participants: { include: { user: { select: USER_SELECT } } },
            messages: { orderBy: { createdAt: "desc" }, take: 1, include: { sender: { select: USER_SELECT } } },
          },
        },
      },
    });

    const items = await Promise.all(
      participations.map(async (p) => {
        const unreadCount = await this.prisma.chatMessage.count({
          where: {
            conversationId: p.conversationId,
            senderId: { not: userId },
            createdAt: { gt: p.lastReadAt ?? new Date(0) },
          },
        });
        const lastMessage = p.conversation.messages[0] ?? null;
        return {
          id: p.conversation.id,
          conversationType: p.conversation.conversationType,
          groupName: p.conversation.groupName,
          // فاز ۲۹ — lastReadAt هر شرکت‌کننده هم برگردونده می‌شه تا فرانت بتونه Read Receipt بسازه
          participants: p.conversation.participants.map((pp) => ({ ...pp.user, lastReadAt: pp.lastReadAt })),
          lastMessage,
          unreadCount,
          sortAt: lastMessage?.createdAt ?? p.conversation.createdAt,
        };
      }),
    );

    items.sort((a, b) => new Date(b.sortAt).getTime() - new Date(a.sortAt).getTime());
    return items.map(({ id, conversationType, groupName, participants, lastMessage, unreadCount }) => ({
      id,
      conversationType,
      groupName,
      participants,
      lastMessage,
      unreadCount,
    }));
  }

  async createConversation(dto: CreateConversationDto, currentUserId: string) {
    const otherIds = Array.from(new Set(dto.participantIds.filter((id) => id !== currentUserId)));
    if (otherIds.length === 0) {
      throw new BadRequestException("حداقل یک شرکت‌کننده دیگر لازمه");
    }
    const existingUsersCount = await this.prisma.user.count({ where: { id: { in: otherIds } } });
    if (existingUsersCount !== otherIds.length) {
      throw new NotFoundException("یکی از کاربران انتخاب‌شده یافت نشد");
    }

    if (dto.conversationType === "direct") {
      if (otherIds.length !== 1) {
        throw new BadRequestException("مکالمهٔ دونفره باید دقیقاً یک نفر دیگر داشته باشه");
      }
      const existing = await this.findExistingDirectConversation(currentUserId, otherIds[0]);
      if (existing) return this.getConversationDetail(existing, currentUserId);

      const conv = await this.prisma.chatConversation.create({
        data: {
          conversationType: "direct",
          createdBy: currentUserId,
          participants: { create: [{ userId: currentUserId }, { userId: otherIds[0] }] },
        },
      });
      return this.getConversationDetail(conv.id, currentUserId);
    }

    if (!dto.groupName || dto.groupName.trim().length === 0) {
      throw new BadRequestException("نام گروه الزامیه");
    }
    const allIds = Array.from(new Set([currentUserId, ...otherIds]));
    const conv = await this.prisma.chatConversation.create({
      data: {
        conversationType: "group",
        groupName: dto.groupName,
        createdBy: currentUserId,
        participants: { create: allIds.map((id) => ({ userId: id })) },
      },
    });
    return this.getConversationDetail(conv.id, currentUserId);
  }

  async getMessages(conversationId: string, userId: string) {
    await this.assertParticipant(conversationId, userId);
    return this.prisma.chatMessage.findMany({
      where: { conversationId },
      include: { sender: { select: USER_SELECT } },
      orderBy: { createdAt: "asc" },
    });
  }

  async sendMessage(conversationId: string, dto: SendMessageDto, userId: string) {
    await this.assertParticipant(conversationId, userId);
    const messageText = dto.messageText?.trim();
    const fileUrl = dto.fileUrl?.trim();
    if (!messageText && !fileUrl) {
      throw new BadRequestException("پیام باید حداقل متن یا پیوست داشته باشه");
    }
    // فاز ۲۸ — چون message_text ستون NOT NULL هست، فرانت همیشه یا کپشن کاربر یا نام
    // اصلی فایل (که از پاسخ آپلود می‌گیره) رو به‌عنوان messageText می‌فرسته؛ این فقط یک
    // شبکهٔ ایمنی برای فراخوانی مستقیم API بدون کپشن است
    return this.prisma.chatMessage.create({
      data: {
        conversationId,
        senderId: userId,
        messageText: messageText || "📎 پیوست",
        fileUrl,
      },
      include: { sender: { select: USER_SELECT } },
    });
  }

  async markRead(conversationId: string, userId: string) {
    await this.assertParticipant(conversationId, userId);
    await this.prisma.chatParticipant.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });
    return { success: true };
  }

  // فاز ۳۰ — ویرایش پیام: فقط خودِ فرستنده، فقط پیام حذف‌نشده
  async editMessage(messageId: string, dto: UpdateMessageDto, userId: string) {
    const message = await this.assertOwnMessage(messageId, userId);
    return this.prisma.chatMessage.update({
      where: { id: message.id },
      data: { messageText: dto.messageText.trim(), editedAt: new Date() },
      include: { sender: { select: USER_SELECT } },
    });
  }

  // فاز ۳۰ — حذف پیام: Soft Delete (مثل تلگرام) — رکورد می‌مونه، فرانت تومبستون نشون می‌ده
  async deleteMessage(messageId: string, userId: string) {
    const message = await this.assertOwnMessage(messageId, userId);
    return this.prisma.chatMessage.update({
      where: { id: message.id },
      data: { deletedAt: new Date() },
      include: { sender: { select: USER_SELECT } },
    });
  }

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------

  private async findExistingDirectConversation(userId: string, otherUserId: string) {
    const candidates = await this.prisma.chatConversation.findMany({
      where: {
        conversationType: "direct",
        participants: { some: { userId } },
        AND: [{ participants: { some: { userId: otherUserId } } }],
      },
      include: { participants: true },
    });
    const exact = candidates.find((c) => c.participants.length === 2);
    return exact?.id ?? null;
  }

  private async assertParticipant(conversationId: string, userId: string) {
    const participant = await this.prisma.chatParticipant.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!participant) {
      throw new NotFoundException("مکالمه یافت نشد");
    }
  }

  private async assertOwnMessage(messageId: string, userId: string) {
    const message = await this.prisma.chatMessage.findUnique({ where: { id: messageId } });
    if (!message || message.deletedAt) {
      throw new NotFoundException("پیام یافت نشد");
    }
    if (message.senderId !== userId) {
      throw new ForbiddenException("فقط فرستندهٔ پیام می‌تونه اون رو ویرایش/حذف کنه");
    }
    return message;
  }

  private async getConversationDetail(conversationId: string, userId: string) {
    const conv = await this.prisma.chatConversation.findUniqueOrThrow({
      where: { id: conversationId },
      include: {
        participants: { include: { user: { select: USER_SELECT } } },
        messages: { orderBy: { createdAt: "desc" }, take: 1, include: { sender: { select: USER_SELECT } } },
      },
    });
    const self = conv.participants.find((pp) => pp.userId === userId);
    const unreadCount = await this.prisma.chatMessage.count({
      where: { conversationId, senderId: { not: userId }, createdAt: { gt: self?.lastReadAt ?? new Date(0) } },
    });
    return {
      id: conv.id,
      conversationType: conv.conversationType,
      groupName: conv.groupName,
      participants: conv.participants.map((pp) => ({ ...pp.user, lastReadAt: pp.lastReadAt })),
      lastMessage: conv.messages[0] ?? null,
      unreadCount,
    };
  }
}
