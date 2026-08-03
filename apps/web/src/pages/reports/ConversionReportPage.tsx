import { useState } from "react";
import { useAuth } from "../../lib/auth-context";
import { hasPermission } from "../../lib/permissions";
import { Select } from "../../components/ui/fields";
import { DualDateInput } from "../../components/ui/DualDateInput";
import { usePartners } from "../partners/partners-api";
import { useColleagues } from "../users/users-api";
import { useConversionReport } from "./reports-api";

function SummaryTile({ label, value, tone }: { label: string; value: string | number; tone?: "success" | "danger" | "warning" }) {
  const toneClass = tone === "success" ? "text-success" : tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-textPrimary";
  return (
    <div className="rounded-lg p-3.5 bg-surface border border-border">
      <p className="text-[11px] text-textSecondary mb-1">{label}</p>
      <p className={`text-lg font-semibold ${toneClass}`} dir="ltr">
        {value}
      </p>
    </div>
  );
}

export function ConversionReportPage() {
  const { user } = useAuth();
  const canView = hasPermission(user, "reports.view_conversion");

  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [buyerId, setBuyerId] = useState("");
  const [salesExpertId, setSalesExpertId] = useState("");

  const { data: partners } = usePartners("", "all");
  const { data: colleagues } = useColleagues();
  const customers = (partners?.items ?? []).filter((p) => ["customer", "both"].includes(p.partnerType));

  const { data, isLoading, isError } = useConversionReport(
    {
      dateFrom: dateFrom ?? undefined,
      dateTo: dateTo ?? undefined,
      buyerId: buyerId || undefined,
      salesExpertId: salesExpertId || undefined,
    },
    canView,
  );

  if (!canView) {
    return <p className="text-xs text-textSecondary py-8 text-center">دسترسی به این بخش ندارید.</p>;
  }

  const overall = data?.overall;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-textPrimary">گزارش تبدیل استعلام به سفارش</h1>
        <p className="text-xs text-textSecondary mt-1">
          نرخ تبدیل = (برد کامل + برد جزئی) ÷ (برد کامل + باخت کامل + برد جزئی) — پرونده‌های در جریان/لغو‌شده/معلق در این نسبت شمرده نمی‌شن.
        </p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <DualDateInput value={dateFrom} onChange={setDateFrom} placeholder="از تاریخ شروع استعلام" />
        <DualDateInput value={dateTo} onChange={setDateTo} placeholder="تا تاریخ شروع استعلام" />
        <Select value={buyerId} onChange={(e) => setBuyerId(e.target.value)} className="w-44">
          <option value="">همه مشتری‌ها</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.companyName}
            </option>
          ))}
        </Select>
        <Select value={salesExpertId} onChange={(e) => setSalesExpertId(e.target.value)} className="w-44">
          <option value="">همه کارشناس‌ها</option>
          {(colleagues ?? []).map((e) => (
            <option key={e.id} value={e.id}>
              {e.fullName}
            </option>
          ))}
        </Select>
      </div>

      {isLoading && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}
      {isError && <p className="text-xs text-danger py-8 text-center">خطا در دریافت اطلاعات.</p>}

      {overall && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <SummaryTile label="کل استعلام‌ها" value={overall.total} />
            <SummaryTile label="برد کامل" value={overall.won} tone="success" />
            <SummaryTile label="برد جزئی" value={overall.partiallyWon} tone="success" />
            <SummaryTile label="باخت کامل" value={overall.lost} tone="danger" />
            <SummaryTile label="لغو شده" value={overall.cancelled} />
            <SummaryTile label="معلق" value={overall.suspended} tone="warning" />
            <SummaryTile label="در جریان" value={overall.inProgress} tone="warning" />
          </div>
          <div className="rounded-lg p-4 bg-accentSoft border border-border flex items-center justify-between">
            <span className="text-xs text-textPrimary font-medium">نرخ تبدیل کل</span>
            <span className="text-xl font-bold text-accent" dir="ltr">
              {overall.conversionRate != null ? `${overall.conversionRate.toFixed(1)}٪` : "—"}
            </span>
          </div>
        </>
      )}

      {!isLoading && !isError && (
        <div className="rounded-xl bg-surface border border-border shadow-card overflow-x-auto">
          <table className="w-full text-right min-w-[720px]">
            <thead>
              <tr className="border-b border-border bg-bg/60">
                <th className="p-3 text-[11px] font-medium text-textSecondary">کارشناس فروش</th>
                <th className="p-3 text-[11px] font-medium text-textSecondary">کل</th>
                <th className="p-3 text-[11px] font-medium text-textSecondary">برد کامل</th>
                <th className="p-3 text-[11px] font-medium text-textSecondary">برد جزئی</th>
                <th className="p-3 text-[11px] font-medium text-textSecondary">باخت کامل</th>
                <th className="p-3 text-[11px] font-medium text-textSecondary">در جریان</th>
                <th className="p-3 text-[11px] font-medium text-textSecondary">نرخ تبدیل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(data?.bySalesExpert.length ?? 0) === 0 && (
                <tr>
                  <td colSpan={7} className="p-10 text-center text-xs text-textSecondary">
                    داده‌ای یافت نشد.
                  </td>
                </tr>
              )}
              {data?.bySalesExpert.map((row) => (
                <tr key={row.salesExpertId}>
                  <td className="p-3 text-xs text-textPrimary">{row.salesExpertName}</td>
                  <td className="p-3 font-mono text-xs text-textPrimary" dir="ltr">{row.total}</td>
                  <td className="p-3 font-mono text-xs text-success" dir="ltr">{row.won}</td>
                  <td className="p-3 font-mono text-xs text-success" dir="ltr">{row.partiallyWon}</td>
                  <td className="p-3 font-mono text-xs text-danger" dir="ltr">{row.lost}</td>
                  <td className="p-3 font-mono text-xs text-warning" dir="ltr">{row.inProgress}</td>
                  <td className="p-3 font-mono text-xs font-semibold text-textPrimary" dir="ltr">
                    {row.conversionRate != null ? `${row.conversionRate.toFixed(1)}٪` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
