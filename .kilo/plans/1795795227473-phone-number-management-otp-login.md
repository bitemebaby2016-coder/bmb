# Phone Number Management & OTP Login — Implementation Plan

## Context

Existing email-registered customers cannot add phone numbers after registration. Phone login exists but uses phone-keyed emails (`<phone>@phone.bmb.local`), not Supabase Auth's official `phone` field. No OTP verification for standard phone login.

## Current State Analysis

| Component | Status | Notes |
|-----------|--------|-------|
| LoginPage `mode='phone'` | ✅ Exists | Phone + password login via `loginByPhone` (authStore) |
| LoginPage `mode='quick'` | ✅ Exists | Name + phone + GPS + OTP (phone-auto-login EF) |
| ProfilePage phone display | ✅ Exists | Shows `customer.phone` from `user.phone \|\| user_metadata.phone` |
| ProfilePage phone edit | ❌ Missing | No UI to add/update phone |
| AdminCustomers phone display | ✅ Exists | Shows `c.phone` in table |
| AdminCustomers phone edit | ❌ Missing | No edit capability |
| Supabase Auth phone OTP | ❌ Not configured | `phone-auto-login` EF uses custom OTP, not Supabase Auth |

## Tasks

### Task 1: ProfilePage — Add Phone Number Editing
**Files:** `src/pages/ProfilePage.tsx`, `src/lib/customerProfile.ts` (or new `src/lib/phoneProfile.ts`)

- Add phone input field + "บันทึกเบอร์โทร" button in ProfilePage
- Validate Thai format (`0XXXXXXXXX` → E.164 `+66XXXXXXXXX`)
- Call `supabase.auth.updateUser({ phone: e164 })` — triggers Supabase SMS OTP if provider configured
- Handle response: success → toast + update local state; error → show message
- If Supabase phone provider not configured: fallback to updating `user_metadata.phone` only (with warning toast)

### Task 2: LoginPage — Enhance Existing Phone Tab with OTP
**Files:** `src/pages/login/LoginPage.tsx`, `src/store/authStore.ts`

- Keep existing `mode='phone'` tab structure
- Add OTP flow: phone input → "ส่งรหัส OTP" button → OTP input → verify
- Use `supabase.auth.signInWithOtp({ phone: e164 })` for real OTP (if Supabase phone provider configured)
- Fallback: keep existing `loginByPhone` (phone + password) if OTP not configured
- Reuse existing `pPhone`, `otpCode`, `otpSent` state variables (already exist for quick login)

### Task 3: AdminCustomers — Manual Phone Addition/Editing
**Files:** `src/pages/admin/AdminCustomers.tsx`, `src/lib/bmbAdminApi_customers.ts`

- Add "แก้ไขเบอร์" button per customer row
- Modal/inline edit: phone input + save button
- Call new `updateCustomerPhone(customerId, phone)` in `bmbAdminApi_customers.ts`
- Implementation: use Supabase Admin API via Edge Function (service role) OR direct update on `customers` table + auth metadata
- Validate Thai format before saving

## Implementation Order

1. **Task 1** (ProfilePage phone edit) — self-contained, no dependencies
2. **Task 3** (AdminCustomers phone edit) — admin-side, independent
3. **Task 2** (LoginPage OTP enhancement) — depends on Task 1 (phone must be addable first)

## Validation

- `npm run lint` — 0 issues
- `npm run typecheck` — 0 errors (tsc)
- `npm run test` — vitest 263 files / 3,050+ tests PASS
- `npm run build` — 0 errors
- Manual: add phone in ProfilePage → verify in AdminCustomers → login with phone

## Risks

- Supabase phone provider may not be configured → OTP won't work. Mitigation: fallback to password-based phone login.
- `supabase.auth.updateUser({ phone })` requires E.164 format → validate + convert Thai format.
- Admin phone update needs service role → use Edge Function pattern (like `phone-auto-login`).

## Out of Scope

- SMS provider configuration (Twilio/MessageBird) — requires Owner decision + secrets
- Real Supabase Auth phone OTP provider setup — infrastructure task
- Migration changes — no DB schema changes needed (phone already in `customers` table + `auth.users`)