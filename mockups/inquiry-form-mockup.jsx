import React, { useState } from "react";
import {
  Plus,
  Trash2,
  Paperclip,
  ChevronDown,
  ChevronUp,
  Search,
  Calendar,
  Info,
} from "lucide-react";

/*
  توکن‌های طراحی
  رنگ: پس‌زمینه کاغذی گرم (#F6F4EF)، سرمه‌ای فولادی (#1F3A5F) به‌عنوان اکشن اصلی،
        زنگاری/مسی (#A9633B) به‌عنوان اکسنت صنعتی (یادآور رنگ فولاد اکسیدشده)
  تایپ: Vazirmatn برای متن فارسی، JetBrains Mono برای کدها/اعداد (شماره استعلام، کد کالا)
  امضای صفحه: بج «شماره استعلام» به شکل مهر/پلاک فولادی با فونت مونو — یادآور پلاک شناسه روی تجهیزات صنعتی
*/

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
};

function SectionCard({ title, subtitle, icon, children }) {
  return (
    <div
      style={{
        background: tokens.surface,
        border: `1px solid ${tokens.border}`,
        borderRight: `4px solid ${tokens.primary}`,
      }}
      className="rounded-lg mb-5 overflow-hidden"
    >
      <div
        className="px-5 py-4 flex items-center gap-3"
        style={{ borderBottom: `1px solid ${tokens.border}` }}
      >
        <div
          className="w-9 h-9 rounded-md flex items-center justify-center shrink-0"
          style={{ background: tokens.accentSoft, color: tokens.accent }}
        >
          {icon}
        </div>
        <div>
          <h3
            className="text-sm font-semibold"
            style={{ color: tokens.textPrimary }}
          >
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs mt-0.5" style={{ color: tokens.textSecondary }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function Field({ label, required, hint, children, span }) {
  return (
    <div className={span === 2 ? "sm:col-span-2" : ""}>
      <label
        className="block text-xs font-medium mb-1.5"
        style={{ color: tokens.textPrimary }}
      >
        {label}
        {required && <span style={{ color: tokens.danger }}> *</span>}
      </label>
      {children}
      {hint && (
        <p className="text-[11px] mt-1" style={{ color: tokens.textSecondary }}>
          {hint}
        </p>
      )}
    </div>
  );
}

const inputBase =
  "w-full rounded-md px-3 py-2 text-sm outline-none transition-colors focus:ring-2";
const inputStyle = {
  border: `1px solid ${tokens.border}`,
  background: "#FFFFFF",
  color: tokens.textPrimary,
};

function TextInput(props) {
  return (
    <input
      {...props}
      style={inputStyle}
      className={`${inputBase} ${props.className || ""}`}
      onFocus={(e) => (e.target.style.borderColor = tokens.primary)}
      onBlur={(e) => (e.target.style.borderColor = tokens.border)}
    />
  );
}

function Select({ children, ...props }) {
  return (
    <select
      {...props}
      style={inputStyle}
      className={`${inputBase} bg-white`}
      onFocus={(e) => (e.target.style.borderColor = tokens.primary)}
      onBlur={(e) => (e.target.style.borderColor = tokens.border)}
    >
      {children}
    </select>
  );
}

function Toggle({ checked, onChange, label }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2 text-sm"
      style={{ color: tokens.textPrimary }}
    >
      <span
        className="w-10 h-5 rounded-full relative transition-colors"
        style={{ background: checked ? tokens.primary : "#D8D4C9" }}
      >
        <span
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all"
          style={{ right: checked ? "22px" : "2px" }}
        />
      </span>
      {label}
    </button>
  );
}

let rowSeq = 3;

// نمونه‌ای از کاتالوگ مرکزی کالا — در پیاده‌سازی واقعی از دیتابیس میاد
const CATALOG_SEED = [
  { code: "BRG-6205-2RS", description: "بلبرینگ ساچمه‌ای شیار عمیق 6205", builder: "SKF", unit: "عدد" },
  { code: "SEAL-NBR-45", description: "کاسه‌نمد لاستیکی NBR سایز 45", builder: "", unit: "عدد" },
  { code: "BLT-M12-80", description: "پیچ آلن سرخود M12x80 گرید 12.9", builder: "", unit: "عدد" },
  { code: "BRG-6202-2RS", description: "بلبرینگ ساچمه‌ای شیار عمیق 6202", builder: "SKF", unit: "عدد" },
];

function ItemCodeField({ value, onSelect, catalog, onAddNew }) {
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);

  const matches = query
    ? catalog.filter(
        (c) => c.code.toLowerCase().includes(query.toLowerCase()) || c.description.includes(query)
      )
    : [];
  const exactMatch = catalog.some((c) => c.code.toLowerCase() === query.toLowerCase());

  return (
    <div className="relative">
      <input
        placeholder="جستجوی کد کالا در کاتالوگ..."
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        className="mono text-xs rounded px-2 py-1.5 w-44"
        style={inputStyle}
      />
      {open && query && (
        <div
          className="absolute z-10 mt-1 w-64 rounded-md overflow-hidden max-h-40 overflow-y-auto"
          style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
        >
          {matches.map((c) => (
            <button
              key={c.code}
              type="button"
              onClick={() => {
                onSelect(c);
                setQuery(c.code);
                setOpen(false);
              }}
              className="w-full text-right px-3 py-2 text-xs hover:bg-black/5"
            >
              <span className="mono font-medium">{c.code}</span>
              <span className="block text-[11px]" style={{ color: tokens.textSecondary }}>{c.description}</span>
            </button>
          ))}
          {!exactMatch && (
            <button
              type="button"
              onClick={() => {
                onAddNew(query);
                setOpen(false);
              }}
              className="w-full text-right px-3 py-2 text-xs font-medium"
              style={{ color: tokens.primary, borderTop: matches.length ? `1px dashed ${tokens.border}` : "none" }}
            >
              + «{query}» در کاتالوگ نیست — افزودن کالای جدید
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function InquiryFormMockup() {
  const [equivalentAccepted, setEquivalentAccepted] = useState(true);
  const [advancePayment, setAdvancePayment] = useState(false);
  const [isExtended, setIsExtended] = useState(false);
  const [assignTo, setAssignTo] = useState("me");
  const [expandedRow, setExpandedRow] = useState(1);
  const [items, setItems] = useState([
    {
      id: 1,
      itemCode: "BRG-6205-2RS",
      description: "بلبرینگ ساچمه‌ای شیار عمیق 6205",
      qty: "20",
      unit: "عدد",
      builder: "SKF",
    },
    { id: 2, itemCode: "", description: "", qty: "", unit: "", builder: "" },
  ]);
  const [catalog, setCatalog] = useState(CATALOG_SEED);
  const [quickAdd, setQuickAdd] = useState(null); // { rowId, code }

  const updateItemField = (id, field, value) => {
    setItems((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  };
  const selectCatalogItem = (rowId, catalogItem) => {
    setItems((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
              ...r,
              itemCode: catalogItem.code,
              description: r.description || catalogItem.description,
              builder: r.builder || catalogItem.builder,
              unit: r.unit || catalogItem.unit,
            }
          : r
      )
    );
  };

  const addRow = () => {
    rowSeq += 1;
    setItems((prev) => [
      ...prev,
      { id: rowSeq, itemCode: "", description: "", qty: "", unit: "", builder: "" },
    ]);
  };

  const removeRow = (id) => {
    setItems((prev) => prev.filter((r) => r.id !== id));
  };

  return (
    <div
      dir="rtl"
      style={{ background: tokens.bg, minHeight: "100vh", fontFamily: "Vazirmatn, sans-serif" }}
      className="p-4 sm:p-8"
    >
      <style>{`
        @import url('${FONT_IMPORT_URL}');
        .mono { font-family: 'JetBrains Mono', monospace; }
      `}</style>

      <div className="max-w-4xl mx-auto">
        {/* هدر صفحه */}
        <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
          <div>
            <p
              className="text-xs font-medium tracking-wide mb-1"
              style={{ color: tokens.accent }}
            >
              پیش‌فروش · مرحله ۱
            </p>
            <h1
              className="text-xl sm:text-2xl font-bold"
              style={{ color: tokens.textPrimary }}
            >
              ثبت استعلام جدید
            </h1>
          </div>

          {/* شماره استعلام (وارد می‌شود توسط کارشناس) + شماره داخلی خودکار */}
          <div className="flex items-end gap-3">
            <div>
              <label
                className="block text-xs font-medium mb-1.5"
                style={{ color: tokens.textPrimary }}
              >
                شماره استعلام (مرجع مشتری/مناقصه)
              </label>
              <TextInput
                className="mono w-48"
                placeholder="مثلاً TND-1405-118"
              />
            </div>
            <div
              className="px-4 py-2.5 rounded-md flex flex-col items-center"
              style={{
                border: `1.5px dashed ${tokens.accent}`,
                background: tokens.accentSoft,
                transform: "rotate(-1deg)",
              }}
            >
              <span className="text-[10px]" style={{ color: tokens.accent }}>
                شماره داخلی (خودکار)
              </span>
              <span
                className="mono text-sm font-semibold"
                style={{ color: tokens.primaryDark }}
              >
                INQ-2026-0417
              </span>
            </div>
          </div>
        </div>

        {/* بخش ۱: اطلاعات کلی */}
        <SectionCard
          title="اطلاعات کلی استعلام"
          subtitle="مشخصات مشتری، مهلت‌ها و شرایط کلی"
          icon={<Info size={18} />}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="شرکت مشتری/کارفرما" required>
              <div className="relative">
                <TextInput placeholder="جستجوی شرکت..." />
                <Search
                  size={15}
                  className="absolute top-2.5 right-3"
                  style={{ color: tokens.textSecondary }}
                />
              </div>
            </Field>

            <Field label="کارشناس طرف مشتری" hint="بعد از انتخاب شرکت، رابطین آن نمایش داده می‌شود">
              <Select defaultValue="">
                <option value="" disabled>
                  انتخاب رابط...
                </option>
                <option>مهندس رضایی — واحد خرید</option>
                <option>خانم احمدی — واحد فنی</option>
              </Select>
            </Field>

            <Field label="موضوع استعلام" required span={2}>
              <TextInput placeholder="مثلاً: تأمین یاتاقان‌های خط تولید نورد ۲" />
            </Field>

            <Field label="مهلت ارائه پیشنهاد" required>
              <div className="relative">
                <TextInput type="date" />
              </div>
            </Field>

            <Field label="تاریخ شروع استعلام" required>
              <TextInput type="date" />
            </Field>

            <div className="sm:col-span-2 flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="extend"
                checked={isExtended}
                onChange={(e) => setIsExtended(e.target.checked)}
                className="w-4 h-4"
              />
              <label htmlFor="extend" className="text-sm" style={{ color: tokens.textPrimary }}>
                این استعلام تمدید شده است
              </label>
            </div>

            {isExtended && (
              <Field label="تاریخ تمدید تا" span={2}>
                <TextInput type="date" />
              </Field>
            )}

            <Field label="کانال دریافت استعلام">
              <Select defaultValue="tender_system">
                <option value="tender_system">سامانه مناقصه</option>
                <option value="email">ایمیل</option>
                <option value="phone">تماس تلفنی</option>
                <option value="in_person">حضوری</option>
              </Select>
            </Field>

            <Field label="سطح فوریت">
              <Select defaultValue="normal">
                <option value="normal">عادی</option>
                <option value="urgent">فوری</option>
              </Select>
            </Field>

            <Field label="کارشناس فروش مسئول" hint="پیش‌فرض: کاربر جاری (فرشید)">
              <Select value={assignTo} onChange={(e) => setAssignTo(e.target.value)}>
                <option value="me">فرشید (خودم)</option>
                <option value="other">واگذاری به همکار دیگر...</option>
              </Select>
              {assignTo === "other" && (
                <Select className="mt-2" defaultValue="">
                  <option value="" disabled>
                    انتخاب همکار...
                  </option>
                  <option value="u1">علی محمدی — کارشناس فروش</option>
                  <option value="u2">سارا کریمی — کارشناس فروش</option>
                  <option value="u3">حسین رستمی — کارشناس فروش</option>
                </Select>
              )}
            </Field>

            <Field label="واحد خرید طرف مشتری">
              <TextInput placeholder="مثلاً واحد نورد" />
            </Field>

            <div className="sm:col-span-2 flex flex-wrap gap-6 pt-2">
              <Toggle
                checked={equivalentAccepted}
                onChange={setEquivalentAccepted}
                label="پیشنهاد تایپ معادل قابل قبول است"
              />
              <Toggle
                checked={advancePayment}
                onChange={setAdvancePayment}
                label="امکان دریافت پیش‌پرداخت وجود دارد"
              />
            </div>

            <Field label="شرایط تسویه" span={2} hint="شرح شرایط تسویه/پرداخت مدنظر مشتری">
              <textarea
                rows={2}
                style={inputStyle}
                className={`${inputBase} resize-none`}
                placeholder="مثلاً: ۳۰٪ پیش‌پرداخت، مانده در مقابل اسناد حمل"
              />
            </Field>

            <Field label="توضیحات" span={2}>
              <textarea
                rows={2}
                style={inputStyle}
                className={`${inputBase} resize-none`}
                placeholder="یادداشت آزاد..."
              />
            </Field>
          </div>
        </SectionCard>

        {/* بخش ۲: اقلام استعلام */}
        <SectionCard
          title="اقلام استعلام"
          subtitle={`${items.length} ردیف ثبت شده`}
          icon={<Paperclip size={18} />}
        >
          <div className="space-y-3">
            {items.map((row, idx) => (
              <div
                key={row.id}
                className="rounded-md"
                style={{ border: `1px solid ${tokens.border}` }}
              >
                <div className="flex items-start gap-3 px-3 py-2.5">
                  <span
                    className="mono text-xs w-6 text-center shrink-0 pt-2"
                    style={{ color: tokens.textSecondary }}
                  >
                    {idx + 1}
                  </span>

                  <div className="flex-1 min-w-0 space-y-2">
                    {/* سطر اول: شرح کالا — فضای کامل، چندخطی */}
                    <textarea
                      placeholder="شرح کامل کالا (می‌تواند چند سطر باشد)..."
                      defaultValue={row.description}
                      rows={2}
                      className="text-sm rounded px-2.5 py-2 w-full resize-y"
                      style={inputStyle}
                    />
                    {/* سطر دوم: کد، مقدار، واحد */}
                    <div className="flex flex-wrap gap-2">
                      <ItemCodeField
                        value={row.itemCode}
                        catalog={catalog}
                        onSelect={(c) => selectCatalogItem(row.id, c)}
                        onAddNew={(code) => setQuickAdd({ rowId: row.id, code })}
                      />
                      <input
                        placeholder="مقدار"
                        defaultValue={row.qty}
                        className="mono text-xs rounded px-2 py-1.5 w-20"
                        style={inputStyle}
                      />
                      <input
                        placeholder="واحد"
                        defaultValue={row.unit}
                        className="text-xs rounded px-2 py-1.5 w-20"
                        style={inputStyle}
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-1 shrink-0 pt-1">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedRow(expandedRow === row.id ? null : row.id)
                      }
                      className="p-1.5 rounded"
                      style={{ color: tokens.primary }}
                      title="جزئیات فنی بیشتر"
                    >
                      {expandedRow === row.id ? (
                        <ChevronUp size={16} />
                      ) : (
                        <ChevronDown size={16} />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => removeRow(row.id)}
                      className="p-1.5 rounded"
                      style={{ color: tokens.danger }}
                      title="حذف ردیف"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {expandedRow === row.id && (
                  <div
                    className="grid grid-cols-2 sm:grid-cols-3 gap-3 px-3 pb-3 pt-1"
                    style={{ borderTop: `1px dashed ${tokens.border}` }}
                  >
                    <Field label="سازنده اصلی">
                      <TextInput defaultValue={row.builder} placeholder="مثلاً SKF" />
                    </Field>
                    <Field label="شماره قطعه (Part No)">
                      <TextInput className="mono text-xs" />
                    </Field>
                    <Field label="شماره نقشه (Drawing No)">
                      <TextInput className="mono text-xs" />
                    </Field>
                    <Field label="تایپ معادل">
                      <TextInput />
                    </Field>
                    <Field label="نوع/ردیف نقشه">
                      <TextInput />
                    </Field>
                    <Field label="شماره سریال">
                      <TextInput className="mono text-xs" />
                    </Field>
                    <div className="col-span-2 sm:col-span-3">
                      <button
                        type="button"
                        className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md"
                        style={{ color: tokens.accent, background: tokens.accentSoft }}
                      >
                        <Paperclip size={13} /> پیوست نقشه/کاتالوگ
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addRow}
            className="mt-3 flex items-center gap-1.5 text-sm px-3 py-2 rounded-md"
            style={{ color: tokens.primary, border: `1px solid ${tokens.primary}` }}
          >
            <Plus size={15} /> افزودن ردیف
          </button>
        </SectionCard>

        {/* اکشن‌های پایانی */}
        <div className="flex items-center justify-end gap-3 mt-6">
          <button
            type="button"
            className="px-5 py-2.5 rounded-md text-sm font-medium"
            style={{ color: tokens.textSecondary }}
          >
            انصراف
          </button>
          <button
            type="button"
            className="px-6 py-2.5 rounded-md text-sm font-medium text-white"
            style={{ background: tokens.primary }}
          >
            ثبت استعلام
          </button>
        </div>
      </div>

      {quickAdd && (
        <QuickAddCatalogModal
          initialCode={quickAdd.code}
          onCancel={() => setQuickAdd(null)}
          onSave={(newItem) => {
            setCatalog((prev) => [...prev, newItem]);
            selectCatalogItem(quickAdd.rowId, newItem);
            setQuickAdd(null);
          }}
        />
      )}
    </div>
  );
}

function QuickAddCatalogModal({ initialCode, onCancel, onSave }) {
  const [code, setCode] = useState(initialCode || "");
  const [description, setDescription] = useState("");
  const [builder, setBuilder] = useState("");
  const [unit, setUnit] = useState("عدد");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(20,18,14,0.45)" }}>
      <div className="rounded-lg w-full max-w-md p-5" style={{ background: tokens.surface }}>
        <p className="text-sm font-semibold mb-1" style={{ color: tokens.textPrimary }}>
          افزودن کالای جدید به کاتالوگ
        </p>
        <p className="text-xs mb-4" style={{ color: tokens.textSecondary }}>
          این کالا به کاتالوگ مرکزی اضافه می‌شه و از این به بعد در همه استعلام‌ها قابل انتخابه.
        </p>
        <div className="space-y-2.5 mb-4">
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="کد کالا"
            className="mono text-sm w-full rounded-md px-3 py-2"
            style={inputStyle}
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="شرح کالا"
            rows={2}
            className="text-sm w-full rounded-md px-3 py-2 resize-none"
            style={inputStyle}
          />
          <div className="grid grid-cols-2 gap-2.5">
            <input
              value={builder}
              onChange={(e) => setBuilder(e.target.value)}
              placeholder="سازنده (اختیاری)"
              className="text-sm rounded-md px-3 py-2"
              style={inputStyle}
            />
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="واحد اندازه‌گیری"
              className="text-sm rounded-md px-3 py-2"
              style={inputStyle}
            />
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="text-sm px-4 py-2 rounded-md" style={{ color: tokens.textSecondary }}>
            انصراف
          </button>
          <button
            onClick={() => onSave({ code, description, builder, unit })}
            disabled={!code || !description}
            className="text-sm px-4 py-2 rounded-md text-white"
            style={{ background: code && description ? tokens.primary : tokens.textSecondary, opacity: code && description ? 1 : 0.6 }}
          >
            ثبت در کاتالوگ و انتخاب
          </button>
        </div>
      </div>
    </div>
  );
}
