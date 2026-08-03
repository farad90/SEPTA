export interface DateRangeRecord {
  startDate: Date;
  endDate: Date;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function daysBetweenInclusive(a: Date, b: Date): number {
  return Math.floor((b.getTime() - a.getTime()) / ONE_DAY_MS) + 1;
}

/**
 * جمع تعداد روزهای همپوشان هر رکورد (مرخصی/مأموریت) با بازه‌ی دوره‌ی حقوقی — یک رکورد
 * ممکن است قبل از شروع یا بعد از پایان دوره شروع/تمام شود، پس هر رکورد به بازه‌ی دوره Clip می‌شود.
 */
export function sumOverlapDays(
  records: DateRangeRecord[],
  periodStart: Date,
  periodEndExclusive: Date,
): number {
  const periodLastDay = new Date(periodEndExclusive.getTime() - 1);
  let total = 0;

  for (const record of records) {
    const clippedStart = record.startDate > periodStart ? record.startDate : periodStart;
    const clippedEnd = record.endDate < periodLastDay ? record.endDate : periodLastDay;
    if (clippedEnd >= clippedStart) {
      total += daysBetweenInclusive(clippedStart, clippedEnd);
    }
  }

  return total;
}
