import { useState } from "react";
import { Check, CheckCheck, FileText, Pencil, Trash2, X } from "lucide-react";
import { AuthImage } from "../../components/ui/AuthImage";
import { FilePreviewModal, isImageFile } from "../../components/ui/FileViewer";
import { ConfirmModal } from "../../components/ui/ConfirmModal";
import { clockTimeFa, relativeTimeFa } from "../../lib/relative-time";
import { isSticker, splitEmojiUnits } from "./sticker-set";
import { EmojiImage } from "./EmojiImage";
import { ReadStatus } from "./chat-shared";
import { ChatMessage, useChatMutations } from "./chat-api";

function AttachmentPreview({
  fileUrl,
  fileName,
  isImage,
}: {
  fileUrl: string;
  fileName: string;
  isImage: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {isImage ? (
        <div>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="block rounded-lg overflow-hidden cursor-zoom-in"
          >
            <AuthImage
              fileUrl={fileUrl}
              alt={fileName}
              className="block max-w-[240px] max-h-[300px] w-auto h-auto object-cover"
              style={{ minWidth: 140, minHeight: 100 }}
            />
          </button>
          {/* فاز ۳۰ — کپشن (یا نام فایل، وقتی کپشنی تایپ نشده) همیشه زیر تصویر نشون داده می‌شه */}
          <p className="text-xs px-2 pt-1 pb-0.5 break-words">{fileName}</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-black/10 hover:bg-black/15 max-w-[240px] text-right"
        >
          <FileText size={22} className="shrink-0" />
          <span className="truncate text-xs">{fileName}</span>
        </button>
      )}
      {open && <FilePreviewModal fileUrl={fileUrl} fileName={fileName} onClose={() => setOpen(false)} />}
    </>
  );
}

// فاز ۳۰ — یک پیام: استیکر بزرگ با گرافیک Twemoji، پیش‌نمایش درون‌خطی تصویر/فایل، حباب متنی،
// Read Receipt، ویرایش/حذف توسط خودِ فرستنده (Soft Delete با تومبستون مثل تلگرام)، و
// هایلایت اختیاری برای نتیجهٔ جست‌وجو
export function MessageBubble({
  message,
  isMe,
  showSenderName,
  readStatus,
  highlighted,
}: {
  message: ChatMessage;
  isMe: boolean;
  showSenderName: boolean;
  readStatus?: ReadStatus;
  highlighted?: boolean;
}) {
  const { editMessage, deleteMessage } = useChatMutations();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.messageText);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const deleted = !!message.deletedAt;
  const sticker = !deleted && isSticker(message.messageText, message.fileUrl);
  // فاز ۳۰ — تشخیص تصویری‌بودن از پسوند خودِ fileUrl، نه messageText؛ چون messageText حالا
  // می‌تونه یک کپشن دلخواه باشه (نه لزوماً نام فایل)، و کپشن هیچ پسوند قابل‌اتکایی نداره
  const isImageAttachment = message.fileUrl ? isImageFile(message.fileUrl) : false;

  const submitEdit = () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === message.messageText) {
      setEditing(false);
      return;
    }
    editMessage.mutate(
      { conversationId: message.conversationId, messageId: message.id, messageText: trimmed },
      { onSuccess: () => setEditing(false) },
    );
  };

  const confirmDelete = () => {
    deleteMessage.mutate(
      { conversationId: message.conversationId, messageId: message.id },
      { onSuccess: () => setConfirmingDelete(false) },
    );
  };

  return (
    <div id={`chat-msg-${message.id}`} className={`group flex ${isMe ? "justify-start" : "justify-end"}`}>
      <div className={`max-w-[70%] rounded-lg transition-shadow ${highlighted ? "ring-2 ring-accent" : ""}`}>
        {!isMe && showSenderName && (
          <p className="text-[11px] font-medium mb-0.5 px-1 text-accent">{message.sender.fullName}</p>
        )}

        {deleted ? (
          <div className="rounded-lg px-3 py-2 text-sm italic text-textSecondary border border-dashed border-border">
            این پیام حذف شد
          </div>
        ) : editing ? (
          <div
            className={`rounded-lg px-2 py-1.5 flex items-center gap-1 border border-accent ${
              isMe ? "bg-primary/10" : "bg-surface"
            }`}
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submitEdit();
                if (e.key === "Escape") setEditing(false);
              }}
              autoFocus
              className="flex-1 min-w-0 text-sm bg-transparent outline-none text-textPrimary"
            />
            <button onClick={submitEdit} aria-label="ذخیره ویرایش" className="text-accent shrink-0">
              <Check size={15} />
            </button>
            <button onClick={() => setEditing(false)} aria-label="انصراف از ویرایش" className="text-textSecondary shrink-0">
              <X size={15} />
            </button>
          </div>
        ) : sticker ? (
          <div className={`flex gap-1 ${isMe ? "justify-start" : "justify-end"}`}>
            {splitEmojiUnits(message.messageText).map((unit, i) => (
              <EmojiImage key={i} emoji={unit} size={56} />
            ))}
          </div>
        ) : message.fileUrl ? (
          <div
            className={`rounded-lg overflow-hidden ${isImageAttachment ? "" : "px-3 py-2"} text-sm ${
              isMe ? "bg-primary text-white" : "bg-surface text-textPrimary border border-border"
            }`}
          >
            <AttachmentPreview fileUrl={message.fileUrl} fileName={message.messageText} isImage={isImageAttachment} />
          </div>
        ) : (
          <div
            className={`rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
              isMe ? "bg-primary text-white" : "bg-surface text-textPrimary border border-border"
            }`}
          >
            {message.messageText}
          </div>
        )}

        {!deleted && !editing && (
          <div className={`flex items-center gap-1 mt-0.5 px-1 ${isMe ? "flex-row-reverse" : ""}`}>
            <p className="text-[10px] text-textSecondary">{relativeTimeFa(message.createdAt)}</p>
            {message.editedAt && <p className="text-[10px] text-textSecondary">(ویرایش‌شده)</p>}
            {isMe &&
              readStatus &&
              (readStatus.isRead ? (
                <CheckCheck size={12} className="text-accent shrink-0" />
              ) : (
                <Check size={12} className="text-textSecondary shrink-0" />
              ))}
            {isMe && (
              <span className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => {
                    setDraft(message.messageText);
                    setEditing(true);
                  }}
                  aria-label="ویرایش پیام"
                  title="ویرایش"
                  className="text-textSecondary hover:text-primary"
                >
                  <Pencil size={11} />
                </button>
                <button
                  onClick={() => setConfirmingDelete(true)}
                  aria-label="حذف پیام"
                  title="حذف"
                  className="text-textSecondary hover:text-danger"
                >
                  <Trash2 size={11} />
                </button>
              </span>
            )}
          </div>
        )}
        {!deleted && !editing && isMe && readStatus?.showLabel && readStatus.isRead && readStatus.readAt && (
          <p className={`text-[10px] text-accent px-1 ${isMe ? "text-left" : "text-right"}`}>
            خوانده شد · {clockTimeFa(readStatus.readAt)}
          </p>
        )}
      </div>

      {confirmingDelete && (
        <ConfirmModal
          title="حذف پیام"
          description="این پیام برای همه حذف می‌شه. مطمئنی؟"
          confirmLabel="بله، حذف کن"
          busyLabel="در حال حذف..."
          busy={deleteMessage.isPending}
          onConfirm={confirmDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}
    </div>
  );
}
