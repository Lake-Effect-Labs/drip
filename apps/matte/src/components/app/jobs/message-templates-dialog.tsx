"use client";

import { useState, useEffect } from "react";
import { createClient } from "@drip/core/database/server";
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
import { Copy, Send, Plus, Trash2, FileText, Mail } from "lucide-react";
import { copyToClipboard, formatDate, formatTime, formatCurrency } from "@/lib/utils";
import type { Job, Customer, Invoice } from "@drip/core/types";

interface MessageTemplate {
  id: string;
  name: string;
  type: "sms" | "email";
  subject: string | null;
  body: string;
  variables: string[];
}

interface MessageTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  job: Job;
  customer: Customer | null;
  invoices: Invoice[];
  scheduledDate: string;
  scheduledTime: string;
  address: string;
}

export function MessageTemplatesDialog({
  open,
  onOpenChange,
  companyId,
  job,
  customer,
  invoices,
  scheduledDate,
  scheduledTime,
  address,
}: MessageTemplatesDialogProps) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateType, setTemplateType] = useState<"sms" | "email">("sms");
  const [templateSubject, setTemplateSubject] = useState("");
  const [templateBody, setTemplateBody] = useState("");
  const { addToast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    if (open) {
      loadTemplates();
    }
  }, [open, companyId]);

  async function loadTemplates() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("message_templates" as any)
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error) {
        setTemplates([]);
        return;
      }
      setTemplates((data as any) || []);
    } catch (error) {
      console.error("Error loading templates:", error);
      addToast("Failed to load templates", "error");
    } finally {
      setLoading(false);
    }
  }

  function replaceVariables(text: string): string {
    return text
      .replace(/\{\{customer_name\}\}/g, customer?.name || "there")
      .replace(/\{\{job_date\}\}/g, scheduledDate ? formatDate(scheduledDate) : "[date]")
      .replace(/\{\{job_time\}\}/g, scheduledTime ? formatTime(scheduledTime) : "[time]")
      .replace(/\{\{job_address\}\}/g, address || "[address]")
      .replace(/\{\{amount\}\}/g, invoices[0] ? formatCurrency(invoices[0].amount_total) : "[amount]")
      .replace(/\{\{invoice_link\}\}/g, invoices[0] 
        ? `${typeof window !== "undefined" ? window.location.origin : ""}/i/${invoices[0].public_token}`
        : "[invoice link]");
  }

  function handleCopyMessage(template: MessageTemplate) {
    const message = replaceVariables(template.body);
    copyToClipboard(message);
    addToast("Message copied!", "success");
  }

  function handleSendMessage(template: MessageTemplate) {
    const message = replaceVariables(template.body);
    
    if (template.type === "sms" && customer?.phone) {
      window.location.href = `sms:${customer.phone}?body=${encodeURIComponent(message)}`;
    } else if (template.type === "email" && customer?.email) {
      const subject = template.subject ? replaceVariables(template.subject) : "Message from Drip";
      window.location.href = `mailto:${customer.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`;
    } else {
      addToast(`No ${template.type === "sms" ? "phone" : "email"} available`, "error");
    }
  }

  async function handleSaveTemplate() {
    if (!templateName.trim() || !templateBody.trim()) {
      addToast("Please fill in all required fields", "error");
      return;
    }

    try {
      const { data, error } = await supabase
        .from("message_templates" as any)
        .insert({
          company_id: companyId,
          name: templateName.trim(),
          type: templateType,
          subject: templateType === "email" && templateSubject.trim() ? templateSubject.trim() : null,
          body: templateBody.trim(),
          variables: extractVariables(templateBody + (templateSubject || "")),
        })
        .select()
        .single();

      if (error) throw error;

      setTemplates((prev) => [(data as any), ...prev]);
      setTemplateName("");
      setTemplateBody("");
      setTemplateSubject("");
      setShowCreateForm(false);
      addToast("Template saved!", "success");
    } catch (error) {
      console.error("Error saving template:", error);
      addToast("Failed to save template", "error");
    }
  }

  function extractVariables(text: string): string[] {
    const matches = text.match(/\{\{(\w+)\}\}/g);
    return matches ? [...new Set(matches.map(m => m.replace(/\{\{|\}\}/g, "")))] : [];
  }

  async function handleDeleteTemplate(templateId: string) {
    try {
      const { error } = await supabase
        .from("message_templates" as any)
        .delete()
        .eq("id", templateId);

      if (error) throw error;

      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
      addToast("Template deleted!", "success");
    } catch (error) {
      console.error("Error deleting template:", error);
      addToast("Failed to delete template", "error");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Message Templates</DialogTitle>
          <DialogDescription>
            Pre-written messages with variables. Use: {"{{customer_name}}"}, {"{{job_date}}"}, {"{{job_time}}"}, {"{{job_address}}"}, {"{{amount}}"}, {"{{invoice_link}}"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {!showCreateForm && (
            <Button
              onClick={() => setShowCreateForm(true)}
              className="w-full"
              variant="outline"
            >
              <Plus className="mr-2 h-4 w-4" />
              Create New Template
            </Button>
          )}

          {showCreateForm && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="templateName">Template Name *</Label>
                  <Input
                    id="templateName"
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                    placeholder="e.g., Job Scheduled"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="templateType">Type *</Label>
                  <Select
                    id="templateType"
                    value={templateType}
                    onChange={(e) => setTemplateType(e.target.value as "sms" | "email")}
                  >
                    <option value="sms">SMS</option>
                    <option value="email">Email</option>
                  </Select>
                </div>
              </div>
              {templateType === "email" && (
                <div className="space-y-2">
                  <Label htmlFor="templateSubject">Subject</Label>
                  <Input
                    id="templateSubject"
                    value={templateSubject}
                    onChange={(e) => setTemplateSubject(e.target.value)}
                    placeholder="Email subject..."
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="templateBody">Message *</Label>
                <Textarea
                  id="templateBody"
                  value={templateBody}
                  onChange={(e) => setTemplateBody(e.target.value)}
                  placeholder="Hey {{customer_name}} — just a reminder..."
                  rows={4}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleSaveTemplate} disabled={!templateName.trim() || !templateBody.trim()}>
                  Save Template
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowCreateForm(false);
                    setTemplateName("");
                    setTemplateBody("");
                    setTemplateSubject("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}

          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Loading templates...
            </div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="mx-auto h-8 w-8 mb-2 opacity-50" />
              <p>No templates yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {templates.map((template) => {
                const preview = replaceVariables(template.body);
                return (
                  <div
                    key={template.id}
                    className="rounded-lg border p-4 space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{template.name}</h4>
                          <span className="text-xs px-2 py-0.5 rounded bg-muted">
                            {template.type.toUpperCase()}
                          </span>
                        </div>
                        {template.type === "email" && template.subject && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Subject: {replaceVariables(template.subject)}
                          </p>
                        )}
                        <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                          {preview}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteTemplate(template.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCopyMessage(template)}
                        className="flex-1"
                      >
                        <Copy className="mr-2 h-4 w-4" />
                        Copy
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleSendMessage(template)}
                        className="flex-1"
                        disabled={template.type === "sms" && !customer?.phone || template.type === "email" && !customer?.email}
                      >
                        {template.type === "sms" ? (
                          <>
                            <Send className="mr-2 h-4 w-4" />
                            Send SMS
                          </>
                        ) : (
                          <>
                            <Mail className="mr-2 h-4 w-4" />
                            Send Email
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
