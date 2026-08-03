import { useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  ImageUp,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { ViewField } from "../../components/ui/ViewField";
import { AuthImage } from "../../components/ui/AuthImage";
import { ImageCropModal } from "../../components/ui/ImageCropModal";
import { DualDateInput } from "../../components/ui/DualDateInput";
import { Field, GhostButton, PrimaryButton, Select, TextArea, TextInput } from "../../components/ui/fields";
import { useDebounced } from "../../lib/use-debounced";
import { hasPermission } from "../../lib/permissions";
import { useAuth } from "../../lib/auth-context";
import { COUNTRIES } from "../../lib/countries";
import { formatJalali } from "../../lib/jalali";
import {
  BusinessPartner,
  CONTACT_LEVEL_LABEL,
  CONTACT_TYPE_LABEL,
  PARTNER_TYPE_LABEL,
  PartnerType,
} from "../../lib/types";
import { uploadFile } from "../inquiries/inquiries-api";
import { usePartnerMutations, usePartners, useSimilarPartners } from "./partners-api";

const TYPE_BADGE_STYLE: Record<string, string> = {
  customer: "bg-successSoft text-success",
  supplier: "bg-accentSoft text-accent",
  both: "bg-warningSoft text-warning",
  freight_forwarder: "bg-primary/10 text-primary",
  organization: "bg-border text-textSecondary",
  bank: "bg-border text-textSecondary",
  service_company: "bg-border text-textSecondary",
};

const OTHER_TYPES: PartnerType[] = ["freight_forwarder", "organization", "bank", "service_company"];

// شرکت داخلی همیشه ایران است (فیلد کشور برای این حالت قفل/غیرقابل‌تغییره)؛
// شرکت خارجی هرگز نباید ایران انتخاب بشه — فاز ۲۶: رفع باگ عدم هماهنگی isForeign/country
const FOREIGN_COUNTRIES = COUNTRIES.filter((c) => c.fa !== "ایران");

function TypeBadge({ type }: { type: PartnerType }) {
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${TYPE_BADGE_STYLE[type]}`}>
      {PARTNER_TYPE_LABEL[type]}
    </span>
  );
}

// ------------------------------------------------------------
// فرم شرکت
// ------------------------------------------------------------
interface PartnerFormState {
  isCustomer: boolean;
  isSupplier: boolean;
  otherType: PartnerType | "";
  companyName: string;
  companyNameEn: string;
  shortCodeEn: string;
  isForeign: boolean;
  country: string;
  industry: string;
  address: string;
  addressEn: string;
  province: string;
  city: string;
  postalCode: string;
  phones: string[];
  fax: string;
  email: string;
  nationalId: string;
  registrationNumber: string;
  registrationDate: string | null;
  logoUrl: string;
  notes: string;
}

function toFormState(partner?: BusinessPartner): PartnerFormState {
  const type = partner?.partnerType;
  return {
    isCustomer: type === "customer" || type === "both",
    isSupplier: type === "supplier" || type === "both",
    otherType: type && OTHER_TYPES.includes(type) ? type : "",
    companyName: partner?.companyName ?? "",
    companyNameEn: partner?.companyNameEn ?? "",
    shortCodeEn: partner?.shortCodeEn ?? "",
    isForeign: partner?.isForeign ?? false,
    country: partner?.country ?? "",
    industry: partner?.industry ?? "",
    address: partner?.address ?? "",
    addressEn: partner?.addressEn ?? "",
    province: partner?.province ?? "",
    city: partner?.city ?? "",
    postalCode: partner?.postalCode ?? "",
    phones: partner?.phones?.length ? partner.phones : partner?.phone ? [partner.phone] : [""],
    fax: partner?.fax ?? "",
    email: partner?.email ?? "",
    nationalId: partner?.nationalId ?? "",
    registrationNumber: partner?.registrationNumber ?? "",
    registrationDate: partner?.registrationDate ?? null,
    logoUrl: partner?.logoUrl ?? "",
    notes: partner?.notes ?? "",
  };
}

function resolvePartnerType(form: PartnerFormState): PartnerType | null {
  if (form.isCustomer && form.isSupplier) return "both";
  if (form.isCustomer) return "customer";
  if (form.isSupplier) return "supplier";
  return form.otherType || null;
}

function toBody(form: PartnerFormState) {
  const clean = (v: string) => (v.trim() === "" ? undefined : v.trim());
  return {
    partnerType: resolvePartnerType(form)!,
    companyName: form.companyName.trim(),
    companyNameEn: clean(form.companyNameEn),
    shortCodeEn: clean(form.shortCodeEn),
    isForeign: form.isForeign,
    country: clean(form.country),
    industry: clean(form.industry),
    address: clean(form.address),
    addressEn: clean(form.addressEn),
    province: form.isForeign ? undefined : clean(form.province),
    city: form.isForeign ? undefined : clean(form.city),
    postalCode: form.isForeign ? undefined : clean(form.postalCode),
    phones: form.isForeign ? [] : form.phones.map((p) => p.trim()).filter(Boolean),
    fax: clean(form.fax),
    email: form.isForeign ? undefined : clean(form.email),
    nationalId: form.isForeign ? undefined : clean(form.nationalId),
    registrationNumber: form.isForeign ? undefined : clean(form.registrationNumber),
    registrationDate: form.registrationDate ?? undefined,
    logoUrl: clean(form.logoUrl),
    notes: clean(form.notes),
  };
}

function PartnerFormFields({
  form,
  onChange,
}: {
  form: PartnerFormState;
  onChange: (next: PartnerFormState) => void;
}) {
  const set = <K extends keyof PartnerFormState>(key: K, value: PartnerFormState[K]) =>
    onChange({ ...form, [key]: value });
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);

  return (
    <div className="space-y-4">
      {/* نوع شرکت — چک‌باکس (شرکت می‌تونه هم مشتری هم تأمین‌کننده باشه) */}
      <div>
        <p className="text-xs font-medium mb-1.5 text-textPrimary">نوع شرکت *</p>
        <div className="flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer text-textPrimary">
            <input
              type="checkbox"
              className="w-3.5 h-3.5"
              checked={form.isCustomer}
              onChange={(e) => onChange({ ...form, isCustomer: e.target.checked, otherType: "" })}
            />
            مشتری
          </label>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer text-textPrimary">
            <input
              type="checkbox"
              className="w-3.5 h-3.5"
              checked={form.isSupplier}
              onChange={(e) => onChange({ ...form, isSupplier: e.target.checked, otherType: "" })}
            />
            تأمین‌کننده
          </label>
          {!form.isCustomer && !form.isSupplier && (
            <Select
              value={form.otherType}
              onChange={(e) => set("otherType", e.target.value as PartnerFormState["otherType"])}
              className="!w-44 !py-2"
            >
              <option value="">سایر انواع...</option>
              {OTHER_TYPES.map((t) => (
                <option key={t} value={t}>{PARTNER_TYPE_LABEL[t]}</option>
              ))}
            </Select>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="نام شرکت *">
          <TextInput value={form.companyName} onChange={(e) => set("companyName", e.target.value)} />
        </Field>

        <Field label="نام شرکت (انگلیسی)">
          <TextInput value={form.companyNameEn} onChange={(e) => set("companyNameEn", e.target.value)} dir="ltr" />
        </Field>

        <Field label="کد اختصاری (انگلیسی)">
          <TextInput
            value={form.shortCodeEn}
            onChange={(e) => set("shortCodeEn", e.target.value.toUpperCase())}
            dir="ltr"
            placeholder="خالی بمونه، خودکار از نام انگلیسی ساخته می‌شه"
          />
        </Field>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium text-textPrimary">کشور</label>
            <label className="flex items-center gap-1.5 text-[11px] cursor-pointer text-textSecondary">
              <input
                type="checkbox"
                className="w-3.5 h-3.5"
                checked={form.isForeign}
                onChange={(e) =>
                  onChange({ ...form, isForeign: e.target.checked, country: e.target.checked ? "" : "ایران" })
                }
              />
              شرکت خارجی
            </label>
          </div>
          {form.isForeign ? (
            <Select value={form.country} onChange={(e) => set("country", e.target.value)} dir="ltr">
              <option value="">— انتخاب کشور —</option>
              {FOREIGN_COUNTRIES.map((c) => (
                <option key={c.en} value={c.en}>{c.en}</option>
              ))}
            </Select>
          ) : (
            <Select value="ایران" disabled dir="rtl">
              <option value="ایران">ایران</option>
            </Select>
          )}
        </div>

        <Field label="صنعت">
          <TextInput value={form.industry} onChange={(e) => set("industry", e.target.value)} />
        </Field>

        {!form.isForeign && (
          <Field label="ایمیل شرکت">
            <TextInput value={form.email} onChange={(e) => set("email", e.target.value)} dir="ltr" />
          </Field>
        )}

        {/* چند شماره تلفن — فقط داخلی طبق کامنت erp-schema.sql روی business_partners.phone */}
        {!form.isForeign && (
          <div className="sm:col-span-2">
            <p className="text-xs font-medium mb-1.5 text-textPrimary">شماره تلفن‌ها</p>
            <div className="space-y-1.5">
              {form.phones.map((phone, index) => (
                <div key={index} className="flex items-center gap-2">
                  <TextInput
                    value={phone}
                    onChange={(e) =>
                      set("phones", form.phones.map((p, i) => (i === index ? e.target.value : p)))
                    }
                    dir="ltr"
                    placeholder="031-12345678"
                    className="!w-56"
                  />
                  {form.phones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => set("phones", form.phones.filter((_, i) => i !== index))}
                      className="text-danger"
                      aria-label="حذف شماره"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => set("phones", [...form.phones, ""])}
                className="text-[11px] text-primary font-medium flex items-center gap-1"
              >
                <Plus size={12} /> شماره دیگر
              </button>
            </div>
          </div>
        )}

        <Field label="فکس">
          <TextInput value={form.fax} onChange={(e) => set("fax", e.target.value)} dir="ltr" />
        </Field>
        {!form.isForeign && (
          <Field label="شناسه ملی">
            <TextInput value={form.nationalId} onChange={(e) => set("nationalId", e.target.value)} dir="ltr" />
          </Field>
        )}
        {!form.isForeign && (
          <Field label="شماره ثبت">
            <TextInput value={form.registrationNumber} onChange={(e) => set("registrationNumber", e.target.value)} dir="ltr" />
          </Field>
        )}
        <Field label="تاریخ ثبت شرکت">
          <DualDateInput value={form.registrationDate} onChange={(iso) => set("registrationDate", iso)} />
        </Field>

        {!form.isForeign && (
          <>
            <Field label="استان">
              <TextInput value={form.province} onChange={(e) => set("province", e.target.value)} />
            </Field>
            <Field label="شهر">
              <TextInput value={form.city} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <Field label="کد پستی">
              <TextInput value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} dir="ltr" />
            </Field>
          </>
        )}

        {/* لوگو */}
        <div>
          <p className="text-xs font-medium mb-1.5 text-textPrimary">لوگوی شرکت</p>
          <div className="flex items-center gap-2">
            {form.logoUrl ? (
              <>
                <AuthImage fileUrl={form.logoUrl} alt="لوگو" className="w-10 h-10 rounded-lg object-contain bg-white border border-border" />
                <button type="button" onClick={() => set("logoUrl", "")} className="text-danger" aria-label="حذف لوگو">
                  <Trash2 size={14} />
                </button>
              </>
            ) : (
              <>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setPendingLogoFile(file);
                    e.target.value = "";
                  }}
                />
                <GhostButton onClick={() => logoInputRef.current?.click()} disabled={uploadingLogo}>
                  <span className="flex items-center gap-1.5">
                    <ImageUp size={13} /> {uploadingLogo ? "در حال بارگذاری..." : "بارگذاری لوگو"}
                  </span>
                </GhostButton>
              </>
            )}
          </div>
          {pendingLogoFile && (
            <ImageCropModal
              file={pendingLogoFile}
              title="برش لوگوی شرکت"
              cropShape="rect"
              onCancel={() => setPendingLogoFile(null)}
              onConfirm={async (croppedFile) => {
                setPendingLogoFile(null);
                setUploadingLogo(true);
                try {
                  const stored = await uploadFile(croppedFile);
                  set("logoUrl", stored.fileUrl);
                } finally {
                  setUploadingLogo(false);
                }
              }}
            />
          )}
        </div>

        <div className="sm:col-span-2">
          <Field label="آدرس">
            <TextArea value={form.address} onChange={(e) => set("address", e.target.value)} rows={2} />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="آدرس (انگلیسی)">
            <TextArea value={form.addressEn} onChange={(e) => set("addressEn", e.target.value)} rows={2} dir="ltr" />
          </Field>
        </div>
        <div className="sm:col-span-2">
          <Field label="ملاحظات">
            <TextArea value={form.notes} onChange={(e) => set("notes", e.target.value)} rows={2} />
          </Field>
        </div>
      </div>
    </div>
  );
}

function SimilarityWarning({ name, excludeId }: { name: string; excludeId?: string }) {
  const debouncedName = useDebounced(name);
  const { data } = useSimilarPartners(debouncedName, true);
  const matches = (data ?? []).filter((match) => match.id !== excludeId);
  if (matches.length === 0) return null;

  return (
    <div className="rounded-lg p-3 bg-warningSoft text-warning text-xs flex gap-2">
      <AlertTriangle size={15} className="shrink-0 mt-0.5" />
      <div>
        <p className="font-medium mb-1">
          ممکنه این شرکت قبلاً با نام مشابهی ثبت شده باشه. لطفاً لیست رو چک کن که تکراری نسازی:
        </p>
        <ul className="space-y-0.5">
          {matches.map((match) => (
            <li key={match.id}>
              • {match.companyName} ({PARTNER_TYPE_LABEL[match.partnerType]}) — شباهت{" "}
              {Math.round(match.similarity * 100)}٪
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// فرم رابط
// ------------------------------------------------------------
const EMPTY_CONTACT = {
  contactName: "",
  contactNameEn: "",
  contactType: "commercial",
  level: "expert",
  phone: "",
  extension: "",
  mobile: "",
  email: "",
  department: "",
  photoUrl: "",
  notes: "",
};

function ContactForm({
  initial,
  busy,
  onSubmit,
  onCancel,
}: {
  initial: typeof EMPTY_CONTACT;
  busy: boolean;
  onSubmit: (contact: typeof EMPTY_CONTACT) => void;
  onCancel: () => void;
}) {
  const [contact, setContact] = useState(initial);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const set = (key: keyof typeof EMPTY_CONTACT) => (value: string) =>
    setContact((current) => ({ ...current, [key]: value }));

  // حداقل یکی از تلفن/موبایل/ایمیل الزامیه (قانون سرور هم هست)
  const hasContactMethod =
    contact.phone.trim() !== "" || contact.mobile.trim() !== "" || contact.email.trim() !== "";

  return (
    <div className="rounded-lg border border-border p-4 space-y-3 bg-bg">
      <div className="flex items-center gap-3">
        {contact.photoUrl ? (
          <AuthImage fileUrl={contact.photoUrl} alt="تصویر" className="w-12 h-12 rounded-full object-cover border border-border" />
        ) : (
          <div className="w-12 h-12 rounded-full bg-surface text-textSecondary flex items-center justify-center border border-border">
            <UserRound size={20} />
          </div>
        )}
        <input
          ref={photoInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.webp"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setUploadingPhoto(true);
            try {
              const stored = await uploadFile(file);
              set("photoUrl")(stored.fileUrl);
            } finally {
              setUploadingPhoto(false);
              e.target.value = "";
            }
          }}
        />
        <GhostButton onClick={() => photoInputRef.current?.click()} disabled={uploadingPhoto}>
          <span className="flex items-center gap-1.5">
            <ImageUp size={12} /> {uploadingPhoto ? "..." : contact.photoUrl ? "تغییر تصویر" : "بارگذاری تصویر"}
          </span>
        </GhostButton>
        {contact.photoUrl && (
          <button type="button" onClick={() => set("photoUrl")("")} className="text-danger" aria-label="حذف تصویر">
            <Trash2 size={13} />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="نام رابط *">
          <TextInput value={contact.contactName} onChange={(e) => set("contactName")(e.target.value)} />
        </Field>
        <Field label="نام رابط (انگلیسی)">
          <TextInput value={contact.contactNameEn} onChange={(e) => set("contactNameEn")(e.target.value)} dir="ltr" />
        </Field>
        <Field label="نوع">
          <Select value={contact.contactType} onChange={(e) => set("contactType")(e.target.value)}>
            {Object.entries(CONTACT_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </Field>
        <Field label="سطح سازمانی">
          <Select value={contact.level} onChange={(e) => set("level")(e.target.value)}>
            {Object.entries(CONTACT_LEVEL_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </Field>
        <Field label="واحد">
          <TextInput value={contact.department} onChange={(e) => set("department")(e.target.value)} />
        </Field>
        <Field label="تلفن ثابت">
          <TextInput value={contact.phone} onChange={(e) => set("phone")(e.target.value)} dir="ltr" />
        </Field>
        <Field label="شماره داخلی">
          <TextInput value={contact.extension} onChange={(e) => set("extension")(e.target.value)} dir="ltr" placeholder="مثلاً 214" />
        </Field>
        <Field label="موبایل">
          <TextInput value={contact.mobile} onChange={(e) => set("mobile")(e.target.value)} dir="ltr" />
        </Field>
        <Field label="ایمیل">
          <TextInput value={contact.email} onChange={(e) => set("email")(e.target.value)} dir="ltr" />
        </Field>
        <div className="sm:col-span-2">
          <Field label="ملاحظات / سایر اطلاعات">
            <TextArea rows={2} value={contact.notes} onChange={(e) => set("notes")(e.target.value)} />
          </Field>
        </div>
      </div>
      {!hasContactMethod && (
        <p className="text-[11px] text-danger">حداقل یکی از تلفن، موبایل یا ایمیل الزامیه.</p>
      )}
      <div className="flex gap-2 justify-end">
        <GhostButton onClick={onCancel}>انصراف</GhostButton>
        <PrimaryButton
          disabled={!contact.contactName.trim() || !hasContactMethod || busy}
          onClick={() => onSubmit(contact)}
        >
          ذخیره رابط
        </PrimaryButton>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// جزئیات شرکت
// ------------------------------------------------------------
function CompanyDetail({ partner, onBack }: { partner: BusinessPartner; onBack: () => void }) {
  const { user } = useAuth();
  const canEdit = hasPermission(user, "partners.edit");
  const canDelete = hasPermission(user, "partners.delete");
  const canCreate = hasPermission(user, "partners.create");

  const { update, remove, addContact, updateContact, removeContact } = usePartnerMutations();
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState(toFormState(partner));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addingContact, setAddingContact] = useState(false);
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [deletingContactId, setDeletingContactId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function extractError(err: unknown) {
    const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
    return Array.isArray(message) ? message.join("، ") : (message ?? "خطا در ذخیره");
  }

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-primary font-medium">
        <ArrowRight size={14} />
        بازگشت به لیست
      </button>

      <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-4">
        <div className="flex items-center gap-3">
          {partner.logoUrl ? (
            <AuthImage fileUrl={partner.logoUrl} alt="لوگو" className="w-11 h-11 rounded-lg object-contain bg-white border border-border shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-accentSoft text-accent flex items-center justify-center shrink-0">
              <Building2 size={20} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-textPrimary truncate">{partner.companyName}</h2>
            <TypeBadge type={partner.partnerType} />
          </div>
          {!editMode && (
            <div className="flex gap-2">
              {canEdit && (
                <GhostButton onClick={() => { setForm(toFormState(partner)); setEditMode(true); }}>
                  <span className="flex items-center gap-1.5"><Pencil size={13} /> ویرایش</span>
                </GhostButton>
              )}
              {canDelete && (
                <button onClick={() => setConfirmDelete(true)} className="text-xs px-3 py-2 rounded-lg text-danger border border-danger/40">
                  <span className="flex items-center gap-1.5"><Trash2 size={13} /> حذف</span>
                </button>
              )}
            </div>
          )}
        </div>

        {editMode ? (
          <div className="space-y-3">
            <PartnerFormFields form={form} onChange={setForm} />
            {form.companyName.trim() !== partner.companyName && (
              <SimilarityWarning name={form.companyName} excludeId={partner.id} />
            )}
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex gap-2 justify-end">
              <GhostButton onClick={() => setEditMode(false)}>انصراف</GhostButton>
              <PrimaryButton
                disabled={update.isPending || !form.companyName.trim() || !resolvePartnerType(form)}
                onClick={async () => {
                  try {
                    setError(null);
                    await update.mutateAsync({ id: partner.id, ...toBody(form) } as never);
                    setEditMode(false);
                    onBack();
                  } catch (err) {
                    setError(extractError(err));
                  }
                }}
              >
                {update.isPending ? "در حال ذخیره..." : "ذخیره تغییرات"}
              </PrimaryButton>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <ViewField title="نام شرکت (انگلیسی)" value={partner.companyNameEn} />
            <ViewField title="کد اختصاری" value={partner.shortCodeEn} />
            <ViewField title="کشور" value={partner.country} />
            <ViewField title="داخلی/خارجی" value={partner.isForeign ? "خارجی" : "داخلی"} />
            <ViewField title="صنعت" value={partner.industry} />
            <ViewField title="فکس" value={partner.fax} />
            <ViewField title="تاریخ ثبت" value={partner.registrationDate ? formatJalali(partner.registrationDate) : null} />
            {!partner.isForeign && (
              <>
                <ViewField title="تلفن‌ها" value={(partner.phones ?? []).join("، ") || partner.phone} />
                <ViewField title="ایمیل" value={partner.email} />
                <ViewField title="شناسه ملی" value={partner.nationalId} />
                <ViewField title="شماره ثبت" value={partner.registrationNumber} />
                <ViewField title="استان" value={partner.province} />
                <ViewField title="شهر" value={partner.city} />
                <ViewField title="کد پستی" value={partner.postalCode} />
              </>
            )}
            <div className="col-span-2 sm:col-span-3">
              <ViewField title="آدرس" value={partner.address} />
            </div>
            <div className="col-span-2 sm:col-span-3">
              <ViewField title="آدرس (انگلیسی)" value={partner.addressEn} />
            </div>
            <div className="col-span-2 sm:col-span-3">
              <ViewField title="ملاحظات" value={partner.notes} />
            </div>
          </div>
        )}
      </div>

      {/* رابطین */}
      <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-textPrimary">رابطین ({partner.contacts.length})</h3>
          {canCreate && !addingContact && (
            <GhostButton onClick={() => setAddingContact(true)}>
              <span className="flex items-center gap-1.5"><Plus size={13} /> رابط جدید</span>
            </GhostButton>
          )}
        </div>

        {addingContact && (
          <ContactForm
            initial={EMPTY_CONTACT}
            busy={addContact.isPending}
            onCancel={() => setAddingContact(false)}
            onSubmit={async (contact) => {
              try {
                setError(null);
                await addContact.mutateAsync({ partnerId: partner.id, ...contact } as never);
                setAddingContact(false);
                onBack();
              } catch (err) {
                setError(extractError(err));
              }
            }}
          />
        )}

        {partner.contacts.length === 0 && !addingContact && (
          <p className="text-xs text-textSecondary">هنوز رابطی برای این شرکت ثبت نشده.</p>
        )}

        <ul className="divide-y divide-border">
          {partner.contacts.map((contact) =>
            editingContactId === contact.id ? (
              <li key={contact.id} className="py-3">
                <ContactForm
                  initial={{
                    contactName: contact.contactName,
                    contactNameEn: contact.contactNameEn ?? "",
                    contactType: contact.contactType ?? "commercial",
                    level: contact.level ?? "expert",
                    phone: contact.phone ?? "",
                    extension: contact.extension ?? "",
                    mobile: contact.mobile ?? "",
                    email: contact.email ?? "",
                    department: contact.department ?? "",
                    photoUrl: contact.photoUrl ?? "",
                    notes: contact.notes ?? "",
                  }}
                  busy={updateContact.isPending}
                  onCancel={() => setEditingContactId(null)}
                  onSubmit={async (body) => {
                    try {
                      setError(null);
                      await updateContact.mutateAsync({ id: contact.id, ...body } as never);
                      setEditingContactId(null);
                      onBack();
                    } catch (err) {
                      setError(extractError(err));
                    }
                  }}
                />
              </li>
            ) : (
              <li key={contact.id} className="py-3 flex items-center gap-3">
                {contact.photoUrl ? (
                  <AuthImage fileUrl={contact.photoUrl} alt={contact.contactName} className="w-8 h-8 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-bg text-textSecondary flex items-center justify-center shrink-0">
                    <UserRound size={15} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-textPrimary truncate">{contact.contactName}</p>
                  <p className="text-[11px] text-textSecondary">
                    {[
                      contact.contactType ? CONTACT_TYPE_LABEL[contact.contactType] : null,
                      contact.level ? CONTACT_LEVEL_LABEL[contact.level] : null,
                      contact.phone && contact.extension ? `${contact.phone} داخلی ${contact.extension}` : contact.phone,
                      contact.mobile,
                      contact.email,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </p>
                </div>
                {canEdit && (
                  <button onClick={() => setEditingContactId(contact.id)} className="text-textSecondary" aria-label="ویرایش رابط">
                    <Pencil size={14} />
                  </button>
                )}
                {canDelete && (
                  <button onClick={() => setDeletingContactId(contact.id)} className="text-danger" aria-label="حذف رابط">
                    <Trash2 size={14} />
                  </button>
                )}
              </li>
            ),
          )}
        </ul>
      </div>

      {confirmDelete && (
        <ConfirmModal
          title={`حذف شرکت «${partner.companyName}»`}
          busy={remove.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await remove.mutateAsync(partner.id);
            setConfirmDelete(false);
            onBack();
          }}
        />
      )}

      {deletingContactId && (
        <ConfirmModal
          title="حذف این رابط"
          busy={removeContact.isPending}
          onCancel={() => setDeletingContactId(null)}
          onConfirm={async () => {
            await removeContact.mutateAsync(deletingContactId);
            setDeletingContactId(null);
            onBack();
          }}
        />
      )}
    </div>
  );
}

function NewPartnerForm({ onDone }: { onDone: () => void }) {
  const { create } = usePartnerMutations();
  const [form, setForm] = useState(toFormState());
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-3">
      <h3 className="text-sm font-bold text-textPrimary">ثبت شرکت جدید</h3>
      <PartnerFormFields form={form} onChange={setForm} />
      <SimilarityWarning name={form.companyName} />
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2 justify-end">
        <GhostButton onClick={onDone}>انصراف</GhostButton>
        <PrimaryButton
          disabled={!form.companyName.trim() || !resolvePartnerType(form) || create.isPending}
          onClick={async () => {
            try {
              setError(null);
              await create.mutateAsync(toBody(form) as never);
              onDone();
            } catch (err: unknown) {
              const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
              setError(Array.isArray(message) ? message.join("، ") : (message ?? "خطا در ثبت شرکت"));
            }
          }}
        >
          {create.isPending ? "در حال ثبت..." : "ثبت شرکت"}
        </PrimaryButton>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// صفحه اصلی
// ------------------------------------------------------------
export function PartnersPage() {
  const { user } = useAuth();
  const canCreate = hasPermission(user, "partners.create");

  const [mainTab, setMainTab] = useState<"companies" | "people">("companies");
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const debouncedQuery = useDebounced(query);
  const { data, isLoading, isError } = usePartners(debouncedQuery, typeFilter);

  const partners = useMemo(() => data?.items ?? [], [data]);
  const selected = useMemo(
    () => partners.find((partner) => partner.id === selectedId) ?? null,
    [partners, selectedId],
  );

  const allContacts = useMemo(
    () => partners.flatMap((partner) => partner.contacts.map((contact) => ({ contact, partner }))),
    [partners],
  );

  if (selected) {
    return <CompanyDetail partner={selected} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex rounded-lg border border-border overflow-hidden">
          {([
            ["companies", "شرکت‌ها"],
            ["people", "رابطین"],
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setMainTab(tab)}
              className={`px-4 py-2 text-xs font-medium ${
                mainTab === tab ? "bg-primary text-white" : "bg-surface text-textSecondary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {canCreate && mainTab === "companies" && !showNewForm && (
          <PrimaryButton onClick={() => setShowNewForm(true)}>
            <span className="flex items-center gap-1.5"><Plus size={14} /> شرکت جدید</span>
          </PrimaryButton>
        )}
      </div>

      {showNewForm && <NewPartnerForm onDone={() => setShowNewForm(false)} />}

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search size={15} className="absolute top-3 right-3 text-textSecondary" />
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mainTab === "companies" ? "جستجوی نام شرکت/کشور/صنعت..." : "جستجو..."}
            className="pr-9"
          />
        </div>
        <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="w-44">
          <option value="all">همه انواع</option>
          {Object.entries(PARTNER_TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </Select>
      </div>

      {isLoading && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}
      {isError && (
        <p className="text-xs text-danger py-8 text-center">خطا در دریافت اطلاعات — اتصال به سرور رو بررسی کنید.</p>
      )}

      {!isLoading && !isError && mainTab === "companies" && (
        <div className="rounded-xl bg-surface border border-border shadow-card divide-y divide-border">
          {partners.length === 0 && (
            <p className="text-xs text-textSecondary p-8 text-center">شرکتی یافت نشد.</p>
          )}
          {partners.map((partner) => (
            <button
              key={partner.id}
              onClick={() => setSelectedId(partner.id)}
              className="w-full flex items-center gap-3 p-4 text-right hover:bg-bg transition-colors"
            >
              {partner.logoUrl ? (
                <AuthImage fileUrl={partner.logoUrl} alt="لوگو" className="w-9 h-9 rounded-lg object-contain bg-white border border-border shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-accentSoft text-accent flex items-center justify-center shrink-0">
                  <Building2 size={17} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-textPrimary truncate">{partner.companyName}</p>
                <p className="text-[11px] text-textSecondary truncate">
                  {[partner.country, partner.industry].filter(Boolean).join(" · ") || "—"}
                </p>
              </div>
              <span className="text-[11px] text-textSecondary shrink-0">{partner.contacts.length} رابط</span>
              <TypeBadge type={partner.partnerType} />
            </button>
          ))}
        </div>
      )}

      {!isLoading && !isError && mainTab === "people" && (
        <div className="rounded-xl bg-surface border border-border shadow-card divide-y divide-border">
          {allContacts.length === 0 && (
            <p className="text-xs text-textSecondary p-8 text-center">رابطی یافت نشد.</p>
          )}
          {allContacts.map(({ contact, partner }) => (
            <button
              key={contact.id}
              onClick={() => { setMainTab("companies"); setSelectedId(partner.id); }}
              className="w-full flex items-center gap-3 p-4 text-right hover:bg-bg transition-colors"
            >
              {contact.photoUrl ? (
                <AuthImage fileUrl={contact.photoUrl} alt={contact.contactName} className="w-9 h-9 rounded-full object-cover shrink-0" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-bg text-textSecondary flex items-center justify-center shrink-0">
                  <UserRound size={16} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-textPrimary truncate">{contact.contactName}</p>
                <p className="text-[11px] text-textSecondary truncate">
                  {partner.companyName}
                  {contact.contactType ? ` · ${CONTACT_TYPE_LABEL[contact.contactType]}` : ""}
                </p>
              </div>
              {contact.mobile && (
                <span className="text-[11px] text-textSecondary shrink-0" dir="ltr">{contact.mobile}</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
