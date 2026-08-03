import { useEffect, useRef, useState } from "react";
import { Paperclip, Send, X } from "lucide-react";
import { formatJalaliDateTime } from "../../lib/jalali";
import { useColleagues } from "../../pages/users/users-api";
import { ACTION_PRIORITY_LABELS } from "../../pages/action-center/action-center-api";
import { useOutcomeTemplates } from "../../pages/activities/outcome-templates-api";
import {
  ACTIVITY_STATUS_LABELS,
  useActivityMutations,
  useTask,
  useTaskTimeline,
} from "../../pages/activities/activities-api";
import { avatarColor, initials, inHours, nextWeek, PRIORITY_COLOR, tomorrowAt } from "./work-panel-shared";

function Avatar({ name, size = 26 }: { name: string; size?: number }) {
  return (
    <span
      className="rounded-full inline-flex items-center justify-center shrink-0 font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4, background: avatarColor(name) }}
    >
      {initials(name)}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls: Record<string, string> = {
    open: "bg-bg text-textSecondary",
    scheduled: "bg-bg text-textSecondary",
    in_progress: "bg-accentSoft text-accent",
    waiting: "bg-warningSoft text-warning",
    overdue: "bg-danger/10 text-danger",
    completed: "bg-successSoft text-success",
    cancelled: "bg-bg text-textSecondary",
  };
  return (
    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold ${cls[status] ?? "bg-bg text-textSecondary"}`}>
      {ACTIVITY_STATUS_LABELS[status] ?? status}
    </span>
  );
}

const OUTCOME_QUICK_TIMES: [string, string][] = [
  ["۱ ساعت دیگر", ""],
  ["فردا صبح ۹:۰۰", ""],
  ["هفته آینده", ""],
];

export function TaskDrawer({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { data: task, isLoading } = useTask(taskId);
  const { data: timeline } = useTaskTimeline(taskId);
  const { data: colleagues } = useColleagues();
  const { data: outcomeTemplates } = useOutcomeTemplates(task?.activityType);
  const { addComment, reassign, recordOutcome, complete, cancel } = useActivityMutations();

  const [comment, setComment] = useState("");
  const [reassignOpen, setReassignOpen] = useState(false);
  const [reassignTarget, setReassignTarget] = useState("");
  const [selectedOutcomeId, setSelectedOutcomeId] = useState<string | null>(null);
  const [selectedTimeIso, setSelectedTimeIso] = useState<string | null>(null);
  const [spawnNewTask, setSpawnNewTask] = useState(false);
  const [waitingReasonInput, setWaitingReasonInput] = useState("");
  const [outcomeNoteInput, setOutcomeNoteInput] = useState("");
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = timelineRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [timeline?.length]);

  useEffect(() => {
    setSelectedOutcomeId(null);
    setSelectedTimeIso(null);
    setSpawnNewTask(false);
    setWaitingReasonInput("");
    setOutcomeNoteInput("");
  }, [taskId]);

  if (isLoading || !task) {
    return (
      <>
        <div className="fixed top-14 left-0 right-0 bottom-0 bg-black/40 z-40" onClick={onClose} />
        <div className="fixed top-14 bottom-0 left-0 w-[440px] max-w-[92vw] bg-surface z-50 shadow-2xl flex items-center justify-center">
          <p className="text-xs text-textSecondary">در حال بارگذاری...</p>
        </div>
      </>
    );
  }

  const selectedOutcome = outcomeTemplates?.find((o) => o.id === selectedOutcomeId) ?? null;
  const effect = selectedOutcome?.effect ?? null;

  const submitOutcome = async () => {
    if (!selectedOutcome) return;
    if (effect === "create_follow_up") {
      await recordOutcome.mutateAsync({
        id: taskId,
        outcomeId: selectedOutcome.id,
        nextActionAt: selectedTimeIso ?? undefined,
        outcomeNote: outcomeNoteInput || undefined,
        spawnNewTask,
      });
    } else if (effect === "keep_waiting") {
      await recordOutcome.mutateAsync({
        id: taskId,
        outcomeId: selectedOutcome.id,
        outcomeNote: waitingReasonInput || undefined,
      });
    } else {
      await recordOutcome.mutateAsync({
        id: taskId,
        outcomeId: selectedOutcome.id,
        outcomeNote: outcomeNoteInput || undefined,
      });
      onClose();
      return;
    }
    setSelectedOutcomeId(null);
    setSelectedTimeIso(null);
    setSpawnNewTask(false);
    setWaitingReasonInput("");
    setOutcomeNoteInput("");
  };

  const colors = PRIORITY_COLOR[task.priority as keyof typeof PRIORITY_COLOR] ?? PRIORITY_COLOR.normal;
  const priorityLabel =
    ACTION_PRIORITY_LABELS[task.priority as keyof typeof ACTION_PRIORITY_LABELS] ?? task.priority;

  return (
    <>
      <div className="fixed top-14 left-0 right-0 bottom-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed top-14 bottom-0 left-0 w-[440px] max-w-[92vw] bg-surface z-50 shadow-2xl flex flex-col" dir="rtl">
        <div className="px-4 py-4 border-b border-border shrink-0">
          <div className="flex items-start gap-2.5">
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-lg border border-border bg-bg text-textSecondary shrink-0 flex items-center justify-center"
            >
              <X size={14} />
            </button>
            <h2 className="text-[14px] font-bold text-textPrimary flex-1 leading-relaxed">{task.subject}</h2>
          </div>
          <div className="flex gap-1.5 mt-2.5">
            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold ${colors.soft} ${colors.text}`}>
              {priorityLabel}
            </span>
            <StatusPill status={task.status} />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4">
          <div className="grid grid-cols-2 gap-2.5 mb-4">
            <div className="rounded-lg bg-bg border border-border px-2.5 py-2">
              <p className="text-[9.5px] text-textSecondary mb-1">ایجادکننده</p>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-textPrimary">
                <Avatar name={task.createdBy.fullName} size={18} /> {task.createdBy.fullName}
              </div>
            </div>
            <div className="rounded-lg bg-bg border border-border px-2.5 py-2">
              <p className="text-[9.5px] text-textSecondary mb-1">مسئول فعلی</p>
              <div className="flex items-center gap-1.5 text-xs font-semibold text-textPrimary">
                <Avatar name={task.assignedTo.fullName} size={18} /> {task.assignedTo.fullName}
                <button onClick={() => setReassignOpen((v) => !v)} className="text-[10px] text-primary mr-auto">
                  واگذاری مجدد
                </button>
              </div>
              {reassignOpen && (
                <div className="flex gap-1.5 mt-2">
                  <select
                    value={reassignTarget}
                    onChange={(e) => setReassignTarget(e.target.value)}
                    className="flex-1 text-[11px] px-1.5 py-1 rounded-lg border border-border bg-surface"
                  >
                    <option value="" disabled>
                      انتخاب کنید
                    </option>
                    {(colleagues ?? []).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.fullName}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => {
                      if (!reassignTarget) return;
                      reassign.mutate({ id: taskId, newOwnerId: reassignTarget });
                      setReassignOpen(false);
                      setReassignTarget("");
                    }}
                    className="text-[10px] px-2 py-1 rounded-lg bg-primary text-white"
                  >
                    تأیید
                  </button>
                </div>
              )}
            </div>
            <div className="col-span-2 rounded-lg bg-bg border border-border px-2.5 py-2">
              <p className="text-[9.5px] text-textSecondary mb-1">موعد</p>
              <p className="text-xs font-semibold text-textPrimary">
                {task.dueAt ? formatJalaliDateTime(task.dueAt) : "بدون سررسید"}
              </p>
            </div>
            {task.relatedEntityType === "inquiry" && task.relatedEntityId && (
              <a
                href={`/inquiries/${task.relatedEntityId}`}
                className="col-span-2 rounded-lg bg-bg border border-border px-2.5 py-2 text-xs font-medium text-primary"
              >
                🔗 مشاهده پرونده استعلام مرتبط
              </a>
            )}
            {task.status === "waiting" && task.waitingReason && (
              <div className="col-span-2 rounded-lg bg-warningSoft border border-border px-2.5 py-2">
                <p className="text-[9.5px] text-warning mb-1">منتظر چی/کی هستیم؟</p>
                <p className="text-xs font-medium text-textPrimary">{task.waitingReason}</p>
              </div>
            )}
          </div>

          <p className="text-[11px] font-bold text-textSecondary mb-2.5">تاریخچه</p>
          <div ref={timelineRef} className="space-y-0 mb-5 max-h-72 overflow-y-auto">
            {(timeline ?? []).map((entry, idx) => (
              <div key={entry.id} className="flex gap-2.5 pb-4 relative">
                {idx !== (timeline?.length ?? 0) - 1 && (
                  <span className="absolute top-6 bottom-0 right-[13px] w-px bg-border" />
                )}
                <Avatar name={entry.author.fullName} size={22} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-1.5 flex-wrap">
                    <span className="text-[11.5px] font-bold text-textPrimary">{entry.author.fullName}</span>
                    <span className="text-[10px] text-textSecondary">{formatJalaliDateTime(entry.createdAt)}</span>
                  </div>
                  {entry.entryType === "comment" ? (
                    <p className="text-xs text-textPrimary mt-0.5 leading-relaxed">{entry.entryText}</p>
                  ) : entry.actionKind === "outcome_recorded" ? (
                    <div className="mt-1 px-2.5 py-2 rounded-lg bg-bg border-r-2 border-accent text-[11px]">
                      <p>
                        <span className="text-textSecondary">نتیجه: </span>
                        <strong>{(entry.metadata?.outcomeLabel as string) ?? entry.entryText}</strong>
                      </p>
                      {typeof entry.metadata?.nextActionAt === "string" && (
                        <p className="mt-0.5">
                          <span className="text-textSecondary">
                            {entry.metadata?.sameTask ? "اقدام بعدی (همین کار): " : "کار پیگیری جدید: "}
                          </span>
                          <strong>{formatJalaliDateTime(entry.metadata.nextActionAt as string)}</strong>
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="text-[11.5px] text-textSecondary mt-0.5">{entry.entryText}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mb-1">
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={2}
              placeholder="یک کامنت اضافه کن..."
              className="flex-1 text-xs px-2.5 py-2 rounded-lg border border-border bg-surface text-textPrimary resize-none"
            />
            <button
              onClick={async () => {
                if (!comment.trim()) return;
                await addComment.mutateAsync({ id: taskId, text: comment.trim() });
                setComment("");
              }}
              className="w-9 h-9 rounded-lg bg-primary text-white shrink-0 flex items-center justify-center self-end"
            >
              <Send size={14} />
            </button>
          </div>
          <button className="flex items-center gap-1 text-[10.5px] text-textSecondary mb-5">
            <Paperclip size={11} /> پیوست فایل
          </button>

          <div className="rounded-lg bg-accentSoft p-3.5">
            <p className="text-[11px] font-bold text-accent mb-2.5">ثبت نتیجه و اقدام بعدی</p>
            <div className="flex flex-wrap gap-1.5 mb-2.5">
              {(outcomeTemplates ?? []).map((o) => (
                <button
                  key={o.id}
                  onClick={() => {
                    setSelectedOutcomeId(o.id);
                    setSelectedTimeIso(null);
                  }}
                  className={`text-[11px] px-2.5 py-1.5 rounded-lg border ${
                    selectedOutcomeId === o.id ? "bg-accent border-accent text-white" : "border-border bg-surface text-textPrimary"
                  }`}
                >
                  {o.label}
                </button>
              ))}
            </div>

            {effect === "create_follow_up" && (
              <div className="mt-2 pt-2 border-t border-dashed border-border space-y-2">
                <p className="text-[10.5px] px-2 py-1.5 rounded-lg bg-successSoft text-success">
                  ↻ همین کار باز می‌مونه — فقط اقدام بعدی و زمانش عوض می‌شه
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {OUTCOME_QUICK_TIMES.map(([label]) => {
                    const iso = label.includes("ساعت") ? inHours(1) : label.includes("فردا") ? tomorrowAt(9) : nextWeek();
                    return (
                      <button
                        key={label}
                        onClick={() => setSelectedTimeIso(iso)}
                        className={`text-[10.5px] px-2.5 py-1 rounded-full border ${
                          selectedTimeIso === iso ? "bg-textPrimary border-textPrimary text-surface" : "border-border"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={() => setSpawnNewTask((v) => !v)}
                  className="text-[10.5px] text-textSecondary underline underline-offset-2"
                >
                  {spawnNewTask ? "✓ " : ""}در عوض، این رو به‌عنوان یک کار کاملاً مستقل ثبت کن
                </button>
              </div>
            )}

            {effect === "keep_waiting" && (
              <div className="mt-2 pt-2 border-t border-dashed border-border">
                <input
                  value={waitingReasonInput}
                  onChange={(e) => setWaitingReasonInput(e.target.value)}
                  placeholder="منتظر چی یا کی هستیم؟"
                  className="w-full text-xs px-2.5 py-2 rounded-lg border border-border bg-surface"
                />
              </div>
            )}

            {(effect === "close" || effect === "create_follow_up") && (
              <div className="mt-2 pt-2 border-t border-dashed border-border">
                <textarea
                  value={outcomeNoteInput}
                  onChange={(e) => setOutcomeNoteInput(e.target.value)}
                  rows={2}
                  placeholder="توضیحات (اختیاری)"
                  className="w-full text-xs px-2.5 py-2 rounded-lg border border-border bg-surface resize-none"
                />
              </div>
            )}

            <button
              onClick={submitOutcome}
              disabled={
                !selectedOutcome ||
                recordOutcome.isPending ||
                (effect === "create_follow_up" && !selectedTimeIso)
              }
              className="w-full mt-3 text-xs font-semibold px-3 py-2 rounded-lg bg-primary text-white disabled:opacity-50"
            >
              {!selectedOutcome
                ? "یک نتیجه رو انتخاب کن"
                : effect === "close"
                  ? "ثبت و تکمیل کار"
                  : effect === "keep_waiting"
                    ? "ثبت و انتقال به وضعیت «در انتظار»"
                    : "ثبت نتیجه و ادامهٔ همین کار"}
            </button>
          </div>
        </div>

        <div className="px-4 py-3 border-t border-border flex gap-2 shrink-0">
          <button
            onClick={() => setReassignOpen(true)}
            className="flex-1 text-xs px-3 py-2 rounded-lg border border-border text-textPrimary"
          >
            ↪ ارجاع
          </button>
          <button
            onClick={() => {
              complete.mutate({ id: taskId });
              onClose();
            }}
            className="flex-1 text-xs px-3 py-2 rounded-lg bg-primary text-white font-medium"
          >
            ✓ تکمیل کار
          </button>
          <button
            onClick={() => {
              cancel.mutate(taskId);
              onClose();
            }}
            className="text-xs px-3 py-2 rounded-lg border border-border text-danger"
          >
            لغو
          </button>
        </div>
      </div>
    </>
  );
}
