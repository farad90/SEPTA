import { useRef, useState } from "react";
import { FileUp, Pencil, Plus, Trash2, X } from "lucide-react";
import { hasPermission } from "../../lib/permissions";
import { useAuth } from "../../lib/auth-context";
import { CatalogItem } from "../../lib/types";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { GhostButton, PrimaryButton, TextArea, TextInput } from "../../components/ui/fields";
import { ItemCodeField } from "./ItemCodeField";
import { QuickAddCatalogModal } from "./QuickAddCatalogModal";
import { InquiryItem } from "./inquiry-types";
import { uploadFile, useInquiryMutations } from "./inquiries-api";
import { FileViewer } from "../../components/ui/FileViewer";

interface DraftState {
  itemCode: string;
  partNumber: string;
  builder: string;
  quantity: string;
  measurementUnit: string;
  description: string;
  serialNumber: string;
  equivalentType: string;
  drawingNumber: string;
}

function toDraft(item?: InquiryItem): DraftState {
  return {
    itemCode: item?.itemCode ?? "",
    partNumber: item?.partNumber ?? "",
    builder: item?.builder ?? "",
    quantity: item ? String(Number(item.quantity)) : "",
    measurementUnit: item?.measurementUnit ?? "عدد",
    description: item?.description ?? "",
    serialNumber: item?.serialNumber ?? "",
    equivalentType: item?.equivalentType ?? "",
    drawingNumber: item?.drawingNumber ?? "",
  };
}

function ItemDocuments({ item, canEdit, internalNumber }: { item: InquiryItem; canEdit: boolean; internalNumber: string }) {
  const { addItemDocument, removeItemDocument } = useInquiryMutations();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {item.documents.map((doc) => (
        <span key={doc.id} className="inline-flex items-center gap-1.5 text-[10px] px-2 py-1 rounded-lg bg-bg text-textSecondary">
          {doc.fileName ?? "فایل"}
          <FileViewer fileUrl={doc.fileUrl} fileName={doc.fileName} />
          {canEdit && (
            <button onClick={() => removeItemDocument.mutate(doc.id)} className="text-danger" title="حذف">
              <X size={10} />
            </button>
          )}
        </span>
      ))}
      {canEdit && (
        <>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.webp,.dwg,.xlsx,.docx,.zip,.tif,.tiff"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setUploading(true);
              setError(null);
              try {
                const stored = await uploadFile(file, undefined, internalNumber);
                await addItemDocument.mutateAsync({ itemId: item.id, fileUrl: stored.fileUrl, fileName: stored.fileName });
              } catch {
                setError("خطا در بارگذاری فایل");
              } finally {
                setUploading(false);
                e.target.value = "";
              }
            }}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg border border-dashed border-border text-textSecondary hover:text-primary hover:border-primary"
          >
            <FileUp size={10} />
            {uploading ? "..." : "پیوست"}
          </button>
        </>
      )}
      {error && <span className="text-[10px] text-danger">{error}</span>}
    </div>
  );
}

function ItemFormFields({
  draft,
  onChange,
  canQuickAdd,
}: {
  draft: DraftState;
  onChange: (next: DraftState) => void;
  canQuickAdd: boolean;
}) {
  const [quickAdd, setQuickAdd] = useState(false);
  const set = <K extends keyof DraftState>(key: K, value: DraftState[K]) => onChange({ ...draft, [key]: value });

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 sm:grid-cols-[2fr,1.2fr,90px,110px] gap-2">
        <ItemCodeField
          value={draft.partNumber}
          onTextChange={(text) => onChange({ ...draft, partNumber: text, itemCode: "" })}
          onSelect={(item: CatalogItem) =>
            onChange({
              ...draft,
              itemCode: item.itemCode,
              partNumber: item.partNumber,
              description: item.itemDescription,
              builder: item.builder ?? "",
              measurementUnit: item.defaultMeasurementUnit ?? draft.measurementUnit,
            })
          }
          onAddNew={() => canQuickAdd && setQuickAdd(true)}
        />
        <TextInput placeholder="سازنده اصلی" dir="ltr" value={draft.builder} onChange={(e) => set("builder", e.target.value)} />
        <TextInput placeholder="مقدار *" dir="ltr" inputMode="decimal" value={draft.quantity} onChange={(e) => set("quantity", e.target.value)} />
        <TextInput placeholder="واحد *" value={draft.measurementUnit} onChange={(e) => set("measurementUnit", e.target.value)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[2fr,1fr,1fr,1fr] gap-2">
        <TextArea placeholder="شرح کالا *" rows={1} value={draft.description} onChange={(e) => set("description", e.target.value)} />
        <TextInput placeholder="شماره سریال" dir="ltr" value={draft.serialNumber} onChange={(e) => set("serialNumber", e.target.value)} />
        <TextInput placeholder="تایپ معادل" value={draft.equivalentType} onChange={(e) => set("equivalentType", e.target.value)} />
        <TextInput placeholder="شماره نقشه" dir="ltr" value={draft.drawingNumber} onChange={(e) => set("drawingNumber", e.target.value)} />
      </div>
      {quickAdd && (
        <QuickAddCatalogModal
          initialPartNumber={draft.partNumber}
          onCancel={() => setQuickAdd(false)}
          onCreated={(item) => {
            onChange({
              ...draft,
              itemCode: item.itemCode,
              partNumber: item.partNumber,
              description: item.itemDescription,
              builder: item.builder ?? "",
              measurementUnit: item.defaultMeasurementUnit ?? draft.measurementUnit,
            });
            setQuickAdd(false);
          }}
        />
      )}
    </div>
  );
}

function extractError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? fallback);
}

export function InquiryItemsPanel({ inquiryId, items, internalNumber }: { inquiryId: string; items: InquiryItem[]; internalNumber: string }) {
  const { user } = useAuth();
  const canEdit = hasPermission(user, "inquiry.edit");
  const canQuickAdd = hasPermission(user, "catalog.create");
  const { addItem, updateItem, removeItem } = useInquiryMutations();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<DraftState>(toDraft());
  const [adding, setAdding] = useState(false);
  const [addDraft, setAddDraft] = useState<DraftState>(toDraft());
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const draftValid = (d: DraftState) => d.itemCode && d.description.trim() && Number(d.quantity) > 0 && d.measurementUnit;

  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-3.5">
        <h3 className="text-sm font-bold text-textPrimary tracking-tight">اقلام استعلام ({items.length})</h3>
        {canEdit && !adding && (
          <GhostButton onClick={() => { setAddDraft(toDraft()); setAdding(true); }}>
            <span className="flex items-center gap-1.5"><Plus size={13} /> ردیف جدید</span>
          </GhostButton>
        )}
      </div>

      {error && <p className="text-xs text-danger mb-2.5 bg-danger/10 rounded-lg px-3 py-2">{error}</p>}

      {adding && (
        <div className="rounded-xl border border-primary/40 bg-bg/50 p-3.5 space-y-2 mb-3.5 animate-pop-in">
          <ItemFormFields draft={addDraft} onChange={setAddDraft} canQuickAdd={canQuickAdd} />
          <div className="flex gap-2 justify-end">
            <GhostButton onClick={() => setAdding(false)}>انصراف</GhostButton>
            <PrimaryButton
              disabled={!draftValid(addDraft) || addItem.isPending}
              onClick={async () => {
                try {
                  setError(null);
                  await addItem.mutateAsync({
                    inquiryId,
                    itemCode: addDraft.itemCode,
                    partNumber: addDraft.partNumber || undefined,
                    description: addDraft.description,
                    quantity: Number(addDraft.quantity),
                    measurementUnit: addDraft.measurementUnit,
                    builder: addDraft.builder || undefined,
                    serialNumber: addDraft.serialNumber || undefined,
                    equivalentType: addDraft.equivalentType || undefined,
                    drawingNumber: addDraft.drawingNumber || undefined,
                  });
                  setAdding(false);
                } catch (err) {
                  setError(extractError(err, "خطا در افزودن ردیف"));
                }
              }}
            >
              {addItem.isPending ? "در حال ثبت..." : "افزودن"}
            </PrimaryButton>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {items.map((item) => (
          <div
            key={item.id}
            className="rounded-lg border border-border p-3.5 bg-bg/30 transition-colors duration-150 hover:border-textSecondary/30"
          >
            {editingId === item.id ? (
              <div className="space-y-2">
                <ItemFormFields draft={editDraft} onChange={setEditDraft} canQuickAdd={canQuickAdd} />
                <div className="flex gap-2 justify-end">
                  <GhostButton onClick={() => setEditingId(null)}>انصراف</GhostButton>
                  <PrimaryButton
                    disabled={!draftValid(editDraft) || updateItem.isPending}
                    onClick={async () => {
                      try {
                        setError(null);
                        await updateItem.mutateAsync({
                          itemId: item.id,
                          itemCode: editDraft.itemCode,
                          partNumber: editDraft.partNumber || undefined,
                          description: editDraft.description,
                          quantity: Number(editDraft.quantity),
                          measurementUnit: editDraft.measurementUnit,
                          builder: editDraft.builder || undefined,
                          serialNumber: editDraft.serialNumber || undefined,
                          equivalentType: editDraft.equivalentType || undefined,
                          drawingNumber: editDraft.drawingNumber || undefined,
                        });
                        setEditingId(null);
                      } catch (err) {
                        setError(extractError(err, "خطا در ذخیره تغییرات"));
                      }
                    }}
                  >
                    {updateItem.isPending ? "در حال ذخیره..." : "ذخیره"}
                  </PrimaryButton>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-start gap-2">
                  <span className="text-[11px] font-bold text-textSecondary w-6 pt-0.5">{item.rowIndex}</span>
                  <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-x-3 gap-y-1 text-xs">
                    <span className="font-mono text-primary" dir="ltr">{item.partNumber || item.itemCode}</span>
                    <span className="text-textSecondary" dir="ltr">{item.builder || "—"}</span>
                    <span className="text-textSecondary font-mono" dir="ltr">{Number(item.quantity)} {item.measurementUnit}</span>
                    <span className="text-textSecondary" dir="ltr">{item.serialNumber || "—"}</span>
                    <p className="col-span-2 sm:col-span-4 text-textPrimary whitespace-pre-wrap">{item.description}</p>
                  </div>
                  {canEdit && (
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => { setEditDraft(toDraft(item)); setEditingId(item.id); }}
                        className="text-textSecondary p-1 rounded-lg transition-colors duration-150 hover:text-primary hover:bg-primary/10"
                        aria-label="ویرایش ردیف"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => setDeletingId(item.id)}
                        disabled={items.length === 1}
                        className="text-danger p-1 rounded-lg transition-colors duration-150 hover:bg-danger/10 disabled:opacity-30 disabled:pointer-events-none"
                        aria-label="حذف ردیف"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  )}
                </div>
                <div className="pr-8">
                  <ItemDocuments item={item} canEdit={canEdit} internalNumber={internalNumber} />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {deletingId && (
        <ConfirmModal
          title="حذف این ردیف از پرونده"
          busy={removeItem.isPending}
          onCancel={() => setDeletingId(null)}
          onConfirm={async () => {
            try {
              await removeItem.mutateAsync(deletingId);
              setDeletingId(null);
            } catch (err) {
              setDeletingId(null);
              setError(extractError(err, "خطا در حذف ردیف"));
            }
          }}
        />
      )}
    </div>
  );
}
