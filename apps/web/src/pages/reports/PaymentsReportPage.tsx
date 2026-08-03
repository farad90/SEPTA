import { useState } from "react";
import { AlertTriangle } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { hasPermission } from "../../lib/permissions";
import { Select } from "../../components/ui/fields";
import { DualDateInput } from "../../components/ui/DualDateInput";
import { Toggle } from "../../components/ui/Toggle";
import { usePaymentsReport } from "./reports-api";
import { PaymentRowType } from "./report-types";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

const TYPE_LABEL: Record<PaymentRowType, string> = {
  receivable: "دریافتنی",
  payable: "پرداختنی",
};

const TYPE_CLASS: Record<PaymentRowType, string> = {
  receivable: "bg-successSoft text-success",
  payable: "bg-warningSoft text-warning",
};

const STATUS_LABEL: Record<string, string> = {
  unpaid: "پرداخت‌نشده",
  paid: "پرداخت‌شده",
  in_progress: "در حال انجام",
  completed: "تکمیل‌شده",
};

export function PaymentsReportPage() {
  const { user } = useAuth();
  const canView = hasPermission(user, "reports.view_payments");

  const [type, setType] = useState<"all" | "receivable" | "payable">("all");
  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [overdueOnly, setOverdueOnly] = useState(false);

  const { data, isLoading, isError } = usePaymentsReport(
    { type, dateFrom: dateFrom ?? undefined, dateTo: dateTo ?? undefined, overdueOnly },
    canView,
  );

  if (!canView) {
    return <p className="text-xs text-textSecondary py-8 text-center">دسترسی به این بخش ندارید.</p>;
  }

  const rows = data?.items ?? [];
  const currencyEntries = Object.entries(data?.totalsByCurrency ?? {});

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-textPrimary">گزارش پرداختی‌ها و دریافتی‌ها</h1>
        <p className="text-xs text-textSecondary mt-1">
          دریافتنی از پرداخت‌های مشتری، پرداختنی از پرداخت‌های تأمین‌کننده — مبالغ به تفکیک ارز.
        </p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <Select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="w-36">
          <option value="all">همه</option>
          <option value="receivable">دریافتنی</option>
          <option value="payable">پرداختنی</option>
        </Select>
        <DualDateInput value={dateFrom} onChange={setDateFrom} placeholder="از تاریخ سررسید" />
        <DualDateInput value={dateTo} onChange={setDateTo} placeholder="تا تاریخ سررسید" />
        <Toggle checked={overdueOnly} onChange={setOverdueOnly} label="فقط معوق" />
      </div>

      {currencyEntries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {currencyEntries.map(([currency, totals]) => (
            <div key={currency} className="rounded-lg p-3.5 bg-surface border border-border space-y-1.5">
              <span className="text-xs font-semibold text-textPrimary" dir="ltr">
                {currency}
              </span>
              <div className="flex items-center justify-between text-[11px] text-textSecondary">
                <span>دریافتنی پرداخت‌نشده</span>
                <span className="font-mono text-success" dir="ltr">
                  {fmt(totals.receivableUnpaid)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-textSecondary">
                <span>پرداختنی پرداخت‌نشده</span>
                <span className="font-mono text-warning" dir="ltr">
                  {fmt(totals.payableUnpaid)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {isLoading && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}
      {isError && <p className="text-xs text-danger py-8 text-center">خطا در دریافت اطلاعات.</p>}

      {!isLoading && !isError && (
        <div className="rounded-xl bg-surface border border-border shadow-card overflow-x-auto">
          <table className="w-full text-right min-w-[760px]">
            <thead>
              <tr className="border-b border-border bg-bg/60">
                <th className="p-3 text-[11px] font-medium text-textSecondary">نوع</th>
                <th className="p-3 text-[11px] font-medium text-textSecondary">طرف حساب</th>
                <th className="p-3 text-[11px] font-medium text-textSecondary">مرجع</th>
                <th className="p-3 text-[11px] font-medium text-textSecondary">سررسید</th>
                <th className="p-3 text-[11px] font-medium text-textSecondary">مبلغ</th>
                <th className="p-3 text-[11px] font-medium text-textSecondary">وضعیت</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-10 text-center text-xs text-textSecondary">
                    ردیفی یافت نشد.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id}>
                  <td className="p-3">
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${TYPE_CLASS[row.type]}`}
                    >
                      {TYPE_LABEL[row.type]}
                    </span>
                  </td>
                  <td className="p-3 text-xs text-textPrimary">{row.counterpartyName}</td>
                  <td className="p-3 font-mono text-xs text-textSecondary" dir="ltr">
                    {row.referenceNumber}
                  </td>
                  <td className="p-3 text-xs">
                    <span className={row.isOverdue ? "text-danger font-medium" : "text-textSecondary"}>
                      {row.dueDate ? new Date(row.dueDate).toLocaleDateString("fa-IR") : "—"}
                    </span>
                    {row.isOverdue && (
                      <AlertTriangle size={11} className="inline-block mr-1 text-danger" />
                    )}
                  </td>
                  <td className="p-3 font-mono text-xs font-semibold text-textPrimary" dir="ltr">
                    {fmt(row.amount)} {row.currencyCode ?? ""}
                  </td>
                  <td className="p-3 text-[11px] text-textSecondary">{STATUS_LABEL[row.status] ?? row.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
