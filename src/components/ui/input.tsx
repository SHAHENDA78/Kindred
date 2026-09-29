import { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, className = "", ...props }: InputProps) {
  return (
    <div>
      {label && (
        <label className="block text-xs font-bold text-stone uppercase mb-2">
          {label}
        </label>
      )}
      <input
        className={`w-full bg-paper border border-line rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 ${className}`}
        {...props}
      />
    </div>
  );
}