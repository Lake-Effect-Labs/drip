import { createClient } from "@/lib/supabase/server";
import { InventoryView } from "@/components/app/inventory/inventory-view";

export default async function InventoryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Get company ID
  const { data: companyUser } = await supabase
    .from("company_users")
    .select("company_id")
    .eq("user_id", user.id)
    .single();

  if (!companyUser) return null;

  // Fetch inventory items
  const { data: itemsData } = await supabase
    .from("inventory_items")
    .select("*")
    .eq("company_id", companyUser.company_id)
    .order("name");

  // Fetch pickup locations
  const { data: locations } = await supabase
    .from("pickup_locations")
    .select("*")
    .eq("company_id", companyUser.company_id)
    .order("name");

  // Map pickup locations to items
  const locationMap = new Map(locations?.map((l) => [l.id, l]) || []);
  const items = (itemsData || []).map((item) => ({
    ...item,
    pickup_location: item.preferred_pickup_location_id
      ? locationMap.get(item.preferred_pickup_location_id) || null
      : null,
  }));

  return (
    <InventoryView
      initialItems={items}
      pickupLocations={locations || []}
      companyId={companyUser.company_id}
    />
  );
}

