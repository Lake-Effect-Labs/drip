"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Company, EstimatingConfig } from "@/types/database";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import { Building, Calculator } from "lucide-react";

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
  const [savingCompany, setSavingCompany] = useState(false);

  // Config form - simplified to just walls rate
  const [wallsRate, setWallsRate] = useState(
    config?.walls_rate_per_sqft?.toString() || "2.00"
  );
  const [savingConfig, setSavingConfig] = useState(false);

  async function handleSaveCompany() {
    setSavingCompany(true);
    try {
      const { error } = await supabase
        .from("companies")
        .update({ name: companyName.trim() })
        .eq("id", company.id);

      if (error) throw error;

      setCompany((prev) => ({ ...prev, name: companyName.trim() }));
      addToast("Settings saved!", "success");
      router.refresh();
    } catch {
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
        {/* Company Name */}
        <div className="rounded-lg border bg-card p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Building className="h-5 w-5 text-muted-foreground" />
            <h3 className="font-semibold">Company Name</h3>
          </div>
          <div className="space-y-2">
            <Input
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="Your company name"
            />
          </div>
          <Button onClick={handleSaveCompany} loading={savingCompany}>
            Save
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
