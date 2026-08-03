import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  AtSign,
  CheckCircle2,
  FileUp,
  MessageSquare,
  RefreshCw,
  Send,
} from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { formatJalaliDateTime } from "../../lib/jalali";
import { useColleagues } from "../users/users-api";
import { DiscussionEntry } from "./inquiry-types";
import { useDiscussions, useInquiryMutations } from "./inquiries-api";

const ACTIVITY_ICON: Record<string, React.ReactNode> = {
  file_upload: <FileUp size={13} />,
  status_change: <RefreshCw size={13} />,
  stage_completed: <CheckCircle2 size={13} />,
  approval: <CheckCircle2 size={13} />,
  technical_question: <MessageSquare size={13} />,
  general: <Activity size={13} />,
};

function AvatarCircle({ name }: { name: string }) {
  const colors = ["#1F3A5F", "#A9633B", "#2F7D5D", "#7B4B94", "#B98900"];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  const initials = name.trim().split(" ").slice(0, 2).map((w) => w[0]).join("");
  return (
    <div
      className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white text-[10px] font-semibold"
      style={{ background: colors[Math.abs(hash) % colors.length] }}
    >
      {initials}
    </div>
  );
}

function Entry({ entry }: { entry: DiscussionEntry }) {
  if (entry.entryType === "activity") {
    return (
      <div className="flex items-center gap-2.5 py-1.5">
        <div className="w-6 h-6 rounded-full bg-bg text-textSecondary flex items-center justify-center shrink-0 ring-1 ring-border">
          {ACTIVITY_ICON[entry.tag ?? "general"] ?? ACTIVITY_ICON.general}
        </div>
        <p className="text-[11px] text-textSecondary flex-1 min-w-0">
          <span className="font-medium text-textPrimary">{entry.author.fullName}</span> — {entry.commentText}
        </p>
        <span className="text-[10px] text-textSecondary/70 whitespace-nowrap">
          {formatJalaliDateTime(entry.createdAt)}
        </span>
      </div>
    );
  }

  return (
    <div className="flex gap-2.5 py-2.5">
      <AvatarCircle name={entry.author.fullName} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-textPrimary">{entry.author.fullName}</p>
          {entry.tag === "technical_question" && (
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-warningSoft text-warning font-medium">سوال فنی</span>
          )}
          <span className="text-[10px] text-textSecondary/70">{formatJalaliDateTime(entry.createdAt)}</span>
        </div>
        <div className="mt-1.5 rounded-xl rounded-tr-sm bg-bg border border-border/60 p-2.5 text-xs text-textPrimary whitespace-pre-wrap leading-relaxed">
          {entry.mentioned && (
            <span className="inline-flex items-center gap-0.5 text-primary font-medium ml-1">
              <AtSign size={11} />
              {entry.mentioned.fullName}
            </span>
          )}
          {entry.commentText}
        </div>
      </div>
    </div>
  );
}

export function ActivityFeed({ inquiryId }: { inquiryId: string }) {
  const { user } = useAuth();
  const { data: entries, isLoading } = useDiscussions(inquiryId);
  const { data: colleagues } = useColleagues();
  const { sendMessage } = useInquiryMutations();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  const [text, setText] = useState("");
  const [mentionId, setMentionId] = useState("");
  const [mentionName, setMentionName] = useState("");
  const [mentionQuery, setMentionQuery] = useState<string | null>(null); // null = بسته
  const [isTechnicalQuestion, setIsTechnicalQuestion] = useState(false);

  const mentionCandidates = useMemo(() => {
    if (mentionQuery === null) return [];
    const list = (colleagues ?? []).filter((c) => c.id !== user?.id);
    if (!mentionQuery) return list.slice(0, 6);
    return list.filter((c) => c.fullName.includes(mentionQuery)).slice(0, 6);
  }, [colleagues, mentionQuery, user?.id]);

  // فاز ۴۸ — اسکرول خودکار به آخرین پیام (لیست از قدیم به جدید مرتبه، پس یعنی انتهای لیست)
  const lastEntryId = entries?.[entries.length - 1]?.id;
  useEffect(() => {
    const container = feedRef.current;
    if (!container) return;
    container.scrollTop = container.scrollHeight;
  }, [entries?.length, lastEntryId]);

  function detectMentionQuery(value: string, cursor: number): string | null {
    const uptoCursor = value.slice(0, cursor);
    const at = uptoCursor.lastIndexOf("@");
    if (at === -1) return null;
    const between = uptoCursor.slice(at + 1);
    if (/\s/.test(between)) return null; // فاصله زده یعنی mention تموم شده
    return between;
  }

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value;
    setText(value);
    const cursor = e.target.selectionStart ?? value.length;
    setMentionQuery(detectMentionQuery(value, cursor));
    // اگر متن mention قبلی از پیام حذف شده، mentionId هم پاک بشه
    if (mentionName && !value.includes(`@${mentionName}`)) {
      setMentionId("");
      setMentionName("");
    }
  }

  function pickMention(colleague: { id: string; fullName: string }) {
    const textarea = textareaRef.current;
    const cursor = textarea?.selectionStart ?? text.length;
    const uptoCursor = text.slice(0, cursor);
    const at = uptoCursor.lastIndexOf("@");
    if (at === -1) return;
    const before = text.slice(0, at);
    const after = text.slice(cursor);
    const inserted = `${before}@${colleague.fullName} ${after}`;
    setText(inserted);
    setMentionId(colleague.id);
    setMentionName(colleague.fullName);
    setMentionQuery(null);
    requestAnimationFrame(() => {
      const pos = before.length + colleague.fullName.length + 2;
      textarea?.focus();
      textarea?.setSelectionRange(pos, pos);
    });
  }

  async function submit() {
    if (!text.trim()) return;
    await sendMessage.mutateAsync({
      inquiryId,
      commentText: text.trim(),
      mentionedUserId: mentionId || undefined,
      tag: isTechnicalQuestion ? "technical_question" : "general",
    });
    setText("");
    setMentionId("");
    setMentionName("");
    setMentionQuery(null);
    setIsTechnicalQuestion(false);
  }

  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-5">
      <h3 className="text-sm font-bold text-textPrimary tracking-tight mb-3.5">گفتگو و لاگ فعالیت پرونده</h3>

      {isLoading && (
        <div className="space-y-2 py-1 mb-4">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 rounded-lg skeleton" />
          ))}
        </div>
      )}

      <div ref={feedRef} className="max-h-[28rem] overflow-y-auto divide-y divide-border/60 mb-4">
        {(entries ?? []).length === 0 && !isLoading && (
          <p className="text-xs text-textSecondary py-6 text-center">هنوز فعالیتی ثبت نشده.</p>
        )}
        {(entries ?? []).map((entry) => (
          <Entry key={entry.id} entry={entry} />
        ))}
      </div>

      <div className="space-y-2.5 pt-1 border-t border-border">
        <div className="relative pt-2.5">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyUp={(e) => {
              const target = e.target as HTMLTextAreaElement;
              setMentionQuery(detectMentionQuery(target.value, target.selectionStart ?? target.value.length));
            }}
            onBlur={() => setTimeout(() => setMentionQuery(null), 150)}
            rows={2}
            placeholder="پیام برای همکاران درگیر در این پرونده... (برای Mention از @ استفاده کن)"
            className="w-full rounded-lg px-3 py-2.5 text-sm border border-border bg-surface text-textPrimary placeholder:text-textSecondary/60 shadow-xs transition-all duration-150 hover:border-textSecondary/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          {mentionQuery !== null && mentionCandidates.length > 0 && (
            <div className="absolute z-30 bottom-full mb-1.5 right-0 w-56 rounded-xl border border-border bg-surface shadow-dropdown py-1.5 max-h-44 overflow-y-auto origin-bottom-right animate-pop-in">
              {mentionCandidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pickMention(c)}
                  className="w-full flex items-center gap-2 px-3 py-1.5 text-right text-xs text-textPrimary transition-colors duration-150 hover:bg-bg"
                >
                  <AtSign size={11} className="text-primary shrink-0" />
                  {c.fullName}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <label className="flex items-center gap-1.5 text-[11px] text-textSecondary cursor-pointer">
            <input
              type="checkbox"
              className="w-3.5 h-3.5 accent-primary cursor-pointer"
              checked={isTechnicalQuestion}
              onChange={(e) => setIsTechnicalQuestion(e.target.checked)}
            />
            سوال فنی
          </label>
          <button
            onClick={submit}
            disabled={!text.trim() || sendMessage.isPending}
            className="mr-auto flex items-center gap-1.5 text-xs px-4 py-2.5 rounded-lg text-white bg-primary font-medium shadow-xs transition-all duration-150 hover:brightness-110 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
          >
            <Send size={13} />
            ارسال
          </button>
        </div>
      </div>
    </div>
  );
}
