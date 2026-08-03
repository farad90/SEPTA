import { useCallback, useState } from "react";
import Cropper, { Area, Point } from "react-easy-crop";
import { X } from "lucide-react";

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", (err) => reject(err));
    img.src = url;
  });
}

async function getCroppedBlob(imageSrc: string, area: Area): Promise<Blob> {
  const image = await loadImage(imageSrc);
  const canvas = document.createElement("canvas");
  canvas.width = area.width;
  canvas.height = area.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context not available");
  ctx.drawImage(image, area.x, area.y, area.width, area.height, 0, 0, area.width, area.height);
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("خطا در برش تصویر"))), "image/jpeg", 0.92);
  });
}

/**
 * Modal برش تصویر ۱:۱ بعد از انتخاب فایل — قبل از آپلود نهایی.
 * onConfirm فایل نهاییِ برش‌خورده (jpeg) رو برمی‌گردونه تا از همون uploadFile() موجود عبور کنه.
 * cropShape پیش‌فرض "round"ه (عکس پروفایل)؛ برای لوگوی شرکت (نمایش مربعی، نه دایره‌ای) "rect" پاس داده می‌شه.
 */
export function ImageCropModal({
  file,
  title,
  cropShape = "round",
  onCancel,
  onConfirm,
}: {
  file: File;
  title?: string;
  cropShape?: "round" | "rect";
  onCancel: () => void;
  onConfirm: (croppedFile: File) => void;
}) {
  const [imageSrc] = useState(() => URL.createObjectURL(file));
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [busy, setBusy] = useState(false);

  // Object URL رو دقیقاً همون لحظه‌ای که دیگه لازم نیست آزاد می‌کنیم (نه با useEffect cleanup —
  // چون در React StrictMode حالت توسعه، افکت‌ها دوبار mount/unmount می‌شن و URL زودتر از موعد باطل می‌شد)
  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  function cancel() {
    URL.revokeObjectURL(imageSrc);
    onCancel();
  }

  async function confirm() {
    if (!croppedAreaPixels) return;
    setBusy(true);
    try {
      const blob = await getCroppedBlob(imageSrc, croppedAreaPixels);
      URL.revokeObjectURL(imageSrc);
      onConfirm(new File([blob], "cropped-image.jpg", { type: "image/jpeg" }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="rounded-lg w-full max-w-md bg-surface p-4">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-textPrimary">{title ?? "برش عکس پروفایل"}</p>
          <button type="button" onClick={cancel} className="text-textSecondary hover:text-danger">
            <X size={16} />
          </button>
        </div>
        <div className="relative w-full h-72 rounded-lg overflow-hidden bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape={cropShape}
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        <input
          type="range"
          min={1}
          max={3}
          step={0.1}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full mt-3"
          aria-label="بزرگ‌نمایی"
        />
        <div className="flex gap-2 justify-end mt-3">
          <button
            type="button"
            onClick={cancel}
            className="text-xs px-3 py-2 rounded-lg text-textSecondary border border-border"
          >
            انصراف
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={busy || !croppedAreaPixels}
            className="text-xs px-4 py-2.5 rounded-lg text-white bg-primary font-medium disabled:opacity-60"
          >
            {busy ? "در حال پردازش..." : "تأیید و آپلود"}
          </button>
        </div>
      </div>
    </div>
  );
}
