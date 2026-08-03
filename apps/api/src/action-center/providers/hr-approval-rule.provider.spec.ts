import { HrAccessService } from "../../hr/hr-access.service";
import { LeaveRequestsService } from "../../hr/leave-requests.service";
import { MissionRequestsService } from "../../hr/mission-requests.service";
import { OvertimeRecordsService } from "../../hr/overtime-records.service";
import { EmployeeLoansService } from "../../hr/employee-loans.service";
import { HrRequestsService } from "../../hr/hr-requests.service";
import { HrApprovalRuleProvider } from "./hr-approval-rule.provider";

const USER_ID = "11111111-1111-1111-1111-111111111111";

function buildProvider() {
  const hrAccess = { getMyEmployee: jest.fn().mockResolvedValue(null) };
  const leaveRequests = { pendingApproval: jest.fn().mockResolvedValue([]) };
  const missionRequests = { pendingApproval: jest.fn().mockResolvedValue([]) };
  const overtimeRecords = { pendingApproval: jest.fn().mockResolvedValue([]) };
  const employeeLoans = { pendingApproval: jest.fn().mockResolvedValue([]) };
  const hrRequests = { pendingApproval: jest.fn().mockResolvedValue([]) };

  const provider = new HrApprovalRuleProvider(
    hrAccess as unknown as HrAccessService,
    leaveRequests as unknown as LeaveRequestsService,
    missionRequests as unknown as MissionRequestsService,
    overtimeRecords as unknown as OvertimeRecordsService,
    employeeLoans as unknown as EmployeeLoansService,
    hrRequests as unknown as HrRequestsService,
  );

  return { provider, hrAccess, leaveRequests, missionRequests, overtimeRecords, employeeLoans, hrRequests };
}

describe("HrApprovalRuleProvider", () => {
  it("skips HR approvals entirely when the user has no linked employee record", async () => {
    const { provider, hrAccess, leaveRequests } = buildProvider();

    const items = await provider.getItems(USER_ID, "mine");

    expect(hrAccess.getMyEmployee).toHaveBeenCalledWith(USER_ID);
    expect(leaveRequests.pendingApproval).not.toHaveBeenCalled();
    expect(items).toHaveLength(0);
  });

  it("includes pending HR approvals with ready-to-call approve/reject action paths when the user is a manager", async () => {
    const { provider, hrAccess, leaveRequests } = buildProvider();
    hrAccess.getMyEmployee.mockResolvedValue({ id: "emp-1" });
    leaveRequests.pendingApproval.mockResolvedValue([
      {
        id: "leave-1",
        daysCount: 3,
        createdAt: new Date(),
        employee: { fullName: "علی رضایی" },
        leaveType: { typeName: "استحقاقی" },
      },
    ]);

    const items = await provider.getItems(USER_ID, "mine");

    expect(items).toHaveLength(1);
    expect(items[0].sourceType).toBe("leave_request");
    expect(items[0].source).toBe("hr");
    expect(items[0].kind).toBe("approval");
    expect(items[0].actions).toEqual([
      { label: "تأیید", method: "POST", path: "/leave-requests/leave-1/approve" },
      { label: "رد", method: "POST", path: "/leave-requests/leave-1/reject" },
    ]);
  });
});
