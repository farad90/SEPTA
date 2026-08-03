import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, Camera, CheckCircle2, FileText, Pencil, Trash2, Upload } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { AuthImage } from "../../components/ui/AuthImage";
import { DualDateInput } from "../../components/ui/DualDateInput";
import { ViewField } from "../../components/ui/ViewField";
import { Field, GhostButton, PrimaryButton, TextArea, TextInput } from "../../components/ui/fields";
import { formatJalali } from "../../lib/jalali";
import { uploadFile } from "../inquiries/inquiries-api";
import { FileViewer } from "../../components/ui/FileViewer";
import { ImageCropModal } from "../../components/ui/ImageCropModal";
import { IdentityDocument, useMyProfile, useProfileMutations } from "./profile-api";
import { MyRequestsSection } from "../hr/MyRequestsSection";
import { MyPayrollAndReviewsSection } from "../hr/MyPayrollAndReviewsSection";
import { PersonnelInfoSection } from "../hr/PersonnelInfoSection";
import { AppearanceSettingsSection } from "./AppearanceSettingsSection";
import { hasPermission } from "../../lib/permissions";
import { useUserMutations, useUsers } from "../users/users-api";

function ChangePasswordSection() {
  const { changePassword } = useProfileMutations();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const mismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const submit = () => {
    setMessage(null);
    if (newPassword.length < 8) {
      setMessage({ kind: "error", text: "رمز عبور جدید باید حداقل ۸ کاراکتر باشه" });
      return;
    }
    if (mismatch) return;
    changePassword.mutate(
      { currentPassword, newPassword },
      {
        onSuccess: () => {
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
          setMessage({ kind: "success", text: "رمز عبور با موفقیت تغییر کرد" });
        },
        onError: (err: unknown) => {
          const apiErr = err as { response?: { data?: { message?: string } } };
          setMessage({ kind: "error", text: apiErr.response?.data?.message ?? "خطا در تغییر رمز عبور" });
        },
      },
    );
  };

  return (
    <div className="rounded-lg p-5 mb-5 bg-surface border border-border">
      <p className="text-sm font-semibold mb-4 text-textPrimary">تغییر رمز عبور</p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-3">
        <Field label="رمز عبور فعلی">
          <TextInput
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            dir="ltr"
          />
        </Field>
        <Field label="رمز عبور جدید">
          <TextInput type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} dir="ltr" />
        </Field>
        <Field label="تکرار رمز عبور جدید">
          <TextInput
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            dir="ltr"
            className={mismatch ? "!border-danger" : ""}
          />
          {mismatch && <p className="text-[11px] mt-1 text-danger">رمزهای عبور یکسان نیستند</p>}
        </Field>
      </div>
      {message && (
        <p className={`text-xs mb-3 ${message.kind === "success" ? "text-success" : "text-danger"}`}>
          {message.text}
        </p>
      )}
      <div className="flex justify-end">
        <PrimaryButton
          onClick={submit}
          disabled={changePassword.isPending || !currentPassword || !newPassword || !confirmPassword || mismatch}
        >
          {changePassword.isPending ? "در حال ذخیره..." : "تغییر رمز عبور"}
        </PrimaryButton>
      </div>
    </div>
  );
}

function ManagedUsersSection() {
  const { data: users, isLoading } = useUsers();
  const { update } = useUserMutations();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ fullName: "", phone: "" });

  const startEdit = (id: string, fullName: string, phone: string | null) => {
    setEditingId(id);
    setEditForm({ fullName, phone: phone ?? "" });
  };

  const save = (id: string) => {
    update.mutate(
      { userId: id, fullName: editForm.fullName || undefined, phone: editForm.phone || undefined },
      { onSuccess: () => setEditingId(null) },
    );
  };

  return (
    <div className="rounded-lg p-5 mb-5 bg-surface border border-border">
      <p className="text-sm font-semibold mb-1 text-textPrimary">مشاهده و ویرایش کاربران</p>
      <p className="text-xs mb-4 text-textSecondary">به‌عنوان مدیر، نام و شماره داخلی سایر کاربران رو از اینجا ویرایش کن</p>
      {isLoading ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>
      ) : (
        <div className="space-y-2">
          {(users ?? []).map((u) => (
            <div key={u.id} className="rounded-lg p-3 bg-bg border border-border">
              {editingId === u.id ? (
                <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
                  <TextInput
                    value={editForm.fullName}
                    onChange={(e) => setEditForm((f) => ({ ...f, fullName: e.target.value }))}
                    placeholder="نام و نام خانوادگی"
                    className="flex-1"
                  />
                  <TextInput
                    value={editForm.phone}
                    onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))}
                    placeholder="شماره داخلی"
                    dir="ltr"
                    className="sm:w-32"
                  />
                  <div className="flex gap-2 justify-end">
                    <GhostButton onClick={() => setEditingId(null)}>انصراف</GhostButton>
                    <PrimaryButton onClick={() => save(u.id)} disabled={update.isPending}>
                      ذخیره
                    </PrimaryButton>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div>
                    <p className="text-xs font-medium text-textPrimary">{u.fullName}</p>
                    <p className="text-[11px] text-textSecondary mt-0.5">
                      {u.email ?? "—"} {u.phone ? `· داخلی ${u.phone}` : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => startEdit(u.id, u.fullName, u.phone)}
                    className="flex items-center gap-1 text-[11px] px-2.5 py-1 rounded-lg text-primary border border-primary"
                  >
                    <Pencil size={11} /> ویرایش
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const REQUIRED_PERSONAL_FIELDS = ["birthDate", "address", "nationalId", "birthCertificateNo"] as const;

function ProfileAvatar({ name, photoUrl, size = 88 }: { name: string; photoUrl?: string | null; size?: number }) {
  const initials = name.trim().split(" ").slice(0, 2).map((w) => w[0]).join("");
  if (photoUrl) {
    return (
      <AuthImage
        fileUrl={photoUrl}
        alt={name}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full flex items-center justify-center font-bold text-white shrink-0 bg-primary"
      style={{ width: size, height: size, fontSize: size * 0.32 }}
    >
      {initials}
    </div>
  );
}

function DocUploadCard({
  title,
  doc,
  required,
  uploading,
  onUpload,
  onRemoveEmptySlot,
}: {
  title: string;
  doc: IdentityDocument | undefined;
  required: boolean;
  uploading: boolean;
  onUpload: (file: File) => void;
  onRemoveEmptySlot?: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const uploaded = !!doc;
  const emptyBg = required ? "bg-warningSoft" : "bg-bg";
  const emptyIconColor = required ? "text-warning" : "text-textSecondary";

  return (
    <div className={`rounded-lg p-3 flex items-center gap-3 ${uploaded ? "bg-successSoft" : emptyBg}`}>
      <div
        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-surface ${
          uploaded ? "text-success" : emptyIconColor
        }`}
      >
        {uploaded ? <CheckCircle2 size={16} /> : <FileText size={16} />}
      </div>
      <div className="flex-1">
        <p className="text-xs font-medium text-textPrimary">
          {title}
          {required && <span className="text-warning"> *الزامی</span>}
        </p>
        {uploaded ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-success">
            بارگذاری شده
            <FileViewer fileUrl={doc!.fileUrl} fileName={`${title}.jpg`} />
          </span>
        ) : (
          <p className={`text-[11px] ${required ? "text-warning" : "text-textSecondary"}`}>
            {required ? "بارگذاری نشده — الزامی" : "بارگذاری نشده"}
          </p>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,.pdf,.tif,.tiff"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onUpload(file);
          e.target.value = "";
        }}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => inputRef.current?.click()}
        className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg text-white shrink-0 disabled:opacity-60 ${
          uploaded ? "bg-textSecondary" : "bg-primary"
        }`}
      >
        <Upload size={11} /> {uploading ? "در حال بارگذاری..." : uploaded ? "جایگزینی" : "بارگذاری"}
      </button>
      {!uploaded && onRemoveEmptySlot && (
        <button type="button" onClick={onRemoveEmptySlot} className="text-[11px] text-danger shrink-0">
          حذف
        </button>
      )}
    </div>
  );
}

export function ProfilePage() {
  const { user, refetch: refetchAuth } = useAuth();
  const { data: profile, isLoading } = useMyProfile();
  const { update, upsertDocument } = useProfileMutations();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") === "appearance" ? "appearance" : "profile";
  const setActiveTab = (tab: "profile" | "appearance") =>
    setSearchParams(tab === "profile" ? {} : { tab }, { replace: true });

  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({
    fullName: "",
    fullNameEn: "",
    phone: "",
    mobile: "",
    email: "",
    birthDate: "" as string | null,
    address: "",
    nationalId: "",
    birthCertificateNo: "",
  });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [pendingPhotoFile, setPendingPhotoFile] = useState<File | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState<string | null>(null);
  const [extraPages, setExtraPages] = useState<number[]>([]);

  useEffect(() => {
    if (profile) {
      setForm({
        fullName: profile.fullName ?? "",
        fullNameEn: profile.fullNameEn ?? "",
        phone: profile.phone ?? "",
        mobile: profile.mobile ?? "",
        email: profile.email ?? "",
        birthDate: profile.birthDate,
        address: profile.address ?? "",
        nationalId: profile.nationalId ?? "",
        birthCertificateNo: profile.birthCertificateNo ?? "",
      });
    }
  }, [profile]);

  const nationalIdCardDoc = profile?.identityDocuments.find((d) => d.documentType === "national_id_card");
  const birthCertPages = useMemo(
    () => profile?.identityDocuments.filter((d) => d.documentType === "birth_certificate_page") ?? [],
    [profile],
  );

  const pageSlots = useMemo(() => {
    const uploadedPageNumbers = birthCertPages.map((d) => d.pageNumber ?? 1);
    const slots = new Set<number>([1, ...uploadedPageNumbers, ...extraPages]);
    return Array.from(slots).sort((a, b) => a - b);
  }, [birthCertPages, extraPages]);

  const completion = useMemo(() => {
    if (!profile) return 0;
    const missingFields = REQUIRED_PERSONAL_FIELDS.filter((f) => !profile[f]);
    // فقط شناسنامه — صفحه ۱ الزامیه؛ کارت ملی اختیاریه و در محاسبه تکمیل شمرده نمی‌شه
    const missingDocs = pageSlots.filter((p) => !birthCertPages.some((d) => (d.pageNumber ?? 1) === p)).length;
    const totalRequired = REQUIRED_PERSONAL_FIELDS.length + pageSlots.length;
    const totalDone = totalRequired - missingFields.length - missingDocs;
    return Math.max(0, Math.min(100, Math.round((totalDone / totalRequired) * 100)));
  }, [profile, pageSlots, birthCertPages]);

  if (isLoading || !profile) {
    return <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>;
  }

  const mobileInvalid = form.mobile.trim() !== "" && !/^09\d{9}$/.test(form.mobile.trim());

  const save = () => {
    update.mutate(
      {
        fullName: form.fullName || undefined,
        fullNameEn: form.fullNameEn || undefined,
        phone: form.phone || undefined,
        mobile: form.mobile || undefined,
        email: form.email || undefined,
        birthDate: form.birthDate || undefined,
        address: form.address || undefined,
        nationalId: form.nationalId || undefined,
        birthCertificateNo: form.birthCertificateNo || undefined,
      },
      { onSuccess: () => setEditMode(false) },
    );
  };

  const uploadPhoto = async (file: File) => {
    setUploadingPhoto(true);
    try {
      const stored = await uploadFile(file);
      await update.mutateAsync({ profilePhotoUrl: stored.fileUrl });
      await refetchAuth();
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = async () => {
    setUploadingPhoto(true);
    try {
      await update.mutateAsync({ profilePhotoUrl: null });
      await refetchAuth();
    } finally {
      setUploadingPhoto(false);
    }
  };

  const uploadDoc = async (documentType: IdentityDocument["documentType"], pageNumber: number | undefined, file: File) => {
    const key = documentType === "national_id_card" ? documentType : `page-${pageNumber}`;
    setUploadingDoc(key);
    try {
      const stored = await uploadFile(file);
      await upsertDocument.mutateAsync({ documentType, pageNumber, fileUrl: stored.fileUrl });
    } finally {
      setUploadingDoc(null);
    }
  };

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold mb-5 text-textPrimary">پروفایل کاربری</h1>

      <div className="flex rounded-lg border border-border overflow-hidden w-fit mb-5">
        <button
          type="button"
          onClick={() => setActiveTab("profile")}
          className={`px-4 py-2 text-xs transition-colors ${
            activeTab === "profile" ? "bg-primary text-white" : "bg-surface text-textSecondary"
          }`}
        >
          پروفایل
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("appearance")}
          className={`px-4 py-2 text-xs transition-colors ${
            activeTab === "appearance" ? "bg-primary text-white" : "bg-surface text-textSecondary"
          }`}
        >
          ظاهر و نمایش
        </button>
      </div>

      {activeTab === "appearance" && <AppearanceSettingsSection />}

      {activeTab === "profile" && (
        <>
      {completion < 100 && (
        <div className="rounded-lg p-4 mb-5 flex items-center gap-3 bg-warningSoft">
          <AlertTriangle size={18} className="shrink-0 text-warning" />
          <div className="flex-1">
            <p className="text-xs font-medium mb-1.5 text-textPrimary">
              تکمیل پروفایل: {completion}٪ — برخی اطلاعات/مدارک الزامی هنوز ثبت نشده
            </p>
            <div className="h-1.5 rounded-full overflow-hidden bg-black/10">
              <div className="h-full rounded-full bg-warning" style={{ width: `${completion}%` }} />
            </div>
          </div>
        </div>
      )}

      {/* هدر پروفایل */}
      <div className="rounded-lg p-5 mb-5 bg-surface border border-border">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="relative">
            <ProfileAvatar name={profile.fullName} photoUrl={profile.profilePhotoUrl} />
            <input
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              className="hidden"
              id="profile-photo-input"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) setPendingPhotoFile(file);
                e.target.value = "";
              }}
            />
            <label
              htmlFor="profile-photo-input"
              className="absolute bottom-0 left-0 w-7 h-7 rounded-full flex items-center justify-center text-white bg-primary border-2 border-surface cursor-pointer"
            >
              {uploadingPhoto ? "..." : <Camera size={13} />}
            </label>
            {profile.profilePhotoUrl && (
              <button
                type="button"
                onClick={removePhoto}
                disabled={uploadingPhoto}
                aria-label="حذف عکس پروفایل"
                title="حذف عکس"
                className="absolute bottom-0 right-0 w-7 h-7 rounded-full flex items-center justify-center text-white bg-danger border-2 border-surface disabled:opacity-60"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
          <div className="flex-1 min-w-[160px]">
            <h2 className="text-lg font-bold text-textPrimary">{profile.fullName}</h2>
            <p className="text-xs mt-1 text-textSecondary">
              گروه دسترسی: {profile.permissionGroup?.groupName ?? "—"}
            </p>
          </div>
          {!editMode && (
            <button
              onClick={() => setEditMode(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-primary border border-primary"
            >
              <Pencil size={12} /> ویرایش پروفایل
            </button>
          )}
        </div>
      </div>

      {/* اطلاعات فردی */}
      <div className="rounded-lg p-5 mb-5 bg-surface border border-border">
        <p className="text-sm font-semibold mb-4 text-textPrimary">اطلاعات فردی</p>

        {!editMode ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ViewField title="نام و نام خانوادگی" value={profile.fullName} />
            <ViewField title="نام و نام خانوادگی (لاتین)" value={profile.fullNameEn} />
            <ViewField title="شماره داخلی" value={profile.phone} />
            <ViewField title="موبایل" value={profile.mobile} />
            <ViewField title="ایمیل" value={profile.email} />
            <ViewField title="تاریخ تولد" value={profile.birthDate ? formatJalali(profile.birthDate) : null} />
            <ViewField title="آدرس" value={profile.address} />
            <ViewField title="کد ملی" value={profile.nationalId} />
            <ViewField title="شماره شناسنامه" value={profile.birthCertificateNo} />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <Field label="نام و نام خانوادگی">
                <TextInput
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                />
              </Field>
              <Field label="نام و نام خانوادگی (لاتین)">
                <TextInput
                  value={form.fullNameEn}
                  onChange={(e) => setForm((f) => ({ ...f, fullNameEn: e.target.value }))}
                  dir="ltr"
                  placeholder="مثلاً Sara Rezaei"
                />
              </Field>
              <Field label="شماره داخلی">
                <TextInput
                  value={form.phone}
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                  dir="ltr"
                />
              </Field>
              <Field label="موبایل">
                <TextInput
                  value={form.mobile}
                  onChange={(e) => setForm((f) => ({ ...f, mobile: e.target.value }))}
                  dir="ltr"
                  placeholder="۰۹xxxxxxxxx"
                  className={mobileInvalid ? "!border-danger" : ""}
                />
                {mobileInvalid && <p className="text-[11px] mt-1 text-danger">شماره موبایل باید با ۰۹ شروع بشه و ۱۱ رقم باشه</p>}
              </Field>
              <Field label="ایمیل">
                <TextInput
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  dir="ltr"
                />
              </Field>
              <Field label="تاریخ تولد *">
                <DualDateInput
                  value={form.birthDate}
                  onChange={(iso) => setForm((f) => ({ ...f, birthDate: iso }))}
                />
              </Field>
              <Field label="کد ملی *">
                <TextInput
                  value={form.nationalId}
                  onChange={(e) => setForm((f) => ({ ...f, nationalId: e.target.value }))}
                  dir="ltr"
                />
              </Field>
              <Field label="شماره شناسنامه *">
                <TextInput
                  value={form.birthCertificateNo}
                  onChange={(e) => setForm((f) => ({ ...f, birthCertificateNo: e.target.value }))}
                  dir="ltr"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="آدرس *">
                  <TextArea
                    value={form.address}
                    onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
                    rows={2}
                  />
                </Field>
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <GhostButton onClick={() => setEditMode(false)}>انصراف</GhostButton>
              <PrimaryButton onClick={save} disabled={update.isPending || mobileInvalid}>
                {update.isPending ? "در حال ذخیره..." : "ذخیره"}
              </PrimaryButton>
            </div>
          </>
        )}
      </div>

      <PersonnelInfoSection />

      {/* مدارک هویتی */}
      <div className="rounded-lg p-5 bg-surface border border-border">
        <p className="text-sm font-semibold mb-1 text-textPrimary">مدارک هویتی</p>
        <p className="text-xs mb-4 text-textSecondary">تصویر کارت ملی (اختیاری) و صفحات شناسنامه — فقط صفحه ۱ الزامیه</p>

        <div className="space-y-2 mb-4">
          <DocUploadCard
            title="تصویر کارت ملی"
            doc={nationalIdCardDoc}
            required={false}
            uploading={uploadingDoc === "national_id_card"}
            onUpload={(file) => uploadDoc("national_id_card", undefined, file)}
          />
          {pageSlots.map((page) => {
            const doc = birthCertPages.find((d) => (d.pageNumber ?? 1) === page);
            return (
              <DocUploadCard
                key={page}
                title={`شناسنامه — صفحه ${page}`}
                doc={doc}
                required={page === 1}
                uploading={uploadingDoc === `page-${page}`}
                onUpload={(file) => uploadDoc("birth_certificate_page", page, file)}
                onRemoveEmptySlot={
                  !doc && page !== 1 ? () => setExtraPages((p) => p.filter((x) => x !== page)) : undefined
                }
              />
            );
          })}
        </div>
        <GhostButton
          onClick={() => setExtraPages((p) => [...p, Math.max(...pageSlots) + 1])}
          className="text-primary border-primary"
        >
          + افزودن صفحه دیگر شناسنامه
        </GhostButton>
      </div>

      <div className="mt-5">
        <ChangePasswordSection />
      </div>

      {hasPermission(user, "users.manage") && (
        <div className="mt-5">
          <ManagedUsersSection />
        </div>
      )}

      <div className="mt-5">
        <MyRequestsSection />
      </div>
      <div className="mt-5">
        <MyPayrollAndReviewsSection />
      </div>

      {pendingPhotoFile && (
        <ImageCropModal
          file={pendingPhotoFile}
          onCancel={() => setPendingPhotoFile(null)}
          onConfirm={(croppedFile) => {
            setPendingPhotoFile(null);
            uploadPhoto(croppedFile);
          }}
        />
      )}
        </>
      )}
    </div>
  );
}
