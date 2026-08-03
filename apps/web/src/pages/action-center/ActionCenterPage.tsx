import { useMemo, useState } from "react";
import { CheckCircle2, Inbox, UserRound } from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { formatJalaliDateTime } from "../../lib/jalali";
import {
  ACTION_KIND_LABELS,
  ActionItem,
  ActionKind,
  useActionCenter,
  useActionItemMutation,
} from "./action-center-api";
import {
  Bucket,
  BUCKET_LABEL,
  PRIORITY_COLOR,
  avatarColor,
  computeBucket,
  initials,
} from "../../components/work-panel/work-panel-shared";

type Scope = "mine" | "team";

const KIND_FILTER_ORDER: ActionKind[] = ["task", "follow_up", "approval", "reminder", "mention"];

function MiniAvatar({ name }: { name: string }) {
  return (
    <span
      className="w-5 h-5 rounded-full inline-flex items-center justify-center shrink-0 font-semibold text-white text-[9px]"
      style={{ background: avatarColor(name) }}
    >
      {initials(name)}
    </span>
  );
}

function SummaryTile({
  label,
  count,
  active,
  className,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  className: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl p-4 text-center border transition-all duration-150 ease-smooth hover:brightness-95 ${className} ${
        active ? "border-current shadow-xs" : "border-transparent"
      }`}
    >
      <span className="block text-2xl font-bold leading-tight tracking-tight">{count}</span>
      <span className="block text-xs mt-1 font-medium">{label}</span>
    </button>
  );
}

function ActionRow({ item, currentUserId }: { item: ActionItem; currentUserId?: string }) {
  const actionMutation = useActionItemMutation();
  const colors = PRIORITY_COLOR[item.priority];
  const bucket = computeBucket(item);
  const dueLabel = item.dueAt ? formatJalaliDateTime(item.dueAt) : "بدون سررسید";

  const content = (
    <div className="flex-1 min-w-0">
      <div className="flex items-start gap-2">
        <p className="text-sm font-semibold text-textPrimary flex-1 leading-snug">{item.title}</p>
        <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-bg text-textSecondary shrink-0">
          {ACTION_KIND_LABELS[item.kind]}
        </span>
      </div>
      {item.subtitle && <p className="text-xs text-textSecondary mt-1 truncate">{item.subtitle}</p>}
      <div className="flex items-center gap-2.5 flex-wrap mt-2 text-[11px] text-textSecondary">
        {item.ownerName && item.ownerId !== currentUserId && (
          <span className="flex items-center gap-1.5">
            <MiniAvatar name={item.ownerName} /> {item.ownerName}
          </span>
        )}
        <span className={`whitespace-nowrap ${bucket === "overdue" ? "text-danger font-semibold" : bucket === "today" ? "text-warning font-medium" : ""}`}>
          {dueLabel}
        </span>
      </div>
    </div>
  );

  return (
    <div className="flex gap-3 px-4 py-3.5 rounded-xl border border-border bg-surface shadow-card transition-all duration-150 ease-smooth hover:shadow-card-hover">
      <div className={`w-1 rounded-full shrink-0 ${colors.bar}`} />
      {content}
      {item.actions.length > 0 && (
        <div className="flex items-center gap-1.5 shrink-0 self-center">
          {item.actions.map((action) => (
            <button
              key={action.label}
              onClick={() => actionMutation.mutate(action)}
              disabled={actionMutation.isPending}
              className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-all duration-150 disabled:opacity-60 disabled:pointer-events-none ${
                action.label === "رد"
                  ? "border border-danger text-danger hover:bg-danger/10"
                  : "bg-primary text-white hover:brightness-110"
              }`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
      {item.linkPath && item.actions.length === 0 && (
        <a
          href={item.linkPath}
          className="text-xs text-primary font-medium shrink-0 self-center transition-colors duration-150 hover:brightness-110"
        >
          مشاهده
        </a>
      )}
    </div>
  );
}

export function ActionCenterPage() {
  const { user } = useAuth();
  const [scope, setScope] = useState<Scope>("mine");
  const [kind, setKind] = useState<"all" | ActionKind>("all");
  const [bucketFilter, setBucketFilter] = useState<Bucket | null>(null);

  const { data, isLoading, isError } = useActionCenter(scope);

  const filteredItems = useMemo(() => {
    let items = data?.items ?? [];
    if (kind !== "all") items = items.filter((i) => i.kind === kind);
    if (bucketFilter) items = items.filter((i) => computeBucket(i) === bucketFilter);
    return items;
  }, [data, kind, bucketFilter]);

  const summary = data?.summary ?? { overdue: 0, today: 0, thisWeek: 0, later: 0 };

  let lastBucket: Bucket | null = null;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryTile
          label={BUCKET_LABEL.overdue}
          count={summary.overdue}
          active={bucketFilter === "overdue"}
          className="text-danger bg-danger/10"
          onClick={() => setBucketFilter((c) => (c === "overdue" ? null : "overdue"))}
        />
        <SummaryTile
          label={BUCKET_LABEL.today}
          count={summary.today}
          active={bucketFilter === "today"}
          className="text-warning bg-warningSoft"
          onClick={() => setBucketFilter((c) => (c === "today" ? null : "today"))}
        />
        <SummaryTile
          label={BUCKET_LABEL.week}
          count={summary.thisWeek}
          active={bucketFilter === "week"}
          className="text-accent bg-accentSoft"
          onClick={() => setBucketFilter((c) => (c === "week" ? null : "week"))}
        />
        <SummaryTile
          label={BUCKET_LABEL.later}
          count={summary.later}
          active={bucketFilter === "later"}
          className="text-textSecondary bg-bg"
          onClick={() => setBucketFilter((c) => (c === "later" ? null : "later"))}
        />
      </div>

      <div className="flex items-center justify-between gap-3 flex-wrap p-3.5 rounded-xl bg-surface border border-border shadow-card">
        <div className="flex gap-1.5">
          {(
            [
              ["mine", "کارهای من", UserRound],
              ["team", "تیم", Inbox],
            ] as [Scope, string, typeof UserRound][]
          ).map(([s, label, Icon]) => (
            <button
              key={s}
              onClick={() => setScope(s)}
              className={`flex items-center gap-1.5 text-xs px-3.5 py-2 rounded-lg border transition-all duration-150 ease-smooth ${
                scope === s
                  ? "bg-primary border-primary text-white shadow-xs"
                  : "border-border text-textSecondary hover:border-textSecondary/40 hover:text-textPrimary"
              }`}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>

        <div className="flex gap-1.5 overflow-x-auto">
          <button
            onClick={() => setKind("all")}
            className={`text-[11px] px-3 py-1.5 rounded-full border whitespace-nowrap transition-all duration-150 shrink-0 ${
              kind === "all" ? "bg-textPrimary border-textPrimary text-surface" : "border-border text-textSecondary hover:border-textSecondary/40"
            }`}
          >
            همه
          </button>
          {KIND_FILTER_ORDER.map((k) => (
            <button
              key={k}
              onClick={() => setKind(k)}
              className={`text-[11px] px-3 py-1.5 rounded-full border whitespace-nowrap transition-all duration-150 shrink-0 ${
                kind === k ? "bg-textPrimary border-textPrimary text-surface" : "border-border text-textSecondary hover:border-textSecondary/40"
              }`}
            >
              {ACTION_KIND_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="space-y-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl skeleton" />
          ))}
        </div>
      )}

      {isError && (
        <div className="rounded-xl bg-surface border border-border shadow-card py-10 text-center">
          <p className="text-xs text-danger">خطا در دریافت اطلاعات — اتصال به سرور رو بررسی کنید.</p>
        </div>
      )}

      {!isLoading && !isError && filteredItems.length === 0 && (
        <div className="rounded-xl bg-surface border border-border shadow-card py-14 text-center">
          <div className="w-12 h-12 rounded-full bg-successSoft flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 size={20} className="text-success" />
          </div>
          <p className="text-xs text-textSecondary">کاری در این فیلتر نیست — همه‌چیز به‌روزه.</p>
        </div>
      )}

      {!isLoading && !isError && filteredItems.length > 0 && (
        <div className="space-y-2.5">
          {filteredItems.map((item) => {
            const b = computeBucket(item);
            const showHeader = b !== lastBucket;
            lastBucket = b;
            return (
              <div key={item.id}>
                {showHeader && (
                  <p className="text-xs font-bold text-textSecondary tracking-wide px-1 pt-2 pb-2">{BUCKET_LABEL[b]}</p>
                )}
                <ActionRow item={item} currentUserId={user?.id} />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
