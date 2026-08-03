import { useState } from "react";
import { X } from "lucide-react";
import { Avatar } from "./chat-shared";

// فاز ۳۰ — از ChatPage استخراج شد تا ChatWidget (حالت غیرتمام‌صفحه) هم بتونه
// «مکالمهٔ جدید» بسازه، بدون تکرار این دو مودال
export function NewGroupModal({
  colleagues,
  onCancel,
  onCreate,
}: {
  colleagues: { id: string; fullName: string }[];
  onCancel: () => void;
  onCreate: (name: string, memberIds: string[]) => void;
}) {
  const [name, setName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px] animate-fade-in">
      <div className="rounded-2xl w-full max-w-sm p-5 bg-surface shadow-modal animate-pop-in">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-textPrimary">ساخت گروه جدید</p>
          <button onClick={onCancel} aria-label="بستن">
            <X size={16} className="text-textSecondary" />
          </button>
        </div>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="نام گروه"
          className="text-sm w-full rounded-lg px-3 py-2 mb-3 border border-border"
        />
        <p className="text-[11px] font-medium mb-2 text-textSecondary">اعضا</p>
        <div className="space-y-1 mb-4 max-h-48 overflow-y-auto">
          {colleagues.map((c) => (
            <label
              key={c.id}
              className={`flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs cursor-pointer ${
                selected.includes(c.id) ? "bg-accentSoft" : "bg-bg"
              }`}
            >
              <input
                type="checkbox"
                checked={selected.includes(c.id)}
                onChange={() => toggle(c.id)}
                className="w-3.5 h-3.5"
              />
              <Avatar name={c.fullName} size={24} />
              <span className="text-textPrimary">{c.fullName}</span>
            </label>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            disabled={!name.trim() || selected.length === 0}
            onClick={() => onCreate(name.trim(), selected)}
            className="flex-1 text-sm py-2 rounded-lg text-white font-medium bg-primary disabled:opacity-50"
          >
            ساخت گروه
          </button>
          <button onClick={onCancel} className="text-sm px-4 py-2 rounded-lg text-textSecondary">
            انصراف
          </button>
        </div>
      </div>
    </div>
  );
}

export function NewDirectModal({
  colleagues,
  onCancel,
  onPick,
}: {
  colleagues: { id: string; fullName: string }[];
  onCancel: () => void;
  onPick: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = colleagues.filter((c) => c.fullName.includes(query));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-[2px] animate-fade-in">
      <div className="rounded-2xl w-full max-w-sm p-5 bg-surface shadow-modal animate-pop-in">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-semibold text-textPrimary">پیام مستقیم جدید</p>
          <button onClick={onCancel} aria-label="بستن">
            <X size={16} className="text-textSecondary" />
          </button>
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="جست‌وجوی همکار..."
          className="text-sm w-full rounded-lg px-3 py-2 mb-3 border border-border"
        />
        <div className="space-y-1 max-h-56 overflow-y-auto">
          {filtered.map((c) => (
            <button
              key={c.id}
              onClick={() => onPick(c.id)}
              className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-xs text-right hover:bg-bg"
            >
              <Avatar name={c.fullName} size={24} />
              <span className="text-textPrimary">{c.fullName}</span>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-xs text-textSecondary px-2 py-2">همکاری یافت نشد</p>}
        </div>
      </div>
    </div>
  );
}
