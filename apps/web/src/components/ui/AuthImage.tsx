import { CSSProperties, useEffect, useState } from "react";
import { apiClient } from "../../lib/api-client";

// دانلود فایل‌ها پشت JWT است؛ <img src> مستقیم نمی‌تونه هدر بفرسته —
// این کامپوننت Blob رو با axios می‌گیره و Object URL می‌سازه (با کش ساده)
const cache = new Map<string, string>();

export function AuthImage({
  fileUrl,
  alt,
  className,
  style,
}: {
  fileUrl: string;
  alt: string;
  className?: string;
  style?: CSSProperties;
}) {
  const [src, setSrc] = useState<string | null>(cache.get(fileUrl) ?? null);

  useEffect(() => {
    if (cache.has(fileUrl)) {
      setSrc(cache.get(fileUrl)!);
      return;
    }
    let cancelled = false;
    apiClient
      .get(`/files/${fileUrl}`, { responseType: "blob" })
      .then(({ data }) => {
        const url = URL.createObjectURL(data);
        cache.set(fileUrl, url);
        if (!cancelled) setSrc(url);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });
    return () => {
      cancelled = true;
    };
  }, [fileUrl]);

  if (!src) {
    return <div className={`bg-bg animate-pulse ${className ?? ""}`} style={style} aria-label={alt} />;
  }
  return <img src={src} alt={alt} className={className} style={style} />;
}
