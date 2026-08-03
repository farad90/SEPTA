import { LucideIcon } from "lucide-react";

/** جای‌نگه‌دار ماژول‌های فازهای بعدی — الگوی PlaceholderPage در app-shell-mockup */
export function PlaceholderPage({ title, icon: Icon, note }: { title: string; icon: LucideIcon; note: string }) {
  return (
    <div>
      <h1 className="text-xl font-bold mb-1 text-textPrimary">{title}</h1>
      <p className="text-xs mb-6 text-textSecondary">{note}</p>
      <div className="rounded-lg p-10 text-center bg-surface border border-dashed border-border">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 bg-accentSoft text-accent">
          <Icon size={22} />
        </div>
        <p className="text-sm text-textSecondary">
          این ماژول در فاز مربوط به خودش پیاده‌سازی می‌شه — اینجا فقط جایگاهش در ناوبری اصلیه.
        </p>
      </div>
    </div>
  );
}
