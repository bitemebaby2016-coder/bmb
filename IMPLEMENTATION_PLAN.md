# BITE ME BABY - Implementation Plan
Version: 1.0 | Date: 2026-09-25 | Status: ACTIVE

## Current State

### DONE
- AI Voice Service (STT + OpenRouter + TTS)
- Bite Mascot 24 Poses (WebP, cycle on tap)
- Cart Isolation Engine (SAME_DAY | PRE_ORDER)
- Delivery Router Two-Tier (Bite Drive + 3rd Party)
- DistanceChecker (500ms debounce)
- Google Maps API Keys added to .env/.env.example
- Build + 358/358 tests PASS

### IN PROGRESS
- Google Routes API integration
- Maps JavaScript API for ContactPage

### PENDING (OWNER-ONLY)
- External Rider API Keys (Grab/LINE MAN/Foodpanda)
- Stripe Test Keys
- Real Bite Drive Pilot

## TASK 1: Glassmorphism Design System (P0, Week 1-2)
- Tailwind cleanup
- Enforce design tokens from platformConfig
- Negative margin + drop-shadow for food images
- Mascot absolute + pointer-events-none

## TASK 2: Pre-Order + Cart Isolation (P0, Week 1-2)
- Weekly menu rotator (available_week/date)
- Dynamic cutoff/quota from config
- Truth Table engine

## TASK 3: Hybrid Delivery + Routing (P0, Week 2-3)
- Google Routes API integration (src/lib/googleMaps.ts)
- Tier logic: <=5km Bite Drive, >5km 3rd Party
- Address autocomplete + geocode

## TASK 4: State Machine + POD (P0, Week 3-4)
- Same-Day: Created->Accepted->Preparing->Ready->Dispatched->Delivered
- Pre-Order: Booked->Allocated->Batch->Ready->Dispatched->Delivered
- Customer timeline (3D Glass)
- Rider PWA: POD (Photo + GPS mandatory)
- Admin dispatch dashboard
- Dual review (Food + Delivery)

## TASK 5: Bite AI 4-Stages (P1, Week 2-3)
- Stage 1: Ambient greeting + audio
- Stage 2: Personalized upsell
- Stage 3: Micro-hook quota warning
- Stage 4: Full-screen chat + context
- Authority boundary: AI only addToCart

## Blockers (OWNER ACTION REQUIRED)
1. Google Maps API Keys (real keys in .env)
2. Grab/LINE MAN/Foodpanda sandbox credentials
3. Stripe Test Keys
4. Supabase Service Role Key

## Next Actions
1. Owner: Add real Google Maps API keys to .env
2. Dev: Integrate computeGoogleRoute in deliveryRouter.ts
3. Dev: Create GoogleMapPicker component
4. Dev: Start Rider PWA POD capture
5. QA: E2E checkout with Google Routes API
