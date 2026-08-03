import { addMonths as addJalaliMonths, newDate as newJalaliDate } from "date-fns-jalali";

export interface PeriodDateRange {
  /** شروع دوره (روز اول ماه)، شامل */
  start: Date;
  /** پایان دوره (روز اول ماه بعد)، غیرشامل — برای مقایسه‌ی `< end` */
  end: Date;
}

/**
 * بازه‌ی تاریخ یک دوره‌ی حقوقی را بر مبنای تقویم شرکت گروه (`payroll_years.calendar_type`) می‌سازد.
 * شمسی برای شرکت ایرانی، میلادی برای شرکت‌های خارجی — همان قاعده‌ای که برای شماره‌گذاری نامه/پیشنهاد
 * در این پروژه اعمال می‌شود.
 */
export function periodDateRange(calendarType: string, yearNumber: number, monthNumber: number): PeriodDateRange {
  if (calendarType === "jalali") {
    const start = newJalaliDate(yearNumber, monthNumber - 1, 1);
    const end = addJalaliMonths(start, 1);
    return { start, end };
  }

  const start = new Date(yearNumber, monthNumber - 1, 1);
  const end = new Date(yearNumber, monthNumber, 1);
  return { start, end };
}
