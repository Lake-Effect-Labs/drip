"use client";

import { useState, useEffect } from "react";
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
import { JobTemplatesDialog } from "./job-templates-dialog";
import { MessageTemplatesDialog } from "./message-templates-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { SimpleCheckbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";
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
  const [saving, setSaving] = useState(false);
  const [newMaterial, setNewMaterial] = useState("");
  const [showCommonMaterials, setShowCommonMaterials] = useState(false);
  
  // Inline add forms
  const [showAddEstimate, setShowAddEstimate] = useState(false);
  const [showAddInvoice, setShowAddInvoice] = useState(false);
  const [estimateLineItems, setEstimateLineItems] = useState<Array<{ title: string; price: string }>>([{ title: "", price: "" }]);
  const [newInvoiceAmount, setNewInvoiceAmount] = useState("");
  const [addingEstimate, setAddingEstimate] = useState(false);
  const [addingInvoice, setAddingInvoice] = useState(false);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [messageTemplatesOpen, setMessageTemplatesOpen] = useState(false);
  const [selectedEstimate, setSelectedEstimate] = useState<EstimateWithLineItems | null>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showMaterialForm, setShowMaterialForm] = useState(false);
  const [materialFormData, setMaterialFormData] = useState({ name: "", quantity: "", color: "", notes: "" });

  // Form state
  const [scheduledDate, setScheduledDate] = useState(job.scheduled_date || "");
  const [scheduledTime, setScheduledTime] = useState(job.scheduled_time || "");
  const [assignedUserId, setAssignedUserId] = useState(job.assigned_user_id || "");
  const [notes, setNotes] = useState(job.notes || "");

  const address = [job.address1, job.city, job.state, job.zip]
    .filter(Boolean)
    .join(", ");

  async function handleSave() {
    setSaving(true);
    try {
      // Determine new status based on scheduling
      let newStatus = job.status;
      if (scheduledDate && job.status === "quoted") {
        newStatus = "scheduled";
      }

      const { error } = await supabase
        .from("jobs")
        .update({
          scheduled_date: scheduledDate || null,
          scheduled_time: scheduledTime || null,
          assigned_user_id: assignedUserId || null,
          notes: notes || null,
          status: newStatus,
          updated_at: new Date().toISOString(),
        })
        .eq("id", job.id);

      if (error) throw error;

      setJob((prev) => ({
        ...prev,
        scheduled_date: scheduledDate || null,
        scheduled_time: scheduledTime || null,
        assigned_user_id: assignedUserId || null,
        notes: notes || null,
        status: newStatus,
      }));

      addToast("Job updated!", "success");
    } catch {
      addToast("Failed to save changes", "error");
    } finally {
      setSaving(false);
    }
  }

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

    // Check if material already exists
    if (materials.some(m => m.name.toLowerCase() === name.toLowerCase())) {
      addToast("Material already added", "error");
      return;
    }

    // Build notes from quantity, color, and other notes
    const notesParts = [];
    if (materialFormData.quantity) notesParts.push(`Qty: ${materialFormData.quantity}`);
    if (materialFormData.color) notesParts.push(`Color: ${materialFormData.color}`);
    if (materialFormData.notes) notesParts.push(materialFormData.notes);
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
      setMaterialFormData({ name: "", quantity: "", color: "", notes: "" });
      setShowMaterialForm(false);
      setNewMaterial("");
      addToast("Material added!", "success");
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

  function copyReminderMessage() {
    const customerName = job.customer?.name || "there";
    const dateStr = scheduledDate ? formatDate(scheduledDate) : "[date]";
    const timeStr = scheduledTime ? formatTime(scheduledTime) : "[time]";
    const message = `Hey ${customerName} — just a reminder that we're scheduled for ${dateStr} at ${timeStr} at ${address || "[address]"}. Reply here if anything changes. See you then!`;
    copyToClipboard(message);
    addToast("Reminder message copied!", "success");
  }

  function copyPaymentRequestMessage() {
    const customerName = job.customer?.name || "there";
    const latestInvoice = invoices[0];
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
              <h1 className="text-xl sm:text-2xl font-bold">{job.title}</h1>
              {job.customer && (
                <p className="text-muted-foreground flex items-center gap-1 mt-1 text-sm sm:text-base">
                  <User className="h-4 w-4" />
                  {job.customer.name}
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
                  <span>{address}</span>
                </div>
              )}
              {job.customer?.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div className="flex gap-2">
                    <a 
                      href={`tel:${job.customer.phone}`} 
                      className="hover:underline touch-target min-h-[44px] flex items-center"
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
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <a 
                    href={`mailto:${job.customer.email}`} 
                    className="hover:underline touch-target min-h-[44px] flex items-center"
                  >
                    {job.customer.email}
                  </a>
                </div>
              )}
            </div>

            {/* All sections in one view */}
            <div className="space-y-6">
                <div className="rounded-lg border bg-card p-4 space-y-4">
                  <h3 className="font-semibold">Scheduling</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="scheduledDate">Date</Label>
                      <Input
                        id="scheduledDate"
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="scheduledTime">Start Time</Label>
                      <Input
                        id="scheduledTime"
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="assignedUser">Assigned To</Label>
                    <Select
                      id="assignedUser"
                      value={assignedUserId}
                      onChange={(e) => setAssignedUserId(e.target.value)}
                    >
                      <option value="">Unassigned</option>
                      {teamMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.fullName}
                        </option>
                      ))}
                    </Select>
                  </div>
                  {scheduledDate && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={copyReminderMessage}
                      className="touch-target min-h-[44px]"
                    >
                      <Copy className="mr-2 h-4 w-4" />
                      Copy reminder message
                    </Button>
                  )}
                </div>

                <div className="rounded-lg border bg-card p-4 space-y-4">
                  <h3 className="font-semibold">Notes</h3>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Add notes about this job..."
                    rows={4}
                  />
                </div>

                {/* Job History Timeline */}
                {jobHistory.length > 0 && (
                  <div className="rounded-lg border bg-card p-4 space-y-4">
                    <h3 className="font-semibold">History</h3>
                    <JobHistoryTimeline history={jobHistory} />
                  </div>
                )}

                <Button onClick={handleSave} loading={saving} className="w-full sm:w-auto touch-target min-h-[44px]">
                  Save Changes
                </Button>

              {/* Estimates Section */}
              <div className="rounded-lg border bg-card p-4 space-y-4">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <h3 className="font-semibold">Estimates ({estimatesList.length})</h3>
                  {!showAddEstimate ? (
                    <Button 
                      size="sm" 
                      className="w-full sm:w-auto touch-target min-h-[44px]"
                      onClick={() => setShowAddEstimate(true)}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Add Estimate
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
                    <p>No estimates yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {estimatesList.map((estimate) => {
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
                  <h3 className="font-semibold">Invoices ({invoicesList.length})</h3>
                  {!showAddInvoice ? (
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
                        Add Invoice
                      </Button>
                    </div>
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
                    <p>No invoices yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {invoicesList.map((invoice) => (
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
                <h3 className="font-semibold">Materials Checklist ({materials.length})</h3>

                <div className="rounded-lg border bg-muted/30 divide-y">
                  {materials.length === 0 ? (
                    <div className="p-8 text-center text-muted-foreground">
                      <Package className="mx-auto h-8 w-8 mb-2" />
                      <p>No materials added</p>
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

                {/* Common materials quick add */}
                {showCommonMaterials && (
                  <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm">Quick Add</Label>
                      <button
                        onClick={() => setShowCommonMaterials(false)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {COMMON_MATERIALS.filter(
                        material => !materials.some(m => m.name.toLowerCase() === material.toLowerCase())
                      ).map((material) => (
                        <Button
                          key={material}
                          variant="outline"
                          size="sm"
                          onClick={() => handleAddMaterial(material)}
                          className="touch-target min-h-[36px] text-xs"
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          {material}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Add material */}
                <div className="flex gap-2">
                  <Input
                    placeholder="Add material..."
                    value={newMaterial}
                    onChange={(e) => setNewMaterial(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        if (newMaterial.trim()) {
                          setMaterialFormData({ ...materialFormData, name: newMaterial });
                          setShowMaterialForm(true);
                        }
                      }
                    }}
                    className="min-h-[44px]"
                  />
                  <Button 
                    onClick={() => setShowCommonMaterials(!showCommonMaterials)}
                    variant="outline"
                    className="touch-target min-h-[44px]"
                    title="Quick add common materials"
                  >
                    <Package className="h-4 w-4" />
                  </Button>
                  <Button 
                    onClick={() => {
                      if (newMaterial.trim()) {
                        setMaterialFormData({ ...materialFormData, name: newMaterial });
                        setShowMaterialForm(true);
                      }
                    }}
                    disabled={!newMaterial.trim()}
                    className="touch-target min-h-[44px] min-w-[44px]"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
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
              {scheduledDate && (
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
                  onClick={() => {
                    const url = `${window.location.origin}/e/${estimatesList[0].public_token}`;
                    copyToClipboard(url);
                    addToast("Estimate link copied!", "success");
                  }}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  Copy estimate link
                </Button>
              )}
            </div>

            {/* Save as Template */}
            <div className="rounded-lg border bg-card p-4">
              <Button
                variant="outline"
                className="w-full touch-target min-h-[44px]"
                onClick={() => setTemplatesOpen(true)}
              >
                <FileText className="mr-2 h-4 w-4" />
                Save as Template
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Templates Dialogs */}
      <JobTemplatesDialog
        open={templatesOpen}
        onOpenChange={setTemplatesOpen}
        companyId={companyId}
        job={{
          ...job,
          materials: materials.map((m) => ({ name: m.name })),
        }}
        onSelectTemplate={() => {}}
      />

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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Material</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="materialName">Material Name *</Label>
              <Input
                id="materialName"
                value={materialFormData.name}
                onChange={(e) => setMaterialFormData({ ...materialFormData, name: e.target.value })}
                placeholder="e.g., Paint, Brushes"
                className="min-h-[44px]"
                autoFocus
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="materialQuantity">Quantity</Label>
                <Input
                  id="materialQuantity"
                  value={materialFormData.quantity}
                  onChange={(e) => setMaterialFormData({ ...materialFormData, quantity: e.target.value })}
                  placeholder="e.g., 5 gallons"
                  className="min-h-[44px]"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="materialColor">Color</Label>
                <Input
                  id="materialColor"
                  value={materialFormData.color}
                  onChange={(e) => setMaterialFormData({ ...materialFormData, color: e.target.value })}
                  placeholder="e.g., SW 7029"
                  className="min-h-[44px]"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="materialNotes">Additional Notes</Label>
              <Textarea
                id="materialNotes"
                value={materialFormData.notes}
                onChange={(e) => setMaterialFormData({ ...materialFormData, notes: e.target.value })}
                placeholder="Any other details..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowMaterialForm(false);
                  setMaterialFormData({ name: "", quantity: "", color: "", notes: "" });
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleSubmitMaterialForm} disabled={!materialFormData.name.trim()}>
                Add Material
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

