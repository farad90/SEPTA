import React, { useState } from "react";
import {
  ArrowRight,
  Check,
  Clock,
  MessageCircleQuestion,
  Send,
  ChevronDown,
  ChevronUp,
  FileText,
  Building2,
  Search,
  Mail,
  FileDown,
  X,
  Paperclip,
  MessageCircle,
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

const TABS = [
  { key: "inquiry", label: "ثبت استعلام", state: "done" },
  { key: "rfq", label: "استعلام از تأمین‌کنندگان", state: "done" },
  { key: "selection", label: "انتخاب نهایی و قیمت‌گذاری", state: "done" },
  { key: "proposal", label: "پیشنهاد به مشتری", state: "done" },
  { key: "outcome", label: "نتیجه نهایی (برد/باخت)", state: "done" },
  { key: "order", label: "سفارش مشتری", state: "done" },
  { key: "po", label: "سفارش خرید (PO)", state: "done" },
  { key: "shipping", label: "حمل و گمرک", state: "done" },
  { key: "settlement", label: "تحویل و تسویه", state: "active" },
];

const inquiryItems = [
  { id: 1, code: "BRG-6205-2RS", desc: "بلبرینگ ساچمه‌ای شیار عمیق 6205", qty: 20, unit: "عدد" },
  { id: 2, code: "SEAL-NBR-45", desc: "کاسه‌نمد لاستیکی NBR سایز 45", qty: 50, unit: "عدد" },
  { id: 3, code: "BLT-M12-80", desc: "پیچ آلن سرخود M12x80 گرید 12.9", qty: 200, unit: "عدد" },
];

function StatusBadge({ status }) {
  const map = {
    awaiting: { label: "در انتظار پاسخ", bg: tokens.warningSoft, color: tokens.warning, icon: Clock },
    technical_question: {
      label: "سوال فنی — ارجاع به فروش",
      bg: tokens.accentSoft,
      color: tokens.accent,
      icon: MessageCircleQuestion,
    },
    offer_received: {
      label: "پیشنهاد قیمت ثبت شد",
      bg: tokens.successSoft,
      color: tokens.success,
      icon: Check,
    },
  };
  const s = map[status];
  const Icon = s.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full"
      style={{ background: s.bg, color: s.color }}
    >
      <Icon size={12} /> {s.label}
    </span>
  );
}

function RFQCard({ rfq }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(rfq.initialStatus);
  const [responseMode, setResponseMode] = useState(null); // null | 'choose' | 'question' | 'offer'
  const [techQuestion, setTechQuestion] = useState("");
  const [offerLocked, setOfferLocked] = useState(true);
  const [receivedAt, setReceivedAt] = useState(null);

  const [offerData, setOfferData] = useState({
    number: "",
    docDate: "",
    currency: "EUR",
    contact: "",
    vatApplicable: false,
    vatRate: "9",
    otherCosts: "",
    rows: rfq.items.map((it) => ({
      item: it,
      qty: inquiryItems.find((x) => x.code === it)?.qty || 0,
      unit: inquiryItems.find((x) => x.code === it)?.unit || "",
      price: "",
      delivery: "",
      partNumber: "",
      techSpec: "",
      isEquivalent: false,
      countryOfOrigin: "",
    })),
    generalRemarks: "",
  });

  const subTotal = offerData.rows.reduce(
    (sum, r) => sum + (parseFloat(r.price) || 0) * (r.qty || 0),
    0
  );
  const vatAmount = offerData.vatApplicable
    ? subTotal * ((parseFloat(offerData.vatRate) || 0) / 100)
    : 0;
  const otherCostsAmount = parseFloat(offerData.otherCosts) || 0;
  const grandTotal = subTotal + vatAmount + otherCostsAmount;
  const fmt = (n) =>
    n.toLocaleString("en-US", { maximumFractionDigits: 2 });

  const updateOfferRow = (idx, field, value) => {
    setOfferData((prev) => {
      const rows = [...prev.rows];
      rows[idx] = { ...rows[idx], [field]: value };
      return { ...prev, rows };
    });
  };

  const startResponse = () => setResponseMode("choose");
  const cancelToChoose = () => setResponseMode("choose");
  const cancelResponse = () => setResponseMode(null);

  const saveTechQuestion = () => {
    setStatus("technical_question");
    setResponseMode(null);
    setReceivedAt("امروز، ۱۴:۳۲"); // در پیاده‌سازی واقعی: now() سرور، خودکار و غیرقابل ویرایش
    // این متن به‌صورت خودکار با تگ «سوال فنی» در inquiry_discussions ثبت می‌شود
  };

  const saveOffer = () => {
    setStatus("offer_received");
    setResponseMode(null);
    setOfferLocked(true);
    setReceivedAt("امروز، ۱۴:۳۲"); // در پیاده‌سازی واقعی: now() سرور، خودکار و غیرقابل ویرایش
  };

  const resetResponse = () => {
    setStatus("awaiting");
    setResponseMode("choose");
    setTechQuestion("");
    setReceivedAt(null);
  };

  const fieldReadStyle = (locked) => ({
    border: `1px solid ${locked ? "transparent" : tokens.border}`,
    background: locked ? "transparent" : tokens.surface,
    color: tokens.textPrimary,
  });

  return (
    <div
      className="rounded-lg overflow-hidden"
      style={{ border: `1px solid ${tokens.border}`, background: tokens.surface }}
    >
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3"
      >
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
            style={{ background: tokens.accentSoft, color: tokens.accent }}
          >
            <Building2 size={15} />
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>
              {rfq.supplier}
              <span
                className="mono text-xs font-normal mr-2"
                style={{ color: tokens.textSecondary }}
              >
                {rfq.number}
              </span>
            </p>
            <p className="text-xs mt-0.5" style={{ color: tokens.textSecondary }}>
              {rfq.items.length} قلم · ارسال‌شده در {rfq.sentDate}
              {receivedAt && ` · پاسخ دریافت‌شده: ${receivedAt}`}
            </p>
            <p className="text-[11px] mt-0.5" style={{ color: tokens.accent }}>
              از طریق: {rfq.ourEntity}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatusBadge status={status} />
          {open ? (
            <ChevronUp size={16} style={{ color: tokens.textSecondary }} />
          ) : (
            <ChevronDown size={16} style={{ color: tokens.textSecondary }} />
          )}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4" style={{ borderTop: `1px dashed ${tokens.border}` }}>
          <div className="flex flex-wrap gap-1.5 my-3">
            {rfq.items.map((it) => (
              <span
                key={it}
                className="mono text-[11px] px-2 py-1 rounded"
                style={{ background: tokens.bg, color: tokens.textSecondary }}
              >
                {it}
              </span>
            ))}
          </div>

          {/* حالت پیش‌فرض: هنوز پاسخی ثبت نشده */}
          {status === "awaiting" && responseMode === null && (
            <button
              type="button"
              onClick={startResponse}
              className="text-xs px-3 py-1.5 rounded-md"
              style={{ color: tokens.primary, border: `1px solid ${tokens.primary}` }}
            >
              ثبت پاسخ تأمین‌کننده
            </button>
          )}

          {responseMode === "choose" && (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setResponseMode("question")}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-md"
                style={{ color: tokens.accent, border: `1px solid ${tokens.accent}` }}
              >
                <MessageCircleQuestion size={13} /> سوال فنی داشت
              </button>
              <button
                type="button"
                onClick={() => setResponseMode("offer")}
                className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-md"
                style={{ color: tokens.success, border: `1px solid ${tokens.success}` }}
              >
                <Check size={13} /> پیشنهاد قیمت داد
              </button>
              <button
                type="button"
                onClick={cancelResponse}
                className="text-xs px-3 py-2 rounded-md"
                style={{ color: tokens.textSecondary }}
              >
                انصراف
              </button>
            </div>
          )}

          {/* ثبت سوال فنی */}
          {responseMode === "question" && (
            <div>
              <p className="text-xs mb-2" style={{ color: tokens.textSecondary }}>
                متن سوال فنی تأمین‌کننده رو وارد کن — به‌صورت خودکار با تگ «سوال فنی» در بخش
                گفتگوی استعلام هم ثبت می‌شه تا کارشناس فروش ببینه. تاریخ دریافت این پاسخ به‌صورت
                خودکار (لحظه ثبت) ذخیره می‌شه:
              </p>
              <textarea
                rows={2}
                value={techQuestion}
                onChange={(e) => setTechQuestion(e.target.value)}
                className="w-full rounded-md px-3 py-2 text-sm resize-none mb-2"
                style={{ border: `1px solid ${tokens.border}` }}
                placeholder="مثلاً: آیا معادل بدون برند SKF قابل قبول است؟"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={saveTechQuestion}
                  className="text-xs px-3 py-1.5 rounded-md text-white"
                  style={{ background: tokens.accent }}
                >
                  ثبت و ارجاع به فروش
                </button>
                <button
                  type="button"
                  onClick={cancelToChoose}
                  className="text-xs px-3 py-1.5 rounded-md"
                  style={{ color: tokens.textSecondary }}
                >
                  بازگشت
                </button>
              </div>
            </div>
          )}

          {status === "technical_question" && responseMode === null && (
            <div
              className="rounded-md px-3 py-2.5 text-xs"
              style={{ background: tokens.accentSoft, color: tokens.textPrimary }}
            >
              «{rfq.supplier}» سوال فنی مطرح کرده و در بخش گفتگوی استعلام برای کارشناس فروش ثبت
              شد. پس از پاسخ فروش، می‌تونی دوباره پاسخ نهایی تأمین‌کننده رو ثبت کنی.
              <div className="flex gap-3 mt-2">
                <button
                  type="button"
                  onClick={() => setResponseMode("choose")}
                  className="underline"
                  style={{ color: tokens.primary }}
                >
                  ثبت پاسخ جدید
                </button>
                <button
                  type="button"
                  onClick={resetResponse}
                  className="underline"
                  style={{ color: tokens.textSecondary }}
                >
                  اشتباه زدم، اصلاح کن
                </button>
              </div>
            </div>
          )}

          {/* فرم ثبت/نمایش پیشنهاد قیمت */}
          {(responseMode === "offer" ||
            (status === "offer_received" && responseMode === null)) && (
            <div className="rounded-md p-3" style={{ background: tokens.bg }}>
              {status === "offer_received" && responseMode === null && (
                <div className="flex justify-between items-center mb-2">
                  <p className="text-xs font-semibold" style={{ color: tokens.textPrimary }}>
                    {offerLocked ? "پیشنهاد ثبت‌شده (فقط خواندنی)" : "در حال ویرایش پیشنهاد"}
                  </p>
                  <div className="flex gap-3">
                    {offerLocked ? (
                      <button
                        type="button"
                        onClick={() => setOfferLocked(false)}
                        className="text-[11px] underline"
                        style={{ color: tokens.primary }}
                      >
                        ویرایش پیشنهاد
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setOfferLocked(true)}
                        className="text-[11px] px-2 py-1 rounded text-white"
                        style={{ background: tokens.success }}
                      >
                        ذخیره تغییرات
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={resetResponse}
                      className="text-[11px] underline"
                      style={{ color: tokens.textSecondary }}
                    >
                      اشتباه زدم، نوع پاسخ رو عوض کن
                    </button>
                  </div>
                </div>
              )}

              {(() => {
                const locked = status === "offer_received" && responseMode === null && offerLocked;
                return (
                  <>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
                      <div>
                        <label className="block text-[11px] mb-1" style={{ color: tokens.textSecondary }}>
                          شماره آفر
                        </label>
                        <input
                          disabled={locked}
                          value={offerData.number}
                          onChange={(e) => setOfferData({ ...offerData, number: e.target.value })}
                          className="mono text-xs w-full rounded px-2 py-1.5"
                          style={fieldReadStyle(locked)}
                          placeholder="OFR-4471"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] mb-1" style={{ color: tokens.textSecondary }}>
                          تاریخ سند آفر
                        </label>
                        <input
                          disabled={locked}
                          type="date"
                          value={offerData.docDate}
                          onChange={(e) => setOfferData({ ...offerData, docDate: e.target.value })}
                          className="mono text-xs w-full rounded px-2 py-1.5"
                          style={fieldReadStyle(locked)}
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] mb-1" style={{ color: tokens.textSecondary }}>
                          ارز پیشنهاد
                        </label>
                        <select
                          disabled={locked}
                          value={offerData.currency}
                          onChange={(e) => setOfferData({ ...offerData, currency: e.target.value })}
                          className="text-xs w-full rounded px-2 py-1.5"
                          style={fieldReadStyle(locked)}
                        >
                          <option>EUR</option>
                          <option>USD</option>
                          <option>AED</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] mb-1" style={{ color: tokens.textSecondary }}>
                          شخص آفردهنده
                        </label>
                        <input
                          disabled={locked}
                          value={offerData.contact}
                          onChange={(e) => setOfferData({ ...offerData, contact: e.target.value })}
                          className="text-xs w-full rounded px-2 py-1.5"
                          style={fieldReadStyle(locked)}
                          placeholder="نام تماس"
                        />
                      </div>
                    </div>

                    <div className="space-y-2.5 mb-1">
                      {offerData.rows.map((row, idx) => {
                        const lineTotal = (parseFloat(row.price) || 0) * (row.qty || 0);
                        return (
                          <div
                            key={row.item}
                            className="rounded-md p-2.5"
                            style={{ border: `1px solid ${tokens.border}`, background: tokens.surface }}
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="mono text-xs font-semibold" style={{ color: tokens.textPrimary }}>
                                {row.item}
                              </span>
                              <span className="mono text-xs" style={{ color: tokens.textSecondary }}>
                                {row.qty} {row.unit}
                              </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 mb-2">
                              <div>
                                <label className="block text-[10px] mb-1" style={{ color: tokens.textSecondary }}>
                                  پارت‌نامبر تأمین‌کننده
                                </label>
                                <input
                                  disabled={locked}
                                  value={row.partNumber}
                                  onChange={(e) => updateOfferRow(idx, "partNumber", e.target.value)}
                                  className="mono w-full rounded px-2 py-1.5"
                                  style={fieldReadStyle(locked)}
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] mb-1" style={{ color: tokens.textSecondary }}>
                                  فی واحد
                                </label>
                                <input
                                  disabled={locked}
                                  value={row.price}
                                  onChange={(e) => updateOfferRow(idx, "price", e.target.value)}
                                  className="mono w-full rounded px-2 py-1.5"
                                  style={fieldReadStyle(locked)}
                                  placeholder="0.00"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] mb-1" style={{ color: tokens.textSecondary }}>
                                  زمان تحویل (روز)
                                </label>
                                <input
                                  disabled={locked}
                                  value={row.delivery}
                                  onChange={(e) => updateOfferRow(idx, "delivery", e.target.value)}
                                  className="mono w-full rounded px-2 py-1.5"
                                  style={fieldReadStyle(locked)}
                                />
                              </div>
                            </div>
                            <div className="flex items-center gap-3 mb-2">
                              <label className="flex items-center gap-2 text-[11px]" style={{ color: tokens.textPrimary }}>
                                <input
                                  type="checkbox"
                                  disabled={locked}
                                  checked={row.isEquivalent}
                                  onChange={(e) => updateOfferRow(idx, "isEquivalent", e.target.checked)}
                                  className="w-3.5 h-3.5"
                                />
                                کالای معادل پیشنهاد شده است
                              </label>
                              <div className="flex items-center gap-1.5 mr-auto">
                                <label className="text-[11px]" style={{ color: tokens.textSecondary }}>
                                  کشور سازنده:
                                </label>
                                <input
                                  disabled={locked}
                                  value={row.countryOfOrigin}
                                  onChange={(e) => updateOfferRow(idx, "countryOfOrigin", e.target.value)}
                                  className="text-[11px] w-24 rounded px-2 py-1"
                                  style={fieldReadStyle(locked)}
                                  placeholder="مثلاً آلمان"
                                />
                              </div>
                            </div>
                            <div className="mb-2">
                              <label className="block text-[10px] mb-1" style={{ color: tokens.textSecondary }}>
                                شرح کالا و مشخصات فنی ارائه‌شده
                              </label>
                              <textarea
                                disabled={locked}
                                rows={2}
                                value={row.techSpec}
                                onChange={(e) => updateOfferRow(idx, "techSpec", e.target.value)}
                                className="w-full rounded px-2 py-1.5 text-xs resize-none"
                                style={fieldReadStyle(locked)}
                                placeholder="برای استفاده در تهیه پیشنهاد فنی به مشتری..."
                              />
                            </div>
                            <div className="flex items-center justify-between">
                              <button
                                type="button"
                                disabled={locked}
                                className="flex items-center gap-1.5 text-[11px] px-2 py-1 rounded"
                                style={{
                                  color: locked ? tokens.textSecondary : tokens.accent,
                                  background: locked ? "transparent" : tokens.accentSoft,
                                }}
                              >
                                <FileText size={12} /> پیوست دیتاشیت/کاتالوگ
                              </button>
                              <span className="mono text-xs font-medium" style={{ color: tokens.textPrimary }}>
                                جمع ردیف: {fmt(lineTotal)} {offerData.currency}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* VAT و سایر هزینه‌ها */}
                    <div
                      className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3 pt-3"
                      style={{ borderTop: `1px dashed ${tokens.border}` }}
                    >
                      <div>
                        <label className="flex items-center gap-2 text-xs mb-1.5" style={{ color: tokens.textPrimary }}>
                          <input
                            type="checkbox"
                            disabled={locked}
                            checked={offerData.vatApplicable}
                            onChange={(e) =>
                              setOfferData({ ...offerData, vatApplicable: e.target.checked })
                            }
                            className="w-3.5 h-3.5"
                          />
                          VAT (مالیات بر ارزش افزوده) اعمال می‌شود
                        </label>
                        {offerData.vatApplicable && (
                          <div className="flex items-center gap-1.5">
                            <input
                              disabled={locked}
                              value={offerData.vatRate}
                              onChange={(e) => setOfferData({ ...offerData, vatRate: e.target.value })}
                              className="mono w-16 rounded px-2 py-1.5 text-xs"
                              style={fieldReadStyle(locked)}
                            />
                            <span className="text-xs" style={{ color: tokens.textSecondary }}>
                              درصد VAT
                            </span>
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="block text-xs mb-1.5" style={{ color: tokens.textPrimary }}>
                          سایر هزینه‌ها (حمل، بسته‌بندی و ...)
                        </label>
                        <input
                          disabled={locked}
                          value={offerData.otherCosts}
                          onChange={(e) => setOfferData({ ...offerData, otherCosts: e.target.value })}
                          className="mono w-full rounded px-2 py-1.5 text-xs"
                          style={fieldReadStyle(locked)}
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div className="mt-3">
                      <label className="block text-xs mb-1.5" style={{ color: tokens.textPrimary }}>
                        سایر ملاحظات (مربوط به کل آفر، نه یک قلم خاص)
                      </label>
                      <textarea
                        disabled={locked}
                        rows={2}
                        value={offerData.generalRemarks}
                        onChange={(e) => setOfferData({ ...offerData, generalRemarks: e.target.value })}
                        className="w-full rounded-md px-3 py-2 text-xs resize-none"
                        style={fieldReadStyle(locked)}
                        placeholder="مثلاً شرایط گارانتی عمومی، بسته‌بندی استاندارد و..."
                      />
                    </div>

                    {/* جمع‌بندی نهایی پیش‌فاکتور */}
                    <div
                      className="rounded-md mt-3 p-3 space-y-1"
                      style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}
                    >
                      <div className="flex justify-between text-xs" style={{ color: tokens.textSecondary }}>
                        <span>جمع ارزش کالاها</span>
                        <span className="mono">
                          {fmt(subTotal)} {offerData.currency}
                        </span>
                      </div>
                      {offerData.vatApplicable && (
                        <div className="flex justify-between text-xs" style={{ color: tokens.textSecondary }}>
                          <span>VAT ({offerData.vatRate || 0}٪)</span>
                          <span className="mono">
                            {fmt(vatAmount)} {offerData.currency}
                          </span>
                        </div>
                      )}
                      {otherCostsAmount > 0 && (
                        <div className="flex justify-between text-xs" style={{ color: tokens.textSecondary }}>
                          <span>سایر هزینه‌ها</span>
                          <span className="mono">
                            {fmt(otherCostsAmount)} {offerData.currency}
                          </span>
                        </div>
                      )}
                      <div
                        className="flex justify-between text-sm font-semibold pt-1.5 mt-1"
                        style={{ color: tokens.textPrimary, borderTop: `1px solid ${tokens.border}` }}
                      >
                        <span>جمع کل پیش‌فاکتور</span>
                        <span className="mono">
                          {fmt(grandTotal)} {offerData.currency}
                        </span>
                      </div>
                    </div>
                  </>
                );
              })()}

              {!(status === "offer_received" && responseMode === null) && (
                <p className="text-[11px] mb-2 mt-2" style={{ color: tokens.textSecondary }}>
                  تاریخ دریافت این پاسخ نیازی به وارد کردن نداره — به‌محض ثبت، به‌صورت خودکار
                  (لحظه فعلی سرور) ذخیره می‌شه تا گزارش سرعت پاسخ‌دهی دقیق باشه.
                </p>
              )}

              <div className="flex items-center gap-2 mt-2">
                <button
                  type="button"
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md"
                  style={{ color: tokens.textSecondary, border: `1px solid ${tokens.border}` }}
                >
                  <FileText size={13} /> پیوست فایل آفر
                </button>
                {responseMode === "offer" && (
                  <>
                    <button
                      type="button"
                      onClick={saveOffer}
                      className="text-xs px-3 py-1.5 rounded-md text-white"
                      style={{ background: tokens.success }}
                    >
                      ثبت پیشنهاد
                    </button>
                    <button
                      type="button"
                      onClick={cancelToChoose}
                      className="text-xs px-3 py-1.5 rounded-md"
                      style={{ color: tokens.textSecondary }}
                    >
                      بازگشت
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SelectionTab() {
  const offers = [
    {
      id: "o1",
      supplier: "Schaeffler Group — آلمان",
      currency: "EUR",
      vatApplicable: false,
      vatRate: 0,
      otherCosts: 120,
      items: [{ code: "BRG-6205-2RS", price: 4.2, delivery: 18, partNumber: "6205-2RS-C3" }],
    },
    {
      id: "o2",
      supplier: "SKF Distribution — هلند",
      currency: "EUR",
      vatApplicable: true,
      vatRate: 19,
      otherCosts: 40,
      items: [
        { code: "BRG-6205-2RS", price: 4.5, delivery: 25, partNumber: "SKF-6205-2RSH" },
        { code: "SEAL-NBR-45", price: 1.1, delivery: 25, partNumber: "SKF-CR-45x65x8" },
      ],
    },
  ];

  const [distribute, setDistribute] = useState({ o1: false, o2: false });
  const [selection, setSelection] = useState({
    "BRG-6205-2RS": "o1",
    "SEAL-NBR-45": "o2",
  });
  const [markup, setMarkup] = useState({ "BRG-6205-2RS": "22", "SEAL-NBR-45": "25" });
  const [finalDelivery, setFinalDelivery] = useState("");
  const [deliveryOptions, setDeliveryOptions] = useState([
    { term: "EXW", extraCost: "0", days: "45" },
    { term: "CPT", extraCost: "180", days: "58" },
    { term: "DDP", extraCost: "410", days: "65" },
  ]);
  const [managerNote, setManagerNote] = useState("");
  const [locked, setLocked] = useState(false);

  const updateDeliveryOption = (idx, field, value) => {
    setDeliveryOptions((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };
  const addDeliveryOption = () =>
    setDeliveryOptions((prev) => [...prev, { term: "EXW", extraCost: "", days: "" }]);
  const removeDeliveryOption = (idx) =>
    setDeliveryOptions((prev) => prev.filter((_, i) => i !== idx));

  const fmt = (n) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

  const offerTotal = (offer) => offer.items.reduce((s, it) => s + it.price, 0);
  const offerVatAmount = (offer) =>
    offer.vatApplicable ? offerTotal(offer) * (offer.vatRate / 100) : 0;

  const effectivePrice = (offer, item) => {
    if (!distribute[offer.id]) return item.price;
    const extra = offer.otherCosts + offerVatAmount(offer);
    const share = (item.price / offerTotal(offer)) * extra;
    return item.price + share;
  };

  // جمع ارزش کالاها بر مبنای آفرهای منتخب و درصد سود هر قلم — مبنای «ارزش کل» هر گزینه ترم
  const baseItemsTotal = Object.entries(selection).reduce((sum, [itemCode, offerId]) => {
    const offer = offers.find((o) => o.id === offerId);
    if (!offer) return sum;
    const item = offer.items.find((it) => it.code === itemCode);
    const eff = effectivePrice(offer, item);
    const sale = eff * (1 + (parseFloat(markup[itemCode]) || 0) / 100);
    return sum + sale;
  }, 0);

  return (
    <div>
      <div
        className="rounded-md px-4 py-2.5 mb-4 text-xs flex items-center gap-2"
        style={{ background: tokens.accentSoft, color: tokens.textPrimary }}
      >
        این مرحله فقط در اختیار مدیریت/مدیر فروش است — همه‌ی آفرهای دریافتی مقایسه و آیتم برگزیده
        هر قلم انتخاب می‌شود.
      </div>

      {["BRG-6205-2RS", "SEAL-NBR-45", "BLT-M12-80"].map((itemCode) => {
        const itemInfo = inquiryItems.find((x) => x.code === itemCode);
        const relevantOffers = offers.filter((o) => o.items.some((it) => it.code === itemCode));

        return (
          <div
            key={itemCode}
            className="rounded-lg p-4 mb-4"
            style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}
          >
            <p className="text-sm font-semibold mb-3" style={{ color: tokens.textPrimary }}>
              <span className="mono ml-2" style={{ color: tokens.textSecondary }}>
                {itemCode}
              </span>
              {itemInfo?.desc}
            </p>

            {relevantOffers.length === 0 && (
              <p className="text-xs" style={{ color: tokens.danger }}>
                هنوز هیچ پیشنهاد قیمتی برای این قلم دریافت نشده — این قلم قابل قیمت‌گذاری نیست.
              </p>
            )}

            <div className="space-y-2">
              {relevantOffers.map((offer) => {
                const item = offer.items.find((it) => it.code === itemCode);
                const eff = effectivePrice(offer, item);
                const isChosen = selection[itemCode] === offer.id;
                return (
                  <label
                    key={offer.id}
                    className="flex flex-wrap items-center gap-3 rounded-md px-3 py-2.5 cursor-pointer"
                    style={{
                      background: isChosen ? tokens.successSoft : tokens.bg,
                      border: isChosen ? `1px solid ${tokens.success}` : "1px solid transparent",
                    }}
                  >
                    <input
                      type="radio"
                      disabled={locked}
                      name={`select-${itemCode}`}
                      checked={isChosen}
                      onChange={() => setSelection({ ...selection, [itemCode]: offer.id })}
                      className="w-4 h-4"
                    />
                    <span className="text-xs font-medium" style={{ color: tokens.textPrimary }}>
                      {offer.supplier}
                    </span>
                    <span className="mono text-xs" style={{ color: tokens.textSecondary }}>
                      PN: {item.partNumber}
                    </span>
                    <span className="mono text-xs" style={{ color: tokens.textSecondary }}>
                      فی: {fmt(item.price)} {offer.currency}
                    </span>
                    <span className="mono text-xs" style={{ color: tokens.textSecondary }}>
                      تحویل تأمین‌کننده: {item.delivery} روز
                    </span>
                    {distribute[offer.id] && (
                      <span className="mono text-xs font-semibold" style={{ color: tokens.accent }}>
                        فی مؤثر (با سهم هزینه‌ها): {fmt(eff)} {offer.currency}
                      </span>
                    )}
                    <label
                      className="flex items-center gap-1.5 text-[11px] mr-auto"
                      style={{ color: tokens.textSecondary }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        disabled={locked}
                        checked={distribute[offer.id]}
                        onChange={(e) =>
                          setDistribute({ ...distribute, [offer.id]: e.target.checked })
                        }
                        className="w-3.5 h-3.5"
                      />
                      توزیع هزینه‌های اضافی این آفر (VAT + سایر هزینه‌ها) به نسبت بین اقلام
                    </label>
                  </label>
                );
              })}
            </div>

            {selection[itemCode] && (
              <div className="flex items-center gap-2 mt-3 pt-3" style={{ borderTop: `1px dashed ${tokens.border}` }}>
                <label className="text-xs" style={{ color: tokens.textSecondary }}>
                  درصد حاشیه سود این قلم:
                </label>
                <input
                  disabled={locked}
                  value={markup[itemCode] || ""}
                  onChange={(e) => setMarkup({ ...markup, [itemCode]: e.target.value })}
                  className="mono w-16 rounded px-2 py-1 text-xs"
                  style={{ border: `1px solid ${tokens.border}` }}
                />
                <span className="text-xs" style={{ color: tokens.textSecondary }}>٪</span>
                {(() => {
                  const offer = offers.find((o) => o.id === selection[itemCode]);
                  const item = offer.items.find((it) => it.code === itemCode);
                  const eff = effectivePrice(offer, item);
                  const sale = eff * (1 + (parseFloat(markup[itemCode]) || 0) / 100);
                  return (
                    <span className="mono text-xs font-semibold mr-auto" style={{ color: tokens.primary }}>
                      قیمت فروش نهایی: {fmt(sale)} {offer.currency}
                    </span>
                  );
                })()}
              </div>
            )}
          </div>
        );
      })}

      {/* گزینه‌های ترم تحویل — امکان ارائه چند ترم هم‌زمان به مشتری */}
      <div
        className="rounded-lg p-4 mb-4"
        style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}
      >
        <p className="text-sm font-semibold mb-1" style={{ color: tokens.textPrimary }}>
          گزینه‌های ترم تحویل به مشتری
        </p>
        <p className="text-xs mb-3" style={{ color: tokens.textSecondary }}>
          می‌تونی چند ترم هم‌زمان پیشنهاد بدی (مثلاً هم EXW هم CPT هم DDP) — هرکدوم هزینه اضافه و
          زمان تحویل مخصوص خودشو داره. حداکثر زمان تحویل تأمین‌کنندگان منتخب ۲۵ روزه؛ عدد نهایی هر
          ترم با احتساب تجربه حمل/ترخیص/سفارش‌گذاری توسط مدیریت وارد می‌شه.
        </p>

        <div className="space-y-2 mb-3">
          {deliveryOptions.map((opt, idx) => {
            const totalForTerm = baseItemsTotal + (parseFloat(opt.extraCost) || 0);
            return (
              <div
                key={idx}
                className="flex flex-wrap items-center gap-2 rounded-md px-3 py-2"
                style={{ background: tokens.bg }}
              >
                <select
                  disabled={locked}
                  value={opt.term}
                  onChange={(e) => updateDeliveryOption(idx, "term", e.target.value)}
                  className="text-xs rounded px-2 py-1.5"
                  style={{ border: `1px solid ${tokens.border}` }}
                >
                  <option value="EXW">EXW</option>
                  <option value="CPT">CPT</option>
                  <option value="DDP">DDP</option>
                  <option value="CIF">CIF</option>
                  <option value="FOB">FOB</option>
                </select>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px]" style={{ color: tokens.textSecondary }}>
                    هزینه اضافه این ترم:
                  </span>
                  <input
                    disabled={locked}
                    value={opt.extraCost}
                    onChange={(e) => updateDeliveryOption(idx, "extraCost", e.target.value)}
                    className="mono w-20 rounded px-2 py-1 text-xs"
                    style={{ border: `1px solid ${tokens.border}` }}
                    placeholder="0.00"
                  />
                  <span className="mono text-[11px]" style={{ color: tokens.textSecondary }}>
                    EUR
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px]" style={{ color: tokens.textSecondary }}>
                    زمان تحویل این ترم:
                  </span>
                  <input
                    disabled={locked}
                    value={opt.days}
                    onChange={(e) => updateDeliveryOption(idx, "days", e.target.value)}
                    className="mono w-14 rounded px-2 py-1 text-xs"
                    style={{ border: `1px solid ${tokens.border}` }}
                    placeholder="۶۰"
                  />
                  <span className="text-[11px]" style={{ color: tokens.textSecondary }}>روز</span>
                </div>
                <span
                  className="mono text-xs font-semibold px-2 py-1 rounded"
                  style={{ background: tokens.accentSoft, color: tokens.accent }}
                >
                  ارزش کل: {fmt(totalForTerm)} EUR
                </span>
                {!locked && (
                  <button
                    type="button"
                    onClick={() => removeDeliveryOption(idx)}
                    className="mr-auto"
                    style={{ color: tokens.danger }}
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {!locked && (
          <button
            type="button"
            onClick={addDeliveryOption}
            className="text-xs px-3 py-1.5 rounded-md"
            style={{ color: tokens.primary, border: `1px solid ${tokens.primary}` }}
          >
            + افزودن گزینه ترم دیگر
          </button>
        )}
      </div>

      {/* کامنت مدیر برای بخش فروش */}
      <div
        className="rounded-lg p-4 mb-4"
        style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}
      >
        <p className="text-sm font-semibold mb-1" style={{ color: tokens.textPrimary }}>
          یادداشت مدیر برای بخش فروش
        </p>
        <p className="text-xs mb-3" style={{ color: tokens.textSecondary }}>
          این یادداشت وقتی کارشناس فروش وارد تب «پیشنهاد به مشتری» بشه بهش نشون داده می‌شه (مثلاً
          ملاحظات خاص مربوط به شرایط این معامله):
        </p>
        <textarea
          disabled={locked}
          rows={2}
          value={managerNote}
          onChange={(e) => setManagerNote(e.target.value)}
          className="w-full rounded-md px-3 py-2 text-sm resize-none"
          style={{ border: `1px solid ${tokens.border}` }}
          placeholder="یادداشت برای کارشناس فروش..."
        />
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setLocked(!locked)}
          className="px-5 py-2.5 rounded-md text-sm font-medium text-white"
          style={{ background: locked ? tokens.textSecondary : tokens.success }}
        >
          {locked ? "بازگشایی برای اصلاح" : "تأیید و قفل انتخاب نهایی"}
        </button>
      </div>
      {locked && (
        <p className="text-xs mt-2 text-left" style={{ color: tokens.success }}>
          ✓ این مرحله قفل شد؛ کارشناس فروش حالا می‌تونه پیشنهاد مالی/فنی رو تولید کنه.
        </p>
      )}
    </div>
  );
}

function ProposalTab() {
  const finalized = [
    {
      code: "BRG-6205-2RS",
      desc: "بلبرینگ ساچمه‌ای شیار عمیق 6205",
      supplier: "Schaeffler Group",
      basePrice: 5.12,
      currency: "EUR",
      partNumber: "6205-2RS-C3",
      techSpec: "بلبرینگ شیار عمیق، دو درپوش لاستیکی، رواداری C3",
      isEquivalent: false,
    },
    {
      code: "SEAL-NBR-45",
      desc: "کاسه‌نمد لاستیکی NBR سایز 45",
      supplier: "SKF Distribution",
      basePrice: 1.72,
      currency: "EUR",
      partNumber: "SKF-CR-45x65x8",
      techSpec: "کاسه‌نمد تک‌لبه با فنر، جنس NBR، دمای کاری تا ۱۰۰ درجه",
      isEquivalent: true,
    },
  ];

  const deliveryOptions = [
    { term: "EXW", extraCost: 0, days: 45 },
    { term: "CPT", extraCost: 180, days: 58 },
    { term: "DDP", extraCost: 410, days: 65 },
  ];

  const [selectedTerm, setSelectedTerm] = useState("CPT");
  const [proposalPrices, setProposalPrices] = useState(
    Object.fromEntries(finalized.map((r) => [r.code, r.basePrice.toFixed(2)]))
  );

  const fmt = (n) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });
  const chosenOption = deliveryOptions.find((o) => o.term === selectedTerm);

  const itemsTotal = finalized.reduce(
    (sum, row) => sum + (parseFloat(proposalPrices[row.code]) || 0),
    0
  );
  const [deliveryDays, setDeliveryDays] = useState(chosenOption.days);
  const handleTermChange = (term) => {
    setSelectedTerm(term);
    setDeliveryDays(deliveryOptions.find((o) => o.term === term).days);
  };
  const [submitted, setSubmitted] = useState(false);

  return (
    <div>
      <div
        className="rounded-md px-4 py-2.5 mb-5 text-xs flex items-center gap-2"
        style={{ background: tokens.successSoft, color: tokens.textPrimary }}
      >
        <Check size={14} style={{ color: tokens.success }} /> انتخاب نهایی و قیمت‌گذاری توسط مدیریت
        قفل شده — این بخش الان در اختیار کارشناس فروش برای تولید پیشنهاد است.
      </div>

      <div
        className="rounded-md px-4 py-2.5 mb-5 text-xs"
        style={{ background: tokens.accentSoft, color: tokens.textPrimary }}
      >
        <span className="font-medium">یادداشت مدیر: </span>
        در صورت فروش به این مشتری، شرایط گارانتی استاندارد ۱۲ ماهه اعمال بشه و روی پرداخت اقساطی
        بیشتر از دو مرحله مذاکره نشه.
      </div>

      <div
        className="rounded-lg p-4 mb-5"
        style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}
      >
        <p className="text-sm font-semibold mb-3" style={{ color: tokens.textPrimary }}>
          قیمت پایه و مشخصات نهایی (فقط‌خواندنی — از مرحله «انتخاب نهایی»، تغییرناپذیر)
        </p>
        <div className="space-y-1.5 mb-3">
          {finalized.map((row) => (
            <div
              key={row.code}
              className="flex flex-wrap items-center gap-3 rounded-md px-3 py-2"
              style={{ background: tokens.bg }}
            >
              <span className="mono text-xs" style={{ color: tokens.textSecondary }}>
                {row.code}
              </span>
              <span className="text-xs" style={{ color: tokens.textPrimary }}>
                {row.desc}
              </span>
              <span
                className="text-[11px] px-2 py-0.5 rounded-full mr-auto"
                style={{ background: tokens.successSoft, color: tokens.success }}
              >
                {row.supplier}
              </span>
              <span className="mono text-xs font-semibold" style={{ color: tokens.primary }}>
                قیمت پایه: {fmt(row.basePrice)} {row.currency}
              </span>
            </div>
          ))}
        </div>
        <p className="text-xs font-medium mb-1.5" style={{ color: tokens.textSecondary }}>
          گزینه‌های ترم تحویل تعیین‌شده توسط مدیریت:
        </p>
        <div className="flex flex-wrap gap-2">
          {[
            { term: "EXW", extraCost: "0", days: "45" },
            { term: "CPT", extraCost: "180", days: "58" },
            { term: "DDP", extraCost: "410", days: "65" },
          ].map((opt) => (
            <span
              key={opt.term}
              className="mono text-xs px-2.5 py-1 rounded-md"
              style={{ background: tokens.bg, color: tokens.textPrimary }}
            >
              {opt.term}: +{opt.extraCost}€ · {opt.days} روز
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* پیشنهاد مالی */}
        <div className="rounded-lg p-4" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>
              پیشنهاد مالی
            </p>
            <span
              className="mono text-[11px] px-2 py-0.5 rounded-full"
              style={{ background: tokens.accentSoft, color: tokens.accent }}
            >
              نسخه ۲ · فعلی
            </span>
          </div>

          <label className="block text-[11px] mb-1" style={{ color: tokens.textSecondary }}>
            ترم تحویل این پیشنهاد
          </label>
          <select
            value={selectedTerm}
            disabled={submitted}
            onChange={(e) => handleTermChange(e.target.value)}
            className="text-xs w-full rounded px-2 py-1.5 mb-2"
            style={{ border: `1px solid ${tokens.border}` }}
          >
            {deliveryOptions.map((o) => (
              <option key={o.term} value={o.term}>
                {o.term} — ارزش کل {fmt(itemsTotal + o.extraCost)}€
              </option>
            ))}
          </select>
          <div
            className="rounded-md px-3 py-2 mb-3 flex items-center justify-between gap-2"
            style={{ background: tokens.accentSoft }}
          >
            <span className="text-xs" style={{ color: tokens.textPrimary }}>
              زمان تحویل این پیشنهاد (ترم {selectedTerm})
            </span>
            <div className="flex items-center gap-1.5">
              <input
                value={deliveryDays}
                disabled={submitted}
                onChange={(e) => setDeliveryDays(e.target.value)}
                className="mono w-14 rounded px-2 py-1 text-xs font-semibold text-left"
                style={{
                  border: `1px solid ${
                    String(deliveryDays) !== String(chosenOption.days)
                      ? tokens.accent
                      : tokens.border
                  }`,
                  color:
                    String(deliveryDays) !== String(chosenOption.days)
                      ? tokens.accent
                      : tokens.textPrimary,
                }}
              />
              <span className="text-xs" style={{ color: tokens.textSecondary }}>روز</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 mb-3">
            <div>
              <label className="block text-[11px] mb-1" style={{ color: tokens.textSecondary }}>
                ارز فروش
              </label>
              <select
                className="text-xs w-full rounded px-2 py-1.5"
                style={{ border: `1px solid ${tokens.border}` }}
              >
                <option>EUR</option>
                <option>USD</option>
                <option>IRR</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] mb-1" style={{ color: tokens.textSecondary }}>
                اعتبار پیشنهاد تا
              </label>
              <input
                type="date"
                className="mono text-xs w-full rounded px-2 py-1.5"
                style={{ border: `1px solid ${tokens.border}` }}
              />
            </div>
          </div>

          <p className="text-[11px] font-medium mb-1.5" style={{ color: tokens.textSecondary }}>
            قیمت نهایی این پیشنهاد به مشتری (قابل‌اصلاح بر اساس مذاکره)
          </p>
          <div className="space-y-1.5 mb-3">
            {finalized.map((row) => (
              <div
                key={row.code}
                className="flex items-center gap-2 rounded-md px-2.5 py-2"
                style={{ background: tokens.bg }}
              >
                <span className="mono text-xs flex-1" style={{ color: tokens.textPrimary }}>
                  {row.code}
                </span>
                <span className="text-[11px]" style={{ color: tokens.textSecondary }}>
                  پایه: {fmt(row.basePrice)}
                </span>
                <input
                  value={proposalPrices[row.code]}
                  disabled={submitted}
                  onChange={(e) =>
                    setProposalPrices({ ...proposalPrices, [row.code]: e.target.value })
                  }
                  className="mono w-20 rounded px-2 py-1 text-xs font-semibold"
                  style={{
                    border: `1px solid ${
                      parseFloat(proposalPrices[row.code]) !== row.basePrice
                        ? tokens.accent
                        : tokens.border
                    }`,
                    color:
                      parseFloat(proposalPrices[row.code]) !== row.basePrice
                        ? tokens.accent
                        : tokens.textPrimary,
                  }}
                />
                <span className="text-[11px]" style={{ color: tokens.textSecondary }}>
                  {row.currency}
                </span>
              </div>
            ))}
          </div>
          <p className="text-[11px] mb-3" style={{ color: tokens.textSecondary }}>
            ⚠️ این ستون قیمت مخصوص همین نسخه پیشنهاده و مستقل از قیمت پایه مدیریته. اگه مذاکره
            ادامه داشت، نسخه بعدی (نسخه ۳) با قیمت‌های جدید ساخته می‌شه و این نسخه به تاریخچه
            می‌ره — قیمت پایه هیچ‌وقت پاک نمی‌شه.
          </p>

          <label className="block text-[11px] mb-1" style={{ color: tokens.textSecondary }}>
            شرایط پرداخت پیشنهادی به مشتری
          </label>
          <textarea
            rows={2}
            className="w-full rounded-md px-3 py-2 text-xs resize-none mb-3"
            style={{ border: `1px solid ${tokens.border}` }}
            placeholder="مثلاً ۳۰٪ پیش‌پرداخت، مانده در مقابل اسناد حمل"
          />
          <label className="block text-[11px] mb-1" style={{ color: tokens.textSecondary }}>
            یادداشت مذاکره (نسبت به نسخه قبل چه تغییری کرد؟)
          </label>
          <textarea
            rows={2}
            className="w-full rounded-md px-3 py-2 text-xs resize-none mb-3"
            style={{ border: `1px solid ${tokens.border}` }}
            placeholder="مثلاً: با درخواست مشتری، ۳٪ تخفیف روی کاسه‌نمد اعمال شد"
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-md text-white"
              style={{ background: tokens.primary }}
            >
              <FileText size={13} /> تولید فایل مالی (PDF/Word)
            </button>
            <button
              type="button"
              className="text-xs px-3 py-2 rounded-md"
              style={{ color: tokens.textSecondary, border: `1px solid ${tokens.border}` }}
            >
              تاریخچه نسخه‌ها (۲)
            </button>
          </div>
        </div>

        {/* پیشنهاد فنی */}
        <div className="rounded-lg p-4" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>
              پیشنهاد فنی
            </p>
            <span
              className="mono text-[11px] px-2 py-0.5 rounded-full"
              style={{ background: tokens.accentSoft, color: tokens.accent }}
            >
              نسخه ۱ · فعلی
            </span>
          </div>
          <label className="block text-[11px] mb-1" style={{ color: tokens.textSecondary }}>
            زمان تحویل تخمینی به مشتری (روز)
          </label>
          <div
            className="rounded-md px-3 py-2 mb-3 text-xs flex items-center justify-between"
            style={{ background: tokens.bg }}
          >
            <span style={{ color: tokens.textSecondary }}>
              همگام با پیشنهاد مالی (ترم {selectedTerm})
            </span>
            <span className="mono font-semibold" style={{ color: tokens.textPrimary }}>
              {deliveryDays} روز
            </span>
          </div>

          <p className="text-[11px] font-medium mb-1.5" style={{ color: tokens.textSecondary }}>
            مشخصات فنی — خودکار از آفر منتخب هر قلم
          </p>
          <div className="space-y-1.5 mb-3">
            {finalized
              .filter((r) => r.partNumber)
              .map((row) => (
                <div key={row.code} className="rounded-md px-2.5 py-2" style={{ background: tokens.bg }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="mono text-xs" style={{ color: tokens.textPrimary }}>
                      {row.code}
                    </span>
                    {row.isEquivalent && (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{ background: tokens.warningSoft, color: tokens.warning }}
                      >
                        کالای معادل
                      </span>
                    )}
                  </div>
                  <p className="text-[11px]" style={{ color: tokens.textSecondary }}>
                    PN: {row.partNumber} — {row.techSpec}
                  </p>
                </div>
              ))}
          </div>

          <label className="block text-[11px] mb-1" style={{ color: tokens.textSecondary }}>
            یادداشت مذاکره
          </label>
          <textarea
            rows={2}
            className="w-full rounded-md px-3 py-2 text-xs resize-none mb-3"
            style={{ border: `1px solid ${tokens.border}` }}
          />
          <div className="flex gap-2">
            <button
              type="button"
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-md text-white"
              style={{ background: tokens.primary }}
            >
              <FileText size={13} /> تولید فایل فنی (PDF/Word)
            </button>
            <button
              type="button"
              className="text-xs px-3 py-2 rounded-md"
              style={{ color: tokens.textSecondary, border: `1px solid ${tokens.border}` }}
            >
              تاریخچه نسخه‌ها (۱)
            </button>
          </div>
        </div>
      </div>

      {!submitted ? (
        <div className="flex justify-end mt-5">
          <button
            type="button"
            onClick={() => setSubmitted(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-md text-sm font-medium text-white"
            style={{ background: tokens.success }}
          >
            <Send size={14} /> فایل‌ها ارسال شد — منتظر نتیجه بمانیم
          </button>
        </div>
      ) : (
        <div
          className="rounded-lg p-4 mt-5 flex flex-wrap items-center justify-between gap-3"
          style={{ background: tokens.successSoft }}
        >
          <div className="flex items-center gap-2 text-sm" style={{ color: tokens.success }}>
            <Check size={16} /> فایل‌های مالی و فنی برای مشتری ارسال شد — در انتظار نتیجه
            مناقصه/استعلام (مرحله ۷)
          </div>
          <button
            type="button"
            onClick={() => setSubmitted(false)}
            className="text-xs px-3 py-2 rounded-md"
            style={{ color: tokens.textPrimary, border: `1px solid ${tokens.textSecondary}` }}
          >
            اصلاح فایل‌ها/قیمت‌ها (ساخت نسخه جدید)
          </button>
        </div>
      )}
    </div>
  );
}

const OUTCOME_ITEMS = [
  { code: "BRG-6205-2RS", desc: "بلبرینگ ساچمه‌ای شیار عمیق 6205", qty: 20, unit: "عدد" },
  { code: "SEAL-NBR-45", desc: "کاسه‌نمد لاستیکی NBR سایز 45", qty: 50, unit: "عدد" },
  { code: "BLT-M12-80", desc: "پیچ آلن سرخود M12x80 گرید 12.9", qty: 200, unit: "عدد" },
];

const MODE_META = {
  won_all: { label: "برد کامل", color: tokens.success, bg: tokens.successSoft },
  lost_all: { label: "باخت کامل", color: tokens.danger, bg: "#F3E6E4" },
  cancelled: { label: "لغو شده", color: tokens.textSecondary, bg: tokens.bg },
  mixed: { label: "ترکیبی (بخشی برد، بخشی باخت)", color: tokens.accent, bg: tokens.accentSoft },
};

function OutcomeTab() {
  const [mode, setMode] = useState(null);
  const [saved, setSaved] = useState(false);
  const [decisionDate, setDecisionDate] = useState("");
  const [winReason, setWinReason] = useState("");
  const [lossReason, setLossReason] = useState("");
  const [competitorName, setCompetitorName] = useState("");
  const [competitorPrice, setCompetitorPrice] = useState("");
  const [note, setNote] = useState("");
  const [itemGroup, setItemGroup] = useState(
    Object.fromEntries(OUTCOME_ITEMS.map((it) => [it.code, "won"]))
  );

  const toggleItemGroup = (code) =>
    setItemGroup((prev) => ({ ...prev, [code]: prev[code] === "won" ? "lost" : "won" }));

  const wonItems =
    mode === "won_all"
      ? OUTCOME_ITEMS
      : mode === "mixed"
      ? OUTCOME_ITEMS.filter((it) => itemGroup[it.code] === "won")
      : [];
  const lostItems =
    mode === "lost_all"
      ? OUTCOME_ITEMS
      : mode === "mixed"
      ? OUTCOME_ITEMS.filter((it) => itemGroup[it.code] === "lost")
      : [];

  if (saved) {
    const m = MODE_META[mode];
    return (
      <div className="rounded-lg p-6" style={{ background: m.bg, border: `1px solid ${tokens.border}` }}>
        <div className="flex items-center justify-between mb-3">
          <span className="text-base font-semibold" style={{ color: m.color }}>
            نتیجه ثبت شد: {m.label}
          </span>
          <button
            type="button"
            onClick={() => setSaved(false)}
            className="text-xs underline"
            style={{ color: tokens.textSecondary }}
          >
            اصلاح نتیجه
          </button>
        </div>
        {wonItems.length > 0 && (
          <p className="text-xs mb-1" style={{ color: tokens.textSecondary }}>
            برنده: {wonItems.map((i) => `${i.code} (${i.qty} ${i.unit})`).join("، ")}
            {winReason && ` — دلیل: ${winReason}`}
          </p>
        )}
        {lostItems.length > 0 && (
          <p className="text-xs mb-1" style={{ color: tokens.textSecondary }}>
            بازنده: {lostItems.map((i) => `${i.code} (${i.qty} ${i.unit})`).join("، ")}
            {lossReason && ` — دلیل: ${lossReason}`}
            {competitorName && ` (رقیب: ${competitorName})`}
          </p>
        )}
        {wonItems.length > 0 && (
          <div
            className="mt-4 rounded-md px-3 py-2 text-xs"
            style={{ background: tokens.surface, color: tokens.textPrimary }}
          >
            ✓ تب «سفارش و اجرا» برای {wonItems.length} قلم برنده‌شده فعال شد.
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div
        className="rounded-md px-4 py-2.5 mb-5 text-xs"
        style={{ background: tokens.accentSoft, color: tokens.textPrimary }}
      >
        برای جلوگیری از طولانی شدن ثبت، یکی از حالت‌های زیر رو انتخاب کن — نیازی به پر کردن دلیل
        جدا برای هر قلم نیست.
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {Object.entries(MODE_META).map(([key, meta]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMode(key)}
            className="py-3 rounded-md text-sm font-medium text-center"
            style={{
              background: mode === key ? meta.bg : tokens.surface,
              color: mode === key ? meta.color : tokens.textSecondary,
              border: `1.5px solid ${mode === key ? meta.color : tokens.border}`,
            }}
          >
            {meta.label}
          </button>
        ))}
      </div>

      {mode && (
        <div className="rounded-lg p-4 mb-4" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
          <label className="block text-[11px] mb-1" style={{ color: tokens.textSecondary }}>
            تاریخ اعلام نتیجه
          </label>
          <input
            type="date"
            value={decisionDate}
            onChange={(e) => setDecisionDate(e.target.value)}
            className="mono text-sm rounded-md px-3 py-2 mb-4"
            style={{ border: `1px solid ${tokens.border}` }}
          />

          {mode === "mixed" && (
            <div className="mb-4">
              <p className="text-xs mb-2" style={{ color: tokens.textSecondary }}>
                هر قلم رو با کلیک بین «برد» و «باخت» جابه‌جا کن:
              </p>
              <div className="space-y-1.5">
                {OUTCOME_ITEMS.map((it) => {
                  const isWon = itemGroup[it.code] === "won";
                  return (
                    <button
                      key={it.code}
                      type="button"
                      onClick={() => toggleItemGroup(it.code)}
                      className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-xs"
                      style={{
                        background: isWon ? tokens.successSoft : "#F3E6E4",
                        color: tokens.textPrimary,
                      }}
                    >
                      <span className="mono" style={{ color: tokens.textSecondary }}>
                        {it.code}
                      </span>
                      <span className="flex-1 text-right">{it.desc}</span>
                      <span className="mono" style={{ color: tokens.textSecondary }}>
                        {it.qty} {it.unit}
                      </span>
                      <span
                        className="font-semibold"
                        style={{ color: isWon ? tokens.success : tokens.danger }}
                      >
                        {isWon ? "برد" : "باخت"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {(mode === "won_all" || (mode === "mixed" && wonItems.length > 0)) && (
            <div className="mb-4 pt-3" style={{ borderTop: `1px dashed ${tokens.border}` }}>
              <p className="text-xs font-medium mb-1.5" style={{ color: tokens.success }}>
                دلیل برد {mode === "mixed" ? `(برای ${wonItems.length} قلم برنده)` : ""} — اختیاری
              </p>
              <input
                value={winReason}
                onChange={(e) => setWinReason(e.target.value)}
                className="w-full text-sm rounded-md px-3 py-2"
                style={{ border: `1px solid ${tokens.border}` }}
                placeholder="مثلاً زمان تحویل رقابتی‌تر، سابقه همکاری قبلی"
              />
            </div>
          )}

          {(mode === "lost_all" || (mode === "mixed" && lostItems.length > 0)) && (
            <div className="mb-2 pt-3" style={{ borderTop: `1px dashed ${tokens.border}` }}>
              <p className="text-xs font-medium mb-1.5" style={{ color: tokens.danger }}>
                دلیل باخت {mode === "mixed" ? `(برای ${lostItems.length} قلم بازنده)` : ""}
              </p>
              <select
                value={lossReason}
                onChange={(e) => setLossReason(e.target.value)}
                className="w-full text-sm rounded-md px-3 py-2 mb-2.5"
                style={{ border: `1px solid ${tokens.border}` }}
              >
                <option value="">انتخاب کنید...</option>
                <option value="قیمت بالاتر از رقیب">قیمت بالاتر از رقیب</option>
                <option value="زمان تحویل نامناسب">زمان تحویل نامناسب</option>
                <option value="عدم تطابق فنی">عدم تطابق فنی</option>
                <option value="تغییر نیاز مشتری">تغییر نیاز مشتری</option>
                <option value="لغو پروژه مشتری">لغو پروژه مشتری</option>
                <option value="سایر">سایر</option>
              </select>
              <div className="grid grid-cols-2 gap-2.5">
                <input
                  value={competitorName}
                  onChange={(e) => setCompetitorName(e.target.value)}
                  className="text-sm rounded-md px-3 py-2"
                  style={{ border: `1px solid ${tokens.border}` }}
                  placeholder="نام رقیب (اختیاری)"
                />
                <input
                  value={competitorPrice}
                  onChange={(e) => setCompetitorPrice(e.target.value)}
                  className="mono text-sm rounded-md px-3 py-2"
                  style={{ border: `1px solid ${tokens.border}` }}
                  placeholder="قیمت رقیب (اختیاری)"
                />
              </div>
            </div>
          )}

          <div className="pt-3 mt-2" style={{ borderTop: `1px dashed ${tokens.border}` }}>
            <label className="block text-[11px] mb-1" style={{ color: tokens.textSecondary }}>
              یادداشت آزاد
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full text-sm rounded-md px-3 py-2 resize-none"
              style={{ border: `1px solid ${tokens.border}` }}
            />
          </div>
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          disabled={!mode}
          onClick={() => setSaved(true)}
          className="px-5 py-2.5 rounded-md text-sm font-medium text-white"
          style={{ background: mode ? tokens.primary : tokens.textSecondary, opacity: mode ? 1 : 0.5 }}
        >
          ثبت نتیجه
        </button>
      </div>
    </div>
  );
}

function FlexPaymentList({ title, payments, setPayments, accentColor }) {
  const addRow = () =>
    setPayments([...payments, { desc: "", dueDate: "", amount: "", status: "unpaid" }]);
  const removeRow = (idx) => setPayments(payments.filter((_, i) => i !== idx));
  const updateRow = (idx, field, value) => {
    const next = [...payments];
    next[idx] = { ...next[idx], [field]: value };
    setPayments(next);
  };

  return (
    <div className="rounded-lg p-4" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
      <p className="text-sm font-semibold mb-3" style={{ color: tokens.textPrimary }}>
        {title}
      </p>
      <div className="space-y-2 mb-3">
        {payments.map((p, idx) => (
          <div key={idx} className="flex flex-wrap items-center gap-2 rounded-md px-2.5 py-2" style={{ background: tokens.bg }}>
            <input
              value={p.desc}
              onChange={(e) => updateRow(idx, "desc", e.target.value)}
              placeholder="شرح (مثلاً پیش‌پرداخت)"
              className="text-xs rounded px-2 py-1.5 flex-1 min-w-[120px]"
              style={{ border: `1px solid ${tokens.border}` }}
            />
            <input
              type="date"
              value={p.dueDate}
              onChange={(e) => updateRow(idx, "dueDate", e.target.value)}
              className="mono text-xs rounded px-2 py-1.5"
              style={{ border: `1px solid ${tokens.border}` }}
            />
            <input
              value={p.amount}
              onChange={(e) => updateRow(idx, "amount", e.target.value)}
              placeholder="مبلغ"
              className="mono text-xs rounded px-2 py-1.5 w-24"
              style={{ border: `1px solid ${tokens.border}` }}
            />
            <select
              value={p.status}
              onChange={(e) => updateRow(idx, "status", e.target.value)}
              className="text-xs rounded px-2 py-1.5"
              style={{ border: `1px solid ${tokens.border}` }}
            >
              <option value="unpaid">پرداخت‌نشده</option>
              <option value="in_progress">در حال انجام</option>
              <option value="completed">تکمیل‌شده</option>
            </select>
            <button
              type="button"
              className="flex items-center gap-1 text-[11px] px-2 py-1.5 rounded"
              style={{ color: accentColor, background: tokens.bg }}
              title="پیوست سند پرداخت"
            >
              <Paperclip size={12} /> سند پرداخت
            </button>
            <button type="button" onClick={() => removeRow(idx)} style={{ color: tokens.danger }}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addRow}
        className="text-xs px-3 py-1.5 rounded-md"
        style={{ color: accentColor, border: `1px solid ${accentColor}` }}
      >
        + افزودن ردیف پرداخت
      </button>
    </div>
  );
}

function OrderTab() {
  const wonItems = [
    { code: "BRG-6205-2RS", desc: "بلبرینگ ساچمه‌ای شیار عمیق 6205", qty: 20, unit: "عدد", supplier: "Schaeffler Group", purchasePrice: 5.12, salePrice: 5.98 },
    { code: "SEAL-NBR-45", desc: "کاسه‌نمد لاستیکی NBR سایز 45", qty: 50, unit: "عدد", supplier: "SKF Distribution", purchasePrice: 1.72, salePrice: 2.05 },
  ];
  const fmt = (n) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  const orderTotal = wonItems.reduce((s, it) => s + it.salePrice * it.qty, 0);

  const [customerPayments, setCustomerPayments] = useState([
    { desc: "پیش‌پرداخت ۳۰٪", dueDate: "", amount: fmt(orderTotal * 0.3), status: "unpaid" },
    { desc: "مانده در مقابل اسناد حمل", dueDate: "", amount: fmt(orderTotal * 0.7), status: "unpaid" },
  ]);
  const [guarantees, setGuarantees] = useState([
    { type: "advance_payment", amount: fmt(orderTotal * 0.3), bank: "", issueDate: "", expiryDate: "", status: "active" },
  ]);

  const updateGuarantee = (idx, field, value) => {
    const next = [...guarantees];
    next[idx] = { ...next[idx], [field]: value };
    setGuarantees(next);
  };

  return (
    <div>
      <div
        className="rounded-md px-4 py-2.5 mb-5 text-xs"
        style={{ background: tokens.successSoft, color: tokens.textPrimary }}
      >
        این مرحله فقط روی اقلامی اجرا می‌شه که در مرحله قبل نتیجه «برد» گرفتن ({wonItems.length}{" "}
        قلم از این استعلام). این بخش (سفارش مشتری) در اختیار <strong>فروش</strong> است؛ سفارش خرید
        از تأمین‌کننده (PO) در تب جدا و توسط <strong>بازرگانی/مدیریت</strong> ثبت می‌شه.
      </div>

      {/* اطلاعات سفارش و قرارداد */}
      <div className="rounded-lg p-4 mb-5" style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRight: `4px solid ${tokens.primary}` }}>
        <p className="text-sm font-semibold mb-3" style={{ color: tokens.textPrimary }}>
          اطلاعات سفارش و قرارداد
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-2">
          <div>
            <label className="block text-[11px] mb-1" style={{ color: tokens.textSecondary }}>شماره سفارش</label>
            <input className="mono text-xs w-full rounded px-2 py-1.5" style={{ border: `1px solid ${tokens.border}` }} placeholder="ORD-0417" />
          </div>
          <div>
            <label className="block text-[11px] mb-1" style={{ color: tokens.textSecondary }}>شماره قرارداد</label>
            <input className="mono text-xs w-full rounded px-2 py-1.5" style={{ border: `1px solid ${tokens.border}` }} />
          </div>
          <div>
            <label className="block text-[11px] mb-1" style={{ color: tokens.textSecondary }}>تاریخ قرارداد</label>
            <input type="date" className="mono text-xs w-full rounded px-2 py-1.5" style={{ border: `1px solid ${tokens.border}` }} />
          </div>
          <div>
            <label className="block text-[11px] mb-1" style={{ color: tokens.textSecondary }}>تاریخ تحویل تعهدشده</label>
            <input type="date" className="mono text-xs w-full rounded px-2 py-1.5" style={{ border: `1px solid ${tokens.border}` }} />
          </div>
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md mt-2"
          style={{ color: tokens.accent, background: tokens.accentSoft }}
        >
          <FileText size={13} /> پیوست فایل قرارداد
        </button>
      </div>

      {/* اقلام سفارش */}
      <div className="rounded-lg p-4 mb-5" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
        <p className="text-sm font-semibold mb-3" style={{ color: tokens.textPrimary }}>
          اقلام سفارش (فقط اقلام برنده)
        </p>
        <div className="space-y-1.5 mb-2">
          {wonItems.map((it) => (
            <div key={it.code} className="flex flex-wrap items-center gap-3 rounded-md px-3 py-2" style={{ background: tokens.bg }}>
              <span className="mono text-xs" style={{ color: tokens.textSecondary }}>{it.code}</span>
              <span className="text-xs" style={{ color: tokens.textPrimary }}>{it.desc}</span>
              <span className="mono text-xs" style={{ color: tokens.textSecondary }}>{it.qty} {it.unit}</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: tokens.successSoft, color: tokens.success }}>{it.supplier}</span>
              <span className="mono text-xs font-semibold mr-auto" style={{ color: tokens.primary }}>
                {fmt(it.salePrice * it.qty)} EUR
              </span>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-sm font-semibold pt-2" style={{ borderTop: `1px solid ${tokens.border}`, color: tokens.textPrimary }}>
          <span>مبلغ کل قرارداد</span>
          <span className="mono">{fmt(orderTotal)} EUR</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
        <FlexPaymentList title="پرداخت مشتری" payments={customerPayments} setPayments={setCustomerPayments} accentColor={tokens.primary} />

        {/* ضمانت‌نامه‌های صادره */}
        <div className="rounded-lg p-4" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
          <p className="text-sm font-semibold mb-3" style={{ color: tokens.textPrimary }}>
            ضمانت‌نامه‌های صادره به مشتری
          </p>
          <div className="space-y-2 mb-3">
            {guarantees.map((g, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2 rounded-md px-2.5 py-2" style={{ background: tokens.bg }}>
                <select
                  value={g.type}
                  onChange={(e) => updateGuarantee(idx, "type", e.target.value)}
                  className="text-xs rounded px-2 py-1.5"
                  style={{ border: `1px solid ${tokens.border}` }}
                >
                  <option value="advance_payment">پیش‌پرداخت</option>
                  <option value="performance">حسن انجام کار</option>
                </select>
                <input
                  value={g.amount}
                  onChange={(e) => updateGuarantee(idx, "amount", e.target.value)}
                  placeholder="مبلغ"
                  className="mono text-xs rounded px-2 py-1.5 w-20"
                  style={{ border: `1px solid ${tokens.border}` }}
                />
                <input
                  value={g.bank}
                  onChange={(e) => updateGuarantee(idx, "bank", e.target.value)}
                  placeholder="بانک صادرکننده"
                  className="text-xs rounded px-2 py-1.5 flex-1 min-w-[100px]"
                  style={{ border: `1px solid ${tokens.border}` }}
                />
                <input
                  type="date"
                  value={g.expiryDate}
                  onChange={(e) => updateGuarantee(idx, "expiryDate", e.target.value)}
                  className="mono text-xs rounded px-2 py-1.5"
                  style={{ border: `1px solid ${tokens.border}` }}
                />
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setGuarantees([...guarantees, { type: "advance_payment", amount: "", bank: "", issueDate: "", expiryDate: "", status: "active" }])}
            className="text-xs px-3 py-1.5 rounded-md"
            style={{ color: tokens.accent, border: `1px solid ${tokens.accent}` }}
          >
            + افزودن ضمانت‌نامه
          </button>
        </div>
      </div>

      <div className="flex justify-end mt-2">
        <button
          type="button"
          className="px-5 py-2.5 rounded-md text-sm font-medium text-white"
          style={{ background: tokens.primary }}
        >
          ثبت سفارش مشتری
        </button>
      </div>
    </div>
  );
}

function POTab() {
  const wonItems = [
    { code: "BRG-6205-2RS", desc: "بلبرینگ ساچمه‌ای شیار عمیق 6205", qty: 20, unit: "عدد", supplier: "Schaeffler Group — آلمان", purchasePrice: 5.12, ourEntity: "General Trading srl" },
    { code: "SEAL-NBR-45", desc: "کاسه‌نمد لاستیکی NBR سایز 45", qty: 50, unit: "عدد", supplier: "SKF Distribution — هلند", purchasePrice: 1.72, ourEntity: "Landa Controls" },
  ];
  const fmt = (n) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  const OUR_ENTITIES = ["General Trading srl", "Pasifik Global Makina", "Landa Controls", "پولاد تجهیز آپادانا"];

  const suppliers = [...new Set(wonItems.map((i) => i.supplier))];
  const [poEntity, setPoEntity] = useState(
    Object.fromEntries(wonItems.map((i) => [i.supplier, i.ourEntity]))
  );
  const [supplierPayments, setSupplierPayments] = useState(
    Object.fromEntries(suppliers.map((s) => [s, [{ desc: "پیش‌پرداخت", dueDate: "", amount: "", status: "unpaid" }]]))
  );

  return (
    <div>
      <div
        className="rounded-md px-4 py-2.5 mb-5 text-xs"
        style={{ background: tokens.accentSoft, color: tokens.textPrimary }}
      >
        این بخش مربوط به <strong>بازرگانی/مدیریت</strong> است و به فروش ربطی نداره. هر سفارش خرید
        باید از طریق یکی از <strong>شرکت‌های گروه ما</strong> (ایتالیا/ترکیه/لهستان/ایران و...)
        صادر بشه — همون شرکتی که استعلام اولیه (RFQ) هم از طریقش ارسال شده بود.
      </div>

      <div className="space-y-4">
        {suppliers.map((s) => {
          const items = wonItems.filter((i) => i.supplier === s);
          const poTotal = items.reduce((sum, it) => sum + it.purchasePrice * it.qty, 0);
          return (
            <div key={s} className="rounded-lg p-4" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Building2 size={15} style={{ color: tokens.accent }} />
                  <span className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>{s}</span>
                </div>
                <span className="mono text-xs font-semibold" style={{ color: tokens.primary }}>
                  {fmt(poTotal)} EUR
                </span>
              </div>

              <div className="mb-3">
                <label className="block text-[11px] mb-1 font-medium" style={{ color: tokens.accent }}>
                  شرکت ما (طرف خریدار در این PO)
                </label>
                <select
                  value={poEntity[s]}
                  onChange={(e) => setPoEntity({ ...poEntity, [s]: e.target.value })}
                  className="text-xs rounded px-2 py-1.5"
                  style={{ border: `1px solid ${tokens.accent}` }}
                >
                  {OUR_ENTITIES.map((e) => (
                    <option key={e} value={e}>{e}</option>
                  ))}
                </select>
                <span className="text-[11px] mr-2" style={{ color: tokens.textSecondary }}>
                  (همون شرکتی که RFQ اولیه از طریقش ارسال شده بود)
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: tokens.textSecondary }}>شماره PO</label>
                  <input className="mono text-xs w-full rounded px-2 py-1.5" style={{ border: `1px solid ${tokens.border}` }} placeholder={`PO-${s.slice(0,3).toUpperCase()}-01`} />
                </div>
                <div>
                  <label className="block text-[11px] mb-1" style={{ color: tokens.textSecondary }}>تاریخ صدور</label>
                  <input type="date" className="mono text-xs w-full rounded px-2 py-1.5" style={{ border: `1px solid ${tokens.border}` }} />
                </div>
              </div>

              <div className="space-y-1.5 mb-3">
                {items.map((it) => (
                  <div key={it.code} className="flex flex-wrap items-center gap-3 rounded-md px-3 py-2 text-xs" style={{ background: tokens.bg }}>
                    <span className="mono" style={{ color: tokens.textSecondary }}>{it.code}</span>
                    <span style={{ color: tokens.textPrimary }}>{it.desc}</span>
                    <span className="mono" style={{ color: tokens.textSecondary }}>{it.qty} {it.unit}</span>
                  </div>
                ))}
              </div>

              <FlexPaymentList
                title={`پرداخت به ${s}`}
                payments={supplierPayments[s]}
                setPayments={(p) => setSupplierPayments({ ...supplierPayments, [s]: p })}
                accentColor={tokens.accent}
              />
            </div>
          );
        })}
      </div>

      <div className="flex justify-end mt-5">
        <button
          type="button"
          className="px-5 py-2.5 rounded-md text-sm font-medium text-white"
          style={{ background: tokens.primary }}
        >
          صدور PO ها
        </button>
      </div>
    </div>
  );
}

function ShippingTab() {
  const [productionStatus, setProductionStatus] = useState({
    "Schaeffler Group": "ready_to_ship",
    "SKF Distribution": "in_production",
  });
  const [pickup, setPickup] = useState({
    "Schaeffler Group": { address: "", phone: "", contactName: "", contactEmail: "", contactPhone: "" },
    "SKF Distribution": { address: "", phone: "", contactName: "", contactEmail: "", contactPhone: "" },
  });
  const [logs, setLogs] = useState({
    "Schaeffler Group": [{ date: "۱۴۰۵/۰۳/۰۲", note: "تولید تکمیل شد" }],
    "SKF Distribution": [{ date: "۱۴۰۵/۰۲/۲۸", note: "در حال تولید، برآورد آماده‌سازی ۱۰ روز دیگر" }],
  });
  const [newLog, setNewLog] = useState({});
  const [packages, setPackages] = useState({});
  const addPackage = (supplier) => {
    const list = packages[supplier] || [];
    setPackages({ ...packages, [supplier]: [...list, { number: `بسته ${list.length + 1}`, l: "", w: "", h: "", weight: "" }] });
  };
  const updatePackage = (supplier, idx, field, value) => {
    const list = [...(packages[supplier] || [])];
    list[idx] = { ...list[idx], [field]: value };
    setPackages({ ...packages, [supplier]: list });
  };
  const updatePickup = (supplier, field, value) => {
    setPickup({ ...pickup, [supplier]: { ...pickup[supplier], [field]: value } });
  };

  const prodStatusMeta = {
    in_production: { label: "در حال تولید", color: tokens.warning, bg: tokens.warningSoft },
    ready_to_ship: { label: "آماده حمل", color: tokens.accent, bg: tokens.accentSoft },
    in_transit: { label: "در حال حمل", color: tokens.success, bg: tokens.successSoft },
  };

  const addLog = (supplier) => {
    if (!newLog[supplier]) return;
    setLogs({ ...logs, [supplier]: [...(logs[supplier] || []), { date: "امروز", note: newLog[supplier] }] });
    setNewLog({ ...newLog, [supplier]: "" });
  };

  return (
    <div>
      {/* مرحله ۱۰: پیگیری تولید نزد تأمین‌کنندگان */}
      <div className="rounded-lg p-4 mb-5" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
        <p className="text-sm font-semibold mb-3" style={{ color: tokens.textPrimary }}>
          پیگیری تولید نزد تأمین‌کنندگان
        </p>
        <div className="space-y-3">
          {Object.entries(productionStatus).map(([supplier, status]) => (
            <div key={supplier} className="rounded-md p-3" style={{ background: tokens.bg }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" style={{ color: tokens.textPrimary }}>{supplier}</span>
                <select
                  value={status}
                  onChange={(e) => setProductionStatus({ ...productionStatus, [supplier]: e.target.value })}
                  className="text-xs rounded px-2 py-1"
                  style={{ background: prodStatusMeta[status].bg, color: prodStatusMeta[status].color, border: "none" }}
                >
                  <option value="in_production">در حال تولید</option>
                  <option value="ready_to_ship">آماده حمل</option>
                  <option value="in_transit">در حال حمل</option>
                </select>
              </div>
              <div className="space-y-1 mb-2">
                {(logs[supplier] || []).map((l, i) => (
                  <p key={i} className="text-[11px]" style={{ color: tokens.textSecondary }}>
                    <span className="mono">{l.date}</span> — {l.note}
                  </p>
                ))}
              </div>

              {status === "in_transit" && (
                <p className="text-[11px]" style={{ color: tokens.success }}>
                  ✓ کالا در حال حمله — دیگر نیازی به پیگیری نیست.
                </p>
              )}

              {status === "ready_to_ship" && (
                <div>
                  <p className="text-[11px] font-medium mb-2" style={{ color: tokens.accent }}>
                    محل pickup کالا برای شرکت حمل
                  </p>
                  <div className="grid grid-cols-2 gap-1.5 mb-3">
                    <input placeholder="آدرس" value={pickup[supplier].address} onChange={(e) => updatePickup(supplier, "address", e.target.value)} className="text-[11px] rounded px-2 py-1.5 col-span-2" style={{ border: `1px solid ${tokens.accent}` }} />
                    <input placeholder="تلفن محل" value={pickup[supplier].phone} onChange={(e) => updatePickup(supplier, "phone", e.target.value)} className="mono text-[11px] rounded px-2 py-1.5" style={{ border: `1px solid ${tokens.border}` }} />
                    <input placeholder="نام شخص رابط" value={pickup[supplier].contactName} onChange={(e) => updatePickup(supplier, "contactName", e.target.value)} className="text-[11px] rounded px-2 py-1.5" style={{ border: `1px solid ${tokens.border}` }} />
                    <input placeholder="ایمیل رابط" value={pickup[supplier].contactEmail} onChange={(e) => updatePickup(supplier, "contactEmail", e.target.value)} className="text-[11px] rounded px-2 py-1.5" style={{ border: `1px solid ${tokens.border}` }} />
                    <input placeholder="تلفن رابط" value={pickup[supplier].contactPhone} onChange={(e) => updatePickup(supplier, "contactPhone", e.target.value)} className="mono text-[11px] rounded px-2 py-1.5" style={{ border: `1px solid ${tokens.border}` }} />
                  </div>

                  <div className="pt-2" style={{ borderTop: `1px dashed ${tokens.border}` }}>
                    <p className="text-[11px] font-medium mb-1.5" style={{ color: tokens.textSecondary }}>
                      بسته‌بندی (برای استعلام حمل در ماژول مدیریت بارها لازمه)
                    </p>
                    {(packages[supplier] || []).map((p, idx) => (
                      <div key={idx} className="rounded-md p-2 mb-1.5" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="mono text-[11px] font-semibold" style={{ color: tokens.textPrimary }}>{p.number}</p>
                          {p.ready ? (
                            <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ background: tokens.successSoft, color: tokens.success }}>آماده حمل ✓</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => updatePackage(supplier, idx, "ready", true)}
                              className="text-[10px] px-2 py-0.5 rounded-full"
                              style={{ color: tokens.primary, border: `1px solid ${tokens.primary}` }}
                            >
                              اعلام آماده حمل
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          <input placeholder="طول(cm)" value={p.l} onChange={(e) => updatePackage(supplier, idx, "l", e.target.value)} className="mono text-[11px] rounded px-1.5 py-1" style={{ border: `1px solid ${tokens.border}` }} />
                          <input placeholder="عرض(cm)" value={p.w} onChange={(e) => updatePackage(supplier, idx, "w", e.target.value)} className="mono text-[11px] rounded px-1.5 py-1" style={{ border: `1px solid ${tokens.border}` }} />
                          <input placeholder="ارتفاع(cm)" value={p.h} onChange={(e) => updatePackage(supplier, idx, "h", e.target.value)} className="mono text-[11px] rounded px-1.5 py-1" style={{ border: `1px solid ${tokens.border}` }} />
                          <input placeholder="وزن(kg)" value={p.weight} onChange={(e) => updatePackage(supplier, idx, "weight", e.target.value)} className="mono text-[11px] rounded px-1.5 py-1" style={{ border: `1px solid ${tokens.border}` }} />
                        </div>
                      </div>
                    ))}
                    <button type="button" onClick={() => addPackage(supplier)} className="text-[11px] px-2.5 py-1 rounded-md" style={{ color: tokens.primary, border: `1px solid ${tokens.primary}` }}>
                      + افزودن بسته
                    </button>
                  </div>
                </div>
              )}

              {status === "in_production" && (
                <div className="flex gap-2">
                  <input
                    value={newLog[supplier] || ""}
                    onChange={(e) => setNewLog({ ...newLog, [supplier]: e.target.value })}
                    placeholder="یادداشت پیگیری جدید..."
                    className="flex-1 text-xs rounded px-2 py-1.5"
                    style={{ border: `1px solid ${tokens.border}` }}
                  />
                  <button
                    type="button"
                    onClick={() => addLog(supplier)}
                    className="text-xs px-3 py-1.5 rounded-md"
                    style={{ color: tokens.primary, border: `1px solid ${tokens.primary}` }}
                  >
                    ثبت
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* وضعیت محموله (فقط‌خواندنی — مدیریت واقعی در ماژول جدا «مدیریت محموله‌ها» انجام می‌شه) */}
      <div className="rounded-lg p-4 mb-5" style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRight: `4px solid ${tokens.accent}` }}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>
            وضعیت محموله (فقط‌خواندنی)
          </p>
          <button
            type="button"
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md"
            style={{ color: tokens.primary, border: `1px solid ${tokens.primary}` }}
          >
            مشاهده در مدیریت محموله‌ها ↗
          </button>
        </div>
        <p className="text-xs mb-3" style={{ color: tokens.textSecondary }}>
          چون یک محموله می‌تونه شامل PO های چند پرونده مختلف باشه، انتخاب PO ها و پیوست اسناد
          صادرات/واردات در یک ماژول سراسری جدا («مدیریت محموله‌ها») انجام می‌شه، نه اینجا. این بخش
          فقط وضعیت رو نشون می‌ده.
        </p>

        <div className="space-y-2">
          {[
            { po: "PO-SCH-01", supplier: "Schaeffler Group", shipment: "SHP-2026-014", status: "in_transit" },
            { po: "PO-SKF-01", supplier: "SKF Distribution", shipment: "—", status: "not_shipped" },
          ].map((row) => {
            const statusMeta = {
              not_shipped: { label: "هنوز ارسال نشده", color: tokens.textSecondary, bg: tokens.bg },
              consolidating: { label: "در حال تجمیع", color: tokens.warning, bg: tokens.warningSoft },
              in_transit: { label: "در حال حمل", color: tokens.accent, bg: tokens.accentSoft },
              in_clearance: { label: "در حال ترخیص", color: tokens.warning, bg: tokens.warningSoft },
              cleared: { label: "ترخیص شده — آماده تحویل به مشتری", color: tokens.success, bg: tokens.successSoft },
            }[row.status];
            return (
              <div key={row.po} className="flex flex-wrap items-center gap-3 rounded-md px-3 py-2.5" style={{ background: tokens.bg }}>
                <span className="mono text-xs" style={{ color: tokens.textSecondary }}>{row.po}</span>
                <span className="text-xs" style={{ color: tokens.textPrimary }}>{row.supplier}</span>
                {row.shipment !== "—" && (
                  <span className="mono text-[11px]" style={{ color: tokens.textSecondary }}>
                    محموله: {row.shipment}
                  </span>
                )}
                <span className="text-[11px] px-2 py-0.5 rounded-full mr-auto" style={{ background: statusMeta.bg, color: statusMeta.color }}>
                  {statusMeta.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* مرحله ۱۲: دریافت کالا در انبار — توسط کارشناس فروش، به تفکیک هر قلم */}
      <div className="rounded-lg p-4" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
        <p className="text-sm font-semibold mb-1" style={{ color: tokens.textPrimary }}>
          دریافت کالا در انبار
        </p>
        <p className="text-xs mb-3" style={{ color: tokens.textSecondary }}>
          بعد از رسیدن محموله و ترخیص (طبق وضعیت بالا)، کارشناس فروش مقدار دریافتی و تصاویر هر قلم
          همین پرونده را اینجا ثبت می‌کند.
        </p>
        <div className="space-y-2">
          {[
            { code: "BRG-6205-2RS", desc: "بلبرینگ ساچمه‌ای شیار عمیق 6205", qty: 20, unit: "عدد" },
            { code: "SEAL-NBR-45", desc: "کاسه‌نمد لاستیکی NBR سایز 45", qty: 50, unit: "عدد" },
          ].map((it) => (
            <div key={it.code} className="rounded-md p-3" style={{ background: tokens.bg }}>
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <span className="mono text-xs" style={{ color: tokens.textSecondary }}>{it.code}</span>
                <span className="text-xs" style={{ color: tokens.textPrimary }}>{it.desc}</span>
                <span className="mono text-[11px]" style={{ color: tokens.textSecondary }}>(سفارش: {it.qty} {it.unit})</span>
                <input placeholder="مقدار دریافتی" className="mono w-24 text-xs rounded px-2 py-1.5 mr-auto" style={{ border: `1px solid ${tokens.border}` }} />
              </div>
              <button
                type="button"
                className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md"
                style={{ color: tokens.accent, background: tokens.accentSoft }}
              >
                <Paperclip size={12} /> بارگذاری تصاویر این کالا
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="flex justify-end mt-5">
        <button type="button" className="px-5 py-2.5 rounded-md text-sm font-medium text-white" style={{ background: tokens.primary }}>
          ثبت اطلاعات
        </button>
      </div>
    </div>
  );
}

function SettlementTab() {
  const orderTotal = 157.6; // مجموع سفارش از تب قبلی (مرجع)
  const fmt = (n) => Number(n).toLocaleString("en-US", { maximumFractionDigits: 2 });

  const [delivery, setDelivery] = useState({
    actualDate: "", method: "carrier", recipient: "",
  });
  const [acceptance, setAcceptance] = useState({ date: "", status: "pending" });
  const [collections, setCollections] = useState([
    { desc: "پیش‌پرداخت ۳۰٪ (قبلاً دریافت شده)", dueDate: "", amount: fmt(orderTotal * 0.3), status: "completed" },
    { desc: "مانده در مقابل اسناد", dueDate: "", amount: fmt(orderTotal * 0.7), status: "unpaid" },
  ]);

  const acceptanceMeta = {
    pending: { label: "در انتظار تأیید مشتری", color: tokens.warning, bg: tokens.warningSoft },
    accepted: { label: "تأیید شده", color: tokens.success, bg: tokens.successSoft },
    rejected_needs_action: { label: "رد شده — نیاز به اقدام", color: tokens.danger, bg: "#F3E6E4" },
  };

  const invoiceAllowed = acceptance.status === "accepted";

  const [invoiceBreakdown, setInvoiceBreakdown] = useState([
    { desc: "پیش‌پرداخت ۳۰٪", eur: orderTotal * 0.3, rateBasis: "نرخ دستی روز پیش‌پرداخت", rate: "" },
    { desc: "مانده (پس از تأیید فنی مشتری)", eur: orderTotal * 0.7, rateBasis: "نرخ دستی روز تحویل/تأیید", rate: "" },
  ]);
  const updateInvoiceRate = (idx, value) => {
    const next = [...invoiceBreakdown];
    next[idx] = { ...next[idx], rate: value };
    setInvoiceBreakdown(next);
  };

  const addCollection = () =>
    setCollections([...collections, { desc: "", dueDate: "", amount: "", status: "unpaid" }]);
  const updateCollection = (idx, field, value) => {
    const next = [...collections];
    next[idx] = { ...next[idx], [field]: value };
    setCollections(next);
  };
  const removeCollection = (idx) => setCollections(collections.filter((_, i) => i !== idx));

  return (
    <div>
      {/* مرحله ۱۴: تحویل به مشتری + تایید فنی/کیفی */}
      <div className="rounded-lg p-4 mb-5" style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRight: `4px solid ${tokens.primary}` }}>
        <p className="text-sm font-semibold mb-3" style={{ color: tokens.textPrimary }}>
          تحویل به مشتری
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-3">
          <div>
            <label className="block text-[11px] mb-1" style={{ color: tokens.textSecondary }}>تاریخ تحویل واقعی</label>
            <input
              type="date"
              value={delivery.actualDate}
              onChange={(e) => setDelivery({ ...delivery, actualDate: e.target.value })}
              className="mono text-xs w-full rounded px-2 py-1.5"
              style={{ border: `1px solid ${tokens.border}` }}
            />
          </div>
          <div>
            <label className="block text-[11px] mb-1" style={{ color: tokens.textSecondary }}>روش تحویل</label>
            <select
              value={delivery.method}
              onChange={(e) => setDelivery({ ...delivery, method: e.target.value })}
              className="text-xs w-full rounded px-2 py-1.5"
              style={{ border: `1px solid ${tokens.border}` }}
            >
              <option value="carrier">ارسال با باربری</option>
              <option value="in_person">تحویل حضوری</option>
            </select>
          </div>
          <div>
            <label className="block text-[11px] mb-1" style={{ color: tokens.textSecondary }}>نام تحویل‌گیرنده</label>
            <input
              value={delivery.recipient}
              onChange={(e) => setDelivery({ ...delivery, recipient: e.target.value })}
              className="text-xs w-full rounded px-2 py-1.5"
              style={{ border: `1px solid ${tokens.border}` }}
            />
          </div>
        </div>
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md mb-4"
          style={{ color: tokens.accent, background: tokens.accentSoft }}
        >
          <FileText size={13} /> پیوست رسید تحویل
        </button>

        <div className="pt-3" style={{ borderTop: `1px dashed ${tokens.border}` }}>
          <p className="text-xs font-medium mb-2" style={{ color: tokens.textSecondary }}>
            تأیید فنی و کیفی مشتری (معمولاً مدتی بعد از تحویل فیزیکی)
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={acceptance.status}
              onChange={(e) => setAcceptance({ ...acceptance, status: e.target.value })}
              className="text-xs rounded px-2 py-1.5"
              style={{
                background: acceptanceMeta[acceptance.status].bg,
                color: acceptanceMeta[acceptance.status].color,
                border: "none",
              }}
            >
              <option value="pending">در انتظار تأیید مشتری</option>
              <option value="accepted">تأیید شده</option>
              <option value="rejected_needs_action">رد شده — نیاز به اقدام</option>
            </select>
            <input
              type="date"
              value={acceptance.date}
              onChange={(e) => setAcceptance({ ...acceptance, date: e.target.value })}
              className="mono text-xs rounded px-2 py-1.5"
              style={{ border: `1px solid ${tokens.border}` }}
              placeholder="تاریخ تایید"
            />
          </div>
        </div>
      </div>

      {/* مرحله ۱۵: صدور فاکتور نهایی */}
      <div
        className="rounded-lg p-4 mb-5"
        style={{
          background: invoiceAllowed ? tokens.surface : tokens.bg,
          border: `1px solid ${tokens.border}`,
          opacity: invoiceAllowed ? 1 : 0.6,
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>
            صدور فاکتور نهایی (به ریال)
          </p>
          {!invoiceAllowed && (
            <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: tokens.warningSoft, color: tokens.warning }}>
              قفل — منتظر تأیید فنی/کیفی مشتری
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-4">
          <div>
            <label className="block text-[11px] mb-1" style={{ color: tokens.textSecondary }}>شماره فاکتور</label>
            <input disabled={!invoiceAllowed} className="mono text-xs w-full rounded px-2 py-1.5" style={{ border: `1px solid ${tokens.border}` }} placeholder="INV-0417" />
          </div>
          <div>
            <label className="block text-[11px] mb-1" style={{ color: tokens.textSecondary }}>تاریخ صدور</label>
            <input disabled={!invoiceAllowed} type="date" className="mono text-xs w-full rounded px-2 py-1.5" style={{ border: `1px solid ${tokens.border}` }} />
          </div>
        </div>

        <p className="text-xs font-medium mb-2" style={{ color: tokens.textSecondary }}>
          ⚠️ چون فاکتور به ریال صادر می‌شه ولی معامله به یورو بوده، هر بخش با نرخ ارز روز خودش تبدیل می‌شه:
        </p>
        <table className="w-full text-xs mb-3">
          <thead>
            <tr style={{ color: tokens.textSecondary }}>
              <th className="text-right font-normal pb-1.5">بخش</th>
              <th className="text-right font-normal pb-1.5">مبلغ (EUR)</th>
              <th className="text-right font-normal pb-1.5">مبنای نرخ ارز</th>
              <th className="text-right font-normal pb-1.5">نرخ (ریال)</th>
              <th className="text-right font-normal pb-1.5">مبلغ (ریال)</th>
            </tr>
          </thead>
          <tbody>
            {invoiceBreakdown.map((row, idx) => (
              <tr key={row.desc} style={{ borderTop: `1px solid ${tokens.border}` }}>
                <td className="py-1.5" style={{ color: tokens.textPrimary }}>{row.desc}</td>
                <td className="mono py-1.5">{fmt(row.eur)}</td>
                <td className="py-1.5 text-[11px]" style={{ color: tokens.textSecondary }}>{row.rateBasis}</td>
                <td className="py-1.5">
                  <input
                    disabled={!invoiceAllowed}
                    value={row.rate}
                    onChange={(e) => updateInvoiceRate(idx, e.target.value)}
                    className="mono w-24 rounded px-2 py-1"
                    style={{ border: `1px solid ${tokens.accent}` }}
                    placeholder="نرخ دستی..."
                  />
                </td>
                <td className="mono py-1.5 font-semibold" style={{ color: tokens.primary }}>{fmt(row.eur * (parseFloat(row.rate) || 0))}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex justify-between text-sm font-semibold pt-2" style={{ borderTop: `1px solid ${tokens.border}`, color: tokens.textPrimary }}>
          <span>جمع کل فاکتور (ریال)</span>
          <span className="mono">{fmt(invoiceBreakdown.reduce((s, r) => s + r.eur * (parseFloat(r.rate) || 0), 0))} ریال</span>
        </div>
      </div>

      {/* مرحله ۱۶: پیگیری وصول */}
      <FlexPaymentList
        title="پیگیری و دریافت وجه از مشتری"
        payments={collections}
        setPayments={setCollections}
        accentColor={tokens.primary}
      />

      <div className="flex justify-end mt-5">
        <button type="button" className="px-5 py-2.5 rounded-md text-sm font-medium text-white" style={{ background: tokens.primary }}>
          ثبت اطلاعات تحویل و تسویه
        </button>
      </div>
    </div>
  );
}

const AVATAR_COLORS = ["#1F3A5F", "#A9633B", "#2F7D5D", "#7B4B94", "#B98900", "#3D6B8C"];
function avatarColor(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
function Avatar({ name, size = 24 }) {
  const initials = name.trim().split(" ").slice(0, 2).map((w) => w[0]).join("");
  return (
    <div
      className="rounded-full flex items-center justify-center shrink-0 font-semibold"
      style={{
        width: size, height: size, background: avatarColor(name), color: "#fff",
        fontSize: size * 0.4,
      }}
    >
      {initials}
    </div>
  );
}

const ALL_COLLEAGUES = ["فرشید محمدی", "علی محمدی", "سارا کریمی", "حسین رستمی", "مریم صادقی"];

const ACTIVITY_ICON = {
  file_upload: Paperclip,
  status_change: Clock,
  stage_completed: Check,
  approval: Check,
  technical_question: MessageCircleQuestion,
  general: MessageCircle,
};

function ActivityTab() {
  const [feed, setFeed] = useState([
    { id: 1, entryType: "activity", author: "فرشید محمدی", text: "استعلام را ثبت کرد", tag: "stage_completed", time: "۱۴۰۵/۰۲/۰۸ ۱۰:۰۲" },
    { id: 2, entryType: "activity", author: "فرشید محمدی", text: "RFQ-1042 را به Schaeffler Group ارسال کرد", tag: "general", time: "۱۴۰۵/۰۲/۱۰ ۱۱:۱۵" },
    { id: 3, entryType: "message", author: "فرشید محمدی", text: "این استعلام برای مشتری استراتژیک‌مونه، لطفاً پیگیری فوری بشه.", time: "۱۴۰۵/۰۲/۱۰ ۱۱:۱۶" },
    { id: 4, entryType: "activity", author: "حسین رستمی", text: "پیشنهاد قیمت Schaeffler Group را ثبت کرد", tag: "file_upload", time: "۱۴۰۵/۰۲/۱۲ ۰۹:۴۰" },
    { id: 5, entryType: "activity", author: "حسین رستمی", text: "سوال فنی از تأمین‌کننده SKF Distribution ثبت شد", tag: "technical_question", time: "۱۴۰۵/۰۲/۱۲ ۱۰:۰۵" },
    { id: 6, entryType: "message", author: "علی محمدی", text: "بله معادل بدون برند SKF قابل قبوله، فقط باید مشخصات فنی رو تأیید کنیم.", time: "۱۴۰۵/۰۲/۱۲ ۱۴:۳۰" },
    { id: 7, entryType: "activity", author: "فرشید محمدی", text: "انتخاب نهایی و قیمت‌گذاری را قفل کرد", tag: "approval", time: "۱۴۰۵/۰۳/۰۱ ۰۹:۰۰" },
    { id: 8, entryType: "activity", author: "علی محمدی", text: "پیشنهاد مالی و فنی (نسخه ۱) را تولید کرد", tag: "file_upload", time: "۱۴۰۵/۰۳/۰۲ ۱۳:۲۰" },
    { id: 9, entryType: "activity", author: "علی محمدی", text: "فایل‌ها را برای مشتری ارسال کرد — در انتظار نتیجه", tag: "status_change", time: "۱۴۰۵/۰۳/۰۲ ۱۳:۲۲" },
    { id: 10, entryType: "activity", author: "علی محمدی", text: "نتیجه «برد جزئی» را برای این استعلام ثبت کرد", tag: "stage_completed", time: "۱۴۰۵/۰۴/۰۱ ۰۹:۱۲" },
  ]);
  const [newMessage, setNewMessage] = useState("");
  const [showMentions, setShowMentions] = useState(false);

  const send = () => {
    if (!newMessage.trim()) return;
    setFeed([...feed, { id: Date.now(), entryType: "message", author: "فرشید محمدی", text: newMessage, time: "اکنون" }]);
    setNewMessage("");
    setShowMentions(false);
  };

  const mentionMatch = newMessage.match(/@([^\s@]*)$/);
  const mentionQuery = mentionMatch ? mentionMatch[1] : null;
  const mentionOptions = mentionQuery !== null
    ? ALL_COLLEAGUES.filter((n) => n.toLowerCase().includes(mentionQuery.toLowerCase()))
    : [];

  const handleMessageChange = (val) => {
    setNewMessage(val);
    setShowMentions(/@([^\s@]*)$/.test(val));
  };

  const pickMention = (name) => {
    setNewMessage(newMessage.replace(/@([^\s@]*)$/, `@${name} `));
    setShowMentions(false);
  };

  return (
    <div>
      <div className="rounded-md px-4 py-2.5 mb-4 text-xs" style={{ background: tokens.accentSoft, color: tokens.textPrimary }}>
        این فید هم گفتگوی آزاد بین همکاران رو نشون می‌ده، هم لاگ خودکار همه فعالیت‌های مهم این
        پرونده (تکمیل مرحله، بارگذاری فایل، تغییر وضعیت و...) به همراه نام عامل هر اقدام.
      </div>

      <div className="space-y-2.5 mb-4">
        {feed.map((item) => {
          if (item.entryType === "activity") {
            const Icon = ACTIVITY_ICON[item.tag] || MessageCircle;
            return (
              <div key={item.id} className="flex items-center gap-2.5 text-xs px-1">
                <Avatar name={item.author} size={20} />
                <Icon size={12} style={{ color: tokens.textSecondary }} />
                <span style={{ color: tokens.textSecondary }}>
                  <strong style={{ color: tokens.textPrimary }}>{item.author}</strong> {item.text}
                </span>
                <span className="mono mr-auto" style={{ color: tokens.textSecondary }}>{item.time}</span>
              </div>
            );
          }
          return (
            <div key={item.id} className="rounded-lg p-3 max-w-[85%]" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-2">
                  <Avatar name={item.author} size={22} />
                  <span className="text-xs font-semibold" style={{ color: tokens.primary }}>{item.author}</span>
                </div>
                <span className="mono text-[11px]" style={{ color: tokens.textSecondary }}>{item.time}</span>
              </div>
              <p className="text-sm" style={{ color: tokens.textPrimary }}>{item.text}</p>
            </div>
          );
        })}
      </div>

      <div className="relative">
        {showMentions && mentionOptions.length > 0 && (
          <div
            className="absolute bottom-full mb-1.5 w-64 rounded-md overflow-hidden"
            style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, boxShadow: "0 -4px 12px rgba(0,0,0,0.08)" }}
          >
            {mentionOptions.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => pickMention(n)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-black/5"
              >
                <Avatar name={n} size={20} />
                <span style={{ color: tokens.textPrimary }}>{n}</span>
              </button>
            ))}
          </div>
        )}
        <div className="flex gap-2 sticky bottom-0 pt-2" style={{ background: tokens.bg }}>
          <input
            value={newMessage}
            onChange={(e) => handleMessageChange(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !showMentions && send()}
            placeholder="پیام خود را بنویس... (@ برای اشاره به همکار)"
            className="flex-1 text-sm rounded-md px-3 py-2.5"
            style={{ border: `1px solid ${tokens.border}` }}
          />
          <button onClick={send} className="flex items-center gap-1.5 px-4 py-2.5 rounded-md text-sm font-medium text-white" style={{ background: tokens.primary }}>
            <Send size={14} /> ارسال
          </button>
        </div>
      </div>
    </div>
  );
}

export default function InquiryDetailMockup() {
  const [activeTab, setActiveTab] = useState("settlement");
  const [selectedItems, setSelectedItems] = useState([1, 3]);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [chosenSupplier, setChosenSupplier] = useState("");
  const [showEmailPreview, setShowEmailPreview] = useState(false);

  const supplierOptions = [
    "Schaeffler Group — آلمان",
    "SKF Distribution — هلند",
    "Bulten Fasteners — سوئد",
    "Timken Europe — ایتالیا",
    "NTN Bearing — فرانسه",
  ].filter((s) => s.toLowerCase().includes(supplierQuery.toLowerCase()));

  const toggleItem = (id) => {
    setSelectedItems((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const rfqs = [
    {
      number: "RFQ-1042",
      supplier: "Schaeffler Group — آلمان",
      ourEntity: "General Trading srl",
      sentDate: "۱۴۰۵/۰۲/۱۰",
      items: ["BRG-6205-2RS"],
      initialStatus: "offer_received",
    },
    {
      number: "RFQ-1043",
      supplier: "SKF Distribution — هلند",
      ourEntity: "Landa Controls",
      sentDate: "۱۴۰۵/۰۲/۱۰",
      items: ["BRG-6205-2RS", "SEAL-NBR-45"],
      initialStatus: "technical_question",
    },
    {
      number: "RFQ-1044",
      supplier: "Bulten Fasteners — سوئد",
      ourEntity: "Pasifik Global Makina",
      sentDate: "۱۴۰۵/۰۲/۱۲",
      items: ["BLT-M12-80"],
      initialStatus: "awaiting",
    },
  ];

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
        <div className="flex items-center gap-2 mb-4">
          <button style={{ color: tokens.textSecondary }}>
            <ArrowRight size={18} />
          </button>
          <span className="text-xs" style={{ color: tokens.textSecondary }}>
            بازگشت به لیست استعلام‌ها
          </span>
        </div>

        <div
          className="rounded-lg p-4 mb-5 flex flex-wrap items-center justify-between gap-3"
          style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="mono text-xs" style={{ color: tokens.accent }}>
                INQ-2026-0417
              </span>
              <span className="text-xs" style={{ color: tokens.textSecondary }}>
                · مرجع مشتری: TND-1405-118
              </span>
            </div>
            <h1 className="text-lg font-bold" style={{ color: tokens.textPrimary }}>
              تأمین یاتاقان‌های خط تولید نورد ۲
            </h1>
            <p className="text-xs mt-1" style={{ color: tokens.textSecondary }}>
              فولاد مبارکه اصفهان — کارشناس فروش: فرشید
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab("activity")}
              className="relative flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full"
              style={{
                background: activeTab === "activity" ? tokens.primary : tokens.accentSoft,
                color: activeTab === "activity" ? "#fff" : tokens.accent,
              }}
            >
              <MessageCircle size={13} /> گفتگو و فعالیت‌ها
              <span
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
                style={{ background: tokens.danger }}
              >
                2
              </span>
            </button>
            <span
              className="text-xs font-medium px-3 py-1.5 rounded-full"
              style={{ background: tokens.warningSoft, color: tokens.warning }}
            >
              در جریان
            </span>
          </div>
        </div>

        <div
          className="flex items-center gap-1 mb-5 overflow-x-auto pb-1"
          style={{ borderBottom: `1px solid ${tokens.border}` }}
        >
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium whitespace-nowrap shrink-0"
              style={{
                color: activeTab === tab.key ? tokens.primary : tokens.textSecondary,
                borderBottom:
                  activeTab === tab.key
                    ? `2px solid ${tokens.primary}`
                    : "2px solid transparent",
              }}
            >
              {tab.state === "done" && (
                <span
                  className="w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ background: tokens.successSoft, color: tokens.success }}
                >
                  <Check size={10} />
                </span>
              )}
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "activity" && <ActivityTab />}

        {activeTab === "rfq" && (
          <>
            <div
              className="rounded-lg p-4 mb-5"
              style={{
                background: tokens.surface,
                border: `1px solid ${tokens.border}`,
                borderRight: `4px solid ${tokens.primary}`,
              }}
            >
              <p className="text-sm font-semibold mb-3" style={{ color: tokens.textPrimary }}>
                ارسال استعلام جدید به تأمین‌کننده
              </p>
              <p className="text-xs mb-3" style={{ color: tokens.textSecondary }}>
                ردیف‌هایی که می‌خوای برای این تأمین‌کننده ارسال بشه رو انتخاب کن:
              </p>
              <div className="space-y-1.5 mb-4">
                {inquiryItems.map((it) => (
                  <label
                    key={it.id}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm cursor-pointer"
                    style={{
                      background: selectedItems.includes(it.id) ? tokens.accentSoft : tokens.bg,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selectedItems.includes(it.id)}
                      onChange={() => toggleItem(it.id)}
                      className="w-4 h-4"
                    />
                    <span className="mono text-xs" style={{ color: tokens.textSecondary }}>
                      {it.code}
                    </span>
                    <span style={{ color: tokens.textPrimary }}>{it.desc}</span>
                    <span
                      className="mono text-xs mr-auto"
                      style={{ color: tokens.textSecondary }}
                    >
                      {it.qty} {it.unit}
                    </span>
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 items-end mb-3">
                <div className="flex-1 min-w-[160px]">
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: tokens.accent }}
                  >
                    شرکت ما (طرف ارسال‌کننده استعلام)
                  </label>
                  <select
                    className="w-full rounded-md px-3 py-2 text-sm"
                    style={{ border: `1px solid ${tokens.accent}` }}
                  >
                    <option>General Trading srl</option>
                    <option>Pasifik Global Makina</option>
                    <option>Landa Controls</option>
                    <option>پولاد تجهیز آپادانا</option>
                  </select>
                </div>
                <div className="flex-1 min-w-[220px] relative">
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: tokens.textPrimary }}
                  >
                    تأمین‌کننده مقصد
                  </label>
                  <div className="relative">
                    <Search
                      size={14}
                      className="absolute top-2.5 right-3"
                      style={{ color: tokens.textSecondary }}
                    />
                    <input
                      className="w-full rounded-md pr-9 pl-3 py-2 text-sm"
                      style={{ border: `1px solid ${tokens.border}` }}
                      placeholder="جستجوی نام تأمین‌کننده..."
                      value={chosenSupplier || supplierQuery}
                      onChange={(e) => {
                        setSupplierQuery(e.target.value);
                        setChosenSupplier("");
                        setSupplierOpen(true);
                      }}
                      onFocus={() => setSupplierOpen(true)}
                    />
                  </div>
                  {supplierOpen && !chosenSupplier && (
                    <div
                      className="absolute z-10 w-full mt-1 rounded-md overflow-hidden max-h-40 overflow-y-auto"
                      style={{
                        background: tokens.surface,
                        border: `1px solid ${tokens.border}`,
                        boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      }}
                    >
                      {supplierOptions.length === 0 && (
                        <p className="text-xs px-3 py-2" style={{ color: tokens.textSecondary }}>
                          موردی یافت نشد
                        </p>
                      )}
                      {supplierOptions.map((s) => (
                        <button
                          type="button"
                          key={s}
                          onClick={() => {
                            setChosenSupplier(s);
                            setSupplierOpen(false);
                          }}
                          className="w-full text-right text-sm px-3 py-2 hover:bg-black/5"
                          style={{ color: tokens.textPrimary }}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label
                    className="block text-xs font-medium mb-1.5"
                    style={{ color: tokens.textPrimary }}
                  >
                    عنوان ایمیل
                  </label>
                  <input
                    className="mono w-full rounded-md px-3 py-2 text-sm"
                    style={{ border: `1px solid ${tokens.border}` }}
                    defaultValue="INQ-2026-0417"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 justify-between items-center">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowEmailPreview(true)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs"
                    style={{ color: tokens.textPrimary, border: `1px solid ${tokens.border}` }}
                  >
                    <Mail size={14} /> پیش‌نمایش ایمیل
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs"
                    style={{ color: tokens.textPrimary, border: `1px solid ${tokens.border}` }}
                  >
                    <FileDown size={14} /> خروجی اکسل اقلام
                  </button>
                </div>
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium text-white shrink-0"
                  style={{ background: tokens.primary }}
                >
                  <Send size={14} /> ارسال RFQ
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>
                استعلام‌های ارسال‌شده ({rfqs.length})
              </p>
            </div>
            <div className="space-y-2.5">
              {rfqs.map((rfq) => (
                <RFQCard key={rfq.number} rfq={rfq} />
              ))}
            </div>
          </>
        )}

        {activeTab === "selection" && <SelectionTab />}

        {activeTab === "proposal" && <ProposalTab />}

        {activeTab === "outcome" && <OutcomeTab />}

        {activeTab === "order" && <OrderTab />}
        {activeTab === "po" && <POTab />}
        {activeTab === "shipping" && <ShippingTab />}
        {activeTab === "settlement" && <SettlementTab />}

        {activeTab !== "rfq" &&
          activeTab !== "proposal" &&
          activeTab !== "selection" &&
          activeTab !== "outcome" &&
          activeTab !== "order" &&
          activeTab !== "po" &&
          activeTab !== "shipping" &&
          activeTab !== "settlement" &&
          activeTab !== "activity" && (
            <div
              className="rounded-lg p-10 text-center"
              style={{ background: tokens.surface, border: `1px dashed ${tokens.border}` }}
            >
              <p className="text-sm" style={{ color: tokens.textSecondary }}>
                محتوای این بخش در ماک‌آپ بعدی طراحی می‌شود
              </p>
            </div>
          )}
      </div>

      {showEmailPreview && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(20,18,14,0.45)" }}
        >
          <div
            className="rounded-lg w-full max-w-lg max-h-[85vh] overflow-y-auto"
            dir="ltr"
            style={{ background: tokens.surface }}
          >
            <div
              className="flex items-center justify-between px-5 py-3.5"
              dir="rtl"
              style={{ borderBottom: `1px solid ${tokens.border}` }}
            >
              <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>
                Email Preview (پیش‌نمایش — به انگلیسی)
              </p>
              <button onClick={() => setShowEmailPreview(false)} style={{ color: tokens.textSecondary }}>
                <X size={18} />
              </button>
            </div>
            <div className="p-5 text-sm" style={{ color: tokens.textPrimary, fontFamily: "Arial, sans-serif" }}>
              <p className="mb-1">
                <span style={{ color: tokens.textSecondary }}>To: </span>
                {chosenSupplier || "— supplier not selected —"}
              </p>
              <p className="mb-4">
                <span style={{ color: tokens.textSecondary }}>Subject: </span>
                <span className="mono">INQ-2026-0417</span>
              </p>
              <p className="mb-3" style={{ color: tokens.textSecondary }}>
                Dear Sir/Madam,<br />
                Kindly quote your best price and delivery time for the following items:
              </p>
              <table className="w-full text-xs mb-4">
                <thead>
                  <tr style={{ color: tokens.textSecondary, borderBottom: `1px solid ${tokens.border}` }}>
                    <th className="text-left font-normal pb-1.5">Item Code</th>
                    <th className="text-left font-normal pb-1.5">Description</th>
                    <th className="text-left font-normal pb-1.5">Quantity</th>
                  </tr>
                </thead>
                <tbody>
                  {inquiryItems
                    .filter((it) => selectedItems.includes(it.id))
                    .map((it) => (
                      <tr key={it.id} style={{ borderBottom: `1px solid ${tokens.border}` }}>
                        <td className="mono py-1.5">{it.code}</td>
                        <td className="py-1.5">{it.desc}</td>
                        <td className="mono py-1.5">
                          {it.qty} {it.unit}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
              <p className="text-xs mb-3" style={{ color: tokens.textSecondary }}>Best regards,</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-md text-xs"
                  style={{ color: tokens.textPrimary, border: `1px solid ${tokens.border}` }}
                >
                  <FileDown size={13} /> دانلود اکسل همین لیست
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
