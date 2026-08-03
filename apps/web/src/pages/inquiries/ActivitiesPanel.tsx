import { useState } from "react";
import { CalendarClock, CheckCircle2, Plus, XCircle } from "lucide-react";
import { formatJalaliDateTime } from "../../lib/jalali";
import { useColleagues } from "../users/users-api";
import {
  ACTIVITY_STATUS_LABELS,
  ACTIVITY_TYPE_LABELS,
  Activity,
  useActivities,
  useActivityMutations,
} from "../activities/activities-api";
import { useOutcomeTemplates } from "../activities/outcome-templates-api";

const STATUS_BADGE_CLASS: Record<string, string> = {
  open: "bg-bg text-textSecondary",
  scheduled: "bg-accentSoft text-accent",
  waiting: "bg-warningSoft text-warning",
  overdue: "bg-[#F3E6E4] text-danger",
  completed: "bg-successSoft text-success",
  cancelled: "bg-bg text-textSecondary",
};

function CompleteForm({ activity, onDone }: { activity: Activity; onDone: () => void }) {
  const { data: templates = [] } = useOutcomeTemplates(activity.activityType);
  const { complete } = useActivityMutations();
  const [outcomeId, setOutcomeId] = useState("");
  const [note, setNote] = useState("");

  const submit = () => {
    complete.mutate(
      { id: activity.id, outcomeId: outcomeId || undefined, outcomeNote: note.trim() || undefined },
      { onSuccess: onDone },
    );
  };

  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-2.5 mt-2 space-y-2">
      {templates.length > 0 && (
        <select
          value={outcomeId}
          onChange={(e) => setOutcomeId(e.target.value)}
          className="w-full text-xs rounded-lg px-2.5 py-1.5 border border-border"
        >
          <option value="">بدون نتیجهٔ ساختاریافته</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
              {t.requiresFollowUp ? " (نیاز به پیگیری)" : ""}
            </option>
          ))}
        </select>
      )}
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="یادداشت (اختیاری)..."
        rows={2}
        className="w-full text-xs rounded-lg px-2.5 py-1.5 border border-border resize-none"
      />
      <div className="flex gap-2 justify-end">
        <button onClick={onDone} className="text-[11px] px-3 py-1.5 rounded-lg text-textSecondary">
          انصراف
        </button>
        <button
          onClick={submit}
          disabled={complete.isPending}
          className="text-[11px] px-3 py-1.5 rounded-lg text-white bg-success disabled:opacity-50"
        >
          ثبت تکمیل
        </button>
      </div>
    </div>
  );
}

function ActivityRow({ activity }: { activity: Activity }) {
  const { cancel } = useActivityMutations();
  const isOpenState = !["completed", "cancelled"].includes(activity.status);
  const [completing, setCompleting] = useState(false);

  return (
    <div className="rounded-lg px-3 py-2.5 bg-bg transition-colors duration-150 hover:bg-border/40">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-medium text-textPrimary">{activity.subject}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_BADGE_CLASS[activity.status] ?? ""}`}>
              {ACTIVITY_STATUS_LABELS[activity.status] ?? activity.status}
            </span>
          </div>
          <p className="text-[11px] text-textSecondary mt-1">
            {ACTIVITY_TYPE_LABELS[activity.activityType] ?? activity.activityType} · مسئول: {activity.assignedTo.fullName}
            {activity.dueAt && <> · مهلت: {formatJalaliDateTime(activity.dueAt)}</>}
          </p>
          {(activity.outcome || activity.outcomeNote) && (
            <p className="text-[11px] text-textSecondary mt-1">
              نتیجه: {activity.outcome?.label}
              {activity.outcome && activity.outcomeNote ? " — " : ""}
              {activity.outcomeNote}
            </p>
          )}
        </div>
        {isOpenState && !completing && (
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => setCompleting(true)}
              className="text-success"
              title="تکمیل"
              aria-label="تکمیل فعالیت"
            >
              <CheckCircle2 size={16} />
            </button>
            <button
              onClick={() => cancel.mutate(activity.id)}
              className="text-danger"
              title="لغو"
              aria-label="لغو فعالیت"
            >
              <XCircle size={16} />
            </button>
          </div>
        )}
      </div>
      {completing && <CompleteForm activity={activity} onDone={() => setCompleting(false)} />}
    </div>
  );
}

export function ActivitiesPanel({ inquiryId }: { inquiryId: string }) {
  const { data: activities = [], isLoading } = useActivities({
    relatedEntityType: "inquiry",
    relatedEntityId: inquiryId,
  });
  const { create } = useActivityMutations();
  const { data: colleagues = [] } = useColleagues();

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    activityType: "follow_up",
    subject: "",
    assignedToUserId: "",
    dueAt: "",
  });

  const submit = () => {
    if (!form.subject.trim()) return;
    create.mutate(
      {
        activityType: form.activityType,
        subject: form.subject.trim(),
        relatedEntityType: "inquiry",
        relatedEntityId: inquiryId,
        assignedToUserId: form.assignedToUserId || undefined,
        dueAt: form.dueAt ? new Date(form.dueAt).toISOString() : undefined,
      },
      {
        onSuccess: () => {
          setForm({ activityType: "follow_up", subject: "", assignedToUserId: "", dueAt: "" });
          setShowForm(false);
        },
      },
    );
  };

  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-3.5">
        <p className="text-sm font-bold text-textPrimary tracking-tight flex items-center gap-1.5">
          <CalendarClock size={15} className="text-textSecondary" /> فعالیت‌ها
        </p>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="flex items-center gap-1 text-[11px] px-2.5 py-1.5 rounded-lg text-primary border border-primary/40 transition-all duration-150 hover:bg-primary/5 hover:border-primary"
        >
          <Plus size={12} /> فعالیت جدید
        </button>
      </div>

      {showForm && (
        <div className="rounded-xl bg-bg p-3.5 mb-3.5 space-y-2 animate-pop-in">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <select
              value={form.activityType}
              onChange={(e) => setForm((f) => ({ ...f, activityType: e.target.value }))}
              className="text-xs rounded-lg px-3 py-2 border border-border bg-surface shadow-xs transition-all duration-150 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              {Object.entries(ACTIVITY_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <select
              value={form.assignedToUserId}
              onChange={(e) => setForm((f) => ({ ...f, assignedToUserId: e.target.value }))}
              className="text-xs rounded-lg px-3 py-2 border border-border bg-surface shadow-xs transition-all duration-150 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              <option value="">مسئول: خودم</option>
              {colleagues.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName}
                </option>
              ))}
            </select>
          </div>
          <input
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            placeholder="موضوع فعالیت..."
            className="w-full text-xs rounded-lg px-3 py-2 border border-border bg-surface placeholder:text-textSecondary/60 shadow-xs transition-all duration-150 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={form.dueAt}
              onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))}
              className="flex-1 text-xs rounded-lg px-3 py-2 border border-border bg-surface shadow-xs transition-all duration-150 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <button
              onClick={submit}
              disabled={create.isPending}
              className="text-xs px-4 py-2 rounded-lg text-white bg-primary font-medium shadow-xs transition-all duration-150 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
            >
              افزودن
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-10 rounded-lg skeleton" />
          ))}
        </div>
      ) : activities.length === 0 ? (
        <p className="text-xs text-textSecondary py-3 text-center bg-bg rounded-lg">فعالیتی برای این پرونده ثبت نشده.</p>
      ) : (
        <div className="space-y-1.5">
          {activities.map((a) => (
            <ActivityRow key={a.id} activity={a} />
          ))}
        </div>
      )}
    </div>
  );
}
