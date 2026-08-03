import { useState } from "react";

/**
 * ورودی زمان تحویل با امکان تایپ بر اساس روز یا هفته — ذخیره‌سازی همیشه به روز انجام می‌شه
 * (schema تغییری نکرده)، فقط واحد نمایش/تایپ محلیه. تغییر واحد، مقدار فعلی رو تبدیل می‌کنه
 * تا عدد نمایش‌داده‌شده هماهنگ با valueDays بمونه.
 *
 * ⚠️ فاز ۵۶ — واحد به‌صورت پیش‌فرض state داخلی کامپوننته (برای مصرف‌کننده‌هایی که نیازی به
 * ماندگاری واحد ندارن، مثل ردیف‌های ترم تحویل در SelectionTab). ولی وقتی واحد باید ذخیره
 * بشه (مثل پیشنهاد مالی/فنی — قبلاً باگ بود: واحد «هفته» انتخابی کاربر هیچ‌جا ذخیره
 * نمی‌شد و سند تولیدی همیشه به روز نشون می‌داد)، مصرف‌کننده می‌تونه unit/onUnitChange رو
 * کنترل‌شده پاس بده تا واحد هم مثل خودِ عدد در دیتابیس بمونه.
 */
export function DeliveryTimeInput({
  valueDays,
  onChange,
  unit: controlledUnit,
  onUnitChange,
  disabled,
  className,
}: {
  valueDays: number;
  onChange: (days: number) => void;
  unit?: "day" | "week";
  onUnitChange?: (unit: "day" | "week") => void;
  disabled?: boolean;
  className?: string;
}) {
  const [internalUnit, setInternalUnit] = useState<"day" | "week">("day");
  const unit = controlledUnit ?? internalUnit;
  const setUnit = onUnitChange ?? setInternalUnit;

  const displayValue = unit === "day" ? valueDays : Math.round((valueDays / 7) * 10) / 10;

  const handleValueChange = (raw: string) => {
    const n = parseFloat(raw);
    if (Number.isNaN(n)) return;
    onChange(Math.round(unit === "day" ? n : n * 7));
  };

  return (
    <div className={`flex items-center gap-1.5 ${className ?? ""}`}>
      <input
        type="text"
        inputMode="decimal"
        dir="ltr"
        disabled={disabled}
        value={String(displayValue)}
        onChange={(e) => handleValueChange(e.target.value)}
        className="w-16 font-mono rounded-lg px-2 py-1.5 text-xs border border-border bg-surface text-textPrimary focus:outline-none focus:border-primary disabled:opacity-60"
      />
      <select
        disabled={disabled}
        value={unit}
        onChange={(e) => setUnit(e.target.value as "day" | "week")}
        className="w-20 py-1.5 text-[11px] rounded-lg border border-border bg-surface text-textPrimary cursor-pointer disabled:opacity-60"
      >
        <option value="day">روز</option>
        <option value="week">هفته</option>
      </select>
    </div>
  );
}
