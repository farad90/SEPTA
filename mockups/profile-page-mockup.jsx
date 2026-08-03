import React, { useState } from "react";
import {
  Camera,
  Pencil,
  Phone,
  Mail,
  Calendar,
  MapPin,
  CreditCard,
  FileText,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Shield,
} from "lucide-react";

const FONT_IMPORT_URL =
  "https://fonts.googleapis.com/css2?family=Vazirmatn:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap";

const tokens = {
  bg: "#F6F4EF",
  surface: "#FFFFFF",
  primary: "#1F3A5F",
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

function Avatar({ name, size = 88, photoUploaded }) {
  const initials = name.trim().split(" ").slice(0, 2).map((w) => w[0]).join("");
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white shrink-0"
      style={{ width: size, height: size, background: photoUploaded ? tokens.accentSoft : tokens.primary, color: photoUploaded ? tokens.accent : "#fff", fontSize: size * 0.32 }}
    >
      {initials}
    </div>
  );
}

function ViewField({ icon: Icon, title, value }) {
  return (
    <div className="flex items-start gap-2.5">
      {Icon && <Icon size={14} className="mt-0.5 shrink-0" style={{ color: tokens.textSecondary }} />}
      <div>
        <p className="text-[11px]" style={{ color: tokens.textSecondary }}>{title}</p>
        <p className="text-sm" style={{ color: value ? tokens.textPrimary : tokens.danger }}>{value || "— ثبت نشده —"}</p>
      </div>
    </div>
  );
}

function DocUploadCard({ title, uploaded, onUpload }) {
  return (
    <div
      className="rounded-md p-3 flex items-center gap-3"
      style={{ background: uploaded ? tokens.successSoft : tokens.warningSoft }}
    >
      <div className="w-9 h-9 rounded-md flex items-center justify-center shrink-0" style={{ background: tokens.surface, color: uploaded ? tokens.success : tokens.warning }}>
        {uploaded ? <CheckCircle2 size={16} /> : <FileText size={16} />}
      </div>
      <div className="flex-1">
        <p className="text-xs font-medium" style={{ color: tokens.textPrimary }}>{title}</p>
        <p className="text-[11px]" style={{ color: uploaded ? tokens.success : tokens.warning }}>
          {uploaded ? "بارگذاری شده" : "بارگذاری نشده — الزامی"}
        </p>
      </div>
      <button
        onClick={onUpload}
        className="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-md text-white shrink-0"
        style={{ background: uploaded ? tokens.textSecondary : tokens.primary }}
      >
        <Upload size={11} /> {uploaded ? "جایگزینی" : "بارگذاری"}
      </button>
    </div>
  );
}

export default function ProfilePageMockup() {
  const [editMode, setEditMode] = useState(false);
  const [photoUploaded, setPhotoUploaded] = useState(false);
  const [data, setData] = useState({
    fullName: "فرشید محمدی",
    mobile: "0912-1112233",
    email: "farshid@poulad-tajhiz.com",
    birthDate: "",
    address: "",
    nationalId: "",
    birthCertNo: "",
  });
  const update = (field, value) => setData({ ...data, [field]: value });

  const [nationalIdCard, setNationalIdCard] = useState(true);
  const [birthCertPages, setBirthCertPages] = useState([{ page: 1, uploaded: true }, { page: 2, uploaded: false }]);

  const requiredFields = ["birthDate", "address", "nationalId", "birthCertNo"];
  const missingFields = requiredFields.filter((f) => !data[f]);
  const missingDocs = (!nationalIdCard ? 1 : 0) + birthCertPages.filter((p) => !p.uploaded).length;
  const totalRequired = requiredFields.length + 1 + birthCertPages.length;
  const totalDone = totalRequired - missingFields.length - missingDocs;
  const completion = Math.round((totalDone / totalRequired) * 100);

  return (
    <div dir="rtl" style={{ background: tokens.bg, minHeight: "100vh", fontFamily: "Vazirmatn, sans-serif" }} className="p-4 sm:p-8">
      <style>{`@import url('${FONT_IMPORT_URL}'); .mono { font-family: 'JetBrains Mono', monospace; }`}</style>
      <div className="max-w-3xl mx-auto">
        <h1 className="text-xl font-bold mb-5" style={{ color: tokens.textPrimary }}>پروفایل کاربری</h1>

        {completion < 100 && (
          <div className="rounded-lg p-4 mb-5 flex items-center gap-3" style={{ background: tokens.warningSoft }}>
            <AlertTriangle size={18} style={{ color: tokens.warning }} className="shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-medium mb-1.5" style={{ color: tokens.textPrimary }}>
                تکمیل پروفایل: {completion}٪ — برخی اطلاعات/مدارک الزامی هنوز ثبت نشده
              </p>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.08)" }}>
                <div className="h-full rounded-full" style={{ width: `${completion}%`, background: tokens.warning }} />
              </div>
            </div>
          </div>
        )}

        {/* هدر پروفایل */}
        <div className="rounded-lg p-5 mb-5" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
          <div className="flex items-center gap-4 flex-wrap">
            <div className="relative">
              <Avatar name={data.fullName} photoUploaded={photoUploaded} />
              <button
                onClick={() => setPhotoUploaded(true)}
                className="absolute bottom-0 left-0 w-7 h-7 rounded-full flex items-center justify-center text-white"
                style={{ background: tokens.primary, border: `2px solid ${tokens.surface}` }}
              >
                <Camera size={13} />
              </button>
            </div>
            <div className="flex-1 min-w-[160px]">
              <h2 className="text-lg font-bold" style={{ color: tokens.textPrimary }}>{data.fullName}</h2>
              <div className="flex items-center gap-1.5 mt-1">
                <Shield size={12} style={{ color: tokens.accent }} />
                <span className="text-xs" style={{ color: tokens.textSecondary }}>گروه دسترسی: مدیریت</span>
              </div>
            </div>
            {!editMode && (
              <button onClick={() => setEditMode(true)} className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md" style={{ color: tokens.primary, border: `1px solid ${tokens.primary}` }}>
                <Pencil size={12} /> ویرایش پروفایل
              </button>
            )}
          </div>
        </div>

        {/* اطلاعات فردی */}
        <div className="rounded-lg p-5 mb-5" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
          <p className="text-sm font-semibold mb-4" style={{ color: tokens.textPrimary }}>اطلاعات فردی</p>

          {!editMode ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ViewField icon={Phone} title="موبایل" value={data.mobile} />
              <ViewField icon={Mail} title="ایمیل" value={data.email} />
              <ViewField icon={Calendar} title="تاریخ تولد" value={data.birthDate} />
              <ViewField icon={MapPin} title="آدرس" value={data.address} />
              <ViewField icon={CreditCard} title="کد ملی" value={data.nationalId} />
              <ViewField icon={FileText} title="شماره شناسنامه" value={data.birthCertNo} />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div>
                  <label className={label} style={{ color: tokens.textSecondary }}>موبایل</label>
                  <input value={data.mobile} onChange={(e) => update("mobile", e.target.value)} className="mono text-sm w-full rounded-md px-3 py-2" style={inputStyle} />
                </div>
                <div>
                  <label className={label} style={{ color: tokens.textSecondary }}>ایمیل</label>
                  <input value={data.email} onChange={(e) => update("email", e.target.value)} className="text-sm w-full rounded-md px-3 py-2" style={inputStyle} />
                </div>
                <div>
                  <label className={label} style={{ color: tokens.textSecondary }}>تاریخ تولد *</label>
                  <input type="date" value={data.birthDate} onChange={(e) => update("birthDate", e.target.value)} className="mono text-sm w-full rounded-md px-3 py-2" style={{ border: `1px solid ${data.birthDate ? tokens.border : tokens.danger}` }} />
                </div>
                <div>
                  <label className={label} style={{ color: tokens.textSecondary }}>کد ملی *</label>
                  <input value={data.nationalId} onChange={(e) => update("nationalId", e.target.value)} className="mono text-sm w-full rounded-md px-3 py-2" style={{ border: `1px solid ${data.nationalId ? tokens.border : tokens.danger}` }} />
                </div>
                <div>
                  <label className={label} style={{ color: tokens.textSecondary }}>شماره شناسنامه *</label>
                  <input value={data.birthCertNo} onChange={(e) => update("birthCertNo", e.target.value)} className="mono text-sm w-full rounded-md px-3 py-2" style={{ border: `1px solid ${data.birthCertNo ? tokens.border : tokens.danger}` }} />
                </div>
                <div className="sm:col-span-2">
                  <label className={label} style={{ color: tokens.textSecondary }}>آدرس *</label>
                  <textarea value={data.address} onChange={(e) => update("address", e.target.value)} rows={2} className="text-sm w-full rounded-md px-3 py-2 resize-none" style={{ border: `1px solid ${data.address ? tokens.border : tokens.danger}` }} />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setEditMode(false)} className="text-xs px-3 py-1.5 rounded-md" style={{ color: tokens.textSecondary }}>انصراف</button>
                <button onClick={() => setEditMode(false)} className="text-xs px-4 py-1.5 rounded-md text-white" style={{ background: tokens.success }}>ذخیره</button>
              </div>
            </>
          )}
        </div>

        {/* مدارک هویتی */}
        <div className="rounded-lg p-5" style={{ background: tokens.surface, border: `1px solid ${tokens.border}` }}>
          <p className="text-sm font-semibold mb-1" style={{ color: tokens.textPrimary }}>مدارک هویتی (الزامی)</p>
          <p className="text-xs mb-4" style={{ color: tokens.textSecondary }}>تصویر کارت ملی و تمامی صفحات شناسنامه</p>

          <div className="space-y-2 mb-4">
            <DocUploadCard title="تصویر کارت ملی" uploaded={nationalIdCard} onUpload={() => setNationalIdCard(true)} />
            {birthCertPages.map((p, idx) => (
              <DocUploadCard
                key={p.page}
                title={`شناسنامه — صفحه ${p.page}`}
                uploaded={p.uploaded}
                onUpload={() => setBirthCertPages(birthCertPages.map((x, i) => (i === idx ? { ...x, uploaded: true } : x)))}
              />
            ))}
          </div>
          <button
            onClick={() => setBirthCertPages([...birthCertPages, { page: birthCertPages.length + 1, uploaded: false }])}
            className="text-xs px-3 py-1.5 rounded-md"
            style={{ color: tokens.primary, border: `1px solid ${tokens.primary}` }}
          >
            + افزودن صفحه دیگر شناسنامه
          </button>
        </div>
      </div>
    </div>
  );
}
