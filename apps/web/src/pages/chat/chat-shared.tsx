import { Users } from "lucide-react";
import { ChatConversation, ChatMessage, ChatUser } from "./chat-api";

// آواتار + نام‌گذاری مکالمه — بین صفحهٔ کامل چت و ویجت شناور (فاز ۲۸) مشترکه
export function Avatar({ name, size = 36, isGroup = false }: { name: string; size?: number; isGroup?: boolean }) {
  const colors = ["#1F3A5F", "#A9633B", "#2F7D5D", "#7B4B94", "#B98900"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const initials = name.trim().split(" ").slice(0, 2).map((w) => w[0]).join("");
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 font-semibold text-white"
      style={{ width: size, height: size, background: colors[Math.abs(hash) % colors.length], fontSize: size * 0.36 }}
    >
      {isGroup ? <Users size={size * 0.45} /> : initials}
    </div>
  );
}

export function conversationName(conv: ChatConversation, selfId: string | undefined): string {
  if (conv.conversationType === "group") return conv.groupName ?? "گروه";
  const other = conv.participants.find((p) => p.id !== selfId);
  return other?.fullName ?? "کاربر";
}

// فاز ۲۹ — طرف مقابل مکالمهٔ دونفره (نه گروه)؛ مبنای Read Receipt
export function otherParticipant(conv: ChatConversation, selfId: string | undefined): ChatUser | null {
  if (conv.conversationType !== "direct") return null;
  return conv.participants.find((p) => p.id !== selfId) ?? null;
}

export interface ReadStatus {
  isRead: boolean;
  showLabel: boolean;
  readAt: string | null;
}

/** آخرین پیامی که من فرستادم و طرف مقابل خونده — برای نمایش برچسب «خوانده شد HH:MM» فقط زیر همون یکی */
export function lastReadMessageId(
  messages: ChatMessage[],
  selfId: string | undefined,
  otherLastReadAt: string | null | undefined,
): string | null {
  if (!otherLastReadAt) return null;
  const readTime = new Date(otherLastReadAt).getTime();
  let result: string | null = null;
  for (const m of messages) {
    if (m.senderId === selfId && new Date(m.createdAt).getTime() <= readTime) {
      result = m.id;
    }
  }
  return result;
}

export function getReadStatus(
  message: ChatMessage,
  isMe: boolean,
  conv: ChatConversation,
  lastReadId: string | null,
  otherLastReadAt: string | null | undefined,
): ReadStatus | undefined {
  if (!isMe || conv.conversationType !== "direct") return undefined;
  const isRead = !!otherLastReadAt && new Date(message.createdAt).getTime() <= new Date(otherLastReadAt).getTime();
  return { isRead, showLabel: message.id === lastReadId, readAt: otherLastReadAt ?? null };
}
