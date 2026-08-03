import { Injectable } from "@nestjs/common";
import { HrAccessService } from "../../hr/hr-access.service";
import { LeaveRequestsService } from "../../hr/leave-requests.service";
import { MissionRequestsService } from "../../hr/mission-requests.service";
import { OvertimeRecordsService } from "../../hr/overtime-records.service";
import { EmployeeLoansService } from "../../hr/employee-loans.service";
import { HrRequestsService } from "../../hr/hr-requests.service";
import { ActionItem, ActionRuleProvider, ActionSourceType } from "../action-item.types";

const HR_REQUEST_TYPE_LABEL: Record<string, string> = {
  certificate: "گواهی اشتغال",
  salary_advance: "پیش‌پرداخت حقوق",
  equipment: "درخواست تجهیزات",
  other: "سایر",
};

/** منبع #۲ — ۵ تأیید پراکندهٔ HR، همه بر مبنای سرپرست مستقیم (نه RBAC) */
@Injectable()
export class HrApprovalRuleProvider implements ActionRuleProvider {
  constructor(
    private readonly hrAccess: HrAccessService,
    private readonly leaveRequests: LeaveRequestsService,
    private readonly missionRequests: MissionRequestsService,
    private readonly overtimeRecords: OvertimeRecordsService,
    private readonly employeeLoans: EmployeeLoansService,
    private readonly hrRequests: HrRequestsService,
  ) {}

  async getItems(userId: string, _scope?: "mine" | "team"): Promise<ActionItem[]> {
    const manager = await this.hrAccess.getMyEmployee(userId);
    if (!manager) return [];

    const [leave, mission, overtime, loans, hrRequests] = await Promise.all([
      this.leaveRequests.pendingApproval(userId),
      this.missionRequests.pendingApproval(userId),
      this.overtimeRecords.pendingApproval(userId),
      this.employeeLoans.pendingApproval(userId),
      this.hrRequests.pendingApproval(userId),
    ]);

    const items: ActionItem[] = [];

    for (const r of leave) {
      items.push(
        approvalItem(
          "leave_request",
          r.id,
          r.createdAt,
          `${r.employee?.fullName ?? "—"} — درخواست مرخصی (${r.leaveType.typeName})`,
          `${r.daysCount} روز`,
          "leave-requests",
        ),
      );
    }
    for (const r of mission) {
      items.push(
        approvalItem(
          "mission_request",
          r.id,
          r.createdAt,
          `${r.employee?.fullName ?? "—"} — درخواست مأموریت به ${r.destination}`,
          null,
          "mission-requests",
        ),
      );
    }
    for (const r of overtime) {
      items.push(
        approvalItem(
          "overtime_record",
          r.id,
          r.createdAt,
          `${r.employee?.fullName ?? "—"} — درخواست اضافه‌کاری`,
          `${r.hours} ساعت`,
          "overtime-records",
        ),
      );
    }
    for (const r of loans) {
      items.push(
        approvalItem(
          "employee_loan",
          r.id,
          r.createdAt,
          `${r.employee?.fullName ?? "—"} — درخواست وام`,
          `${Number(r.loanAmount).toLocaleString("en-US")} ${r.currencyCode}`,
          "employee-loans",
        ),
      );
    }
    for (const r of hrRequests) {
      items.push(
        approvalItem(
          "hr_request",
          r.id,
          r.createdAt,
          `${r.employee?.fullName ?? "—"} — ${HR_REQUEST_TYPE_LABEL[r.requestType] ?? r.requestType}`,
          r.description,
          "hr-requests",
        ),
      );
    }

    return items;
  }
}

function approvalItem(
  sourceType: ActionSourceType,
  sourceId: string,
  createdAt: Date,
  title: string,
  subtitle: string | null,
  endpointBase: string,
): ActionItem {
  return {
    id: `${sourceType}:${sourceId}`,
    sourceType,
    sourceId,
    source: "hr",
    kind: "approval",
    title,
    subtitle,
    priority: "high",
    dueAt: null,
    isOverdue: false,
    origin: "assigned",
    relatedEntityType: null,
    relatedEntityId: null,
    linkPath: "/hr",
    actions: [
      { label: "تأیید", method: "POST", path: `/${endpointBase}/${sourceId}/approve` },
      { label: "رد", method: "POST", path: `/${endpointBase}/${sourceId}/reject` },
    ],
    createdAt: createdAt.toISOString(),
  };
}
