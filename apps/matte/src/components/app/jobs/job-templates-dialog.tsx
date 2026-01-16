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
import { SimpleCheckbox } from "@/components/ui/checkbox";
import { useToast } from "@/components/ui/toast";
import { Save, Trash2 } from "lucide-react";
import type { JobTemplateWithRelations } from "@drip/core/types";

interface JobTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "save" | "manage";
  jobId?: string;
  companyId: string;
  onRefresh?: () => void;
}

export function JobTemplatesDialog({
  open,
  onOpenChange,
  mode,
  jobId,
  companyId,
  onRefresh,
}: JobTemplatesDialogProps) {
  const [loading, setLoading] = useState(false);
  const [templates, setTemplates] = useState<JobTemplateWithRelations[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeMaterials, setIncludeMaterials] = useState(true);
  const [includeEstimateStructure, setIncludeEstimateStructure] = useState(false);
  const { addToast } = useToast();
  const supabase = createClient();

  useEffect(() => {
    if (open && mode === "manage") {
      loadTemplates();
    }
  }, [open, mode]);

  async function loadTemplates() {
    try {
      const response = await fetch("/api/job-templates");
      if (!response.ok) throw new Error("Failed to load templates");
      const data = await response.json();
      setTemplates(data);
    } catch (error) {
      console.error("Error loading templates:", error);
      addToast("Failed to load templates", "error");
    }
  }

  async function handleSaveTemplate() {
    if (!templateName.trim()) {
      addToast("Please enter a template name", "error");
      return;
    }

    if (!jobId) {
      addToast("No job selected", "error");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/job-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          job_id: jobId,
          name: templateName.trim(),
          description: templateDescription.trim() || null,
          include_notes: includeNotes,
          include_materials: includeMaterials,
          include_estimate_structure: includeEstimateStructure,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to save template");
      }

      addToast("Template saved successfully!", "success");
      setTemplateName("");
      setTemplateDescription("");
      setIncludeNotes(true);
      setIncludeMaterials(true);
      setIncludeEstimateStructure(false);
      onOpenChange(false);
      onRefresh?.();
    } catch (error: any) {
      console.error("Error saving template:", error);
      addToast(error.message || "Failed to save template", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDeleteTemplate(templateId: string) {
    if (!confirm("Are you sure you want to delete this template?")) {
      return;
    }

    try {
      const response = await fetch(`/api/job-templates/${templateId}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Failed to delete template");

      addToast("Template deleted", "success");
      loadTemplates();
      onRefresh?.();
    } catch (error) {
      console.error("Error deleting template:", error);
      addToast("Failed to delete template", "error");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "save" ? "Save as Template" : "Manage Templates"}
          </DialogTitle>
          <DialogDescription>
            {mode === "save"
              ? "Create a reusable template from this job"
              : `Manage your job templates (${templates.length}/50)`}
          </DialogDescription>
        </DialogHeader>

        {mode === "save" ? (
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label htmlFor="templateName">Template Name *</Label>
              <Input
                id="templateName"
                placeholder="e.g., Standard Interior Repaint"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                autoFocus
                className="min-h-[44px]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="templateDescription">Description (Optional)</Label>
              <Textarea
                id="templateDescription"
                placeholder="Add details about when to use this template..."
                value={templateDescription}
                onChange={(e) => setTemplateDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-medium">What to include:</p>

              <div className="flex items-start gap-3">
                <SimpleCheckbox
                  id="includeNotes"
                  checked={includeNotes}
                  onChange={(e) => setIncludeNotes(e.target.checked)}
                />
                <div className="flex-1">
                  <Label htmlFor="includeNotes" className="cursor-pointer font-normal">
                    Notes
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Copy job notes to template
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <SimpleCheckbox
                  id="includeMaterials"
                  checked={includeMaterials}
                  onChange={(e) => setIncludeMaterials(e.target.checked)}
                />
                <div className="flex-1">
                  <Label htmlFor="includeMaterials" className="cursor-pointer font-normal">
                    Materials
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Save materials list for reuse
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <SimpleCheckbox
                  id="includeEstimateStructure"
                  checked={includeEstimateStructure}
                  onChange={(e) => setIncludeEstimateStructure(e.target.checked)}
                />
                <div className="flex-1">
                  <Label
                    htmlFor="includeEstimateStructure"
                    className="cursor-pointer font-normal"
                  >
                    Estimate Structure
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Save line item names (prices not included)
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button onClick={handleSaveTemplate} loading={loading}>
                <Save className="mr-2 h-4 w-4" />
                Save Template
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            {templates.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <p>No templates yet</p>
                <p className="text-sm mt-1">
                  Save your first template from a job detail page
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="rounded-lg border bg-card p-4 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1">
                        <h4 className="font-medium">{template.name}</h4>
                        {template.description && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {template.description}
                          </p>
                        )}
                        <div className="flex gap-4 mt-2 text-xs text-muted-foreground">
                          {template.template_materials && (
                            <span>{template.template_materials.length} materials</span>
                          )}
                          {template.template_estimate_items && (
                            <span>
                              {template.template_estimate_items.length} estimate items
                            </span>
                          )}
                          {template.notes && <span>Has notes</span>}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTemplate(template.id)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
