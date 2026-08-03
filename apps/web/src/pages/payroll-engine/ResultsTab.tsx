import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { GhostButton, PrimaryButton, Select } from "../../components/ui/fields";
import { useAuth } from "../../lib/auth-context";
import { hasPermission } from "../../lib/permissions";
import { downloadFile } from "../inquiries/inquiries-api";
import {
  useGeneratePayrollList,
  useGeneratePayslip,
  usePayrollPeriods,
  usePayrollResult,
  usePayrollResults,
  usePayrollYears,
  useTransitionResult,
} from "./payroll-engine-api";
import { PayrollResult, PayrollResultStatus } from "./payroll-engine-types";

function extractError(err: unknown) {
  const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? "خطا در انجام عملیات");
}

const STATUS_LABEL: Record<PayrollResultStatus, string> = {
  draft: "پیش‌نویس",
  calculated: "محاسبه‌شده",
  reviewed: "بازبینی‌شده",
  approved: "تأییدشده",
  posted: "ثبت حسابداری",
  locked: "قفل‌شده",
};

const STATUS_COLOR: Record<PayrollResultStatus, string> = {
  draft: "bg-border text-textSecondary",
  calculated: "bg-accentSoft text-accent",
  reviewed: "bg-warningSoft text-warning",
  approved: "bg-warningSoft text-warning",
  posted: "bg-successSoft text-success",
  locked: "bg-successSoft text-success",
};

const NEXT_TRANSITION: Partial<Record<PayrollResultStatus, { target: "reviewed" | "approved" | "posted" | "locked"; label: string; permission: string }>> = {
  calculated: { target: "reviewed", label: "بازبینی", permission: "payroll_engine.review" },
  reviewed: { target: "approved", label: "تأیید نهایی", permission: "payroll_engine.approve" },
  approved: { target: "posted", label: "ثبت حسابداری", permission: "payroll_engine.post" },
  posted: { target: "locked", label: "قفل نهایی", permission: "payroll_engine.lock" },
};

function money(v: string) {
  return Number(v).toLocaleString("en-US");
}

function ResultDetail({ resultId, onBack }: { resultId: string; onBack: () => void }) {
  const { data: result } = usePayrollResult(resultId);
  const { user } = useAuth();
  const transition = useTransitionResult();
  const generatePayslip = useGeneratePayslip();
  const [error, setError] = useState<string | null>(null);

  if (!result) return <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>;

  const next = NEXT_TRANSITION[result.status];
  const canTransition = next && hasPermission(user, next.permission);

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-primary font-medium">
        <ArrowRight size={14} /> بازگشت به لیست
      </button>

      <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h2 className="text-base font-bold text-textPrimary">
              {result.employee?.fullName ?? result.employeeId}
            </h2>
            <p className="text-[11px] text-textSecondary">{result.employee?.employeeNumber}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium ${STATUS_COLOR[result.status]}`}>
              {STATUS_LABEL[result.status]}
            </span>
            <GhostButton
              disabled={generatePayslip.isPending}
              onClick={async () => {
                try {
                  setError(null);
                  const file = await generatePayslip.mutateAsync(result.id);
                  await downloadFile(file.fileUrl, file.fileName);
                } catch (err) {
                  setError(extractError(err));
                }
              }}
            >
              {generatePayslip.isPending ? "در حال تولید..." : "دریافت فیش حقوقی (PDF)"}
            </GhostButton>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
          <div>
            <p className="text-textSecondary">ناخالص</p>
            <p className="font-mono text-textPrimary" dir="ltr">{money(result.grossEarnings)}</p>
          </div>
          <div>
            <p className="text-textSecondary">سهم بیمه کارگر</p>
            <p className="font-mono text-textPrimary" dir="ltr">{money(result.insuranceEmployeeShare)}</p>
          </div>
          <div>
            <p className="text-textSecondary">مالیات</p>
            <p className="font-mono text-textPrimary" dir="ltr">{money(result.taxAmount)}</p>
          </div>
          <div>
            <p className="text-textSecondary">خالص پرداختی</p>
            <p className="font-mono font-bold text-textPrimary" dir="ltr">{money(result.netSalary)}</p>
          </div>
          <div>
            <p className="text-textSecondary">سهم بیمه کارفرما</p>
            <p className="font-mono text-textPrimary" dir="ltr">{money(result.insuranceEmployerShare)}</p>
          </div>
          <div>
            <p className="text-textSecondary">بیمه بیکاری</p>
            <p className="font-mono text-textPrimary" dir="ltr">{money(result.unemploymentInsurance)}</p>
          </div>
          <div>
            <p className="text-textSecondary">سایر کسورات</p>
            <p className="font-mono text-textPrimary" dir="ltr">
              {money(String(Number(result.totalDeductions) - Number(result.insuranceEmployeeShare) - Number(result.taxAmount)))}
            </p>
          </div>
          <div>
            <p className="text-textSecondary">هزینه‌ی تمام‌شده‌ی کارفرما</p>
            <p className="font-mono text-textPrimary" dir="ltr">{money(result.employerCost)}</p>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-bold text-textPrimary mb-2">اجزای حقوق</h3>
          <div className="rounded-lg border border-border divide-y divide-border">
            {(result.items ?? []).map((item) => (
              <div key={item.id} className="flex items-center justify-between p-2.5 text-xs">
                <span className="font-mono text-textPrimary">{item.componentCode}</span>
                <span className="font-mono" dir="ltr">{money(item.amount)}</span>
              </div>
            ))}
            {(result.items ?? []).length === 0 && (
              <p className="text-xs text-textSecondary p-3">ردیفی ثبت نشده.</p>
            )}
          </div>
        </div>

        {error && <p className="text-xs text-danger">{error}</p>}
        {next && (
          <div className="flex justify-end">
            <PrimaryButton
              disabled={!canTransition || transition.isPending}
              title={!canTransition ? "دسترسی کافی ندارید" : undefined}
              onClick={async () => {
                try {
                  setError(null);
                  await transition.mutateAsync({ resultId: result.id, targetStatus: next.target });
                } catch (err) {
                  setError(extractError(err));
                }
              }}
            >
              {next.label}
            </PrimaryButton>
          </div>
        )}
      </div>
    </div>
  );
}

export function ResultsTab() {
  const { data: years } = usePayrollYears();
  const [payrollYearId, setPayrollYearId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [selectedResultId, setSelectedResultId] = useState<string | null>(null);
  const { data: periods } = usePayrollPeriods(payrollYearId || null);
  const { data: results, isLoading } = usePayrollResults(periodId || null);
  const generatePayrollList = useGeneratePayrollList();
  const [listError, setListError] = useState<string | null>(null);

  if (selectedResultId) {
    return <ResultDetail resultId={selectedResultId} onBack={() => setSelectedResultId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface border border-border shadow-card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            value={payrollYearId}
            onChange={(e) => {
              setPayrollYearId(e.target.value);
              setPeriodId("");
            }}
          >
            <option value="">سال حقوقی...</option>
            {(years ?? []).map((y) => (
              <option key={y.id} value={y.id}>
                {y.yearNumber}
              </option>
            ))}
          </Select>
          <Select value={periodId} onChange={(e) => setPeriodId(e.target.value)} disabled={!payrollYearId}>
            <option value="">دوره...</option>
            {(periods ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.periodCode}
              </option>
            ))}
          </Select>
        </div>
        {periodId && (
          <div>
            <GhostButton
              disabled={generatePayrollList.isPending}
              onClick={async () => {
                try {
                  setListError(null);
                  const file = await generatePayrollList.mutateAsync(periodId);
                  await downloadFile(file.fileUrl, file.fileName);
                } catch (err) {
                  setListError(extractError(err));
                }
              }}
            >
              {generatePayrollList.isPending ? "در حال تولید..." : "دریافت لیست حقوق این دوره (Excel)"}
            </GhostButton>
            {listError && <p className="text-xs text-danger mt-1">{listError}</p>}
          </div>
        )}
      </div>

      {isLoading && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}

      {periodId && !isLoading && (
        <div className="rounded-xl bg-surface border border-border shadow-card divide-y divide-border">
          {(results ?? []).length === 0 && (
            <p className="text-xs text-textSecondary p-8 text-center">هنوز نتیجه‌ای برای این دوره محاسبه نشده.</p>
          )}
          {(results ?? []).map((result: PayrollResult) => (
            <button
              key={result.id}
              onClick={() => setSelectedResultId(result.id)}
              className="w-full flex items-center justify-between gap-3 p-4 text-right hover:bg-bg transition-colors"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-textPrimary truncate">
                  {result.employee?.fullName ?? result.employeeId}
                </p>
                <p className="text-[11px] text-textSecondary font-mono" dir="ltr">
                  خالص: {money(result.netSalary)}
                </p>
              </div>
              <span className={`text-[10px] px-2.5 py-1 rounded-full font-medium shrink-0 ${STATUS_COLOR[result.status]}`}>
                {STATUS_LABEL[result.status]}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
