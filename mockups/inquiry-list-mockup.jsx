import React, { useState } from "react";
import {
  Search,
  Plus,
  ChevronDown,
  ChevronUp,
  Calendar,
  User,
  Building2,
} from "lucide-react";

const FONT_IMPORT_URL =
  "https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap";

const tokens = {
  bg: "#F6F4EF",
  surface: "#FFFFFF",
  primary: "#1F3A5F",
  primaryDark: "#16293F",
  accent: "#A9633B",
  accentSoft: "#F3E6DC",
  border: "#E3DED2",
  textPrimary: "#20201C",
  textSecondary: "#6B675F",
  danger: "#B3413A",
  success: "#2F7D5D",
  successSoft: "#E4F0EA",
  warning: "#B98900",
  warningSoft: "#FBF2DA",
};

const inputStyle = { border: `1px solid ${tokens.border}` };

const STATUS_META = {
  in_progress: { label: "در جریان", color: tokens.warning, bg: tokens.warningSoft },
  won: { label: "برد کامل", color: tokens.success, bg: tokens.successSoft },
  partially_won: { label: "برد جزئی", color: tokens.accent, bg: tokens.accentSoft },
  lost: { label: "باخت کامل", color: tokens.danger, bg: "#F3E6E4" },
  cancelled: { label: "لغو شده", color: tokens.textSecondary, bg: tokens.bg },
  suspended: { label: "معلق", color: tokens.textSecondary, bg: tokens.bg },
};

const INITIAL_INQUIRIES = [
  { id: 1, number: "INQ-2026-0417", customerRef: "TND-1405-118", subject: "تأمین یاتاقان‌های خط تولید نورد ۲", customer: "فولاد مبارکه اصفهان", salesExpert: "فرشید محمدی", status: "in_progress", itemCount: 3, deadline: "۱۴۰۵/۰۴/۲۰", value: 157600, currency: "EUR", createdAt: "۱۴۰۵/۰۲/۰۸" },
  { id: 2, number: "INQ-2026-0388", customerRef: "ZO-88214", subject: "تأمین بلبرینگ‌های خط ذوب", customer: "ذوب‌آهن اصفهان", salesExpert: "علی محمدی", status: "lost", itemCount: 2, deadline: "۱۴۰۵/۰۲/۲۸", value: 42000, currency: "EUR", createdAt: "۱۴۰۵/۰۱/۲۲" },
  { id: 3, number: "INQ-2026-0301", customerRef: "FKH-3391", subject: "تأمین قطعات هیدرولیک", customer: "فولاد خوزستان", salesExpert: "سارا کریمی", status: "won", itemCount: 5, deadline: "۱۴۰۴/۱۲/۱۵", value: 88500, currency: "EUR", createdAt: "۱۴۰۴/۱۱/۲۰" },
  { id: 4, number: "INQ-2026-0290", customerRef: "MOB-7712", subject: "تأمین یاتاقان‌های نورد سرد", customer: "فولاد مبارکه اصفهان", salesExpert: "فرشید محمدی", status: "won", itemCount: 4, deadline: "۱۴۰۴/۱۱/۰۵", value: 63200, currency: "EUR", createdAt: "۱۴۰۴/۱۰/۱۰" },
  { id: 5, number: "INQ-2026-0255", customerRef: "KVJ-441", subject: "تأمین اتصالات صنعتی", customer: "فولاد کاوه جنوب", salesExpert: "علی محمدی", status: "cancelled", itemCount: 1, deadline: "۱۴۰۴/۱۰/۱۲", value: 9800, currency: "EUR", createdAt: "۱۴۰۴/۰۹/۱۸" },
  { id: 6, number: "INQ-2026-0210", customerRef: "ZO-71190", subject: "تأمین کاسه‌نمد و آب‌بندی", customer: "ذوب‌آهن اصفهان", salesExpert: "سارا کریمی", status: "partially_won", itemCount: 3, deadline: "۱۴۰۴/۰۹/۳۰", value: 21400, currency: "EUR", createdAt: "۱۴۰۴/۰۸/۲۵" },
  { id: 7, number: "INQ-2026-0512", customerRef: "BLT-9002", subject: "تأمین پیچ و مهره صنعتی", customer: "فولاد بوتیای ایرانیان", salesExpert: "حسین رستمی", status: "in_progress", itemCount: 1, deadline: "۱۴۰۵/۰۵/۰۱", value: 12300, currency: "EUR", createdAt: "۱۴۰۵/۰۳/۰۱" },
];

const SALES_EXPERTS = [...new Set(INITIAL_INQUIRIES.map((i) => i.salesExpert))];
const CUSTOMERS = [...new Set(INITIAL_INQUIRIES.map((i) => i.customer))];

function StatusBadge({ status }) {
  const m = STATUS_META[status];
  return <span className="text-[11px] font-medium px-2 py-0.5 rounded-full whitespace-nowrap" style={{ background: m.bg, color: m.color }}>{m.label}</span>;
}

function SortHeader({ label, sortKey, currentSort, onSort }) {
  const active = currentSort.key === sortKey;
  return (
    <button
      onClick={() => onSort(sortKey)}
      className="flex items-center gap-1 text-[11px] font-medium"
      style={{ color: active ? tokens.primary : tokens.textSecondary }}
    >
      {label}
      {active && (currentSort.dir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
    </button>
  );
}

export default function InquiryListMockup() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [expertFilter, setExpertFilter] = useState("all");
  const [customerFilter, setCustomerFilter] = useState("all");
  const [sort, setSort] = useState({ key: "createdAt", dir: "desc" });

  const handleSort = (key) => {
    setSort((prev) => (prev.key === key ? { key, dir: prev.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  };

  let filtered = INITIAL_INQUIRIES.filter((inq) => {
    const matchesQuery =
      inq.subject.toLowerCase().includes(query.toLowerCase()) ||
      inq.number.toLowerCase().includes(query.toLowerCase()) ||
      inq.customerRef.toLowerCase().includes(query.toLowerCase()) ||
      inq.customer.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === "all" || inq.status === statusFilter;
    const matchesExpert = expertFilter === "all" || inq.salesExpert === expertFilter;
    const matchesCustomer = customerFilter === "all" || inq.customer === customerFilter;
    return matchesQuery && matchesStatus && matchesExpert && matchesCustomer;
  });

  filtered = [...filtered].sort((a, b) => {
    let cmp = 0;
    if (sort.key === "value") cmp = a.value - b.value;
    else if (sort.key === "deadline") cmp = a.deadline.localeCompare(b.deadline);
    else if (sort.key === "createdAt") cmp = a.createdAt.localeCompare(b.createdAt);
    else if (sort.key === "number") cmp = a.number.localeCompare(b.number);
    return sort.dir === "asc" ? cmp : -cmp;
  });

  const totalValue = filtered.reduce((s, i) => s + i.value, 0);

  return (
    <div dir="rtl" style={{ background: tokens.bg, minHeight: "100vh", fontFamily: "Vazirmatn, sans-serif" }} className="p-4 sm:p-8">
      <style>{`@import url('${FONT_IMPORT_URL}'); .mono { font-family: 'JetBrains Mono', monospace; }`}</style>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-1">
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: tokens.textPrimary }}>لیست استعلام‌ها</h1>
          <button type="button" className="flex items-center gap-1.5 px-4 py-2.5 rounded-md text-sm font-medium text-white" style={{ background: tokens.primary }}>
            <Plus size={15} /> استعلام جدید
          </button>
        </div>
        <p className="text-xs mb-5" style={{ color: tokens.textSecondary }}>
          {filtered.length} استعلام · جمع ارزش: <span className="mono font-medium" style={{ color: tokens.textPrimary }}>{totalValue.toLocaleString("en-US")} EUR</span>
        </p>

        <div className="relative mb-3">
          <Search size={15} className="absolute top-2.5 right-3" style={{ color: tokens.textSecondary }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جست‌وجوی موضوع، شماره، مرجع مشتری یا نام مشتری..." className="w-full rounded-md pr-9 pl-3 py-2.5 text-sm" style={inputStyle} />
        </div>

        <div className="flex flex-wrap gap-2 mb-5">
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-xs rounded-md px-3 py-2" style={inputStyle}>
            <option value="all">همه وضعیت‌ها</option>
            {Object.entries(STATUS_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={expertFilter} onChange={(e) => setExpertFilter(e.target.value)} className="text-xs rounded-md px-3 py-2" style={inputStyle}>
            <option value="all">همه کارشناسان</option>
            {SALES_EXPERTS.map((e) => <option key={e} value={e}>{e}</option>)}
          </select>
          <select value={customerFilter} onChange={(e) => setCustomerFilter(e.target.value)} className="text-xs rounded-md px-3 py-2" style={inputStyle}>
            <option value="all">همه مشتریان</option>
            {CUSTOMERS.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* هدر جدول با سورت */}
        <div className="hidden sm:flex items-center gap-3 px-4 py-2 text-[11px]" style={{ color: tokens.textSecondary }}>
          <span className="w-28"><SortHeader label="شماره" sortKey="number" currentSort={sort} onSort={handleSort} /></span>
          <span className="flex-1">موضوع / مشتری</span>
          <span className="w-24"><SortHeader label="مهلت" sortKey="deadline" currentSort={sort} onSort={handleSort} /></span>
          <span className="w-24 text-left"><SortHeader label="ارزش" sortKey="value" currentSort={sort} onSort={handleSort} /></span>
          <span className="w-28">وضعیت</span>
        </div>

        <div className="space-y-2">
          {filtered.map((inq) => (
            <button
              key={inq.id}
              type="button"
              className="w-full text-right rounded-lg p-4 flex flex-wrap sm:flex-nowrap items-center gap-3"
              style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}
            >
              <div className="w-28 shrink-0">
                <p className="mono text-xs font-medium" style={{ color: tokens.accent }}>{inq.number}</p>
                <p className="mono text-[10px]" style={{ color: tokens.textSecondary }}>{inq.customerRef}</p>
              </div>
              <div className="flex-1 min-w-[180px]">
                <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>{inq.subject}</p>
                <div className="flex flex-wrap items-center gap-2 mt-0.5">
                  <span className="flex items-center gap-1 text-[11px]" style={{ color: tokens.textSecondary }}>
                    <Building2 size={11} /> {inq.customer}
                  </span>
                  <span className="flex items-center gap-1 text-[11px]" style={{ color: tokens.textSecondary }}>
                    <User size={11} /> {inq.salesExpert}
                  </span>
                  <span className="text-[11px]" style={{ color: tokens.textSecondary }}>{inq.itemCount} قلم</span>
                </div>
              </div>
              <div className="w-24 shrink-0 flex items-center gap-1 text-xs" style={{ color: tokens.textSecondary }}>
                <Calendar size={12} /> {inq.deadline}
              </div>
              <div className="w-24 shrink-0 text-left mono text-xs font-semibold" style={{ color: tokens.textPrimary }}>
                {inq.value.toLocaleString("en-US")}<br /><span className="text-[10px] font-normal" style={{ color: tokens.textSecondary }}>{inq.currency}</span>
              </div>
              <div className="w-28 shrink-0">
                <StatusBadge status={inq.status} />
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-center py-6" style={{ color: tokens.textSecondary }}>موردی یافت نشد</p>
          )}
        </div>
      </div>
    </div>
  );
}
