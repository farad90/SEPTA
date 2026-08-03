import { useState } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { hasPermission } from "../../lib/permissions";
import { Select } from "../../components/ui/fields";
import { DualDateInput } from "../../components/ui/DualDateInput";
import { usePartners } from "../partners/partners-api";
import { useColleagues } from "../users/users-api";
import { useOrdersPnlReport } from "./reports-api";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

export function OrdersPnlReportPage() {
  const { user } = useAuth();
  const canView = hasPermission(user, "reports.view_orders_pnl");

  const [dateFrom, setDateFrom] = useState<string | null>(null);
  const [dateTo, setDateTo] = useState<string | null>(null);
  const [buyerId, setBuyerId] = useState("");
  const [salesExpertId, setSalesExpertId] = useState("");

  const { data: partners } = usePartners("", "all");
  const { data: colleagues } = useColleagues();
  const customers = (partners?.items ?? []).filter((p) => ["customer", "both"].includes(p.partnerType));

  const { data, isLoading, isError } = useOrdersPnlReport(
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

  const rows = data?.items ?? [];
  const currencyEntries = Object.entries(data?.totalsByCurrency ?? {});

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold text-textPrimary">گزارش سفارشات و سود و زیان</h1>
        <p className="text-xs text-textSecondary mt-1">
          مبالغ همیشه به تفکیک ارز نمایش داده می‌شن — بدون تبدیل و جمع بین ارزهای مختلف.
        </p>
      </div>

      <div className="flex gap-3 flex-wrap">
        <DualDateInput value={dateFrom} onChange={setDateFrom} placeholder="از تاریخ قرارداد" />
        <DualDateInput value={dateTo} onChange={setDateTo} placeholder="تا تاریخ قرارداد" />
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

      {currencyEntries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {currencyEntries.map(([currency, totals]) => (
            <div key={currency} className="rounded-lg p-3.5 bg-surface border border-border">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-textPrimary" dir="ltr">
                  {currency}
                </span>
                <span
                  className={`flex items-center gap-1 text-[11px] font-medium ${totals.margin >= 0 ? "text-success" : "text-danger"}`}
                >
                  {totals.margin >= 0 ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  سود {fmt(totals.margin)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-textSecondary">
                <span>خرید: {fmt(totals.totalPurchase)}</span>
                <span>فروش: {fmt(totals.totalSale)}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {isLoading && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}
      {isError && <p className="text-xs text-danger py-8 text-center">خطا در دریافت اطلاعات.</p>}

      {!isLoading && !isError && (
        <div className="rounded-xl bg-surface border border-border shadow-card overflow-x-auto">
          <table className="w-full text-right min-w-[820px]">
            <thead>
              <tr className="border-b border-border bg-bg/60">
                <th className="p-3 text-[11px] font-medium text-textSecondary">شماره سفارش</th>
                <th className="p-3 text-[11px] font-medium text-textSecondary">شماره استعلام</th>
                <th className="p-3 text-[11px] font-medium text-textSecondary">مشتری</th>
                <th className="p-3 text-[11px] font-medium text-textSecondary">کارشناس فروش</th>
                <th className="p-3 text-[11px] font-medium text-textSecondary">تاریخ قرارداد</th>
                <th className="p-3 text-[11px] font-medium text-textSecondary">خرید</th>
                <th className="p-3 text-[11px] font-medium text-textSecondary">فروش</th>
                <th className="p-3 text-[11px] font-medium text-textSecondary">سود</th>
                <th className="p-3 text-[11px] font-medium text-textSecondary">درصد سود</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-xs text-textSecondary">
                    سفارشی یافت نشد.
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.orderId}>
                  <td className="p-3 font-mono text-xs text-textPrimary" dir="ltr">
                    {row.orderNumber}
                  </td>
                  <td className="p-3 font-mono text-xs text-textSecondary" dir="ltr">
                    {row.inquiryInternalNumber}
                  </td>
                  <td className="p-3 text-xs text-textPrimary">{row.buyerName}</td>
                  <td className="p-3 text-xs text-textPrimary">{row.salesExpertName}</td>
                  <td className="p-3 text-xs text-textSecondary">
                    {row.contractDate ? new Date(row.contractDate).toLocaleDateString("fa-IR") : "—"}
                  </td>
                  <td className="p-3 font-mono text-xs text-textPrimary" dir="ltr">
                    {fmt(row.totalPurchase)} {row.currencyCode ?? ""}
                  </td>
                  <td className="p-3 font-mono text-xs text-textPrimary" dir="ltr">
                    {fmt(row.totalSale)} {row.currencyCode ?? ""}
                  </td>
                  <td
                    className={`p-3 font-mono text-xs font-semibold ${row.margin >= 0 ? "text-success" : "text-danger"}`}
                    dir="ltr"
                  >
                    {fmt(row.margin)} {row.currencyCode ?? ""}
                  </td>
                  <td className="p-3 font-mono text-xs text-textSecondary" dir="ltr">
                    {row.marginPercent != null ? `${fmt(row.marginPercent)}٪` : "—"}
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
