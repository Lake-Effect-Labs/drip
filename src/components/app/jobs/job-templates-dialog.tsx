"use client";

import { useState, useEffect } from "react";
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
import { useToast } from "@/components/ui/toast";
import { Plus, FileText, Trash2 } from "lucide-react";
import type { Job } from "@/types/database";

interface JobTemplate {
  id: string;
  name: string;
  description: string | null;
  default_materials: string[];
  default_notes: string | null;
}

interface JobTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  job?: Job & { materials?: { name: string }[] };
  onSelectTemplate: (template: JobTemplate) => void;
}

export function JobTemplatesDialog({
  open,
  onOpenChange,
  companyId,
  job,
  onSelectTemplate,
}: JobTemplatesDialogProps) {
  const [templates, setTemplates] = useState<JobTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
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
      // job_templates table may not exist, so use optional query
      const { data, error } = await supabase
        .from("job_templates" as any)
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      if (error || !data || Array.isArray(data) === false) {
        // Table doesn't exist or error, use empty array
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

  async function handleSaveTemplate() {
    if (!templateName.trim() || !job) {
      addToast("Please enter a template name", "error");
      return;
    }

    setSaving(true);
    try {
      const { data, error } = await supabase
        .from("job_templates" as any)
        .insert({
          company_id: companyId,
          name: templateName.trim(),
          description: templateDescription.trim() || null,
          default_materials: job.materials?.map((m) => m.name) || [],
          default_notes: job.notes || null,
        })
        .select()
        .single();

      if (error) throw error;

      setTemplates((prev) => [(data as any), ...prev]);
      setTemplateName("");
      setTemplateDescription("");
      setShowSaveForm(false);
      addToast("Template saved!", "success");
    } catch (error) {
      console.error("Error saving template:", error);
      addToast("Failed to save template", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteTemplate(templateId: string) {
    try {
      const { error } = await supabase
        .from("job_templates" as any)
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
          <DialogTitle>Job Templates</DialogTitle>
          <DialogDescription>
            Save job configurations as templates for quick reuse
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {job && !showSaveForm && (
            <Button
              onClick={() => setShowSaveForm(true)}
              className="w-full"
              variant="outline"
            >
              <Plus className="mr-2 h-4 w-4" />
              Save Current Job as Template
            </Button>
          )}

          {showSaveForm && job && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="space-y-2">
                <Label htmlFor="templateName">Template Name *</Label>
                <Input
                  id="templateName"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  placeholder="e.g., Interior Paint - 2BR"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="templateDescription">Description</Label>
                <Textarea
                  id="templateDescription"
                  value={templateDescription}
                  onChange={(e) => setTemplateDescription(e.target.value)}
                  placeholder="Optional description..."
                  rows={2}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveTemplate}
                  loading={saving}
                  disabled={!templateName.trim()}
                >
                  Save Template
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowSaveForm(false);
                    setTemplateName("");
                    setTemplateDescription("");
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
              {templates.map((template) => (
                <div
                  key={template.id}
                  className="flex items-start justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1">
                    <h4 className="font-medium">{template.name}</h4>
                    {template.description && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {template.description}
                      </p>
                    )}
                    {template.default_materials.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {template.default_materials.length} default materials
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        onSelectTemplate(template);
                        onOpenChange(false);
                      }}
                    >
                      Use
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteTemplate(template.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
