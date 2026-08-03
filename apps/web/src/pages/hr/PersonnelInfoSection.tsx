import { useEffect, useState } from "react";
import { AlertTriangle, Pencil } from "lucide-react";
import { DualDateInput } from "../../components/ui/DualDateInput";
import { ViewField } from "../../components/ui/ViewField";
import { Field, GhostButton, PrimaryButton, Select, TextInput } from "../../components/ui/fields";
import { formatJalali } from "../../lib/jalali";
import { useMyEmployee, useMyEmployeeMutations } from "./hr-requests-api";
import { GENDER_LABEL, MARITAL_STATUS_LABEL, MILITARY_SERVICE_LABEL } from "./hr-types";

function extractError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? fallback);
}

/**
 * فقط برای پرسنلی که پرونده‌شون در منابع انسانی از طریق «حساب کاربری دارد» ساخته شده —
 * اطلاعات فردی رو خودشون اینجا تکمیل می‌کنن؛ فیلدهای مدیریتی (بخش/سمت/شرکت گروه/تاریخ
 * استخدام/شماره پرسنلی) در اختیار منابع انسانی می‌مونه (نگاه کنید به EmployeesTab.tsx)
 */
export function PersonnelInfoSection() {
  const { data: employee, isLoading } = useMyEmployee();
  const { update } = useMyEmployeeMutations();
  const [editMode, setEditMode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    nationalId: "",
    birthDate: null as string | null,
    gender: "",
    mobile: "",
    email: "",
    address: "",
    maritalStatus: "",
    militaryServiceStatus: "",
    educationLevel: "",
    bankAccountNumber: "",
    bankName: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
  });

  useEffect(() => {
    if (employee) {
      setForm({
        nationalId: employee.nationalId ?? "",
        birthDate: employee.birthDate,
        gender: employee.gender ?? "",
        mobile: employee.mobile ?? "",
        email: employee.email ?? "",
        address: employee.address ?? "",
        maritalStatus: employee.maritalStatus ?? "",
        militaryServiceStatus: employee.militaryServiceStatus ?? "",
        educationLevel: employee.educationLevel ?? "",
        bankAccountNumber: employee.bankAccountNumber ?? "",
        bankName: employee.bankName ?? "",
        emergencyContactName: employee.emergencyContactName ?? "",
        emergencyContactPhone: employee.emergencyContactPhone ?? "",
      });
    }
  }, [employee]);

  if (isLoading || !employee) {
    return null;
  }

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    try {
      setError(null);
      const clean = (v: string) => (v.trim() === "" ? undefined : v.trim());
      await update.mutateAsync({
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
      });
      setEditMode(false);
    } catch (err) {
      setError(extractError(err, "خطا در ذخیره اطلاعات"));
    }
  };

  return (
    <div className="rounded-lg p-5 mb-5 bg-surface border border-border">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-textPrimary">اطلاعات پرسنلی</p>
        {!editMode && (
          <button
            onClick={() => setEditMode(true)}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-primary border border-primary"
          >
            <Pencil size={12} /> ویرایش
          </button>
        )}
      </div>

      {employee.employeeNumber ? (
        <p className="text-xs mb-4 text-textSecondary">
          شماره پرسنلی: <span dir="ltr" className="font-medium text-textPrimary">{employee.employeeNumber}</span>
        </p>
      ) : (
        <div className="rounded-lg p-3 mb-4 flex items-start gap-2.5 bg-warningSoft">
          <AlertTriangle size={15} className="shrink-0 mt-0.5 text-warning" />
          <p className="text-xs text-textPrimary leading-relaxed">
            هنوز به‌عنوان کارمند رسمی شرکت ثبت نشده‌اید. لطفاً اطلاعات زیر رو تکمیل کنید — پس از
            تکمیل، منابع انسانی شماره پرسنلی شما رو ثبت می‌کنه.
          </p>
        </div>
      )}

      {!editMode ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ViewField title="کد ملی" value={employee.nationalId} />
          <ViewField title="تاریخ تولد" value={employee.birthDate ? formatJalali(employee.birthDate) : null} />
          <ViewField title="جنسیت" value={employee.gender ? GENDER_LABEL[employee.gender] : null} />
          <ViewField title="موبایل" value={employee.mobile} />
          <ViewField title="ایمیل" value={employee.email} />
          <ViewField title="وضعیت تأهل" value={employee.maritalStatus ? MARITAL_STATUS_LABEL[employee.maritalStatus] : null} />
          <ViewField
            title="وضعیت خدمت نظام‌وظیفه"
            value={employee.militaryServiceStatus ? MILITARY_SERVICE_LABEL[employee.militaryServiceStatus] : null}
          />
          <ViewField title="مدرک تحصیلی" value={employee.educationLevel} />
          <ViewField title="شماره حساب/شبا بانکی" value={employee.bankAccountNumber} />
          <ViewField title="نام بانک" value={employee.bankName} />
          <ViewField title="نام تماس اضطراری" value={employee.emergencyContactName} />
          <ViewField title="تلفن تماس اضطراری" value={employee.emergencyContactPhone} />
          <div className="sm:col-span-2">
            <ViewField title="آدرس" value={employee.address} />
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
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
            <Field label="موبایل">
              <TextInput value={form.mobile} onChange={(e) => set("mobile", e.target.value)} dir="ltr" />
            </Field>
            <Field label="ایمیل">
              <TextInput value={form.email} onChange={(e) => set("email", e.target.value)} dir="ltr" />
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
            <div className="sm:col-span-2">
              <Field label="آدرس">
                <TextInput value={form.address} onChange={(e) => set("address", e.target.value)} />
              </Field>
            </div>
          </div>
          {error && <p className="text-xs text-danger mb-3">{error}</p>}
          <div className="flex gap-2 justify-end">
            <GhostButton onClick={() => setEditMode(false)}>انصراف</GhostButton>
            <PrimaryButton onClick={save} disabled={update.isPending}>
              {update.isPending ? "در حال ذخیره..." : "ذخیره"}
            </PrimaryButton>
          </div>
        </>
      )}
    </div>
  );
}
