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

/**
 * P0-E4-F1-T1 — two concurrent transitions (e.g. a double-click, or two
 * reviewers acting at once) could previously both pass the check-then-act
 * validation in PayrollWorkflowService.transition() and both write, silently
 * — the second write overwriting the first's actor/timestamp with no trace
 * either happened twice. This is thrown when the conditional update in
 * PayrollResultRepository.updateStatus() finds the row's status no longer
 * matches what was just validated against, i.e. someone else got there first.
 */
export class PayrollConcurrentModificationError extends Error {
  constructor(public readonly resultId: string) {
    super("این نتیجه هم‌زمان توسط یک عملیات دیگه تغییر کرد — صفحه رو رفرش کنید و دوباره تلاش کنید");
    this.name = "PayrollConcurrentModificationError";
  }
}
