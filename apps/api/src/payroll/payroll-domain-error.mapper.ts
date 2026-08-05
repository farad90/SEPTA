import { BadRequestException, ConflictException, NotFoundException } from "@nestjs/common";
import { ComponentEvaluationError } from "./engines/component-evaluator/errors";
import { RuleVersionNotFoundError } from "./engines/rule-engine/errors";
import { EmployeeContractNotFoundError, PayrollPeriodNotFoundError as PipelinePeriodNotFoundError } from "./pipeline/errors";
import { PayrollPeriodNotFoundError as WorkLogPeriodNotFoundError } from "./worklog/errors";
import {
  InvalidPayrollTransitionError,
  PayrollConcurrentModificationError,
  PayrollResultLockedError,
  PayrollResultNotFoundError,
} from "./workflow/errors";

/**
 * Engine‌ها/Repository‌ها عمداً مستقل از NestJS هستند (Error های ساده پرتاب می‌کنند، نه
 * HttpException) تا در بیرون از HTTP هم (تست، Job زمان‌بندی‌شده) قابل استفاده بمانند.
 * این تابع تنها نقطه‌ای است که این خطاهای دامنه را در مرز Application Service به پاسخ HTTP
 * صحیح ترجمه می‌کند — دقیقاً همان نقشی که در بقیه‌ی پروژه‌ی این را Service خودش انجام می‌ده.
 */
export function mapPayrollDomainError(err: unknown): never {
  if (
    err instanceof PipelinePeriodNotFoundError ||
    err instanceof WorkLogPeriodNotFoundError ||
    err instanceof RuleVersionNotFoundError ||
    err instanceof PayrollResultNotFoundError
  ) {
    throw new NotFoundException(err.message);
  }

  if (err instanceof EmployeeContractNotFoundError || err instanceof ComponentEvaluationError) {
    throw new BadRequestException(err.message);
  }

  if (
    err instanceof PayrollResultLockedError ||
    err instanceof InvalidPayrollTransitionError ||
    err instanceof PayrollConcurrentModificationError
  ) {
    throw new ConflictException(err.message);
  }

  throw err;
}
