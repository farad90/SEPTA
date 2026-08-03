import { useState } from "react";
import { EMOJI_CODEPOINTS } from "./emoji-codepoints.generated";

// فاز ۳۰ — رندر یک ایموجی به‌عنوان تصویر SVG محلی Twemoji (کیفیت یکنواخت و بهتر از فونت
// سیستم‌عامل، به‌خصوص روی ویندوز)؛ اگه ایموجی خارج از مجموعهٔ ۱۳۴تایی ما باشه (مثلاً مستقیم
// از کیبورد سیستم‌عامل پیست شده)، به رندر متنی معمولی برمی‌گرده — بدون شکستن UI
export function EmojiImage({ emoji, size = 22, className }: { emoji: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const codepoint = EMOJI_CODEPOINTS[emoji];

  if (!codepoint || failed) {
    return (
      <span className={className} style={{ fontSize: size, lineHeight: 1 }}>
        {emoji}
      </span>
    );
  }

  return (
    <img
      src={`/twemoji/${codepoint}.svg`}
      alt={emoji}
      width={size}
      height={size}
      draggable={false}
      className={className}
      style={{ display: "inline-block", verticalAlign: "middle" }}
      onError={() => setFailed(true)}
    />
  );
}
