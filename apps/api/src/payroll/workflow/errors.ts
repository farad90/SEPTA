export class PayrollResultNotFoundError extends Error {
  constructor(public readonly resultId: string) {
    super(`نتیجه‌ی حقوق با شناسه‌ی ${resultId} یافت نشد`);
    this.name = "PayrollResultNotFoundError";
  }
}

export class PayrollResultLockedError extends Error {
  constructor(public readonly resultId: string) {
    super("این نتیجه قفل شده (Locked) — هیچ تغییری از این پس مجاز نیست");
    this.name = "PayrollResultLockedError";
  }
}

export class InvalidPayrollTransitionError extends Error {
  constructor(
    public readonly fromStatus: string,
    public readonly toStatus: string,
  ) {
    super(`گذار از وضعیت «${fromStatus}» به «${toStatus}» مجاز نیست`);
    this.name = "InvalidPayrollTransitionError";
  }
}
