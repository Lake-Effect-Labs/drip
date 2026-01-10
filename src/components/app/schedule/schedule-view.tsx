"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  format,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  isSameDay,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  startOfDay,
  parseISO,
} from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { cn, formatTime, formatDate } from "@/lib/utils";
import type { Job, Customer } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { ChevronLeft, ChevronRight, Calendar, Clock, MapPin, User } from "lucide-react";

type JobWithCustomer = Job & { customer: Customer | null };
type ViewType = "day" | "week";
type FilterType = "all" | "mine";

interface ScheduleViewProps {
  initialJobs: JobWithCustomer[];
  teamMembers: { id: string; email: string; fullName: string }[];
  currentUserId: string;
}

export function ScheduleView({
  initialJobs,
  teamMembers,
  currentUserId,
}: ScheduleViewProps) {
  const [jobs, setJobs] = useState<JobWithCustomer[]>(initialJobs);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>("day");
  const [filter, setFilter] = useState<FilterType>("all");
  const { addToast } = useToast();
  const supabase = createClient();

  // Filter jobs
  const filteredJobs = jobs.filter((job) => {
    if (filter === "mine") {
      return job.assigned_user_id === currentUserId;
    }
    return true;
  });

  // Get jobs for current day/week
  const jobsForPeriod = useMemo(() => {
    const start = view === "day" 
      ? startOfDay(currentDate)
      : startOfWeek(currentDate, { weekStartsOn: 0 });
    const end = view === "day"
      ? startOfDay(addDays(currentDate, 1))
      : endOfWeek(currentDate, { weekStartsOn: 0 });

    return filteredJobs.filter((job) => {
      if (!job.scheduled_date) return false;
      const jobDate = parseISO(job.scheduled_date);
      return jobDate >= start && jobDate < end;
    }).sort((a, b) => {
      // Sort by date, then by time
      if (a.scheduled_date !== b.scheduled_date) {
        return a.scheduled_date!.localeCompare(b.scheduled_date!);
      }
      const timeA = a.scheduled_time || "00:00";
      const timeB = b.scheduled_time || "00:00";
      return timeA.localeCompare(timeB);
    });
  }, [filteredJobs, currentDate, view]);

  // Get days for week view
  const weekDays = useMemo(() => {
    if (view === "day") return [currentDate];
    const start = startOfWeek(currentDate, { weekStartsOn: 0 });
    return eachDayOfInterval({
      start,
      end: endOfWeek(currentDate, { weekStartsOn: 0 }),
    });
  }, [currentDate, view]);

  // Group jobs by date for week view
  const jobsByDate = useMemo(() => {
    const map = new Map<string, JobWithCustomer[]>();
    jobsForPeriod.forEach((job) => {
      if (job.scheduled_date) {
        const dateKey = job.scheduled_date;
        const existing = map.get(dateKey) || [];
        map.set(dateKey, [...existing, job]);
      }
    });
    return map;
  }, [jobsForPeriod]);

  function navigateDate(direction: "prev" | "next") {
    if (view === "day") {
      setCurrentDate((prev) => (direction === "next" ? addDays(prev, 1) : subDays(prev, 1)));
    } else {
      setCurrentDate((prev) => (direction === "next" ? addWeeks(prev, 1) : subWeeks(prev, 1)));
    }
  }

  function goToToday() {
    setCurrentDate(new Date());
  }

  const getTeamMemberName = (userId: string | null) => {
    if (!userId) return "Unassigned";
    const member = teamMembers.find((m) => m.id === userId);
    return member?.fullName || "Unknown";
  };

  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <div className="w-full">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold">Schedule</h1>
              <p className="text-sm text-muted-foreground">
                {view === "day" 
                  ? format(currentDate, "EEEE, MMMM d, yyyy")
                  : `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 0 }), "MMM d")}`
                }
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                value={filter}
                onChange={(e) => setFilter(e.target.value as FilterType)}
                className="w-full sm:w-40 min-w-[120px]"
              >
                <option value="all">All jobs</option>
                <option value="mine">My jobs</option>
              </Select>
              <div className="flex items-center gap-1 border rounded-lg shrink-0">
                <Button
                  variant={view === "day" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setView("day")}
                  className="rounded-r-none"
                >
                  Day
                </Button>
                <Button
                  variant={view === "week" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setView("week")}
                  className="rounded-l-none"
                >
                  Week
                </Button>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateDate("prev")}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={goToToday}
                  className="text-xs px-2"
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigateDate("next")}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Content */}
      <div className="w-full p-4">
        {view === "day" ? (
          <div className="space-y-4">
            <div className="text-sm font-medium text-muted-foreground mb-2">
              {jobsForPeriod.length} job{jobsForPeriod.length !== 1 ? "s" : ""} scheduled
            </div>
            {jobsForPeriod.length === 0 ? (
              <Card className="p-12 text-center">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No jobs scheduled for this day</p>
              </Card>
            ) : (
              <div className="space-y-3">
                {jobsForPeriod.map((job) => (
                  <Link
                    key={job.id}
                    href={`/app/jobs/${job.id}`}
                    className="block"
                  >
                    <Card className="p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <h3 className="font-semibold truncate flex-1">{job.title}</h3>
                            <Badge variant="secondary" className="shrink-0">{job.status}</Badge>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                            {job.scheduled_time && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Clock className="h-4 w-4 shrink-0" />
                                <span className="whitespace-nowrap">{formatTime(job.scheduled_time)}</span>
                              </div>
                            )}
                            {job.customer && (
                              <div className="flex items-center gap-1.5 min-w-0">
                                <User className="h-4 w-4 shrink-0" />
                                <span className="truncate">{job.customer.name}</span>
                              </div>
                            )}
                            {job.address1 && (
                              <div className="flex items-start gap-1.5 min-w-0 flex-1">
                                <MapPin className="h-4 w-4 shrink-0 mt-0.5" />
                                <span className="break-words text-xs">{[job.address1, job.city, job.state].filter(Boolean).join(", ")}</span>
                              </div>
                            )}
                            {job.assigned_user_id && (
                              <div className="text-xs shrink-0 whitespace-nowrap">
                                Assigned to: {getTeamMemberName(job.assigned_user_id)}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Link>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-7 gap-1 sm:gap-2 overflow-x-auto">
              {weekDays.map((day, index) => {
                const dayKey = format(day, "yyyy-MM-dd");
                const dayJobs = jobsByDate.get(dayKey) || [];
                const isToday = isSameDay(day, new Date());

                return (
                  <div key={index} className="space-y-2 min-w-[80px] sm:min-w-0">
                    <div
                      className={cn(
                        "text-center p-2 rounded-lg",
                        isToday && "bg-primary text-primary-foreground"
                      )}
                    >
                      <div className="text-xs text-muted-foreground">
                        {format(day, "EEE")}
                      </div>
                      <div className="text-lg font-semibold">
                        {format(day, "d")}
                      </div>
                    </div>
                    <div className="space-y-1.5 min-h-[200px]">
                      {dayJobs.map((job) => (
                        <Link
                          key={job.id}
                          href={`/app/jobs/${job.id}`}
                          className="block"
                        >
                          <Card className="p-2.5 hover:bg-muted/50 transition-colors">
                            <div className="font-semibold text-sm truncate mb-1">{job.title}</div>
                            {job.scheduled_time && (
                              <div className="text-xs text-muted-foreground mb-0.5">
                                {formatTime(job.scheduled_time)}
                              </div>
                            )}
                            {job.customer && (
                              <div className="text-xs text-muted-foreground truncate">
                                {job.customer.name}
                              </div>
                            )}
                          </Card>
                        </Link>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
