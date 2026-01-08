"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { JobTemplatesDialog } from "@/components/app/jobs/job-templates-dialog";
import { FileText } from "lucide-react";
import type { Job, Customer } from "@/types/database";

type JobWithCustomer = Job & { customer: Customer | null };

interface NewJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  teamMembers: { id: string; email: string; fullName: string }[];
  onJobCreated: (job: JobWithCustomer) => void;
}

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA",
  "HI", "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD",
  "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV", "NH", "NJ",
  "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC",
  "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY",
];

export function NewJobDialog({
  open,
  onOpenChange,
  companyId,
  teamMembers,
  onJobCreated,
}: NewJobDialogProps) {
  const [loading, setLoading] = useState(false);
  const [title, setTitle] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [zip, setZip] = useState("");
  const [notes, setNotes] = useState("");
  const [assignedUserId, setAssignedUserId] = useState("");
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const { addToast } = useToast();
  const supabase = createClient();

  function resetForm() {
    setTitle("");
    setCustomerName("");
    setCustomerPhone("");
    setCustomerEmail("");
    setAddress1("");
    setAddress2("");
    setCity("");
    setState("");
    setZip("");
    setNotes("");
    setAssignedUserId("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      // Create customer if name provided (via API to bypass RLS)
      let customerId: string | null = null;
      if (customerName.trim()) {
        const customerResponse = await fetch("/api/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_id: companyId,
            name: customerName.trim(),
            phone: customerPhone || null,
            email: customerEmail || null,
            address1: address1 || null,
            address2: address2 || null,
            city: city || null,
            state: state || null,
            zip: zip || null,
          }),
        });

        if (!customerResponse.ok) {
          const errorData = await customerResponse.json();
          throw new Error(errorData.error || "Failed to create customer");
        }

        const customer = await customerResponse.json();
        customerId = customer.id;
      }

      // Create job via API (bypasses RLS)
      const jobResponse = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company_id: companyId,
          customer_id: customerId,
          title: title.trim(),
          address1: address1 || null,
          address2: address2 || null,
          city: city || null,
          state: state || null,
          zip: zip || null,
          notes: notes || null,
          assigned_user_id: assignedUserId || null,
          status: "new",
        }),
      });

      if (!jobResponse.ok) {
        const errorData = await jobResponse.json();
        throw new Error(errorData.error || "Failed to create job");
      }

      const job = await jobResponse.json();

      onJobCreated(job);
      resetForm();
    } catch (error) {
      console.error("Error creating job:", error);
      addToast("Failed to create job", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Job</DialogTitle>
          <DialogDescription>
            Create a new job. It will start in the &quot;New&quot; column.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          {/* Templates */}
          <Button
            type="button"
            variant="outline"
            onClick={() => setTemplatesOpen(true)}
            className="w-full"
          >
            <FileText className="mr-2 h-4 w-4" />
            Use Template
          </Button>

          {/* Job Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Job Title *</Label>
            <Input
              id="title"
              placeholder="e.g., Johnson Exterior Repaint"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          {/* Customer Section */}
          <div className="space-y-3 rounded-lg border p-4">
            <h4 className="font-medium text-sm">Customer (optional)</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customerName">Name</Label>
                <Input
                  id="customerName"
                  placeholder="John Smith"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerPhone">Phone</Label>
                <Input
                  id="customerPhone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  value={customerPhone}
                  onChange={(e) => setCustomerPhone(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="customerEmail">Email</Label>
              <Input
                id="customerEmail"
                type="email"
                placeholder="john@email.com"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </div>
          </div>

          {/* Address Section */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Job Address</h4>
            <div className="space-y-2">
              <Label htmlFor="address1">Street Address</Label>
              <Input
                id="address1"
                placeholder="123 Main St"
                value={address1}
                onChange={(e) => setAddress1(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="address2">Apt, Suite, etc.</Label>
              <Input
                id="address2"
                placeholder="Apt 4B"
                value={address2}
                onChange={(e) => setAddress2(e.target.value)}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  placeholder="Austin"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="state">State</Label>
                <Select
                  id="state"
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                >
                  <option value="">Select</option>
                  {US_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="zip">ZIP</Label>
                <Input
                  id="zip"
                  placeholder="78701"
                  value={zip}
                  onChange={(e) => setZip(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Assignment */}
          <div className="space-y-2">
            <Label htmlFor="assignedUser">Assign to</Label>
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

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Create Job
            </Button>
          </div>
        </form>

        <JobTemplatesDialog
          open={templatesOpen}
          onOpenChange={setTemplatesOpen}
          companyId={companyId}
          onSelectTemplate={(template) => {
            setTitle(template.name);
            setNotes(template.default_notes || "");
            // Materials would be added after job creation
            addToast("Template applied!", "success");
          }}
        />
      </DialogContent>
    </Dialog>
  );
}

