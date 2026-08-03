import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package, Plus } from "lucide-react";
import { apiClient } from "../../lib/api-client";
import { CatalogItem, Paged } from "../../lib/types";
import { useDebounced } from "../../lib/use-debounced";
import { useClickOutside } from "../../lib/use-click-outside";

/**
 * فیلد پارت نامبر با autocomplete از کالاها — پارت نامبر مهم‌ترین مشخصهٔ کالاست
 * (درخواست کاربر)؛ کد کالا (itemCode) صرفاً FK داخلیه و پشت صحنه resolve می‌شه.
 * تایپ → پیشنهاد زنده؛ انتخاب → پر شدن خودکار شرح/برند/واحد + itemCode؛
 * نبود پارت نامبر → دکمه «افزودن سریع به کالاها»
 */
export function ItemCodeField({
  value,
  onTextChange,
  onSelect,
  onAddNew,
}: {
  value: string;
  onTextChange: (text: string) => void;
  onSelect: (item: CatalogItem) => void;
  onAddNew: (typedPartNumber: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  useClickOutside(containerRef, () => setOpen(false));

  const debounced = useDebounced(value, 300);
  const { data } = useQuery({
    queryKey: ["item-catalog", "autocomplete", debounced],
    queryFn: async () =>
      (
        await apiClient.get<Paged<CatalogItem> & { builders: string[] }>("/item-catalog", {
          params: { q: debounced, pageSize: 8 },
        })
      ).data,
    enabled: open && debounced.trim().length >= 1,
  });

  const matches = data?.items ?? [];
  const exactMatch = matches.some((m) => m.partNumber.toLowerCase() === value.trim().toLowerCase());

  return (
    <div className="relative" ref={containerRef}>
      <input
        value={value}
        onChange={(e) => {
          onTextChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="پارت نامبر — مثلاً BRG-6205-2RS"
        dir="ltr"
        className="w-full rounded-lg px-3 py-2.5 text-sm font-mono border border-border bg-surface text-textPrimary focus:outline-none focus:border-primary"
      />
      {open && value.trim().length >= 1 && (
        <div className="absolute z-30 mt-1 w-full min-w-64 rounded-lg border border-border bg-surface shadow-lg py-1 max-h-64 overflow-y-auto">
          {matches.map((item) => (
            <button
              key={item.itemCode}
              type="button"
              onClick={() => {
                onSelect(item);
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-right hover:bg-bg"
            >
              <Package size={13} className="text-accent shrink-0" />
              <span className="text-xs font-mono text-textPrimary" dir="ltr">{item.partNumber}</span>
              <span className="text-[11px] text-textSecondary truncate flex-1">{item.itemDescription}</span>
            </button>
          ))}
          {!exactMatch && (
            <button
              type="button"
              onClick={() => {
                onAddNew(value.trim());
                setOpen(false);
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-right text-primary hover:bg-bg border-t border-border"
            >
              <Plus size={13} />
              <span className="text-xs font-medium">
                «{value.trim()}» در کالاها نیست — افزودن سریع
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
