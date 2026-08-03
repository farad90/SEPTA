import { PermissionsService } from "../../permissions/permissions.service";
import { PayrollAuditLogService } from "../audit/payroll-audit-log.service";
import { PayrollResultRepository } from "../repositories/payroll-result.repository";
import { InvalidPayrollTransitionError, PayrollResultLockedError, PayrollResultNotFoundError } from "./errors";
import { PayrollWorkflowService } from "./payroll-workflow.service";

function buildDeps() {
  const resultRepository = {
    findById: jest.fn(),
    updateStatus: jest.fn(),
  } as unknown as jest.Mocked<PayrollResultRepository>;
  const auditLog = { log: jest.fn() } as unknown as jest.Mocked<PayrollAuditLogService>;
  const permissions = {
    hasPermission: jest.fn().mockResolvedValue(true),
  } as unknown as jest.Mocked<PermissionsService>;
  return { resultRepository, auditLog, permissions };
}

function buildService(deps: ReturnType<typeof buildDeps>) {
  return new PayrollWorkflowService(deps.resultRepository, deps.auditLog, deps.permissions);
}

describe("PayrollWorkflowService.transition", () => {
  it("وقتی نتیجه پیدا نشود، PayrollResultNotFoundError می‌دهد", async () => {
    const deps = buildDeps();
    (deps.resultRepository.findById as jest.Mock).mockResolvedValue(null);
    const service = buildService(deps);

    await expect(service.transition("missing", "reviewed", "user-1")).rejects.toBeInstanceOf(
      PayrollResultNotFoundError,
    );
  });

  it("گذار calculated→reviewed→approved→posted→locked را به‌ترتیب می‌پذیرد", async () => {
    const deps = buildDeps();
    (deps.resultRepository.updateStatus as jest.Mock).mockImplementation((id, status) =>
      Promise.resolve({ id, status }),
    );
    const service = buildService(deps);

    (deps.resultRepository.findById as jest.Mock).mockResolvedValue({ id: "r1", status: "calculated" });
    await service.transition("r1", "reviewed", "u1");
    expect(deps.resultRepository.updateStatus).toHaveBeenCalledWith("r1", "reviewed", "u1", "reviewedAt", "reviewedBy");

    (deps.resultRepository.findById as jest.Mock).mockResolvedValue({ id: "r1", status: "reviewed" });
    await service.transition("r1", "approved", "u1");
    expect(deps.resultRepository.updateStatus).toHaveBeenCalledWith("r1", "approved", "u1", "approvedAt", "approvedBy");

    (deps.resultRepository.findById as jest.Mock).mockResolvedValue({ id: "r1", status: "approved" });
    await service.transition("r1", "posted", "u1");
    expect(deps.resultRepository.updateStatus).toHaveBeenCalledWith("r1", "posted", "u1", "postedAt", "postedBy");

    (deps.resultRepository.findById as jest.Mock).mockResolvedValue({ id: "r1", status: "posted" });
    await service.transition("r1", "locked", "u1");
    expect(deps.resultRepository.updateStatus).toHaveBeenCalledWith("r1", "locked", "u1", "lockedAt", "lockedBy");
  });

  it("پرش مرحله (calculated→approved) را رد می‌کند", async () => {
    const deps = buildDeps();
    (deps.resultRepository.findById as jest.Mock).mockResolvedValue({ id: "r1", status: "calculated" });
    const service = buildService(deps);

    await expect(service.transition("r1", "approved", "u1")).rejects.toBeInstanceOf(InvalidPayrollTransitionError);
    expect(deps.resultRepository.updateStatus).not.toHaveBeenCalled();
  });

  it("گذار به عقب (approved→reviewed) را رد می‌کند", async () => {
    const deps = buildDeps();
    (deps.resultRepository.findById as jest.Mock).mockResolvedValue({ id: "r1", status: "approved" });
    const service = buildService(deps);

    await expect(service.transition("r1", "reviewed", "u1")).rejects.toBeInstanceOf(InvalidPayrollTransitionError);
  });

  it("هر تلاش برای تغییر یک نتیجه‌ی Locked را رد می‌کند، حتی اگر target نامعتبر نباشد", async () => {
    const deps = buildDeps();
    (deps.resultRepository.findById as jest.Mock).mockResolvedValue({ id: "r1", status: "locked" });
    const service = buildService(deps);

    await expect(service.transition("r1", "locked", "u1")).rejects.toBeInstanceOf(PayrollResultLockedError);
    expect(deps.resultRepository.updateStatus).not.toHaveBeenCalled();
  });

  it("بعد از هر گذار موفق، یک رکورد Audit Log با actor/oldValue/newValue صحیح ثبت می‌کند", async () => {
    const deps = buildDeps();
    (deps.resultRepository.findById as jest.Mock).mockResolvedValue({ id: "r1", status: "calculated" });
    (deps.resultRepository.updateStatus as jest.Mock).mockResolvedValue({ id: "r1", status: "reviewed" });
    const service = buildService(deps);

    await service.transition("r1", "reviewed", "user-42");

    expect(deps.auditLog.log).toHaveBeenCalledWith({
      entityType: "payroll_result",
      entityId: "r1",
      action: "status_changed",
      fieldName: "status",
      oldValue: "calculated",
      newValue: "reviewed",
      performedBy: "user-42",
    });
  });

  it("پرمیژن متناظر با targetStatus را چک می‌کند (approve → payroll_engine.approve)", async () => {
    const deps = buildDeps();
    (deps.resultRepository.findById as jest.Mock).mockResolvedValue({ id: "r1", status: "reviewed" });
    (deps.resultRepository.updateStatus as jest.Mock).mockResolvedValue({ id: "r1", status: "approved" });
    const service = buildService(deps);

    await service.transition("r1", "approved", "u1");

    expect(deps.permissions.hasPermission).toHaveBeenCalledWith("u1", "payroll_engine.approve");
  });

  it("وقتی کاربر پرمیژن لازم را ندارد، ForbiddenException می‌دهد و چیزی ذخیره نمی‌شود", async () => {
    const deps = buildDeps();
    (deps.resultRepository.findById as jest.Mock).mockResolvedValue({ id: "r1", status: "calculated" });
    (deps.permissions.hasPermission as jest.Mock).mockResolvedValue(false);
    const service = buildService(deps);

    await expect(service.transition("r1", "reviewed", "u1")).rejects.toThrow(
      "دسترسی کافی برای این عملیات ندارید",
    );
    expect(deps.resultRepository.updateStatus).not.toHaveBeenCalled();
    expect(deps.auditLog.log).not.toHaveBeenCalled();
  });
});
