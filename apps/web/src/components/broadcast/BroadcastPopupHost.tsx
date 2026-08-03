import { useEffect, useState } from "react";
import { usePendingBroadcasts, useDismissBroadcast } from "../../pages/broadcast-messages/broadcast-messages-api";
import { BroadcastPopup } from "./BroadcastPopup";

export function BroadcastPopupHost() {
  const { data: pending } = usePendingBroadcasts();
  const dismiss = useDismissBroadcast();
  const [queue, setQueue] = useState<string[]>([]);

  // صف رو فقط وقتی داده تازه از سرور اومد به‌روزرسانی می‌کنیم — بستن یک پیام صف محلی رو
  // فوراً کوتاه می‌کنه (بدون منتظر رفرش سرور)، پیام‌های تازه از پاسخ‌های بعدی اضافه می‌شن
  useEffect(() => {
    if (!pending) return;
    setQueue((current) => {
      const currentSet = new Set(current);
      const incomingIds = pending.map((b) => b.id);
      const merged = [...current.filter((id) => incomingIds.includes(id))];
      for (const id of incomingIds) {
        if (!currentSet.has(id)) merged.push(id);
      }
      return merged;
    });
  }, [pending]);

  const activeId = queue[0];
  const active = pending?.find((b) => b.id === activeId);

  if (!active) return null;

  return (
    <BroadcastPopup
      broadcast={active}
      closing={dismiss.isPending}
      onClose={async () => {
        try {
          await dismiss.mutateAsync(active.id);
        } finally {
          setQueue((current) => current.filter((id) => id !== active.id));
        }
      }}
    />
  );
}
