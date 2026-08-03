import React, { useState } from "react";
import {
  ArrowRight,
  Search,
  Plus,
  UserCircle,
  Shield,
  Pencil,
  Trash2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Copy,
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

// ------------------------------------------------------------
// فهرست دسترسی‌ها به تفکیک ماژول — نمونه نماینده (در عمل هر بخش می‌تونه ده‌ها دسترسی داشته باشه)
// ------------------------------------------------------------
const PERMISSION_MODULES = [
  {
    key: "inquiry", label: "ثبت استعلام",
    items: [
      { key: "inquiry.view", label: "مشاهده استعلام‌ها" },
      { key: "inquiry.create", label: "ثبت استعلام جدید" },
      { key: "inquiry.edit", label: "ویرایش استعلام" },
      { key: "inquiry.delete", label: "حذف استعلام" },
      { key: "inquiry.assign", label: "واگذاری استعلام به همکار دیگر" },
    ],
  },
  {
    key: "rfq", label: "استعلام از تأمین‌کنندگان",
    items: [
      { key: "rfq.view", label: "مشاهده استعلام‌های تأمین‌کننده" },
      { key: "rfq.send", label: "ارسال استعلام به تأمین‌کننده" },
      { key: "rfq.record_offer", label: "ثبت پیشنهاد قیمت دریافتی" },
    ],
  },
  {
    key: "selection", label: "انتخاب نهایی و قیمت‌گذاری",
    items: [
      { key: "selection.view", label: "مشاهده مقایسه آفرها" },
      { key: "selection.select_offer", label: "انتخاب آفر نهایی هر قلم" },
      { key: "selection.set_markup", label: "تعیین حاشیه سود" },
      { key: "selection.lock", label: "قفل کردن انتخاب نهایی", supportsLimit: false },
    ],
  },
  {
    key: "proposal", label: "پیشنهاد به مشتری",
    items: [
      { key: "proposal.view", label: "مشاهده پیشنهادها" },
      { key: "proposal.generate", label: "تولید فایل پیشنهاد مالی/فنی" },
      { key: "proposal.edit_price", label: "ویرایش قیمت در نسخه جدید" },
      { key: "proposal.send_final", label: "ثبت نهایی و ارسال به مشتری" },
    ],
  },
  {
    key: "outcome", label: "نتیجه نهایی (برد/باخت)",
    items: [{ key: "outcome.record", label: "ثبت نتیجه برد/باخت" }],
  },
  {
    key: "order", label: "سفارش مشتری",
    items: [
      { key: "order.view", label: "مشاهده سفارش‌ها" },
      { key: "order.create", label: "ثبت سفارش مشتری" },
      { key: "order.manage_payments", label: "مدیریت پرداخت‌های مشتری" },
    ],
  },
  {
    key: "po", label: "سفارش خرید (PO)",
    items: [
      { key: "po.view", label: "مشاهده PO ها" },
      { key: "po.create", label: "صدور PO" },
      { key: "po.manage_payments", label: "مدیریت پرداخت به تأمین‌کننده" },
    ],
  },
  {
    key: "shipping", label: "حمل و گمرک / مدیریت بارها",
    items: [
      { key: "shipping.view", label: "مشاهده وضعیت بار" },
      { key: "shipping.record_packaging", label: "ثبت بسته‌بندی" },
      { key: "shipping.manage_freight_rfq", label: "مدیریت استعلام حمل (سراسری)" },
      { key: "shipping.manage_shipment", label: "مدیریت بار و اسناد گمرکی (سراسری)" },
      { key: "shipping.record_warehouse_receipt", label: "ثبت دریافت انبار و تصاویر" },
    ],
  },
  {
    key: "settlement", label: "تحویل و تسویه",
    items: [
      { key: "settlement.record_delivery", label: "ثبت تحویل به مشتری" },
      { key: "settlement.issue_invoice", label: "صدور فاکتور نهایی" },
      { key: "settlement.record_collection", label: "ثبت وصول مطالبات" },
    ],
  },
  {
    key: "partners", label: "شرکت‌ها و رابطین",
    items: [
      { key: "partners.view", label: "مشاهده شرکت‌ها" },
      { key: "partners.create", label: "ثبت شرکت/رابط جدید" },
      { key: "partners.edit", label: "ویرایش شرکت/رابط" },
      { key: "partners.delete", label: "حذف شرکت/رابط" },
    ],
  },
  {
    key: "users", label: "کاربران و گروه‌های دسترسی",
    items: [{ key: "users.manage", label: "مدیریت کاربران و گروه‌های دسترسی" }],
  },
  {
    key: "catalog", label: "کاتالوگ کالا",
    items: [
      { key: "catalog.view", label: "مشاهده کاتالوگ" },
      { key: "catalog.create", label: "افزودن کالا جدید" },
    ],
  },
];

const ALL_PERMISSIONS = PERMISSION_MODULES.flatMap((m) => m.items.map((i) => i.key));

const DEFAULT_GROUPS = [
  {
    id: "g1", name: "فروش", isDefault: true,
    perms: ["inquiry.view", "inquiry.create", "inquiry.edit", "inquiry.assign", "proposal.view", "proposal.generate", "proposal.edit_price", "proposal.send_final", "outcome.record", "order.view", "order.create", "settlement.record_delivery", "partners.view", "partners.create"],
  },
  {
    id: "g2", name: "بازرگانی", isDefault: true,
    perms: ["rfq.view", "rfq.send", "rfq.record_offer", "selection.view", "selection.select_offer", "po.view", "po.create", "shipping.view", "shipping.record_packaging", "shipping.manage_freight_rfq", "shipping.manage_shipment", "partners.view", "partners.create", "catalog.view", "catalog.create"],
  },
  {
    id: "g3", name: "مالی", isDefault: true,
    perms: ["order.manage_payments", "po.manage_payments", "settlement.issue_invoice", "settlement.record_collection"],
  },
  {
    id: "g4", name: "مدیریت", isDefault: true,
    perms: ALL_PERMISSIONS,
  },
];

const INITIAL_USERS = [
  { id: 1, fullName: "فرشید محمدی", mobile: "0912-1112233", email: "farshid@poulad-tajhiz.com", status: "active", groupId: "g4" },
  { id: 2, fullName: "علی محمدی", mobile: "0913-2223344", email: "ali@poulad-tajhiz.com", status: "active", groupId: "g1" },
  { id: 3, fullName: "سارا کریمی", mobile: "0919-3334455", email: "sara@poulad-tajhiz.com", status: "active", groupId: "g1" },
  { id: 4, fullName: "حسین رستمی", mobile: "0935-4445566", email: "hossein@poulad-tajhiz.com", status: "active", groupId: "g2" },
  { id: 5, fullName: "مریم صادقی", mobile: "0902-5556677", email: "maryam@poulad-tajhiz.com", status: "inactive", groupId: "g3" },
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

// ============================================================
// جزئیات کاربر
// ============================================================

function UserDetail({ user, groups, onBack, onDeleted }) {
  const [editMode, setEditMode] = useState(false);
  const [data, setData] = useState({ ...user });
  const [confirmDelete, setConfirmDelete] = useState(false);
  const update = (field, value) => setData({ ...data, [field]: value });
  const group = groups.find((g) => g.id === data.groupId);

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} style={{ color: tokens.textSecondary }}><ArrowRight size={18} /></button>
        <span className="text-xs" style={{ color: tokens.textSecondary }}>بازگشت به لیست کاربران</span>
      </div>

      <div className="rounded-lg p-4 mb-5" style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRight: `4px solid ${tokens.primary}` }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: tokens.accentSoft, color: tokens.accent }}>
              <UserCircle size={22} />
            </div>
            <div>
              {editMode ? (
                <input value={data.fullName} onChange={(e) => update("fullName", e.target.value)} className="text-lg font-bold rounded px-2 py-1" style={inputStyle} />
              ) : (
                <h1 className="text-lg font-bold" style={{ color: tokens.textPrimary }}>{data.fullName}</h1>
              )}
              <span className="text-[11px] px-2 py-0.5 rounded-full inline-block mt-1" style={{ background: tokens.accentSoft, color: tokens.accent }}>
                گروه دسترسی: {group?.name || "—"}
              </span>
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
            <ViewField title="موبایل" value={data.mobile} />
            <ViewField title="ایمیل" value={data.email} />
            <ViewField title="وضعیت" value={data.status === "active" ? "فعال" : "غیرفعال"} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-3">
              <input placeholder="موبایل" value={data.mobile || ""} onChange={(e) => update("mobile", e.target.value)} className="mono text-xs rounded px-2 py-1.5" style={inputStyle} />
              <input placeholder="ایمیل" value={data.email || ""} onChange={(e) => update("email", e.target.value)} className="text-xs rounded px-2 py-1.5" style={inputStyle} />
              <select value={data.status} onChange={(e) => update("status", e.target.value)} className="text-xs rounded px-2 py-1.5" style={inputStyle}>
                <option value="active">فعال</option>
                <option value="inactive">غیرفعال</option>
              </select>
            </div>
            <div className="pt-3 mb-3" style={{ borderTop: `1px dashed ${tokens.border}` }}>
              <label className={label} style={{ color: tokens.textSecondary }}>گروه دسترسی (هر کاربر فقط یک گروه)</label>
              <select value={data.groupId} onChange={(e) => update("groupId", e.target.value)} className="text-sm w-full sm:w-64 rounded px-2 py-1.5" style={inputStyle}>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}{g.isDefault ? " (پیش‌فرض)" : ""}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between pt-3" style={{ borderTop: `1px dashed ${tokens.border}` }}>
              <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md" style={{ color: tokens.danger, border: `1px solid ${tokens.danger}` }}>
                <Trash2 size={13} /> حذف این کاربر
              </button>
              <div className="flex gap-2">
                <button onClick={() => setEditMode(false)} className="text-xs px-3 py-1.5 rounded-md" style={{ color: tokens.textSecondary }}>انصراف</button>
                <button onClick={() => setEditMode(false)} className="text-xs px-4 py-1.5 rounded-md text-white" style={{ background: tokens.success }}>ذخیره</button>
              </div>
            </div>
          </>
        )}
      </div>

      {!editMode && group && (
        <div className="rounded-lg p-4" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
          <p className="text-sm font-semibold mb-2" style={{ color: tokens.textPrimary }}>خلاصه دسترسی‌های گروه «{group.name}»</p>
          <p className="text-xs" style={{ color: tokens.textSecondary }}>{group.perms.length} دسترسی از {ALL_PERMISSIONS.length} فعاله. جزئیات کامل رو در تب «گروه‌های دسترسی» ببین.</p>
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal title={`حذف کاربر «${data.fullName}»`} onCancel={() => setConfirmDelete(false)} onConfirm={() => onDeleted(data.id)} />
      )}
    </div>
  );
}

// ============================================================
// جزئیات گروه دسترسی — چک‌باکس‌های دسترسی به تفکیک ماژول
// ============================================================

function GroupDetail({ group, onBack, onDeleted, onSaved }) {
  const [editMode, setEditMode] = useState(false);
  const [name, setName] = useState(group.name);
  const [perms, setPerms] = useState(group.perms);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [expanded, setExpanded] = useState(PERMISSION_MODULES[0].key);

  const togglePerm = (key) => {
    setPerms(perms.includes(key) ? perms.filter((p) => p !== key) : [...perms, key]);
  };
  const toggleModuleAll = (mod) => {
    const keys = mod.items.map((i) => i.key);
    const allOn = keys.every((k) => perms.includes(k));
    setPerms(allOn ? perms.filter((p) => !keys.includes(p)) : [...new Set([...perms, ...keys])]);
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} style={{ color: tokens.textSecondary }}><ArrowRight size={18} /></button>
        <span className="text-xs" style={{ color: tokens.textSecondary }}>بازگشت به لیست گروه‌ها</span>
      </div>

      <div className="rounded-lg p-4 mb-5" style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRight: `4px solid ${tokens.primary}` }}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md flex items-center justify-center" style={{ background: tokens.accentSoft, color: tokens.accent }}>
              <Shield size={18} />
            </div>
            {editMode ? (
              <input value={name} onChange={(e) => setName(e.target.value)} className="text-lg font-bold rounded px-2 py-1" style={inputStyle} />
            ) : (
              <div>
                <h1 className="text-lg font-bold" style={{ color: tokens.textPrimary }}>{group.name}</h1>
                {group.isDefault && <span className="text-[11px]" style={{ color: tokens.textSecondary }}>گروه پیش‌فرض سیستم</span>}
              </div>
            )}
          </div>
          {!editMode && (
            <button onClick={() => setEditMode(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md" style={{ color: tokens.primary, border: `1px solid ${tokens.primary}` }}>
              <Pencil size={12} /> ویرایش
            </button>
          )}
        </div>
        {!editMode && (
          <p className="text-xs" style={{ color: tokens.textSecondary }}>{perms.length} از {ALL_PERMISSIONS.length} دسترسی فعال</p>
        )}
      </div>

      <div className="space-y-2.5 mb-5">
        {PERMISSION_MODULES.map((mod) => {
          const keys = mod.items.map((i) => i.key);
          const activeCount = keys.filter((k) => perms.includes(k)).length;
          const open = expanded === mod.key;
          return (
            <div key={mod.key} className="rounded-lg overflow-hidden" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
              <button
                type="button"
                onClick={() => setExpanded(open ? null : mod.key)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3"
              >
                <span className="text-sm font-medium" style={{ color: tokens.textPrimary }}>{mod.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: activeCount > 0 ? tokens.successSoft : tokens.bg, color: activeCount > 0 ? tokens.success : tokens.textSecondary }}>
                    {activeCount}/{keys.length}
                  </span>
                  {open ? <ChevronUp size={15} style={{ color: tokens.textSecondary }} /> : <ChevronDown size={15} style={{ color: tokens.textSecondary }} />}
                </div>
              </button>
              {open && (
                <div className="px-4 pb-3" style={{ borderTop: `1px dashed ${tokens.border}` }}>
                  {editMode && (
                    <button type="button" onClick={() => toggleModuleAll(mod)} className="text-[11px] underline mt-2 mb-1" style={{ color: tokens.primary }}>
                      انتخاب/لغو انتخاب همه این بخش
                    </button>
                  )}
                  <div className="space-y-1.5 mt-2">
                    {mod.items.map((it) => (
                      <label key={it.key} className="flex items-center gap-2.5 text-xs" style={{ color: tokens.textPrimary }}>
                        <input
                          type="checkbox"
                          disabled={!editMode}
                          checked={perms.includes(it.key)}
                          onChange={() => togglePerm(it.key)}
                          className="w-3.5 h-3.5"
                        />
                        {it.label}
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {editMode && (
        <div className="flex items-center justify-between">
          <button onClick={() => setConfirmDelete(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md" style={{ color: tokens.danger, border: `1px solid ${tokens.danger}` }}>
            <Trash2 size={13} /> حذف این گروه
          </button>
          <div className="flex gap-2">
            <button onClick={() => setEditMode(false)} className="text-xs px-3 py-1.5 rounded-md" style={{ color: tokens.textSecondary }}>انصراف</button>
            <button onClick={() => { onSaved({ ...group, name, perms }); setEditMode(false); }} className="text-xs px-4 py-1.5 rounded-md text-white" style={{ background: tokens.success }}>ذخیره</button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <ConfirmModal title={`حذف گروه دسترسی «${group.name}»`} onCancel={() => setConfirmDelete(false)} onConfirm={() => onDeleted(group.id)} />
      )}
    </div>
  );
}

function NewGroupForm({ onCancel, onCreated }) {
  const [name, setName] = useState("");
  return (
    <div className="rounded-lg p-4 mb-5" style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRight: `4px solid ${tokens.primary}` }}>
      <p className="text-sm font-semibold mb-3" style={{ color: tokens.textPrimary }}>ایجاد گروه دسترسی سفارشی</p>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="نام گروه (مثلاً «فروش ارشد»)" className="text-sm w-full rounded-md px-3 py-2 mb-3" style={inputStyle} />
      <p className="text-xs mb-3" style={{ color: tokens.textSecondary }}>بعد از ایجاد، وارد جزئیات گروه می‌شی تا دسترسی‌های موردنظر رو تیک بزنی.</p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!name}
          onClick={() => onCreated({ id: `g${Date.now()}`, name, isDefault: false, perms: [] })}
          className="px-4 py-2 rounded-md text-sm font-medium text-white"
          style={{ background: name ? tokens.primary : tokens.textSecondary, opacity: name ? 1 : 0.6 }}
        >
          ایجاد و ادامه
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

export default function UserRoleManagementMockup() {
  const [users, setUsers] = useState(INITIAL_USERS);
  const [groups, setGroups] = useState(DEFAULT_GROUPS);
  const [mainTab, setMainTab] = useState("users");
  const [view, setView] = useState("list");
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedGroupId, setSelectedGroupId] = useState(null);
  const [query, setQuery] = useState("");
  const [showNewUser, setShowNewUser] = useState(false);
  const [showNewGroup, setShowNewGroup] = useState(false);

  const selectedUser = users.find((u) => u.id === selectedUserId);
  const selectedGroup = groups.find((g) => g.id === selectedGroupId);

  const openUser = (u) => { setSelectedUserId(u.id); setView("user-detail"); };
  const openGroup = (g) => { setSelectedGroupId(g.id); setView("group-detail"); };
  const backToList = () => { setView("list"); setSelectedUserId(null); setSelectedGroupId(null); };
  const deleteUser = (id) => { setUsers(users.filter((u) => u.id !== id)); backToList(); };
  const deleteGroup = (id) => { setGroups(groups.filter((g) => g.id !== id)); backToList(); };
  const saveGroup = (updated) => setGroups(groups.map((g) => (g.id === updated.id ? updated : g)));

  if (view === "user-detail" && selectedUser) {
    return <Shell><UserDetail user={selectedUser} groups={groups} onBack={backToList} onDeleted={deleteUser} /></Shell>;
  }
  if (view === "group-detail" && selectedGroup) {
    return <Shell><GroupDetail group={selectedGroup} onBack={backToList} onDeleted={deleteGroup} onSaved={saveGroup} /></Shell>;
  }

  const filteredUsers = users.filter((u) => u.fullName.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase()));

  return (
    <Shell>
      <div className="flex items-center justify-between mb-1">
        <div>
          <p className="text-xs font-medium tracking-wide mb-1" style={{ color: tokens.accent }}>ماژول سراسری</p>
          <h1 className="text-xl sm:text-2xl font-bold" style={{ color: tokens.textPrimary }}>کاربران و گروه‌های دسترسی</h1>
        </div>
        {mainTab === "users" && !showNewUser && (
          <button type="button" onClick={() => setShowNewUser(true)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-md text-sm font-medium text-white" style={{ background: tokens.primary }}>
            <Plus size={15} /> کاربر جدید
          </button>
        )}
        {mainTab === "groups" && !showNewGroup && (
          <button type="button" onClick={() => setShowNewGroup(true)} className="flex items-center gap-1.5 px-4 py-2.5 rounded-md text-sm font-medium text-white" style={{ background: tokens.primary }}>
            <Plus size={15} /> گروه جدید
          </button>
        )}
      </div>
      <p className="text-xs mb-4" style={{ color: tokens.textSecondary }}>
        دسترسی‌ها به‌صورت ریز و چک‌باکسی هستن و در «گروه‌های دسترسی» بسته‌بندی می‌شن. چند گروه
        پیش‌فرض (بازرگانی/مالی/فروش/مدیریت) از قبل هست، ولی می‌تونی گروه سفارشی هم بسازی. هر کاربر
        دقیقاً به یک گروه وصل می‌شه.
      </p>

      <div className="flex gap-1 mb-5" style={{ borderBottom: `1px solid ${tokens.border}` }}>
        {[{ key: "users", label: "کاربران" }, { key: "groups", label: "گروه‌های دسترسی" }].map((t) => (
          <button
            key={t.key}
            onClick={() => setMainTab(t.key)}
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

      {mainTab === "users" && (
        <>
          {showNewUser && (
            <NewUserQuick
              groups={groups}
              onCancel={() => setShowNewUser(false)}
              onCreated={(u) => { setUsers([...users, u]); setShowNewUser(false); }}
            />
          )}
          <div className="relative mb-4">
            <Search size={15} className="absolute top-2.5 right-3" style={{ color: tokens.textSecondary }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="جستجوی نام یا ایمیل..." className="w-full rounded-md pr-9 pl-3 py-2.5 text-sm" style={inputStyle} />
          </div>
          <div className="space-y-2.5">
            {filteredUsers.map((u) => {
              const g = groups.find((x) => x.id === u.groupId);
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => openUser(u)}
                  className="w-full text-right rounded-lg p-4 flex flex-wrap items-center gap-3"
                  style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, opacity: u.status === "inactive" ? 0.6 : 1 }}
                >
                  <div className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: tokens.accentSoft, color: tokens.accent }}>
                    <UserCircle size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>{u.fullName}</p>
                    <p className="text-xs" style={{ color: tokens.textSecondary }}>{u.email}</p>
                  </div>
                  <div className="mr-auto flex items-center gap-2">
                    {u.status === "inactive" && (
                      <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: "#F3E6E4", color: tokens.danger }}>غیرفعال</span>
                    )}
                    <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: tokens.accentSoft, color: tokens.accent }}>{g?.name}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {mainTab === "groups" && (
        <>
          {showNewGroup && (
            <NewGroupForm
              onCancel={() => setShowNewGroup(false)}
              onCreated={(g) => { setGroups([...groups, g]); setShowNewGroup(false); openGroup(g); }}
            />
          )}
          <div className="space-y-2.5">
            {groups.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => openGroup(g)}
                className="w-full text-right rounded-lg p-4 flex flex-wrap items-center gap-3"
                style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}
              >
                <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0" style={{ background: tokens.accentSoft, color: tokens.accent }}>
                  <Shield size={16} />
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: tokens.textPrimary }}>{g.name}</p>
                  <p className="text-xs" style={{ color: tokens.textSecondary }}>
                    {g.perms.length} از {ALL_PERMISSIONS.length} دسترسی · {users.filter((u) => u.groupId === g.id).length} کاربر
                  </p>
                </div>
                {g.isDefault && (
                  <span className="mr-auto text-[11px] px-2 py-0.5 rounded-full" style={{ background: tokens.bg, color: tokens.textSecondary }}>پیش‌فرض</span>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}

function NewUserQuick({ groups, onCancel, onCreated }) {
  const [fullName, setFullName] = useState("");
  const [mobile, setMobile] = useState("");
  const [email, setEmail] = useState("");
  const [groupId, setGroupId] = useState(groups[0]?.id || "");

  return (
    <div className="rounded-lg p-4 mb-5" style={{ background: tokens.surface, border: `1px solid ${tokens.border}`, borderRight: `4px solid ${tokens.primary}` }}>
      <p className="text-sm font-semibold mb-3" style={{ color: tokens.textPrimary }}>ثبت کاربر جدید</p>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 mb-3">
        <input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="نام و نام خانوادگی" className="text-sm rounded-md px-3 py-2" style={inputStyle} />
        <input value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="موبایل" className="mono text-sm rounded-md px-3 py-2" style={inputStyle} />
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ایمیل" className="text-sm rounded-md px-3 py-2" style={inputStyle} />
        <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className="text-sm rounded-md px-3 py-2" style={inputStyle}>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!fullName}
          onClick={() => onCreated({ id: Date.now(), fullName, mobile, email, status: "active", groupId })}
          className="px-4 py-2 rounded-md text-sm font-medium text-white"
          style={{ background: fullName ? tokens.primary : tokens.textSecondary, opacity: fullName ? 1 : 0.6 }}
        >
          ثبت کاربر
        </button>
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-md text-sm" style={{ color: tokens.textSecondary }}>انصراف</button>
      </div>
    </div>
  );
}
