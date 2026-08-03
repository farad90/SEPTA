import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, FileUp, Info, Package, Paperclip, Plus, Trash2, X } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { hasPermission } from "../../lib/permissions";
import { todayIso } from "../../lib/jalali";
import { CatalogItem } from "../../lib/types";
import { Field, GhostButton, PrimaryButton, Select, TextArea, TextInput } from "../../components/ui/fields";
import { DualDateInput } from "../../components/ui/DualDateInput";
import { Toggle } from "../../components/ui/Toggle";
import { usePartners } from "../partners/partners-api";
import { ItemCodeField } from "./ItemCodeField";
import { QuickAddCatalogModal } from "./QuickAddCatalogModal";
import { CHANNEL_LABEL } from "./inquiry-types";
import { uploadFile, useInquiryMutations } from "./inquiries-api";
import { FileViewer } from "../../components/ui/FileViewer";
import { FileDropZone, UploadedFileRef } from "../../components/ui/FileDropZone";

function SectionCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-accentSoft text-accent flex items-center justify-center">{icon}</div>
        <div>
          <h3 className="text-sm font-bold text-textPrimary">{title}</h3>
          {subtitle && <p className="text-[11px] text-textSecondary">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

interface PendingAttachment {
  fileUrl: string;
  fileName: string;
}

interface ItemRow {
  key: number;
  itemCode: string; // FK داخلی — پشت صحنه از انتخاب پارت نامبر resolve می‌شه
  partNumber: string;
  builder: string;
  quantity: string;
  measurementUnit: string;
  description: string;
  serialNumber: string;
  equivalentType: string;
  drawingNumber: string;
  attachments: PendingAttachment[];
  uploading: boolean;
}

let rowKeyCounter = 1;
function emptyRow(): ItemRow {
  return {
    key: rowKeyCounter++,
    itemCode: "",
    partNumber: "",
    builder: "",
    quantity: "",
    measurementUnit: "عدد",
    description: "",
    serialNumber: "",
    equivalentType: "",
    drawingNumber: "",
    attachments: [],
    uploading: false,
  };
}

export function InquiryFormPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const canQuickAddCatalog = hasPermission(user, "catalog.create");
  const { create, addItemDocument, addDocument } = useInquiryMutations();
  const [pendingDocuments, setPendingDocuments] = useState<PendingAttachment[]>([]);

  const [form, setForm] = useState({
    subject: "",
    inquiryNumber: "",
    buyerId: "",
    buyerContactId: "",
    offerEndDate: null as string | null,
    extendedOfferEndDate: null as string | null,
    inquiryStartDate: todayIso() as string | null,
    channel: "",
    urgency: "normal",
    isEquivalentAccepted: false,
    advancePaymentAvailable: false,
    settlementTerms: "",
    description: "",
  });
  const [rows, setRows] = useState<ItemRow[]>([emptyRow()]);
  const [quickAddPartNumber, setQuickAddPartNumber] = useState<string | null>(null);
  const [quickAddRowKey, setQuickAddRowKey] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data: partnersData } = usePartners("", "all");
  const customers = useMemo(
    () => (partnersData?.items ?? []).filter((p) => ["customer", "both"].includes(p.partnerType)),
    [partnersData],
  );
  const selectedBuyer = customers.find((c) => c.id === form.buyerId);

  function setRow(key: number, patch: Partial<ItemRow>) {
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  }

  function applyCatalogItem(rowKey: number, item: CatalogItem) {
    setRow(rowKey, {
      itemCode: item.itemCode,
      partNumber: item.partNumber,
      description: item.itemDescription,
      builder: item.builder ?? "",
      measurementUnit: item.defaultMeasurementUnit ?? "عدد",
    });
  }

  async function handleAttach(rowKey: number, file: File) {
    setRow(rowKey, { uploading: true });
    try {
      const stored = await uploadFile(file);
      setRows((current) =>
        current.map((row) =>
          row.key === rowKey
            ? { ...row, attachments: [...row.attachments, stored], uploading: false }
            : row,
        ),
      );
    } catch {
      setRow(rowKey, { uploading: false });
    }
  }

  // ردیف معتبره اگر پارت نامبر از کالاها resolve شده باشه (itemCode پر باشه) + شرح/مقدار/واحد
  const validRows = rows.filter(
    (row) => row.itemCode && row.description.trim() && Number(row.quantity) > 0 && row.measurementUnit,
  );
  const unresolvedRows = rows.filter((row) => row.partNumber.trim() && !row.itemCode);
  const canSubmit =
    form.subject.trim().length >= 2 &&
    form.buyerId &&
    form.offerEndDate &&
    form.inquiryStartDate &&
    validRows.length === rows.length &&
    rows.length >= 1 &&
    !submitting;

  async function submit() {
    try {
      setError(null);
      setSubmitting(true);
      const created = await create.mutateAsync({
        subject: form.subject.trim(),
        inquiryNumber: form.inquiryNumber.trim() || undefined,
        buyerId: form.buyerId,
        buyerContactId: form.buyerContactId || undefined,
        offerEndDate: form.offerEndDate!,
        extendedOfferEndDate: form.extendedOfferEndDate ?? undefined,
        inquiryStartDate: form.inquiryStartDate!,
        channel: form.channel || undefined,
        urgency: form.urgency,
        isEquivalentAccepted: form.isEquivalentAccepted,
        advancePaymentAvailable: form.advancePaymentAvailable,
        settlementTerms: form.settlementTerms.trim() || undefined,
        description: form.description.trim() || undefined,
        items: rows.map((row) => ({
          itemCode: row.itemCode,
          description: row.description,
          quantity: Number(row.quantity),
          measurementUnit: row.measurementUnit,
          equivalentType: row.equivalentType || undefined,
          partNumber: row.partNumber || undefined,
          drawingNumber: row.drawingNumber || undefined,
          builder: row.builder || undefined,
          serialNumber: row.serialNumber || undefined,
        })),
      });

      // پیوست‌های از پیش بارگذاری‌شده هر ردیف رو به قلم متناظرش (به همون ترتیب) وصل می‌کنیم
      await Promise.all(
        rows.flatMap((row, index) => {
          const createdItem = created.items[index];
          if (!createdItem) return [];
          return row.attachments.map((att) =>
            addItemDocument.mutateAsync({ itemId: createdItem.id, fileUrl: att.fileUrl, fileName: att.fileName }),
          );
        }),
      );

      // پیوست‌های کلی پرونده (جدا از ردیف‌ها) رو هم به پرونده‌ی تازه‌ساخته وصل می‌کنیم
      await Promise.all(
        pendingDocuments.map((att) =>
          addDocument.mutateAsync({ inquiryId: created.id, fileUrl: att.fileUrl, fileName: att.fileName }),
        ),
      );

      navigate(`/inquiries/${created.id}`);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
      setError(Array.isArray(message) ? message.join("، ") : message ?? "خطا در ثبت استعلام");
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4 max-w-4xl">
      <button onClick={() => navigate("/inquiries")} className="flex items-center gap-1.5 text-xs text-primary font-medium">
        <ArrowRight size={14} />
        بازگشت به لیست استعلام‌ها
      </button>

      <SectionCard title="اطلاعات کلی استعلام" subtitle="مرحله ۱ و ۲ فرآیند — دریافت و ثبت استعلام" icon={<Info size={16} />}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2">
            <Field label="موضوع استعلام *">
              <TextInput value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="مثلاً تأمین یاتاقان‌های خط تولید نورد ۲" />
            </Field>
          </div>
          <Field label="شرکت مشتری/کارفرما *">
            <Select value={form.buyerId} onChange={(e) => setForm({ ...form, buyerId: e.target.value, buyerContactId: "" })}>
              <option value="" disabled>انتخاب از شرکت‌های نوع مشتری</option>
              {customers.map((customer) => (
                <option key={customer.id} value={customer.id}>{customer.companyName}</option>
              ))}
            </Select>
          </Field>
          <Field label="کارشناس طرف مشتری">
            <Select
              value={form.buyerContactId}
              onChange={(e) => setForm({ ...form, buyerContactId: e.target.value })}
              disabled={!selectedBuyer}
            >
              <option value="">— بدون رابط مشخص —</option>
              {(selectedBuyer?.contacts ?? []).map((contact) => (
                <option key={contact.id} value={contact.id}>{contact.contactName}</option>
              ))}
            </Select>
          </Field>
          <Field label="شماره استعلام/مناقصه مشتری">
            <TextInput value={form.inquiryNumber} onChange={(e) => setForm({ ...form, inquiryNumber: e.target.value })} dir="ltr" placeholder="TND-1405-118" />
          </Field>
          <Field label="کانال دریافت">
            <Select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })}>
              <option value="">—</option>
              {Object.entries(CHANNEL_LABEL).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </Select>
          </Field>
          <Field label="تاریخ شروع استعلام *">
            <DualDateInput value={form.inquiryStartDate} onChange={(iso) => setForm({ ...form, inquiryStartDate: iso })} />
          </Field>
          <Field label="مهلت ارائه پیشنهاد *">
            <DualDateInput value={form.offerEndDate} onChange={(iso) => setForm({ ...form, offerEndDate: iso })} />
          </Field>
          <Field label="تاریخ تمدید مهلت (در صورت تمدید)">
            <DualDateInput value={form.extendedOfferEndDate} onChange={(iso) => setForm({ ...form, extendedOfferEndDate: iso })} />
          </Field>
          <Field label="سطح فوریت">
            <Select value={form.urgency} onChange={(e) => setForm({ ...form, urgency: e.target.value })}>
              <option value="normal">عادی</option>
              <option value="urgent">فوری</option>
            </Select>
          </Field>
          <div className="sm:col-span-2 flex flex-wrap gap-6 py-1">
            <Toggle checked={form.isEquivalentAccepted} onChange={(v) => setForm({ ...form, isEquivalentAccepted: v })} label="تایپ معادل قابل قبوله" />
            <Toggle checked={form.advancePaymentAvailable} onChange={(v) => setForm({ ...form, advancePaymentAvailable: v })} label="امکان دریافت پیش‌پرداخت هست" />
          </div>
          <div className="sm:col-span-2">
            <Field label="شرایط تسویه مدنظر مشتری">
              <TextArea rows={2} value={form.settlementTerms} onChange={(e) => setForm({ ...form, settlementTerms: e.target.value })} />
            </Field>
          </div>
          <div className="sm:col-span-2">
            <Field label="توضیحات/کامنت آزاد">
              <TextArea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
          </div>
        </div>
      </SectionCard>

      <SectionCard title={`اقلام استعلام (${rows.length})`} subtitle="پارت نامبر باید در فهرست کالاها موجود باشه — از پیشنهادهای زنده انتخاب کن" icon={<Package size={16} />}>
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={row.key} className="rounded-lg border border-border p-3 space-y-2 bg-bg/50">
              <div className="flex items-start gap-2">
                <span className="text-[11px] font-bold text-textSecondary w-6 pt-2.5">{index + 1}</span>
                <div className="flex-1 space-y-2">
                  {/* ردیف اول: پارت نامبر، سازنده اصلی، مقدار، واحد اندازه‌گیری */}
                  <div className="grid grid-cols-1 sm:grid-cols-[2fr,1.2fr,90px,110px] gap-2">
                    <ItemCodeField
                      value={row.partNumber}
                      onTextChange={(text) => setRow(row.key, { partNumber: text, itemCode: "" })}
                      onSelect={(item) => applyCatalogItem(row.key, item)}
                      onAddNew={(partNumber) => {
                        if (!canQuickAddCatalog) return;
                        setQuickAddPartNumber(partNumber);
                        setQuickAddRowKey(row.key);
                      }}
                    />
                    <TextInput placeholder="سازنده اصلی" dir="ltr" value={row.builder} onChange={(e) => setRow(row.key, { builder: e.target.value })} />
                    <TextInput placeholder="مقدار *" dir="ltr" inputMode="decimal" value={row.quantity} onChange={(e) => setRow(row.key, { quantity: e.target.value })} />
                    <TextInput placeholder="واحد *" value={row.measurementUnit} onChange={(e) => setRow(row.key, { measurementUnit: e.target.value })} />
                  </div>

                  {/* ردیف دوم: شرح کالا (چندسطری)، شماره سریال، تایپ معادل، شماره نقشه */}
                  <div className="grid grid-cols-1 sm:grid-cols-[2fr,1fr,1fr,1fr] gap-2">
                    <TextArea
                      placeholder="شرح کالا *"
                      rows={1}
                      value={row.description}
                      onChange={(e) => setRow(row.key, { description: e.target.value })}
                      className="sm:row-span-1"
                    />
                    <TextInput placeholder="شماره سریال" dir="ltr" value={row.serialNumber} onChange={(e) => setRow(row.key, { serialNumber: e.target.value })} />
                    <TextInput placeholder="تایپ معادل" value={row.equivalentType} onChange={(e) => setRow(row.key, { equivalentType: e.target.value })} />
                    <TextInput placeholder="شماره نقشه" dir="ltr" value={row.drawingNumber} onChange={(e) => setRow(row.key, { drawingNumber: e.target.value })} />
                  </div>

                  {/* پیوست‌ها */}
                  <div className="flex flex-wrap items-center gap-2">
                    {row.attachments.map((att, attIndex) => (
                      <span key={att.fileUrl} className="inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-xl bg-surface border border-border shadow-card text-textSecondary">
                        <Paperclip size={10} />
                        {att.fileName}
                        <FileViewer fileUrl={att.fileUrl} fileName={att.fileName} />
                        <button
                          type="button"
                          onClick={() =>
                            setRow(row.key, { attachments: row.attachments.filter((_, i) => i !== attIndex) })
                          }
                          className="text-danger"
                        >
                          <X size={10} />
                        </button>
                      </span>
                    ))}
                    <label className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-dashed border-border text-textSecondary cursor-pointer hover:text-primary hover:border-primary">
                      <FileUp size={10} />
                      {row.uploading ? "در حال بارگذاری..." : "پیوست فایل"}
                      <input
                        type="file"
                        className="hidden"
                        disabled={row.uploading}
                        accept=".pdf,.png,.jpg,.jpeg,.webp,.dwg,.xlsx,.docx,.zip,.tif,.tiff"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleAttach(row.key, file);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setRows((current) => current.filter((r) => r.key !== row.key))}
                  disabled={rows.length === 1}
                  className="text-danger disabled:opacity-30 mt-2"
                  aria-label="حذف ردیف"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
          <GhostButton onClick={() => setRows((current) => [...current, emptyRow()])}>
            <span className="flex items-center gap-1.5"><Plus size={13} /> ردیف جدید</span>
          </GhostButton>
          {unresolvedRows.length > 0 && (
            <p className="text-[11px] text-warning">
              پارت نامبر «{unresolvedRows[0].partNumber}» هنوز از فهرست کالاها انتخاب نشده — از پیشنهادها انتخاب کن یا «افزودن سریع» رو بزن.
            </p>
          )}
        </div>
      </SectionCard>

      <SectionCard title="پیوست‌های کلی استعلام" subtitle="فایل‌هایی که به کل پرونده مربوطن، جدا از پیوست هر ردیف کالا" icon={<Paperclip size={16} />}>
        <div className="space-y-2">
          {pendingDocuments.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {pendingDocuments.map((doc, index) => (
                <span key={doc.fileUrl} className="inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-xl bg-surface border border-border shadow-card text-textSecondary">
                  <Paperclip size={10} />
                  {doc.fileName}
                  <FileViewer fileUrl={doc.fileUrl} fileName={doc.fileName} />
                  <button
                    type="button"
                    onClick={() => setPendingDocuments((current) => current.filter((_, i) => i !== index))}
                    className="text-danger"
                  >
                    <X size={10} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <FileDropZone
            onFilesUploaded={(files: UploadedFileRef[]) => setPendingDocuments((current) => [...current, ...files])}
            accept=".pdf,.png,.jpg,.jpeg,.webp,.dwg,.xlsx,.docx,.zip"
          />
        </div>
      </SectionCard>

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex gap-2 justify-end">
        <GhostButton onClick={() => navigate("/inquiries")}>انصراف</GhostButton>
        <PrimaryButton disabled={!canSubmit} onClick={submit}>
          {submitting ? "در حال ثبت..." : "ثبت استعلام"}
        </PrimaryButton>
      </div>

      {quickAddPartNumber !== null && (
        <QuickAddCatalogModal
          initialPartNumber={quickAddPartNumber}
          onCancel={() => setQuickAddPartNumber(null)}
          onCreated={(item) => {
            if (quickAddRowKey !== null) applyCatalogItem(quickAddRowKey, item);
            setQuickAddPartNumber(null);
            setQuickAddRowKey(null);
          }}
        />
      )}
    </div>
  );
}
