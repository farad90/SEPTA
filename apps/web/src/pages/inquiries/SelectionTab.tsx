import { useEffect, useState } from "react";
import { AlertTriangle, Info, Lock, Plus, X } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { hasPermission } from "../../lib/permissions";
import { GhostButton, PrimaryButton, Select, TextArea, TextInput } from "../../components/ui/fields";
import { AmountInput } from "../../components/ui/AmountInput";
import { DeliveryTimeInput } from "../../components/ui/DeliveryTimeInput";
import { InquiryDetail } from "./inquiry-types";
import { useCurrencies } from "./rfqs-api";
import { useSelection, useSelectionMutations } from "./selection-api";
import { PricingWorkspace } from "./PricingWorkspace";
import {
  DELIVERY_TERMS,
  DeliveryTerm,
  SelectionDeliveryOption,
  SelectionItem,
  SelectionOfferOption,
} from "./selection-types";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

// فاز ۴۰-الف: پیش‌نمایش زنده‌ی فی مؤثر — دقیقاً هم‌فرمول computeEffectiveUnitPrice سمت سرور،
// ولی روی state محلی (distributeDraft) اجرا می‌شه تا با تیک‌زدن چک‌باکس، بدون نیاز به «ذخیره»،
// بلافاصله قیمت پیش‌نمایش عوض بشه — قبلاً effectivePrice فقط بعد از ذخیره از سرور تازه می‌شد
function computeLiveEffectivePrice(
  offer: SelectionOfferOption,
  quantity: number,
  distribute: { vat: boolean; otherCosts: boolean },
): number {
  if (!distribute.vat && !distribute.otherCosts) return offer.price;
  if (offer.subTotal <= 0 || quantity <= 0) return offer.price;
  const vatAmount = offer.vatApplicable ? (offer.subTotal * offer.vatRatePercent) / 100 : 0;
  const extra = (distribute.vat ? vatAmount : 0) + (distribute.otherCosts ? offer.otherCosts : 0);
  const lineTotal = offer.price * quantity;
  const share = (lineTotal / offer.subTotal) * extra;
  return offer.price + share / quantity;
}

function extractError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? fallback);
}

export function SelectionTab({ inquiry }: { inquiry: InquiryDetail }) {
  const { user } = useAuth();
  const canView = hasPermission(user, "selection.view");
  const canSelectOffer = hasPermission(user, "selection.select_offer");
  const canSetMarkup = hasPermission(user, "selection.set_markup");
  const canLock = hasPermission(user, "selection.lock");

  const { data, isLoading, isError } = useSelection(inquiry.id);
  const { save, saveDeliveryOptions, lock, unlock } = useSelectionMutations(inquiry.id);
  const { data: currencies } = useCurrencies();

  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [managerNote, setManagerNote] = useState("");
  // فاز ۵۷ — ارز مبنای انتخاب نهایی + نرخ تبدیل هر ارز آفر به این ارز (بافر محلی، مثل بقیه فرم‌ها)
  const [baseCurrencyDraft, setBaseCurrencyDraft] = useState("");
  const [rateDraft, setRateDraft] = useState<Record<string, string>>({});
  const [deliveryDraft, setDeliveryDraft] = useState<SelectionDeliveryOption[]>([]);
  const [pricingDraft, setPricingDraft] = useState<
    Record<string, { markupPercent: string; manualFinalSalePrice: string; selectionNotes: string }>
  >({});
  // انتخاب آفر و توزیع هزینه هم فقط در state محلی بافر می‌شن — تا کلیک «ذخیره» همون قلم به سرور نمی‌رن
  const [selectedOfferDraft, setSelectedOfferDraft] = useState<Record<string, string | null>>({});
  // فاز ۳۵-الف: توزیع VAT و سایر هزینه‌ها دو سوییچ مستقل‌ان
  const [distributeDraft, setDistributeDraft] = useState<
    Record<string, { vat: boolean; otherCosts: boolean }>
  >({});

  useEffect(() => {
    if (!data) return;
    setManagerNote(data.managerNoteToSales ?? "");
    setBaseCurrencyDraft(data.selectionBaseCurrencyCode ?? "");
    setRateDraft(Object.fromEntries(data.exchangeRates.map((r) => [r.fromCurrencyCode, String(r.rate)])));
    setDeliveryDraft(data.deliveryOptions);
    setPricingDraft((current) => {
      const next = { ...current };
      for (const item of data.items) {
        if (!next[item.id]) {
          next[item.id] = {
            markupPercent: item.markupPercent != null ? String(item.markupPercent) : "",
            manualFinalSalePrice: "",
            selectionNotes: item.selectionNotes ?? "",
          };
        }
      }
      return next;
    });
    setSelectedOfferDraft((current) => {
      const next = { ...current };
      for (const item of data.items) {
        if (!(item.id in next)) next[item.id] = item.selectedOfferItemId;
      }
      return next;
    });
    setDistributeDraft((current) => {
      const next = { ...current };
      for (const item of data.items) {
        for (const offer of item.offers) {
          if (!(offer.offerId in next)) {
            next[offer.offerId] = { vat: offer.distributeVat, otherCosts: offer.distributeOtherCosts };
          }
        }
      }
      return next;
    });
  }, [data]);

  if (!canView) {
    return (
      <div className="rounded-xl bg-surface border border-border shadow-card py-10 text-center">
        <p className="text-xs text-textSecondary">دسترسی به این بخش ندارید.</p>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-10 rounded-xl skeleton" />
        <div className="h-40 rounded-xl skeleton" />
        <div className="h-40 rounded-xl skeleton" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <div className="rounded-xl bg-surface border border-border shadow-card py-10 text-center">
        <p className="text-xs text-danger">خطا در دریافت اطلاعات.</p>
      </div>
    );
  }

  const locked = data.locked;

  function selectOffer(item: SelectionItem, offerItemId: string | null) {
    setSelectedOfferDraft((c) => ({ ...c, [item.id]: offerItemId }));
  }

  function toggleDistribute(offerId: string, field: "vat" | "otherCosts", next: boolean) {
    setDistributeDraft((c) => ({
      ...c,
      [offerId]: { vat: c[offerId]?.vat ?? false, otherCosts: c[offerId]?.otherCosts ?? false, [field]: next },
    }));
  }

  async function savePricing(item: SelectionItem) {
    const draft = pricingDraft[item.id];
    if (!draft) return;
    try {
      setError(null);
      const touchedOffers = item.offers.filter((o) => {
        const d = distributeDraft[o.offerId];
        return d && (d.vat !== o.distributeVat || d.otherCosts !== o.distributeOtherCosts);
      });
      await save.mutateAsync({
        items: [
          {
            inquiryItemId: item.id,
            selectedOfferItemId: selectedOfferDraft[item.id] ?? item.selectedOfferItemId,
            selectionNotes: draft.selectionNotes || undefined,
            markupPercent: draft.markupPercent ? parseFloat(draft.markupPercent) : undefined,
            finalSalePrice: draft.manualFinalSalePrice ? parseFloat(draft.manualFinalSalePrice) : undefined,
          },
        ],
        offers: touchedOffers.length
          ? touchedOffers.map((o) => ({
              offerId: o.offerId,
              distributeVat: distributeDraft[o.offerId].vat,
              distributeOtherCosts: distributeDraft[o.offerId].otherCosts,
            }))
          : undefined,
      });
      setNotice("ذخیره شد");
      setTimeout(() => setNotice(null), 1500);
    } catch (err) {
      setError(extractError(err, "خطا در ذخیره قیمت‌گذاری"));
    }
  }

  function updateDeliveryRow(index: number, patch: Partial<SelectionDeliveryOption>) {
    setDeliveryDraft((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  async function saveDelivery() {
    try {
      setError(null);
      await saveDeliveryOptions.mutateAsync(deliveryDraft);
      setNotice("گزینه‌های تحویل ذخیره شد");
      setTimeout(() => setNotice(null), 1500);
    } catch (err) {
      setError(extractError(err, "خطا در ذخیره گزینه‌های تحویل"));
    }
  }

  async function handleLock() {
    try {
      setError(null);
      const result = await lock.mutateAsync(managerNote || undefined);
      if (result.warnings?.length) {
        setNotice(result.warnings.join("؛ "));
      }
    } catch (err) {
      setError(extractError(err, "خطا در قفل کردن — همه اقلامِ دارای آفر باید انتخاب و درصد سود داشته باشن"));
    }
  }

  // فاز ۵۷ — نرخ زنده (بافر محلی، قبل از ذخیره) برای تبدیل یک ارز آفر به ارز مبنای درِ حال ویرایش
  function liveRateFor(currencyCode: string): number | null {
    if (!baseCurrencyDraft) return null;
    if (currencyCode === baseCurrencyDraft) return 1;
    const parsed = parseFloat(rateDraft[currencyCode]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  // فی مؤثر یک آفر به ارز مبنا — null یعنی ارز مبنا فعاله ولی نرخ این ارز هنوز وارد نشده
  function liveEffectiveInBase(
    offer: SelectionOfferOption,
    quantity: number,
    distribute: { vat: boolean; otherCosts: boolean },
  ): number | null {
    const raw = computeLiveEffectivePrice(offer, quantity, distribute);
    if (!baseCurrencyDraft) return raw;
    const rate = liveRateFor(offer.currencyCode);
    return rate != null ? raw * rate : null;
  }

  async function saveBaseCurrency() {
    try {
      setError(null);
      const rates = offerCurrencies
        .filter((code) => code !== baseCurrencyDraft)
        .map((code) => ({ fromCurrencyCode: code, rate: parseFloat(rateDraft[code]) }))
        .filter((r) => Number.isFinite(r.rate) && r.rate > 0);
      await save.mutateAsync({
        selectionBaseCurrencyCode: baseCurrencyDraft || null,
        exchangeRates: baseCurrencyDraft && rates.length > 0 ? rates : undefined,
      });
      setNotice("ارز مبنا ذخیره شد");
      setTimeout(() => setNotice(null), 1500);
    } catch (err) {
      setError(extractError(err, "خطا در ذخیره ارز مبنا"));
    }
  }

  async function handleUnlock() {
    try {
      setError(null);
      await unlock.mutateAsync();
    } catch (err) {
      setError(extractError(err, "خطا در بازگشایی"));
    }
  }

  const totalsEntries = Object.entries(data.totalsByCurrency);
  // فاز ۵۷ — تمام ارزهای واقعاً استفاده‌شده در آفرهای این پرونده (برای فهرست ورودی نرخ تبدیل)
  const offerCurrencies = [...new Set(data.items.flatMap((i) => i.offers.map((o) => o.currencyCode)))];

  return (
    <div className="space-y-4">
      <div className="rounded-xl px-4 py-3 text-xs flex items-center gap-2.5 bg-accentSoft text-textPrimary">
        <Info size={14} className="shrink-0 text-accent" />
        این مرحله فقط در اختیار مدیریت/مدیر فروش است — همه‌ی آفرهای دریافتی مقایسه و آیتم برگزیده هر قلم انتخاب می‌شود.
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}
      {notice && <p className="text-xs text-success">{notice}</p>}

      {/* فاز ۵۷ — ارز مبنای قیمت‌گذاری */}
      {canSetMarkup && (
        <div className="rounded-xl p-5 bg-surface border border-border shadow-card">
          <p className="text-sm font-semibold mb-1 text-textPrimary">ارز مبنای قیمت‌گذاری</p>
          <p className="text-xs mb-3 text-textSecondary">
            اگه پیشنهادهای تأمین‌کننده به چند ارز مختلف باشن، اینجا یک ارز مبنا برای قیمت فروش به مشتری انتخاب کن — برای هر ارزی که با ارز مبنا فرق داره باید نرخ تبدیل وارد بشه.
          </p>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <label className="text-xs text-textSecondary">ارز مبنا:</label>
            <Select
              disabled={locked}
              value={baseCurrencyDraft}
              onChange={(e) => setBaseCurrencyDraft(e.target.value)}
              className="!w-32 !py-1.5 text-xs"
            >
              <option value="">— غیرفعال (چندارزی مثل قبل) —</option>
              {(currencies ?? []).map((c) => (
                <option key={c.currencyCode} value={c.currencyCode}>{c.currencyCode}</option>
              ))}
            </Select>
          </div>

          {baseCurrencyDraft && (
            <div className="space-y-2 mb-3">
              {offerCurrencies
                .filter((code) => code !== baseCurrencyDraft)
                .map((code) => (
                  <div key={code} className="flex items-center gap-2 rounded-lg px-3 py-2 bg-bg">
                    <span className="font-mono text-xs text-textSecondary" dir="ltr">
                      یک {code} = ... {baseCurrencyDraft}
                    </span>
                    <TextInput
                      disabled={locked}
                      value={rateDraft[code] ?? ""}
                      onChange={(e) => setRateDraft((c) => ({ ...c, [code]: e.target.value }))}
                      className="!w-28 font-mono"
                      dir="ltr"
                      placeholder="نرخ تبدیل"
                    />
                  </div>
                ))}
              {offerCurrencies.filter((code) => code !== baseCurrencyDraft).length === 0 && (
                <p className="text-[11px] text-textSecondary">همه پیشنهادهای دریافتی همین ارز مبنا هستن — نیازی به نرخ تبدیل نیست.</p>
              )}
            </div>
          )}

          {!locked && (
            <GhostButton onClick={saveBaseCurrency} disabled={save.isPending}>
              ذخیره ارز مبنا
            </GhostButton>
          )}

          {data.missingExchangeRateCurrencies.length > 0 && (
            <p className="text-[11px] text-warning flex items-center gap-1 mt-2">
              <AlertTriangle size={11} /> نرخ تبدیل این ارزها هنوز ثبت نشده: {data.missingExchangeRateCurrencies.join("، ")}
            </p>
          )}
        </div>
      )}

      {data.items.map((item) => {
        const draft = pricingDraft[item.id] ?? { markupPercent: "", manualFinalSalePrice: "", selectionNotes: "" };
        const currentSelectedOfferItemId = selectedOfferDraft[item.id] ?? item.selectedOfferItemId;
        const selectedOffer = item.offers.find((o) => o.offerItemId === currentSelectedOfferItemId);
        // فاز ۵۷ — وقتی ارز مبنا فعاله، فی مؤثر باید اول به ارز مبنا تبدیل بشه؛ null یعنی نرخ این ارز هنوز ثبت نشده
        const selectedOfferLiveEffectivePrice = selectedOffer
          ? liveEffectiveInBase(
              selectedOffer,
              item.quantity,
              distributeDraft[selectedOffer.offerId] ?? {
                vat: selectedOffer.distributeVat,
                otherCosts: selectedOffer.distributeOtherCosts,
              },
            )
          : 0;
        const missingRateForSelected = baseCurrencyDraft && selectedOffer && selectedOfferLiveEffectivePrice == null;
        const previewFinal =
          draft.manualFinalSalePrice ||
          (selectedOffer && draft.markupPercent && selectedOfferLiveEffectivePrice != null
            ? fmt(selectedOfferLiveEffectivePrice * (1 + (parseFloat(draft.markupPercent) || 0) / 100))
            : item.finalSalePrice != null
              ? fmt(item.finalSalePrice)
              : "");

        return (
          <div key={item.id} className="rounded-xl p-5 bg-surface border border-border shadow-card">
            <p className="text-sm font-semibold mb-3 text-textPrimary">
              <span className="font-mono ml-2 text-textSecondary" dir="ltr">ردیف {item.rowIndex}</span>
              {item.partNumber && <span className="font-mono ml-2 text-textSecondary" dir="ltr">PN: {item.partNumber}</span>}
              {item.description}
              <span className="font-mono mr-2 text-textSecondary" dir="ltr">— {item.quantity} {item.measurementUnit}</span>
            </p>

            {item.offers.length === 0 && (
              <p className="text-xs text-danger">هنوز هیچ پیشنهاد قیمتی برای این قلم دریافت نشده — این قلم قابل قیمت‌گذاری نیست.</p>
            )}

            <div className="space-y-2">
              {item.offers.map((offer) => {
                const isChosen = currentSelectedOfferItemId === offer.offerItemId;
                const offerDistribute = distributeDraft[offer.offerId] ?? {
                  vat: offer.distributeVat,
                  otherCosts: offer.distributeOtherCosts,
                };
                return (
                  <label
                    key={offer.offerItemId}
                    className={`flex flex-wrap items-center gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-colors duration-150 ${
                      isChosen ? "bg-successSoft border border-success" : "bg-bg border border-transparent hover:border-border"
                    }`}
                  >
                    <input
                      type="radio"
                      disabled={locked || !canSelectOffer}
                      name={`select-${item.id}`}
                      checked={isChosen}
                      onChange={() => selectOffer(item, offer.offerItemId)}
                      className="w-4 h-4"
                    />
                    <span className="text-xs font-medium text-textPrimary">{offer.supplier.companyName}</span>
                    {offer.partNumber && (
                      <span className="font-mono text-xs text-textSecondary" dir="ltr">PN: {offer.partNumber}</span>
                    )}
                    {offer.builder && (
                      <span className="text-xs text-textSecondary">برند: {offer.builder}</span>
                    )}
                    <span className="font-mono text-xs text-textSecondary" dir="ltr">
                      فی: {fmt(offer.price)} {offer.currencyCode}
                    </span>
                    {offer.deliveryTimeDays != null && (
                      <span className="font-mono text-xs text-textSecondary" dir="ltr">تحویل: {offer.deliveryTimeDays} روز</span>
                    )}
                    {(offerDistribute.vat || offerDistribute.otherCosts) && (
                      <span className="font-mono text-xs font-semibold text-accent" dir="ltr">
                        فی مؤثر: {fmt(computeLiveEffectivePrice(offer, item.quantity, offerDistribute))} {offer.currencyCode}
                      </span>
                    )}
                    {/* فاز ۵۷ — پیش‌نمایش فی مؤثر بر حسب ارز مبنا */}
                    {baseCurrencyDraft && offer.currencyCode !== baseCurrencyDraft && (
                      (() => {
                        const inBase = liveEffectiveInBase(offer, item.quantity, offerDistribute);
                        return inBase != null ? (
                          <span className="font-mono text-xs font-semibold text-success" dir="ltr">
                            = {fmt(inBase)} {baseCurrencyDraft}
                          </span>
                        ) : (
                          <span className="text-[11px] font-medium text-warning flex items-center gap-1">
                            <AlertTriangle size={11} /> نرخ تبدیل {offer.currencyCode} ثبت نشده
                          </span>
                        );
                      })()
                    )}
                    <div
                      className="flex items-center gap-3 text-[11px] mr-auto text-textSecondary"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          disabled={locked || !canSelectOffer}
                          checked={offerDistribute.vat}
                          onChange={(e) => toggleDistribute(offer.offerId, "vat", e.target.checked)}
                          className="w-3.5 h-3.5"
                        />
                        توزیع VAT بین اقلام
                      </label>
                      <label className="flex items-center gap-1.5">
                        <input
                          type="checkbox"
                          disabled={locked || !canSelectOffer}
                          checked={offerDistribute.otherCosts}
                          onChange={(e) => toggleDistribute(offer.offerId, "otherCosts", e.target.checked)}
                          className="w-3.5 h-3.5"
                        />
                        توزیع سایر هزینه‌ها بین اقلام
                      </label>
                    </div>
                  </label>
                );
              })}
            </div>

            {currentSelectedOfferItemId && (
              <div className="flex flex-wrap items-center gap-2 mt-3 pt-3 border-t border-dashed border-border">
                <label className="text-xs text-textSecondary">درصد حاشیه سود:</label>
                <TextInput
                  disabled={locked || !canSetMarkup}
                  value={draft.markupPercent}
                  onChange={(e) =>
                    setPricingDraft((c) => ({ ...c, [item.id]: { ...draft, markupPercent: e.target.value } }))
                  }
                  className="!w-16 font-mono"
                  dir="ltr"
                />
                <span className="text-xs text-textSecondary">٪</span>
                <label className="text-xs text-textSecondary mr-2">قیمت فروش نهایی:</label>
                <AmountInput
                  disabled={locked || !canSetMarkup}
                  value={draft.manualFinalSalePrice === "" ? null : Number(draft.manualFinalSalePrice)}
                  placeholder={previewFinal || "خودکار"}
                  onChange={(n) =>
                    setPricingDraft((c) => ({ ...c, [item.id]: { ...draft, manualFinalSalePrice: n === null ? "" : String(n) } }))
                  }
                  className="!w-28 font-mono"
                />
                {canSetMarkup && !locked && (
                  <GhostButton onClick={() => savePricing(item)} disabled={save.isPending}>
                    ذخیره
                  </GhostButton>
                )}
                {missingRateForSelected && (
                  <p className="basis-full text-[11px] text-warning flex items-center gap-1">
                    <AlertTriangle size={11} /> قبل از تعیین حاشیه سود، نرخ تبدیل {selectedOffer?.currencyCode} به {baseCurrencyDraft} رو در بخش «ارز مبنا» بالای صفحه ثبت کن
                  </p>
                )}
              </div>
            )}

            {(canSetMarkup || item.selectionNotes) && currentSelectedOfferItemId && (
              <div className="mt-2">
                <TextArea
                  disabled={locked || !canSetMarkup}
                  rows={1}
                  placeholder="یادداشت معیار انتخاب (سابقه همکاری، کیفیت، ریسک ارزی...)"
                  value={draft.selectionNotes}
                  onChange={(e) =>
                    setPricingDraft((c) => ({ ...c, [item.id]: { ...draft, selectionNotes: e.target.value } }))
                  }
                  className="text-xs"
                />
              </div>
            )}
          </div>
        );
      })}

      {/* فاز ۶۰ (اصلاح — بازخورد کاربر) — موتور قیمت‌گذاری بازرگانی مبتنی بر Incoterm («تعیین
      حاشیه سود» به تفکیک هر ترم تحویل) — دقیقاً همین‌جاست که باید مدیریت بشه، نه در تب «پیشنهاد
      به مشتری». جدا از بخش ساده‌ی «گزینه‌های ترم تحویل به مشتری» زیر که مسیر تخت/قدیمی رو
      پشتیبانی می‌کنه. */}
      {canSetMarkup && (
        <PricingWorkspace
          inquiry={inquiry}
          canManagePricing={canSetMarkup}
          defaultCurrencyCode={baseCurrencyDraft || totalsEntries[0]?.[0] || ""}
          locked={locked}
        />
      )}

      {/* گزینه‌های ترم تحویل */}
      <div className="rounded-xl p-5 bg-surface border border-border shadow-card">
        <p className="text-sm font-semibold mb-1 text-textPrimary">گزینه‌های ترم تحویل به مشتری</p>
        <p className="text-xs mb-3 text-textSecondary">
          می‌تونی چند ترم هم‌زمان پیشنهاد بدی (مثلاً هم EXW هم CPT هم DDP) — هرکدوم هزینه اضافه و زمان تحویل مخصوص خودشو داره.
        </p>

        <div className="space-y-2 mb-3">
          {deliveryDraft.map((opt, idx) => {
            // ⚠️ باگ قبلی: هزینه اضافه فقط برای ردیف idx===0 به ارزش کل اضافه می‌شد (نه هر ردیف)
            const totalLine = totalsEntries.map(([cur, val]) => `${fmt(val + opt.extraCost)} ${cur}`).join(" + ");
            return (
              <div key={idx} className="flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 bg-bg">
                <Select
                  disabled={locked || !canSetMarkup}
                  value={opt.deliveryTerm}
                  onChange={(e) => updateDeliveryRow(idx, { deliveryTerm: e.target.value as DeliveryTerm })}
                  className="!w-24 !py-1.5 text-xs"
                >
                  {DELIVERY_TERMS.map((term) => (
                    <option key={term} value={term}>{term}</option>
                  ))}
                </Select>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-textSecondary">هزینه اضافه:</span>
                  <AmountInput
                    disabled={locked || !canSetMarkup}
                    value={opt.extraCost}
                    onChange={(n) => updateDeliveryRow(idx, { extraCost: n ?? 0 })}
                    className="!w-20 font-mono"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-textSecondary">زمان تحویل:</span>
                  <DeliveryTimeInput
                    disabled={locked || !canSetMarkup}
                    valueDays={opt.deliveryDays}
                    onChange={(days) => updateDeliveryRow(idx, { deliveryDays: days })}
                  />
                </div>
                {totalLine && (
                  <span className="font-mono text-xs font-semibold px-2 py-1 rounded bg-accentSoft text-accent" dir="ltr">
                    ارزش کل: {totalLine}
                  </span>
                )}
                {!locked && canSetMarkup && (
                  <button
                    type="button"
                    onClick={() => setDeliveryDraft((c) => c.filter((_, i) => i !== idx))}
                    className="mr-auto text-danger"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {!locked && canSetMarkup && (
          <div className="flex gap-2">
            <GhostButton
              onClick={() => setDeliveryDraft((c) => [...c, { deliveryTerm: "EXW", extraCost: 0, deliveryDays: 30 }])}
            >
              <span className="flex items-center gap-1.5"><Plus size={13} /> افزودن گزینه ترم دیگر</span>
            </GhostButton>
            <PrimaryButton onClick={saveDelivery} disabled={saveDeliveryOptions.isPending}>
              {saveDeliveryOptions.isPending ? "در حال ذخیره..." : "ذخیره ترم‌ها"}
            </PrimaryButton>
          </div>
        )}
      </div>

      {/* یادداشت مدیر */}
      <div className="rounded-xl p-5 bg-surface border border-border shadow-card">
        <p className="text-sm font-semibold mb-1 text-textPrimary">یادداشت مدیر برای بخش فروش</p>
        <p className="text-xs mb-3 text-textSecondary">
          این یادداشت وقتی کارشناس فروش وارد تب «پیشنهاد به مشتری» بشه بهش نشون داده می‌شه.
        </p>
        <TextArea
          disabled={locked || !canLock}
          rows={2}
          value={managerNote}
          onChange={(e) => setManagerNote(e.target.value)}
          placeholder="یادداشت برای کارشناس فروش..."
        />
      </div>

      {canLock && (
        <div className="flex justify-end">
          {locked ? (
            <button
              onClick={handleUnlock}
              disabled={unlock.isPending}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-textSecondary shadow-xs transition-all duration-150 hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
            >
              بازگشایی برای اصلاح
            </button>
          ) : (
            <button
              onClick={handleLock}
              disabled={lock.isPending}
              className="px-5 py-2.5 rounded-lg text-sm font-medium text-white bg-success shadow-xs transition-all duration-150 hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
            >
              تأیید و قفل انتخاب نهایی
            </button>
          )}
        </div>
      )}
      {locked && (
        <p className="text-xs text-left text-success flex items-center justify-end gap-1.5">
          <Lock size={12} />
          این مرحله قفل شد؛ کارشناس فروش حالا می‌تونه پیشنهاد مالی/فنی رو تولید کنه.
          {data.selectionLocker && ` (توسط ${data.selectionLocker.fullName})`}
        </p>
      )}
    </div>
  );
}
