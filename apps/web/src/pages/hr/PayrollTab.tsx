import { useState } from "react";
import { Plus } from "lucide-react";
import { Field, GhostButton, PrimaryButton, Select, TextInput } from "../../components/ui/fields";
import { useAuth } from "../../lib/auth-context";
import { hasPermission } from "../../lib/permissions";
import { useOurEntities } from "../inquiries/rfqs-api";
import { useEmployees } from "./hr-api";
import { PAYROLL_STATUS_META, Payslip, usePayrollMutations, usePayrollPeriods, usePeriodPayslips } from "./payroll-api";

function extractError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? fallback);
}

function StatusBadge({ status }: { status: string }) {
  const meta = PAYROLL_STATUS_META[status];
  if (!meta) return null;
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${meta.className}`}>{meta.label}</span>;
}

function NewPeriodForm({ onDone }: { onDone: () => void }) {
  const { data: ourEntities } = useOurEntities();
  const { createPeriod } = usePayrollMutations();
  const [ourEntityId, setOurEntityId] = useState("");
  const [periodMonth, setPeriodMonth] = useState(String(new Date().getMonth() + 1));
  const [periodYear, setPeriodYear] = useState(String(new Date().getFullYear()));
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-3">
      <h3 className="text-sm font-bold text-textPrimary">دوره حقوقی جدید</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="شرکت گروه *">
          <Select value={ourEntityId} onChange={(e) => setOurEntityId(e.target.value)}>
            <option value="">— انتخاب —</option>
            {(ourEntities ?? []).map((e) => (
              <option key={e.id} value={e.id}>{e.entityName}</option>
            ))}
          </Select>
        </Field>
        <Field label="ماه *">
          <Select value={periodMonth} onChange={(e) => setPeriodMonth(e.target.value)}>
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>ماه {m}</option>
            ))}
          </Select>
        </Field>
        <Field label="سال *">
          <TextInput value={periodYear} onChange={(e) => setPeriodYear(e.target.value)} dir="ltr" inputMode="numeric" />
        </Field>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2 justify-end">
        <GhostButton onClick={onDone}>انصراف</GhostButton>
        <PrimaryButton
          disabled={!ourEntityId || createPeriod.isPending}
          onClick={async () => {
            try {
              setError(null);
              await createPeriod.mutateAsync({ ourEntityId, periodMonth: Number(periodMonth), periodYear: Number(periodYear) });
              onDone();
            } catch (err) {
              setError(extractError(err, "خطا در ساخت دوره"));
            }
          }}
        >
          {createPeriod.isPending ? "در حال ثبت..." : "ساخت دوره"}
        </PrimaryButton>
      </div>
    </div>
  );
}

function PayslipPreview({ payslip }: { payslip: Payslip }) {
  return (
    <div className="mt-2 rounded-lg bg-bg p-3 space-y-1">
      {payslip.items.map((item) => (
        <div key={item.id} className="flex items-center justify-between text-[11px]">
          <span className={item.itemType === "earning" ? "text-success" : "text-danger"}>
            {item.category}
            {item.description ? ` (${item.description})` : ""}
          </span>
          <span dir="ltr">
            {item.itemType === "deduction" ? "-" : "+"}
            {Number(item.amount).toLocaleString("en-US")}
          </span>
        </div>
      ))}
      <div className="flex items-center justify-between text-xs font-bold text-textPrimary pt-1 border-t border-border">
        <span>خالص پرداختی</span>
        <span dir="ltr">{Number(payslip.netAmount).toLocaleString("en-US")} {payslip.currencyCode}</span>
      </div>
    </div>
  );
}

function PeriodDetail({ periodId, onBack }: { periodId: string; onBack: () => void }) {
  const { user } = useAuth();
  const canManage = hasPermission(user, "hr.manage");
  const { data: periods } = usePayrollPeriods();
  const period = periods?.find((p) => p.id === periodId);
  const { data: payslips } = usePeriodPayslips(periodId);
  const { data: employees } = useEmployees({});
  const { generatePayslip, finalizePeriod, markPaid } = usePayrollMutations();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!period) return null;

  const entityEmployees = (employees ?? []).filter((e) => e.ourEntity?.id === period.ourEntityId);
  const payslipByEmployee = new Map((payslips ?? []).map((p) => [p.employeeId, p]));

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="text-xs text-primary font-medium">→ بازگشت به لیست دوره‌ها</button>

      <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <h3 className="text-sm font-bold text-textPrimary">
              {period.ourEntity.entityName} — ماه {period.periodMonth} / {period.periodYear}
            </h3>
            <StatusBadge status={period.status} />
          </div>
          {canManage && period.status === "draft" && (
            <GhostButton onClick={() => finalizePeriod.mutate(period.id)} disabled={finalizePeriod.isPending}>
              نهایی‌سازی دوره
            </GhostButton>
          )}
          {canManage && period.status === "finalized" && (
            <GhostButton onClick={() => markPaid.mutate(period.id)} disabled={markPaid.isPending}>
              ثبت پرداخت
            </GhostButton>
          )}
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
      </div>

      <div className="rounded-xl bg-surface border border-border shadow-card divide-y divide-border">
        {entityEmployees.map((emp) => {
          const payslip = payslipByEmployee.get(emp.id);
          return (
            <div key={emp.id} className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-textPrimary">{emp.fullName}</p>
                  <p className="text-[11px] text-textSecondary" dir="ltr">{emp.employeeNumber}</p>
                </div>
                {payslip && <StatusBadge status={payslip.status} />}
                {canManage && period.status === "draft" && (!payslip || payslip.status === "draft") && (
                  <GhostButton
                    onClick={async () => {
                      try {
                        setError(null);
                        await generatePayslip.mutateAsync({ periodId: period.id, employeeId: emp.id });
                        setExpandedId(emp.id);
                      } catch (err) {
                        setError(extractError(err, "خطا در تولید فیش"));
                      }
                    }}
                    disabled={generatePayslip.isPending}
                  >
                    {payslip ? "تولید مجدد فیش" : "تولید فیش"}
                  </GhostButton>
                )}
                {payslip && (
                  <button onClick={() => setExpandedId(expandedId === emp.id ? null : emp.id)} className="text-[11px] text-primary">
                    {expandedId === emp.id ? "بستن" : "جزئیات"}
                  </button>
                )}
              </div>
              {payslip && expandedId === emp.id && <PayslipPreview payslip={payslip} />}
            </div>
          );
        })}
        {entityEmployees.length === 0 && <p className="text-xs text-textSecondary p-8 text-center">پرسنلی برای این شرکت یافت نشد.</p>}
      </div>
    </div>
  );
}

export function PayrollTab() {
  const { user } = useAuth();
  const canManage = hasPermission(user, "hr.manage");
  const { data: periods, isLoading } = usePayrollPeriods();
  const [showNewForm, setShowNewForm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (selectedId) {
    return <PeriodDetail periodId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        {canManage && !showNewForm && (
          <PrimaryButton onClick={() => setShowNewForm(true)}>
            <span className="flex items-center gap-1.5"><Plus size={14} /> دوره جدید</span>
          </PrimaryButton>
        )}
      </div>

      {showNewForm && <NewPeriodForm onDone={() => setShowNewForm(false)} />}

      {isLoading && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}

      <div className="rounded-xl bg-surface border border-border shadow-card divide-y divide-border">
        {periods && periods.length === 0 && <p className="text-xs text-textSecondary p-8 text-center">هنوز دوره حقوقی‌ای ثبت نشده.</p>}
        {(periods ?? []).map((period) => (
          <button
            key={period.id}
            onClick={() => setSelectedId(period.id)}
            className="w-full flex items-center gap-3 p-4 text-right hover:bg-bg transition-colors"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-textPrimary">
                {period.ourEntity.entityName} — ماه {period.periodMonth} / {period.periodYear}
              </p>
              <p className="text-[11px] text-textSecondary">{period._count?.payslips ?? 0} فیش</p>
            </div>
            <StatusBadge status={period.status} />
          </button>
        ))}
      </div>
    </div>
  );
}
