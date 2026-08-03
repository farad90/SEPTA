import { useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowRight, FileUp, Pencil, Plus, Search, UserRound } from "lucide-react";
import { AuthImage } from "../../components/ui/AuthImage";
import { FileViewer } from "../../components/ui/FileViewer";
import { ViewField } from "../../components/ui/ViewField";
import { DualDateInput } from "../../components/ui/DualDateInput";
import { AmountInput } from "../../components/ui/AmountInput";
import { Field, GhostButton, PrimaryButton, Select, TextArea, TextInput } from "../../components/ui/fields";
import { useDebounced } from "../../lib/use-debounced";
import { hasPermission } from "../../lib/permissions";
import { useAuth } from "../../lib/auth-context";
import { formatJalali } from "../../lib/jalali";
import { uploadFile } from "../inquiries/inquiries-api";
import { useCurrencies, useOurEntities } from "../inquiries/rfqs-api";
import { useColleagues } from "../users/users-api";
import {
  useDepartments,
  useEmployee,
  useEmployeeMutations,
  useEmployees,
  useSimilarEmployees,
} from "./hr-api";
import {
  CONTRACT_STATUS_META,
  CONTRACT_TYPE_LABEL,
  Employee,
  EMPLOYMENT_STATUS_META,
  EmployeeContract,
  GENDER_LABEL,
  MARITAL_STATUS_LABEL,
  MILITARY_SERVICE_LABEL,
} from "./hr-types";
import { EmployeeHrRecordsSection } from "./EmployeeHrRecordsSection";

function extractError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? fallback);
}

// ------------------------------------------------------------
// فرم پرسنل
// ------------------------------------------------------------
interface EmployeeFormState {
  employeeNumber: string;
  fullName: string;
  userId: string;
  nationalId: string;
  birthDate: string | null;
  gender: string;
  mobile: string;
  email: string;
  address: string;
  maritalStatus: string;
  militaryServiceStatus: string;
  educationLevel: string;
  bankAccountNumber: string;
  bankName: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
  departmentId: string;
  positionTitle: string;
  directManagerId: string;
  ourEntityId: string;
  hireDate: string | null;
}

function toFormState(employee?: Employee): EmployeeFormState {
  return {
    employeeNumber: employee?.employeeNumber ?? "",
    fullName: employee?.fullName ?? "",
    userId: employee?.userId ?? "",
    nationalId: employee?.nationalId ?? "",
    birthDate: employee?.birthDate ?? null,
    gender: employee?.gender ?? "",
    mobile: employee?.mobile ?? "",
    email: employee?.email ?? "",
    address: employee?.address ?? "",
    maritalStatus: employee?.maritalStatus ?? "",
    militaryServiceStatus: employee?.militaryServiceStatus ?? "",
    educationLevel: employee?.educationLevel ?? "",
    bankAccountNumber: employee?.bankAccountNumber ?? "",
    bankName: employee?.bankName ?? "",
    emergencyContactName: employee?.emergencyContactName ?? "",
    emergencyContactPhone: employee?.emergencyContactPhone ?? "",
    departmentId: employee?.departmentId ?? "",
    positionTitle: employee?.positionTitle ?? "",
    directManagerId: employee?.directManagerId ?? "",
    ourEntityId: employee?.ourEntityId ?? "",
    hireDate: employee?.hireDate ?? null,
  };
}

function toBody(form: EmployeeFormState, includeEmployeeNumber: boolean) {
  const clean = (v: string) => (v.trim() === "" ? undefined : v.trim());
  return {
    ...(includeEmployeeNumber && form.employeeNumber.trim() ? { employeeNumber: form.employeeNumber.trim() } : {}),
    userId: form.userId || undefined,
    fullName: form.fullName.trim(),
    nationalId: clean(form.nationalId),
    birthDate: form.birthDate ?? undefined,
    gender: clean(form.gender),
    mobile: clean(form.mobile),
    email: clean(form.email),
    address: clean(form.address),
    maritalStatus: clean(form.maritalStatus),
    militaryServiceStatus: clean(form.militaryServiceStatus),
    educationLevel: clean(form.educationLevel),
    bankAccountNumber: clean(form.bankAccountNumber),
    bankName: clean(form.bankName),
    emergencyContactName: clean(form.emergencyContactName),
    emergencyContactPhone: clean(form.emergencyContactPhone),
    departmentId: form.departmentId || undefined,
    positionTitle: clean(form.positionTitle),
    directManagerId: form.directManagerId || undefined,
    ourEntityId: form.ourEntityId,
    hireDate: form.hireDate ?? undefined,
  };
}

function EmployeeFormFields({
  form,
  onChange,
  isNew,
  excludeManagerId,
  mode = "full",
}: {
  form: EmployeeFormState;
  onChange: (next: EmployeeFormState) => void;
  isNew: boolean;
  excludeManagerId?: string;
  /** adminOnly: پرسنل «حساب کاربری دارد» — فیلدهای فردی حذف می‌شن (خودِ شخص در پروفایل تکمیل می‌کنه) */
  mode?: "full" | "adminOnly";
}) {
  const set = <K extends keyof EmployeeFormState>(key: K, value: EmployeeFormState[K]) =>
    onChange({ ...form, [key]: value });
  const { data: departments } = useDepartments();
  const { data: ourEntities } = useOurEntities();
  const { data: colleagues } = useEmployees({});

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {isNew && mode === "full" && (
          <Field label="شماره پرسنلی *">
            <TextInput value={form.employeeNumber} onChange={(e) => set("employeeNumber", e.target.value)} dir="ltr" />
          </Field>
        )}
        <Field label="نام و نام‌خانوادگی *">
          <TextInput value={form.fullName} onChange={(e) => set("fullName", e.target.value)} />
        </Field>
        {mode === "full" && (
          <>
            <Field label="کد ملی">
              <TextInput value={form.nationalId} onChange={(e) => set("nationalId", e.target.value)} dir="ltr" />
            </Field>
            <Field label="تاریخ تولد">
              <DualDateInput value={form.birthDate} onChange={(iso) => set("birthDate", iso)} />
            </Field>
            <Field label="جنسیت">
              <Select value={form.gender} onChange={(e) => set("gender", e.target.value)}>
                <option value="">— انتخاب —</option>
                {Object.entries(GENDER_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </Field>
            <Field label="وضعیت تأهل">
              <Select value={form.maritalStatus} onChange={(e) => set("maritalStatus", e.target.value)}>
                <option value="">— انتخاب —</option>
                {Object.entries(MARITAL_STATUS_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </Field>
            <Field label="وضعیت خدمت نظام‌وظیفه">
              <Select value={form.militaryServiceStatus} onChange={(e) => set("militaryServiceStatus", e.target.value)}>
                <option value="">— انتخاب —</option>
                {Object.entries(MILITARY_SERVICE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </Select>
            </Field>
            <Field label="مدرک تحصیلی">
              <TextInput value={form.educationLevel} onChange={(e) => set("educationLevel", e.target.value)} />
            </Field>
            <Field label="موبایل">
              <TextInput value={form.mobile} onChange={(e) => set("mobile", e.target.value)} dir="ltr" />
            </Field>
            <Field label="ایمیل">
              <TextInput value={form.email} onChange={(e) => set("email", e.target.value)} dir="ltr" />
            </Field>
            <Field label="شماره حساب/شبا بانکی">
              <TextInput value={form.bankAccountNumber} onChange={(e) => set("bankAccountNumber", e.target.value)} dir="ltr" />
            </Field>
            <Field label="نام بانک">
              <TextInput value={form.bankName} onChange={(e) => set("bankName", e.target.value)} />
            </Field>
            <Field label="نام تماس اضطراری">
              <TextInput value={form.emergencyContactName} onChange={(e) => set("emergencyContactName", e.target.value)} />
            </Field>
            <Field label="تلفن تماس اضطراری">
              <TextInput value={form.emergencyContactPhone} onChange={(e) => set("emergencyContactPhone", e.target.value)} dir="ltr" />
            </Field>
          </>
        )}
        <Field label="بخش">
          <Select value={form.departmentId} onChange={(e) => set("departmentId", e.target.value)}>
            <option value="">— بدون بخش —</option>
            {(departments ?? []).map((d) => (
              <option key={d.id} value={d.id}>{d.departmentName}</option>
            ))}
          </Select>
        </Field>
        <Field label="عنوان شغلی">
          <TextInput value={form.positionTitle} onChange={(e) => set("positionTitle", e.target.value)} />
        </Field>
        <Field label="سرپرست مستقیم">
          <Select value={form.directManagerId} onChange={(e) => set("directManagerId", e.target.value)}>
            <option value="">— بدون سرپرست —</option>
            {(colleagues ?? [])
              .filter((c) => c.id !== excludeManagerId && c.employeeNumber)
              .map((c) => (
                <option key={c.id} value={c.id}>{c.fullName}</option>
              ))}
          </Select>
        </Field>
        <Field label={mode === "full" ? "شرکت گروه *" : "شرکت گروه"}>
          <Select value={form.ourEntityId} onChange={(e) => set("ourEntityId", e.target.value)}>
            <option value="">— انتخاب —</option>
            {(ourEntities ?? []).map((e) => (
              <option key={e.id} value={e.id}>{e.entityName}</option>
            ))}
          </Select>
        </Field>
        <Field label={mode === "full" ? "تاریخ استخدام *" : "تاریخ استخدام"}>
          <DualDateInput value={form.hireDate} onChange={(iso) => set("hireDate", iso)} />
        </Field>
        {mode === "full" && (
          <div className="sm:col-span-2">
            <Field label="آدرس">
              <TextArea value={form.address} onChange={(e) => set("address", e.target.value)} rows={2} />
            </Field>
          </div>
        )}
      </div>
      {mode === "adminOnly" && (
        <p className="text-[11px] text-textSecondary">
          «شرکت گروه» و «تاریخ استخدام» اختیاریه — اگه الان مشخص نیست، می‌تونید در همون مرحله تخصیص
          شماره پرسنلی تعیینش کنید.
        </p>
      )}
    </div>
  );
}

function SimilarityWarning({ name, excludeId }: { name: string; excludeId?: string }) {
  const debouncedName = useDebounced(name);
  const { data } = useSimilarEmployees(debouncedName, true);
  const matches = (data ?? []).filter((match) => match.id !== excludeId);
  if (matches.length === 0) return null;

  return (
    <div className="rounded-lg p-3 bg-warningSoft text-warning text-xs flex gap-2">
      <AlertTriangle size={15} className="shrink-0 mt-0.5" />
      <div>
        <p className="font-medium mb-1">ممکنه این پرسنل قبلاً با نام مشابهی ثبت شده باشه:</p>
        <ul className="space-y-0.5">
          {matches.map((match) => (
            <li key={match.id}>
              • {match.fullName} ({match.employeeNumber}) — شباهت {Math.round(match.similarity * 100)}٪
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// فرم قرارداد
// ------------------------------------------------------------
const EMPTY_CONTRACT = {
  ourEntityId: "",
  contractType: "permanent",
  positionTitle: "",
  startDate: null as string | null,
  endDate: null as string | null,
  baseSalary: "",
  salaryCurrency: "",
  workLocation: "",
  fileUrl: "",
  signedDate: null as string | null,
};

function ContractForm({
  initial,
  busy,
  onSubmit,
  onCancel,
}: {
  initial: typeof EMPTY_CONTRACT;
  busy: boolean;
  onSubmit: (body: typeof EMPTY_CONTRACT) => void;
  onCancel: () => void;
}) {
  const { data: ourEntities } = useOurEntities();
  const { data: currencies } = useCurrencies();
  const [contract, setContract] = useState(initial);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const set = <K extends keyof typeof EMPTY_CONTRACT>(key: K, value: (typeof EMPTY_CONTRACT)[K]) =>
    setContract((current) => ({ ...current, [key]: value }));

  const canSubmit =
    !!contract.ourEntityId && !!contract.startDate && !!contract.baseSalary.trim() && !!contract.salaryCurrency;

  return (
    <div className="rounded-lg border border-border p-4 space-y-3 bg-bg">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="نوع قرارداد *">
          <Select value={contract.contractType} onChange={(e) => set("contractType", e.target.value)}>
            {Object.entries(CONTRACT_TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
        </Field>
        <Field label="شرکت گروه *">
          <Select value={contract.ourEntityId} onChange={(e) => set("ourEntityId", e.target.value)}>
            <option value="">— انتخاب —</option>
            {(ourEntities ?? []).map((e) => (
              <option key={e.id} value={e.id}>{e.entityName}</option>
            ))}
          </Select>
        </Field>
        <Field label="عنوان شغلی">
          <TextInput value={contract.positionTitle} onChange={(e) => set("positionTitle", e.target.value)} />
        </Field>
        <Field label="محل کار">
          <TextInput value={contract.workLocation} onChange={(e) => set("workLocation", e.target.value)} />
        </Field>
        <Field label="تاریخ شروع *">
          <DualDateInput value={contract.startDate} onChange={(iso) => set("startDate", iso)} />
        </Field>
        <Field label="تاریخ پایان">
          <DualDateInput value={contract.endDate} onChange={(iso) => set("endDate", iso)} />
        </Field>
        <Field label="حقوق پایه *">
          <AmountInput
            value={contract.baseSalary === "" ? null : Number(contract.baseSalary)}
            onChange={(n) => set("baseSalary", n === null ? "" : String(n))}
          />
        </Field>
        <Field label="ارز *">
          <Select value={contract.salaryCurrency} onChange={(e) => set("salaryCurrency", e.target.value)}>
            <option value="">— انتخاب —</option>
            {(currencies ?? []).map((c) => (
              <option key={c.currencyCode} value={c.currencyCode}>{c.currencyName}</option>
            ))}
          </Select>
        </Field>
        <Field label="تاریخ امضا">
          <DualDateInput value={contract.signedDate} onChange={(iso) => set("signedDate", iso)} />
        </Field>
        <div>
          <p className="text-xs font-medium mb-1.5 text-textPrimary">فایل قرارداد</p>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(true);
              try {
                const stored = await uploadFile(file);
                set("fileUrl", stored.fileUrl);
              } finally {
                setUploading(false);
                e.target.value = "";
              }
            }}
          />
          <GhostButton onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            <span className="flex items-center gap-1.5">
              <FileUp size={13} /> {uploading ? "در حال بارگذاری..." : contract.fileUrl ? "تغییر فایل" : "بارگذاری فایل"}
            </span>
          </GhostButton>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <GhostButton onClick={onCancel}>انصراف</GhostButton>
        <PrimaryButton disabled={!canSubmit || busy} onClick={() => onSubmit(contract)}>
          ذخیره قرارداد
        </PrimaryButton>
      </div>
    </div>
  );
}

function ContractRow({ contract }: { contract: EmployeeContract }) {
  const statusMeta = CONTRACT_STATUS_META[contract.status];
  return (
    <li className="py-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-textPrimary">
          {CONTRACT_TYPE_LABEL[contract.contractType] ?? contract.contractType}
          {contract.positionTitle ? ` — ${contract.positionTitle}` : ""}
        </p>
        {statusMeta && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusMeta.className}`}>
            {statusMeta.label}
          </span>
        )}
      </div>
      <p className="text-[11px] text-textSecondary mt-1">
        از {formatJalali(contract.startDate)}
        {contract.endDate ? ` تا ${formatJalali(contract.endDate)}` : ""} ·{" "}
        {Number(contract.baseSalary).toLocaleString("en-US")} {contract.salaryCurrency}
        {contract.workLocation ? ` · ${contract.workLocation}` : ""}
      </p>
      {contract.fileUrl && (
        <span className="inline-flex items-center gap-1 mt-2 text-[11px] text-textSecondary">
          فایل قرارداد
          <FileViewer fileUrl={contract.fileUrl} fileName="فایل قرارداد" />
        </span>
      )}
    </li>
  );
}

// ------------------------------------------------------------
// تخصیص شماره پرسنلی — لحظه‌ای که یک «کاربر سامانه» رسماً «کارمند شرکت» ثبت می‌شه
// ------------------------------------------------------------
function AssignNumberForm({ employee }: { employee: Employee }) {
  const { assignNumber } = useEmployeeMutations();
  const { data: ourEntities } = useOurEntities();
  const [employeeNumber, setEmployeeNumber] = useState("");
  const [ourEntityId, setOurEntityId] = useState(employee.ourEntityId ?? "");
  const [hireDate, setHireDate] = useState<string | null>(employee.hireDate);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = employeeNumber.trim() && ourEntityId && hireDate;

  return (
    <div className="rounded-lg border border-warning/40 bg-warningSoft p-4 space-y-3">
      <p className="text-xs font-semibold text-textPrimary">تخصیص شماره پرسنلی</p>
      <p className="text-[11px] text-textSecondary">
        با ثبت این فرم، این شخص به‌عنوان کارمند رسمی شرکت ثبت می‌شه.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="شماره پرسنلی *">
          <TextInput value={employeeNumber} onChange={(e) => setEmployeeNumber(e.target.value)} dir="ltr" />
        </Field>
        <Field label="شرکت گروه *">
          <Select value={ourEntityId} onChange={(e) => setOurEntityId(e.target.value)}>
            <option value="">— انتخاب —</option>
            {(ourEntities ?? []).map((e) => (
              <option key={e.id} value={e.id}>{e.entityName}</option>
            ))}
          </Select>
        </Field>
        <Field label="تاریخ استخدام *">
          <DualDateInput value={hireDate} onChange={setHireDate} />
        </Field>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex justify-end">
        <PrimaryButton
          disabled={!canSubmit || assignNumber.isPending}
          onClick={async () => {
            try {
              setError(null);
              await assignNumber.mutateAsync({
                id: employee.id,
                employeeNumber: employeeNumber.trim(),
                ourEntityId,
                hireDate: hireDate ?? undefined,
              });
            } catch (err) {
              setError(extractError(err, "خطا در تخصیص شماره پرسنلی"));
            }
          }}
        >
          {assignNumber.isPending ? "در حال ثبت..." : "ثبت به‌عنوان کارمند رسمی"}
        </PrimaryButton>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// جزئیات پرسنل
// ------------------------------------------------------------
function EmployeeDetail({ employeeId, onBack }: { employeeId: string; onBack: () => void }) {
  const { user } = useAuth();
  const canManage = hasPermission(user, "hr.manage");
  const { data: employee } = useEmployee(employeeId);
  const { update, addContract } = useEmployeeMutations();
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState<EmployeeFormState | null>(null);
  const [employmentStatus, setEmploymentStatus] = useState("active");
  const [terminationDate, setTerminationDate] = useState<string | null>(null);
  const [addingContract, setAddingContract] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!employee) {
    return <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>;
  }

  const statusMeta = EMPLOYMENT_STATUS_META[employee.employmentStatus];

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-primary font-medium">
        <ArrowRight size={14} />
        بازگشت به لیست
      </button>

      <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-4">
        <div className="flex items-center gap-3">
          {employee.profilePhotoUrl ? (
            <AuthImage fileUrl={employee.profilePhotoUrl} alt={employee.fullName} className="w-11 h-11 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-11 h-11 rounded-full bg-accentSoft text-accent flex items-center justify-center shrink-0">
              <UserRound size={20} />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-textPrimary truncate">{employee.fullName}</h2>
            {employee.employeeNumber ? (
              <p className="text-[11px] text-textSecondary" dir="ltr">{employee.employeeNumber}</p>
            ) : (
              <p className="text-[11px] text-warning">در انتظار تخصیص شماره پرسنلی</p>
            )}
          </div>
          {statusMeta && (
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusMeta.className}`}>
              {statusMeta.label}
            </span>
          )}
          {canManage && !editMode && (
            <GhostButton
              onClick={() => {
                setForm(toFormState(employee));
                setEmploymentStatus(employee.employmentStatus);
                setTerminationDate(employee.terminationDate);
                setEditMode(true);
              }}
            >
              <span className="flex items-center gap-1.5"><Pencil size={13} /> ویرایش</span>
            </GhostButton>
          )}
        </div>

        {!employee.employeeNumber && canManage && !editMode && <AssignNumberForm employee={employee} />}

        {editMode && form ? (
          <div className="space-y-3">
            <EmployeeFormFields form={form} onChange={setForm} isNew={false} excludeManagerId={employee.id} />
            {form.fullName.trim() !== employee.fullName && (
              <SimilarityWarning name={form.fullName} excludeId={employee.id} />
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="وضعیت اشتغال">
                <Select value={employmentStatus} onChange={(e) => setEmploymentStatus(e.target.value)}>
                  <option value="active">فعال</option>
                  <option value="on_leave">مرخصی</option>
                  <option value="terminated">پایان همکاری</option>
                </Select>
              </Field>
              {employmentStatus === "terminated" && (
                <Field label="تاریخ پایان همکاری">
                  <DualDateInput value={terminationDate} onChange={setTerminationDate} />
                </Field>
              )}
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex gap-2 justify-end">
              <GhostButton onClick={() => setEditMode(false)}>انصراف</GhostButton>
              <PrimaryButton
                disabled={
                  update.isPending ||
                  !form.fullName.trim() ||
                  (!!employee.employeeNumber && (!form.ourEntityId || !form.hireDate))
                }
                onClick={async () => {
                  try {
                    setError(null);
                    await update.mutateAsync({
                      id: employee.id,
                      ...toBody(form, false),
                      employmentStatus,
                      terminationDate: employmentStatus === "terminated" ? (terminationDate ?? undefined) : undefined,
                    });
                    setEditMode(false);
                  } catch (err) {
                    setError(extractError(err, "خطا در ذخیره"));
                  }
                }}
              >
                {update.isPending ? "در حال ذخیره..." : "ذخیره تغییرات"}
              </PrimaryButton>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <ViewField title="کد ملی" value={employee.nationalId} />
            <ViewField title="تاریخ تولد" value={employee.birthDate ? formatJalali(employee.birthDate) : null} />
            <ViewField title="جنسیت" value={employee.gender ? GENDER_LABEL[employee.gender] : null} />
            <ViewField title="وضعیت تأهل" value={employee.maritalStatus ? MARITAL_STATUS_LABEL[employee.maritalStatus] : null} />
            <ViewField title="نظام‌وظیفه" value={employee.militaryServiceStatus ? MILITARY_SERVICE_LABEL[employee.militaryServiceStatus] : null} />
            <ViewField title="مدرک تحصیلی" value={employee.educationLevel} />
            <ViewField title="موبایل" value={employee.mobile} />
            <ViewField title="ایمیل" value={employee.email} />
            <ViewField title="حساب بانکی" value={employee.bankAccountNumber} />
            <ViewField title="بانک" value={employee.bankName} />
            <ViewField title="تماس اضطراری" value={employee.emergencyContactName} />
            <ViewField title="تلفن اضطراری" value={employee.emergencyContactPhone} />
            <ViewField title="بخش" value={employee.department?.departmentName} />
            <ViewField title="عنوان شغلی" value={employee.positionTitle} />
            <ViewField title="سرپرست مستقیم" value={employee.directManager?.fullName} />
            <ViewField title="شرکت گروه" value={employee.ourEntity?.entityName} />
            <ViewField title="تاریخ استخدام" value={employee.hireDate ? formatJalali(employee.hireDate) : null} />
            {employee.terminationDate && (
              <ViewField title="تاریخ پایان همکاری" value={formatJalali(employee.terminationDate)} />
            )}
            <div className="col-span-2 sm:col-span-3">
              <ViewField title="آدرس" value={employee.address} />
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-textPrimary">قراردادها ({employee.contracts.length})</h3>
          {canManage && !addingContract && (
            <GhostButton onClick={() => setAddingContract(true)}>
              <span className="flex items-center gap-1.5"><Plus size={13} /> قرارداد جدید</span>
            </GhostButton>
          )}
        </div>

        {addingContract && (
          <ContractForm
            initial={EMPTY_CONTRACT}
            busy={addContract.isPending}
            onCancel={() => setAddingContract(false)}
            onSubmit={async (body) => {
              try {
                setError(null);
                await addContract.mutateAsync({ employeeId: employee.id, ...body });
                setAddingContract(false);
              } catch (err) {
                setError(extractError(err, "خطا در ثبت قرارداد"));
              }
            }}
          />
        )}

        {employee.contracts.length === 0 && !addingContract && (
          <p className="text-xs text-textSecondary">هنوز قراردادی برای این پرسنل ثبت نشده.</p>
        )}

        <ul className="divide-y divide-border">
          {employee.contracts.map((contract) => (
            <ContractRow key={contract.id} contract={contract} />
          ))}
        </ul>
      </div>

      <EmployeeHrRecordsSection employeeId={employee.id} canManage={canManage} />
    </div>
  );
}

function NewEmployeeForm({ onDone }: { onDone: () => void }) {
  const { create } = useEmployeeMutations();
  const { data: colleagues } = useColleagues();
  const { data: existingEmployees } = useEmployees({});
  const [hasAccount, setHasAccount] = useState(false);
  const [form, setForm] = useState(toFormState());
  const [error, setError] = useState<string | null>(null);

  // فقط کاربرانی که هنوز به هیچ پرونده پرسنلی وصل نشدن قابل انتخابن
  const linkedUserIds = useMemo(
    () => new Set((existingEmployees ?? []).map((e) => e.userId).filter(Boolean)),
    [existingEmployees],
  );
  const eligibleColleagues = useMemo(
    () => (colleagues ?? []).filter((c) => !linkedUserIds.has(c.id)),
    [colleagues, linkedUserIds],
  );

  const canSubmit = hasAccount
    ? !!form.userId && form.fullName.trim()
    : form.employeeNumber.trim() && form.fullName.trim() && form.ourEntityId && form.hireDate;

  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-3">
      <h3 className="text-sm font-bold text-textPrimary">ثبت پرسنل جدید</h3>

      <div className="flex rounded-lg border border-border overflow-hidden w-fit">
        <button
          type="button"
          onClick={() => setHasAccount(false)}
          className={`px-4 py-2 text-xs transition-colors ${!hasAccount ? "bg-primary text-white" : "bg-surface text-textSecondary"}`}
        >
          حساب کاربری ندارد
        </button>
        <button
          type="button"
          onClick={() => setHasAccount(true)}
          className={`px-4 py-2 text-xs transition-colors ${hasAccount ? "bg-primary text-white" : "bg-surface text-textSecondary"}`}
        >
          حساب کاربری دارد
        </button>
      </div>

      {hasAccount && (
        <>
          <Field label="کاربر سامانه *">
            <Select
              value={form.userId}
              onChange={(e) => {
                const userId = e.target.value;
                const colleague = eligibleColleagues.find((c) => c.id === userId);
                setForm({ ...form, userId, fullName: colleague?.fullName ?? form.fullName });
              }}
            >
              <option value="">— انتخاب —</option>
              {eligibleColleagues.map((c) => (
                <option key={c.id} value={c.id}>{c.fullName}</option>
              ))}
            </Select>
          </Field>
          <p className="text-[11px] text-textSecondary">
            اطلاعات فردی (کد ملی، تاریخ تولد، تماس اضطراری و...) رو خودِ کارمند از صفحه پروفایلش
            تکمیل می‌کنه؛ تا وقتی شماره پرسنلی تخصیص داده نشه، این شخص فقط «کاربر سامانه»ست، نه
            کارمند رسمی شرکت.
          </p>
        </>
      )}

      <EmployeeFormFields form={form} onChange={setForm} isNew mode={hasAccount ? "adminOnly" : "full"} />
      <SimilarityWarning name={form.fullName} />
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2 justify-end">
        <GhostButton onClick={onDone}>انصراف</GhostButton>
        <PrimaryButton
          disabled={!canSubmit || create.isPending}
          onClick={async () => {
            try {
              setError(null);
              await create.mutateAsync(toBody(form, !hasAccount));
              onDone();
            } catch (err) {
              setError(extractError(err, "خطا در ثبت پرسنل"));
            }
          }}
        >
          {create.isPending ? "در حال ثبت..." : "ثبت پرسنل"}
        </PrimaryButton>
      </div>
    </div>
  );
}

export function EmployeesTab() {
  const { user } = useAuth();
  const canManage = hasPermission(user, "hr.manage");

  const [query, setQuery] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);

  const debouncedQuery = useDebounced(query);
  const { data: departments } = useDepartments();
  const { data: employees, isLoading, isError } = useEmployees({
    q: debouncedQuery,
    departmentId: departmentFilter,
    status: statusFilter,
  });

  const list = useMemo(() => employees ?? [], [employees]);

  if (selectedId) {
    return <EmployeeDetail employeeId={selectedId} onBack={() => setSelectedId(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        {canManage && !showNewForm && (
          <PrimaryButton onClick={() => setShowNewForm(true)}>
            <span className="flex items-center gap-1.5"><Plus size={14} /> پرسنل جدید</span>
          </PrimaryButton>
        )}
      </div>

      {showNewForm && <NewEmployeeForm onDone={() => setShowNewForm(false)} />}

      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-52">
          <Search size={15} className="absolute top-3 right-3 text-textSecondary" />
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجوی نام یا شماره پرسنلی..."
            className="pr-9"
          />
        </div>
        <Select value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} className="w-44">
          <option value="">همه بخش‌ها</option>
          {(departments ?? []).map((d) => (
            <option key={d.id} value={d.id}>{d.departmentName}</option>
          ))}
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-40">
          <option value="">همه وضعیت‌ها</option>
          {Object.entries(EMPLOYMENT_STATUS_META).map(([value, meta]) => (
            <option key={value} value={value}>{meta.label}</option>
          ))}
        </Select>
      </div>

      {isLoading && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}
      {isError && <p className="text-xs text-danger py-8 text-center">خطا در دریافت اطلاعات — اتصال به سرور رو بررسی کنید.</p>}

      {!isLoading && !isError && (
        <div className="rounded-xl bg-surface border border-border shadow-card divide-y divide-border">
          {list.length === 0 && <p className="text-xs text-textSecondary p-8 text-center">پرسنلی یافت نشد.</p>}
          {list.map((employee) => {
            const statusMeta = EMPLOYMENT_STATUS_META[employee.employmentStatus];
            return (
              <button
                key={employee.id}
                onClick={() => setSelectedId(employee.id)}
                className="w-full flex items-center gap-3 p-4 text-right hover:bg-bg transition-colors"
              >
                {employee.profilePhotoUrl ? (
                  <AuthImage fileUrl={employee.profilePhotoUrl} alt={employee.fullName} className="w-9 h-9 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-accentSoft text-accent flex items-center justify-center shrink-0">
                    <UserRound size={16} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-textPrimary truncate">{employee.fullName}</p>
                  <p className="text-[11px] text-textSecondary truncate">
                    {[employee.department?.departmentName, employee.positionTitle].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                {employee.employeeNumber ? (
                  <span className="text-[11px] text-textSecondary shrink-0" dir="ltr">{employee.employeeNumber}</span>
                ) : (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 bg-warningSoft text-warning">
                    در انتظار شماره
                  </span>
                )}
                {statusMeta && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusMeta.className}`}>
                    {statusMeta.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
