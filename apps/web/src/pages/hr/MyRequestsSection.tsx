import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { DualDateInput } from "../../components/ui/DualDateInput";
import { Field, PrimaryButton, Select, TextArea, TextInput } from "../../components/ui/fields";
import { AmountInput } from "../../components/ui/AmountInput";
import { formatJalali } from "../../lib/jalali";
import { useCurrencies } from "../inquiries/rfqs-api";
import {
  useEmployeeLoanMutations,
  useHrRequestMutations,
  useLeaveRequestMutations,
  useLeaveTypes,
  useMissionRequestMutations,
  useMyEmployee,
  useMyHrRequests,
  useMyLeaveBalances,
  useMyLeaveRequests,
  useMyLoans,
  useMyMissionRequests,
  useMyOvertimeRecords,
  useOvertimeRecordMutations,
} from "./hr-requests-api";
import { HR_REQUEST_TYPE_LABEL, REQUEST_STATUS_META } from "./hr-requests-types";

function extractError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? fallback);
}

function StatusBadge({ status }: { status: string }) {
  const meta = REQUEST_STATUS_META[status];
  if (!meta) return null;
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${meta.className}`}>{meta.label}</span>
  );
}

function LeaveTab() {
  const { data: leaveTypes } = useLeaveTypes();
  const { data: balances } = useMyLeaveBalances();
  const { data: requests, isLoading } = useMyLeaveRequests();
  const { create, cancel } = useLeaveRequestMutations();

  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canSubmit = leaveTypeId && startDate && endDate;

  return (
    <div className="space-y-4">
      {balances && balances.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {balances.map((b) => (
            <div key={b.id} className="rounded-lg p-2.5 bg-bg">
              <p className="text-[11px] text-textSecondary">{b.leaveType.typeName} ({b.year})</p>
              <p className="text-sm font-medium text-textPrimary">
                {Number(b.entitledDays) - Number(b.usedDays)} روز مانده
              </p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="نوع مرخصی *">
            <Select value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
              <option value="">— انتخاب —</option>
              {(leaveTypes ?? []).map((t) => (
                <option key={t.id} value={t.id}>{t.typeName}</option>
              ))}
            </Select>
          </Field>
          <div />
          <Field label="از تاریخ *">
            <DualDateInput value={startDate} onChange={setStartDate} />
          </Field>
          <Field label="تا تاریخ *">
            <DualDateInput value={endDate} onChange={setEndDate} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="دلیل">
              <TextArea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
            </Field>
          </div>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex justify-end">
          <PrimaryButton
            disabled={!canSubmit || create.isPending}
            onClick={async () => {
              try {
                setError(null);
                await create.mutateAsync({ leaveTypeId, startDate, endDate, reason: reason || undefined });
                setLeaveTypeId("");
                setStartDate(null);
                setEndDate(null);
                setReason("");
              } catch (err) {
                setError(extractError(err, "خطا در ثبت درخواست"));
              }
            }}
          >
            {create.isPending ? "در حال ثبت..." : "ثبت درخواست مرخصی"}
          </PrimaryButton>
        </div>
      </div>

      {isLoading && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}
      <ul className="divide-y divide-border">
        {(requests ?? []).map((r) => (
          <li key={r.id} className="py-2.5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-textPrimary">
                {r.leaveType.typeName} — {formatJalali(r.startDate)} تا {formatJalali(r.endDate)} ({r.daysCount} روز)
              </p>
              {r.reason && <p className="text-[11px] text-textSecondary">{r.reason}</p>}
            </div>
            <StatusBadge status={r.status} />
            {r.status === "pending" && (
              <button onClick={() => cancel.mutate(r.id)} className="text-[11px] text-danger">
                لغو
              </button>
            )}
          </li>
        ))}
        {requests && requests.length === 0 && (
          <p className="text-xs text-textSecondary py-3">هنوز درخواست مرخصی‌ای ثبت نکردی.</p>
        )}
      </ul>
    </div>
  );
}

function MissionTab() {
  const { data: currencies } = useCurrencies();
  const { data: requests, isLoading } = useMyMissionRequests();
  const { create, cancel } = useMissionRequestMutations();

  const [destination, setDestination] = useState("");
  const [purpose, setPurpose] = useState("");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [transportationMethod, setTransportationMethod] = useState("");
  const [estimatedCost, setEstimatedCost] = useState("");
  const [currencyCode, setCurrencyCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canSubmit = destination.trim() && startDate && endDate;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="مقصد *">
            <TextInput value={destination} onChange={(e) => setDestination(e.target.value)} />
          </Field>
          <Field label="وسیله رفت‌وآمد">
            <TextInput value={transportationMethod} onChange={(e) => setTransportationMethod(e.target.value)} />
          </Field>
          <Field label="از تاریخ *">
            <DualDateInput value={startDate} onChange={setStartDate} />
          </Field>
          <Field label="تا تاریخ *">
            <DualDateInput value={endDate} onChange={setEndDate} />
          </Field>
          <Field label="هزینه تخمینی">
            <AmountInput
              value={estimatedCost === "" ? null : Number(estimatedCost)}
              onChange={(n) => setEstimatedCost(n === null ? "" : String(n))}
            />
          </Field>
          <Field label="ارز">
            <Select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)}>
              <option value="">— انتخاب —</option>
              {(currencies ?? []).map((c) => (
                <option key={c.currencyCode} value={c.currencyCode}>{c.currencyName}</option>
              ))}
            </Select>
          </Field>
          <div className="sm:col-span-2">
            <Field label="هدف مأموریت">
              <TextArea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={2} />
            </Field>
          </div>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex justify-end">
          <PrimaryButton
            disabled={!canSubmit || create.isPending}
            onClick={async () => {
              try {
                setError(null);
                await create.mutateAsync({
                  destination: destination.trim(),
                  purpose: purpose || undefined,
                  startDate,
                  endDate,
                  transportationMethod: transportationMethod || undefined,
                  estimatedCost: estimatedCost ? Number(estimatedCost) : undefined,
                  currencyCode: currencyCode || undefined,
                });
                setDestination("");
                setPurpose("");
                setStartDate(null);
                setEndDate(null);
                setTransportationMethod("");
                setEstimatedCost("");
                setCurrencyCode("");
              } catch (err) {
                setError(extractError(err, "خطا در ثبت درخواست"));
              }
            }}
          >
            {create.isPending ? "در حال ثبت..." : "ثبت درخواست مأموریت"}
          </PrimaryButton>
        </div>
      </div>

      {isLoading && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}
      <ul className="divide-y divide-border">
        {(requests ?? []).map((r) => (
          <li key={r.id} className="py-2.5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-textPrimary">
                {r.destination} — {formatJalali(r.startDate)} تا {formatJalali(r.endDate)}
              </p>
              {r.purpose && <p className="text-[11px] text-textSecondary">{r.purpose}</p>}
            </div>
            <StatusBadge status={r.status} />
            {r.status === "pending" && (
              <button onClick={() => cancel.mutate(r.id)} className="text-[11px] text-danger">
                لغو
              </button>
            )}
          </li>
        ))}
        {requests && requests.length === 0 && (
          <p className="text-xs text-textSecondary py-3">هنوز درخواست مأموریتی ثبت نکردی.</p>
        )}
      </ul>
    </div>
  );
}

function OvertimeTab() {
  const { data: requests, isLoading } = useMyOvertimeRecords();
  const { create, cancel } = useOvertimeRecordMutations();

  const [workDate, setWorkDate] = useState<string | null>(null);
  const [hours, setHours] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canSubmit = workDate && hours.trim();

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="تاریخ *">
            <DualDateInput value={workDate} onChange={setWorkDate} />
          </Field>
          <Field label="ساعت اضافه‌کاری *">
            <TextInput value={hours} onChange={(e) => setHours(e.target.value)} dir="ltr" inputMode="decimal" />
          </Field>
          <div className="sm:col-span-2">
            <Field label="دلیل">
              <TextArea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
            </Field>
          </div>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex justify-end">
          <PrimaryButton
            disabled={!canSubmit || create.isPending}
            onClick={async () => {
              try {
                setError(null);
                await create.mutateAsync({ workDate, hours: Number(hours), reason: reason || undefined });
                setWorkDate(null);
                setHours("");
                setReason("");
              } catch (err) {
                setError(extractError(err, "خطا در ثبت درخواست"));
              }
            }}
          >
            {create.isPending ? "در حال ثبت..." : "ثبت اضافه‌کاری"}
          </PrimaryButton>
        </div>
      </div>

      {isLoading && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}
      <ul className="divide-y divide-border">
        {(requests ?? []).map((r) => (
          <li key={r.id} className="py-2.5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-textPrimary">
                {formatJalali(r.workDate)} — {r.hours} ساعت (ضریب {r.rateMultiplier})
              </p>
              {r.reason && <p className="text-[11px] text-textSecondary">{r.reason}</p>}
            </div>
            <StatusBadge status={r.status} />
            {r.status === "pending" && (
              <button onClick={() => cancel.mutate(r.id)} className="text-[11px] text-danger">
                لغو
              </button>
            )}
          </li>
        ))}
        {requests && requests.length === 0 && (
          <p className="text-xs text-textSecondary py-3">هنوز اضافه‌کاری‌ای ثبت نکردی.</p>
        )}
      </ul>
    </div>
  );
}

function LoanTab() {
  const { data: loans, isLoading } = useMyLoans();
  const { create, cancel } = useEmployeeLoanMutations();
  const { data: currencies } = useCurrencies();

  const [loanAmount, setLoanAmount] = useState("");
  const [currencyCode, setCurrencyCode] = useState("");
  const [installmentCount, setInstallmentCount] = useState("");
  const [startDeductionDate, setStartDeductionDate] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const canSubmit = loanAmount.trim() && currencyCode && installmentCount.trim() && startDeductionDate;
  const previewInstallment =
    loanAmount && installmentCount && Number(installmentCount) > 0
      ? (Number(loanAmount) / Number(installmentCount)).toLocaleString("en-US", { maximumFractionDigits: 2 })
      : null;

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="مبلغ وام *">
            <AmountInput
              value={loanAmount === "" ? null : Number(loanAmount)}
              onChange={(n) => setLoanAmount(n === null ? "" : String(n))}
            />
          </Field>
          <Field label="ارز *">
            <Select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)}>
              <option value="">— انتخاب —</option>
              {(currencies ?? []).map((c) => (
                <option key={c.currencyCode} value={c.currencyCode}>{c.currencyName}</option>
              ))}
            </Select>
          </Field>
          <Field label="تعداد قسط *">
            <TextInput value={installmentCount} onChange={(e) => setInstallmentCount(e.target.value)} dir="ltr" inputMode="numeric" />
          </Field>
          <Field label="تاریخ شروع کسر اقساط *">
            <DualDateInput value={startDeductionDate} onChange={setStartDeductionDate} />
          </Field>
          <div className="sm:col-span-2">
            <Field label="دلیل">
              <TextArea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} />
            </Field>
          </div>
        </div>
        {previewInstallment && (
          <p className="text-[11px] text-textSecondary">
            هر قسط تقریباً <span className="font-medium text-textPrimary">{previewInstallment}</span> {currencyCode || ""}
          </p>
        )}
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex justify-end">
          <PrimaryButton
            disabled={!canSubmit || create.isPending}
            onClick={async () => {
              try {
                setError(null);
                await create.mutateAsync({
                  loanAmount: Number(loanAmount),
                  currencyCode,
                  installmentCount: Number(installmentCount),
                  startDeductionDate,
                  reason: reason || undefined,
                });
                setLoanAmount("");
                setCurrencyCode("");
                setInstallmentCount("");
                setStartDeductionDate(null);
                setReason("");
              } catch (err) {
                setError(extractError(err, "خطا در ثبت درخواست وام"));
              }
            }}
          >
            {create.isPending ? "در حال ثبت..." : "ثبت درخواست وام"}
          </PrimaryButton>
        </div>
      </div>

      {isLoading && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}
      <ul className="divide-y divide-border">
        {(loans ?? []).map((loan) => (
          <li key={loan.id} className="py-2.5">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-textPrimary">
                  {Number(loan.loanAmount).toLocaleString("en-US")} {loan.currencyCode} — {loan.installmentCount} قسط
                </p>
                {loan.reason && <p className="text-[11px] text-textSecondary">{loan.reason}</p>}
              </div>
              <StatusBadge status={loan.status} />
              {loan.status === "pending" && (
                <button onClick={() => cancel.mutate(loan.id)} className="text-[11px] text-danger">
                  لغو
                </button>
              )}
            </div>
            {loan.installments.length > 0 && (
              <p className="text-[11px] text-textSecondary mt-1">
                اقساط: {loan.installments.map((i) => `${formatJalali(i.dueDate)} (${i.amount})`).join(" · ")}
              </p>
            )}
          </li>
        ))}
        {loans && loans.length === 0 && <p className="text-xs text-textSecondary py-3">هنوز درخواست وامی ثبت نکردی.</p>}
      </ul>
    </div>
  );
}

function OtherRequestsTab() {
  const { data: requests, isLoading } = useMyHrRequests();
  const { create, cancel } = useHrRequestMutations();

  const [requestType, setRequestType] = useState("certificate");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border p-3 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="نوع درخواست *">
            <Select value={requestType} onChange={(e) => setRequestType(e.target.value)}>
              {Object.entries(HR_REQUEST_TYPE_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
        </div>
        <Field label="توضیح *">
          <TextArea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </Field>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex justify-end">
          <PrimaryButton
            disabled={!description.trim() || create.isPending}
            onClick={async () => {
              try {
                setError(null);
                await create.mutateAsync({ requestType, description: description.trim() });
                setDescription("");
              } catch (err) {
                setError(extractError(err, "خطا در ثبت درخواست"));
              }
            }}
          >
            {create.isPending ? "در حال ثبت..." : "ثبت درخواست"}
          </PrimaryButton>
        </div>
      </div>

      {isLoading && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}
      <ul className="divide-y divide-border">
        {(requests ?? []).map((r) => (
          <li key={r.id} className="py-2.5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-textPrimary">{HR_REQUEST_TYPE_LABEL[r.requestType] ?? r.requestType}</p>
              <p className="text-[11px] text-textSecondary">{r.description}</p>
            </div>
            <StatusBadge status={r.status} />
            {r.status === "pending" && (
              <button onClick={() => cancel.mutate(r.id)} className="text-[11px] text-danger">
                لغو
              </button>
            )}
          </li>
        ))}
        {requests && requests.length === 0 && (
          <p className="text-xs text-textSecondary py-3">هنوز درخواست دیگری ثبت نکردی.</p>
        )}
      </ul>
    </div>
  );
}

export function MyRequestsSection() {
  const { data: myEmployee, isLoading } = useMyEmployee();
  const [tab, setTab] = useState<"leave" | "mission" | "overtime" | "loan" | "other">("leave");

  if (isLoading) {
    return null;
  }

  if (!myEmployee) {
    return (
      <div className="rounded-lg p-5 bg-surface border border-border">
        <p className="text-sm font-semibold mb-3 text-textPrimary">درخواست‌های من</p>
        <div className="rounded-lg p-3 flex items-center gap-3 bg-warningSoft text-warning text-xs">
          <AlertTriangle size={16} className="shrink-0" />
          پرونده پرسنلی متصل به این حساب نداری — برای ثبت مرخصی/مأموریت/اضافه‌کاری از منابع انسانی بخواه پرونده‌ات رو وصل کنه.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg p-5 bg-surface border border-border">
      <p className="text-sm font-semibold mb-4 text-textPrimary">درخواست‌های من</p>
      <div className="flex rounded-lg border border-border overflow-hidden w-fit mb-4">
        {([
          ["leave", "مرخصی"],
          ["mission", "مأموریت"],
          ["overtime", "اضافه‌کاری"],
          ["loan", "وام"],
          ["other", "سایر درخواست‌ها"],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`px-4 py-2 text-xs font-medium ${
              tab === value ? "bg-primary text-white" : "bg-bg text-textSecondary"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "leave" && <LeaveTab />}
      {tab === "mission" && <MissionTab />}
      {tab === "overtime" && <OvertimeTab />}
      {tab === "loan" && <LoanTab />}
      {tab === "other" && <OtherRequestsTab />}
    </div>
  );
}
