"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  format,
  isSameMonth,
  addMonths,
  subMonths,
  isToday,
  parseISO,
} from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { cn, formatTime, JOB_STATUS_COLORS, type JobStatus } from "@/lib/utils";
import type { Job, Customer } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { ChevronLeft, ChevronRight } from "lucide-react";

type JobWithCustomer = Job & { customer: Customer | null };

interface CalendarViewProps {
  initialJobs: JobWithCustomer[];
  teamMembers: { id: string; email: string; fullName: string }[];
  currentUserId: string;
}

type FilterType = "all" | "mine" | "unassigned";

export function CalendarView({
  initialJobs,
  currentUserId,
}: CalendarViewProps) {
  const [jobs, setJobs] = useState<JobWithCustomer[]>(initialJobs);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [filter, setFilter] = useState<FilterType>("all");
  const [draggedJob, setDraggedJob] = useState<JobWithCustomer | null>(null);
  const { addToast } = useToast();
  const supabase = createClient();

  // Filter jobs
  const filteredJobs = jobs.filter((job) => {
    if (filter === "mine") return job.assigned_user_id === currentUserId;
    if (filter === "unassigned") return !job.assigned_user_id;
    return true;
  });

  // Generate calendar days
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(currentDate);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  // Group jobs by date - handle multi-day jobs
  const jobsByDate = useMemo(() => {
    const map = new Map<string, JobWithCustomer[]>();
    
    filteredJobs.forEach((job) => {
      if (!job.scheduled_date) return;
      
      const startDate = parseISO(job.scheduled_date);
      const endDate = job.scheduled_end_date ? parseISO(job.scheduled_end_date) : startDate;
      
      // Add job to all days it spans
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateKey = format(currentDate, "yyyy-MM-dd");
        const existing = map.get(dateKey) || [];
        map.set(dateKey, [...existing, job]);
        currentDate.setDate(currentDate.getDate() + 1);
      }
    });
    
    return map;
  }, [filteredJobs]);
  
  // Helper to check if a job spans multiple days
  const isMultiDayJob = (job: JobWithCustomer): boolean => {
    if (!job.scheduled_date || !job.scheduled_end_date) return false;
    return job.scheduled_date !== job.scheduled_end_date;
  };
  
  // Helper to check if a job starts on this day
  const isJobStartDay = (job: JobWithCustomer, day: Date): boolean => {
    if (!job.scheduled_date) return false;
    const dateKey = format(day, "yyyy-MM-dd");
    return job.scheduled_date === dateKey;
  };
  
  // Helper to check if a job ends on this day
  const isJobEndDay = (job: JobWithCustomer, day: Date): boolean => {
    if (!job.scheduled_end_date) return false;
    const dateKey = format(day, "yyyy-MM-dd");
    return job.scheduled_end_date === dateKey;
  };

  async function handleDrop(date: Date) {
    if (!draggedJob) return;

    const newDate = format(date, "yyyy-MM-dd");
    if (draggedJob.scheduled_date === newDate) {
      setDraggedJob(null);
      return;
    }

    // Optimistically update
    setJobs((prev) =>
      prev.map((j) =>
        j.id === draggedJob.id ? { ...j, scheduled_date: newDate } : j
      )
    );
    setDraggedJob(null);

    // Update in database
    const { error } = await supabase
      .from("jobs")
      .update({
        scheduled_date: newDate,
        updated_at: new Date().toISOString(),
      })
      .eq("id", draggedJob.id);

    if (error) {
      // Revert
      setJobs((prev) =>
        prev.map((j) =>
          j.id === draggedJob.id
            ? { ...j, scheduled_date: draggedJob.scheduled_date }
            : j
        )
      );
      addToast("Failed to reschedule job", "error");
    } else {
      addToast("Job rescheduled!", "success");
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(subMonths(currentDate, 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-xl font-bold min-w-[180px] text-center">
            {format(currentDate, "MMMM yyyy")}
          </h1>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentDate(addMonths(currentDate, 1))}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentDate(new Date())}
          >
            Today
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value as FilterType)}
            className="w-40"
          >
            <option value="all">All jobs</option>
            <option value="mine">Assigned to me</option>
            <option value="unassigned">Unassigned</option>
          </Select>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="flex-1 overflow-auto p-2 sm:p-4">
        {/* Day headers */}
        <div className="grid grid-cols-7 gap-px mb-px">
          {[
            { full: "Sun", short: "S" },
            { full: "Mon", short: "M" },
            { full: "Tue", short: "T" },
            { full: "Wed", short: "W" },
            { full: "Thu", short: "T" },
            { full: "Fri", short: "F" },
            { full: "Sat", short: "S" },
          ].map((day) => (
            <div
              key={day.full}
              className="bg-muted p-2 text-center text-sm font-medium text-muted-foreground"
            >
              <span className="hidden sm:inline">{day.full}</span>
              <span className="sm:hidden">{day.short}</span>
            </div>
          ))}
        </div>

        {/* Calendar cells */}
        <div className="grid grid-cols-7 gap-px bg-border">
          {calendarDays.map((day) => {
            const dateKey = format(day, "yyyy-MM-dd");
            const dayJobs = jobsByDate.get(dateKey) || [];
            const isCurrentMonth = isSameMonth(day, currentDate);

            return (
              <div
                key={dateKey}
                className={cn(
                  "calendar-cell bg-card p-1 sm:p-2 transition-colors min-h-[60px] sm:min-h-[100px]",
                  !isCurrentMonth && "bg-muted/50",
                  isToday(day) && "ring-2 ring-primary ring-inset"
                )}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add("bg-primary/10");
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove("bg-primary/10");
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("bg-primary/10");
                  handleDrop(day);
                }}
              >
                <div
                  className={cn(
                    "text-xs sm:text-sm font-medium mb-1",
                    !isCurrentMonth && "text-muted-foreground",
                    isToday(day) && "text-primary"
                  )}
                >
                  {format(day, "d")}
                </div>
                <div className="space-y-0.5 sm:space-y-1">
                  {dayJobs.slice(0, 3).map((job) => {
                    const multiDay = isMultiDayJob(job);
                    const isStart = isJobStartDay(job, day);
                    const isEnd = isJobEndDay(job, day);
                    
                    // Build title with date range for multi-day jobs
                    const jobTitle = multiDay && job.scheduled_date && job.scheduled_end_date
                      ? `${job.title} (${format(parseISO(job.scheduled_date), "MMM d")} - ${format(parseISO(job.scheduled_end_date), "MMM d")})`
                      : job.title;
                    
                    return (
                      <Link
                        key={`${job.id}-${dateKey}`}
                        href={`/app/jobs/${job.id}`}
                        draggable={isStart}
                        onDragStart={() => isStart && setDraggedJob(job)}
                        onDragEnd={() => setDraggedJob(null)}
                        className={cn(
                          "block rounded px-1 sm:px-1.5 py-0.5 text-[10px] sm:text-xs truncate touch-target-sm",
                          isStart && "cursor-grab active:cursor-grabbing",
                          !isStart && multiDay && "cursor-pointer",
                          JOB_STATUS_COLORS[job.status as JobStatus],
                          multiDay && !isStart && !isEnd && "opacity-75"
                        )}
                        title={jobTitle}
                      >
                        {isStart && job.scheduled_time && (
                          <span className="font-medium">
                            {formatTime(job.scheduled_time).split(" ")[0]}{" "}
                          </span>
                        )}
                        {isStart ? job.title : multiDay ? "..." : job.title}
                      </Link>
                    );
                  })}
                  {dayJobs.length > 3 && (
                    <div className="text-[10px] sm:text-xs text-muted-foreground px-1">
                      +{dayJobs.length - 3}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="border-t bg-card p-4">
        <div className="flex flex-wrap gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-blue-100"></div>
            <span>New</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-purple-100"></div>
            <span>Quoted</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-yellow-100"></div>
            <span>Scheduled</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-orange-100"></div>
            <span>In Progress</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded bg-green-100"></div>
            <span>Done</span>
          </div>
        </div>
      </div>
    </div>
  );
}

