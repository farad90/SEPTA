export class FormulaSyntaxError extends Error {
  constructor(
    message: string,
    public readonly position: number,
  ) {
    super(`خطای نحوی فرمول در موقعیت ${position}: ${message}`);
    this.name = "FormulaSyntaxError";
  }
}

export class FormulaEvaluationError extends Error {
  constructor(
    message: string,
    public readonly identifier?: string,
  ) {
    super(message);
    this.name = "FormulaEvaluationError";
  }
}
