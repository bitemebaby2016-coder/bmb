# BITE ME BABY - Implementation Plan
Version: 1.1 | Date: 2026-09-26 | Status: ACTIVE

## Current State

### ✅ COMPLETED
- AI Voice Service (STT + OpenRouter + TTS) ✅
- Bite Mascot 24 Poses (WebP, cycle on tap) ✅
- Cart Isolation Engine (SAME_DAY | PRE_ORDER) ✅
- Delivery Router Two-Tier (Bite Drive + 3rd Party) ✅
- Google Maps Platform Integration (Routes API, Geocoding, Places, Maps JS) ✅
- routeOrderWithGoogle() — real driving distance/duration + fallback ✅
- ContactPage Interactive Map (Kitchen location via Google Maps JS SDK) ✅
- AddressAutocomplete component with debounced Place suggestions ✅
- CustomerTimeline (3D Glass UI, animated progress for SAME_DAY/PRE_ORDER) ✅
- RiderPod (Mandatory Photo + GPS capture on delivery) ✅
- DistanceChecker (500ms debounce) ✅
- Payment Gateway P0-5 (Stripe + PromptPay + COD — server-authoritative) ✅
- Order State Machine P0-6 (allow-list transitions) ✅
- Build + 358/358 tests PASS ✅

### IN PROGRESS
- None

### BLOCKED (OWNER ACTION REQUIRED)
- External Delivery Provider Keys (Grab/LINE MAN/Foodpanda sandbox credentials provided but no live API yet)

## TASK 1: Glassmorphism Design System (P0, Week 1-2)
### Completed
- Tailwind cleanup — existing glass utilities preserved ✅
- Enforce design tokens from platformConfig (glassBg, glassBlur, depthShadow) ✅
- Mascot absolute + pointer-events-none wrapper (MascotWrapper) ✅

### Remaining
- Negative margin + drop-shadow for food images (add to MenuPage/CheckoutPage cards)
- Custom scrollbar + micro-animation polish

## TASK 2: Pre-Order + Cart Isolation (P0, Week 1-2)
### Completed
- Weekly menu rotator (available_week attribute in config) ✅
- Dynamic cutoff/quota from config ✅
- Truth Table engine (availabilityEngine.ts) ✅
- CartIsolationStore with mode-switch confirmation modal ✅

### Remaining
- Admin Pre-Order scheduling UI (AdminPreOrders page partially done)
- Scheduled_date auto-default (Today+3) on checkout

## TASK 3: Hybrid Delivery + Routing (P0, Week 2-3)
### ✅ COMPLETE
- src/lib/googleMaps.ts — Routes API, Geocoding, Places Autocomplete, Maps JS SDK
- routeOrderWithGoogle() — async function using Google Routes for actual driving distance
- ContactPage embedded interactive map with kitchen location
- AddressAutocomplete component with debounced Place predictions
- Haversine fallback when APIs unavailable

## TASK 4: State Machine + POD (P0, Week 3-4)
### ✅ COMPLETE
- orderStateMachine.ts — SAME_DAY/PRE_ORDER allow-list transitions (unchanged)
- CustomerTimeline.tsx — Glass card with animated steps, phase grouping, terminal states
- RiderPod.tsx — Camera/gallery photo capture + navigator.geolocation GPS mandatory on delivery
- RoutingQuote interface extended with optional estimatedDurationSec

## TASK 5: Bite AI 4-Stages (P1, Week 2-3)
### ✅ All Stages Implemented
- Stage 1 Ambient: Floating mascot overlay + Web Audio greeting on first click ✅
- Stage 2 Upsell: Cart total vs free-shipping threshold → sweetener prompt ✅
- Stage 3 Micro-Hook: Scroll-stall monitor (>5s idle on pre-order grid → "เหลือน้อย") ✅
- Stage 4 Full-Chat: Mascot tap → BiteAIChat with contextual context pipe ✅
- Authority Boundary: AI only calls addToCart (no direct DB mutation) ✅

### Remaining Enhancements
- Stage 2: Add personalized recommendation based on browsing history
- Stage 3: Expand quota warning triggers (not just scroll-stall)
- Stage 4: Add voice output option (TTS integration with aiVoice.ts)

## PAYMENT INTEGRATION (P0-5) — VERIFIED WITH REAL KEYS ✅
### Live Configuration in .env
- **Supabase URL**: `https://ivkdfognyiwjcmrhcnwz.supabase.co` ✅
- **Supabase Service Role Key**: `sb_secret_RVEtLvVSfj8twoNkxTE-...` ✅
- **Stripe Publishable Key**: `pk_test_51UGpVA3yHrQLTgfK...` ✅
- **Stripe Secret Key**: `sk_test_51UGpVA3yHrQLTgfKmV8...` ✅
- **Stripe Webhook Secret**: `whsec_Dt6CDya0kdAuZmf7EW6fG49cBlrcmwpP` ✅

### Server-Authoritative Flow
1. **credit_card** → Edge Function `create-checkout` creates Stripe PaymentIntent
   - Reads `STRIPE_SECRET_KEY` from env → Stripe API (Bearer auth)
   - Creates PI with authoritative amount (from `orders.total_amount`, never client-supplied)
   - Returns `client_secret` for Stripe.js confirmation
   - Records intent row with service-role key (`bmb_backend_production_supabase_service_role_key`)
2. **Stripe Webhook** → `stripe-webhook/index.ts`
   - Verifies HMAC-SHA256 with `STRIPE_WEBHOOK_SECRET` (constant-time comparison)
   - Calls `record_payment_result()` RPC (service_role only, idempotent by `payment_intent_id`)
   - Updates `orders.payment_status='paid'` + `payment_intents.status='completed'`
3. **promptpay_qr** → `create_payment_intent_record()` RPC → customer submits TXN reference → admin confirms
4. **cash_on_delivery** → `create_payment_intent_record()` RPC → admin collects at door → `confirm_offline_payment()` after delivered

### Security Guarantees
- Service-role key NEVER exposed in client bundle (confirmed in `src/lib/supabase.ts` — P0-1 FIX)
- Client can never fabricate success (no simulation/localStorage)
- Amount tamper-proof: edge function re-derives from DB
- Refunds server-side only via `stripe-refund` EF
