"use client";

import { formatDate, formatTime } from "@/lib/utils";
import { JOB_STATUS_LABELS } from "@/lib/utils";
import { Clock, CheckCircle } from "lucide-react";
import type { JobHistory } from "@/types/database";

interface JobHistoryTimelineProps {
  history: JobHistory[];
}

export function JobHistoryTimeline({ history }: JobHistoryTimelineProps) {
  if (history.length === 0) {
    return (
      <div className="p-4 text-center text-muted-foreground text-sm">
        No history yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {history.map((item, index) => (
        <div key={item.id} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              {item.status === "done" || item.status === "paid" ? (
                <CheckCircle className="h-4 w-4 text-success" />
              ) : (
                <Clock className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            {index < history.length - 1 && (
              <div className="w-0.5 h-full bg-border mt-2" />
            )}
          </div>
          <div className="flex-1 pb-4">
            <div className="flex items-center gap-2">
              <span className="font-medium">
                {JOB_STATUS_LABELS[item.status as keyof typeof JOB_STATUS_LABELS] || item.status}
              </span>
              <span className="text-sm text-muted-foreground">
                {formatDate(item.changed_at)} {formatTime(new Date(item.changed_at).toISOString().split('T')[1].split('.')[0])}
              </span>
            </div>
            {item.notes && (
              <p className="text-sm text-muted-foreground mt-1">{item.notes}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
