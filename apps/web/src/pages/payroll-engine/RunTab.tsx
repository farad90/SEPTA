import { useState } from "react";
import { Field, GhostButton, PrimaryButton, Select, TextInput } from "../../components/ui/fields";
import { useEmployees } from "../hr/hr-api";
import {
  useAggregateWorkLog,
  useCalculateEmployee,
  useCalculatePeriod,
  useCreatePayrollPeriod,
  usePayrollPeriods,
  usePayrollYears,
  useRuleVersions,
} from "./payroll-engine-api";
import { PayrollCalculationOutcome } from "./payroll-engine-types";

function extractError(err: unknown) {
  const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? "خطا در انجام عملیات");
}

function NewPeriodForm({ payrollYearId, onDone }: { payrollYearId: string; onDone: () => void }) {
  const { data: versions } = useRuleVersions(payrollYearId);
  const create = useCreatePayrollPeriod();
  const [periodCode, setPeriodCode] = useState("");
  const [monthNumber, setMonthNumber] = useState("1");
  const [ruleVersionId, setRuleVersionId] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-4 space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Field label="کد دوره">
          <TextInput value={periodCode} onChange={(e) => setPeriodCode(e.target.value)} dir="ltr" placeholder="1406-01" />
        </Field>
        <Field label="شماره ماه">
          <TextInput value={monthNumber} onChange={(e) => setMonthNumber(e.target.value)} dir="ltr" />
        </Field>
        <Field label="نسخه‌ی قانون">
          <Select value={ruleVersionId} onChange={(e) => setRuleVersionId(e.target.value)}>
            <option value="">انتخاب کنید...</option>
            {(versions ?? []).map((v) => (
              <option key={v.id} value={v.id}>
                {v.title}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2">
        <GhostButton onClick={onDone}>انصراف</GhostButton>
        <PrimaryButton
          disabled={!periodCode.trim() || !ruleVersionId || create.isPending}
          onClick={async () => {
            try {
              setError(null);
              await create.mutateAsync({
                payrollYearId,
                periodCode: periodCode.trim(),
                monthNumber: Number(monthNumber),
                ruleVersionId,
              });
              onDone();
            } catch (err) {
              setError(extractError(err));
            }
          }}
        >
          ثبت دوره
        </PrimaryButton>
      </div>
    </div>
  );
}

function OutcomesSummary({ outcomes }: { outcomes: PayrollCalculationOutcome[] }) {
  const ok = outcomes.filter((o) => o.status === "ok").length;
  const failed = outcomes.filter((o) => o.status === "error");
  return (
    <div className="rounded-lg border border-border p-3 text-xs space-y-1">
      <p className="text-textPrimary">
        {ok} کارمند محاسبه شد
        {failed.length > 0 && <span className="text-danger"> · {failed.length} خطا</span>}
      </p>
      {failed.map((o) => (
        <p key={o.employeeId} className="text-danger">
          {o.employeeId}: {o.error}
        </p>
      ))}
    </div>
  );
}

export function RunTab() {
  const { data: years } = usePayrollYears();
  const { data: employees } = useEmployees({});
  const [payrollYearId, setPayrollYearId] = useState("");
  const [periodId, setPeriodId] = useState("");
  const [showNewPeriod, setShowNewPeriod] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const { data: periods } = usePayrollPeriods(payrollYearId || null);

  const aggregate = useAggregateWorkLog();
  const calculatePeriod = useCalculatePeriod();
  const calculateEmployee = useCalculateEmployee();

  const [aggregateResult, setAggregateResult] = useState<{ processed: number; skippedManual: number } | null>(null);
  const [calcOutcomes, setCalcOutcomes] = useState<PayrollCalculationOutcome[] | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [employeeCalcMessage, setEmployeeCalcMessage] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface border border-border shadow-card p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="سال حقوقی">
            <Select
              value={payrollYearId}
              onChange={(e) => {
                setPayrollYearId(e.target.value);
                setPeriodId("");
              }}
            >
              <option value="">انتخاب کنید...</option>
              {(years ?? []).map((y) => (
                <option key={y.id} value={y.id}>
                  {y.yearNumber}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="دوره">
            <Select value={periodId} onChange={(e) => setPeriodId(e.target.value)} disabled={!payrollYearId}>
              <option value="">انتخاب کنید...</option>
              {(periods ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.periodCode}
                </option>
              ))}
            </Select>
          </Field>
        </div>
        {payrollYearId && !showNewPeriod && (
          <GhostButton onClick={() => setShowNewPeriod(true)}>+ دوره جدید</GhostButton>
        )}
        {payrollYearId && showNewPeriod && (
          <NewPeriodForm payrollYearId={payrollYearId} onDone={() => setShowNewPeriod(false)} />
        )}
      </div>

      {periodId && (
        <>
          <div className="rounded-xl bg-surface border border-border shadow-card p-4 space-y-3">
            <h3 className="text-sm font-bold text-textPrimary">کارکرد ماهانه (WorkLog)</h3>
            <p className="text-xs text-textSecondary">
              از حضور و غیاب/مرخصی/اضافه‌کاری/مأموریت موجود به‌صورت خودکار تجمیع می‌شود؛ ردیف‌های اصلاح‌شده‌ی
              دستی دست‌نخورده می‌مانند.
            </p>
            <PrimaryButton
              disabled={aggregate.isPending}
              onClick={async () => {
                try {
                  setActionError(null);
                  const result = await aggregate.mutateAsync(periodId);
                  setAggregateResult(result);
                } catch (err) {
                  setActionError(extractError(err));
                }
              }}
            >
              {aggregate.isPending ? "در حال تجمیع..." : "تجمیع کارکرد این دوره"}
            </PrimaryButton>
            {aggregateResult && (
              <p className="text-xs text-success">
                {aggregateResult.processed} نفر تجمیع شد
                {aggregateResult.skippedManual > 0 && ` · ${aggregateResult.skippedManual} ردیف دستی دست‌نخورده ماند`}
              </p>
            )}
          </div>

          <div className="rounded-xl bg-surface border border-border shadow-card p-4 space-y-3">
            <h3 className="text-sm font-bold text-textPrimary">اجرای محاسبه</h3>
            <PrimaryButton
              disabled={calculatePeriod.isPending}
              onClick={async () => {
                try {
                  setActionError(null);
                  const outcomes = await calculatePeriod.mutateAsync(periodId);
                  setCalcOutcomes(outcomes);
                } catch (err) {
                  setActionError(extractError(err));
                }
              }}
            >
              {calculatePeriod.isPending ? "در حال محاسبه..." : "اجرای محاسبه‌ی کل دوره"}
            </PrimaryButton>
            {calcOutcomes && <OutcomesSummary outcomes={calcOutcomes} />}

            <div className="border-t border-border pt-3 flex items-end gap-2 flex-wrap">
              <Field label="محاسبه‌ی یک کارمند خاص">
                <Select value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)}>
                  <option value="">انتخاب کنید...</option>
                  {(employees ?? []).map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.fullName}
                    </option>
                  ))}
                </Select>
              </Field>
              <GhostButton
                disabled={!selectedEmployeeId || calculateEmployee.isPending}
                onClick={async () => {
                  try {
                    setActionError(null);
                    setEmployeeCalcMessage(null);
                    await calculateEmployee.mutateAsync({ periodId, employeeId: selectedEmployeeId });
                    setEmployeeCalcMessage("محاسبه شد.");
                  } catch (err) {
                    setActionError(extractError(err));
                  }
                }}
              >
                محاسبه
              </GhostButton>
            </div>
            {employeeCalcMessage && <p className="text-xs text-success">{employeeCalcMessage}</p>}
            {actionError && <p className="text-xs text-danger">{actionError}</p>}
          </div>
        </>
      )}
    </div>
  );
}
