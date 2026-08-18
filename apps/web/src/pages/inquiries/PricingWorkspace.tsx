import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { GhostButton, PrimaryButton, Select, TextInput } from "../../components/ui/fields";
import { AmountInput } from "../../components/ui/AmountInput";
import { InquiryDetail } from "./inquiry-types";
import { useCurrencies } from "./rfqs-api";
import { DELIVERY_TERMS, DeliveryTerm, IncotermOption, IncotermOptionItem } from "./selection-types";
import {
  AddPricingOptionBody,
  SavePricingCostBody,
  usePricingCosts,
  usePricingMutations,
  usePricingOptions,
} from "./selection-api";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

function extractError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } } | null)?.response?.data
    ?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? fallback);
}

// ------------------------------------------------------------
// هزینه‌های اضافی قابل‌تخصیص به قیمت‌گذاری (freight/insurance/customs/...)
// ------------------------------------------------------------

function AdditionalCostsPanel({ inquiry, locked }: { inquiry: InquiryDetail; locked: boolean }) {
  const { data: costs, isLoading } = usePricingCosts(inquiry.id);
  const { data: currencies } = useCurrencies();
  const mutations = usePricingMutations(inquiry.id);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<SavePricingCostBody>({
    description: "",
    amount: 0,
    currencyCode: "",
    includeInMarginBase: true,
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function submit() {
    setErrorMsg(null);
    if (!draft.description.trim() || !draft.currencyCode || draft.amount <= 0) {
      setErrorMsg("شرح، ارز و مبلغ (بزرگ‌تر از صفر) الزامی‌ان");
      return;
    }
    try {
      await mutations.createPricingCost.mutateAsync(draft);
      setDraft({ description: "", amount: 0, currencyCode: draft.currencyCode, includeInMarginBase: true });
      setAdding(false);
    } catch (err) {
      setErrorMsg(extractError(err, "ثبت هزینه اضافی ناموفق بود"));
    }
  }

  return (
    <div className="rounded-xl p-5 bg-surface border border-border shadow-card">
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-semibold text-textPrimary">هزینه‌های اضافی</p>
          <p className="text-[11px] text-textSecondary mt-0.5">
            حمل، بیمه، گمرک و... — هرکدوم می‌تونه داخل هزینه پایه محاسبه مارک‌آپ لحاظ بشه یا بعد از آن روی قیمت نهایی سوار بشه
          </p>
        </div>
        {!adding && !locked && (
          <GhostButton type="button" onClick={() => setAdding(true)} className="flex items-center gap-1">
            <Plus size={13} /> افزودن هزینه
          </GhostButton>
        )}
      </div>

      {isLoading && <p className="text-xs text-textSecondary">در حال بارگذاری...</p>}

      {!isLoading && (costs?.length ?? 0) === 0 && !adding && (
        <p className="text-xs text-textSecondary">هزینه اضافی‌ای ثبت نشده.</p>
      )}

      {(costs?.length ?? 0) > 0 && (
        <div className="space-y-1.5 mb-3">
          {costs!.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-2.5 rounded-lg px-3 py-2 bg-bg text-xs">
              <span className="text-textPrimary flex-1 min-w-[100px]">{c.description}</span>
              <span className="font-mono text-textPrimary" dir="ltr">
                {fmt(c.amount)} {c.currencyCode}
              </span>
              <span
                className={`text-[10.5px] px-2 py-0.5 rounded-lg font-medium ${
                  c.includeInMarginBase ? "bg-accentSoft text-accent" : "bg-bg border border-border text-textSecondary"
                }`}
              >
                {c.includeInMarginBase ? "داخل هزینه پایه" : "بعد از مارک‌آپ"}
              </span>
              {c.deliveryTerm && (
                <span className="font-mono text-[10.5px] px-2 py-0.5 rounded-lg bg-bg border border-border text-textSecondary" dir="ltr">
                  فقط {c.deliveryTerm}
                </span>
              )}
              {!locked && (
                <button
                  type="button"
                  onClick={() => mutations.deletePricingCost.mutate(c.id)}
                  className="text-textSecondary hover:text-danger transition-colors duration-150"
                  aria-label="حذف"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="rounded-lg p-3 bg-bg space-y-2.5">
          {errorMsg && <p className="text-xs text-danger">{errorMsg}</p>}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
            <div className="sm:col-span-2">
              <TextInput
                placeholder="شرح هزینه (مثلاً حمل دریایی)"
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
              />
            </div>
            <AmountInput
              value={draft.amount || null}
              onChange={(n) => setDraft((d) => ({ ...d, amount: n ?? 0 }))}
              placeholder="مبلغ"
            />
            <Select
              value={draft.currencyCode}
              onChange={(e) => setDraft((d) => ({ ...d, currencyCode: e.target.value }))}
            >
              <option value="">ارز...</option>
              {currencies?.map((c) => (
                <option key={c.currencyCode} value={c.currencyCode}>
                  {c.currencyCode}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-1.5 text-xs text-textPrimary cursor-pointer">
              <input
                type="checkbox"
                checked={draft.includeInMarginBase ?? true}
                onChange={(e) => setDraft((d) => ({ ...d, includeInMarginBase: e.target.checked }))}
              />
              این هزینه داخل هزینه پایه محاسبه مارک‌آپ لحاظ بشه
            </label>
            <Select
              value={draft.deliveryTerm ?? ""}
              onChange={(e) =>
                setDraft((d) => ({ ...d, deliveryTerm: (e.target.value || undefined) as DeliveryTerm | undefined }))
              }
              className="w-auto"
            >
              <option value="">روی همه گزینه‌های ترم تحویل</option>
              {DELIVERY_TERMS.map((t) => (
                <option key={t} value={t}>
                  فقط {t}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-2">
            <PrimaryButton type="button" onClick={submit} disabled={mutations.createPricingCost.isPending}>
              ثبت هزینه
            </PrimaryButton>
            <GhostButton type="button" onClick={() => setAdding(false)}>
              انصراف
            </GhostButton>
          </div>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------------
// افزودن گزینه ترم تحویل جدید («یک پیشنهاد، چند Incoterm»)
// ------------------------------------------------------------

function AddOptionForm({
  inquiry,
  existingTerms,
  defaultCurrencyCode,
  onDone,
}: {
  inquiry: InquiryDetail;
  existingTerms: DeliveryTerm[];
  defaultCurrencyCode: string;
  onDone: () => void;
}) {
  const { data: currencies } = useCurrencies();
  const mutations = usePricingMutations(inquiry.id);
  const available = DELIVERY_TERMS.filter((t) => !existingTerms.includes(t));
  const [draft, setDraft] = useState<AddPricingOptionBody>({
    deliveryTerm: available[0] ?? "CPT",
    deliveryDays: 30,
    currencyCode: defaultCurrencyCode,
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function submit() {
    setErrorMsg(null);
    try {
      await mutations.addPricingOption.mutateAsync(draft);
      onDone();
    } catch (err) {
      setErrorMsg(extractError(err, "افزودن گزینه ناموفق بود"));
    }
  }

  if (available.length === 0) {
    return <p className="text-xs text-textSecondary">همه‌ی ترم‌های تحویل تعریف‌شده قبلاً به این قیمت‌گذاری اضافه شدن.</p>;
  }

  return (
    <div className="rounded-lg p-3 bg-bg space-y-2.5">
      {errorMsg && <p className="text-xs text-danger">{errorMsg}</p>}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <Select value={draft.deliveryTerm} onChange={(e) => setDraft((d) => ({ ...d, deliveryTerm: e.target.value as DeliveryTerm }))}>
          {available.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <AmountInput
          value={draft.deliveryDays || null}
          onChange={(n) => setDraft((d) => ({ ...d, deliveryDays: n ?? 0 }))}
          placeholder="زمان تحویل (روز)"
        />
        <Select value={draft.currencyCode} onChange={(e) => setDraft((d) => ({ ...d, currencyCode: e.target.value }))}>
          {currencies?.map((c) => (
            <option key={c.currencyCode} value={c.currencyCode}>
              {c.currencyCode}
            </option>
          ))}
        </Select>
        <AmountInput
          value={draft.defaultMarkupPercent ?? null}
          onChange={(n) => setDraft((d) => ({ ...d, defaultMarkupPercent: n ?? undefined }))}
          placeholder="درصد مارک‌آپ پیش‌فرض"
        />
      </div>
      <AmountInput
        value={draft.exchangeRate ?? null}
        onChange={(n) => setDraft((d) => ({ ...d, exchangeRate: n ?? undefined }))}
        placeholder="نرخ تبدیل (فقط اگه ارز این گزینه با ارز مبنای قیمت‌گذاری فرق داره)"
      />
      <TextInput
        placeholder="محل تحویل (مثلاً CPT Tehran)"
        value={draft.incotermLocation ?? ""}
        onChange={(e) => setDraft((d) => ({ ...d, incotermLocation: e.target.value }))}
      />
      <div className="flex items-center gap-2">
        <PrimaryButton type="button" onClick={submit} disabled={mutations.addPricingOption.isPending}>
          افزودن گزینه
        </PrimaryButton>
        <GhostButton type="button" onClick={onDone}>
          انصراف
        </GhostButton>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// ردیف قیمت‌گذاری یک قلم — مارک‌آپ بازرگانی («تعیین حاشیه سود») + قیمت محاسبه‌شده
// ------------------------------------------------------------

function ItemPricingRow({
  item,
  optionId,
  optionCurrency,
  inquiryId,
  locked,
}: {
  item: IncotermOptionItem;
  optionId: string;
  optionCurrency: string;
  inquiryId: string;
  locked: boolean;
}) {
  const mutations = usePricingMutations(inquiryId);
  const [markupDraft, setMarkupDraft] = useState(String(item.markupPercent));
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setMarkupDraft(String(item.markupPercent));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.markupPercent]);

  async function saveMarkup() {
    setErrorMsg(null);
    const pct = parseFloat(markupDraft);
    if (Number.isNaN(pct)) {
      setErrorMsg("درصد مارک‌آپ نامعتبره");
      return;
    }
    try {
      await mutations.saveMarkup.mutateAsync({
        optionId,
        body: { items: [{ inquiryItemId: item.inquiryItemId, markupPercent: pct }] },
      });
    } catch (err) {
      setErrorMsg(extractError(err, "ذخیره مارک‌آپ ناموفق بود"));
    }
  }

  return (
    <div className="rounded-lg bg-bg overflow-hidden">
      <div className="p-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-mono text-textSecondary" dir="ltr">
            {item.rowIndex != null ? `ردیف ${item.rowIndex}` : ""} {item.partNumber ? `— PN: ${item.partNumber}` : ""}
          </span>
          <span className="text-textPrimary flex-1 min-w-[120px] truncate" title={item.description ?? ""}>
            {item.description}
          </span>
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <div className="flex items-end gap-1.5">
            <div className="w-24">
              <label className="block text-[10.5px] text-textSecondary mb-1">درصد مارک‌آپ</label>
              <TextInput
                disabled={locked}
                value={markupDraft}
                onChange={(e) => setMarkupDraft(e.target.value)}
                dir="ltr"
                className="font-mono text-xs py-1.5"
              />
            </div>
            {!locked && (
              <GhostButton
                type="button"
                onClick={saveMarkup}
                disabled={mutations.saveMarkup.isPending}
                className="py-1.5 px-2.5"
              >
                ذخیره
              </GhostButton>
            )}
          </div>

          <div className="flex flex-col gap-0.5 text-xs mr-auto" dir="ltr">
            <span className="text-textPrimary font-semibold">
              قیمت محاسبه‌شده بازرگانی:{" "}
              <span className="font-mono">
                {item.commercialCalculatedPrice != null ? fmt(item.commercialCalculatedPrice) : "—"} {optionCurrency}
              </span>
            </span>
            <span className="text-[10.5px] text-textSecondary">
              اصلاح نهایی قیمت مشتری (تخفیف/افزایش) در تب «پیشنهاد به مشتری» توسط فروش انجام می‌شه
            </span>
          </div>
        </div>

        {errorMsg && <p className="text-xs text-danger">{errorMsg}</p>}

        {item.marginBaseCostSnapshot && item.marginBaseCostSnapshot.length > 0 && (
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            className="flex items-center gap-1 text-[10.5px] text-textSecondary hover:text-textPrimary transition-colors duration-150"
          >
            جزئیات محاسبه {detailsOpen ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        )}
        {detailsOpen && item.marginBaseCostSnapshot && (
          <div className="text-[10.5px] text-textSecondary space-y-0.5" dir="ltr">
            {item.marginBaseCostSnapshot.map((c, idx) => (
              <div key={idx} className="flex justify-between">
                <span>
                  {c.description} ({c.includeInMarginBase ? "داخل هزینه پایه" : "بعد از مارک‌آپ"})
                </span>
                <span className="font-mono">
                  {fmt(c.amount)} {c.currencyCode}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// یک گزینه ترم تحویل کامل — پروفایل مارک‌آپ («اعمال به همه») + قیمت‌گذاری هر قلم
// ------------------------------------------------------------

function OptionPanel({
  option,
  inquiryId,
  canRemove,
  locked,
  onRemoved,
}: {
  option: IncotermOption;
  inquiryId: string;
  canRemove: boolean;
  locked: boolean;
  onRemoved: () => void;
}) {
  const mutations = usePricingMutations(inquiryId);
  const [applyAllDraft, setApplyAllDraft] = useState(String(option.defaultMarkupPercent ?? ""));
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function applyToAll() {
    setErrorMsg(null);
    const pct = parseFloat(applyAllDraft);
    if (Number.isNaN(pct)) {
      setErrorMsg("درصد مارک‌آپ نامعتبره");
      return;
    }
    try {
      await mutations.saveMarkup.mutateAsync({ optionId: option.id, body: { defaultMarkupPercent: pct } });
    } catch (err) {
      setErrorMsg(extractError(err, "اعمال مارک‌آپ ناموفق بود"));
    }
  }

  async function remove() {
    if (!window.confirm(`گزینه ${option.deliveryTerm} حذف بشه؟`)) return;
    try {
      await mutations.removePricingOption.mutateAsync(option.id);
      onRemoved();
    } catch (err) {
      setErrorMsg(extractError(err, "حذف گزینه ناموفق بود"));
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2.5 bg-bg">
        <div className="flex flex-wrap items-center gap-3 text-xs">
          <span className="text-textSecondary">
            ارز: <span className="font-mono text-textPrimary">{option.currencyCode}</span>
          </span>
          <span className="text-textSecondary">
            زمان تحویل: <span className="font-mono text-textPrimary">{option.deliveryDays} روز</span>
          </span>
          <span className="text-textSecondary">
            هزینه پایه مارک‌آپ: <span className="font-mono text-textPrimary">{fmt(option.marginBaseAmount)}</span>
          </span>
          {option.incotermLocation && (
            <span className="text-textSecondary">
              محل تحویل: <span className="text-textPrimary">{option.incotermLocation}</span>
            </span>
          )}
        </div>
        {canRemove && !locked && (
          <button
            type="button"
            onClick={remove}
            className="text-textSecondary hover:text-danger transition-colors duration-150 flex items-center gap-1 text-[11px]"
          >
            <Trash2 size={12} /> حذف گزینه
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="w-32">
          <label className="block text-[10.5px] text-textSecondary mb-1">مارک‌آپ پیش‌فرض (اعمال به همه)</label>
          <TextInput disabled={locked} value={applyAllDraft} onChange={(e) => setApplyAllDraft(e.target.value)} dir="ltr" className="font-mono text-xs" />
        </div>
        {!locked && (
          <PrimaryButton type="button" onClick={applyToAll} disabled={mutations.saveMarkup.isPending} className="py-2">
            اعمال به همه اقلام
          </PrimaryButton>
        )}
      </div>
      {errorMsg && <p className="text-xs text-danger">{errorMsg}</p>}

      <div className="space-y-2">
        {option.items.map((item) => (
          <ItemPricingRow
            key={item.id}
            item={item}
            optionId={option.id}
            optionCurrency={option.currencyCode}
            inquiryId={inquiryId}
            locked={locked}
          />
        ))}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// بخش اصلی — سوییچر گزینه‌های ترم تحویل («یک پیشنهاد، چند Incoterm») + هزینه‌های اضافی
// ⚠️ فاز ۶۰ (اصلاح — بازخورد کاربر): این بخش («تعیین حاشیه سود») متعلق به همین مرحله «انتخاب
// نهایی و قیمت‌گذاری» است — قبلاً اشتباهاً در تب «پیشنهاد به مشتری» قرار گرفته بود.
// ------------------------------------------------------------

export function PricingWorkspace({
  inquiry,
  canManagePricing,
  defaultCurrencyCode,
  locked,
}: {
  inquiry: InquiryDetail;
  canManagePricing: boolean;
  defaultCurrencyCode: string;
  locked: boolean;
}) {
  const { data: options, isLoading } = usePricingOptions(inquiry.id);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [addingOption, setAddingOption] = useState(false);

  useEffect(() => {
    if (!options) return;
    if (!options.some((o) => o.id === activeId)) {
      setActiveId(options[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options?.map((o) => o.id).join(",")]);

  if (!canManagePricing) return null;

  const list = options ?? [];
  const activeOption = list.find((o) => o.id === activeId) ?? null;

  return (
    <div className="space-y-4">
      <AdditionalCostsPanel inquiry={inquiry} locked={locked} />

      <div className="rounded-xl p-5 bg-surface border border-border shadow-card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-semibold text-textPrimary">قیمت‌گذاری بازرگانی به تفکیک ترم تحویل</p>
            <p className="text-[11px] text-textSecondary mt-0.5">
              حاشیه سود («مارک‌آپ») هر گزینه Incoterm همین‌جا تعیین می‌شه — نتیجه‌ش فقط‌خواندنی در تب «پیشنهاد به مشتری» دیده می‌شه.
            </p>
          </div>
          {!addingOption && !locked && (
            <GhostButton type="button" onClick={() => setAddingOption(true)} className="flex items-center gap-1">
              <Plus size={13} /> افزودن گزینه Incoterm
            </GhostButton>
          )}
        </div>

        {isLoading && <p className="text-xs text-textSecondary">در حال بارگذاری...</p>}

        {addingOption && (
          <div className="mb-3">
            <AddOptionForm
              inquiry={inquiry}
              existingTerms={list.map((o) => o.deliveryTerm)}
              defaultCurrencyCode={defaultCurrencyCode}
              onDone={() => setAddingOption(false)}
            />
          </div>
        )}

        {!isLoading && list.length === 0 && !addingOption && (
          <p className="text-xs text-textSecondary">
            هنوز هیچ گزینه ترم تحویلی برای قیمت‌گذاری ثبت نشده — ابتدا حداقل یک قلم باید آفر منتخب داشته باشه.
          </p>
        )}

        {list.length > 0 && (
          <>
            {/* سوییچر پیل — هیچ کامپوننت Tabs عمومی در این پروژه نیست، دقیقاً هم‌الگوی سایر جاهایی
            که با دکمه‌های گروه‌بندی‌شده شبیه‌سازی شده */}
            <div className="flex flex-wrap gap-1.5 mb-4 border-b border-border pb-3">
              {list.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => setActiveId(o.id)}
                  className={`text-xs font-mono px-3.5 py-2 rounded-lg font-medium transition-all duration-150 ${
                    activeId === o.id
                      ? "bg-primary text-white shadow-xs"
                      : "bg-bg text-textSecondary hover:text-textPrimary border border-border"
                  }`}
                  dir="ltr"
                >
                  {o.deliveryTerm}
                  {o.isPrimary && <span className="mr-1 opacity-70">·پیش‌فرض</span>}
                </button>
              ))}
            </div>

            {activeOption && (
              <OptionPanel
                key={activeOption.id}
                option={activeOption}
                inquiryId={inquiry.id}
                canRemove={list.length > 1}
                locked={locked}
                onRemoved={() => setActiveId(null)}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
