# UnifiedPayment Component - State Analysis

## Payment States (currentPaymentState)
1. **"none"** - No estimate/payment created yet
2. **"proposed"** - Estimate sent to customer, waiting for approval
3. **"approved"** - Customer approved the estimate
4. **"due"** - Payment is due (approved estimate, ready for payment)
5. **"paid"** - Payment received

## Estimate Status (estimateStatus prop)
1. **"draft"** - Draft estimate (not sent)
2. **"sent"** - Sent to customer
3. **"accepted"** - Accepted by customer
4. **"denied"** - Denied by customer

## Editing State (editingEstimate)
- **true** - Currently editing estimate
- **false** - Viewing estimate (not editing)

## Line Items State
- **savedLineItems** - Line items saved in database
- **initialLineItems** - Line items from props (parent component)
- **lineItems** - Current editing state (form inputs)

---

## Current Rendering Logic (THE MESS)

### 1. DENIED ESTIMATE ALERT
**Condition:** `estimateStatus === "denied"`
- Always shows when estimate is denied
- Shows denial reason and "Revise Estimate" button

### 2. PROPOSED STATE SECTION
**Condition:** `(currentPaymentState === "none" || currentPaymentState === "proposed") || (currentPaymentState === "approved" && editingEstimate)`

**Sub-conditions:**
- **Details View:** `currentPaymentState === "proposed" && (savedLineItems.length > 0 || initialLineItems.length > 0) && !editingEstimate`
  - Shows saved estimate details
  - Shows Share, Edit, Approve buttons
  
- **Editing Form:** Otherwise (the else branch)
  - Shows form to create/edit estimate
  - Shows "Add Line" and "Create/Update Estimate" buttons
  - Shows "Cancel" button if `editingEstimate === true`

### 3. APPROVED STATE SECTION
**Condition:** `currentPaymentState === "approved"`

**Sub-conditions:**
- **When NOT editing:** `!editingEstimate`
  - Shows approval message
  - Shows estimate details
  - Shows "Revise Estimate" and "Finalize Payment" buttons
  
- **When editing:** `editingEstimate === true`
  - Shows "Revising Approved Estimate" message
  - Shows estimate details
  - BUT editing form is shown in PROPOSED section (confusing!)

### 4. DUE STATE SECTION
**Condition:** `currentPaymentState === "due"`
- Shows payment due message
- Shows share payment link buttons

### 5. PAID STATE SECTION
**Condition:** `currentPaymentState === "paid"`
- Shows payment received message
- Shows payment method and date

---

## PROBLEMS WITH CURRENT LOGIC

1. **Overlapping Conditions:**
   - When `currentPaymentState === "approved" && editingEstimate === true`, BOTH PROPOSED and APPROVED sections can render
   - The editing form is in PROPOSED section, but approval message/details are in APPROVED section

2. **Confusing State Management:**
   - `currentPaymentState` can be "approved" but editing form shows in "proposed" section
   - `savedLineItems` vs `initialLineItems` vs `lineItems` - unclear which to use when

3. **Multiple Sources of Truth:**
   - `paymentState` prop vs `currentPaymentState` state
   - `savedLineItems` state vs `initialLineItems` prop
   - `estimateStatus` prop (separate from payment state)

4. **Complex Nested Conditions:**
   - Multiple nested ternary operators
   - Hard to follow the logic flow
   - Easy to introduce bugs

---

## SIMPLIFIED STATE MODEL (PROPOSED)

### Single State Object:
```typescript
type EstimateState = 
  | { type: "none" }                           // No estimate created
  | { type: "draft", editing: boolean }        // Draft estimate
  | { type: "proposed", editing: boolean }     // Sent to customer
  | { type: "denied", editing: boolean }        // Denied by customer
  | { type: "approved", editing: boolean }     // Approved by customer
  | { type: "due" }                             // Payment due
  | { type: "paid" };                           // Payment received
```

### Single Line Items Source:
- Always use `savedLineItems` for display
- Only use `lineItems` when `editing === true`
- Remove `initialLineItems` duplication

### Clear Rendering Rules:
1. If `editing === true` → Show editing form
2. If `editing === false` → Show details view
3. Each state has ONE section, not multiple overlapping ones
