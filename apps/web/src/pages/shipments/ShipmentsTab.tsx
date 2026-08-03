import { useState } from "react";
import { Ship } from "lucide-react";
import { useShipments } from "./shipment-api";
import { ShipmentDetail } from "./ShipmentDetail";
import { SHIPMENT_STAGES } from "./shipping-types";

export function ShipmentsTab({ canEdit }: { canEdit: boolean }) {
  const { data: shipments, isLoading } = useShipments();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!canEdit) {
    return <p className="text-xs text-textSecondary py-8 text-center">دسترسی به این بخش ندارید.</p>;
  }

  if (selectedId) {
    return <ShipmentDetail shipmentId={selectedId} onBack={() => setSelectedId(null)} canEdit={canEdit} />;
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-semibold text-textPrimary">محموله‌ها ({shipments?.length ?? 0})</p>

      {isLoading && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}
      {!isLoading && (shipments ?? []).length === 0 && (
        <p className="text-xs text-textSecondary py-6 text-center rounded-lg border border-dashed border-border">
          هنوز محموله‌ای ساخته نشده — از تب «استعلام حمل» یک شرکت حمل رو به‌عنوان برنده انتخاب کن.
        </p>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {(shipments ?? []).map((s) => {
          const stageMeta = SHIPMENT_STAGES.find((st) => st.key === s.stage);
          return (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className="text-right rounded-lg border border-border bg-surface p-4 hover:border-primary transition-colors"
            >
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-7 h-7 rounded-lg bg-accentSoft text-accent flex items-center justify-center shrink-0">
                  <Ship size={14} />
                </div>
                <p className="text-sm font-semibold text-textPrimary font-mono" dir="ltr">{s.shipmentNumber}</p>
              </div>
              <p className="text-xs text-textSecondary mb-2">
                {s.freightCompany?.companyName ?? "—"} · مقصد: {s.destinationCustoms ?? "—"} · {s.packageCount} بسته
              </p>
              <span className="text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                {stageMeta?.label ?? s.stage}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
