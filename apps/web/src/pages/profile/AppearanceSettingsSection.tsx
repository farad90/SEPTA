import { Check } from "lucide-react";
import { useAppearance } from "../../lib/appearance-context";
import { FONT_FAMILY_OPTIONS, FONT_SIZE_OPTIONS, PALETTE_OPTIONS } from "../../lib/appearance-palettes";
import { Toggle } from "../../components/ui/Toggle";

export function AppearanceSettingsSection() {
  const { palette, darkMode, fontSize, fontFamily, setPalette, setDarkMode, setFontSize, setFontFamily } =
    useAppearance();

  return (
    <div className="rounded-lg p-5 bg-surface border border-border">
      <p className="text-sm font-semibold mb-1 text-textPrimary">ظاهر و نمایش</p>
      <p className="text-xs mb-5 text-textSecondary">
        این تنظیمات فقط روی همین مرورگر ذخیره می‌شه و روی سایر کاربران یا دستگاه‌های دیگه اثری نداره.
      </p>

      <p className="text-xs font-medium mb-2.5 text-textPrimary">پالت رنگی</p>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 mb-6">
        {PALETTE_OPTIONS.map((opt) => {
          const active = opt.key === palette;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setPalette(opt.key)}
              className={`relative rounded-lg p-3 border text-right transition-colors ${
                active ? "border-primary" : "border-border"
              }`}
              style={{ backgroundColor: opt.swatch.bg }}
            >
              {active && (
                <span className="absolute top-1.5 left-1.5 w-4 h-4 rounded-full flex items-center justify-center text-white bg-primary">
                  <Check size={11} />
                </span>
              )}
              <div className="flex gap-1 mb-2">
                <span className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: opt.swatch.primary }} />
                <span className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: opt.swatch.accent }} />
              </div>
              <span className="text-[11px] font-medium" style={{ color: opt.swatch.primary }}>
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>

      <p className="text-xs font-medium mb-2.5 text-textPrimary">فونت</p>
      <p className="text-[11px] mb-2.5 text-textSecondary">
        فونت مستقل از پالت رنگیه — هر پالتی رو می‌تونید با هر فونتی امتحان کنید.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mb-6">
        {FONT_FAMILY_OPTIONS.map((opt) => {
          const active = opt.key === fontFamily;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setFontFamily(opt.key)}
              className={`relative rounded-lg p-3 border text-right transition-colors bg-bg ${
                active ? "border-primary" : "border-border"
              }`}
            >
              {active && (
                <span className="absolute top-1.5 left-1.5 w-4 h-4 rounded-full flex items-center justify-center text-white bg-primary">
                  <Check size={11} />
                </span>
              )}
              <span className="block text-[11px] font-medium mb-1 text-textSecondary">{opt.label}</span>
              <span className="block text-sm text-textPrimary" style={{ fontFamily: opt.stack }}>
                نمونه متن فارسی ۱۲۳۴
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-6">
        <Toggle checked={darkMode} onChange={setDarkMode} label="حالت تاریک (Dark Mode)" />
      </div>

      <p className="text-xs font-medium mb-2.5 text-textPrimary">سایز فونت</p>
      <div className="flex rounded-lg border border-border overflow-hidden w-fit">
        {FONT_SIZE_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setFontSize(opt.key)}
            className={`px-4 py-2 text-xs transition-colors ${
              fontSize === opt.key ? "bg-primary text-white" : "bg-surface text-textSecondary"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
