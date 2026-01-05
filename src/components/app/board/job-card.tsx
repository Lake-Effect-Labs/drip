"use client";

import { useDraggable } from "@dnd-kit/core";
import Link from "next/link";
import { cn, formatDate } from "@/lib/utils";
import type { Job, Customer } from "@/types/database";
import { Calendar, MapPin, User } from "lucide-react";

type JobWithCustomer = Job & { customer: Customer | null };

interface JobCardProps {
  job: JobWithCustomer;
}

export function JobCard({ job }: JobCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: job.id,
    });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  const address = [job.address1, job.city, job.state]
    .filter(Boolean)
    .join(", ");

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={cn(
        "cursor-grab rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing",
        isDragging && "opacity-50"
      )}
    >
      <Link href={`/app/jobs/${job.id}`} className="block">
        <h4 className="font-medium text-foreground line-clamp-1">{job.title}</h4>

        {job.customer && (
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            <span className="line-clamp-1">{job.customer.name}</span>
          </div>
        )}

        {address && (
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            <span className="line-clamp-1">{address}</span>
          </div>
        )}

        {job.scheduled_date && (
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{formatDate(job.scheduled_date)}</span>
          </div>
        )}
      </Link>
    </div>
  );
}

