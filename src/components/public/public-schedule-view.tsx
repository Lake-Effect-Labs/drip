"use client";

import { formatDate, formatTime } from "@/lib/utils";
import type { Job, Customer, Company } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, MapPin, Paintbrush } from "lucide-react";
import { PaintChipAnimator } from "@/components/public/paint-chip-animator";

type JobWithCustomer = Job & { 
  customer: Customer | null;
  company: Pick<Company, "name" | "logo_url"> | null;
};

interface PublicScheduleViewProps {
  job: JobWithCustomer;
  token: string;
}

export function PublicScheduleView({ job: initialJob, token }: PublicScheduleViewProps) {
  const address = [initialJob.address1, initialJob.city, initialJob.state, initialJob.zip]
    .filter(Boolean)
    .join(", ");

  if (!initialJob.scheduled_date) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-100 via-stone-50 to-white flex items-center justify-center p-4 relative">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <h1 className="text-2xl font-bold mb-2">Schedule Not Set</h1>
            <p className="text-muted-foreground">
              This job hasn't been scheduled yet. Please contact us for more information.
            </p>
          </CardContent>
        </Card>
        <PaintChipAnimator />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-stone-50 to-white relative">
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center gap-3">
          {(initialJob.company as any)?.logo_url ? (
            <img 
              src={(initialJob.company as any).logo_url} 
              alt={initialJob.company?.name || "Company Logo"}
              className="w-10 h-10 rounded-lg object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-stone-800 flex items-center justify-center">
              <Paintbrush className="w-5 h-5 text-white" />
            </div>
          )}
          <div>
            <span className="font-bold">{initialJob.company?.name}</span>
            <p className="text-xs text-muted-foreground">Schedule</p>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-4 py-8 space-y-6">
        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              Scheduled Appointment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {initialJob.customer && (
              <div>
                <p className="text-sm text-muted-foreground">Customer</p>
                <p className="font-medium">{initialJob.customer.name}</p>
              </div>
            )}
            {address && (
              <div className="flex items-start gap-2 min-w-0">
                <MapPin className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-medium break-words">{address}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Schedule Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Scheduled Time</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3 min-w-0">
              <Calendar className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium text-base sm:text-lg break-words">
                  {initialJob.scheduled_end_date && initialJob.scheduled_end_date !== initialJob.scheduled_date
                    ? `${formatDate(initialJob.scheduled_date)} - ${formatDate(initialJob.scheduled_end_date)}`
                    : formatDate(initialJob.scheduled_date)}
                </p>
              </div>
            </div>
            {initialJob.scheduled_time && (
              <div className="flex items-start gap-3 min-w-0">
                <Clock className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground">
                    {initialJob.scheduled_end_date && initialJob.scheduled_end_date !== initialJob.scheduled_date
                      ? "Daily Arrival Time"
                      : "Time"}
                  </p>
                  <p className="font-medium text-base sm:text-lg">
                    {formatTime(initialJob.scheduled_time)}
                  </p>
                  {initialJob.scheduled_end_date && initialJob.scheduled_end_date !== initialJob.scheduled_date && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Our crew will arrive at this time each day
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="text-center py-4">
          <p className="text-sm text-muted-foreground">
            If you need to make any changes to this schedule, please contact {initialJob.company?.name} directly.
          </p>
        </div>
      </main>

      <PaintChipAnimator />
    </div>
  );
}
