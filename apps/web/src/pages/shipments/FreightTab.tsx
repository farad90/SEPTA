import { useMemo, useState } from "react";
import { Award, Building2, ChevronDown, ChevronUp, Clipboard, Mail, Search, Send } from "lucide-react";
import { Field, GhostButton, PrimaryButton, Select, TextArea, TextInput } from "../../components/ui/fields";
import { DualDateInput } from "../../components/ui/DualDateInput";
import { AmountInput } from "../../components/ui/AmountInput";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { formatJalali } from "../../lib/jalali";
import { useDebounced } from "../../lib/use-debounced";
import { usePartners } from "../partners/partners-api";
import { useCurrencies } from "../inquiries/rfqs-api";
import { fetchFreightEmailPreview, useFreightMutations, useFreightRfqs, useReadyPackages } from "./freight-api";
import { FREIGHT_RFQ_STATUS_META, FreightRfq } from "./shipping-types";

function extractApiError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } })?.response?.data?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? fallback);
}

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

function EmailPreviewModal({ rfqId, onClose }: { rfqId: string; onClose: () => void }) {
  const [preview, setPreview] = useState<{ subject: string; text: string; smtpConfigured: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  useState(() => {
    fetchFreightEmailPreview(rfqId).then(setPreview);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px] animate-fade-in">
      <div className="rounded-2xl w-full max-w-2xl p-5 bg-surface shadow-modal space-y-3 max-h-[85vh] overflow-y-auto animate-pop-in">
        <h3 className="text-sm font-bold text-textPrimary">پیش‌نمایش ایمیل استعلام حمل</h3>
        {!preview && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}
        {preview && (
          <>
            {!preview.smtpConfigured && (
              <p className="text-xs rounded-lg p-2.5 bg-warningSoft text-warning">
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

function NewFreightRfqForm({ onCreated }: { onCreated: (rfqId: string, emailSent: boolean) => void }) {
  const { data: packages, isLoading } = useReadyPackages();
  const { create } = useFreightMutations();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [destinationCustoms, setDestinationCustoms] = useState("");
  const [companyQuery, setCompanyQuery] = useState("");
  const [chosenCompany, setChosenCompany] = useState<{ id: string; companyName: string; email: string | null } | null>(null);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [error, setError] = useState<string | null>(null);

  const debouncedQuery = useDebounced(companyQuery, 300);
  const { data: partnersData } = usePartners(debouncedQuery, "freight_forwarder");
  const companyOptions = useMemo(() => (partnersData?.items ?? []).slice(0, 8), [partnersData]);

  function toggle(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const canSubmit = selectedIds.size > 0 && destinationCustoms.trim() && chosenCompany && recipientEmail.includes("@");

  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-4 mb-5">
      <h3 className="text-sm font-bold text-textPrimary">استعلام حمل جدید</h3>

      <div>
        <p className="text-xs font-medium text-textPrimary mb-2">
          بسته‌های آماده حمل ({selectedIds.size} از {packages?.length ?? 0})
        </p>
        {isLoading && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}
        {!isLoading && (packages ?? []).length === 0 && (
          <p className="text-xs text-textSecondary py-3 text-center rounded-lg border border-dashed border-border">
            هیچ بسته «آماده حمل»ی برای استعلام موجود نیست.
          </p>
        )}
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {(packages ?? []).map((pkg) => (
            <label key={pkg.id} className="flex items-center gap-2.5 text-sm rounded-lg border border-border px-3 py-2 cursor-pointer hover:bg-bg">
              <input type="checkbox" checked={selectedIds.has(pkg.id)} onChange={() => toggle(pkg.id)} className="w-4 h-4" />
              <span className="font-mono text-xs text-textSecondary" dir="ltr">{pkg.packageNumber}</span>
              <span className="text-xs text-textPrimary truncate">{pkg.inquirySubject}</span>
              <span className="text-[10px] text-textSecondary">({pkg.inquiryNumber} · {pkg.poNumber} · {pkg.supplierName})</span>
              <span className="font-mono text-xs text-textSecondary mr-auto" dir="ltr">{pkg.weightKg} kg</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="گمرک مقصد *">
          <TextInput value={destinationCustoms} onChange={(e) => setDestinationCustoms(e.target.value)} placeholder="مثلاً گمرک بازرگان" />
        </Field>

        <Field label="شرکت حمل *">
          <div className="relative">
            <Search size={14} className="absolute top-3 right-3 text-textSecondary" />
            <TextInput
              className="pr-9"
              placeholder="جستجوی نام شرکت حمل..."
              value={chosenCompany?.companyName ?? companyQuery}
              onChange={(e) => {
                setCompanyQuery(e.target.value);
                setChosenCompany(null);
                setCompanyOpen(true);
              }}
              onFocus={() => setCompanyOpen(true)}
            />
            {companyOpen && !chosenCompany && companyQuery.trim().length >= 1 && (
              <div className="absolute z-20 w-full mt-1 rounded-lg border border-border bg-surface shadow-lg max-h-44 overflow-y-auto">
                {companyOptions.length === 0 && <p className="text-xs px-3 py-2 text-textSecondary">شرکت حملی یافت نشد</p>}
                {companyOptions.map((company) => (
                  <button
                    key={company.id}
                    type="button"
                    onClick={() => {
                      setChosenCompany({ id: company.id, companyName: company.companyName, email: company.email });
                      setRecipientEmail(company.email ?? "");
                      setCompanyOpen(false);
                    }}
                    className="w-full text-right text-sm px-3 py-2 hover:bg-bg text-textPrimary"
                  >
                    {company.companyName}
                    {company.country && <span className="text-[11px] text-textSecondary"> — {company.country}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>
        </Field>

        <Field label="ایمیل گیرنده *">
          <TextInput value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} dir="ltr" placeholder="ops@freight.com" />
        </Field>

        <Field label="عنوان ایمیل">
          <TextInput value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} dir="ltr" className="font-mono" placeholder="پیش‌فرض: شماره استعلام حمل" />
        </Field>
      </div>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex justify-end">
        <PrimaryButton
          disabled={!canSubmit || create.isPending}
          onClick={async () => {
            try {
              setError(null);
              const result = await create.mutateAsync({
                freightCompanyId: chosenCompany!.id,
                destinationCustoms: destinationCustoms.trim(),
                packageIds: [...selectedIds],
                recipientEmail: recipientEmail.trim(),
                emailSubject: emailSubject.trim() || undefined,
              });
              setSelectedIds(new Set());
              setChosenCompany(null);
              setCompanyQuery("");
              setRecipientEmail("");
              setDestinationCustoms("");
              onCreated(result.id, result.emailSent);
            } catch (err) {
              setError(extractApiError(err, "خطا در ارسال استعلام حمل"));
            }
          }}
        >
          <span className="flex items-center gap-1.5"><Send size={14} /> {create.isPending ? "در حال ارسال..." : "ارسال استعلام حمل"}</span>
        </PrimaryButton>
      </div>
    </div>
  );
}

function OfferForm({ rfq, busy, onSubmit, onCancel }: { rfq: FreightRfq; busy: boolean; onSubmit: (body: { price: number; currencyCode: string; transitTimeDays?: number; offerDate?: string; validityDate?: string; notes?: string }) => void; onCancel: () => void }) {
  const { data: currencies } = useCurrencies();
  const [price, setPrice] = useState<number | null>(rfq.offer ? rfq.offer.price : null);
  const [currencyCode, setCurrencyCode] = useState(rfq.offer?.currencyCode ?? "EUR");
  const [transitTimeDays, setTransitTimeDays] = useState(rfq.offer?.transitTimeDays != null ? String(rfq.offer.transitTimeDays) : "");
  const [offerDate, setOfferDate] = useState<string | null>(rfq.offer?.offerDate ?? null);
  const [validityDate, setValidityDate] = useState<string | null>(rfq.offer?.validityDate ?? null);
  const [notes, setNotes] = useState(rfq.offer?.notes ?? "");

  return (
    <div className="rounded-lg border border-border bg-bg/60 p-4 space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <AmountInput placeholder="قیمت *" value={price} onChange={setPrice} className="font-mono" />
        <Select value={currencyCode} onChange={(e) => setCurrencyCode(e.target.value)}>
          {(currencies ?? []).map((c) => (
            <option key={c.currencyCode} value={c.currencyCode}>{c.currencyCode} — {c.currencyName}</option>
          ))}
        </Select>
        <TextInput placeholder="زمان حمل (روز)" dir="ltr" inputMode="numeric" value={transitTimeDays} onChange={(e) => setTransitTimeDays(e.target.value)} />
        <DualDateInput value={validityDate} onChange={setValidityDate} placeholder="اعتبار پیشنهاد تا" />
      </div>
      <Field label="تاریخ سند آفر">
        <DualDateInput value={offerDate} onChange={setOfferDate} />
      </Field>
      <TextArea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="سایر ملاحظات..." />
      <div className="flex gap-2 justify-end">
        <GhostButton onClick={onCancel}>انصراف</GhostButton>
        <button
          disabled={!price || busy}
          onClick={() =>
            onSubmit({
              price: price ?? 0,
              currencyCode,
              transitTimeDays: transitTimeDays ? parseInt(transitTimeDays, 10) : undefined,
              offerDate: offerDate ?? undefined,
              validityDate: validityDate ?? undefined,
              notes: notes.trim() || undefined,
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

function FreightRfqCard({ rfq }: { rfq: FreightRfq }) {
  const { saveOffer, selectWinner } = useFreightMutations();
  const [open, setOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [confirmingWinner, setConfirmingWinner] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const meta = FREIGHT_RFQ_STATUS_META[rfq.status];

  return (
    <div className="rounded-lg border border-border bg-surface overflow-hidden">
      <button type="button" onClick={() => setOpen(!open)} className="w-full flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-accentSoft text-accent flex items-center justify-center shrink-0">
            <Building2 size={15} />
          </div>
          <div className="text-right min-w-0">
            <p className="text-sm font-semibold text-textPrimary truncate">
              {rfq.freightCompany.companyName}
              {rfq.freightCompany.country && <span className="text-[11px] text-textSecondary font-normal"> — {rfq.freightCompany.country}</span>}
            </p>
            <p className="text-[11px] text-textSecondary">
              <span className="font-mono" dir="ltr">{rfq.rfqNumber}</span> · مقصد: {rfq.destinationCustoms} · ارسال: {formatJalali(rfq.sentDate)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {rfq.wonShipment && (
            <span className="text-[10px] px-2 py-1 rounded-full font-medium bg-primary/10 text-primary">
              برنده — {rfq.wonShipment.shipmentNumber}
            </span>
          )}
          <span className={`text-[10px] px-2 py-1 rounded-full font-medium ${meta.className}`}>{meta.label}</span>
          {open ? <ChevronUp size={15} className="text-textSecondary" /> : <ChevronDown size={15} className="text-textSecondary" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {rfq.packages.map((pkg) => (
              <span key={pkg.id} className="text-[10px] px-2 py-1 rounded-lg bg-bg text-textSecondary font-mono" dir="ltr">
                {pkg.packageNumber} ({pkg.poNumber}) · {pkg.weightKg}kg
              </span>
            ))}
            <button onClick={() => setShowPreview(true)} className="text-[10px] px-2 py-1 rounded-lg border border-border text-textSecondary hover:text-primary flex items-center gap-1">
              <Mail size={10} /> پیش‌نمایش ایمیل
            </button>
          </div>

          {error && <p className="text-xs text-danger">{error}</p>}

          {rfq.offer && !editingOffer && (
            <div className="rounded-lg border border-success/40 bg-successSoft/30 p-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-mono text-textPrimary" dir="ltr">{fmt(rfq.offer.price)} {rfq.offer.currencyCode}</span>
                <button onClick={() => setEditingOffer(true)} className="text-primary">اصلاح</button>
              </div>
              <p className="text-[11px] text-textSecondary">
                {rfq.offer.transitTimeDays != null && <>زمان حمل: {rfq.offer.transitTimeDays} روز · </>}
                دریافت: {formatJalali(rfq.offer.receivedAt)}
                {rfq.offer.validityDate && <> · اعتبار تا: {formatJalali(rfq.offer.validityDate)}</>}
              </p>
              {rfq.offer.notes && <p className="text-[11px] text-textSecondary">{rfq.offer.notes}</p>}
              {!rfq.wonShipment && (
                <div className="pt-1.5">
                  <button
                    onClick={() => setConfirmingWinner(true)}
                    className="text-xs px-3 py-1.5 rounded-lg border border-primary text-primary flex items-center gap-1.5"
                  >
                    <Award size={13} /> انتخاب این شرکت حمل به‌عنوان برنده
                  </button>
                </div>
              )}
            </div>
          )}

          {(!rfq.offer || editingOffer) && (
            <OfferForm
              rfq={rfq}
              busy={saveOffer.isPending}
              onCancel={() => setEditingOffer(false)}
              onSubmit={async (body) => {
                try {
                  setError(null);
                  await saveOffer.mutateAsync({ rfqId: rfq.id, ...body });
                  setEditingOffer(false);
                } catch (err) {
                  setError(extractApiError(err, "خطا در ثبت پیشنهاد"));
                }
              }}
            />
          )}
        </div>
      )}

      {showPreview && <EmailPreviewModal rfqId={rfq.id} onClose={() => setShowPreview(false)} />}
      {confirmingWinner && (
        <ConfirmModal
          title={`انتخاب «${rfq.freightCompany.companyName}» به‌عنوان برنده`}
          description="یک محموله جدید با بسته‌های این استعلام ساخته می‌شه. این عملیات قابل بازگشت نیست."
          confirmLabel="بله، این شرکت رو انتخاب کن"
          busyLabel="در حال ساخت محموله..."
          busy={selectWinner.isPending}
          onCancel={() => setConfirmingWinner(false)}
          onConfirm={async () => {
            try {
              setError(null);
              await selectWinner.mutateAsync(rfq.id);
              setConfirmingWinner(false);
            } catch (err) {
              setError(extractApiError(err, "خطا در انتخاب برنده"));
              setConfirmingWinner(false);
            }
          }}
        />
      )}
    </div>
  );
}

export function FreightTab({ canEdit }: { canEdit: boolean }) {
  const { data: rfqs, isLoading } = useFreightRfqs();
  const [notice, setNotice] = useState<string | null>(null);
  const [previewRfqId, setPreviewRfqId] = useState<string | null>(null);

  if (!canEdit) {
    return <p className="text-xs text-textSecondary py-8 text-center">دسترسی به این بخش ندارید.</p>;
  }

  return (
    <div className="space-y-4">
      <NewFreightRfqForm
        onCreated={(rfqId, emailSent) => {
          setNotice(
            emailSent
              ? "استعلام حمل ثبت و ایمیل ارسال شد ✅"
              : "استعلام ثبت شد ولی ایمیل ارسال نشد (SMTP تنظیم نیست یا خطا داد) — از «پیش‌نمایش ایمیل» متن رو کپی و دستی ارسال کن.",
          );
          if (!emailSent) setPreviewRfqId(rfqId);
        }}
      />

      {notice && (
        <p className="text-xs rounded-lg p-3 bg-warningSoft text-warning flex items-center justify-between gap-2">
          {notice}
          <button onClick={() => setNotice(null)} className="shrink-0 underline">بستن</button>
        </p>
      )}

      <p className="text-sm font-semibold text-textPrimary">استعلام‌های حمل ارسال‌شده ({rfqs?.length ?? 0})</p>

      {isLoading && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}
      {!isLoading && (rfqs ?? []).length === 0 && (
        <p className="text-xs text-textSecondary py-6 text-center rounded-lg border border-dashed border-border">
          هنوز استعلام حملی ارسال نشده.
        </p>
      )}

      <div className="space-y-2.5">
        {(rfqs ?? []).map((rfq) => (
          <FreightRfqCard key={rfq.id} rfq={rfq} />
        ))}
      </div>

      {previewRfqId && <EmailPreviewModal rfqId={previewRfqId} onClose={() => setPreviewRfqId(null)} />}
    </div>
  );
}
