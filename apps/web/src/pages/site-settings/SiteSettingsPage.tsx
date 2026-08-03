import { useRef, useState } from "react";
import { Image as ImageIcon, ImageUp, Trash2 } from "lucide-react";
import { GhostButton, PrimaryButton } from "../../components/ui/fields";
import { API_URL } from "../../lib/api-client";
import { uploadFile } from "../inquiries/inquiries-api";
import { useSiteSettings, useUpdateLoginBackground } from "./site-settings-api";

function extractError(err: unknown) {
  const message = (err as { response?: { data?: { message?: string | string[] } } }).response?.data
    ?.message;
  return Array.isArray(message) ? message.join("، ") : (message ?? "خطا در ذخیره");
}

export function SiteSettingsPage() {
  const { data: settings, isLoading } = useSiteSettings();
  const updateBackground = useUpdateLoginBackground();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasBackground = Boolean(settings?.loginBackgroundUrl);
  const previewSrc = hasBackground
    ? `${API_URL}/public/login-background?t=${encodeURIComponent(settings!.updatedAt)}`
    : null;

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    setUploading(true);
    try {
      const stored = await uploadFile(file);
      await updateBackground.mutateAsync(stored.fileUrl);
    } catch (err) {
      setError(extractError(err));
    } finally {
      setUploading(false);
    }
  };

  const handleRestoreDefault = async () => {
    setError(null);
    try {
      await updateBackground.mutateAsync(null);
    } catch (err) {
      setError(extractError(err));
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-bold text-textPrimary">تنظیمات سامانه</h1>
        <p className="text-xs text-textSecondary">مدیریت تصویر پس‌زمینه صفحه ورود.</p>
      </div>

      <div className="rounded-xl bg-surface border border-border shadow-card p-5 space-y-4">
        <div>
          <h2 className="text-sm font-bold text-textPrimary">پس‌زمینه صفحه ورود</h2>
          <p className="text-[11px] text-textSecondary mt-1">
            این تصویر پشت پنل معرفی سامانه در صفحه ورود (قبل از لاگین) نمایش داده می‌شه. تصویر عمودی/بلند
            پیشنهاد می‌شه.
          </p>
        </div>

        {isLoading ? (
          <div className="py-3 space-y-2">{[0, 1, 2].map((i) => (<div key={i} className="h-10 rounded-lg skeleton" />))}</div>
        ) : (
          <div className="flex items-start gap-4 flex-wrap">
            <div className="w-48 h-64 rounded-lg border border-border bg-bg flex items-center justify-center overflow-hidden shrink-0">
              {previewSrc ? (
                <img src={previewSrc} alt="پس‌زمینه صفحه ورود" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon size={28} className="text-textSecondary" />
              )}
            </div>

            <div className="space-y-2">
              <input
                ref={fileInputRef}
                type="file"
                accept=".png,.jpg,.jpeg,.webp"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  handleFileChange(file);
                  e.target.value = "";
                }}
              />
              <div className="flex gap-2">
                <PrimaryButton onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <span className="flex items-center gap-1.5">
                    <ImageUp size={14} /> {uploading ? "در حال بارگذاری..." : "بارگذاری تصویر جدید"}
                  </span>
                </PrimaryButton>
                {hasBackground && (
                  <GhostButton onClick={handleRestoreDefault} disabled={updateBackground.isPending}>
                    <span className="flex items-center gap-1.5 text-danger">
                      <Trash2 size={13} /> بازگردانی پیش‌فرض
                    </span>
                  </GhostButton>
                )}
              </div>
              {error && <p className="text-xs text-danger">{error}</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
