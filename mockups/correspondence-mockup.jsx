import React, { useState } from "react";
import {
  ArrowRight,
  Search,
  Plus,
  Mail,
  MailOpen,
  FileEdit,
  Paperclip,
  Upload,
  Tag,
  Clock,
  Bell,
  History,
  User,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  FileText,
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

const TYPE_META = {
  incoming: { label: "دریافتی", color: tokens.primary, bg: "#E7EDF3", icon: MailOpen },
  outgoing: { label: "ارسالی", color: tokens.success, bg: tokens.successSoft, icon: Mail },
  internal: { label: "داخلی", color: tokens.accent, bg: tokens.accentSoft, icon: FileEdit },
};
const PRIORITY_META = {
  normal: { label: "عادی", color: tokens.textSecondary, bg: tokens.bg },
  urgent: { label: "فوری", color: tokens.warning, bg: tokens.warningSoft },
  very_urgent: { label: "خیلی فوری", color: tokens.danger, bg: "#F3E6E4" },
};
const STATUS_META = {
  draft: { label: "پیش‌نویس", color: tokens.textSecondary, bg: tokens.bg },
  registered: { label: "ثبت‌شده", color: tokens.primary, bg: "#E7EDF3" },
  sent: { label: "ارسال‌شده", color: tokens.success, bg: tokens.successSoft },
  archived: { label: "بایگانی‌شده", color: tokens.accent, bg: tokens.accentSoft },
};
const CATEGORY_LABEL = {
  contract: "قرارداد", invoice: "فاکتور", shipping_doc: "سند حمل", customs_doc: "سند گمرکی",
  technical_file: "فایل فنی", other: "سایر",
};

const OUR_ENTITIES = [
  { id: "oe1", name: "پولاد تجهیز آپادانا", shortCode: "پت" },
  { id: "oe2", name: "General Trading srl", shortCode: "جت" },
  { id: "oe3", name: "Landa Controls", shortCode: "لک" },
  { id: "oe4", name: "Pasifik Global Makina", shortCode: "پگ" },
];

// طرف‌های تجاری بیرونی — شامل مشتری/تأمین‌کننده/شرکت حمل/سازمان/بانک/شرکت خدماتی
const EXTERNAL_PARTNERS = [
  { id: "p1", name: "فولاد مبارکه اصفهان", type: "customer", contacts: ["مهندس رضایی", "خانم احمدی"] },
  { id: "p2", name: "ذوب‌آهن اصفهان", type: "customer", contacts: ["آقای طاهری"] },
  { id: "p3", name: "Schaeffler Group", type: "supplier", contacts: ["Mr. Klein"] },
  { id: "p4", name: "DHL Global Forwarding", type: "freight_forwarder", contacts: [] },
  { id: "p5", name: "گمرک شهید رجایی", type: "organization", contacts: [] },
  { id: "p6", name: "بانک تجارت شعبه مرکزی", type: "bank", contacts: [] },
  { id: "p7", name: "بیمه ایران — نمایندگی اصفهان", type: "service_company", contacts: [] },
];
const PARTNER_TYPE_LABEL = {
  customer: "مشتری", supplier: "تأمین‌کننده", both: "مشتری و تأمین‌کننده", freight_forwarder: "شرکت حمل",
  organization: "سازمان", bank: "بانک", service_company: "شرکت خدماتی",
};

const SAMPLE_INQUIRIES = ["INQ-2026-0417", "INQ-2026-0388", "INQ-2026-0301"];
const SAMPLE_SHIPMENTS = ["SHP-2026-013", "SHP-2026-014"];

const INITIAL_LETTERS = [
  {
    id: 1, letterNumber: "1405-پت-0041", type: "incoming", date: "۱۴۰۵/۰۴/۰۱", subject: "اعلام نتیجه مناقصه یاتاقان‌های نورد ۲",
    sender: "فولاد مبارکه اصفهان", receiver: "پولاد تجهیز آپادانا", department: "فروش", priority: "urgent", status: "archived",
    relatedInquiry: "INQ-2026-0417", issuingEntityId: "oe1", description: "نامه رسمی اعلام برنده شدن در بخشی از اقلام",
    documents: [{ name: "نتیجه-مناقصه.pdf", type: "pdf", category: "other", tags: ["مناقصه"] }],
    workflow: [
      { action: "registered", by: "فرشید محمدی", at: "۱۴۰۵/۰۴/۰۱ ۰۹:۱۲" },
      { action: "referred", by: "فرشید محمدی", to: "علی محمدی", at: "۱۴۰۵/۰۴/۰۱ ۰۹:۲۰" },
      { action: "responded", by: "علی محمدی", at: "۱۴۰۵/۰۴/۰۲ ۱۱:۰۰" },
      { action: "archived", by: "علی محمدی", at: "۱۴۰۵/۰۴/۰۲ ۱۱:۰۵" },
    ],
  },
  {
    id: 2, letterNumber: null, type: "outgoing", date: "۱۴۰۵/۰۴/۰۵", subject: "درخواست تمدید مهلت ارائه پیشنهاد",
    sender: "پولاد تجهیز آپادانا", receiver: "ذوب‌آهن اصفهان", department: "فروش", priority: "normal", status: "draft",
    relatedInquiry: "INQ-2026-0388", issuingEntityId: "oe1", description: "",
    documents: [], workflow: [],
  },
  {
    id: 3, letterNumber: "1405-جت-0004", type: "internal", date: "۱۴۰۵/۰۳/۲۸", subject: "هماهنگی داخلی جهت ارسال محموله SHP-2026-014",
    sender: "بازرگانی", receiver: "مالی", department: "بازرگانی", priority: "normal", status: "registered",
    relatedShipment: "SHP-2026-014", issuingEntityId: "oe2", description: "",
    documents: [], workflow: [{ action: "registered", by: "حسین رستمی", at: "۱۴۰۵/۰۳/۲۸ ۱۴:۰۰" }],
  },
];

const WORKFLOW_ACTION_LABEL = {
  registered: "ثبت شد", scanned: "اسکن و آپلود شد", referred: "ارجاع شد", responded: "پاسخ داده شد",
  approved: "تأیید مدیر", sent: "ارسال شد", archived: "بایگانی شد",
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

function TypeBadge({ type }) {
  const m = TYPE_META[type];
  const Icon = m.icon;
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: m.bg, color: m.color }}>
      <Icon size={11} /> {m.label}
    </span>
  );
}
function StatusBadge({ status }) {
  const m = STATUS_META[status];
  return <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: m.bg, color: m.color }}>{m.label}</span>;
}
function PriorityBadge({ priority }) {
  const m = PRIORITY_META[priority];
  if (priority === "normal") return null;
  return <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: m.bg, color: m.color }}>{m.label}</span>;
}

// ============================================================
// جزئیات نامه
// ============================================================

function LetterDetail({ letter, onBack, onDeleted }) {
  const [data, setData] = useState({ ...letter });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showRefer, setShowRefer] = useState(false);
  const [referTo, setReferTo] = useState("");
  const [referNote, setReferNote] = useState("");
  const [expandedSection, setExpandedSection] = useState("documents");

  const issuingEntity = OUR_ENTITIES.find((oe) => oe.id === data.issuingEntityId) || OUR_ENTITIES[0];

  const doAction = (action, extra = {}) => {
    setData({
      ...data,
      workflow: [...data.workflow, { action, by: "فرشید محمدی", at: "امروز", ...extra }],
      status: action === "archived" ? "archived" : action === "sent" ? "sent" : action === "registered" ? "registered" : data.status,
      letterNumber: action === "registered" && !data.letterNumber
        ? `1405-${issuingEntity.shortCode}-00${Math.floor(Math.random() * 90 + 10)}`
        : data.letterNumber,
    });
  };

  const sendReferral = () => {
    doAction("referred", { to: referTo, note: referNote });
    setShowRefer(false);
    setReferTo("");
    setReferNote("");
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} style={{ color: tokens.textSecondary }}><ArrowRight size={18} /></button>
        <span className="text-xs" style={{ color: tokens.textSecondary }}>بازگشت به لیست نامه‌ها</span>
      </div>

      <div className="rounded-lg p-4 mb-5" style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRight: `4px solid ${TYPE_META[data.type].color}` }}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <TypeBadge type={data.type} />
              <StatusBadge status={data.status} />
              <PriorityBadge priority={data.priority} />
              {data.letterNumber && (
                <span className="mono text-xs" style={{ color: tokens.accent }}>{data.letterNumber}</span>
              )}
            </div>
            <h1 className="text-lg font-bold" style={{ color: tokens.textPrimary }}>{data.subject}</h1>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          <div><p className="text-[11px]" style={{ color: tokens.textSecondary }}>تاریخ نامه</p><p className="mono text-sm" style={{ color: tokens.textPrimary }}>{data.date}</p></div>
          <div><p className="text-[11px]" style={{ color: tokens.textSecondary }}>فرستنده</p><p className="text-sm" style={{ color: tokens.textPrimary }}>{data.sender || "—"}</p></div>
          <div><p className="text-[11px]" style={{ color: tokens.textSecondary }}>گیرنده</p><p className="text-sm" style={{ color: tokens.textPrimary }}>{data.receiver || "—"}</p></div>
          <div><p className="text-[11px]" style={{ color: tokens.textSecondary }}>واحد مربوطه</p><p className="text-sm" style={{ color: tokens.textPrimary }}>{data.department || "—"}</p></div>
          {data.relatedInquiry && (
            <div><p className="text-[11px]" style={{ color: tokens.textSecondary }}>پرونده مرتبط</p><p className="mono text-sm" style={{ color: tokens.primary }}>{data.relatedInquiry}</p></div>
          )}
          {data.relatedShipment && (
            <div><p className="text-[11px]" style={{ color: tokens.textSecondary }}>محموله مرتبط</p><p className="mono text-sm" style={{ color: tokens.primary }}>{data.relatedShipment}</p></div>
          )}
        </div>
        {data.description && (
          <p className="text-xs pt-2" style={{ color: tokens.textSecondary, borderTop: `1px dashed ${tokens.border}` }}>{data.description}</p>
        )}

        {/* اکشن‌های گردش کار */}
        <div className="flex flex-wrap gap-2 pt-3 mt-2" style={{ borderTop: `1px dashed ${tokens.border}` }}>
          {data.status === "draft" && (
            <button onClick={() => doAction("registered")} className="text-xs px-3 py-1.5 rounded-md text-white" style={{ background: tokens.primary }}>
              ثبت رسمی و صدور شماره
            </button>
          )}
          <button onClick={() => setShowRefer(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md" style={{ color: tokens.accent, border: `1px solid ${tokens.accent}` }}>
            <User size={12} /> ارجاع به کارشناس
          </button>
          {data.status !== "archived" && (
            <button onClick={() => doAction("archived")} className="text-xs px-3 py-1.5 rounded-md" style={{ color: tokens.textSecondary, border: `1px solid ${tokens.border}` }}>
              بایگانی
            </button>
          )}
          <button onClick={() => setConfirmDelete(true)} className="text-xs px-3 py-1.5 rounded-md" style={{ color: tokens.danger, border: `1px solid ${tokens.danger}` }}>
            حذف نامه
          </button>
        </div>

        {showRefer && (
          <div className="rounded-md p-3 mt-3" style={{ background: tokens.bg }}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2">
              <select value={referTo} onChange={(e) => setReferTo(e.target.value)} className="text-xs rounded px-2 py-1.5" style={inputStyle}>
                <option value="">انتخاب کارشناس...</option>
                <option>علی محمدی</option>
                <option>سارا کریمی</option>
                <option>حسین رستمی</option>
              </select>
              <input value={referNote} onChange={(e) => setReferNote(e.target.value)} placeholder="یادداشت ارجاع (اختیاری)" className="text-xs rounded px-2 py-1.5" style={inputStyle} />
            </div>
            <div className="flex gap-2">
              <button onClick={sendReferral} disabled={!referTo} className="text-xs px-3 py-1.5 rounded-md text-white" style={{ background: referTo ? tokens.success : tokens.textSecondary }}>ارجاع و اعلان</button>
              <button onClick={() => setShowRefer(false)} className="text-xs px-3 py-1.5 rounded-md" style={{ color: tokens.textSecondary }}>انصراف</button>
            </div>
          </div>
        )}
      </div>

      {/* بخش اسناد پیوست */}
      <Collapsible
        title={`اسناد پیوست (${data.documents.length})`}
        icon={<Paperclip size={15} />}
        open={expandedSection === "documents"}
        onToggle={() => setExpandedSection(expandedSection === "documents" ? null : "documents")}
      >
        <div
          className="rounded-md p-6 text-center mb-3"
          style={{ border: `2px dashed ${tokens.border}`, background: tokens.bg }}
        >
          <Upload size={20} className="mx-auto mb-2" style={{ color: tokens.textSecondary }} />
          <p className="text-xs" style={{ color: tokens.textSecondary }}>فایل را اینجا رها کن یا کلیک کن (PDF, JPG, PNG, Excel)</p>
        </div>
        <div className="space-y-1.5">
          {data.documents.map((d, idx) => (
            <div key={idx} className="flex flex-wrap items-center gap-2 rounded-md px-3 py-2 text-xs" style={{ background: tokens.bg }}>
              <FileText size={14} style={{ color: tokens.accent }} />
              <span style={{ color: tokens.textPrimary }}>{d.name}</span>
              <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: tokens.accentSoft, color: tokens.accent }}>{CATEGORY_LABEL[d.category]}</span>
              {d.tags.map((t) => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1" style={{ background: tokens.surface, color: tokens.textSecondary, border: `1px solid ${tokens.border}` }}>
                  <Tag size={9} /> {t}
                </span>
              ))}
              <button className="mr-auto text-[11px] underline" style={{ color: tokens.primary }}>پیش‌نمایش</button>
            </div>
          ))}
          {data.documents.length === 0 && <p className="text-xs" style={{ color: tokens.textSecondary }}>هنوز سندی پیوست نشده.</p>}
        </div>
      </Collapsible>

      {/* گردش کار / تاریخچه */}
      <Collapsible
        title="گردش کار نامه"
        icon={<History size={15} />}
        open={expandedSection === "workflow"}
        onToggle={() => setExpandedSection(expandedSection === "workflow" ? null : "workflow")}
      >
        <div className="space-y-2">
          {data.workflow.map((w, idx) => (
            <div key={idx} className="flex items-center gap-3 text-xs">
              <div className="w-2 h-2 rounded-full shrink-0" style={{ background: tokens.accent }} />
              <span className="mono" style={{ color: tokens.textSecondary }}>{w.at}</span>
              <span style={{ color: tokens.textPrimary }}>
                {WORKFLOW_ACTION_LABEL[w.action]} — {w.by}
                {w.to && <> ← ارجاع به <strong>{w.to}</strong></>}
              </span>
            </div>
          ))}
          {data.workflow.length === 0 && <p className="text-xs" style={{ color: tokens.textSecondary }}>هنوز اقدامی ثبت نشده.</p>}
        </div>
      </Collapsible>

      {/* یادآور پاسخ */}
      <Collapsible
        title="یادآور / مهلت پاسخ"
        icon={<Clock size={15} />}
        open={expandedSection === "reminder"}
        onToggle={() => setExpandedSection(expandedSection === "reminder" ? null : "reminder")}
      >
        <div className="flex flex-wrap items-center gap-2">
          <input type="date" className="mono text-xs rounded px-2 py-1.5" style={inputStyle} />
          <input placeholder="یادداشت یادآور" className="text-xs rounded px-2 py-1.5 flex-1 min-w-[150px]" style={inputStyle} />
          <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md text-white" style={{ background: tokens.primary }}>
            <Bell size={12} /> تنظیم یادآور
          </button>
        </div>
      </Collapsible>

      {confirmDelete && (
        <ConfirmModal title={`حذف نامه «${data.subject}»`} onCancel={() => setConfirmDelete(false)} onConfirm={() => onDeleted(data.id)} />
      )}
    </div>
  );
}

function Collapsible({ title, icon, open, onToggle, children }) {
  return (
    <div className="rounded-lg overflow-hidden mb-3" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between gap-2 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-medium" style={{ color: tokens.textPrimary }}>
          <span style={{ color: tokens.accent }}>{icon}</span> {title}
        </span>
        {open ? <ChevronUp size={16} style={{ color: tokens.textSecondary }} /> : <ChevronDown size={16} style={{ color: tokens.textSecondary }} />}
      </button>
      {open && <div className="px-4 pb-4" style={{ borderTop: `1px dashed ${tokens.border}` }}><div className="pt-3">{children}</div></div>}
    </div>
  );
}

// ============================================================
// فرم نامه جدید — با پیش‌نمایش شماره خودکار
// ============================================================

function PartySelector({ label: fieldLabel, value, onChange }) {
  // value: { kind: 'our'|'partner', ourEntityId?, partnerId?, contactName? }
  const kind = value?.kind || "partner";
  const partner = EXTERNAL_PARTNERS.find((p) => p.id === value?.partnerId);

  return (
    <div>
      <label className={label2} style={{ color: tokens.textPrimary }}>{fieldLabel}</label>
      <div className="flex gap-1.5 mb-1.5">
        <button
          type="button"
          onClick={() => onChange({ kind: "our" })}
          className="text-[11px] px-2.5 py-1 rounded-full"
          style={{
            background: kind === "our" ? tokens.primary : tokens.bg,
            color: kind === "our" ? "#fff" : tokens.textSecondary,
          }}
        >
          یکی از شرکت‌های ما
        </button>
        <button
          type="button"
          onClick={() => onChange({ kind: "partner" })}
          className="text-[11px] px-2.5 py-1 rounded-full"
          style={{
            background: kind === "partner" ? tokens.primary : tokens.bg,
            color: kind === "partner" ? "#fff" : tokens.textSecondary,
          }}
        >
          طرف بیرونی (از قبل تعریف‌شده)
        </button>
      </div>

      {kind === "our" ? (
        <select
          value={value?.ourEntityId || ""}
          onChange={(e) => onChange({ kind: "our", ourEntityId: e.target.value })}
          className="text-sm w-full rounded-md px-3 py-2"
          style={inputStyle}
        >
          <option value="">انتخاب شرکت ما...</option>
          {OUR_ENTITIES.map((oe) => <option key={oe.id} value={oe.id}>{oe.name}</option>)}
        </select>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <select
            value={value?.partnerId || ""}
            onChange={(e) => onChange({ kind: "partner", partnerId: e.target.value, contactName: "" })}
            className="text-sm rounded-md px-3 py-2"
            style={inputStyle}
          >
            <option value="">انتخاب شرکت (مشتری/تأمین‌کننده/سازمان/بانک/...)...</option>
            {EXTERNAL_PARTNERS.map((p) => (
              <option key={p.id} value={p.id}>{p.name} — {PARTNER_TYPE_LABEL[p.type]}</option>
            ))}
          </select>
          <select
            value={value?.contactName || ""}
            onChange={(e) => onChange({ ...value, contactName: e.target.value })}
            disabled={!partner || partner.contacts.length === 0}
            className="text-sm rounded-md px-3 py-2"
            style={inputStyle}
          >
            <option value="">رابط مشخص (اختیاری)</option>
            {partner?.contacts.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      )}
    </div>
  );
}

const label2 = "block text-[11px] mb-1";

function NewLetterForm({ onCancel, onCreated, counters }) {
  const [type, setType] = useState("incoming");
  const [subject, setSubject] = useState("");
  const [department, setDepartment] = useState("فروش");
  const [priority, setPriority] = useState("normal");
  const [sender, setSender] = useState({ kind: "partner" });
  const [receiver, setReceiver] = useState({ kind: "our" });
  const [issuingEntityId, setIssuingEntityId] = useState("oe1");
  const [linkType, setLinkType] = useState("none"); // none | inquiry | shipment
  const [linkValue, setLinkValue] = useState("");

  const issuingEntity = OUR_ENTITIES.find((oe) => oe.id === issuingEntityId);
  const nextSerial = counters[issuingEntityId] || 1;
  const previewNumber = `1405-${issuingEntity?.shortCode}-${String(nextSerial).padStart(4, "0")}`;

  const displayParty = (p) => {
    if (p.kind === "our") return OUR_ENTITIES.find((oe) => oe.id === p.ourEntityId)?.name || "";
    const partner = EXTERNAL_PARTNERS.find((x) => x.id === p.partnerId);
    return partner ? `${partner.name}${p.contactName ? " — " + p.contactName : ""}` : "";
  };

  return (
    <div className="rounded-lg p-4 mb-5" style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRight: `4px solid ${tokens.primary}` }}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>ثبت نامه جدید</p>
        <span className="mono text-xs px-3 py-1 rounded-full" style={{ background: tokens.accentSoft, color: tokens.accent }}>
          پیش‌نمایش شماره: {previewNumber}
        </span>
      </div>
      <p className="text-[11px] mb-3" style={{ color: tokens.textSecondary }}>
        کد داخل شماره، کد اختصاری شرکت صادرکننده/دریافت‌کننده است (نه جهت نامه)؛ شماره نهایی فقط
        بعد از «ثبت رسمی» صادر می‌شه.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-3">
        <select value={type} onChange={(e) => setType(e.target.value)} className="text-sm rounded-md px-3 py-2" style={inputStyle}>
          <option value="incoming">دریافتی</option>
          <option value="outgoing">ارسالی</option>
          <option value="internal">داخلی</option>
        </select>
        <select value={department} onChange={(e) => setDepartment(e.target.value)} className="text-sm rounded-md px-3 py-2" style={inputStyle}>
          <option>فروش</option>
          <option>بازرگانی</option>
          <option>مالی</option>
          <option>مدیریت</option>
        </select>
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="text-sm rounded-md px-3 py-2" style={inputStyle}>
          <option value="normal">عادی</option>
          <option value="urgent">فوری</option>
          <option value="very_urgent">خیلی فوری</option>
        </select>
        <select value={issuingEntityId} onChange={(e) => setIssuingEntityId(e.target.value)} className="text-sm rounded-md px-3 py-2" style={inputStyle}>
          {OUR_ENTITIES.map((oe) => <option key={oe.id} value={oe.id}>شماره‌گذاری: {oe.name}</option>)}
        </select>
      </div>

      <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="موضوع نامه" className="text-sm w-full rounded-md px-3 py-2 mb-3" style={inputStyle} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        <PartySelector label="فرستنده" value={sender} onChange={setSender} />
        <PartySelector label="گیرنده" value={receiver} onChange={setReceiver} />
      </div>

      <div className="pt-3 mb-3" style={{ borderTop: `1px dashed ${tokens.border}` }}>
        <label className={label2} style={{ color: tokens.textPrimary }}>لینک به ...</label>
        <div className="flex gap-1.5 mb-2">
          {[
            { key: "none", label: "بدون لینک" },
            { key: "inquiry", label: "استعلام" },
            { key: "shipment", label: "محموله" },
          ].map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => { setLinkType(o.key); setLinkValue(""); }}
              className="text-[11px] px-2.5 py-1 rounded-full"
              style={{ background: linkType === o.key ? tokens.primary : tokens.bg, color: linkType === o.key ? "#fff" : tokens.textSecondary }}
            >
              {o.label}
            </button>
          ))}
        </div>
        {linkType === "inquiry" && (
          <select value={linkValue} onChange={(e) => setLinkValue(e.target.value)} className="mono text-sm w-full sm:w-64 rounded-md px-3 py-2" style={inputStyle}>
            <option value="">انتخاب استعلام...</option>
            {SAMPLE_INQUIRIES.map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        )}
        {linkType === "shipment" && (
          <select value={linkValue} onChange={(e) => setLinkValue(e.target.value)} className="mono text-sm w-full sm:w-64 rounded-md px-3 py-2" style={inputStyle}>
            <option value="">انتخاب محموله...</option>
            {SAMPLE_SHIPMENTS.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!subject}
          onClick={() =>
            onCreated({
              id: Date.now(), letterNumber: null, type, date: "امروز", subject,
              sender: displayParty(sender), receiver: displayParty(receiver),
              department, priority, status: "draft", issuingEntityId,
              relatedInquiry: linkType === "inquiry" ? linkValue : undefined,
              relatedShipment: linkType === "shipment" ? linkValue : undefined,
              description: "", documents: [], workflow: [],
            })
          }
          className="px-4 py-2 rounded-md text-sm font-medium text-white"
          style={{ background: subject ? tokens.primary : tokens.textSecondary, opacity: subject ? 1 : 0.6 }}
        >
          ذخیره پیش‌نویس
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md text-sm" style={{ color: tokens.textSecondary }}>انصراف</button>
      </div>
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

export default function CorrespondenceMockup() {
  const [letters, setLetters] = useState(INITIAL_LETTERS);
  const [view, setView] = useState("list");
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [showNewForm, setShowNewForm] = useState(false);

  const selected = letters.find((l) => l.id === selectedId);
  const openLetter = (l) => { setSelectedId(l.id); setView("detail"); };
  const backToList = () => { setView("list"); setSelectedId(null); };
  const deleteLetter = (id) => { setLetters(letters.filter((l) => l.id !== id)); backToList(); };

  if (view === "detail" && selected) {
    return <Shell><LetterDetail letter={selected} onBack={backToList} onDeleted={deleteLetter} /></Shell>;
  }

  const filtered = letters.filter((l) => {
    const matchesQuery = l.subject.toLowerCase().includes(query.toLowerCase()) || (l.letterNumber || "").includes(query);
    const matchesType = typeFilter === "all" || l.type === typeFilter;
    const matchesStatus = statusFilter === "all" || l.status === statusFilter;
    const matchesDept = deptFilter === "all" || l.department === deptFilter;
    return matchesQuery && matchesType && matchesStatus && matchesDept;
  });

  const nextSerials = { oe1: 42, oe2: 5, oe3: 3, oe4: 2 };

  return (
    <Shell>
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="text-xs font-medium tracking-wide mb-1" style={{ color: tokens.accent }}>ماژول سراسری</p>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: tokens.textPrimary }}>مکاتبات و بایگانی اسناد</h1>
        </div>
        {!showNewForm && (
          <button type="button" onClick={() => setShowNewForm(true)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-md text-sm font-medium text-white" style={{ background: tokens.primary }}>
            <Plus size={15} /> نامه جدید
          </button>
        )}
      </div>
      <p className="text-xs mb-5" style={{ color: tokens.textSecondary }}>
        هر واحد فقط نامه‌های مربوط به خودش رو می‌بینه (کنترل دسترسی طبق گروه دسترسی کاربر). شماره
        نامه فقط بعد از ثبت رسمی صادر می‌شه.
      </p>

      {showNewForm && (
        <NewLetterForm counters={nextSerials} onCancel={() => setShowNewForm(false)} onCreated={(l) => { setLetters([l, ...letters]); setShowNewForm(false); }} />
      )}

      <div className="relative mb-3">
        <Search size={15} className="absolute top-2.5 right-3" style={{ color: tokens.textSecondary }} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جست‌وجوی موضوع یا شماره نامه..." className="w-full rounded-md pr-9 pl-3 py-2.5 text-sm" style={inputStyle} />
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="text-xs rounded-md px-3 py-2" style={inputStyle}>
          <option value="all">همه انواع</option>
          <option value="incoming">دریافتی</option>
          <option value="outgoing">ارسالی</option>
          <option value="internal">داخلی</option>
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="text-xs rounded-md px-3 py-2" style={inputStyle}>
          <option value="all">همه وضعیت‌ها</option>
          <option value="draft">پیش‌نویس</option>
          <option value="registered">ثبت‌شده</option>
          <option value="sent">ارسال‌شده</option>
          <option value="archived">بایگانی‌شده</option>
        </select>
        <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)} className="text-xs rounded-md px-3 py-2" style={inputStyle}>
          <option value="all">همه واحدها</option>
          <option value="فروش">فروش</option>
          <option value="بازرگانی">بازرگانی</option>
          <option value="مالی">مالی</option>
        </select>
        <span className="text-[11px] mr-auto self-center" style={{ color: tokens.textSecondary }}>{filtered.length} نامه</span>
      </div>

      <div className="space-y-2.5">
        {filtered.map((l) => (
          <button
            key={l.id}
            type="button"
            onClick={() => openLetter(l)}
            className="w-full text-right rounded-lg p-4 flex flex-wrap items-center gap-3"
            style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}
          >
            <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0" style={{ background: TYPE_META[l.type].bg, color: TYPE_META[l.type].color }}>
              {React.createElement(TYPE_META[l.type].icon, { size: 16 })}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                {l.letterNumber && <span className="mono text-xs" style={{ color: tokens.accent }}>{l.letterNumber}</span>}
                <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>{l.subject}</p>
              </div>
              <p className="text-xs" style={{ color: tokens.textSecondary }}>{l.date} · {l.department} · {l.documents.length} سند پیوست</p>
            </div>
            <div className="mr-auto flex items-center gap-2">
              <PriorityBadge priority={l.priority} />
              <StatusBadge status={l.status} />
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
