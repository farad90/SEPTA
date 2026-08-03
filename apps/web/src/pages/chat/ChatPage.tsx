import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  MessageSquarePlus,
  Paperclip,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { useColleagues } from "../users/users-api";
import { relativeTimeFa } from "../../lib/relative-time";
import { useChatMutations, useConversations, useMessages } from "./chat-api";
import { MessageBubble } from "./MessageBubble";
import { MessageComposer, MessageComposerHandle } from "./MessageComposer";
import { Avatar, conversationName, getReadStatus, lastReadMessageId, otherParticipant } from "./chat-shared";
import { useAutoScroll } from "./use-auto-scroll";
import { useMessageSearch } from "./use-message-search";
import { NewDirectModal, NewGroupModal } from "./NewConversationModals";

export function ChatPage() {
  const { user } = useAuth();
  const { data: conversations = [] } = useConversations();
  const { data: colleagues = [] } = useColleagues();
  const { createConversation, sendMessage, markRead } = useChatMutations();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showNewDirect, setShowNewDirect] = useState(false);
  const [mobileShowChat, setMobileShowChat] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const dragCounter = useRef(0);
  const composerRef = useRef<MessageComposerHandle>(null);

  const { data: messages = [] } = useMessages(selectedId ?? undefined);

  useEffect(() => {
    if (!selectedId && conversations.length > 0) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId]);

  useEffect(() => {
    if (selectedId) markRead.mutate(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, messages.length]);

  const otherColleagues = useMemo(
    () => colleagues.filter((c) => c.id !== user?.id),
    [colleagues, user?.id],
  );

  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  const other = selected ? otherParticipant(selected, user?.id) : null;
  const readLastId = useMemo(
    () => (selected ? lastReadMessageId(messages, user?.id, other?.lastReadAt) : null),
    [messages, user?.id, other?.lastReadAt, selected],
  );
  const { containerRef, bottomRef, showJump, scrollToBottom, onScroll } = useAutoScroll(
    messages,
    user?.id,
    selectedId ?? undefined,
  );
  const search = useMessageSearch(messages, selectedId ?? undefined);

  const filtered = conversations.filter((c) =>
    conversationName(c, user?.id).toLowerCase().includes(query.toLowerCase()),
  );

  const createGroup = (name: string, memberIds: string[]) => {
    createConversation.mutate(
      { conversationType: "group", groupName: name, participantIds: memberIds },
      {
        onSuccess: (conv) => {
          setSelectedId(conv.id);
          setShowNewGroup(false);
          setMobileShowChat(true);
        },
      },
    );
  };

  const pickDirect = (colleagueId: string) => {
    createConversation.mutate(
      { conversationType: "direct", participantIds: [colleagueId] },
      {
        onSuccess: (conv) => {
          setSelectedId(conv.id);
          setShowNewDirect(false);
          setMobileShowChat(true);
        },
      },
    );
  };

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) {
      dragCounter.current += 1;
      setDragActive(true);
    }
  };
  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) setDragActive(false);
  };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setDragActive(false);
    composerRef.current?.addFiles(Array.from(e.dataTransfer.files));
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -m-4 sm:-m-8 overflow-hidden">
      {/* لیست مکالمات */}
      <div
        className={`w-full sm:w-80 shrink-0 flex-col bg-surface border-l border-border ${
          mobileShowChat ? "hidden sm:flex" : "flex"
        }`}
      >
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold text-textPrimary">پیام‌ها</h1>
            <div className="flex gap-1.5">
              <button
                onClick={() => setShowNewDirect(true)}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg text-textPrimary border border-border"
                title="پیام مستقیم جدید"
              >
                <MessageSquarePlus size={13} />
              </button>
              <button
                onClick={() => setShowNewGroup(true)}
                className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg text-white bg-primary"
              >
                <Plus size={13} /> گروه جدید
              </button>
            </div>
          </div>
          <div className="relative">
            <Search size={14} className="absolute top-2.5 right-3 text-textSecondary" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="جست‌وجو..."
              className="w-full text-xs rounded-lg pr-8 pl-2 py-2 border border-border"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <p className="px-4 py-6 text-xs text-textSecondary text-center">مکالمه‌ای وجود ندارد</p>
          )}
          {filtered.map((c) => {
            const name = conversationName(c, user?.id);
            return (
              <button
                key={c.id}
                onClick={() => {
                  setSelectedId(c.id);
                  setMobileShowChat(true);
                }}
                className={`w-full flex items-center gap-2.5 px-4 py-3 text-right border-b border-border ${
                  selectedId === c.id ? "bg-accentSoft" : ""
                }`}
              >
                <Avatar name={name} isGroup={c.conversationType === "group"} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium truncate text-textPrimary">{name}</p>
                    {c.lastMessage && (
                      <span className="text-[10px] shrink-0 text-textSecondary">
                        {relativeTimeFa(c.lastMessage.createdAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs truncate text-textSecondary">
                    {c.lastMessage ? c.lastMessage.messageText : "گروه جدید ایجاد شد"}
                  </p>
                </div>
                {c.unreadCount > 0 && (
                  <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 bg-accent">
                    {c.unreadCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* پنجره گفتگو */}
      <div className={`flex-1 flex-col ${mobileShowChat ? "flex" : "hidden sm:flex"}`}>
        {selected ? (
          <>
            {search.open ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-surface border-b border-border">
                <Search size={14} className="text-textSecondary shrink-0" />
                <input
                  autoFocus
                  value={search.query}
                  onChange={(e) => search.setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") search.next();
                    if (e.key === "Escape") search.close();
                  }}
                  placeholder="جست‌وجو در پیام‌ها..."
                  className="flex-1 text-sm bg-transparent outline-none"
                />
                {search.query.trim() && (
                  <span className="text-[11px] text-textSecondary shrink-0">
                    {search.matches.length > 0 ? `${search.index + 1}/${search.matches.length}` : "0/0"}
                  </span>
                )}
                <button onClick={search.prev} disabled={search.matches.length === 0} className="text-textSecondary disabled:opacity-30">
                  <ChevronUp size={16} />
                </button>
                <button onClick={search.next} disabled={search.matches.length === 0} className="text-textSecondary disabled:opacity-30">
                  <ChevronDown size={16} />
                </button>
                <button onClick={search.close} aria-label="بستن جست‌وجو" className="text-textSecondary">
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2.5 px-4 py-3 bg-surface border-b border-border">
                <button className="sm:hidden" onClick={() => setMobileShowChat(false)} aria-label="بازگشت">
                  <ArrowRight size={18} className="text-textSecondary" />
                </button>
                <Avatar
                  name={conversationName(selected, user?.id)}
                  isGroup={selected.conversationType === "group"}
                />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-textPrimary">
                    {conversationName(selected, user?.id)}
                  </p>
                  {selected.conversationType === "group" && (
                    <p className="text-[11px] text-textSecondary">{selected.participants.length} عضو</p>
                  )}
                </div>
                <button
                  onClick={() => search.setOpen(true)}
                  aria-label="جست‌وجو در پیام‌ها"
                  title="جست‌وجو"
                  className="text-textSecondary hover:text-primary"
                >
                  <Search size={16} />
                </button>
              </div>
            )}

            <div
              className="flex-1 min-h-0 relative"
              onDragEnter={onDragEnter}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={onDragLeave}
              onDrop={onDrop}
            >
              <div ref={containerRef} onScroll={onScroll} className="h-full overflow-y-auto p-4 space-y-3">
                {messages.map((m) => (
                  <MessageBubble
                    key={m.id}
                    message={m}
                    isMe={m.senderId === user?.id}
                    showSenderName={selected.conversationType === "group"}
                    readStatus={getReadStatus(m, m.senderId === user?.id, selected, readLastId, other?.lastReadAt)}
                    highlighted={m.id === search.activeMessageId}
                  />
                ))}
                {messages.length === 0 && (
                  <p className="text-xs text-textSecondary text-center">هنوز پیامی ارسال نشده</p>
                )}
                <div ref={bottomRef} />
              </div>
              {showJump && (
                <button
                  onClick={() => scrollToBottom()}
                  className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 text-xs px-3 py-1.5 rounded-full text-white bg-primary shadow-lg"
                >
                  <ArrowDown size={13} /> پیام‌های جدید
                </button>
              )}
              {dragActive && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary m-2 rounded-lg pointer-events-none">
                  <div className="flex flex-col items-center gap-2 text-primary">
                    <Paperclip size={28} />
                    <p className="text-sm font-medium">برای ارسال فایل رها کنید</p>
                  </div>
                </div>
              )}
            </div>

            <MessageComposer
              ref={composerRef}
              onSend={(body) => selectedId && sendMessage.mutate({ conversationId: selectedId, ...body })}
            />
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm text-textSecondary">یک مکالمه را انتخاب کن</p>
          </div>
        )}
      </div>

      {showNewGroup && (
        <NewGroupModal
          colleagues={otherColleagues}
          onCancel={() => setShowNewGroup(false)}
          onCreate={createGroup}
        />
      )}
      {showNewDirect && (
        <NewDirectModal
          colleagues={otherColleagues}
          onCancel={() => setShowNewDirect(false)}
          onPick={pickDirect}
        />
      )}
    </div>
  );
}
