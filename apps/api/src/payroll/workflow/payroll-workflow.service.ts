import { ForbiddenException, Injectable } from "@nestjs/common";
import { PermissionsService } from "../../permissions/permissions.service";
import { PayrollAuditLogService } from "../audit/payroll-audit-log.service";
import { PayrollResultRepository } from "../repositories/payroll-result.repository";
import { InvalidPayrollTransitionError, PayrollResultLockedError, PayrollResultNotFoundError } from "./errors";
import { MANUAL_TRANSITIONS, ManualPayrollTransition, isLocked } from "./payroll-status";

/**
 * گردش وضعیت Draft→Calculated→Reviewed→Approved→Posted→Locked. تنها نقطه‌ی مجاز برای
 * تغییر دستی وضعیت یک PayrollResult — Controller هرگز مستقیم `prisma.payrollResult.update`
 * صدا نمی‌زند. چون دسترسی لازم به خود targetStatus وابسته است (بازبینی/تأیید/ثبت/قفل هرکدام
 * پرمیژن جدا دارند)، چک اینجا در سرویس انجام می‌شود نه با یک @RequirePermissions ثابت روی
 * Controller — دقیقاً هم‌الگوی `ShipmentsService`/`shipping.approve_edit`.
 */
@Injectable()
export class PayrollWorkflowService {
  constructor(
    private readonly resultRepository: PayrollResultRepository,
    private readonly auditLog: PayrollAuditLogService,
    private readonly permissions: PermissionsService,
  ) {}

  async transition(resultId: string, targetStatus: ManualPayrollTransition, actorId: string) {
    const result = await this.resultRepository.findById(resultId);
    if (!result) throw new PayrollResultNotFoundError(resultId);
    if (isLocked(result.status)) throw new PayrollResultLockedError(resultId);

    const rule = MANUAL_TRANSITIONS[targetStatus];
    if (result.status !== rule.requiresFrom) {
      throw new InvalidPayrollTransitionError(result.status, targetStatus);
    }

    const allowed = await this.permissions.hasPermission(actorId, rule.permissionKey);
    if (!allowed) {
      throw new ForbiddenException("دسترسی کافی برای این عملیات ندارید");
    }

    const updated = await this.resultRepository.updateStatus(
      resultId,
      targetStatus,
      actorId,
      rule.stampField,
      rule.actorField,
    );

    await this.auditLog.log({
      entityType: "payroll_result",
      entityId: resultId,
      action: "status_changed",
      fieldName: "status",
      oldValue: result.status,
      newValue: targetStatus,
      performedBy: actorId,
    });

    return updated;
  }
}
