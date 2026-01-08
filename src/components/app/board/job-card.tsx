"use client";

import { useDraggable } from "@dnd-kit/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn, formatDate, type JobStatus } from "@/lib/utils";
import type { Job, Customer } from "@/types/database";
import { Calendar, MapPin, User, Archive, CheckCircle, Phone, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";

type JobWithCustomer = Job & { customer: Customer | null };

interface JobCardProps {
  job: JobWithCustomer;
  onStatusChange?: (jobId: string, newStatus: JobStatus) => void;
  onDuplicate?: (jobId: string) => void;
}

export function JobCard({ job, onStatusChange, onDuplicate }: JobCardProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const supabase = createClient();

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

  const handleStatusChange = async (newStatus: JobStatus) => {
    if (onStatusChange) {
      onStatusChange(job.id, newStatus);
    } else {
      const { error } = await supabase
        .from("jobs")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", job.id);

      if (error) {
        addToast("Failed to update status", "error");
      } else {
        addToast("Status updated!", "success");
        router.refresh();
      }
    }
  };

  const handleDuplicate = async () => {
    if (onDuplicate) {
      onDuplicate(job.id);
      return;
    }

    try {
      const { data: newJob, error } = await supabase
        .from("jobs")
        .insert({
          company_id: job.company_id,
          customer_id: job.customer_id,
          title: `${job.title} (Copy)`,
          address1: job.address1,
          address2: job.address2,
          city: job.city,
          state: job.state,
          zip: job.zip,
          notes: job.notes,
          status: "new",
        })
        .select("*, customer:customers(*)")
        .single();

      if (error) throw error;
      addToast("Job duplicated!", "success");
      router.push(`/app/jobs/${newJob.id}`);
    } catch (error) {
      addToast("Failed to duplicate job", "error");
    }
  };

  const handleCall = () => {
    if (job.customer?.phone) {
      window.location.href = `tel:${job.customer.phone}`;
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "cursor-grab rounded-lg border bg-card p-3 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing",
        isDragging && "opacity-50"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/app/jobs/${job.id}`} className="flex-1 block" {...listeners} {...attributes}>
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

        {/* Long-press menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="touch-target min-h-[44px] min-w-[44px] flex items-center justify-center text-muted-foreground hover:text-foreground"
              onClick={(e) => e.preventDefault()}
            >
              <MoreVertical className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {job.status !== "done" && job.status !== "paid" && (
              <DropdownMenuItem onClick={() => handleStatusChange("done")}>
                <CheckCircle className="mr-2 h-4 w-4" />
                Mark Complete
              </DropdownMenuItem>
            )}
            {job.status !== "archive" && (
              <DropdownMenuItem onClick={() => handleStatusChange("archive")}>
                <Archive className="mr-2 h-4 w-4" />
                Archive
              </DropdownMenuItem>
            )}
            {job.customer?.phone && (
              <DropdownMenuItem onClick={handleCall}>
                <Phone className="mr-2 h-4 w-4" />
                Call Customer
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={handleDuplicate}>
              Duplicate Job
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

