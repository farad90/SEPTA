import { useEffect, useMemo, useRef, useState } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import {
  getDaysInMonth as getDaysInMonthJ,
  getMonth as getMonthJ,
  getYear as getYearJ,
  newDate as newDateJ,
} from "date-fns-jalali";
import { formatJalali, parseJalaliToIso, toLatinDigits, toPersianDigits } from "../../lib/jalali";
import { useClickOutside } from "../../lib/use-click-outside";

type CalendarMode = "jalali" | "gregorian";

const WEEKDAYS = ["ش", "ی", "د", "س", "چ", "پ", "ج"]; // شنبه‌محور
const JALALI_MONTHS = ["فروردین","اردیبهشت","خرداد","تیر","مرداد","شهریور","مهر","آبان","آذر","دی","بهمن","اسفند"];
const GREGORIAN_MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function toIso(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function parseGregorian(input: string): string | null {
  const normalized = toLatinDigits(input.trim()).replace(/[/.]/g, "-");
  if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(normalized)) return null;
  const [y, m, d] = normalized.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return toIso(date);
}

/**
 * انتخابگر تاریخ دوگانه شمسی/میلادی (درخواست کاربر) — ورودی متنی + تقویم بازشونده.
 * value/onChange همیشه ISO میلادی (قرارداد API)؛ حالت نمایش قابل تعویضه.
 */
export function DualDateInput({
  value,
  onChange,
  placeholder,
}: {
  value: string | null;
  onChange: (iso: string | null) => void;
  placeholder?: string;
}) {
  const [mode, setMode] = useState<CalendarMode>("jalali");
  const [text, setText] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [open, setOpen] = useState(false);
  // ماه در حال نمایش تقویم — به‌صورت Date میلادیِ اول ماهِ فعال در تقویم انتخابی
  const [viewDate, setViewDate] = useState<Date>(() => (value ? new Date(value) : new Date()));
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));

  const display = (iso: string | null) => {
    if (!iso) return "";
    return mode === "jalali" ? formatJalali(iso) : iso;
  };

  useEffect(() => {
    setText(display(value));
    setInvalid(false);
    if (value) setViewDate(new Date(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, mode]);

  function commitText() {
    if (!text.trim()) {
      setInvalid(false);
      onChange(null);
      return;
    }
    const iso = mode === "jalali" ? parseJalaliToIso(text) : parseGregorian(text);
    if (iso) {
      setInvalid(false);
      onChange(iso);
    } else {
      setInvalid(true);
    }
  }

  // ساخت شبکه روزهای ماهِ در حال نمایش
  const grid = useMemo(() => {
    if (mode === "jalali") {
      const year = getYearJ(viewDate);
      const month = getMonthJ(viewDate); // 0-based جلالی
      const first = newDateJ(year, month, 1);
      const startOffset = (first.getDay() + 1) % 7; // شنبه‌محور
      const daysInMonth = getDaysInMonthJ(viewDate);
      return {
        year,
        month,
        title: `${JALALI_MONTHS[month]} ${toPersianDigits(year)}`,
        startOffset,
        days: Array.from({ length: daysInMonth }, (_, i) => {
          const date = newDateJ(year, month, i + 1);
          return { day: i + 1, iso: toIso(date), label: toPersianDigits(i + 1) };
        }),
        prev: () => setViewDate(month === 0 ? newDateJ(year - 1, 11, 1) : newDateJ(year, month - 1, 1)),
        next: () => setViewDate(month === 11 ? newDateJ(year + 1, 0, 1) : newDateJ(year, month + 1, 1)),
        goTo: (y: number, m: number) => setViewDate(newDateJ(y, m, 1)),
      };
    }
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const first = new Date(year, month, 1);
    const startOffset = (first.getDay() + 1) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return {
      year,
      month,
      title: `${GREGORIAN_MONTHS[month]} ${year}`,
      startOffset,
      days: Array.from({ length: daysInMonth }, (_, i) => ({
        day: i + 1,
        iso: toIso(new Date(year, month, i + 1)),
        label: String(i + 1),
      })),
      prev: () => setViewDate(new Date(year, month - 1, 1)),
      next: () => setViewDate(new Date(year, month + 1, 1)),
      goTo: (y: number, m: number) => setViewDate(new Date(y, m, 1)),
    };
  }, [mode, viewDate]);

  // بازه سال قابل انتخاب در کشویی: از ۱۰۰ سال قبل تا ۱۰ سال بعد از سال جاری همون تقویم
  const yearOptions = useMemo(() => {
    const current = mode === "jalali" ? getYearJ(new Date()) : new Date().getFullYear();
    const years: number[] = [];
    for (let y = current + 10; y >= current - 100; y--) years.push(y);
    return years;
  }, [mode]);

  const todayIsoValue = toIso(new Date());

  return (
    <div className="relative" ref={containerRef}>
      <div className="relative">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onFocus={() => setOpen(true)}
          placeholder={placeholder ?? (mode === "jalali" ? "مثلاً ۱۴۰۵/۰۴/۲۰" : "2026-07-11")}
          dir={mode === "jalali" ? "rtl" : "ltr"}
          className={`w-full rounded-lg px-3 py-2.5 pl-9 text-sm border bg-surface text-textPrimary focus:outline-none ${
            invalid ? "border-danger" : "border-border focus:border-primary"
          }`}
        />
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="absolute top-2.5 left-2.5 text-textSecondary hover:text-primary"
          aria-label="باز کردن تقویم"
        >
          <Calendar size={16} />
        </button>
      </div>
      {invalid && (
        <p className="text-[11px] mt-1 text-danger">
          {mode === "jalali" ? "فرمت تاریخ شمسی نامعتبره (۱۴۰۵/۰۴/۲۰)" : "فرمت تاریخ میلادی نامعتبره (2026-07-11)"}
        </p>
      )}

      {open && (
        <div className="absolute z-40 mt-1 w-64 rounded-lg border border-border bg-surface shadow-lg p-3">
          {/* سوییچ تقویم */}
          <div className="flex rounded-lg border border-border overflow-hidden mb-2 w-fit mx-auto">
            {(["jalali", "gregorian"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={`px-3 py-1 text-[11px] font-medium ${
                  mode === m ? "bg-primary text-white" : "bg-surface text-textSecondary"
                }`}
              >
                {m === "jalali" ? "شمسی" : "میلادی"}
              </button>
            ))}
          </div>

          <div className="flex items-center justify-between mb-2 gap-1">
            <button type="button" onClick={grid.next} className="text-textSecondary p-1 shrink-0" aria-label="ماه بعد">
              <ChevronLeft size={15} />
            </button>
            <div className="flex items-center gap-1 flex-1 justify-center min-w-0">
              <select
                value={grid.month}
                onChange={(e) => grid.goTo(grid.year, Number(e.target.value))}
                aria-label="انتخاب ماه"
                className="text-[11px] font-bold text-textPrimary bg-surface border border-border rounded px-1 py-0.5 focus:outline-none focus:border-primary min-w-0"
              >
                {(mode === "jalali" ? JALALI_MONTHS : GREGORIAN_MONTHS).map((m, i) => (
                  <option key={m} value={i}>{m}</option>
                ))}
              </select>
              <select
                value={grid.year}
                onChange={(e) => grid.goTo(Number(e.target.value), grid.month)}
                aria-label="انتخاب سال"
                className="text-[11px] font-bold text-textPrimary bg-surface border border-border rounded px-1 py-0.5 focus:outline-none focus:border-primary min-w-0"
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{mode === "jalali" ? toPersianDigits(y) : y}</option>
                ))}
              </select>
            </div>
            <button type="button" onClick={grid.prev} className="text-textSecondary p-1 shrink-0" aria-label="ماه قبل">
              <ChevronRight size={15} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 text-center mb-1">
            {WEEKDAYS.map((d) => (
              <span key={d} className="text-[10px] text-textSecondary py-1">{d}</span>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-center">
            {Array.from({ length: grid.startOffset }, (_, i) => (
              <span key={`empty-${i}`} />
            ))}
            {grid.days.map((d) => {
              const isSelected = value === d.iso;
              const isToday = d.iso === todayIsoValue;
              return (
                <button
                  key={d.iso}
                  type="button"
                  onClick={() => {
                    onChange(d.iso);
                    setOpen(false);
                  }}
                  className={`text-[11px] rounded py-1 transition-colors ${
                    isSelected
                      ? "bg-primary text-white font-bold"
                      : isToday
                        ? "bg-accentSoft text-accent font-medium"
                        : "text-textPrimary hover:bg-bg"
                  }`}
                >
                  {d.label}
                </button>
              );
            })}
          </div>

          <div className="flex justify-between items-center mt-2 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => { onChange(todayIsoValue); setOpen(false); }}
              className="text-[11px] text-primary font-medium"
            >
              امروز
            </button>
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); }}
              className="text-[11px] text-textSecondary"
            >
              پاک کردن
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
