import { useMemo, useState } from "react";
import { Field, GhostButton, PrimaryButton, Select, TextInput } from "../../components/ui/fields";
import {
  useComponentMutations,
  useCreatePayrollYear,
  usePayrollComponents,
  usePayrollYears,
  usePreviewFormula,
  useRuleVersion,
  useRuleVersionMutations,
  useRuleVersions,
} from "./payroll-engine-api";
import { PayrollComponent, PayrollFormula, PayrollRule, PayrollTaxBracket } from "./payroll-engine-types";

function extractError(err: unknown) {
  const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? "خطا در ذخیره");
}

const STATUS_LABEL: Record<string, string> = { draft: "پیش‌نویس", active: "فعال", superseded: "جایگزین‌شده" };

function YearsBlock({ selectedYearId, onSelect }: { selectedYearId: string | null; onSelect: (id: string) => void }) {
  const { data: years, isLoading } = usePayrollYears();
  const createYear = useCreatePayrollYear();
  const [showForm, setShowForm] = useState(false);
  const [yearNumber, setYearNumber] = useState("");
  const [calendarType, setCalendarType] = useState<"jalali" | "gregorian">("jalali");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-textPrimary">سال حقوقی</h3>
        <GhostButton onClick={() => setShowForm((v) => !v)}>{showForm ? "انصراف" : "+ سال جدید"}</GhostButton>
      </div>

      {showForm && (
        <div className="flex items-end gap-2 flex-wrap">
          <Field label="سال (شمسی/میلادی)">
            <TextInput
              value={yearNumber}
              onChange={(e) => setYearNumber(e.target.value)}
              dir="ltr"
              className="w-28"
            />
          </Field>
          <Field label="تقویم">
            <Select value={calendarType} onChange={(e) => setCalendarType(e.target.value as typeof calendarType)}>
              <option value="jalali">شمسی</option>
              <option value="gregorian">میلادی</option>
            </Select>
          </Field>
          <PrimaryButton
            disabled={!yearNumber || createYear.isPending}
            onClick={async () => {
              try {
                setError(null);
                const created = await createYear.mutateAsync({ yearNumber: Number(yearNumber), calendarType });
                setShowForm(false);
                setYearNumber("");
                onSelect(created.id);
              } catch (err) {
                setError(extractError(err));
              }
            }}
          >
            ثبت
          </PrimaryButton>
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}

      {isLoading && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}
      <div className="flex flex-wrap gap-2">
        {(years ?? []).map((y) => (
          <button
            key={y.id}
            onClick={() => onSelect(y.id)}
            className={`text-xs px-3 py-1.5 rounded-lg border ${
              selectedYearId === y.id ? "bg-primary text-white border-primary" : "border-border text-textSecondary"
            }`}
          >
            {y.yearNumber} ({y.calendarType === "jalali" ? "شمسی" : "میلادی"})
          </button>
        ))}
        {(years ?? []).length === 0 && !isLoading && <p className="text-xs text-textSecondary">هنوز سالی ثبت نشده.</p>}
      </div>
    </div>
  );
}

function VersionsBlock({
  payrollYearId,
  selectedVersionId,
  onSelect,
}: {
  payrollYearId: string;
  selectedVersionId: string | null;
  onSelect: (id: string) => void;
}) {
  const { data: versions, isLoading } = useRuleVersions(payrollYearId);
  const { create } = useRuleVersionMutations();
  const [showForm, setShowForm] = useState(false);
  const [versionNumber, setVersionNumber] = useState("1");
  const [title, setTitle] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-textPrimary">نسخه‌ی قانون</h3>
        <GhostButton onClick={() => setShowForm((v) => !v)}>{showForm ? "انصراف" : "+ نسخه جدید"}</GhostButton>
      </div>

      {showForm && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-end">
          <Field label="شماره نسخه">
            <TextInput value={versionNumber} onChange={(e) => setVersionNumber(e.target.value)} dir="ltr" />
          </Field>
          <Field label="عنوان">
            <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثلاً نسخه ۱" />
          </Field>
          <Field label="تاریخ اجرا">
            <TextInput type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} dir="ltr" />
          </Field>
          <div className="sm:col-span-3">
            <PrimaryButton
              disabled={!title.trim() || !effectiveFrom || create.isPending}
              onClick={async () => {
                try {
                  setError(null);
                  const created = await create.mutateAsync({
                    payrollYearId,
                    versionNumber: Number(versionNumber),
                    title: title.trim(),
                    effectiveFrom,
                  });
                  setShowForm(false);
                  setTitle("");
                  onSelect(created.id);
                } catch (err) {
                  setError(extractError(err));
                }
              }}
            >
              ثبت نسخه
            </PrimaryButton>
          </div>
        </div>
      )}
      {error && <p className="text-xs text-danger">{error}</p>}

      {isLoading && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}
      <div className="flex flex-wrap gap-2">
        {(versions ?? []).map((v) => (
          <button
            key={v.id}
            onClick={() => onSelect(v.id)}
            className={`text-xs px-3 py-1.5 rounded-lg border ${
              selectedVersionId === v.id ? "bg-primary text-white border-primary" : "border-border text-textSecondary"
            }`}
          >
            {v.title} · {STATUS_LABEL[v.status]}
          </button>
        ))}
        {(versions ?? []).length === 0 && !isLoading && (
          <p className="text-xs text-textSecondary">هنوز نسخه‌ای برای این سال ثبت نشده.</p>
        )}
      </div>
    </div>
  );
}

function RulesEditor({ ruleVersionId, rules }: { ruleVersionId: string; rules: PayrollRule[] }) {
  const { upsertRule } = useRuleVersionMutations();
  const [code, setCode] = useState("");
  const [ruleTitle, setRuleTitle] = useState("");
  const [valueType, setValueType] = useState<"number" | "percent" | "boolean">("percent");
  const [value, setValue] = useState("");
  const [effectiveDate, setEffectiveDate] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border divide-y divide-border">
        {rules.length === 0 && <p className="text-xs text-textSecondary p-3">قانونی ثبت نشده.</p>}
        {rules.map((r) => (
          <div key={r.id} className="flex items-center justify-between p-2.5 text-xs">
            <span className="font-mono text-textPrimary">{r.code}</span>
            <span className="text-textSecondary">{r.title}</span>
            <span className="font-mono text-textPrimary" dir="ltr">
              {r.value} {r.valueType === "percent" ? "٪" : ""}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 items-end">
        <Field label="کد">
          <TextInput value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} dir="ltr" placeholder="TAX_EXEMPTION" />
        </Field>
        <Field label="عنوان">
          <TextInput value={ruleTitle} onChange={(e) => setRuleTitle(e.target.value)} />
        </Field>
        <Field label="نوع">
          <Select value={valueType} onChange={(e) => setValueType(e.target.value as typeof valueType)}>
            <option value="percent">درصد</option>
            <option value="number">عدد</option>
            <option value="boolean">بولی</option>
          </Select>
        </Field>
        <Field label="مقدار">
          <TextInput value={value} onChange={(e) => setValue(e.target.value)} dir="ltr" />
        </Field>
        <Field label="تاریخ اجرا">
          <TextInput type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} dir="ltr" />
        </Field>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <PrimaryButton
        disabled={!code.trim() || !ruleTitle.trim() || !value || !effectiveDate || upsertRule.isPending}
        onClick={async () => {
          try {
            setError(null);
            await upsertRule.mutateAsync({
              ruleVersionId,
              code: code.trim(),
              title: ruleTitle.trim(),
              valueType,
              value: Number(value),
              effectiveDate,
              expireDate: null,
              description: null,
            });
            setCode("");
            setRuleTitle("");
            setValue("");
          } catch (err) {
            setError(extractError(err));
          }
        }}
      >
        ثبت/به‌روزرسانی قانون
      </PrimaryButton>
    </div>
  );
}

function BracketsEditor({ ruleVersionId, brackets }: { ruleVersionId: string; brackets: PayrollTaxBracket[] }) {
  const { replaceBrackets } = useRuleVersionMutations();
  const [rows, setRows] = useState(
    () =>
      brackets.map((b) => ({
        bracketOrder: b.bracketOrder,
        fromAmount: b.fromAmount,
        toAmount: b.toAmount ?? "",
        ratePercent: b.ratePercent,
      })),
  );
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-2">
      {rows.map((row, idx) => (
        <div key={idx} className="grid grid-cols-4 gap-2 items-end">
          <Field label="پله">
            <TextInput
              value={row.bracketOrder}
              onChange={(e) => setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, bracketOrder: Number(e.target.value) } : r)))}
              dir="ltr"
            />
          </Field>
          <Field label="از مبلغ">
            <TextInput
              value={row.fromAmount}
              onChange={(e) => setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, fromAmount: e.target.value } : r)))}
              dir="ltr"
            />
          </Field>
          <Field label="تا مبلغ (خالی = بی‌سقف)">
            <TextInput
              value={row.toAmount}
              onChange={(e) => setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, toAmount: e.target.value } : r)))}
              dir="ltr"
            />
          </Field>
          <div className="flex items-end gap-2">
            <Field label="نرخ ٪">
              <TextInput
                value={row.ratePercent}
                onChange={(e) => setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ratePercent: e.target.value } : r)))}
                dir="ltr"
              />
            </Field>
            <GhostButton onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}>حذف</GhostButton>
          </div>
        </div>
      ))}
      <GhostButton
        onClick={() =>
          setRows((prev) => [...prev, { bracketOrder: prev.length + 1, fromAmount: "0", toAmount: "", ratePercent: "0" }])
        }
      >
        + پله جدید
      </GhostButton>
      {error && <p className="text-xs text-danger">{error}</p>}
      <div>
        <PrimaryButton
          disabled={replaceBrackets.isPending}
          onClick={async () => {
            try {
              setError(null);
              await replaceBrackets.mutateAsync({
                ruleVersionId,
                brackets: rows.map((r) => ({
                  bracketOrder: r.bracketOrder,
                  fromAmount: Number(r.fromAmount),
                  toAmount: r.toAmount === "" ? null : Number(r.toAmount),
                  ratePercent: Number(r.ratePercent),
                })),
              });
            } catch (err) {
              setError(extractError(err));
            }
          }}
        >
          ذخیره پله‌های مالیات
        </PrimaryButton>
      </div>
    </div>
  );
}

function FormulasEditor({ ruleVersionId, formulas }: { ruleVersionId: string; formulas: PayrollFormula[] }) {
  const { upsertFormula } = useRuleVersionMutations();
  const previewFormula = usePreviewFormula();
  const [code, setCode] = useState("");
  const [expression, setExpression] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-border divide-y divide-border">
        {formulas.length === 0 && <p className="text-xs text-textSecondary p-3">فرمولی ثبت نشده.</p>}
        {formulas.map((f) => (
          <div key={f.id} className="flex items-center justify-between p-2.5 text-xs gap-2">
            <span className="font-mono text-textPrimary shrink-0">{f.code}</span>
            <span className="font-mono text-textSecondary truncate" dir="ltr">
              {f.expression}
            </span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Field label="کد فرمول">
          <TextInput value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} dir="ltr" placeholder="HOUSE" />
        </Field>
        <Field label="عبارت">
          <TextInput
            value={expression}
            onChange={(e) => {
              setExpression(e.target.value);
              setPreviewResult(null);
            }}
            dir="ltr"
            placeholder="PERCENT(BASE, HOUSE_RATE)"
          />
        </Field>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {previewResult && <p className="text-xs text-success">{previewResult}</p>}
      <div className="flex gap-2">
        <GhostButton
          disabled={!expression.trim() || previewFormula.isPending}
          onClick={async () => {
            try {
              setError(null);
              await previewFormula.mutateAsync(expression);
              setPreviewResult("عبارت از نظر گرامری معتبر است.");
            } catch (err) {
              setPreviewResult(null);
              setError(extractError(err));
            }
          }}
        >
          بررسی نحو فرمول
        </GhostButton>
        <PrimaryButton
          disabled={!code.trim() || !expression.trim() || upsertFormula.isPending}
          onClick={async () => {
            try {
              setError(null);
              await upsertFormula.mutateAsync({ ruleVersionId, code: code.trim(), expression: expression.trim(), description: null });
              setCode("");
              setExpression("");
              setPreviewResult(null);
            } catch (err) {
              setError(extractError(err));
            }
          }}
        >
          ثبت/به‌روزرسانی فرمول
        </PrimaryButton>
      </div>
    </div>
  );
}

function VersionDetailBlock({ versionId }: { versionId: string }) {
  const { data: version, isLoading } = useRuleVersion(versionId);
  const { updateStatus } = useRuleVersionMutations();

  if (isLoading || !version) return <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>;

  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-4 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-textPrimary">{version.title}</h3>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-textSecondary">وضعیت: {STATUS_LABEL[version.status]}</span>
          <Select
            value=""
            onChange={async (e) => {
              if (!e.target.value) return;
              await updateStatus.mutateAsync({ id: versionId, status: e.target.value });
            }}
            className="w-auto text-xs"
          >
            <option value="">تغییر وضعیت...</option>
            <option value="draft">پیش‌نویس</option>
            <option value="active">فعال</option>
            <option value="superseded">جایگزین‌شده</option>
          </Select>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-bold text-textPrimary mb-2">قوانین (نرخ‌ها/سقف‌ها/معافیت‌ها)</h4>
        <RulesEditor ruleVersionId={versionId} rules={version.rules ?? []} />
      </div>

      <div>
        <h4 className="text-xs font-bold text-textPrimary mb-2">پله‌های مالیات پلکانی</h4>
        <BracketsEditor ruleVersionId={versionId} brackets={version.brackets ?? []} />
      </div>

      <div>
        <h4 className="text-xs font-bold text-textPrimary mb-2">فرمول‌ها</h4>
        <FormulasEditor ruleVersionId={versionId} formulas={version.formulas ?? []} />
      </div>
    </div>
  );
}

function ComponentsBlock({ availableFormulas }: { availableFormulas: PayrollFormula[] }) {
  const { data: components, isLoading } = usePayrollComponents();
  const { create, update } = useComponentMutations();
  const [showForm, setShowForm] = useState(false);
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [componentType, setComponentType] = useState<"earning" | "deduction">("earning");
  const [isInsurable, setIsInsurable] = useState(false);
  const [isTaxable, setIsTaxable] = useState(false);
  const [formulaId, setFormulaId] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-textPrimary">اجزای حقوق (Component)</h3>
        <GhostButton onClick={() => setShowForm((v) => !v)}>{showForm ? "انصراف" : "+ جزء جدید"}</GhostButton>
      </div>

      {showForm && (
        <div className="space-y-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <Field label="کد">
              <TextInput value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} dir="ltr" placeholder="HOUSE" />
            </Field>
            <Field label="عنوان">
              <TextInput value={title} onChange={(e) => setTitle(e.target.value)} placeholder="حق مسکن" />
            </Field>
            <Field label="نوع">
              <Select value={componentType} onChange={(e) => setComponentType(e.target.value as typeof componentType)}>
                <option value="earning">مزایا (Earning)</option>
                <option value="deduction">کسورات (Deduction)</option>
              </Select>
            </Field>
            <Field label="فرمول (از نسخه‌ی انتخاب‌شده)">
              <Select value={formulaId} onChange={(e) => setFormulaId(e.target.value)}>
                <option value="">بدون فرمول (صفر)</option>
                {availableFormulas.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.code}
                  </option>
                ))}
              </Select>
            </Field>
          </div>
          <div className="flex items-center gap-4 text-xs text-textPrimary">
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={isInsurable} onChange={(e) => setIsInsurable(e.target.checked)} />
              مشمول بیمه
            </label>
            <label className="flex items-center gap-1.5">
              <input type="checkbox" checked={isTaxable} onChange={(e) => setIsTaxable(e.target.checked)} />
              مشمول مالیات
            </label>
          </div>
          {error && <p className="text-xs text-danger">{error}</p>}
          <PrimaryButton
            disabled={!code.trim() || !title.trim() || create.isPending}
            onClick={async () => {
              try {
                setError(null);
                await create.mutateAsync({
                  code: code.trim(),
                  title: title.trim(),
                  componentType,
                  isInsurable,
                  isTaxable,
                  formulaId: formulaId || undefined,
                });
                setShowForm(false);
                setCode("");
                setTitle("");
                setFormulaId("");
              } catch (err) {
                setError(extractError(err));
              }
            }}
          >
            ثبت جزء
          </PrimaryButton>
        </div>
      )}

      {isLoading && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}
      <div className="rounded-lg border border-border divide-y divide-border">
        {(components ?? []).length === 0 && !isLoading && (
          <p className="text-xs text-textSecondary p-3">هنوز جزئی ثبت نشده.</p>
        )}
        {(components ?? []).map((c: PayrollComponent) => (
          <div key={c.id} className="flex items-center justify-between p-2.5 text-xs gap-2">
            <span className="font-mono text-textPrimary shrink-0">{c.code}</span>
            <span className="text-textSecondary flex-1">{c.title}</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-accentSoft text-accent shrink-0">
              {c.componentType === "earning" ? "مزایا" : "کسورات"}
            </span>
            {c.status === "inactive" && (
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-border text-textSecondary shrink-0">غیرفعال</span>
            )}
            <GhostButton
              onClick={() => update.mutate({ id: c.id, status: c.status === "active" ? "inactive" : "active" })}
            >
              {c.status === "active" ? "غیرفعال کردن" : "فعال کردن"}
            </GhostButton>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ConfigTab() {
  const [selectedYearId, setSelectedYearId] = useState<string | null>(null);
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null);
  const { data: version } = useRuleVersion(selectedVersionId);
  const availableFormulas = useMemo(() => version?.formulas ?? [], [version]);

  return (
    <div className="space-y-4">
      <YearsBlock
        selectedYearId={selectedYearId}
        onSelect={(id) => {
          setSelectedYearId(id);
          setSelectedVersionId(null);
        }}
      />

      {selectedYearId && (
        <VersionsBlock payrollYearId={selectedYearId} selectedVersionId={selectedVersionId} onSelect={setSelectedVersionId} />
      )}

      {selectedVersionId && <VersionDetailBlock versionId={selectedVersionId} />}

      <ComponentsBlock availableFormulas={availableFormulas} />
    </div>
  );
}
