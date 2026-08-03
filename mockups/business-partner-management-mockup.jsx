import React, { useState } from "react";
import {
  ArrowRight,
  Search,
  Plus,
  Building2,
  User,
  Phone,
  Mail,
  AlertTriangle,
  Pencil,
  Trash2,
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
  customer: { label: "مشتری", color: tokens.primary, bg: "#E7EDF3" },
  supplier: { label: "تأمین‌کننده", color: tokens.success, bg: tokens.successSoft },
  both: { label: "مشتری و تأمین‌کننده", color: tokens.accent, bg: tokens.accentSoft },
  freight_forwarder: { label: "شرکت حمل", color: tokens.warning, bg: tokens.warningSoft },
};
const CONTACT_TYPE_LABEL = { technical: "فنی", financial: "مالی", commercial: "بازرگانی", other: "سایر" };
const LEVEL_LABEL = { expert: "کارشناس", manager: "مدیر", ceo: "مدیرعامل" };

const INITIAL_PARTNERS = [
  {
    id: 1, type: "customer", name: "فولاد مبارکه اصفهان", country: "ایران", industry: "فولاد", status: "active",
    province: "اصفهان", city: "مبارکه", postalCode: "8481-", phone: "031-52642000", email: "info@mobarakeh-steel.ir",
    nationalId: "10260071237", regNumber: "5622", address: "کیلومتر ۴۵ جاده اصفهان-مبارکه", notes: "مشتری استراتژیک، سابقه همکاری از ۱۳۹۸",
    contacts: [
      { id: "c1", name: "مهندس رضایی", type: "technical", level: "expert", phone: "0311-1234567", mobile: "0913-1234567", email: "rezaei@mobarakeh-steel.ir", department: "واحد نورد" },
      { id: "c2", name: "خانم احمدی", type: "commercial", level: "manager", phone: "0311-7654321", mobile: "0912-7654321", email: "ahmadi@mobarakeh-steel.ir", department: "واحد خرید" },
    ],
  },
  {
    id: 2, type: "supplier", name: "Schaeffler Group", country: "آلمان", industry: "قطعات صنعتی", status: "active",
    address: "Herzogenaurach, Germany", notes: "",
    contacts: [
      { id: "c3", name: "Mr. Klein", type: "commercial", level: "manager", phone: "+49-911-1234", mobile: "", email: "klein@schaeffler.com", department: "Sales" },
    ],
  },
  { id: 3, type: "supplier", name: "SKF Distribution", country: "هلند", industry: "یاتاقان", status: "active", contacts: [] },
  { id: 4, type: "freight_forwarder", name: "DHL Global Forwarding", country: "آلمان", industry: "حمل و نقل", status: "active", contacts: [] },
  { id: 5, type: "both", name: "Pasifik Global Makina", country: "ترکیه", industry: "ماشین‌آلات صنعتی", status: "inactive", contacts: [] },
];

function TypeBadge({ type }) {
  const m = TYPE_META[type];
  return (
    <span className="text-[11px] font-medium px-2 py-0.5 rounded-full" style={{ background: m.bg, color: m.color }}>
      {m.label}
    </span>
  );
}

function ConfirmModal({ title, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(20,18,14,0.45)" }}>
      <div className="rounded-lg w-full max-w-sm p-5" style={{ background: tokens.surface }}>
        <div className="flex items-center gap-2 mb-3" style={{ color: tokens.danger }}>
          <AlertTriangle size={18} />
          <p className="text-sm font-semibold">{title}</p>
        </div>
        <p className="text-xs mb-4" style={{ color: tokens.textSecondary }}>
          این عملیات قابل بازگشت نیست. مطمئنی؟
        </p>
        <div className="flex gap-2 justify-end">
          <button onClick={onCancel} className="text-xs px-3 py-2 rounded-md" style={{ color: tokens.textSecondary, border: `1px solid ${tokens.border}` }}>
            انصراف
          </button>
          <button onClick={onConfirm} className="text-xs px-3 py-2 rounded-md text-white" style={{ background: tokens.danger }}>
            بله، حذف کن
          </button>
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

// ============================================================
// جزئیات شرکت — پیش‌فرض فقط‌نمایش
// ============================================================

function CompanyDetail({ partner, onBack, onOpenPerson, onDeleted }) {
  const [editMode, setEditMode] = useState(false);
  const [data, setData] = useState({ ...partner });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const emptyContact = { name: "", type: "commercial", level: "expert", phone: "", mobile: "", email: "", department: "" };
  const [newContact, setNewContact] = useState(emptyContact);

  const update = (field, value) => setData({ ...data, [field]: value });

  const saveNewContact = () => {
    setData({ ...data, contacts: [...data.contacts, { ...newContact, id: `c${Date.now()}` }] });
    setNewContact(emptyContact);
    setAddingContact(false);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} style={{ color: tokens.textSecondary }}><ArrowRight size={18} /></button>
        <span className="text-xs" style={{ color: tokens.textSecondary }}>بازگشت به لیست شرکت‌ها</span>
      </div>

      <div className="rounded-lg p-4 mb-5" style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRight: `4px solid ${tokens.primary}` }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ background: tokens.accentSoft, color: tokens.accent }}>
              <Building2 size={18} />
            </div>
            <div>
              {editMode ? (
                <input value={data.name} onChange={(e) => update("name", e.target.value)} className="text-lg font-bold rounded px-2 py-1" style={inputStyle} />
              ) : (
                <h1 className="text-lg font-bold" style={{ color: tokens.textPrimary }}>{data.name}</h1>
              )}
              <p className="text-xs" style={{ color: tokens.textSecondary }}>{data.country} · {data.industry}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <TypeBadge type={data.type} />
            {!editMode && (
              <button onClick={() => setEditMode(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md" style={{ color: tokens.primary, border: `1px solid ${tokens.primary}` }}>
                <Pencil size={12} /> ویرایش
              </button>
            )}
          </div>
        </div>

        {!editMode ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <ViewField title="نوع طرف تجاری" value={TYPE_META[data.type].label} />
            <ViewField title="کشور" value={data.country} />
            <ViewField title="حوزه فعالیت" value={data.industry} />
            <ViewField title="وضعیت" value={data.status === "active" ? "فعال" : "غیرفعال"} />
            <ViewField title="آدرس" value={data.address} />
            {data.country === "ایران" && (
              <>
                <ViewField title="استان" value={data.province} />
                <ViewField title="شهر" value={data.city} />
                <ViewField title="کد پستی" value={data.postalCode} />
                <ViewField title="تلفن" value={data.phone} />
                <ViewField title="ایمیل" value={data.email} />
                <ViewField title="شناسه ملی" value={data.nationalId} />
                <ViewField title="شماره ثبت" value={data.regNumber} />
              </>
            )}
            <div className="col-span-2 sm:col-span-4">
              <ViewField title="ملاحظات" value={data.notes} />
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mb-2">
              <div>
                <label className={label} style={{ color: tokens.textSecondary }}>نوع طرف تجاری</label>
                <select value={data.type} onChange={(e) => update("type", e.target.value)} className="text-xs w-full rounded px-2 py-1.5" style={inputStyle}>
                  <option value="customer">مشتری</option>
                  <option value="supplier">تأمین‌کننده</option>
                  <option value="both">هر دو</option>
                  <option value="freight_forwarder">شرکت حمل</option>
                </select>
              </div>
              <div><label className={label} style={{ color: tokens.textSecondary }}>کشور</label>
                <input value={data.country || ""} onChange={(e) => update("country", e.target.value)} className="text-xs w-full rounded px-2 py-1.5" style={inputStyle} />
              </div>
              <div><label className={label} style={{ color: tokens.textSecondary }}>حوزه فعالیت</label>
                <input value={data.industry || ""} onChange={(e) => update("industry", e.target.value)} className="text-xs w-full rounded px-2 py-1.5" style={inputStyle} />
              </div>
              <div>
                <label className={label} style={{ color: tokens.textSecondary }}>وضعیت</label>
                <select value={data.status} onChange={(e) => update("status", e.target.value)} className="text-xs w-full rounded px-2 py-1.5" style={inputStyle}>
                  <option value="active">فعال</option>
                  <option value="inactive">غیرفعال</option>
                </select>
              </div>
              <input placeholder="آدرس" value={data.address || ""} onChange={(e) => update("address", e.target.value)} className="text-xs rounded px-2 py-1.5 col-span-2 sm:col-span-4" style={inputStyle} />
            </div>

            {data.country === "ایران" && (
              <div className="pt-3 mb-2" style={{ borderTop: `1px dashed ${tokens.border}` }}>
                <p className="text-[11px] font-medium mb-2" style={{ color: tokens.accent }}>اطلاعات اختصاصی شرکت‌های داخلی</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  <input placeholder="استان" value={data.province || ""} onChange={(e) => update("province", e.target.value)} className="text-xs rounded px-2 py-1.5" style={inputStyle} />
                  <input placeholder="شهر" value={data.city || ""} onChange={(e) => update("city", e.target.value)} className="text-xs rounded px-2 py-1.5" style={inputStyle} />
                  <input placeholder="کد پستی" value={data.postalCode || ""} onChange={(e) => update("postalCode", e.target.value)} className="mono text-xs rounded px-2 py-1.5" style={inputStyle} />
                  <input placeholder="تلفن" value={data.phone || ""} onChange={(e) => update("phone", e.target.value)} className="mono text-xs rounded px-2 py-1.5" style={inputStyle} />
                  <input placeholder="ایمیل" value={data.email || ""} onChange={(e) => update("email", e.target.value)} className="text-xs rounded px-2 py-1.5" style={inputStyle} />
                  <input placeholder="شناسه ملی" value={data.nationalId || ""} onChange={(e) => update("nationalId", e.target.value)} className="mono text-xs rounded px-2 py-1.5" style={inputStyle} />
                  <input placeholder="شماره ثبت" value={data.regNumber || ""} onChange={(e) => update("regNumber", e.target.value)} className="mono text-xs rounded px-2 py-1.5" style={inputStyle} />
                </div>
              </div>
            )}

            <div className="pt-3 mb-3" style={{ borderTop: `1px dashed ${tokens.border}` }}>
              <label className={label} style={{ color: tokens.textSecondary }}>ملاحظات</label>
              <textarea rows={2} value={data.notes || ""} onChange={(e) => update("notes", e.target.value)} className="text-xs w-full rounded px-2 py-1.5 resize-none" style={inputStyle} />
            </div>

            <div className="flex items-center justify-between pt-3" style={{ borderTop: `1px dashed ${tokens.border}` }}>
              <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md" style={{ color: tokens.danger, border: `1px solid ${tokens.danger}` }}>
                <Trash2 size={13} /> حذف این شرکت
              </button>
              <div className="flex gap-2">
                <button onClick={() => setEditMode(false)} className="text-xs px-3 py-1.5 rounded-md" style={{ color: tokens.textSecondary }}>انصراف</button>
                <button onClick={() => setEditMode(false)} className="text-xs px-4 py-1.5 rounded-md text-white" style={{ background: tokens.success }}>ذخیره</button>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="rounded-lg p-4" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>رابطین ({data.contacts.length})</p>
          {!addingContact && (
            <button type="button" onClick={() => setAddingContact(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md" style={{ color: tokens.primary, border: `1px solid ${tokens.primary}` }}>
              <Plus size={13} /> افزودن رابط
            </button>
          )}
        </div>

        <div className="space-y-2 mb-3">
          {data.contacts.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onOpenPerson(c, data)}
              className="w-full text-right rounded-md p-3 flex flex-wrap items-center gap-3"
              style={{ background: tokens.bg }}
            >
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: tokens.accentSoft, color: tokens.accent }}>
                <User size={14} />
              </div>
              <div>
                <p className="text-sm font-medium" style={{ color: tokens.textPrimary }}>{c.name}</p>
                <p className="text-[11px]" style={{ color: tokens.textSecondary }}>{LEVEL_LABEL[c.level]} · {c.department}</p>
              </div>
              <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: tokens.accentSoft, color: tokens.accent }}>
                {CONTACT_TYPE_LABEL[c.type]}
              </span>
              <div className="flex items-center gap-3 mr-auto text-[11px]" style={{ color: tokens.textSecondary }}>
                <span className="flex items-center gap-1"><Phone size={11} /> {c.mobile || c.phone}</span>
                <span className="flex items-center gap-1"><Mail size={11} /> {c.email}</span>
              </div>
            </button>
          ))}
          {data.contacts.length === 0 && !addingContact && (
            <p className="text-xs" style={{ color: tokens.textSecondary }}>هنوز رابطی برای این شرکت ثبت نشده.</p>
          )}
        </div>

        {addingContact && (
          <div className="rounded-md p-3" style={{ background: tokens.bg, border: `1px dashed ${tokens.border}` }}>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-2">
              <input placeholder="نام رابط" value={newContact.name} onChange={(e) => setNewContact({ ...newContact, name: e.target.value })} className="text-xs rounded px-2 py-1.5" style={inputStyle} />
              <select value={newContact.type} onChange={(e) => setNewContact({ ...newContact, type: e.target.value })} className="text-xs rounded px-2 py-1.5" style={inputStyle}>
                <option value="technical">فنی</option>
                <option value="financial">مالی</option>
                <option value="commercial">بازرگانی</option>
                <option value="other">سایر</option>
              </select>
              <select value={newContact.level} onChange={(e) => setNewContact({ ...newContact, level: e.target.value })} className="text-xs rounded px-2 py-1.5" style={inputStyle}>
                <option value="expert">کارشناس</option>
                <option value="manager">مدیر</option>
                <option value="ceo">مدیرعامل</option>
              </select>
              <input placeholder="واحد/دپارتمان" value={newContact.department} onChange={(e) => setNewContact({ ...newContact, department: e.target.value })} className="text-xs rounded px-2 py-1.5" style={inputStyle} />
              <input placeholder="تلفن" value={newContact.phone} onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })} className="mono text-xs rounded px-2 py-1.5" style={inputStyle} />
              <input placeholder="موبایل" value={newContact.mobile} onChange={(e) => setNewContact({ ...newContact, mobile: e.target.value })} className="mono text-xs rounded px-2 py-1.5" style={inputStyle} />
              <input placeholder="ایمیل" value={newContact.email} onChange={(e) => setNewContact({ ...newContact, email: e.target.value })} className="text-xs rounded px-2 py-1.5" style={inputStyle} />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={saveNewContact} className="text-xs px-3 py-1.5 rounded-md text-white" style={{ background: tokens.success }}>ذخیره رابط</button>
              <button type="button" onClick={() => setAddingContact(false)} className="text-xs px-3 py-1.5 rounded-md" style={{ color: tokens.textSecondary }}>انصراف</button>
            </div>
          </div>
        )}
      </div>

      {confirmDelete && (
        <ConfirmModal
          title={`حذف شرکت «${data.name}»`}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => { onDeleted(data.id); }}
        />
      )}
    </div>
  );
}

// ============================================================
// جزئیات فرد/رابط — پیش‌فرض فقط‌نمایش
// ============================================================

function PersonDetail({ person, company, onBack, onOpenCompany, onDeleted }) {
  const [editMode, setEditMode] = useState(false);
  const [data, setData] = useState({ ...person });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const update = (field, value) => setData({ ...data, [field]: value });

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} style={{ color: tokens.textSecondary }}><ArrowRight size={18} /></button>
        <span className="text-xs" style={{ color: tokens.textSecondary }}>بازگشت</span>
      </div>

      <div className="rounded-lg p-4 mb-5" style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRight: `4px solid ${tokens.accent}` }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: tokens.accentSoft, color: tokens.accent }}>
              <User size={18} />
            </div>
            <div>
              {editMode ? (
                <input value={data.name} onChange={(e) => update("name", e.target.value)} className="text-lg font-bold rounded px-2 py-1" style={inputStyle} />
              ) : (
                <h1 className="text-lg font-bold" style={{ color: tokens.textPrimary }}>{data.name}</h1>
              )}
              <button onClick={() => onOpenCompany(company)} className="text-xs underline" style={{ color: tokens.primary }}>
                {company.name}
              </button>
            </div>
          </div>
          {!editMode && (
            <button onClick={() => setEditMode(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md" style={{ color: tokens.primary, border: `1px solid ${tokens.primary}` }}>
              <Pencil size={12} /> ویرایش
            </button>
          )}
        </div>

        {!editMode ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <ViewField title="نوع رابط" value={CONTACT_TYPE_LABEL[data.type]} />
            <ViewField title="سطح" value={LEVEL_LABEL[data.level]} />
            <ViewField title="واحد/دپارتمان" value={data.department} />
            <ViewField title="تلفن" value={data.phone} />
            <ViewField title="موبایل" value={data.mobile} />
            <ViewField title="ایمیل" value={data.email} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-3">
              <select value={data.type} onChange={(e) => update("type", e.target.value)} className="text-xs rounded px-2 py-1.5" style={inputStyle}>
                <option value="technical">فنی</option>
                <option value="financial">مالی</option>
                <option value="commercial">بازرگانی</option>
                <option value="other">سایر</option>
              </select>
              <select value={data.level} onChange={(e) => update("level", e.target.value)} className="text-xs rounded px-2 py-1.5" style={inputStyle}>
                <option value="expert">کارشناس</option>
                <option value="manager">مدیر</option>
                <option value="ceo">مدیرعامل</option>
              </select>
              <input placeholder="واحد/دپارتمان" value={data.department || ""} onChange={(e) => update("department", e.target.value)} className="text-xs rounded px-2 py-1.5" style={inputStyle} />
              <input placeholder="تلفن" value={data.phone || ""} onChange={(e) => update("phone", e.target.value)} className="mono text-xs rounded px-2 py-1.5" style={inputStyle} />
              <input placeholder="موبایل" value={data.mobile || ""} onChange={(e) => update("mobile", e.target.value)} className="mono text-xs rounded px-2 py-1.5" style={inputStyle} />
              <input placeholder="ایمیل" value={data.email || ""} onChange={(e) => update("email", e.target.value)} className="text-xs rounded px-2 py-1.5" style={inputStyle} />
            </div>
            <div className="flex items-center justify-between pt-3" style={{ borderTop: `1px dashed ${tokens.border}` }}>
              <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md" style={{ color: tokens.danger, border: `1px solid ${tokens.danger}` }}>
                <Trash2 size={13} /> حذف این رابط
              </button>
              <div className="flex gap-2">
                <button onClick={() => setEditMode(false)} className="text-xs px-3 py-1.5 rounded-md" style={{ color: tokens.textSecondary }}>انصراف</button>
                <button onClick={() => setEditMode(false)} className="text-xs px-4 py-1.5 rounded-md text-white" style={{ background: tokens.success }}>ذخیره</button>
              </div>
            </div>
          </>
        )}
      </div>

      {confirmDelete && (
        <ConfirmModal
          title={`حذف رابط «${data.name}»`}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() => onDeleted(data.id)}
        />
      )}
    </div>
  );
}

// ============================================================
// کامپوننت اصلی
// ============================================================

export default function BusinessPartnerManagementMockup() {
  const [partners, setPartners] = useState(INITIAL_PARTNERS);
  const [mainTab, setMainTab] = useState("companies"); // companies | people
  const [view, setView] = useState("list"); // list | company-detail | person-detail
  const [selectedCompanyId, setSelectedCompanyId] = useState(null);
  const [selectedPersonRef, setSelectedPersonRef] = useState(null); // { personId, companyId }
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [showNewForm, setShowNewForm] = useState(false);

  const selectedCompany = partners.find((p) => p.id === selectedCompanyId);
  const selectedPerson = selectedPersonRef
    ? partners.find((p) => p.id === selectedPersonRef.companyId)?.contacts.find((c) => c.id === selectedPersonRef.personId)
    : null;
  const selectedPersonCompany = selectedPersonRef ? partners.find((p) => p.id === selectedPersonRef.companyId) : null;

  const openCompany = (companyOrId) => {
    const id = typeof companyOrId === "object" ? companyOrId.id : companyOrId;
    setSelectedCompanyId(id);
    setView("company-detail");
  };
  const openPerson = (person, company) => {
    setSelectedPersonRef({ personId: person.id, companyId: company.id });
    setView("person-detail");
  };
  const backToList = () => {
    setView("list");
    setSelectedCompanyId(null);
    setSelectedPersonRef(null);
  };

  const deleteCompany = (id) => {
    setPartners(partners.filter((p) => p.id !== id));
    backToList();
  };
  const deletePerson = (personId) => {
    setPartners(partners.map((p) =>
      p.id === selectedPersonRef.companyId ? { ...p, contacts: p.contacts.filter((c) => c.id !== personId) } : p
    ));
    openCompany(selectedPersonRef.companyId);
  };

  // همه افراد از همه شرکت‌ها، برای تب «افراد»
  const allPeople = partners.flatMap((p) => p.contacts.map((c) => ({ ...c, companyId: p.id, companyName: p.name })));

  if (view === "company-detail" && selectedCompany) {
    return (
      <Shell>
        <CompanyDetail
          partner={selectedCompany}
          onBack={backToList}
          onOpenPerson={openPerson}
          onDeleted={deleteCompany}
        />
      </Shell>
    );
  }
  if (view === "person-detail" && selectedPerson) {
    return (
      <Shell>
        <PersonDetail
          person={selectedPerson}
          company={selectedPersonCompany}
          onBack={() => openCompany(selectedPersonRef.companyId)}
          onOpenCompany={openCompany}
          onDeleted={deletePerson}
        />
      </Shell>
    );
  }

  const filteredCompanies = partners.filter((p) => {
    const matchesQuery = p.name.toLowerCase().includes(query.toLowerCase()) || p.country.includes(query);
    const matchesType = typeFilter === "all" || p.type === typeFilter || (typeFilter === "customer" && p.type === "both") || (typeFilter === "supplier" && p.type === "both");
    return matchesQuery && matchesType;
  });

  const filteredPeople = allPeople.filter((c) =>
    c.name.toLowerCase().includes(query.toLowerCase()) || c.companyName.toLowerCase().includes(query.toLowerCase())
  );

  return (
    <Shell>
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="text-xs font-medium tracking-wide mb-1" style={{ color: tokens.accent }}>ماژول سراسری</p>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: tokens.textPrimary }}>مدیریت شرکت‌ها و رابطین</h1>
        </div>
        {mainTab === "companies" && !showNewForm && (
          <button type="button" onClick={() => setShowNewForm(true)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-md text-sm font-medium text-white" style={{ background: tokens.primary }}>
            <Plus size={15} /> شرکت جدید
          </button>
        )}
      </div>
      <p className="text-xs mb-4" style={{ color: tokens.textSecondary }}>
        دسترسی بر اساس نوع کنترل می‌شه: کارشناس فروش فقط مشتریان، کارشناس بازرگانی فقط
        تأمین‌کنندگان و شرکت‌های حمل رو می‌بینه؛ مدیر همه رو می‌بینه.
      </p>

      {/* تب‌های اصلی: شرکت‌ها / افراد */}
      <div className="flex gap-1 mb-5" style={{ borderBottom: `1px solid ${tokens.border}` }}>
        {[{ key: "companies", label: "شرکت‌ها" }, { key: "people", label: "افراد" }].map((t) => (
          <button
            key={t.key}
            onClick={() => { setMainTab(t.key); setQuery(""); }}
            className="px-4 py-2.5 text-sm font-medium"
            style={{
              color: mainTab === t.key ? tokens.primary : tokens.textSecondary,
              borderBottom: mainTab === t.key ? `2px solid ${tokens.primary}` : "2px solid transparent",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {mainTab === "companies" && showNewForm && (
        <NewPartnerForm
          existing={partners}
          onCancel={() => setShowNewForm(false)}
          onCreated={(newP) => { setPartners([...partners, newP]); setShowNewForm(false); }}
        />
      )}

      <div className="relative mb-3">
        <Search size={15} className="absolute top-2.5 right-3" style={{ color: tokens.textSecondary }} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={mainTab === "companies" ? "جستجوی نام شرکت یا کشور..." : "جستجوی نام فرد یا شرکت..."}
          className="w-full rounded-md pr-9 pl-3 py-2.5 text-sm"
          style={inputStyle}
        />
      </div>

      {mainTab === "companies" && (
        <>
          <div className="flex gap-1.5 mb-5 overflow-x-auto pb-1">
            {[
              { key: "all", label: "همه" },
              { key: "customer", label: "مشتریان" },
              { key: "supplier", label: "تأمین‌کنندگان" },
              { key: "freight_forwarder", label: "شرکت‌های حمل" },
            ].map((f) => (
              <button
                key={f.key}
                onClick={() => setTypeFilter(f.key)}
                className="text-xs px-3 py-1.5 rounded-full whitespace-nowrap"
                style={{
                  background: typeFilter === f.key ? tokens.primary : tokens.surface,
                  color: typeFilter === f.key ? "#fff" : tokens.textSecondary,
                  border: `1px solid ${typeFilter === f.key ? tokens.primary : tokens.border}`,
                }}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="space-y-2.5">
            {filteredCompanies.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => openCompany(p)}
                className="w-full text-right rounded-lg p-4 flex flex-wrap items-center gap-3"
                style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, opacity: p.status === "inactive" ? 0.6 : 1 }}
              >
                <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0" style={{ background: tokens.accentSoft, color: tokens.accent }}>
                  <Building2 size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>{p.name}</p>
                  <p className="text-xs" style={{ color: tokens.textSecondary }}>{p.country} · {p.industry} · {p.contacts.length} رابط</p>
                </div>
                <div className="mr-auto flex items-center gap-2">
                  {p.status === "inactive" && (
                    <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "#F3E6E4", color: tokens.danger }}>غیرفعال</span>
                  )}
                  <TypeBadge type={p.type} />
                </div>
              </button>
            ))}
            {filteredCompanies.length === 0 && (
              <p className="text-sm text-center py-6" style={{ color: tokens.textSecondary }}>موردی یافت نشد</p>
            )}
          </div>
        </>
      )}

      {mainTab === "people" && (
        <div className="space-y-2.5">
          {filteredPeople.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => openPerson(c, { id: c.companyId })}
              className="w-full text-right rounded-lg p-4 flex flex-wrap items-center gap-3"
              style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}
            >
              <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: tokens.accentSoft, color: tokens.accent }}>
                <User size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>{c.name}</p>
                <p className="text-xs" style={{ color: tokens.textSecondary }}>
                  {c.companyName} · {LEVEL_LABEL[c.level]} · {c.department}
                </p>
              </div>
              <div className="mr-auto text-[11px]" style={{ color: tokens.textSecondary }}>
                {c.mobile || c.phone}
              </div>
            </button>
          ))}
          {filteredPeople.length === 0 && (
            <p className="text-sm text-center py-6" style={{ color: tokens.textSecondary }}>موردی یافت نشد</p>
          )}
        </div>
      )}
    </Shell>
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

function NewPartnerForm({ existing, onCancel, onCreated }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("customer");
  const [country, setCountry] = useState("");
  const [industry, setIndustry] = useState("");

  const similarMatch = name.length > 2 && existing.some(
    (p) => p.name.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(p.name.toLowerCase().slice(0, 5))
  );

  return (
    <div className="rounded-lg p-4 mb-5" style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRight: `4px solid ${tokens.primary}` }}>
      <p className="text-sm font-semibold mb-3" style={{ color: tokens.textPrimary }}>ثبت شرکت جدید</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2">
        <div>
          <label className={label} style={{ color: tokens.textPrimary }}>نام شرکت</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="text-sm w-full rounded-md px-3 py-2" style={inputStyle} placeholder="مثلاً فولاد مبارکه اصفهان" />
        </div>
        <div>
          <label className={label} style={{ color: tokens.textPrimary }}>نوع طرف تجاری</label>
          <select value={type} onChange={(e) => setType(e.target.value)} className="text-sm w-full rounded-md px-3 py-2" style={inputStyle}>
            <option value="customer">مشتری</option>
            <option value="supplier">تأمین‌کننده</option>
            <option value="both">هر دو</option>
            <option value="freight_forwarder">شرکت حمل</option>
          </select>
        </div>
      </div>
      {similarMatch && (
        <div className="flex items-start gap-2 rounded-md px-3 py-2 mb-3 text-xs" style={{ background: tokens.warningSoft, color: tokens.warning }}>
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <span>ممکنه این شرکت قبلاً با نام مشابهی ثبت شده باشه. لطفاً لیست رو چک کن که تکراری نسازی.</span>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-3">
        <input value={country} onChange={(e) => setCountry(e.target.value)} placeholder="کشور" className="text-sm rounded-md px-3 py-2" style={inputStyle} />
        <input value={industry} onChange={(e) => setIndustry(e.target.value)} placeholder="حوزه فعالیت" className="text-sm rounded-md px-3 py-2" style={inputStyle} />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!name}
          onClick={() => onCreated({ id: Date.now(), type, name, country, industry, status: "active", contacts: [], notes: "" })}
          className="px-4 py-2 rounded-md text-sm font-medium text-white"
          style={{ background: name ? tokens.primary : tokens.textSecondary, opacity: name ? 1 : 0.6 }}
        >
          ثبت شرکت
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md text-sm" style={{ color: tokens.textSecondary }}>انصراف</button>
      </div>
    </div>
  );
}
