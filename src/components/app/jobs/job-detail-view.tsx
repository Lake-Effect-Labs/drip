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
import type { Job, Customer, Estimate, EstimateLineItem, Invoice, JobMaterial } from "@/types/database";
import { JobHistoryTimeline } from "./job-history-timeline";
import { MessageTemplatesDialog } from "./message-templates-dialog";
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
}

export function JobDetailView({
  job: initialJob,
  estimates,
  invoices,
  materials: initialMaterials,
  jobHistory = [],
  teamMembers,
  companyId,
}: JobDetailViewProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const supabase = createClient();

  const [job, setJob] = useState(initialJob);
  const [materials, setMaterials] = useState(initialMaterials);
  const [estimatesList, setEstimatesList] = useState(estimates);
  const [invoicesList, setInvoicesList] = useState(invoices);

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
  const [materialType, setMaterialType] = useState<"paint" | "generic">("generic");
  const [materialFormData, setMaterialFormData] = useState({ 
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

  // Auto-save handlers
  async function handleDateChange(date: string) {
    setScheduledDate(date);
    await autoSave({ scheduled_date: date || null });
  }

  async function handleTimeChange(time: string) {
    setScheduledTime(time);
    await autoSave({ scheduled_time: time || null });
  }

  async function handleAssignedUserChange(userId: string) {
    setAssignedUserId(userId);
    await autoSave({ assigned_user_id: userId || null });
  }

  // Debounced notes save
  async function handleNotesChange(newNotes: string) {
    setNotes(newNotes);
    
    // Clear existing timeout
    if (notesTimeoutRef.current) {
      clearTimeout(notesTimeoutRef.current);
    }
    
    // Set new timeout for auto-save
    notesTimeoutRef.current = setTimeout(async () => {
      await autoSave({ notes: newNotes || null });
    }, 1000); // Save after 1 second of no typing
  }

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (notesTimeoutRef.current) {
        clearTimeout(notesTimeoutRef.current);
      }
    };
  }, []);

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
    }

    // Build notes based on material type
    const notesParts = [];
    
    if (materialType === "paint") {
      // Paint: Brand, Color, Sheen, Quantity, Product Line, Area, Notes
      if (materialFormData.brand) notesParts.push(materialFormData.brand);
      notesParts.push(materialFormData.color);
      notesParts.push(materialFormData.sheen);
      if (materialFormData.quantity) notesParts.push(materialFormData.quantity);
      if (materialFormData.productLine) notesParts.push(`(${materialFormData.productLine})`);
      if (materialFormData.area) notesParts.push(`- ${materialFormData.area}`);
      if (materialFormData.notes) notesParts.push(`| ${materialFormData.notes}`);
    } else {
      // Generic: Quantity, Notes
      if (materialFormData.quantity) notesParts.push(materialFormData.quantity);
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
    const { error } = await supabase
      .from("job_materials")
      .update({ checked })
      .eq("id", materialId);

    if (error) {
      addToast("Failed to update material", "error");
      return;
    }

    setMaterials((prev) =>
      prev.map((m) => (m.id === materialId ? { ...m, checked } : m))
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

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold truncate">{job.title}</h1>
              {job.customer && (
                <p className="text-muted-foreground flex items-center gap-1 mt-1 text-sm sm:text-base min-w-0">
                  <User className="h-4 w-4 shrink-0" />
                  <span className="truncate">{job.customer.name}</span>
                </p>
              )}
            </div>
            <Badge className={cn("w-fit", JOB_STATUS_COLORS[job.status as JobStatus])}>
              {JOB_STATUS_LABELS[job.status as JobStatus]}
            </Badge>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto p-4">
        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-6">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6 order-1">
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
                <div className="rounded-lg border bg-card p-4 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Scheduling</h3>
                    {scheduledDate && scheduledTime && (
                      <Badge variant="secondary" className="text-xs">
                        <Clock className="mr-1 h-3 w-3" />
                        {formatDate(scheduledDate)} at {formatTime(scheduledTime)}
                      </Badge>
                    )}
                  </div>
                  <div className="space-y-4">
                    <DateTimePicker
                      date={scheduledDate || null}
                      time={scheduledTime || null}
                      onDateChange={handleDateChange}
                      onTimeChange={handleTimeChange}
                      label="When is this job scheduled?"
                    />
                    <div className="space-y-2">
                      <Label htmlFor="assignedUser" className="text-sm font-medium">
                        Who's working on this?
                      </Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                        <Select
                          id="assignedUser"
                          value={assignedUserId}
                          onChange={(e) => handleAssignedUserChange(e.target.value)}
                          className="pl-10 min-h-[44px]"
                        >
                          <option value="">Unassigned</option>
                          {teamMembers.map((member) => (
                            <option key={member.id} value={member.id}>
                              {member.fullName}
                            </option>
                          ))}
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-lg border bg-card p-4 space-y-4">
                  <h3 className="font-semibold">Notes</h3>
                  <Textarea
                    value={notes}
                    onChange={(e) => handleNotesChange(e.target.value)}
                    placeholder="Add notes about this job..."
                    rows={4}
                  />
                </div>

              {/* Estimates Section */}
              <div className="rounded-lg border bg-card p-4 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <h3 className="font-semibold">Estimate</h3>
                  {estimatesList.length === 0 && !showAddEstimate ? (
                    <Button 
                      size="sm" 
                      className="w-full sm:w-auto touch-target min-h-[44px]"
                      onClick={() => setShowAddEstimate(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create Estimate
                    </Button>
                  ) : estimatesList.length > 0 ? (
                    <Button 
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto touch-target min-h-[44px]"
                      onClick={() => setSelectedEstimate(estimatesList[0])}
                    >
                      View Details
                    </Button>
                  ) : null}
                </div>

                {showAddEstimate && (
                  <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Line Items</Label>
                      <button
                        onClick={() => {
                          setShowAddEstimate(false);
                          setEstimateLineItems([{ title: "", price: "" }]);
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="space-y-3">
                      {estimateLineItems.map((item, index) => (
                        <div key={index} className="flex gap-2">
                          <Input
                            placeholder="Title"
                            value={item.title}
                            onChange={(e) => updateEstimateLineItem(index, "title", e.target.value)}
                            className="flex-1 min-h-[44px]"
                            autoFocus={index === estimateLineItems.length - 1}
                          />
                          <div className="relative w-32">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                              $
                            </span>
                            <Input
                              type="number"
                              step="0.01"
                              min="0.01"
                              placeholder="0.00"
                              value={item.price}
                              onChange={(e) => updateEstimateLineItem(index, "price", e.target.value)}
                              className="pl-7 min-h-[44px]"
                            />
                          </div>
                          {estimateLineItems.length > 1 && (
                            <button
                              onClick={() => removeEstimateLineItem(index)}
                              className="text-muted-foreground hover:text-destructive touch-target min-h-[44px] min-w-[44px] flex items-center justify-center"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      ))}
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={addEstimateLineItem}
                        className="w-full touch-target min-h-[44px]"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Line Item
                      </Button>
                    </div>
                    <Button 
                      onClick={handleAddEstimate}
                      loading={addingEstimate}
                      disabled={estimateLineItems.every(item => !item.title.trim() || !item.price.trim())}
                      className="w-full touch-target min-h-[44px]"
                    >
                      Create Estimate
                    </Button>
                  </div>
                )}

                {estimatesList.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <FileText className="mx-auto h-8 w-8 mb-2" />
                    <p>No estimate yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {estimatesList.slice(0, 1).map((estimate) => {
                      const total = estimate.line_items.reduce((sum, li) => sum + li.price, 0);
                      return (
                        <button
                          key={estimate.id}
                          onClick={() => setSelectedEstimate(estimate)}
                          className="w-full text-left block rounded-lg border bg-muted/30 p-4 hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium">
                                {formatCurrency(total)}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {estimate.line_items.length} line items • {formatDate(estimate.created_at)}
                              </p>
                            </div>
                            <Badge
                              variant={
                                estimate.status === "accepted"
                                  ? "success"
                                  : estimate.status === "sent"
                                  ? "secondary"
                                  : "outline"
                              }
                            >
                              {estimate.status}
                            </Badge>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Invoices Section */}
              <div className="rounded-lg border bg-card p-4 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <h3 className="font-semibold">Invoice</h3>
                  {invoicesList.length === 0 && !showAddInvoice ? (
                    <div className="flex gap-2 w-full sm:w-auto">
                      {estimatesList.some(e => e.status === "accepted") && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          className="flex-1 sm:flex-none touch-target min-h-[44px]"
                          onClick={handleCreateInvoiceFromEstimate}
                        >
                          <Receipt className="mr-2 h-4 w-4" />
                          From Estimate
                        </Button>
                      )}
                      <Button 
                        size="sm" 
                        className="flex-1 sm:flex-none touch-target min-h-[44px]"
                        onClick={() => setShowAddInvoice(true)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Create Invoice
                      </Button>
                    </div>
                  ) : invoicesList.length > 0 ? (
                    <Button 
                      size="sm"
                      variant="outline"
                      className="w-full sm:w-auto touch-target min-h-[44px]"
                      onClick={() => setSelectedInvoice(invoicesList[0])}
                    >
                      View Details
                    </Button>
                  ) : null}
                </div>

                {showAddInvoice && (
                  <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="invoiceAmount">Amount</Label>
                      <button
                        onClick={() => {
                          setShowAddInvoice(false);
                          setNewInvoiceAmount("");
                        }}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          $
                        </span>
                        <Input
                          id="invoiceAmount"
                          type="number"
                          step="0.01"
                          min="0.01"
                          className="pl-7 min-h-[44px]"
                          placeholder="0.00"
                          value={newInvoiceAmount}
                          onChange={(e) => setNewInvoiceAmount(e.target.value)}
                          autoFocus
                        />
                      </div>
                      <Button 
                        onClick={handleAddInvoice}
                        loading={addingInvoice}
                        disabled={!newInvoiceAmount.trim()}
                        className="touch-target min-h-[44px]"
                      >
                        Add
                      </Button>
                    </div>
                  </div>
                )}

                {invoicesList.length === 0 ? (
                  <div className="p-8 text-center text-muted-foreground">
                    <Receipt className="mx-auto h-8 w-8 mb-2" />
                    <p>No invoice yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {invoicesList.slice(0, 1).map((invoice) => (
                      <button
                        key={invoice.id}
                        onClick={() => setSelectedInvoice(invoice)}
                        className="w-full text-left block rounded-lg border bg-muted/30 p-4 hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">
                              {formatCurrency(invoice.amount_total)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {formatDate(invoice.created_at)}
                            </p>
                          </div>
                          <Badge
                            variant={
                              invoice.status === "paid"
                                ? "success"
                                : invoice.status === "sent"
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {invoice.status}
                          </Badge>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Materials Section */}
              <div className="rounded-lg border bg-card p-4 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">Materials Checklist ({materials.length})</h3>
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setMaterialType("paint");
                        setMaterialFormData({
                          name: "Interior Wall Paint",
                          brand: "",
                          color: "",
                          sheen: "Eggshell",
                          quantity: "",
                          productLine: "",
                          area: "Walls",
                          notes: "",
                          showAdvanced: false
                        });
                        setShowMaterialForm(true);
                      }}
                      className="touch-target min-h-[44px] justify-start"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Wall Paint
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setMaterialType("paint");
                        setMaterialFormData({
                          name: "Ceiling Paint",
                          brand: "",
                          color: "",
                          sheen: "Flat",
                          quantity: "",
                          productLine: "",
                          area: "Ceiling",
                          notes: "",
                          showAdvanced: false
                        });
                        setShowMaterialForm(true);
                      }}
                      className="touch-target min-h-[44px] justify-start"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Ceiling Paint
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setMaterialType("paint");
                        setMaterialFormData({
                          name: "Trim Paint",
                          brand: "",
                          color: "",
                          sheen: "Semi-Gloss",
                          quantity: "",
                          productLine: "",
                          area: "Trim",
                          notes: "",
                          showAdvanced: false
                        });
                        setShowMaterialForm(true);
                      }}
                      className="touch-target min-h-[44px] justify-start"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Trim Paint
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setMaterialType("generic");
                        setMaterialFormData({
                          name: "Roller Set",
                          brand: "",
                          color: "",
                          sheen: "",
                          quantity: "1 set",
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
                      Roller Set
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setMaterialType("generic");
                        setMaterialFormData({
                          name: "Prep Kit",
                          brand: "",
                          color: "",
                          sheen: "",
                          quantity: "1 kit",
                          productLine: "",
                          area: "",
                          notes: "Tape, spackle, sandpaper",
                          showAdvanced: false
                        });
                        setShowMaterialForm(true);
                      }}
                      className="touch-target min-h-[44px] justify-start"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Prep Kit
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
                        className="flex items-center gap-3 p-3"
                      >
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
                    ))
                  )}
                </div>
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

          {/* Sidebar */}
          <div className="space-y-4 order-2 lg:order-2">
            {/* Status Actions */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <h3 className="font-semibold">Actions</h3>
              {job.status === "new" && (
                <Button
                  variant="outline"
                  className="w-full justify-start touch-target min-h-[44px]"
                  onClick={() => handleStatusChange("quoted")}
                >
                  Mark as Quoted
                </Button>
              )}
              {job.status === "quoted" && (
                <Button
                  variant="outline"
                  className="w-full justify-start touch-target min-h-[44px]"
                  onClick={() => handleStatusChange("scheduled")}
                >
                  Mark as Scheduled
                </Button>
              )}
              {job.status === "scheduled" && (
                <Button
                  variant="outline"
                  className="w-full justify-start touch-target min-h-[44px]"
                  onClick={() => handleStatusChange("in_progress")}
                >
                  Start Job
                </Button>
              )}
              {job.status === "in_progress" && (
                <Button
                  variant="outline"
                  className="w-full justify-start touch-target min-h-[44px]"
                  onClick={() => handleStatusChange("done")}
                >
                  Mark Complete
                </Button>
              )}
              {job.status === "done" && (
                <Button
                  variant="outline"
                  className="w-full justify-start touch-target min-h-[44px]"
                  onClick={() => handleStatusChange("paid")}
                >
                  Mark as Paid
                </Button>
              )}
              <Button
                variant="ghost"
                className="w-full justify-start text-muted-foreground touch-target min-h-[44px]"
                onClick={() => handleStatusChange("archive")}
              >
                Archive Job
              </Button>
            </div>

            {/* Copy Messages */}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Copy Messages</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMessageTemplatesOpen(true)}
                  className="touch-target min-h-[36px]"
                >
                  Templates
                </Button>
              </div>
              {scheduledDate && scheduledTime && job.status === "quoted" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start touch-target min-h-[44px]"
                  onClick={copyScheduleConfirmationMessage}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy schedule confirmation
                </Button>
              )}
              {scheduledDate && scheduledTime && job.status === "scheduled" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start touch-target min-h-[44px]"
                  onClick={copyReminderMessage}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy reminder message
                </Button>
              )}
              {invoicesList.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start touch-target min-h-[44px]"
                  onClick={copyPaymentRequestMessage}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy invoice message
                </Button>
              )}
              {estimatesList.length > 0 && estimatesList[0].public_token && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start touch-target min-h-[44px]"
                  onClick={copyEstimateMessage}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy estimate message
                </Button>
              )}
              {materials.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start touch-target min-h-[44px]"
                  onClick={copyMaterialsList}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy materials list
                </Button>
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
                    <Input
                      id="paintQuantity"
                      value={materialFormData.quantity}
                      onChange={(e) => setMaterialFormData({ ...materialFormData, quantity: e.target.value })}
                      placeholder="e.g., 3 gal, 1 quart"
                      className="min-h-[44px]"
                    />
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
                    <div className="grid gap-4 sm:grid-cols-2">
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
                        <Label htmlFor="paintArea">Area / Use</Label>
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
                disabled={!materialFormData.name.trim() || (materialType === "paint" && (!materialFormData.color.trim() || !materialFormData.sheen))}
              >
                Add {materialType === "paint" ? "Paint" : "Material"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

