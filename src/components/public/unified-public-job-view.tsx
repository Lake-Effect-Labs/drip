"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { formatCurrency, formatDate, formatTime } from "@/lib/utils";
import { createBrowserClient } from "@supabase/ssr";
import type { Job, Customer, Company, Estimate, EstimateLineItem, EstimateMaterial, JobPhoto } from "@/types/database";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Paintbrush,
  CheckCircle,
  MapPin,
  User,
  Calendar,
  TrendingUp,
  Camera,
  X,
  ChevronLeft,
  ChevronRight
} from "lucide-react";

type JobWithDetails = Job & {
  customer: Customer | null;
  company: (Pick<Company, "name"> & {
    logo_url?: string | null;
    contact_phone?: string | null;
    contact_email?: string | null;
  }) | null;
  estimate: (Estimate & {
    line_items: EstimateLineItem[];
    materials: EstimateMaterial[];
  }) | null;
  photos?: JobPhoto[];
};

interface UnifiedPublicJobViewProps {
  job: JobWithDetails;
}

export function UnifiedPublicJobView({ job: initialJob }: UnifiedPublicJobViewProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [job] = useState(initialJob);

  // Determine initial tab from URL query param
  const getInitialTab = () => {
    const tabParam = searchParams?.get("tab");
    if (tabParam === "estimate" || tabParam === "schedule" || tabParam === "photos") {
      return tabParam;
    }
    return initialJob.estimate ? "estimate" : "schedule";
  };

  const [activeTab, setActiveTab] = useState(getInitialTab());

  // Photo lightbox state
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  // Group photos by tag
  const photos = job.photos || [];
  const beforePhotos = photos.filter(p => p.tag === "before");
  const afterPhotos = photos.filter(p => p.tag === "after");
  const progressPhotos = photos.filter(p => p.tag === "progress" || p.tag === "other" || !p.tag);

  // Auto-trigger print dialog when opened with ?print=true (Save as PDF flow)
  useEffect(() => {
    if (searchParams?.get("print") === "true") {
      // Small delay to ensure the page is fully rendered
      const timer = setTimeout(() => window.print(), 500);
      return () => clearTimeout(timer);
    }
  }, [searchParams]);

  // Real-time subscription for updates from painter
  useEffect(() => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Subscribe to job updates
    const jobChannel = supabase
      .channel(`public-job-${job.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `id=eq.${job.id}`,
        },
        () => router.refresh()
      )
      .subscribe();

    // Subscribe to estimate updates
    const estimateChannel = job.estimate?.id ? supabase
      .channel(`public-estimate-${job.estimate.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'estimates',
          filter: `job_id=eq.${job.id}`,
        },
        () => router.refresh()
      )
      .subscribe() : null;

    // Subscribe to photo updates
    const photoChannel = supabase
      .channel(`public-photos-${job.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'job_photos',
          filter: `job_id=eq.${job.id}`,
        },
        () => router.refresh()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(jobChannel);
      if (estimateChannel) supabase.removeChannel(estimateChannel);
      supabase.removeChannel(photoChannel);
    };
  }, [job.id, job.estimate?.id, router]);

  // Determine job status
  const isJobDone = job.status === "done" || job.status === "paid" || job.status === "archive";

  const address = [job.address1, job.city, job.state, job.zip]
    .filter(Boolean)
    .join(", ");

  // Calculate total amount for estimate display
  const totalAmount = job.estimate
    ? (job.estimate.labor_total || job.estimate.line_items.reduce((sum, li) => sum + li.price, 0))
    : 0;

  // Progress percentage
  const progressPercentage = job.progress_percentage || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-stone-100 via-stone-50 to-white">
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
        {/* Customer Name and Address */}
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

        {/* Progress Tracker */}
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
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className={`grid w-full mb-6 ${
            job.estimate && photos.length > 0 ? "grid-cols-3" :
            job.estimate || photos.length > 0 ? "grid-cols-2" : "grid-cols-1"
          }`}>
            {job.estimate && <TabsTrigger value="estimate">Estimate</TabsTrigger>}
            <TabsTrigger value="schedule">Schedule</TabsTrigger>
            {photos.length > 0 && (
              <TabsTrigger value="photos" className="gap-1">
                <Camera className="h-4 w-4" />
                Photos
              </TabsTrigger>
            )}
          </TabsList>

          {/* Estimate Tab - View Only */}
          {job.estimate && (
            <TabsContent value="estimate" className="space-y-6">
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
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {job.estimate.line_items.map((item) => {
                      const itemNameLower = item.name?.toLowerCase() || '';
                      const itemMaterials = job.estimate!.materials?.filter(
                        (m: EstimateMaterial) => {
                          if (m.estimate_line_item_id === item.id) return true;
                          const areaDescLower = m.area_description?.toLowerCase() || '';
                          if (areaDescLower && itemNameLower) {
                            if (areaDescLower.includes(itemNameLower) || itemNameLower.includes(areaDescLower)) {
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
                                  </span>
                                )}
                              </div>
                            </div>
                            <p className="font-medium ml-4 shrink-0">{formatCurrency(item.price)}</p>
                          </div>

                          {itemMaterials.length > 0 && (
                            <div className="ml-0 mt-3 space-y-2 border-l-2 border-muted pl-3">
                              {itemMaterials.map((material: EstimateMaterial) => (
                                <div key={material.id} className="text-sm text-muted-foreground">
                                  {material.paint_product && (
                                    <div className="font-medium text-foreground">
                                      {material.paint_product}
                                    </div>
                                  )}
                                  <div>
                                    {material.color_name && <span>{material.color_name}</span>}
                                    {material.sheen && <span className="ml-1">- {material.sheen}</span>}
                                  </div>
                                  {material.quantity_gallons && (
                                    <span className="text-xs">
                                      {material.quantity_gallons} gallons
                                    </span>
                                  )}
                                </div>
                              ))}
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
            </TabsContent>
          )}

          {/* Schedule Tab - Simple View */}
          <TabsContent value="schedule" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Schedule
                </CardTitle>
              </CardHeader>
              <CardContent>
                {job.scheduled_date ? (
                  <div className="space-y-4">
                    {/* Main Schedule Display */}
                    <div className="p-6 rounded-lg bg-primary/5 border border-primary/20 text-center">
                      <p className="text-sm text-muted-foreground mb-2">Your appointment</p>
                      <p className="text-2xl font-bold text-primary mb-1">
                        {job.scheduled_end_date && job.scheduled_end_date !== job.scheduled_date
                          ? `${formatDate(job.scheduled_date)} - ${formatDate(job.scheduled_end_date)}`
                          : formatDate(job.scheduled_date)}
                      </p>
                      {job.scheduled_time && (
                        <p className="text-lg text-muted-foreground">
                          Arriving around {formatTime(job.scheduled_time)}
                        </p>
                      )}
                    </div>

                    {/* Contact Info */}
                    {job.company?.contact_phone && (
                      <p className="text-sm text-muted-foreground text-center">
                        Questions? Call {job.company.name} at {job.company.contact_phone}
                      </p>
                    )}
                  </div>
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
                          className="relative aspect-square rounded-lg overflow-hidden bg-muted hover:opacity-90 transition-opacity"
                        >
                          <img
                            src={photo.thumbnail_url || photo.public_url}
                            alt={photo.caption || `Before photo ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

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
                          className="relative aspect-square rounded-lg overflow-hidden bg-muted hover:opacity-90 transition-opacity"
                        >
                          <img
                            src={photo.thumbnail_url || photo.public_url}
                            alt={photo.caption || `After photo ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

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
                          className="relative aspect-square rounded-lg overflow-hidden bg-muted hover:opacity-90 transition-opacity"
                        >
                          <img
                            src={photo.thumbnail_url || photo.public_url}
                            alt={photo.caption || `Progress photo ${index + 1}`}
                            className="w-full h-full object-cover"
                          />
                        </button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          )}
        </Tabs>
      </main>

      {/* Photo Lightbox */}
      {lightboxOpen && photos.length > 0 && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 text-white/80 hover:text-white p-2 z-50"
          >
            <X className="h-8 w-8" />
          </button>

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

          <div
            className="max-w-[90vw] max-h-[85vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={photos[lightboxIndex]?.public_url || photos[lightboxIndex]?.thumbnail_url || undefined}
              alt={photos[lightboxIndex]?.caption || `Photo ${lightboxIndex + 1}`}
              className="max-w-full max-h-[80vh] object-contain"
            />
            <div className="mt-4 text-center text-white">
              {photos[lightboxIndex]?.caption && (
                <p className="text-lg mb-2">{photos[lightboxIndex].caption}</p>
              )}
              <p className="text-sm text-white/60">
                {lightboxIndex + 1} of {photos.length}
              </p>
            </div>
          </div>

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
