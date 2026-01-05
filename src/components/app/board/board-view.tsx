"use client";

import { useState, useCallback } from "react";
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";
import { createClient } from "@/lib/supabase/client";
import { JOB_STATUSES, JOB_STATUS_LABELS, type JobStatus } from "@/lib/utils";
import type { Job, Customer } from "@/types/database";
import { BoardColumn } from "./board-column";
import { JobCard } from "./job-card";
import { NewJobDialog } from "./new-job-dialog";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useToast } from "@/components/ui/toast";

type JobWithCustomer = Job & { customer: Customer | null };

interface BoardViewProps {
  initialJobs: JobWithCustomer[];
  teamMembers: { id: string; email: string; fullName: string }[];
  currentUserId: string;
  companyId: string;
}

type FilterType = "all" | "mine" | "unassigned";

export function BoardView({
  initialJobs,
  teamMembers,
  currentUserId,
  companyId,
}: BoardViewProps) {
  const [jobs, setJobs] = useState<JobWithCustomer[]>(initialJobs);
  const [activeJob, setActiveJob] = useState<JobWithCustomer | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [newJobOpen, setNewJobOpen] = useState(false);
  const { addToast } = useToast();
  const supabase = createClient();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Filter jobs
  const filteredJobs = jobs.filter((job) => {
    if (filter === "mine") return job.assigned_user_id === currentUserId;
    if (filter === "unassigned") return !job.assigned_user_id;
    return true;
  });

  // Group jobs by status
  const jobsByStatus = JOB_STATUSES.reduce(
    (acc, status) => {
      acc[status] = filteredJobs.filter((job) => job.status === status);
      return acc;
    },
    {} as Record<JobStatus, JobWithCustomer[]>
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    const job = jobs.find((j) => j.id === event.active.id);
    if (job) setActiveJob(job);
  }, [jobs]);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const { active, over } = event;
      setActiveJob(null);

      if (!over) return;

      const jobId = active.id as string;
      const newStatus = over.id as JobStatus;

      // Find the job and check if status changed
      const job = jobs.find((j) => j.id === jobId);
      if (!job || job.status === newStatus) return;

      // Optimistically update UI
      setJobs((prev) =>
        prev.map((j) => (j.id === jobId ? { ...j, status: newStatus } : j))
      );

      // Update in database
      const { error } = await supabase
        .from("jobs")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", jobId);

      if (error) {
        // Revert on error
        setJobs((prev) =>
          prev.map((j) => (j.id === jobId ? { ...j, status: job.status } : j))
        );
        addToast("Failed to update job status", "error");
      }
    },
    [jobs, supabase, addToast]
  );

  const handleJobCreated = useCallback((newJob: JobWithCustomer) => {
    setJobs((prev) => [newJob, ...prev]);
    setNewJobOpen(false);
    addToast("Job created!", "success");
  }, [addToast]);

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Board</h1>
          <p className="text-sm text-muted-foreground">
            {jobs.length} job{jobs.length !== 1 ? "s" : ""} total
          </p>
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
          <Button onClick={() => setNewJobOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Job
          </Button>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto p-4">
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
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
          >
            <div className="flex h-full gap-4">
              {JOB_STATUSES.map((status) => (
                <BoardColumn
                  key={status}
                  id={status}
                  title={JOB_STATUS_LABELS[status]}
                  jobs={jobsByStatus[status]}
                  count={jobsByStatus[status].length}
                />
              ))}
            </div>

            <DragOverlay>
              {activeJob && (
                <div className="drag-overlay">
                  <JobCard job={activeJob} />
                </div>
              )}
            </DragOverlay>
          </DndContext>
        )}
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

