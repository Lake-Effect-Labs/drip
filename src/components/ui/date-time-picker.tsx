"use client";

import { useState } from "react";
import { Calendar, Clock } from "lucide-react";
import { Input } from "./input";
import { Label } from "./label";
import { Select } from "./select";
import { cn } from "@/lib/utils";

interface DateTimePickerProps {
  date: string | null;
  time: string | null;
  onDateChange: (date: string) => void;
  onTimeChange: (time: string) => void;
  label?: string;
  className?: string;
  disabled?: boolean;
}

// Generate time options in 15-minute intervals
const generateTimeOptions = () => {
  const options: { value: string; label: string }[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const hourStr = hour.toString().padStart(2, "0");
      const minuteStr = minute.toString().padStart(2, "0");
      const value = `${hourStr}:${minuteStr}`;

      // Format label as 12-hour time
      const hour12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
      const ampm = hour < 12 ? "AM" : "PM";
      const label = `${hour12}:${minuteStr} ${ampm}`;

      options.push({ value, label });
    }
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

export function DateTimePicker({
  date,
  time,
  onDateChange,
  onTimeChange,
  label = "Date & Time",
  className,
  disabled = false,
}: DateTimePickerProps) {
  const [focused, setFocused] = useState<"date" | "time" | null>(null);
  const dateValue = date || "";
  const timeValue = time || "";

  const formattedDate = date
    ? new Date(date + "T00:00").toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "";

  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label className="text-sm font-medium">{label}</Label>}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        <div className="space-y-1.5">
          <div
            className={cn(
              "relative rounded-lg border bg-background transition-all",
              focused === "date"
                ? "ring-2 ring-primary ring-offset-2 border-primary"
                : "border-input hover:border-muted-foreground/50",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
            <Input
              type="date"
              value={dateValue}
              onChange={(e) => onDateChange(e.target.value)}
              onFocus={() => setFocused("date")}
              onBlur={() => setFocused(null)}
              disabled={disabled}
              className="pl-10 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[44px] cursor-pointer bg-transparent"
            />
          </div>
          {formattedDate && (
            <p className="text-sm text-muted-foreground mt-1 ml-1">
              {formattedDate}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <div
            className={cn(
              "relative rounded-lg border bg-background transition-all",
              focused === "time"
                ? "ring-2 ring-primary ring-offset-2 border-primary"
                : "border-input hover:border-muted-foreground/50",
              disabled && "opacity-50 cursor-not-allowed"
            )}
          >
            <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none z-10" />
            <Select
              value={timeValue}
              onChange={(e) => onTimeChange(e.target.value)}
              onFocus={() => setFocused("time")}
              onBlur={() => setFocused(null)}
              disabled={disabled}
              className="pl-10 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[44px] cursor-pointer bg-transparent"
            >
              <option value="">Select time</option>
              {TIME_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
