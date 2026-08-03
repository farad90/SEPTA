import { useState } from "react";
import { Check, ExternalLink, Paperclip, Plus, X } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { hasPermission } from "../../lib/permissions";
import { GhostButton, Select, TextInput } from "../../components/ui/fields";
import { FileViewer } from "../../components/ui/FileViewer";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { formatJalali } from "../../lib/jalali";
import { uploadFile } from "./inquiries-api";
import { InquiryDetail } from "./inquiry-types";
import {
  useProductionTracking,
  useShipmentStatus,
  useShippingMutations,
  useWarehouseReceipt,
  useWarehouseReceiptMutations,
} from "./shipping-api";
import {
  PackageRow as PackageRowData,
  PRODUCTION_STATUS_META,
  PRODUCTION_STATUSES,
  ProductionEntry,
  SHIPMENT_STAGE_META,
  WarehouseReceiptItemRow,
} from "./shipping-types";

function extractError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } } | null)?.response?.data
    ?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? fallback);
}

function PoTrackingCard({
  entry,
  inquiryId,
  canEdit,
}: {
  entry: ProductionEntry;
  inquiryId: string;
  canEdit: boolean;
}) {
  const mutations = useShippingMutations(inquiryId);
  const [statusDraft, setStatusDraft] = useState(entry.status);
  const [pickup, setPickup] = useState({
    pickupAddress: entry.pickupAddress ?? "",
    pickupPhone: entry.pickupPhone ?? "",
    pickupContactName: entry.pickupContactName ?? "",
    pickupContactEmail: entry.pickupContactEmail ?? "",
    pickupContactPhone: entry.pickupContactPhone ?? "",
  });
  const [newLogNote, setNewLogNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [deletingPackageId, setDeletingPackageId] = useState<string | null>(null);
  const meta = PRODUCTION_STATUS_META[entry.status];

  async function commitStatus() {
    try {
      setError(null);
      await mutations.updateTracking.mutateAsync({ poId: entry.poId, body: { status: statusDraft } });
    } catch (err) {
      setError(extractError(err, "خطا در تغییر وضعیت"));
    }
  }

  async function savePickup() {
    try {
      setError(null);
      await mutations.updateTracking.mutateAsync({ poId: entry.poId, body: pickup });
    } catch (err) {
      setError(extractError(err, "خطا در ذخیره اطلاعات pickup"));
    }
  }

  async function submitLog() {
    if (!newLogNote.trim()) return;
    try {
      setError(null);
      await mutations.addLog.mutateAsync({ poId: entry.poId, note: newLogNote.trim() });
      setNewLogNote("");
    } catch (err) {
      setError(extractError(err, "خطا در ثبت یادداشت"));
    }
  }

  return (
    <div className="rounded-lg p-3 bg-bg">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-textPrimary">
          {entry.supplierName} <span className="font-mono text-xs text-textSecondary" dir="ltr">({entry.poNumber})</span>
        </span>
        <div className="flex items-center gap-1.5">
          <Select
            disabled={!canEdit}
            value={statusDraft}
            onChange={(e) => setStatusDraft(e.target.value as typeof statusDraft)}
            className={`!w-auto !py-1 !border-0 text-xs ${meta.className}`}
          >
            {PRODUCTION_STATUSES.map((s) => (
              <option key={s} value={s}>{PRODUCTION_STATUS_META[s].label}</option>
            ))}
          </Select>
          {statusDraft !== entry.status && canEdit && (
            <GhostButton onClick={commitStatus} disabled={mutations.updateTracking.isPending}>ثبت</GhostButton>
          )}
        </div>
      </div>

      {error && <p className="text-[11px] text-danger mb-2">{error}</p>}

      <div className="space-y-1 mb-2">
        {entry.logs.map((l) => (
          <p key={l.id} className="text-[11px] text-textSecondary">
            <span className="font-mono" dir="ltr">{formatJalali(l.logDate)}</span> — {l.note}
          </p>
        ))}
      </div>

      {entry.status === "in_transit" && (
        <p className="text-[11px] text-success">✓ کالا در حال حمله — دیگر نیازی به پیگیری نیست.</p>
      )}

      {entry.status === "ready_to_ship" && (
        <div>
          <p className="text-[11px] font-medium mb-2 text-accent">محل pickup کالا برای شرکت حمل</p>
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            <TextInput
              disabled={!canEdit}
              placeholder="آدرس"
              value={pickup.pickupAddress}
              onChange={(e) => setPickup((p) => ({ ...p, pickupAddress: e.target.value }))}
              className="col-span-2 !py-1.5 text-[11px]"
            />
            <TextInput
              disabled={!canEdit}
              placeholder="تلفن محل"
              value={pickup.pickupPhone}
              onChange={(e) => setPickup((p) => ({ ...p, pickupPhone: e.target.value }))}
              className="!py-1.5 text-[11px] font-mono"
              dir="ltr"
            />
            <TextInput
              disabled={!canEdit}
              placeholder="نام شخص رابط"
              value={pickup.pickupContactName}
              onChange={(e) => setPickup((p) => ({ ...p, pickupContactName: e.target.value }))}
              className="!py-1.5 text-[11px]"
            />
            <TextInput
              disabled={!canEdit}
              placeholder="ایمیل رابط"
              value={pickup.pickupContactEmail}
              onChange={(e) => setPickup((p) => ({ ...p, pickupContactEmail: e.target.value }))}
              className="!py-1.5 text-[11px]"
            />
            <TextInput
              disabled={!canEdit}
              placeholder="تلفن رابط"
              value={pickup.pickupContactPhone}
              onChange={(e) => setPickup((p) => ({ ...p, pickupContactPhone: e.target.value }))}
              className="!py-1.5 text-[11px] font-mono"
              dir="ltr"
            />
          </div>
          {canEdit && (
            <div className="flex justify-end mb-3">
              <GhostButton onClick={savePickup} disabled={mutations.updateTracking.isPending}>
                ذخیره اطلاعات pickup
              </GhostButton>
            </div>
          )}

          <div className="pt-2 border-t border-dashed border-border">
            <p className="text-[11px] font-medium mb-1.5 text-textSecondary">
              بسته‌بندی (برای استعلام حمل در ماژول مدیریت بارها لازمه)
            </p>
            {entry.packages.map((p) => (
              <PackageCard
                key={p.id}
                pkg={p}
                canEdit={canEdit}
                onCommit={(body) => mutations.updatePackage.mutateAsync({ id: p.id, body })}
                onMarkReady={() => mutations.updatePackage.mutate({ id: p.id, body: { status: "ready_to_ship" } })}
                onDelete={() => setDeletingPackageId(p.id)}
              />
            ))}
            {canEdit && (
              <GhostButton onClick={() => mutations.addPackage.mutate(entry.poId)} disabled={mutations.addPackage.isPending}>
                <span className="flex items-center gap-1.5"><Plus size={12} /> افزودن بسته</span>
              </GhostButton>
            )}
          </div>
        </div>
      )}

      {entry.status === "in_production" && canEdit && (
        <div className="flex gap-2">
          <TextInput
            value={newLogNote}
            onChange={(e) => setNewLogNote(e.target.value)}
            placeholder="یادداشت پیگیری جدید..."
            className="flex-1 !py-1.5 text-xs"
          />
          <GhostButton onClick={submitLog} disabled={mutations.addLog.isPending}>ثبت</GhostButton>
        </div>
      )}

      {deletingPackageId && (
        <ConfirmModal
          title="حذف این بسته"
          busy={mutations.deletePackage.isPending}
          onCancel={() => setDeletingPackageId(null)}
          onConfirm={async () => {
            try {
              await mutations.deletePackage.mutateAsync(deletingPackageId);
            } finally {
              setDeletingPackageId(null);
            }
          }}
        />
      )}
    </div>
  );
}

function PackageCard({
  pkg,
  canEdit,
  onCommit,
  onMarkReady,
  onDelete,
}: {
  pkg: PackageRowData;
  canEdit: boolean;
  onCommit: (body: Record<string, unknown>) => Promise<unknown>;
  onMarkReady: () => void;
  onDelete: () => void;
}) {
  const [draft, setDraft] = useState({
    lengthCm: pkg.lengthCm != null ? String(pkg.lengthCm) : "",
    widthCm: pkg.widthCm != null ? String(pkg.widthCm) : "",
    heightCm: pkg.heightCm != null ? String(pkg.heightCm) : "",
    weightKg: String(pkg.weightKg),
    pickupLocation: pkg.pickupLocation,
  });
  const [committing, setCommitting] = useState(false);
  const locked = pkg.status === "ready_to_ship";

  async function handleCommit() {
    setCommitting(true);
    try {
      await onCommit({
        lengthCm: parseFloat(draft.lengthCm) || 0,
        widthCm: parseFloat(draft.widthCm) || 0,
        heightCm: parseFloat(draft.heightCm) || 0,
        weightKg: parseFloat(draft.weightKg) || 0,
        pickupLocation: draft.pickupLocation,
      });
    } finally {
      setCommitting(false);
    }
  }

  return (
    <div className="rounded-lg p-2.5 mb-1.5 bg-surface border border-border transition-colors duration-150 hover:border-textSecondary/40">
      <div className="flex items-center justify-between mb-1.5">
        <p className="font-mono text-[11px] font-semibold text-textPrimary" dir="ltr">{pkg.packageNumber}</p>
        {locked ? (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-successSoft text-success flex items-center gap-1">
            <Check size={10} /> آماده حمل
          </span>
        ) : (
          <div className="flex items-center gap-1.5">
            {canEdit && (
              <button
                type="button"
                onClick={onMarkReady}
                className="text-[10px] px-2 py-0.5 rounded-full text-primary border border-primary"
              >
                اعلام آماده حمل
              </button>
            )}
            {canEdit && (
              <button type="button" onClick={onDelete} className="text-danger">
                <X size={12} />
              </button>
            )}
          </div>
        )}
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {(
          [
            ["lengthCm", "طول(cm)"],
            ["widthCm", "عرض(cm)"],
            ["heightCm", "ارتفاع(cm)"],
            ["weightKg", "وزن(kg)"],
          ] as const
        ).map(([field, placeholder]) => (
          <TextInput
            key={field}
            disabled={!canEdit || locked}
            value={draft[field]}
            onChange={(e) => setDraft((d) => ({ ...d, [field]: e.target.value }))}
            placeholder={placeholder}
            className="font-mono !py-1 text-[11px]"
            dir="ltr"
          />
        ))}
      </div>
      <TextInput
        disabled={!canEdit || locked}
        value={draft.pickupLocation}
        onChange={(e) => setDraft((d) => ({ ...d, pickupLocation: e.target.value }))}
        placeholder="محل بارگیری (انبار واسط یا نزد تأمین‌کننده)"
        className="!py-1 text-[11px] mt-1.5"
      />
      {canEdit && !locked && (
        <div className="flex justify-end mt-1.5">
          <GhostButton onClick={handleCommit} disabled={committing}>ثبت</GhostButton>
        </div>
      )}
    </div>
  );
}

function ShipmentStatusCard({ inquiryId }: { inquiryId: string }) {
  const { data, isLoading } = useShipmentStatus(inquiryId);
  if (isLoading || !data || data.length === 0) return null;

  return (
    <div className="rounded-xl p-5 mb-5 bg-surface border border-border shadow-card border-r-4 border-r-accent">
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-semibold text-textPrimary">وضعیت محموله (فقط‌خواندنی)</p>
        <a
          href="/shipments"
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-primary border border-primary"
        >
          مشاهده در مدیریت محموله‌ها <ExternalLink size={11} />
        </a>
      </div>
      <p className="text-xs mb-3 text-textSecondary">
        چون یک محموله می‌تونه شامل PO های چند پرونده مختلف باشه، انتخاب PO ها و پیوست اسناد صادرات/واردات در یک
        ماژول سراسری جدا («مدیریت محموله‌ها») انجام می‌شه، نه اینجا. این بخش فقط وضعیت رو نشون می‌ده.
      </p>
      <div className="space-y-2">
        {data.map((row) => {
          const meta = row.stage ? SHIPMENT_STAGE_META[row.stage] : null;
          return (
            <div key={row.poId} className="flex flex-wrap items-center gap-3 rounded-lg px-3 py-2.5 bg-bg">
              <span className="font-mono text-xs text-textSecondary" dir="ltr">{row.poNumber}</span>
              <span className="text-xs text-textPrimary">{row.supplierName}</span>
              {row.shipmentNumber && (
                <span className="font-mono text-[11px] text-textSecondary" dir="ltr">
                  محموله: {row.shipmentNumber}
                </span>
              )}
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full mr-auto ${meta?.className ?? "bg-bg text-textSecondary"}`}
              >
                {meta?.label ?? "هنوز ارسال نشده"}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function WarehouseReceiptItemCard({
  item,
  inquiryId,
  canEdit,
}: {
  item: WarehouseReceiptItemRow;
  inquiryId: string;
  canEdit: boolean;
}) {
  const { saveItems, addPhoto } = useWarehouseReceiptMutations(inquiryId);
  const [uploading, setUploading] = useState(false);
  const [qtyDraft, setQtyDraft] = useState(item.receivedQuantity != null ? String(item.receivedQuantity) : "");
  const dirty = qtyDraft !== (item.receivedQuantity != null ? String(item.receivedQuantity) : "");

  function commitQty() {
    saveItems.mutate([{ inquiryItemId: item.inquiryItemId, receivedQuantity: parseFloat(qtyDraft) || 0 }]);
  }

  return (
    <div className="rounded-lg p-3 bg-bg">
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <span className="font-mono text-xs text-textSecondary" dir="ltr">{item.itemCode}</span>
        <span className="text-xs text-textPrimary">{item.description}</span>
        <span className="font-mono text-[11px] text-textSecondary" dir="ltr">
          (سفارش: {item.orderedQuantity} {item.measurementUnit})
        </span>
        <div className="flex items-center gap-1.5 mr-auto">
          <TextInput
            disabled={!canEdit}
            value={qtyDraft}
            onChange={(e) => setQtyDraft(e.target.value)}
            placeholder="مقدار دریافتی"
            className="font-mono !w-24 !py-1.5 text-xs"
            dir="ltr"
          />
          {canEdit && dirty && (
            <GhostButton onClick={commitQty} disabled={saveItems.isPending}>ثبت</GhostButton>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {item.photos.map((p) => (
          <span key={p.id} className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-surface text-textSecondary">
            <Paperclip size={10} /> تصویر
            <FileViewer fileUrl={p.photoUrl} fileName="تصویر کالای دریافتی" />
          </span>
        ))}
        {canEdit && item.receiptItemId && (
          <label className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg cursor-pointer text-accent bg-accentSoft">
            <Paperclip size={12} /> {uploading ? "در حال آپلود..." : "بارگذاری تصاویر این کالا"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                try {
                  const stored = await uploadFile(file);
                  await addPhoto.mutateAsync({ receiptItemId: item.receiptItemId!, photoUrl: stored.fileUrl });
                } finally {
                  setUploading(false);
                  e.target.value = "";
                }
              }}
            />
          </label>
        )}
        {canEdit && !item.receiptItemId && (
          <p className="text-[11px] text-textSecondary">ابتدا مقدار دریافتی رو وارد کن</p>
        )}
      </div>
    </div>
  );
}

function WarehouseReceiptSection({ inquiryId, canEdit }: { inquiryId: string; canEdit: boolean }) {
  const { data, isLoading, isError, error } = useWarehouseReceipt(inquiryId);

  if (!canEdit) return null;
  if (isLoading) return <div className="space-y-3"><div className="h-10 rounded-xl skeleton" /><div className="h-32 rounded-xl skeleton" /></div>;
  if (isError || !data) {
    return (
      <div className="rounded-xl p-5 bg-surface border border-border shadow-card">
        <p className="text-sm font-semibold mb-1 text-textPrimary">دریافت کالا در انبار</p>
        <p className="text-xs rounded-lg px-3 py-2 bg-warningSoft text-textPrimary">
          {extractError(error, "هنوز هیچ محموله‌ای برای این پرونده ترخیص نشده")}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl p-5 bg-surface border border-border shadow-card">
      <p className="text-sm font-semibold mb-1 text-textPrimary">دریافت کالا در انبار</p>
      <p className="text-xs mb-3 text-textSecondary">
        محموله ترخیص‌شده: <span className="font-mono" dir="ltr">{data.shipmentNumber}</span> — مقدار دریافتی و
        تصاویر هر قلم رو اینجا ثبت کن.
      </p>
      <div className="space-y-2">
        {data.items.map((item) => (
          <WarehouseReceiptItemCard key={item.inquiryItemId} item={item} inquiryId={inquiryId} canEdit={canEdit} />
        ))}
      </div>
    </div>
  );
}

export function ShippingTab({ inquiry }: { inquiry: InquiryDetail }) {
  const { user } = useAuth();
  const canView = hasPermission(user, "shipping.view");
  const canEdit = hasPermission(user, "shipping.record_packaging");
  const canRecordWarehouseReceipt = hasPermission(user, "shipping.record_warehouse_receipt");

  const { data, isLoading, isError, error } = useProductionTracking(inquiry.id);

  if (!canView) {
    return <div className="rounded-xl bg-surface border border-border shadow-card py-10 text-center"><p className="text-xs text-textSecondary">دسترسی به این بخش ندارید.</p></div>;
  }
  if (isLoading) return <div className="space-y-3"><div className="h-10 rounded-xl skeleton" /><div className="h-32 rounded-xl skeleton" /></div>;
  if (isError || !data) {
    return (
      <div className="rounded-lg px-4 py-3 text-xs bg-warningSoft text-textPrimary">
        {extractError(error, "ابتدا باید سفارش خرید (PO) صادر بشه")}
      </div>
    );
  }

  return (
    <div>
      <ShipmentStatusCard inquiryId={inquiry.id} />

      <div className="rounded-xl p-5 mb-5 bg-surface border border-border shadow-card">
        <p className="text-sm font-semibold mb-3 text-textPrimary">پیگیری تولید نزد تأمین‌کنندگان</p>
        <div className="space-y-3">
          {data.map((entry) => (
            <PoTrackingCard key={entry.poId} entry={entry} inquiryId={inquiry.id} canEdit={canEdit} />
          ))}
        </div>
      </div>

      <WarehouseReceiptSection inquiryId={inquiry.id} canEdit={canRecordWarehouseReceipt} />
    </div>
  );
}
