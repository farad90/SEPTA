export class RuleVersionNotFoundError extends Error {
  constructor(public readonly ruleVersionId: string) {
    super(`نسخه‌ی قانون با شناسه‌ی ${ruleVersionId} یافت نشد`);
    this.name = "RuleVersionNotFoundError";
  }
}
