"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, ExternalLink, Copy, Edit2, Check, DollarSign, Clock, Ruler, Users, Share2, MessageSquare, Pencil, ChevronDown, ChevronUp } from "lucide-react";
import { formatCurrency, formatDate, copyToClipboard, generateToken, PAINT_SHEENS } from "@/lib/utils";

// Product Lines by Brand
const PRODUCT_LINES_BY_BRAND: Record<string, string[]> = {
  "Sherwin-Williams": [
    "Duration",
    "Emerald",
    "SuperPaint",
    "ProClassic",
    "Cashmere",
    "Harmony",
    "Resilience",
    "A-100",
    "Captivate",
    "Classic 99",
    "ProMar 200",
    "ProMar 400",
    "ProMar 700",
    "Other"
  ],
  "Benjamin Moore": [
    "Aura",
    "Regal Select",
    "Ben",
    "Advance",
    "Command",
    "Coronado",
    "Grand Entrance",
    "Ultra Spec",
    "Scuff-X",
    "Other"
  ],
  "Behr": [
    "Premium Plus",
    "Ultra",
    "Marquee",
    "Scuff Defense",
    "Premium Plus Ultra",
    "Pro",
    "Other"
  ],
  "PPG": [
    "Pittsburgh Paints",
    "Olympic",
    "Porter Paints",
    "PPG Timeless",
    "Speedhide",
    "Other"
  ],
  "Other": [],
} as const;

// Common Sherwin-Williams Colors
const COMMON_SW_COLORS = [
  { code: "SW 7008", name: "Alabaster" },
  { code: "SW 7029", name: "Agreeable Gray" },
  { code: "SW 7015", name: "Repose Gray" },
  { code: "SW 7005", name: "Pure White" },
  { code: "SW 7006", name: "Extra White" },
  { code: "SW 7013", name: "Greek Villa" },
  { code: "SW 7014", name: "Classic Light Buff" },
  { code: "SW 7016", name: "Classic Gray" },
  { code: "SW 7018", name: "Classic French Gray" },
  { code: "SW 7023", name: "Classic Gray" },
  { code: "SW 7030", name: "Accessible Beige" },
  { code: "SW 7031", name: "Mindful Gray" },
  { code: "SW 7032", name: "Worldly Gray" },
  { code: "SW 7042", name: "Urbane Bronze" },
  { code: "SW 7043", name: "Iron Ore" },
  { code: "SW 7044", name: "Naval" },
  { code: "SW 7045", name: "Evergreen Fog" },
  { code: "SW 7048", name: "Peppercorn" },
  { code: "SW 7049", name: "Colonel Sanders" },
  { code: "SW 7050", name: "Copper Penny" },
  { code: "SW 7051", name: "Coral Reef" },
  { code: "SW 7052", name: "Sea Salt" },
  { code: "SW 7053", name: "Watery" },
  { code: "SW 7054", name: "Raindrops" },
  { code: "SW 7055", name: "Jade Dragon" },
  { code: "SW 7056", name: "Sage Green" },
  { code: "SW 7057", name: "Hale Navy" },
] as const;
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
  paintProductLine?: string; // "Duration", "Emerald", etc.
  paintNotes?: string; // Advanced notes
  paintAdvancedMode?: boolean; // Toggle for advanced options
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
  estimateMaterials?: Array<any>; // Materials for the latest estimate
  estimateLineItems?: Array<any>; // Full line items for the latest estimate
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
  estimateMaterials: initialEstimateMaterials = [],
  estimateLineItems: initialEstimateLineItems = [],
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

  // Update saved line items when initialLineItems prop changes (from parent refresh)
  useEffect(() => {
    if (initialLineItems.length > 0) {
      setSavedLineItems(initialLineItems);
    }
  }, [initialLineItems]);

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
          paintQuantityUnit: "gal",
          paintProductLine: "",
          paintNotes: "",
          paintAdvancedMode: false
        }))
      : [{ 
          type: "other", 
          title: "", 
          price: "",
          paintBrand: "",
          paintColor: "",
          paintSheen: "",
          paintQuantity: "",
          paintQuantityUnit: "gal",
          paintProductLine: "",
          paintNotes: "",
          paintAdvancedMode: false
        }]
  );
  const [savedLineItems, setSavedLineItems] = useState(initialLineItems);
  const [fullEstimateLineItems, setFullEstimateLineItems] = useState<any[]>(initialEstimateLineItems);
  const [saving, setSaving] = useState(false);
  const [markPaidDialogOpen, setMarkPaidDialogOpen] = useState(false);
  const [paidMethod, setPaidMethod] = useState("cash");
  const [editingEstimate, setEditingEstimate] = useState(false);
  const [loadingEstimateData, setLoadingEstimateData] = useState(false);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [sharePaymentDialogOpen, setSharePaymentDialogOpen] = useState(false);
  const [estimateMaterials, setEstimateMaterials] = useState<any[]>(initialEstimateMaterials);
  const [selectedPaymentMethods, setSelectedPaymentMethods] = useState<string[]>(["cash", "check", "venmo", "stripe"]);
  const [currentPublicToken, setCurrentPublicToken] = useState<string | undefined>(publicToken);
  const [currentPaymentToken, setCurrentPaymentToken] = useState<string | undefined>();
  const [loadingToken, setLoadingToken] = useState(false);
  const [loadingPaymentToken, setLoadingPaymentToken] = useState(false);
  const [estimateWasRevised, setEstimateWasRevised] = useState(false);

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

  // Sync estimate materials and line items from props (they're now fetched server-side)
  useEffect(() => {
    setEstimateMaterials(initialEstimateMaterials);
    setFullEstimateLineItems(initialEstimateLineItems);
  }, [initialEstimateMaterials, initialEstimateLineItems]);

  // Load existing estimate line items when editing
  async function loadExistingEstimate() {
    setLoadingEstimateData(true);
    try {
      // Always try to load from database first to get full details
      // Fetch the latest estimate (there may be multiple if revisions were created)
      const { data: estimates } = await supabase
        .from("estimates")
        .select("id, status, created_at")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false })
        .limit(1);

      const estimate = estimates?.[0] || null;
      
      if (!estimate) {
        // If no estimate exists, use saved or initial line items as fallback
        const itemsToUse = savedLineItems.length > 0 ? savedLineItems : initialLineItems;
        if (itemsToUse.length > 0) {
          const loadedItems = itemsToUse.map(item => ({
            id: item.id,
            type: "other" as LineItemType,
            title: item.title,
            price: (item.price / 100).toFixed(2),
            areaType: undefined,
            sqft: "",
            ratePerSqft: "",
            paintBrand: "",
            paintColor: "",
            paintSheen: "",
            paintQuantity: "",
            paintQuantityUnit: "gal" as const,
            paintProductLine: "",
            paintNotes: "",
            paintAdvancedMode: false
          }));
          setLineItems(loadedItems);
        }
        setLoadingEstimateData(false);
        return;
      }

      // Fetch estimate line items with paint details
      const { data: estimateLineItems } = await supabase
        .from("estimate_line_items")
        .select("*")
        .eq("estimate_id", estimate.id)
        .order("created_at", { ascending: true });

      // Fetch materials for this estimate
      const { data: materials } = await supabase
        .from("estimate_materials")
        .select("*")
        .eq("estimate_id", estimate.id);
      
      setEstimateMaterials(materials || []);

      if (estimateLineItems && estimateLineItems.length > 0) {
        const loadedItems = estimateLineItems.map(item => {
          // Determine type based on service_type
          let type: LineItemType = "other";
          let areaType: "walls" | "ceilings" | "trim" | "doors" | "exterior_walls" | "exterior_trim" | "deck_fence" | "siding" | "other" | undefined;

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

          // Parse brand and product line from description if available
          let paintBrand = "";
          let paintProductLine = "";
          let paintNotes = "";
          
          if (item.description) {
            const brandMatch = item.description.match(/BRAND:([^|]+)/);
            const productLineMatch = item.description.match(/PRODUCT_LINE:([^|]+)/);
            const notesMatch = item.description.match(/NOTES:([^|]+)/);
            
            if (brandMatch) paintBrand = brandMatch[1];
            if (productLineMatch) paintProductLine = productLineMatch[1];
            if (notesMatch) paintNotes = notesMatch[1];
          }
          
          // Fallback: if no brand/product line in description, use product_line as product line
          // and check if product_line is a brand name
          if (!paintBrand && !paintProductLine && item.product_line) {
            const knownBrands = ["Sherwin-Williams", "Benjamin Moore", "Behr", "PPG", "Other"];
            if (knownBrands.includes(item.product_line)) {
              paintBrand = item.product_line;
            } else {
              paintProductLine = item.product_line;
            }
          }

          return {
            id: item.id,
            type,
            title: item.name,
            price: (item.price / 100).toFixed(2),
            areaType,
            sqft: (item as any).sqft?.toString() || "",
            ratePerSqft: (item as any).rate_per_sqft?.toString() || "",
            paintBrand: paintBrand || "",
            paintColor: item.paint_color_name_or_code || "",
            paintSheen: item.sheen || "",
            paintQuantity: item.gallons_estimate?.toString() || "",
            paintQuantityUnit: "gal" as const,
            paintProductLine: paintProductLine || "",
            paintNotes: paintNotes || "",
            paintAdvancedMode: false
          };
        });

        setLineItems(loadedItems);
      } else {
        // No line items in DB, use initial line items if available
        if (initialLineItems.length > 0) {
          const loadedItems = initialLineItems.map(item => ({
            id: item.id,
            type: "other" as LineItemType,
            title: item.title,
            price: (item.price / 100).toFixed(2),
            areaType: undefined,
            sqft: "",
            ratePerSqft: "",
            paintBrand: "",
            paintColor: "",
            paintSheen: "",
            paintQuantity: "",
            paintQuantityUnit: "gal" as const,
            paintProductLine: "",
            paintNotes: "",
            paintAdvancedMode: false
          }));
          setLineItems(loadedItems);
        }
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
        // Ensure job has unified_job_token
        const { data: jobData } = await supabase
          .from("jobs")
          .select("unified_job_token")
          .eq("id", jobId)
          .single();
        
        if (jobData && !jobData.unified_job_token) {
          const unifiedToken = generateToken(24);
          await supabase
            .from("jobs")
            .update({ unified_job_token: unifiedToken })
            .eq("id", jobId);
        }

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

  const updateLineItem = (index: number, field: keyof PaymentLineItem, value: string | LineItemType | boolean) => {
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
      paintQuantityUnit: "gal",
      paintProductLine: "",
      paintNotes: "",
      paintAdvancedMode: false
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

      // First check if estimate exists for this job (get the latest one)
      const { data: existingEstimates } = await supabase
        .from("estimates")
        .select("id, public_token, status")
        .eq("job_id", jobId)
        .order("created_at", { ascending: false })
        .limit(1);

      const existingEstimate = existingEstimates?.[0] || null;

      let estimateId: string = "";
      let estimateData;
      let estimateError;

      if (existingEstimate) {
        // Check if estimate is accepted or denied - if so, we need to handle it differently
        // The database trigger prevents modifying accepted/denied estimates
        const currentEstimate = existingEstimate; // Already have the status from the query above
        
        // If estimate is accepted or denied, we can't modify it directly due to database constraints
        // Instead, we'll create a new estimate revision with a NEW token
        // The public estimate page will find this new estimate by looking up the latest "sent" estimate for the job
        // This means the customer's original link will still work - it finds the job, then shows the latest estimate
        if (currentEstimate?.status === "accepted" || currentEstimate?.status === "denied") {
          // For accepted or denied estimates, create a new estimate revision
          // Use a new token (database has unique constraint on public_token)
          // The estimate viewing page handles this by looking up the latest "sent" estimate for the job
          const newToken = generateToken(24);

          // Create the new estimate with a new token
          const { data, error } = await supabase
            .from("estimates")
            .insert({
              company_id: companyId,
              job_id: jobId,
              customer_id: customerId,
              status: "sent",
              public_token: newToken,
            })
            .select("id, public_token")
            .single();
          estimateData = data;
          estimateError = error;
          estimateId = data?.id || "";

          // If there was an error, log it properly
          if (error) {
            console.error("Error creating new estimate revision:", {
              message: error.message,
              details: error.details,
              hint: error.hint,
              code: error.code,
            });
          } else {
            // Reset job approval status since we're creating a new estimate revision
            // Get current job status first
            const { data: currentJobForRevision } = await supabase
              .from("jobs")
              .select("status")
              .eq("id", jobId)
              .single();

            const { error: jobUpdateError } = await supabase
              .from("jobs")
              .update({
                payment_state: "proposed",
                payment_approved_at: null,
                status: currentJobForRevision?.status === "quoted" ? "new" : currentJobForRevision?.status || "new", // Reset from quoted if it was quoted
                updated_at: new Date().toISOString(),
              })
              .eq("id", jobId);

            if (jobUpdateError) {
              console.error("Error updating job after creating revision:", jobUpdateError);
            }
          }
        } else {
          // Update existing estimate and reset approval status
          const updateData: any = {
            public_token: token,
            status: "sent",
            updated_at: new Date().toISOString(),
          };
          
          // Only update customer_id if provided
          if (customerId) {
            updateData.customer_id = customerId;
          }
          
          // Reset acceptance if revising
          updateData.accepted_at = null;
          updateData.denied_at = null;
          updateData.denial_reason = null;
          
          const { data, error } = await supabase
            .from("estimates")
            .update(updateData)
            .eq("id", existingEstimate.id)
            .select("id, public_token")
            .single();
          estimateData = data;
          estimateError = error;
          estimateId = existingEstimate.id;
          
          // Reset job approval status since we're revising the estimate
          // Check if job was previously approved
          const { data: currentJob } = await supabase
            .from("jobs")
            .select("payment_state, status")
            .eq("id", jobId)
            .single();
          
          if (currentJob?.payment_state === "approved") {
            await supabase
              .from("jobs")
              .update({
                payment_state: "proposed",
                payment_approved_at: null,
                status: currentJob.status === "quoted" ? "new" : currentJob.status, // Reset from quoted if it was quoted
                updated_at: new Date().toISOString(),
              })
              .eq("id", jobId);
          }
        }
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
        console.error("Estimate create/update error:", {
          message: estimateError.message,
          details: estimateError.details,
          hint: estimateError.hint,
          code: estimateError.code,
        });
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

              // Store brand and product line information in description for material generation
              // Format: "BRAND:brand_name|PRODUCT_LINE:product_line|NOTES:notes"
              let description = "";
              if (item.paintBrand || item.paintProductLine || item.paintNotes) {
                const parts: string[] = [];
                if (item.paintBrand) parts.push(`BRAND:${item.paintBrand}`);
                if (item.paintProductLine) parts.push(`PRODUCT_LINE:${item.paintProductLine}`);
                if (item.paintNotes) parts.push(`NOTES:${item.paintNotes}`);
                description = parts.join("|");
              }

              return {
                estimate_id: estimateId,
                service_key: "other",
                service_type: serviceType,
                name,
                description: description || null,
                price,
                sqft: item.type === "area" && item.sqft ? parseFloat(item.sqft) : null,
                rate_per_sqft: item.type === "area" && item.ratePerSqft ? parseFloat(item.ratePerSqft) : null,
                paint_color_name_or_code: item.paintColor || null,
                sheen: item.paintSheen || null,
                product_line: item.paintProductLine || item.paintBrand || null, // Store product line if exists, otherwise brand
                gallons_estimate: item.paintQuantity ? parseFloat(item.paintQuantity) : null,
                vendor_sku: null,
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
      const wasDenied = estimateStatus === "denied";

      if (wasApproved) {
        addToast("Estimate revised - customer needs to approve again", "success");
        // Immediately update local state to show proposed UI
        setCurrentPaymentState("proposed");
      } else if (wasDenied) {
        addToast("Estimate revised - sent to customer for approval", "success");
        // Mark that the estimate was revised so we hide the denied banner
        setEstimateWasRevised(true);
        setCurrentPaymentState("proposed");
      } else {
        addToast("Estimate saved", "success");
      }
      setEditingEstimate(false);

      // Reload estimate data to ensure details are properly displayed
      if (estimateId) {
        try {
          // Fetch updated line items from database
          const { data: updatedLineItems } = await supabase
            .from("estimate_line_items")
            .select("*")
            .eq("estimate_id", estimateId)
            .order("created_at");

          // Fetch materials after saving
          const { data: materials } = await supabase
            .from("estimate_materials")
            .select("*")
            .eq("estimate_id", estimateId);
          setEstimateMaterials(materials || []);

          // Update full estimate line items
          setFullEstimateLineItems(updatedLineItems || []);

          // Update saved line items from database
          if (updatedLineItems && updatedLineItems.length > 0) {
            const savedItems = updatedLineItems.map((item) => ({
              id: item.id,
              title: item.name,
              price: item.price,
            }));
            setSavedLineItems(savedItems);
          } else {
            // Fallback to current line items if database fetch fails
            const savedItems = lineItems
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
                  id: `saved-${index}-${Date.now()}`,
                  title,
                  price,
                };
              });
            setSavedLineItems(savedItems);
          }
        } catch (error) {
          console.error("Failed to reload estimate data:", error);
        }
      }

      // Call onUpdate to refresh parent component data
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

    const link = `${window.location.origin}/portal/${token}`;
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

    const link = `${window.location.origin}/portal/${token}`;
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
                    value={loadingToken ? "Generating..." : (typeof window !== "undefined" && (currentPublicToken || publicToken) ? `${window.location.origin}/portal/${currentPublicToken || publicToken}` : "No token available")}
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
                  value={loadingToken ? "Generating link..." : `Hey there — here's your estimate for ${formatCurrency(paymentAmount || totalAmount)}: ${typeof window !== "undefined" && (currentPublicToken || publicToken) ? `${window.location.origin}/portal/${currentPublicToken || publicToken}` : "[link will be generated]"}. Let me know if you have any questions!`}
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
                        value={typeof window !== "undefined" && currentPaymentToken ? `${window.location.origin}/j/${currentPaymentToken}?tab=payment` : ""} 
                        readOnly 
                        className="font-mono text-sm"
                      />
                      <Button 
                        variant="outline"
                        onClick={() => {
                          const link = `${window.location.origin}/j/${currentPaymentToken}?tab=payment`;
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
                      value={`Hey there — here's your invoice for ${formatCurrency(paymentAmount || 0)}: ${typeof window !== "undefined" && currentPaymentToken ? `${window.location.origin}/j/${currentPaymentToken}?tab=payment` : "[link will be generated]"}. Thank you!`}
                      readOnly 
                      rows={4}
                      className="mt-2 font-sans"
                    />
                    <Button 
                      onClick={() => {
                        const link = `${window.location.origin}/j/${currentPaymentToken}?tab=payment`;
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
            {estimateStatus === "denied" && !estimateWasRevised && (
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
        {estimateStatus === "denied" && !editingEstimate && !estimateWasRevised && (
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
                <p className="text-xs text-muted-foreground mt-2">
                  Review the customer's feedback and use the "Edit Estimate" button below to revise the estimate.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* EDITING MODE - Show form when editing any state */}
        {editingEstimate && (
          <div className="space-y-4">
            {/* Context message when editing approved/denied estimate */}
            {(currentPaymentState === "approved" || (estimateStatus === "denied" && !estimateWasRevised)) && (
              <div className="rounded-lg border bg-warning/10 border-warning/20 p-4">
                {currentPaymentState === "approved" ? (
                  <>
                    <p className="text-sm font-medium text-warning mb-2">
                      Revising Approved Estimate
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Current approved price: {formatCurrency(paymentAmount || 0)}
                    </p>
                    {paymentApprovedAt && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Originally approved {formatDate(paymentApprovedAt)}
                      </p>
                    )}
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-warning mb-2">
                      Revising Denied Estimate
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Make changes based on customer feedback and resend.
                    </p>
                  </>
                )}
              </div>
            )}
            
            {/* Editing Form */}
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
                          <div className="flex items-center justify-between">
                            <Label className="text-xs font-semibold">Paint Details</Label>
                            <button
                              type="button"
                              onClick={() => updateLineItem(index, "paintAdvancedMode", !item.paintAdvancedMode)}
                              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                            >
                              {item.paintAdvancedMode ? (
                                <>
                                  <ChevronUp className="h-3 w-3" />
                                  Hide Advanced
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3 w-3" />
                                  Advanced Options
                                </>
                              )}
                            </button>
                          </div>

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
                              <div className="relative">
                                <Input
                                  placeholder="e.g., SW 7008 Alabaster"
                                  value={item.paintColor || ""}
                                  onChange={(e) => updateLineItem(index, "paintColor", e.target.value)}
                                  className="min-h-[44px] pr-8"
                                  list={`color-suggestions-${index}`}
                                />
                                <datalist id={`color-suggestions-${index}`}>
                                  {COMMON_SW_COLORS.map((color) => (
                                    <option key={color.code} value={`${color.code} ${color.name}`}>
                                      {color.name}
                                    </option>
                                  ))}
                                </datalist>
                              </div>
                            </div>
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

                          {/* Advanced Options */}
                          {item.paintAdvancedMode && (
                            <div className="rounded-lg border bg-muted/30 p-4 space-y-3 mt-3">
                              {/* Product Line - Show when a brand with product lines is selected */}
                              {item.paintBrand && PRODUCT_LINES_BY_BRAND[item.paintBrand] && PRODUCT_LINES_BY_BRAND[item.paintBrand].length > 0 && (
                                <div className="space-y-2">
                                  <Label className="text-xs text-muted-foreground">Product Line</Label>
                                  <Select
                                    value={item.paintProductLine || ""}
                                    onChange={(e) => updateLineItem(index, "paintProductLine", e.target.value)}
                                    className="min-h-[44px]"
                                  >
                                    <option value="">Select product line...</option>
                                    {PRODUCT_LINES_BY_BRAND[item.paintBrand].map((line) => (
                                      <option key={line} value={line}>
                                        {line}
                                      </option>
                                    ))}
                                  </Select>
                                </div>
                              )}
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Sheen</Label>
                                <Select
                                  value={item.paintSheen || ""}
                                  onChange={(e) => updateLineItem(index, "paintSheen", e.target.value)}
                                  className="min-h-[44px]"
                                >
                                  <option value="">Select sheen...</option>
                                  {PAINT_SHEENS.map((sheen) => (
                                    <option key={sheen} value={sheen}>
                                      {sheen}
                                    </option>
                                  ))}
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs text-muted-foreground">Notes</Label>
                                <Textarea
                                  placeholder="e.g., Back wall only, Second coat needed, Special prep required..."
                                  value={item.paintNotes || ""}
                                  onChange={(e) => updateLineItem(index, "paintNotes", e.target.value)}
                                  rows={3}
                                  className="text-sm"
                                />
                                <p className="text-xs text-muted-foreground">
                                  Add any special instructions or notes about this paint application
                                </p>
                              </div>
                            </div>
                          )}
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
                  {currentPaymentState === "proposed" || currentPaymentState === "approved" || (estimateStatus === "denied" && !estimateWasRevised)
                    ? "Update Estimate"
                    : "Create Estimate"}
                </Button>
              </div>
              
              {/* Cancel button */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingEstimate(false);
                    // Reset line items to saved state
                    setLineItems(
                      savedLineItems.length > 0
                        ? savedLineItems.map(item => ({ 
                            id: item.id, 
                            type: "other" as LineItemType,
                            title: item.title, 
                            price: (item.price / 100).toFixed(2) 
                          }))
                        : initialLineItems.length > 0
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
            </div>
          </div>
        )}

        {/* VIEW MODE - Show details when NOT editing */}
        {!editingEstimate && (
          <>
            {/* NONE/PROPOSED STATE */}
            {(currentPaymentState === "none" || currentPaymentState === "proposed") && (
              <div className="space-y-4">
                {(savedLineItems.length > 0 || initialLineItems.length > 0) ? (
                  <>
                    <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-sm">Estimate Total</h4>
                        <span className="text-lg font-bold">{formatCurrency(paymentAmount || totalAmount)}</span>
                      </div>
                      <div className="space-y-3">
                        {(savedLineItems.length > 0 ? savedLineItems : initialLineItems).map((item, index) => {
                          // Find matching full estimate line item by index (since IDs are from different tables)
                          const fullItem = fullEstimateLineItems[index];
                          // Match materials by estimate_line_item_id (from fullEstimateLineItems) or by name
                          const fullItemId = fullItem?.id;
                          const itemMaterials = estimateMaterials.filter(
                            (m: any) => {
                              // Match by estimate_line_item_id if we have a fullItem
                              if (m.estimate_line_item_id && fullItemId && m.estimate_line_item_id === fullItemId) {
                                return true;
                              }
                              // Fallback to name matching
                              const itemNameLower = item.title?.toLowerCase() || '';
                              const areaDescLower = m.area_description?.toLowerCase() || '';
                              if (areaDescLower && itemNameLower) {
                                if (areaDescLower.includes(itemNameLower) || itemNameLower.includes(areaDescLower)) {
                                  return true;
                                }
                                const itemWords = itemNameLower.split(/\s+/);
                                const areaWords = areaDescLower.split(/\s+/);
                                if (itemWords.some(word => word.length > 3 && areaWords.includes(word))) {
                                  return true;
                                }
                              }
                              return false;
                            }
                          );

                          return (
                            <div key={item.id} className="space-y-2">
                              <div className="flex justify-between text-sm">
                                <div>
                                  <span className="font-medium">{item.title}</span>
                                  {fullItem && fullItem.service_type === "sqft" && fullItem.sqft && fullItem.rate_per_sqft && (
                                    <span className="text-xs text-muted-foreground ml-2">
                                      ({fullItem.sqft} sqft @ ${fullItem.rate_per_sqft}/sqft)
                                    </span>
                                  )}
                                </div>
                                <span className="font-medium">{formatCurrency(item.price)}</span>
                              </div>
                              
                              {itemMaterials.length > 0 && (
                                <div className="ml-4 pl-3 border-l-2 border-muted space-y-1 text-xs text-muted-foreground">
                                  {itemMaterials.map((material: any) => (
                                    <div key={material.id} className="space-y-0.5">
                                      {material.paint_product && (
                                        <div className="font-medium text-foreground">
                                          {material.paint_product}
                                        </div>
                                      )}
                                      {(material.color_name || material.color_code || material.sheen) && (
                                        <div>
                                          {material.color_name && <span>{material.color_name}</span>}
                                          {material.color_code && <span className="ml-1">({material.color_code})</span>}
                                          {material.sheen && <span className="ml-1">- {material.sheen}</span>}
                                        </div>
                                      )}
                                      {material.quantity_gallons && (
                                        <div className="text-xs">
                                          {material.quantity_gallons} {material.quantity_gallons === 1 ? 'gallon' : 'gallons'}
                                        </div>
                                      )}
                                      {material.notes && (
                                        <div className="italic text-muted-foreground mt-1">
                                          {material.notes}
                                        </div>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                          await loadExistingEstimate();
                          setEditingEstimate(true);
                        }}
                        className="flex-1 touch-target min-h-[44px]"
                      >
                        Edit Estimate
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        onClick={async () => {
                          await ensurePublicToken();
                          setShareDialogOpen(true);
                        }}
                        className="flex-1 touch-target min-h-[44px]"
                      >
                        <Share2 className="mr-2 h-4 w-4" />
                        Share Estimate
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="flex gap-2">
                    <Button
                      onClick={() => setEditingEstimate(true)}
                      className="flex-1 touch-target min-h-[44px]"
                    >
                      Create Estimate
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* APPROVED STATE */}
            {currentPaymentState === "approved" && (
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

                {(savedLineItems.length > 0 || initialLineItems.length > 0) && (
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Estimate Details</h4>
                      <span className="text-lg font-bold">{formatCurrency(paymentAmount || totalAmount)}</span>
                    </div>
                    <div className="space-y-3">
                      {(savedLineItems.length > 0 ? savedLineItems : initialLineItems).map((item, index) => {
                        // Match by index since IDs are from different tables
                        const fullItemId = fullEstimateLineItems[index]?.id;
                        const itemMaterials = estimateMaterials.filter(
                          (m: any) => {
                            // Match by estimate_line_item_id if we have a fullItem
                            if (m.estimate_line_item_id && fullItemId && m.estimate_line_item_id === fullItemId) {
                              return true;
                            }
                            // Fallback to name matching
                            const itemNameLower = item.title?.toLowerCase() || '';
                            const areaDescLower = m.area_description?.toLowerCase() || '';
                            if (areaDescLower && itemNameLower) {
                              if (areaDescLower.includes(itemNameLower) || itemNameLower.includes(areaDescLower)) {
                                return true;
                              }
                              const itemWords = itemNameLower.split(/\s+/);
                              const areaWords = areaDescLower.split(/\s+/);
                              if (itemWords.some(word => word.length > 3 && areaWords.includes(word))) {
                                return true;
                              }
                            }
                            return false;
                          }
                        );

                        return (
                          <div key={item.id} className="space-y-2">
                            <div className="flex justify-between text-sm">
                              <span className="font-medium">{item.title}</span>
                              <span className="font-medium">{formatCurrency(item.price)}</span>
                            </div>

                            {itemMaterials.length > 0 && (
                              <div className="ml-4 pl-3 border-l-2 border-muted space-y-1 text-xs text-muted-foreground">
                                {itemMaterials.map((material: any) => (
                                  <div key={material.id} className="space-y-0.5">
                                    {material.paint_product && (
                                      <div className="font-medium text-foreground">
                                        {material.paint_product}
                                      </div>
                                    )}
                                    {(material.color_name || material.color_code || material.sheen) && (
                                      <div>
                                        {material.color_name && <span>{material.color_name}</span>}
                                        {material.color_code && <span className="ml-1">({material.color_code})</span>}
                                        {material.sheen && <span className="ml-1">- {material.sheen}</span>}
                                      </div>
                                    )}
                                    {material.quantity_gallons && (
                                      <div className="text-xs">
                                        {material.quantity_gallons} {material.quantity_gallons === 1 ? 'gallon' : 'gallons'}
                                      </div>
                                    )}
                                    {material.notes && (
                                      <div className="italic text-muted-foreground mt-1">
                                        {material.notes}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

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
          </>
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

            {/* Estimate Details (read-only) - Show full details for records */}
            {(savedLineItems.length > 0 || initialLineItems.length > 0) && (
              <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">Estimate Total</h4>
                  <span className="text-lg font-bold">{formatCurrency(paymentAmount || totalAmount)}</span>
                </div>
                <div className="space-y-3">
                  {(savedLineItems.length > 0 ? savedLineItems : initialLineItems).map((item, index) => {
                    // Find matching full estimate line item by index (since IDs are from different tables)
                    const fullItem = fullEstimateLineItems[index];
                    const fullItemId = fullItem?.id;
                    const itemMaterials = estimateMaterials.filter(
                      (m: any) => {
                        // Match by estimate_line_item_id if we have a fullItem
                        if (m.estimate_line_item_id && fullItemId && m.estimate_line_item_id === fullItemId) {
                          return true;
                        }
                        // Fallback to name matching
                        const itemNameLower = item.title?.toLowerCase() || '';
                        const areaDescLower = m.area_description?.toLowerCase() || '';
                        if (areaDescLower && itemNameLower) {
                          if (areaDescLower.includes(itemNameLower) || itemNameLower.includes(areaDescLower)) {
                            return true;
                          }
                          const itemWords = itemNameLower.split(/\s+/);
                          const areaWords = areaDescLower.split(/\s+/);
                          if (itemWords.some(word => word.length > 3 && areaWords.includes(word))) {
                            return true;
                          }
                        }
                        return false;
                      }
                    );

                    return (
                      <div key={item.id} className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <div>
                            <span className="font-medium">{item.title}</span>
                            {fullItem && fullItem.service_type === "sqft" && fullItem.sqft && fullItem.rate_per_sqft && (
                              <span className="text-xs text-muted-foreground ml-2">
                                ({fullItem.sqft} sqft @ ${fullItem.rate_per_sqft}/sqft)
                              </span>
                            )}
                          </div>
                          <span className="font-medium">{formatCurrency(item.price)}</span>
                        </div>

                        {itemMaterials.length > 0 && (
                          <div className="ml-4 pl-3 border-l-2 border-muted space-y-1 text-xs text-muted-foreground">
                            {itemMaterials.map((material: any) => (
                              <div key={material.id} className="space-y-0.5">
                                {material.paint_product && (
                                  <div className="font-medium text-foreground">
                                    {material.paint_product}
                                  </div>
                                )}
                                {(material.color_name || material.color_code || material.sheen) && (
                                  <div>
                                    {material.color_name && <span>{material.color_name}</span>}
                                    {material.color_code && <span className="ml-1">({material.color_code})</span>}
                                    {material.sheen && <span className="ml-1">- {material.sheen}</span>}
                                  </div>
                                )}
                                {material.quantity_gallons && (
                                  <div className="text-xs">
                                    {material.quantity_gallons} {material.quantity_gallons === 1 ? 'gallon' : 'gallons'}
                                  </div>
                                )}
                                {material.notes && (
                                  <div className="italic text-muted-foreground mt-1">
                                    {material.notes}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
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
