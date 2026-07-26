"use client";

import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[1.15rem] border border-[#dfe5dc] bg-white p-4 shadow-[0_1px_2px_rgba(8,55,45,0.03)] sm:p-5 ${className}`}>
      {children}
    </div>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="text-xs text-zinc-500">{hint}</span>}
    </label>
  );
}

const inputClass =
  "rounded-lg border border-[#cbd5cc] bg-white px-3 py-2 text-sm text-[#12372f] focus:outline-none focus:ring-2 focus:ring-[#0e5a48]/35 disabled:cursor-not-allowed disabled:opacity-50";

export function TextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={`${inputClass} ${props.className ?? ""}`} />;
}

export function Checkbox({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <label className={`flex items-start gap-3 rounded-lg border border-zinc-200 dark:border-zinc-800 p-3 cursor-pointer ${disabled ? "opacity-50 cursor-not-allowed" : "hover:border-zinc-400 dark:hover:border-zinc-600"}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-zinc-900 dark:accent-white"
      />
      <span className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        {description && <span className="text-xs text-zinc-500">{description}</span>}
      </span>
    </label>
  );
}

export function Button({
  children,
  variant = "primary",
  className = "",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const variants: Record<string, string> = {
    primary: "bg-[#0b4438] text-white hover:bg-[#12604d]",
    secondary: "border border-[#cbd5cc] bg-white text-[#173d34] hover:border-[#8fa99b] hover:bg-[#f2f7f3]",
    danger: "bg-red-600 text-white hover:bg-red-700",
    ghost: "text-[#173d34] hover:bg-[#edf4ef]",
  };
  return (
    <button
      {...props}
      className={`rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${variants[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Badge({ children, tone = "zinc" }: { children: ReactNode; tone?: "zinc" | "violet" | "amber" | "red" | "emerald" }) {
  const tones: Record<string, string> = {
    zinc: "bg-[#edf1ed] text-[#53655d]",
    violet: "bg-[#eeeaf8] text-[#6f5fa7]",
    amber: "bg-[#fff5bf] text-[#6a5913]",
    red: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    emerald: "bg-[#e1f3e8] text-[#176447]",
  };
  return <span className={`text-[10px] uppercase tracking-wide rounded-full px-2 py-1 ${tones[tone]}`}>{children}</span>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p className="text-sm text-red-600 dark:text-red-400">{children}</p>;
}
