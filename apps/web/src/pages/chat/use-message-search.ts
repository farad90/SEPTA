import { useEffect, useMemo, useState } from "react";
import { ChatMessage } from "./chat-api";

// فاز ۳۰ — جست‌وجوی سمت کلاینت در پیام‌های یک مکالمهٔ بازشده (بدون تغییر بک‌اند، چون
// پیام‌ها همین حالا هم بدون صفحه‌بندی کامل لود می‌شن) — با شمارندهٔ N/M و پیمایش بعدی/قبلی،
// دقیقاً مثل Ctrl+F داخل یک چت در تلگرام دسکتاپ/وب
export function useMessageSearch(messages: ChatMessage[], resetKey: string | undefined) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setOpen(false);
    setQuery("");
    setIndex(0);
  }, [resetKey]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return messages.filter((m) => !m.deletedAt && m.messageText.toLowerCase().includes(q));
  }, [messages, query]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  useEffect(() => {
    const current = matches[index];
    if (!current) return;
    const el = document.getElementById(`chat-msg-${current.id}`);
    el?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [index, matches]);

  const next = () => matches.length > 0 && setIndex((i) => (i + 1) % matches.length);
  const prev = () => matches.length > 0 && setIndex((i) => (i - 1 + matches.length) % matches.length);
  const close = () => {
    setOpen(false);
    setQuery("");
  };

  return {
    open,
    setOpen,
    query,
    setQuery,
    matches,
    index,
    next,
    prev,
    close,
    activeMessageId: matches[index]?.id ?? null,
  };
}
