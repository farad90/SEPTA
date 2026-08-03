import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";

const CONVERSATIONS_KEY = ["chat", "conversations"];
const messagesKey = (conversationId: string) => ["chat", "conversations", conversationId, "messages"];

export interface ChatUser {
  id: string;
  fullName: string;
  // فاز ۲۹ — فقط در پاسخ لیست/جزئیات مکالمه پر می‌شه (نه روی sender پیام)، مبنای Read Receipt
  lastReadAt?: string | null;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  messageText: string;
  fileUrl: string | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  sender: ChatUser;
}

export interface ChatConversation {
  id: string;
  conversationType: "direct" | "group";
  groupName: string | null;
  participants: ChatUser[];
  lastMessage: ChatMessage | null;
  unreadCount: number;
}

export function useConversations() {
  return useQuery({
    queryKey: CONVERSATIONS_KEY,
    queryFn: async () => (await apiClient.get<ChatConversation[]>("/chat/conversations")).data,
    refetchInterval: 8_000,
  });
}

export function useMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: conversationId ? messagesKey(conversationId) : ["chat", "conversations", "none"],
    queryFn: async () => (await apiClient.get<ChatMessage[]>(`/chat/conversations/${conversationId}/messages`)).data,
    enabled: !!conversationId,
    refetchInterval: 3_000,
  });
}

export function useChatMutations() {
  const queryClient = useQueryClient();

  const createConversation = useMutation({
    mutationFn: async (body: { conversationType: "direct" | "group"; participantIds: string[]; groupName?: string }) =>
      (await apiClient.post<ChatConversation>("/chat/conversations", body)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY }),
  });

  const sendMessage = useMutation({
    mutationFn: async ({
      conversationId,
      messageText,
      fileUrl,
    }: {
      conversationId: string;
      messageText?: string;
      fileUrl?: string;
    }) =>
      (await apiClient.post<ChatMessage>(`/chat/conversations/${conversationId}/messages`, { messageText, fileUrl }))
        .data,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: messagesKey(variables.conversationId) });
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });

  const markRead = useMutation({
    mutationFn: async (conversationId: string) => (await apiClient.post(`/chat/conversations/${conversationId}/read`)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY }),
  });

  // فاز ۳۰ — ویرایش/حذف پیام توسط خودِ فرستنده
  const editMessage = useMutation({
    mutationFn: async (vars: { conversationId: string; messageId: string; messageText: string }) =>
      (await apiClient.patch<ChatMessage>(`/chat/messages/${vars.messageId}`, { messageText: vars.messageText })).data,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: messagesKey(variables.conversationId) });
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });

  const deleteMessage = useMutation({
    mutationFn: async (vars: { conversationId: string; messageId: string }) =>
      (await apiClient.delete(`/chat/messages/${vars.messageId}`)).data,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: messagesKey(variables.conversationId) });
      queryClient.invalidateQueries({ queryKey: CONVERSATIONS_KEY });
    },
  });

  return { createConversation, sendMessage, markRead, editMessage, deleteMessage };
}
