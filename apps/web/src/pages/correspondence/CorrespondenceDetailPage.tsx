import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  History,
  Paperclip,
  Tag,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import { useAuth } from "../../lib/auth-context";
import { hasPermission } from "../../lib/permissions";
import { formatJalali } from "../../lib/jalali";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { GhostButton, Select, TextInput } from "../../components/ui/fields";
import { uploadFile } from "../inquiries/inquiries-api";
import { FileViewer } from "../../components/ui/FileViewer";
import { useColleagues } from "../users/users-api";
import { useLetter, useLetterMutations } from "./correspondence-api";
import {
  CATEGORY_LABEL,
  PRIORITY_META,
  STATUS_META,
  TYPE_META,
  WORKFLOW_ACTION_LABEL,
} from "./correspondence-types";

function extractError(err: unknown, fallback: string): string {
  const message = (err as { response?: { data?: { message?: string | string[] } } } | null)?.response?.data
    ?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? fallback);
}

function Collapsible({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg overflow-hidden mb-3 bg-surface border border-border">
      <button type="button" onClick={onToggle} className="w-full flex items-center justify-between gap-2 px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-medium text-textPrimary">
          <span className="text-accent">{icon}</span> {title}
        </span>
        {open ? <ChevronUp size={16} className="text-textSecondary" /> : <ChevronDown size={16} className="text-textSecondary" />}
      </button>
      {open && <div className="px-4 pb-4 pt-3 border-t border-dashed border-border">{children}</div>}
    </div>
  );
}

function PartyLine({ label, party }: { label: string; party: { name: string; contactName?: string | null } | null }) {
  return (
    <div>
      <p className="text-[11px] text-textSecondary">{label}</p>
      <p className="text-sm text-textPrimary">{party ? `${party.name}${party.contactName ? " — " + party.contactName : ""}` : "—"}</p>
    </div>
  );
}

export function CorrespondenceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const canCreate = hasPermission(user, "correspondence.create");
  const canRegister = hasPermission(user, "correspondence.register");
  const canRefer = hasPermission(user, "correspondence.refer");
  const canArchive = hasPermission(user, "correspondence.archive");
  const canDelete = hasPermission(user, "correspondence.delete");

  const { data, isLoading } = useLetter(id);
  const { data: colleagues } = useColleagues();
  const mutations = useLetterMutations();

  const [expanded, setExpanded] = useState<string | null>("documents");
  const [showRefer, setShowRefer] = useState(false);
  const [referTo, setReferTo] = useState("");
  const [referNote, setReferNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isLoading || !data) {
    return <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>;
  }

  const typeMeta = TYPE_META[data.type];
  const statusMeta = STATUS_META[data.status];
  const priorityMeta = PRIORITY_META[data.priority];

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <button onClick={() => navigate("/correspondence")} className="flex items-center gap-2 mb-4 text-xs text-textSecondary">
        <ArrowRight size={18} /> بازگشت به لیست نامه‌ها
      </button>

      <div
        className={`rounded-lg p-4 mb-5 bg-surface border border-border border-r-4 ${
          data.type === "incoming" ? "border-r-primary" : data.type === "outgoing" ? "border-r-success" : "border-r-accent"
        }`}
      >
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${typeMeta.className}`}>{typeMeta.label}</span>
              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${statusMeta.className}`}>{statusMeta.label}</span>
              {data.priority !== "normal" && (
                <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${priorityMeta.className}`}>{priorityMeta.label}</span>
              )}
              {data.letterNumber && <span className="font-mono text-xs text-accent" dir="ltr">{data.letterNumber}</span>}
            </div>
            <h1 className="text-lg font-bold text-textPrimary">{data.subject}</h1>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
          <div>
            <p className="text-[11px] text-textSecondary">تاریخ نامه</p>
            <p className="font-mono text-sm text-textPrimary" dir="ltr">{formatJalali(data.letterDate)}</p>
          </div>
          {data.type === "internal" ? (
            <>
              <div>
                <p className="text-[11px] text-textSecondary">از بخش</p>
                <p className="text-sm text-textPrimary">{data.internalFromDepartment?.departmentName ?? "—"}</p>
              </div>
              <div>
                <p className="text-[11px] text-textSecondary">به بخش</p>
                <p className="text-sm text-textPrimary">{data.internalToDepartment?.departmentName ?? "—"}</p>
              </div>
            </>
          ) : (
            <>
              <PartyLine label="فرستنده" party={data.sender} />
              <PartyLine label="گیرنده" party={data.receiver} />
            </>
          )}
          {data.type === "incoming" ? (
            <>
              <div>
                <p className="text-[11px] text-textSecondary">شماره نامه فرستنده</p>
                <p className="font-mono text-sm text-textPrimary" dir="ltr">{data.senderReferenceNumber ?? "—"}</p>
              </div>
              <div>
                <p className="text-[11px] text-textSecondary">مسئول پیگیری</p>
                <p className="text-sm text-textPrimary">{data.responsibleUser?.fullName ?? "—"}</p>
              </div>
            </>
          ) : (
            <div>
              <p className="text-[11px] text-textSecondary">واحد مربوطه</p>
              <p className="text-sm text-textPrimary">{data.department ?? "—"}</p>
            </div>
          )}
          {data.type === "outgoing" && (
            <div className="sm:col-span-2">
              <p className="text-[11px] text-textSecondary">امضاکننده(ها)</p>
              <p className="text-sm text-textPrimary">
                {data.signers.length > 0 ? data.signers.map((s) => s.fullName).join("، ") : "—"}
              </p>
            </div>
          )}
          {data.relatedInquiry && (
            <div>
              <p className="text-[11px] text-textSecondary">پرونده مرتبط</p>
              <p className="font-mono text-sm text-primary" dir="ltr">{data.relatedInquiry.internalNumber}</p>
            </div>
          )}
          {data.relatedShipment && (
            <div>
              <p className="text-[11px] text-textSecondary">محموله مرتبط</p>
              <p className="font-mono text-sm text-primary" dir="ltr">{data.relatedShipment.shipmentNumber}</p>
            </div>
          )}
        </div>
        {data.description && (
          <p className="text-xs pt-2 border-t border-dashed border-border text-textSecondary">{data.description}</p>
        )}

        {error && <p className="text-xs text-danger mt-2">{error}</p>}

        {data.status === "draft" && canRegister && data.type === "outgoing" && (
          <p className="text-[11px] mt-2 text-textSecondary">
            برای نامه ارسالی، می‌تونی همین الان شماره رو بگیری و روی نامه‌ای که می‌نویسی درج کنی — سند نهایی رو بعداً هم می‌شه پیوست کرد.
          </p>
        )}
        <div className="flex flex-wrap gap-2 pt-3 mt-2 border-t border-dashed border-border">
          {data.status === "draft" && canRegister && (
            <button
              onClick={async () => {
                try {
                  setError(null);
                  await mutations.register.mutateAsync(data.id);
                } catch (err) {
                  setError(extractError(err, "خطا در ثبت رسمی"));
                }
              }}
              disabled={mutations.register.isPending}
              className="text-xs px-3 py-1.5 rounded-lg text-white bg-primary"
            >
              {mutations.register.isPending ? "در حال ثبت..." : "ثبت رسمی و صدور شماره"}
            </button>
          )}
          {canRefer && (
            <button
              onClick={() => setShowRefer(true)}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg text-accent border border-accent"
            >
              <User size={12} /> ارجاع به کارشناس
            </button>
          )}
          {data.status !== "archived" && canArchive && (
            <button
              onClick={async () => {
                try {
                  setError(null);
                  await mutations.workflowAction.mutateAsync({ id: data.id, action: "archived" });
                } catch (err) {
                  setError(extractError(err, "خطا در بایگانی"));
                }
              }}
              className="text-xs px-3 py-1.5 rounded-lg text-textSecondary border border-border"
            >
              بایگانی
            </button>
          )}
          {canDelete && (
            <button onClick={() => setConfirmDelete(true)} className="text-xs px-3 py-1.5 rounded-lg text-danger border border-danger">
              حذف نامه
            </button>
          )}
        </div>

        {showRefer && (
          <div className="rounded-lg p-3 mt-3 bg-bg">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2">
              <Select value={referTo} onChange={(e) => setReferTo(e.target.value)}>
                <option value="">انتخاب کارشناس...</option>
                {(colleagues ?? []).map((c) => (
                  <option key={c.id} value={c.id}>{c.fullName}</option>
                ))}
              </Select>
              <TextInput value={referNote} onChange={(e) => setReferNote(e.target.value)} placeholder="یادداشت ارجاع (اختیاری)" />
            </div>
            <div className="flex gap-2">
              <button
                disabled={!referTo || mutations.refer.isPending}
                onClick={async () => {
                  try {
                    setError(null);
                    await mutations.refer.mutateAsync({ id: data.id, referredToUserId: referTo, note: referNote.trim() || undefined });
                    setShowRefer(false);
                    setReferTo("");
                    setReferNote("");
                  } catch (err) {
                    setError(extractError(err, "خطا در ارجاع"));
                  }
                }}
                className="text-xs px-3 py-1.5 rounded-lg text-white bg-success disabled:opacity-60"
              >
                ارجاع
              </button>
              <GhostButton onClick={() => setShowRefer(false)}>انصراف</GhostButton>
            </div>
          </div>
        )}
      </div>

      <Collapsible
        title={`اسناد پیوست (${data.documents.length})`}
        icon={<Paperclip size={15} />}
        open={expanded === "documents"}
        onToggle={() => setExpanded(expanded === "documents" ? null : "documents")}
      >
        {canCreate && (
          <label className="rounded-lg p-6 text-center mb-3 border-2 border-dashed border-border bg-bg flex flex-col items-center cursor-pointer">
            <Upload size={20} className="mb-2 text-textSecondary" />
            <p className="text-xs text-textSecondary">{uploading ? "در حال آپلود..." : "فایل را انتخاب کن (PDF, JPG, PNG, Excel)"}</p>
            <input
              type="file"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setUploading(true);
                try {
                  const stored = await uploadFile(file);
                  await mutations.addDocument.mutateAsync({ letterId: data.id, fileUrl: stored.fileUrl, fileName: stored.fileName });
                } catch (err) {
                  setError(extractError(err, "خطا در آپلود سند"));
                } finally {
                  setUploading(false);
                  e.target.value = "";
                }
              }}
            />
          </label>
        )}
        <div className="space-y-1.5">
          {data.documents.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-lg px-3 py-2 text-xs bg-bg">
              <FileText size={14} className="text-accent" />
              <span className="text-textPrimary">{d.fileName}</span>
              <Select
                className="!w-auto !py-1 text-[11px]"
                value={d.category}
                onChange={(e) => mutations.updateDocument.mutate({ docId: d.id, letterId: data.id, category: e.target.value })}
                disabled={!canCreate}
              >
                {Object.entries(CATEGORY_LABEL).map(([key, label]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </Select>
              {d.tags.map((t) => (
                <span key={t} className="text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 bg-surface text-textSecondary border border-border">
                  <Tag size={9} /> {t}
                </span>
              ))}
              <span className="mr-auto">
                <FileViewer fileUrl={d.fileUrl} fileName={d.fileName} />
              </span>
              {canCreate && (
                <button onClick={() => mutations.deleteDocument.mutate({ docId: d.id, letterId: data.id })} className="text-danger">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
          {data.documents.length === 0 && <p className="text-xs text-textSecondary">هنوز سندی پیوست نشده.</p>}
        </div>
      </Collapsible>

      <Collapsible
        title="گردش کار نامه"
        icon={<History size={15} />}
        open={expanded === "workflow"}
        onToggle={() => setExpanded(expanded === "workflow" ? null : "workflow")}
      >
        <div className="space-y-2">
          {data.workflowLogs.map((w) => (
            <div key={w.id} className="flex items-center gap-3 text-xs">
              <div className="w-2 h-2 rounded-full shrink-0 bg-accent" />
              <span className="font-mono text-textSecondary" dir="ltr">{formatJalali(w.performedAt)}</span>
              <span className="text-textPrimary">
                {WORKFLOW_ACTION_LABEL[w.action] ?? w.action} — {w.performedBy}
                {w.referredToUser && <> ← ارجاع به <strong>{w.referredToUser}</strong></>}
              </span>
            </div>
          ))}
          {data.workflowLogs.length === 0 && <p className="text-xs text-textSecondary">هنوز اقدامی ثبت نشده.</p>}
        </div>
      </Collapsible>

      <Collapsible
        title="سابقه بازدید/ویرایش (Audit Log)"
        icon={<Eye size={15} />}
        open={expanded === "audit"}
        onToggle={() => setExpanded(expanded === "audit" ? null : "audit")}
      >
        <div className="space-y-1">
          {data.auditLogs.map((a) => (
            <p key={a.id} className="text-xs text-textSecondary">
              <span className="font-medium text-textPrimary">{a.user}</span> {a.action === "viewed" ? "مشاهده کرد" : "ویرایش کرد"} —{" "}
              <span className="font-mono" dir="ltr">{formatJalali(a.occurredAt)}</span>
            </p>
          ))}
          {data.auditLogs.length === 0 && <p className="text-xs text-textSecondary">هنوز کسی این نامه رو ندیده.</p>}
        </div>
      </Collapsible>

      {confirmDelete && (
        <ConfirmModal
          title={`حذف نامه «${data.subject}»`}
          busy={mutations.remove.isPending}
          onCancel={() => setConfirmDelete(false)}
          onConfirm={async () => {
            try {
              await mutations.remove.mutateAsync(data.id);
              navigate("/correspondence");
            } finally {
              setConfirmDelete(false);
            }
          }}
        />
      )}
    </div>
  );
}
