import { useMemo, useState } from "react";
import {
  Building2,
  Check,
  ChevronDown,
  ChevronUp,
  Clipboard,
  FileDown,
  Mail,
  MessageCircleQuestion,
  Paperclip,
  Pencil,
  RotateCcw,
  Search,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { hasPermission } from "../../lib/permissions";
import { formatJalali } from "../../lib/jalali";
import { Field, GhostButton, PrimaryButton, Select, TextArea, TextInput } from "../../components/ui/fields";
import { DualDateInput } from "../../components/ui/DualDateInput";
import { AmountInput } from "../../components/ui/AmountInput";
import { FileViewer } from "../../components/ui/FileViewer";
import { FileDropZone, UploadedFileRef } from "../../components/ui/FileDropZone";
import { useDebounced } from "../../lib/use-debounced";
import { usePartners } from "../partners/partners-api";
import { InquiryDetail } from "./inquiry-types";
import { Offer, Rfq, RFQ_STATUS_META } from "./rfq-types";
import {
  CreateOfferBody,
  fetchEmailPreview,
  useCurrencies,
  useOurEntities,
  useRfqMutations,
  useRfqs,
} from "./rfqs-api";

function extractApiError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? fallback);
}

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

// ------------------------------------------------------------
// مودال پیش‌نمایش ایمیل + کپی متن (مسیر Fallback بدون SMTP)
// ------------------------------------------------------------
function EmailPreviewModal({
  rfqId,
  onClose,
  onLoaded,
}: {
  rfqId: string;
  onClose: () => void;
  onLoaded?: (smtpConfigured: boolean) => void;
}) {
  const [preview, setPreview] = useState<{ subject: string; text: string; smtpConfigured: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  useState(() => {
    fetchEmailPreview(rfqId).then((data) => {
      setPreview(data);
      onLoaded?.(data.smtpConfigured);
    });
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px] animate-fade-in">
      <div className="rounded-2xl w-full max-w-2xl p-5 bg-surface shadow-modal space-y-3 max-h-[85vh] overflow-y-auto animate-pop-in">
        <h3 className="text-sm font-bold text-textPrimary tracking-tight">پیش‌نمایش ایمیل RFQ</h3>
        {!preview && (
          <div className="space-y-2 py-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-8 rounded-lg skeleton" />
            ))}
          </div>
        )}
        {preview && (
          <>
            {!preview.smtpConfigured && (
              <p className="text-xs rounded-lg p-2.5 bg-warningSoft text-warning font-medium">
                SMTP پیکربندی نشده — متن رو کپی کن و از ایمیل سازمانی خودت ارسال کن.
              </p>
            )}
            <p className="text-xs text-textSecondary">
              موضوع: <span className="font-mono text-textPrimary" dir="ltr">{preview.subject}</span>
            </p>
            <pre className="text-[11px] rounded-lg border border-border bg-bg p-3 whitespace-pre-wrap max-h-72 overflow-y-auto" dir="ltr">
              {preview.text}
            </pre>
            <div className="flex gap-2 justify-end">
              <GhostButton onClick={onClose}>بستن</GhostButton>
              <PrimaryButton
                onClick={async () => {
                  await navigator.clipboard.writeText(preview.text);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
              >
                <span className="flex items-center gap-1.5">
                  <Clipboard size={13} /> {copied ? "کپی شد!" : "کپی متن ایمیل"}
                </span>
              </PrimaryButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// فرم RFQ جدید
// ------------------------------------------------------------
function NewRfqForm({ inquiry }: { inquiry: InquiryDetail }) {
  const { create, resendEmail } = useRfqMutations(inquiry.id);
  const { data: entities } = useOurEntities();

  // فاز ۳۳ — بعد از «ثبت»، RFQ ساخته می‌شه ولی هنوز ایمیلی نمی‌ره؛ کاربر باید اول
  // «پیش‌نمایش» بگیره (که smtpConfigured رو هم برمی‌گردونه) و بعد جدا روی «ارسال» بزنه.
  const [pendingRfq, setPendingRfq] = useState<{ id: string; rfqNumber: string; recipientEmail: string } | null>(null);
  const [showPendingPreview, setShowPendingPreview] = useState(false);
  const [smtpConfigured, setSmtpConfigured] = useState<boolean | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sendNotice, setSendNotice] = useState<string | null>(null);

  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [ourEntityId, setOurEntityId] = useState("");
  const [supplierQuery, setSupplierQuery] = useState("");
  const [chosenSupplier, setChosenSupplier] = useState<{ id: string; companyName: string; email: string | null } | null>(null);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailSubject, setEmailSubject] = useState(inquiry.internalNumber);
  const [responseDueDate, setResponseDueDate] = useState<string | null>(() => {
    const d = new Date(Date.now() + 7 * 86_400_000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [error, setError] = useState<string | null>(null);

  const debouncedSupplierQuery = useDebounced(supplierQuery, 300);
  const { data: partnersData } = usePartners(debouncedSupplierQuery, "all");
  const supplierOptions = useMemo(
    () => (partnersData?.items ?? []).filter((p) => ["supplier", "both"].includes(p.partnerType)).slice(0, 8),
    [partnersData],
  );

  function toggleItem(id: string) {
    setSelectedItems((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportCsv() {
    const rows = inquiry.items
      .filter((item) => selectedItems.has(item.id))
      .map((item) => [item.itemCode, item.description, Number(item.quantity), item.measurementUnit, item.partNumber ?? "", item.builder ?? ""]);
    const csv = ["Item Code,Description,Qty,Unit,Part No,Manufacturer", ...rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${inquiry.internalNumber}-items.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  const canSubmit = selectedItems.size > 0 && ourEntityId && chosenSupplier && recipientEmail.includes("@");

  if (pendingRfq) {
    return (
      <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-3 mb-5">
        <h3 className="text-sm font-bold text-textPrimary tracking-tight">
          RFQ <span className="font-mono" dir="ltr">{pendingRfq.rfqNumber}</span> ثبت شد
        </h3>
        <p className="text-xs text-textSecondary">
          هنوز هیچ ایمیلی ارسال نشده. اول پیش‌نمایش رو بگیر، بعد روی «ارسال» بزن.
        </p>

        {sendError && <p className="text-xs text-danger">{sendError}</p>}
        {sendNotice && <p className="text-xs text-success">{sendNotice}</p>}

        <div className="flex flex-wrap gap-2 items-center">
          <GhostButton onClick={() => setShowPendingPreview(true)}>
            <span className="flex items-center gap-1.5"><Mail size={13} /> پیش‌نمایش</span>
          </GhostButton>
          <div title={smtpConfigured === false ? "به دلیل عدم پیکربندی تنظیمات ایمیل (SMTP) غیرفعاله — از پیش‌نمایش، متن رو کپی و دستی ارسال کن" : undefined}>
            <PrimaryButton
              disabled={smtpConfigured !== true || resendEmail.isPending}
              onClick={async () => {
                try {
                  setSendError(null);
                  await resendEmail.mutateAsync({ rfqId: pendingRfq.id, recipientEmail: pendingRfq.recipientEmail });
                  setSendNotice("ایمیل ارسال شد ✅");
                } catch (err) {
                  setSendError(extractApiError(err, "خطا در ارسال ایمیل"));
                }
              }}
            >
              <span className="flex items-center gap-1.5"><Send size={14} /> {resendEmail.isPending ? "در حال ارسال..." : "ارسال"}</span>
            </PrimaryButton>
          </div>
          <GhostButton
            onClick={() => {
              setPendingRfq(null);
              setShowPendingPreview(false);
              setSmtpConfigured(null);
              setSendError(null);
              setSendNotice(null);
            }}
          >
            پایان — ثبت RFQ بعدی
          </GhostButton>
        </div>

        {showPendingPreview && (
          <EmailPreviewModal
            rfqId={pendingRfq.id}
            onClose={() => setShowPendingPreview(false)}
            onLoaded={setSmtpConfigured}
          />
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-4 mb-5">
      <h3 className="text-sm font-bold text-textPrimary tracking-tight">RFQ جدید به تأمین‌کننده</h3>

      <div>
        <p className="text-xs font-medium text-textPrimary mb-2">ردیف‌های انتخابی ({selectedItems.size} از {inquiry.items.length})</p>
        <div className="space-y-1.5">
          {inquiry.items.map((item) => (
            <label key={item.id} className="flex items-center gap-2.5 text-sm rounded-lg border border-border px-3 py-2 cursor-pointer transition-colors duration-150 hover:bg-bg hover:border-textSecondary/40">
              <input type="checkbox" checked={selectedItems.has(item.id)} onChange={() => toggleItem(item.id)} className="w-4 h-4 accent-primary cursor-pointer" />
              <span className="font-mono text-xs text-textSecondary" dir="ltr">{item.itemCode}</span>
              <span className="text-xs text-textPrimary truncate">{item.description}</span>
              <span className="font-mono text-xs text-textSecondary mr-auto" dir="ltr">{Number(item.quantity)} {item.measurementUnit}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="شرکت ما (طرف ارسال‌کننده استعلام) *">
          <Select value={ourEntityId} onChange={(e) => setOurEntityId(e.target.value)} className="!border-accent">
            <option value="" disabled>انتخاب شرکت گروه</option>
            {(entities ?? []).map((entity) => (
              <option key={entity.id} value={entity.id}>{entity.entityName}</option>
            ))}
          </Select>
        </Field>

        <Field label="تأمین‌کننده مقصد *">
          <div className="relative">
            <Search size={14} className="absolute top-3 right-3 text-textSecondary" />
            <TextInput
              className="pr-9"
              placeholder="جستجوی نام تأمین‌کننده..."
              value={chosenSupplier?.companyName ?? supplierQuery}
              onChange={(e) => {
                setSupplierQuery(e.target.value);
                setChosenSupplier(null);
                setSupplierOpen(true);
              }}
              onFocus={() => setSupplierOpen(true)}
            />
            {supplierOpen && !chosenSupplier && supplierQuery.trim().length >= 1 && (
              <div className="absolute z-20 w-full mt-1.5 rounded-xl border border-border bg-surface shadow-dropdown max-h-44 overflow-y-auto py-1 origin-top animate-pop-in">
                {supplierOptions.length === 0 && <p className="text-xs px-3 py-2 text-textSecondary">تأمین‌کننده‌ای یافت نشد</p>}
                {supplierOptions.map((supplier) => (
                  <button
                    key={supplier.id}
                    type="button"
                    onClick={() => {
                      setChosenSupplier({ id: supplier.id, companyName: supplier.companyName, email: supplier.email });
                      setRecipientEmail(supplier.email ?? "");
                      setSupplierOpen(false);
                    }}
                    className="w-full text-right text-sm px-3 py-2 transition-colors duration-150 hover:bg-bg text-textPrimary"
                  >
                    {supplier.companyName}
                    {supplier.country && <span className="text-[11px] text-textSecondary"> — {supplier.country}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Field>

        <Field label="ایمیل گیرنده *">
          <TextInput value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} dir="ltr" placeholder="sales@supplier.com" />
        </Field>

        <Field label="عنوان ایمیل">
          <TextInput value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} dir="ltr" className="font-mono" />
        </Field>

        <Field label="مهلت پاسخ (پیش‌فرض ۷ روز)">
          <DualDateInput value={responseDueDate} onChange={setResponseDueDate} />
        </Field>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex flex-wrap gap-2 justify-between items-center">
        <GhostButton onClick={exportCsv} disabled={selectedItems.size === 0}>
          <span className="flex items-center gap-1.5"><FileDown size={13} /> خروجی اکسل اقلام</span>
        </GhostButton>
        <PrimaryButton
          disabled={!canSubmit || create.isPending}
          onClick={async () => {
            try {
              setError(null);
              const sentToEmail = recipientEmail.trim();
              const result = await create.mutateAsync({
                supplierId: chosenSupplier!.id,
                ourEntityId,
                inquiryItemIds: [...selectedItems],
                recipientEmail: sentToEmail,
                emailSubject: emailSubject.trim() || undefined,
                responseDueDate: responseDueDate ?? undefined,
              });
              setSelectedItems(new Set());
              setChosenSupplier(null);
              setSupplierQuery("");
              setRecipientEmail("");
              setPendingRfq({ id: result.id, rfqNumber: result.rfqNumber, recipientEmail: sentToEmail });
            } catch (err) {
              setError(extractApiError(err, "خطا در ثبت RFQ"));
            }
          }}
        >
          <span className="flex items-center gap-1.5"><Send size={14} /> {create.isPending ? "در حال ثبت..." : "ثبت"}</span>
        </PrimaryButton>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// فرم ثبت آفر
// ------------------------------------------------------------
interface OfferRowState {
  inquiryItemId: string;
  price: string;
  deliveryTimeDays: string;
  partNumber: string;
  builder: string;
  technicalSpecs: string;
  isEquivalent: boolean;
  countryOfOrigin: string;
  datasheetUrl: string;
  datasheetName: string;
}

function OfferForm({
  rfq,
  internalNumber,
  existing,
  busy,
  onSubmit,
  onCancel,
}: {
  rfq: Rfq;
  internalNumber: string;
  existing?: Offer;
  busy: boolean;
  onSubmit: (body: CreateOfferBody) => void;
  onCancel: () => void;
}) {
  const { data: currencies } = useCurrencies();
  const [header, setHeader] = useState({
    offerNumber: existing?.offerNumber ?? "",
    offerDate: existing?.offerDate ?? null,
    currencyCode: existing?.items[0]?.currencyCode ?? "EUR",
    offerContactName: existing?.offerContactName ?? "",
    vatApplicable: existing?.vatApplicable ?? false,
    vatRatePercent: existing?.vatRatePercent ? String(Number(existing.vatRatePercent)) : "9",
    otherCosts: existing?.otherCosts ? String(Number(existing.otherCosts)) : "",
    generalRemarks: existing?.generalRemarks ?? "",
  });
  const [rows, setRows] = useState<OfferRowState[]>(() =>
    rfq.items.map((item) => {
      const prior = existing?.items.find((o) => o.inquiryItemId === item.inquiryItemId);
      return {
        inquiryItemId: item.inquiryItemId,
        price: prior ? String(Number(prior.price)) : "",
        deliveryTimeDays: prior?.deliveryTimeDays != null ? String(prior.deliveryTimeDays) : "",
        partNumber: prior?.partNumber ?? "",
        // فاز ۵۵ — پیش‌فرض از برند اولیه‌ی استعلام (اگه تأمین‌کننده هنوز چیزی وارد نکرده)؛
        // کارشناس بازرگانی در صورت تفاوت برند پیشنهادی، همینجا اصلاحش می‌کنه
        builder: prior?.builder ?? item.inquiryItem.builder ?? "",
        technicalSpecs: prior?.technicalSpecs ?? "",
        isEquivalent: prior?.isEquivalent ?? false,
        countryOfOrigin: prior?.countryOfOrigin ?? "",
        datasheetUrl: prior?.datasheetUrl ?? "",
        datasheetName: prior?.datasheetUrl ? prior.datasheetUrl.split("/").pop() ?? "" : "",
      };
    }),
  );

  const quantityOf = (inquiryItemId: string) =>
    Number(rfq.items.find((i) => i.inquiryItemId === inquiryItemId)?.inquiryItem.quantity ?? 0);

  const subTotal = rows.reduce((sum, row) => sum + (parseFloat(row.price) || 0) * quantityOf(row.inquiryItemId), 0);
  const vatAmount = header.vatApplicable ? (subTotal * (parseFloat(header.vatRatePercent) || 0)) / 100 : 0;
  const otherCostsAmount = parseFloat(header.otherCosts) || 0;
  const grandTotal = subTotal + vatAmount + otherCostsAmount;

  const pricedRows = rows.filter((row) => parseFloat(row.price) > 0);

  function setRow(inquiryItemId: string, patch: Partial<OfferRowState>) {
    setRows((current) => current.map((row) => (row.inquiryItemId === inquiryItemId ? { ...row, ...patch } : row)));
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-bg/60 p-4 space-y-3 animate-pop-in">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <Field label="شماره آفر"><TextInput value={header.offerNumber} onChange={(e) => setHeader({ ...header, offerNumber: e.target.value })} dir="ltr" /></Field>
        <Field label="تاریخ سند آفر"><DualDateInput value={header.offerDate} onChange={(iso) => setHeader({ ...header, offerDate: iso })} /></Field>
        <Field label="ارز">
          <Select value={header.currencyCode} onChange={(e) => setHeader({ ...header, currencyCode: e.target.value })}>
            {(currencies ?? []).map((currency) => (
              <option key={currency.currencyCode} value={currency.currencyCode}>{currency.currencyCode} — {currency.currencyName}</option>
            ))}
          </Select>
        </Field>
        <Field label="شخص آفردهنده"><TextInput value={header.offerContactName} onChange={(e) => setHeader({ ...header, offerContactName: e.target.value })} /></Field>
      </div>

      {/* ردیف اقلام */}
      <div className="space-y-2">
        {rfq.items.map((item) => {
          const row = rows.find((r) => r.inquiryItemId === item.inquiryItemId)!;
          return (
            <div key={item.inquiryItemId} className="rounded-lg border border-border bg-surface p-3 space-y-2 transition-colors duration-150 hover:border-textSecondary/30">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-mono text-primary" dir="ltr">{item.inquiryItem.itemCode}</span>
                <span className="text-textPrimary truncate flex-1">{item.inquiryItem.description}</span>
                <span className="font-mono text-textSecondary" dir="ltr">{Number(item.inquiryItem.quantity)} {item.inquiryItem.measurementUnit}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <AmountInput
                  placeholder={`قیمت واحد (${header.currencyCode}) *`}
                  value={row.price === "" ? null : Number(row.price)}
                  onChange={(n) => setRow(item.inquiryItemId, { price: n === null ? "" : String(n) })}
                  className="font-mono"
                />
                <TextInput placeholder="زمان تحویل (روز)" dir="ltr" inputMode="numeric" value={row.deliveryTimeDays} onChange={(e) => setRow(item.inquiryItemId, { deliveryTimeDays: e.target.value })} />
                <TextInput placeholder="Part Number" dir="ltr" value={row.partNumber} onChange={(e) => setRow(item.inquiryItemId, { partNumber: e.target.value })} />
                <TextInput placeholder="برند سازنده" value={row.builder} onChange={(e) => setRow(item.inquiryItemId, { builder: e.target.value })} />
                <TextInput placeholder="کشور سازنده" value={row.countryOfOrigin} onChange={(e) => setRow(item.inquiryItemId, { countryOfOrigin: e.target.value })} />
                <div className="col-span-2 sm:col-span-3">
                  <TextInput placeholder="مشخصات فنی ارائه‌شده (ممکنه با درخواست فرق کنه)" value={row.technicalSpecs} onChange={(e) => setRow(item.inquiryItemId, { technicalSpecs: e.target.value })} />
                </div>
                <label className="flex items-center gap-1.5 text-[11px] text-textSecondary cursor-pointer">
                  <input type="checkbox" className="w-3.5 h-3.5" checked={row.isEquivalent} onChange={(e) => setRow(item.inquiryItemId, { isEquivalent: e.target.checked })} />
                  کالای معادل
                </label>
              </div>
              <div className="flex items-center gap-2">
                {row.datasheetUrl ? (
                  <span className="inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg bg-bg border border-border text-textSecondary">
                    <Paperclip size={10} />
                    {row.datasheetName || "دیتاشیت"}
                    <FileViewer fileUrl={row.datasheetUrl} fileName={row.datasheetName} />
                    <button type="button" onClick={() => setRow(item.inquiryItemId, { datasheetUrl: "", datasheetName: "" })} className="text-danger">×</button>
                  </span>
                ) : (
                  <FileDropZone
                    multiple={false}
                    compact
                    label="پیوست دیتاشیت این قلم"
                    accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.docx,.zip,.tif,.tiff"
                    folder={internalNumber}
                    onFilesUploaded={([file]: UploadedFileRef[]) =>
                      setRow(item.inquiryItemId, { datasheetUrl: file.fileUrl, datasheetName: file.fileName })
                    }
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="flex items-center gap-2 text-xs text-textPrimary cursor-pointer">
            <input type="checkbox" className="w-3.5 h-3.5" checked={header.vatApplicable} onChange={(e) => setHeader({ ...header, vatApplicable: e.target.checked })} />
            VAT (مالیات بر ارزش افزوده) اعمال می‌شود
          </label>
          {header.vatApplicable && (
            <div className="flex items-center gap-1.5">
              <TextInput className="!w-20 font-mono" dir="ltr" value={header.vatRatePercent} onChange={(e) => setHeader({ ...header, vatRatePercent: e.target.value })} />
              <span className="text-xs text-textSecondary">درصد VAT</span>
            </div>
          )}
        </div>
        <Field label="سایر هزینه‌ها (حمل، بسته‌بندی و ...)">
          <AmountInput
            className="font-mono"
            placeholder="0.00"
            value={header.otherCosts === "" ? null : Number(header.otherCosts)}
            onChange={(n) => setHeader({ ...header, otherCosts: n === null ? "" : String(n) })}
          />
        </Field>
      </div>

      <Field label="سایر ملاحظات (مربوط به کل آفر، نه یک قلم خاص)">
        <TextArea rows={2} value={header.generalRemarks} onChange={(e) => setHeader({ ...header, generalRemarks: e.target.value })} placeholder="مثلاً شرایط گارانتی عمومی، بسته‌بندی استاندارد و..." />
      </Field>

      {/* جمع‌بندی زنده پیش‌فاکتور */}
      <div className="rounded-lg border border-border bg-surface p-3 space-y-1">
        <div className="flex justify-between text-xs text-textSecondary"><span>جمع ارزش کالاها</span><span className="font-mono" dir="ltr">{fmt(subTotal)} {header.currencyCode}</span></div>
        {header.vatApplicable && (
          <div className="flex justify-between text-xs text-textSecondary"><span>VAT ({header.vatRatePercent || 0}٪)</span><span className="font-mono" dir="ltr">{fmt(vatAmount)} {header.currencyCode}</span></div>
        )}
        {otherCostsAmount > 0 && (
          <div className="flex justify-between text-xs text-textSecondary"><span>سایر هزینه‌ها</span><span className="font-mono" dir="ltr">{fmt(otherCostsAmount)} {header.currencyCode}</span></div>
        )}
        <div className="flex justify-between text-sm font-semibold text-textPrimary border-t border-border pt-1.5 mt-1">
          <span>جمع کل پیش‌فاکتور</span><span className="font-mono" dir="ltr">{fmt(grandTotal)} {header.currencyCode}</span>
        </div>
      </div>

      <p className="text-[11px] text-textSecondary">
        تاریخ دریافت این پاسخ نیازی به وارد کردن نداره — به‌محض ثبت، خودکار (لحظه فعلی سرور) ذخیره می‌شه تا گزارش سرعت پاسخ‌دهی دقیق باشه.
      </p>

      <div className="flex gap-2 justify-end">
        <GhostButton onClick={onCancel}>بازگشت</GhostButton>
        <button
          disabled={pricedRows.length === 0 || busy}
          onClick={() =>
            onSubmit({
              offerNumber: header.offerNumber.trim() || undefined,
              offerDate: header.offerDate ?? undefined,
              currencyCode: header.currencyCode,
              offerContactName: header.offerContactName.trim() || undefined,
              vatApplicable: header.vatApplicable,
              vatRatePercent: header.vatApplicable ? parseFloat(header.vatRatePercent) || 0 : undefined,
              otherCosts: otherCostsAmount || undefined,
              generalRemarks: header.generalRemarks.trim() || undefined,
              items: pricedRows.map((row) => ({
                inquiryItemId: row.inquiryItemId,
                price: parseFloat(row.price),
                deliveryTimeDays: row.deliveryTimeDays ? parseInt(row.deliveryTimeDays, 10) : undefined,
                partNumber: row.partNumber.trim() || undefined,
                builder: row.builder.trim() || undefined,
                countryOfOrigin: row.countryOfOrigin.trim() || undefined,
                isEquivalent: row.isEquivalent,
                technicalSpecs: row.technicalSpecs.trim() || undefined,
                datasheetUrl: row.datasheetUrl || undefined,
              })),
            })
          }
          className="text-xs px-4 py-2.5 rounded-lg text-white bg-success font-medium disabled:opacity-60"
        >
          {busy ? "در حال ثبت..." : "ثبت پیشنهاد"}
        </button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------
// نمایش آفر ثبت‌شده (قفل)
// ------------------------------------------------------------
function OfferView({ offer, rfq, canRecord, onEdit, inquiryId, internalNumber }: { offer: Offer; rfq: Rfq; canRecord: boolean; onEdit: () => void; inquiryId: string; internalNumber: string }) {
  const { addOfferDocument } = useRfqMutations(inquiryId);
  const currency = offer.items[0]?.currencyCode ?? "";

  return (
    <div className="rounded-lg border border-success/40 bg-successSoft/30 p-3 space-y-2">
      <div className="flex items-center gap-2 flex-wrap text-xs text-textSecondary">
        {offer.offerNumber && <span>شماره آفر: <span className="font-mono text-textPrimary" dir="ltr">{offer.offerNumber}</span></span>}
        {offer.offerContactName && <span>· آفردهنده: {offer.offerContactName}</span>}
        <span>· دریافت: {formatJalali(offer.receivedAt)}</span>
        {canRecord && (
          <button onClick={onEdit} className="mr-auto text-primary flex items-center gap-1"><Pencil size={11} /> اصلاح</button>
        )}
      </div>
      <table className="w-full text-right text-xs">
        <thead>
          <tr className="text-[10px] text-textSecondary border-b border-border">
            <th className="py-1">کد</th><th className="py-1">قیمت واحد</th><th className="py-1">تحویل (روز)</th><th className="py-1">PN</th><th className="py-1">برند</th><th className="py-1">معادل</th><th className="py-1">دیتاشیت</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {offer.items.map((item) => {
            const meta = rfq.items.find((r) => r.inquiryItemId === item.inquiryItemId)?.inquiryItem;
            return (
              <tr key={item.id}>
                <td className="py-1.5 font-mono text-primary" dir="ltr">{meta?.itemCode}</td>
                <td className="py-1.5 font-mono" dir="ltr">{fmt(Number(item.price))} {item.currencyCode}</td>
                <td className="py-1.5" dir="ltr">{item.deliveryTimeDays ?? "—"}</td>
                <td className="py-1.5 font-mono" dir="ltr">{item.partNumber ?? "—"}</td>
                <td className="py-1.5">{item.builder ?? "—"}</td>
                <td className="py-1.5">{item.isEquivalent ? "✓" : "—"}</td>
                <td className="py-1.5">
                  {item.datasheetUrl ? <FileViewer fileUrl={item.datasheetUrl} fileName={item.datasheetUrl.split("/").pop()} /> : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex items-center justify-between text-xs font-semibold text-textPrimary border-t border-border pt-1.5">
        <span>جمع کل پیش‌فاکتور</span>
        <span className="font-mono" dir="ltr">{fmt(offer.totals.grandTotal)} {currency}</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {offer.documents.map((doc) => (
          <span key={doc.id} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-surface text-textSecondary">
            <Paperclip size={10} /> {doc.fileName ?? "فایل"}
            <FileViewer fileUrl={doc.fileUrl} fileName={doc.fileName} />
          </span>
        ))}
      </div>
      {canRecord && (
        <FileDropZone
          compact
          label="پیوست فایل آفر (کل پیش‌فاکتور)"
          accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.docx,.zip,.tif,.tiff"
          folder={internalNumber}
          onFilesUploaded={(files: UploadedFileRef[]) =>
            files.forEach((f) => addOfferDocument.mutate({ offerId: offer.id, fileUrl: f.fileUrl, fileName: f.fileName }))
          }
        />
      )}
    </div>
  );
}

// ------------------------------------------------------------
// کارت RFQ
// ------------------------------------------------------------
function RfqCard({ rfq, inquiryId, internalNumber }: { rfq: Rfq; inquiryId: string; internalNumber: string }) {
  const { user } = useAuth();
  const canRecord = hasPermission(user, "rfq.record_offer");
  const canRequestDelete = hasPermission(user, "rfq.send");
  const { technicalQuestion, reject, createOffer, updateOffer, updateStatus, requestDelete } =
    useRfqMutations(inquiryId);

  const [open, setOpen] = useState(false);
  const [responseMode, setResponseMode] = useState<null | "choose" | "question" | "reject" | "offer" | "edit-offer">(null);
  const [questionText, setQuestionText] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteRequestOpen, setDeleteRequestOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");

  const meta = RFQ_STATUS_META[rfq.status];
  const latestOffer = rfq.offers[0];

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-accentSoft text-accent flex items-center justify-center shrink-0">
            <Building2 size={15} />
          </div>
          <div className="text-right min-w-0">
            <p className="text-sm font-semibold text-textPrimary truncate">
              {rfq.supplier.companyName}
              {rfq.supplier.country && <span className="text-[11px] text-textSecondary font-normal"> — {rfq.supplier.country}</span>}
            </p>
            <p className="text-[11px] text-textSecondary">
              <span className="font-mono" dir="ltr">{rfq.rfqNumber}</span> · از طریق: {rfq.ourEntity.entityName} · ارسال: {formatJalali(rfq.sentDate)}
              {rfq.responseDueDate && <> · مهلت: {formatJalali(rfq.responseDueDate)}</>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${meta.className}`}>{meta.label}</span>
          {open ? <ChevronUp size={15} className="text-textSecondary" /> : <ChevronDown size={15} className="text-textSecondary" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-3">
          {/* اقلام این RFQ */}
          <div className="flex flex-wrap gap-1.5">
            {rfq.items.map((item) => (
              <span key={item.inquiryItemId} className="text-[10px] px-2 py-1 rounded-lg bg-bg text-textSecondary font-mono" dir="ltr">
                {item.inquiryItem.itemCode} × {Number(item.inquiryItem.quantity)}
              </span>
            ))}
            <button onClick={() => setShowPreview(true)} className="text-[10px] px-2 py-1 rounded-lg border border-border text-textSecondary hover:text-primary flex items-center gap-1">
              <Mail size={10} /> پیش‌نمایش ایمیل
            </button>
          </div>

          {rfq.status === "rejected_by_supplier" && rfq.rejectionReason && (
            <div className="text-xs px-3 py-2 rounded-lg bg-danger/10 text-danger flex items-start gap-2">
              <XCircle size={14} className="shrink-0 mt-0.5" />
              <span><b>علت رد تأمین‌کننده:</b> {rfq.rejectionReason}</span>
            </div>
          )}

          {error && <p className="text-xs text-danger">{error}</p>}

          {/* فاز ۵۷ — درخواست حذف RFQ (فقط بدون آفر دریافتی)؛ تأیید/رد از داخل اعلان مدیریت انجام می‌شه */}
          {rfq.deleteRequests.length > 0 ? (
            <div className="text-xs px-3 py-2 rounded-lg bg-warningSoft text-warning flex items-start gap-2">
              <Trash2 size={14} className="shrink-0 mt-0.5" />
              <span>
                درخواست حذف این RFQ توسط «{rfq.deleteRequests[0].requester.fullName}» ثبت شده و در انتظار تأیید مدیریته — دلیل: {rfq.deleteRequests[0].reason}
              </span>
            </div>
          ) : (
            canRequestDelete &&
            rfq.offers.length === 0 && (
              <div>
                {!deleteRequestOpen ? (
                  <button
                    onClick={() => setDeleteRequestOpen(true)}
                    className="text-[11px] px-2.5 py-1.5 rounded-lg border border-danger/40 text-danger flex items-center gap-1.5 hover:bg-danger/5"
                  >
                    <Trash2 size={12} /> درخواست حذف RFQ
                  </button>
                ) : (
                  <div className="space-y-2 rounded-lg p-3 bg-danger/5">
                    <TextArea
                      rows={2}
                      value={deleteReason}
                      onChange={(e) => setDeleteReason(e.target.value)}
                      placeholder="دلیل درخواست حذف این RFQ"
                    />
                    <div className="flex gap-2 justify-end">
                      <GhostButton onClick={() => { setDeleteRequestOpen(false); setDeleteReason(""); }}>
                        انصراف
                      </GhostButton>
                      <PrimaryButton
                        disabled={!deleteReason.trim() || requestDelete.isPending}
                        onClick={async () => {
                          try {
                            setError(null);
                            await requestDelete.mutateAsync({ rfqId: rfq.id, reason: deleteReason.trim() });
                            setDeleteReason("");
                            setDeleteRequestOpen(false);
                          } catch (err) {
                            setError(extractApiError(err, "خطا در ثبت درخواست حذف"));
                          }
                        }}
                      >
                        ثبت درخواست حذف
                      </PrimaryButton>
                    </div>
                  </div>
                )}
              </div>
            )
          )}

          {/* آفر ثبت‌شده */}
          {latestOffer && responseMode !== "edit-offer" && (
            <OfferView offer={latestOffer} rfq={rfq} canRecord={canRecord} inquiryId={inquiryId} internalNumber={internalNumber} onEdit={() => setResponseMode("edit-offer")} />
          )}

          {/* اقدامات ثبت پاسخ */}
          {canRecord && !latestOffer && responseMode === null && (
            <div className="flex gap-2 flex-wrap">
              <PrimaryButton onClick={() => setResponseMode("choose")}>ثبت پاسخ تأمین‌کننده</PrimaryButton>
              {rfq.status === "no_response" && (
                <GhostButton onClick={() => updateStatus.mutate({ rfqId: rfq.id, status: "awaiting_response" })}>
                  <span className="flex items-center gap-1.5"><RotateCcw size={12} /> بازگشت به «در انتظار پاسخ»</span>
                </GhostButton>
              )}
            </div>
          )}

          {responseMode === "choose" && (
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setResponseMode("question")} className="text-xs px-3 py-2 rounded-lg border border-accent text-accent flex items-center gap-1.5">
                <MessageCircleQuestion size={13} /> سوال فنی داشت
              </button>
              <button onClick={() => setResponseMode("offer")} className="text-xs px-3 py-2 rounded-lg border border-success text-success flex items-center gap-1.5">
                <Check size={13} /> پیشنهاد قیمت داد
              </button>
              <button onClick={() => setResponseMode("reject")} className="text-xs px-3 py-2 rounded-lg border border-danger text-danger flex items-center gap-1.5">
                <XCircle size={13} /> رد کرد
              </button>
              <GhostButton onClick={() => setResponseMode(null)}>انصراف</GhostButton>
            </div>
          )}

          {responseMode === "reject" && (
            <div className="space-y-2">
              <TextArea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="علت رد درخواست توسط تأمین‌کننده"
              />
              <div className="flex gap-2 justify-end">
                <GhostButton onClick={() => setResponseMode("choose")}>بازگشت</GhostButton>
                <PrimaryButton
                  disabled={!rejectReason.trim() || reject.isPending}
                  onClick={async () => {
                    try {
                      setError(null);
                      await reject.mutateAsync({ rfqId: rfq.id, reason: rejectReason.trim() });
                      setRejectReason("");
                      setResponseMode(null);
                    } catch (err) {
                      setError(extractApiError(err, "خطا در ثبت رد تأمین‌کننده"));
                    }
                  }}
                >
                  ثبت رد تأمین‌کننده
                </PrimaryButton>
              </div>
            </div>
          )}

          {responseMode === "question" && (
            <div className="space-y-2">
              <TextArea rows={3} value={questionText} onChange={(e) => setQuestionText(e.target.value)} placeholder="متن سوال فنی تأمین‌کننده — خودکار در گفتگوی پرونده با Mention کارشناس فروش ثبت می‌شه" />
              <div className="flex gap-2 justify-end">
                <GhostButton onClick={() => setResponseMode("choose")}>بازگشت</GhostButton>
                <PrimaryButton
                  disabled={!questionText.trim() || technicalQuestion.isPending}
                  onClick={async () => {
                    try {
                      setError(null);
                      await technicalQuestion.mutateAsync({ rfqId: rfq.id, questionText: questionText.trim() });
                      setQuestionText("");
                      setResponseMode(null);
                    } catch (err) {
                      setError(extractApiError(err, "خطا در ثبت سوال فنی"));
                    }
                  }}
                >
                  ثبت سوال فنی
                </PrimaryButton>
              </div>
            </div>
          )}

          {(responseMode === "offer" || responseMode === "edit-offer") && (
            <OfferForm
              rfq={rfq}
              internalNumber={internalNumber}
              existing={responseMode === "edit-offer" ? latestOffer : undefined}
              busy={createOffer.isPending || updateOffer.isPending}
              onCancel={() => setResponseMode(responseMode === "edit-offer" ? null : "choose")}
              onSubmit={async (body) => {
                try {
                  setError(null);
                  if (responseMode === "edit-offer" && latestOffer) {
                    await updateOffer.mutateAsync({ offerId: latestOffer.id, ...body });
                  } else {
                    await createOffer.mutateAsync({ rfqId: rfq.id, ...body });
                  }
                  setResponseMode(null);
                } catch (err) {
                  setError(extractApiError(err, "خطا در ثبت آفر"));
                }
              }}
            />
          )}
        </div>
      )}

      {showPreview && <EmailPreviewModal rfqId={rfq.id} onClose={() => setShowPreview(false)} />}
    </div>
  );
}

// ------------------------------------------------------------
// تب کامل RFQ
// ------------------------------------------------------------
export function RfqTab({ inquiry }: { inquiry: InquiryDetail }) {
  const { user } = useAuth();
  const canSend = hasPermission(user, "rfq.send");
  const { data: rfqs, isLoading } = useRfqs(inquiry.id);

  return (
    <div className="space-y-4">
      {canSend && <NewRfqForm inquiry={inquiry} />}

      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-textPrimary">استعلام‌های ارسال‌شده ({rfqs?.length ?? 0})</p>
      </div>

      {isLoading && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}
      {!isLoading && (rfqs ?? []).length === 0 && (
        <p className="text-xs text-textSecondary py-6 text-center rounded-lg border border-dashed border-border">
          هنوز استعلامی به تأمین‌کننده‌ای ارسال نشده.
        </p>
      )}

      <div className="space-y-2.5">
        {(rfqs ?? []).map((rfq) => (
          <RfqCard key={rfq.id} rfq={rfq} inquiryId={inquiry.id} internalNumber={inquiry.internalNumber} />
        ))}
      </div>
    </div>
  );
}
