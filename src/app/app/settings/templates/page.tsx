"use client";

import { useEffect, useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Save, X, MessageSquare } from "lucide-react";
import Link from "next/link";

interface Template {
  id: string;
  name: string;
  type: string;
  subject: string | null;
  body: string;
  variables: string[];
  created_at: string;
}

const AVAILABLE_VARIABLES = [
  { name: "customer_name", description: "Customer's name" },
  { name: "job_date", description: "Scheduled job date" },
  { name: "job_time", description: "Scheduled job time" },
  { name: "job_address", description: "Job address" },
  { name: "amount", description: "Payment amount" },
  { name: "invoice_link", description: "Invoice URL" },
  { name: "estimate_link", description: "Estimate URL" },
  { name: "company_name", description: "Your company name" },
];

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBody, setEditBody] = useState("");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newBody, setNewBody] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/message-templates");
      const json = await res.json();
      if (Array.isArray(json)) {
        setTemplates(json);
      }
    } catch {
      setError("Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const startEdit = (template: Template) => {
    setEditing(template.id);
    setEditName(template.name);
    setEditBody(template.body);
    setError("");
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditName("");
    setEditBody("");
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/message-templates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: editing, name: editName, body: editBody }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error || "Failed to save");
      } else {
        await fetchTemplates();
        cancelEdit();
      }
    } catch {
      setError("Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  const createTemplate = async () => {
    if (!newName.trim() || !newBody.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/message-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, body: newBody }),
      });
      if (!res.ok) {
        const json = await res.json();
        setError(json.error || "Failed to create");
      } else {
        await fetchTemplates();
        setCreating(false);
        setNewName("");
        setNewBody("");
      }
    } catch {
      setError("Failed to create template");
    } finally {
      setSaving(false);
    }
  };

  const insertVariable = (variable: string, target: "edit" | "new") => {
    const tag = `{{${variable}}}`;
    if (target === "edit") {
      setEditBody((prev) => prev + tag);
    } else {
      setNewBody((prev) => prev + tag);
    }
  };

  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{\{(\w+)\}\}/g);
    return matches ? [...new Set(matches.map((m) => m.replace(/\{\{|\}\}/g, "")))] : [];
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-48" />
          <div className="h-32 bg-muted rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Link href="/app/settings">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Settings
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Message Templates</h1>
          <p className="text-muted-foreground">
            Customize the messages sent to your customers
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 bg-destructive/10 text-destructive rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Template list */}
      <div className="space-y-4">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  {editing === template.id ? (
                    <Input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="h-8 w-64"
                    />
                  ) : (
                    <CardTitle className="text-base">{template.name}</CardTitle>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{template.type}</Badge>
                  {editing === template.id ? (
                    <>
                      <Button size="sm" onClick={saveEdit} disabled={saving}>
                        <Save className="h-3 w-3 mr-1" />
                        {saving ? "Saving..." : "Save"}
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEdit}>
                        <X className="h-3 w-3" />
                      </Button>
                    </>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => startEdit(template)}>
                      Edit
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {editing === template.id ? (
                <div className="space-y-3">
                  <Textarea
                    value={editBody}
                    onChange={(e) => setEditBody(e.target.value)}
                    rows={4}
                    className="font-mono text-sm"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs text-muted-foreground mr-1">Insert:</span>
                    {AVAILABLE_VARIABLES.map((v) => (
                      <button
                        key={v.name}
                        onClick={() => insertVariable(v.name, "edit")}
                        className="text-xs px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground"
                        title={v.description}
                      >
                        {`{{${v.name}}}`}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-sm whitespace-pre-wrap">{template.body}</p>
                  {template.variables.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {template.variables.map((v) => (
                        <Badge key={v} variant="outline" className="text-xs">
                          {v}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add new template */}
      {creating ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">New Template</CardTitle>
            <CardDescription>Create a custom message template</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Template name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <Textarea
              placeholder="Message body — use {{variable_name}} for dynamic values"
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              rows={4}
              className="font-mono text-sm"
            />
            <div className="flex flex-wrap gap-1.5">
              <span className="text-xs text-muted-foreground mr-1">Insert:</span>
              {AVAILABLE_VARIABLES.map((v) => (
                <button
                  key={v.name}
                  onClick={() => insertVariable(v.name, "new")}
                  className="text-xs px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-muted-foreground"
                  title={v.description}
                >
                  {`{{${v.name}}}`}
                </button>
              ))}
            </div>
            {newBody && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs font-medium mb-1">Preview:</p>
                <p className="text-sm">
                  {newBody.replace(/\{\{(\w+)\}\}/g, (_, key) => {
                    const sampleData: Record<string, string> = {
                      customer_name: "John Smith",
                      job_date: "March 15",
                      job_time: "9:00 AM",
                      job_address: "123 Main St",
                      amount: "$2,500",
                      invoice_link: "https://...",
                      estimate_link: "https://...",
                      company_name: "Your Company",
                    };
                    return sampleData[key] || `{{${key}}}`;
                  })}
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <Button onClick={createTemplate} disabled={saving || !newName.trim() || !newBody.trim()}>
                {saving ? "Creating..." : "Create Template"}
              </Button>
              <Button variant="outline" onClick={() => { setCreating(false); setNewName(""); setNewBody(""); }}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Button variant="outline" onClick={() => setCreating(true)} className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          Add Custom Template
        </Button>
      )}

      {/* Variables reference */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Available Variables</CardTitle>
          <CardDescription>
            Use these in your templates with double curly braces
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {AVAILABLE_VARIABLES.map((v) => (
              <div key={v.name} className="flex items-center gap-2 text-sm">
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs">
                  {`{{${v.name}}}`}
                </code>
                <span className="text-muted-foreground">{v.description}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
