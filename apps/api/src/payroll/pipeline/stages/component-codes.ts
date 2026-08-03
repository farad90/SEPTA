/**
 * این دو کد جزء، اگر در کاتالوگ موجود باشند، مقدارشان توسط Insurance Engine/Tax Engine
 * (مراحل ۷ و ۹) تعیین می‌شود، نه فرمول خودشان — بنابراین از جمع خام اجزای کسورات (مرحله ۱۰)
 * کنار گذاشته می‌شوند تا دوبار محاسبه نشوند. مبالغ نهایی آن‌ها روی ستون‌های اختصاصی
 * PayrollResult (insuranceEmployeeShare/taxAmount) ذخیره می‌شوند، نه در PayrollResultItem.
 */
export const INSURANCE_COMPONENT_CODE = "INSURANCE";
export const TAX_COMPONENT_CODE = "TAX";
export const ENGINE_MANAGED_COMPONENT_CODES: ReadonlySet<string> = new Set([
  INSURANCE_COMPONENT_CODE,
  TAX_COMPONENT_CODE,
]);
