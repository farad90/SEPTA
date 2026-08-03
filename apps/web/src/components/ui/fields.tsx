import { ReactNode } from "react";

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="block text-[11.5px] font-medium mb-1.5 text-textSecondary tracking-wide">{label}</label>
      {children}
    </div>
  );
}

const inputClass =
  "w-full rounded-lg px-3 py-2.5 text-sm border border-border bg-surface text-textPrimary placeholder:text-textSecondary/60 shadow-xs transition-all duration-150 ease-smooth hover:border-textSecondary/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:bg-bg disabled:text-textSecondary disabled:cursor-not-allowed disabled:opacity-70 disabled:shadow-none";

export function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClass} cursor-pointer ${props.className ?? ""}`} />;
}

export function PrimaryButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`text-xs px-4 py-2.5 rounded-lg text-white bg-primary font-medium shadow-xs transition-all duration-150 ease-smooth hover:brightness-110 active:brightness-95 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-2 focus-visible:ring-offset-surface disabled:opacity-60 disabled:pointer-events-none disabled:active:scale-100 ${props.className ?? ""}`}
    />
  );
}

export function GhostButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`text-xs px-4 py-2.5 rounded-lg text-textSecondary border border-border bg-transparent transition-all duration-150 ease-smooth hover:text-textPrimary hover:border-textSecondary/40 hover:bg-bg active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 disabled:opacity-60 disabled:pointer-events-none disabled:active:scale-100 ${props.className ?? ""}`}
    />
  );
}
