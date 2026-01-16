"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@drip/core/database/client";
import { Button } from "@/components/ui/button";
import { X, AlertTriangle, Lightbulb, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";

interface Nudge {
  type: string;
  priority: number;
  count: number;
  message: string;
  action: string;
  icon: string;
  variant: "destructive" | "warning" | "secondary";
}

interface NudgeBannersProps {
  companyId: string;
}

export function NudgeBanners({ companyId }: NudgeBannersProps) {
  const router = useRouter();
  const supabase = createClient();
  const [nudges, setNudges] = useState<Nudge[]>([]);
  const [loading, setLoading] = useState(true);
  const [dismissedTypes, setDismissedTypes] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadNudges();
  }, [companyId]);

  async function loadNudges() {
    try {
      // Get dismissals first
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: dismissals } = await supabase
        .from("nudge_dismissals")
        .select("nudge_type, expires_at")
        .eq("user_id", user.id)
        .eq("company_id", companyId);

      const dismissed = new Set(
        (dismissals || [])
          .filter(d => d.expires_at && new Date(d.expires_at) > new Date())
          .map(d => d.nudge_type)
      );
      setDismissedTypes(dismissed);

      // Check for accepted estimates without invoices
      const { data: acceptedNoInvoice } = await supabase
        .from("estimates")
        .select("id, job_id")
        .eq("company_id", companyId)
        .eq("status", "accepted")
        .is("job_id", false) // Has a job
        .limit(10);

      // Filter out jobs that already have invoices
      let acceptedCount = 0;
      if (acceptedNoInvoice) {
        for (const estimate of acceptedNoInvoice) {
          if (estimate.job_id) {
            const { data: invoices } = await supabase
              .from("invoices")
              .select("id")
              .eq("job_id", estimate.job_id)
              .limit(1);
            if (!invoices || invoices.length === 0) {
              acceptedCount++;
            }
          }
        }
      }

      // Check for overdue invoices (30+ days, unpaid)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: overdueInvoices, count: overdueCount } = await supabase
        .from("invoices")
        .select("id", { count: "exact" })
        .eq("company_id", companyId)
        .neq("status", "paid")
        .lt("created_at", thirtyDaysAgo.toISOString())
        .limit(10);

      // Check for stuck jobs (in_progress for 14+ days)
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

      const { data: stuckJobs, count: stuckCount } = await supabase
        .from("jobs")
        .select("id", { count: "exact" })
        .eq("company_id", companyId)
        .eq("status", "in_progress")
        .lt("updated_at", fourteenDaysAgo.toISOString())
        .limit(10);

      // Build nudges array
      const activeNudges: Nudge[] = [];

      if ((overdueCount || 0) > 0 && !dismissed.has("overdue_invoices")) {
        activeNudges.push({
          type: "overdue_invoices",
          priority: 1,
          count: overdueCount || 0,
          message: `${overdueCount} invoice${overdueCount !== 1 ? 's are' : ' is'} overdue (30+ days unpaid).`,
          action: "/app/board?filter=overdue",
          icon: "⚠️",
          variant: "destructive",
        });
      }

      if (acceptedCount > 0 && !dismissed.has("accepted_no_invoice")) {
        activeNudges.push({
          type: "accepted_no_invoice",
          priority: 2,
          count: acceptedCount,
          message: `${acceptedCount} job${acceptedCount !== 1 ? 's have' : ' has'} accepted estimates but no invoice yet.`,
          action: "/app/board?filter=quoted",
          icon: "💡",
          variant: "warning",
        });
      }

      if ((stuckCount || 0) > 0 && !dismissed.has("stuck_jobs")) {
        activeNudges.push({
          type: "stuck_jobs",
          priority: 3,
          count: stuckCount || 0,
          message: `${stuckCount} job${stuckCount !== 1 ? 's have' : ' has'} been "In Progress" for 14+ days.`,
          action: "/app/board?filter=in_progress",
          icon: "📋",
          variant: "secondary",
        });
      }

      // Sort by priority and take top 2
      setNudges(activeNudges.sort((a, b) => a.priority - b.priority).slice(0, 2));
    } catch (error) {
      console.error("Error loading nudges:", error);
    } finally {
      setLoading(false);
    }
  }

  async function dismissNudge(type: string, permanent: boolean = false) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const expiresAt = new Date();
      if (permanent) {
        expiresAt.setFullYear(expiresAt.getFullYear() + 10); // Effectively permanent
      } else {
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days
      }

      await supabase
        .from("nudge_dismissals")
        .insert({
          user_id: user.id,
          company_id: companyId,
          nudge_type: type,
          expires_at: expiresAt.toISOString(),
        });

      setDismissedTypes(prev => new Set(prev).add(type));
      setNudges(nudges.filter(n => n.type !== type));
    } catch (error) {
      console.error("Error dismissing nudge:", error);
    }
  }

  if (loading || nudges.length === 0) return null;

  return (
    <div className="space-y-2 mb-4">
      {nudges.map((nudge) => (
        <div
          key={nudge.type}
          className={cn(
            "rounded-lg border p-4 flex items-start justify-between gap-4",
            nudge.variant === "destructive" && "border-destructive bg-destructive/10",
            nudge.variant === "warning" && "border-warning bg-warning/10",
            nudge.variant === "secondary" && "border-border bg-muted/50"
          )}
        >
          <div className="flex items-center gap-3 flex-1">
            <span className="text-xl">{nudge.icon}</span>
            <div className="flex-1">
              <p className={cn(
                "font-medium mb-1",
                nudge.variant === "destructive" && "text-destructive",
                nudge.variant === "warning" && "text-warning"
              )}>
                {nudge.message}
              </p>
              <Button
                variant="link"
                size="sm"
                className="p-0 h-auto text-sm"
                onClick={() => router.push(nudge.action)}
              >
                View {nudge.count} {nudge.type.includes('invoice') ? 'invoices' : 'jobs'} →
              </Button>
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dismissNudge(nudge.type, false)}
              className="text-xs"
            >
              Dismiss for 7 days
            </Button>
            <button
              onClick={() => dismissNudge(nudge.type, true)}
              className="text-muted-foreground hover:text-foreground touch-target min-h-[44px] min-w-[44px] flex items-center justify-center"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
