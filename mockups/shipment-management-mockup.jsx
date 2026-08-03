import React, { useState } from "react";
import {
  ArrowRight,
  Search,
  Plus,
  FileText,
  Building2,
  Package,
  Truck,
  Warehouse,
  ChevronDown,
  ChevronUp,
  Check,
  Paperclip,
  Send,
  Box,
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

const MODULE_TABS = [
  { key: "freight", label: "استعلام حمل" },
  { key: "shipments", label: "بارها" },
];

const inputStyle = { border: `1px solid ${tokens.border}` };
const label = "block text-[11px] mb-1";

function Section({ title, subtitle, children, accent }) {
  return (
    <div
      className="rounded-lg p-4 mb-5"
      style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRight: accent ? `4px solid ${accent}` : undefined }}
    >
      <p className="text-sm font-semibold mb-1" style={{ color: tokens.textPrimary }}>{title}</p>
      {subtitle && <p className="text-xs mb-3" style={{ color: tokens.textSecondary }}>{subtitle}</p>}
      {children}
    </div>
  );
}

const PACKAGED_ITEMS = [
  { id: "PKG-001", po: "PO-SCH-01", inquiry: "INQ-2026-0417", location: "Warehouse Italy, Via Roma 12, Milan", dims: "60×40×35 cm", weight: "18 kg", qty: 1 },
  { id: "PKG-002", po: "PO-NTN-02", inquiry: "INQ-2026-0388", location: "Warehouse Poland, ul. Portowa 4, Gdansk", dims: "45×30×25 cm", weight: "9 kg", qty: 2 },
];

function FreightRfqCard({ rfq }) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState(rfq.initialStatus);
  const [entering, setEntering] = useState(false);
  const [offer, setOffer] = useState({ price: "", currency: "EUR", transit: "", validity: "" });
  const [selected, setSelected] = useState(false);

  const statusMeta = {
    awaiting_response: { label: "در انتظار پاسخ", color: tokens.warning, bg: tokens.warningSoft },
    offer_received: { label: "پیشنهاد قیمت ثبت شد", color: tokens.success, bg: tokens.successSoft },
  }[status];

  const saveOffer = () => {
    setStatus("offer_received");
    setEntering(false);
  };

  return (
    <div className="rounded-lg overflow-hidden" style={{ border: `1px solid ${selected ? tokens.success : tokens.border}`, background: tokens.surface }}>
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: tokens.accentSoft, color: tokens.accent }}>
            <Truck size={15} />
          </div>
          <div className="text-right">
            <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>
              {rfq.company} <span className="mono text-xs font-normal" style={{ color: tokens.textSecondary }}>{rfq.number}</span>
            </p>
            <p className="text-xs" style={{ color: tokens.textSecondary }}>مقصد: {rfq.destination} · ارسال‌شده {rfq.sentDate}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {selected && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: tokens.successSoft, color: tokens.success }}>منتخب نهایی</span>}
          <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: statusMeta.bg, color: statusMeta.color }}>{statusMeta.label}</span>
          {open ? <ChevronUp size={16} style={{ color: tokens.textSecondary }} /> : <ChevronDown size={16} style={{ color: tokens.textSecondary }} />}
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4" style={{ borderTop: `1px dashed ${tokens.border}` }}>
          <div className="flex flex-wrap gap-1.5 my-3">
            {rfq.packages.map((p) => (
              <span key={p} className="mono text-[11px] px-2 py-1 rounded" style={{ background: tokens.bg, color: tokens.textSecondary }}>{p}</span>
            ))}
          </div>

          {status === "awaiting_response" && !entering && (
            <button type="button" onClick={() => setEntering(true)} className="text-xs px-3 py-1.5 rounded-md" style={{ color: tokens.primary, border: `1px solid ${tokens.primary}` }}>
              ثبت پیشنهاد قیمت دریافتی
            </button>
          )}

          {(entering || status === "offer_received") && (
            <div className="rounded-md p-3" style={{ background: tokens.bg }}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
                <div>
                  <label className={label} style={{ color: tokens.textSecondary }}>قیمت حمل</label>
                  <input disabled={status === "offer_received" && !entering} value={offer.price} onChange={(e) => setOffer({ ...offer, price: e.target.value })} className="mono text-xs w-full rounded px-2 py-1.5" style={inputStyle} placeholder="0.00" />
                </div>
                <div>
                  <label className={label} style={{ color: tokens.textSecondary }}>ارز</label>
                  <select disabled={status === "offer_received" && !entering} value={offer.currency} onChange={(e) => setOffer({ ...offer, currency: e.target.value })} className="text-xs w-full rounded px-2 py-1.5" style={inputStyle}>
                    <option>EUR</option><option>USD</option>
                  </select>
                </div>
                <div>
                  <label className={label} style={{ color: tokens.textSecondary }}>زمان حمل (روز)</label>
                  <input disabled={status === "offer_received" && !entering} value={offer.transit} onChange={(e) => setOffer({ ...offer, transit: e.target.value })} className="mono text-xs w-full rounded px-2 py-1.5" style={inputStyle} />
                </div>
                <div>
                  <label className={label} style={{ color: tokens.textSecondary }}>اعتبار پیشنهاد</label>
                  <input disabled={status === "offer_received" && !entering} type="date" value={offer.validity} onChange={(e) => setOffer({ ...offer, validity: e.target.value })} className="mono text-xs w-full rounded px-2 py-1.5" style={inputStyle} />
                </div>
              </div>
              {entering ? (
                <button type="button" onClick={saveOffer} className="text-xs px-3 py-1.5 rounded-md text-white" style={{ background: tokens.success }}>ثبت پیشنهاد</button>
              ) : (
                <button
                  type="button"
                  onClick={() => setSelected(true)}
                  disabled={selected}
                  className="text-xs px-3 py-1.5 rounded-md text-white"
                  style={{ background: selected ? tokens.textSecondary : tokens.primary }}
                >
                  {selected ? "انتخاب شد ✓" : "انتخاب این شرکت حمل به‌عنوان برنده"}
                </button>
              )}
            </div>
          )}

          {selected && (
            <div className="rounded-md p-3 mt-3" style={{ background: tokens.successSoft }}>
              <p className="text-xs" style={{ color: tokens.textPrimary }}>
                ✓ این شرکت حمل انتخاب شد و بار ایجاد شد. بارگذاری و ارسال اسناد (Invoice, Packing
                List, Non-Dual-Use, POA) از تب «بارها» روی همین بار انجام می‌شه.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FreightTab() {
  const [selectedPkgs, setSelectedPkgs] = useState({ "PKG-001": true });
  const [destination, setDestination] = useState("");
  const [companyQuery, setCompanyQuery] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  const rfqs = [
    { number: "FRT-RFQ-201", company: "DHL Global Forwarding", destination: "گمرک شهید رجایی", sentDate: "۱۴۰۵/۰۳/۱۲", packages: ["PKG-001"], initialStatus: "offer_received" },
    { number: "FRT-RFQ-202", company: "Turk Nakliyat A.Ş.", destination: "گمرک شهید رجایی", sentDate: "۱۴۰۵/۰۳/۱۲", packages: ["PKG-001"], initialStatus: "awaiting_response" },
  ];

  return (
    <div>
      <Section
        title="ارسال استعلام حمل جدید"
        subtitle="فقط بسته‌هایی که در صفحه استعلام مربوطه «آماده حمل» علامت خورده‌اند اینجا نمایش داده می‌شوند — فقط قابل انتخاب هستند، نه ویرایش. مقصد گمرک را مشخص کن و به چند شرکت حمل هم‌زمان استعلام بده"
        accent={tokens.primary}
      >
        <div className="space-y-1.5 mb-4">
          {PACKAGED_ITEMS.map((p) => (
            <label key={p.id} className="flex items-center gap-2.5 rounded-md px-3 py-2 text-xs cursor-pointer" style={{ background: selectedPkgs[p.id] ? tokens.accentSoft : tokens.bg }}>
              <input type="checkbox" checked={!!selectedPkgs[p.id]} onChange={() => setSelectedPkgs({ ...selectedPkgs, [p.id]: !selectedPkgs[p.id] })} className="w-3.5 h-3.5" />
              <span className="mono" style={{ color: tokens.textSecondary }}>{p.id}</span>
              <span style={{ color: tokens.textPrimary }}>{p.po}</span>
              <span className="mono text-[11px]" style={{ color: tokens.textSecondary }}>({p.inquiry})</span>
              <span className="mono text-[11px]" style={{ color: tokens.textSecondary }}>{p.dims} · {p.weight} · ×{p.qty}</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: tokens.successSoft, color: tokens.success }}>آماده حمل</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full mr-auto" style={{ background: tokens.bg, color: tokens.textSecondary }}>{p.location}</span>
            </label>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
          <div>
            <label className={label} style={{ color: tokens.textPrimary }}>گمرک/مرز مقصد</label>
            <input value={destination} onChange={(e) => setDestination(e.target.value)} className="w-full rounded-md px-3 py-2 text-sm" style={inputStyle} placeholder="مثلاً گمرک شهید رجایی" />
          </div>
          <div className="relative">
            <label className={label} style={{ color: tokens.textPrimary }}>شرکت حمل</label>
            <div className="relative">
              <Search size={14} className="absolute top-2.5 right-3" style={{ color: tokens.textSecondary }} />
              <input value={companyQuery} onChange={(e) => setCompanyQuery(e.target.value)} className="w-full rounded-md pr-9 pl-3 py-2 text-sm" style={inputStyle} placeholder="جستجوی شرکت حمل..." />
            </div>
          </div>
        </div>
        <button type="button" onClick={() => setShowPreview(true)} className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium ml-2" style={{ color: tokens.textPrimary, border: `1px solid ${tokens.border}` }}>
          <FileText size={14} /> پیش‌نمایش متن ایمیل
        </button>
        <button type="button" className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium text-white" style={{ background: tokens.primary }}>
          <Send size={14} /> ارسال استعلام حمل
        </button>
      </Section>

      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(20,18,14,0.45)" }}>
          <div className="rounded-lg w-full max-w-xl max-h-[85vh] overflow-y-auto" dir="ltr" style={{ background: tokens.surface }}>
            <div className="flex items-center justify-between px-5 py-3.5" dir="rtl" style={{ borderBottom: `1px solid ${tokens.border}` }}>
              <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>Email Preview (پیش‌نمایش — به انگلیسی)</p>
              <button onClick={() => setShowPreview(false)} style={{ color: tokens.textSecondary }}>✕</button>
            </div>
            <div className="p-5 text-sm" style={{ color: tokens.textPrimary, fontFamily: "Arial, sans-serif" }}>
              <p className="mb-1"><span style={{ color: tokens.textSecondary }}>To: </span>{companyQuery || "— freight company not selected —"}</p>
              <p className="mb-3"><span style={{ color: tokens.textSecondary }}>Subject: </span>Freight Quotation Request — Destination Customs: {destination || "—"}</p>
              <p className="mb-3" style={{ color: tokens.textSecondary }}>
                Dear Sir/Madam,<br />
                Kindly provide your best freight quotation for the pickup and delivery of the following packages to the destination customs mentioned above.
              </p>
              <table className="w-full text-xs mb-4" style={{ borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: tokens.textSecondary, borderBottom: `1px solid ${tokens.border}` }}>
                    <th className="text-left font-normal pb-1.5 pl-2">Package</th>
                    <th className="text-left font-normal pb-1.5">Dimensions</th>
                    <th className="text-left font-normal pb-1.5">Weight</th>
                    <th className="text-left font-normal pb-1.5">Qty</th>
                    <th className="text-left font-normal pb-1.5">Pickup Address</th>
                  </tr>
                </thead>
                <tbody>
                  {PACKAGED_ITEMS.filter((p) => selectedPkgs[p.id]).map((p) => (
                    <tr key={p.id} style={{ borderBottom: `1px solid ${tokens.border}` }}>
                      <td className="mono py-1.5 pl-2">{p.id}</td>
                      <td className="mono py-1.5">{p.dims}</td>
                      <td className="mono py-1.5">{p.weight}</td>
                      <td className="mono py-1.5">{p.qty}</td>
                      <td className="py-1.5">{p.location}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs" style={{ color: tokens.textSecondary }}>
                Destination Customs: <strong style={{ color: tokens.textPrimary }}>{destination || "—"}</strong>
              </p>
              <p className="text-xs mt-3" style={{ color: tokens.textSecondary }}>Best regards,</p>
            </div>
          </div>
        </div>
      )}

      <p className="text-sm font-semibold mb-3" style={{ color: tokens.textPrimary }}>استعلام‌های حمل ارسال‌شده</p>
      <div className="space-y-2.5">
        {rfqs.map((r) => <FreightRfqCard key={r.number} rfq={r} />)}
      </div>
    </div>
  );
}

const STAGES = [
  { key: "consolidating", label: "تجمیع" },
  { key: "in_transit", label: "در حال حمل" },
  { key: "export_declared", label: "اظهارنامه صادرات" },
  { key: "iran_docs_sent", label: "مدارک ایران ارسال شد" },
  { key: "customs_declared", label: "اظهار گمرکی مقصد" },
  { key: "cleared", label: "ترخیص و انبار" },
];

function StageBadge({ stage }) {
  const idx = STAGES.findIndex((s) => s.key === stage);
  const meta = idx === STAGES.length - 1
    ? { color: tokens.success, bg: tokens.successSoft }
    : { color: tokens.accent, bg: tokens.accentSoft };
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: meta.bg, color: meta.color }}>
      {STAGES[idx]?.label}
    </span>
  );
}

const EXISTING_SHIPMENTS = [
  { number: "SHP-2026-013", freightCompany: "DHL Global Forwarding", destination: "گمرک شهید رجایی", stage: "cleared", packages: ["PKG-098 (INQ-2026-0290)", "PKG-099 (INQ-2026-0301)"], eta: "۱۴۰۵/۰۳/۰۸" },
  { number: "SHP-2026-014", freightCompany: "DHL Global Forwarding", destination: "گمرک شهید رجایی", stage: "in_transit", packages: ["PKG-001 (INQ-2026-0417)"], eta: "۱۴۰۵/۰۴/۰۲" },
];

function StageStep({ stage, currentIdx, idx, children }) {
  const done = idx < currentIdx;
  const active = idx === currentIdx;
  const pending = idx > currentIdx;
  return (
    <div className="flex gap-3 mb-1">
      <div className="flex flex-col items-center">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-semibold"
          style={{
            background: done ? tokens.success : active ? tokens.primary : tokens.bg,
            color: done || active ? "#fff" : tokens.textSecondary,
            border: pending ? `1px solid ${tokens.border}` : "none",
          }}
        >
          {done ? <Check size={13} /> : idx + 1}
        </div>
        {idx < STAGES.length - 1 && <div className="w-0.5 flex-1 my-1" style={{ background: done ? tokens.success : tokens.border }} />}
      </div>
      <div className="flex-1 pb-5">
        <p className="text-sm font-semibold mb-2" style={{ color: active ? tokens.textPrimary : tokens.textSecondary }}>
          {stage.label}
        </p>
        {(active || done) && children}
      </div>
    </div>
  );
}

function ShipmentDetail({ shipment, onBack }) {
  const [stage, setStage] = useState(shipment.stage);
  const currentIdx = STAGES.findIndex((s) => s.key === stage);
  const advance = () => {
    if (currentIdx < STAGES.length - 1) setStage(STAGES[currentIdx + 1].key);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} style={{ color: tokens.textSecondary }}><ArrowRight size={18} /></button>
        <span className="text-xs" style={{ color: tokens.textSecondary }}>بازگشت به لیست بارها</span>
      </div>
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-lg font-bold" style={{ color: tokens.textPrimary }}>بار {shipment.number}</h1>
        <StageBadge stage={stage} />
      </div>

      <Section title="مشخصات محموله">
        <div className="grid grid-cols-2 gap-2.5 mb-2 text-xs">
          <p style={{ color: tokens.textSecondary }}>شرکت حمل: <span style={{ color: tokens.textPrimary }}>{shipment.freightCompany}</span></p>
          <p style={{ color: tokens.textSecondary }}>مقصد گمرک: <span style={{ color: tokens.textPrimary }}>{shipment.destination}</span></p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {shipment.packages.map((p) => (
            <span key={p} className="mono text-[11px] px-2 py-1 rounded" style={{ background: tokens.bg, color: tokens.textSecondary }}>{p}</span>
          ))}
        </div>
      </Section>

      <div className="rounded-lg p-5 mb-5" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
        <p className="text-sm font-semibold mb-4" style={{ color: tokens.textPrimary }}>مسیر مراحل محموله</p>

        <StageStep stage={STAGES[0]} idx={0} currentIdx={currentIdx}>
          <p className="text-xs" style={{ color: tokens.textSecondary }}>بسته‌ها در انبار واسط تجمیع شدن.</p>
        </StageStep>

        <StageStep stage={STAGES[1]} idx={1} currentIdx={currentIdx}>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-2">
            <div><label className={label} style={{ color: tokens.textSecondary }}>شماره بارنامه</label><input className="mono text-xs w-full rounded px-2 py-1.5" style={inputStyle} /></div>
            <div><label className={label} style={{ color: tokens.textSecondary }}>تاریخ بارگیری</label><input type="date" className="mono text-xs w-full rounded px-2 py-1.5" style={inputStyle} /></div>
            <div><label className={label} style={{ color: tokens.textSecondary }}>ETA</label><input type="date" className="mono text-xs w-full rounded px-2 py-1.5" style={inputStyle} /></div>
          </div>
          <p className="text-[11px] mb-2" style={{ color: tokens.textSecondary }}>اسناد صادراتی که باید برای شرکت حمل ارسال بشه — همزمان اینجا هم بارگذاری می‌شه:</p>
          <div className="flex flex-wrap gap-2">
            {["Invoice", "Packing List", "Non-Dual-Use", "POA"].map((d) => (
              <button key={d} type="button" className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md text-white" style={{ background: tokens.primary }}><Send size={11} /> ارسال {d}</button>
            ))}
          </div>
          {currentIdx === 1 && <button type="button" onClick={advance} className="mt-3 text-xs px-3 py-1.5 rounded-md text-white" style={{ background: tokens.primary }}>ثبت و رفتن به مرحله بعد</button>}
        </StageStep>

        <StageStep stage={STAGES[2]} idx={2} currentIdx={currentIdx}>
          <p className="text-[11px] mb-2" style={{ color: tokens.textSecondary }}>سند EX1 / بیانه صادرات که شرکت حمل برای ما ارسال کرده:</p>
          <div className="grid grid-cols-2 gap-2.5 mb-2">
            <input placeholder="شماره اظهارنامه صادرات" className="mono text-xs rounded px-2 py-1.5" style={inputStyle} />
            <button type="button" className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md" style={{ color: tokens.accent, background: tokens.accentSoft }}><Paperclip size={12} /> بارگذاری فایل EX1/بیانه</button>
          </div>
          {currentIdx === 2 && <button type="button" onClick={advance} className="mt-1 text-xs px-3 py-1.5 rounded-md text-white" style={{ background: tokens.primary }}>ثبت و رفتن به مرحله بعد</button>}
        </StageStep>

        <StageStep stage={STAGES[3]} idx={3} currentIdx={currentIdx}>
          <p className="text-[11px] mb-2" style={{ color: tokens.textSecondary }}>
            مدارک سمت ایران — هم‌زمان برای شرکت حمل ارسال و اینجا بارگذاری می‌شن:
          </p>
          <div className="grid grid-cols-2 gap-2.5 mb-2">
            <input placeholder="شماره ثبت سفارش" className="mono text-xs rounded px-2 py-1.5" style={inputStyle} />
            <input placeholder="شماره بیمه‌نامه" className="mono text-xs rounded px-2 py-1.5" style={inputStyle} />
            <input placeholder="شماره فاکتور ریالی شرکت حمل" className="mono text-xs rounded px-2 py-1.5" style={inputStyle} />
            <input placeholder="شماره فاکتور ارزی شرکت حمل" className="mono text-xs rounded px-2 py-1.5" style={inputStyle} />
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              "ثبت سفارش", "بیمه‌نامه", "Invoice لگ دوم", "Packing لگ دوم",
              "بارنامه", "قبض انبار", "ترخیصیه/واگذاری",
              "فاکتور ریالی شرکت حمل", "فاکتور ارزی شرکت حمل",
              "گواهی بازرسی", "گواهی مبدأ",
            ].map((d) => (
              <button key={d} type="button" className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md text-white" style={{ background: tokens.primary }}><Send size={11} /> {d}</button>
            ))}
          </div>
          {currentIdx === 3 && <button type="button" onClick={advance} className="mt-3 text-xs px-3 py-1.5 rounded-md text-white" style={{ background: tokens.primary }}>ثبت و رفتن به مرحله بعد</button>}
        </StageStep>

        <StageStep stage={STAGES[4]} idx={4} currentIdx={currentIdx}>
          <p className="text-[11px] mb-2" style={{ color: tokens.textSecondary }}>بار به گمرک مقصد رسیده و اظهار شده:</p>
          <div className="grid grid-cols-2 gap-2.5 mb-2">
            <input placeholder="شماره اظهارنامه گمرکی" className="mono text-xs rounded px-2 py-1.5" style={inputStyle} />
            <button type="button" className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-md" style={{ color: tokens.accent, background: tokens.accentSoft }}><Paperclip size={12} /> بارگذاری اظهارنامه گمرکی</button>
          </div>
          {currentIdx === 4 && <button type="button" onClick={advance} className="mt-1 text-xs px-3 py-1.5 rounded-md text-white" style={{ background: tokens.primary }}>ثبت و رفتن به مرحله بعد</button>}
        </StageStep>

        <StageStep stage={STAGES[5]} idx={5} currentIdx={currentIdx}>
          <p className="text-[11px] mb-2" style={{ color: tokens.textSecondary }}>هزینه‌های ترخیص — دو بخش جدا:</p>
          <div className="grid grid-cols-2 gap-2.5 mb-3">
            <div>
              <label className={label} style={{ color: tokens.textSecondary }}>حقوق و عوارض گمرکی</label>
              <input placeholder="0.00" className="mono text-xs w-full rounded px-2 py-1.5" style={inputStyle} />
            </div>
            <div>
              <label className={label} style={{ color: tokens.textSecondary }}>کارمزد و سایر هزینه‌های ترخیص</label>
              <input placeholder="0.00" className="mono text-xs w-full rounded px-2 py-1.5" style={inputStyle} />
            </div>
            <input placeholder="نام ترخیص‌کار" className="text-xs rounded px-2 py-1.5 col-span-2" style={inputStyle} />
          </div>
          <p className="text-[11px] mb-2" style={{ color: tokens.textSecondary }}>اسناد پایانی خروج از گمرک:</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md" style={{ color: tokens.accent, background: tokens.accentSoft }}><Paperclip size={12} /> قبض باسکول</button>
            <button type="button" className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md" style={{ color: tokens.accent, background: tokens.accentSoft }}><Paperclip size={12} /> بارنامه خروج از گمرک</button>
          </div>
          <div
            className="rounded-md px-3 py-2.5 mt-4 text-xs"
            style={{ background: tokens.successSoft, color: tokens.textPrimary }}
          >
            ✓ کار این ماژول برای این محموله تمام شد. ثبت مقدار دریافتی و تصاویر هر کالا، توسط
            کارشناس فروش در صفحه خود پرونده/استعلام انجام می‌شه.
          </div>
        </StageStep>
      </div>

      <div className="flex justify-end">
        <button type="button" className="px-5 py-2.5 rounded-md text-sm font-medium text-white" style={{ background: tokens.primary }}>ذخیره تغییرات</button>
      </div>
    </div>
  );
}

function ShipmentsTab() {
  const [selected, setSelected] = useState(null);
  if (selected) return <ShipmentDetail shipment={selected} onBack={() => setSelected(null)} />;
  return (
    <div className="space-y-2.5">
      {EXISTING_SHIPMENTS.map((s) => (
        <button key={s.number} type="button" onClick={() => setSelected(s)} className="w-full text-right rounded-lg p-4 flex flex-wrap items-center gap-3" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
          <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0" style={{ background: tokens.accentSoft, color: tokens.accent }}><Package size={16} /></div>
          <div>
            <p className="mono text-sm font-semibold" style={{ color: tokens.textPrimary }}>{s.number}</p>
            <p className="text-xs" style={{ color: tokens.textSecondary }}>{s.freightCompany} · {s.packages.length} بسته · ETA {s.eta}</p>
          </div>
          <div className="mr-auto"><StageBadge stage={s.stage} /></div>
        </button>
      ))}
    </div>
  );
}

export default function ShipmentManagementMockup() {
  const [tab, setTab] = useState("freight");

  return (
    <div dir="rtl" style={{ background: tokens.bg, minHeight: "100vh", fontFamily: "Vazirmatn, sans-serif" }} className="p-4 sm:p-8">
      <style>{`@import url('${FONT_IMPORT_URL}'); .mono { font-family: 'JetBrains Mono', monospace; }`}</style>
      <div className="max-w-4xl mx-auto">
        <p className="text-xs font-medium tracking-wide mb-1" style={{ color: tokens.accent }}>ماژول سراسری</p>
        <h1 className="text-xl sm:text-2xl font-bold mb-1" style={{ color: tokens.textPrimary }}>مدیریت بارها</h1>
        <p className="text-xs mb-2" style={{ color: tokens.textSecondary }}>
          استعلام حمل از شرکت‌های باربری، و پیگیری ترخیص — مستقل از صفحه هر استعلام، چون یک بار
          می‌تونه شامل کالاهای چند پرونده مختلف باشه.
        </p>
        <div className="rounded-md px-4 py-2.5 mb-5 text-xs font-medium" style={{ background: tokens.warningSoft, color: tokens.warning }}>
          🔒 این ماژول فقط برای بازرگانی و مدیریت قابل مشاهده است.
        </div>

        <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1" style={{ borderBottom: `1px solid ${tokens.border}` }}>
          {MODULE_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className="px-4 py-2.5 text-sm font-medium whitespace-nowrap"
              style={{
                color: tab === t.key ? tokens.primary : tokens.textSecondary,
                borderBottom: tab === t.key ? `2px solid ${tokens.primary}` : "2px solid transparent",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "freight" && <FreightTab />}
        {tab === "shipments" && <ShipmentsTab />}
      </div>
    </div>
  );
}
