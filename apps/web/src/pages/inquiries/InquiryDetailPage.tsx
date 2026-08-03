import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Flame, Lock, Paperclip, Pencil, Trash2, UserRound, X } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { hasPermission } from "../../lib/permissions";
import { formatJalali } from "../../lib/jalali";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { ViewField } from "../../components/ui/ViewField";
import { FileViewer } from "../../components/ui/FileViewer";
import { FileDropZone, UploadedFileRef } from "../../components/ui/FileDropZone";
import { Field, GhostButton, PrimaryButton, Select, TextArea, TextInput } from "../../components/ui/fields";
import { DualDateInput } from "../../components/ui/DualDateInput";
import { useColleagues } from "../users/users-api";
import { StatusBadge } from "./InquiriesListPage";
import { ActivityFeed } from "./ActivityFeed";
import { ActivitiesPanel } from "./ActivitiesPanel";
import { RfqTab } from "./RfqTab";
import { SelectionTab } from "./SelectionTab";
import { ProposalTab } from "./ProposalTab";
import { OutcomeTab } from "./OutcomeTab";
import { OrderTab } from "./OrderTab";
import { POTab } from "./POTab";
import { ShippingTab } from "./ShippingTab";
import { SettlementTab } from "./SettlementTab";
import { InquiryItemsPanel } from "./InquiryItemsPanel";
import { CHANNEL_LABEL, INQUIRY_STATUS_META, InquiryDetail } from "./inquiry-types";
import { useInquiry, useInquiryMutations } from "./inquiries-api";

// نوار ۹ مرحله فرآیند — مراحل ۱ و ۲ فعال (فاز ۳ و ۴)؛ بقیه در فازهای بعدی
const PROCESS_TABS = [
  { key: "inquiry", label: "ثبت استعلام", enabled: true },
  { key: "rfq", label: "استعلام از تأمین‌کنندگان", enabled: true },
  { key: "selection", label: "انتخاب نهایی و قیمت‌گذاری", enabled: true },
  { key: "proposal", label: "پیشنهاد به مشتری", enabled: true },
  { key: "outcome", label: "نتیجه نهایی (برد/باخت)", enabled: true },
  { key: "order", label: "سفارش مشتری", enabled: true },
  { key: "po", label: "سفارش خرید (PO)", enabled: true },
  { key: "shipping", label: "حمل و گمرک", enabled: true },
  { key: "settlement", label: "تحویل و تسویه", enabled: true },
];

function InfoTab({ inquiry }: { inquiry: InquiryDetail }) {
  const { user } = useAuth();
  const canEdit = hasPermission(user, "inquiry.edit");
  const canAssign = hasPermission(user, "inquiry.assign");
  const canDelete = hasPermission(user, "inquiry.delete");
  const canDecline = hasPermission(user, "inquiry.decline");

  const navigate = useNavigate();
  const { update, assign, remove, decline, addDocument, removeDocument } = useInquiryMutations();
  // واگذاری پرونده: طبق درخواست کاربر، اعضای گروه «مدیریت» جزو گزینه‌ها نیستن
  const { data: colleagues } = useColleagues(true);

  const [editMode, setEditMode] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [declineReason, setDeclineReason] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [assignTo, setAssignTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    subject: inquiry.subject,
    inquiryNumber: inquiry.inquiryNumber ?? "",
    offerEndDate: inquiry.offerEndDate as string | null,
    extendedOfferEndDate: inquiry.extendedOfferEndDate as string | null,
    settlementTerms: inquiry.settlementTerms ?? "",
    description: inquiry.description ?? "",
    status: inquiry.status as string,
  });

  function extractError(err: unknown) {
    const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
    return Array.isArray(message) ? message.join("، ") : message ?? "خطا در ذخیره";
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-textPrimary font-mono tracking-tight" dir="ltr">{inquiry.internalNumber}</h2>
              <StatusBadge status={inquiry.status} />
              {inquiry.urgency === "urgent" && (
                <span className="inline-flex items-center gap-1 text-[10.5px] px-2.5 py-1 rounded-full bg-[#F3E6E4] text-danger font-medium">
                  <Flame size={10} /> فوری
                </span>
              )}
            </div>
            <p className="text-xs text-textSecondary mt-1.5">{inquiry.subject}</p>
          </div>
          {!editMode && (
            <div className="flex gap-2">
              {canEdit && (
                <GhostButton onClick={() => setEditMode(true)}>
                  <span className="flex items-center gap-1.5"><Pencil size={13} /> ویرایش</span>
                </GhostButton>
              )}
              {canDecline && inquiry.status === "in_progress" && (
                <button
                  onClick={() => setDeclineOpen(true)}
                  className="text-xs px-3.5 py-2.5 rounded-lg text-danger border border-danger/40 transition-all duration-150 hover:bg-danger/10"
                >
                  <span className="flex items-center gap-1.5"><X size={13} /> رد استعلام</span>
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => setConfirmDelete(true)}
                  className="text-xs px-3.5 py-2.5 rounded-lg text-danger border border-danger/40 transition-all duration-150 hover:bg-danger/10"
                >
                  <span className="flex items-center gap-1.5"><Trash2 size={13} /> حذف پرونده</span>
                </button>
              )}
            </div>
          )}
        </div>

        {editMode ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="sm:col-span-2">
                <Field label="موضوع *"><TextInput value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} /></Field>
              </div>
              <Field label="شماره استعلام مشتری">
                <TextInput value={form.inquiryNumber} onChange={(e) => setForm({ ...form, inquiryNumber: e.target.value })} dir="ltr" />
              </Field>
              <Field label="وضعیت">
                <Select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
                  {Object.entries(INQUIRY_STATUS_META).map(([value, meta]) => (
                    <option key={value} value={value}>{meta.label}</option>
                  ))}
                </Select>
              </Field>
              <Field label="مهلت ارائه پیشنهاد *">
                <DualDateInput value={form.offerEndDate} onChange={(iso) => setForm({ ...form, offerEndDate: iso })} />
              </Field>
              <Field label="تاریخ تمدید مهلت">
                <DualDateInput value={form.extendedOfferEndDate} onChange={(iso) => setForm({ ...form, extendedOfferEndDate: iso })} />
              </Field>
              <div className="sm:col-span-2">
                <Field label="شرایط تسویه"><TextArea rows={2} value={form.settlementTerms} onChange={(e) => setForm({ ...form, settlementTerms: e.target.value })} /></Field>
              </div>
              <div className="sm:col-span-2">
                <Field label="توضیحات"><TextArea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></Field>
              </div>
            </div>
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex gap-2 justify-end">
              <GhostButton onClick={() => setEditMode(false)}>انصراف</GhostButton>
              <PrimaryButton
                disabled={update.isPending || !form.subject.trim() || !form.offerEndDate}
                onClick={async () => {
                  try {
                    setError(null);
                    await update.mutateAsync({
                      id: inquiry.id,
                      subject: form.subject.trim(),
                      inquiryNumber: form.inquiryNumber.trim() || undefined,
                      offerEndDate: form.offerEndDate!,
                      // ⚠️ عمداً ?? undefined نداره — وقتی کاربر تاریخ رو پاک می‌کنه باید null صراحتاً
                      // فرستاده بشه تا سرور واقعاً پاکش کنه، نه اینکه با undefined نادیده گرفته بشه
                      extendedOfferEndDate: form.extendedOfferEndDate,
                      settlementTerms: form.settlementTerms.trim() || undefined,
                      description: form.description.trim() || undefined,
                      status: form.status,
                    });
                    setEditMode(false);
                  } catch (err) {
                    setError(extractError(err));
                  }
                }}
              >
                {update.isPending ? "در حال ذخیره..." : "ذخیره تغییرات"}
              </PrimaryButton>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-5">
            <ViewField title="مشتری/کارفرما" value={inquiry.buyer.companyName} />
            <ViewField title="کارشناس طرف مشتری" value={inquiry.buyerContact?.contactName} />
            <ViewField title="شماره استعلام مشتری" value={inquiry.inquiryNumber} />
            <ViewField title="کارشناس فروش مسئول" value={inquiry.salesExpert.fullName} />
            <ViewField title="ثبت‌کننده" value={inquiry.createdBy.fullName} />
            <ViewField title="کانال دریافت" value={inquiry.channel ? CHANNEL_LABEL[inquiry.channel] : null} />
            <ViewField title="تاریخ شروع" value={formatJalali(inquiry.inquiryStartDate)} />
            <ViewField title="مهلت پیشنهاد" value={formatJalali(inquiry.offerEndDate)} />
            <ViewField title="تمدید مهلت" value={inquiry.extendedOfferEndDate ? formatJalali(inquiry.extendedOfferEndDate) : null} />
            <ViewField title="تایپ معادل" value={inquiry.isEquivalentAccepted == null ? null : inquiry.isEquivalentAccepted ? "قابل قبوله" : "قابل قبول نیست"} />
            <ViewField title="پیش‌پرداخت" value={inquiry.advancePaymentAvailable == null ? null : inquiry.advancePaymentAvailable ? "امکان‌پذیره" : "ندارد"} />
            <div className="col-span-2 sm:col-span-3">
              <ViewField title="شرایط تسویه" value={inquiry.settlementTerms} />
            </div>
            <div className="col-span-2 sm:col-span-3">
              <ViewField title="توضیحات" value={inquiry.description} />
            </div>
          </div>
        )}

        {/* واگذاری پرونده */}
        {canAssign && !editMode && (
          <div className="border-t border-border pt-3.5">
            {assigning ? (
              <div className="flex items-center gap-2 flex-wrap">
                <UserRound size={14} className="text-textSecondary" />
                <Select value={assignTo} onChange={(e) => setAssignTo(e.target.value)} className="w-48 !py-2">
                  <option value="" disabled>انتخاب کارشناس جدید</option>
                  {(colleagues ?? [])
                    .filter((c) => c.id !== inquiry.salesExpert.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>{c.fullName}</option>
                    ))}
                </Select>
                <GhostButton onClick={() => setAssigning(false)}>انصراف</GhostButton>
                <PrimaryButton
                  disabled={!assignTo || assign.isPending}
                  onClick={async () => {
                    try {
                      setError(null);
                      await assign.mutateAsync({ id: inquiry.id, salesExpertId: assignTo });
                      setAssigning(false);
                      setAssignTo("");
                    } catch (err) {
                      setError(extractError(err));
                    }
                  }}
                >
                  واگذاری
                </PrimaryButton>
              </div>
            ) : (
              <button
                onClick={() => setAssigning(true)}
                className="text-xs text-primary font-medium flex items-center gap-1.5 transition-colors duration-150 hover:brightness-110"
              >
                <UserRound size={13} />
                واگذاری پرونده به کارشناس دیگر
              </button>
            )}
          </div>
        )}
      </div>

      <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Paperclip size={14} className="text-textSecondary" />
          <h3 className="text-sm font-bold text-textPrimary tracking-tight">پیوست‌های کلی استعلام</h3>
        </div>
        {inquiry.documents.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {inquiry.documents.map((doc) => (
              <span
                key={doc.id}
                className="inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1.5 rounded-lg bg-bg border border-border text-textSecondary transition-colors duration-150 hover:border-textSecondary/40"
              >
                <Paperclip size={10} />
                {doc.fileName ?? doc.fileUrl}
                <FileViewer fileUrl={doc.fileUrl} fileName={doc.fileName} />
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => removeDocument.mutate(doc.id)}
                    className="text-danger transition-transform duration-150 hover:scale-110"
                    aria-label="حذف پیوست"
                  >
                    <X size={10} />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
        {canEdit && (
          <FileDropZone
            onFilesUploaded={(files: UploadedFileRef[]) =>
              files.forEach((f) => addDocument.mutate({ inquiryId: inquiry.id, fileUrl: f.fileUrl, fileName: f.fileName }))
            }
            accept=".pdf,.png,.jpg,.jpeg,.webp,.dwg,.xlsx,.docx,.zip,.tif,.tiff"
            compact
            folder={inquiry.internalNumber}
          />
        )}
        {!canEdit && inquiry.documents.length === 0 && (
          <p className="text-[11px] text-textSecondary">پیوستی ثبت نشده</p>
        )}
      </div>

      <InquiryItemsPanel inquiryId={inquiry.id} items={inquiry.items} internalNumber={inquiry.internalNumber} />

      {declineOpen && (
        <ConfirmModal
          title={`رد استعلام «${inquiry.internalNumber}»`}
          description="این استعلام به‌عنوان رد شده توسط بازرگانی ثبت می‌شه و دیگه ادامه پیدا نمی‌کنه."
          confirmLabel="بله، رد کن"
          busyLabel="در حال ثبت..."
          busy={decline.isPending}
          onCancel={() => {
            setDeclineOpen(false);
            setDeclineReason("");
          }}
          onConfirm={async () => {
            await decline.mutateAsync({ id: inquiry.id, reason: declineReason.trim() || undefined });
            setDeclineOpen(false);
            setDeclineReason("");
          }}
        >
          <TextArea
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
            placeholder="دلیل رد (اختیاری)"
            rows={3}
          />
        </ConfirmModal>
      )}

      {confirmDelete && (
        <ConfirmModal
          title={`حذف پرونده «${inquiry.internalNumber}»`}
          description="پرونده به سطل حذف‌شده‌ها منتقل می‌شه — حذف قطعی یا بازگردانی بعداً توسط مدیر ممکنه."
          confirmLabel="بله، حذف کن"
          busyLabel="در حال انتقال..."
          busy={remove.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await remove.mutateAsync(inquiry.id);
            navigate("/inquiries");
          }}
        />
      )}
    </div>
  );
}

export function InquiryDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: inquiry, isLoading, isError } = useInquiry(id);
  const [activeTab, setActiveTab] = useState("inquiry");

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="h-9 w-40 rounded-lg skeleton" />
        <div className="h-10 rounded-xl skeleton" />
        <div className="h-56 rounded-xl skeleton" />
      </div>
    );
  }
  if (isError || !inquiry) {
    return (
      <div className="rounded-xl bg-surface border border-border shadow-card py-10 text-center">
        <p className="text-xs text-danger">پرونده یافت نشد یا خطا در دریافت اطلاعات.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button
        onClick={() => navigate("/inquiries")}
        className="flex items-center gap-1.5 text-xs text-primary font-medium transition-colors duration-150 hover:brightness-110 group"
      >
        <ArrowRight size={14} className="transition-transform duration-150 group-hover:-translate-x-0.5" />
        بازگشت به لیست استعلام‌ها
      </button>

      {/* نوار مراحل فرآیند */}
      <div className="rounded-xl bg-surface border border-border shadow-card px-2 py-1.5 overflow-x-auto">
        <div className="flex items-center gap-1 min-w-max">
          {PROCESS_TABS.map((tab, index) => (
            <button
              key={tab.key}
              disabled={!tab.enabled}
              onClick={() => tab.enabled && setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 text-[11px] px-3 py-2 rounded-lg whitespace-nowrap transition-all duration-150 ease-smooth ${
                activeTab === tab.key
                  ? "bg-primary text-white font-medium shadow-xs"
                  : tab.enabled
                    ? "text-textSecondary hover:bg-bg hover:text-textPrimary"
                    : "text-textSecondary/40 cursor-not-allowed"
              }`}
              title={tab.enabled ? undefined : "در فازهای بعدی فعال می‌شه"}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-semibold shrink-0 ${
                  activeTab === tab.key ? "bg-white/20" : "bg-black/10"
                }`}
              >
                {index + 1}
              </span>
              {tab.label}
              {!tab.enabled && <Lock size={10} />}
            </button>
          ))}
        </div>
      </div>

      {activeTab === "inquiry" && <InfoTab inquiry={inquiry} />}
      {activeTab === "rfq" && <RfqTab inquiry={inquiry} />}
      {activeTab === "selection" && <SelectionTab inquiry={inquiry} />}
      {activeTab === "proposal" && <ProposalTab inquiry={inquiry} />}
      {activeTab === "outcome" && <OutcomeTab inquiry={inquiry} />}
      {activeTab === "order" && <OrderTab inquiry={inquiry} />}
      {activeTab === "po" && <POTab inquiry={inquiry} />}
      {activeTab === "shipping" && <ShippingTab inquiry={inquiry} />}
      {activeTab === "settlement" && <SettlementTab inquiry={inquiry} />}

      <ActivitiesPanel inquiryId={inquiry.id} />
      <ActivityFeed inquiryId={inquiry.id} />
    </div>
  );
}
