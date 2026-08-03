import { useState } from "react";
import { Pencil, Plus } from "lucide-react";
import { Field, GhostButton, PrimaryButton, TextInput } from "../../components/ui/fields";
import { useAuth } from "../../lib/auth-context";
import { hasPermission } from "../../lib/permissions";
import { useLeaveTypeMutations, useLeaveTypes } from "./hr-requests-api";
import { LeaveType } from "./hr-requests-types";

function extractError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? fallback);
}

interface FormState {
  typeName: string;
  isPaid: boolean;
  annualEntitlementDays: string;
}

function toFormState(type?: LeaveType): FormState {
  return {
    typeName: type?.typeName ?? "",
    isPaid: type?.isPaid ?? true,
    annualEntitlementDays: type?.annualEntitlementDays ?? "",
  };
}

function LeaveTypeForm({
  initial,
  busy,
  onSubmit,
  onCancel,
}: {
  initial: FormState;
  busy: boolean;
  onSubmit: (form: FormState) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState(initial);
  return (
    <div className="rounded-lg border border-border p-3 space-y-3 bg-bg">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Field label="نام نوع مرخصی *">
          <TextInput value={form.typeName} onChange={(e) => setForm({ ...form, typeName: e.target.value })} />
        </Field>
        <Field label="سقف پیش‌فرض سالانه (روز)">
          <TextInput
            value={form.annualEntitlementDays}
            onChange={(e) => setForm({ ...form, annualEntitlementDays: e.target.value })}
            dir="ltr"
            inputMode="decimal"
          />
        </Field>
        <div className="flex items-end pb-2.5">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer text-textPrimary">
            <input
              type="checkbox"
              className="w-3.5 h-3.5"
              checked={form.isPaid}
              onChange={(e) => setForm({ ...form, isPaid: e.target.checked })}
            />
            با حقوق
          </label>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <GhostButton onClick={onCancel}>انصراف</GhostButton>
        <PrimaryButton disabled={!form.typeName.trim() || busy} onClick={() => onSubmit(form)}>
          ذخیره
        </PrimaryButton>
      </div>
    </div>
  );
}

export function LeaveTypesTab() {
  const { user } = useAuth();
  const canManage = hasPermission(user, "hr.manage");
  const { data: leaveTypes, isLoading } = useLeaveTypes();
  const { create, update } = useLeaveTypeMutations();

  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        {canManage && !showNewForm && (
          <PrimaryButton onClick={() => setShowNewForm(true)}>
            <span className="flex items-center gap-1.5"><Plus size={14} /> نوع مرخصی جدید</span>
          </PrimaryButton>
        )}
      </div>

      {showNewForm && (
        <LeaveTypeForm
          initial={toFormState()}
          busy={create.isPending}
          onCancel={() => setShowNewForm(false)}
          onSubmit={async (form) => {
            try {
              setError(null);
              await create.mutateAsync({
                typeName: form.typeName.trim(),
                isPaid: form.isPaid,
                annualEntitlementDays: form.annualEntitlementDays ? Number(form.annualEntitlementDays) : undefined,
              });
              setShowNewForm(false);
            } catch (err) {
              setError(extractError(err, "خطا در ثبت نوع مرخصی"));
            }
          }}
        />
      )}
      {error && <p className="text-xs text-danger">{error}</p>}

      {isLoading && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}

      <div className="rounded-xl bg-surface border border-border shadow-card divide-y divide-border">
        {leaveTypes && leaveTypes.length === 0 && (
          <p className="text-xs text-textSecondary p-8 text-center">هنوز نوع مرخصی‌ای ثبت نشده.</p>
        )}
        {(leaveTypes ?? []).map((type) =>
          editingId === type.id ? (
            <div key={type.id} className="p-4">
              <LeaveTypeForm
                initial={toFormState(type)}
                busy={update.isPending}
                onCancel={() => setEditingId(null)}
                onSubmit={async (form) => {
                  try {
                    setError(null);
                    await update.mutateAsync({
                      id: type.id,
                      typeName: form.typeName.trim(),
                      isPaid: form.isPaid,
                      annualEntitlementDays: form.annualEntitlementDays ? Number(form.annualEntitlementDays) : undefined,
                    });
                    setEditingId(null);
                  } catch (err) {
                    setError(extractError(err, "خطا در ذخیره"));
                  }
                }}
              />
            </div>
          ) : (
            <div key={type.id} className="flex items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-textPrimary">{type.typeName}</p>
                <p className="text-[11px] text-textSecondary">
                  {type.isPaid ? "با حقوق" : "بدون حقوق"}
                  {type.annualEntitlementDays ? ` · سقف پیش‌فرض ${type.annualEntitlementDays} روز` : ""}
                </p>
              </div>
              {canManage && (
                <button onClick={() => setEditingId(type.id)} className="text-textSecondary" aria-label="ویرایش">
                  <Pencil size={14} />
                </button>
              )}
            </div>
          ),
        )}
      </div>
    </div>
  );
}
