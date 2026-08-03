import { useEffect, useRef, useState } from "react";

/**
 * فاز ۳۲-ب: مدیریت لیست‌های «افزودن/ویرایش/حذف ردیف» با ذخیره‌سازی صریح (نه Auto-save).
 * ردیف‌های جدید با id موقت (temp-*) در state محلی می‌مونن تا کلیک روی «ثبت»؛
 * ویرایش ردیف‌های موجود هم فقط در state محلی بافر می‌شه؛ حذف هم تا ثبت نهایی صرفاً پنهانه.
 */
export interface StagedRow<T> {
  id: string;
  isNew: boolean;
  markedForDelete: boolean;
  data: T;
}

let tempCounter = 0;
function nextTempId() {
  tempCounter += 1;
  return `temp-${tempCounter}`;
}

export function useStagedList<T extends object>(serverRows: (T & { id: string })[]) {
  const [rows, setRows] = useState<StagedRow<T>[]>(() =>
    serverRows.map((r) => ({ id: r.id, isNew: false, markedForDelete: false, data: r })),
  );
  const dirtyRef = useRef(false);

  // فقط وقتی چیزی محلی تغییر نکرده، با داده‌ی تازه‌ی سرور همگام می‌شیم (تا ادیت در حال انجام کاربر پاک نشه)
  useEffect(() => {
    if (dirtyRef.current) return;
    setRows(serverRows.map((r) => ({ id: r.id, isNew: false, markedForDelete: false, data: r })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [serverRows]);

  function addRow(initial: T) {
    dirtyRef.current = true;
    setRows((prev) => [...prev, { id: nextTempId(), isNew: true, markedForDelete: false, data: initial }]);
  }

  function updateRow(id: string, patch: Partial<T>) {
    dirtyRef.current = true;
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, data: { ...r.data, ...patch } } : r)));
  }

  function removeRow(id: string) {
    dirtyRef.current = true;
    setRows((prev) =>
      prev
        .filter((r) => !(r.id === id && r.isNew))
        .map((r) => (r.id === id ? { ...r, markedForDelete: true } : r)),
    );
  }

  function reset() {
    dirtyRef.current = false;
    setRows(serverRows.map((r) => ({ id: r.id, isNew: false, markedForDelete: false, data: r })));
  }

  const visibleRows = rows.filter((r) => !r.markedForDelete);
  const isDirty =
    rows.some((r) => r.isNew || r.markedForDelete) ||
    rows.some((r) => {
      if (r.isNew || r.markedForDelete) return false;
      const server = serverRows.find((s) => s.id === r.id);
      return server ? JSON.stringify(server) !== JSON.stringify(r.data) : false;
    });

  async function commit(handlers: {
    onCreate: (data: T) => Promise<unknown>;
    onUpdate: (id: string, data: T) => Promise<unknown>;
    onDelete: (id: string) => Promise<unknown>;
  }) {
    for (const r of rows) {
      if (r.markedForDelete) {
        if (!r.isNew) await handlers.onDelete(r.id);
      } else if (r.isNew) {
        await handlers.onCreate(r.data);
      } else {
        const server = serverRows.find((s) => s.id === r.id);
        if (!server || JSON.stringify(server) !== JSON.stringify(r.data)) {
          await handlers.onUpdate(r.id, r.data);
        }
      }
    }
    dirtyRef.current = false;
  }

  return { rows: visibleRows, addRow, updateRow, removeRow, reset, commit, isDirty };
}
