import { AlertTriangle, ArrowLeftRight, CircleCheck, Inbox, PieChart, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../lib/auth-context";
import { hasPermission } from "../../lib/permissions";
import { startOfJalaliYearIso } from "../../lib/jalali";
import {
  useConversionReport,
  useOrdersPnlReport,
  useOwnSalesSummary,
  usePaymentsReport,
  useRfqResponseRate,
} from "../reports/reports-api";
import {
  BarsChartSkeleton,
  HorizontalBars,
  KpiTile,
  KpiTileSkeleton,
  ProgressRing,
  RingChartSkeleton,
} from "../../components/charts/MiniCharts";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

function currentMonthRange(): { dateFrom: string; dateTo: string } {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1);
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  return { dateFrom: toIso(first), dateTo: toIso(last) };
}

function ChartCard({
  title,
  icon,
  linkTo,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  linkTo?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl p-5 bg-surface border border-border shadow-card transition-all duration-150 hover:shadow-card-hover">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <span className="w-7 h-7 rounded-lg bg-accentSoft text-accent flex items-center justify-center shrink-0">
            {icon}
          </span>
          <p className="text-sm font-bold text-textPrimary tracking-tight">{title}</p>
        </div>
        {linkTo && (
          <Link
            to={linkTo}
            className="text-[11px] text-textSecondary transition-colors duration-150 hover:text-primary shrink-0"
          >
            گزارش کامل ←
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}

/** حالت خالی هم‌الگوی InquiriesListPage — آیکون + متن، به‌جای فقط یک خط متن خاکستری */
function EmptyState({ message }: { message: string }) {
  return (
    <div className="py-6 text-center">
      <div className="w-9 h-9 rounded-full bg-bg flex items-center justify-center mx-auto mb-2.5">
        <Inbox size={16} className="text-textSecondary" />
      </div>
      <p className="text-xs text-textSecondary">{message}</p>
    </div>
  );
}

/** تبدیل استعلام به سفارش — برای کسی که سود‌وزیان کامل رو نمی‌بینه (مثلاً فروش)، فقط پرونده‌های خودش */
function ConversionWidget({ ownScoped, userId }: { ownScoped: boolean; userId?: string }) {
  const { data, isLoading } = useConversionReport(
    ownScoped && userId ? { salesExpertId: userId } : {},
    true,
  );
  const overall = data?.overall;

  return (
    <ChartCard title="تبدیل استعلام به سفارش" icon={<PieChart size={14} />} linkTo="/reports/conversion">
      {isLoading || !overall ? (
        <RingChartSkeleton />
      ) : (
        <div className="flex items-center gap-5">
          <ProgressRing
            value={overall.conversionRate}
            label="نرخ تبدیل"
            tone={
              overall.conversionRate == null
                ? "textSecondary"
                : overall.conversionRate >= 50
                  ? "success"
                  : overall.conversionRate >= 25
                    ? "warning"
                    : "danger"
            }
          />
          <div className="flex-1 min-w-0">
            <HorizontalBars
              dense
              items={[
                { label: "برد کامل", value: overall.won, tone: "success" },
                { label: "برد جزئی", value: overall.partiallyWon, tone: "success" },
                { label: "باخت کامل", value: overall.lost, tone: "danger" },
                { label: "در جریان", value: overall.inProgress, tone: "warning" },
              ]}
            />
          </div>
        </div>
      )}
    </ChartCard>
  );
}

function OrdersPnlWidget() {
  const { data, isLoading } = useOrdersPnlReport({}, true);
  const currencyEntries = Object.entries(data?.totalsByCurrency ?? {}).slice(0, 3);

  return (
    <ChartCard title="سود و زیان سفارشات" icon={<Wallet size={14} />} linkTo="/reports/orders-pnl">
      {isLoading ? (
        <BarsChartSkeleton rows={2} />
      ) : currencyEntries.length === 0 ? (
        <EmptyState message="سفارش تسویه‌شده‌ای برای نمایش وجود ندارد." />
      ) : (
        <div className="space-y-4">
          {currencyEntries.map(([currency, totals]) => (
            <div key={currency}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-textPrimary" dir="ltr">
                  {currency}
                </span>
                <span
                  className={`flex items-center gap-1 text-[11px] font-medium ${
                    totals.margin >= 0 ? "text-success" : "text-danger"
                  }`}
                  dir="ltr"
                >
                  {totals.margin >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {fmt(totals.margin)}
                </span>
              </div>
              <HorizontalBars
                dense
                items={[
                  { label: "خرید", value: totals.totalPurchase, tone: "textSecondary" },
                  { label: "فروش", value: totals.totalSale, tone: "accent" },
                ]}
              />
            </div>
          ))}
        </div>
      )}
    </ChartCard>
  );
}

/** پرداختی/دریافتی داشبورد همیشه محدود به «این ماه»ه — گزارش کامل بدون این فیلتر باز می‌مونه */
function PaymentsThisMonthWidget() {
  const { dateFrom, dateTo } = currentMonthRange();
  const { data, isLoading } = usePaymentsReport({ dateFrom, dateTo }, true);
  const currencyEntries = Object.entries(data?.totalsByCurrency ?? {}).slice(0, 2);
  const overdueCount = (data?.items ?? []).filter((i) => i.isOverdue).length;

  return (
    <ChartCard title="پرداختی‌ها و دریافتی‌های این ماه" icon={<ArrowLeftRight size={14} />} linkTo="/reports/payments">
      {isLoading ? (
        <BarsChartSkeleton rows={2} />
      ) : currencyEntries.length === 0 ? (
        <EmptyState message="برای این ماه داده‌ای ثبت نشده." />
      ) : (
        <div className="space-y-4">
          {overdueCount > 0 && (
            <div className="flex items-center gap-2 rounded-lg px-3 py-2 bg-warningSoft text-warning text-[11px] font-medium">
              <AlertTriangle size={13} />
              {overdueCount} مورد پرداخت/دریافت معوق
            </div>
          )}
          {currencyEntries.map(([currency, totals]) => (
            <div key={currency}>
              <p className="text-xs font-semibold text-textPrimary mb-1.5" dir="ltr">
                {currency}
              </p>
              <HorizontalBars
                dense
                items={[
                  { label: "دریافتنی پرداخت‌نشده", value: totals.receivableUnpaid, tone: "warning" },
                  { label: "دریافتنی وصول‌شده", value: totals.receivablePaid, tone: "success" },
                  { label: "پرداختنی پرداخت‌نشده", value: totals.payableUnpaid, tone: "danger" },
                  { label: "پرداختنی تسویه‌شده", value: totals.payablePaid, tone: "textSecondary" },
                ]}
              />
            </div>
          ))}
        </div>
      )}
    </ChartCard>
  );
}

function RfqResponseRateWidget() {
  const { data, isLoading } = useRfqResponseRate(true);

  return (
    <ChartCard title="نرخ پاسخ‌دهی تأمین‌کنندگان" icon={<CircleCheck size={14} />}>
      {isLoading || !data ? (
        <RingChartSkeleton />
      ) : data.total === 0 ? (
        <EmptyState message="هنوز استعلام قیمتی از تأمین‌کننده ثبت نشده." />
      ) : (
        <div className="flex items-center gap-5">
          <ProgressRing
            value={data.responseRate}
            label="نرخ موفقیت"
            tone={
              data.responseRate == null
                ? "textSecondary"
                : data.responseRate >= 50
                  ? "success"
                  : data.responseRate >= 25
                    ? "warning"
                    : "danger"
            }
          />
          <div className="flex-1 min-w-0">
            <HorizontalBars
              dense
              items={[
                { label: "قیمت گرفته شد", value: data.offerReceived, tone: "success" },
                { label: "سوال فنی مطرح شد", value: data.technicalQuestion, tone: "warning" },
                { label: "بی‌پاسخ ماند", value: data.noResponse, tone: "danger" },
                { label: "در انتظار پاسخ", value: data.awaitingResponse, tone: "textSecondary" },
              ]}
            />
          </div>
        </div>
      )}
    </ChartCard>
  );
}

function KpiRow({ canPnl, canOwnSales }: { canPnl: boolean; canOwnSales: boolean }) {
  const yearStart = startOfJalaliYearIso();
  const { data: pnl, isLoading: pnlLoading } = useOrdersPnlReport(canPnl ? { dateFrom: yearStart } : {}, canPnl);
  const { data: ownSales, isLoading: ownSalesLoading } = useOwnSalesSummary(canOwnSales);

  const tiles: React.ReactNode[] = [];

  if (canPnl) {
    if (pnlLoading) {
      tiles.push(<KpiTileSkeleton key="annual-total" />);
    } else {
      const total = Object.entries(pnl?.totalsByCurrency ?? {})[0];
      tiles.push(
        <KpiTile
          key="annual-total"
          label={total ? `مبلغ کل فروش امسال (${total[0]})` : "مبلغ کل فروش امسال"}
          value={total ? fmt(total[1].totalSale) : "—"}
          tone="accent"
          icon={<Wallet size={15} />}
        />,
      );
    }
  }

  if (canOwnSales) {
    if (ownSalesLoading) {
      tiles.push(<KpiTileSkeleton key="own-annual-total" />);
    } else {
      const total = Object.entries(ownSales?.totalsByCurrency ?? {})[0];
      tiles.push(
        <KpiTile
          key="own-annual-total"
          label={total ? `مبلغ سفارشات من امسال (${total[0]})` : "مبلغ سفارشات من امسال"}
          value={total ? fmt(total[1]) : "—"}
          tone="accent"
          icon={<Wallet size={15} />}
        />,
      );
    }
  }

  if (tiles.length === 0) return null;

  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{tiles}</div>;
}

/** بخش نمودارها/گزارش‌های داشبورد — چیدمان بر اساس مجوزهای واقعی کاربر، نه نام گروه دسترسی */
export function ReportsOverviewSection() {
  const { user } = useAuth();
  const canConversion = hasPermission(user, "reports.view_conversion");
  const canPnl = hasPermission(user, "reports.view_orders_pnl");
  const canPayments = hasPermission(user, "reports.view_payments");
  const canOwnSales = hasPermission(user, "reports.view_own_sales_summary");
  const canRfqRate = hasPermission(user, "reports.view_rfq_response_rate");

  if (!canConversion && !canPnl && !canPayments && !canOwnSales && !canRfqRate) {
    return null;
  }

  // کسی که دید کامل سود‌وزیان نداره (مثلاً فروش)، نمودار تبدیل استعلام هم فقط پرونده‌های خودشو می‌بینه
  const ownScopedConversion = canConversion && !canPnl;
  // مدیریت/مالی که خودشون KPI «مبلغ کل» رو می‌بینن، نیازی به کارت تکراری/احتمالاً-خالی «سفارشات من» ندارن
  const showOwnSalesTile = canOwnSales && !canPnl;

  return (
    <div className="space-y-4">
      <KpiRow canPnl={canPnl} canOwnSales={showOwnSalesTile} />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {canConversion && <ConversionWidget ownScoped={ownScopedConversion} userId={user?.id} />}
        {canPnl && <OrdersPnlWidget />}
        {canPayments && <PaymentsThisMonthWidget />}
        {canRfqRate && <RfqResponseRateWidget />}
      </div>
    </div>
  );
}
