import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  ChevronDown,
  Download,
  FileUp,
  History,
  Loader2,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { apiClient } from "../../lib/api-client";
import { useAuth } from "../../lib/auth-context";
import { hasPermission } from "../../lib/permissions";
import { useDebounced } from "../../lib/use-debounced";
import { CatalogItem, Paged, SimilarItem } from "../../lib/types";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { ViewField } from "../../components/ui/ViewField";
import { FileViewer } from "../../components/ui/FileViewer";
import { Field, GhostButton, PrimaryButton, Select, TextArea, TextInput } from "../../components/ui/fields";
import { uploadFile } from "../inquiries/inquiries-api";

const KEY = ["item-catalog"];

interface CatalogResponse extends Paged<CatalogItem> {
  builders: string[];
}

interface MeasurementUnit {
  id: string;
  unitName: string;
}

interface CatalogDocument {
  id: string;
  fileUrl: string;
  fileName: string | null;
  uploadedAt: string;
  uploader: { id: string; fullName: string } | null;
}

interface CatalogItemDetail extends CatalogItem {
  documents: CatalogDocument[];
}

interface ImportRowError {
  row: number;
  itemCode?: string;
  message: string;
}

interface ImportReport {
  totalRows: number;
  createdCount: number;
  failedCount: number;
  errors: ImportRowError[];
}

/** دانلود یک پاسخ باینری (اکسل) با احراز هویت — مثل الگوی downloadFile موجود، ولی برای Endpoint هایی که فایل رو زنده تولید می‌کنن نه از استوریج */
async function downloadBinary(url: string, filename: string) {
  const { data } = await apiClient.get(url, { responseType: "blob" });
  const objectUrl = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(objectUrl);
}

function useCatalog(q: string, builders: string[]) {
  return useQuery({
    queryKey: [...KEY, { q, builders }],
    queryFn: async () => {
      const { data } = await apiClient.get<CatalogResponse>("/item-catalog", {
        params: {
          q: q || undefined,
          builders: builders.length ? builders.join(",") : undefined,
          pageSize: 100,
        },
      });
      return data;
    },
  });
}

/** جزئیات کامل یک کالا شامل پیوست‌ها — برخلاف useCatalog (لیست)، پیوست‌ها فقط اینجا برمی‌گرده */
function useCatalogDetail(itemCode: string | null) {
  return useQuery({
    queryKey: [...KEY, "detail", itemCode],
    queryFn: async () =>
      (await apiClient.get<CatalogItemDetail>(`/item-catalog/${encodeURIComponent(itemCode!)}`)).data,
    enabled: !!itemCode,
  });
}

function useSimilarItems(code: string, description: string) {
  const term = { code: useDebounced(code), description: useDebounced(description) };
  return useQuery({
    queryKey: [...KEY, "similar", term],
    queryFn: async () => {
      const { data } = await apiClient.get<SimilarItem[]>("/item-catalog/similar", {
        params: { code: term.code || undefined, description: term.description || undefined },
      });
      return data;
    },
    enabled: term.code.trim().length >= 2 || term.description.trim().length >= 2,
  });
}

function useMeasurementUnits() {
  return useQuery({
    queryKey: ["measurement-units"],
    queryFn: async () => (await apiClient.get<MeasurementUnit[]>("/item-catalog/measurement-units")).data,
    staleTime: 5 * 60 * 1000,
  });
}

function useAddMeasurementUnit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (unitName: string) =>
      (await apiClient.post<MeasurementUnit>("/item-catalog/measurement-units", { unitName })).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["measurement-units"] }),
  });
}

function useCatalogMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: KEY });

  const create = useMutation({
    mutationFn: async (body: Partial<CatalogItem>) =>
      (await apiClient.post<CatalogItem>("/item-catalog", body)).data,
    onSuccess: invalidate,
  });
  const update = useMutation({
    mutationFn: async ({ itemCode, ...body }: Partial<CatalogItem> & { itemCode: string }) =>
      (await apiClient.patch<CatalogItem>(`/item-catalog/${encodeURIComponent(itemCode)}`, body)).data,
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: async (itemCode: string) => {
      await apiClient.delete(`/item-catalog/${encodeURIComponent(itemCode)}`);
    },
    onSuccess: invalidate,
  });
  const addDocument = useMutation({
    mutationFn: async ({
      itemCode,
      fileUrl,
      fileName,
    }: {
      itemCode: string;
      fileUrl: string;
      fileName?: string;
    }) =>
      (await apiClient.post(`/item-catalog/${encodeURIComponent(itemCode)}/documents`, { fileUrl, fileName }))
        .data,
    onSuccess: invalidate,
  });
  const removeDocument = useMutation({
    mutationFn: async (documentId: string) => {
      await apiClient.delete(`/item-catalog-documents/${documentId}`);
    },
    onSuccess: invalidate,
  });
  const importExcel = useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      const { data } = await apiClient.post<ImportReport>("/item-catalog/import", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return data;
    },
    onSuccess: invalidate,
  });

  return { create, update, remove, addDocument, removeDocument, importExcel };
}

function SimilarityWarning({ code, description, excludeCode }: { code: string; description: string; excludeCode?: string }) {
  const { data } = useSimilarItems(code, description);
  const matches = (data ?? []).filter((match) => match.itemCode !== excludeCode);
  if (matches.length === 0) return null;

  return (
    <div className="rounded-lg p-3 bg-warningSoft text-warning text-xs flex gap-2">
      <AlertTriangle size={15} className="shrink-0 mt-0.5" />
      <div>
        <p className="font-medium mb-1">
          ممکنه این کالا قبلاً با پارت نامبر مشابهی ثبت شده باشه. لطفاً لیست پایین رو چک کن که تکراری نسازی:
        </p>
        <ul className="space-y-0.5">
          {matches.map((match) => (
            <li key={match.itemCode}>
              • <span className="font-mono" dir="ltr">{match.partNumber}</span> — {match.itemDescription}
              {match.builder ? ` (${match.builder})` : ""} — شباهت {Math.round(match.similarity * 100)}٪
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function BrandMultiSelect({
  builders,
  selected,
  onChange,
}: {
  builders: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  function toggle(builder: string) {
    onChange(
      selected.includes(builder)
        ? selected.filter((b) => b !== builder)
        : [...selected, builder],
    );
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-xs px-3 py-2.5 rounded-lg border border-border bg-surface text-textSecondary"
      >
        برند {selected.length > 0 && <span className="text-primary font-medium">({selected.length})</span>}
        <ChevronDown size={13} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-48 max-h-56 overflow-y-auto rounded-lg border border-border bg-surface shadow-lg py-1">
          {builders.length === 0 && (
            <p className="text-[11px] text-textSecondary px-3 py-2">برندی ثبت نشده</p>
          )}
          {builders.map((builder) => (
            <button
              key={builder}
              onClick={() => toggle(builder)}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-textPrimary hover:bg-bg"
            >
              <span
                className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${
                  selected.includes(builder) ? "bg-primary border-primary text-white" : "border-border"
                }`}
              >
                {selected.includes(builder) && <Check size={10} />}
              </span>
              {builder}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// افزودن واحد جدید به لیست از پیش تعریف‌شده — فقط با catalog.manage_units
function AddUnitModal({ onClose, onAdded }: { onClose: () => void; onAdded: (unitName: string) => void }) {
  const addUnit = useAddMeasurementUnit();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px] animate-fade-in">
      <div className="rounded-2xl w-full max-w-sm p-5 bg-surface shadow-modal space-y-3 animate-pop-in">
        <h3 className="text-sm font-bold text-textPrimary">افزودن واحد اندازه‌گیری جدید</h3>
        <Field label="نام واحد">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً بشکه" />
        </Field>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex gap-2 justify-end">
          <GhostButton onClick={onClose}>انصراف</GhostButton>
          <PrimaryButton
            disabled={!name.trim() || addUnit.isPending}
            onClick={async () => {
              try {
                setError(null);
                const unit = await addUnit.mutateAsync(name.trim());
                onAdded(unit.unitName);
              } catch (err: unknown) {
                const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
                setError(message ?? "خطا در افزودن واحد");
              }
            }}
          >
            {addUnit.isPending ? "در حال ثبت..." : "افزودن"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}

function UnitSelect({
  value,
  onChange,
  canManageUnits,
}: {
  value: string;
  onChange: (unit: string) => void;
  canManageUnits: boolean;
}) {
  const { data: units } = useMeasurementUnits();
  const [showAddModal, setShowAddModal] = useState(false);

  return (
    <>
      <Select
        value={value}
        onChange={(e) => {
          if (e.target.value === "__add__") {
            setShowAddModal(true);
            return;
          }
          onChange(e.target.value);
        }}
      >
        <option value="">— انتخاب واحد —</option>
        {(units ?? []).map((unit) => (
          <option key={unit.id} value={unit.unitName}>{unit.unitName}</option>
        ))}
        {canManageUnits && <option value="__add__">+ افزودن واحد جدید...</option>}
      </Select>
      {showAddModal && (
        <AddUnitModal
          onClose={() => setShowAddModal(false)}
          onAdded={(unitName) => {
            onChange(unitName);
            setShowAddModal(false);
          }}
        />
      )}
    </>
  );
}

interface ItemFormState {
  itemCode: string;
  autoCode: boolean;
  partNumber: string;
  itemDescription: string;
  builder: string;
  defaultMeasurementUnit: string;
}

function ItemFormFields({
  form,
  onChange,
  isNew,
  canManageUnits,
}: {
  form: ItemFormState;
  onChange: (next: ItemFormState) => void;
  isNew?: boolean;
  canManageUnits: boolean;
}) {
  const set = <K extends keyof ItemFormState>(key: K, value: ItemFormState[K]) =>
    onChange({ ...form, [key]: value });

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="پارت نامبر * (مهم‌ترین مشخصه کالا)">
          <TextInput
            value={form.partNumber}
            onChange={(e) => set("partNumber", e.target.value)}
            dir="ltr"
            className="font-mono"
            placeholder="مثلاً BRG-6205-2RS"
          />
        </Field>
        <Field label="سازنده اصلی (برند)">
          <TextInput value={form.builder} onChange={(e) => set("builder", e.target.value)} dir="ltr" />
        </Field>
      </div>

      {isNew && (
        <div>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer text-textPrimary mb-1.5">
            <input
              type="checkbox"
              className="w-3.5 h-3.5"
              checked={!form.autoCode}
              onChange={(e) => set("autoCode", !e.target.checked)}
            />
            کد کالا رو دستی وارد می‌کنم (در غیر این صورت سیستم خودکار تولید می‌کنه: ITM-NNNNNN)
          </label>
          {!form.autoCode && (
            <TextInput
              value={form.itemCode}
              onChange={(e) => set("itemCode", e.target.value)}
              dir="ltr"
              className="font-mono"
              placeholder="کد یکتای دلخواه"
            />
          )}
        </div>
      )}

      <Field label="شرح کالا * (می‌تونه چند سطر باشه)">
        <TextArea value={form.itemDescription} onChange={(e) => set("itemDescription", e.target.value)} rows={3} />
      </Field>

      <Field label="واحد اندازه‌گیری پیش‌فرض">
        <UnitSelect
          value={form.defaultMeasurementUnit}
          onChange={(unit) => set("defaultMeasurementUnit", unit)}
          canManageUnits={canManageUnits}
        />
      </Field>
    </div>
  );
}

// پیوست فایل در سطح کالا (فاز ۲۵) — مشاهده برای هر کسی که catalog.view داره، افزودن/حذف پشت catalog.create
function CatalogAttachments({ itemCode, canEdit }: { itemCode: string; canEdit: boolean }) {
  const { data } = useCatalogDetail(itemCode);
  const { addDocument, removeDocument } = useCatalogMutations();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const documents = data?.documents ?? [];

  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-5">
      <h3 className="text-sm font-bold text-textPrimary mb-3">پیوست‌ها</h3>
      <div className="flex flex-wrap items-center gap-2">
        {documents.length === 0 && !canEdit && (
          <p className="text-xs text-textSecondary">پیوستی برای این کالا ثبت نشده.</p>
        )}
        {documents.map((doc) => (
          <span
            key={doc.id}
            className="inline-flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg bg-bg text-textSecondary"
          >
            {doc.fileName ?? "فایل"}
            <FileViewer fileUrl={doc.fileUrl} fileName={doc.fileName} />
            {canEdit && (
              <button onClick={() => removeDocument.mutate(doc.id)} className="text-danger" title="حذف">
                <X size={11} />
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
                  const stored = await uploadFile(file);
                  await addDocument.mutateAsync({ itemCode, fileUrl: stored.fileUrl, fileName: stored.fileName });
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
              className="inline-flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg border border-dashed border-border text-textSecondary hover:text-primary hover:border-primary"
            >
              <FileUp size={12} />
              {uploading ? "در حال بارگذاری..." : "افزودن پیوست"}
            </button>
          </>
        )}
      </div>
      {error && <p className="text-[11px] text-danger mt-2">{error}</p>}
    </div>
  );
}

function ItemDetail({ item, onBack }: { item: CatalogItem; onBack: () => void }) {
  const { user } = useAuth();
  const canEdit = hasPermission(user, "catalog.create");
  const canManageUnits = hasPermission(user, "catalog.manage_units");
  const { update, remove } = useCatalogMutations();
  const [editMode, setEditMode] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [form, setForm] = useState<ItemFormState>({
    itemCode: item.itemCode,
    autoCode: false,
    partNumber: item.partNumber,
    itemDescription: item.itemDescription,
    builder: item.builder ?? "",
    defaultMeasurementUnit: item.defaultMeasurementUnit ?? "",
  });

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-primary font-medium">
        <ArrowRight size={14} />
        بازگشت به کالاها
      </button>

      <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-accentSoft text-accent flex items-center justify-center">
            <Package size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-bold text-textPrimary font-mono" dir="ltr">{item.partNumber}</h2>
            <p className="text-xs text-textSecondary truncate">{item.itemDescription}</p>
            <p className="text-[10px] text-textSecondary font-mono" dir="ltr">کد کالا: {item.itemCode}</p>
          </div>
          {!editMode && canEdit && (
            <div className="flex gap-2">
              <GhostButton onClick={() => setEditMode(true)}>
                <span className="flex items-center gap-1.5"><Pencil size={13} /> ویرایش</span>
              </GhostButton>
              <button onClick={() => setConfirmDelete(true)} className="text-xs px-3 py-2 rounded-lg text-danger border border-danger/40">
                <span className="flex items-center gap-1.5"><Trash2 size={13} /> حذف</span>
              </button>
            </div>
          )}
        </div>

        {editMode ? (
          <div className="space-y-3">
            <ItemFormFields form={form} onChange={setForm} canManageUnits={canManageUnits} />
            {form.partNumber !== item.partNumber && (
              <SimilarityWarning code={form.partNumber} description={form.itemDescription} excludeCode={item.itemCode} />
            )}
            <div className="flex gap-2 justify-end">
              <GhostButton onClick={() => setEditMode(false)}>انصراف</GhostButton>
              <PrimaryButton
                disabled={update.isPending || !form.itemDescription.trim() || !form.partNumber.trim()}
                onClick={async () => {
                  await update.mutateAsync({
                    itemCode: item.itemCode,
                    partNumber: form.partNumber.trim(),
                    itemDescription: form.itemDescription,
                    builder: form.builder || undefined,
                    defaultMeasurementUnit: form.defaultMeasurementUnit || undefined,
                  } as never);
                  setEditMode(false);
                  onBack();
                }}
              >
                {update.isPending ? "در حال ذخیره..." : "ذخیره تغییرات"}
              </PrimaryButton>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <ViewField title="سازنده اصلی" value={item.builder} />
            <ViewField title="واحد اندازه‌گیری" value={item.defaultMeasurementUnit} />
            <ViewField title="وضعیت" value={item.status === "active" ? "فعال" : "غیرفعال"} />
          </div>
        )}
      </div>

      <CatalogAttachments itemCode={item.itemCode} canEdit={canEdit} />

      {/* سابقه استفاده — داده‌اش از inquiry_items میاد که فاز ۳ است */}
      <div className="rounded-xl bg-surface border border-border shadow-card p-5">
        <h3 className="text-sm font-bold text-textPrimary mb-3">سابقه استفاده در استعلام‌ها</h3>
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <div className="w-10 h-10 rounded-full bg-bg text-textSecondary flex items-center justify-center mx-auto mb-2">
            <History size={18} />
          </div>
          <p className="text-xs text-textSecondary">
            این کالا هنوز در استعلامی استفاده نشده. سابقه استفاده (استعلام/مشتری/تعداد/نتیجه) اینجا نمایش داده می‌شه.
          </p>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmModal
          title={`حذف کالای «${item.partNumber}»`}
          busy={remove.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            await remove.mutateAsync(item.itemCode);
            setConfirmDelete(false);
            onBack();
          }}
        />
      )}
    </div>
  );
}

// درون‌ریزی اکسل (فاز ۲۵) — فقط ایجاد، ثبت جزئی + گزارش خطای ردیف‌به‌ردیف
function ImportModal({ onClose }: { onClose: () => void }) {
  const { importExcel } = useCatalogMutations();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showErrors, setShowErrors] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px] animate-fade-in">
      <div className="rounded-2xl w-full max-w-md p-5 bg-surface shadow-modal space-y-3 animate-pop-in">
        <h3 className="text-sm font-bold text-textPrimary">درون‌ریزی اکسل کالاها</h3>
        <button
          type="button"
          onClick={() => downloadBinary("/item-catalog/import-template", "catalog-import-template.xlsx")}
          className="text-xs text-primary underline"
        >
          دانلود قالب نمونه
        </button>

        {!report ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-xs text-textSecondary"
            />
            <p className="text-[11px] text-textSecondary">
              فقط ردیف‌های جدید ثبت می‌شن؛ کد کالای تکراری یا ردیف ناقص با گزارش خطا رد می‌شه.
            </p>
            {error && <p className="text-xs text-danger">{error}</p>}
            <div className="flex gap-2 justify-end">
              <GhostButton onClick={onClose}>انصراف</GhostButton>
              <PrimaryButton
                disabled={!file || importExcel.isPending}
                onClick={async () => {
                  if (!file) return;
                  try {
                    setError(null);
                    const result = await importExcel.mutateAsync(file);
                    setReport(result);
                  } catch (err: unknown) {
                    const message =
                      (err as { response?: { data?: { message?: string } } }).response?.data?.message;
                    setError(message ?? "خطا در پردازش فایل");
                  }
                }}
              >
                {importExcel.isPending ? (
                  <span className="flex items-center gap-1.5"><Loader2 size={13} className="animate-spin" /> در حال پردازش...</span>
                ) : (
                  "درون‌ریزی"
                )}
              </PrimaryButton>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-textPrimary">
              از {report.totalRows} ردیف، <span className="text-success font-medium">{report.createdCount} ثبت شد</span>
              {report.failedCount > 0 && (
                <>
                  {" "}و <span className="text-danger font-medium">{report.failedCount} رد شد</span>
                </>
              )}
              .
            </p>
            {report.errors.length > 0 && (
              <div>
                <button type="button" onClick={() => setShowErrors((s) => !s)} className="text-xs text-primary">
                  {showErrors ? "پنهان کردن جزئیات خطاها" : "نمایش جزئیات خطاها"}
                </button>
                {showErrors && (
                  <ul className="mt-2 space-y-1 max-h-48 overflow-y-auto text-[11px] text-textSecondary">
                    {report.errors.map((rowError, i) => (
                      <li key={i}>
                        ردیف {rowError.row}
                        {rowError.itemCode ? ` (${rowError.itemCode})` : ""}: {rowError.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="flex justify-end">
              <PrimaryButton onClick={onClose}>باشه</PrimaryButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NewItemForm({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const canManageUnits = hasPermission(user, "catalog.manage_units");
  const { create } = useCatalogMutations();
  const [form, setForm] = useState<ItemFormState>({
    itemCode: "",
    autoCode: true,
    partNumber: "",
    itemDescription: "",
    builder: "",
    defaultMeasurementUnit: "",
  });
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-3">
      <h3 className="text-sm font-bold text-textPrimary">افزودن کالای جدید</h3>
      <ItemFormFields form={form} onChange={setForm} isNew canManageUnits={canManageUnits} />
      <SimilarityWarning code={form.partNumber} description={form.itemDescription} />
      {error && <p className="text-xs text-danger">{error}</p>}
      <div className="flex gap-2 justify-end">
        <GhostButton onClick={onDone}>انصراف</GhostButton>
        <PrimaryButton
          disabled={!form.partNumber.trim() || !form.itemDescription.trim() || create.isPending}
          onClick={async () => {
            try {
              setError(null);
              await create.mutateAsync({
                itemCode: form.autoCode ? undefined : form.itemCode.trim() || undefined,
                partNumber: form.partNumber.trim(),
                itemDescription: form.itemDescription.trim(),
                builder: form.builder || undefined,
                defaultMeasurementUnit: form.defaultMeasurementUnit || undefined,
              } as never);
              onDone();
            } catch (err: unknown) {
              const message =
                (err as { response?: { data?: { message?: string } } }).response?.data?.message;
              setError(message ?? "خطا در ثبت کالا");
            }
          }}
        >
          {create.isPending ? "در حال ثبت..." : "ثبت کالا"}
        </PrimaryButton>
      </div>
    </div>
  );
}

export function CatalogPage() {
  const { user } = useAuth();
  const canCreate = hasPermission(user, "catalog.create");
  const canImport = hasPermission(user, "catalog.import");

  const [query, setQuery] = useState("");
  const [selectedBuilders, setSelectedBuilders] = useState<string[]>([]);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [exporting, setExporting] = useState(false);

  const debouncedQuery = useDebounced(query);
  const { data, isLoading, isError } = useCatalog(debouncedQuery, selectedBuilders);

  const items = useMemo(() => data?.items ?? [], [data]);
  const selected = useMemo(
    () => items.find((item) => item.itemCode === selectedCode) ?? null,
    [items, selectedCode],
  );

  if (selected) {
    return <ItemDetail item={selected} onBack={() => setSelectedCode(null)} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-textSecondary">
          {data ? `${data.total} کالا` : ""}
        </p>
        <div className="flex items-center gap-2">
          <GhostButton
            disabled={exporting}
            onClick={async () => {
              setExporting(true);
              try {
                await downloadBinary(
                  `/item-catalog/export?${new URLSearchParams({
                    ...(debouncedQuery ? { q: debouncedQuery } : {}),
                    ...(selectedBuilders.length ? { builders: selectedBuilders.join(",") } : {}),
                  }).toString()}`,
                  "catalog.xlsx",
                );
              } finally {
                setExporting(false);
              }
            }}
          >
            <span className="flex items-center gap-1.5">
              <Download size={13} /> {exporting ? "در حال آماده‌سازی..." : "خروجی اکسل"}
            </span>
          </GhostButton>
          {canImport && (
            <GhostButton onClick={() => setShowImportModal(true)}>
              <span className="flex items-center gap-1.5"><Upload size={13} /> درون‌ریزی اکسل</span>
            </GhostButton>
          )}
          {canCreate && !showNewForm && (
            <PrimaryButton onClick={() => setShowNewForm(true)}>
              <span className="flex items-center gap-1.5"><Plus size={14} /> کالای جدید</span>
            </PrimaryButton>
          )}
        </div>
      </div>

      {showNewForm && <NewItemForm onDone={() => setShowNewForm(false)} />}
      {showImportModal && <ImportModal onClose={() => setShowImportModal(false)} />}

      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-52">
          <Search size={15} className="absolute top-3 right-3 text-textSecondary" />
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="جستجوی پارت نامبر، کد یا شرح کالا..."
            className="pr-9"
          />
        </div>
        <BrandMultiSelect
          builders={data?.builders ?? []}
          selected={selectedBuilders}
          onChange={setSelectedBuilders}
        />
      </div>

      {isLoading && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}
      {isError && (
        <p className="text-xs text-danger py-8 text-center">
          خطا در دریافت اطلاعات — اتصال به سرور رو بررسی کنید.
        </p>
      )}

      {!isLoading && !isError && (
        <div className="rounded-xl bg-surface border border-border shadow-card divide-y divide-border">
          {items.length === 0 && (
            <p className="text-xs text-textSecondary p-8 text-center">کالایی یافت نشد.</p>
          )}
          {items.map((item) => (
            <button
              key={item.itemCode}
              onClick={() => setSelectedCode(item.itemCode)}
              className="w-full flex items-center gap-3 p-4 text-right hover:bg-bg transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-accentSoft text-accent flex items-center justify-center shrink-0">
                <Package size={17} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-textPrimary font-mono" dir="ltr">
                  {item.partNumber}
                </p>
                <p className="text-[11px] text-textSecondary truncate">{item.itemDescription}</p>
              </div>
              <span className="text-[10px] text-textSecondary font-mono shrink-0" dir="ltr">{item.itemCode}</span>
              {item.builder && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-bg text-textSecondary shrink-0">
                  {item.builder}
                </span>
              )}
              {item.status === "inactive" && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-border text-textSecondary shrink-0">
                  غیرفعال
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
