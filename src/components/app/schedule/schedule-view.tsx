"use client";

import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import {
  format,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  isSameMonth,
  addDays,
  subDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  startOfDay,
  parseISO,
  getDay,
} from "date-fns";
import { createClient } from "@/lib/supabase/client";
import { cn, formatTime, formatDate, JOB_STATUS_COLORS, JOB_STATUS_LABELS, type JobStatus } from "@/lib/utils";
import type { Job, Customer } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { ChevronLeft, ChevronRight, Calendar, Clock, MapPin, User } from "lucide-react";

type JobWithCustomer = Job & { customer: Customer | null };
type ViewType = "day" | "week" | "month";
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
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const { addToast } = useToast();
  const supabase = createClient();

  // Check scroll position
  const checkScroll = useCallback(() => {
    const container = scrollContainerRef.current;
    if (container) {
      setCanScrollLeft(container.scrollLeft > 0);
      setCanScrollRight(
        container.scrollLeft < container.scrollWidth - container.clientWidth - 1
      );
    }
  }, []);

  // Scroll left/right
  const scroll = useCallback((direction: "left" | "right") => {
    const container = scrollContainerRef.current;
    if (container) {
      const scrollAmount = container.clientWidth * 0.8;
      container.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  }, []);

  // Filter jobs
  const filteredJobs = jobs.filter((job) => {
    if (filter === "mine") {
      return job.assigned_user_id === currentUserId;
    }
    return true;
  });

  // Get jobs for current day/week/month
  const jobsForPeriod = useMemo(() => {
    let start, end;
    
    if (view === "day") {
      start = startOfDay(currentDate);
      end = startOfDay(addDays(currentDate, 1));
    } else if (view === "week") {
      start = startOfWeek(currentDate, { weekStartsOn: 0 });
      end = endOfWeek(currentDate, { weekStartsOn: 0 });
    } else {
      start = startOfMonth(currentDate);
      end = endOfMonth(currentDate);
    }

    return filteredJobs.filter((job) => {
      if (!job.scheduled_date) return false;
      const jobDate = parseISO(job.scheduled_date);
      return jobDate >= start && jobDate <= end;
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

  // Get days for week/month view
  const viewDays = useMemo(() => {
    if (view === "day") return [currentDate];
    if (view === "week") {
      const start = startOfWeek(currentDate, { weekStartsOn: 0 });
      return eachDayOfInterval({
        start,
        end: endOfWeek(currentDate, { weekStartsOn: 0 }),
      });
    }
    // Month view - get all days including padding
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);
    const monthDays = eachDayOfInterval({ start, end });
    
    // Add padding days to start at Sunday
    const firstDayOfWeek = getDay(start);
    const paddingStart = [];
    for (let i = 0; i < firstDayOfWeek; i++) {
      paddingStart.push(subDays(start, firstDayOfWeek - i));
    }
    
    // Add padding days to end at Saturday
    const lastDay = monthDays[monthDays.length - 1];
    const lastDayOfWeek = getDay(lastDay);
    const paddingEnd = [];
    for (let i = 1; i < 7 - lastDayOfWeek; i++) {
      paddingEnd.push(addDays(lastDay, i));
    }
    
    return [...paddingStart, ...monthDays, ...paddingEnd];
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
    } else if (view === "week") {
      setCurrentDate((prev) => (direction === "next" ? addWeeks(prev, 1) : subWeeks(prev, 1)));
    } else {
      setCurrentDate((prev) => (direction === "next" ? addMonths(prev, 1) : subMonths(prev, 1)));
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

  // Check scroll on mount and when view changes
  useEffect(() => {
    checkScroll();
    const handleResize = () => checkScroll();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [checkScroll, view]);

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
                  : view === "week"
                  ? `Week of ${format(startOfWeek(currentDate, { weekStartsOn: 0 }), "MMM d")}`
                  : format(currentDate, "MMMM yyyy")
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
                  className="rounded-r-none rounded-l-lg"
                >
                  Day
                </Button>
                <Button
                  variant={view === "week" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setView("week")}
                  className="rounded-none"
                >
                  Week
                </Button>
                <Button
                  variant={view === "month" ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setView("month")}
                  className="rounded-l-none rounded-r-lg"
                >
                  Month
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
                    <Card className={cn(
                      "p-4 hover:opacity-90 transition-all border-l-4",
                      JOB_STATUS_COLORS[job.status as JobStatus]
                    )}>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0 space-y-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <h3 className="font-semibold truncate flex-1">{job.title}</h3>
                            <Badge className={cn("shrink-0", JOB_STATUS_COLORS[job.status as JobStatus])}>
                              {JOB_STATUS_LABELS[job.status as JobStatus]}
                            </Badge>
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
          <div className="relative">
            {/* Left scroll button */}
            {canScrollLeft && (view === "week" || view === "month") && (
              <button
                onClick={() => scroll("left")}
                className="absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-card border rounded-full p-2 shadow-lg hover:bg-muted transition-colors touch-target"
                aria-label="Scroll left"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            )}

            {/* Right scroll button */}
            {canScrollRight && (view === "week" || view === "month") && (
              <button
                onClick={() => scroll("right")}
                className="absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-card border rounded-full p-2 shadow-lg hover:bg-muted transition-colors touch-target"
                aria-label="Scroll right"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            )}

            <div 
              ref={scrollContainerRef}
              onScroll={checkScroll}
              className="overflow-x-auto scrollbar-hide"
            >
              {view === "week" ? (
                <div className="grid grid-cols-7 gap-1 sm:gap-2 min-w-[560px]">
                  {viewDays.map((day, index) => {
                    const dayKey = format(day, "yyyy-MM-dd");
                    const dayJobs = jobsByDate.get(dayKey) || [];
                    const isToday = isSameDay(day, new Date());

                    return (
                      <div key={index} className="space-y-2 min-w-[80px]">
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
                              <Card className={cn(
                                "p-2.5 hover:opacity-90 transition-all border-l-4",
                                JOB_STATUS_COLORS[job.status as JobStatus]
                              )}>
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
              ) : (
                <div className="min-w-[640px]">
                  {/* Month view header */}
                  <div className="grid grid-cols-7 gap-1 mb-2">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                      <div key={day} className="text-center text-sm font-semibold text-muted-foreground py-2">
                        {day}
                      </div>
                    ))}
                  </div>
                  {/* Month view grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {viewDays.map((day, index) => {
                      const dayKey = format(day, "yyyy-MM-dd");
                      const dayJobs = jobsByDate.get(dayKey) || [];
                      const isToday = isSameDay(day, new Date());
                      const isCurrentMonth = isSameMonth(day, currentDate);

                      return (
                        <div
                          key={index}
                          className={cn(
                            "min-h-[100px] border rounded-lg p-2",
                            !isCurrentMonth && "bg-muted/30 text-muted-foreground",
                            isToday && "ring-2 ring-primary"
                          )}
                        >
                          <div className={cn(
                            "text-sm font-semibold mb-1",
                            isToday && "text-primary"
                          )}>
                            {format(day, "d")}
                          </div>
                          <div className="space-y-1">
                            {dayJobs.slice(0, 3).map((job) => (
                              <Link
                                key={job.id}
                                href={`/app/jobs/${job.id}`}
                                className="block"
                              >
                                <div className={cn(
                                  "text-xs p-1 rounded border-l-2 truncate",
                                  JOB_STATUS_COLORS[job.status as JobStatus]
                                )}>
                                  {job.scheduled_time && `${formatTime(job.scheduled_time)} `}
                                  {job.title}
                                </div>
                              </Link>
                            ))}
                            {dayJobs.length > 3 && (
                              <div className="text-xs text-muted-foreground">
                                +{dayJobs.length - 3} more
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
