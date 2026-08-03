export interface ChildRecord {
  birthDate: Date;
}

function ageInYears(birthDate: Date, referenceDate: Date): number {
  let age = referenceDate.getFullYear() - birthDate.getFullYear();
  const hasHadBirthdayThisYear =
    referenceDate.getMonth() > birthDate.getMonth() ||
    (referenceDate.getMonth() === birthDate.getMonth() && referenceDate.getDate() >= birthDate.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

/**
 * تعداد فرزندانی که در تاریخ مرجع (شروع دوره) هنوز به سقف سنی حق اولاد نرسیده‌اند.
 * maxAge از Rule می‌آید (`CHILD_ALLOWANCE_MAX_AGE`)؛ اگر تنظیم نشده باشد (Infinity)،
 * همه‌ی فرزندان بدون محدودیت سنی شمرده می‌شوند.
 */
export function countEligibleChildren(children: ChildRecord[], referenceDate: Date, maxAge: number): number {
  return children.filter((child) => ageInYears(child.birthDate, referenceDate) < maxAge).length;
}
