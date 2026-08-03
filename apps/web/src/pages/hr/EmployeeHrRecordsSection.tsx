import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { DualDateInput } from "../../components/ui/DualDateInput";
import { Field, GhostButton, PrimaryButton, Select, TextArea, TextInput } from "../../components/ui/fields";
import { AmountInput } from "../../components/ui/AmountInput";
import { formatJalali } from "../../lib/jalali";
import { useCurrencies } from "../inquiries/rfqs-api";
import {
  useAttendanceMutations,
  useBenefitTypes,
  useDeductionTypes,
  useEmployeeAttendance,
  useEmployeeBenefits,
  useEmployeeChildMutations,
  useEmployeeChildren,
  useEmployeeDeductions,
  useEmployeeHrRequests,
  useEmployeeLeaveBalances,
  useEmployeeLeaveRequests,
  useEmployeeLoans,
  useEmployeeMissionRequests,
  useEmployeeOvertimeRecords,
  useEmployeeBenefitMutations,
  useEmployeeDeductionMutations,
  useLeaveBalanceMutations,
  useLeaveTypes,
} from "./hr-requests-api";
import { ATTENDANCE_STATUS_LABEL, HR_REQUEST_TYPE_LABEL, REQUEST_STATUS_META } from "./hr-requests-types";
import { PAYROLL_STATUS_META, useEmployeePayslips } from "./payroll-api";
import { REVIEW_STATUS_META, useEmployeePerformanceReviews } from "./performance-review-api";

function extractError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? fallback);
}

function StatusBadge({ status }: { status: string }) {
  const meta = REQUEST_STATUS_META[status];
  if (!meta) return null;
  return <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${meta.className}`}>{meta.label}</span>;
}

function LeaveBalancesBlock({ employeeId, canManage }: { employeeId: string; canManage: boolean }) {
  const { data: balances } = useEmployeeLeaveBalances(employeeId);
  const { data: leaveTypes } = useLeaveTypes();
  const { data: requests } = useEmployeeLeaveRequests(employeeId);
  const { set } = useLeaveBalanceMutations();

  const [showForm, setShowForm] = useState(false);
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [entitledDays, setEntitledDays] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-textPrimary">مرخصی‌ها</h3>
        {canManage && !showForm && (
          <GhostButton onClick={() => setShowForm(true)}>
            <span className="flex items-center gap-1.5"><Plus size={13} /> تعیین سقف سالانه</span>
          </GhostButton>
        )}
      </div>

      {showForm && (
        <div className="rounded-lg border border-border p-3 space-y-3 bg-bg">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="نوع مرخصی *">
              <Select
                value={leaveTypeId}
                onChange={(e) => {
                  setLeaveTypeId(e.target.value);
                  const t = (leaveTypes ?? []).find((lt) => lt.id === e.target.value);
                  if (t?.annualEntitlementDays) setEntitledDays(t.annualEntitlementDays);
                }}
              >
                <option value="">— انتخاب —</option>
                {(leaveTypes ?? []).map((t) => (
                  <option key={t.id} value={t.id}>{t.typeName}</option>
                ))}
              </Select>
            </Field>
            <Field label="سال *">
              <TextInput value={year} onChange={(e) => setYear(e.target.value)} dir="ltr" inputMode="numeric" />
            </Field>
            <Field label="سقف سالانه (روز) *">
              <TextInput value={entitledDays} onChange={(e) => setEntitledDays(e.target.value)} dir="ltr" inputMode="decimal" />
            </Field>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex gap-2 justify-end">
            <GhostButton onClick={() => setShowForm(false)}>انصراف</GhostButton>
            <PrimaryButton
              disabled={!leaveTypeId || !year || !entitledDays || set.isPending}
              onClick={async () => {
                try {
                  setError(null);
                  await set.mutateAsync({
                    employeeId,
                    leaveTypeId,
                    year: Number(year),
                    entitledDays: Number(entitledDays),
                  });
                  setShowForm(false);
                  setLeaveTypeId("");
                  setEntitledDays("");
                } catch (err) {
                  setError(extractError(err, "خطا در ثبت سقف مرخصی"));
                }
              }}
            >
              ذخیره
            </PrimaryButton>
          </div>
        </div>
      )}

      {balances && balances.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {balances.map((b) => (
            <div key={b.id} className="rounded-lg p-2.5 bg-bg">
              <p className="text-[11px] text-textSecondary">{b.leaveType.typeName} ({b.year})</p>
              <p className="text-sm font-medium text-textPrimary">
                {b.usedDays} / {b.entitledDays} روز مصرف‌شده
              </p>
            </div>
          ))}
        </div>
      )}

      <ul className="divide-y divide-border">
        {(requests ?? []).map((r) => (
          <li key={r.id} className="py-2.5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-textPrimary">
                {r.leaveType.typeName} — {formatJalali(r.startDate)} تا {formatJalali(r.endDate)} ({r.daysCount} روز)
              </p>
              {r.approver && <p className="text-[11px] text-textSecondary">تأییدکننده: {r.approver.fullName}</p>}
            </div>
            <StatusBadge status={r.status} />
          </li>
        ))}
        {requests && requests.length === 0 && (
          <p className="text-xs text-textSecondary py-3">درخواست مرخصی‌ای ثبت نشده.</p>
        )}
      </ul>
    </div>
  );
}

function MissionsBlock({ employeeId }: { employeeId: string }) {
  const { data: requests } = useEmployeeMissionRequests(employeeId);
  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-3">
      <h3 className="text-sm font-bold text-textPrimary">مأموریت‌ها</h3>
      <ul className="divide-y divide-border">
        {(requests ?? []).map((r) => (
          <li key={r.id} className="py-2.5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-textPrimary">
                {r.destination} — {formatJalali(r.startDate)} تا {formatJalali(r.endDate)}
              </p>
              {r.approver && <p className="text-[11px] text-textSecondary">تأییدکننده: {r.approver.fullName}</p>}
            </div>
            <StatusBadge status={r.status} />
          </li>
        ))}
        {requests && requests.length === 0 && (
          <p className="text-xs text-textSecondary py-3">درخواست مأموریتی ثبت نشده.</p>
        )}
      </ul>
    </div>
  );
}

function OvertimeBlock({ employeeId }: { employeeId: string }) {
  const { data: records } = useEmployeeOvertimeRecords(employeeId);
  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-3">
      <h3 className="text-sm font-bold text-textPrimary">اضافه‌کاری</h3>
      <ul className="divide-y divide-border">
        {(records ?? []).map((r) => (
          <li key={r.id} className="py-2.5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-textPrimary">
                {formatJalali(r.workDate)} — {r.hours} ساعت (ضریب {r.rateMultiplier})
              </p>
              {r.approver && <p className="text-[11px] text-textSecondary">تأییدکننده: {r.approver.fullName}</p>}
            </div>
            <StatusBadge status={r.status} />
          </li>
        ))}
        {records && records.length === 0 && (
          <p className="text-xs text-textSecondary py-3">اضافه‌کاری‌ای ثبت نشده.</p>
        )}
      </ul>
    </div>
  );
}

function AttendanceBlock({ employeeId, canManage }: { employeeId: string; canManage: boolean }) {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const { data: records } = useEmployeeAttendance(employeeId, month, year);
  const { upsert } = useAttendanceMutations();

  const [showForm, setShowForm] = useState(false);
  const [workDate, setWorkDate] = useState<string | null>(null);
  const [status, setStatus] = useState("present");
  const [notes, setNotes] = useState("");

  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-textPrimary">حضور و غیاب</h3>
        <div className="flex items-center gap-2">
          <Select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="!w-28 !py-1.5">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>ماه {m}</option>
            ))}
          </Select>
          <TextInput
            value={String(year)}
            onChange={(e) => setYear(Number(e.target.value) || year)}
            dir="ltr"
            inputMode="numeric"
            className="!w-24 !py-1.5"
          />
          {canManage && !showForm && (
            <GhostButton onClick={() => setShowForm(true)}>
              <span className="flex items-center gap-1.5"><Plus size={13} /> ثبت روز</span>
            </GhostButton>
          )}
        </div>
      </div>

      {showForm && (
        <div className="rounded-lg border border-border p-3 space-y-3 bg-bg">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="تاریخ *">
              <DualDateInput value={workDate} onChange={setWorkDate} />
            </Field>
            <Field label="وضعیت *">
              <Select value={status} onChange={(e) => setStatus(e.target.value)}>
                {Object.entries(ATTENDANCE_STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="یادداشت">
                <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
              </Field>
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <GhostButton onClick={() => setShowForm(false)}>انصراف</GhostButton>
            <PrimaryButton
              disabled={!workDate || upsert.isPending}
              onClick={async () => {
                await upsert.mutateAsync({ employeeId, workDate, status, notes: notes || undefined });
                setShowForm(false);
                setWorkDate(null);
                setNotes("");
              }}
            >
              ذخیره
            </PrimaryButton>
          </div>
        </div>
      )}

      <ul className="divide-y divide-border">
        {(records ?? []).map((r) => (
          <li key={r.id} className="py-2 flex items-center gap-3">
            <p className="text-xs text-textPrimary flex-1">{formatJalali(r.workDate)}</p>
            <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-bg text-textSecondary">
              {ATTENDANCE_STATUS_LABEL[r.status] ?? r.status}
            </span>
            {r.notes && <p className="text-[11px] text-textSecondary">{r.notes}</p>}
          </li>
        ))}
        {records && records.length === 0 && (
          <p className="text-xs text-textSecondary py-3">رکوردی برای این ماه ثبت نشده.</p>
        )}
      </ul>
    </div>
  );
}

function LoansBlock({ employeeId }: { employeeId: string }) {
  const { data: loans } = useEmployeeLoans(employeeId);
  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-3">
      <h3 className="text-sm font-bold text-textPrimary">وام‌ها</h3>
      <ul className="divide-y divide-border">
        {(loans ?? []).map((loan) => (
          <li key={loan.id} className="py-2.5">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-textPrimary">
                  {Number(loan.loanAmount).toLocaleString("en-US")} {loan.currencyCode} — {loan.installmentCount} قسط ({loan.monthlyInstallment} هرکدام)
                </p>
                {loan.approver && <p className="text-[11px] text-textSecondary">تأییدکننده: {loan.approver.fullName}</p>}
              </div>
              <StatusBadge status={loan.status} />
            </div>
            {loan.installments.length > 0 && (
              <p className="text-[11px] text-textSecondary mt-1">
                اقساط: {loan.installments.map((i) => `${formatJalali(i.dueDate)} (${i.amount})`).join(" · ")}
              </p>
            )}
          </li>
        ))}
        {loans && loans.length === 0 && <p className="text-xs text-textSecondary py-3">وامی ثبت نشده.</p>}
      </ul>
    </div>
  );
}

function HrRequestsBlock({ employeeId }: { employeeId: string }) {
  const { data: requests } = useEmployeeHrRequests(employeeId);
  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-3">
      <h3 className="text-sm font-bold text-textPrimary">سایر درخواست‌ها</h3>
      <ul className="divide-y divide-border">
        {(requests ?? []).map((r) => (
          <li key={r.id} className="py-2.5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-textPrimary">{HR_REQUEST_TYPE_LABEL[r.requestType] ?? r.requestType}</p>
              <p className="text-[11px] text-textSecondary">{r.description}</p>
            </div>
            <StatusBadge status={r.status} />
          </li>
        ))}
        {requests && requests.length === 0 && (
          <p className="text-xs text-textSecondary py-3">درخواستی ثبت نشده.</p>
        )}
      </ul>
    </div>
  );
}

function ageInYears(birthDateIso: string): number {
  const birthDate = new Date(birthDateIso);
  const now = new Date();
  let age = now.getFullYear() - birthDate.getFullYear();
  const hasHadBirthdayThisYear =
    now.getMonth() > birthDate.getMonth() ||
    (now.getMonth() === birthDate.getMonth() && now.getDate() >= birthDate.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

function ChildrenBlock({ employeeId, canManage }: { employeeId: string; canManage: boolean }) {
  const { data: children } = useEmployeeChildren(employeeId);
  const { create, remove } = useEmployeeChildMutations();

  const [showForm, setShowForm] = useState(false);
  const [fullName, setFullName] = useState("");
  const [birthDate, setBirthDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-textPrimary">فرزندان</h3>
        {canManage && !showForm && (
          <GhostButton onClick={() => setShowForm(true)}>
            <span className="flex items-center gap-1.5"><Plus size={13} /> افزودن فرزند</span>
          </GhostButton>
        )}
      </div>
      <p className="text-[11px] text-textSecondary">
        تاریخ تولد مبنای محاسبه‌ی خودکار «حق اولاد» در حقوق و دستمزد است — فقط فرزندان زیر سقف سنی
        تعیین‌شده (بر اساس قانون فعال) مشمول می‌شوند.
      </p>

      {showForm && (
        <div className="rounded-lg border border-border p-3 space-y-3 bg-bg">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="نام فرزند">
              <TextInput value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </Field>
            <Field label="تاریخ تولد *">
              <DualDateInput value={birthDate} onChange={setBirthDate} />
            </Field>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex gap-2 justify-end">
            <GhostButton onClick={() => setShowForm(false)}>انصراف</GhostButton>
            <PrimaryButton
              disabled={!birthDate || create.isPending}
              onClick={async () => {
                try {
                  setError(null);
                  await create.mutateAsync({ employeeId, fullName: fullName.trim() || undefined, birthDate: birthDate! });
                  setShowForm(false);
                  setFullName("");
                  setBirthDate(null);
                } catch (err) {
                  setError(extractError(err, "خطا در ثبت"));
                }
              }}
            >
              ذخیره
            </PrimaryButton>
          </div>
        </div>
      )}

      <ul className="divide-y divide-border">
        {(children ?? []).map((child) => (
          <li key={child.id} className="py-2.5 flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-textPrimary">{child.fullName || "بدون نام"}</p>
              <p className="text-[11px] text-textSecondary">
                {formatJalali(child.birthDate)} · {ageInYears(child.birthDate)} ساله
              </p>
            </div>
            {canManage && (
              <button
                onClick={() => remove.mutate({ id: child.id, employeeId })}
                className="text-danger"
                aria-label="حذف فرزند"
              >
                <Trash2 size={14} />
              </button>
            )}
          </li>
        ))}
        {children && children.length === 0 && <p className="text-xs text-textSecondary py-3">فرزندی ثبت نشده.</p>}
      </ul>
    </div>
  );
}

function BenefitsBlock({ employeeId, canManage }: { employeeId: string; canManage: boolean }) {
  const { data: benefits } = useEmployeeBenefits(employeeId);
  const { data: benefitTypes } = useBenefitTypes();
  const { data: currencies } = useCurrencies();
  const { create } = useEmployeeBenefitMutations();

  const [showForm, setShowForm] = useState(false);
  const [benefitTypeId, setBenefitTypeId] = useState("");
  const [amount, setAmount] = useState("");
  const [currencyCode, setCurrencyCode] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-textPrimary">مزایا</h3>
        {canManage && !showForm && (
          <GhostButton onClick={() => setShowForm(true)}>
            <span className="flex items-center gap-1.5"><Plus size={13} /> تخصیص جدید</span>
          </GhostButton>
        )}
      </div>

      {showForm && (
        <div className="rounded-lg border border-border p-3 space-y-3 bg-bg">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="نوع مزایا *">
              <Select value={benefitTypeId} onChange={(e) => setBenefitTypeId(e.target.value)}>
                <option value="">— انتخاب —</option>
                {(benefitTypes ?? []).map((t) => (
                  <option key={t.id} value={t.id}>{t.benefitName}</option>
                ))}
              </Select>
            </Field>
            <Field label="مبلغ *">
              <AmountInput value={amount === "" ? null : Number(amount)} onChange={(n) => setAmount(n === null ? "" : String(n))} />
            </Field>
            <Field label="ارز *">
              <Select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)}>
                <option value="">— انتخاب —</option>
                {(currencies ?? []).map((c) => (
                  <option key={c.currencyCode} value={c.currencyCode}>{c.currencyName}</option>
                ))}
              </Select>
            </Field>
            <Field label="اعتبار از تاریخ *">
              <DualDateInput value={effectiveFrom} onChange={setEffectiveFrom} />
            </Field>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex gap-2 justify-end">
            <GhostButton onClick={() => setShowForm(false)}>انصراف</GhostButton>
            <PrimaryButton
              disabled={!benefitTypeId || !amount || !currencyCode || !effectiveFrom || create.isPending}
              onClick={async () => {
                try {
                  setError(null);
                  await create.mutateAsync({
                    employeeId,
                    benefitTypeId,
                    amount: Number(amount),
                    currencyCode,
                    effectiveFrom,
                  });
                  setShowForm(false);
                  setBenefitTypeId("");
                  setAmount("");
                  setCurrencyCode("");
                  setEffectiveFrom(null);
                } catch (err) {
                  setError(extractError(err, "خطا در ثبت"));
                }
              }}
            >
              ذخیره
            </PrimaryButton>
          </div>
        </div>
      )}

      <ul className="divide-y divide-border">
        {(benefits ?? []).map((b) => (
          <li key={b.id} className="py-2.5">
            <p className="text-xs font-medium text-textPrimary">
              {b.benefitType.benefitName} — {Number(b.amount).toLocaleString("en-US")} {b.currencyCode}
            </p>
            <p className="text-[11px] text-textSecondary">
              از {formatJalali(b.effectiveFrom)}
              {b.effectiveTo ? ` تا ${formatJalali(b.effectiveTo)}` : " (فعال)"}
            </p>
          </li>
        ))}
        {benefits && benefits.length === 0 && <p className="text-xs text-textSecondary py-3">مزایایی تخصیص داده نشده.</p>}
      </ul>
    </div>
  );
}

function DeductionsBlock({ employeeId, canManage }: { employeeId: string; canManage: boolean }) {
  const { data: deductions } = useEmployeeDeductions(employeeId);
  const { data: deductionTypes } = useDeductionTypes();
  const { data: currencies } = useCurrencies();
  const { data: loans } = useEmployeeLoans(employeeId);
  const { create } = useEmployeeDeductionMutations();

  const [showForm, setShowForm] = useState(false);
  const [deductionTypeId, setDeductionTypeId] = useState("");
  const [amount, setAmount] = useState("");
  const [currencyCode, setCurrencyCode] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState<string | null>(null);
  const [relatedLoanId, setRelatedLoanId] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-textPrimary">کسورات</h3>
        {canManage && !showForm && (
          <GhostButton onClick={() => setShowForm(true)}>
            <span className="flex items-center gap-1.5"><Plus size={13} /> تخصیص جدید</span>
          </GhostButton>
        )}
      </div>

      {showForm && (
        <div className="rounded-lg border border-border p-3 space-y-3 bg-bg">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="نوع کسر *">
              <Select value={deductionTypeId} onChange={(e) => setDeductionTypeId(e.target.value)}>
                <option value="">— انتخاب —</option>
                {(deductionTypes ?? []).map((t) => (
                  <option key={t.id} value={t.id}>{t.deductionName}</option>
                ))}
              </Select>
            </Field>
            <Field label="مبلغ *">
              <AmountInput value={amount === "" ? null : Number(amount)} onChange={(n) => setAmount(n === null ? "" : String(n))} />
            </Field>
            <Field label="ارز *">
              <Select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)}>
                <option value="">— انتخاب —</option>
                {(currencies ?? []).map((c) => (
                  <option key={c.currencyCode} value={c.currencyCode}>{c.currencyName}</option>
                ))}
              </Select>
            </Field>
            <Field label="اعتبار از تاریخ *">
              <DualDateInput value={effectiveFrom} onChange={setEffectiveFrom} />
            </Field>
            <Field label="مرتبط با کدوم وام (اختیاری)">
              <Select value={relatedLoanId} onChange={(e) => setRelatedLoanId(e.target.value)}>
                <option value="">— هیچ‌کدام —</option>
                {(loans ?? []).map((loan) => (
                  <option key={loan.id} value={loan.id}>
                    {Number(loan.loanAmount).toLocaleString("en-US")} {loan.currencyCode}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <div className="flex gap-2 justify-end">
            <GhostButton onClick={() => setShowForm(false)}>انصراف</GhostButton>
            <PrimaryButton
              disabled={!deductionTypeId || !amount || !currencyCode || !effectiveFrom || create.isPending}
              onClick={async () => {
                try {
                  setError(null);
                  await create.mutateAsync({
                    employeeId,
                    deductionTypeId,
                    amount: Number(amount),
                    currencyCode,
                    effectiveFrom,
                    relatedLoanId: relatedLoanId || undefined,
                  });
                  setShowForm(false);
                  setDeductionTypeId("");
                  setAmount("");
                  setCurrencyCode("");
                  setEffectiveFrom(null);
                  setRelatedLoanId("");
                } catch (err) {
                  setError(extractError(err, "خطا در ثبت"));
                }
              }}
            >
              ذخیره
            </PrimaryButton>
          </div>
        </div>
      )}

      <ul className="divide-y divide-border">
        {(deductions ?? []).map((d) => (
          <li key={d.id} className="py-2.5">
            <p className="text-xs font-medium text-textPrimary">
              {d.deductionType.deductionName} — {Number(d.amount).toLocaleString("en-US")} {d.currencyCode}
            </p>
            <p className="text-[11px] text-textSecondary">
              از {formatJalali(d.effectiveFrom)}
              {d.effectiveTo ? ` تا ${formatJalali(d.effectiveTo)}` : " (فعال)"}
            </p>
          </li>
        ))}
        {deductions && deductions.length === 0 && <p className="text-xs text-textSecondary py-3">کسری تخصیص داده نشده.</p>}
      </ul>
    </div>
  );
}

function PayslipsBlock({ employeeId }: { employeeId: string }) {
  const { data: payslips } = useEmployeePayslips(employeeId);
  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-3">
      <h3 className="text-sm font-bold text-textPrimary">فیش‌های حقوقی</h3>
      <ul className="divide-y divide-border">
        {(payslips ?? []).map((p) => {
          const meta = PAYROLL_STATUS_META[p.status];
          return (
            <li key={p.id} className="py-2.5 flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-textPrimary">
                  ماه {p.payrollPeriod.periodMonth} / {p.payrollPeriod.periodYear} — خالص{" "}
                  {Number(p.netAmount).toLocaleString("en-US")} {p.currencyCode}
                </p>
              </div>
              {meta && <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${meta.className}`}>{meta.label}</span>}
            </li>
          );
        })}
        {payslips && payslips.length === 0 && <p className="text-xs text-textSecondary py-3">فیشی صادر نشده.</p>}
      </ul>
    </div>
  );
}

function PerformanceReviewsBlock({ employeeId }: { employeeId: string }) {
  const { data: reviews } = useEmployeePerformanceReviews(employeeId);
  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-3">
      <h3 className="text-sm font-bold text-textPrimary">ارزیابی‌های عملکرد</h3>
      <ul className="divide-y divide-border">
        {(reviews ?? []).map((r) => {
          const meta = REVIEW_STATUS_META[r.status];
          return (
            <li key={r.id} className="py-2.5">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-textPrimary">{r.cycle.cycleName}</p>
                  <p className="text-[11px] text-textSecondary">ارزیاب: {r.reviewer.fullName}{r.overallScore ? ` · نمره: ${r.overallScore}` : ""}</p>
                </div>
                {meta && <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${meta.className}`}>{meta.label}</span>}
              </div>
            </li>
          );
        })}
        {reviews && reviews.length === 0 && <p className="text-xs text-textSecondary py-3">بررسی عملکردی ثبت نشده.</p>}
      </ul>
    </div>
  );
}

export function EmployeeHrRecordsSection({ employeeId, canManage }: { employeeId: string; canManage: boolean }) {
  return (
    <>
      <AttendanceBlock employeeId={employeeId} canManage={canManage} />
      <LeaveBalancesBlock employeeId={employeeId} canManage={canManage} />
      <MissionsBlock employeeId={employeeId} />
      <OvertimeBlock employeeId={employeeId} />
      <LoansBlock employeeId={employeeId} />
      <ChildrenBlock employeeId={employeeId} canManage={canManage} />
      <BenefitsBlock employeeId={employeeId} canManage={canManage} />
      <DeductionsBlock employeeId={employeeId} canManage={canManage} />
      <HrRequestsBlock employeeId={employeeId} />
      <PayslipsBlock employeeId={employeeId} />
      <PerformanceReviewsBlock employeeId={employeeId} />
    </>
  );
}
