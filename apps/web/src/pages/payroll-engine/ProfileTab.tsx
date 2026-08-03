import { useEffect, useState } from "react";
import { Field, PrimaryButton, Select, TextInput } from "../../components/ui/fields";
import { useDepartments, useEmployees } from "../hr/hr-api";
import { usePayrollProfile, usePayrollYears, useRuleVersions, useUpsertPayrollProfile } from "./payroll-engine-api";

function extractError(err: unknown) {
  const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? "خطا در ذخیره");
}

export function ProfileTab() {
  const { data: employees } = useEmployees({});
  const { data: departments } = useDepartments();
  const [employeeId, setEmployeeId] = useState("");
  const { data: profile } = usePayrollProfile(employeeId || null);
  const upsert = useUpsertPayrollProfile();

  const [seniorityBaseDate, setSeniorityBaseDate] = useState("");
  const [insuranceNumber, setInsuranceNumber] = useState("");
  const [costCenterDeptId, setCostCenterDeptId] = useState("");
  const [defaultYearId, setDefaultYearId] = useState("");
  const [defaultRuleVersionId, setDefaultRuleVersionId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const { data: years } = usePayrollYears();
  const { data: versions } = useRuleVersions(defaultYearId || null);

  useEffect(() => {
    setSeniorityBaseDate(profile?.seniorityBaseDate?.slice(0, 10) ?? "");
    setInsuranceNumber(profile?.insuranceNumber ?? "");
    setCostCenterDeptId(profile?.costCenterDeptId ?? "");
    setDefaultRuleVersionId(profile?.defaultRuleVersionId ?? "");
    setSaved(false);
  }, [profile, employeeId]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface border border-border shadow-card p-4 space-y-3">
        <Field label="پرسنل">
          <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            <option value="">انتخاب کنید...</option>
            {(employees ?? []).map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.fullName} ({emp.employeeNumber})
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {employeeId && (
        <div className="rounded-xl bg-surface border border-border shadow-card p-4 space-y-3">
          <h3 className="text-sm font-bold text-textPrimary">پروفایل حقوقی</h3>
          {profile === null && (
            <p className="text-xs text-textSecondary">هنوز پروفایلی برای این پرسنل تعریف نشده — با ثبت زیر ساخته می‌شود.</p>
          )}

          <p className="text-[11px] text-textSecondary">
            تعداد فرزندان دیگر اینجا دستی وارد نمی‌شود — از تاریخ تولد ثبت‌شده در «منابع انسانی ←
            پرسنل ← فرزندان» و سقف سنی قانون فعال به‌صورت خودکار محاسبه می‌شود.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="تاریخ مبنای سنوات (خالی = تاریخ استخدام)">
              <TextInput
                type="date"
                value={seniorityBaseDate}
                onChange={(e) => setSeniorityBaseDate(e.target.value)}
                dir="ltr"
              />
            </Field>
            <Field label="شماره بیمه">
              <TextInput value={insuranceNumber} onChange={(e) => setInsuranceNumber(e.target.value)} dir="ltr" />
            </Field>
            <Field label="مرکز هزینه (بخش)">
              <Select value={costCenterDeptId} onChange={(e) => setCostCenterDeptId(e.target.value)}>
                <option value="">—</option>
                {(departments ?? []).map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.departmentName}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="سال قانون پیش‌فرض">
              <Select value={defaultYearId} onChange={(e) => { setDefaultYearId(e.target.value); setDefaultRuleVersionId(""); }}>
                <option value="">—</option>
                {(years ?? []).map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.yearNumber}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="نسخه‌ی قانون پیش‌فرض">
              <Select value={defaultRuleVersionId} onChange={(e) => setDefaultRuleVersionId(e.target.value)}>
                <option value="">—</option>
                {(versions ?? []).map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.title}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}
          {saved && <p className="text-xs text-success">ذخیره شد.</p>}
          <PrimaryButton
            disabled={upsert.isPending}
            onClick={async () => {
              try {
                setError(null);
                setSaved(false);
                await upsert.mutateAsync({
                  employeeId,
                  seniorityBaseDate: seniorityBaseDate || undefined,
                  insuranceNumber: insuranceNumber || undefined,
                  costCenterDeptId: costCenterDeptId || undefined,
                  defaultRuleVersionId: defaultRuleVersionId || undefined,
                });
                setSaved(true);
              } catch (err) {
                setError(extractError(err));
              }
            }}
          >
            ذخیره پروفایل
          </PrimaryButton>
        </div>
      )}
    </div>
  );
}
