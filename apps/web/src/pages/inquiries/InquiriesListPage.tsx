import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  FileSearch,
  Filter,
  Flame,
  ListChecks,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { hasPermission } from "../../lib/permissions";
import { useDebounced } from "../../lib/use-debounced";
import { formatJalali, toLatinDigits } from "../../lib/jalali";
import { PrimaryButton, TextInput } from "../../components/ui/fields";
import { ActionPriority, INQUIRY_STATUS_META, InquiryListRow, InquiryStatus } from "./inquiry-types";
import { exportInquiries, useInquiries } from "./inquiries-api";

// فاز ۵۸ — وقتی stageLabel موجوده همیشه نمایش داده می‌شه (نه فقط برای in_progress)، چون
// پرونده‌های won/partially_won هم می‌تونن Activity باز داشته باشن (مثلاً «در انتظار صدور PO»)
export function StatusBadge({ status, stageLabel }: { status: InquiryStatus; stageLabel?: string | null }) {
  const meta = INQUIRY_STATUS_META[status];
  const label = stageLabel ?? meta.label;
  return (
    <span
      className={`inline-flex items-start gap-1 text-[10.5px] px-2.5 py-1 rounded-lg font-medium leading-snug ${meta.className}`}
    >
      <span className="w-1.5 h-1.5 mt-1 rounded-full bg-current opacity-70 shrink-0" />
      <span className="break-words">{label}</span>
    </span>
  );
}

// فاز ۵۸ — برچسب/رنگ اولویت Activity باز (همون توکن‌های رنگ INQUIRY_STATUS_META، برای هم‌خوانی بصری)
const ACTION_PRIORITY_META: Record<ActionPriority, { label: string; className: string }> = {
  urgent: { label: "فوری", className: "bg-[#F3E6E4] text-danger" },
  high: { label: "بالا", className: "bg-warningSoft text-warning" },
  normal: { label: "عادی", className: "bg-bg text-textSecondary" },
  low: { label: "کم", className: "bg-bg text-textSecondary/70" },
};

const PRIORITY_RANK: Record<string, number> = { urgent: 4, high: 3, normal: 2, low: 1 };

/**
 * مرتب‌سازی «نیاز به اقدام» — همون منطق چندکلیدی سرور (erp-database-design.md دامنه ۱۴):
 * فوری/عقب‌افتاده اول، بعد نزدیک‌ترین سررسید، بعد اولویت، بعد آخرین به‌روزرسانی. یک مقایسه‌گر
 * چندکلیدی جدا از sortValue تک‌کلیدی عمومی، چون در یک عدد ساده جا نمی‌شه.
 */
function compareByAction(a: InquiryListRow, b: InquiryListRow): number {
  const urgentA = a.actionOverdue || a.actionPriority === "urgent";
  const urgentB = b.actionOverdue || b.actionPriority === "urgent";
  if (urgentA !== urgentB) return urgentA ? -1 : 1;

  const dueA = a.actionDueAt ? new Date(a.actionDueAt).getTime() : Infinity;
  const dueB = b.actionDueAt ? new Date(b.actionDueAt).getTime() : Infinity;
  if (dueA !== dueB) return dueA - dueB;

  const rankA = PRIORITY_RANK[a.actionPriority ?? ""] ?? 0;
  const rankB = PRIORITY_RANK[b.actionPriority ?? ""] ?? 0;
  if (rankA !== rankB) return rankB - rankA;

  return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
}

function isSameLocalDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/** ستون «نیاز به اقدام» — عمداً پررنگ‌تر/برجسته‌تر از نشان مرحله، طبق الزام UX */
function ActionCell({ row }: { row: InquiryListRow }) {
  if (!row.actionRequired) {
    return <span className="text-xs text-textSecondary">—</span>;
  }
  const urgent = row.actionOverdue || row.actionPriority === "urgent";
  const Icon = row.actionOverdue ? AlertTriangle : row.actionPriority === "urgent" ? Flame : ListChecks;
  return (
    <div className="flex items-start gap-1.5 min-w-0">
      <Icon size={13} className={`shrink-0 mt-0.5 ${urgent ? "text-danger" : "text-textSecondary"}`} />
      <span
        className={`text-xs leading-snug break-words ${urgent ? "font-semibold text-danger" : "font-semibold text-textPrimary"}`}
        title={row.actionRequired}
      >
        {row.actionRequired}
      </span>
    </div>
  );
}

/** ستون «سررسید» — عقب‌افتاده/امروز همیشه با آیکون+متن مشخص می‌شن، نه فقط رنگ */
function DueCell({ row }: { row: InquiryListRow }) {
  const dueValue = row.actionDueAt ?? row.extendedOfferEndDate ?? row.offerEndDate;
  if (!dueValue) return <span className="text-xs text-textSecondary">—</span>;

  // نشان عقب‌افتاده/امروز فقط وقتی مبنای سررسید واقعاً actionDueAt (سررسید Activity باز)ه معنا داره —
  // برای fallback به مهلت پیشنهاد، سرور وضعیت عقب‌افتادگی رو ارزیابی نکرده
  const hasActionDue = !!row.actionDueAt;
  const overdue = hasActionDue && row.actionOverdue;
  const dueToday = hasActionDue && !overdue && isSameLocalDay(new Date(dueValue), new Date());

  return (
    <div className="whitespace-nowrap">
      <span className={`text-xs ${overdue ? "text-danger font-semibold" : dueToday ? "text-warning font-semibold" : "text-textSecondary"}`}>
        {formatJalali(dueValue)}
      </span>
      {overdue && (
        <span className="flex items-center gap-1 text-[10px] font-semibold text-danger mt-0.5">
          <AlertTriangle size={10} /> عقب‌افتاده
        </span>
      )}
      {dueToday && (
        <span className="flex items-center gap-1 text-[10px] font-semibold text-warning mt-0.5">
          <Clock size={10} /> امروز
        </span>
      )}
      {/* fallback به مهلت پیشنهاد (بدون Activity باز) — نگه‌داشتن نشان «تمدید شده» قبلی */}
      {!hasActionDue && row.extendedOfferEndDate && (
        <span className="block text-[10px] text-warning font-medium">تمدید شده</span>
      )}
    </div>
  );
}

function PriorityBadge({ priority }: { priority: ActionPriority | null }) {
  if (!priority) return <span className="text-xs text-textSecondary">—</span>;
  const meta = ACTION_PRIORITY_META[priority];
  return <span className={`inline-block text-[10.5px] px-2 py-0.5 rounded-lg font-medium ${meta.className}`}>{meta.label}</span>;
}

// ------------------------------------------------------------
// تعریف ستون‌های قابل مرتب‌سازی/فیلتر — هر ستون یک مقدار مرتب‌سازی (عدد/رشته/تاریخ) و
// یک فهرست «گزینه‌های موجود در این سلول» (برای فیلتر چندانتخابی مثل AutoFilter اکسل)
// از روی همون ردیف تولید می‌کنه. اکثر ستون‌ها یک گزینه به ازای هر ردیف دارن؛ ستون‌هایی
// که می‌تونن چند مقدار هم‌زمان داشته باشن (برندها، ارزش به چند ارز) چند گزینه برمی‌گردونن
// و ردیف با فیلتر مطابقت داره اگه *حداقل یکی* از گزینه‌هاش انتخاب شده باشه.
// ------------------------------------------------------------
type ColumnKey =
  | "internalNumber"
  | "subject"
  | "buyer"
  | "action"
  | "status"
  | "assignee"
  | "deadline"
  | "priority"
  | "createdAt";

const COLUMN_LABEL: Record<ColumnKey, string> = {
  internalNumber: "شماره داخلی",
  subject: "موضوع",
  buyer: "مشتری",
  action: "نیاز به اقدام",
  status: "مرحله",
  assignee: "مسئول فعلی",
  deadline: "سررسید",
  priority: "اولویت",
  createdAt: "ثبت",
};

// فاز ۵۸ — itemCount/brands/saleValue (کم‌کاربردترین ستون‌ها برای تصمیم عملیاتی «چه کاری
// الان لازمه») از نمای پیش‌فرض لیست حذف شدن تا ستون‌های اقدام/مسئول/سررسید/اولویت جا باز کنن؛
// این داده‌ها همچنان در صفحه جزئیات پرونده در دسترسن.
const ALL_COLUMNS: ColumnKey[] = [
  "internalNumber",
  "subject",
  "buyer",
  "action",
  "status",
  "assignee",
  "deadline",
  "priority",
  "createdAt",
];

function sortValue(row: InquiryListRow, key: ColumnKey): string | number {
  switch (key) {
    case "internalNumber":
      return row.internalNumber;
    case "subject":
      return row.subject;
    case "buyer":
      return row.buyer.companyName;
    case "action":
      // مرتب‌سازی واقعی این ستون چندکلیدیه و در useMemo با compareByAction انجام می‌شه؛
      // این مقدار فقط برای کامل بودن نوع لازمه، در عمل مصرف نمی‌شه
      return row.actionRequired ?? "";
    case "status":
      return INQUIRY_STATUS_META[row.status].label;
    case "assignee":
      return row.actionAssignee?.fullName ?? row.salesExpert.fullName;
    case "deadline":
      return new Date(row.actionDueAt ?? row.extendedOfferEndDate ?? row.offerEndDate).getTime();
    case "priority":
      return PRIORITY_RANK[row.actionPriority ?? ""] ?? 0;
    case "createdAt":
      return new Date(row.createdAt).getTime();
  }
}

// فهرست گزینه‌های موجود در سلول این ستون برای همین ردیف — پایه فیلتر چندانتخابی
function columnOptions(row: InquiryListRow, key: ColumnKey): string[] {
  switch (key) {
    case "internalNumber":
      return [row.internalNumber];
    case "subject":
      return [row.subject];
    case "buyer":
      return [row.buyer.companyName];
    case "action":
      return [row.actionRequired ?? "(بدون اقدام باز)"];
    case "status":
      return [INQUIRY_STATUS_META[row.status].label];
    case "assignee":
      return [row.actionAssignee?.fullName ?? row.salesExpert.fullName];
    case "deadline":
      return [formatJalali(row.actionDueAt ?? row.extendedOfferEndDate ?? row.offerEndDate)];
    case "priority":
      return [row.actionPriority ? ACTION_PRIORITY_META[row.actionPriority].label : "(بدون اولویت)"];
    case "createdAt":
      return [formatJalali(row.createdAt)];
  }
}

// filterSet===null یعنی فیلتری روی این ستون فعال نیست (همه رد می‌شن)؛ Set خالی یعنی
// کاربر صراحتاً هیچ گزینه‌ای رو تیک نزده (هیچ ردیفی رد نمی‌شه) — دقیقاً رفتار AutoFilter اکسل
function rowPassesColumn(row: InquiryListRow, key: ColumnKey, filterSet: Set<string> | null): boolean {
  if (filterSet === null) return true;
  return columnOptions(row, key).some((opt) => filterSet.has(opt));
}

function SortHeader({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 text-[11px] font-medium transition-colors duration-150 shrink-0 ${
        active ? "text-primary" : "text-textSecondary hover:text-textPrimary"
      }`}
    >
      {label}
      {active && (dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
    </button>
  );
}

// دراپ‌داون فیلتر چندانتخابی هر ستون — چک‌باکس به‌ازای هر مقدار موجود (با شمارش)، جعبه
// جستجوی داخلی برای فهرست‌های بلند، و «انتخاب همه»/«پاک کردن»؛ دقیقاً الگوی AutoFilter اکسل
function ColumnFilterMenu({
  columnKey,
  sourceRows,
  colFilters,
  filterValue,
  onChange,
}: {
  columnKey: ColumnKey;
  sourceRows: InquiryListRow[];
  colFilters: Record<ColumnKey, Set<string> | null>;
  filterValue: Set<string> | null;
  onChange: (next: Set<string> | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  // فهرست گزینه‌ها بر مبنای ردیف‌هایی که از فیلترهای *سایر* ستون‌ها عبور کردن (Cascading —
  // دقیقاً رفتار اکسل: گزینه‌های یک ستون بسته به انتخاب‌های ستون‌های دیگه به‌روز می‌شن)
  const options = useMemo(() => {
    if (!open) return [] as { value: string; count: number }[];
    const rowsForOptions = sourceRows.filter((row) =>
      ALL_COLUMNS.filter((k) => k !== columnKey).every((k) => rowPassesColumn(row, k, colFilters[k])),
    );
    const counts = new Map<string, number>();
    rowsForOptions.forEach((row) => {
      columnOptions(row, columnKey).forEach((v) => counts.set(v, (counts.get(v) ?? 0) + 1));
    });
    return [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => a.value.localeCompare(b.value, "fa", { numeric: true }));
  }, [open, sourceRows, colFilters, columnKey]);

  const filteredOptions = useMemo(() => {
    const q = toLatinDigits(search.trim()).toLowerCase();
    if (!q) return options;
    return options.filter((o) => toLatinDigits(o.value).toLowerCase().includes(q));
  }, [options, search]);

  const isChecked = (value: string) => filterValue === null || filterValue.has(value);

  function toggleValue(value: string) {
    if (filterValue === null) {
      const next = new Set(options.map((o) => o.value));
      next.delete(value);
      onChange(next);
    } else {
      const next = new Set(filterValue);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      onChange(next);
    }
  }

  const active = filterValue !== null;

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`p-0.5 rounded transition-colors duration-150 ${
          active ? "text-primary" : "text-textSecondary/60 hover:text-textSecondary"
        }`}
        aria-label={`فیلتر ${COLUMN_LABEL[columnKey]}`}
      >
        <Filter size={11} fill={active ? "currentColor" : "none"} />
      </button>
      {open && (
        <div
          className="absolute z-20 top-full mt-1 right-0 w-56 rounded-lg border border-border bg-surface shadow-lg p-2 space-y-2"
          onClick={(e) => e.stopPropagation()}
        >
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جستجو در مقادیر..."
            className="w-full text-[11px] px-2 py-1 rounded-md border border-border bg-bg focus:outline-none focus:border-primary"
          />
          <div className="flex items-center gap-2 text-[10.5px]">
            <button className="text-primary hover:underline" onClick={() => onChange(null)}>
              انتخاب همه
            </button>
            <button className="text-textSecondary hover:underline" onClick={() => onChange(new Set())}>
              پاک کردن
            </button>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-0.5 border-t border-border pt-1.5">
            {filteredOptions.length === 0 && (
              <p className="text-[10.5px] text-textSecondary text-center py-2">موردی یافت نشد</p>
            )}
            {filteredOptions.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-1.5 text-[11px] text-textPrimary px-1 py-1 rounded hover:bg-bg cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={isChecked(opt.value)}
                  onChange={() => toggleValue(opt.value)}
                  className="shrink-0"
                />
                <span className="truncate flex-1" title={opt.value}>{opt.value}</span>
                <span className="text-textSecondary/70 shrink-0">{opt.count}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function emptyColFilters(): Record<ColumnKey, Set<string> | null> {
  return {
    internalNumber: null,
    subject: null,
    buyer: null,
    action: null,
    status: null,
    assignee: null,
    deadline: null,
    priority: null,
    createdAt: null,
  };
}

export function InquiriesListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreate = hasPermission(user, "inquiry.create");
  const canPurge = hasPermission(user, "inquiry.purge");

  // فاز ۵۸ — پیش‌فرض حالا «نیاز به اقدام» (فوری/عقب‌افتاده اول) به‌جای تاریخ ثبت؛ کلیک روی
  // هدر ستون «ثبت» همچنان مرتب‌سازی زمانی جایگزین رو در دسترس نگه می‌داره
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<ColumnKey>("action");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [colFilters, setColFilters] = useState<Record<ColumnKey, Set<string> | null>>(emptyColFilters());
  const [exporting, setExporting] = useState(false);

  // دیبانس کوتاه — نتیجه عملاً با هر حرف تایپ/حذف‌شده به‌روز می‌شه، بدون شلیک یک درخواست به‌ازای هر keystroke
  const debouncedQuery = useDebounced(query, 200);
  // فاز ۵۸ — sortBy=action مبنای واکشی سرور (سقف امنیتی ۲۰۰۰ ردیف مرتب‌شده)؛ ترتیب واقعی
  // نمایش‌شده همچنان با مرتب‌سازی کلاینت (rows زیر) تعیین می‌شه
  const { data, isLoading, isError } = useInquiries({ q: debouncedQuery, sortBy: "action" });

  function toggleSort(key: ColumnKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  function setColFilter(key: ColumnKey, value: Set<string> | null) {
    setColFilters((prev) => ({ ...prev, [key]: value }));
  }

  const hasActiveColFilters = Object.values(colFilters).some((v) => v !== null);

  const sourceRows = data?.items ?? [];

  const rows = useMemo(() => {
    const filtered = sourceRows.filter((row) => ALL_COLUMNS.every((key) => rowPassesColumn(row, key, colFilters[key])));
    // ستون «نیاز به اقدام» چندکلیدیه (نگاه کنید به compareByAction) — نمی‌شه با sortValue تک‌عددی بیان کرد
    if (sortKey === "action") {
      const sorted = [...filtered].sort(compareByAction);
      return sortDir === "asc" ? sorted : sorted.reverse();
    }
    return [...filtered].sort((a, b) => {
      const av = sortValue(a, sortKey);
      const bv = sortValue(b, sortKey);
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av).localeCompare(String(bv), "fa");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [sourceRows, colFilters, sortKey, sortDir]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-textSecondary">
          {data ? (
            <>
              <span className="font-semibold text-textPrimary">{rows.length}</span>
              {hasActiveColFilters || rows.length !== data.total ? <> از {data.total}</> : null} پرونده استعلام
            </>
          ) : (
            ""
          )}
        </p>
        <div className="flex gap-2">
          {hasActiveColFilters && (
            <button
              onClick={() => setColFilters(emptyColFilters())}
              className="flex items-center gap-1.5 text-xs px-3.5 py-2.5 rounded-lg text-textSecondary border border-border transition-all duration-150 hover:text-textPrimary hover:border-textSecondary/40 hover:bg-bg"
            >
              پاک کردن فیلترها
            </button>
          )}
          <button
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                await exportInquiries({ q: debouncedQuery || undefined });
              } finally {
                setExporting(false);
              }
            }}
            className="flex items-center gap-1.5 text-xs px-3.5 py-2.5 rounded-lg text-textSecondary border border-border transition-all duration-150 hover:text-textPrimary hover:border-textSecondary/40 hover:bg-bg disabled:opacity-60"
          >
            <Download size={13} /> {exporting ? "در حال آماده‌سازی..." : "خروجی اکسل"}
          </button>
          {canPurge && (
            <button
              onClick={() => navigate("/inquiries/deleted")}
              className="flex items-center gap-1.5 text-xs px-3.5 py-2.5 rounded-lg text-textSecondary border border-border transition-all duration-150 hover:text-textPrimary hover:border-textSecondary/40 hover:bg-bg"
            >
              <Trash2 size={13} /> سطل حذف‌شده‌ها
            </button>
          )}
          {canCreate && (
            <PrimaryButton onClick={() => navigate("/inquiries/new")}>
              <span className="flex items-center gap-1.5"><Plus size={14} /> استعلام جدید</span>
            </PrimaryButton>
          )}
        </div>
      </div>

      <div className="p-3.5 rounded-xl bg-surface border border-border shadow-card">
        <div className="relative">
          <Search size={15} className="absolute top-1/2 -translate-y-1/2 right-3 text-textSecondary" />
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجو در شماره، موضوع، مشتری، کارشناس، کالا، پارت‌نامبر، برند..."
            className="pr-9"
          />
        </div>
      </div>

      {isLoading && (
        <div className="rounded-xl bg-surface border border-border shadow-card overflow-hidden">
          <div className="p-3 space-y-2">
            {[0, 1, 2, 3, 5].map((i) => (
              <div key={i} className="h-11 rounded-lg skeleton" />
            ))}
          </div>
        </div>
      )}
      {isError && (
        <div className="rounded-xl bg-surface border border-border shadow-card py-10 text-center">
          <p className="text-xs text-danger">خطا در دریافت اطلاعات — اتصال به سرور رو بررسی کنید.</p>
        </div>
      )}

      {!isLoading && !isError && (
        <div className="rounded-xl bg-surface border border-border shadow-card overflow-x-auto">
          <table className="w-full text-right table-fixed min-w-[1250px]">
            <thead>
              <tr className="border-b border-border bg-bg/60">
                {ALL_COLUMNS.map((key) => (
                  <th
                    key={key}
                    className={`px-3 py-2.5 align-bottom ${
                      key === "internalNumber"
                        ? "w-[120px]"
                        : key === "subject"
                          ? "w-[170px]"
                          : key === "buyer"
                            ? "w-[110px]"
                            : key === "status"
                              ? "w-[110px]"
                              : key === "assignee"
                                ? "w-[100px]"
                                : key === "deadline"
                                  ? "w-[110px]"
                                  : key === "priority"
                                    ? "w-[75px]"
                                    : key === "createdAt"
                                      ? "w-[90px]"
                                      : "" /* action: باقی‌ماندهٔ فضا، بیشترین اولویت نمایشی */
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1">
                      <SortHeader label={COLUMN_LABEL[key]} active={sortKey === key} dir={sortDir} onClick={() => toggleSort(key)} />
                      <ColumnFilterMenu
                        columnKey={key}
                        sourceRows={sourceRows}
                        colFilters={colFilters}
                        filterValue={colFilters[key]}
                        onChange={(next) => setColFilter(key, next)}
                      />
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-14 text-center">
                    <div className="w-12 h-12 rounded-full bg-bg flex items-center justify-center mx-auto mb-3">
                      <FileSearch size={20} className="text-textSecondary" />
                    </div>
                    <p className="text-xs text-textSecondary">پرونده‌ای یافت نشد.</p>
                    <p className="text-[11px] text-textSecondary/70 mt-1">جستجو/فیلتر رو تغییر بده یا یک استعلام جدید ثبت کن.</p>
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                // فاز ۵۸ — تمایز بصری ردیف‌های عقب‌افتاده، مکمل نشان آیکون+متن ستون سررسید
                // (نه فقط رنگ — طبق الزام UX، رنگ ردیف صرفاً یک لایه‌ی اضافیه)
                return (
                  <tr
                    key={row.id}
                    onClick={() => navigate(`/inquiries/${row.id}`)}
                    className={`cursor-pointer transition-colors duration-150 ${
                      row.actionOverdue ? "bg-[#F3E6E4]/50 hover:bg-[#F3E6E4]/70" : "hover:bg-bg"
                    }`}
                  >
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-1 min-w-0">
                        {row.actionOverdue && <AlertTriangle size={11} className="text-danger shrink-0" />}
                        <span className="block truncate text-xs font-mono text-primary font-medium" dir="ltr" title={row.internalNumber}>
                          {row.internalNumber}
                        </span>
                      </span>
                      {row.inquiryNumber && (
                        <span className="block truncate text-[10px] text-textSecondary font-mono" dir="ltr" title={row.inquiryNumber}>
                          {row.inquiryNumber}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-textPrimary">
                      <span className="flex items-center gap-1.5 min-w-0">
                        {row.urgency === "urgent" && <Flame size={12} className="text-danger shrink-0" />}
                        <span className="truncate min-w-0" title={row.subject}>{row.subject}</span>
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-textPrimary">
                      <span className="block truncate" title={row.buyer.companyName}>{row.buyer.companyName}</span>
                    </td>
                    {/* فاز ۵۸ — «نیاز به اقدام»: عمداً پررنگ‌تر از نشان مرحله، طبق الزام UX */}
                    <td className="px-3 py-2"><ActionCell row={row} /></td>
                    <td className="px-3 py-2"><StatusBadge status={row.status} stageLabel={row.stageLabel} /></td>
                    <td className="px-3 py-2 text-xs text-textSecondary">
                      <span
                        className="block truncate"
                        title={row.actionAssignee?.fullName ?? row.salesExpert.fullName}
                      >
                        {row.actionAssignee?.fullName ?? row.salesExpert.fullName}
                      </span>
                    </td>
                    <td className="px-3 py-2"><DueCell row={row} /></td>
                    <td className="px-3 py-2"><PriorityBadge priority={row.actionPriority} /></td>
                    <td className="px-3 py-2 text-xs text-textSecondary whitespace-nowrap">{formatJalali(row.createdAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
