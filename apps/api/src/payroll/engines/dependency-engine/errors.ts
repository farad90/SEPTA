export class CircularDependencyError extends Error {
  constructor(public readonly cycle: string[]) {
    super(`وابستگی چرخه‌ای شناسایی شد: ${cycle.join(" → ")}`);
    this.name = "CircularDependencyError";
  }
}
