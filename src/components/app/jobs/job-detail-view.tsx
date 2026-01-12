"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  cn,
  formatDate,
  formatTime,
  formatCurrency,
  copyToClipboard,
  generateToken,
  COMMON_MATERIALS,
  JOB_STATUS_LABELS,
  JOB_STATUS_COLORS,
  type JobStatus,
} from "@/lib/utils";
import type { Job, Customer, Estimate, EstimateLineItem, Invoice, JobMaterial, EstimatingConfig } from "@/types/database";
import { JobHistoryTimeline } from "./job-history-timeline";
import { MessageTemplatesDialog } from "./message-templates-dialog";
import { JobTemplatesDialog } from "./job-templates-dialog";
import { PhotoGallery } from "./photo-gallery";
import { UnifiedPayment } from "./unified-payment";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SimpleCheckbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Phone,
  Mail,
  User,
  FileText,
  Receipt,
  Package,
  Copy,
  Plus,
  Trash2,
  ExternalLink,
  X,
  Pencil,
  Share2,
  MoreVertical,
  Archive,
  Save,
  CheckCircle,
} from "lucide-react";

type JobWithCustomer = Job & { customer: Customer | null };
type EstimateWithLineItems = Estimate & { line_items: EstimateLineItem[] };

interface JobHistory {
  id: string;
  job_id: string;
  status: string;
  changed_by: string | null;
  changed_at: string;
  notes: string | null;
}

interface JobDetailViewProps {
  job: JobWithCustomer;
  estimates: EstimateWithLineItems[];
  invoices: Invoice[];
  materials: JobMaterial[];
  jobHistory?: JobHistory[];
  teamMembers: { id: string; email: string; fullName: string }[];
  companyId: string;
  estimatingConfig?: EstimatingConfig | null;
}

export function JobDetailView({
  job: initialJob,
  estimates,
  invoices,
  materials: initialMaterials,
  jobHistory = [],
  teamMembers,
  companyId,
  estimatingConfig,
}: JobDetailViewProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const supabase = createClient();
  
  // Get current user ID from Supabase auth
  const [currentUserId, setCurrentUserId] = useState<string>("");
  
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUserId(user.id);
      }
    };
    fetchUser();
  }, [supabase]);

  const [job, setJob] = useState(initialJob);
  const [materials, setMaterials] = useState(initialMaterials);
  const [estimatesList, setEstimatesList] = useState(estimates);
  const [invoicesList, setInvoicesList] = useState(invoices);
  const [pickupLocations, setPickupLocations] = useState<Array<{ id: string; name: string }>>([]);
  const [selectedPickupLocation, setSelectedPickupLocation] = useState<string | null>(job.pickup_location_id || null);
  const [timeEntries, setTimeEntries] = useState<Array<{
    id: string;
    user_id: string;
    started_at: string;
    ended_at: string | null;
    duration_seconds: number | null;
    user?: { full_name: string };
  }>>([]);
  const [loadingTimeEntries, setLoadingTimeEntries] = useState(false);
  const [addingTimeEntry, setAddingTimeEntry] = useState(false);
  const [editingTimeEntry, setEditingTimeEntry] = useState<string | null>(null);
  const [newTimeEntry, setNewTimeEntry] = useState({
    userId: currentUserId,
    hours: "",
    date: new Date().toISOString().split("T")[0],
  });
  const [paymentLineItems, setPaymentLineItems] = useState<Array<{
    id: string;
    title: string;
    price: number;
  }>>([]);

  // Sync state with props when they change (e.g., after navigation)
  useEffect(() => {
    setJob(initialJob);
    setMaterials(initialMaterials);
    setEstimatesList(estimates);
    setInvoicesList(invoices);
  }, [initialJob.id, initialMaterials.length, estimates.length, invoices.length]);

  // Real-time subscription for estimate updates
  useEffect(() => {
    const channel = supabase
      .channel(`job-${job.id}-estimates`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'estimates',
          filter: `job_id=eq.${job.id}`,
        },
        (payload) => {
          // Update the estimate in the list
          setEstimatesList((prev) =>
            prev.map((est) =>
              est.id === payload.new.id ? { ...est, ...payload.new } : est
            )
          );
          
          // If estimate was accepted, update job status to quoted
          if (payload.new.status === 'accepted' && job.status === 'new') {
            setJob((prev) => ({ ...prev, status: 'quoted' }));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [job.id, job.status, supabase]);
  const [saving, setSaving] = useState(false);
  const [newMaterial, setNewMaterial] = useState("");
  const [showCommonMaterials, setShowCommonMaterials] = useState(false);
  const notesTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Inline add forms
  const [showAddEstimate, setShowAddEstimate] = useState(false);
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [estimateLineItems, setEstimateLineItems] = useState<Array<{ title: string; price: string }>>([{ title: "", price: "" }]);
  const [newInvoiceAmount, setNewInvoiceAmount] = useState("");
  const [addingEstimate, setAddingEstimate] = useState(false);
  const [addingInvoice, setAddingInvoice] = useState(false);
  const [messageTemplatesOpen, setMessageTemplatesOpen] = useState(false);
  const [selectedEstimate, setSelectedEstimate] = useState<EstimateWithLineItems | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showShareScheduleDialog, setShowShareScheduleDialog] = useState(false);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [scheduleToken, setScheduleToken] = useState<string | null>((job as any).schedule_token || null);
  const [loadingScheduleToken, setLoadingScheduleToken] = useState(false);
  const [templateDialogMode, setTemplateDialogMode] = useState<"save" | "manage">("save");
  const [showCopyDialog, setShowCopyDialog] = useState(false);
  const [copyDialogType, setCopyDialogType] = useState<"estimate" | "invoice" | "materials" | "reminder" | "schedule-confirmation">("estimate");
  const [materialType, setMaterialType] = useState<"paint" | "generic">("generic");
  const [editingCostId, setEditingCostId] = useState<string | null>(null);
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState(false);
  const [editingTracking, setEditingTracking] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [editingMaterials, setEditingMaterials] = useState(false);
  const [editingPhotos, setEditingPhotos] = useState(false);
  const [materialFormData, setMaterialFormData] = useState({
    name: "",
    brand: "",
    color: "",
    sheen: "",
    quantity: "",
    quantityUnit: "gal",
    productLine: "",
    area: "",
    notes: "",
    showAdvanced: false
  });

  // Form state
  const [scheduledDate, setScheduledDate] = useState(job.scheduled_date || "");
  const [scheduledTime, setScheduledTime] = useState(job.scheduled_time || "");
  const [assignedUserId, setAssignedUserId] = useState(job.assigned_user_id || "");
  const [notes, setNotes] = useState(job.notes || "");

  const address = [job.address1, job.city, job.state, job.zip]
    .filter(Boolean)
    .join(", ");

  // Auto-save function
  async function autoSave(fields: {
    scheduled_date?: string | null;
    scheduled_time?: string | null;
    assigned_user_id?: string | null;
    notes?: string | null;
  }) {
    try {
      const { error } = await supabase
        .from("jobs")
        .update({
          ...fields,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      if (error) {
        console.error("Auto-save error:", error);
        return;
      }

      setJob((prev) => ({
        ...prev,
        ...fields,
      }));
    } catch (err) {
      console.error("Auto-save error:", err);
    }
  }

  // Ensure schedule token exists
  async function ensureScheduleToken() {
    if (scheduleToken) return scheduleToken;
    
    setLoadingScheduleToken(true);
    try {
      const token = generateToken(24);
      
      const { error } = await supabase
        .from("jobs")
        .update({
          schedule_token: token,
        })
        .eq("id", job.id);

      if (error) throw error;

      setScheduleToken(token);
      setJob((prev) => ({ ...prev, schedule_token: token } as any));
      return token;
    } catch (err) {
      console.error("Failed to generate schedule token:", err);
      addToast("Failed to generate schedule link", "error");
      return null;
    } finally {
      setLoadingScheduleToken(false);
    }
  }

  // Save handlers (no auto-save)
  async function handleSaveSchedule() {
    if (!scheduledDate || !scheduledTime) {
      addToast("Please set both date and time", "error");
      return;
    }

    try {
      // Generate token if it doesn't exist
      const token = scheduleToken || generateToken(24);
      
      const { error } = await supabase
        .from("jobs")
        .update({
          scheduled_date: scheduledDate || null,
          scheduled_time: scheduledTime || null,
          schedule_state: "proposed",
          schedule_token: token,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      if (error) {
        addToast("Failed to save schedule", "error");
        return;
      }

      setJob((prev) => ({
        ...prev,
        scheduled_date: scheduledDate || null,
        scheduled_time: scheduledTime || null,
        schedule_state: "proposed",
        schedule_token: token,
      } as any));
      setScheduleToken(token);
      setEditingSchedule(false);
      addToast("Schedule saved and ready to share", "success");
      router.refresh();
    } catch (err) {
      console.error("Save error:", err);
      addToast("Failed to save schedule", "error");
    }
  }

  async function handleAcceptSchedule() {
    try {
      const { error } = await supabase
        .from("jobs")
        .update({
          schedule_state: "accepted",
          schedule_accepted_at: new Date().toISOString(),
          status: "scheduled",
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      if (error) {
        addToast("Failed to accept schedule", "error");
        return;
      }

      setJob((prev) => ({
        ...prev,
        schedule_state: "accepted",
        schedule_accepted_at: new Date().toISOString(),
        status: "scheduled",
      } as any));
      addToast("Schedule accepted!", "success");
      router.refresh();
    } catch (err) {
      console.error("Accept error:", err);
      addToast("Failed to accept schedule", "error");
    }
  }

  async function handleSaveAssignment() {
    try {
      const { error } = await supabase
        .from("jobs")
        .update({
          assigned_user_id: assignedUserId || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      if (error) {
        addToast("Failed to save assignment", "error");
        return;
      }

      setJob((prev) => ({
        ...prev,
        assigned_user_id: assignedUserId || null,
      }));
      addToast("Assignment saved", "success");
    } catch (err) {
      console.error("Save error:", err);
      addToast("Failed to save assignment", "error");
    }
  }

  async function handleSaveNotes() {
    try {
      const { error } = await supabase
        .from("jobs")
        .update({
          notes: notes || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      if (error) {
        addToast("Failed to save notes", "error");
        return;
      }

      setJob((prev) => ({
        ...prev,
        notes: notes || null,
      }));
      setEditingNotes(false);
      addToast("Notes saved", "success");
    } catch (err) {
      console.error("Save error:", err);
      addToast("Failed to save notes", "error");
    }
  }

  async function handlePickupLocationChange(locationId: string | null) {
    setSelectedPickupLocation(locationId);
    // Save immediately for pickup location as it's a simple select
    try {
      const { error } = await supabase
        .from("jobs")
        .update({
          pickup_location_id: locationId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      if (error) {
        addToast("Failed to save pickup location", "error");
        return;
      }

      setJob((prev) => ({
        ...prev,
        pickup_location_id: locationId,
      } as any));
      addToast("Pickup location saved", "success");
    } catch (err) {
      console.error("Save error:", err);
      addToast("Failed to save pickup location", "error");
    }
  }

  async function handleAddTimeEntry() {
    if (!newTimeEntry.hours || parseFloat(newTimeEntry.hours) <= 0) {
      addToast("Please enter valid hours", "error");
      return;
    }
    if (!newTimeEntry.userId) {
      addToast("Please select a worker", "error");
      return;
    }

    setAddingTimeEntry(true);
    try {
      const hours = parseFloat(newTimeEntry.hours);
      const durationSeconds = Math.round(hours * 3600);
      const startDateTime = `${newTimeEntry.date}T09:00:00`; // Default to 9 AM
      const endDateTime = new Date(new Date(startDateTime).getTime() + durationSeconds * 1000).toISOString();

      const { data, error } = await supabase
        .from("time_entries")
        .insert({
          job_id: job.id,
          company_id: companyId,
          user_id: newTimeEntry.userId,
          started_at: startDateTime,
          ended_at: endDateTime,
          duration_seconds: durationSeconds,
        })
        .select(`
          id,
          user_id,
          started_at,
          ended_at,
          duration_seconds,
          user:user_id (full_name)
        `)
        .single();

      if (error) throw error;

      // Refresh time entries to get updated user info
      const { data: refreshedEntries } = await supabase
        .from("time_entries")
        .select(`
          id,
          user_id,
          started_at,
          ended_at,
          duration_seconds
        `)
        .eq("job_id", job.id)
        .order("started_at", { ascending: false });
      
      if (refreshedEntries) {
        // Fetch user profiles
        const userIds = [...new Set(refreshedEntries.map(e => e.user_id).filter((id): id is string => id !== null))];
        let userMap: Record<string, { full_name: string }> = {};
        
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("user_profiles")
            .select("id, full_name")
            .in("id", userIds);
          
          if (profiles) {
            userMap = profiles.reduce((acc, p) => {
              acc[p.id] = { full_name: p.full_name || "" };
              return acc;
            }, {} as Record<string, { full_name: string }>);
          }
        }
        
        // Combine entries with user data
        const entriesWithUsers = refreshedEntries.map(entry => ({
          ...entry,
          user: entry.user_id ? userMap[entry.user_id] : null,
        }));
        
        setTimeEntries(entriesWithUsers as any);
      }
      
      setNewTimeEntry({
        userId: currentUserId,
        hours: "",
        date: new Date().toISOString().split("T")[0],
      });
      addToast("Time entry added", "success");
    } catch (err) {
      console.error("Failed to add time entry:", err);
      addToast("Failed to add time entry", "error");
    } finally {
      setAddingTimeEntry(false);
    }
  }

  async function handleUpdateTimeEntry(entryId: string, hours: number) {
    const durationSeconds = Math.round(hours * 3600);
    const entry = timeEntries.find(e => e.id === entryId);
    if (!entry) return;

    const startDateTime = entry.started_at;
    const endDateTime = new Date(new Date(startDateTime).getTime() + durationSeconds * 1000).toISOString();

    const { error } = await supabase
      .from("time_entries")
      .update({
        ended_at: endDateTime,
        duration_seconds: durationSeconds,
      })
      .eq("id", entryId);

    if (error) {
      addToast("Failed to update time entry", "error");
      return;
    }

    setTimeEntries((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? { ...e, ended_at: endDateTime, duration_seconds: durationSeconds }
          : e
      )
    );
    setEditingTimeEntry(null);
    addToast("Time entry updated", "success");
  }

  async function handleDeleteTimeEntry(entryId: string) {
    const { error } = await supabase
      .from("time_entries")
      .delete()
      .eq("id", entryId);

    if (error) {
      addToast("Failed to delete time entry", "error");
      return;
    }

    setTimeEntries((prev) => prev.filter((e) => e.id !== entryId));
    addToast("Time entry deleted", "success");
  }

  // Notes change handler (no auto-save)
  function handleNotesChange(newNotes: string) {
    setNotes(newNotes);
  }

  // Fetch pickup locations
  useEffect(() => {
    async function fetchPickupLocations() {
      const { data } = await supabase
        .from("pickup_locations")
        .select("id, name")
        .eq("company_id", companyId)
        .order("name");
      
      if (data) {
        setPickupLocations(data);
      }
    }
    fetchPickupLocations();
  }, [companyId]);

  // Fetch time entries
  useEffect(() => {
    async function fetchTimeEntries() {
      setLoadingTimeEntries(true);
      const { data: entries } = await supabase
        .from("time_entries")
        .select(`
          id,
          user_id,
          started_at,
          ended_at,
          duration_seconds
        `)
        .eq("job_id", job.id)
        .order("started_at", { ascending: false });
      
      if (entries) {
        // Fetch user profiles for all unique user IDs
        const userIds = [...new Set(entries.map(e => e.user_id).filter((id): id is string => id !== null))];
        let userMap: Record<string, { full_name: string }> = {};
        
        if (userIds.length > 0) {
          const { data: profiles } = await supabase
            .from("user_profiles")
            .select("id, full_name")
            .in("id", userIds);
          
          if (profiles) {
            userMap = profiles.reduce((acc, p) => {
              acc[p.id] = { full_name: p.full_name || "" };
              return acc;
            }, {} as Record<string, { full_name: string }>);
          }
        }
        
        // Combine entries with user data
        const entriesWithUsers = entries.map(entry => ({
          ...entry,
          user: entry.user_id ? userMap[entry.user_id] : null,
        }));
        
        setTimeEntries(entriesWithUsers as any);
      }
      setLoadingTimeEntries(false);
    }
    fetchTimeEntries();
  }, [job.id, supabase]);

  // Update newTimeEntry userId when currentUserId changes
  useEffect(() => {
    if (currentUserId && !newTimeEntry.userId) {
      setNewTimeEntry(prev => ({ ...prev, userId: currentUserId }));
    }
  }, [currentUserId]);

  // Fetch payment line items and estimate token
  useEffect(() => {
    async function fetchPaymentLineItems() {
      const { data } = await supabase
        .from("job_payment_line_items")
        .select("id, title, price")
        .eq("job_id", job.id)
        .order("sort_order");
      
      if (data) {
        setPaymentLineItems(data);
      }

      // Also fetch estimate record for public token if payment state is proposed
      if (job.payment_state === "proposed") {
        const { data: estimateData } = await supabase
          .from("estimates")
          .select("public_token")
          .eq("job_id", job.id)
          .maybeSingle();
        
        if (estimateData?.public_token && estimatesList.length === 0) {
          // Update estimatesList if we found an estimate
          setEstimatesList([{ ...estimatesList[0] || {}, public_token: estimateData.public_token } as any]);
        }
      }
    }
    fetchPaymentLineItems();
  }, [job.id, job.payment_state]);

  // Sync schedule token from job
  useEffect(() => {
    if ((job as any).schedule_token && !scheduleToken) {
      setScheduleToken((job as any).schedule_token);
    }
  }, [job, scheduleToken]);

  // Refresh job data when window regains focus (catches external updates like customer acceptance)
  useEffect(() => {
    const handleFocus = () => {
      router.refresh();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [router]);

  async function handleStatusChange(newStatus: JobStatus) {
    const { error } = await supabase
      .from("jobs")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", job.id);

    if (error) {
      addToast("Failed to update status", "error");
      return;
    }

    setJob((prev) => ({ ...prev, status: newStatus }));
    addToast("Status updated!", "success");
    
    // Force a refresh of the page to update the board view
    router.refresh();
  }

  async function handleAddMaterial(materialName?: string) {
    if (materialName) {
      // Quick add from common materials
      const materialToAdd = materialName.trim();
      if (!materialToAdd) return;

      // Check if material already exists
      if (materials.some(m => m.name.toLowerCase() === materialToAdd.toLowerCase())) {
        addToast("Material already added", "error");
        return;
      }

      try {
        const { data, error } = await supabase
          .from("job_materials")
          .insert({
            job_id: job.id,
            name: materialToAdd,
            checked: false,
          })
          .select()
          .single();

        if (error) {
          const errorMessage = error?.message || error?.details || error?.hint || JSON.stringify(error) || "Failed to add material";
          addToast(errorMessage, "error");
          console.error("Error adding material:", error);
          return;
        }

        setMaterials((prev) => [...prev, data]);
        setShowCommonMaterials(false);
        addToast("Material added!", "success");
      } catch (error: any) {
        console.error("Error adding material:", error);
        const errorMessage = error?.message || error?.details || error?.hint || JSON.stringify(error) || "Failed to add material";
        addToast(errorMessage, "error");
      }
    } else {
      // Show form for detailed material entry
      setShowMaterialForm(true);
    }
  }

  async function handleSubmitMaterialForm() {
    const name = materialFormData.name.trim();
    if (!name) {
      addToast("Please enter a material name", "error");
      return;
    }

    // Validation for paint
    if (materialType === "paint") {
      if (!materialFormData.color.trim()) {
        addToast("Please enter a color", "error");
        return;
      }
      if (!materialFormData.sheen) {
        addToast("Please select a sheen", "error");
        return;
      }
      if (!materialFormData.area) {
        addToast("Please select an area", "error");
        return;
      }
    }

    // Build notes based on material type
    const notesParts = [];
    let quantityDecimal: number = 1; // Default to 1 if not specified
    let unit: string | null = null;

    if (materialType === "paint") {
      // Paint: Brand, Color, Sheen, Quantity, Product Line, Area, Notes
      if (materialFormData.brand) notesParts.push(materialFormData.brand);
      notesParts.push(materialFormData.color);
      notesParts.push(materialFormData.sheen);
      if (materialFormData.quantity) {
        const quantityWithUnit = `${materialFormData.quantity} ${materialFormData.quantityUnit}`;
        notesParts.push(quantityWithUnit);
        quantityDecimal = parseFloat(materialFormData.quantity);
        unit = materialFormData.quantityUnit;
      } else {
        // Default unit for paint
        unit = materialFormData.quantityUnit;
      }
      if (materialFormData.productLine) notesParts.push(`(${materialFormData.productLine})`);
      if (materialFormData.area) notesParts.push(`- ${materialFormData.area}`);
      if (materialFormData.notes) notesParts.push(`| ${materialFormData.notes}`);
    } else {
      // Generic: Quantity, Notes
      if (materialFormData.quantity) {
        notesParts.push(materialFormData.quantity);
        // Try to parse quantity for generic materials
        const parsedQty = parseFloat(materialFormData.quantity);
        if (!isNaN(parsedQty)) {
          quantityDecimal = parsedQty;
        }
        unit = "each"; // Default unit for generic materials
      } else {
        unit = "each";
      }
      if (materialFormData.notes) notesParts.push(materialFormData.notes);
    }

    const notes = notesParts.length > 0 ? notesParts.join(" • ") : null;

    try {
      const { data, error } = await supabase
        .from("job_materials")
        .insert({
          job_id: job.id,
          name,
          checked: false,
          notes,
          quantity_decimal: quantityDecimal,
          unit,
        })
        .select()
        .single();

      if (error) {
        const errorMessage = error?.message || error?.details || error?.hint || JSON.stringify(error) || "Failed to add material";
        addToast(errorMessage, "error");
        console.error("Error adding material:", error);
        return;
      }

      setMaterials((prev) => [...prev, data]);
      setMaterialFormData({
        name: "",
        brand: "",
        quantity: "",
        quantityUnit: "gal",
        color: "",
        sheen: "",
        productLine: "",
        area: "",
        notes: "",
        showAdvanced: false
      });
      setShowMaterialForm(false);
      setNewMaterial("");
      addToast(materialType === "paint" ? "Paint added!" : "Material added!", "success");
    } catch (error: any) {
      console.error("Error adding material:", error);
      const errorMessage = error?.message || error?.details || error?.hint || JSON.stringify(error) || "Failed to add material";
      addToast(errorMessage, "error");
    }
  }

  async function handleCreateInvoiceFromEstimate() {
    const acceptedEstimate = estimatesList.find(e => e.status === "accepted");
    if (!acceptedEstimate) {
      addToast("No accepted estimate found", "error");
      return;
    }

    const total = acceptedEstimate.line_items.reduce((sum, li) => sum + li.price, 0);
    setNewInvoiceAmount((total / 100).toFixed(2));
    setShowAddInvoice(true);
  }

  function addEstimateLineItem() {
    setEstimateLineItems((prev) => [...prev, { title: "", price: "" }]);
  }

  function updateEstimateLineItem(index: number, field: "title" | "price", value: string) {
    setEstimateLineItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  }

  function removeEstimateLineItem(index: number) {
    setEstimateLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleAddEstimate() {
    const validItems = estimateLineItems.filter(
      (item) => item.title.trim() && item.price.trim() && parseFloat(item.price) > 0
    );

    if (validItems.length === 0) {
      addToast("Please add at least one line item with title and price", "error");
      return;
    }

    setAddingEstimate(true);

    try {
      // Create estimate
      const { data: estimate, error: estimateError } = await supabase
        .from("estimates")
        .insert({
          company_id: companyId,
          job_id: job.id,
          customer_id: job.customer_id || null,
          status: "draft",
          public_token: generateToken(24),
        })
        .select()
        .single();

      if (estimateError) {
        console.error("Estimate insert error:", estimateError);
        throw estimateError;
      }

      if (!estimate) {
        throw new Error("Estimate was not created");
      }

      // Create line items
      const lineItemsToInsert = validItems.map((item) => ({
        estimate_id: estimate.id,
        service_key: "other",
        service_type: "flat" as const,
        name: item.title.trim(),
        description: "",
        price: Math.round(parseFloat(item.price) * 100),
      }));

      const { error: itemError } = await supabase
        .from("estimate_line_items")
        .insert(lineItemsToInsert);

      if (itemError) {
        console.error("Line item insert error:", itemError);
        throw itemError;
      }

      // Fetch the estimate with line items
      const { data: lineItems } = await supabase
        .from("estimate_line_items")
        .select("*")
        .eq("estimate_id", estimate.id);

      setEstimatesList((prev) => [{ ...estimate, line_items: lineItems || [] }, ...prev]);
      setEstimateLineItems([{ title: "", price: "" }]);
      setShowAddEstimate(false);
      addToast("Estimate added!", "success");
    } catch (error: any) {
      console.error("Error creating estimate:", error);
      const errorMessage = error?.message || error?.details || error?.hint || JSON.stringify(error) || "Failed to create estimate";
      addToast(errorMessage, "error");
    } finally {
      setAddingEstimate(false);
    }
  }

  async function handleAddInvoice() {
    if (!newInvoiceAmount.trim()) {
      addToast("Please enter an amount", "error");
      return;
    }

    const amountCents = Math.round(parseFloat(newInvoiceAmount) * 100);
    if (!amountCents || amountCents <= 0) {
      addToast("Please enter a valid amount", "error");
      return;
    }

    if (!job.customer_id) {
      addToast("Job must have a customer to create invoice", "error");
      return;
    }

    setAddingInvoice(true);

    try {
      const { data: invoice, error } = await supabase
        .from("invoices")
        .insert({
          company_id: companyId,
          job_id: job.id,
          customer_id: job.customer_id,
          amount_total: amountCents,
          status: "draft",
          public_token: generateToken(24),
        })
        .select()
        .single();

      if (error) {
        console.error("Invoice insert error:", error);
        throw error;
      }

      if (!invoice) {
        throw new Error("Invoice was not created");
      }

      setInvoicesList((prev) => [invoice, ...prev]);
      setNewInvoiceAmount("");
      setShowAddInvoice(false);
      addToast("Invoice added!", "success");
    } catch (error: any) {
      console.error("Error creating invoice:", error);
      const errorMessage = error?.message || error?.details || error?.hint || JSON.stringify(error) || "Failed to create invoice";
      addToast(errorMessage, "error");
    } finally {
      setAddingInvoice(false);
    }
  }

  async function handleToggleMaterial(materialId: string, checked: boolean) {
    const material = materials.find(m => m.id === materialId);
    if (!material) return;

    const updates: any = { checked };

    // Handle inventory consumption for jobs in progress or done
    if (material.inventory_item_id && material.quantity_decimal) {
      const shouldConsumeInventory = ["in_progress", "done"].includes(job.status);

      if (shouldConsumeInventory) {
        if (checked && !material.consumed_at) {
          // Consume: decrement inventory
          const { data: inventoryItem, error: fetchError } = await supabase
            .from("inventory_items")
            .select("on_hand")
            .eq("id", material.inventory_item_id)
            .single();

          if (!fetchError && inventoryItem) {
            const newQuantity = Math.max(0, inventoryItem.on_hand - (material.quantity_decimal || 0));
            await supabase
              .from("inventory_items")
              .update({ on_hand: newQuantity })
              .eq("id", material.inventory_item_id);

            updates.consumed_at = new Date().toISOString();
          }
        } else if (!checked && material.consumed_at) {
          // Unconsume: increment inventory back
          const { data: inventoryItem, error: fetchError } = await supabase
            .from("inventory_items")
            .select("on_hand")
            .eq("id", material.inventory_item_id)
            .single();

          if (!fetchError && inventoryItem) {
            const newQuantity = inventoryItem.on_hand + (material.quantity_decimal || 0);
            await supabase
              .from("inventory_items")
              .update({ on_hand: newQuantity })
              .eq("id", material.inventory_item_id);

            updates.consumed_at = null;
          }
        }
      }
    }

    const { error } = await supabase
      .from("job_materials")
      .update(updates)
      .eq("id", materialId);

    if (error) {
      addToast("Failed to update material", "error");
      return;
    }

    setMaterials((prev) =>
      prev.map((m) => (m.id === materialId ? { ...m, ...updates } : m))
    );
  }

  async function handleDeleteMaterial(materialId: string) {
    const { error } = await supabase
      .from("job_materials")
      .delete()
      .eq("id", materialId);

    if (error) {
      addToast("Failed to delete material", "error");
      return;
    }

    setMaterials((prev) => prev.filter((m) => m.id !== materialId));
  }

  async function handleUpdateMaterialCost(
    materialId: string, 
    costPerUnit: number | null, 
    quantityDecimal: number | null,
    unit: string | null
  ) {
    const { error } = await supabase
      .from("job_materials")
      .update({ 
        cost_per_unit: costPerUnit,
        quantity_decimal: quantityDecimal,
        unit: unit
      })
      .eq("id", materialId);

    if (error) {
      addToast("Failed to update cost", "error");
      return;
    }

    setMaterials((prev) =>
      prev.map((m) => 
        m.id === materialId 
          ? { ...m, cost_per_unit: costPerUnit, quantity_decimal: quantityDecimal, unit: unit }
          : m
      )
    );
    setEditingCostId(null);
  }

  function copyScheduleConfirmationMessage() {
    const customerName = job.customer?.name || "there";
    const dateStr = scheduledDate ? formatDate(scheduledDate) : "[date]";
    const timeStr = scheduledTime ? formatTime(scheduledTime) : "[time]";
    const confirmUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/s/${job.id}`;
    const message = `Hey ${customerName} — we'd like to schedule your project for ${dateStr} at ${timeStr}. Please confirm this works for you: ${confirmUrl}`;
    copyToClipboard(message);
    addToast("Schedule confirmation message copied!", "success");
  }

  function copyReminderMessage() {
    const customerName = job.customer?.name || "there";
    const dateStr = scheduledDate ? formatDate(scheduledDate) : "[date]";
    const timeStr = scheduledTime ? formatTime(scheduledTime) : "[time]";
    const message = `Hey ${customerName} — just a reminder that we're scheduled for ${dateStr} at ${timeStr} at ${address || "[address]"}. Reply here if anything changes. See you then!`;
    copyToClipboard(message);
    addToast("Reminder message copied!", "success");
  }

  function copyMaterialsList() {
    if (materials.length === 0) {
      addToast("No materials to copy", "error");
      return;
    }

    const jobTitle = job.title;
    const customerName = job.customer?.name || "Customer";
    
    let message = `Materials needed for ${jobTitle} (${customerName}):\n\n`;
    
    materials.forEach((material, index) => {
      message += `${index + 1}. ${material.name}`;
      if (material.notes) {
        message += ` - ${material.notes}`;
      }
      message += `\n`;
    });
    
    message += `\nTotal items: ${materials.length}`;
    
    copyToClipboard(message);
    addToast("Materials list copied!", "success");
  }

  function copyEstimateMessage() {
    const customerName = job.customer?.name || "there";
    const latestEstimate = estimatesList[0];
    const estimateUrl = latestEstimate
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/e/${latestEstimate.public_token}`
      : "[estimate link]";
    const total = latestEstimate
      ? formatCurrency(latestEstimate.line_items.reduce((sum, li) => sum + li.price, 0))
      : "[amount]";
    const message = `Hey ${customerName} — here's your estimate for ${total}: ${estimateUrl}. Let me know if you have any questions!`;
    copyToClipboard(message);
    addToast("Estimate message copied!", "success");
  }

  function copyPaymentRequestMessage() {
    const customerName = job.customer?.name || "there";
    const latestInvoice = invoicesList[0];
    const invoiceUrl = latestInvoice
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/i/${latestInvoice.public_token}`
      : "[invoice link]";
    const amount = latestInvoice
      ? formatCurrency(latestInvoice.amount_total)
      : "[amount]";
    const message = `Hey ${customerName} — thanks again for letting us work on your project! Here's your invoice for ${amount}: ${invoiceUrl}. Let us know if you have any questions!`;
    copyToClipboard(message);
    addToast("Invoice message copied!", "success");
  }

  function getScheduleLink() {
    const token = scheduleToken || (job as any).schedule_token;
    if (!token) return "";
    return `${typeof window !== "undefined" ? window.location.origin : ""}/s/${token}`;
  }

  function getScheduleMessage() {
    const customerName = job.customer?.name || "there";
    const companyName = ""; // You can add company name from context if needed
    const dateStr = scheduledDate ? formatDate(scheduledDate) : "TBD";
    const timeStr = scheduledTime ? formatTime(scheduledTime) : "TBD";
    const link = getScheduleLink();
    
    return `Hi ${customerName}${companyName ? `, this is ${companyName}` : ""}. We're scheduled for ${dateStr} at ${timeStr}. Confirm your appointment here: ${link}`;
  }

  function copyScheduleLink() {
    copyToClipboard(getScheduleLink());
    addToast("Schedule link copied!", "success");
  }

  function copyScheduleMessage() {
    copyToClipboard(getScheduleMessage());
    addToast("Schedule message copied!", "success");
  }

  async function handleDuplicateJob() {
    setDuplicating(true);

    try {
      // Create the duplicate job
      const { data: newJob, error: jobError } = await supabase
        .from("jobs")
        .insert({
          company_id: companyId,
          customer_id: job.customer_id,
          title: `${job.title} (Copy)`,
          address1: job.address1,
          address2: job.address2,
          city: job.city,
          state: job.state,
          zip: job.zip,
          notes: job.notes,
          assigned_user_id: job.assigned_user_id,
          status: "new",
        })
        .select()
        .single();

      if (jobError) throw jobError;

      // Copy materials
      if (materials.length > 0) {
        const materialsToInsert = materials.map((m) => ({
          job_id: newJob.id,
          name: m.name,
          notes: m.notes,
          checked: false, // Reset checked status
        }));

        const { error: materialsError } = await supabase
          .from("job_materials")
          .insert(materialsToInsert);

        if (materialsError) {
          console.error("Error copying materials:", materialsError);
          // Don't fail the whole operation, just warn
          addToast("Job duplicated but materials may not have copied", "error");
        }
      }

      addToast(`Job duplicated! New job ID: ${newJob.id}`, "success");
      copyToClipboard(newJob.id);
      setShowDuplicateDialog(false);
      router.push(`/app/jobs/${newJob.id}`);
    } catch (error) {
      console.error("Error duplicating job:", error);
      addToast("Failed to duplicate job", "error");
    } finally {
      setDuplicating(false);
    }
  }

  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      {/* Header */}
      <div className="border-b bg-card">
        <div className="max-w-4xl mx-auto p-4">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 touch-target"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex flex-col gap-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold truncate">{job.title}</h1>
                {job.customer && (
                  <p className="text-muted-foreground flex items-center gap-1 mt-1 text-sm sm:text-base min-w-0">
                    <User className="h-4 w-4 shrink-0" />
                    <span className="truncate">{job.customer.name}</span>
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge className={cn("w-fit text-base px-4 py-2", JOB_STATUS_COLORS[job.status as JobStatus])}>
                  {JOB_STATUS_LABELS[job.status as JobStatus]}
                </Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="touch-target min-h-[44px]">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {job.status === "new" && (
                      <DropdownMenuItem onClick={() => handleStatusChange("quoted")}>
                        Mark as Quoted
                      </DropdownMenuItem>
                    )}
                    {job.status === "quoted" && (
                      <DropdownMenuItem onClick={() => handleStatusChange("scheduled")}>
                        Mark as Scheduled
                      </DropdownMenuItem>
                    )}
                    {job.status === "scheduled" && (
                      <DropdownMenuItem onClick={() => handleStatusChange("in_progress")}>
                        Start Job
                      </DropdownMenuItem>
                    )}
                    {job.status === "in_progress" && (
                      <DropdownMenuItem onClick={() => handleStatusChange("done")}>
                        Mark Complete
                      </DropdownMenuItem>
                    )}
                    {job.status === "done" && (
                      <DropdownMenuItem onClick={() => handleStatusChange("paid")}>
                        Mark as Paid
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => setShowDuplicateDialog(true)}>
                      <Copy className="mr-2 h-4 w-4" />
                      Duplicate Job
                    </DropdownMenuItem>
                    {scheduledDate && (
                      <DropdownMenuItem onClick={async () => {
                        await ensureScheduleToken();
                        setShowShareScheduleDialog(true);
                      }}>
                        <Share2 className="mr-2 h-4 w-4" />
                        Share Schedule
                      </DropdownMenuItem>
                    )}
                    {timeEntries.length > 0 && (
                      <DropdownMenuItem onClick={() => {
                        const totalSeconds = timeEntries.reduce((sum, entry) => sum + (entry.duration_seconds || 0), 0);
                        const totalHours = Math.floor(totalSeconds / 3600);
                        const totalMinutes = Math.floor((totalSeconds % 3600) / 60);
                        let workLog = `Work Log - ${job.title}\n\nTotal Time: ${totalHours}h ${totalMinutes}m\n\nTime Entries:\n`;
                        timeEntries.forEach((entry) => {
                          const date = new Date(entry.started_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
                          const hours = entry.duration_seconds ? (entry.duration_seconds / 3600).toFixed(1) : "0";
                          const userName = entry.user?.full_name || "Unknown";
                          workLog += `- ${date}: ${hours}h - ${userName}\n`;
                        });
                        copyToClipboard(workLog);
                        addToast("Work log copied to clipboard", "success");
                      }}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Work Log
                      </DropdownMenuItem>
                    )}
                    {scheduledDate && scheduledTime && job.status === "scheduled" && (
                      <DropdownMenuItem onClick={() => {
                        setCopyDialogType("reminder");
                        setShowCopyDialog(true);
                      }}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Reminder
                      </DropdownMenuItem>
                    )}
                    {estimatesList.length > 0 && estimatesList[0].public_token && (
                      <>
                        <DropdownMenuItem onClick={() => {
                          const estimateUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/e/${estimatesList[0].public_token}`;
                          copyToClipboard(estimateUrl);
                          addToast("Estimate link copied!", "success");
                        }}>
                          <Share2 className="mr-2 h-4 w-4" />
                          Share Estimate Link
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          setCopyDialogType("estimate");
                          setShowCopyDialog(true);
                        }}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy Estimate Message
                        </DropdownMenuItem>
                      </>
                    )}
                    {invoicesList.length > 0 && (
                      <>
                        <DropdownMenuItem onClick={() => {
                          const invoiceUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/i/${invoicesList[0].public_token}`;
                          copyToClipboard(invoiceUrl);
                          addToast("Invoice link copied!", "success");
                        }}>
                          <Share2 className="mr-2 h-4 w-4" />
                          Share Invoice Link
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => {
                          setCopyDialogType("invoice");
                          setShowCopyDialog(true);
                        }}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy Invoice Message
                        </DropdownMenuItem>
                      </>
                    )}
                    {materials.length > 0 && (
                      <DropdownMenuItem onClick={() => {
                        setCopyDialogType("materials");
                        setShowCopyDialog(true);
                      }}>
                        <Copy className="mr-2 h-4 w-4" />
                        Copy Materials List
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem onClick={() => setMessageTemplatesOpen(true)}>
                      <FileText className="mr-2 h-4 w-4" />
                      Message Templates
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      onClick={() => handleStatusChange("archive")}
                      className="text-destructive"
                    >
                      <Archive className="mr-2 h-4 w-4" />
                      Archive Job
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4">
        <div className="space-y-6">
          {/* Main content */}
          <div className="space-y-6">
            {/* Quick Info */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              {address && (
                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                  <span className="break-words">{address}</span>
                </div>
              )}
              {job.customer?.phone && (
                <div className="flex items-center gap-3 min-w-0">
                  <Phone className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="flex gap-2 min-w-0">
                    <a 
                      href={`tel:${job.customer.phone}`} 
                      className="hover:underline touch-target min-h-[44px] flex items-center truncate"
                    >
                      {job.customer.phone}
                    </a>
                    <a 
                      href={`sms:${job.customer.phone}`}
                      className="text-muted-foreground hover:text-foreground touch-target min-h-[44px] min-w-[44px] flex items-center justify-center"
                      title="Send SMS"
                    >
                      <Mail className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              )}
              {job.customer?.email && (
                <div className="flex items-center gap-3 min-w-0">
                  <Mail className="h-5 w-5 text-muted-foreground shrink-0" />
                  <a 
                    href={`mailto:${job.customer.email}`} 
                    className="hover:underline touch-target min-h-[44px] flex items-center truncate"
                  >
                    {job.customer.email}
                  </a>
                </div>
              )}
            </div>

            {/* All sections in one view */}
            <div className="space-y-6">
              {/* Unified Payment Section (replaces Estimate + Invoice) */}
              <UnifiedPayment
                jobId={job.id}
                companyId={companyId}
                customerId={job.customer_id}
                paymentState={(job.payment_state as any) || "none"}
                paymentAmount={job.payment_amount || null}
                paymentApprovedAt={job.payment_approved_at || null}
                paymentPaidAt={job.payment_paid_at || null}
                paymentMethod={job.payment_method || null}
                publicToken={estimatesList[0]?.public_token}
                lineItems={paymentLineItems}
                estimatingConfig={estimatingConfig}
                onUpdate={() => {
                  router.refresh();
                }}
              />

              {/* Scheduling Section */}
              <div className="rounded-lg border bg-card p-4 space-y-4">
                {!editingSchedule && scheduledDate && scheduledTime ? (
                  <>
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold mb-1">Scheduling</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          <span>{formatDate(scheduledDate)} at {formatTime(scheduledTime)}</span>
                        </div>
                        {(job as any).schedule_state === "proposed" && (
                          <Badge variant="secondary" className="mt-2">Proposed</Badge>
                        )}
                        {(job as any).schedule_state === "accepted" && (
                          <Badge variant="default" className="mt-2">Accepted</Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingSchedule(true)}
                        className="touch-target min-h-[44px]"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                    {(job as any).schedule_state === "proposed" && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          onClick={async () => {
                            await ensureScheduleToken();
                            setShowShareScheduleDialog(true);
                          }}
                          className="flex-1"
                        >
                          <Share2 className="mr-2 h-4 w-4" />
                          Share Schedule
                        </Button>
                        <Button
                          onClick={handleAcceptSchedule}
                          className="flex-1"
                        >
                          <CheckCircle className="mr-2 h-4 w-4" />
                          Accept Schedule
                        </Button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Scheduling</h3>
                      {editingSchedule && scheduledDate && scheduledTime && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingSchedule(false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <div className="space-y-4">
                      <DateTimePicker
                        date={scheduledDate || null}
                        time={scheduledTime || null}
                        onDateChange={(date) => setScheduledDate(date)}
                        onTimeChange={(time) => setScheduledTime(time)}
                        label="When is this job scheduled?"
                      />
                      <Button onClick={handleSaveSchedule} className="w-full">
                        <Save className="mr-2 h-4 w-4" />
                        Save Schedule
                      </Button>
                    </div>
                  </>
                )}
              </div>

              {/* Materials Section */}
                <div className="rounded-lg border bg-card p-4 space-y-6">
                  {!editingMaterials && materials.length > 0 ? (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-lg">Materials ({materials.length})</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingMaterials(true)}
                          className="touch-target min-h-[44px]"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                      {/* Simplified view */}
                      <div className="space-y-1">
                        {materials.slice(0, 5).map((material) => (
                          <div key={material.id} className="flex items-center gap-2 text-sm">
                            {material.checked && <span className="text-muted-foreground">✓</span>}
                            <span className={cn(material.checked && "line-through text-muted-foreground")}>
                              {material.name}
                            </span>
                          </div>
                        ))}
                        {materials.length > 5 && (
                          <p className="text-xs text-muted-foreground pt-1">
                            +{materials.length - 5} more
                          </p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-lg">Materials</h3>
                        {editingMaterials && materials.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingMaterials(false)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                  
                  {/* Checklist Subsection */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Checklist ({materials.length})</h4>
                      {materials.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={copyMaterialsList}
                          className="touch-target min-h-[44px]"
                        >
                          <Copy className="mr-2 h-4 w-4" />
                          Copy List
                        </Button>
                      )}
                    </div>

                    {/* Smart Presets - Quick Add */}
                    <div className="space-y-2">
                      <Label className="text-sm text-muted-foreground">Quick Add</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setMaterialType("paint");
                            setMaterialFormData({
                              name: "Paint",
                              brand: "",
                              color: "",
                              sheen: "",
                              quantity: "",
                              productLine: "",
                              area: "",
                              notes: "",
                              showAdvanced: false
                            });
                            setShowMaterialForm(true);
                          }}
                          className="touch-target min-h-[44px] justify-start"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Paint
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setMaterialType("generic");
                            setMaterialFormData({
                              name: "",
                              brand: "",
                              color: "",
                              sheen: "",
                              quantity: "",
                              productLine: "",
                              area: "",
                              notes: "",
                              showAdvanced: false
                            });
                            setShowMaterialForm(true);
                          }}
                          className="touch-target min-h-[44px] justify-start"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Custom
                        </Button>
                      </div>
                    </div>

                    {/* Materials List */}
                    <div className="rounded-lg border bg-muted/30 divide-y">
                      {materials.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">
                          <Package className="mx-auto h-8 w-8 mb-2" />
                          <p className="text-sm">No materials yet</p>
                          <p className="text-xs mt-1">Use Quick Add buttons above</p>
                        </div>
                      ) : (
                        materials.map((material) => (
                          <div
                            key={material.id}
                            className="p-3 space-y-2"
                          >
                            <div className="flex items-center gap-3">
                              <SimpleCheckbox
                                checked={material.checked}
                                onChange={(e) =>
                                  handleToggleMaterial(material.id, e.target.checked)
                                }
                              />
                              <div className="flex-1">
                                <span
                                  className={cn(
                                    "font-medium",
                                    material.checked && "line-through text-muted-foreground"
                                  )}
                                >
                                  {material.name}
                                </span>
                                {material.notes && (
                                  <p className="text-xs text-muted-foreground mt-0.5">
                                    {material.notes}
                                  </p>
                                )}
                              </div>
                              <button
                                onClick={() => handleDeleteMaterial(material.id)}
                                className="text-muted-foreground hover:text-destructive touch-target min-h-[44px] min-w-[44px] flex items-center justify-center"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                            
                            {/* Cost Tracking (Optional) */}
                            {editingCostId === material.id ? (
                              <div className="flex items-center gap-2 text-sm pl-8">
                                <span className="text-muted-foreground">$</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="0.00"
                                  defaultValue={material.cost_per_unit || ''}
                                  className="w-20 h-8 text-sm"
                                  id={`cost-${material.id}`}
                                />
                                <span className="text-muted-foreground">per</span>
                                <Input
                                  type="text"
                                  placeholder="unit"
                                  defaultValue={material.unit || 'each'}
                                  className="w-20 h-8 text-sm"
                                  id={`unit-${material.id}`}
                                />
                                <span className="text-muted-foreground">×</span>
                                <Input
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder="qty"
                                  defaultValue={material.quantity_decimal || ''}
                                  className="w-16 h-8 text-sm"
                                  id={`qty-${material.id}`}
                                />
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8"
                                  onClick={() => {
                                    const costInput = document.getElementById(`cost-${material.id}`) as HTMLInputElement;
                                    const unitInput = document.getElementById(`unit-${material.id}`) as HTMLInputElement;
                                    const qtyInput = document.getElementById(`qty-${material.id}`) as HTMLInputElement;
                                    handleUpdateMaterialCost(
                                      material.id,
                                      costInput.value ? parseFloat(costInput.value) : null,
                                      qtyInput.value ? parseFloat(qtyInput.value) : null,
                                      unitInput.value || null
                                    );
                                  }}
                                >
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8"
                                  onClick={() => setEditingCostId(null)}
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : material.cost_per_unit ? (
                              <div className="flex items-center justify-between text-sm pl-8">
                                <span className="text-muted-foreground">
                                  {formatCurrency(Math.round(material.cost_per_unit * 100))} per {material.unit || 'each'}
                                  {material.quantity_decimal && ` × ${material.quantity_decimal}`}
                                  {material.quantity_decimal && material.cost_per_unit && (
                                    <span className="font-medium ml-2">
                                      = {formatCurrency(Math.round(material.cost_per_unit * material.quantity_decimal * 100))}
                                    </span>
                                  )}
                                </span>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 text-xs"
                                  onClick={() => setEditingCostId(material.id)}
                                >
                                  Edit
                                </Button>
                              </div>
                            ) : (
                              <div className="pl-8">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 text-xs text-muted-foreground"
                                  onClick={() => setEditingCostId(material.id)}
                                >
                                  + Add cost
                                </Button>
                              </div>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                    
                    {/* Materials Cost Summary */}
                    {(() => {
                      const materialsWithCost = materials.filter(m => m.cost_per_unit && m.quantity_decimal);
                      if (materialsWithCost.length === 0) return null;
                      
                      const totalCost = materialsWithCost.reduce(
                        (sum, m) => sum + ((m.cost_per_unit || 0) * (m.quantity_decimal || 0)),
                        0
                      );
                      const allHaveCosts = materials.length === materialsWithCost.length;
                      const invoice = invoicesList[0];
                      
                      return (
                        <div className="rounded-lg border bg-muted/50 p-3 space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">
                              Materials Total{!allHaveCosts && <span className="text-xs ml-1">(partial)</span>}
                            </span>
                            <span className="font-medium">{formatCurrency(Math.round(totalCost * 100))}</span>
                          </div>
                          
                          {invoice && (
                            <>
                              <div className="flex justify-between">
                                <span className="text-muted-foreground">Invoice Total</span>
                                <span className="font-medium">{formatCurrency(invoice.amount_total)}</span>
                              </div>
                              <div className="h-px bg-border" />
                              <div className="flex justify-between font-semibold">
                                <span>Estimated Margin</span>
                                <span className={cn(
                                  (invoice.amount_total - Math.round(totalCost * 100)) > 0 
                                    ? 'text-success' 
                                    : 'text-destructive'
                                )}>
                                  {formatCurrency(invoice.amount_total - Math.round(totalCost * 100))}
                                  <span className="text-xs ml-1 font-normal">
                                    ({Math.round(((invoice.amount_total - Math.round(totalCost * 100)) / invoice.amount_total) * 100)}%)
                                  </span>
                                </span>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                ⚠️ Materials only - doesn't include labor or overhead
                              </p>
                            </>
                          )}
                        </div>
                      );
                    })()}
                    
                    {/* Pickup Location Subsection */}
                    <div className="space-y-3 pt-4 border-t">
                      <h4 className="font-medium text-sm">Pickup Location</h4>
                      <p className="text-xs text-muted-foreground">Optional - Select where to pick up materials</p>
                      <Select
                        value={selectedPickupLocation || ""}
                        onChange={(e) => handlePickupLocationChange(e.target.value || null)}
                        className="w-full"
                      >
                        <option value="">None selected</option>
                        {pickupLocations.map((location) => (
                          <option key={location.id} value={location.id}>
                            {location.name}
                          </option>
                        ))}
                      </Select>
                      {pickupLocations.length === 0 && (
                        <p className="text-xs text-muted-foreground">
                          Add pickup locations in Settings → Locations
                        </p>
                      )}
                    </div>
                  </div>
                    </>
                  )}
                </div>

              {/* Assign To Section */}
              <div className="rounded-lg border bg-card p-4">
                {!editingAssignment ? (
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold mb-1">Assign To</h3>
                      <div className="text-sm text-muted-foreground">
                        {assignedUserId ? (
                          <span>{teamMembers.find(m => m.id === assignedUserId)?.fullName || 'Unknown'}</span>
                        ) : (
                          <span>Unassigned</span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingAssignment(true)}
                      className="touch-target min-h-[44px]"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Label htmlFor="assignedUser" className="text-sm font-medium whitespace-nowrap shrink-0">
                      Who's working on this?
                    </Label>
                    <Select
                      id="assignedUser"
                      value={assignedUserId}
                      onChange={(e) => setAssignedUserId(e.target.value)}
                      className="flex-1 h-9"
                    >
                      <option value="">Unassigned</option>
                      {teamMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.fullName}
                        </option>
                      ))}
                    </Select>
                    <Button 
                      onClick={async () => {
                        await handleSaveAssignment();
                        setEditingAssignment(false);
                      }} 
                      className="shrink-0 h-9"
                    >
                      Save
                    </Button>
                  </div>
                )}
              </div>

              {/* Notes Section */}
              <div className="rounded-lg border bg-card p-4 space-y-4">
                {!editingNotes && notes ? (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">Notes</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingNotes(true)}
                        className="touch-target min-h-[44px]"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{notes}</p>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Notes</h3>
                      {editingNotes && notes && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingNotes(false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <Textarea
                      value={notes}
                      onChange={(e) => handleNotesChange(e.target.value)}
                      placeholder="Add notes about this job..."
                      rows={4}
                    />
                    <Button onClick={handleSaveNotes} className="w-full">
                      <Save className="mr-2 h-4 w-4" />
                      Save Notes
                    </Button>
                  </>
                )}
              </div>

              {/* Tracking Section */}
              <div className="rounded-lg border bg-card p-4 space-y-4">
                {!editingTracking && timeEntries.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold">Tracking</h3>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingTracking(true)}
                        className="touch-target min-h-[44px]"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                    </div>
                    {/* Simplified view - show workers and total hours */}
                    <div className="space-y-2">
                      {(() => {
                        // Group entries by user
                        const groupedByUser = timeEntries.reduce((acc, entry) => {
                          const userId = entry.user_id || 'unknown';
                          const userName = entry.user?.full_name || 'Unknown';
                          if (!acc[userId]) {
                            acc[userId] = { name: userName, totalHours: 0, entries: [] };
                          }
                          const hours = entry.duration_seconds ? entry.duration_seconds / 3600 : 0;
                          acc[userId].totalHours += hours;
                          acc[userId].entries.push(entry);
                          return acc;
                        }, {} as Record<string, { name: string; totalHours: number; entries: typeof timeEntries }>);

                        return Object.entries(groupedByUser).map(([userId, data]) => (
                          <div key={userId} className="flex items-center justify-between rounded-lg border bg-muted/30 p-2">
                            <span className="text-sm font-medium">{data.name}</span>
                            <span className="text-sm text-muted-foreground">{data.totalHours.toFixed(1)}h</span>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">Tracking</h3>
                      {editingTracking && timeEntries.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingTracking(false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    {/* Time Tracking */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Time Logs</Label>
                      
                      {/* Add Time Entry Form */}
                      <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
                        <div className="grid gap-2 sm:grid-cols-3">
                          <div className="space-y-1">
                            <Label htmlFor="timeWorker" className="text-xs">Worker</Label>
                            <Select
                              id="timeWorker"
                              value={newTimeEntry.userId}
                              onChange={(e) => setNewTimeEntry({ ...newTimeEntry, userId: e.target.value })}
                              className="h-9"
                            >
                              <option value="">Select worker</option>
                              {teamMembers.map((member) => (
                                <option key={member.id} value={member.id}>
                                  {member.fullName}
                                </option>
                              ))}
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="timeDate" className="text-xs">Date</Label>
                            <Input
                              id="timeDate"
                              type="date"
                              value={newTimeEntry.date}
                              onChange={(e) => setNewTimeEntry({ ...newTimeEntry, date: e.target.value })}
                              className="h-9"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label htmlFor="timeHours" className="text-xs">Hours</Label>
                            <Input
                              id="timeHours"
                              type="number"
                              step="0.25"
                              min="0"
                              placeholder="0.0"
                              value={newTimeEntry.hours}
                              onChange={(e) => setNewTimeEntry({ ...newTimeEntry, hours: e.target.value })}
                              className="h-9"
                            />
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={handleAddTimeEntry}
                          loading={addingTimeEntry}
                          disabled={!newTimeEntry.hours || !newTimeEntry.userId}
                          className="w-full"
                        >
                          <Plus className="mr-2 h-4 w-4" />
                          Add Hours
                        </Button>
                      </div>

                      {/* Time Entries List */}
                      {loadingTimeEntries ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Loading...</p>
                      ) : timeEntries.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No time entries yet</p>
                      ) : (
                        <div className="space-y-2">
                          {timeEntries.map((entry) => {
                            const hours = entry.duration_seconds ? (entry.duration_seconds / 3600).toFixed(1) : "0";
                            const date = new Date(entry.started_at).toLocaleDateString([], { month: "short", day: "numeric" });
                            const userName = entry.user?.full_name || "Unknown";

                            return (
                              <div key={entry.id} className="flex items-center justify-between rounded-lg border bg-muted/30 p-3">
                                <div className="flex-1">
                                  <p className="text-sm font-medium">{userName}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {date} • {hours}h
                                  </p>
                                </div>
                                <div className="flex items-center gap-2">
                                  {editingTimeEntry === entry.id ? (
                                    <>
                                      <Input
                                        type="number"
                                        step="0.25"
                                        min="0"
                                        defaultValue={hours}
                                        className="w-20 h-8 text-sm"
                                        onBlur={(e) => {
                                          const newHours = parseFloat(e.target.value);
                                          if (!isNaN(newHours) && newHours > 0) {
                                            handleUpdateTimeEntry(entry.id, newHours);
                                          } else {
                                            setEditingTimeEntry(null);
                                          }
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Enter') {
                                            const newHours = parseFloat((e.target as HTMLInputElement).value);
                                            if (!isNaN(newHours) && newHours > 0) {
                                              handleUpdateTimeEntry(entry.id, newHours);
                                            } else {
                                              setEditingTimeEntry(null);
                                            }
                                          } else if (e.key === 'Escape') {
                                            setEditingTimeEntry(null);
                                          }
                                        }}
                                        autoFocus
                                      />
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setEditingTimeEntry(null)}
                                        className="h-8"
                                      >
                                        <X className="h-3 w-3" />
                                      </Button>
                                    </>
                                  ) : (
                                    <>
                                      <button
                                        onClick={() => setEditingTimeEntry(entry.id)}
                                        className="text-muted-foreground hover:text-foreground"
                                        title="Edit hours"
                                      >
                                        <Pencil className="h-4 w-4" />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteTimeEntry(entry.id)}
                                        className="text-muted-foreground hover:text-destructive"
                                        title="Delete entry"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

                {/* Photos Section */}
                <div className="rounded-lg border bg-card p-4 space-y-4">
                  {!editingPhotos ? (
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold">Photos</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingPhotos(true)}
                          className="touch-target min-h-[44px]"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                      <PhotoGallery jobId={job.id} companyId={companyId} compact />
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">Photos</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingPhotos(false)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      <PhotoGallery jobId={job.id} companyId={companyId} />
                    </>
                  )}
                </div>

                {/* Job History Timeline */}
                {jobHistory.length > 0 && (
                  <div className="rounded-lg border bg-card p-4 space-y-4">
                    <h3 className="font-semibold">History</h3>
                    <JobHistoryTimeline history={jobHistory} />
                  </div>
                )}
              </div>
            </div>

        </div>
      </div>

      {/* Message Templates Dialog */}
      <MessageTemplatesDialog
        open={messageTemplatesOpen}
        onOpenChange={setMessageTemplatesOpen}
        companyId={companyId}
        job={job}
        customer={job.customer}
        invoices={invoicesList}
        scheduledDate={scheduledDate}
        scheduledTime={scheduledTime}
        address={address}
      />

      {/* Estimate Detail Dialog */}
      <Dialog open={!!selectedEstimate} onOpenChange={(open) => !open && setSelectedEstimate(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Estimate Details</DialogTitle>
          </DialogHeader>
          {selectedEstimate && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge
                  variant={
                    selectedEstimate.status === "accepted"
                      ? "success"
                      : selectedEstimate.status === "sent"
                      ? "secondary"
                      : "outline"
                  }
                >
                  {selectedEstimate.status}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Created {formatDate(selectedEstimate.created_at)}
                </p>
              </div>
              <div className="rounded-lg border divide-y">
                {selectedEstimate.line_items.map((item) => (
                  <div key={item.id} className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <p className="font-medium">{formatCurrency(item.price)}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="p-4 border-t bg-muted/50 rounded-b-lg">
                <div className="flex items-center justify-between text-lg font-semibold">
                  <span>Total</span>
                  <span>{formatCurrency(selectedEstimate.line_items.reduce((sum, li) => sum + li.price, 0))}</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Invoice Detail Dialog */}
      <Dialog open={!!selectedInvoice} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Invoice Details</DialogTitle>
          </DialogHeader>
          {selectedInvoice && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Badge
                  variant={
                    selectedInvoice.status === "paid"
                      ? "success"
                      : selectedInvoice.status === "sent"
                      ? "secondary"
                      : "outline"
                  }
                >
                  {selectedInvoice.status}
                </Badge>
                <p className="text-sm text-muted-foreground">
                  Created {formatDate(selectedInvoice.created_at)}
                </p>
              </div>
              <div className="rounded-lg border bg-card p-6 text-center">
                <p className="text-sm text-muted-foreground mb-1">Amount Due</p>
                <p className="text-4xl font-bold">
                  {formatCurrency(selectedInvoice.amount_total)}
                </p>
              </div>
              {selectedInvoice.status === "paid" && selectedInvoice.paid_at && (
                <div className="bg-success/10 text-success rounded-lg p-4 text-center">
                  <p className="font-semibold">Paid</p>
                  <p className="text-sm">on {formatDate(selectedInvoice.paid_at)}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Material Form Dialog */}
      <Dialog open={showMaterialForm} onOpenChange={setShowMaterialForm}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{materialType === "paint" ? "Add Paint" : "Add Material"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {materialType === "paint" ? (
              /* Paint Form */
              <>
                <div className="space-y-2">
                  <Label htmlFor="paintName">Paint Type *</Label>
                  <Input
                    id="paintName"
                    value={materialFormData.name}
                    onChange={(e) => setMaterialFormData({ ...materialFormData, name: e.target.value })}
                    placeholder="e.g., Interior Wall Paint"
                    className="min-h-[44px]"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="paintArea">Area / Use *</Label>
                  <Select
                    id="paintArea"
                    value={materialFormData.area}
                    onChange={(e) => setMaterialFormData({ ...materialFormData, area: e.target.value })}
                    className="min-h-[44px]"
                  >
                    <option value="">Select area...</option>
                    <option value="Walls">Walls</option>
                    <option value="Ceiling">Ceiling</option>
                    <option value="Trim">Trim</option>
                    <option value="Doors">Doors</option>
                  </Select>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="paintBrand">Brand (Optional)</Label>
                    <Select
                      id="paintBrand"
                      value={materialFormData.brand}
                      onChange={(e) => setMaterialFormData({ ...materialFormData, brand: e.target.value })}
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
                    <Label htmlFor="paintColor">Color *</Label>
                    <Input
                      id="paintColor"
                      value={materialFormData.color}
                      onChange={(e) => setMaterialFormData({ ...materialFormData, color: e.target.value })}
                      placeholder="e.g., SW 7008 Alabaster"
                      className="min-h-[44px]"
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="paintSheen">Sheen *</Label>
                    <Select
                      id="paintSheen"
                      value={materialFormData.sheen}
                      onChange={(e) => setMaterialFormData({ ...materialFormData, sheen: e.target.value })}
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
                    <Label htmlFor="paintQuantity">Quantity</Label>
                    <div className="flex gap-2">
                      <Input
                        id="paintQuantity"
                        type="number"
                        min="0"
                        step="0.25"
                        value={materialFormData.quantity}
                        onChange={(e) => setMaterialFormData({ ...materialFormData, quantity: e.target.value })}
                        placeholder="e.g., 3"
                        className="min-h-[44px] flex-1"
                      />
                      <Select
                        value={materialFormData.quantityUnit}
                        onChange={(e) => setMaterialFormData({ ...materialFormData, quantityUnit: e.target.value })}
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

                {/* Advanced Options */}
                <button
                  type="button"
                  onClick={() => setMaterialFormData({ ...materialFormData, showAdvanced: !materialFormData.showAdvanced })}
                  className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1"
                >
                  {materialFormData.showAdvanced ? "Hide" : "Show"} advanced options
                </button>

                {materialFormData.showAdvanced && (
                  <div className="rounded-lg border bg-muted/30 p-4 space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="paintProductLine">Product Line</Label>
                      <Input
                        id="paintProductLine"
                        value={materialFormData.productLine}
                        onChange={(e) => setMaterialFormData({ ...materialFormData, productLine: e.target.value })}
                        placeholder="e.g., Duration, Emerald"
                        className="min-h-[44px]"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="paintNotes">Notes</Label>
                      <Textarea
                        id="paintNotes"
                        value={materialFormData.notes}
                        onChange={(e) => setMaterialFormData({ ...materialFormData, notes: e.target.value })}
                        placeholder="e.g., Back wall only, Second coat needed"
                        rows={2}
                      />
                    </div>
                  </div>
                )}
              </>
            ) : (
              /* Generic Material Form */
              <>
                <div className="space-y-2">
                  <Label htmlFor="materialName">Material Name *</Label>
                  <Input
                    id="materialName"
                    value={materialFormData.name}
                    onChange={(e) => setMaterialFormData({ ...materialFormData, name: e.target.value })}
                    placeholder="e.g., Roller Set, Tape, Drop Cloth"
                    className="min-h-[44px]"
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="materialQuantity">Quantity</Label>
                  <Input
                    id="materialQuantity"
                    value={materialFormData.quantity}
                    onChange={(e) => setMaterialFormData({ ...materialFormData, quantity: e.target.value })}
                    placeholder="e.g., 2 rolls, 1 set, 3 brushes"
                    className="min-h-[44px]"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="materialNotes">Notes (Optional)</Label>
                  <Textarea
                    id="materialNotes"
                    value={materialFormData.notes}
                    onChange={(e) => setMaterialFormData({ ...materialFormData, notes: e.target.value })}
                    placeholder="Any additional details..."
                    rows={2}
                  />
                </div>
              </>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowMaterialForm(false);
                  setMaterialFormData({ 
                    name: "", 
                    brand: "",
                    quantity: "", 
                    color: "", 
                    sheen: "",
                    productLine: "",
                    area: "",
                    notes: "",
                    showAdvanced: false
                  });
                }}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSubmitMaterialForm} 
                disabled={!materialFormData.name.trim() || (materialType === "paint" && (!materialFormData.color.trim() || !materialFormData.sheen || !materialFormData.area))}
              >
                Add {materialType === "paint" ? "Paint" : "Material"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Share Schedule Dialog */}
      <Dialog open={showShareScheduleDialog} onOpenChange={async (open) => {
        setShowShareScheduleDialog(open);
        if (open) {
          await ensureScheduleToken();
        }
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Share Schedule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!scheduledDate || !scheduledTime ? (
              <div className="rounded-lg border bg-muted/50 p-4 text-center text-muted-foreground">
                <Calendar className="mx-auto h-8 w-8 mb-2" />
                <p>This job hasn't been scheduled yet.</p>
                <p className="text-sm mt-1">Add a scheduled date and time first.</p>
              </div>
            ) : loadingScheduleToken ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground">Generating link...</p>
              </div>
            ) : !getScheduleLink() ? (
              <div className="text-center py-4">
                <p className="text-sm text-destructive">No token available</p>
              </div>
            ) : (
              <>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground mb-2">Scheduled for</p>
                  <p className="font-semibold text-lg">
                    {formatDate(scheduledDate)} at {formatTime(scheduledTime)}
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-sm text-muted-foreground">Schedule Link</Label>
                    <div className="flex gap-2 mt-2">
                      <Input 
                        value={getScheduleLink()} 
                        readOnly 
                        className="font-mono text-sm"
                      />
                      <Button 
                        variant="outline"
                        onClick={copyScheduleLink}
                        disabled={loadingScheduleToken}
                        className="shrink-0"
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div>
                    <Label className="text-sm text-muted-foreground">Pre-written Message</Label>
                    <Textarea 
                      value={getScheduleMessage()} 
                      readOnly 
                      rows={4}
                      className="mt-2 font-sans"
                    />
                    <Button 
                      onClick={copyScheduleMessage}
                      className="w-full mt-2"
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

      {/* Duplicate Job Dialog */}
      <Dialog open={showDuplicateDialog} onOpenChange={setShowDuplicateDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Duplicate Job?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This will create a new job with the same customer, address, and materials.
            </p>
            <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
              <p className="text-sm font-medium">Will be copied:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Customer & address</li>
                <li>Notes</li>
                <li>Assigned team member</li>
                <li>Materials ({materials.length} items)</li>
              </ul>
            </div>
            <div className="rounded-lg border bg-warning/10 p-3 space-y-2">
              <p className="text-sm font-medium text-warning">Will NOT be copied:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Schedule (will be unscheduled)</li>
                <li>Status (will reset to "new")</li>
                <li>Estimates & invoices</li>
              </ul>
            </div>
            <div className="flex gap-3 justify-end pt-2">
              <Button
                variant="outline"
                onClick={() => setShowDuplicateDialog(false)}
                disabled={duplicating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleDuplicateJob}
                loading={duplicating}
              >
                <Copy className="mr-2 h-4 w-4" />
                Duplicate
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Job Templates Dialog */}
      <JobTemplatesDialog
        open={showTemplateDialog}
        onOpenChange={setShowTemplateDialog}
        mode={templateDialogMode}
        jobId={job.id}
        companyId={companyId}
        onRefresh={() => router.refresh()}
      />

      {/* Copy Message Dialog */}
      <Dialog open={showCopyDialog} onOpenChange={setShowCopyDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {copyDialogType === "estimate" && "Estimate Message"}
              {copyDialogType === "invoice" && "Invoice Message"}
              {copyDialogType === "materials" && "Materials List"}
              {copyDialogType === "reminder" && "Reminder Message"}
              {copyDialogType === "schedule-confirmation" && "Schedule Confirmation"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {copyDialogType === "estimate" && estimatesList[0] && (
              <>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground mb-2">Estimate Link</p>
                  <div className="flex gap-2 mt-2">
                    <Input 
                      value={`${typeof window !== "undefined" ? window.location.origin : ""}/e/${estimatesList[0].public_token}`}
                      readOnly 
                      className="font-mono text-sm"
                    />
                    <Button 
                      variant="outline"
                      onClick={() => {
                        copyToClipboard(`${typeof window !== "undefined" ? window.location.origin : ""}/e/${estimatesList[0].public_token}`);
                        addToast("Link copied!", "success");
                      }}
                      className="shrink-0"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Message Template</Label>
                  <Textarea 
                    value={`Hey ${job.customer?.name || "there"} — here's your estimate for ${formatCurrency(estimatesList[0].line_items.reduce((sum, li) => sum + li.price, 0))}: ${typeof window !== "undefined" ? window.location.origin : ""}/e/${estimatesList[0].public_token}. Let me know if you have any questions!`}
                    readOnly 
                    rows={4}
                    className="mt-2 font-sans"
                  />
                  <Button 
                    onClick={() => {
                      copyEstimateMessage();
                      setShowCopyDialog(false);
                    }}
                    className="w-full mt-2"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Message
                  </Button>
                </div>
              </>
            )}

            {copyDialogType === "invoice" && invoicesList[0] && (
              <>
                <div className="rounded-lg border bg-card p-4">
                  <p className="text-sm text-muted-foreground mb-2">Invoice Link</p>
                  <div className="flex gap-2 mt-2">
                    <Input 
                      value={`${typeof window !== "undefined" ? window.location.origin : ""}/i/${invoicesList[0].public_token}`}
                      readOnly 
                      className="font-mono text-sm"
                    />
                    <Button 
                      variant="outline"
                      onClick={() => {
                        copyToClipboard(`${typeof window !== "undefined" ? window.location.origin : ""}/i/${invoicesList[0].public_token}`);
                        addToast("Link copied!", "success");
                      }}
                      className="shrink-0"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Message Template</Label>
                  <Textarea 
                    value={`Hey ${job.customer?.name || "there"} — thanks again for letting us work on your project! Here's your invoice for ${formatCurrency(invoicesList[0].amount_total)}: ${typeof window !== "undefined" ? window.location.origin : ""}/i/${invoicesList[0].public_token}. Let us know if you have any questions!`}
                    readOnly 
                    rows={4}
                    className="mt-2 font-sans"
                  />
                  <Button 
                    onClick={() => {
                      copyPaymentRequestMessage();
                      setShowCopyDialog(false);
                    }}
                    className="w-full mt-2"
                  >
                    <Copy className="mr-2 h-4 w-4" />
                    Copy Message
                  </Button>
                </div>
              </>
            )}

            {copyDialogType === "materials" && (
              <div>
                <Label className="text-sm text-muted-foreground">Materials List</Label>
                <Textarea 
                  value={`Materials needed for ${job.title} (${job.customer?.name || "Customer"}):\n\n${materials.map((m, i) => `${i + 1}. ${m.name}${m.notes ? ` - ${m.notes}` : ""}`).join("\n")}\n\nTotal items: ${materials.length}`}
                  readOnly 
                  rows={Math.min(materials.length + 4, 12)}
                  className="mt-2 font-mono text-sm"
                />
                <Button 
                  onClick={() => {
                    copyMaterialsList();
                    setShowCopyDialog(false);
                  }}
                  className="w-full mt-2"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy List
                </Button>
              </div>
            )}

            {copyDialogType === "reminder" && scheduledDate && scheduledTime && (
              <div>
                <Label className="text-sm text-muted-foreground">Reminder Message</Label>
                <Textarea 
                  value={`Hey ${job.customer?.name || "there"} — just a reminder that we're scheduled for ${formatDate(scheduledDate)} at ${formatTime(scheduledTime)} at ${address || "[address]"}. Reply here if anything changes. See you then!`}
                  readOnly 
                  rows={4}
                  className="mt-2 font-sans"
                />
                <Button 
                  onClick={() => {
                    copyReminderMessage();
                    setShowCopyDialog(false);
                  }}
                  className="w-full mt-2"
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy Message
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
