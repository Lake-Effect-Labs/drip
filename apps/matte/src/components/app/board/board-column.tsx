"use client";

import { useDroppable } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn, type JobStatus } from "@/lib/utils";
import type { Job, Customer } from "@drip/core/types";
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
        "board-column flex w-full md:w-72 max-h-[400px] md:h-full md:flex-shrink-0 flex-col rounded-lg bg-muted/50 transition-all duration-200",
        isOver && "bg-primary/10 ring-2 ring-primary shadow-lg scale-[1.02]"
      )}
    >
      {/* Column header */}
      <div className="flex items-center justify-between p-3 flex-shrink-0">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-muted px-1.5 text-xs font-medium text-muted-foreground">
          {count}
        </span>
      </div>

      {/* Cards */}
      <div className={cn(
        "flex-1 overflow-y-auto p-2 pt-0 min-h-[200px] rounded-lg transition-all",
        isOver && jobs.length > 0 && "bg-primary/5 ring-2 ring-primary ring-inset"
      )}>
        <SortableContext items={jobIds} strategy={verticalListSortingStrategy}>
          {jobs.length === 0 ? (
            <div className={cn(
              "flex h-full min-h-[180px] items-center justify-center rounded-lg border-2 border-dashed transition-all",
              isOver
                ? "border-primary bg-primary/5 text-primary font-medium"
                : "border-muted text-muted-foreground"
            )}>
              Drop here
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

