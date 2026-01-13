"use client";

import { useState } from "react";
import { formatDate, formatTime } from "@/lib/utils";
import type { Job, Customer, Company } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { CheckCircle, Calendar, Clock, MapPin, Paintbrush, XCircle } from "lucide-react";
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
  const [job, setJob] = useState(initialJob);
  const [confirming, setConfirming] = useState(false);
  const [denying, setDenying] = useState(false);
  const [confirmed, setConfirmed] = useState((job as any).schedule_state === "accepted" || job.status === "scheduled");
  const [denied, setDenied] = useState((job as any).schedule_state === "denied");
  const [error, setError] = useState("");
  const [showDenyDialog, setShowDenyDialog] = useState(false);
  const [denialReason, setDenialReason] = useState("");

  const address = [job.address1, job.city, job.state, job.zip]
    .filter(Boolean)
    .join(", ");

  async function handleConfirm() {
    setConfirming(true);
    setError("");

    try {
      const response = await fetch(`/api/schedules/${token}/accept`, {
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
        schedule_state: "accepted",
        schedule_accepted_at: new Date().toISOString(),
      } as any));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setConfirming(false);
    }
  }

  async function handleDeny() {
    setDenying(true);
    setError("");
    setShowDenyDialog(false);

    try {
      const response = await fetch(`/api/schedules/${token}/deny`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: denialReason || null }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to deny schedule");
      }

      setDenied(true);
      setJob((prev) => ({
        ...prev,
        schedule_state: "denied",
        schedule_denied_at: new Date().toISOString(),
      } as any));
      setDenialReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setDenying(false);
    }
  }

  if (confirmed) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-100 via-stone-50 to-white flex items-center justify-center p-4 relative">
        <PaintChipAnimator />
        <Card className="w-full max-w-md text-center relative z-20">
          <CardContent className="pt-8 pb-8">
            <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Schedule Confirmed!</h1>
            <p className="text-muted-foreground mb-6">
              Thank you for confirming. {job.company?.name} will see you{" "}
              {job.scheduled_date && job.scheduled_end_date && job.scheduled_end_date !== job.scheduled_date ? (
                <>
                  from {formatDate(job.scheduled_date)} to {formatDate(job.scheduled_end_date)}
                  {job.scheduled_time && (
                    <>. Our crew will arrive at {formatTime(job.scheduled_time)} each day</>
                  )}
                </>
              ) : (
                <>
                  on {job.scheduled_date && formatDate(job.scheduled_date)}
                  {job.scheduled_time && ` at ${formatTime(job.scheduled_time)}`}
                </>
              )}
              .
            </p>
            <div className="text-sm text-muted-foreground">
              If you need to make any changes, please contact us directly.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (denied) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-stone-100 via-stone-50 to-white flex items-center justify-center p-4 relative">
        <PaintChipAnimator />
        <Card className="w-full max-w-md text-center relative z-20">
          <CardContent className="pt-8 pb-8">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-4">
              <XCircle className="w-8 h-8 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Schedule Denied</h1>
            <p className="text-muted-foreground mb-6">
              We've received your response. Please contact {job.company?.name} to discuss alternative scheduling options.
            </p>
            <div className="text-sm text-muted-foreground">
              We'll work with you to find a time that works better.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!job.scheduled_date) {
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
          {(job.company as any)?.logo_url ? (
            <img 
              src={(job.company as any).logo_url} 
              alt={job.company?.name || "Company Logo"}
              className="w-10 h-10 rounded-lg object-cover"
            />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-stone-800 flex items-center justify-center">
              <Paintbrush className="w-5 h-5 text-white" />
            </div>
          )}
          <div>
            <span className="font-bold">{job.company?.name}</span>
            <p className="text-xs text-muted-foreground">Schedule Confirmation</p>
          </div>
        </div>
      </header>

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
                  {job.scheduled_end_date && job.scheduled_end_date !== job.scheduled_date
                    ? `${formatDate(job.scheduled_date)} - ${formatDate(job.scheduled_end_date)}`
                    : formatDate(job.scheduled_date)}
                </p>
              </div>
            </div>
            {job.scheduled_time && (
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">
                    {job.scheduled_end_date && job.scheduled_end_date !== job.scheduled_date
                      ? "Daily Arrival Time"
                      : "Time"}
                  </p>
                  <p className="font-medium text-lg">
                    {formatTime(job.scheduled_time)}
                  </p>
                  {job.scheduled_end_date && job.scheduled_end_date !== job.scheduled_date && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Our crew will arrive at this time each day
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="space-y-3">
          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}
          <div className="flex gap-3">
            <Button
              size="lg"
              variant="outline"
              className="flex-1"
              onClick={() => setShowDenyDialog(true)}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Deny Schedule
            </Button>
            <Button
              size="lg"
              className="flex-1"
              onClick={handleConfirm}
              loading={confirming}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              Confirm Schedule
            </Button>
          </div>
          <p className="text-xs text-center text-muted-foreground">
            By confirming, you agree to this scheduled time. If this time doesn't work,
            please deny and contact us to reschedule.
          </p>
        </div>
      </main>

      {/* Deny Dialog */}
      <Dialog open={showDenyDialog} onOpenChange={setShowDenyDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline This Schedule?</DialogTitle>
            <DialogDescription>
              Let {job.company?.name} know why this time doesn't work. They may be able to adjust the schedule to better meet your needs.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason for declining (optional)</Label>
              <Textarea
                id="reason"
                placeholder="e.g., Time doesn't work, need different dates, prefer morning/afternoon..."
                value={denialReason}
                onChange={(e) => setDenialReason(e.target.value)}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                Your feedback helps {job.company?.name} provide better service.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDenyDialog(false);
                setDenialReason("");
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeny}
              loading={denying}
            >
              Decline Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PaintChipAnimator />
    </div>
  );
}
