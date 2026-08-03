// فاز ۲۹/۳۰ — یک ایموجی‌پیکر دسته‌بندی‌شده و کامل. مقادیر همون کاراکترهای یونیکد استانداردن
// (پیام همیشه متن معمولیه، بدون ستون/جدول جدید) ولی رندر بصری‌شون (فاز ۳۰) به‌جای فونت
// ایموجی سیستم‌عامل (که روی ویندوز کیفیت پایینی داره) از گرافیک محلی Twemoji استفاده می‌کنه
// — همون سبک تصویری که دیسکورد/اسلک استفاده می‌کنن، MIT+CC-BY، کاملاً قابل جاسازی و متفاوت
// از استیکرهای اختصاصی اپل/گوگل/تلگرام که کپی‌شون از نظر کپی‌رایت درست نیست. فایل‌های SVG در
// public/twemoji/ و نگاشت در emoji-codepoints.generated.ts — ببینید EmojiImage.tsx
export interface EmojiCategory {
  label: string;
  icon: string;
  emojis: string[];
}

export const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    label: "لبخندها",
    icon: "😀",
    emojis: [
      "😀", "😁", "😂", "🤣", "😊", "🙂", "😉", "😍", "🥰", "😘",
      "😜", "🤔", "🙄", "😐", "😴", "🥱", "😢", "😭", "😡", "🥳",
      "😇", "🤗", "😎", "😅", "😱", "🤯", "😳", "🥺", "😏", "🤩",
    ],
  },
  {
    label: "ژست‌ها",
    icon: "👍",
    emojis: [
      "👍", "👎", "👏", "🙏", "🙌", "💪", "👌", "✌️", "🤝", "👋",
      "🤞", "✋", "👊", "🤟", "🫡", "👆", "👇", "🖕", "🤙", "💅",
    ],
  },
  {
    label: "قلب‌ها",
    icon: "❤️",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "💔", "💕",
      "💖", "💗", "💯", "✨", "⭐", "🔥",
    ],
  },
  {
    label: "حیوانات",
    icon: "🐶",
    emojis: [
      "🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯",
      "🦁", "🐮", "🐷", "🐸", "🐵", "🐔", "🐧", "🦋", "🐢", "🐝",
    ],
  },
  {
    label: "غذا",
    icon: "🍕",
    emojis: [
      "🍎", "🍕", "🍔", "🍟", "🌮", "🍩", "🍰", "🍫", "☕", "🍺",
      "🍇", "🍉", "🍓", "🥐", "🍜", "🍦",
    ],
  },
  {
    label: "فعالیت‌ها",
    icon: "🎉",
    emojis: [
      "⚽", "🏆", "🎉", "🎂", "🎁", "📌", "📎", "💡", "📷", "🎵",
      "🚀", "✈️", "🚗", "🏠", "💼", "📱",
    ],
  },
  {
    label: "نمادها",
    icon: "✅",
    emojis: [
      "✅", "❌", "❗", "❓", "⏰", "🔔", "🔒", "🔓", "💤", "💢",
      "‼️", "⚠️", "🆗", "🆕", "🔴", "🟢",
    ],
  },
];

// همهٔ استیکرهای فاز ۲۸ رو هم پوشش می‌ده (زیرمجموعهٔ دسته‌بندی‌های بالاست) — سازگاری تاریخی
export const EMOJI_FLAT = EMOJI_CATEGORIES.flatMap((c) => c.emojis);

// یک واحد ایموجی: پایه + Variation Selector اختیاری (️) + دنبالهٔ ZWJ اختیاری
const EMOJI_UNIT_SOURCE = "\\p{Extended_Pictographic}\\uFE0F?(?:\\u200d\\p{Extended_Pictographic}\\uFE0F?)*";
const EMOJI_ONLY_RE = new RegExp(`^(?:${EMOJI_UNIT_SOURCE}\\s*)+$`, "u");
const EMOJI_SPLIT_RE = new RegExp(EMOJI_UNIT_SOURCE, "gu");

/**
 * تشخیص «پیام-استیکر»: متن پیام کاملاً از ۱ تا ۳ ایموجی تشکیل شده باشه (مثل تلگرام/واتس‌اپ
 * که پیام تک‌ایموجی رو بزرگ و بدون حباب نشون می‌دن) — چه از پیکر خودمون انتخاب شده باشه
 * چه مستقیم از کیبورد سیستم‌عامل تایپ شده باشه، فرقی نداره.
 */
export function isSticker(messageText: string, fileUrl: string | null): boolean {
  if (fileUrl) return false;
  const trimmed = messageText.trim();
  if (!trimmed || !EMOJI_ONLY_RE.test(trimmed)) return false;
  const units = trimmed.match(EMOJI_SPLIT_RE) ?? [];
  return units.length > 0 && units.length <= 3;
}

/** تقسیم متن استیکر به واحدهای ایموجی مجزا — برای رندر هرکدوم به‌عنوان یک EmojiImage جدا */
export function splitEmojiUnits(messageText: string): string[] {
  return messageText.trim().match(EMOJI_SPLIT_RE) ?? [];
}
