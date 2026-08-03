import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Field, GhostButton, PrimaryButton, Select, TextInput } from "../../components/ui/fields";
import { DualDateInput } from "../../components/ui/DualDateInput";
import { formatJalali } from "../../lib/jalali";
import { useEmployee, useEmployees } from "./hr-api";
import {
  PerformanceReviewCycle,
  usePerformanceReviewCycles,
  usePerformanceReviewMutations,
} from "./performance-review-api";

function extractError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? fallback);
}

function CycleRow({ cycle }: { cycle: PerformanceReviewCycle }) {
  const { closeCycle } = usePerformanceReviewMutations();
  return (
    <div className="flex items-center gap-3 p-4">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-textPrimary">{cycle.cycleName}</p>
        <p className="text-[11px] text-textSecondary">{formatJalali(cycle.startDate)} تا {formatJalali(cycle.endDate)}</p>
      </div>
      <span
        className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
          cycle.status === "open" ? "bg-successSoft text-success" : "bg-border text-textSecondary"
        }`}
      >
        {cycle.status === "open" ? "باز" : "بسته"}
      </span>
      {cycle.status === "open" && (
        <button onClick={() => closeCycle.mutate(cycle.id)} className="text-[11px] text-danger">
          بستن دوره
        </button>
      )}
    </div>
  );
}

function NewCycleForm({ onDone }: { onDone: () => void }) {
  const { createCycle } = usePerformanceReviewMutations();
  const [cycleName, setCycleName] = useState("");
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-3">
      <h3 className="text-sm font-bold text-textPrimary">دوره ارزیابی جدید</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="نام دوره *">
          <TextInput value={cycleName} onChange={(e) => setCycleName(e.target.value)} />
        </Field>
        <Field label="از تاریخ *">
          <DualDateInput value={startDate} onChange={setStartDate} />
        </Field>
        <Field label="تا تاریخ *">
          <DualDateInput value={endDate} onChange={setEndDate} />
        </Field>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2 justify-end">
        <GhostButton onClick={onDone}>انصراف</GhostButton>
        <PrimaryButton
          disabled={!cycleName.trim() || !startDate || !endDate || createCycle.isPending}
          onClick={async () => {
            try {
              setError(null);
              await createCycle.mutateAsync({ cycleName: cycleName.trim(), startDate, endDate });
              onDone();
            } catch (err) {
              setError(extractError(err, "خطا در ساخت دوره"));
            }
          }}
        >
          ساخت دوره
        </PrimaryButton>
      </div>
    </div>
  );
}

const EMPTY_CRITERION = { criterionName: "", weightPercent: "" };

function NewReviewForm({ onDone }: { onDone: () => void }) {
  const { data: cycles } = usePerformanceReviewCycles();
  const { data: employees } = useEmployees({});
  const { createReview } = usePerformanceReviewMutations();

  const [cycleId, setCycleId] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [reviewerId, setReviewerId] = useState("");
  const [criteria, setCriteria] = useState([{ ...EMPTY_CRITERION }]);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { data: selectedEmployee } = useEmployee(employeeId || null);
  useEffect(() => {
    if (selectedEmployee?.directManager && !reviewerId) {
      setReviewerId(selectedEmployee.directManager.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployee]);

  const openCycles = (cycles ?? []).filter((c) => c.status === "open");
  const canSubmit =
    cycleId && employeeId && reviewerId && criteria.every((c) => c.criterionName.trim());

  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-3">
      <h3 className="text-sm font-bold text-textPrimary">بررسی عملکرد جدید</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="دوره ارزیابی *">
          <Select value={cycleId} onChange={(e) => setCycleId(e.target.value)}>
            <option value="">— انتخاب —</option>
            {openCycles.map((c) => (
              <option key={c.id} value={c.id}>{c.cycleName}</option>
            ))}
          </Select>
        </Field>
        <Field label="پرسنل مورد ارزیابی *">
          <Select
            value={employeeId}
            onChange={(e) => {
              setEmployeeId(e.target.value);
              setReviewerId("");
            }}
          >
            <option value="">— انتخاب —</option>
            {(employees ?? []).map((e) => (
              <option key={e.id} value={e.id}>{e.fullName}</option>
            ))}
          </Select>
        </Field>
        <Field label="ارزیاب *">
          <Select value={reviewerId} onChange={(e) => setReviewerId(e.target.value)}>
            <option value="">— انتخاب —</option>
            {(employees ?? []).map((e) => (
              <option key={e.id} value={e.id}>{e.fullName}</option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium text-textPrimary">معیارهای ارزیابی</p>
        {criteria.map((c, i) => (
          <div key={i} className="flex items-center gap-2">
            <TextInput
              value={c.criterionName}
              onChange={(e) =>
                setCriteria((cur) => cur.map((x, idx) => (idx === i ? { ...x, criterionName: e.target.value } : x)))
              }
              placeholder="مثلاً کیفیت کار"
              className="flex-1"
            />
            <TextInput
              value={c.weightPercent}
              onChange={(e) =>
                setCriteria((cur) => cur.map((x, idx) => (idx === i ? { ...x, weightPercent: e.target.value } : x)))
              }
              placeholder="وزن ٪"
              dir="ltr"
              inputMode="numeric"
              className="!w-24"
            />
            {criteria.length > 1 && (
              <button onClick={() => setCriteria((cur) => cur.filter((_, idx) => idx !== i))} className="text-danger" aria-label="حذف معیار">
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
        <button
          onClick={() => setCriteria((cur) => [...cur, { ...EMPTY_CRITERION }])}
          className="text-[11px] text-primary font-medium flex items-center gap-1"
        >
          <Plus size={12} /> معیار دیگر
        </button>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
      {success && <p className="text-xs text-success">بررسی با موفقیت ساخته شد — از صفحه جزئیات پرسنل قابل پیگیریه.</p>}
      <div className="flex gap-2 justify-end">
        <GhostButton onClick={onDone}>بستن</GhostButton>
        <PrimaryButton
          disabled={!canSubmit || createReview.isPending}
          onClick={async () => {
            try {
              setError(null);
              await createReview.mutateAsync({
                cycleId,
                employeeId,
                reviewerId,
                criteria: criteria.map((c) => ({
                  criterionName: c.criterionName.trim(),
                  weightPercent: c.weightPercent ? Number(c.weightPercent) : undefined,
                })),
              });
              setSuccess(true);
              setEmployeeId("");
              setReviewerId("");
              setCriteria([{ ...EMPTY_CRITERION }]);
            } catch (err) {
              setError(extractError(err, "خطا در ساخت بررسی"));
            }
          }}
        >
          {createReview.isPending ? "در حال ثبت..." : "ساخت بررسی"}
        </PrimaryButton>
      </div>
    </div>
  );
}

export function PerformanceReviewsTab() {
  const { data: cycles, isLoading } = usePerformanceReviewCycles();
  const [showNewCycle, setShowNewCycle] = useState(false);
  const [showNewReview, setShowNewReview] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        {!showNewReview && (
          <GhostButton onClick={() => setShowNewReview(true)}>
            <span className="flex items-center gap-1.5"><Plus size={13} /> بررسی جدید</span>
          </GhostButton>
        )}
        {!showNewCycle && (
          <PrimaryButton onClick={() => setShowNewCycle(true)}>
            <span className="flex items-center gap-1.5"><Plus size={14} /> دوره جدید</span>
          </PrimaryButton>
        )}
      </div>

      {showNewCycle && <NewCycleForm onDone={() => setShowNewCycle(false)} />}
      {showNewReview && <NewReviewForm onDone={() => setShowNewReview(false)} />}

      {isLoading && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}

      <div className="rounded-xl bg-surface border border-border shadow-card divide-y divide-border">
        {cycles && cycles.length === 0 && <p className="text-xs text-textSecondary p-8 text-center">هنوز دوره ارزیابی‌ای ثبت نشده.</p>}
        {(cycles ?? []).map((cycle) => (
          <CycleRow key={cycle.id} cycle={cycle} />
        ))}
      </div>
    </div>
  );
}
