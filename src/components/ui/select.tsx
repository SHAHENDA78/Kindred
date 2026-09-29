"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  className?: string;
  variant?: "default" | "ghost";
  placeholder?: string;
}

export function Select({
  value,
  onChange,
  options,
  className = "",
  variant = "default",
  placeholder = "Select...",
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={
          variant === "ghost"
            ? "flex items-center gap-1 text-[10px] font-bold text-stone uppercase tracking-widest hover:text-ink transition-colors"
            : "w-full bg-white border border-line rounded-xl px-4 py-3 text-sm text-ink flex items-center justify-between gap-2 hover:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent transition-all"
        }
      >
        <span>{selected?.label ?? placeholder}</span>
        {variant !== "ghost" && (
          <ChevronDown
            size={14}
            className={`text-stone transition-transform ${open ? "rotate-180" : ""}`}
          />
        )}
        {variant === "ghost" && (
          <ChevronDown
            size={10}
            className={`text-stone/0 group-hover:text-stone/60 transition-all ${open ? "rotate-180" : ""}`}
          />
        )}
      </button>

      {open && (
        <div className="absolute z-20 mt-2 w-full bg-white border border-line rounded-xl shadow-xl py-1 max-h-60 overflow-y-auto kindred-scrollbar">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center justify-between transition-colors ${
                  isSelected
                    ? "bg-accent/10 text-accent font-bold"
                    : "text-ink hover:bg-paper"
                }`}
              >
                {option.label}
                {isSelected && <Check size={14} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}