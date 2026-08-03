import React, { useState } from "react";
import { Search, Plus, Send, Users, X, ArrowRight } from "lucide-react";

const FONT_IMPORT_URL =
  "https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap";

const tokens = {
  bg: "#F6F4EF",
  surface: "#FFFFFF",
  primary: "#1F3A5F",
  accent: "#A9633B",
  accentSoft: "#F3E6DC",
  border: "#E3DED2",
  textPrimary: "#20201C",
  textSecondary: "#6B675F",
  success: "#2F7D5D",
};

function Avatar({ name, size = 36, isGroup }) {
  const colors = ["#1F3A5F", "#A9633B", "#2F7D5D", "#7B4B94", "#B98900"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const initials = isGroup ? <Users size={size * 0.45} /> : name.trim().split(" ").slice(0, 2).map((w) => w[0]).join("");
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 font-semibold text-white"
      style={{ width: size, height: size, background: colors[Math.abs(hash) % colors.length], fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}

const COLLEAGUES = ["علی محمدی", "سارا کریمی", "حسین رستمی", "مریم صادقی", "فرشید محمدی"];

const CONVERSATIONS = [
  { id: 1, type: "direct", name: "علی محمدی", lastMessage: "باشه، الان چک می‌کنم", time: "۱۰:۴۲", unread: 2,
    messages: [
      { author: "علی محمدی", text: "سلام، وضعیت RFQ-1044 چیه؟", time: "۱۰:۳۰", me: false },
      { author: "فرشید محمدی", text: "هنوز از Bulten جواب نگرفتیم", time: "۱۰:۳۵", me: true },
      { author: "علی محمدی", text: "باشه، الان چک می‌کنم", time: "۱۰:۴۲", me: false },
    ] },
  { id: 2, type: "group", name: "تیم بازرگانی", lastMessage: "سارا: فایل رو گذاشتم", time: "دیروز", unread: 0,
    members: ["فرشید محمدی", "علی محمدی", "حسین رستمی"],
    messages: [
      { author: "حسین رستمی", text: "قیمت‌های جدید SKF رسید", time: "دیروز ۱۴:۰۰", me: false },
      { author: "سارا کریمی", text: "فایل رو گذاشتم", time: "دیروز ۱۴:۱۰", me: false },
    ] },
  { id: 3, type: "direct", name: "مریم صادقی", lastMessage: "فاکتور صادر شد", time: "۲ روز پیش", unread: 0,
    messages: [{ author: "مریم صادقی", text: "فاکتور صادر شد", time: "۲ روز پیش", me: false }] },
];

function NewGroupModal({ onCancel, onCreate }) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState([]);
  const toggle = (n) => setSelected(selected.includes(n) ? selected.filter((x) => x !== n) : [...selected, n]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(20,18,14,0.45)" }}>
      <div className="rounded-lg w-full max-w-sm p-5" style={{ background: tokens.surface }}>
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>ساخت گروه جدید</p>
          <button onClick={onCancel}><X size={16} style={{ color: tokens.textSecondary }} /></button>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="نام گروه"
          className="text-sm w-full rounded-md px-3 py-2 mb-3"
          style={{ border: `1px solid ${tokens.border}` }}
        />
        <p className="text-[11px] font-medium mb-2" style={{ color: tokens.textSecondary }}>اعضا</p>
        <div className="space-y-1 mb-4 max-h-48 overflow-y-auto">
          {COLLEAGUES.filter((c) => c !== "فرشید محمدی").map((c) => (
            <label key={c} className="flex items-center gap-2.5 px-2 py-2 rounded-md text-xs cursor-pointer" style={{ background: selected.includes(c) ? tokens.accentSoft : tokens.bg }}>
              <input type="checkbox" checked={selected.includes(c)} onChange={() => toggle(c)} className="w-3.5 h-3.5" />
              <Avatar name={c} size={24} />
              <span style={{ color: tokens.textPrimary }}>{c}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            disabled={!name || selected.length === 0}
            onClick={() => onCreate({ name, members: selected })}
            className="flex-1 text-sm py-2 rounded-md text-white font-medium"
            style={{ background: name && selected.length ? tokens.primary : tokens.textSecondary, opacity: name && selected.length ? 1 : 0.6 }}
          >
            ساخت گروه
          </button>
          <button onClick={onCancel} className="text-sm px-4 py-2 rounded-md" style={{ color: tokens.textSecondary }}>انصراف</button>
        </div>
      </div>
    </div>
  );
}

export default function ChatMessagingMockup() {
  const [conversations, setConversations] = useState(CONVERSATIONS);
  const [selectedId, setSelectedId] = useState(1);
  const [query, setQuery] = useState("");
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [mobileShowChat, setMobileShowChat] = useState(false);

  const selected = conversations.find((c) => c.id === selectedId);
  const filtered = conversations.filter((c) => c.name.toLowerCase().includes(query.toLowerCase()));

  const send = () => {
    if (!newMessage.trim()) return;
    setConversations(conversations.map((c) =>
      c.id === selectedId ? { ...c, messages: [...c.messages, { author: "فرشید محمدی", text: newMessage, time: "اکنون", me: true }] } : c
    ));
    setNewMessage("");
  };

  const createGroup = ({ name, members }) => {
    const newConv = { id: Date.now(), type: "group", name, members: [...members, "فرشید محمدی"], lastMessage: "", time: "اکنون", unread: 0, messages: [] };
    setConversations([newConv, ...conversations]);
    setSelectedId(newConv.id);
    setShowNewGroup(false);
    setMobileShowChat(true);
  };

  return (
    <div dir="rtl" style={{ background: tokens.bg, height: "100vh", fontFamily: "Vazirmatn, sans-serif" }} className="flex overflow-hidden">
      <style>{`@import url('${FONT_IMPORT_URL}'); .mono { font-family: 'JetBrains Mono', monospace; }`}</style>

      {/* لیست مکالمات */}
      <div className={`w-full sm:w-80 shrink-0 flex-col ${mobileShowChat ? "hidden sm:flex" : "flex"}`} style={{ background: tokens.surface, borderLeft: `1px solid ${tokens.border}` }}>
        <div className="p-4" style={{ borderBottom: `1px solid ${tokens.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <h1 className="text-lg font-bold" style={{ color: tokens.textPrimary }}>پیام‌ها</h1>
            <button onClick={() => setShowNewGroup(true)} className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-md text-white" style={{ background: tokens.primary }}>
              <Plus size={13} /> گروه جدید
            </button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute top-2.5 right-3" style={{ color: tokens.textSecondary }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جست‌وجو..." className="w-full text-xs rounded-md pr-8 pl-2 py-2" style={{ border: `1px solid ${tokens.border}` }} />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => { setSelectedId(c.id); setMobileShowChat(true); }}
              className="w-full flex items-center gap-2.5 px-4 py-3 text-right"
              style={{ background: selectedId === c.id ? tokens.accentSoft : "transparent", borderBottom: `1px solid ${tokens.border}` }}
            >
              <Avatar name={c.name} isGroup={c.type === "group"} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium truncate" style={{ color: tokens.textPrimary }}>{c.name}</p>
                  <span className="text-[10px] shrink-0" style={{ color: tokens.textSecondary }}>{c.time}</span>
                </div>
                <p className="text-xs truncate" style={{ color: tokens.textSecondary }}>{c.lastMessage || "گروه جدید ایجاد شد"}</p>
              </div>
              {c.unread > 0 && (
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0" style={{ background: tokens.accent }}>
                  {c.unread}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* پنجره گفتگو */}
      <div className={`flex-1 flex-col ${mobileShowChat ? "flex" : "hidden sm:flex"}`}>
        {selected ? (
          <>
            <div className="flex items-center gap-2.5 px-4 py-3" style={{ background: tokens.surface, borderBottom: `1px solid ${tokens.border}` }}>
              <button className="sm:hidden" onClick={() => setMobileShowChat(false)}><ArrowRight size={18} style={{ color: tokens.textSecondary }} /></button>
              <Avatar name={selected.name} isGroup={selected.type === "group"} />
              <div>
                <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>{selected.name}</p>
                {selected.type === "group" && (
                  <p className="text-[11px]" style={{ color: tokens.textSecondary }}>{selected.members.length} عضو</p>
                )}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {selected.messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.me ? "justify-start" : "justify-end"}`}>
                  <div className="max-w-[70%]">
                    {!m.me && selected.type === "group" && (
                      <p className="text-[11px] font-medium mb-0.5 px-1" style={{ color: tokens.accent }}>{m.author}</p>
                    )}
                    <div
                      className="rounded-lg px-3 py-2 text-sm"
                      style={{ background: m.me ? tokens.primary : tokens.surface, color: m.me ? "#fff" : tokens.textPrimary, border: m.me ? "none" : `1px solid ${tokens.border}` }}
                    >
                      {m.text}
                    </div>
                    <p className="text-[10px] mt-0.5 px-1" style={{ color: tokens.textSecondary }}>{m.time}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex gap-2 p-3" style={{ background: tokens.surface, borderTop: `1px solid ${tokens.border}` }}>
              <input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="پیام بنویس..."
                className="flex-1 text-sm rounded-md px-3 py-2"
                style={{ border: `1px solid ${tokens.border}` }}
              />
              <button onClick={send} className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium text-white" style={{ background: tokens.primary }}>
                <Send size={14} />
              </button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm" style={{ color: tokens.textSecondary }}>یک مکالمه را انتخاب کن</p>
          </div>
        )}
      </div>

      {showNewGroup && <NewGroupModal onCancel={() => setShowNewGroup(false)} onCreate={createGroup} />}
    </div>
  );
}
