import { useMemo, useRef, useState } from "react";
import { ArrowRight, ImageUp, Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import { ViewField } from "../../components/ui/ViewField";
import { AuthImage } from "../../components/ui/AuthImage";
import { ImageCropModal } from "../../components/ui/ImageCropModal";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { Field, GhostButton, PrimaryButton, Select, TextInput } from "../../components/ui/fields";
import { OurEntity } from "../inquiries/rfq-types";
import { uploadFile } from "../inquiries/inquiries-api";
import { OurEntityBody, useOurEntitiesAdmin, useOurEntityMutations } from "./our-entities-api";

const CALENDAR_LABEL: Record<string, string> = {
  jalali: "شمسی",
  gregorian: "میلادی",
};

interface FormState {
  entityName: string;
  entityNameEn: string;
  shortCode: string;
  calendarType: "jalali" | "gregorian";
  country: string;
  address: string;
  addressEn: string;
  phone: string;
  email: string;
  website: string;
  logoUrl: string;
  postalCode: string;
  registrationNumber: string;
  status: "active" | "inactive";
}

function toFormState(entity?: OurEntity): FormState {
  return {
    entityName: entity?.entityName ?? "",
    entityNameEn: entity?.entityNameEn ?? "",
    shortCode: entity?.shortCode ?? "",
    calendarType: entity?.calendarType ?? "gregorian",
    country: entity?.country ?? "",
    address: entity?.address ?? "",
    addressEn: entity?.addressEn ?? "",
    phone: entity?.phone ?? "",
    email: entity?.email ?? "",
    website: entity?.website ?? "",
    logoUrl: entity?.logoUrl ?? "",
    postalCode: entity?.postalCode ?? "",
    registrationNumber: entity?.registrationNumber ?? "",
    status: entity?.status ?? "active",
  };
}

function toBody(form: FormState): OurEntityBody {
  const clean = (v: string) => (v.trim() === "" ? undefined : v.trim());
  return {
    entityName: form.entityName.trim(),
    shortCode: form.shortCode.trim(),
    calendarType: form.calendarType,
    country: form.country.trim(),
    status: form.status,
    entityNameEn: clean(form.entityNameEn),
    address: clean(form.address),
    addressEn: clean(form.addressEn),
    phone: clean(form.phone),
    email: clean(form.email),
    website: clean(form.website),
    logoUrl: clean(form.logoUrl),
    postalCode: clean(form.postalCode),
    registrationNumber: clean(form.registrationNumber),
  };
}

function extractError(err: unknown) {
  const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data
    ?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? "خطا در ذخیره");
}

function EntityFormFields({
  form,
  onChange,
  allowStatusEdit,
}: {
  form: FormState;
  onChange: (next: FormState) => void;
  allowStatusEdit: boolean;
}) {
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    onChange({ ...form, [key]: value });
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="نام شرکت (فارسی) *">
          <TextInput value={form.entityName} onChange={(e) => set("entityName", e.target.value)} />
        </Field>
        <Field label="نام شرکت (انگلیسی)">
          <TextInput value={form.entityNameEn} onChange={(e) => set("entityNameEn", e.target.value)} dir="ltr" />
        </Field>
        <Field label="کد اختصاری *">
          <TextInput value={form.shortCode} onChange={(e) => set("shortCode", e.target.value)} dir="ltr" />
        </Field>
        <Field label="تقویم *">
          <Select
            value={form.calendarType}
            onChange={(e) => set("calendarType", e.target.value as FormState["calendarType"])}
          >
            <option value="jalali">شمسی</option>
            <option value="gregorian">میلادی</option>
          </Select>
        </Field>
        <Field label="کشور *">
          <TextInput value={form.country} onChange={(e) => set("country", e.target.value)} />
        </Field>
        {allowStatusEdit && (
          <Field label="وضعیت">
            <Select value={form.status} onChange={(e) => set("status", e.target.value as FormState["status"])}>
              <option value="active">فعال</option>
              <option value="inactive">غیرفعال</option>
            </Select>
          </Field>
        )}
        <Field label="تلفن">
          <TextInput value={form.phone} onChange={(e) => set("phone", e.target.value)} dir="ltr" />
        </Field>
        <Field label="ایمیل">
          <TextInput value={form.email} onChange={(e) => set("email", e.target.value)} dir="ltr" />
        </Field>
        <Field label="وب‌سایت">
          <TextInput value={form.website} onChange={(e) => set("website", e.target.value)} dir="ltr" />
        </Field>
        <Field label="کد پستی">
          <TextInput value={form.postalCode} onChange={(e) => set("postalCode", e.target.value)} dir="ltr" />
        </Field>
        <Field label="شماره ثبت">
          <TextInput
            value={form.registrationNumber}
            onChange={(e) => set("registrationNumber", e.target.value)}
            dir="ltr"
          />
        </Field>

        <div>
          <p className="text-xs font-medium mb-1.5 text-textPrimary">لوگو</p>
          <div className="flex items-center gap-2">
            {form.logoUrl ? (
              <>
                <AuthImage
                  fileUrl={form.logoUrl}
                  alt="لوگو"
                  className="w-10 h-10 rounded-lg object-contain bg-white border border-border"
                />
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
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="آدرس (فارسی)">
          <TextInput value={form.address} onChange={(e) => set("address", e.target.value)} />
        </Field>
        <Field label="آدرس (انگلیسی)">
          <TextInput value={form.addressEn} onChange={(e) => set("addressEn", e.target.value)} dir="ltr" />
        </Field>
      </div>
    </div>
  );
}

function EntityDetail({ entity, onBack }: { entity: OurEntity; onBack: () => void }) {
  const { update, remove } = useOurEntityMutations();
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState(toFormState(entity));
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-primary font-medium">
        <ArrowRight size={14} />
        بازگشت به لیست
      </button>

      <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-4">
        <div className="flex items-center gap-3">
          {entity.logoUrl ? (
            <AuthImage
              fileUrl={entity.logoUrl}
              alt="لوگو"
              className="w-11 h-11 rounded-lg object-contain bg-white border border-border shrink-0"
            />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-accentSoft text-accent flex items-center justify-center shrink-0">
              <Landmark size={20} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-textPrimary truncate">{entity.entityName}</h2>
            <p className="text-[11px] text-textSecondary">
              {entity.shortCode} · {CALENDAR_LABEL[entity.calendarType]}
              {entity.status === "inactive" && " · غیرفعال"}
            </p>
          </div>
          {!editMode && (
            <div className="flex gap-2 shrink-0">
              <GhostButton onClick={() => { setForm(toFormState(entity)); setEditMode(true); }}>
                <span className="flex items-center gap-1.5"><Pencil size={13} /> ویرایش</span>
              </GhostButton>
              <button
                onClick={() => { setDeleteError(null); setConfirmDelete(true); }}
                className="text-xs px-3.5 py-2.5 rounded-lg text-danger border border-danger/40 transition-all duration-150 hover:bg-danger/10"
              >
                <span className="flex items-center gap-1.5"><Trash2 size={13} /> حذف</span>
              </button>
            </div>
          )}
        </div>
        {deleteError && <p className="text-xs text-danger">{deleteError}</p>}

        {editMode ? (
          <div className="space-y-3">
            <EntityFormFields form={form} onChange={setForm} allowStatusEdit />
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex gap-2 justify-end">
              <GhostButton onClick={() => { setForm(toFormState(entity)); setEditMode(false); setError(null); }}>
                انصراف
              </GhostButton>
              <PrimaryButton
                disabled={update.isPending || !form.entityName.trim() || !form.shortCode.trim() || !form.country.trim()}
                onClick={async () => {
                  try {
                    setError(null);
                    await update.mutateAsync({ id: entity.id, ...toBody(form) });
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
            <ViewField title="نام انگلیسی" value={entity.entityNameEn} />
            <ViewField title="کشور" value={entity.country} />
            <ViewField title="تلفن" value={entity.phone} />
            <ViewField title="ایمیل" value={entity.email} />
            <ViewField title="وب‌سایت" value={entity.website} />
            <ViewField title="کد پستی" value={entity.postalCode} />
            <ViewField title="شماره ثبت" value={entity.registrationNumber} />
            <div className="col-span-2 sm:col-span-3">
              <ViewField title="آدرس (فارسی)" value={entity.address} />
            </div>
            <div className="col-span-2 sm:col-span-3">
              <ViewField title="آدرس (انگلیسی)" value={entity.addressEn} />
            </div>
          </div>
        )}
      </div>

      {confirmDelete && (
        <ConfirmModal
          title={`حذف شرکت «${entity.entityName}»`}
          description="اگه این شرکت جای دیگه‌ای (استعلام، سفارش خرید، پرسنل، نامه و...) استفاده شده باشه، حذف امکان‌پذیر نیست — به‌جاش وضعیتش رو «غیرفعال» کنید."
          confirmLabel="بله، حذف کن"
          busyLabel="در حال حذف..."
          busy={remove.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            try {
              await remove.mutateAsync(entity.id);
              setConfirmDelete(false);
              onBack();
            } catch (err) {
              setConfirmDelete(false);
              setDeleteError(extractError(err));
            }
          }}
        />
      )}
    </div>
  );
}

function NewEntityForm({ onDone }: { onDone: () => void }) {
  const { create } = useOurEntityMutations();
  const [form, setForm] = useState<FormState>(toFormState());
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-3">
      <h3 className="text-sm font-bold text-textPrimary">ثبت شرکت گروه جدید</h3>
      <EntityFormFields form={form} onChange={setForm} allowStatusEdit={false} />
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2 justify-end">
        <GhostButton onClick={onDone}>انصراف</GhostButton>
        <PrimaryButton
          disabled={!form.entityName.trim() || !form.shortCode.trim() || !form.country.trim() || create.isPending}
          onClick={async () => {
            try {
              setError(null);
              await create.mutateAsync(toBody(form));
              onDone();
            } catch (err) {
              setError(extractError(err));
            }
          }}
        >
          {create.isPending ? "در حال ثبت..." : "ثبت شرکت"}
        </PrimaryButton>
      </div>
    </div>
  );
}

export function OurEntitiesPage() {
  const { data, isLoading, isError } = useOurEntitiesAdmin();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const entities = useMemo(() => data ?? [], [data]);
  const selected = useMemo(
    () => entities.find((entity) => entity.id === selectedId) ?? null,
    [entities, selectedId],
  );

  if (selected) {
    return <EntityDetail entity={selected} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-textPrimary">شرکت‌های ما</h1>
          <p className="text-xs text-textSecondary">
            شرکت‌های گروه که استعلام/سفارش خرید و مکاتبات از طریق‌شون صادر می‌شه.
          </p>
        </div>
        {!showNewForm && (
          <PrimaryButton onClick={() => setShowNewForm(true)}>
            <span className="flex items-center gap-1.5"><Plus size={14} /> شرکت جدید</span>
          </PrimaryButton>
        )}
      </div>

      {showNewForm && <NewEntityForm onDone={() => setShowNewForm(false)} />}

      {isLoading && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}
      {isError && (
        <p className="text-xs text-danger py-8 text-center">خطا در دریافت اطلاعات — اتصال به سرور رو بررسی کنید.</p>
      )}

      {!isLoading && !isError && (
        <div className="rounded-xl bg-surface border border-border shadow-card divide-y divide-border">
          {entities.length === 0 && (
            <p className="text-xs text-textSecondary p-8 text-center">شرکتی ثبت نشده.</p>
          )}
          {entities.map((entity) => (
            <button
              key={entity.id}
              onClick={() => setSelectedId(entity.id)}
              className="w-full flex items-center gap-3 p-4 text-right hover:bg-bg transition-colors"
            >
              {entity.logoUrl ? (
                <AuthImage
                  fileUrl={entity.logoUrl}
                  alt="لوگو"
                  className="w-9 h-9 rounded-lg object-contain bg-white border border-border shrink-0"
                />
              ) : (
                <div className="w-9 h-9 rounded-lg bg-accentSoft text-accent flex items-center justify-center shrink-0">
                  <Landmark size={17} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-textPrimary truncate">{entity.entityName}</p>
                <p className="text-[11px] text-textSecondary truncate">
                  {[entity.shortCode, entity.country, CALENDAR_LABEL[entity.calendarType]]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
              {entity.status === "inactive" && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-border text-textSecondary shrink-0">
                  غیرفعال
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
