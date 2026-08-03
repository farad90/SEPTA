/** پرایمیتیوهای سبک نمودار — بدون کتابخانه خارجی، صرفاً SVG/CSS، هم‌رنگ با توکن‌های طراحی سامانه */

const TONE_VAR: Record<string, string> = {
  primary: "--color-primary",
  accent: "--color-accent",
  success: "--color-success",
  danger: "--color-danger",
  warning: "--color-warning",
  textSecondary: "--color-textSecondary",
};

export function ProgressRing({
  value,
  size = 88,
  strokeWidth = 9,
  label,
  tone = "primary",
}: {
  value: number | null;
  size?: number;
  strokeWidth?: number;
  label?: string;
  tone?: keyof typeof TONE_VAR;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  const dash = (pct / 100) * circumference;
  const colorVar = TONE_VAR[tone] ?? TONE_VAR.primary;

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          stroke={`rgb(var(--color-border))`}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          stroke={`rgb(var(${colorVar}))`}
          className="transition-all duration-700 ease-smooth"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-bold text-textPrimary" dir="ltr">
          {value != null ? `${value.toFixed(0)}%` : "—"}
        </span>
        {label && <span className="text-[9px] text-textSecondary mt-0.5 text-center px-1">{label}</span>}
      </div>
    </div>
  );
}

export interface BarItem {
  label: string;
  value: number;
  displayValue?: string;
  tone?: keyof typeof TONE_VAR;
}

export function HorizontalBars({ items, dense = false }: { items: BarItem[]; dense?: boolean }) {
  const max = Math.max(1, ...items.map((i) => Math.abs(i.value)));
  return (
    <div className={dense ? "space-y-2" : "space-y-2.5"}>
      {items.map((item) => {
        const colorVar = TONE_VAR[item.tone ?? "primary"] ?? TONE_VAR.primary;
        return (
          <div key={item.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] text-textSecondary">{item.label}</span>
              <span className="text-[11px] font-semibold text-textPrimary font-mono" dir="ltr">
                {item.displayValue ?? item.value.toLocaleString("en-US")}
              </span>
            </div>
            <div className={`${dense ? "h-1.5" : "h-2"} rounded-full bg-bg overflow-hidden`}>
              <div
                className="h-full rounded-full transition-all duration-500 ease-smooth"
                style={{
                  width: `${(Math.abs(item.value) / max) * 100}%`,
                  backgroundColor: `rgb(var(${colorVar}))`,
                }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function KpiTile({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: string | number;
  tone?: "success" | "danger" | "warning" | "accent";
  icon?: React.ReactNode;
}) {
  const toneClass =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-danger"
        : tone === "warning"
          ? "text-warning"
          : tone === "accent"
            ? "text-accent"
            : "text-textPrimary";
  return (
    <div className="rounded-xl p-3.5 bg-surface border border-border shadow-card transition-all duration-150 hover:shadow-card-hover">
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] text-textSecondary">{label}</p>
        {icon && <span className={toneClass}>{icon}</span>}
      </div>
      <p className={`text-xl font-bold ${toneClass}`} dir="ltr">
        {value}
      </p>
    </div>
  );
}
