import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  MessageCircle,
  MessageSquarePlus,
  Paperclip,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { useClickOutside } from "../../lib/use-click-outside";
import { useColleagues } from "../users/users-api";
import { relativeTimeFa } from "../../lib/relative-time";
import { useChatMutations, useConversations, useMessages } from "./chat-api";
import { MessageBubble } from "./MessageBubble";
import { MessageComposer, MessageComposerHandle } from "./MessageComposer";
import { Avatar, conversationName, getReadStatus, lastReadMessageId, otherParticipant } from "./chat-shared";
import { useAutoScroll } from "./use-auto-scroll";
import { useMessageSearch } from "./use-message-search";
import { NewDirectModal, NewGroupModal } from "./NewConversationModals";

// فاز ۲۹/۳۰ — نوار چت شناور، مثل فیسبوک مسنجر: یک نوار همیشه‌ثابت در پایین صفحه (نه یک دکمهٔ
// گرد شناور) که هیچ‌وقت جابه‌جا نمی‌شه — چون خودِ نوار همیشه آخرین فرزند یک ستون Flex در
// یک کانتینر `fixed bottom-0` است، پنل گفتگو فقط بالای همون نوار باز/بسته می‌شه بدون اینکه
// موقعیت خودِ نوار روی صفحه تغییر کنه. فاز ۳۰: مکالمهٔ جدید + Drag&Drop + جست‌وجو هم همینجا موجوده.
export function ChatWidget() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showNewDirect, setShowNewDirect] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const dragCounter = useRef(0);
  const ref = useRef<HTMLDivElement>(null);
  const composerRef = useRef<MessageComposerHandle>(null);
  useClickOutside(ref, () => setOpen(false));

  const { data: conversations = [] } = useConversations();
  const { data: colleagues = [] } = useColleagues();
  const { createConversation, sendMessage, markRead } = useChatMutations();
  const { data: messages = [] } = useMessages(open ? (selectedId ?? undefined) : undefined);

  const otherColleagues = useMemo(
    () => colleagues.filter((c) => c.id !== user?.id),
    [colleagues, user?.id],
  );

  const totalUnread = conversations.reduce((sum, c) => sum + c.unreadCount, 0);
  const selected = conversations.find((c) => c.id === selectedId) ?? null;
  const other = selected ? otherParticipant(selected, user?.id) : null;
  const readLastId = useMemo(
    () => (selected ? lastReadMessageId(messages, user?.id, other?.lastReadAt) : null),
    [messages, user?.id, other?.lastReadAt, selected],
  );
  const { containerRef, bottomRef, showJump, scrollToBottom, onScroll } = useAutoScroll(
    messages,
    user?.id,
    open ? (selectedId ?? undefined) : undefined,
  );
  const search = useMessageSearch(messages, selectedId ?? undefined);

  const openConversation = (id: string) => {
    setSelectedId(id);
    markRead.mutate(id);
  };

  const createGroup = (name: string, memberIds: string[]) => {
    createConversation.mutate(
      { conversationType: "group", groupName: name, participantIds: memberIds },
      { onSuccess: (conv) => { openConversation(conv.id); setShowNewGroup(false); } },
    );
  };

  const pickDirect = (colleagueId: string) => {
    createConversation.mutate(
      { conversationType: "direct", participantIds: [colleagueId] },
      { onSuccess: (conv) => { openConversation(conv.id); setShowNewDirect(false); } },
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
    <div className="fixed bottom-0 left-4 z-40 flex flex-col items-stretch w-80" ref={ref}>
      {open && (
        <div className="w-full h-[26rem] flex flex-col overflow-hidden rounded-t-lg bg-surface border border-border border-b-0 shadow-2xl">
          {selected ? (
            <>
              {search.open ? (
                <div className="flex items-center gap-1.5 px-2.5 py-2 border-b border-border bg-surface shrink-0">
                  <Search size={13} className="text-textSecondary shrink-0" />
                  <input
                    autoFocus
                    value={search.query}
                    onChange={(e) => search.setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") search.next();
                      if (e.key === "Escape") search.close();
                    }}
                    placeholder="جست‌وجو..."
                    className="flex-1 min-w-0 text-xs bg-transparent outline-none"
                  />
                  {search.query.trim() && (
                    <span className="text-[10px] text-textSecondary shrink-0">
                      {search.matches.length > 0 ? `${search.index + 1}/${search.matches.length}` : "0/0"}
                    </span>
                  )}
                  <button onClick={search.prev} disabled={search.matches.length === 0} className="text-textSecondary disabled:opacity-30">
                    <ChevronUp size={14} />
                  </button>
                  <button onClick={search.next} disabled={search.matches.length === 0} className="text-textSecondary disabled:opacity-30">
                    <ChevronDown size={14} />
                  </button>
                  <button onClick={search.close} aria-label="بستن جست‌وجو" className="text-textSecondary">
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-surface shrink-0">
                  <button onClick={() => setSelectedId(null)} aria-label="بازگشت به لیست">
                    <ArrowRight size={16} className="text-textSecondary" />
                  </button>
                  <Avatar name={conversationName(selected, user?.id)} size={28} isGroup={selected.conversationType === "group"} />
                  <p className="text-xs font-semibold text-textPrimary truncate flex-1">
                    {conversationName(selected, user?.id)}
                  </p>
                  <button onClick={() => search.setOpen(true)} aria-label="جست‌وجو در پیام‌ها" className="text-textSecondary hover:text-primary">
                    <Search size={14} />
                  </button>
                  <Link to="/chat" className="text-textSecondary hover:text-primary" title="باز کردن در حالت کامل">
                    <ExternalLink size={14} />
                  </Link>
                </div>
              )}
              <div
                className="flex-1 min-h-0 relative"
                onDragEnter={onDragEnter}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
              >
                <div ref={containerRef} onScroll={onScroll} className="h-full overflow-y-auto p-3 space-y-2">
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
                    <p className="text-[11px] text-textSecondary text-center">هنوز پیامی ارسال نشده</p>
                  )}
                  <div ref={bottomRef} />
                </div>
                {showJump && (
                  <button
                    onClick={() => scrollToBottom()}
                    className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-full text-white bg-primary shadow-lg"
                  >
                    <ArrowDown size={11} /> پیام‌های جدید
                  </button>
                )}
                {dragActive && (
                  <div className="absolute inset-0 z-10 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary m-1.5 rounded-lg pointer-events-none">
                    <div className="flex flex-col items-center gap-1.5 text-primary">
                      <Paperclip size={22} />
                      <p className="text-[11px] font-medium">رها کنید</p>
                    </div>
                  </div>
                )}
              </div>
              <MessageComposer
                ref={composerRef}
                compact
                onSend={(body) => selectedId && sendMessage.mutate({ conversationId: selectedId, ...body })}
              />
            </>
          ) : (
            <>
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-surface shrink-0">
                <p className="text-xs font-semibold text-textPrimary">پیام‌ها</p>
                <div className="flex items-center gap-2">
                  <button onClick={() => setShowNewDirect(true)} aria-label="پیام مستقیم جدید" title="پیام مستقیم جدید" className="text-textSecondary hover:text-primary">
                    <MessageSquarePlus size={14} />
                  </button>
                  <button onClick={() => setShowNewGroup(true)} aria-label="گروه جدید" title="گروه جدید" className="text-textSecondary hover:text-primary">
                    <Plus size={15} />
                  </button>
                  <Link to="/chat" className="text-textSecondary hover:text-primary" title="باز کردن در حالت کامل">
                    <ExternalLink size={14} />
                  </Link>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto">
                {conversations.length === 0 && (
                  <p className="px-4 py-6 text-[11px] text-textSecondary text-center">
                    مکالمه‌ای وجود ندارد — یکی بساز.
                  </p>
                )}
                {conversations.map((c) => {
                  const name = conversationName(c, user?.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => openConversation(c.id)}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-right border-b border-border hover:bg-bg"
                    >
                      <Avatar name={name} size={30} isGroup={c.conversationType === "group"} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-medium truncate text-textPrimary">{name}</p>
                          {c.lastMessage && (
                            <span className="text-[9px] shrink-0 text-textSecondary">
                              {relativeTimeFa(c.lastMessage.createdAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] truncate text-textSecondary">
                          {c.lastMessage ? c.lastMessage.messageText : "بدون پیام"}
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
            </>
          )}
        </div>
      )}

      {/* نوار ثابت — همیشه رندر می‌شه با ارتفاع ثابت، هیچ‌وقت روی صفحه جابه‌جا نمی‌شه */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full h-11 flex items-center gap-2 px-3.5 rounded-t-lg text-white bg-primary shadow-lg shrink-0"
        aria-label="چت"
      >
        <MessageCircle size={17} />
        <span className="text-xs font-semibold">پیام‌ها</span>
        {totalUnread > 0 && (
          <span className="h-[18px] min-w-[18px] px-1 rounded-full flex items-center justify-center text-[10px] font-bold text-white bg-danger">
            {totalUnread > 9 ? "9+" : totalUnread}
          </span>
        )}
        {open ? <ChevronDown size={15} className="mr-auto" /> : <ChevronUp size={15} className="mr-auto" />}
      </button>

      {showNewGroup && (
        <NewGroupModal colleagues={otherColleagues} onCancel={() => setShowNewGroup(false)} onCreate={createGroup} />
      )}
      {showNewDirect && (
        <NewDirectModal colleagues={otherColleagues} onCancel={() => setShowNewDirect(false)} onPick={pickDirect} />
      )}
    </div>
  );
}
