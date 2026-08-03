import { useRef, useState } from "react";
import { ImageUp, Megaphone, Trash2 } from "lucide-react";
import { AuthImage } from "../../components/ui/AuthImage";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { Field, GhostButton, PrimaryButton, Select, TextArea } from "../../components/ui/fields";
import { uploadFile } from "../inquiries/inquiries-api";
import { useUsers, usePermissionGroups } from "../users/users-api";
import {
  BroadcastMessage,
  useBroadcastMessageMutations,
  useBroadcastMessages,
} from "./broadcast-messages-api";

type TargetType = "user" | "group" | "all";

function extractError(err: unknown) {
  const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data
    ?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? "خطا در ذخیره");
}

const TARGET_LABEL: Record<TargetType, string> = {
  user: "کاربر خاص",
  group: "گروه دسترسی خاص",
  all: "همه کاربران",
};

function targetSummary(b: BroadcastMessage) {
  if (b.targetType === "all") return "همه کاربران";
  if (b.targetType === "user") return `کاربر: ${b.targetUser?.fullName ?? "—"}`;
  return `گروه: ${b.targetGroup?.groupName ?? "—"}`;
}

function Composer({ onDone }: { onDone: () => void }) {
  const { create } = useBroadcastMessageMutations();
  const { data: users } = useUsers();
  const { data: groups } = usePermissionGroups();

  const [message, setMessage] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [targetType, setTargetType] = useState<TargetType>("all");
  const [targetUserId, setTargetUserId] = useState("");
  const [targetGroupId, setTargetGroupId] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canSubmit =
    message.trim().length > 0 &&
    (targetType === "all" ||
      (targetType === "user" && targetUserId) ||
      (targetType === "group" && targetGroupId));

  const handleSubmit = async () => {
    setError(null);
    try {
      await create.mutateAsync({
        message: message.trim(),
        imageUrl: imageUrl ?? undefined,
        targetType,
        targetUserId: targetType === "user" ? targetUserId : undefined,
        targetGroupId: targetType === "group" ? targetGroupId : undefined,
      });
      onDone();
    } catch (err) {
      setError(extractError(err));
    }
  };

  return (
    <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-4">
      <h3 className="text-sm font-bold text-textPrimary">پیام اعلامی جدید</h3>

      <div>
        <p className="text-xs font-medium mb-1.5 text-textPrimary">تصویر (اختیاری)</p>
        <p className="text-[11px] text-textSecondary mb-2">تصویر افقی/بنری پیشنهاد می‌شه.</p>
        {imageUrl ? (
          <div className="flex items-center gap-2">
            <AuthImage
              fileUrl={imageUrl}
              alt="پیش‌نمایش"
              className="w-32 h-20 rounded-lg object-cover border border-border"
            />
            <button type="button" onClick={() => setImageUrl(null)} className="text-danger" aria-label="حذف تصویر">
              <Trash2 size={14} />
            </button>
          </div>
        ) : (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                setUploading(true);
                try {
                  const stored = await uploadFile(file);
                  setImageUrl(stored.fileUrl);
                } finally {
                  setUploading(false);
                }
              }}
            />
            <GhostButton onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              <span className="flex items-center gap-1.5">
                <ImageUp size={13} /> {uploading ? "در حال بارگذاری..." : "بارگذاری تصویر"}
              </span>
            </GhostButton>
          </>
        )}
      </div>

      <Field label="متن پیام *">
        <TextArea value={message} onChange={(e) => setMessage(e.target.value)} rows={4} />
      </Field>

      <Field label="مخاطب پیام *">
        <Select value={targetType} onChange={(e) => setTargetType(e.target.value as TargetType)}>
          <option value="all">{TARGET_LABEL.all}</option>
          <option value="user">{TARGET_LABEL.user}</option>
          <option value="group">{TARGET_LABEL.group}</option>
        </Select>
      </Field>

      {targetType === "user" && (
        <Field label="کاربر">
          <Select value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)}>
            <option value="">— انتخاب کنید —</option>
            {(users ?? []).map((u) => (
              <option key={u.id} value={u.id}>
                {u.fullName}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {targetType === "group" && (
        <Field label="گروه دسترسی">
          <Select value={targetGroupId} onChange={(e) => setTargetGroupId(e.target.value)}>
            <option value="">— انتخاب کنید —</option>
            {(groups ?? []).map((g) => (
              <option key={g.id} value={g.id}>
                {g.groupName}
              </option>
            ))}
          </Select>
        </Field>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}

      <div className="flex gap-2 justify-end">
        <GhostButton onClick={onDone}>انصراف</GhostButton>
        <PrimaryButton disabled={!canSubmit || create.isPending} onClick={handleSubmit}>
          {create.isPending ? "در حال ارسال..." : "ارسال پیام"}
        </PrimaryButton>
      </div>
    </div>
  );
}

export function BroadcastMessagesPage() {
  const { data, isLoading, isError } = useBroadcastMessages();
  const { deactivate } = useBroadcastMessageMutations();
  const [showComposer, setShowComposer] = useState(false);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const messages = data ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-lg font-bold text-textPrimary">پیام‌های اعلامی</h1>
          <p className="text-xs text-textSecondary">
            پیامی که به محض ورود کاربر هدف به سامانه، یک‌بار نمایش داده می‌شه.
          </p>
        </div>
        {!showComposer && (
          <PrimaryButton onClick={() => setShowComposer(true)}>
            <span className="flex items-center gap-1.5">
              <Megaphone size={14} /> پیام جدید
            </span>
          </PrimaryButton>
        )}
      </div>

      {showComposer && <Composer onDone={() => setShowComposer(false)} />}

      {isLoading && <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>}
      {isError && (
        <p className="text-xs text-danger py-8 text-center">خطا در دریافت اطلاعات — اتصال به سرور رو بررسی کنید.</p>
      )}

      {!isLoading && !isError && (
        <div className="rounded-xl bg-surface border border-border shadow-card divide-y divide-border">
          {messages.length === 0 && (
            <p className="text-xs text-textSecondary p-8 text-center">پیامی ثبت نشده.</p>
          )}
          {messages.map((b) => (
            <div key={b.id} className="flex items-center gap-3 p-4">
              {b.imageUrl ? (
                <AuthImage
                  fileUrl={b.imageUrl}
                  alt=""
                  className="w-14 h-10 rounded-lg object-cover border border-border shrink-0"
                />
              ) : (
                <div className="w-14 h-10 rounded-lg bg-accentSoft text-accent flex items-center justify-center shrink-0">
                  <Megaphone size={16} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-textPrimary truncate">{b.message}</p>
                <p className="text-[10px] text-textSecondary mt-0.5">
                  {targetSummary(b)} · {b.creator?.fullName ?? "—"}
                </p>
              </div>
              {b.active ? (
                <GhostButton onClick={() => setConfirmingId(b.id)}>غیرفعال‌کردن</GhostButton>
              ) : (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-medium bg-border text-textSecondary shrink-0">
                  غیرفعال
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {confirmingId && (
        <ConfirmModal
          title="غیرفعال‌کردن پیام اعلامی"
          description="این پیام دیگه برای کاربرانی که هنوز ندیده‌ان نمایش داده نمی‌شه. مطمئنی؟"
          confirmLabel="بله، غیرفعال کن"
          busyLabel="در حال ثبت..."
          busy={deactivate.isPending}
          onCancel={() => setConfirmingId(null)}
          onConfirm={async () => {
            await deactivate.mutateAsync(confirmingId);
            setConfirmingId(null);
          }}
        />
      )}
    </div>
  );
}
