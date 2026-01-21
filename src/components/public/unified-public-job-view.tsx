"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { createBrowserClient } from "@supabase/ssr";
import type { Job, Customer, Company, Estimate, EstimateLineItem, EstimateMaterial, Invoice, JobPhoto } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Paintbrush,
  CheckCircle,
  MapPin,
  User,
  Calendar,
  Clock,
  DollarSign,
  FileText,
  TrendingUp,
  XCircle,
  CreditCard,
  Wallet,
  Smartphone,
  Star,
  ExternalLink,
  Camera,
  X,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { PaintChipAnimator } from "@/components/public/paint-chip-animator";
import { EstimateSignoff } from "@/components/public/estimate-signoff";

type JobWithDetails = Job & {
  customer: Customer | null;
  company: (Pick<Company, "name"> & {
    logo_url?: string | null;
    contact_phone?: string | null;
    contact_email?: string | null;
    review_enabled?: boolean;
    google_review_link?: string | null;
  }) | null;
  estimate: (Estimate & {
    line_items: EstimateLineItem[];
    materials: EstimateMaterial[];
  }) | null;
  invoice: Invoice | null;
  payment_line_items?: Array<{
    id: string;
    title: string;
    price: number; // in cents
  }>;
  photos?: JobPhoto[];
};

interface UnifiedPublicJobViewProps {
  job: JobWithDetails;
  token: string;
  isPaymentToken?: boolean;
}

export function UnifiedPublicJobView({ job: initialJob, token, isPaymentToken = false }: UnifiedPublicJobViewProps) {
  const searchParams = useSearchParams();
  const [job, setJob] = useState(initialJob);
  
  // Determine initial tab from URL query param, or default based on job state
  const getInitialTab = () => {
    const tabParam = searchParams?.get("tab");
    if (tabParam === "payment" || tabParam === "estimate" || tabParam === "schedule" || tabParam === "progress" || tabParam === "photos") {
      return tabParam;
    }
    // If this is a payment token or payment is due, default to payment tab
    if (isPaymentToken || job.payment_state === "due" || job.payment_state === "paid") {
      return "payment";
    }
    return initialJob.estimate ? "estimate" : "schedule";
  };

  const [activeTab, setActiveTab] = useState(getInitialTab());
  const [acceptingEstimate, setAcceptingEstimate] = useState(false);

  // Photo lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Group photos by tag
  const photos = job.photos || [];
  const beforePhotos = photos.filter(p => p.tag === "before");
  const afterPhotos = photos.filter(p => p.tag === "after");
  const progressPhotos = photos.filter(p => p.tag === "progress" || p.tag === "other" || !p.tag);

  const router = useRouter();

  // Real-time subscription for updates from painter
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Subscribe to job updates (schedule, progress, payment status)
    const jobChannel = supabase
      .channel(`public-job-${job.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `id=eq.${job.id}`,
        },
        (payload) => {
          console.log('[Customer Portal] Job updated:', payload);
          // Refresh the page to get updated data
          router.refresh();
        }
      )
      .subscribe();

    // Subscribe to estimate updates
    const estimateChannel = job.estimate?.id ? supabase
      .channel(`public-estimate-${job.estimate.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'estimates',
          filter: `job_id=eq.${job.id}`,
        },
        (payload) => {
          console.log('[Customer Portal] Estimate updated:', payload);
          router.refresh();
        }
      )
      .subscribe() : null;

    // Subscribe to new estimates (for revisions)
    const newEstimateChannel = supabase
      .channel(`public-new-estimates-${job.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'estimates',
          filter: `job_id=eq.${job.id}`,
        },
        (payload) => {
          console.log('[Customer Portal] New estimate created:', payload);
          router.refresh();
        }
      )
      .subscribe();

    // Subscribe to photo updates
    const photoChannel = supabase
      .channel(`public-photos-${job.id}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_photos',
          filter: `job_id=eq.${job.id}`,
        },
        (payload) => {
          console.log('[Customer Portal] Photos updated:', payload);
          router.refresh();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(jobChannel);
      if (estimateChannel) supabase.removeChannel(estimateChannel);
      supabase.removeChannel(newEstimateChannel);
      supabase.removeChannel(photoChannel);
    };
  }, [job.id, job.estimate?.id, router]);

  const [denyingEstimate, setDenyingEstimate] = useState(false);
  const [confirmingSchedule, setConfirmingSchedule] = useState(false);
  const [denyingSchedule, setDenyingSchedule] = useState(false);
  const [updatingProgress, setUpdatingProgress] = useState(false);
  const [showDenyEstimateDialog, setShowDenyEstimateDialog] = useState(false);
  const [showDenyScheduleDialog, setShowDenyScheduleDialog] = useState(false);
  const [denialReason, setDenialReason] = useState("");
  const [showSignoff, setShowSignoff] = useState(
    job.estimate?.requires_signoff && !job.estimate?.signoff_completed_at
  );

  // Determine job status
  const isJobDone = job.status === "done" || job.status === "paid" || job.status === "archive";
  const estimateAccepted = job.estimate?.status === "accepted";
  const scheduleAccepted = (job as any).schedule_state === "accepted";
  const paymentPaid = job.payment_state === "paid";
  const [confirmingPayment, setConfirmingPayment] = useState(false);
  const [processingStripe, setProcessingStripe] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string | null>(null);

  const address = [job.address1, job.city, job.state, job.zip]
    .filter(Boolean)
    .join(", ");

  // Calculate total amount - prefer payment_amount, then payment_line_items, then estimate
  const totalAmount = job.payment_amount || 
    (job.payment_line_items?.reduce((sum, item) => sum + item.price, 0) || 0) ||
    (job.estimate 
      ? (job.estimate.labor_total || job.estimate.line_items.reduce((sum, li) => sum + li.price, 0))
      : 0);

  // Get available payment methods (default to cash, check, venmo, stripe if not set)
  const availableMethods = (job as any).payment_methods || ["cash", "check", "venmo", "stripe"];

  // Check URL params for Stripe success
  useEffect(() => {
    if (typeof window !== "undefined" && !paymentPaid) {
      const params = new URLSearchParams(window.location.search);
      if (params.get("success") === "true") {
        // Payment succeeded via Stripe - reload to show updated state
        window.location.reload();
      }
    }
  }, [paymentPaid]);

  async function handleMarkPaid(method: string) {
    setConfirmingPayment(true);
    setSelectedPaymentMethod(method);
    try {
      const response = await fetch(`/api/payments/${token}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payment_method: method }),
      });

      if (!response.ok) {
        throw new Error("Failed to mark payment as paid");
      }

      // Reload to show updated state
      window.location.reload();
    } catch (error) {
      console.error("Error marking payment as paid:", error);
      alert("Failed to mark payment as paid. Please try again.");
    } finally {
      setConfirmingPayment(false);
      setSelectedPaymentMethod(null);
    }
  }

  async function handleStripePayment() {
    setProcessingStripe(true);
    try {
      const response = await fetch(`/api/payments/${token}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create payment session");
      }

      const { url } = await response.json();
      if (url) {
        window.location.href = url;
      }
    } catch (error) {
      console.error("Error creating Stripe checkout:", error);
      alert(error instanceof Error ? error.message : "Failed to process payment. Please try again.");
      setProcessingStripe(false);
    }
  }

  function getPaymentMethodIcon(method: string) {
    switch (method) {
      case "stripe":
        return <CreditCard className="h-5 w-5" />;
      case "cash":
        return <DollarSign className="h-5 w-5" />;
      case "check":
        return <FileText className="h-5 w-5" />;
      case "venmo":
        return <Smartphone className="h-5 w-5" />;
      default:
        return <Wallet className="h-5 w-5" />;
    }
  }

  function getPaymentMethodLabel(method: string) {
    switch (method) {
      case "stripe":
        return "Pay Online with Card";
      case "cash":
        return "I Paid with Cash";
      case "check":
        return "I Paid with Check";
      case "venmo":
        return "I Paid via Venmo";
      default:
        return `I Paid via ${method}`;
    }
  }

  // Handle estimate acceptance
  async function handleAcceptEstimate() {
    if (!job.estimate) return;
    setAcceptingEstimate(true);
    try {
      const response = await fetch(`/api/estimates/${job.estimate.public_token}/accept`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to accept estimate");
      
      // Reload page to show updated unified view (stays on same URL)
      window.location.reload();
    } catch (err) {
      console.error("Failed to accept estimate:", err);
      alert("Failed to accept estimate. Please try again.");
      setAcceptingEstimate(false);
    }
  }

  // Handle estimate denial
  async function handleDenyEstimate() {
    if (!job.estimate) return;
    setDenyingEstimate(true);
    setShowDenyEstimateDialog(false);
    try {
      const response = await fetch(`/api/estimates/${job.estimate.public_token}/deny`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: denialReason || null }),
      });
      if (!response.ok) throw new Error("Failed to deny estimate");
      
      setJob(prev => ({
        ...prev,
        estimate: prev.estimate ? {
          ...prev.estimate,
          status: "denied",
          denied_at: new Date().toISOString(),
          denial_reason: denialReason || null,
        } : null,
      }));
      setDenialReason("");
    } catch (err) {
      console.error("Failed to deny estimate:", err);
      alert("Failed to deny estimate. Please try again.");
    } finally {
      setDenyingEstimate(false);
    }
  }

  // Handle schedule confirmation
  async function handleConfirmSchedule() {
    setConfirmingSchedule(true);
    try {
      const response = await fetch(`/api/schedules/${token}/accept`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to confirm schedule");
      
      setJob(prev => ({
        ...prev,
        status: "scheduled",
        schedule_state: "accepted",
        schedule_accepted_at: new Date().toISOString(),
      } as any));
    } catch (err) {
      console.error("Failed to confirm schedule:", err);
      alert("Failed to confirm schedule. Please try again.");
    } finally {
      setConfirmingSchedule(false);
    }
  }

  // Handle schedule denial
  async function handleDenySchedule() {
    setDenyingSchedule(true);
    setShowDenyScheduleDialog(false);
    try {
      const response = await fetch(`/api/schedules/${token}/deny`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: denialReason || null }),
      });
      if (!response.ok) throw new Error("Failed to deny schedule");
      
      setJob(prev => ({
        ...prev,
        schedule_state: "denied",
        schedule_denied_at: new Date().toISOString(),
      } as any));
      setDenialReason("");
    } catch (err) {
      console.error("Failed to deny schedule:", err);
      alert("Failed to deny schedule. Please try again.");
    } finally {
      setDenyingSchedule(false);
    }
  }

  function handleSignoffComplete() {
    setShowSignoff(false);
    setJob(prev => ({
      ...prev,
      estimate: prev.estimate ? {
        ...prev.estimate,
        signoff_completed_at: new Date().toISOString(),
      } : null,
    }));
  }

  // Progress is read-only for customers (company updates it via Matte)
  const progressPercentage = job.progress_percentage || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-stone-50 to-white relative">
      <PaintChipAnimator />
      
      {/* Header */}
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-3">
            {job.company?.logo_url ? (
              <img 
                src={job.company.logo_url} 
                alt={job.company.name || "Company Logo"}
                className="w-10 h-10 rounded-lg object-cover"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-stone-800 flex items-center justify-center">
                <Paintbrush className="w-5 h-5 text-white" />
              </div>
            )}
            <div className="flex-1">
              <span className="font-bold">{job.company?.name}</span>
              <p className="text-xs text-muted-foreground">{job.title}</p>
            </div>
            {isJobDone && (
              <Badge variant="success" className="ml-auto">
                <CheckCircle className="w-3 h-3 mr-1" />
                Completed
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 py-8">
        {/* Customer Name and Address - Above progress bar */}
        <Card className="mb-6">
          <CardContent className="pt-6 space-y-4">
            {job.customer && (
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span>{job.customer.name}</span>
              </div>
            )}
            {address && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                <span>{address}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Progress Tracker - Always visible at top */}
        {!isJobDone && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Job Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Completion</span>
                  <span className="font-medium">{progressPercentage}%</span>
                </div>
                <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-primary h-full transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground text-center">
                  Progress is updated by {job.company?.name} as work progresses
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs for different sections */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={`grid w-full mb-6 ${
            job.estimate && photos.length > 0 ? "grid-cols-4" :
            job.estimate || photos.length > 0 ? "grid-cols-3" : "grid-cols-2"
          }`}>
            {job.estimate && <TabsTrigger value="estimate">Estimate</TabsTrigger>}
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            {photos.length > 0 && (
              <TabsTrigger value="photos" className="gap-1">
                <Camera className="h-4 w-4" />
                <span className="hidden sm:inline">Photos</span>
                <span className="sm:hidden">Photos</span>
              </TabsTrigger>
            )}
            <TabsTrigger value="payment">Payment</TabsTrigger>
          </TabsList>

          {/* Estimate Tab */}
          {job.estimate && (
            <TabsContent value="estimate" className="space-y-6">
              {showSignoff ? (
                <EstimateSignoff 
                  estimate={{
                    ...job.estimate,
                    customer: job.customer,
                    job: job,
                  }} 
                  token={token}
                  onSignoffComplete={handleSignoffComplete}
                  companyLogo={job.company?.logo_url}
                  companyName={job.company?.name}
                />
              ) : (
                <>
                  <Card>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>Estimate Details</CardTitle>
                          {job.estimate.created_at && (
                            <p className="text-sm text-muted-foreground mt-1">
                              Created {formatDate(job.estimate.created_at)}
                            </p>
                          )}
                        </div>
                        <Badge variant={estimateAccepted ? "success" : "secondary"}>
                          {estimateAccepted ? "Accepted" : job.estimate.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y">
                        {job.estimate.line_items.map((item) => {
                          const hasPaintDetails = item.product_line || item.paint_color_name_or_code || item.sheen || item.gallons_estimate;
                          
                          // Parse notes from description field (format: "BRAND:brand|PRODUCT_LINE:line|NOTES:notes")
                          let lineItemNotes: string | null = null;
                          if (item.description) {
                            const notesMatch = item.description.match(/NOTES:([^|]+)/);
                            if (notesMatch) {
                              lineItemNotes = notesMatch[1];
                            }
                          }
                          
                          // Find materials for this line item (match by ID or by area name)
                          // Use more flexible matching to catch variations like "Ceilings" vs "Ceiling"
                          const itemNameLower = item.name?.toLowerCase() || '';
                          const itemMaterials = job.estimate!.materials?.filter(
                            (m: EstimateMaterial) => {
                              // Direct ID match (most reliable)
                              if (m.estimate_line_item_id === item.id) return true;
                              
                              // Area description match (normalize both sides)
                              const areaDescLower = m.area_description?.toLowerCase() || '';
                              if (areaDescLower && itemNameLower) {
                                // Check if either contains the other (handles "Ceilings" vs "Ceiling")
                                if (areaDescLower.includes(itemNameLower) || itemNameLower.includes(areaDescLower)) {
                                  return true;
                                }
                                // Also check for partial matches (e.g., "Interior Walls" contains "Walls")
                                const itemWords = itemNameLower.split(/\s+/);
                                const areaWords = areaDescLower.split(/\s+/);
                                // If any significant word matches, consider it a match
                                if (itemWords.some(word => word.length > 3 && areaWords.includes(word))) {
                                  return true;
                                }
                              }
                              return false;
                            }
                          ) || [];
                          
                          return (
                            <div key={item.id} className="p-4">
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex-1">
                                  <div className="flex items-baseline gap-2">
                                    <p className="font-medium">{item.name}</p>
                                    {item.sqft && (
                                      <span className="text-sm text-muted-foreground">
                                        {item.sqft} sqft
                                        {item.rate_per_sqft && ` @ ${formatCurrency(item.rate_per_sqft)}/sqft`}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <p className="font-medium ml-4 shrink-0">{formatCurrency(item.price)}</p>
                              </div>
                              
                              {/* Materials for this area */}
                              {itemMaterials.length > 0 && (
                                <div className="ml-0 mt-3 space-y-2 border-l-2 border-muted pl-3">
                                  {itemMaterials.map((material: EstimateMaterial) => (
                                    <div key={material.id} className="text-sm">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 text-muted-foreground">
                                          {material.paint_product && (
                                            <div className="font-medium text-foreground">
                                              {material.paint_product}
                                            </div>
                                          )}
                                          {!material.paint_product && material.product_line && (
                                            <div className="font-medium text-foreground">
                                              {material.product_line}
                                            </div>
                                          )}
                                          {!material.paint_product && !material.product_line && (
                                            <div className="font-medium text-foreground">
                                              {material.name}
                                            </div>
                                          )}
                                          <div>
                                            {material.color_name && <span>{material.color_name}</span>}
                                            {material.color_code && <span className="ml-1 text-xs">({material.color_code})</span>}
                                            {material.sheen && (
                                              <span className="ml-1">- {material.sheen}</span>
                                            )}
                                          </div>
                                          {/* Show notes from material or line item */}
                                          {(material.notes || lineItemNotes) && (
                                            <div className="mt-1 text-xs italic text-muted-foreground">
                                              {material.notes || lineItemNotes}
                                            </div>
                                          )}
                                        </div>
                                        {material.quantity_gallons && (
                                          <span className="text-xs text-muted-foreground shrink-0">
                                            {material.quantity_gallons} {material.quantity_gallons === 1 ? 'gallon' : 'gallons'}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                              
                              {/* Show notes if no materials but notes exist */}
                              {itemMaterials.length === 0 && lineItemNotes && (
                                <div className="mt-2 text-sm text-muted-foreground italic border-l-2 border-muted pl-3">
                                  {lineItemNotes}
                                </div>
                              )}
                              
                              {/* Legacy paint details if no materials */}
                              {itemMaterials.length === 0 && hasPaintDetails && (
                                <div className="text-sm text-muted-foreground mt-2 space-y-0.5">
                                  {(item.product_line || item.paint_color_name_or_code || item.sheen) && (
                                    <div>
                                      {item.product_line && <span>{item.product_line} </span>}
                                      {item.paint_color_name_or_code && <span>{item.paint_color_name_or_code} </span>}
                                      {item.sheen && <span>- {item.sheen}</span>}
                                    </div>
                                  )}
                                  {item.gallons_estimate && (
                                    <div>{item.gallons_estimate} gallons</div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="p-4 border-t">
                        <div className="flex justify-between items-center">
                          <span className="font-semibold">Total</span>
                          <span className="text-xl font-bold">{formatCurrency(totalAmount)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Estimate Actions */}
                  {!estimateAccepted && job.estimate.status !== "denied" && (
                    <div className="flex flex-col sm:flex-row gap-3">
                      <Button
                        variant="outline"
                        onClick={() => setShowDenyEstimateDialog(true)}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        Decline Estimate
                      </Button>
                      <Button
                        onClick={handleAcceptEstimate}
                        loading={acceptingEstimate}
                        className="flex-1"
                      >
                        <CheckCircle className="mr-2 h-4 w-4" />
                        Accept Estimate
                      </Button>
                    </div>
                  )}
                </>
              )}
            </TabsContent>
          )}

          {/* Schedule Tab */}
          <TabsContent value="schedule" className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Your Job Schedule</CardTitle>
                  {scheduleAccepted && (
                    <Badge variant="success">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Confirmed
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {job.scheduled_date ? (
                  <>
                    <div className="p-4 rounded-lg bg-muted/30 space-y-3">
                      <div className="flex items-start gap-3">
                        <Calendar className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm text-muted-foreground">
                            {job.scheduled_end_date && job.scheduled_end_date !== job.scheduled_date ? "Date Range" : "Date"}
                          </p>
                          <p className="font-medium text-lg">
                            {job.scheduled_end_date && job.scheduled_end_date !== job.scheduled_date
                              ? `${formatDate(job.scheduled_date)} - ${formatDate(job.scheduled_end_date)}`
                              : formatDate(job.scheduled_date)}
                          </p>
                        </div>
                      </div>
                      {job.scheduled_time && (
                        <div className="flex items-start gap-3">
                          <Clock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                          <div>
                            <p className="text-sm text-muted-foreground">
                              {job.scheduled_end_date && job.scheduled_end_date !== job.scheduled_date ? "Daily Arrival Time" : "Arrival Time"}
                            </p>
                            <p className="font-medium text-lg">Around {formatTime(job.scheduled_time)}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              We'll arrive within 1 hour of this time
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {!scheduleAccepted ? (
                      /* Schedule Confirmation Actions */
                      <div className="space-y-3">
                        <p className="text-sm font-medium">Does this schedule work for you?</p>
                        <div className="flex flex-col gap-2">
                          <Button
                            onClick={handleConfirmSchedule}
                            loading={confirmingSchedule}
                            className="w-full"
                          >
                            <CheckCircle className="mr-2 h-4 w-4" />
                            Confirm Schedule
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setShowDenyScheduleDialog(true)}
                            className="w-full"
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Request Different Time
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* Schedule Confirmed Message */
                      <div className="p-4 rounded-lg bg-success/10 border border-success/20">
                        <p className="text-sm font-medium text-success mb-2">Schedule Confirmed!</p>
                        <p className="text-sm text-muted-foreground">
                          We'll see you {job.scheduled_end_date && job.scheduled_end_date !== job.scheduled_date ? "starting" : "on"} {formatDate(job.scheduled_date)}.
                          {job.company?.contact_phone && ` If anything changes, please call us at ${job.company.contact_phone}.`}
                        </p>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8">
                    <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-muted-foreground">Schedule to be determined</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {job.company?.name} will update you with scheduling information soon.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Photos Tab */}
          {photos.length > 0 && (
            <TabsContent value="photos" className="space-y-6">
              {/* Before Photos */}
              {beforePhotos.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Camera className="h-5 w-5" />
                      Before Photos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {beforePhotos.map((photo, index) => (
                        <button
                          key={photo.id}
                          onClick={() => {
                            setLightboxIndex(photos.indexOf(photo));
                            setLightboxOpen(true);
                          }}
                          className="relative aspect-square rounded-lg overflow-hidden bg-muted hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <img
                            src={photo.thumbnail_url || photo.public_url}
                            alt={photo.caption || `Before photo ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {photo.caption && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                              <p className="text-white text-xs truncate">{photo.caption}</p>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* After Photos */}
              {afterPhotos.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-success" />
                      After Photos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {afterPhotos.map((photo, index) => (
                        <button
                          key={photo.id}
                          onClick={() => {
                            setLightboxIndex(photos.indexOf(photo));
                            setLightboxOpen(true);
                          }}
                          className="relative aspect-square rounded-lg overflow-hidden bg-muted hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <img
                            src={photo.thumbnail_url || photo.public_url}
                            alt={photo.caption || `After photo ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {photo.caption && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                              <p className="text-white text-xs truncate">{photo.caption}</p>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Progress/Other Photos */}
              {progressPhotos.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Progress Photos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {progressPhotos.map((photo, index) => (
                        <button
                          key={photo.id}
                          onClick={() => {
                            setLightboxIndex(photos.indexOf(photo));
                            setLightboxOpen(true);
                          }}
                          className="relative aspect-square rounded-lg overflow-hidden bg-muted hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <img
                            src={photo.thumbnail_url || photo.public_url}
                            alt={photo.caption || `Progress photo ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {photo.caption && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                              <p className="text-white text-xs truncate">{photo.caption}</p>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* All photos in one section if no tags */}
              {beforePhotos.length === 0 && afterPhotos.length === 0 && progressPhotos.length === 0 && photos.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Camera className="h-5 w-5" />
                      Job Photos
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {photos.map((photo, index) => (
                        <button
                          key={photo.id}
                          onClick={() => {
                            setLightboxIndex(index);
                            setLightboxOpen(true);
                          }}
                          className="relative aspect-square rounded-lg overflow-hidden bg-muted hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                          <img
                            src={photo.thumbnail_url || photo.public_url}
                            alt={photo.caption || `Photo ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                          {photo.caption && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black/50 px-2 py-1">
                              <p className="text-white text-xs truncate">{photo.caption}</p>
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <p className="text-center text-sm text-muted-foreground">
                Photos are uploaded by {job.company?.name} to document the job progress.
              </p>
            </TabsContent>
          )}

          {/* Payment Tab */}
          <TabsContent value="payment" className="space-y-6">
            {paymentPaid ? (
              <>
                <Card>
                  <CardContent className="pt-8 pb-8">
                    <div className="text-center">
                      <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-success" />
                      </div>
                      <h2 className="text-2xl font-bold mb-2">Payment Confirmed!</h2>
                      <p className="text-muted-foreground mb-6">
                        Thank you for your payment of {formatCurrency(totalAmount)}.
                      </p>
                      <div className="text-sm text-muted-foreground">
                        {job.company?.name} has been notified.
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Review Request - Only show if company has reviews enabled */}
                {job.company?.review_enabled && job.company?.google_review_link && (
                  <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                    <CardContent className="pt-6 pb-6">
                      <div className="text-center space-y-4">
                        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                          <Star className="w-7 h-7 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold mb-2">How was your experience?</h3>
                          <p className="text-muted-foreground text-sm">
                            If you're happy with our work, we'd love a Google review! It helps other customers find us.
                          </p>
                        </div>
                        <Button
                          onClick={() => window.open(job.company!.google_review_link!, "_blank", "noopener,noreferrer")}
                          className="gap-2"
                          size="lg"
                        >
                          <Star className="w-4 h-4" />
                          Leave a Review
                          <ExternalLink className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            ) : job.payment_state && job.payment_state !== "none" ? (
              <>
                {/* Amount Card */}
                <Card>
                  <CardContent className="py-8">
                    <div className="text-center">
                      <p className="text-sm text-muted-foreground mb-2">Amount Due</p>
                      <p className="text-5xl font-bold">
                        {formatCurrency(totalAmount)}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {/* Line Items */}
                {job.payment_line_items && job.payment_line_items.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Line Items</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {job.payment_line_items.map((item) => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span>{item.title}</span>
                            <span className="font-medium">{formatCurrency(item.price)}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Payment Methods */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Payment Options</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {availableMethods.includes("stripe") ? (
                      <Button
                        onClick={handleStripePayment}
                        disabled={processingStripe || confirmingPayment}
                        className="w-full"
                        size="lg"
                      >
                        {processingStripe ? (
                          <>
                            <CreditCard className="mr-2 h-4 w-4 animate-spin" />
                            Processing...
                          </>
                        ) : (
                          <>
                            <CreditCard className="mr-2 h-4 w-4" />
                            Pay Online with Card
                          </>
                        )}
                      </Button>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">
                        Online payment is not available. Please contact {job.company?.name || "us"} to arrange payment.
                      </p>
                    )}
                    
                    {(job.company?.contact_phone || job.company?.contact_email) && (
                      <div className="pt-4 border-t text-center text-sm text-muted-foreground space-y-1">
                        <p className="font-medium text-foreground">Need to pay another way?</p>
                        <p>Contact {job.company?.name} directly:</p>
                        {job.company?.contact_phone && (
                          <p>{job.company.contact_phone}</p>
                        )}
                        {job.company?.contact_email && (
                          <p>{job.company.contact_email}</p>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center">
                    <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-3 opacity-50" />
                    <p className="text-muted-foreground">Payment information to be determined</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      {job.company?.name} will provide payment details once the estimate is accepted.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </main>

      {/* Deny Estimate Dialog */}
      <Dialog open={showDenyEstimateDialog} onOpenChange={setShowDenyEstimateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline This Estimate?</DialogTitle>
            <DialogDescription>
              Let {job.company?.name} know why this estimate doesn't work for you.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Reason (optional)</Label>
              <Textarea
                id="reason"
                placeholder="e.g., Price is too high, need different materials..."
                value={denialReason}
                onChange={(e) => setDenialReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDenyEstimateDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDenyEstimate} loading={denyingEstimate}>
              Decline Estimate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deny Schedule Dialog */}
      <Dialog open={showDenyScheduleDialog} onOpenChange={setShowDenyScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Decline This Schedule?</DialogTitle>
            <DialogDescription>
              Let {job.company?.name} know why this time doesn't work.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="schedule-reason">Reason (optional)</Label>
              <Textarea
                id="schedule-reason"
                placeholder="e.g., Time doesn't work, need different dates..."
                value={denialReason}
                onChange={(e) => setDenialReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDenyScheduleDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDenySchedule} loading={denyingSchedule}>
              Decline Schedule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Photo Lightbox */}
      {lightboxOpen && photos.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          {/* Close button */}
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2 z-50"
          >
            <X className="h-8 w-8" />
          </button>

          {/* Previous button */}
          {photos.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((prev) => (prev - 1 + photos.length) % photos.length);
              }}
              className="absolute left-4 text-white/80 hover:text-white p-2 z-50"
            >
              <ChevronLeft className="h-10 w-10" />
            </button>
          )}

          {/* Image */}
          <div
            className="max-w-[90vw] max-h-[85vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={photos[lightboxIndex]?.public_url || photos[lightboxIndex]?.thumbnail_url}
              alt={photos[lightboxIndex]?.caption || `Photo ${lightboxIndex + 1}`}
              className="max-w-full max-h-[80vh] object-contain"
            />
            {/* Caption and counter */}
            <div className="mt-4 text-center text-white">
              {photos[lightboxIndex]?.caption && (
                <p className="text-lg mb-2">{photos[lightboxIndex].caption}</p>
              )}
              <p className="text-sm text-white/60">
                {lightboxIndex + 1} of {photos.length}
                {photos[lightboxIndex]?.tag && (
                  <span className="ml-2 px-2 py-0.5 rounded bg-white/20 text-xs">
                    {photos[lightboxIndex].tag}
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Next button */}
          {photos.length > 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIndex((prev) => (prev + 1) % photos.length);
              }}
              className="absolute right-4 text-white/80 hover:text-white p-2 z-50"
            >
              <ChevronRight className="h-10 w-10" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
