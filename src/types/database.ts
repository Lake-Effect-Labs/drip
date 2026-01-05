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
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          theme_id?: string;
          owner_user_id: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          theme_id?: string;
          owner_user_id?: string;
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
          assigned_user_id: string | null;
          notes: string | null;
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
          assigned_user_id?: string | null;
          notes?: string | null;
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
          assigned_user_id?: string | null;
          notes?: string | null;
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
          public_token: string;
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
          public_token: string;
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
          public_token?: string;
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
      invoices: {
        Row: {
          id: string;
          company_id: string;
          job_id: string;
          customer_id: string;
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
          updated_at: string;
        };
        Insert: {
          company_id: string;
          walls_rate_per_sqft?: number;
          ceilings_rate_per_sqft?: number;
          trim_rate_per_sqft?: number;
          updated_at?: string;
        };
        Update: {
          company_id?: string;
          walls_rate_per_sqft?: number;
          ceilings_rate_per_sqft?: number;
          trim_rate_per_sqft?: number;
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
export type Invoice = Tables<"invoices">;
export type InvoicePayment = Tables<"invoice_payments">;
export type EstimatingConfig = Tables<"estimating_config">;
export type PickupLocation = Tables<"pickup_locations">;
export type InventoryItem = Tables<"inventory_items">;
export type JobMaterial = Tables<"job_materials">;
export type UserProfile = Tables<"user_profiles">;

// Extended types with relations
export type JobWithCustomer = Job & {
  customer: Customer | null;
};

export type EstimateWithLineItems = Estimate & {
  line_items: EstimateLineItem[];
  customer: Customer | null;
  job: Job | null;
};

export type InvoiceWithDetails = Invoice & {
  customer: Customer;
  job: Job;
  payments: InvoicePayment[];
};
