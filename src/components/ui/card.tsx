import { HTMLAttributes } from "react";

export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`bg-white rounded-3xl border border-line shadow-sm ${className}`}
      {...props}
    />
  );
}