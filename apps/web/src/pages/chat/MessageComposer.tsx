import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { FileText, Paperclip, Send, Smile, X } from "lucide-react";
import { useClickOutside } from "../../lib/use-click-outside";
import { uploadFile } from "../inquiries/inquiries-api";
import { EMOJI_CATEGORIES } from "./sticker-set";
import { EmojiImage } from "./EmojiImage";

export interface MessageComposerHandle {
  addFiles: (files: File[]) => void;
}

interface PendingFile {
  file: File;
  previewUrl: string | null;
}

function isImage(file: File): boolean {
  return file.type.startsWith("image/");
}

// فاز ۳۰ — کادر ارسال پیام مشترک بین صفحهٔ کامل چت و ویجت شناور:
// متن + دکمهٔ پیوست (📎، چندفایلی) + پیکر ایموجی Twemoji + پشتیبانی Drag & Drop (از طریق
// addFiles روی ref، والد کانتینر بزرگ‌تری رو Drop-Zone می‌کنه) + پیش‌نمایش/کپشن مثل تلگرام:
// فایل انتخاب‌شده بلافاصله آپلود/ارسال نمی‌شه، اول در یک نوار پیش‌نمایش با امکان افزودن
// کپشن نشون داده می‌شه و فقط با زدن دکمهٔ ارسال واقعاً می‌ره
export const MessageComposer = forwardRef<MessageComposerHandle, {
  onSend: (body: { messageText?: string; fileUrl?: string }) => void;
  compact?: boolean;
}>(function MessageComposer({ onSend, compact = false }, ref) {
  const [text, setText] = useState("");
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [activeCategory, setActiveCategory] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const emojiRef = useRef<HTMLDivElement>(null);
  useClickOutside(emojiRef, () => setShowEmoji(false));

  useEffect(() => {
    return () => {
      pendingFiles.forEach((pf) => pf.previewUrl && URL.revokeObjectURL(pf.previewUrl));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const addFiles = (files: File[]) => {
    if (files.length === 0) return;
    setPendingFiles((prev) => [
      ...prev,
      ...files.map((file) => ({ file, previewUrl: isImage(file) ? URL.createObjectURL(file) : null })),
    ]);
  };

  useImperativeHandle(ref, () => ({ addFiles }), []);

  const removeFile = (index: number) => {
    setPendingFiles((prev) => {
      const target = prev[index];
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  };

  const sendStaged = async () => {
    const caption = text.trim();
    const files = pendingFiles;
    setUploading(true);
    try {
      for (const pf of files) {
        const stored = await uploadFile(pf.file);
        onSend({ messageText: caption || stored.fileName, fileUrl: stored.fileUrl });
      }
    } finally {
      files.forEach((pf) => pf.previewUrl && URL.revokeObjectURL(pf.previewUrl));
      setPendingFiles([]);
      setText("");
      setUploading(false);
    }
  };

  const sendText = () => {
    if (pendingFiles.length > 0) {
      sendStaged();
      return;
    }
    if (!text.trim()) return;
    onSend({ messageText: text.trim() });
    setText("");
  };

  const insertEmoji = (emoji: string) => {
    const el = inputRef.current;
    if (el && document.activeElement === el) {
      const start = el.selectionStart ?? text.length;
      const end = el.selectionEnd ?? text.length;
      const next = text.slice(0, start) + emoji + text.slice(end);
      setText(next);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + emoji.length, start + emoji.length);
      });
    } else {
      setText((t) => t + emoji);
    }
  };

  const hasPending = pendingFiles.length > 0;

  return (
    <div className={`border-t border-border bg-surface ${compact ? "p-2" : "p-3"}`}>
      {hasPending && (
        <div className="flex items-center gap-2 pb-2 overflow-x-auto">
          {pendingFiles.map((pf, i) => (
            <div key={i} className="relative shrink-0">
              {pf.previewUrl ? (
                <img src={pf.previewUrl} alt={pf.file.name} className="w-14 h-14 object-cover rounded-lg" />
              ) : (
                <div className="w-14 h-14 rounded-lg bg-bg border border-border flex flex-col items-center justify-center px-1 gap-0.5">
                  <FileText size={16} className="text-textSecondary" />
                  <span className="text-[8px] truncate w-full text-center text-textSecondary">{pf.file.name}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeFile(i)}
                aria-label="حذف پیوست"
                className="absolute -top-1.5 -left-1.5 w-4 h-4 rounded-full bg-danger text-white flex items-center justify-center"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-1.5">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            addFiles(Array.from(e.target.files ?? []));
            e.target.value = "";
          }}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="p-2 rounded-lg text-textSecondary hover:text-primary shrink-0 disabled:opacity-50"
          aria-label="افزودن پیوست"
          title="پیوست فایل"
        >
          <Paperclip size={16} />
        </button>

        <div className="relative shrink-0" ref={emojiRef}>
          <button
            onClick={() => setShowEmoji((s) => !s)}
            className={`p-2 rounded-lg hover:text-primary ${showEmoji ? "text-primary" : "text-textSecondary"}`}
            aria-label="ایموجی"
            title="ایموجی و استیکر"
          >
            <Smile size={16} />
          </button>
          {showEmoji && (
            <div className="absolute bottom-full mb-2 right-0 w-72 rounded-xl bg-surface border border-border shadow-card shadow-xl z-20 overflow-hidden">
              <div className="flex border-b border-border">
                {EMOJI_CATEGORIES.map((cat, i) => (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => setActiveCategory(i)}
                    title={cat.label}
                    className={`flex-1 flex items-center justify-center py-1.5 ${
                      activeCategory === i ? "bg-accentSoft" : "hover:bg-bg"
                    }`}
                  >
                    <EmojiImage emoji={cat.icon} size={18} />
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5 p-2 max-h-48 overflow-y-auto">
                {EMOJI_CATEGORIES[activeCategory].emojis.map((em) => (
                  <button
                    key={em}
                    type="button"
                    onClick={() => insertEmoji(em)}
                    className="flex items-center justify-center p-1.5 rounded hover:bg-bg"
                  >
                    <EmojiImage emoji={em} size={26} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && sendText()}
          placeholder={uploading ? "در حال آپلود..." : hasPending ? "افزودن توضیح (اختیاری)..." : "پیام بنویس..."}
          disabled={uploading}
          className="flex-1 min-w-0 text-sm rounded-lg px-3 py-2 border border-border disabled:opacity-60"
        />
        <button
          onClick={sendText}
          disabled={uploading || (!hasPending && !text.trim())}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white bg-primary disabled:opacity-50 shrink-0"
          aria-label="ارسال"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
});
