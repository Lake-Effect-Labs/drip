"use client";

import { useState, useEffect, useRef } from "react";
import { Bell } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";

interface Reminder {
  id: string;
  jobId: string;
  jobTitle: string;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  sentAt: string;
  daysAgo: number;
}

export function NotificationBell() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Fetch reminders on mount and every 5 minutes
  useEffect(() => {
    fetchReminders();
    const interval = setInterval(fetchReminders, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [open]);

  async function fetchReminders() {
    try {
      const res = await fetch("/api/reminders");
      if (res.ok) {
        const data = await res.json();
        setReminders(data.reminders || []);
      }
    } catch {
      // Silently fail — not critical
    } finally {
      setLoading(false);
    }
  }

  async function dismissReminder(estimateId: string) {
    setReminders((prev) => prev.filter((r) => r.id !== estimateId));
    try {
      await fetch("/api/reminders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ estimateId }),
      });
    } catch {
      // Silently fail
    }
  }

  function handleFollowUp(reminder: Reminder) {
    setOpen(false);
    router.push(`/app/board?job=${reminder.jobId}`);
  }

  const count = reminders.length;

  return (
    <div ref={dropdownRef} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "relative p-2 rounded-lg transition-colors",
          "hover:bg-muted text-muted-foreground hover:text-foreground",
          open && "bg-muted text-foreground"
        )}
        title={count > 0 ? `${count} follow-up reminder${count !== 1 ? "s" : ""}` : "No reminders"}
      >
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground">
            {count > 9 ? "9+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className={cn(
          "absolute right-0 top-full mt-2 z-50 w-80 max-h-96 overflow-y-auto",
          "rounded-lg border bg-card shadow-lg animate-fade-in"
        )}>
          <div className="p-3 border-b">
            <h3 className="font-semibold text-sm">Follow-up Reminders</h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Estimates waiting for a response
            </p>
          </div>

          {loading ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              Loading...
            </div>
          ) : count === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              All caught up — no pending follow-ups.
            </div>
          ) : (
            <div className="divide-y">
              {reminders.map((reminder) => (
                <div key={reminder.id} className="p-3 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {reminder.customerName}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {reminder.jobTitle}
                      </p>
                      <p className="text-xs text-warning font-medium mt-1">
                        Sent {reminder.daysAgo} day{reminder.daysAgo !== 1 ? "s" : ""} ago
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => handleFollowUp(reminder)}
                      className="flex-1 text-xs font-medium px-2.5 py-1.5 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                    >
                      Follow Up
                    </button>
                    <button
                      onClick={() => dismissReminder(reminder.id)}
                      className="text-xs font-medium px-2.5 py-1.5 rounded-md border hover:bg-muted transition-colors"
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
