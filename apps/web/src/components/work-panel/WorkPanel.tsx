import { useMemo, useState } from "react";
import { History, Plus, X } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { formatJalaliDateTime } from "../../lib/jalali";
import { DualDateInput } from "../../components/ui/DualDateInput";
import { useColleagues } from "../../pages/users/users-api";
import {
  ACTION_KIND_LABELS,
  ActionItem,
  ActionKind,
  useActionCenter,
  useActionItemMutation,
} from "../../pages/action-center/action-center-api";
import { useActivities, useActivityMutations } from "../../pages/activities/activities-api";
import { avatarColor, Bucket, BUCKET_LABEL, computeBucket, initials, PRIORITY_COLOR } from "./work-panel-shared";
import { TaskDrawer } from "./TaskDrawer";

type Scope = "mine" | "delegated" | "team";

function MiniAvatar({ name, size = 16 }: { name: string; size?: number }) {
  return (
    <span
      className="rounded-full inline-flex items-center justify-center shrink-0 font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42, background: avatarColor(name) }}
    >
      {initials(name)}
    </span>
  );
}

// پیش‌فرض فردا همین ساعت
function tomorrowDateIso(): string {
  const d = new Date(Date.now() + 24 * 60 * 60 * 1000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function nowTime(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** موکول به آینده — طبق درخواست کاربر: تاریخ/ساعت جدید و یک کامنت الزامی، نه فقط چند گزینه آماده */
function SnoozePopover({
  onSubmit,
  onClose,
}: {
  onSubmit: (iso: string, comment: string) => void;
  onClose: () => void;
}) {
  const [date, setDate] = useState<string | null>(tomorrowDateIso());
  const [time, setTime] = useState(nowTime());
  const [comment, setComment] = useState("");

  return (
    <div
      className="absolute z-20 top-full mt-1.5 right-2 bg-surface border border-border rounded-xl shadow-dropdown p-3 flex flex-col gap-2 w-64 origin-top-right animate-pop-in"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-[11px] font-semibold text-textPrimary">موکول به چه زمانی؟</p>
      <DualDateInput value={date} onChange={setDate} />
      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="w-full text-xs px-2.5 py-2 rounded-lg border border-border bg-surface text-textPrimary"
      />
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        rows={2}
        placeholder="توضیح (چرا موکول شد؟)"
        className="w-full text-xs px-2.5 py-2 rounded-lg border border-border bg-surface text-textPrimary resize-none"
      />
      <div className="flex justify-end gap-1.5">
        <button onClick={onClose} className="text-[11px] px-2.5 py-1.5 rounded-lg text-textSecondary hover:bg-bg">
          انصراف
        </button>
        <button
          disabled={!date || !comment.trim()}
          onClick={() => {
            if (!date) return;
            onSubmit(new Date(`${date}T${time}`).toISOString(), comment.trim());
            onClose();
          }}
          className="text-[11px] px-2.5 py-1.5 rounded-lg bg-primary text-white font-medium disabled:opacity-50"
        >
          ثبت
        </button>
      </div>
    </div>
  );
}

/** ثبت «انجام شد» — طبق درخواست کاربر: قبل از ثبت، امکان نوشتن توضیحات کار انجام‌شده */
function CompletePopover({ onSubmit, onClose }: { onSubmit: (note: string) => void; onClose: () => void }) {
  const [note, setNote] = useState("");
  return (
    <div
      className="absolute z-20 top-full mt-1.5 right-2 bg-surface border border-border rounded-xl shadow-dropdown p-3 flex flex-col gap-2 w-64 origin-top-right animate-pop-in"
      onClick={(e) => e.stopPropagation()}
    >
      <p className="text-[11px] font-semibold text-textPrimary">توضیحات انجام کار (اختیاری)</p>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={2}
        placeholder="چه کاری انجام شد؟"
        className="w-full text-xs px-2.5 py-2 rounded-lg border border-border bg-surface text-textPrimary resize-none"
      />
      <div className="flex justify-end gap-1.5">
        <button onClick={onClose} className="text-[11px] px-2.5 py-1.5 rounded-lg text-textSecondary hover:bg-bg">
          انصراف
        </button>
        <button
          onClick={() => {
            onSubmit(note.trim());
            onClose();
          }}
          className="text-[11px] px-2.5 py-1.5 rounded-lg bg-success text-white font-medium"
        >
          ثبت و تکمیل کار
        </button>
      </div>
    </div>
  );
}

function TaskRow({ item, currentUserId, onOpen }: { item: ActionItem; currentUserId: string; onOpen: (id: string) => void }) {
  const isTask = item.sourceType === "activity";
  const { complete, recordOutcome } = useActivityMutations();
  const actionMutation = useActionItemMutation();
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);
  const bucket = computeBucket(item);
  const colors = PRIORITY_COLOR[item.priority];

  const dueLabel = item.dueAt ? formatJalaliDateTime(item.dueAt) : bucket === "later" ? "بدون سررسید" : "—";

  const handleClick = () => {
    if (isTask) onOpen(item.sourceId);
  };

  return (
    <div
      className={`relative flex gap-2.5 px-2 py-2.5 rounded-lg border border-transparent transition-colors duration-150 hover:bg-bg hover:border-border ${isTask ? "cursor-pointer" : ""}`}
      onClick={handleClick}
    >
      <div className={`w-[3px] rounded-full shrink-0 ${colors.bar}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-1.5">
          <p className="text-[12.5px] font-semibold text-textPrimary flex-1 leading-snug">{item.title}</p>
          <span className="text-[9px] px-1.5 py-0.5 rounded-lg font-semibold bg-bg text-textSecondary shrink-0 mt-0.5">
            {ACTION_KIND_LABELS[item.kind]}
          </span>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap mt-1 text-[10.5px] text-textSecondary">
          {item.ownerName && item.ownerId !== currentUserId && (
            <span className="flex items-center gap-1">
              <MiniAvatar name={item.ownerName} size={14} /> {item.ownerName}
            </span>
          )}
          {item.subtitle && <span className="truncate">{item.subtitle}</span>}
          <span className={`mr-auto whitespace-nowrap ${bucket === "overdue" ? "text-danger font-semibold" : bucket === "today" ? "text-warning font-medium" : ""}`}>
            {dueLabel}
          </span>
        </div>

        {isTask ? (
          <div className="flex items-center gap-1.5 mt-1.5" onClick={(e) => e.stopPropagation()}>
            <div className="relative">
              <button
                onClick={() => setCompleteOpen((v) => !v)}
                className="text-[10px] px-2 py-1 rounded-lg border border-border text-textSecondary transition-all duration-150 hover:text-success hover:border-success hover:bg-success/5 flex items-center gap-1"
              >
                ✓ انجام شد
              </button>
              {completeOpen && (
                <CompletePopover
                  onClose={() => setCompleteOpen(false)}
                  onSubmit={(note) => complete.mutate({ id: item.sourceId, outcomeNote: note || undefined })}
                />
              )}
            </div>
            <div className="relative">
              <button
                onClick={() => setSnoozeOpen((v) => !v)}
                className="text-[10px] px-2 py-1 rounded-lg border border-border text-textSecondary transition-all duration-150 hover:text-warning hover:border-warning hover:bg-warningSoft flex items-center gap-1"
              >
                ⏰ موکول کن
              </button>
              {snoozeOpen && (
                <SnoozePopover
                  onClose={() => setSnoozeOpen(false)}
                  onSubmit={(iso, comment) =>
                    recordOutcome.mutate({
                      id: item.sourceId,
                      effectOverride: "create_follow_up",
                      nextActionAt: iso,
                      outcomeNote: comment,
                    })
                  }
                />
              )}
            </div>
            <button
              onClick={() => onOpen(item.sourceId)}
              className="text-[10px] px-2 py-1 rounded-lg border border-border text-textSecondary transition-all duration-150 hover:text-textPrimary hover:border-textSecondary/40 hover:bg-bg"
            >
              ↪ ارجاع
            </button>
          </div>
        ) : (
          item.actions.length > 0 && (
            <div className="flex items-center gap-1.5 mt-1.5" onClick={(e) => e.stopPropagation()}>
              {item.actions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => actionMutation.mutate(action)}
                  disabled={actionMutation.isPending}
                  className={`text-[10px] px-2.5 py-1 rounded-lg font-medium transition-all duration-150 disabled:opacity-60 disabled:pointer-events-none ${
                    action.label === "رد"
                      ? "border border-danger text-danger hover:bg-danger/10"
                      : "bg-primary text-white hover:brightness-110"
                  }`}
                >
                  {action.label}
                </button>
              ))}
              {item.linkPath && (
                <a
                  href={item.linkPath}
                  className="text-[10px] text-primary font-medium mr-auto transition-colors duration-150 hover:brightness-110"
                >
                  مشاهده
                </a>
              )}
            </div>
          )
        )}
      </div>
    </div>
  );
}

function NewTaskForm({ onDone }: { onDone: () => void }) {
  const { data: colleagues } = useColleagues();
  const { user } = useAuth();
  const { create } = useActivityMutations();
  const [subject, setSubject] = useState("");
  const [assignee, setAssignee] = useState("me");
  const [priority, setPriority] = useState("normal");
  // پیش‌فرض فردا همین ساعت — فقط برای راحتی، کاربر آزاده تغییرش بده. تاریخ به‌صورت شمسی
  // (DualDateInput) گرفته می‌شه، ساعت چون مستقل از تقویمه با یک ورودی ساعت ساده
  const [dueDate, setDueDate] = useState<string | null>(tomorrowDateIso());
  const [dueTime, setDueTime] = useState(nowTime());

  const submit = async () => {
    if (!subject.trim() || !dueDate) return;
    await create.mutateAsync({
      activityType: "internal_task",
      subject: subject.trim(),
      priority,
      dueAt: new Date(`${dueDate}T${dueTime}`).toISOString(),
      assignedToUserId: assignee === "me" ? user?.id : assignee,
    });
    setSubject("");
    setDueDate(tomorrowDateIso());
    setDueTime(nowTime());
    onDone();
  };

  return (
    <div className="mx-3 mb-2.5 p-3 rounded-xl bg-bg border border-border space-y-2 animate-pop-in">
      <input
        value={subject}
        onChange={(e) => setSubject(e.target.value)}
        placeholder="عنوان کار — مثلاً «تماس با مشتری ABC»"
        className="w-full text-xs px-2.5 py-2 rounded-lg border border-border bg-surface text-textPrimary placeholder:text-textSecondary/60 shadow-xs transition-all duration-150 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
      <div className="flex gap-1.5">
        <select
          value={assignee}
          onChange={(e) => setAssignee(e.target.value)}
          className="flex-1 text-xs px-2 py-1.5 rounded-lg border border-border bg-surface text-textPrimary shadow-xs transition-all duration-150 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
        >
          <option value="me">برای خودم</option>
          {(colleagues ?? [])
            .filter((c) => c.id !== user?.id)
            .map((c) => (
              <option key={c.id} value={c.id}>
                واگذاری به {c.fullName}
              </option>
            ))}
        </select>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          className="text-xs px-2 py-1.5 rounded-lg border border-border bg-surface text-textPrimary shadow-xs transition-all duration-150 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
        >
          <option value="low">کم‌اهمیت</option>
          <option value="normal">عادی</option>
          <option value="high">مهم</option>
          <option value="urgent">فوری</option>
        </select>
      </div>
      <div className="flex gap-1.5">
        <DualDateInput value={dueDate} onChange={setDueDate} placeholder="تاریخ سررسید" />
        <input
          type="time"
          value={dueTime}
          onChange={(e) => setDueTime(e.target.value)}
          className="text-xs px-2 py-1.5 rounded-lg border border-border bg-surface text-textPrimary shadow-xs transition-all duration-150 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
      </div>
      <div className="flex justify-end gap-2">
        <button
          onClick={onDone}
          className="text-[11px] px-3 py-1.5 rounded-lg border border-border text-textSecondary transition-all duration-150 hover:bg-surface hover:text-textPrimary"
        >
          انصراف
        </button>
        <button
          onClick={submit}
          disabled={!subject.trim() || !dueDate || create.isPending}
          className="text-[11px] px-3 py-1.5 rounded-lg bg-primary text-white font-medium shadow-xs transition-all duration-150 hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
        >
          {create.isPending ? "در حال ایجاد..." : "ایجاد کار"}
        </button>
      </div>
    </div>
  );
}

/** سابقه کارهای تکمیل/لغوشده — action-center این‌ها رو حذف می‌کنه، پس مستقیم از useActivities می‌خونیم */
function HistoryList({ onOpen }: { onOpen: (id: string) => void }) {
  const { data: activities, isLoading } = useActivities({ assignedToMe: true, status: "completed" });
  const sorted = [...(activities ?? [])].sort(
    (a, b) => new Date(b.completedAt ?? b.createdAt).getTime() - new Date(a.completedAt ?? a.createdAt).getTime(),
  );

  if (isLoading) {
    return <p className="text-xs text-textSecondary text-center py-10">در حال بارگذاری...</p>;
  }
  if (sorted.length === 0) {
    return <p className="text-xs text-textSecondary text-center py-10">هنوز کار تکمیل‌شده‌ای نیست.</p>;
  }
  return (
    <div className="px-2 pb-3">
      {sorted.map((a) => (
        <button
          key={a.id}
          onClick={() => onOpen(a.id)}
          className="w-full text-right flex flex-col gap-0.5 px-2 py-2.5 rounded-lg hover:bg-bg transition-colors duration-150"
        >
          <p className="text-[12.5px] font-semibold text-textPrimary leading-snug">{a.subject}</p>
          <p className="text-[10.5px] text-textSecondary">
            {a.completedAt ? formatJalaliDateTime(a.completedAt) : ""}
            {a.outcomeNote ? ` · ${a.outcomeNote}` : ""}
          </p>
        </button>
      ))}
    </div>
  );
}

export function WorkPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const [scope, setScope] = useState<Scope>("mine");
  const [kind, setKind] = useState<"all" | ActionKind>("all");
  const [bucketFilter, setBucketFilter] = useState<Bucket | null>(null);
  const [newTaskOpen, setNewTaskOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  const apiScope = scope === "team" ? "team" : "mine";
  const { data } = useActionCenter(apiScope);

  const filteredItems = useMemo(() => {
    let items = data?.items ?? [];
    if (scope === "mine") {
      items = items.filter((i) => !i.ownerId || i.ownerId === user?.id);
    } else if (scope === "delegated") {
      items = items.filter((i) => i.creatorId === user?.id && i.ownerId && i.ownerId !== user?.id);
    }
    if (kind !== "all") items = items.filter((i) => i.kind === kind);
    if (bucketFilter) items = items.filter((i) => computeBucket(i) === bucketFilter);
    return items;
  }, [data, scope, kind, bucketFilter, user?.id]);

  const summary = data?.summary ?? { overdue: 0, today: 0, thisWeek: 0, later: 0 };

  let lastBucket: Bucket | null = null;

  if (!open) return null;

  return (
    <>
      <div
        className="fixed top-14 left-0 right-0 bottom-0 z-40 bg-black/30 backdrop-blur-[1px] animate-fade-in"
        onClick={onClose}
      />
      <aside className="fixed top-14 bottom-0 left-0 z-50 w-[340px] max-w-[92vw] bg-surface border-e border-border shadow-2xl flex flex-col">
        <div className="px-4 pt-4 pb-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              aria-label="بستن پنل"
              className="w-7 h-7 rounded-lg border border-border bg-bg text-textSecondary hover:text-textPrimary hover:border-textSecondary/40 transition-all duration-150 flex items-center justify-center shrink-0"
            >
              <X size={14} />
            </button>
            <span className="text-[13px] font-bold text-textPrimary flex-1 tracking-tight">مرکز کار من</span>
          </div>
          <div className="flex items-center justify-between mt-3">
            <button
              onClick={() => setHistoryOpen((v) => !v)}
              className={`flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-lg border transition-all duration-150 ${
                historyOpen
                  ? "bg-textPrimary border-textPrimary text-surface"
                  : "border-border text-textSecondary hover:border-textSecondary/40 hover:text-textPrimary"
              }`}
            >
              <History size={12} /> تاریخچه
            </button>
            <button
              onClick={() => setNewTaskOpen((v) => !v)}
              className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg bg-primary text-white shadow-xs transition-all duration-150 hover:brightness-110 active:scale-[0.98]"
            >
              <Plus size={12} /> کار جدید
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
          {newTaskOpen && <NewTaskForm onDone={() => setNewTaskOpen(false)} />}

          {historyOpen ? (
            <div className="flex-1 overflow-y-auto">
              <HistoryList onOpen={setOpenTaskId} />
            </div>
          ) : (
          <>
            <div className="grid grid-cols-4 gap-1.5 px-3 py-2.5 shrink-0">
              {(
                [
                  ["overdue", summary.overdue, "text-danger bg-danger/10"],
                  ["today", summary.today, "text-warning bg-warningSoft"],
                  ["week", summary.thisWeek, "text-accent bg-accentSoft"],
                  ["later", summary.later, "text-textSecondary bg-bg"],
                ] as [Bucket, number, string][]
              ).map(([b, n, cls]) => (
                <button
                  key={b}
                  onClick={() => setBucketFilter((cur) => (cur === b ? null : b))}
                  className={`rounded-lg py-1.5 text-center border transition-all duration-150 ease-smooth hover:brightness-95 active:scale-[0.98] ${cls} ${
                    bucketFilter === b ? "border-current shadow-xs" : "border-transparent"
                  }`}
                >
                  <span className="block text-sm font-bold leading-tight">{n}</span>
                  <span className="block text-[9px] mt-0.5">{BUCKET_LABEL[b]}</span>
                </button>
              ))}
            </div>

            <div className="flex gap-1 px-3 pb-2.5 shrink-0">
              {(
                [
                  ["mine", "کارهای من"],
                  ["delegated", "واگذارشده توسط من"],
                  ["team", "تیم"],
                ] as [Scope, string][]
              ).map(([s, label]) => (
                <button
                  key={s}
                  onClick={() => setScope(s)}
                  className={`flex-1 text-[10.5px] py-1.5 rounded-lg border transition-all duration-150 ease-smooth ${
                    scope === s
                      ? "bg-primary border-primary text-white shadow-xs"
                      : "border-border text-textSecondary hover:border-textSecondary/40 hover:text-textPrimary"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex gap-1.5 px-3 pb-2.5 overflow-x-auto shrink-0">
              {(["all", ...ACTIVITY_KIND_FILTER_ORDER] as ("all" | ActionKind)[]).map((k) => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`text-[10px] px-2.5 py-1 rounded-full border whitespace-nowrap shrink-0 transition-all duration-150 ${
                    kind === k
                      ? "bg-textPrimary border-textPrimary text-surface"
                      : "border-border text-textSecondary hover:border-textSecondary/40 hover:text-textPrimary"
                  }`}
                >
                  {k === "all" ? "همه" : ACTION_KIND_LABELS[k]}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-2 pb-3">
              {filteredItems.length === 0 && (
                <p className="text-xs text-textSecondary text-center py-10">کاری در این فیلتر نیست.</p>
              )}
              {filteredItems.map((item) => {
                const b = computeBucket(item);
                const showHeader = b !== lastBucket;
                lastBucket = b;
                return (
                  <div key={item.id}>
                    {showHeader && (
                      <p className="text-[10.5px] font-bold text-textSecondary px-2 pt-3 pb-1">{BUCKET_LABEL[b]}</p>
                    )}
                    <TaskRow item={item} currentUserId={user?.id ?? ""} onOpen={setOpenTaskId} />
                  </div>
                );
              })}
            </div>
          </>
          )}
        </div>
      </aside>

      {openTaskId && <TaskDrawer taskId={openTaskId} onClose={() => setOpenTaskId(null)} />}
    </>
  );
}

const ACTIVITY_KIND_FILTER_ORDER: ActionKind[] = ["task", "follow_up", "approval", "reminder", "mention"];
