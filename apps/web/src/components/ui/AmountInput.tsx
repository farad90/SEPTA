import { useEffect, useRef, useState } from "react";

/** فرمت نمایشی یک عدد با جداکننده سه‌رقمی (ارقام لاتین) — برای نمایش فقط‌خواندنی هم قابل استفاده‌ست */
export function formatAmount(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "";
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}

function isDigitChar(ch: string): boolean {
  return ch >= "0" && ch <= "9";
}

// تعداد ارقام (بدون کاما) قبل از موقعیت Cursor — مبنای حفظ موقعیت بعد از فرمت مجدد
function digitsBeforeCursor(str: string, cursor: number): number {
  let count = 0;
  for (let i = 0; i < cursor && i < str.length; i++) {
    if (isDigitChar(str[i]) || str[i] === ".") count++;
  }
  return count;
}

// پیدا کردن موقعیت Cursor در رشته فرمت‌شده جدید که همون تعداد رقم قبلش باشه
function cursorAfterNDigits(str: string, n: number): number {
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (count >= n) return i;
    if (isDigitChar(str[i]) || str[i] === ".") count++;
  }
  return str.length;
}

/**
 * فیلد مبلغ با جداکننده سه‌رقمی زنده هنگام تایپ (ارقام لاتین + کاما، مثلاً ۱٬۲۳۴٬۵۶۷ → 1,234,567).
 * value/onChange همیشه عدد خام (بدون کاما)؛ فرمت فقط نمایشیه.
 */
export function AmountInput({
  value,
  onChange,
  onCommit,
  placeholder,
  disabled,
  className,
}: {
  value: number | null;
  onChange: (n: number | null) => void;
  /** اختیاری — فقط روی از-فوکوس‌خارج‌شدن فراخوانی می‌شه (برای الگوی «commit on blur» با Mutation) */
  onCommit?: (n: number | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}) {
  const [text, setText] = useState(() => formatAmount(value));
  const inputRef = useRef<HTMLInputElement>(null);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(formatAmount(value));
  }, [value]);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    const cursor = e.target.selectionStart ?? raw.length;
    const digitsBefore = digitsBeforeCursor(raw, cursor);

    // فقط رقم و یک نقطه اعشار مجازن؛ کاماهای موجود (تایپ‌شده یا قبلی) دور ریخته می‌شن
    const cleaned = raw.replace(/[^0-9.]/g, "");
    const firstDot = cleaned.indexOf(".");
    const normalized =
      firstDot === -1 ? cleaned : cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, "");

    if (normalized === "" || normalized === ".") {
      setText(normalized);
      onChange(null);
      return;
    }

    const [intPart, decPart] = normalized.split(".");
    const intFormatted = intPart === "" ? "" : Number(intPart).toLocaleString("en-US");
    const display = decPart !== undefined ? `${intFormatted}.${decPart}` : intFormatted;

    setText(display);
    const parsed = parseFloat(normalized);
    onChange(Number.isNaN(parsed) ? null : parsed);

    requestAnimationFrame(() => {
      if (inputRef.current) {
        const newCursor = cursorAfterNDigits(display, digitsBefore);
        inputRef.current.setSelectionRange(newCursor, newCursor);
      }
    });
  }

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      dir="ltr"
      value={text}
      disabled={disabled}
      placeholder={placeholder}
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        setText(formatAmount(value));
        onCommit?.(value);
      }}
      onChange={handleChange}
      className={`w-full rounded-lg px-3 py-2.5 text-sm border border-border bg-surface text-textPrimary focus:outline-none focus:border-primary disabled:opacity-60 ${className ?? ""}`}
    />
  );
}
