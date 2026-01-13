"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, ExternalLink, Copy, Edit2, Check, DollarSign, Clock, Ruler, Users, Share2, MessageSquare, Pencil } from "lucide-react";
import { formatCurrency, formatDate, copyToClipboard, generateToken } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { useToast } from "@/components/ui/toast";
import { useRouter } from "next/navigation";
import type { EstimatingConfig } from "@/types/database";

type PaymentState = "none" | "proposed" | "approved" | "due" | "paid";

type LineItemType = "area" | "labor" | "other";

interface PaymentLineItem {
  id?: string;
  type: LineItemType;
  title: string;
  price: string; // string for input, stored as cents
  // Area-based fields
  areaType?: "walls" | "ceilings" | "trim" | "doors" | "exterior_walls" | "exterior_trim" | "deck_fence" | "siding" | "other";
  ratePerSqft?: string;
  sqft?: string;
  // Labor fields
  hours?: string;
  ratePerHour?: string;
  // Paint/Material fields (matching Add Paint dialog)
  paintBrand?: string; // "Sherwin-Williams", etc.
  paintColor?: string; // "SW 7008 Alabaster"
  paintSheen?: string; // "Eggshell", etc.
  paintQuantity?: string; // number as string
  paintQuantityUnit?: string; // "gal", "qt", "pt", "oz"
}

interface UnifiedPaymentProps {
  jobId: string;
  companyId: string;
  customerId: string | null;
  paymentState: PaymentState;
  paymentAmount: number | null; // in cents
  paymentApprovedAt: string | null;
  paymentPaidAt: string | null;
  paymentMethod: string | null;
  publicToken?: string;
  lineItems: Array<{
    id: string;
    title: string;
    price: number; // in cents
  }>;
  estimatingConfig?: EstimatingConfig | null;
  estimateStatus?: string | null; // "draft", "sent", "accepted", "denied"
  estimateDeniedAt?: string | null;
  estimateDenialReason?: string | null;
  onUpdate: () => void;
}

export function UnifiedPayment({
  jobId,
  companyId,
  customerId,
  paymentState,
  paymentAmount,
  paymentApprovedAt,
  paymentPaidAt,
  paymentMethod,
  publicToken,
  lineItems: initialLineItems,
  estimatingConfig,
  estimateStatus,
  estimateDeniedAt,
  estimateDenialReason,
  onUpdate,
}: UnifiedPaymentProps) {
  const supabase = createClient();
  const { addToast } = useToast();
  const router = useRouter();

  // Local state to track current payment state (allows immediate UI updates)
  const [currentPaymentState, setCurrentPaymentState] = useState<PaymentState>(paymentState);
  const [currentPaymentPaidAt, setCurrentPaymentPaidAt] = useState<string | null>(paymentPaidAt);
  const [currentPaymentMethod, setCurrentPaymentMethod] = useState<string | null>(paymentMethod);
  
  // Update local state when prop changes
  useEffect(() => {
    setCurrentPaymentState(paymentState);
  }, [paymentState]);
  
  useEffect(() => {
    setCurrentPaymentPaidAt(paymentPaidAt);
  }, [paymentPaidAt]);
  
  useEffect(() => {
    setCurrentPaymentMethod(paymentMethod);
  }, [paymentMethod]);

  const [lineItems, setLineItems] = useState<PaymentLineItem[]>(
    initialLineItems.length > 0
      ? initialLineItems.map(item => ({ 
          id: item.id, 
          type: "other" as LineItemType,
          title: item.title, 
          price: (item.price / 100).toFixed(2),
          paintBrand: "",
          paintColor: "",
          paintSheen: "",
          paintQuantity: "",
          paintQuantityUnit: "gal"
        }))
      : [{ 
          type: "other", 
          title: "", 
          price: "",
          paintBrand: "",
          paintColor: "",
          paintSheen: "",
          paintQuantity: "",
          paintQuantityUnit: "gal"
        }]
  );
  const [saving, setSaving] = useState(false);
  const [markPaidDialogOpen, setMarkPaidDialogOpen] = useState(false);
  const [paidMethod, setPaidMethod] = useState("cash");
  const [editingEstimate, setEditingEstimate] = useState(false);
  const [loadingEstimateData, setLoadingEstimateData] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sharePaymentDialogOpen, setSharePaymentDialogOpen] = useState(false);
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>(["cash", "check", "venmo", "stripe"]);
  const [currentPublicToken, setCurrentPublicToken] = useState<string | undefined>(publicToken);
  const [currentPaymentToken, setCurrentPaymentToken] = useState<string | undefined>();
  const [loadingToken, setLoadingToken] = useState(false);
  const [loadingPaymentToken, setLoadingPaymentToken] = useState(false);

  // Fetch estimate token if not available
  useEffect(() => {
    async function fetchEstimateToken() {
      if (currentPublicToken || !jobId || paymentState !== "proposed") return;
      
      setLoadingToken(true);
      try {
        const { data: estimateData } = await supabase
          .from("estimates")
          .select("public_token")
          .eq("job_id", jobId)
          .maybeSingle();
        
        if (estimateData?.public_token) {
          setCurrentPublicToken(estimateData.public_token);
        }
      } catch (err) {
        console.error("Error fetching estimate token:", err);
      } finally {
        setLoadingToken(false);
      }
    }
    
    fetchEstimateToken();
  }, [jobId, paymentState, currentPublicToken, supabase]);

  // Fetch payment token if not available
  useEffect(() => {
    async function fetchPaymentToken() {
      if (currentPaymentToken || !jobId || paymentState !== "due") return;
      
      setLoadingPaymentToken(true);
      try {
        const { data: jobData } = await supabase
          .from("jobs")
          .select("payment_token")
          .eq("id", jobId)
          .single();
        
        if (jobData?.payment_token) {
          setCurrentPaymentToken(jobData.payment_token);
        }
      } catch (err) {
        console.error("Error fetching payment token:", err);
      } finally {
        setLoadingPaymentToken(false);
      }
    }
    
    fetchPaymentToken();
  }, [jobId, paymentState, currentPaymentToken, supabase]);

  // Load existing estimate line items when editing
  async function loadExistingEstimate() {
    setLoadingEstimateData(true);
    try {
      // Fetch the estimate
      const { data: estimate } = await supabase
        .from("estimates")
        .select("id")
        .eq("job_id", jobId)
        .maybeSingle();
      
      if (!estimate) {
        setLoadingEstimateData(false);
        return;
      }

      // Fetch estimate line items with paint details
      const { data: estimateLineItems } = await supabase
        .from("estimate_line_items")
        .select("*")
        .eq("estimate_id", estimate.id)
        .order("created_at", { ascending: true });

      if (estimateLineItems && estimateLineItems.length > 0) {
        const loadedItems = estimateLineItems.map(item => {
          // Determine type based on service_type
          let type: LineItemType = "other";
          let areaType: "walls" | "ceilings" | "trim" | "doors" | undefined;

          if (item.service_type === "sqft") {
            type = "area";
            // Parse area type from name
            const nameLower = item.name.toLowerCase();
            if (nameLower.includes("exterior") && nameLower.includes("walls")) areaType = "exterior_walls";
            else if (nameLower.includes("exterior") && nameLower.includes("trim")) areaType = "exterior_trim";
            else if (nameLower.includes("deck") || nameLower.includes("fence")) areaType = "deck_fence";
            else if (nameLower.includes("siding")) areaType = "siding";
            else if (nameLower.includes("walls")) areaType = "walls";
            else if (nameLower.includes("ceiling")) areaType = "ceilings";
            else if (nameLower.includes("trim")) areaType = "trim";
            else if (nameLower.includes("door")) areaType = "doors";
            else areaType = "other";
          }

          return {
            id: item.id,
            type,
            title: item.name,
            price: (item.price / 100).toFixed(2),
            areaType,
            sqft: (item as any).sqft?.toString() || "",
            ratePerSqft: (item as any).rate_per_sqft?.toString() || "",
            paintBrand: item.product_line || "",
            paintColor: item.paint_color_name_or_code || "",
            paintSheen: item.sheen || "",
            paintQuantity: item.gallons_estimate?.toString() || "",
            paintQuantityUnit: "gal"
          };
        });

        setLineItems(loadedItems);
      }
    } catch (error) {
      console.error("Error loading estimate:", error);
      addToast("Failed to load estimate details", "error");
    } finally {
      setLoadingEstimateData(false);
    }
  }

  // Generate token when needed
  async function ensurePublicToken() {
    if (currentPublicToken || publicToken) return currentPublicToken || publicToken;
    
    setLoadingToken(true);
    try {
      const token = generateToken(24);
      
      // First check if estimate exists for this job
      const { data: existingEstimate } = await supabase
        .from("estimates")
        .select("id, public_token")
        .eq("job_id", jobId)
        .maybeSingle();

      let estimateData;
      let estimateError;

      if (existingEstimate) {
        // Update existing estimate with new token
        const { data, error } = await supabase
          .from("estimates")
          .update({
            public_token: token,
            status: "sent",
            customer_id: customerId,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingEstimate.id)
          .select("public_token")
          .single();
        estimateData = data;
        estimateError = error;
      } else {
        // Create new estimate
        const { data, error } = await supabase
          .from("estimates")
          .insert({
            company_id: companyId,
            job_id: jobId,
            customer_id: customerId,
            status: "sent",
            public_token: token,
          })
          .select("public_token")
          .single();
        estimateData = data;
        estimateError = error;
      }

      if (estimateError) {
        console.error("Estimate create/update error:", estimateError);
        // Still set the token for display even if DB save fails
        setCurrentPublicToken(token);
        return token;
      } else if (estimateData) {
        setCurrentPublicToken(estimateData.public_token);
        return estimateData.public_token;
      }
    } catch (err) {
      console.error("Error ensuring public token:", err);
      // Generate a temporary token for display
      const tempToken = generateToken(24);
      setCurrentPublicToken(tempToken);
      return tempToken;
    } finally {
      setLoadingToken(false);
    }
    
    return undefined;
  }

  const totalAmount = lineItems.reduce((sum, item) => {
    if (item.type === "area" && item.ratePerSqft && item.sqft) {
      const rate = parseFloat(item.ratePerSqft) || 0;
      const sqft = parseFloat(item.sqft) || 0;
      return sum + Math.round(rate * sqft * 100);
    } else if (item.type === "labor" && item.hours && item.ratePerHour) {
      const hours = parseFloat(item.hours) || 0;
      const rate = parseFloat(item.ratePerHour) || 0;
      return sum + Math.round(hours * rate * 100);
    } else {
      const price = parseFloat(item.price) || 0;
      return sum + Math.round(price * 100);
    }
  }, 0);

  // Helper to get label based on state
  const getLabel = () => {
    switch (paymentState) {
      case "none":
      case "proposed":
        return "Estimate";
      case "approved":
        return "Agreed Price";
      case "due":
        return "Payment Due";
      case "paid":
        return "Paid";
      default:
        return "Payment";
    }
  };

  // Helper to get badge variant
  const getBadgeVariant = () => {
    switch (paymentState) {
      case "proposed":
        return "secondary";
      case "approved":
        return "default";
      case "due":
        return "warning" as any;
      case "paid":
        return "success";
      default:
        return "outline";
    }
  };

  const updateLineItem = (index: number, field: keyof PaymentLineItem, value: string | LineItemType) => {
    const updated = [...lineItems];
    (updated[index] as any)[field] = value;
    // Reset type-specific fields when type changes and apply defaults
    if (field === "type") {
      if (value === "area") {
        updated[index].areaType = "walls";
        updated[index].ratePerSqft = estimatingConfig?.walls_rate_per_sqft?.toString() || "";
        updated[index].sqft = "";
        updated[index].price = "";
      } else if (value === "labor") {
        updated[index].hours = "";
        updated[index].ratePerHour = estimatingConfig?.labor_rate_per_hour?.toString() || "";
        updated[index].price = "";
      } else {
        updated[index].price = "";
      }
    }
    // Apply default rate when area type changes
    if (field === "areaType" && value === "walls") {
      updated[index].ratePerSqft = estimatingConfig?.walls_rate_per_sqft?.toString() || "";
    } else if (field === "areaType" && value === "ceilings") {
      updated[index].ratePerSqft = estimatingConfig?.ceilings_rate_per_sqft?.toString() || "";
    } else if (field === "areaType" && (value === "trim" || value === "doors")) {
      updated[index].ratePerSqft = estimatingConfig?.trim_rate_per_sqft?.toString() || "";
    }
    setLineItems(updated);
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { 
      type: "other", 
      title: "", 
      price: "",
      paintBrand: "",
      paintColor: "",
      paintSheen: "",
      paintQuantity: "",
      paintQuantityUnit: "gal"
    }]);
  };

  const removeLineItem = (index: number) => {
    if (lineItems.length === 1) return;
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  // Create or update proposed payment
  async function handleSaveProposed() {
    // Validate that at least one line item is complete
    const hasValidItem = lineItems.some(item => {
      if (item.type === "area") {
        return item.ratePerSqft && item.sqft && parseFloat(item.ratePerSqft) > 0 && parseFloat(item.sqft) > 0;
      } else if (item.type === "labor") {
        return item.hours && item.ratePerHour && parseFloat(item.hours) > 0 && parseFloat(item.ratePerHour) > 0;
      } else {
        return item.title.trim() && item.price.trim() && parseFloat(item.price) > 0;
      }
    });

    if (!hasValidItem) {
      addToast("Please add at least one complete line item", "error");
      return;
    }

    setSaving(true);
    try {
      // Update job payment - reset approval if revising an approved estimate
      const jobUpdate: any = {
        payment_state: "proposed",
        payment_amount: totalAmount,
      };
      
      // If this was previously approved, reset the approval
      if (currentPaymentState === "approved") {
        jobUpdate.payment_approved_at = null;
      }

      const { error: jobError } = await supabase
        .from("jobs")
        .update(jobUpdate)
        .eq("id", jobId);

      if (jobError) {
        console.error("Job update error:", jobError);
        throw jobError;
      }

      // Update local state immediately for instant UI feedback
      setCurrentPaymentState("proposed");

      // Delete old line items
      const { error: deleteError } = await supabase
        .from("job_payment_line_items")
        .delete()
        .eq("job_id", jobId);

      if (deleteError) {
        console.error("Delete line items error:", deleteError);
        throw deleteError;
      }

      // Insert new line items
      const itemsToInsert = lineItems
        .filter(item => {
          if (item.type === "area") {
            return item.ratePerSqft && item.sqft && parseFloat(item.ratePerSqft) > 0 && parseFloat(item.sqft) > 0;
          } else if (item.type === "labor") {
            return item.hours && item.ratePerHour && parseFloat(item.hours) > 0 && parseFloat(item.ratePerHour) > 0;
          } else {
            return item.title.trim() && item.price.trim() && parseFloat(item.price) > 0;
          }
        })
        .map((item, index) => {
          let title = "";
          let price = 0;

          if (item.type === "area" && item.areaType && item.ratePerSqft && item.sqft) {
            const areaLabels: Record<string, string> = {
              walls: "Interior Walls",
              ceilings: "Ceilings",
              trim: "Interior Trim",
              doors: "Doors",
              exterior_walls: "Exterior Walls",
              exterior_trim: "Exterior Trim",
              deck_fence: "Deck/Fence",
              siding: "Siding",
              other: "Other"
            };
            title = `${areaLabels[item.areaType]} - ${item.sqft} sqft @ $${item.ratePerSqft}/sqft`;
            price = Math.round((parseFloat(item.ratePerSqft) || 0) * (parseFloat(item.sqft) || 0) * 100);
          } else if (item.type === "labor" && item.hours && item.ratePerHour) {
            title = `Labor - ${item.hours} hrs @ $${item.ratePerHour}/hr`;
            price = Math.round((parseFloat(item.hours) || 0) * (parseFloat(item.ratePerHour) || 0) * 100);
          } else {
            title = item.title.trim();
            price = Math.round((parseFloat(item.price) || 0) * 100);
          }

          return {
            job_id: jobId,
            title,
            price,
            sort_order: index,
          };
        });

      if (itemsToInsert.length === 0) {
        throw new Error("No valid line items to save");
      }

      const { error: itemsError } = await supabase
        .from("job_payment_line_items")
        .insert(itemsToInsert);

      if (itemsError) {
        console.error("Items insert error:", itemsError);
        throw itemsError;
      }

      // Create or update estimate record for public sharing
      // Always update the estimate, whether or not we have a token
      const token = currentPublicToken || generateToken(24);
      
      // First check if estimate exists for this job
      const { data: existingEstimate } = await supabase
        .from("estimates")
        .select("id, public_token")
        .eq("job_id", jobId)
        .maybeSingle();

      let estimateId: string;
      let estimateData;
      let estimateError;

      if (existingEstimate) {
        // Update existing estimate and reset approval status
        const { data, error } = await supabase
          .from("estimates")
          .update({
            public_token: token,
            status: "sent",
            customer_id: customerId,
            accepted_at: null, // Reset acceptance if revising
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingEstimate.id)
          .select("id, public_token")
          .single();
        estimateData = data;
        estimateError = error;
        estimateId = existingEstimate.id;
      } else {
        // Create new estimate
        const { data, error } = await supabase
          .from("estimates")
          .insert({
            company_id: companyId,
            job_id: jobId,
            customer_id: customerId,
            status: "sent",
            public_token: token,
          })
          .select("id, public_token")
          .single();
        estimateData = data;
        estimateError = error;
        estimateId = data?.id || "";
      }

      if (estimateError) {
        console.error("Estimate create/update error:", estimateError);
        // Don't throw - estimate creation is optional for sharing
      } else if (estimateData && estimateId) {
        setCurrentPublicToken(estimateData.public_token);
        
        // Delete old estimate line items
        await supabase
          .from("estimate_line_items")
          .delete()
          .eq("estimate_id", estimateId);
        
        // Create estimate line items with paint details
        const estimateLineItems = lineItems
            .filter(item => {
              if (item.type === "area") {
                return item.ratePerSqft && item.sqft && parseFloat(item.ratePerSqft) > 0 && parseFloat(item.sqft) > 0;
              } else if (item.type === "labor") {
                return item.hours && item.ratePerHour && parseFloat(item.hours) > 0 && parseFloat(item.ratePerHour) > 0;
              } else {
                return item.title.trim() && item.price.trim() && parseFloat(item.price) > 0;
              }
            })
            .map((item) => {
              let name = "";
              let price = 0;
              let serviceType: "sqft" | "flat" = "flat";

              if (item.type === "area" && item.areaType && item.ratePerSqft && item.sqft) {
                const areaLabels: Record<string, string> = {
                  walls: "Interior Walls",
                  ceilings: "Ceilings",
                  trim: "Interior Trim",
                  doors: "Doors",
                  exterior_walls: "Exterior Walls",
                  exterior_trim: "Exterior Trim",
                  deck_fence: "Deck/Fence",
                  siding: "Siding",
                  other: "Other"
                };
                name = areaLabels[item.areaType];
                price = Math.round((parseFloat(item.ratePerSqft) || 0) * (parseFloat(item.sqft) || 0) * 100);
                serviceType = "sqft";
              } else if (item.type === "labor" && item.hours && item.ratePerHour) {
                name = "Labor";
                price = Math.round((parseFloat(item.hours) || 0) * (parseFloat(item.ratePerHour) || 0) * 100);
              } else {
                name = item.title.trim();
                price = Math.round((parseFloat(item.price) || 0) * 100);
              }

              return {
                estimate_id: estimateId,
                service_key: "other",
                service_type: serviceType,
                name,
                description: null,
                price,
                sqft: item.type === "area" && item.sqft ? parseFloat(item.sqft) : null,
                rate_per_sqft: item.type === "area" && item.ratePerSqft ? parseFloat(item.ratePerSqft) : null,
                paint_color_name_or_code: item.paintColor || null,
                sheen: item.paintSheen || null,
                product_line: item.paintBrand || null,
                gallons_estimate: item.paintQuantity ? parseFloat(item.paintQuantity) : null,
              };
            });
          
          if (estimateLineItems.length > 0) {
            await supabase
              .from("estimate_line_items")
              .insert(estimateLineItems);
              
            // Auto-generate materials from line items with paint details
            try {
              await fetch(`/api/estimate-materials/${estimateId}/generate`, { method: "POST" });
            } catch (error) {
              console.error("Failed to auto-generate materials:", error);
            }
          }
        }

      // Show appropriate message based on whether this was a revision
      const wasApproved = currentPaymentState === "approved";
      if (wasApproved) {
        addToast("Estimate revised - customer needs to approve again", "success");
        // Immediately update local state to show proposed UI
        setCurrentPaymentState("proposed");
      } else {
        addToast("Estimate saved", "success");
      }
      setEditingEstimate(false);
      onUpdate();
    } catch (err: any) {
      console.error("Failed to save payment:", err);
      console.error("Error details:", {
        message: err?.message,
        code: err?.code,
        details: err?.details,
        hint: err?.hint,
        fullError: err
      });
      const errorMessage = err?.message || err?.code || err?.details || JSON.stringify(err) || "Unknown error";
      addToast(`Failed to save: ${errorMessage}`, "error");
    } finally {
      setSaving(false);
    }
  }

  // Copy estimate link
  async function handleCopyLink() {
    const token = await ensurePublicToken();
    if (!token) {
      addToast("Unable to generate link", "error");
      return;
    }

    const link = `${window.location.origin}/e/${token}`;
    copyToClipboard(link);
    addToast("Estimate link copied to clipboard", "success");
    setShareDialogOpen(false);
  }

  // Copy pre-written message
  async function handleCopyMessage() {
    const token = await ensurePublicToken();
    if (!token) {
      addToast("Unable to generate link", "error");
      return;
    }

    const link = `${window.location.origin}/e/${token}`;
    const customerName = "there"; // Could be passed as prop if needed
    const message = `Hey ${customerName} — here's your estimate for ${formatCurrency(paymentAmount || totalAmount)}: ${link}. Let me know if you have any questions!`;
    copyToClipboard(message);
    addToast("Message copied to clipboard", "success");
    setShareDialogOpen(false);
  }

  // Customer approves (from public page or internal)
  async function handleApprove() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("jobs")
        .update({
          payment_state: "approved",
          payment_approved_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      if (error) throw error;

      // Update local state immediately for instant UI feedback
      setCurrentPaymentState("approved");
      
      addToast("Price approved! 🎉", "success");
      onUpdate();
    } catch (err) {
      console.error("Failed to approve:", err);
      addToast("Failed to approve", "error");
    } finally {
      setSaving(false);
    }
  }

  // Ensure payment token exists
  async function ensurePaymentToken() {
    if (currentPaymentToken) return currentPaymentToken;
    
    setLoadingPaymentToken(true);
    try {
      // First check if job already has a payment_token
      const { data: jobData } = await supabase
        .from("jobs")
        .select("payment_token")
        .eq("id", jobId)
        .single();

      if (jobData?.payment_token) {
        setCurrentPaymentToken(jobData.payment_token);
        return jobData.payment_token;
      }

      // Generate new token
      const token = generateToken(24);
      
      const { error } = await supabase
        .from("jobs")
        .update({
          payment_token: token,
        })
        .eq("id", jobId);

      if (error) throw error;

      setCurrentPaymentToken(token);
      return token;
    } catch (err) {
      console.error("Failed to generate payment token:", err);
      addToast("Failed to generate payment link", "error");
      return null;
    } finally {
      setLoadingPaymentToken(false);
    }
  }

  // Mark as due (when job is done)
  async function handleMarkDue() {
    // Use default payment methods if none selected (cash, check, venmo, stripe)
    const methodsToUse = selectedPaymentMethods.length > 0 
      ? selectedPaymentMethods 
      : ["cash", "check", "venmo", "stripe"];

    setSaving(true);
    try {
      // Generate payment token if it doesn't exist
      const token = await ensurePaymentToken();
      if (!token) {
        setSaving(false);
        return;
      }

      const { error } = await supabase
        .from("jobs")
        .update({
          payment_state: "due",
          payment_token: token,
          payment_methods: methodsToUse,
        })
        .eq("id", jobId);

      if (error) throw error;

      // Update local state immediately for instant UI feedback
      setCurrentPaymentState("due");
      
      addToast("Payment requested", "success");
      onUpdate();
    } catch (err) {
      console.error("Failed to mark due:", err);
      addToast("Failed to request payment", "error");
    } finally {
      setSaving(false);
    }
  }

  // Mark as paid
  async function handleMarkPaid() {
    setSaving(true);
    try {
      const { error } = await supabase
        .from("jobs")
        .update({
          payment_state: "paid",
          payment_paid_at: new Date().toISOString(),
          payment_method: paidMethod,
          status: "paid", // Also update job status to move card to paid column
          updated_at: new Date().toISOString(),
        })
        .eq("id", jobId);

      if (error) throw error;

      // Update local state immediately for instant UI feedback
      const paidAt = new Date().toISOString();
      setCurrentPaymentState("paid");
      setCurrentPaymentPaidAt(paidAt);
      setCurrentPaymentMethod(paidMethod);
      
      addToast("Payment recorded! 💰", "success");
      setMarkPaidDialogOpen(false);
      onUpdate();
    } catch (err) {
      console.error("Failed to mark paid:", err);
      addToast("Failed to record payment", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      {/* Share Estimate Dialog */}
      <Dialog open={shareDialogOpen} onOpenChange={async (open) => {
        setShareDialogOpen(open);
        if (open) {
          // Ensure token exists when dialog opens
          await ensurePublicToken();
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Share Estimate</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label className="text-sm text-muted-foreground">Estimate Link</Label>
                <div className="flex gap-2 mt-2">
                  <Input 
                    value={loadingToken ? "Generating..." : (typeof window !== "undefined" && (currentPublicToken || publicToken) ? `${window.location.origin}/e/${currentPublicToken || publicToken}` : "No token available")}
                    readOnly 
                    className="font-mono text-sm"
                  />
                  <Button 
                    variant="outline"
                    onClick={handleCopyLink}
                    disabled={loadingToken}
                    className="shrink-0"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div>
                <Label className="text-sm text-muted-foreground">Pre-written Message</Label>
                <Textarea
                  value={loadingToken ? "Generating link..." : `Hey there — here's your estimate for ${formatCurrency(paymentAmount || totalAmount)}: ${typeof window !== "undefined" && (currentPublicToken || publicToken) ? `${window.location.origin}/e/${currentPublicToken || publicToken}` : "[link will be generated]"}. Let me know if you have any questions!`}
                  readOnly
                  rows={4}
                  className="mt-2 font-sans"
                />
                <Button
                  onClick={handleCopyMessage}
                  className="w-full mt-2"
                  disabled={loadingToken}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Message
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Payment Dialog */}
      <Dialog open={sharePaymentDialogOpen} onOpenChange={async (open) => {
        setSharePaymentDialogOpen(open);
        if (open) {
          await ensurePaymentToken();
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Share Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {loadingPaymentToken ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">Generating link...</p>
              </div>
            ) : !currentPaymentToken ? (
              <div className="text-center py-4">
                <p className="text-sm text-destructive">No token available</p>
              </div>
            ) : (
              <>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground mb-2">Amount Due</p>
                  <p className="font-semibold text-lg">
                    {formatCurrency(paymentAmount || 0)}
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-sm text-muted-foreground">Payment Link</Label>
                    <div className="flex gap-2 mt-2">
                      <Input 
                        value={typeof window !== "undefined" && currentPaymentToken ? `${window.location.origin}/p/${currentPaymentToken}` : ""} 
                        readOnly 
                        className="font-mono text-sm"
                      />
                      <Button 
                        variant="outline"
                        onClick={() => {
                          const link = `${window.location.origin}/p/${currentPaymentToken}`;
                          copyToClipboard(link);
                          addToast("Payment link copied", "success");
                        }}
                        disabled={loadingPaymentToken}
                        className="shrink-0"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm text-muted-foreground">Pre-written Message</Label>
                    <Textarea 
                      value={`Hey there — here's your invoice for ${formatCurrency(paymentAmount || 0)}: ${typeof window !== "undefined" && currentPaymentToken ? `${window.location.origin}/p/${currentPaymentToken}` : "[link will be generated]"}. Thank you!`}
                      readOnly 
                      rows={4}
                      className="mt-2 font-sans"
                    />
                    <Button 
                      onClick={() => {
                        const link = `${window.location.origin}/p/${currentPaymentToken}`;
                        const customerName = "there"; // Could be passed as prop if needed
                        const message = `Hey ${customerName} — here's your invoice for ${formatCurrency(paymentAmount || 0)}: ${link}. Thank you!`;
                        copyToClipboard(message);
                        addToast("Message copied to clipboard", "success");
                        setSharePaymentDialogOpen(false);
                      }}
                      className="w-full mt-2"
                      disabled={loadingPaymentToken}
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy Message
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <div className="rounded-lg border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h3 className="font-semibold">{getLabel()}</h3>
            {paymentState !== "none" && (
              <Badge variant={getBadgeVariant()}>
                {paymentState.charAt(0).toUpperCase() + paymentState.slice(1)}
              </Badge>
            )}
            {estimateStatus === "denied" && (
              <Badge variant="destructive">Denied</Badge>
            )}
          </div>
          {paymentAmount && (
            <div className="text-xl font-bold">
              {formatCurrency(paymentAmount)}
            </div>
          )}
        </div>

        {/* DENIED ESTIMATE ALERT */}
        {estimateStatus === "denied" && (
          <div className="rounded-lg border-2 border-destructive bg-destructive/10 p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-destructive text-white flex items-center justify-center shrink-0 mt-0.5">
                ✗
              </div>
              <div className="flex-1 space-y-2">
                <div>
                  <h4 className="font-semibold text-destructive">Customer Declined Estimate</h4>
                  <p className="text-sm text-muted-foreground mt-1">
                    Declined on {formatDate(estimateDeniedAt || new Date().toISOString())}
                  </p>
                </div>
                {estimateDenialReason && (
                  <div className="bg-card p-3 rounded-lg border">
                    <p className="text-sm font-medium mb-1">Customer Feedback:</p>
                    <p className="text-sm text-muted-foreground">{estimateDenialReason}</p>
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      await loadExistingEstimate();
                      setEditingEstimate(true);
                    }}
                    disabled={loadingEstimateData}
                  >
                    <Edit2 className="h-4 w-4 mr-2" />
                    {loadingEstimateData ? "Loading..." : "Revise Estimate"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Review the customer's feedback and revise the estimate. You can adjust pricing, scope, or send a message to discuss their concerns.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* PROPOSED STATE - Create/Edit Estimate */}
        {((currentPaymentState === "none" || currentPaymentState === "proposed") || (currentPaymentState === "approved" && editingEstimate)) && (
          <div className="space-y-4">
            {/* Simple view when estimate exists */}
            {currentPaymentState === "proposed" && initialLineItems.length > 0 && !editingEstimate ? (
              <>
                <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-sm">Estimate Total</h4>
                    <span className="text-lg font-bold">{formatCurrency(paymentAmount || totalAmount)}</span>
                  </div>
                  <div className="space-y-1">
                    {initialLineItems.map((item) => (
                      <div key={item.id} className="flex justify-between text-sm text-muted-foreground">
                        <span>{item.title}</span>
                        <span>{formatCurrency(item.price)}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={async () => {
                      await ensurePublicToken();
                      setShareDialogOpen(true);
                    }}
                    className="flex-1"
                  >
                    <Share2 className="mr-2 h-4 w-4" />
                    Share Estimate
                  </Button>
                  <Button
                    variant="outline"
                    onClick={async () => {
                      await loadExistingEstimate();
                      setEditingEstimate(true);
                    }}
                    disabled={loadingEstimateData}
                    className="flex-1"
                  >
                    <Pencil className="mr-2 h-4 w-4" />
                    {loadingEstimateData ? "Loading..." : "Edit"}
                  </Button>
                  {customerId && (
                    <Button
                      variant="default"
                      onClick={handleApprove}
                      loading={saving}
                      className="flex-1"
                    >
                      <Check className="mr-2 h-4 w-4" />
                      Approve
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <>
            <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
              {lineItems.map((item, index) => {
                const itemTotal = item.type === "area" && item.ratePerSqft && item.sqft
                  ? (parseFloat(item.ratePerSqft) || 0) * (parseFloat(item.sqft) || 0)
                  : item.type === "labor" && item.hours && item.ratePerHour
                  ? (parseFloat(item.hours) || 0) * (parseFloat(item.ratePerHour) || 0)
                  : parseFloat(item.price) || 0;

                return (
                  <div key={index} className="p-3 sm:p-4 rounded-lg border bg-card space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <Select
                        value={item.type}
                        onChange={(e) => updateLineItem(index, "type", e.target.value as LineItemType)}
                        className="flex-1 min-h-[44px]"
                      >
                        <option value="area">Area</option>
                        <option value="labor">Labor</option>
                        <option value="other">Other</option>
                      </Select>
                      {lineItems.length > 1 && (
                        <button
                          onClick={() => removeLineItem(index)}
                          className="text-muted-foreground hover:text-destructive min-h-[44px] w-11 flex items-center justify-center shrink-0 touch-target"
                          aria-label="Remove line item"
                        >
                          <Trash2 className="h-5 w-5" />
                        </button>
                      )}
                    </div>

                    {item.type === "area" ? (
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1">Area Type</Label>
                          <Select
                            value={item.areaType || "walls"}
                            onChange={(e) => updateLineItem(index, "areaType", e.target.value)}
                            className="w-full min-h-[44px]"
                          >
                            <optgroup label="Interior">
                              <option value="walls">Interior Walls</option>
                              <option value="ceilings">Ceilings</option>
                              <option value="trim">Interior Trim</option>
                              <option value="doors">Doors</option>
                            </optgroup>
                            <optgroup label="Exterior">
                              <option value="exterior_walls">Exterior Walls</option>
                              <option value="exterior_trim">Exterior Trim</option>
                              <option value="deck_fence">Deck/Fence</option>
                              <option value="siding">Siding</option>
                            </optgroup>
                            <option value="other">Other</option>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1">Square Feet</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0"
                              value={item.sqft || ""}
                              onChange={(e) => updateLineItem(index, "sqft", e.target.value)}
                              className="min-h-[44px]"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1">Rate ($/sqft)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={item.ratePerSqft || ""}
                              onChange={(e) => updateLineItem(index, "ratePerSqft", e.target.value)}
                              className="min-h-[44px]"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="text-sm font-medium text-muted-foreground">Total</span>
                          <span className="text-lg font-bold">{formatCurrency(Math.round(itemTotal * 100))}</span>
                        </div>
                        
                        {/* Paint Details - Only for Area type */}
                        <div className="pt-3 border-t space-y-3">
                          <Label className="text-xs font-semibold">Paint Details</Label>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Brand</Label>
                              <Select
                                value={item.paintBrand || ""}
                                onChange={(e) => updateLineItem(index, "paintBrand", e.target.value)}
                                className="min-h-[44px]"
                              >
                                <option value="">Select brand...</option>
                                <option value="Sherwin-Williams">Sherwin-Williams</option>
                                <option value="Benjamin Moore">Benjamin Moore</option>
                                <option value="Behr">Behr</option>
                                <option value="PPG">PPG</option>
                                <option value="Other">Other</option>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Color</Label>
                              <Input
                                placeholder="e.g., SW 7008 Alabaster"
                                value={item.paintColor || ""}
                                onChange={(e) => updateLineItem(index, "paintColor", e.target.value)}
                                className="min-h-[44px]"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Sheen</Label>
                              <Select
                                value={item.paintSheen || ""}
                                onChange={(e) => updateLineItem(index, "paintSheen", e.target.value)}
                                className="min-h-[44px]"
                              >
                                <option value="">Select sheen...</option>
                                <option value="Flat">Flat</option>
                                <option value="Matte">Matte</option>
                                <option value="Eggshell">Eggshell</option>
                                <option value="Satin">Satin</option>
                                <option value="Semi-Gloss">Semi-Gloss</option>
                                <option value="Gloss">Gloss</option>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs text-muted-foreground">Quantity</Label>
                              <div className="flex gap-2">
                                <Input
                                  type="number"
                                  min="0"
                                  step="0.25"
                                  placeholder="e.g., 3"
                                  value={item.paintQuantity || ""}
                                  onChange={(e) => updateLineItem(index, "paintQuantity", e.target.value)}
                                  className="min-h-[44px] flex-1"
                                />
                                <Select
                                  value={item.paintQuantityUnit || "gal"}
                                  onChange={(e) => updateLineItem(index, "paintQuantityUnit", e.target.value)}
                                  className="min-h-[44px] w-28"
                                >
                                  <option value="gal">Gallons</option>
                                  <option value="qt">Quarts</option>
                                  <option value="pt">Pints</option>
                                  <option value="oz">Oz</option>
                                </Select>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : item.type === "labor" ? (
                      <div className="space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1">Hours</Label>
                            <Input
                              type="number"
                              step="0.25"
                              min="0"
                              placeholder="0"
                              value={item.hours || ""}
                              onChange={(e) => updateLineItem(index, "hours", e.target.value)}
                              className="min-h-[44px]"
                            />
                          </div>
                          <div>
                            <Label className="text-xs text-muted-foreground mb-1">Rate ($/hr)</Label>
                            <Input
                              type="number"
                              step="0.01"
                              min="0"
                              placeholder="0.00"
                              value={item.ratePerHour || ""}
                              onChange={(e) => updateLineItem(index, "ratePerHour", e.target.value)}
                              className="min-h-[44px]"
                            />
                          </div>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t">
                          <span className="text-sm font-medium text-muted-foreground">Total</span>
                          <span className="text-lg font-bold">{formatCurrency(Math.round(itemTotal * 100))}</span>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1">Description</Label>
                          <Input
                            placeholder="e.g., Materials, Travel, etc."
                            value={item.title}
                            onChange={(e) => updateLineItem(index, "title", e.target.value)}
                            className="w-full min-h-[44px]"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1">Amount</Label>
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              placeholder="0.00"
                              value={item.price}
                              onChange={(e) => updateLineItem(index, "price", e.target.value)}
                              className="pl-7 min-h-[44px]"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLineItem}
                  className="flex-1 touch-target min-h-[44px]"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Line
                </Button>
                <Button
                  onClick={handleSaveProposed}
                  loading={saving}
                  disabled={lineItems.every(item => {
                    if (item.type === "area") {
                      return !item.ratePerSqft || !item.sqft || parseFloat(item.ratePerSqft || "0") <= 0 || parseFloat(item.sqft || "0") <= 0;
                    } else if (item.type === "labor") {
                      return !item.hours || !item.ratePerHour || parseFloat(item.hours || "0") <= 0 || parseFloat(item.ratePerHour || "0") <= 0;
                    } else {
                      return !item.title.trim() || !item.price.trim() || parseFloat(item.price) <= 0;
                    }
                  })}
                  className="flex-1 touch-target min-h-[44px]"
                >
                  {currentPaymentState === "proposed" ? "Update Estimate" : "Create Estimate"}
                </Button>
              </div>
            </div>

            {editingEstimate && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingEstimate(false);
                    // Reset line items to initial state
                    setLineItems(
                      initialLineItems.length > 0
                        ? initialLineItems.map(item => ({ 
                            id: item.id, 
                            type: "other" as LineItemType,
                            title: item.title, 
                            price: (item.price / 100).toFixed(2) 
                          }))
                        : [{ type: "other", title: "", price: "" }]
                    );
                  }}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </div>
            )}
            </>
            )}
          </div>
        )}

        {/* APPROVED STATE - Price Locked */}
        {currentPaymentState === "approved" && !editingEstimate && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-success/10 border-success/20 p-4">
              <p className="text-sm font-medium text-success mb-2">
                ✓ Thanks for approving!
              </p>
              <p className="text-sm text-muted-foreground">
                Price is locked at {formatCurrency(paymentAmount || 0)}
              </p>
              {paymentApprovedAt && (
                <p className="text-xs text-muted-foreground mt-1">
                  Approved {formatDate(paymentApprovedAt)}
                </p>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  await loadExistingEstimate();
                  setEditingEstimate(true);
                }}
                disabled={loadingEstimateData}
                className="flex-1"
              >
                <Edit2 className="mr-2 h-4 w-4" />
                {loadingEstimateData ? "Loading..." : "Revise Estimate"}
              </Button>
              <Button
                onClick={handleMarkDue}
                loading={saving}
                className="flex-1"
              >
                <DollarSign className="mr-2 h-4 w-4" />
                Finalize Payment
              </Button>
            </div>
          </div>
        )}

        {/* DUE STATE - Payment Requested */}
        {currentPaymentState === "due" && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-warning/10 border-warning/20 p-4">
              <p className="text-sm font-medium text-foreground mb-2">
                💰 Payment Requested
              </p>
              <p className="text-sm text-muted-foreground">
                Amount due: {formatCurrency(paymentAmount || 0)}
              </p>
            </div>

            {/* Line Items (read-only) */}
            <div className="space-y-2">
              {initialLineItems.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.title}</span>
                  <span className="font-medium">{formatCurrency(item.price)}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={async () => {
                  await ensurePaymentToken();
                  setSharePaymentDialogOpen(true);
                }}
                className="flex-1"
              >
                <Share2 className="mr-2 h-4 w-4" />
                Share Payment
              </Button>
              <Button
                onClick={() => setMarkPaidDialogOpen(true)}
                className="flex-1"
              >
                <Check className="mr-2 h-4 w-4" />
                Mark as Paid
              </Button>
            </div>
          </div>
        )}

        {/* PAID STATE - Payment Complete */}
        {currentPaymentState === "paid" && (
          <div className="space-y-4">
            <div className="rounded-lg border bg-success/10 border-success/20 p-4">
              <p className="text-sm font-medium text-success mb-2">
                ✓ Payment Received
              </p>
              <div className="space-y-1 text-sm text-muted-foreground">
                {currentPaymentPaidAt && (
                  <p>Paid on {formatDate(currentPaymentPaidAt)}</p>
                )}
                {currentPaymentMethod && (
                  <p className="capitalize">Method: {currentPaymentMethod}</p>
                )}
              </div>
            </div>

            {/* Line Items (read-only) */}
            <div className="space-y-2">
              {initialLineItems.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span>{item.title}</span>
                  <span className="font-medium">{formatCurrency(item.price)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Mark Paid Dialog */}
      <Dialog open={markPaidDialogOpen} onOpenChange={setMarkPaidDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm text-muted-foreground">Amount:</p>
              <p className="text-2xl font-bold">{formatCurrency(paymentAmount || 0)}</p>
            </div>

            <div className="space-y-2">
              <Label>Payment Method</Label>
              <select
                value={paidMethod}
                onChange={(e) => setPaidMethod(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2"
              >
                <option value="cash">Cash</option>
                <option value="check">Check</option>
                <option value="card">Credit/Debit Card</option>
                <option value="zelle">Zelle</option>
                <option value="venmo">Venmo</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setMarkPaidDialogOpen(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleMarkPaid} loading={saving} className="flex-1">
                Record Payment
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
