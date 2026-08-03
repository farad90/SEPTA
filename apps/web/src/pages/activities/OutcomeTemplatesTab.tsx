import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Field, GhostButton, PrimaryButton, Select, TextInput } from "../../components/ui/fields";
import { ACTIVITY_TYPE_LABELS } from "./activities-api";
import { useOutcomeTemplateMutations, useOutcomeTemplates } from "./outcome-templates-api";

export function OutcomeTemplatesTab() {
  const { data: templates = [], isLoading } = useOutcomeTemplates();
  const { create, remove } = useOutcomeTemplateMutations();

  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    activityType: "call",
    label: "",
    requiresFollowUp: false,
    followUpActivityType: "",
    followUpOffsetMinutes: "60",
  });

  const grouped = Object.entries(ACTIVITY_TYPE_LABELS).map(([type, typeLabel]) => ({
    type,
    typeLabel,
    items: templates.filter((t) => t.activityType === type),
  }));

  const submit = () => {
    if (!form.label.trim()) return;
    create.mutate(
      {
        activityType: form.activityType,
        label: form.label.trim(),
        requiresFollowUp: form.requiresFollowUp,
        followUpActivityType: form.requiresFollowUp ? form.followUpActivityType || undefined : undefined,
        followUpOffsetMinutes: form.requiresFollowUp ? Number(form.followUpOffsetMinutes) : undefined,
      },
      {
        onSuccess: () => {
          setForm({ activityType: "call", label: "", requiresFollowUp: false, followUpActivityType: "", followUpOffsetMinutes: "60" });
          setCreating(false);
        },
      },
    );
  };

  if (isLoading) {
    return <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {!creating && (
          <PrimaryButton onClick={() => setCreating(true)}>
            <span className="flex items-center gap-1.5">
              <Plus size={14} /> قالب نتیجهٔ سفارشی جدید
            </span>
          </PrimaryButton>
        )}
      </div>

      {creating && (
        <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="نوع فعالیت *">
              <Select
                value={form.activityType}
                onChange={(e) => setForm((f) => ({ ...f, activityType: e.target.value }))}
              >
                {Object.entries(ACTIVITY_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="عنوان نتیجه *">
              <TextInput
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="مثلاً منتظر پاسخ فنی"
              />
            </Field>
          </div>
          <label className="flex items-center gap-2 text-xs text-textPrimary">
            <input
              type="checkbox"
              checked={form.requiresFollowUp}
              onChange={(e) => setForm((f) => ({ ...f, requiresFollowUp: e.target.checked }))}
            />
            این نتیجه نیاز به پیگیری خودکار داره
          </label>
          {form.requiresFollowUp && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="نوع فعالیت پیگیری (اختیاری — پیش‌فرض: همون نوع)">
                <Select
                  value={form.followUpActivityType}
                  onChange={(e) => setForm((f) => ({ ...f, followUpActivityType: e.target.value }))}
                >
                  <option value="">همون نوع فعالیت</option>
                  {Object.entries(ACTIVITY_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="فاصلهٔ پیگیری (دقیقه) *">
                <TextInput
                  type="number"
                  min={1}
                  value={form.followUpOffsetMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, followUpOffsetMinutes: e.target.value }))}
                />
              </Field>
            </div>
          )}
          <div className="flex gap-2 justify-end">
            <GhostButton onClick={() => setCreating(false)}>انصراف</GhostButton>
            <PrimaryButton disabled={!form.label.trim() || create.isPending} onClick={submit}>
              {create.isPending ? "در حال ساخت..." : "ساخت قالب"}
            </PrimaryButton>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {grouped.map(
          (group) =>
            group.items.length > 0 && (
              <div key={group.type} className="rounded-xl bg-surface border border-border shadow-card overflow-hidden">
                <p className="text-xs font-semibold px-4 py-2.5 bg-bg text-textPrimary">{group.typeLabel}</p>
                <div className="divide-y divide-border">
                  {group.items.map((t) => (
                    <div key={t.id} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-textPrimary">
                          {t.label}
                          {t.isDefault && <span className="text-[10px] text-textSecondary mr-1.5">(پیش‌فرض)</span>}
                        </p>
                        {t.requiresFollowUp && (
                          <p className="text-[11px] text-textSecondary mt-0.5">
                            نیاز به پیگیری — {Math.round((t.followUpOffsetMinutes ?? 0) / 60)} ساعت بعد
                            {t.followUpActivityType && ` · نوع: ${ACTIVITY_TYPE_LABELS[t.followUpActivityType]}`}
                          </p>
                        )}
                      </div>
                      {!t.isDefault && (
                        <button
                          onClick={() => remove.mutate(t.id)}
                          className="text-danger shrink-0"
                          aria-label="حذف قالب"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ),
        )}
      </div>
    </div>
  );
}
