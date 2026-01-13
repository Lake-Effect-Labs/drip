"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { useRef } from "react";
import { cn, formatDate } from "@/lib/utils";
import type { Job, Customer } from "@/types/database";
import { Calendar, MapPin, User } from "lucide-react";

type JobWithCustomer = Job & { customer: Customer | null };

interface JobCardProps {
  job: JobWithCustomer;
}

export function JobCard({ job }: JobCardProps) {
  const router = useRouter();
  const dragStartPos = useRef<{ x: number; y: number } | null>(null);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({
      id: job.id,
    });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const address = [job.address1, job.city, job.state]
    .filter(Boolean)
    .join(", ");

  const handleMouseDown = (e: React.MouseEvent) => {
    dragStartPos.current = { x: e.clientX, y: e.clientY };
  };

  const handleClick = (e: React.MouseEvent) => {
    // If we're dragging, don't navigate
    if (isDragging) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Check if mouse moved significantly (was a drag, not a click)
    if (dragStartPos.current) {
      const deltaX = Math.abs(e.clientX - dragStartPos.current.x);
      const deltaY = Math.abs(e.clientY - dragStartPos.current.y);
      
      // If moved more than 5px, it was a drag
      if (deltaX > 5 || deltaY > 5) {
        e.preventDefault();
        e.stopPropagation();
        dragStartPos.current = null;
        return;
      }
    }

    // It was a click, navigate
    router.push(`/app/jobs/${job.id}`);
    dragStartPos.current = null;
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "cursor-grab rounded-lg border bg-card p-3 shadow-sm transition-all hover:shadow-md active:cursor-grabbing select-none",
        isDragging && "opacity-40 scale-105"
      )}
      {...listeners}
      {...attributes}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
    >
      <div className="block select-none">
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
      </div>
    </div>
  );
}

