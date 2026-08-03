export class PayrollPeriodNotFoundError extends Error {
  constructor(public readonly payrollPeriodId: string) {
    super(`دوره‌ی حقوقی با شناسه‌ی ${payrollPeriodId} یافت نشد`);
    this.name = "PayrollPeriodNotFoundError";
  }
}

export class EmployeeContractNotFoundError extends Error {
  constructor(public readonly employeeId: string) {
    super(`قرارداد فعالی برای این پرسنل در این دوره یافت نشد`);
    this.name = "EmployeeContractNotFoundError";
  }
}
