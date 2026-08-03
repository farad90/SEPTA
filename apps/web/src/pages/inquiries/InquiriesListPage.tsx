import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronUp, Download, FileSearch, Filter, Flame, Plus, Search, Trash2 } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { hasPermission } from "../../lib/permissions";
import { useDebounced } from "../../lib/use-debounced";
import { formatJalali, toLatinDigits } from "../../lib/jalali";
import { PrimaryButton, TextInput } from "../../components/ui/fields";
import { INQUIRY_STATUS_META, InquiryListRow, InquiryStatus } from "./inquiry-types";
import { exportInquiries, useInquiries } from "./inquiries-api";

export function StatusBadge({ status, stageLabel }: { status: InquiryStatus; stageLabel?: string | null }) {
  const meta = INQUIRY_STATUS_META[status];
  const label = status === "in_progress" && stageLabel ? stageLabel : meta.label;
  return (
    <span
      className={`inline-flex items-start gap-1 text-[10.5px] px-2.5 py-1 rounded-lg font-medium leading-snug ${meta.className}`}
    >
      <span className="w-1.5 h-1.5 mt-1 rounded-full bg-current opacity-70 shrink-0" />
      <span className="break-words">{label}</span>
    </span>
  );
}

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

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
  | "salesExpert"
  | "itemCount"
  | "brands"
  | "saleValue"
  | "deadline"
  | "status"
  | "createdAt";

const COLUMN_LABEL: Record<ColumnKey, string> = {
  internalNumber: "شماره داخلی",
  subject: "موضوع",
  buyer: "مشتری",
  salesExpert: "کارشناس",
  itemCount: "اقلام",
  brands: "برندها",
  saleValue: "ارزش کل (فروش)",
  deadline: "مهلت پیشنهاد",
  status: "وضعیت",
  createdAt: "ثبت",
};

const ALL_COLUMNS: ColumnKey[] = [
  "internalNumber",
  "subject",
  "buyer",
  "salesExpert",
  "itemCount",
  "brands",
  "saleValue",
  "deadline",
  "status",
  "createdAt",
];

function saleValueText(row: InquiryListRow): string {
  return Object.entries(row.saleValueByCurrency)
    .map(([currency, amount]) => `${fmt(amount)} ${currency}`)
    .join("، ");
}

function sortValue(row: InquiryListRow, key: ColumnKey): string | number {
  switch (key) {
    case "internalNumber":
      return row.internalNumber;
    case "subject":
      return row.subject;
    case "buyer":
      return row.buyer.companyName;
    case "salesExpert":
      return row.salesExpert.fullName;
    case "itemCount":
      return row._count.items;
    case "brands":
      return row.builders[0] ?? "";
    case "saleValue":
      return Object.values(row.saleValueByCurrency).reduce((a, b) => a + b, 0);
    case "deadline":
      return new Date(row.extendedOfferEndDate ?? row.offerEndDate).getTime();
    case "status":
      return INQUIRY_STATUS_META[row.status].label;
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
    case "salesExpert":
      return [row.salesExpert.fullName];
    case "itemCount":
      return [String(row._count.items)];
    case "brands":
      return row.builders.length > 0 ? row.builders : ["(بدون برند)"];
    case "saleValue": {
      const entries = Object.entries(row.saleValueByCurrency);
      return entries.length > 0 ? entries.map(([currency, amount]) => `${fmt(amount)} ${currency}`) : ["(بدون قیمت)"];
    }
    case "deadline":
      return [formatJalali(row.extendedOfferEndDate ?? row.offerEndDate)];
    case "status":
      return [INQUIRY_STATUS_META[row.status].label];
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
    salesExpert: null,
    itemCount: null,
    brands: null,
    saleValue: null,
    deadline: null,
    status: null,
    createdAt: null,
  };
}

export function InquiriesListPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreate = hasPermission(user, "inquiry.create");
  const canPurge = hasPermission(user, "inquiry.purge");

  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<ColumnKey>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [colFilters, setColFilters] = useState<Record<ColumnKey, Set<string> | null>>(emptyColFilters());
  const [exporting, setExporting] = useState(false);

  // دیبانس کوتاه — نتیجه عملاً با هر حرف تایپ/حذف‌شده به‌روز می‌شه، بدون شلیک یک درخواست به‌ازای هر keystroke
  const debouncedQuery = useDebounced(query, 200);
  const { data, isLoading, isError } = useInquiries({ q: debouncedQuery });

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
                        : key === "buyer"
                          ? "w-[110px]"
                          : key === "salesExpert"
                            ? "w-[100px]"
                            : key === "itemCount"
                              ? "w-[55px]"
                              : key === "brands"
                                ? "w-[140px]"
                                : key === "saleValue"
                                  ? "w-[140px]"
                                  : key === "deadline"
                                    ? "w-[100px]"
                                    : key === "status"
                                      ? "w-[100px]"
                                      : key === "createdAt"
                                        ? "w-[90px]"
                                        : ""
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
                  <td colSpan={10} className="p-14 text-center">
                    <div className="w-12 h-12 rounded-full bg-bg flex items-center justify-center mx-auto mb-3">
                      <FileSearch size={20} className="text-textSecondary" />
                    </div>
                    <p className="text-xs text-textSecondary">پرونده‌ای یافت نشد.</p>
                    <p className="text-[11px] text-textSecondary/70 mt-1">جستجو/فیلتر رو تغییر بده یا یک استعلام جدید ثبت کن.</p>
                  </td>
                </tr>
              )}
              {rows.map((row) => {
                const brandsText = row.builders.join("، ");
                const saleValue = saleValueText(row);
                return (
                  <tr
                    key={row.id}
                    onClick={() => navigate(`/inquiries/${row.id}`)}
                    className="cursor-pointer hover:bg-bg transition-colors duration-150"
                  >
                    <td className="px-3 py-2">
                      <span className="block truncate text-xs font-mono text-primary font-medium" dir="ltr" title={row.internalNumber}>
                        {row.internalNumber}
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
                    <td className="px-3 py-2 text-xs text-textSecondary">
                      <span className="block truncate" title={row.salesExpert.fullName}>{row.salesExpert.fullName}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-textSecondary">{row._count.items}</td>
                    <td className="px-3 py-2 text-xs text-textSecondary">
                      {brandsText ? (
                        <span className="block truncate" title={brandsText}>{brandsText}</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-textPrimary font-medium" dir="ltr">
                      {saleValue ? (
                        <span className="block truncate" title={saleValue}>{saleValue}</span>
                      ) : (
                        <span className="text-textSecondary font-normal">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-textSecondary whitespace-nowrap">
                      {formatJalali(row.extendedOfferEndDate ?? row.offerEndDate)}
                      {row.extendedOfferEndDate && (
                        <span className="block text-[10px] text-warning font-medium">تمدید شده</span>
                      )}
                    </td>
                    <td className="px-3 py-2"><StatusBadge status={row.status} stageLabel={row.stageLabel} /></td>
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
