"use client";

import { useState } from "react";
import { formatDate, formatTime } from "@/lib/utils";
import type { Job, Customer } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Calendar, Clock, MapPin } from "lucide-react";

type JobWithCustomer = Job & { customer: Customer | null };

interface PublicScheduleViewProps {
  job: JobWithCustomer;
  jobId: string;
}

export function PublicScheduleView({ job: initialJob, jobId }: PublicScheduleViewProps) {
  const [job, setJob] = useState(initialJob);
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(job.status === "scheduled");
  const [error, setError] = useState("");

  const address = [job.address1, job.city, job.state, job.zip]
    .filter(Boolean)
    .join(", ");

  async function handleConfirm() {
    setConfirming(true);
    setError("");

    try {
      const response = await fetch(`/api/jobs/${jobId}/schedule/accept`, {
        method: "POST",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to confirm schedule");
      }

      setConfirmed(true);
      setJob((prev) => ({
        ...prev,
        status: "scheduled",
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setConfirming(false);
    }
  }

  if (confirmed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-100 via-stone-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Schedule Confirmed!</h1>
            <p className="text-muted-foreground mb-6">
              Thank you for confirming. We'll see you on{" "}
              {job.scheduled_date && formatDate(job.scheduled_date)}
              {job.scheduled_time && ` at ${formatTime(job.scheduled_time)}`}.
            </p>
            <div className="text-sm text-muted-foreground">
              If you need to make any changes, please contact us directly.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!job.scheduled_date) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-100 via-stone-50 to-white flex items-center justify-center p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-8">
            <h1 className="text-2xl font-bold mb-2">Schedule Not Set</h1>
            <p className="text-muted-foreground">
              This job hasn't been scheduled yet. Please contact us for more information.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-stone-50 to-white">
      <main className="max-w-2xl mx-auto p-4 py-8 space-y-6">
        {/* Summary Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              Confirm Your Scheduled Appointment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {job.customer && (
              <div>
                <p className="text-sm text-muted-foreground">Customer</p>
                <p className="font-medium">{job.customer.name}</p>
              </div>
            )}
            {address && (
              <div className="flex items-start gap-2">
                <MapPin className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Location</p>
                  <p className="font-medium">{address}</p>
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
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium text-lg">
                  {formatDate(job.scheduled_date)}
                </p>
              </div>
            </div>
            {job.scheduled_time && (
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Time</p>
                  <p className="font-medium text-lg">
                    {formatTime(job.scheduled_time)}
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Confirm Button */}
        <div className="space-y-3">
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
          <Button
            size="lg"
            className="w-full"
            onClick={handleConfirm}
            loading={confirming}
          >
            Confirm Schedule
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            By confirming, you agree to this scheduled time. If you need to reschedule,
            please contact us directly.
          </p>
        </div>
      </main>
    </div>
  );
}
