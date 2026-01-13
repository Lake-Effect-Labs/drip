export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      companies: {
        Row: {
          id: string;
          name: string;
          theme_id: string;
          owner_user_id: string;
          stripe_account_id: string | null;
          stripe_enabled: boolean;
          stripe_onboarding_complete: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          theme_id?: string;
          owner_user_id: string;
          stripe_account_id?: string | null;
          stripe_enabled?: boolean;
          stripe_onboarding_complete?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          theme_id?: string;
          owner_user_id?: string;
          stripe_account_id?: string | null;
          stripe_enabled?: boolean;
          stripe_onboarding_complete?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      company_users: {
        Row: {
          id: string;
          company_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          user_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      invite_links: {
        Row: {
          id: string;
          company_id: string;
          token: string;
          expires_at: string;
          created_by_user_id: string;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          token: string;
          expires_at: string;
          created_by_user_id: string;
          revoked_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          token?: string;
          expires_at?: string;
          created_by_user_id?: string;
          revoked_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      customers: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          phone: string | null;
          email: string | null;
          address1: string | null;
          address2: string | null;
          city: string | null;
          state: string | null;
          zip: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          phone?: string | null;
          email?: string | null;
          address1?: string | null;
          address2?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          phone?: string | null;
          email?: string | null;
          address1?: string | null;
          address2?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      jobs: {
        Row: {
          id: string;
          company_id: string;
          customer_id: string | null;
          title: string;
          address1: string | null;
          address2: string | null;
          city: string | null;
          state: string | null;
          zip: string | null;
          status: string;
          scheduled_date: string | null;
          scheduled_time: string | null;
          schedule_state: string | null;
          schedule_token: string | null;
          schedule_accepted_at: string | null;
          assigned_user_id: string | null;
          notes: string | null;
          is_outdoor: boolean;
          pickup_location_id: string | null;
          payment_state: string;
          payment_amount: number | null;
          payment_approved_at: string | null;
          payment_paid_at: string | null;
          payment_method: string | null;
          payment_token: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          customer_id?: string | null;
          title: string;
          address1?: string | null;
          address2?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          status?: string;
          scheduled_date?: string | null;
          scheduled_time?: string | null;
          schedule_state?: string | null;
          schedule_token?: string | null;
          schedule_accepted_at?: string | null;
          assigned_user_id?: string | null;
          notes?: string | null;
          is_outdoor?: boolean;
          pickup_location_id?: string | null;
          payment_state?: string;
          payment_amount?: number | null;
          payment_approved_at?: string | null;
          payment_paid_at?: string | null;
          payment_method?: string | null;
          payment_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          customer_id?: string | null;
          title?: string;
          address1?: string | null;
          address2?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          status?: string;
          scheduled_date?: string | null;
          scheduled_time?: string | null;
          schedule_state?: string | null;
          schedule_token?: string | null;
          schedule_accepted_at?: string | null;
          assigned_user_id?: string | null;
          notes?: string | null;
          is_outdoor?: boolean;
          pickup_location_id?: string | null;
          payment_state?: string;
          payment_amount?: number | null;
          payment_approved_at?: string | null;
          payment_paid_at?: string | null;
          payment_method?: string | null;
          payment_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      estimates: {
        Row: {
          id: string;
          company_id: string;
          job_id: string | null;
          customer_id: string | null;
          sqft: number | null;
          status: string;
          accepted_at: string | null;
          denied_at: string | null;
          denial_reason: string | null;
          sent_at: string | null;
          expires_at: string | null;
          hourly_rate: number | null;
          public_token: string;
          labor_total: number;
          materials_total: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          job_id?: string | null;
          customer_id?: string | null;
          sqft?: number | null;
          status?: string;
          accepted_at?: string | null;
          denied_at?: string | null;
          denial_reason?: string | null;
          sent_at?: string | null;
          expires_at?: string | null;
          hourly_rate?: number | null;
          public_token: string;
          labor_total?: number;
          materials_total?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          job_id?: string | null;
          customer_id?: string | null;
          sqft?: number | null;
          status?: string;
          accepted_at?: string | null;
          denied_at?: string | null;
          denial_reason?: string | null;
          sent_at?: string | null;
          expires_at?: string | null;
          hourly_rate?: number | null;
          public_token?: string;
          labor_total?: number;
          materials_total?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      estimate_line_items: {
        Row: {
          id: string;
          estimate_id: string;
          service_key: string;
          service_type: string;
          name: string;
          description: string | null;
          price: number;
          paint_color_name_or_code: string | null;
          sheen: string | null;
          product_line: string | null;
          gallons_estimate: number | null;
          vendor_sku: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          estimate_id: string;
          service_key: string;
          service_type: string;
          name: string;
          description?: string | null;
          price: number;
          paint_color_name_or_code?: string | null;
          sheen?: string | null;
          product_line?: string | null;
          gallons_estimate?: number | null;
          vendor_sku?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          estimate_id?: string;
          service_key?: string;
          service_type?: string;
          name?: string;
          description?: string | null;
          price?: number;
          paint_color_name_or_code?: string | null;
          sheen?: string | null;
          product_line?: string | null;
          gallons_estimate?: number | null;
          vendor_sku?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      estimate_materials: {
        Row: {
          id: string;
          estimate_id: string;
          name: string;
          paint_product: string | null;
          product_line: string | null;
          color_name: string | null;
          color_code: string | null;
          sheen: string | null;
          area_description: string | null;
          quantity_gallons: number | null;
          cost_per_gallon: number | null;
          line_total: number | null;
          estimate_line_item_id: string | null;
          vendor_sku: string | null;
          notes: string | null;
          is_auto_generated: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          estimate_id: string;
          name: string;
          paint_product?: string | null;
          product_line?: string | null;
          color_name?: string | null;
          color_code?: string | null;
          sheen?: string | null;
          area_description?: string | null;
          quantity_gallons?: number | null;
          cost_per_gallon?: number | null;
          line_total?: number | null;
          estimate_line_item_id?: string | null;
          vendor_sku?: string | null;
          notes?: string | null;
          is_auto_generated?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          estimate_id?: string;
          name?: string;
          paint_product?: string | null;
          product_line?: string | null;
          color_name?: string | null;
          color_code?: string | null;
          sheen?: string | null;
          area_description?: string | null;
          quantity_gallons?: number | null;
          cost_per_gallon?: number | null;
          line_total?: number | null;
          estimate_line_item_id?: string | null;
          vendor_sku?: string | null;
          notes?: string | null;
          is_auto_generated?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          company_id: string;
          job_id: string;
          customer_id: string;
          estimate_id: string | null;
          status: string;
          public_token: string;
          stripe_checkout_session_id: string | null;
          stripe_checkout_url: string | null;
          amount_total: number;
          created_at: string;
          updated_at: string;
          paid_at: string | null;
        };
        Insert: {
          id?: string;
          company_id: string;
          job_id: string;
          customer_id: string;
          estimate_id?: string | null;
          status?: string;
          public_token: string;
          stripe_checkout_session_id?: string | null;
          stripe_checkout_url?: string | null;
          amount_total: number;
          created_at?: string;
          updated_at?: string;
          paid_at?: string | null;
        };
        Update: {
          id?: string;
          company_id?: string;
          job_id?: string;
          customer_id?: string;
          estimate_id?: string | null;
          status?: string;
          public_token?: string;
          stripe_checkout_session_id?: string | null;
          stripe_checkout_url?: string | null;
          amount_total?: number;
          created_at?: string;
          updated_at?: string;
          paid_at?: string | null;
        };
        Relationships: [];
      };
      invoice_payments: {
        Row: {
          id: string;
          invoice_id: string;
          stripe_payment_intent_id: string;
          amount: number;
          paid_at: string;
        };
        Insert: {
          id?: string;
          invoice_id: string;
          stripe_payment_intent_id: string;
          amount: number;
          paid_at?: string;
        };
        Update: {
          id?: string;
          invoice_id?: string;
          stripe_payment_intent_id?: string;
          amount?: number;
          paid_at?: string;
        };
        Relationships: [];
      };
      estimating_config: {
        Row: {
          company_id: string;
          walls_rate_per_sqft: number;
          ceilings_rate_per_sqft: number;
          trim_rate_per_sqft: number;
          labor_rate_per_hour: number | null;
          updated_at: string;
        };
        Insert: {
          company_id: string;
          walls_rate_per_sqft?: number;
          ceilings_rate_per_sqft?: number;
          trim_rate_per_sqft?: number;
          labor_rate_per_hour?: number | null;
          updated_at?: string;
        };
        Update: {
          company_id?: string;
          walls_rate_per_sqft?: number;
          ceilings_rate_per_sqft?: number;
          trim_rate_per_sqft?: number;
          labor_rate_per_hour?: number | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      pickup_locations: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          address1: string | null;
          address2: string | null;
          city: string | null;
          state: string | null;
          zip: string | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          address1?: string | null;
          address2?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          address1?: string | null;
          address2?: string | null;
          city?: string | null;
          state?: string | null;
          zip?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      inventory_items: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          unit: string;
          on_hand: number;
          reorder_at: number;
          cost_per_unit: number | null;
          vendor_name: string | null;
          vendor_sku: string | null;
          preferred_pickup_location_id: string | null;
          category: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          unit: string;
          on_hand?: number;
          reorder_at?: number;
          cost_per_unit?: number | null;
          vendor_name?: string | null;
          vendor_sku?: string | null;
          preferred_pickup_location_id?: string | null;
          category?: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          unit?: string;
          on_hand?: number;
          reorder_at?: number;
          cost_per_unit?: number | null;
          vendor_name?: string | null;
          vendor_sku?: string | null;
          preferred_pickup_location_id?: string | null;
          category?: string;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      job_materials: {
        Row: {
          id: string;
          job_id: string;
          name: string;
          checked: boolean;
          inventory_item_id: string | null;
          vendor_sku: string | null;
          notes: string | null;
          cost_per_unit: number | null;
          quantity_decimal: number | null;
          unit: string | null;
          purchased_at: string | null;
          consumed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          name: string;
          checked?: boolean;
          inventory_item_id?: string | null;
          vendor_sku?: string | null;
          notes?: string | null;
          cost_per_unit?: number | null;
          quantity_decimal?: number | null;
          unit?: string | null;
          purchased_at?: string | null;
          consumed_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          name?: string;
          checked?: boolean;
          inventory_item_id?: string | null;
          vendor_sku?: string | null;
          notes?: string | null;
          cost_per_unit?: number | null;
          quantity_decimal?: number | null;
          unit?: string | null;
          purchased_at?: string | null;
          consumed_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      user_profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      job_templates: {
        Row: {
          id: string;
          company_id: string;
          name: string;
          description: string | null;
          notes: string | null;
          estimated_hours: number | null;
          created_by_user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          company_id: string;
          name: string;
          description?: string | null;
          notes?: string | null;
          estimated_hours?: number | null;
          created_by_user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          company_id?: string;
          name?: string;
          description?: string | null;
          notes?: string | null;
          estimated_hours?: number | null;
          created_by_user_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      template_materials: {
        Row: {
          id: string;
          template_id: string;
          name: string;
          quantity: string | null;
          notes: string | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          template_id: string;
          name: string;
          quantity?: string | null;
          notes?: string | null;
          sort_order?: number;
        };
        Update: {
          id?: string;
          template_id?: string;
          name?: string;
          quantity?: string | null;
          notes?: string | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      template_estimate_items: {
        Row: {
          id: string;
          template_id: string;
          service_type: string | null;
          name: string | null;
          description: string | null;
          sort_order: number;
        };
        Insert: {
          id?: string;
          template_id: string;
          service_type?: string | null;
          name?: string | null;
          description?: string | null;
          sort_order?: number;
        };
        Update: {
          id?: string;
          template_id?: string;
          service_type?: string | null;
          name?: string | null;
          description?: string | null;
          sort_order?: number;
        };
        Relationships: [];
      };
      job_photos: {
        Row: {
          id: string;
          job_id: string;
          company_id: string;
          storage_path: string;
          public_url: string;
          thumbnail_url: string | null;
          file_name: string | null;
          file_size_bytes: number | null;
          mime_type: string | null;
          tag: "before" | "after" | "other" | null;
          caption: string | null;
          uploaded_by_user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          company_id: string;
          storage_path: string;
          public_url: string;
          thumbnail_url?: string | null;
          file_name?: string | null;
          file_size_bytes?: number | null;
          mime_type?: string | null;
          tag?: "before" | "after" | "other" | null;
          caption?: string | null;
          uploaded_by_user_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          company_id?: string;
          storage_path?: string;
          public_url?: string;
          thumbnail_url?: string | null;
          file_name?: string | null;
          file_size_bytes?: number | null;
          mime_type?: string | null;
          tag?: "before" | "after" | "other" | null;
          caption?: string | null;
          uploaded_by_user_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      time_entries: {
        Row: {
          id: string;
          job_id: string;
          company_id: string;
          user_id: string | null;
          user_name: string | null;
          started_at: string;
          ended_at: string | null;
          duration_seconds: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          company_id: string;
          user_id?: string | null;
          user_name?: string | null;
          started_at: string;
          ended_at?: string | null;
          duration_seconds?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          company_id?: string;
          user_id?: string | null;
          user_name?: string | null;
          started_at?: string;
          ended_at?: string | null;
          duration_seconds?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      job_payment_line_items: {
        Row: {
          id: string;
          job_id: string;
          title: string;
          price: number;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          job_id: string;
          title: string;
          price: number;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          job_id?: string;
          title?: string;
          price?: number;
          sort_order?: number;
          created_at?: string;
        };
        Relationships: [];
      };
      job_payment_revisions: {
        Row: {
          id: string;
          job_id: string;
          previous_amount: number;
          new_amount: number;
          revision_reason: string | null;
          created_at: string;
          created_by_user_id: string | null;
        };
        Insert: {
          id?: string;
          job_id: string;
          previous_amount: number;
          new_amount: number;
          revision_reason?: string | null;
          created_at?: string;
          created_by_user_id?: string | null;
        };
        Update: {
          id?: string;
          job_id?: string;
          previous_amount?: number;
          new_amount?: number;
          revision_reason?: string | null;
          created_at?: string;
          created_by_user_id?: string | null;
        };
        Relationships: [];
      };
      nudge_dismissals: {
        Row: {
          id: string;
          user_id: string;
          company_id: string;
          nudge_type: string;
          dismissed_at: string;
          expires_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          company_id: string;
          nudge_type: string;
          dismissed_at?: string;
          expires_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          company_id?: string;
          nudge_type?: string;
          dismissed_at?: string;
          expires_at?: string | null;
        };
        Relationships: [];
      };
      customer_tags: {
        Row: {
          id: string;
          customer_id: string;
          company_id: string;
          tag: string;
          created_at: string;
          created_by_user_id: string | null;
        };
        Insert: {
          id?: string;
          customer_id: string;
          company_id: string;
          tag: string;
          created_at?: string;
          created_by_user_id?: string | null;
        };
        Update: {
          id?: string;
          customer_id?: string;
          company_id?: string;
          tag?: string;
          created_at?: string;
          created_by_user_id?: string | null;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      get_user_company_id: {
        Args: Record<string, never>;
        Returns: string | null;
      };
      create_company_with_owner: {
        Args: {
          company_name: string;
          owner_id: string;
          owner_email: string;
          owner_name: string;
        };
        Returns: string;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Helper types
export type Tables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Row"];
export type InsertTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Insert"];
export type UpdateTables<T extends keyof Database["public"]["Tables"]> =
  Database["public"]["Tables"][T]["Update"];

// Commonly used types
export type Company = Tables<"companies">;
export type CompanyUser = Tables<"company_users">;
export type InviteLink = Tables<"invite_links">;
export type Customer = Tables<"customers">;
export type Job = Tables<"jobs">;
export type Estimate = Tables<"estimates">;
export type EstimateLineItem = Tables<"estimate_line_items">;
export type EstimateMaterial = Tables<"estimate_materials">;
export type Invoice = Tables<"invoices">;
export type InvoicePayment = Tables<"invoice_payments">;
export type EstimatingConfig = Tables<"estimating_config">;
export type PickupLocation = Tables<"pickup_locations">;
export type InventoryItem = Tables<"inventory_items">;
export type JobMaterial = Tables<"job_materials">;
export type UserProfile = Tables<"user_profiles">;
export type JobTemplate = Tables<"job_templates">;
export type TemplateMaterial = Tables<"template_materials">;
export type TemplateEstimateItem = Tables<"template_estimate_items">;
export type JobPhoto = Tables<"job_photos">;
export type TimeEntry = Tables<"time_entries">;
export type JobPaymentLineItem = Tables<"job_payment_line_items">;
export type JobPaymentRevision = Tables<"job_payment_revisions">;
export type NudgeDismissal = Tables<"nudge_dismissals">;
export type CustomerTag = Tables<"customer_tags">;

// Extended types with relations
export type JobWithCustomer = Job & {
  customer: Customer | null;
};

export type EstimateWithLineItems = Estimate & {
  line_items: EstimateLineItem[];
  materials: EstimateMaterial[];
  customer: Customer | null;
  job: Job | null;
};

export type InvoiceWithDetails = Invoice & {
  customer: Customer;
  job: Job;
  payments: InvoicePayment[];
};

export type JobTemplateWithRelations = JobTemplate & {
  template_materials: TemplateMaterial[];
  template_estimate_items: TemplateEstimateItem[];
};
