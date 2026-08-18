import { useEffect, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Download, FileText, History, Info, Send } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { hasPermission } from "../../lib/permissions";
import { GhostButton, PrimaryButton, Select, TextArea, TextInput } from "../../components/ui/fields";
import { DualDateInput } from "../../components/ui/DualDateInput";
import { DeliveryTimeInput } from "../../components/ui/DeliveryTimeInput";
import { InquiryDetail } from "./inquiry-types";
import { downloadFile } from "./inquiries-api";
import { useCurrencies, useOurEntities } from "./rfqs-api";
import { DELIVERY_TERMS, DeliveryTerm, IncotermOption, SALES_ADJUSTMENT_REASONS } from "./selection-types";
import { useProposal, useProposalHistory, useProposalMutations } from "./proposal-api";
import {
  FinancialProposal,
  ProposalBaselineItem,
  PROPOSAL_DOCUMENT_CHECKLIST_ITEMS,
  TechnicalProposal,
} from "./proposal-types";

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

// فاز ۵۶ — بازخورد کاربر (باگ واقعی): واحد انتخابی کاربر (روز/هفته) در DeliveryTimeInput
// هیچ‌جا ذخیره نمی‌شد، پس همه‌جا (پیش‌نمایش UI و سند تولیدی) همیشه به روز نشون داده می‌شد.
// این تابع دقیقاً هم‌فرمول formatDeliveryDuration سمت سرور رو تکرار می‌کنه.
function formatDeliveryDuration(days: number | null, unit: "day" | "week"): string {
  if (days == null) return "";
  if (unit === "week") {
    const weeks = Math.round((days / 7) * 10) / 10;
    return `${weeks} هفته`;
  }
  return `${days} روز`;
}

// فاز ۵۳ — پیش‌نمایش زنده‌ی توزیع هزینه ترم تحویل روی state محلی فرم (قبل از «ذخیره») —
// دقیقاً هم‌فرمول distributeDeliveryExtraCost سمت سرور، تا با تغییر ترم/هزینه/قیمت هر قلم
// بدون نیاز به رفت‌وبرگشت به سرور، عدد «ارزش کل» بلافاصله به‌روز بشه
function computeDeliveryDistribution(
  rows: Array<{ inquiryItemId: string; unitPrice: number; quantity: number }>,
  extraCost: number,
): { subTotal: number; grandTotal: number; byItemId: Map<string, number> } {
  const subTotal = rows.reduce((sum, r) => sum + r.unitPrice * r.quantity, 0);
  const byItemId = new Map<string, number>();
  for (const row of rows) {
    const lineTotal = row.unitPrice * row.quantity;
    const share = extraCost > 0 && subTotal > 0 ? (lineTotal / subTotal) * extraCost : 0;
    byItemId.set(row.inquiryItemId, row.quantity > 0 ? row.unitPrice + share / row.quantity : row.unitPrice);
  }
  return { subTotal, grandTotal: subTotal + extraCost, byItemId };
}

function extractError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } } | null)?.response?.data
    ?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? fallback);
}

// فاز ۴۰-و: کلیک روی یک نسخه در تاریخچه، جزئیات کامل همون نسخه رو باز/بسته می‌کنه + امکان دانلود مجدد فایل تولیدشده‌ی همون نسخه
function HistoryVersionRow({
  row,
  kind,
  baselineByRow,
}: {
  row: FinancialProposal | TechnicalProposal;
  kind: "financial" | "technical";
  baselineByRow: Map<string, ProposalBaselineItem>;
}) {
  const [open, setOpen] = useState(false);
  const financial = kind === "financial" ? (row as FinancialProposal) : null;
  const technical = kind === "technical" ? (row as TechnicalProposal) : null;

  return (
    <div className="rounded-lg bg-bg text-xs overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-right"
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-mono text-textPrimary" dir="ltr">{row.proposalNumber}</span>
            <span className={row.status === "current" ? "text-accent" : "text-textSecondary"}>
              {row.status === "current" ? "فعلی" : "جایگزین‌شده"}
            </span>
          </div>
          <p className="text-textSecondary mt-0.5">
            {row.sentAt ? `ارسال‌شده در ${new Date(row.sentAt).toLocaleDateString("fa-IR")}` : "ارسال نشده"}
          </p>
        </div>
        {open ? <ChevronUp size={14} className="shrink-0 text-textSecondary" /> : <ChevronDown size={14} className="shrink-0 text-textSecondary" />}
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/60 pt-2">
          {financial && (
            <p className="text-textPrimary">
              ترم {financial.chosenDeliveryTerm} · {formatDeliveryDuration(financial.deliveryDays, financial.deliveryDaysUnit)} · ارز {financial.currencyCode}
            </p>
          )}
          {technical && technical.deliveryTimeEstimateDays != null && (
            <p className="text-textPrimary">زمان تحویل تخمینی: {formatDeliveryDuration(technical.deliveryTimeEstimateDays, technical.deliveryDaysUnit)}</p>
          )}

          <div className="space-y-1.5">
            {financial &&
              financial.items.map((i) => (
                <div key={i.inquiryItemId} className="flex items-center gap-2 rounded-lg px-2.5 py-1.5 bg-surface">
                  <span className="font-mono flex-1" dir="ltr">{baselineByRow.get(i.inquiryItemId)?.itemCode}</span>
                  <span className="font-mono font-semibold" dir="ltr">
                    {fmt(i.priceWithDelivery)} {financial.currencyCode}
                  </span>
                </div>
              ))}
            {financial && financial.deliveryExtraCost > 0 && (
              <div className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 bg-accentSoft">
                <span>ارزش کل نهایی (شامل هزینه ترم تحویل)</span>
                <span className="font-mono font-semibold text-accent" dir="ltr">
                  {fmt(financial.totalAmountWithDelivery)} {financial.currencyCode}
                </span>
              </div>
            )}
            {technical &&
              technical.items.map((i) => (
                <div key={i.inquiryItemId} className="rounded-lg px-2.5 py-1.5 bg-surface">
                  <span className="font-mono" dir="ltr">{baselineByRow.get(i.inquiryItemId)?.itemCode}</span>
                  {i.technicalSpecs && <p className="text-textSecondary mt-0.5">{i.technicalSpecs}</p>}
                </div>
              ))}
          </div>

          {financial?.paymentTerms && <p className="text-textSecondary">شرایط پرداخت: {financial.paymentTerms}</p>}
          {financial?.paymentMethod && <p className="text-textSecondary">روش پرداخت: {financial.paymentMethod}</p>}
          {financial?.remarks && <p className="text-textSecondary">ملاحظات: {financial.remarks}</p>}
          {row.negotiationNote && <p className="text-textSecondary">یادداشت مذاکره: {row.negotiationNote}</p>}

          {row.fileUrl ? (
            <button
              type="button"
              onClick={() => downloadFile(row.fileUrl as string, `${row.proposalNumber}`)}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg text-white bg-accent"
            >
              <Download size={13} /> دانلود فایل این نسخه
            </button>
          ) : (
            <p className="text-textSecondary">برای این نسخه هنوز فایلی تولید نشده است.</p>
          )}
        </div>
      )}
    </div>
  );
}

function HistoryModal({
  inquiryId,
  kind,
  baselineByRow,
  onClose,
}: {
  inquiryId: string;
  kind: "financial" | "technical";
  baselineByRow: Map<string, ProposalBaselineItem>;
  onClose: () => void;
}) {
  const { data } = useProposalHistory(inquiryId, kind, true);
  return (
    <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-surface rounded-lg border border-border p-4 max-w-lg w-full max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <p className="text-sm font-semibold mb-3 text-textPrimary">
          تاریخچه نسخه‌های پیشنهاد {kind === "financial" ? "مالی" : "فنی"}
        </p>
        <div className="space-y-2">
          {(data ?? []).map((row) => (
            <HistoryVersionRow key={row.id} row={row} kind={kind} baselineByRow={baselineByRow} />
          ))}
          {(data ?? []).length === 0 && <p className="text-textSecondary text-xs">تاریخچه‌ای وجود ندارد.</p>}
        </div>
        <div className="flex justify-end mt-3">
          <GhostButton onClick={onClose}>بستن</GhostButton>
        </div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// فاز ۶۰ (اصلاح — بازخورد کاربر) — نمایش فقط‌خواندنی قیمت بازرگانی هر گزینه Incoterm + اصلاح
// فروش (Sales Adjustment) + تولید سند. ⚠️ مارک‌آپ/هزینه‌های اضافی/گزینه‌های ترم تحویل اینجا هرگز
// مدیریت نمی‌شن — اون‌ها منحصراً در تب «انتخاب نهایی و قیمت‌گذاری» (SelectionTab) هستن؛ این
// کامپوننت فقط نتیجه‌ی محاسبه‌شده رو می‌خونه و روش یک اصلاح نهایی (تخفیف/افزایش) اعمال می‌کنه.
// ------------------------------------------------------------

function SalesAdjustmentRow({
  item,
  optionId,
  optionCurrency,
  inquiryId,
  canAdjustSales,
}: {
  item: IncotermOption["items"][number];
  optionId: string;
  optionCurrency: string;
  inquiryId: string;
  canAdjustSales: boolean;
}) {
  const mutations = useProposalMutations(inquiryId);
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState(String(item.salesAdjustmentAmount));
  const [adjustReason, setAdjustReason] = useState(item.salesAdjustmentReasonCode ?? "");
  const [adjustNote, setAdjustNote] = useState(item.salesAdjustmentNote ?? "");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    setAdjustAmount(String(item.salesAdjustmentAmount));
    setAdjustReason(item.salesAdjustmentReasonCode ?? "");
    setAdjustNote(item.salesAdjustmentNote ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.salesAdjustmentAmount, item.salesAdjustmentReasonCode, item.salesAdjustmentNote]);

  async function saveAdjustment() {
    setErrorMsg(null);
    const amount = parseFloat(adjustAmount || "0");
    if (Number.isNaN(amount)) {
      setErrorMsg("مبلغ اصلاح نامعتبره");
      return;
    }
    try {
      await mutations.saveSalesAdjustment.mutateAsync({
        optionId,
        body: {
          inquiryItemId: item.inquiryItemId,
          adjustmentAmount: amount,
          reasonCode: (adjustReason || undefined) as never,
          note: adjustNote || undefined,
        },
      });
      setAdjustOpen(false);
    } catch (err) {
      setErrorMsg(extractError(err, "ثبت اصلاح قیمت ناموفق بود"));
    }
  }

  const isPendingApproval = item.finalSalePrice === item.commercialCalculatedPrice && item.salesAdjustmentAmount !== 0;

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
          <div className="flex flex-col gap-0.5 text-xs" dir="ltr">
            <span className="text-textSecondary">
              قیمت بازرگانی (فقط‌خواندنی):{" "}
              <span className="font-mono text-textPrimary font-medium">
                {item.commercialCalculatedPrice != null ? fmt(item.commercialCalculatedPrice) : "—"} {optionCurrency}
              </span>
            </span>
            {item.salesAdjustmentAmount !== 0 && (
              <span className="text-textSecondary">
                اصلاح فروش:{" "}
                <span className={`font-mono font-medium ${item.salesAdjustmentAmount < 0 ? "text-danger" : "text-success"}`}>
                  {item.salesAdjustmentAmount > 0 ? "+" : ""}
                  {fmt(item.salesAdjustmentAmount)} {optionCurrency}
                </span>
              </span>
            )}
            <span className="text-textPrimary font-semibold">
              قیمت نهایی مشتری: <span className="font-mono">{fmt(item.finalSalePrice)} {optionCurrency}</span>
            </span>
            {isPendingApproval && (
              <span className="text-warning text-[10.5px]">در انتظار تأیید مدیر برای کاهش قیمت</span>
            )}
          </div>

          {canAdjustSales && (
            <GhostButton type="button" onClick={() => setAdjustOpen((v) => !v)} className="py-1.5 px-2.5 mr-auto">
              اصلاح قیمت فروش
            </GhostButton>
          )}
        </div>

        {errorMsg && <p className="text-xs text-danger">{errorMsg}</p>}

        {adjustOpen && (
          <div className="rounded-lg p-2.5 bg-surface border border-border space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div>
                <label className="block text-[10.5px] text-textSecondary mb-1">مبلغ اصلاح (مثبت یا منفی)</label>
                <TextInput value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} dir="ltr" className="font-mono text-xs" />
              </div>
              <Select value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)}>
                <option value="">دلیل اصلاح (اختیاری)...</option>
                {SALES_ADJUSTMENT_REASONS.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.label}
                  </option>
                ))}
              </Select>
            </div>
            <TextArea
              placeholder="یادداشت آزاد (اختیاری)"
              value={adjustNote}
              onChange={(e) => setAdjustNote(e.target.value)}
              rows={2}
            />
            <div className="flex items-center gap-2">
              <PrimaryButton type="button" onClick={saveAdjustment} disabled={mutations.saveSalesAdjustment.isPending}>
                ثبت اصلاح قیمت
              </PrimaryButton>
              <GhostButton type="button" onClick={() => setAdjustOpen(false)}>
                انصراف
              </GhostButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CustomerPricingOptions({
  inquiry,
  options,
  canAdjustSales,
}: {
  inquiry: InquiryDetail;
  options: IncotermOption[];
  canAdjustSales: boolean;
}) {
  const mutations = useProposalMutations(inquiry.id);
  const [activeId, setActiveId] = useState<string | null>(options[0]?.id ?? null);
  const [docFormat, setDocFormat] = useState<"pdf" | "xlsx">("pdf");
  const [docLang, setDocLang] = useState<"fa" | "en">("fa");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!options.some((o) => o.id === activeId)) {
      setActiveId(options[0]?.id ?? null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options.map((o) => o.id).join(",")]);

  if (options.length === 0) {
    return (
      <div className="rounded-xl p-5 bg-surface border border-border shadow-card">
        <p className="text-sm font-semibold text-textPrimary mb-1">قیمت‌گذاری بازرگانی به تفکیک ترم تحویل</p>
        <p className="text-xs text-textSecondary">
          هنوز هیچ گزینه ترم تحویل قیمت‌گذاری‌شده‌ای وجود نداره. تعیین حاشیه سود («مارک‌آپ») و افزودن گزینه‌های Incoterm
          در تب «انتخاب نهایی و قیمت‌گذاری» انجام می‌شه.
        </p>
      </div>
    );
  }

  const activeOption = options.find((o) => o.id === activeId) ?? null;

  async function generateOptionDoc() {
    if (!activeOption) return;
    setErrorMsg(null);
    try {
      const result = await mutations.generateFinancialDoc.mutateAsync({
        format: docFormat,
        lang: docLang,
        deliveryOptionId: activeOption.id,
      });
      await downloadFile(result.fileUrl, result.fileName);
    } catch (err) {
      setErrorMsg(extractError(err, "خطا در تولید سند این گزینه"));
    }
  }

  return (
    <div className="rounded-xl p-5 bg-surface border border-border shadow-card">
      <p className="text-sm font-semibold text-textPrimary mb-3">قیمت‌گذاری بازرگانی به تفکیک ترم تحویل</p>

      <div className="flex flex-wrap gap-1.5 mb-4 border-b border-border pb-3">
        {options.map((o) => (
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
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2.5 bg-bg">
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <span className="text-textSecondary">
                ارز: <span className="font-mono text-textPrimary">{activeOption.currencyCode}</span>
              </span>
              <span className="text-textSecondary">
                زمان تحویل: <span className="font-mono text-textPrimary">{activeOption.deliveryDays} روز</span>
              </span>
              {activeOption.incotermLocation && (
                <span className="text-textSecondary">
                  محل تحویل: <span className="text-textPrimary">{activeOption.incotermLocation}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <Select value={docFormat} onChange={(e) => setDocFormat(e.target.value as "pdf" | "xlsx")} className="!w-20 !py-1.5 text-[11px]">
                <option value="pdf">PDF</option>
                <option value="xlsx">Excel</option>
              </Select>
              <Select value={docLang} onChange={(e) => setDocLang(e.target.value as "fa" | "en")} className="!w-20 !py-1.5 text-[11px]">
                <option value="fa">فارسی</option>
                <option value="en">English</option>
              </Select>
              <button
                type="button"
                onClick={generateOptionDoc}
                disabled={mutations.generateFinancialDoc.isPending}
                className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg text-white bg-accent disabled:opacity-60"
              >
                <FileText size={12} /> {mutations.generateFinancialDoc.isPending ? "در حال تولید..." : "دریافت فایل این گزینه"}
              </button>
            </div>
          </div>

          {errorMsg && <p className="text-xs text-danger">{errorMsg}</p>}

          <div className="space-y-2">
            {activeOption.items.map((item) => (
              <SalesAdjustmentRow
                key={item.id}
                item={item}
                optionId={activeOption.id}
                optionCurrency={activeOption.currencyCode}
                inquiryId={inquiry.id}
                canAdjustSales={canAdjustSales}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ProposalTab({ inquiry }: { inquiry: InquiryDetail }) {
  const { user } = useAuth();
  const canView = hasPermission(user, "proposal.view");
  const canEdit = hasPermission(user, "proposal.edit_price");
  const canGenerate = hasPermission(user, "proposal.generate");
  const canSend = hasPermission(user, "proposal.send_final");

  const { data, isLoading, isError, error } = useProposal(inquiry.id);
  const { data: currencies } = useCurrencies();
  const { data: ourEntities } = useOurEntities();
  const mutations = useProposalMutations(inquiry.id);

  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [reviseOpen, setReviseOpen] = useState(false);
  const [reviseCurrency, setReviseCurrency] = useState("");
  const [reviseRate, setReviseRate] = useState("");
  // فاز ۵۷ — نرخ تبدیل وقتی ارز پیش‌نویس (هنوز ارسال‌نشده) عوض می‌شه
  const [finExchangeRate, setFinExchangeRate] = useState("");
  const [historyOpen, setHistoryOpen] = useState<"financial" | "technical" | null>(null);

  const [finDraft, setFinDraft] = useState<{
    ourEntityId: string;
    chosenDeliveryTerm: DeliveryTerm;
    deliveryDays: string;
    deliveryDaysUnit: "day" | "week";
    incotermLocation: string;
    shippingMethod: string;
    currencyCode: string;
    paymentTerms: string;
    proposalValidityDate: string | null;
    negotiationNote: string;
    paymentMethod: string;
    partialShipmentAllowed: boolean;
    documentsChecklist: string[];
    serviceTest: string;
    serviceFieldService: string;
    serviceDesign: string;
    warrantyTerms: string;
    remarks: string;
    // فاز ۳۵-ج: markupPercent از فرم ویرایش حذف شد — کارشناس فروش فقط قیمت نهایی رو مستقیم اصلاح می‌کنه
    items: Record<string, { finalSalePrice: string }>;
  } | null>(null);

  const [techDraft, setTechDraft] = useState<{
    ourEntityId: string;
    chosenDeliveryTerm: DeliveryTerm;
    deliveryTimeEstimateDays: string;
    deliveryDaysUnit: "day" | "week";
    negotiationNote: string;
    items: Record<string, { technicalSpecs: string; complianceNote: string }>;
  } | null>(null);

  useEffect(() => {
    if (!data) return;
    setFinDraft({
      ourEntityId: data.financial.ourEntityId ?? "",
      chosenDeliveryTerm: data.financial.chosenDeliveryTerm,
      deliveryDays: String(data.financial.deliveryDays),
      deliveryDaysUnit: data.financial.deliveryDaysUnit,
      incotermLocation: data.financial.incotermLocation ?? "",
      shippingMethod: data.financial.shippingMethod ?? "",
      currencyCode: data.financial.currencyCode,
      paymentTerms: data.financial.paymentTerms ?? "",
      proposalValidityDate: data.financial.proposalValidityDate,
      negotiationNote: data.financial.negotiationNote ?? "",
      paymentMethod: data.financial.paymentMethod ?? "",
      partialShipmentAllowed: data.financial.partialShipmentAllowed ?? true,
      documentsChecklist: data.financial.documentsChecklist ?? [],
      serviceTest: data.financial.serviceTest ?? "",
      serviceFieldService: data.financial.serviceFieldService ?? "",
      serviceDesign: data.financial.serviceDesign ?? "",
      warrantyTerms: data.financial.warrantyTerms ?? "",
      remarks: data.financial.remarks ?? "",
      items: Object.fromEntries(
        data.financial.items.map((i) => [i.inquiryItemId, { finalSalePrice: String(i.finalSalePrice) }]),
      ),
    });
    setFinExchangeRate("");
    setTechDraft({
      ourEntityId: data.technical.ourEntityId ?? "",
      chosenDeliveryTerm: data.technical.chosenDeliveryTerm ?? data.financial.chosenDeliveryTerm,
      deliveryTimeEstimateDays: String(data.technical.deliveryTimeEstimateDays ?? data.financial.deliveryDays),
      deliveryDaysUnit: data.technical.deliveryDaysUnit,
      negotiationNote: data.technical.negotiationNote ?? "",
      items: Object.fromEntries(
        data.technical.items.map((i) => [
          i.inquiryItemId,
          { technicalSpecs: i.technicalSpecs ?? "", complianceNote: i.complianceNote ?? "" },
        ]),
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.financial.id, data?.financial.version, data?.technical.id, data?.technical.version]);

  if (!canView) {
    return <div className="rounded-xl bg-surface border border-border shadow-card py-10 text-center"><p className="text-xs text-textSecondary">دسترسی به این بخش ندارید.</p></div>;
  }
  if (isLoading) return <div className="space-y-3"><div className="h-10 rounded-xl skeleton" /><div className="h-32 rounded-xl skeleton" /></div>;
  if (isError) {
    return (
      <div className="rounded-lg px-4 py-3 text-xs flex items-center gap-2 bg-warningSoft text-textPrimary">
        <Info size={14} className="shrink-0" />
        {extractError(error, "ابتدا باید مرحله «انتخاب نهایی» توسط مدیریت قفل بشه")}
      </div>
    );
  }
  if (!data || !finDraft || !techDraft) {
    return <div className="space-y-3"><div className="h-10 rounded-xl skeleton" /><div className="h-32 rounded-xl skeleton" /></div>;
  }

  const baselineByRow = new Map(data.baselineItems.map((i) => [i.inquiryItemId, i]));
  // فاز ۳۵-ج: برای نشون‌دادن نشان «در انتظار تأیید مدیر» کنار هر ردیف
  const financialItemsByRow = new Map(data.financial.items.map((i) => [i.inquiryItemId, i]));

  async function saveFinancial() {
    if (!finDraft || !data) return;
    try {
      setErrorMsg(null);
      await mutations.saveFinancial.mutateAsync({
        ourEntityId: finDraft.ourEntityId || undefined,
        chosenDeliveryTerm: finDraft.chosenDeliveryTerm,
        deliveryDays: parseInt(finDraft.deliveryDays, 10) || 1,
        deliveryDaysUnit: finDraft.deliveryDaysUnit,
        incotermLocation: finDraft.incotermLocation || undefined,
        shippingMethod: finDraft.shippingMethod || undefined,
        currencyCode: finDraft.currencyCode,
        // فاز ۵۷ — فقط وقتی ارز واقعاً عوض شده لازمه
        exchangeRate:
          finDraft.currencyCode !== data.financial.currencyCode ? parseFloat(finExchangeRate) || undefined : undefined,
        paymentTerms: finDraft.paymentTerms || undefined,
        proposalValidityDate: finDraft.proposalValidityDate || undefined,
        negotiationNote: finDraft.negotiationNote || undefined,
        paymentMethod: finDraft.paymentMethod || undefined,
        partialShipmentAllowed: finDraft.partialShipmentAllowed,
        documentsChecklist: finDraft.documentsChecklist,
        serviceTest: finDraft.serviceTest || undefined,
        serviceFieldService: finDraft.serviceFieldService || undefined,
        serviceDesign: finDraft.serviceDesign || undefined,
        warrantyTerms: finDraft.warrantyTerms || undefined,
        remarks: finDraft.remarks || undefined,
        items: Object.entries(finDraft.items).map(([inquiryItemId, v]) => ({
          inquiryItemId,
          finalSalePrice: v.finalSalePrice ? parseFloat(v.finalSalePrice) : undefined,
        })),
      });
      setFinExchangeRate("");
      setNotice("پیشنهاد مالی ذخیره شد");
      setTimeout(() => setNotice(null), 1500);
    } catch (err) {
      setErrorMsg(extractError(err, "خطا در ذخیره پیشنهاد مالی"));
    }
  }

  // فاز ۳۵-ج — انصراف: فرم رو به آخرین مقدار ذخیره‌شده روی سرور برمی‌گردونه (بدون تماس شبکه)
  function cancelFinancialEdits() {
    if (!data) return;
    setFinExchangeRate("");
    setFinDraft({
      ourEntityId: data.financial.ourEntityId ?? "",
      chosenDeliveryTerm: data.financial.chosenDeliveryTerm,
      deliveryDays: String(data.financial.deliveryDays),
      deliveryDaysUnit: data.financial.deliveryDaysUnit,
      incotermLocation: data.financial.incotermLocation ?? "",
      shippingMethod: data.financial.shippingMethod ?? "",
      currencyCode: data.financial.currencyCode,
      paymentTerms: data.financial.paymentTerms ?? "",
      proposalValidityDate: data.financial.proposalValidityDate,
      negotiationNote: data.financial.negotiationNote ?? "",
      paymentMethod: data.financial.paymentMethod ?? "",
      partialShipmentAllowed: data.financial.partialShipmentAllowed ?? true,
      documentsChecklist: data.financial.documentsChecklist ?? [],
      serviceTest: data.financial.serviceTest ?? "",
      serviceFieldService: data.financial.serviceFieldService ?? "",
      serviceDesign: data.financial.serviceDesign ?? "",
      warrantyTerms: data.financial.warrantyTerms ?? "",
      remarks: data.financial.remarks ?? "",
      items: Object.fromEntries(
        data.financial.items.map((i) => [i.inquiryItemId, { finalSalePrice: String(i.finalSalePrice) }]),
      ),
    });
    setErrorMsg(null);
  }

  async function saveTechnical() {
    if (!techDraft) return;
    try {
      setErrorMsg(null);
      await mutations.saveTechnical.mutateAsync({
        ourEntityId: techDraft.ourEntityId || undefined,
        chosenDeliveryTerm: techDraft.chosenDeliveryTerm,
        deliveryTimeEstimateDays: Number(techDraft.deliveryTimeEstimateDays) || 1,
        deliveryDaysUnit: techDraft.deliveryDaysUnit,
        negotiationNote: techDraft.negotiationNote || undefined,
        items: Object.entries(techDraft.items).map(([inquiryItemId, v]) => ({
          inquiryItemId,
          technicalSpecs: v.technicalSpecs || undefined,
          complianceNote: v.complianceNote || undefined,
        })),
      });
      setNotice("پیشنهاد فنی ذخیره شد");
      setTimeout(() => setNotice(null), 1500);
    } catch (err) {
      setErrorMsg(extractError(err, "خطا در ذخیره پیشنهاد فنی"));
    }
  }

  // فاز ۳۹: یک کلیک — تولید سند و بلافاصله دانلود، بدون نیاز به مرحله جدای «دانلود» بعدش
  // فاز ۴۵: قبلش اگه فرم هنوز قابل‌ویرایشه (ذخیره نشده)، اول خودکار ذخیره می‌شه — وگرنه سرور
  // از آخرین مقدار ذخیره‌شده (نه انتخاب تازه‌ی کاربر در دراپ‌داون «شرکت صادرکننده اسناد») سند می‌سازه
  async function generateFinancialDoc(format: "pdf" | "xlsx", lang: "fa" | "en") {
    try {
      setErrorMsg(null);
      if (canEdit && !data!.financial.sentAt) {
        await saveFinancial();
      }
      const result = await mutations.generateFinancialDoc.mutateAsync({ format, lang });
      await downloadFile(result.fileUrl, result.fileName);
    } catch (err) {
      setErrorMsg(extractError(err, "خطا در تولید سند"));
    }
  }

  // فاز ۴۵: هم‌الگوی generateFinancialDoc — ذخیره‌ی خودکار قبل از تولید سند
  async function generateTechnicalDoc(format: "pdf" | "xlsx", lang: "fa" | "en") {
    try {
      setErrorMsg(null);
      if (canEdit && !data!.technical.sentAt) {
        await saveTechnical();
      }
      const result = await mutations.generateTechnicalDoc.mutateAsync({ format, lang });
      await downloadFile(result.fileUrl, result.fileName);
    } catch (err) {
      setErrorMsg(extractError(err, "خطا در تولید سند"));
    }
  }

  const finItemsTotal = Object.entries(finDraft.items).reduce(
    (sum, [id, v]) => sum + (parseFloat(v.finalSalePrice) || 0) * (baselineByRow.get(id)?.quantity ?? 0),
    0,
  );

  // فاز ۵۳ — توزیع هزینه ترم تحویل انتخاب‌شده‌ی فعلی بین اقلام، برای پیش‌نمایش زنده در فرم
  const chosenExtraCost = data.deliveryOptions.find((o) => o.deliveryTerm === finDraft.chosenDeliveryTerm)?.extraCost ?? 0;
  const finDeliveryDistribution = computeDeliveryDistribution(
    Object.entries(finDraft.items).map(([id, v]) => ({
      inquiryItemId: id,
      unitPrice: parseFloat(v.finalSalePrice) || 0,
      quantity: baselineByRow.get(id)?.quantity ?? 0,
    })),
    chosenExtraCost,
  );

  return (
    <div className="space-y-4">
      {data.managerNoteToSales && (
        <div className="rounded-lg px-4 py-2.5 text-xs bg-accentSoft text-textPrimary">
          <span className="font-medium">یادداشت مدیر: </span>
          {data.managerNoteToSales}
        </div>
      )}

      {errorMsg && <p className="text-xs text-danger">{errorMsg}</p>}
      {notice && <p className="text-xs text-success">{notice}</p>}

      {/* مشخصات نهایی فقط‌خواندنی از مرحله انتخاب نهایی — ⚠️ فاز ۳۵-ب: قیمت خرید اینجا نمایش داده نمی‌شه */}
      <div className="rounded-xl p-5 bg-surface border border-border shadow-card">
        <p className="text-sm font-semibold mb-3 text-textPrimary">
          مشخصات نهایی (فقط‌خواندنی — از مرحله «انتخاب نهایی»)
        </p>
        <div className="space-y-1.5 mb-3">
          {data.baselineItems.map((row: ProposalBaselineItem) => (
            <div key={row.inquiryItemId} className="flex flex-wrap items-center gap-3 rounded-lg px-3 py-2 bg-bg">
              <span className="font-mono text-xs text-textSecondary" dir="ltr">{row.itemCode}</span>
              <span className="text-xs text-textPrimary">{row.description}</span>
              {row.supplierName && (
                <span className="text-[11px] px-2 py-0.5 rounded-full mr-auto bg-successSoft text-success">
                  {row.supplierName}
                </span>
              )}
              {row.baselineFinalSalePrice != null && (
                <span className="font-mono text-xs font-semibold text-primary" dir="ltr">
                  قیمت پایه تعیین‌شده مدیریت: {fmt(row.baselineFinalSalePrice)}
                </span>
              )}
            </div>
          ))}
        </div>
        <p className="text-xs font-medium mb-1.5 text-textSecondary">گزینه‌های ترم تحویل تعیین‌شده توسط مدیریت:</p>
        <div className="flex flex-wrap gap-2">
          {data.deliveryOptions.map((opt) => (
            <span key={opt.deliveryTerm} className="font-mono text-xs px-2.5 py-1 rounded-lg bg-bg text-textPrimary" dir="ltr">
              {opt.deliveryTerm}: +{fmt(opt.extraCost)} · {opt.deliveryDays} روز
            </span>
          ))}
        </div>
      </div>

      {/* فاز ۶۰ (اصلاح — بازخورد کاربر) — نمایش فقط‌خواندنی قیمت‌های بازرگانی محاسبه‌شده به تفکیک
      هر گزینه Incoterm («یک پیشنهاد، چند Incoterm») + اصلاح فروش. مدیریت مارک‌آپ/هزینه اضافی/
      افزودن گزینه در تب «انتخاب نهایی و قیمت‌گذاری» انجام می‌شه، نه اینجا. جدا از فرم پیشنهاد
      مالی زیر که همچنان مسیر تک‌ترمی/قدیمی رو نگه می‌داره (سازگاری کامل با پیشنهادهای قبل از این فاز) */}
      <CustomerPricingOptions
        inquiry={inquiry}
        options={data.financial.pricingDeliveryOptions}
        canAdjustSales={canEdit}
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* پیشنهاد مالی */}
        <div className="rounded-xl p-5 bg-surface border border-border shadow-card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-textPrimary">پیشنهاد مالی</p>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-accentSoft text-accent" dir="ltr">
              نسخه {data.financial.version} · {data.financial.sentAt ? "ارسال‌شده" : "پیش‌نویس"}
            </span>
          </div>

          {data.financial.currencyWarnings.length > 0 && (
            <div className="rounded-lg px-3 py-2 mb-3 text-[11px] flex items-start gap-1.5 bg-warningSoft text-warning">
              <AlertTriangle size={13} className="shrink-0 mt-0.5" />
              <div>{data.financial.currencyWarnings.join("؛ ")}</div>
            </div>
          )}

          {data.financial.sentAt ? (
            <FinancialReadOnly proposal={data.financial} baselineByRow={baselineByRow} />
          ) : (
            <>
              <label className="block text-[11px] mb-1 text-textSecondary">شرکت صادرکننده اسناد</label>
              <Select
                disabled={!canEdit}
                value={finDraft.ourEntityId}
                onChange={(e) => setFinDraft((d) => (d ? { ...d, ourEntityId: e.target.value } : d))}
                className="!py-1.5 text-xs mb-2"
              >
                {(ourEntities ?? []).map((oe) => (
                  <option key={oe.id} value={oe.id}>{oe.entityName}</option>
                ))}
              </Select>

              <label className="block text-[11px] mb-1 text-textSecondary">ترم تحویل این پیشنهاد</label>
              <Select
                disabled={!canEdit}
                value={finDraft.chosenDeliveryTerm}
                onChange={(e) => {
                  const term = e.target.value as DeliveryTerm;
                  const opt = data.deliveryOptions.find((o) => o.deliveryTerm === term);
                  setFinDraft((d) => (d ? { ...d, chosenDeliveryTerm: term, deliveryDays: opt ? String(opt.deliveryDays) : d.deliveryDays } : d));
                }}
                className="!py-1.5 text-xs mb-2"
              >
                {(data.deliveryOptions.length > 0 ? data.deliveryOptions : DELIVERY_TERMS.map((t) => ({ deliveryTerm: t, extraCost: 0 }))).map((o) => (
                  <option key={o.deliveryTerm} value={o.deliveryTerm}>
                    {o.deliveryTerm} — ارزش کل {fmt(finItemsTotal + o.extraCost)} {finDraft.currencyCode}
                  </option>
                ))}
              </Select>

              <div className="rounded-lg px-3 py-2 mb-3 flex items-center justify-between gap-2 bg-accentSoft">
                <span className="text-xs text-textPrimary">زمان تحویل این پیشنهاد</span>
                <DeliveryTimeInput
                  disabled={!canEdit}
                  valueDays={Number(finDraft.deliveryDays) || 0}
                  onChange={(days) => setFinDraft((d) => (d ? { ...d, deliveryDays: String(days) } : d))}
                  unit={finDraft.deliveryDaysUnit}
                  onUnitChange={(unit) => setFinDraft((d) => (d ? { ...d, deliveryDaysUnit: unit } : d))}
                />
              </div>

              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <div>
                  <label className="block text-[11px] mb-1 text-textSecondary">محل تحویل (Incoterm)</label>
                  <TextInput
                    disabled={!canEdit}
                    value={finDraft.incotermLocation}
                    onChange={(e) => setFinDraft((d) => (d ? { ...d, incotermLocation: e.target.value } : d))}
                    className="!py-1.5 text-xs"
                    placeholder="مثلاً Tehran"
                    dir="ltr"
                  />
                </div>
                <div>
                  <label className="block text-[11px] mb-1 text-textSecondary">روش حمل</label>
                  <TextInput
                    disabled={!canEdit}
                    value={finDraft.shippingMethod}
                    onChange={(e) => setFinDraft((d) => (d ? { ...d, shippingMethod: e.target.value } : d))}
                    className="!py-1.5 text-xs"
                    placeholder="مثلاً Air Freight"
                    dir="ltr"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <div>
                  <label className="block text-[11px] mb-1 text-textSecondary">ارز فروش</label>
                  <Select
                    disabled={!canEdit}
                    value={finDraft.currencyCode}
                    onChange={(e) => setFinDraft((d) => (d ? { ...d, currencyCode: e.target.value } : d))}
                    className="!py-1.5 text-xs"
                  >
                    {(currencies ?? []).map((c) => (
                      <option key={c.currencyCode} value={c.currencyCode}>{c.currencyCode}</option>
                    ))}
                  </Select>
                </div>
                <div>
                  <label className="block text-[11px] mb-1 text-textSecondary">اعتبار پیشنهاد تا</label>
                  <DualDateInput
                    value={finDraft.proposalValidityDate}
                    onChange={(v) => setFinDraft((d) => (d ? { ...d, proposalValidityDate: v } : d))}
                    placeholder="تاریخ"
                  />
                </div>
              </div>

              {/* فاز ۵۷ — تغییر ارز پیش‌نویس (قبل از اولین ارسال) نیاز به نرخ تبدیل داره */}
              {finDraft.currencyCode !== data.financial.currencyCode && (
                <div className="rounded-lg p-3 mb-3 bg-warningSoft">
                  <label className="block text-[11px] mb-1 text-textPrimary">
                    نرخ تبدیل {data.financial.currencyCode} به {finDraft.currencyCode}
                  </label>
                  <TextInput
                    disabled={!canEdit}
                    value={finExchangeRate}
                    onChange={(e) => setFinExchangeRate(e.target.value)}
                    placeholder={`مثلاً یک ${data.financial.currencyCode} = ... ${finDraft.currencyCode}`}
                    className="!py-1.5 text-xs"
                    dir="ltr"
                  />
                  <p className="text-[11px] mt-1 text-textSecondary">
                    با ذخیره، قیمت‌های ثبت‌شده‌ی این نسخه با همین نرخ به {finDraft.currencyCode} تبدیل می‌شن.
                  </p>
                </div>
              )}

              <p className="text-[11px] font-medium mb-1.5 text-textSecondary">
                قیمت نهایی این پیشنهاد به مشتری (قابل‌اصلاح بر اساس مذاکره)
              </p>
              <div className="space-y-1.5 mb-3">
                {data.baselineItems.map((row) => {
                  const v = finDraft.items[row.inquiryItemId] ?? { finalSalePrice: "" };
                  const pending = financialItemsByRow.get(row.inquiryItemId)?.pendingRequestedPrice;
                  return (
                    <div key={row.inquiryItemId} className="rounded-lg px-2.5 py-2 bg-bg">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs flex-1 text-textPrimary" dir="ltr">{row.itemCode}</span>
                        <TextInput
                          disabled={!canEdit}
                          value={v.finalSalePrice}
                          onChange={(e) =>
                            setFinDraft((d) =>
                              d ? { ...d, items: { ...d.items, [row.inquiryItemId]: { finalSalePrice: e.target.value } } } : d,
                            )
                          }
                          className="!w-24 font-mono font-semibold"
                          dir="ltr"
                        />
                        <span className="text-[11px] text-textSecondary">{finDraft.currencyCode}</span>
                      </div>
                      {chosenExtraCost > 0 && (
                        <p className="text-[11px] mt-1 text-accent">
                          با احتساب هزینه ترم تحویل: {fmt(finDeliveryDistribution.byItemId.get(row.inquiryItemId) ?? 0)} {finDraft.currencyCode}
                        </p>
                      )}
                      {pending != null && (
                        <p className="text-[11px] mt-1 text-warning">
                          در انتظار تأیید مدیر برای کاهش قیمت به {fmt(pending)} {finDraft.currencyCode}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="rounded-lg px-3 py-2 mb-3 flex items-center justify-between gap-2 bg-accentSoft">
                <span className="text-xs text-textPrimary">ارزش کل نهایی (شامل هزینه ترم تحویل)</span>
                <span className="font-mono text-xs font-semibold text-accent" dir="ltr">
                  {fmt(finDeliveryDistribution.grandTotal)} {finDraft.currencyCode}
                </span>
              </div>

              <label className="block text-[11px] mb-1 text-textSecondary">شرایط پرداخت پیشنهادی به مشتری</label>
              <TextArea
                disabled={!canEdit}
                rows={2}
                value={finDraft.paymentTerms}
                onChange={(e) => setFinDraft((d) => (d ? { ...d, paymentTerms: e.target.value } : d))}
                className="text-xs mb-3"
              />

              <div className="grid grid-cols-2 gap-2.5 mb-3">
                <div>
                  <label className="block text-[11px] mb-1 text-textSecondary">روش پرداخت</label>
                  <TextInput
                    disabled={!canEdit}
                    value={finDraft.paymentMethod}
                    onChange={(e) => setFinDraft((d) => (d ? { ...d, paymentMethod: e.target.value } : d))}
                    className="!py-1.5 text-xs"
                    placeholder="مثلاً TT، LC"
                    dir="ltr"
                  />
                </div>
                <div className="flex items-end pb-1.5">
                  <label className="flex items-center gap-1.5 text-xs cursor-pointer text-textPrimary">
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      className="w-3.5 h-3.5"
                      checked={finDraft.partialShipmentAllowed}
                      onChange={(e) =>
                        setFinDraft((d) => (d ? { ...d, partialShipmentAllowed: e.target.checked } : d))
                      }
                    />
                    ارسال جزئی مجاز است
                  </label>
                </div>
              </div>

              <p className="text-[11px] mb-1.5 text-textSecondary">مدارک ارسالی همراه محموله</p>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 mb-3">
                {PROPOSAL_DOCUMENT_CHECKLIST_ITEMS.map((doc) => (
                  <label key={doc.key} className="flex items-center gap-1.5 text-xs cursor-pointer text-textPrimary">
                    <input
                      type="checkbox"
                      disabled={!canEdit}
                      className="w-3.5 h-3.5"
                      checked={finDraft.documentsChecklist.includes(doc.key)}
                      onChange={(e) =>
                        setFinDraft((d) => {
                          if (!d) return d;
                          const next = e.target.checked
                            ? [...d.documentsChecklist, doc.key]
                            : d.documentsChecklist.filter((k) => k !== doc.key);
                          return { ...d, documentsChecklist: next };
                        })
                      }
                    />
                    {doc.label}
                  </label>
                ))}
              </div>

              <p className="text-[11px] mb-1.5 text-textSecondary">سایر خدمات</p>
              <div className="grid grid-cols-3 gap-2.5 mb-3">
                <div>
                  <label className="block text-[11px] mb-1 text-textSecondary">تست</label>
                  <TextInput
                    disabled={!canEdit}
                    value={finDraft.serviceTest}
                    onChange={(e) => setFinDraft((d) => (d ? { ...d, serviceTest: e.target.value } : d))}
                    className="!py-1.5 text-xs"
                    placeholder="N/A"
                  />
                </div>
                <div>
                  <label className="block text-[11px] mb-1 text-textSecondary">نصب/راه‌اندازی</label>
                  <TextInput
                    disabled={!canEdit}
                    value={finDraft.serviceFieldService}
                    onChange={(e) => setFinDraft((d) => (d ? { ...d, serviceFieldService: e.target.value } : d))}
                    className="!py-1.5 text-xs"
                    placeholder="شامل/مستثنی"
                  />
                </div>
                <div>
                  <label className="block text-[11px] mb-1 text-textSecondary">طراحی</label>
                  <TextInput
                    disabled={!canEdit}
                    value={finDraft.serviceDesign}
                    onChange={(e) => setFinDraft((d) => (d ? { ...d, serviceDesign: e.target.value } : d))}
                    className="!py-1.5 text-xs"
                    placeholder="شامل/مستثنی"
                  />
                </div>
              </div>

              <label className="block text-[11px] mb-1 text-textSecondary">شرایط گارانتی</label>
              <TextArea
                disabled={!canEdit}
                rows={2}
                value={finDraft.warrantyTerms}
                onChange={(e) => setFinDraft((d) => (d ? { ...d, warrantyTerms: e.target.value } : d))}
                className="text-xs mb-3"
              />

              <label className="block text-[11px] mb-1 text-textSecondary">ملاحظات (در سند درج می‌شود)</label>
              <TextArea
                disabled={!canEdit}
                rows={2}
                value={finDraft.remarks}
                onChange={(e) => setFinDraft((d) => (d ? { ...d, remarks: e.target.value } : d))}
                className="text-xs mb-3"
              />

              <label className="block text-[11px] mb-1 text-textSecondary">یادداشت مذاکره</label>
              <TextArea
                disabled={!canEdit}
                rows={2}
                value={finDraft.negotiationNote}
                onChange={(e) => setFinDraft((d) => (d ? { ...d, negotiationNote: e.target.value } : d))}
                className="text-xs mb-3"
              />

              {canEdit && (
                <div className="flex justify-end gap-2 mb-3">
                  <GhostButton onClick={cancelFinancialEdits} disabled={mutations.saveFinancial.isPending}>
                    انصراف
                  </GhostButton>
                  <GhostButton
                    onClick={saveFinancial}
                    disabled={
                      mutations.saveFinancial.isPending ||
                      (finDraft.currencyCode !== data.financial.currencyCode && !parseFloat(finExchangeRate))
                    }
                  >
                    {mutations.saveFinancial.isPending ? "در حال ذخیره..." : "ذخیره"}
                  </GhostButton>
                </div>
              )}
            </>
          )}

          <ProposalFileActions
            canGenerate={canGenerate}
            disabled={!!data.financial.sentAt}
            onGenerate={generateFinancialDoc}
            generating={mutations.generateFinancialDoc.isPending}
            onOpenHistory={() => setHistoryOpen("financial")}
            historyCount={data.financial.historyCount}
          />

          {canSend && (
            <div className="flex flex-col items-end gap-2 mt-3">
              {data.financial.sentAt ? (
                <>
                  <GhostButton
                    onClick={() => {
                      setReviseCurrency(data.financial.currencyCode);
                      setReviseRate("");
                      setReviseOpen((v) => !v);
                    }}
                    disabled={mutations.reviseFinancial.isPending}
                  >
                    اصلاح (ساخت نسخه جدید)
                  </GhostButton>
                  {reviseOpen && (
                    <div className="w-full rounded-lg p-3 bg-accentSoft space-y-2.5">
                      <label className="block text-[11px] text-textSecondary">
                        ارز نسخه جدید (پیش‌فرض همون ارز فعلی — {data.financial.currencyCode})
                      </label>
                      <Select
                        value={reviseCurrency}
                        onChange={(e) => setReviseCurrency(e.target.value)}
                        className="!py-1.5 text-xs"
                      >
                        {(currencies ?? []).map((c) => (
                          <option key={c.currencyCode} value={c.currencyCode}>{c.currencyCode}</option>
                        ))}
                      </Select>
                      {reviseCurrency !== data.financial.currencyCode && (
                        <div>
                          <label className="block text-[11px] mb-1 text-textSecondary">
                            نرخ تبدیل {data.financial.currencyCode} به {reviseCurrency}
                          </label>
                          <TextInput
                            value={reviseRate}
                            onChange={(e) => setReviseRate(e.target.value)}
                            placeholder={`مثلاً یک ${data.financial.currencyCode} = ... ${reviseCurrency}`}
                            className="!py-1.5 text-xs"
                            dir="ltr"
                          />
                        </div>
                      )}
                      <div className="flex justify-end gap-2">
                        <GhostButton onClick={() => setReviseOpen(false)}>انصراف</GhostButton>
                        <PrimaryButton
                          disabled={
                            mutations.reviseFinancial.isPending ||
                            (reviseCurrency !== data.financial.currencyCode && !parseFloat(reviseRate))
                          }
                          onClick={async () => {
                            try {
                              setErrorMsg(null);
                              const changed = reviseCurrency !== data.financial.currencyCode;
                              await mutations.reviseFinancial.mutateAsync(
                                changed
                                  ? { newCurrencyCode: reviseCurrency, exchangeRate: parseFloat(reviseRate) }
                                  : undefined,
                              );
                              setReviseOpen(false);
                            } catch (err) {
                              setErrorMsg(extractError(err, "خطا در ساخت نسخه جدید"));
                            }
                          }}
                        >
                          {mutations.reviseFinancial.isPending ? "در حال ساخت..." : "تأیید و ساخت نسخه جدید"}
                        </PrimaryButton>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <PrimaryButton onClick={() => mutations.sendFinancial.mutate()} disabled={mutations.sendFinancial.isPending}>
                  <span className="flex items-center gap-1.5"><Send size={13} /> فایل‌ها ارسال شد</span>
                </PrimaryButton>
              )}
            </div>
          )}
          {data.financial.exchangeRateValue != null && (
            <p className="text-[11px] mt-2 text-textSecondary">
              این نسخه با نرخ تبدیل {fmt(data.financial.exchangeRateValue)} از {data.financial.exchangeRateFromCurrency} به{" "}
              {data.financial.exchangeRateToCurrency} ساخته شده
            </p>
          )}
        </div>

        {/* پیشنهاد فنی */}
        <div className="rounded-xl p-5 bg-surface border border-border shadow-card">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-textPrimary">پیشنهاد فنی</p>
            <span className="font-mono text-[11px] px-2 py-0.5 rounded-full bg-accentSoft text-accent" dir="ltr">
              نسخه {data.technical.version} · {data.technical.sentAt ? "ارسال‌شده" : "پیش‌نویس"}
            </span>
          </div>

          {!data.technical.sentAt && (
            <>
              <label className="block text-[11px] mb-1 text-textSecondary">شرکت صادرکننده اسناد</label>
              <Select
                disabled={!canEdit}
                value={techDraft.ourEntityId}
                onChange={(e) => setTechDraft((d) => (d ? { ...d, ourEntityId: e.target.value } : d))}
                className="!py-1.5 text-xs mb-3"
              >
                {(ourEntities ?? []).map((oe) => (
                  <option key={oe.id} value={oe.id}>{oe.entityName}</option>
                ))}
              </Select>
            </>
          )}

          {data.technical.sentAt ? (
            <div className="rounded-lg px-3 py-2 mb-3 text-xs flex items-center justify-between bg-bg">
              <span className="text-textSecondary">ترم تحویل این پیشنهاد فنی</span>
              <span className="font-mono font-semibold text-textPrimary" dir="ltr">
                {data.technical.chosenDeliveryTerm ?? "—"} · {formatDeliveryDuration(data.technical.deliveryTimeEstimateDays, data.technical.deliveryDaysUnit) || "—"}
              </span>
            </div>
          ) : (
            <>
              {/* فاز ۵۴ — بازخورد کاربر: ترم تحویل پیشنهاد فنی مستقل از پیشنهاد مالی انتخاب می‌شه؛
                  فایل خروجی هم بر همین ترم مستقل تولید می‌شه (نه همیشه هم‌ترم مالی) */}
              <label className="block text-[11px] mb-1 text-textSecondary">ترم تحویل این پیشنهاد فنی</label>
              <Select
                disabled={!canEdit}
                value={techDraft.chosenDeliveryTerm}
                onChange={(e) => {
                  const term = e.target.value as DeliveryTerm;
                  const opt = data.deliveryOptions.find((o) => o.deliveryTerm === term);
                  setTechDraft((d) =>
                    d
                      ? {
                          ...d,
                          chosenDeliveryTerm: term,
                          deliveryTimeEstimateDays: opt ? String(opt.deliveryDays) : d.deliveryTimeEstimateDays,
                        }
                      : d,
                  );
                }}
                className="!py-1.5 text-xs mb-2"
              >
                {(data.deliveryOptions.length > 0
                  ? data.deliveryOptions
                  : DELIVERY_TERMS.map((term) => ({ deliveryTerm: term, extraCost: 0, deliveryDays: 30 }))
                ).map((o) => (
                  <option key={o.deliveryTerm} value={o.deliveryTerm}>{o.deliveryTerm}</option>
                ))}
              </Select>

              <div className="rounded-lg px-3 py-2 mb-3 flex items-center justify-between gap-2 bg-accentSoft">
                <span className="text-xs text-textPrimary">زمان تحویل تخمینی به مشتری</span>
                <DeliveryTimeInput
                  disabled={!canEdit}
                  valueDays={Number(techDraft.deliveryTimeEstimateDays) || 0}
                  onChange={(days) => setTechDraft((d) => (d ? { ...d, deliveryTimeEstimateDays: String(days) } : d))}
                  unit={techDraft.deliveryDaysUnit}
                  onUnitChange={(unit) => setTechDraft((d) => (d ? { ...d, deliveryDaysUnit: unit } : d))}
                />
              </div>
            </>
          )}

          <p className="text-[11px] font-medium mb-1.5 text-textSecondary">مشخصات فنی — قابل تکمیل برای هر قلم</p>
          <div className="space-y-2 mb-3">
            {data.baselineItems.map((row) => {
              const v = techDraft.items[row.inquiryItemId] ?? { technicalSpecs: "", complianceNote: "" };
              return (
                <div key={row.inquiryItemId} className="rounded-lg px-2.5 py-2 bg-bg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-xs text-textPrimary" dir="ltr">{row.itemCode}</span>
                    {row.isEquivalent && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-warningSoft text-warning">کالای معادل</span>
                    )}
                  </div>
                  {row.partNumber && (
                    <p className="text-[11px] mb-1 text-textSecondary" dir="ltr">PN: {row.partNumber}</p>
                  )}
                  {row.datasheetUrl && (
                    <button
                      type="button"
                      onClick={() => downloadFile(row.datasheetUrl as string, `datasheet-${row.itemCode}`)}
                      className="flex items-center gap-1 text-[11px] mb-1.5 text-primary"
                    >
                      <Download size={11} /> دانلود دیتاشیت تأمین‌کننده
                    </button>
                  )}
                  <TextArea
                    disabled={!canEdit || !!data.technical.sentAt}
                    rows={2}
                    placeholder="مشخصات فنی ارائه‌شده به مشتری"
                    value={v.technicalSpecs}
                    onChange={(e) =>
                      setTechDraft((d) =>
                        d ? { ...d, items: { ...d.items, [row.inquiryItemId]: { ...v, technicalSpecs: e.target.value } } } : d,
                      )
                    }
                    className="text-xs"
                  />
                </div>
              );
            })}
          </div>

          <label className="block text-[11px] mb-1 text-textSecondary">یادداشت مذاکره</label>
          <TextArea
            disabled={!canEdit || !!data.technical.sentAt}
            rows={2}
            value={techDraft.negotiationNote}
            onChange={(e) => setTechDraft((d) => (d ? { ...d, negotiationNote: e.target.value } : d))}
            className="text-xs mb-3"
          />

          {canEdit && !data.technical.sentAt && (
            <div className="flex justify-end mb-3">
              <GhostButton onClick={saveTechnical} disabled={mutations.saveTechnical.isPending}>
                {mutations.saveTechnical.isPending ? "در حال ذخیره..." : "ذخیره"}
              </GhostButton>
            </div>
          )}

          <ProposalFileActions
            canGenerate={canGenerate}
            disabled={!!data.technical.sentAt}
            onGenerate={generateTechnicalDoc}
            generating={mutations.generateTechnicalDoc.isPending}
            onOpenHistory={() => setHistoryOpen("technical")}
            historyCount={data.technical.historyCount}
          />

          {canSend && (
            <div className="flex justify-end mt-3">
              {data.technical.sentAt ? (
                <GhostButton onClick={() => mutations.reviseTechnical.mutate()} disabled={mutations.reviseTechnical.isPending}>
                  اصلاح (ساخت نسخه جدید)
                </GhostButton>
              ) : (
                <PrimaryButton onClick={() => mutations.sendTechnical.mutate()} disabled={mutations.sendTechnical.isPending}>
                  <span className="flex items-center gap-1.5"><Send size={13} /> فایل‌ها ارسال شد</span>
                </PrimaryButton>
              )}
            </div>
          )}
        </div>
      </div>

      {data.financial.sentAt && data.technical.sentAt && (
        <div className="rounded-lg p-4 flex items-center gap-2 text-sm bg-successSoft text-success">
          <Send size={16} /> فایل‌های مالی و فنی برای مشتری ارسال شد — در انتظار نتیجه استعلام
        </div>
      )}

      {historyOpen && (
        <HistoryModal
          inquiryId={inquiry.id}
          kind={historyOpen}
          baselineByRow={baselineByRow}
          onClose={() => setHistoryOpen(null)}
        />
      )}
    </div>
  );
}

function FinancialReadOnly({
  proposal,
  baselineByRow,
}: {
  proposal: FinancialProposal;
  baselineByRow: Map<string, ProposalBaselineItem>;
}) {
  return (
    <div className="text-xs space-y-1.5 mb-3 text-textPrimary">
      <p>
        ترم {proposal.chosenDeliveryTerm} · {formatDeliveryDuration(proposal.deliveryDays, proposal.deliveryDaysUnit)} · ارز {proposal.currencyCode}
      </p>
      {proposal.items.map((i) => (
        <div key={i.inquiryItemId} className="flex items-center gap-2 rounded-lg px-2.5 py-2 bg-bg">
          <span className="font-mono flex-1" dir="ltr">{baselineByRow.get(i.inquiryItemId)?.itemCode}</span>
          <span className="font-mono font-semibold" dir="ltr">
            {fmt(i.priceWithDelivery)} {proposal.currencyCode}
          </span>
        </div>
      ))}
      {proposal.deliveryExtraCost > 0 && (
        <div className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 bg-accentSoft">
          <span className="text-textPrimary">ارزش کل نهایی (شامل هزینه ترم تحویل)</span>
          <span className="font-mono font-semibold text-accent" dir="ltr">
            {fmt(proposal.totalAmountWithDelivery)} {proposal.currencyCode}
          </span>
        </div>
      )}
      {proposal.paymentTerms && <p className="text-textSecondary">شرایط پرداخت: {proposal.paymentTerms}</p>}
    </div>
  );
}

function ProposalFileActions({
  canGenerate,
  disabled,
  onGenerate,
  generating,
  onOpenHistory,
  historyCount,
}: {
  canGenerate: boolean;
  disabled: boolean;
  onGenerate: (format: "pdf" | "xlsx", lang: "fa" | "en") => void;
  generating: boolean;
  onOpenHistory: () => void;
  historyCount: number;
}) {
  const [format, setFormat] = useState<"pdf" | "xlsx">("pdf");
  const [lang, setLang] = useState<"fa" | "en">("fa");

  return (
    <div className="space-y-1.5">
      <style>{`@keyframes proposal-gen-bar { 0% { transform: translateX(-100%); } 100% { transform: translateX(280%); } }`}</style>
      <div className="flex flex-wrap gap-2 items-center">
        {canGenerate && !disabled && (
          <>
            <Select
              value={format}
              onChange={(e) => setFormat(e.target.value as "pdf" | "xlsx")}
              className="!w-24 !py-2 text-xs"
            >
              <option value="pdf">PDF</option>
              <option value="xlsx">Excel</option>
            </Select>
            <Select
              value={lang}
              onChange={(e) => setLang(e.target.value as "fa" | "en")}
              className="!w-24 !py-2 text-xs"
            >
              <option value="fa">فارسی</option>
              <option value="en">English</option>
            </Select>
            <button
              type="button"
              disabled={generating}
              onClick={() => onGenerate(format, lang)}
              className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg text-white bg-accent disabled:opacity-60"
            >
              <FileText size={13} /> {generating ? "در حال تولید..." : "دریافت فایل سند"}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onOpenHistory}
          className="flex items-center gap-1.5 text-xs px-3 py-2 rounded-lg text-textSecondary border border-border"
        >
          <History size={13} /> تاریخچه نسخه‌ها ({historyCount})
        </button>
      </div>
      {generating && (
        <div className="w-full h-1 rounded-full overflow-hidden bg-border/60">
          <div
            className="h-full w-1/3 rounded-full bg-accent"
            style={{ animation: "proposal-gen-bar 1.1s ease-in-out infinite" }}
          />
        </div>
      )}
    </div>
  );
}
