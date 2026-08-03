export class ComponentEvaluationError extends Error {
  constructor(
    public readonly componentCode: string,
    cause: Error,
  ) {
    super(`خطا در محاسبه‌ی جزء «${componentCode}»: ${cause.message}`);
    this.name = "ComponentEvaluationError";
  }
}
