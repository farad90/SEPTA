import { useEffect, useState } from "react";
import { useAuth } from "../../lib/auth-context";
import { hasPermission } from "../../lib/permissions";
import { GhostButton, PrimaryButton, Select, TextArea, TextInput } from "../../components/ui/fields";
import { DualDateInput } from "../../components/ui/DualDateInput";
import { AmountInput } from "../../components/ui/AmountInput";
import { InquiryDetail } from "./inquiry-types";
import { useOutcome, useOutcomeMutations } from "./outcome-api";
import { LOSS_REASON_OPTIONS, MODE_META, OutcomeItem, OutcomeMode } from "./outcome-types";

function extractError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } } | null)?.response?.data
    ?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? fallback);
}

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

interface FormState {
  mode: OutcomeMode | null;
  decisionDate: string | null;
  winReason: string;
  lossReason: string;
  competitorName: string;
  competitorPrice: string;
  note: string;
  itemGroup: Record<string, "won" | "lost">;
}

function deriveForm(items: OutcomeItem[]): FormState {
  const hasDecision = items.length > 0 && items.every((i) => i.outcome);
  if (!hasDecision) {
    return {
      mode: null,
      decisionDate: todayIso(),
      winReason: "",
      lossReason: "",
      competitorName: "",
      competitorPrice: "",
      note: "",
      itemGroup: Object.fromEntries(items.map((i) => [i.inquiryItemId, "won" as const])),
    };
  }
  const results = items.map((i) => i.outcome!.result);
  const allWon = results.every((r) => r === "won");
  const allLost = results.every((r) => r === "lost");
  const allCancelled = results.every((r) => r === "cancelled");
  const mode: OutcomeMode = allWon ? "won_all" : allLost ? "lost_all" : allCancelled ? "cancelled" : "mixed";
  const wonItem = items.find((i) => i.outcome?.result === "won");
  const lostItem = items.find((i) => i.outcome?.result === "lost");
  const anyItem = items[0];
  return {
    mode,
    decisionDate: anyItem.outcome!.decisionDate ? anyItem.outcome!.decisionDate.slice(0, 10) : todayIso(),
    winReason: wonItem?.outcome?.winReason ?? "",
    lossReason: lostItem?.outcome?.lossReason ?? "",
    competitorName: lostItem?.outcome?.competitorName ?? "",
    competitorPrice: lostItem?.outcome?.competitorPrice != null ? String(lostItem.outcome.competitorPrice) : "",
    note: anyItem.outcome?.expertNote ?? "",
    itemGroup: Object.fromEntries(
      items.map((i) => [i.inquiryItemId, i.outcome?.result === "lost" ? ("lost" as const) : ("won" as const)]),
    ),
  };
}

export function OutcomeTab({ inquiry }: { inquiry: InquiryDetail }) {
  const { user } = useAuth();
  const canRecord = hasPermission(user, "outcome.record");

  const { data, isLoading, isError } = useOutcome(inquiry.id);
  const { save } = useOutcomeMutations(inquiry.id);

  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!data) return;
    setForm(deriveForm(data.items));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.items.map((i) => `${i.inquiryItemId}:${i.outcome?.result ?? "-"}`).join(",")]);

  if (!canRecord) {
    return <div className="rounded-xl bg-surface border border-border shadow-card py-10 text-center"><p className="text-xs text-textSecondary">دسترسی به این بخش ندارید.</p></div>;
  }
  if (isLoading || !form) return <div className="space-y-3"><div className="h-10 rounded-xl skeleton" /><div className="h-32 rounded-xl skeleton" /></div>;
  if (isError || !data) {
    return <div className="rounded-xl bg-surface border border-border shadow-card py-10 text-center"><p className="text-xs text-danger">خطا در دریافت اطلاعات.</p></div>;
  }

  const hasDecision = data.items.length > 0 && data.items.every((i) => i.outcome);
  const showForm = editing || !hasDecision;
  // فاز ۴۶ — ردیف‌هایی که هیچ‌وقت آفری براشون انتخاب نشده، اصلاً وارد این مرحله نمی‌شن؛ سرور
  // از قبل فیلترشون کرده، اینجا فقط برای اطلاع کاربر تعدادشون رو نشون می‌دیم
  const excludedCount = inquiry.items.length - data.items.length;

  const toggleItem = (id: string) =>
    setForm((f) => (f ? { ...f, itemGroup: { ...f.itemGroup, [id]: f.itemGroup[id] === "won" ? "lost" : "won" } } : f));

  const wonItems = form.mode === "won_all" ? data.items : form.mode === "mixed" ? data.items.filter((i) => form.itemGroup[i.inquiryItemId] === "won") : [];
  const lostItems = form.mode === "lost_all" ? data.items : form.mode === "mixed" ? data.items.filter((i) => form.itemGroup[i.inquiryItemId] === "lost") : [];

  async function handleSave() {
    if (!form || !form.mode) return;
    try {
      setError(null);
      await save.mutateAsync({
        mode: form.mode,
        decisionDate: form.decisionDate ?? todayIso(),
        winReason: form.winReason || undefined,
        lossReason: form.lossReason || undefined,
        competitorName: form.competitorName || undefined,
        competitorPrice: form.competitorPrice ? parseFloat(form.competitorPrice) : undefined,
        note: form.note || undefined,
        itemResults: form.mode === "mixed" ? form.itemGroup : undefined,
      });
      setEditing(false);
    } catch (err) {
      setError(extractError(err, "خطا در ثبت نتیجه"));
    }
  }

  if (!showForm) {
    const mode = deriveForm(data.items).mode!;
    const meta = MODE_META[mode];
    const won = data.items.filter((i) => i.outcome?.result === "won");
    const lost = data.items.filter((i) => i.outcome?.result === "lost");
    return (
      <div className="rounded-lg p-6 bg-successSoft border border-border">
        <div className="flex items-center justify-between mb-3">
          <span className="text-base font-semibold text-textPrimary">نتیجه ثبت شد: {meta.label}</span>
          <button type="button" onClick={() => setEditing(true)} className="text-xs underline text-textSecondary">
            اصلاح نتیجه
          </button>
        </div>
        {won.length > 0 && (
          <p className="text-xs mb-1 text-textSecondary">
            برنده: {won.map((i) => `${i.itemCode} (${i.quantity} ${i.measurementUnit})`).join("، ")}
            {won[0].outcome?.winReason && ` — دلیل: ${won[0].outcome.winReason}`}
          </p>
        )}
        {lost.length > 0 && (
          <p className="text-xs mb-1 text-textSecondary">
            بازنده: {lost.map((i) => `${i.itemCode} (${i.quantity} ${i.measurementUnit})`).join("، ")}
            {lost[0].outcome?.lossReason &&
              ` — دلیل: ${LOSS_REASON_OPTIONS.find((o) => o.value === lost[0].outcome?.lossReason)?.label ?? lost[0].outcome.lossReason}`}
            {lost[0].outcome?.competitorName && ` (رقیب: ${lost[0].outcome.competitorName})`}
          </p>
        )}
        {won.length > 0 && (
          <div className="mt-4 rounded-lg px-3 py-2 text-xs bg-surface text-textPrimary">
            ✓ تب «سفارش مشتری» برای {won.length} قلم برنده‌شده در فازهای بعدی فعال می‌شه.
          </div>
        )}
        {excludedCount > 0 && (
          <p className="mt-3 text-[11px] text-textSecondary">
            {excludedCount} ردیف دیگر از این پرونده، چون هیچ پیشنهادی براشون انتخاب نشده، جزو این نتیجه نیستن.
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="rounded-lg px-4 py-2.5 mb-5 text-xs bg-accentSoft text-textPrimary">
        برای جلوگیری از طولانی شدن ثبت، یکی از حالت‌های زیر رو انتخاب کن — نیازی به پر کردن دلیل جدا برای هر قلم نیست.
      </div>

      {excludedCount > 0 && (
        <p className="mb-3 text-[11px] text-textSecondary">
          {excludedCount} ردیف دیگر از این پرونده، چون هیچ پیشنهادی براشون انتخاب نشده، در این فرم نمایش داده نمی‌شن.
        </p>
      )}

      {error && <p className="text-xs text-danger mb-3">{error}</p>}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {(Object.keys(MODE_META) as OutcomeMode[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setForm((f) => (f ? { ...f, mode: key } : f))}
            className={`py-3 rounded-lg text-sm font-medium text-center border ${
              form.mode === key ? "bg-accentSoft text-accent border-accent" : "bg-surface text-textSecondary border-border"
            }`}
          >
            {MODE_META[key].label}
          </button>
        ))}
      </div>

      {form.mode && (
        <div className="rounded-xl p-5 mb-4 bg-surface border border-border shadow-card">
          <label className="block text-[11px] mb-1 text-textSecondary">تاریخ اعلام نتیجه</label>
          <div className="mb-4 max-w-[200px]">
            <DualDateInput value={form.decisionDate} onChange={(v) => setForm((f) => (f ? { ...f, decisionDate: v } : f))} />
          </div>

          {form.mode === "mixed" && (
            <div className="mb-4">
              <p className="text-xs mb-2 text-textSecondary">هر قلم رو با کلیک بین «برد» و «باخت» جابجا کن:</p>
              <div className="space-y-1.5">
                {data.items.map((it) => {
                  const isWon = form.itemGroup[it.inquiryItemId] === "won";
                  return (
                    <button
                      key={it.inquiryItemId}
                      type="button"
                      onClick={() => toggleItem(it.inquiryItemId)}
                      className={`w-full flex items-center gap-3 rounded-lg px-3 py-2 text-xs ${isWon ? "bg-successSoft" : "bg-[#F3E6E4]"}`}
                    >
                      <span className="font-mono text-textSecondary" dir="ltr">{it.itemCode}</span>
                      <span className="flex-1 text-right text-textPrimary">{it.description}</span>
                      <span className="font-mono text-textSecondary" dir="ltr">{it.quantity} {it.measurementUnit}</span>
                      <span className={`font-semibold ${isWon ? "text-success" : "text-danger"}`}>{isWon ? "برد" : "باخت"}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {(form.mode === "won_all" || (form.mode === "mixed" && wonItems.length > 0)) && (
            <div className="mb-4 pt-3 border-t border-dashed border-border">
              <p className="text-xs font-medium mb-1.5 text-success">
                دلیل برد {form.mode === "mixed" ? `(برای ${wonItems.length} قلم برنده)` : ""} — اختیاری
              </p>
              <TextInput
                value={form.winReason}
                onChange={(e) => setForm((f) => (f ? { ...f, winReason: e.target.value } : f))}
                placeholder="مثلاً زمان تحویل رقابتی‌تر، سابقه همکاری قبلی"
              />
            </div>
          )}

          {(form.mode === "lost_all" || (form.mode === "mixed" && lostItems.length > 0)) && (
            <div className="mb-2 pt-3 border-t border-dashed border-border">
              <p className="text-xs font-medium mb-1.5 text-danger">
                دلیل باخت {form.mode === "mixed" ? `(برای ${lostItems.length} قلم بازنده)` : ""}
              </p>
              <Select
                value={form.lossReason}
                onChange={(e) => setForm((f) => (f ? { ...f, lossReason: e.target.value } : f))}
                className="mb-2.5"
              >
                <option value="">انتخاب کنید...</option>
                {LOSS_REASON_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </Select>
              <div className="grid grid-cols-2 gap-2.5">
                <TextInput
                  value={form.competitorName}
                  onChange={(e) => setForm((f) => (f ? { ...f, competitorName: e.target.value } : f))}
                  placeholder="نام رقیب (اختیاری)"
                />
                <AmountInput
                  value={form.competitorPrice === "" ? null : Number(form.competitorPrice)}
                  onChange={(n) => setForm((f) => (f ? { ...f, competitorPrice: n === null ? "" : String(n) } : f))}
                  placeholder="قیمت رقیب (اختیاری)"
                  className="font-mono"
                />
              </div>
            </div>
          )}

          <div className="pt-3 mt-2 border-t border-dashed border-border">
            <label className="block text-[11px] mb-1 text-textSecondary">یادداشت آزاد</label>
            <TextArea rows={2} value={form.note} onChange={(e) => setForm((f) => (f ? { ...f, note: e.target.value } : f))} />
          </div>
        </div>
      )}

      <div className="flex justify-end gap-2">
        {hasDecision && (
          <GhostButton onClick={() => setEditing(false)}>انصراف</GhostButton>
        )}
        <PrimaryButton onClick={handleSave} disabled={!form.mode || save.isPending}>
          {save.isPending ? "در حال ثبت..." : "ثبت نتیجه"}
        </PrimaryButton>
      </div>
    </div>
  );
}
