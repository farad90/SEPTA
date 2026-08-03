export function ViewField({ title, value }: { title: string; value?: string | null }) {
  return (
    <div>
      <p className="text-[11px] text-textSecondary tracking-wide mb-0.5">{title}</p>
      <p className={`text-sm leading-snug ${value ? "text-textPrimary font-medium" : "text-textSecondary/70"}`}>
        {value || "—"}
      </p>
    </div>
  );
}
