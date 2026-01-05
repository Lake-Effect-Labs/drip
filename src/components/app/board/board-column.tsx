"use client";

import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";
import type { Job, Customer } from "@/types/database";
import { JobCard } from "./job-card";

type JobWithCustomer = Job & { customer: Customer | null };

interface BoardColumnProps {
  id: string;
  title: string;
  jobs: JobWithCustomer[];
  count: number;
}

export function BoardColumn({ id, title, jobs, count }: BoardColumnProps) {
  const { setNodeRef, isOver } = useDroppable({
    id,
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "board-column flex w-72 flex-shrink-0 flex-col rounded-lg bg-muted/50 transition-colors",
        isOver && "bg-muted"
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
      <div className="flex-1 space-y-2 overflow-y-auto p-2 pt-0">
        {jobs.length === 0 ? (
          <div className="flex h-24 items-center justify-center rounded-lg border-2 border-dashed border-muted text-sm text-muted-foreground">
            No jobs
          </div>
        ) : (
          jobs.map((job) => <JobCard key={job.id} job={job} />)
        )}
      </div>
    </div>
  );
}

