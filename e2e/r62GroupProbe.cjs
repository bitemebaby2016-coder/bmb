// R62 PHASE 1 — read-only source-existence probe for 12-group audit (A–L)
// Evidence rule: source/migrations > docs. This checks actual files only.
const fs = require('fs');
const path = require('path');

const G = {
  A_customer_pwa: [
    'src/pages/HomePage.tsx', 'src/pages/MenuPage.tsx', 'src/pages/CartPage.tsx',
    'src/pages/CheckoutPage.tsx', 'src/pages/OrdersPage.tsx', 'src/pages/OrderTrackPage.tsx',
    'src/pages/ProfilePage.tsx', 'src/pages/RewardsPage.tsx', 'src/pages/PromotionsPage.tsx',
    'src/sw.ts', 'src/lib/cartDeepLink.ts', 'src/lib/cartPersistence.ts',
    'src/lib/notificationService.ts', 'src/lib/pushService.ts',
  ],
  B_product_ordering: [
    'src/lib/orderEntry.ts', 'src/lib/orderStateMachine.ts', 'src/lib/orderPolicy.ts',
    'src/lib/availabilityEngine.ts', 'src/lib/bmbMenuSchedule.ts', 'src/lib/preOrderQueue.ts',
    'src/lib/discountGuardrail.ts', 'src/lib/addonMarginGuard.ts', 'src/lib/marginCalc.ts',
    'src/pages/admin/AdminProducts.tsx', 'src/pages/admin/AdminRounds.tsx',
  ],
  C_payment: [
    'src/lib/paymentGateway.ts', 'src/lib/omise.ts', 'src/lib/paymentExceptions.ts',
    'src/lib/guestCheckout.ts', 'supabase/functions/omise-webhook/index.ts',
    'supabase/functions/stripe-webhook/index.ts', 'supabase/functions/omise-refund/index.ts',
    'supabase/functions/stripe-refund/index.ts', 'supabase/functions/create-checkout/index.ts',
    'supabase/functions/omise-checkout/index.ts', 'supabase/functions/guest-checkout-session/index.ts',
    'supabase/migrations/133_payment_slip_upload.sql', 'supabase/migrations/172_discount_cap_15pct.sql',
  ],
  D_admin: [
    'src/pages/admin/AdminDashboard.tsx', 'src/pages/admin/AdminOrders.tsx',
    'src/pages/admin/AdminSettings.tsx', 'src/pages/admin/AdminPromotions.tsx',
    'src/pages/admin/AdminMarketing.tsx', 'src/pages/admin/DeliveryManagement.tsx',
    'src/pages/admin/InventoryPage.tsx', 'src/pages/admin/AdminReports.tsx',
    'src/pages/admin/AdminPrintSettings.tsx', 'src/pages/admin/RouteOptimizationPage.tsx',
    'src/pages/admin/AuditLogPage.tsx',
  ],
  E_staff_kitchen: [
    'src/pages/admin/AdminKitchen.tsx', 'src/pages/admin/AdminPos.tsx',
    'src/lib/kitchenService.ts', 'src/lib/kitchenQueueView.ts', 'src/lib/posApi.ts',
    'src/lib/printService.ts', 'src/lib/stickerPng.ts',
    'supabase/migrations/019_kitchen_core.sql', 'supabase/migrations/054_kitchen_ready_to_make_gate.sql',
    'supabase/migrations/129_pos_staff_shift.sql', 'supabase/migrations/167_kitchen_batch_loop_fix.sql',
  ],
  F_rider_delivery: [
    'src/pages/RiderPwaPage.tsx', 'src/lib/driverService.ts', 'src/lib/riderPositionApi.ts',
    'src/lib/deliveryRouter.ts', 'src/lib/routeOptimization.ts', 'src/lib/dispatchFallback.ts',
    'supabase/migrations/135_dispatch_offers.sql', 'supabase/migrations/136_driver_location_history.sql',
    'supabase/migrations/168_multi_job_rider_route.sql', 'supabase/migrations/174_customer_rider_position.sql',
  ],
  G_inventory_finance: [
    'src/pages/admin/AdminRecipes.tsx', 'src/lib/bmbAdminApi_inventory.ts',
    'supabase/migrations/026_inventory_aggregate_fix.sql',
    'supabase/migrations/130_finance_reports.sql', 'supabase/migrations/170_product_cost_margin_fields.sql',
    'supabase/migrations/181_addon_margin_rules.sql',
  ],
  H_automation_notifications: [
    'supabase/functions/cron-tick/index.ts', 'supabase/functions/queue-dispatcher/index.ts',
    'supabase/functions/queue-enqueue/index.ts', 'supabase/functions/automation-worker/index.ts',
    'supabase/functions/notification-dispatcher/index.ts', 'supabase/functions/push-send/index.ts',
    'supabase/functions/sms-send/index.ts', 'supabase/functions/otp-send/index.ts',
    'src/lib/notificationLinks.ts', 'src/lib/cartSessionSync.ts',
    'supabase/migrations/179_notification_hub.sql', 'supabase/migrations/180_cart_sessions_reminder.sql',
    '.github/workflows/automation-scheduler.yml',
  ],
  I_security_backend: [
    'supabase/migrations/005_secure_rls_policies.sql', 'supabase/migrations/006_rls_hardening_auth.sql',
    'supabase/migrations/041_driver_identity_jwt_binding.sql', 'supabase/migrations/046_channel_identity_foundation.sql',
    'supabase/migrations/146_role_foundation.sql', 'supabase/migrations/147_role_rls_matrix.sql',
    'supabase/migrations/157_anon_policy_role_scoping.sql', 'supabase/migrations/158_align_grants_and_rls.sql',
    'src/lib/auditLog.ts', 'src/lib/authRecovery.ts', 'src/lib/authSessionSync.ts',
  ],
  J_ai: [
    'supabase/functions/ai-proxy/index.ts', 'supabase/functions/image-gen/index.ts',
    'supabase/functions/social-ai-worker/index.ts', 'supabase/functions/social-post-worker/index.ts',
    'supabase/functions/social-publish-worker/index.ts', 'supabase/functions/voice-tts/index.ts',
    'src/lib/aiService.ts', 'src/lib/aiGuardrails.ts', 'src/lib/talkToBite.ts',
    'src/lib/marketingAutoSchedule.ts', 'src/pages/admin/AdminAiStudio.tsx',
    'src/pages/TalkToBiteHomePage.tsx',
  ],
  K_infra_migrations: [
    'supabase/migrations/183_promo_banner_mascot.sql',
    '.github/workflows/ci.yml', '.github/workflows/contract-tests.yml',
    '.github/workflows/daily-backup.yml', '.github/workflows/sheets-sync.yml',
    'scripts/dbBackup.mjs', 'docker-compose.yml', 'Dockerfile', 'workers/tenant-proxy',
    'vitest.config.ts', 'playwright.config.ts',
  ],
  L_quality: [
    'src/__tests__', 'e2e', 'eslint.config.js', 'scripts/brandNameGuard.cjs',
    'src/test-setup.ts', 'lighthouse',
  ],
};

const out = {};
for (const [g, files] of Object.entries(G)) {
  out[g] = files.map(f => ({ f, ok: fs.existsSync(f) }));
}
const flat = Object.entries(out).flatMap(([g, arr]) => arr.filter(x => !x.ok).map(x => g + ' MISSING: ' + x.f));
const summary = {};
for (const [g, arr] of Object.entries(out)) summary[g] = arr.filter(x => x.ok).length + '/' + arr.length;
const res = { summary, missing: flat, head: require('child_process').execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim() };
fs.writeFileSync(path.join('e2e', 'r62GroupProbe-result.json'), JSON.stringify(out, null, 1));
console.log(JSON.stringify(res, null, 1));

