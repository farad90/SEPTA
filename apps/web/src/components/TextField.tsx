import { LucideIcon } from "lucide-react";
import { InputHTMLAttributes, ReactNode } from "react";

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  icon: LucideIcon;
  value: string;
  onChange: (value: string) => void;
  endAdornment?: ReactNode;
}

export function TextField({ icon: Icon, value, onChange, endAdornment, ...rest }: TextFieldProps) {
  return (
    <div className="relative group">
      <Icon
        size={16}
        className="absolute top-1/2 -translate-y-1/2 right-3.5 text-textSecondary transition-colors duration-150 group-focus-within:text-primary"
      />
      <input
        {...rest}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-border bg-surface text-textPrimary placeholder:text-textSecondary/60 pr-10 py-2.5 text-sm shadow-xs transition-all duration-150 ease-smooth hover:border-textSecondary/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
        style={{ paddingLeft: endAdornment ? "2.5rem" : "0.75rem" }}
      />
      {endAdornment}
    </div>
  );
}
