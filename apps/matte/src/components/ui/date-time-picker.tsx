"use client";

import { useState } from "react";
import { Calendar, Clock } from "lucide-react";
import { Input } from "./input";
import { Label } from "./label";
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
            <Input
              type="time"
              value={timeValue}
              onChange={(e) => onTimeChange(e.target.value)}
              onFocus={() => setFocused("time")}
              onBlur={() => setFocused(null)}
              disabled={disabled}
              className="pl-10 border-0 focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[44px] cursor-pointer bg-transparent"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
