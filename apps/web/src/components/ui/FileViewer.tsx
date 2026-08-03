import { useEffect, useState } from "react";
import { Download, Eye, Loader2, X } from "lucide-react";
import { apiClient } from "../../lib/api-client";
import { downloadFile } from "../../pages/inquiries/inquiries-api";

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp"];

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

/** تشخیص نوع MIME از پسوند نام فایل — چون بک‌اند Content-Type واقعی رو در پاسخ دانلود ست نمی‌کنه */
export function mimeFromExtension(name: string): string {
  const ext = extensionOf(name);
  switch (ext) {
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "pdf":
      return "application/pdf";
    default:
      return "application/octet-stream";
  }
}

function isPreviewable(name: string): boolean {
  const ext = extensionOf(name);
  return IMAGE_EXTENSIONS.includes(ext) || ext === "pdf";
}

/**
 * ⚠️ فاز ۳۹: تشخیص نوع فایل (برای پیش‌نمایش/MIME) همیشه باید از پسوند واقعی fileUrl (مسیر ذخیره‌شده)
 * باشه، نه از fileName نمایشی — چون در چند جای برنامه fileName یک برچسب فارسی ثابت بدون پسوند است
 * (مثلاً «فایل پیشنهاد»، «فایل قرارداد»)، و اگه پسوند از همون رشته استخراج بشه، PDF/تصویر واقعی
 * هیچ‌وقت previewable تشخیص داده نمی‌شه.
 */
function extensionFromUrl(fileUrl: string): string {
  return extensionOf(fileUrl.split("/").pop() ?? fileUrl);
}

/** نام پیشنهادی دانلود: اگه fileName نمایشی پسوند نداشت، پسوند واقعی fileUrl بهش اضافه می‌شه */
export function resolveDownloadName(fileUrl: string, fileName: string): string {
  if (extensionOf(fileName)) return fileName;
  const urlExt = extensionFromUrl(fileUrl);
  return urlExt ? `${fileName}.${urlExt}` : fileName;
}

/** فاز ۲۹ — تشخیص فایل تصویری برای پیش‌نمایش درون‌خطی در حباب چت (مثل تلگرام) */
export function isImageFile(name: string): boolean {
  return IMAGE_EXTENSIONS.includes(extensionOf(name));
}

/**
 * آیکون چشم (پیش‌نمایش داخل برنامه) + آیکون دانلود، برای هر مدرک/فایل ضمیمه‌ای در سامانه.
 * برای تصاویر همیشه‌نمایان (لوگو/آواتار) به‌جای این، AuthImage استفاده می‌شه.
 */
export function FileViewer({
  fileUrl,
  fileName,
  className,
}: {
  fileUrl: string;
  fileName?: string | null;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const name = resolveDownloadName(fileUrl, fileName ?? fileUrl.split("/").pop() ?? fileUrl);

  return (
    <>
      <span className={`inline-flex items-center gap-1 ${className ?? ""}`}>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="p-1.5 rounded-lg text-textSecondary hover:text-primary hover:bg-bg"
          aria-label="پیش‌نمایش فایل"
          title="پیش‌نمایش"
        >
          <Eye size={15} />
        </button>
        <button
          type="button"
          onClick={() => downloadFile(fileUrl, name)}
          className="p-1.5 rounded-lg text-textSecondary hover:text-primary hover:bg-bg"
          aria-label="دانلود فایل"
          title="دانلود"
        >
          <Download size={15} />
        </button>
      </span>
      {open && <FilePreviewModal fileUrl={fileUrl} fileName={name} onClose={() => setOpen(false)} />}
    </>
  );
}

/** فاز ۲۹ — export شد تا حباب‌های چت (تصویر/فایل) هم بتونن مستقیم از همین لایت‌باکس استفاده کنن */
export function FilePreviewModal({
  fileUrl,
  fileName,
  onClose,
}: {
  fileUrl: string;
  fileName: string;
  onClose: () => void;
}) {
  const [blobSrc, setBlobSrc] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  // پسوند همیشه از fileUrl واقعی مشتق می‌شه (نه از fileName نمایشی که ممکنه یک برچسب ثابت بدون پسوند باشه)
  const resolvedName = resolveDownloadName(fileUrl, fileName);
  const previewable = isPreviewable(resolvedName);
  const mime = mimeFromExtension(resolvedName);

  useEffect(() => {
    if (!previewable) return;
    let cancelled = false;
    let objectUrl: string | null = null;
    apiClient
      .get(`/files/${fileUrl}`, { responseType: "blob" })
      .then(({ data }) => {
        // نوع Blob رو از پسوند دستی ست می‌کنیم چون پاسخ سرور Content-Type واقعی نداره
        const typed = new Blob([data], { type: mime });
        objectUrl = URL.createObjectURL(typed);
        if (!cancelled) setBlobSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileUrl]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="rounded-lg w-full max-w-3xl h-[85vh] flex flex-col bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="text-xs font-medium text-textPrimary truncate">{fileName}</p>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => downloadFile(fileUrl, resolvedName)}
              className="p-1.5 rounded-lg text-textSecondary hover:text-primary hover:bg-bg"
              aria-label="دانلود فایل"
              title="دانلود"
            >
              <Download size={16} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-textSecondary hover:text-danger hover:bg-bg"
              aria-label="بستن"
            >
              <X size={16} />
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 overflow-auto flex items-center justify-center p-3">
          {!previewable ? (
            <div className="text-center text-textSecondary text-xs px-6">
              <p className="mb-3">این نوع فایل قابل پیش‌نمایش داخل برنامه نیست.</p>
              <button
                type="button"
                onClick={() => downloadFile(fileUrl, resolvedName)}
                className="text-xs px-4 py-2.5 rounded-lg text-white bg-primary font-medium"
              >
                دانلود فایل
              </button>
            </div>
          ) : failed ? (
            <p className="text-xs text-danger">خطا در بارگذاری فایل</p>
          ) : !blobSrc ? (
            <Loader2 size={22} className="animate-spin text-textSecondary" />
          ) : mime.startsWith("image/") ? (
            <img src={blobSrc} alt={fileName} className="max-w-full max-h-full object-contain" />
          ) : (
            <iframe src={blobSrc} title={fileName} className="w-full h-full border-0" />
          )}
        </div>
      </div>
    </div>
  );
}
