import { useRef, useState } from "react";
import { FileUp, Loader2 } from "lucide-react";
import { uploadFile } from "../../pages/inquiries/inquiries-api";

export interface UploadedFileRef {
  fileUrl: string;
  fileName: string;
}

/**
 * ناحیه‌ی آپلود فایل با Drag & Drop — الگوی dragCounter از ChatPage.tsx، دور تابع
 * مشترک uploadFile() پیچیده شده. چندفایلی پیش‌فرضه؛ برای تک‌فایلی multiple=false بده.
 */
export function FileDropZone({
  onFilesUploaded,
  multiple = true,
  disabled = false,
  accept,
  label = "فایل را بکشید و رها کنید یا کلیک کنید",
  compact = false,
  folder,
}: {
  onFilesUploaded: (files: UploadedFileRef[]) => void;
  multiple?: boolean;
  disabled?: boolean;
  accept?: string;
  label?: string;
  compact?: boolean;
  /** فاز ۴۹ — پوشه‌ی ذخیره‌سازی روی سرور (معمولاً شماره داخلی استعلام) */
  folder?: string;
}) {
  const [dragActive, setDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const dragCounter = useRef(0);

  async function handleFiles(fileList: FileList | File[]) {
    const files = Array.from(fileList);
    if (files.length === 0) return;
    setUploading(true);
    setProgress(0);
    try {
      const uploaded: UploadedFileRef[] = [];
      for (const file of multiple ? files : files.slice(0, 1)) {
        const stored = await uploadFile(file, (percent) => setProgress(percent), folder);
        uploaded.push(stored);
      }
      onFilesUploaded(uploaded);
    } finally {
      setUploading(false);
      setProgress(0);
    }
  }

  function onDragEnter(e: React.DragEvent) {
    e.preventDefault();
    if (disabled || uploading) return;
    if (e.dataTransfer.types.includes("Files")) {
      dragCounter.current += 1;
      setDragActive(true);
    }
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) setDragActive(false);
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    dragCounter.current = 0;
    setDragActive(false);
    if (disabled || uploading) return;
    handleFiles(e.dataTransfer.files);
  }

  return (
    <label
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`flex items-center justify-center gap-2 rounded-lg border border-dashed cursor-pointer transition-colors ${
        compact ? "px-2 py-1.5 text-[10px]" : "px-4 py-6 text-xs"
      } ${
        dragActive
          ? "border-primary bg-accentSoft text-primary"
          : "border-border text-textSecondary hover:border-primary hover:text-primary"
      } ${disabled || uploading ? "opacity-60 pointer-events-none" : ""}`}
    >
      {uploading ? (
        <>
          <Loader2 size={compact ? 11 : 14} className="animate-spin" />
          {progress > 0 ? `در حال بارگذاری (${progress}%)` : "در حال بارگذاری..."}
        </>
      ) : (
        <>
          <FileUp size={compact ? 11 : 14} />
          {label}
        </>
      )}
      <input
        type="file"
        multiple={multiple}
        accept={accept}
        disabled={disabled || uploading}
        className="hidden"
        onChange={(e) => {
          if (e.target.files) handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );
}
