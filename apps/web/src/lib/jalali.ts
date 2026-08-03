import { format, newDate, parse, isValid } from "date-fns-jalali";

const PERSIAN_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

export function toPersianDigits(value: string | number): string {
  return String(value).replace(/[0-9]/g, (d) => PERSIAN_DIGITS[Number(d)]);
}

export function toLatinDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

/** ISO/Date → «۱۴۰۵/۰۴/۲۰» — برای نمایش در UI */
export function formatJalali(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return toPersianDigits(format(date, "yyyy/MM/dd"));
}

/** ISO/Date → «۱۴۰۵/۰۴/۲۰ - ۱۴:۳۵» — برای فید فعالیت */
export function formatJalaliDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return toPersianDigits(format(date, "yyyy/MM/dd - HH:mm"));
}

/**
 * «۱۴۰۵/۰۴/۲۰» یا «1405/4/20» → ISO (yyyy-MM-dd) برای ارسال به API.
 * ورودی نامعتبر → null (فرم خطا نشون می‌ده).
 */
export function parseJalaliToIso(input: string): string | null {
  const normalized = toLatinDigits(input.trim()).replace(/[-.]/g, "/");
  if (!/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(normalized)) return null;
  const parsed = parse(normalized, "yyyy/MM/dd", new Date());
  if (!isValid(parsed)) return null;
  // خروجی تاریخ محلی بدون لغزش timezone
  const y = parsed.getFullYear();
  const m = String(parsed.getMonth() + 1).padStart(2, "0");
  const d = String(parsed.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** تاریخ امروز به‌صورت ISO — برای پیش‌فرض فرم‌ها */
export function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** روز اول فروردین سال شمسی جاری، به‌صورت ISO — برای فیلتر «از ابتدای سال» گزارش‌ها */
export function startOfJalaliYearIso(): string {
  const currentJalaliYear = Number(format(new Date(), "yyyy"));
  const start = newDate(currentJalaliYear, 0, 1);
  const y = start.getFullYear();
  const m = String(start.getMonth() + 1).padStart(2, "0");
  const d = String(start.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
