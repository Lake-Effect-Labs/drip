"use client";

import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { useRef, useEffect } from "react";
import { cn, formatDate } from "@/lib/utils";
import type { Job, Customer } from "@/types/database";
import { Calendar, MapPin, User } from "lucide-react";

type JobWithCustomer = Job & { customer: Customer | null };

interface JobCardProps {
  job: JobWithCustomer;
}

export function JobCard({ job }: JobCardProps) {
  const router = useRouter();
  const wasDragging = useRef(false);
  const clickTimer = useRef<NodeJS.Timeout | null>(null);

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

  // Track dragging state - when drag starts, mark that we were dragging
  useEffect(() => {
    if (isDragging) {
      // Drag started - mark that we're dragging and clear any pending timer
      wasDragging.current = true;
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
        clickTimer.current = null;
      }
    } else if (wasDragging.current) {
      // Drag ended - delay reset to prevent click from firing immediately after drag
      clickTimer.current = setTimeout(() => {
        wasDragging.current = false;
        clickTimer.current = null;
      }, 150);
    }

    // Cleanup timer on unmount
    return () => {
      if (clickTimer.current) {
        clearTimeout(clickTimer.current);
        clickTimer.current = null;
      }
    };
  }, [isDragging]);

  const handleClick = (e: React.MouseEvent) => {
    // Don't navigate if we just dragged
    if (isDragging || wasDragging.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // It was a click, navigate
    router.push(`/app/jobs/${job.id}`);
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

