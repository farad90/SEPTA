import React, { useState } from "react";
import {
  ArrowRight,
  Search,
  Plus,
  Package,
  Pencil,
  Trash2,
  AlertTriangle,
  BarChart3,
  ChevronDown,
  ChevronUp,
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
const label = "block text-[11px] mb-1";

const INITIAL_CATALOG = [
  {
    id: 1, code: "BRG-6205-2RS", description: "بلبرینگ ساچمه‌ای شیار عمیق 6205", builder: "SKF", unit: "عدد", status: "active",
    usageHistory: [
      { inquiry: "INQ-2026-0417", customer: "فولاد مبارکه اصفهان", date: "۱۴۰۵/۰۲/۱۰", qty: 20, outcome: "pending" },
      { inquiry: "INQ-2026-0388", customer: "ذوب‌آهن اصفهان", date: "۱۴۰۵/۰۱/۲۲", qty: 8, outcome: "lost" },
      { inquiry: "INQ-2026-0301", customer: "فولاد خوزستان", date: "۱۴۰۴/۱۲/۰۵", qty: 15, outcome: "won" },
      { inquiry: "INQ-2026-0290", customer: "فولاد مبارکه اصفهان", date: "۱۴۰۴/۱۱/۱۸", qty: 30, outcome: "won" },
      { inquiry: "INQ-2026-0255", customer: "فولاد کاوه جنوب", date: "۱۴۰۴/۱۰/۰۲", qty: 5, outcome: "cancelled" },
      { inquiry: "INQ-2026-0210", customer: "ذوب‌آهن اصفهان", date: "۱۴۰۴/۰۹/۱۴", qty: 12, outcome: "lost" },
      { inquiry: "INQ-2026-0180", customer: "فولاد مبارکه اصفهان", date: "۱۴۰۴/۰۸/۰۱", qty: 20, outcome: "won" },
    ],
  },
  {
    id: 2, code: "SEAL-NBR-45", description: "کاسه‌نمد لاستیکی NBR سایز 45", builder: "SKF", unit: "عدد", status: "active",
    usageHistory: [
      { inquiry: "INQ-2026-0417", customer: "فولاد مبارکه اصفهان", date: "۱۴۰۵/۰۲/۱۰", qty: 50, outcome: "pending" },
      { inquiry: "INQ-2026-0301", customer: "فولاد خوزستان", date: "۱۴۰۴/۱۲/۰۵", qty: 10, outcome: "won" },
      { inquiry: "INQ-2026-0210", customer: "ذوب‌آهن اصفهان", date: "۱۴۰۴/۰۹/۱۴", qty: 6, outcome: "lost" },
    ],
  },
  {
    id: 3, code: "BLT-M12-80", description: "پیچ آلن سرخود M12x80 گرید 12.9", builder: "Bulten", unit: "عدد", status: "active",
    usageHistory: Array.from({ length: 12 }, (_, i) => ({
      inquiry: `INQ-2026-0${400 - i * 15}`, customer: ["فولاد مبارکه اصفهان", "ذوب‌آهن اصفهان", "فولاد خوزستان"][i % 3],
      date: "۱۴۰۴/۱۰/۰۱", qty: 100 + i * 10, outcome: ["won", "lost", "pending"][i % 3],
    })),
  },
  {
    id: 4, code: "BRG-6202-2RS", description: "بلبرینگ ساچمه‌ای شیار عمیق 6202", builder: "SKF", unit: "عدد", status: "active",
    usageHistory: [
      { inquiry: "INQ-2026-0388", customer: "ذوب‌آهن اصفهان", date: "۱۴۰۵/۰۱/۲۲", qty: 40, outcome: "lost" },
      { inquiry: "INQ-2026-0255", customer: "فولاد کاوه جنوب", date: "۱۴۰۴/۱۰/۰۲", qty: 15, outcome: "cancelled" },
    ],
  },
  { id: 5, code: "BRG-6304-2RS", description: "بلبرینگ ساچمه‌ای شیار عمیق 6304", builder: "NTN", unit: "عدد", status: "inactive", usageHistory: [] },
];

const OUTCOME_META = {
  won: { label: "برد", color: tokens.success, bg: tokens.successSoft },
  lost: { label: "باخت", color: tokens.danger, bg: "#F3E6E4" },
  cancelled: { label: "لغو شده", color: tokens.textSecondary, bg: tokens.bg },
  pending: { label: "هنوز نتیجه اعلام نشده", color: tokens.warning, bg: tokens.warningSoft },
};

function ConfirmModal({ title, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(20,18,14,0.45)" }}>
      <div className="rounded-lg w-full max-w-sm p-5" style={{ background: tokens.surface }}>
        <div className="flex items-center gap-2 mb-3" style={{ color: tokens.danger }}>
          <AlertTriangle size={18} />
          <p className="text-sm font-semibold">{title}</p>
        </div>
        <p className="text-xs mb-4" style={{ color: tokens.textSecondary }}>این عملیات قابل بازگشت نیست. مطمئنی؟</p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="text-xs px-3 py-2 rounded-md" style={{ color: tokens.textSecondary, border: `1px solid ${tokens.border}` }}>انصراف</button>
          <button onClick={onConfirm} className="text-xs px-3 py-2 rounded-md text-white" style={{ background: tokens.danger }}>بله، حذف کن</button>
        </div>
      </div>
    </div>
  );
}

function ViewField({ title, value }) {
  return (
    <div>
      <p className="text-[11px]" style={{ color: tokens.textSecondary }}>{title}</p>
      <p className="text-sm" style={{ color: tokens.textPrimary }}>{value || "—"}</p>
    </div>
  );
}

function ItemDetail({ item, onBack, onDeleted }) {
  const [editMode, setEditMode] = useState(false);
  const [data, setData] = useState({ ...item });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const update = (field, value) => setData({ ...data, [field]: value });

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} style={{ color: tokens.textSecondary }}><ArrowRight size={18} /></button>
        <span className="text-xs" style={{ color: tokens.textSecondary }}>بازگشت به کاتالوگ</span>
      </div>

      <div className="rounded-lg p-4 mb-5" style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRight: `4px solid ${tokens.primary}` }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ background: tokens.accentSoft, color: tokens.accent }}>
              <Package size={18} />
            </div>
            <div>
              {editMode ? (
                <input value={data.code} onChange={(e) => update("code", e.target.value)} className="mono text-lg font-bold rounded px-2 py-1" style={inputStyle} />
              ) : (
                <div className="flex items-center gap-2">
                  {data.builder && (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded"
                      style={{ border: `1.5px solid ${tokens.accent}`, color: tokens.accent }}
                    >
                      {data.builder}
                    </span>
                  )}
                  <h1 className="mono text-lg font-bold" style={{ color: tokens.textPrimary }}>{data.code}</h1>
                </div>
              )}
              <p className="text-xs" style={{ color: tokens.textSecondary }}>{data.description}</p>
            </div>
          </div>
          {!editMode && (
            <button onClick={() => setEditMode(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md" style={{ color: tokens.primary, border: `1px solid ${tokens.primary}` }}>
              <Pencil size={12} /> ویرایش
            </button>
          )}
        </div>

        {!editMode ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ViewField title="شرح کالا" value={data.description} />
            <ViewField title="سازنده" value={data.builder} />
            <ViewField title="واحد اندازه‌گیری" value={data.unit} />
            <ViewField title="وضعیت" value={data.status === "active" ? "فعال" : "غیرفعال"} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
              <textarea
                value={data.description}
                onChange={(e) => update("description", e.target.value)}
                placeholder="شرح کالا"
                rows={2}
                className="text-sm rounded px-2.5 py-2 resize-none sm:col-span-2"
                style={inputStyle}
              />
              <input placeholder="سازنده" value={data.builder} onChange={(e) => update("builder", e.target.value)} className="text-sm rounded px-2.5 py-2" style={inputStyle} />
              <input placeholder="واحد اندازه‌گیری" value={data.unit} onChange={(e) => update("unit", e.target.value)} className="text-sm rounded px-2.5 py-2" style={inputStyle} />
              <select value={data.status} onChange={(e) => update("status", e.target.value)} className="text-sm rounded px-2.5 py-2" style={inputStyle}>
                <option value="active">فعال</option>
                <option value="inactive">غیرفعال</option>
              </select>
            </div>
            <div className="flex items-center justify-between pt-3" style={{ borderTop: `1px dashed ${tokens.border}` }}>
              <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md" style={{ color: tokens.danger, border: `1px solid ${tokens.danger}` }}>
                <Trash2 size={13} /> حذف این کالا
              </button>
              <div className="flex gap-2">
                <button onClick={() => setEditMode(false)} className="text-xs px-3 py-1.5 rounded-md" style={{ color: tokens.textSecondary }}>انصراف</button>
                <button onClick={() => setEditMode(false)} className="text-xs px-4 py-1.5 rounded-md text-white" style={{ background: tokens.success }}>ذخیره</button>
              </div>
            </div>
          </>
        )}
      </div>

      {!editMode && (
        <div className="rounded-lg p-4" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
          <div className="flex items-center gap-2 mb-1">
            <BarChart3 size={16} style={{ color: tokens.accent }} />
            <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>
              سابقه استفاده ({data.usageHistory.length} استعلام)
            </p>
          </div>
          <p className="text-[11px] mb-3" style={{ color: tokens.textSecondary }}>
            آمار مرجع، فقط برای اطلاع — غیرقابل‌ویرایش
          </p>
          {data.usageHistory.length === 0 ? (
            <p className="text-xs" style={{ color: tokens.textSecondary }}>هنوز در هیچ استعلامی استفاده نشده.</p>
          ) : (
            <div className="space-y-1.5">
              {data.usageHistory.map((h, idx) => {
                const meta = OUTCOME_META[h.outcome];
                return (
                  <div key={idx} className="flex flex-wrap items-center gap-3 rounded-md px-3 py-2 text-xs" style={{ background: tokens.bg }}>
                    <span className="mono" style={{ color: tokens.accent, fontWeight: 600 }}>{h.inquiry}</span>
                    <span style={{ color: tokens.textPrimary }}>{h.customer}</span>
                    <span className="mono" style={{ color: tokens.textSecondary }}>{h.date}</span>
                    <span className="mono" style={{ color: tokens.textSecondary }}>{h.qty} عدد</span>
                    <span className="mr-auto text-[11px] px-2 py-0.5 rounded-full" style={{ background: meta.bg, color: meta.color }}>
                      {meta.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal title={`حذف کالای «${data.code}»`} onCancel={() => setConfirmDelete(false)} onConfirm={() => onDeleted(data.id)} />
      )}
    </div>
  );
}

function NewItemForm({ existing, onCancel, onCreated }) {
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [builder, setBuilder] = useState("");
  const [unit, setUnit] = useState("عدد");

  const similarMatch =
    code.length > 1 &&
    existing.some((c) => c.code.toLowerCase() === code.toLowerCase() || c.code.toLowerCase().includes(code.toLowerCase()));

  return (
    <div className="rounded-lg p-4 mb-5" style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRight: `4px solid ${tokens.primary}` }}>
      <p className="text-sm font-semibold mb-3" style={{ color: tokens.textPrimary }}>افزودن کالای جدید به کاتالوگ</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2">
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="کد کالا" className="mono text-sm rounded-md px-3 py-2" style={inputStyle} />
        <input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="واحد اندازه‌گیری" className="text-sm rounded-md px-3 py-2" style={inputStyle} />
      </div>

      {similarMatch && (
        <div className="flex items-start gap-2 rounded-md px-3 py-2 mb-3 text-xs" style={{ background: tokens.warningSoft, color: tokens.warning }}>
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>ممکنه این کد قبلاً با نام مشابهی ثبت شده باشه. لطفاً لیست پایین رو چک کن که تکراری نسازی.</span>
        </div>
      )}

      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="شرح کالا" rows={2} className="text-sm w-full rounded-md px-3 py-2 mb-2 resize-none" style={inputStyle} />
      <input value={builder} onChange={(e) => setBuilder(e.target.value)} placeholder="سازنده (اختیاری)" className="text-sm w-full rounded-md px-3 py-2 mb-3" style={inputStyle} />

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!code || !description}
          onClick={() => onCreated({ id: Date.now(), code, description, builder, unit, status: "active", usageCount: 0 })}
          className="px-4 py-2 rounded-md text-sm font-medium text-white"
          style={{ background: code && description ? tokens.primary : tokens.textSecondary, opacity: code && description ? 1 : 0.6 }}
        >
          ثبت کالا
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md text-sm" style={{ color: tokens.textSecondary }}>انصراف</button>
      </div>
    </div>
  );
}

function BrandMultiSelect({ builders, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filteredBuilders = builders.filter((b) => b.toLowerCase().includes(query.toLowerCase()));
  const toggle = (b) => onChange(selected.includes(b) ? selected.filter((x) => x !== b) : [...selected, b]);

  return (
    <div className="relative mb-3">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between text-sm rounded-md px-3 py-2.5"
        style={inputStyle}
      >
        <span style={{ color: selected.length ? tokens.textPrimary : tokens.textSecondary }}>
          {selected.length === 0 ? "فیلتر بر اساس برند/سازنده..." : `${selected.length} برند انتخاب شده: ${selected.join("، ")}`}
        </span>
        {open ? <ChevronUp size={16} style={{ color: tokens.textSecondary }} /> : <ChevronDown size={16} style={{ color: tokens.textSecondary }} />}
      </button>

      {open && (
        <div
          className="absolute z-10 w-full mt-1 rounded-md overflow-hidden"
          style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
        >
          <div className="p-2" style={{ borderBottom: `1px solid ${tokens.border}` }}>
            <div className="relative">
              <Search size={13} className="absolute top-2 right-2.5" style={{ color: tokens.textSecondary }} />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="جست‌وجوی برند..."
                className="w-full text-xs rounded pr-8 pl-2 py-1.5"
                style={inputStyle}
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filteredBuilders.length === 0 && (
              <p className="text-xs px-3 py-2" style={{ color: tokens.textSecondary }}>موردی یافت نشد</p>
            )}
            {filteredBuilders.map((b) => (
              <label key={b} className="flex items-center gap-2.5 px-3 py-2 text-xs cursor-pointer hover:bg-black/5">
                <input type="checkbox" checked={selected.includes(b)} onChange={() => toggle(b)} className="w-3.5 h-3.5" />
                <span style={{ color: tokens.textPrimary }}>{b}</span>
              </label>
            ))}
          </div>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={() => onChange([])}
              className="w-full text-center text-xs py-2"
              style={{ color: tokens.danger, borderTop: `1px solid ${tokens.border}` }}
            >
              پاک کردن انتخاب‌ها
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function Shell({ children }) {
  return (
    <div dir="rtl" style={{ background: tokens.bg, minHeight: "100vh", fontFamily: "Vazirmatn, sans-serif" }} className="p-4 sm:p-8">
      <style>{`@import url('${FONT_IMPORT_URL}'); .mono { font-family: 'JetBrains Mono', monospace; }`}</style>
      <div className="max-w-4xl mx-auto">{children}</div>
    </div>
  );
}

export default function ItemCatalogMockup() {
  const [catalog, setCatalog] = useState(INITIAL_CATALOG);
  const [view, setView] = useState("list");
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [showNewForm, setShowNewForm] = useState(false);
  const [builderFilter, setBuilderFilter] = useState([]);
  const [statusFilter, setStatusFilter] = useState("active");
  const [sortBy, setSortBy] = useState("usage_desc");

  const selected = catalog.find((c) => c.id === selectedId);
  const openItem = (item) => { setSelectedId(item.id); setView("detail"); };
  const backToList = () => { setView("list"); setSelectedId(null); };
  const deleteItem = (id) => { setCatalog(catalog.filter((c) => c.id !== id)); backToList(); };

  if (view === "detail" && selected) {
    return <Shell><ItemDetail item={selected} onBack={backToList} onDeleted={deleteItem} /></Shell>;
  }

  const builders = [...new Set(catalog.map((c) => c.builder).filter(Boolean))].sort();

  let filtered = catalog.filter((c) => {
    const matchesQuery =
      c.code.toLowerCase().includes(query.toLowerCase()) ||
      c.description.includes(query) ||
      (c.builder && c.builder.toLowerCase().includes(query.toLowerCase()));
    const matchesBuilder = builderFilter.length === 0 || builderFilter.includes(c.builder);
    const matchesStatus = statusFilter === "all" || c.status === statusFilter;
    return matchesQuery && matchesBuilder && matchesStatus;
  });

  const sorters = {
    usage_desc: (a, b) => b.usageHistory.length - a.usageHistory.length,
    usage_asc: (a, b) => a.usageHistory.length - b.usageHistory.length,
    code_asc: (a, b) => a.code.localeCompare(b.code),
    code_desc: (a, b) => b.code.localeCompare(a.code),
    builder_asc: (a, b) => (a.builder || "").localeCompare(b.builder || ""),
  };
  filtered = [...filtered].sort(sorters[sortBy]);

  return (
    <Shell>
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="text-xs font-medium tracking-wide mb-1" style={{ color: tokens.accent }}>ماژول سراسری</p>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: tokens.textPrimary }}>کاتالوگ کالا</h1>
        </div>
        {!showNewForm && (
          <button type="button" onClick={() => setShowNewForm(true)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-md text-sm font-medium text-white" style={{ background: tokens.primary }}>
            <Plus size={15} /> کالای جدید
          </button>
        )}
      </div>
      <p className="text-xs mb-5" style={{ color: tokens.textSecondary }}>
        همون کاتالوگی که هنگام ثبت استعلام هم استفاده می‌شه — لیست تخت، بدون دسته‌بندی. این ماژول
        برای ثبت پیش‌دستانه/دسته‌جمعی و پاکسازی/نگهداری کاتالوگه.
      </p>

      {showNewForm && (
        <NewItemForm existing={catalog} onCancel={() => setShowNewForm(false)} onCreated={(item) => { setCatalog([...catalog, item]); setShowNewForm(false); }} />
      )}

      <div className="relative mb-3">
        <Search size={15} className="absolute top-2.5 right-3" style={{ color: tokens.textSecondary }} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستجوی کد، شرح یا سازنده..." className="w-full rounded-md pr-9 pl-3 py-2.5 text-sm" style={inputStyle} />
      </div>

      {/* فیلتر برند/سازنده — کمبوباکس چندانتخابی (چون تعداد برندها می‌تونه خیلی زیاد باشه) */}
      <BrandMultiSelect builders={builders} selected={builderFilter} onChange={setBuilderFilter} />

      {/* فیلتر وضعیت + مرتب‌سازی */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-xs rounded-md px-3 py-2" style={inputStyle}>
          <option value="active">فقط فعال</option>
          <option value="inactive">فقط غیرفعال</option>
          <option value="all">همه وضعیت‌ها</option>
        </select>
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="text-xs rounded-md px-3 py-2" style={inputStyle}>
          <option value="usage_desc">مرتب‌سازی: بیشترین استفاده</option>
          <option value="usage_asc">مرتب‌سازی: کمترین استفاده</option>
          <option value="code_asc">مرتب‌سازی: کد (الف تا ی)</option>
          <option value="code_desc">مرتب‌سازی: کد (ی تا الف)</option>
          <option value="builder_asc">مرتب‌سازی: سازنده</option>
        </select>
        <span className="text-[11px] mr-auto" style={{ color: tokens.textSecondary }}>{filtered.length} کالا</span>
      </div>

      <div className="space-y-2.5">
        {filtered.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => openItem(c)}
            className="w-full text-right rounded-lg p-4 flex flex-wrap items-center gap-3"
            style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, opacity: c.status === "inactive" ? 0.6 : 1 }}
          >
            <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0" style={{ background: tokens.accentSoft, color: tokens.accent }}>
              <Package size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                {c.builder && (
                  <span
                    className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                    style={{ border: `1.5px solid ${tokens.accent}`, color: tokens.accent }}
                  >
                    {c.builder}
                  </span>
                )}
                <p className="mono text-sm font-semibold" style={{ color: tokens.textPrimary }}>{c.code}</p>
              </div>
              <p className="text-xs" style={{ color: tokens.textSecondary }}>{c.description}</p>
            </div>
            <div className="mr-auto flex items-center gap-2">
              {c.status === "inactive" && (
                <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "#F3E6E4", color: tokens.danger }}>غیرفعال</span>
              )}
              <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: tokens.bg, color: tokens.textSecondary }}>
                {c.usageHistory.length} استفاده
              </span>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-center py-6" style={{ color: tokens.textSecondary }}>موردی یافت نشد</p>
        )}
      </div>
    </Shell>
  );
}
