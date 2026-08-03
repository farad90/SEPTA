export class PayrollPeriodNotFoundError extends Error {
  constructor(public readonly payrollPeriodId: string) {
    super(`دوره‌ی حقوقی با شناسه‌ی ${payrollPeriodId} یافت نشد`);
    this.name = "PayrollPeriodNotFoundError";
  }
}
