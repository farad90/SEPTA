import React, { useState } from "react";
import {
  ArrowRight,
  Search,
  Plus,
  Mail,
  MailOpen,
  Send,
  FileText,
  Paperclip,
  Upload,
  Tag,
  Clock,
  Bell,
  Eye,
  Pencil,
  Trash2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Check,
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
const label = "block text-[11px] mb-1";

const TYPE_META = {
  incoming: { label: "دریافتی", icon: MailOpen, color: tokens.success, bg: tokens.successSoft, code: "IN" },
  outgoing: { label: "ارسالی", icon: Send, color: tokens.primary, bg: "#E7EDF3", code: "OUT" },
  internal: { label: "داخلی", icon: Mail, color: tokens.accent, bg: tokens.accentSoft, code: "MEMO" },
};
const PRIORITY_META = {
  normal: { label: "عادی", color: tokens.textSecondary, bg: tokens.bg },
  urgent: { label: "فوری", color: tokens.warning, bg: tokens.warningSoft },
  very_urgent: { label: "خیلی فوری", color: tokens.danger, bg: "#F3E6E4" },
};
const STATUS_META = {
  draft: { label: "پیش‌نویس", color: tokens.textSecondary, bg: tokens.bg },
  registered: { label: "ثبت‌شده", color: tokens.accent, bg: tokens.accentSoft },
  sent: { label: "ارسال‌شده", color: tokens.primary, bg: "#E7EDF3" },
  archived: { label: "بایگانی‌شده", color: tokens.success, bg: tokens.successSoft },
};
const CATEGORY_LABEL = { contract: "قرارداد", invoice: "فاکتور", shipping_doc: "سند حمل", customs_doc: "سند گمرکی", technical_file: "فایل فنی", other: "سایر" };

const WORKFLOW_STAGES = {
  incoming: [
    { key: "registered", label: "ثبت اولیه" },
    { key: "scanned", label: "اسکن و آپلود" },
    { key: "referred", label: "ارجاع به کارشناس" },
    { key: "responded", label: "پاسخ / اقدام" },
    { key: "archived", label: "بایگانی" },
  ],
  outgoing: [
    { key: "draft_step", label: "پیش‌نویس" },
    { key: "approved", label: "تأیید مدیر" },
    { key: "number_assigned", label: "ثبت شماره رسمی" },
    { key: "sent", label: "ارسال" },
    { key: "archived", label: "آرشیو" },
  ],
  internal: [
    { key: "draft_step", label: "پیش‌نویس" },
    { key: "registered", label: "ثبت" },
    { key: "sent", label: "ارسال به واحد مقصد" },
    { key: "archived", label: "بایگانی" },
  ],
};

const INITIAL_LETTERS = [
  {
    id: 1, number: "1405-IN-0042", type: "incoming", date: "۱۴۰۵/۰۳/۱۲", subject: "درخواست تمدید مهلت ارسال پیشنهاد قیمت",
    sender: "فولاد مبارکه اصفهان", receiver: "", department: "فروش", priority: "urgent", status: "registered",
    relatedInquiry: "INQ-2026-0417", description: "مشتری درخواست ۵ روز تمدید داده.",
    stageIndex: 2, referredTo: "فرشید محمدی",
    documents: [{ name: "نامه-درخواست-تمدید.pdf", type: "pdf", category: "other", tags: ["تمدید", "فوری"] }],
    reminder: { dueDate: "۱۴۰۵/۰۳/۱۶", note: "پاسخ باید قبل از این تاریخ ارسال بشه", status: "pending" },
    auditLog: [{ user: "فرشید محمدی", action: "viewed", time: "۱۴۰۵/۰۳/۱۲ ۱۰:۲۰" }],
  },
  {
    id: 2, number: "1405-OUT-0018", type: "outgoing", date: "۱۴۰۵/۰۳/۱۰", subject: "ارسال پیش‌فاکتور نهایی",
    sender: "", receiver: "Schaeffler Group", department: "بازرگانی", priority: "normal", status: "sent",
    relatedInquiry: "INQ-2026-0417", description: "",
    stageIndex: 3, referredTo: "",
    documents: [{ name: "Invoice-Draft.pdf", type: "pdf", category: "invoice", tags: [] }],
    reminder: null, auditLog: [],
  },
  {
    id: 3, number: "", type: "internal", date: "۱۴۰۵/۰۳/۱۴", subject: "هماهنگی ترخیص محموله SHP-2026-014",
    sender: "بازرگانی", receiver: "مالی", department: "مالی", priority: "very_urgent", status: "draft",
    relatedInquiry: "", description: "نیاز به واریز فوری هزینه ترخیص", stageIndex: 0, referredTo: "",
    documents: [], reminder: null, auditLog: [],
  },
];

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
function Badge({ label: l, color, bg }) {
  return <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: bg, color }}>{l}</span>;
}

// ============================================================
// جزئیات نامه
// ============================================================

function LetterDetail({ letter, onBack, onDeleted }) {
  const [editMode, setEditMode] = useState(false);
  const [data, setData] = useState({ ...letter });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [referring, setReferring] = useState(false);
  const [referTo, setReferTo] = useState("");
  const update = (field, value) => setData({ ...data, [field]: value });

  const typeMeta = TYPE_META[data.type];
  const stages = WORKFLOW_STAGES[data.type];
  const TypeIcon = typeMeta.icon;

  const advanceStage = () => {
    if (data.stageIndex < stages.length - 1) update("stageIndex", data.stageIndex + 1);
  };
  const doRefer = () => {
    update("referredTo", referTo);
    update("stageIndex", stages.findIndex((s) => s.key === "referred"));
    setReferring(false);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} style={{ color: tokens.textSecondary }}><ArrowRight size={18} /></button>
        <span className="text-xs" style={{ color: tokens.textSecondary }}>بازگشت به لیست نامه‌ها</span>
      </div>

      <div className="rounded-lg p-4 mb-5" style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRight: `4px solid ${typeMeta.color}` }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ background: typeMeta.bg, color: typeMeta.color }}>
              <TypeIcon size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="mono text-xs" style={{ color: tokens.textSecondary }}>
                  {data.number || "بدون شماره (پیش‌نویس)"}
                </span>
                <Badge label={typeMeta.label} color={typeMeta.color} bg={typeMeta.bg} />
              </div>
              {editMode ? (
                <input value={data.subject} onChange={(e) => update("subject", e.target.value)} className="text-base font-bold rounded px-2 py-1 mt-1" style={inputStyle} />
              ) : (
                <h1 className="text-base font-bold" style={{ color: tokens.textPrimary }}>{data.subject}</h1>
              )}
            </div>
          </div>
          {!editMode && (
            <button onClick={() => setEditMode(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md" style={{ color: tokens.primary, border: `1px solid ${tokens.primary}` }}>
              <Pencil size={12} /> ویرایش
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-3">
          <Badge label={PRIORITY_META[data.priority].label} color={PRIORITY_META[data.priority].color} bg={PRIORITY_META[data.priority].bg} />
          <Badge label={STATUS_META[data.status].label} color={STATUS_META[data.status].color} bg={STATUS_META[data.status].bg} />
        </div>

        {!editMode ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <ViewField title="تاریخ نامه" value={data.date} />
            {data.type !== "outgoing" && <ViewField title="فرستنده" value={data.sender} />}
            {data.type !== "incoming" && <ViewField title="گیرنده" value={data.receiver} />}
            <ViewField title="واحد مربوطه" value={data.department} />
            <ViewField title="مرتبط با استعلام" value={data.relatedInquiry} />
            <div className="col-span-2 sm:col-span-3">
              <ViewField title="توضیحات" value={data.description} />
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-3">
              <input type="date" value={data.date} onChange={(e) => update("date", e.target.value)} className="mono text-xs rounded px-2 py-1.5" style={inputStyle} />
              {data.type !== "outgoing" && <input placeholder="فرستنده" value={data.sender} onChange={(e) => update("sender", e.target.value)} className="text-xs rounded px-2 py-1.5" style={inputStyle} />}
              {data.type !== "incoming" && <input placeholder="گیرنده" value={data.receiver} onChange={(e) => update("receiver", e.target.value)} className="text-xs rounded px-2 py-1.5" style={inputStyle} />}
              <input placeholder="واحد مربوطه" value={data.department} onChange={(e) => update("department", e.target.value)} className="text-xs rounded px-2 py-1.5" style={inputStyle} />
              <select value={data.priority} onChange={(e) => update("priority", e.target.value)} className="text-xs rounded px-2 py-1.5" style={inputStyle}>
                <option value="normal">عادی</option>
                <option value="urgent">فوری</option>
                <option value="very_urgent">خیلی فوری</option>
              </select>
              <input placeholder="مرتبط با استعلام (اختیاری)" value={data.relatedInquiry} onChange={(e) => update("relatedInquiry", e.target.value)} className="mono text-xs rounded px-2 py-1.5" style={inputStyle} />
            </div>
            <textarea value={data.description} onChange={(e) => update("description", e.target.value)} placeholder="توضیحات" rows={2} className="text-xs w-full rounded px-2.5 py-2 resize-none mb-3" style={inputStyle} />
            <div className="flex items-center justify-between pt-3" style={{ borderTop: `1px dashed ${tokens.border}` }}>
              <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md" style={{ color: tokens.danger, border: `1px solid ${tokens.danger}` }}>
                <Trash2 size={13} /> حذف این نامه
              </button>
              <div className="flex gap-2">
                <button onClick={() => setEditMode(false)} className="text-xs px-3 py-1.5 rounded-md" style={{ color: tokens.textSecondary }}>انصراف</button>
                <button onClick={() => setEditMode(false)} className="text-xs px-4 py-1.5 rounded-md text-white" style={{ background: tokens.success }}>ذخیره</button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* مسیر گردش کار */}
      {!editMode && (
        <div className="rounded-lg p-4 mb-5" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
          <p className="text-sm font-semibold mb-3" style={{ color: tokens.textPrimary }}>مسیر گردش کار</p>
          <div className="flex items-center flex-wrap gap-1">
            {stages.map((s, idx) => (
              <React.Fragment key={s.key}>
                <div className="flex items-center gap-1.5">
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold"
                    style={{
                      background: idx <= data.stageIndex ? tokens.success : tokens.bg,
                      color: idx <= data.stageIndex ? "#fff" : tokens.textSecondary,
                    }}
                  >
                    {idx <= data.stageIndex ? <Check size={12} /> : idx + 1}
                  </span>
                  <span className="text-xs" style={{ color: idx <= data.stageIndex ? tokens.textPrimary : tokens.textSecondary }}>{s.label}</span>
                </div>
                {idx < stages.length - 1 && <div className="w-6 h-0.5" style={{ background: idx < data.stageIndex ? tokens.success : tokens.border }} />}
              </React.Fragment>
            ))}
          </div>

          {data.type === "incoming" && stages[data.stageIndex]?.key !== "archived" && (
            <div className="mt-4 pt-3" style={{ borderTop: `1px dashed ${tokens.border}` }}>
              {data.referredTo && (
                <p className="text-xs mb-2" style={{ color: tokens.textSecondary }}>
                  ارجاع‌شده به: <span style={{ color: tokens.textPrimary, fontWeight: 600 }}>{data.referredTo}</span>
                </p>
              )}
              {!referring ? (
                <div className="flex gap-2">
                  <button onClick={() => setReferring(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md" style={{ color: tokens.accent, border: `1px solid ${tokens.accent}` }}>
                    <User size={12} /> ارجاع به کارشناس
                  </button>
                  <button onClick={advanceStage} className="text-xs px-3 py-1.5 rounded-md text-white" style={{ background: tokens.primary }}>
                    ثبت مرحله بعد
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <select value={referTo} onChange={(e) => setReferTo(e.target.value)} className="text-xs rounded px-2 py-1.5" style={inputStyle}>
                    <option value="">انتخاب کارشناس...</option>
                    <option value="فرشید محمدی">فرشید محمدی</option>
                    <option value="علی محمدی">علی محمدی</option>
                    <option value="سارا کریمی">سارا کریمی</option>
                  </select>
                  <button onClick={doRefer} disabled={!referTo} className="text-xs px-3 py-1.5 rounded-md text-white" style={{ background: referTo ? tokens.accent : tokens.textSecondary }}>ثبت ارجاع</button>
                  <button onClick={() => setReferring(false)} className="text-xs px-3 py-1.5 rounded-md" style={{ color: tokens.textSecondary }}>انصراف</button>
                </div>
              )}
            </div>
          )}
          {data.type !== "incoming" && stages[data.stageIndex]?.key !== "archived" && (
            <button onClick={advanceStage} className="mt-4 text-xs px-3 py-1.5 rounded-md text-white" style={{ background: tokens.primary }}>
              ثبت مرحله بعد
            </button>
          )}
        </div>
      )}

      {/* یادآور/مهلت پاسخ */}
      {!editMode && data.reminder && (
        <div className="rounded-lg p-4 mb-5 flex items-center gap-3" style={{ background: tokens.warningSoft, border: `1px solid ${tokens.border}` }}>
          <Clock size={18} style={{ color: tokens.warning }} />
          <div>
            <p className="text-sm font-medium" style={{ color: tokens.textPrimary }}>مهلت پاسخ: {data.reminder.dueDate}</p>
            <p className="text-xs" style={{ color: tokens.textSecondary }}>{data.reminder.note}</p>
          </div>
        </div>
      )}

      {/* اسناد پیوست */}
      {!editMode && (
        <div className="rounded-lg p-4 mb-5" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>اسناد پیوست ({data.documents.length})</p>
            <button className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md" style={{ color: tokens.primary, border: `1px solid ${tokens.primary}` }}>
              <Upload size={12} /> بارگذاری سند
            </button>
          </div>
          <div
            className="rounded-md mb-3 p-4 flex flex-col items-center justify-center text-center"
            style={{ border: `1.5px dashed ${tokens.border}`, background: tokens.bg }}
          >
            <Upload size={18} style={{ color: tokens.textSecondary }} />
            <p className="text-xs mt-1.5" style={{ color: tokens.textSecondary }}>فایل را اینجا بکشید و رها کنید (PDF/Image/Excel)</p>
          </div>
          <div className="space-y-2">
            {data.documents.map((d, idx) => (
              <div key={idx} className="flex flex-wrap items-center gap-2.5 rounded-md px-3 py-2" style={{ background: tokens.bg }}>
                <FileText size={16} style={{ color: tokens.accent }} />
                <span className="text-xs" style={{ color: tokens.textPrimary }}>{d.name}</span>
                <Badge label={CATEGORY_LABEL[d.category]} color={tokens.accent} bg={tokens.accentSoft} />
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
        </div>
      )}

      {/* Audit Log */}
      {!editMode && (
        <div className="rounded-lg p-4" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
          <div className="flex items-center gap-2 mb-2">
            <Eye size={15} style={{ color: tokens.textSecondary }} />
            <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>سابقه بازدید/ویرایش (Audit Log)</p>
          </div>
          {data.auditLog.length === 0 ? (
            <p className="text-xs" style={{ color: tokens.textSecondary }}>هنوز کسی این نامه رو ندیده.</p>
          ) : (
            <div className="space-y-1">
              {data.auditLog.map((a, idx) => (
                <p key={idx} className="text-xs" style={{ color: tokens.textSecondary }}>
                  <span style={{ color: tokens.textPrimary, fontWeight: 500 }}>{a.user}</span> {a.action === "viewed" ? "مشاهده کرد" : "ویرایش کرد"} — <span className="mono">{a.time}</span>
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal title={`حذف نامه «${data.subject}»`} onCancel={() => setConfirmDelete(false)} onConfirm={() => onDeleted(data.id)} />
      )}
    </div>
  );
}

// ============================================================
// فرم نامه جدید
// ============================================================

function NewLetterForm({ onCancel, onCreated }) {
  const [type, setType] = useState("incoming");
  const [subject, setSubject] = useState("");
  const [date, setDate] = useState("");
  const [sender, setSender] = useState("");
  const [receiver, setReceiver] = useState("");
  const [department, setDepartment] = useState("");
  const [priority, setPriority] = useState("normal");
  const [relatedInquiry, setRelatedInquiry] = useState("");
  const [description, setDescription] = useState("");

  const typeMeta = TYPE_META[type];
  const previewNumber = `۱۴۰۵-${typeMeta.code}-${type === "incoming" ? "۰۰۴۳" : type === "outgoing" ? "۰۰۱۹" : "—"}`;

  return (
    <div className="rounded-lg p-4 mb-5" style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRight: `4px solid ${tokens.primary}` }}>
      <p className="text-sm font-semibold mb-3" style={{ color: tokens.textPrimary }}>ثبت نامه جدید</p>

      <div className="flex gap-2 mb-3">
        {Object.entries(TYPE_META).map(([key, m]) => (
          <button
            key={key}
            type="button"
            onClick={() => setType(key)}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-sm font-medium"
            style={{
              background: type === key ? m.bg : tokens.bg,
              color: type === key ? m.color : tokens.textSecondary,
              border: `1.5px solid ${type === key ? m.color : "transparent"}`,
            }}
          >
            <m.icon size={14} /> {m.label}
          </button>
        ))}
      </div>

      <div className="rounded-md px-3 py-2 mb-3 text-xs flex items-center justify-between" style={{ background: tokens.accentSoft, color: tokens.accent }}>
        <span>شماره نامه (پیش‌نمایش — فقط بعد از ثبت رسمی نهایی می‌شه)</span>
        <span className="mono font-semibold">{previewNumber}</span>
      </div>

      <textarea value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="موضوع نامه" rows={2} className="text-sm w-full rounded-md px-3 py-2 mb-2.5 resize-none" style={inputStyle} />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-2.5">
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="mono text-sm rounded-md px-3 py-2" style={inputStyle} />
        {type !== "outgoing" && <input value={sender} onChange={(e) => setSender(e.target.value)} placeholder="فرستنده" className="text-sm rounded-md px-3 py-2" style={inputStyle} />}
        {type !== "incoming" && <input value={receiver} onChange={(e) => setReceiver(e.target.value)} placeholder="گیرنده" className="text-sm rounded-md px-3 py-2" style={inputStyle} />}
        <input value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="واحد مربوطه" className="text-sm rounded-md px-3 py-2" style={inputStyle} />
        <select value={priority} onChange={(e) => setPriority(e.target.value)} className="text-sm rounded-md px-3 py-2" style={inputStyle}>
          <option value="normal">عادی</option>
          <option value="urgent">فوری</option>
          <option value="very_urgent">خیلی فوری</option>
        </select>
        <input value={relatedInquiry} onChange={(e) => setRelatedInquiry(e.target.value)} placeholder="مرتبط با استعلام (اختیاری)" className="mono text-sm rounded-md px-3 py-2" style={inputStyle} />
      </div>

      <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="توضیحات" rows={2} className="text-sm w-full rounded-md px-3 py-2 mb-3 resize-none" style={inputStyle} />

      <div
        className="rounded-md mb-3 p-4 flex flex-col items-center justify-center text-center"
        style={{ border: `1.5px dashed ${tokens.border}`, background: tokens.bg }}
      >
        <Upload size={18} style={{ color: tokens.textSecondary }} />
        <p className="text-xs mt-1.5" style={{ color: tokens.textSecondary }}>فایل اسکن‌شده را اینجا بکشید و رها کنید</p>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={!subject}
          onClick={() =>
            onCreated({
              id: Date.now(), number: "", type, subject, date, sender, receiver, department,
              priority, status: "draft", relatedInquiry, description, stageIndex: 0, referredTo: "",
              documents: [], reminder: null, auditLog: [],
            })
          }
          className="px-4 py-2 rounded-md text-sm font-medium text-white"
          style={{ background: subject ? tokens.primary : tokens.textSecondary, opacity: subject ? 1 : 0.6 }}
        >
          ذخیره به‌عنوان پیش‌نویس
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
  const [showNewForm, setShowNewForm] = useState(false);

  const selected = letters.find((l) => l.id === selectedId);
  const openLetter = (l) => { setSelectedId(l.id); setView("detail"); };
  const backToList = () => { setView("list"); setSelectedId(null); };
  const deleteLetter = (id) => { setLetters(letters.filter((l) => l.id !== id)); backToList(); };

  if (view === "detail" && selected) {
    return <Shell><LetterDetail letter={selected} onBack={backToList} onDeleted={deleteLetter} /></Shell>;
  }

  const filtered = letters.filter((l) => {
    const matchesQuery =
      l.subject.toLowerCase().includes(query.toLowerCase()) ||
      l.number.toLowerCase().includes(query.toLowerCase()) ||
      l.documents.some((d) => d.tags.some((t) => t.includes(query)));
    const matchesType = typeFilter === "all" || l.type === typeFilter;
    const matchesStatus = statusFilter === "all" || l.status === statusFilter;
    return matchesQuery && matchesType && matchesStatus;
  });

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
      <p className="text-xs mb-4" style={{ color: tokens.textSecondary }}>
        ثبت نامه‌های دریافتی/ارسالی/داخلی با شماره‌گذاری خودکار یکتا، بایگانی اسناد اسکن‌شده، و
        پیگیری گردش کار. هر واحد فقط نامه‌های خودش رو می‌بینه (بر اساس گروه دسترسی).
      </p>

      {showNewForm && (
        <NewLetterForm onCancel={() => setShowNewForm(false)} onCreated={(l) => { setLetters([...letters, l]); setShowNewForm(false); }} />
      )}

      <div className="relative mb-3">
        <Search size={15} className="absolute top-2.5 right-3" style={{ color: tokens.textSecondary }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جست‌وجوی موضوع، شماره نامه یا برچسب سند..."
          className="w-full rounded-md pr-9 pl-3 py-2.5 text-sm"
          style={inputStyle}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 mb-5">
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
        <span className="text-[11px] mr-auto" style={{ color: tokens.textSecondary }}>{filtered.length} نامه</span>
      </div>

      <div className="space-y-2.5">
        {filtered.map((l) => {
          const typeMeta = TYPE_META[l.type];
          const TypeIcon = typeMeta.icon;
          return (
            <button
              key={l.id}
              type="button"
              onClick={() => openLetter(l)}
              className="w-full text-right rounded-lg p-4 flex flex-wrap items-center gap-3"
              style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}
            >
              <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0" style={{ background: typeMeta.bg, color: typeMeta.color }}>
                <TypeIcon size={16} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="mono text-xs" style={{ color: tokens.textSecondary }}>{l.number || "بدون شماره"}</span>
                  {l.priority !== "normal" && <Badge label={PRIORITY_META[l.priority].label} color={PRIORITY_META[l.priority].color} bg={PRIORITY_META[l.priority].bg} />}
                </div>
                <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>{l.subject}</p>
                <p className="text-xs" style={{ color: tokens.textSecondary }}>{l.department} · {l.date} {l.documents.length > 0 && `· ${l.documents.length} سند`}</p>
              </div>
              <div className="mr-auto">
                <Badge label={STATUS_META[l.status].label} color={STATUS_META[l.status].color} bg={STATUS_META[l.status].bg} />
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && <p className="text-sm text-center py-6" style={{ color: tokens.textSecondary }}>موردی یافت نشد</p>}
      </div>
    </Shell>
  );
}
