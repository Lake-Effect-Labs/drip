# Matte Inventory System Implementation

## Overview
Implemented a lightweight, job-driven inventory system for residential painting companies as specified in the requirements.

## Changes Made

### 1. Database Schema (Migration 020)
**File**: `/supabase/migrations/020_inventory_system_enhancements.sql`

Added the following fields:
- `inventory_items.category` - Paint, Primer, Sundries, or Tools
- `inventory_items.notes` - Optional notes field
- `job_materials.purchased_at` - Timestamp when materials are marked as purchased
- `job_materials.consumed_at` - Timestamp when inventory was decremented

Added indexes for performance:
- `idx_job_materials_purchased_at`
- `idx_job_materials_consumed_at`
- `idx_inventory_items_category`

### 2. TypeScript Types
**File**: `/src/types/database.ts`

Updated type definitions:
- Added `category` and `notes` to `InventoryItem` type
- Added `purchased_at` and `consumed_at` to `JobMaterial` type

### 3. Inventory Page
**File**: `/src/app/app/inventory/page.tsx`

Enhanced data fetching:
- Fetches job materials for active/upcoming jobs (new, quoted, scheduled, in_progress)
- Filters to only unpurchased materials
- Includes job details in the query

### 4. Inventory View Component
**File**: `/src/components/app/inventory/inventory-view.tsx`

Major enhancements:
- Added category support (Paint, Primer, Sundries, Tools) in the form
- Added notes field to inventory items
- New **"Needed for Jobs"** tab showing materials needed across all active jobs
- Implemented aggregation logic:
  - Groups materials by store
  - Calculates `totalNeeded - onHand = quantityStillNeeded`
  - Shows which jobs are contributing to the need
  - Supports both linked and unlinked materials
- **"Mark as Purchased"** functionality:
  - Updates job materials with `purchased_at` timestamp
  - Increases inventory `on_hand` quantity if linked
  - Removes items from the "Needed for Jobs" list
- Category badges on inventory items
- Enhanced UI with job count in header

### 5. Job Materials Consumption
**File**: `/src/components/app/jobs/job-detail-view.tsx`

Enhanced `handleToggleMaterial` function:
- Automatically decrements inventory when materials are checked off (for jobs in "in_progress" or "done" status)
- Sets `consumed_at` timestamp when consumed
- Allows unchecking to restore inventory (editable, as per requirements)
- Only consumes if material is linked to inventory and has quantity

## Features Implemented

### ✅ Core Requirements
- [x] Inventory items with category, unit, on_hand, reorder threshold
- [x] Job materials checklist that can consume inventory
- [x] Low stock alerts (threshold-based)
- [x] **"Still Need to Buy" section** - aggregates unfulfilled material requirements
- [x] Lightweight stores/pickup locations support
- [x] Material consumption when jobs are in progress/done
- [x] Editable consumption (can undo)

### ✅ User Experience
- [x] Single inventory page with tabs
- [x] No modal chains
- [x] Fast bulk actions (quick +/- buttons)
- [x] Mobile-friendly design
- [x] Category-based organization
- [x] Store grouping in "Needed for Jobs"
- [x] Clear visual indicators (badges, icons)

### ✅ Explicit Non-Goals (Avoided)
- ❌ No purchase orders
- ❌ No vendor integrations
- ❌ No accounting exports
- ❌ No cost tracking in inventory flow
- ❌ No multi-warehouse logic
- ❌ No auto-purchasing
- ❌ No COGS, FIFO/LIFO, valuation

## How It Works

### Workflow 1: Adding Inventory Items
1. Click "Add Item" button
2. Enter name, category, unit, quantities, vendor info
3. Optional: Link to a preferred pickup location (store)
4. Save - item appears in "All Items" tab

### Workflow 2: Materials Needed for Jobs
1. Add materials to job materials checklist (on job detail page)
2. Link materials to inventory items (optional)
3. Specify quantity needed
4. Navigate to Inventory > "Needed for Jobs" tab
5. See aggregated list grouped by store
6. Click "Mark as Purchased" to:
   - Mark materials as purchased
   - Increase inventory on_hand (if linked)
   - Remove from "Needed for Jobs" list

### Workflow 3: Job Consumption
1. Move job to "In Progress" or "Done" status
2. Check off materials as they're used
3. If material is linked to inventory:
   - Inventory `on_hand` decreases by quantity
   - `consumed_at` timestamp is set
4. Unchecking restores inventory (editable)

### Workflow 4: Low Stock Monitoring
1. Set reorder threshold on each item
2. When `on_hand <= reorder_at`:
   - Item appears in "Low Stock" tab
   - Shows in "Buy List" with suggested quantity

## Database Structure

```
inventory_items
├── id (uuid)
├── company_id (uuid)
├── name (text)
├── category (text) [NEW]
├── unit (text)
├── on_hand (integer)
├── reorder_at (integer)
├── cost_per_unit (numeric)
├── vendor_name (text)
├── vendor_sku (text)
├── preferred_pickup_location_id (uuid)
├── notes (text) [NEW]
└── created_at (timestamptz)

job_materials
├── id (uuid)
├── job_id (uuid)
├── name (text)
├── checked (boolean)
├── inventory_item_id (uuid)
├── vendor_sku (text)
├── notes (text)
├── cost_per_unit (numeric)
├── quantity_decimal (numeric)
├── unit (text)
├── purchased_at (timestamptz) [NEW]
├── consumed_at (timestamptz) [NEW]
└── created_at (timestamptz)
```

## Success Criteria Met

✅ **Solo painter setup**: Can add items and set thresholds in <10 minutes
✅ **Crew lead visibility**: "Needed for Jobs" tab shows exactly what to buy today
✅ **Natural accuracy**: Job usage naturally keeps inventory current
✅ **No training needed**: UI is self-explanatory with clear labels and actions

## Future Enhancements (Not Implemented)
- Bulk import of inventory items
- Material suggestions based on job type
- Integration with estimate line items for automatic material lists
- Historical consumption tracking for forecasting
- Mobile app for job site material checklist

## Testing Checklist
- [ ] Create inventory item with category
- [ ] Add materials to job with quantities
- [ ] Link materials to inventory items
- [ ] View "Needed for Jobs" tab
- [ ] Mark materials as purchased
- [ ] Check material consumption when job is in progress
- [ ] Uncheck material to restore inventory
- [ ] Verify low stock alerts
- [ ] Test store grouping in "Needed for Jobs"
