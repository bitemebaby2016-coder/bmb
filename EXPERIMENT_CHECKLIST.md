# EXPERIMENT / PILOT CHECKLIST — Bite Me Baby M1

> Created: 2026-09-23  
> Technical baseline: `cf29b39` → `4414144`  
> Status: **READY FOR OWNER EXPERIMENT**

---

## Pre-Experiment Checklist (Technical)

### Authentication & Authorization
- [x] Login works (Supabase Auth — email/password)
- [x] Registration works (creates profile via trigger)
- [x] Quick login works (Edge Function phone-auto-login)
- [x] Logout invalidates real session
- [x] Admin pages require profiles.role='admin' (RLS)
- [x] No localStorage auth anywhere

### Database
- [x] Migrations 001–034 applied (34/34 LIVE)
- [x] ACL gate PASS (anon_write_residue=0, anon_extra_select=0)
- [x] RLS policies enforced (all tables protected)
- [x] Audit logs write to DB via RPC append_audit_log

### Payment
- [x] Stripe Edge Function operational
- [x] Webhook signature verification active
- [x] Real refund capability verified (172 THB test refund exists)
- [x] PromptPay offline payment flow works (TXN reference submission)
- [x] COD requires 'delivered' before payment confirmed

### Order Lifecycle
- [x] Same-day order: cart → checkout → payment → kitchen → delivery
- [x] Pre-order: round selection → capacity lock → payment → batch
- [x] Cancellation: customer cancel → capacity restore → inventory restore
- [x] State machine enforced server-side (allow-list + trigger)

### Delivery
- [x] Zone-based fee calculation (0–5km = 25฿, 5–10km = 45฿, 10–20km = 80฿)
- [x] Rider PWA: assign → accept → picked_up → in_transit → delivered
- [x] Delivery status syncs back to orders via driver_update_delivery_status

---

## Owner Experiment Steps

### Step 1: Create Test Customer Account
```
Action: Open https://production-url/login → Register new account
Expected: Profile created in DB with role=customer
Verify: Can log in, redirected to home page
```

### Step 2: Place Same-Day Order
```
Action: Browse menu → Add items to cart → Go to checkout
Expected:
  - Cart shows correct prices (display only — server re-calculates)
  - Delivery fee calculated based on GPS location
  - Order created via create_order_with_items RPC
  - Price authoritative (from DB products table)
Verify:
  - Check admin panel → Orders page → See new order
  - Status should be 'pending' or 'confirmed'
```

### Step 3: Complete Payment
```
Action: On payment page, submit transaction info or pay via card
Expected:
  - TXN reference submitted via submit_offline_payment_reference
  - Or Stripe charge processed via create-checkout EF
  - Redirected to payment confirmation page
Verify:
  - Payment status updated in admin panel
  - Order proceeds through workflow
```

### Step 4: Kitchen Processing
```
Action: Admin confirms order → marks as prepared → delivers
Expected:
  - Status transitions follow allow-list (no jumps allowed)
  - Audit log entries created for each state change
  - Customer receives status update tracking
Verify:
  - Track page (/track/{order_number}) shows real status
  - No impossible state transitions possible
```

### Step 5: Delivery Completion
```
Action: Rider accepts delivery → advances through statuses → marked delivered
Expected:
  - Assignment appears in rider's dashboard
  - Status chain: assigned → accepted → picked_up → in_transit → delivered
  - Final delivery triggers status sync to orders table
Verify:
  - Order status = 'delivered' in admin
  - Payment auto-confirms for COD after delivery
```

### Step 6: Test Cancellation
```
Action: As customer, cancel an order in 'pending' state
Expected:
  - cancel_order RPC executes
  - Round capacity restored (for pre-orders)
  - Inventory un-locked (if deducted)
  - Order status changes to 'cancelled'
Verify:
  - Admin sees cancelled order
  - Capacity correctly returned
```

### Step 7: Test Refund
```
Action: Admin processes Stripe refund for paid+cancelled order
Expected:
  - stripe-refund EF called
  - Idempotency key prevents double-refund
  - Refund amount matches order total
Verify:
  - Payment status shows refunded in DB
```

---

## Known Limitations (Acceptable for Pilot)

| Item | Status | Impact |
|------|--------|--------|
| Kitchen auto-batch creation | Function exists but manual trigger needed | Low — admin creates batches manually |
| Inventory management UI | Displays from DB but editing may use cache | Medium — review inventory accuracy |
| Auto-assign drivers | `assign_driver` RPC exists but no admin UI | Low — rider self-selects assignments |
| Automated notifications | Toast notifications only | Low — no push/email/SMS yet |
| Review system | Reviews stored in DB but curated reviews hardcoded | Very low |
| Content management | Missing admin UI for reviews | Very low |

---

## Failure Recovery Tests

### Payment Failure
```
Scenario: Stripe payment declines or webhook arrives late
Admin Action: Mark payment failed via admin panel
Customer Action: Retry payment or choose different method
Expected: Order stays pending, no orphan state
```

### Network Timeout During Checkout
```
Scenario: Customer clicks pay but network drops
Customer Action: Return to /payment/{order}, see order exists
Expected: Can retry payment without creating duplicate order
```

### Order After Pre-Order Cutoff
```
Scenario: Customer tries to order past cutoff time
System Action: Server rejects (availability engine quota=0)
Expected: Clear error message showing when next round opens
```

---

## Post-Experiment Data to Verify

After running steps 1–7 above, owner should confirm:

1. **Orders table**: All orders have valid statuses matching their lifecycle stage
2. **Payment intents**: Each payment has one valid intent, webhooks idempotent
3. **Delivery assignments**: Only live orders show in rider dashboard
4. **Audit log**: Key actions (login, order_create, payment_processed, status_change) appear
5. **Capacity**: No negative capacity, correct restoration after cancel
6. **Inventory**: Accurate counts after add/remove operations