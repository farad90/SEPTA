import { Check, X } from "lucide-react";
import { formatJalali } from "../../lib/jalali";
import {
  useEmployeeLoanMutations,
  useHrRequestMutations,
  useLeaveRequestMutations,
  useMissionRequestMutations,
  useOvertimeRecordMutations,
  usePendingHrRequestApprovals,
  usePendingLeaveApprovals,
  usePendingLoanApprovals,
  usePendingMissionApprovals,
  usePendingOvertimeApprovals,
} from "../hr/hr-requests-api";
import {
  EmployeeLoan,
  HR_REQUEST_TYPE_LABEL,
  HrRequest,
  LeaveRequest,
  MissionRequest,
  OvertimeRecord,
} from "../hr/hr-requests-types";

function Row({
  title,
  subtitle,
  busy,
  onApprove,
  onReject,
}: {
  title: string;
  subtitle: string;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 bg-bg transition-colors duration-150 hover:bg-border/40">
      <div className="flex-1 min-w-0">
        <p className="text-xs text-textPrimary font-medium">{title}</p>
        <p className="text-[10px] mt-0.5 text-textSecondary">{subtitle}</p>
      </div>
      <button
        disabled={busy}
        onClick={onApprove}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-success bg-successSoft transition-all duration-150 hover:brightness-95 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
        aria-label="تأیید"
      >
        <Check size={14} />
      </button>
      <button
        disabled={busy}
        onClick={onReject}
        className="w-7 h-7 rounded-lg flex items-center justify-center text-danger bg-danger/10 transition-all duration-150 hover:brightness-95 active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
        aria-label="رد"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function TeamApprovalsWidget() {
  const { data: leave = [] } = usePendingLeaveApprovals();
  const { data: mission = [] } = usePendingMissionApprovals();
  const { data: overtime = [] } = usePendingOvertimeApprovals();
  const { data: loans = [] } = usePendingLoanApprovals();
  const { data: hrRequests = [] } = usePendingHrRequestApprovals();

  const leaveMutations = useLeaveRequestMutations();
  const missionMutations = useMissionRequestMutations();
  const overtimeMutations = useOvertimeRecordMutations();
  const loanMutations = useEmployeeLoanMutations();
  const hrRequestMutations = useHrRequestMutations();

  const total = leave.length + mission.length + overtime.length + loans.length + hrRequests.length;
  if (total === 0) {
    return null;
  }

  return (
    <div className="rounded-xl p-5 bg-surface border border-border shadow-card">
      <p className="text-sm font-bold mb-3.5 text-textPrimary tracking-tight">تأییدیه‌های تیم من ({total})</p>
      <div className="space-y-1.5">
        {leave.map((r: LeaveRequest) => (
          <Row
            key={`leave-${r.id}`}
            title={`${r.employee?.fullName ?? "—"} — درخواست مرخصی (${r.leaveType.typeName})`}
            subtitle={`${formatJalali(r.startDate)} تا ${formatJalali(r.endDate)} · ${r.daysCount} روز`}
            busy={leaveMutations.approve.isPending || leaveMutations.reject.isPending}
            onApprove={() => leaveMutations.approve.mutate(r.id)}
            onReject={() => leaveMutations.reject.mutate(r.id)}
          />
        ))}
        {mission.map((r: MissionRequest) => (
          <Row
            key={`mission-${r.id}`}
            title={`${r.employee?.fullName ?? "—"} — درخواست مأموریت به ${r.destination}`}
            subtitle={`${formatJalali(r.startDate)} تا ${formatJalali(r.endDate)}`}
            busy={missionMutations.approve.isPending || missionMutations.reject.isPending}
            onApprove={() => missionMutations.approve.mutate(r.id)}
            onReject={() => missionMutations.reject.mutate(r.id)}
          />
        ))}
        {overtime.map((r: OvertimeRecord) => (
          <Row
            key={`overtime-${r.id}`}
            title={`${r.employee?.fullName ?? "—"} — درخواست اضافه‌کاری`}
            subtitle={`${formatJalali(r.workDate)} · ${r.hours} ساعت`}
            busy={overtimeMutations.approve.isPending || overtimeMutations.reject.isPending}
            onApprove={() => overtimeMutations.approve.mutate(r.id)}
            onReject={() => overtimeMutations.reject.mutate(r.id)}
          />
        ))}
        {loans.map((r: EmployeeLoan) => (
          <Row
            key={`loan-${r.id}`}
            title={`${r.employee?.fullName ?? "—"} — درخواست وام`}
            subtitle={`${Number(r.loanAmount).toLocaleString("en-US")} ${r.currencyCode} · ${r.installmentCount} قسط`}
            busy={loanMutations.approve.isPending || loanMutations.reject.isPending}
            onApprove={() => loanMutations.approve.mutate(r.id)}
            onReject={() => loanMutations.reject.mutate(r.id)}
          />
        ))}
        {hrRequests.map((r: HrRequest) => (
          <Row
            key={`hr-request-${r.id}`}
            title={`${r.employee?.fullName ?? "—"} — ${HR_REQUEST_TYPE_LABEL[r.requestType] ?? r.requestType}`}
            subtitle={r.description}
            busy={hrRequestMutations.approve.isPending || hrRequestMutations.reject.isPending}
            onApprove={() => hrRequestMutations.approve.mutate(r.id)}
            onReject={() => hrRequestMutations.reject.mutate(r.id)}
          />
        ))}
      </div>
    </div>
  );
}
