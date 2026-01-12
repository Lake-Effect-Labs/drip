"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn, type JobStatus } from "@/lib/utils";
import type { Job, Customer } from "@/types/database";
import { JobCard } from "./job-card";

type JobWithCustomer = Job & { customer: Customer | null };

interface BoardColumnProps {
  id: string;
  title: string;
  jobs: JobWithCustomer[];
  count: number;
  onStatusChange?: (jobId: string, newStatus: JobStatus) => void;
  onDuplicate?: (jobId: string) => void;
}

export function BoardColumn({ id, title, jobs, count, onStatusChange, onDuplicate }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  const jobIds = jobs.map((job) => job.id);

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "board-column flex w-72 flex-shrink-0 flex-col rounded-lg bg-muted/50 transition-colors",
        isOver && "bg-muted ring-2 ring-primary ring-offset-2"
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between p-3">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
          {count}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 overflow-y-auto p-2 pt-0 min-h-[200px]">
        <SortableContext items={jobIds} strategy={verticalListSortingStrategy}>
          {jobs.length === 0 ? (
            <div className="flex h-24 items-center justify-center rounded-lg border-2 border-dashed border-muted text-sm text-muted-foreground pointer-events-none">
              No jobs
            </div>
          ) : (
            <div className="space-y-2">
              {jobs.map((job) => (
                <JobCard
                  key={job.id}
                  job={job}
                />
              ))}
            </div>
          )}
        </SortableContext>
      </div>
    </div>
  );
}

