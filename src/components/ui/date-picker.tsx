"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronLeft, ChevronRight, Calendar } from "lucide-react";

interface DatePickerProps {
  value: string; 
  onChange: (value: string) => void;
  className?: string;
}

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toDateString(d: Date) {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDisplay(dateStr: string) {
  if (!dateStr) return "Select a date";
  const [y, m, d] = dateStr.split("-").map(Number);
  return `${MONTHS[m - 1].slice(0, 3)} ${d}, ${y}`;
}

export function DatePicker({ value, onChange, className = "" }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedDate = value ? new Date(value + "T00:00:00") : new Date();
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

  const cells: { day: number; inCurrentMonth: boolean; date: Date }[] = [];
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    cells.push({
      day: daysInPrevMonth - i,
      inCurrentMonth: false,
      date: new Date(viewYear, viewMonth - 1, daysInPrevMonth - i),
    });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inCurrentMonth: true, date: new Date(viewYear, viewMonth, d) });
  }
  while (cells.length % 7 !== 0) {
    const nextDay = cells.length - (firstDayOfMonth + daysInMonth) + 1;
    cells.push({
      day: nextDay,
      inCurrentMonth: false,
      date: new Date(viewYear, viewMonth + 1, nextDay),
    });
  }

  function goToPrevMonth() {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function goToNextMonth() {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function selectDay(date: Date) {
    onChange(toDateString(date));
    setOpen(false);
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full bg-paper border border-line rounded-2xl px-5 py-4 text-sm text-ink flex items-center justify-between gap-2 hover:border-accent/40 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
      >
        <span className="flex items-center gap-2">
          <Calendar size={14} className="text-stone shrink-0" />
          {formatDisplay(value)}
        </span>
        <ChevronDown size={14} className={`text-stone transition-transform shrink-0 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
<div className="absolute z-60 mt-2 w-72 bg-white border border-line rounded-2xl shadow-xl p-4 max-h-[70vh] overflow-y-auto">         <div className="flex items-center justify-between mb-4">
            <button
              type="button"
              onClick={goToPrevMonth}
              className="w-7 h-7 rounded-full flex items-center justify-center text-stone hover:bg-paper hover:text-accent transition-colors"
            >
              <ChevronLeft size={14} />
            </button>
            <span className="text-sm font-bold text-ink">
              {MONTHS[viewMonth]} {viewYear}
            </span>
            <button
              type="button"
              onClick={goToNextMonth}
              className="w-7 h-7 rounded-full flex items-center justify-center text-stone hover:bg-paper hover:text-accent transition-colors"
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-1">
            {WEEKDAYS.map((wd) => (
              <div key={wd} className="text-center text-[9px] font-bold text-stone uppercase py-1">
                {wd}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {cells.map((cell, i) => {
              const cellStr = toDateString(cell.date);
              const isSelected = cellStr === value;
              const isToday = cellStr === toDateString(new Date());
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectDay(cell.date)}
                  className={`w-8 h-8 rounded-full text-xs flex items-center justify-center transition-colors ${
                    isSelected
                      ? "bg-accent text-white font-bold"
                      : cell.inCurrentMonth
                      ? "text-ink hover:bg-paper"
                      : "text-stone/30 hover:bg-paper"
                  } ${isToday && !isSelected ? "border border-accent/40" : ""}`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}