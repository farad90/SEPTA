import { useState } from "react";
import { formatJalali } from "../../lib/jalali";
import { PrimaryButton, TextArea, TextInput } from "../../components/ui/fields";
import { useMyEmployee } from "./hr-requests-api";
import { PAYROLL_STATUS_META, useMyPayslips } from "./payroll-api";
import {
  PerformanceReview,
  REVIEW_STATUS_META,
  useMyReviewsAsEmployee,
  useMyReviewsAsReviewer,
  usePerformanceReviewMutations,
} from "./performance-review-api";

function extractError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? fallback);
}

function PayslipsBlock() {
  const { data: payslips, isLoading } = useMyPayslips();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div>
      <p className="text-sm font-semibold mb-3 text-textPrimary">فیش‌های من</p>
      {isLoading && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}
      <ul className="divide-y divide-border">
        {(payslips ?? []).map((p) => {
          const meta = PAYROLL_STATUS_META[p.status];
          return (
            <li key={p.id} className="py-2.5">
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-textPrimary">
                    ماه {p.payrollPeriod.periodMonth} / {p.payrollPeriod.periodYear}
                  </p>
                  <p className="text-[11px] text-textSecondary" dir="ltr">
                    خالص: {Number(p.netAmount).toLocaleString("en-US")} {p.currencyCode}
                  </p>
                </div>
                {meta && <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${meta.className}`}>{meta.label}</span>}
                <button onClick={() => setExpandedId(expandedId === p.id ? null : p.id)} className="text-[11px] text-primary">
                  {expandedId === p.id ? "بستن" : "جزئیات"}
                </button>
              </div>
              {expandedId === p.id && (
                <div className="mt-2 rounded-lg bg-bg p-3 space-y-1">
                  {p.items.map((item) => (
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
                </div>
              )}
            </li>
          );
        })}
        {payslips && payslips.length === 0 && <p className="text-xs text-textSecondary py-3">هنوز فیشی برات صادر نشده.</p>}
      </ul>
    </div>
  );
}

function SelfReviewRow({ review }: { review: PerformanceReview }) {
  const { selfReview, acknowledge } = usePerformanceReviewMutations();
  const [notes, setNotes] = useState(review.selfReviewNotes ?? "");
  const [error, setError] = useState<string | null>(null);
  const meta = REVIEW_STATUS_META[review.status];

  return (
    <li className="py-3">
      <div className="flex items-center gap-3 mb-1.5">
        <p className="text-xs font-medium text-textPrimary flex-1">{review.cycle.cycleName}</p>
        {meta && <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${meta.className}`}>{meta.label}</span>}
      </div>

      {review.status === "draft" && (
        <div className="space-y-2">
          <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="خودارزیابی خودت رو بنویس..." />
          {error && <p className="text-[11px] text-danger">{error}</p>}
          <div className="flex justify-end">
            <PrimaryButton
              disabled={!notes.trim() || selfReview.isPending}
              onClick={async () => {
                try {
                  setError(null);
                  await selfReview.mutateAsync({ id: review.id, selfReviewNotes: notes.trim() });
                } catch (err) {
                  setError(extractError(err, "خطا در ثبت"));
                }
              }}
            >
              ذخیره خودارزیابی
            </PrimaryButton>
          </div>
        </div>
      )}

      {review.status === "submitted" && (
        <div className="space-y-2">
          <p className="text-[11px] text-textSecondary">نمره کلی: {review.overallScore ?? "—"}</p>
          {review.managerNotes && <p className="text-[11px] text-textSecondary">یادداشت ارزیاب: {review.managerNotes}</p>}
          <ul className="space-y-1">
            {review.items.map((item) => (
              <li key={item.id} className="text-[11px] text-textSecondary">
                {item.criterionName}: {item.score ?? "—"} {item.comments ? `(${item.comments})` : ""}
              </li>
            ))}
          </ul>
          <div className="flex justify-end">
            <PrimaryButton onClick={() => acknowledge.mutate(review.id)} disabled={acknowledge.isPending}>
              تأیید مشاهده
            </PrimaryButton>
          </div>
        </div>
      )}

      {review.status === "acknowledged" && (
        <p className="text-[11px] text-textSecondary">نمره کلی: {review.overallScore ?? "—"} · تأییدشده در {formatJalali(review.acknowledgedAt!)}</p>
      )}
    </li>
  );
}

function ReviewerRow({ review }: { review: PerformanceReview }) {
  const { submit } = usePerformanceReviewMutations();
  const [scores, setScores] = useState<Record<string, { score: string; comments: string }>>(
    Object.fromEntries(review.items.map((i) => [i.id, { score: i.score ?? "", comments: i.comments ?? "" }])),
  );
  const [overallScore, setOverallScore] = useState(review.overallScore ?? "");
  const [managerNotes, setManagerNotes] = useState(review.managerNotes ?? "");
  const [error, setError] = useState<string | null>(null);
  const meta = REVIEW_STATUS_META[review.status];

  if (review.status !== "draft") {
    return (
      <li className="py-3 flex items-center gap-3">
        <p className="text-xs font-medium text-textPrimary flex-1">{review.employee.fullName} — {review.cycle.cycleName}</p>
        {meta && <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${meta.className}`}>{meta.label}</span>}
      </li>
    );
  }

  return (
    <li className="py-3 space-y-2">
      <p className="text-xs font-medium text-textPrimary">{review.employee.fullName} — {review.cycle.cycleName}</p>
      {review.selfReviewNotes && <p className="text-[11px] text-textSecondary">خودارزیابی پرسنل: {review.selfReviewNotes}</p>}
      {review.items.map((item) => (
        <div key={item.id} className="flex items-center gap-2">
          <span className="text-[11px] text-textSecondary flex-1">{item.criterionName}</span>
          <TextInput
            value={scores[item.id]?.score ?? ""}
            onChange={(e) => setScores((s) => ({ ...s, [item.id]: { ...s[item.id], score: e.target.value } }))}
            dir="ltr"
            inputMode="decimal"
            placeholder="نمره"
            className="!w-20"
          />
          <TextInput
            value={scores[item.id]?.comments ?? ""}
            onChange={(e) => setScores((s) => ({ ...s, [item.id]: { ...s[item.id], comments: e.target.value } }))}
            placeholder="توضیح"
            className="flex-1"
          />
        </div>
      ))}
      <TextInput value={String(overallScore)} onChange={(e) => setOverallScore(e.target.value)} dir="ltr" inputMode="decimal" placeholder="نمره کلی" />
      <TextArea value={managerNotes} onChange={(e) => setManagerNotes(e.target.value)} rows={2} placeholder="یادداشت کلی" />
      {error && <p className="text-[11px] text-danger">{error}</p>}
      <div className="flex justify-end">
        <PrimaryButton
          disabled={submit.isPending}
          onClick={async () => {
            try {
              setError(null);
              await submit.mutateAsync({
                id: review.id,
                overallScore: overallScore ? Number(overallScore) : undefined,
                managerNotes: managerNotes || undefined,
                items: review.items.map((i) => ({
                  id: i.id,
                  score: scores[i.id]?.score ? Number(scores[i.id].score) : undefined,
                  comments: scores[i.id]?.comments || undefined,
                })),
              });
            } catch (err) {
              setError(extractError(err, "خطا در ثبت"));
            }
          }}
        >
          ثبت نهایی ارزیابی
        </PrimaryButton>
      </div>
    </li>
  );
}

function PerformanceReviewsBlock() {
  const { data: asEmployee, isLoading: loadingEmployee } = useMyReviewsAsEmployee();
  const { data: asReviewer, isLoading: loadingReviewer } = useMyReviewsAsReviewer();

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-semibold mb-2 text-textPrimary">ارزیابی‌های من</p>
        {loadingEmployee && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}
        <ul className="divide-y divide-border">
          {(asEmployee ?? []).map((r) => (
            <SelfReviewRow key={r.id} review={r} />
          ))}
          {asEmployee && asEmployee.length === 0 && <p className="text-xs text-textSecondary py-3">بررسی عملکردی برات ثبت نشده.</p>}
        </ul>
      </div>

      {(asReviewer ?? []).length > 0 && (
        <div>
          <p className="text-sm font-semibold mb-2 text-textPrimary">ارزیابی‌هایی که باید انجام بدم</p>
          {loadingReviewer && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}
          <ul className="divide-y divide-border">
            {(asReviewer ?? []).map((r) => (
              <ReviewerRow key={r.id} review={r} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export function MyPayrollAndReviewsSection() {
  const { data: myEmployee, isLoading } = useMyEmployee();

  if (isLoading || !myEmployee) {
    return null;
  }

  return (
    <div className="rounded-lg p-5 bg-surface border border-border space-y-5">
      <PayslipsBlock />
      <div className="border-t border-border pt-4">
        <PerformanceReviewsBlock />
      </div>
    </div>
  );
}
