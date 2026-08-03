import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Field, GhostButton, PrimaryButton, TextInput } from "../../components/ui/fields";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { useAuth } from "../../lib/auth-context";
import { hasPermission } from "../../lib/permissions";
import { useBenefitTypeMutations, useBenefitTypes } from "./hr-requests-api";
import { BenefitType } from "./hr-requests-types";

function extractError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? fallback);
}

interface FormState {
  benefitName: string;
  isRecurringDefault: boolean;
}

function toFormState(type?: BenefitType): FormState {
  return {
    benefitName: type?.benefitName ?? "",
    isRecurringDefault: type?.isRecurringDefault ?? true,
  };
}

function BenefitTypeForm({
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
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="نام نوع مزایا *">
          <TextInput value={form.benefitName} onChange={(e) => setForm({ ...form, benefitName: e.target.value })} />
        </Field>
        <div className="flex items-end pb-2.5">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer text-textPrimary">
            <input
              type="checkbox"
              className="w-3.5 h-3.5"
              checked={form.isRecurringDefault}
              onChange={(e) => setForm({ ...form, isRecurringDefault: e.target.checked })}
            />
            پیش‌فرض تکرارشونده
          </label>
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <GhostButton onClick={onCancel}>انصراف</GhostButton>
        <PrimaryButton disabled={!form.benefitName.trim() || busy} onClick={() => onSubmit(form)}>
          ذخیره
        </PrimaryButton>
      </div>
    </div>
  );
}

export function BenefitTypesTab() {
  const { user } = useAuth();
  const canManage = hasPermission(user, "hr.manage");
  const { data: benefitTypes, isLoading } = useBenefitTypes();
  const { create, update, remove } = useBenefitTypeMutations();

  const [showNewForm, setShowNewForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingType, setDeletingType] = useState<BenefitType | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        {canManage && !showNewForm && (
          <PrimaryButton onClick={() => setShowNewForm(true)}>
            <span className="flex items-center gap-1.5"><Plus size={14} /> نوع مزایا جدید</span>
          </PrimaryButton>
        )}
      </div>

      {showNewForm && (
        <BenefitTypeForm
          initial={toFormState()}
          busy={create.isPending}
          onCancel={() => setShowNewForm(false)}
          onSubmit={async (form) => {
            try {
              setError(null);
              await create.mutateAsync({ benefitName: form.benefitName.trim(), isRecurringDefault: form.isRecurringDefault });
              setShowNewForm(false);
            } catch (err) {
              setError(extractError(err, "خطا در ثبت نوع مزایا"));
            }
          }}
        />
      )}
      {error && <p className="text-xs text-danger">{error}</p>}

      {isLoading && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}

      <div className="rounded-xl bg-surface border border-border shadow-card divide-y divide-border">
        {benefitTypes && benefitTypes.length === 0 && (
          <p className="text-xs text-textSecondary p-8 text-center">هنوز نوع مزایایی ثبت نشده.</p>
        )}
        {(benefitTypes ?? []).map((type) =>
          editingId === type.id ? (
            <div key={type.id} className="p-4">
              <BenefitTypeForm
                initial={toFormState(type)}
                busy={update.isPending}
                onCancel={() => setEditingId(null)}
                onSubmit={async (form) => {
                  try {
                    setError(null);
                    await update.mutateAsync({
                      id: type.id,
                      benefitName: form.benefitName.trim(),
                      isRecurringDefault: form.isRecurringDefault,
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
                <p className="text-sm font-medium text-textPrimary">{type.benefitName}</p>
                <p className="text-[11px] text-textSecondary">{type.isRecurringDefault ? "پیش‌فرض تکرارشونده" : "پیش‌فرض یک‌باره"}</p>
              </div>
              {canManage && (
                <>
                  <button onClick={() => setEditingId(type.id)} className="text-textSecondary" aria-label="ویرایش">
                    <Pencil size={14} />
                  </button>
                  <button onClick={() => setDeletingType(type)} className="text-danger" aria-label="حذف">
                    <Trash2 size={14} />
                  </button>
                </>
              )}
            </div>
          ),
        )}
      </div>

      {deletingType && (
        <ConfirmModal
          title={`حذف نوع مزایای «${deletingType.benefitName}»`}
          description="اگه این نوع مزایا برای پرسنلی ثبت شده باشه، حذف امکان‌پذیر نیست."
          busy={remove.isPending}
          onCancel={() => setDeletingType(null)}
          onConfirm={async () => {
            try {
              await remove.mutateAsync(deletingType.id);
              setDeletingType(null);
            } catch (err) {
              setDeletingType(null);
              setError(extractError(err, "خطا در حذف نوع مزایا"));
            }
          }}
        />
      )}
    </div>
  );
}
