import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "../../lib/api-client";
import { CatalogItem } from "../../lib/types";
import { Field, GhostButton, PrimaryButton, TextArea, TextInput } from "../../components/ui/fields";

/** افزودن سریع کالا بدون ترک فرم استعلام (نیازمند catalog.create) — کد کالا خودکار تولید می‌شه */
export function QuickAddCatalogModal({
  initialPartNumber,
  onCancel,
  onCreated,
}: {
  initialPartNumber: string;
  onCancel: () => void;
  onCreated: (item: CatalogItem) => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    partNumber: initialPartNumber,
    itemDescription: "",
    builder: "",
    defaultMeasurementUnit: "عدد",
  });
  const [error, setError] = useState<string | null>(null);

  const create = useMutation({
    mutationFn: async () =>
      (
        await apiClient.post<CatalogItem>("/item-catalog", {
          partNumber: form.partNumber.trim(),
          itemDescription: form.itemDescription.trim(),
          builder: form.builder.trim() || undefined,
          defaultMeasurementUnit: form.defaultMeasurementUnit.trim() || undefined,
        })
      ).data,
    onSuccess: (item) => {
      queryClient.invalidateQueries({ queryKey: ["item-catalog"] });
      onCreated(item);
    },
    onError: (err: unknown) => {
      const message = (err as { response?: { data?: { message?: string } } }).response?.data?.message;
      setError(message ?? "خطا در ثبت کالا");
    },
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px] animate-fade-in">
      <div className="rounded-2xl w-full max-w-md p-5 bg-surface shadow-modal space-y-3 animate-pop-in">
        <h3 className="text-sm font-bold text-textPrimary">افزودن سریع کالا</h3>
        <p className="text-[11px] text-textSecondary">
          قبل از استفاده در استعلام، کالا باید ثبت شده باشه. کد کالا خودکار تولید می‌شه.
        </p>
        <Field label="پارت نامبر *">
          <TextInput
            value={form.partNumber}
            onChange={(e) => setForm({ ...form, partNumber: e.target.value })}
            dir="ltr"
            className="font-mono"
          />
        </Field>
        <Field label="شرح کالا *">
          <TextArea
            value={form.itemDescription}
            onChange={(e) => setForm({ ...form, itemDescription: e.target.value })}
            rows={2}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="سازنده اصلی (برند)">
            <TextInput
              value={form.builder}
              onChange={(e) => setForm({ ...form, builder: e.target.value })}
              dir="ltr"
            />
          </Field>
          <Field label="واحد پیش‌فرض">
            <TextInput
              value={form.defaultMeasurementUnit}
              onChange={(e) => setForm({ ...form, defaultMeasurementUnit: e.target.value })}
            />
          </Field>
        </div>
        {error && <p className="text-xs text-danger">{error}</p>}
        <div className="flex gap-2 justify-end">
          <GhostButton onClick={onCancel}>انصراف</GhostButton>
          <PrimaryButton
            disabled={!form.partNumber.trim() || !form.itemDescription.trim() || create.isPending}
            onClick={() => {
              setError(null);
              create.mutate();
            }}
          >
            {create.isPending ? "در حال ثبت..." : "ثبت کالا"}
          </PrimaryButton>
        </div>
      </div>
    </div>
  );
}
