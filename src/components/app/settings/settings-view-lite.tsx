"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Company, EstimatingConfig } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { Building, Calculator, Palette, Check } from "lucide-react";
import { THEMES, type ThemeId } from "@/lib/utils";

interface SettingsViewLiteProps {
  company: Company;
  config: EstimatingConfig | null;
}

export function SettingsViewLite({
  company: initialCompany,
  config: initialConfig,
}: SettingsViewLiteProps) {
  const router = useRouter();
  const { addToast } = useToast();
  const supabase = createClient();

  const [company, setCompany] = useState(initialCompany);
  const [config, setConfig] = useState(initialConfig);

  // Company form
  const [companyName, setCompanyName] = useState(company.name);
  const [logoUrl, setLogoUrl] = useState((company as any).logo_url || "");
  const [contactPhone, setContactPhone] = useState((company as any).contact_phone || "");
  const [contactEmail, setContactEmail] = useState((company as any).contact_email || "");
  const [selectedTheme, setSelectedTheme] = useState<ThemeId>(
    (company.theme_id as ThemeId) || "agreeable-gray"
  );
  const [savingCompany, setSavingCompany] = useState(false);

  // Config form - simplified to just walls rate
  const [wallsRate, setWallsRate] = useState(
    config?.walls_rate_per_sqft?.toString() || "2.00"
  );
  const [savingConfig, setSavingConfig] = useState(false);

  async function handleSaveCompany() {
    setSavingCompany(true);
    try {
      const response = await fetch(`/api/companies/${company.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: companyName.trim(),
          theme_id: selectedTheme,
          logo_url: logoUrl.trim() || null,
          contact_phone: contactPhone.trim() || null,
          contact_email: contactEmail.trim() || null,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save settings");
      }

      const updatedCompany = await response.json();

      setCompany((prev) => ({
        ...prev,
        name: updatedCompany.name,
        theme_id: updatedCompany.theme_id,
      }));

      // Apply theme immediately
      document.documentElement.setAttribute("data-theme", selectedTheme);

      addToast("Settings saved!", "success");
      router.refresh();
    } catch (error) {
      console.error("Error saving company:", error);
      addToast("Failed to save settings", "error");
    } finally {
      setSavingCompany(false);
    }
  }

  async function handleSaveConfig() {
    setSavingConfig(true);
    try {
      const rate = parseFloat(wallsRate) || 2.0;
      const configData = {
        company_id: company.id,
        walls_rate_per_sqft: rate,
        ceilings_rate_per_sqft: rate * 0.25, // Auto-calculate others
        trim_rate_per_sqft: rate * 0.375,
        labor_rate_per_hour: config?.labor_rate_per_hour ?? null,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from("estimating_config")
        .upsert(configData, { onConflict: "company_id" });

      if (error) throw error;

      setConfig(configData);
      addToast("Rate saved!", "success");
    } catch {
      addToast("Failed to save rate", "error");
    } finally {
      setSavingConfig(false);
    }
  }

  return (
    <div className="min-h-screen pb-20 lg:pb-0">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <h1 className="text-2xl font-bold">Settings</h1>
      </div>

      <div className="max-w-lg mx-auto p-4 space-y-6">
        {/* Company Info */}
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Building className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Company Information</h3>
          </div>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="Your company name"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="logoUrl">Logo URL (optional)</Label>
              <Input
                id="logoUrl"
                type="url"
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://example.com/logo.png"
              />
              <p className="text-xs text-muted-foreground">
                Upload your logo to a service like Imgur and paste the URL here
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="contactPhone">Contact Phone</Label>
                <Input
                  id="contactPhone"
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="(555) 123-4567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="contactEmail">Contact Email</Label>
                <Input
                  id="contactEmail"
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="contact@company.com"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Theme Selection */}
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Palette className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Theme</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Choose a Sherwin-Williams inspired color theme.
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {THEMES.map((theme) => (
              <button
                key={theme.id}
                type="button"
                onClick={() => setSelectedTheme(theme.id)}
                className={`relative rounded-lg border-2 p-3 text-left transition-all overflow-hidden ${
                  selectedTheme === theme.id
                    ? "border-primary ring-2 ring-primary"
                    : "hover:border-muted-foreground border-border"
                }`}
              >
                {/* Background preview */}
                <div
                  className="absolute inset-0 opacity-20"
                  style={{ backgroundColor: (theme as any).bgColor || (theme as any).color }}
                />
                {/* Primary color swatch */}
                <div className="relative">
                  <div className="flex gap-2 mb-2">
                    <div
                      className="h-8 flex-1 rounded"
                      style={{ backgroundColor: theme.color }}
                    />
                    {theme.bgColor && (
                      <div
                        className="h-8 w-8 rounded border border-border/50"
                        style={{ backgroundColor: theme.bgColor }}
                      />
                    )}
                  </div>
                  <p className="text-xs font-medium truncate relative z-10">{theme.name}</p>
                </div>
                {selectedTheme === theme.id && (
                  <Check className="absolute top-2 right-2 h-4 w-4 text-primary z-10" />
                )}
              </button>
            ))}
          </div>
          <Button onClick={handleSaveCompany} loading={savingCompany}>
            Save Company Settings
          </Button>
        </div>

        {/* Estimating Rate */}
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Estimating Rate</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Your price per square foot for estimates.
          </p>
          <div className="space-y-2">
            <Label htmlFor="rate">Rate ($/sqft)</Label>
            <div className="relative max-w-[120px]">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                id="rate"
                type="number"
                step="0.25"
                min="0"
                className="pl-7"
                value={wallsRate}
                onChange={(e) => setWallsRate(e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Example: 2000 sqft × ${wallsRate}/sqft = ${(2000 * parseFloat(wallsRate || "0")).toLocaleString()}
            </p>
          </div>
          <Button onClick={handleSaveConfig} loading={savingConfig}>
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}
