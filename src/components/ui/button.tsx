import { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const base = "px-6 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50";
  const styles = {
    primary: "bg-accent text-white hover:bg-accent/90",
    secondary: "bg-paper border border-line text-stone hover:bg-clay",
  };

  return <button className={`${base} ${styles[variant]} ${className}`} {...props} />;
}