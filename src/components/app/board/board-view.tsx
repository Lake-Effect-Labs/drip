"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import {
  DndContext,
  DragOverlay,
  closestCenter,
  pointerWithin,
  rectIntersection,
  KeyboardSensor,
  TouchSensor,
  MouseSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { JOB_STATUSES, JOB_STATUS_LABELS, type JobStatus } from "@/lib/utils";
import type { Job, Customer } from "@/types/database";
import { BoardColumn } from "./board-column";
import { JobCard } from "./job-card";
import { NewJobDialog } from "./new-job-dialog";
import { NudgeBanners } from "./nudge-banners";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Plus, Search, X, ChevronLeft, ChevronRight, Sparkles } from "lucide-react";
import { useToast } from "@/components/ui/toast";
import { createClient } from "@/lib/supabase/client";
import Link from "next/link";

type LatestEstimate = {
  id: string;
  status: string;
  denied_at: string | null;
  denial_reason: string | null;
};

type JobWithCustomer = Job & { customer: Customer | null; latestEstimate?: LatestEstimate | null };

interface BoardViewProps {
  initialJobs: JobWithCustomer[];
  teamMembers: { id: string; email: string; fullName: string }[];
  currentUserId: string;
  companyId: string;
  subscriptionStatus: string;
  isAtTrialLimit: boolean;
}

type FilterType = "all" | "mine" | "unassigned";

export function BoardView({
  initialJobs,
  teamMembers,
  currentUserId,
  companyId,
  isAtTrialLimit,
}: BoardViewProps) {
  const [jobs, setJobs] = useState<JobWithCustomer[]>(initialJobs);
  const [activeJob, setActiveJob] = useState<JobWithCustomer | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [newJobOpen, setNewJobOpen] = useState(false);
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
      const scrollAmount = container.clientWidth * 0.8; // Scroll 80% of viewport
      container.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
    }
  }, []);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        distance: 8, // Mouse needs less distance
      },
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 150, // Delay before drag starts on touch
        tolerance: 8, // Movement tolerance during delay
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Custom collision detection optimized for both horizontal and vertical layouts
  const collisionDetectionStrategy: CollisionDetection = useCallback((args) => {
    // First, try pointer-within for intuitive column detection
    const pointerCollisions = pointerWithin(args);
    if (pointerCollisions.length > 0) {
      return pointerCollisions;
    }

    // Use closestCenter for better vertical layout support
    const closestCenterCollisions = closestCenter(args);
    if (closestCenterCollisions.length > 0) {
      return closestCenterCollisions;
    }

    // Final fallback to rect intersection
    return rectIntersection(args);
  }, []);

  // Filter and search jobs (memoized to avoid recomputing on unrelated state changes)
  const filteredJobs = useMemo(() => jobs.filter((job) => {
    // Apply status filter
    if (filter === "mine") {
      if (job.assigned_user_id !== currentUserId) return false;
    } else if (filter === "unassigned") {
      if (job.assigned_user_id) return false;
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = job.title.toLowerCase().includes(query);
      const matchesCustomer = job.customer?.name.toLowerCase().includes(query);
      const matchesAddress = [
        job.address1,
        job.city,
        job.state,
        job.zip,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);

      if (!matchesTitle && !matchesCustomer && !matchesAddress) return false;
    }

    return true;
  }), [jobs, filter, searchQuery, currentUserId]);

  // Group jobs by status (memoized)
  const jobsByStatus = useMemo(() => JOB_STATUSES.reduce(
    (acc, status) => {
      acc[status] = filteredJobs.filter((job) => job.status === status);
      return acc;
    },
    {} as Record<JobStatus, JobWithCustomer[]>
  ), [filteredJobs]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const job = jobs.find((j) => j.id === event.active.id);
    if (job) setActiveJob(job);
  }, [jobs]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveJob(null);

      if (!over) return;

      const activeId = active.id as string;
      const overId = over.id as string;

      // Find the active job
      const activeJob = jobs.find((j) => j.id === activeId);
      if (!activeJob) return;

      // Check if overId is a valid status (column) or a job (within column sorting)
      const isValidStatus = JOB_STATUSES.includes(overId as JobStatus);
      
      let targetStatus: JobStatus | null = null;
      
      if (isValidStatus) {
        // Dropped directly on the column
        targetStatus = overId as JobStatus;
      } else {
        // Dropped on a card - find that card's status
        const overJob = jobs.find((j) => j.id === overId);
        if (overJob && JOB_STATUSES.includes(overJob.status as JobStatus)) {
          targetStatus = overJob.status as JobStatus;
        }
      }

      // If we have a target status and it's different from the current status, update it
      if (targetStatus && activeJob.status !== targetStatus) {
        // Optimistically update UI
        setJobs((prev) =>
          prev.map((j) => (j.id === activeId ? { ...j, status: targetStatus! } : j))
        );

        // Update in database via API (bypasses RLS)
        const updateResponse = await fetch(`/api/jobs/${activeId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: targetStatus }),
        });

        if (!updateResponse.ok) {
          // Revert on error
          setJobs((prev) =>
            prev.map((j) => (j.id === activeId ? { ...j, status: activeJob.status } : j))
          );
          addToast("Failed to update job status", "error");
        }
      } else if (activeId !== overId && activeJob.status === targetStatus) {
        // Dragging within the same column (reordering)
        // For now, we just allow the visual reordering without persisting
        // The dnd-kit sortable will handle the visual update automatically
        // To persist, we would need to add a sort_order field to the jobs table
        const overJob = jobs.find((j) => j.id === overId);
        if (overJob && overJob.status === activeJob.status) {
          // Reorder within the same status
          const statusJobs = jobs.filter((j) => j.status === activeJob.status);
          const otherJobs = jobs.filter((j) => j.status !== activeJob.status);

          const oldIndex = statusJobs.findIndex((j) => j.id === activeId);
          const newIndex = statusJobs.findIndex((j) => j.id === overId);

          if (oldIndex !== -1 && newIndex !== -1) {
            const reorderedStatusJobs = [...statusJobs];
            const [removed] = reorderedStatusJobs.splice(oldIndex, 1);
            reorderedStatusJobs.splice(newIndex, 0, removed);

            setJobs([...otherJobs, ...reorderedStatusJobs]);
          }
        }
      }
    },
    [jobs, addToast]
  );

  const handleJobCreated = useCallback((newJob: JobWithCustomer) => {
    setJobs((prev) => [newJob, ...prev]);
    setNewJobOpen(false);
    addToast("Job created!", "success");
  }, [addToast]);

  // Real-time subscription for job updates
  useEffect(() => {
    const channel = supabase
      .channel(`board-jobs-${companyId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "jobs",
          filter: `company_id=eq.${companyId}`,
        },
        (payload) => {
          // Update the job in local state when it changes
          // Preserve customer data from existing job
          setJobs((prev) =>
            prev.map((job) =>
              job.id === payload.new.id
                ? { ...job, ...(payload.new as Partial<JobWithCustomer>) }
                : job
            )
          );
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "jobs",
          filter: `company_id=eq.${companyId}`,
        },
        async () => {
          // Refresh jobs when a new one is created to get customer data
          window.location.reload();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [companyId, supabase]);


  // Check scroll on mount and when jobs change
  useEffect(() => {
    checkScroll();
    // Add resize listener
    const handleResize = () => checkScroll();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [checkScroll, jobs.length]);

  return (
    <div className="flex h-full flex-col">
      {/* Nudge Banners */}
      <div className="p-4 pb-0">
        <NudgeBanners companyId={companyId} />

        {/* Trial Limit Banner */}
        {isAtTrialLimit && (
          <div className="rounded-lg border border-primary bg-primary/10 p-4 flex items-center justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 text-primary" />
              <div>
                <p className="font-medium text-primary">You&apos;ve used your free job</p>
                <p className="text-sm text-muted-foreground">Subscribe to create unlimited jobs and grow your business.</p>
              </div>
            </div>
            <Link href="/app/settings">
              <Button size="sm">
                Subscribe Now
              </Button>
            </Link>
          </div>
        )}
      </div>
      
      {/* Header */}
      <div className="flex flex-col gap-2 sm:gap-3 border-b bg-card p-3 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold">Board</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">
              {filteredJobs.length} of {jobs.length} job{jobs.length !== 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={filter}
              onChange={(e) => setFilter(e.target.value as FilterType)}
              className="w-32 sm:w-40 text-sm"
            >
              <option value="all">All jobs</option>
              <option value="mine">Assigned to me</option>
              <option value="unassigned">Unassigned</option>
            </Select>
            {isAtTrialLimit ? (
              <Link href="/app/settings">
                <Button size="sm" className="sm:size-default">
                  <Sparkles className="h-4 w-4 sm:mr-2" />
                  <span className="hidden sm:inline">Subscribe</span>
                </Button>
              </Link>
            ) : (
              <Button onClick={() => setNewJobOpen(true)} size="sm" className="sm:size-default">
                <Plus className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">New Job</span>
              </Button>
            )}
          </div>
        </div>
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search jobs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-10 h-9 sm:h-10 text-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 relative min-h-0">
        {/* Left scroll button - desktop only */}
        {canScrollLeft && (
          <button
            onClick={() => scroll("left")}
            className="hidden md:block absolute left-2 top-1/2 -translate-y-1/2 z-10 bg-card border rounded-full p-2 shadow-lg hover:bg-muted transition-colors touch-target"
            aria-label="Scroll left"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {/* Right scroll button - desktop only */}
        {canScrollRight && (
          <button
            onClick={() => scroll("right")}
            className="hidden md:block absolute right-2 top-1/2 -translate-y-1/2 z-10 bg-card border rounded-full p-2 shadow-lg hover:bg-muted transition-colors touch-target"
            aria-label="Scroll right"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        <div
          ref={scrollContainerRef}
          onScroll={checkScroll}
          className="h-full overflow-auto p-4 scrollbar-hide"
          style={{
            maxHeight: 'calc(100vh - 14rem)',
            WebkitOverflowScrolling: 'touch'
          }}
        >
          {jobs.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center max-w-md">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
                <Plus className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No jobs yet</h3>
              <p className="text-muted-foreground mb-6">
                Create your first job to get started. Jobs move through the board from New to Paid.
              </p>
              <Button onClick={() => setNewJobOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Create your first job
              </Button>
            </div>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={collisionDetectionStrategy}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex flex-col md:flex-row h-full gap-4">
              {JOB_STATUSES.map((status) => (
                <BoardColumn
                  key={status}
                  id={status}
                  title={JOB_STATUS_LABELS[status]}
                  jobs={jobsByStatus[status]}
                  count={jobsByStatus[status].length}
                  onStatusChange={async (jobId, newStatus) => {
                    const updateResponse = await fetch(`/api/jobs/${jobId}`, {
                      method: "PATCH",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ status: newStatus }),
                    });

                    if (updateResponse.ok) {
                      setJobs((prev) =>
                        prev.map((j) => (j.id === jobId ? { ...j, status: newStatus } : j))
                      );
                      addToast("Status updated!", "success");
                    } else {
                      addToast("Failed to update status", "error");
                    }
                  }}
                  onDuplicate={async (jobId) => {
                    const job = jobs.find((j) => j.id === jobId);
                    if (!job) return;

                    const response = await fetch("/api/jobs", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({
                        company_id: companyId,
                        customer_id: job.customer_id,
                        title: `${job.title} (Copy)`,
                        address1: job.address1,
                        address2: job.address2,
                        city: job.city,
                        state: job.state,
                        zip: job.zip,
                        notes: job.notes,
                        status: "new",
                      }),
                    });

                    if (response.ok) {
                      const newJob = await response.json();
                      setJobs((prev) => [newJob, ...prev]);
                      addToast("Job duplicated!", "success");
                    } else if (response.status === 402) {
                      addToast("Subscribe to create more jobs", "error");
                    } else {
                      addToast("Failed to duplicate job", "error");
                    }
                  }}
                />
              ))}
            </div>

            <DragOverlay>
              {activeJob && (
                <div className="rotate-3 scale-105 opacity-95">
                  <div className="shadow-2xl ring-2 ring-primary/20">
                    <JobCard job={activeJob} />
                  </div>
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
        </div>
      </div>

      {/* New Job Dialog */}
      <NewJobDialog
        open={newJobOpen}
        onOpenChange={setNewJobOpen}
        companyId={companyId}
        teamMembers={teamMembers}
        onJobCreated={handleJobCreated}
      />
    </div>
  );
}

