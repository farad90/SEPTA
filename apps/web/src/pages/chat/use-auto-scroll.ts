import { useEffect, useRef, useState } from "react";
import { ChatMessage } from "./chat-api";

const NEAR_BOTTOM_THRESHOLD_PX = 120;

// عکس/پیوست‌های داخل حباب‌ها با تأخیر (بعد از fetch شدن Blob در AuthImage) لود و بزرگ می‌شن
// و ارتفاع کانتینر رو بعد از اسکرول اولیه عوض می‌کنن؛ این فاصله‌ها برای اصلاح مجدد اسکرول بعد
// از تثبیت لایوت (Layout Shift) استفاده می‌شن
const CATCH_UP_DELAYS_MS = [150, 500, 1200];

/**
 * فاز ۲۹/۳۱ — اسکرول خودکار به آخرین پیام (مثل تلگرام):
 * - باز کردن یک مکالمه (تغییر resetKey) همیشه، بدون قید‌وشرط، می‌ره ته لیست — حتی اگه
 *   پیام‌ها با تأخیر (بعد از رندر اول) از سرور برسن؛ یک پرچم «در انتظار اسکرول اولیه» این
 *   حالت رو تا لود واقعی داده نگه می‌داره تا قربانی مسابقهٔ async loading نشه.
 * - وقتی خودم پیام می‌فرستم همیشه بدون قید‌وشرط می‌ره ته لیست (چون منتظر دیدن پیام خودمم).
 * - وقتی پیام جدید از طرف مقابل می‌رسه، فقط اگه از قبل پایین لیست بودم خودکار اسکرول می‌شه؛
 *   وگرنه (دارم تاریخچه رو می‌خونم) دکمهٔ «پیام‌های جدید» ظاهر می‌شه تا پرت نشم.
 * - چون تصاویر/پیوست‌ها با تأخیر لود می‌شن و ارتفاع لیست رو بعد از اسکرول اولیه عوض می‌کنن،
 *   هر اسکرول «قطعی» (باز کردن مکالمه یا ارسال پیام خودم) چند بار با فاصلهٔ کوتاه تکرار می‌شه
 *   تا لایوت واقعاً تثبیت بشه — وگرنه کاربر وسط لیست گیر می‌افته نه ته واقعی آن.
 */
export function useAutoScroll(messages: ChatMessage[], selfId: string | undefined, resetKey: string | undefined) {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const itemCount = messages.length;
  const prevCountRef = useRef(itemCount);
  const pendingResetScroll = useRef(true);
  const catchUpTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [showJump, setShowJump] = useState(false);

  const isNearBottom = () => {
    const el = containerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < NEAR_BOTTOM_THRESHOLD_PX;
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    bottomRef.current?.scrollIntoView({ behavior });
    setShowJump(false);
  };

  const clearCatchUpTimers = () => {
    catchUpTimers.current.forEach(clearTimeout);
    catchUpTimers.current = [];
  };

  // بعد از یک اسکرول قطعی، چندبار دیگه هم (بعد از لود احتمالی تصاویر) دوباره بریم ته لیست
  const scrollToBottomWithCatchUp = () => {
    clearCatchUpTimers();
    scrollToBottom("auto");
    catchUpTimers.current = CATCH_UP_DELAYS_MS.map((delay) =>
      setTimeout(() => scrollToBottom("auto"), delay),
    );
  };

  useEffect(() => {
    prevCountRef.current = itemCount;
    pendingResetScroll.current = true;
    scrollToBottomWithCatchUp();
    return clearCatchUpTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  useEffect(() => {
    const grew = itemCount > prevCountRef.current;
    prevCountRef.current = itemCount;

    if (pendingResetScroll.current) {
      // بعد از باز شدن مکالمه، همین که پیام‌های واقعی رندر شدن (حتی اگه با تأخیر شبکه بوده) حتماً بریم ته لیست
      pendingResetScroll.current = false;
      scrollToBottomWithCatchUp();
      return;
    }

    if (!grew) return;
    const lastMessage = messages[messages.length - 1];
    const isMine = !!selfId && lastMessage?.senderId === selfId;
    if (isMine) {
      scrollToBottomWithCatchUp();
    } else if (isNearBottom()) {
      scrollToBottom(itemCount <= 1 ? "auto" : "smooth");
    } else {
      setShowJump(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemCount]);

  useEffect(() => clearCatchUpTimers, []);

  const onScroll = () => {
    if (isNearBottom()) setShowJump(false);
  };

  return { containerRef, bottomRef, showJump, scrollToBottom, onScroll };
}
