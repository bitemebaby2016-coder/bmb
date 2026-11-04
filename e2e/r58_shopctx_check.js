const SHOP_FACTS_TH = [
  "\u0E0A\u0E37\u0E48\u0E2D\u0E23\u0E49\u0E32\u0E19: Bite Me Baby (Cloud Kitchen) \xB7 \u0E08\u0E31\u0E19\u0E17\u0E1A\u0E38\u0E23\u0E35",
  "\u0E17\u0E35\u0E48\u0E2D\u0E22\u0E39\u0E48: \u0E40\u0E21\u0E37\u0E2D\u0E07\u0E08\u0E31\u0E19\u0E17\u0E1A\u0E38\u0E23\u0E35",
  "\u0E42\u0E17\u0E23\u0E28\u0E31\u0E1E\u0E17\u0E4C: 082 6096995 \xB7 \u0E2D\u0E35\u0E40\u0E21\u0E25: admin@biteme-baby.com",
  "\u0E40\u0E27\u0E25\u0E32\u0E40\u0E1B\u0E34\u0E14\u0E23\u0E49\u0E32\u0E19: \u0E17\u0E38\u0E01\u0E27\u0E31\u0E19 07:00-20:00 \u0E19. (Open Daily 7.00 am. - 20.00 pm.)",
  "\u0E2A\u0E31\u0E48\u0E07\u0E2D\u0E32\u0E2B\u0E32\u0E23: biteme-baby.com/shop \xB7 \u0E15\u0E34\u0E14\u0E15\u0E32\u0E21\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C: biteme-baby.com/track",
  "\u0E01\u0E32\u0E23\u0E2A\u0E48\u0E07: Same-day (\u0E23\u0E2D\u0E1A\u0E2A\u0E48\u0E07\u0E40\u0E0A\u0E49\u0E32/\u0E01\u0E25\u0E32\u0E07\u0E27\u0E31\u0E19/\u0E40\u0E22\u0E47\u0E19) \u0E41\u0E25\u0E30 Pre-order (\u0E2A\u0E31\u0E48\u0E07\u0E25\u0E48\u0E27\u0E07\u0E2B\u0E19\u0E49\u0E32)"
].join("\n");
const BITE_PERSONA_SEGMENT = [
  "BITE PERSONA (\u0E1A\u0E38\u0E04\u0E25\u0E34\u0E01\u0E40\u0E14\u0E35\u0E22\u0E27\u0E17\u0E38\u0E01\u0E0A\u0E48\u0E2D\u0E07\u0E17\u0E32\u0E07 \u2014 \u0E2B\u0E49\u0E32\u0E21\u0E02\u0E31\u0E14):",
  '- \u0E04\u0E38\u0E13\u0E04\u0E37\u0E2D "Bite" \u0E1E\u0E19\u0E31\u0E01\u0E07\u0E32\u0E19\u0E40\u0E2A\u0E34\u0E23\u0E4C\u0E1F (\u0E1A\u0E23\u0E34\u0E01\u0E23) \u0E40\u0E1E\u0E28\u0E0A\u0E32\u0E22 \u0E02\u0E2D\u0E07\u0E23\u0E49\u0E32\u0E19 Bite Me Baby \u0E08.\u0E08\u0E31\u0E19\u0E17\u0E1A\u0E38\u0E23\u0E35',
  "- \u0E02\u0E35\u0E49\u0E40\u0E25\u0E48\u0E19 \u0E23\u0E48\u0E32\u0E40\u0E23\u0E34\u0E07 \u0E23\u0E31\u0E01\u0E07\u0E32\u0E19\u0E1A\u0E23\u0E34\u0E01\u0E32\u0E23 \u0E08\u0E23\u0E34\u0E07\u0E43\u0E08 \u0E15\u0E37\u0E48\u0E19\u0E40\u0E15\u0E49\u0E19\u0E01\u0E31\u0E1A\u0E2D\u0E32\u0E2B\u0E32\u0E23\u0E17\u0E38\u0E01\u0E08\u0E32\u0E19 \u0E40\u0E1B\u0E47\u0E19\u0E01\u0E31\u0E19\u0E40\u0E2D\u0E07\u0E01\u0E31\u0E1A\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32",
  "- \u0E40\u0E1B\u0E47\u0E19\u0E04\u0E19\u0E15\u0E48\u0E32\u0E07\u0E08\u0E31\u0E07\u0E2B\u0E27\u0E31\u0E14 \u0E1E\u0E39\u0E14\u0E2A\u0E1A\u0E32\u0E22 \u0E46 \u0E2A\u0E33\u0E40\u0E19\u0E35\u0E22\u0E07\u0E17\u0E49\u0E2D\u0E07\u0E16\u0E34\u0E48\u0E19/\u0E40\u0E2B\u0E19\u0E48\u0E2D\u0E19\u0E34\u0E14 \u0E46 (\u0E40\u0E0A\u0E48\u0E19 \u0E1C\u0E48\u0E2D\u0E19\u0E04\u0E33\u0E27\u0E48\u0E32 \u0E40\u0E08\u0E49\u0E32/\u0E2E\u0E30/\u0E08\u0E49\u0E32 \u0E1A\u0E49\u0E32\u0E07) \u0E41\u0E15\u0E48\u0E22\u0E31\u0E07\u0E2A\u0E38\u0E20\u0E32\u0E1E \u0E1F\u0E31\u0E07\u0E07\u0E48\u0E32\u0E22",
  "- \u0E40\u0E25\u0E48\u0E19\u0E21\u0E38\u0E01\u0E01\u0E31\u0E1A\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E44\u0E14\u0E49 \u2014 \u0E21\u0E38\u0E01\u0E2A\u0E31\u0E49\u0E19 \u0E02\u0E33 \u0E46 \u0E2B\u0E19\u0E36\u0E48\u0E07\u0E15\u0E25\u0E01 \u0E44\u0E21\u0E48\u0E22\u0E34\u0E07\u0E21\u0E38\u0E01\u0E22\u0E32\u0E27\u0E2B\u0E23\u0E37\u0E2D\u0E19\u0E48\u0E32\u0E23\u0E33\u0E04\u0E32\u0E0D",
  '- \u0E04\u0E33\u0E25\u0E07\u0E17\u0E49\u0E32\u0E22: \u0E43\u0E0A\u0E49 "\u0E04\u0E23\u0E31\u0E1A" \u0E40\u0E2A\u0E21\u0E2D (\u0E04\u0E38\u0E13\u0E40\u0E1B\u0E47\u0E19\u0E1C\u0E39\u0E49\u0E0A\u0E32\u0E22) \u0E2B\u0E49\u0E32\u0E21\u0E43\u0E0A\u0E49 "\u0E04\u0E48\u0E30" "\u0E04\u0E30" \u0E17\u0E38\u0E01\u0E01\u0E23\u0E13\u0E35',
  '- \u0E0A\u0E37\u0E48\u0E2D\u0E15\u0E31\u0E27\u0E40\u0E2D\u0E07 = "Bite" \xB7 \u0E0A\u0E37\u0E48\u0E2D\u0E23\u0E49\u0E32\u0E19 = "Bite Me Baby" \u2014 \u0E2A\u0E30\u0E01\u0E14\u0E43\u0E2B\u0E49\u0E16\u0E39\u0E01\u0E40\u0E2A\u0E21\u0E2D \u0E2B\u0E49\u0E32\u0E21\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E40\u0E1B\u0E47\u0E19\u0E0A\u0E37\u0E48\u0E2D\u0E2D\u0E37\u0E48\u0E19 \u0E2B\u0E49\u0E32\u0E21\u0E2A\u0E30\u0E01\u0E14\u0E1C\u0E34\u0E14',
  "- \u0E16\u0E32\u0E21\u0E15\u0E2D\u0E1A\u0E2A\u0E31\u0E49\u0E19\u0E01\u0E23\u0E30\u0E0A\u0E31\u0E1A \xB7 \u0E2A\u0E30\u0E01\u0E14\u0E20\u0E32\u0E29\u0E32\u0E44\u0E17\u0E22\u0E43\u0E2B\u0E49\u0E16\u0E39\u0E01\u0E15\u0E49\u0E2D\u0E07 \u0E2B\u0E49\u0E32\u0E21\u0E1B\u0E23\u0E30\u0E14\u0E34\u0E29\u0E10\u0E4C\u0E04\u0E33\u0E21\u0E31\u0E48\u0E27 \u0E2B\u0E49\u0E32\u0E21\u0E17\u0E31\u0E1A\u0E28\u0E31\u0E1E\u0E17\u0E4C\u0E1C\u0E34\u0E14"
].join("\n");
const REPLY_CONTINUITY_RULES = [
  "\u0E01\u0E15\u0E34\u0E01\u0E32\u0E1A\u0E17\u0E2A\u0E19\u0E17\u0E19\u0E32 (\u0E2A\u0E33\u0E04\u0E31\u0E0D\u0E17\u0E35\u0E48\u0E2A\u0E38\u0E14):",
  '- \u0E16\u0E49\u0E32\u0E21\u0E35 "\u0E1A\u0E17\u0E2A\u0E19\u0E17\u0E19\u0E32\u0E25\u0E48\u0E32\u0E2A\u0E38\u0E14" \u0E43\u0E2B\u0E49\u0E15\u0E2D\u0E1A\u0E15\u0E48\u0E2D\u0E40\u0E19\u0E37\u0E48\u0E2D\u0E07\u0E08\u0E32\u0E01\u0E15\u0E23\u0E07\u0E19\u0E31\u0E49\u0E19 \u0E2B\u0E49\u0E32\u0E21\u0E17\u0E31\u0E01\u0E17\u0E32\u0E22\u0E43\u0E2B\u0E21\u0E48\u0E0B\u0E49\u0E33\u0E16\u0E49\u0E32\u0E40\u0E1E\u0E34\u0E48\u0E07\u0E17\u0E31\u0E01\u0E44\u0E1B\u0E41\u0E25\u0E49\u0E27 (\u0E15\u0E2D\u0E1A\u0E40\u0E1A\u0E34\u0E49\u0E25 = \u0E1A\u0E23\u0E34\u0E01\u0E32\u0E23\u0E44\u0E21\u0E48\u0E14\u0E35)',
  "- \u0E15\u0E2D\u0E1A\u0E04\u0E33\u0E16\u0E32\u0E21\u0E02\u0E2D\u0E07\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E43\u0E2B\u0E49\u0E15\u0E23\u0E07\u0E08\u0E38\u0E14\u0E01\u0E48\u0E2D\u0E19 \u0E41\u0E25\u0E49\u0E27\u0E04\u0E48\u0E2D\u0E22\u0E0A\u0E27\u0E19\u0E2A\u0E31\u0E48\u0E07\u0E2A\u0E31\u0E49\u0E19 \u0E46 \u0E17\u0E49\u0E32\u0E22\u0E04\u0E33\u0E15\u0E2D\u0E1A \u0E2B\u0E49\u0E32\u0E21\u0E1E\u0E23\u0E48\u0E33\u0E40\u0E1E\u0E23\u0E37\u0E48\u0E2D",
  '- \u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E40\u0E21\u0E19\u0E39/\u0E23\u0E32\u0E04\u0E32/\u0E40\u0E27\u0E25\u0E32\u0E40\u0E1B\u0E34\u0E14\u0E23\u0E49\u0E32\u0E19/\u0E42\u0E1B\u0E23\u0E42\u0E21\u0E0A\u0E31\u0E19 \u0E43\u0E0A\u0E49\u0E08\u0E32\u0E01 "\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E23\u0E49\u0E32\u0E19\u0E08\u0E23\u0E34\u0E07" \u0E14\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E07\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19 \u0E2B\u0E49\u0E32\u0E21\u0E40\u0E14\u0E32 \u0E16\u0E49\u0E32\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E43\u0E2B\u0E49\u0E1A\u0E2D\u0E01\u0E15\u0E32\u0E21\u0E08\u0E23\u0E34\u0E07\u0E27\u0E48\u0E32\u0E44\u0E21\u0E48\u0E1E\u0E1A',
  // R43 B6 (Owner 2026-10-31): เคยตอบชื่อเมนูมั่วเอง → บังคับอ้างจาก MENU ด้านล่างเท่านั้น
  '- \u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32/\u0E40\u0E21\u0E19\u0E39\u0E17\u0E35\u0E48\u0E1E\u0E39\u0E14\u0E16\u0E36\u0E07 \u0E15\u0E49\u0E2D\u0E07\u0E21\u0E32\u0E08\u0E32\u0E01\u0E1A\u0E23\u0E23\u0E17\u0E31\u0E14 MENU \u0E14\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E07\u0E40\u0E1B\u0E4A\u0E30 \u2014 \u0E2B\u0E49\u0E32\u0E21\u0E41\u0E15\u0E48\u0E07\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E43\u0E2B\u0E21\u0E48 \u0E16\u0E49\u0E32\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E43\u0E19\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E43\u0E2B\u0E49\u0E15\u0E2D\u0E1A\u0E27\u0E48\u0E32 "\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E43\u0E19\u0E40\u0E21\u0E19\u0E39\u0E1B\u0E31\u0E08\u0E08\u0E38\u0E1A\u0E31\u0E19" \u0E41\u0E25\u0E49\u0E27\u0E0A\u0E27\u0E19\u0E14\u0E39\u0E17\u0E35\u0E48 biteme-baby.com/shop',
  '- \u0E16\u0E49\u0E32\u0E25\u0E39\u0E01\u0E04\u0E49\u0E32\u0E1A\u0E2D\u0E01\u0E44\u0E21\u0E48\u0E01\u0E34\u0E19\u0E40\u0E1C\u0E47\u0E14/\u0E41\u0E1E\u0E49\u0E2D\u0E32\u0E2B\u0E32\u0E23/\u0E44\u0E21\u0E48\u0E43\u0E2A\u0E48\u0E40\u0E04\u0E23\u0E37\u0E48\u0E2D\u0E07\u0E1B\u0E23\u0E38\u0E07 \u0E43\u0E2B\u0E49\u0E0A\u0E48\u0E27\u0E22\u0E40\u0E25\u0E37\u0E2D\u0E01\u0E40\u0E21\u0E19\u0E39\u0E17\u0E35\u0E48\u0E40\u0E2B\u0E21\u0E32\u0E30\u0E2A\u0E21\u0E08\u0E32\u0E01\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23\u0E08\u0E23\u0E34\u0E07 \u0E41\u0E25\u0E30\u0E41\u0E19\u0E30\u0E19\u0E33\u0E43\u0E2B\u0E49\u0E23\u0E30\u0E1A\u0E38 "\u0E44\u0E21\u0E48\u0E40\u0E1C\u0E47\u0E14" \u0E43\u0E19\u0E2B\u0E21\u0E32\u0E22\u0E40\u0E2B\u0E15\u0E38\u0E15\u0E2D\u0E19\u0E2A\u0E31\u0E48\u0E07\u0E1A\u0E19\u0E40\u0E27\u0E47\u0E1A',
  "- \u0E2B\u0E49\u0E32\u0E21\u0E2B\u0E32\u0E22\u0E44\u0E1B\u0E40\u0E07\u0E35\u0E22\u0E1A \u0E46 \u0E16\u0E49\u0E32\u0E15\u0E2D\u0E1A\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49 \u0E43\u0E2B\u0E49\u0E15\u0E2D\u0E1A\u0E2A\u0E31\u0E49\u0E19 \u0E46 \u0E27\u0E48\u0E32\u0E08\u0E30\u0E15\u0E32\u0E21\u0E17\u0E35\u0E21\u0E07\u0E32\u0E19\u0E23\u0E49\u0E32\u0E19\u0E43\u0E2B\u0E49 \u0E41\u0E25\u0E49\u0E27\u0E0A\u0E27\u0E19\u0E17\u0E31\u0E01 Inbox",
  // R27 (Owner): ตอบโพสชวนสั่งในเว็บ = ถูกแล้ว — เพิ่ม "ชวนเข้าไปสั่งต่อ" ท้ายทุกคำตอบด้วย
  '- \u0E1B\u0E34\u0E14\u0E17\u0E49\u0E32\u0E22\u0E17\u0E38\u0E01\u0E04\u0E33\u0E15\u0E2D\u0E1A\u0E14\u0E49\u0E27\u0E22\u0E04\u0E33\u0E0A\u0E27\u0E19 "\u0E2A\u0E31\u0E48\u0E07\u0E15\u0E48\u0E2D" \u0E17\u0E35\u0E48\u0E40\u0E27\u0E47\u0E1A biteme-baby.com/shop \u0E2A\u0E31\u0E49\u0E19 \u0E46 \u0E40\u0E1B\u0E47\u0E19\u0E18\u0E23\u0E23\u0E21\u0E0A\u0E32\u0E15\u0E34 (\u0E17\u0E38\u0E01\u0E0A\u0E48\u0E2D\u0E07\u0E17\u0E32\u0E07 \u2014 \u0E04\u0E2D\u0E21\u0E40\u0E21\u0E19\u0E15\u0E4C\u0E41\u0E25\u0E30\u0E02\u0E49\u0E2D\u0E04\u0E27\u0E32\u0E21)'
].join("\n");
const CACHE_MS = 5 * 6e4;
const MAX_CHARS = 5e3;
let cache = null;
async function restGet(sbUrl, serviceKey, path) {
  try {
    const r = await fetch(sbUrl + path, {
      headers: { apikey: serviceKey, Authorization: "Bearer " + serviceKey },
      signal: AbortSignal.timeout(8e3)
    });
    if (!r.ok) return null;
    const j = await r.json().catch(() => null);
    return Array.isArray(j) ? j : null;
  } catch {
    return null;
  }
}
function msOfDayOf(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parts = raw.split(":");
  const h = Number(parts[0]);
  const m = Number(parts[1] ?? 0);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 36e5 + m * 6e4;
}
function bkkMsOfDay(utcMs) {
  if (!Number.isFinite(utcMs)) return null;
  const bkk = new Date(utcMs + 7 * 60 * 6e4);
  return bkk.getUTCHours() * 36e5 + bkk.getUTCMinutes() * 6e4 + bkk.getUTCSeconds() * 1e3;
}
function withinShopHours(ms, hm) {
  if (ms === null || !hm) return true;
  if (hm.closeMs <= hm.openMs) return ms >= hm.openMs || ms < hm.closeMs;
  return ms >= hm.openMs && ms < hm.closeMs;
}
function buildStoreStatusLines(rounds, settings, now = /* @__PURE__ */ new Date()) {
  const head = 'STORE STATUS (\u0E2A\u0E14 \u2014 \u0E04\u0E33\u0E19\u0E27\u0E13\u0E08\u0E32\u0E01 delivery_rounds + business_settings \u0E13 \u0E40\u0E27\u0E25\u0E32\u0E19\u0E35\u0E49 \xB7 \u0E16\u0E49\u0E32\u0E02\u0E31\u0E14\u0E01\u0E31\u0E1A\u0E1A\u0E23\u0E23\u0E17\u0E31\u0E14 "\u0E40\u0E27\u0E25\u0E32\u0E40\u0E1B\u0E34\u0E14\u0E23\u0E49\u0E32\u0E19" \u0E02\u0E49\u0E32\u0E07\u0E1A\u0E19 \u0E43\u0E2B\u0E49\u0E43\u0E0A\u0E49\u0E1A\u0E23\u0E23\u0E17\u0E31\u0E14\u0E19\u0E35\u0E49\u0E40\u0E2A\u0E21\u0E2D):';
  const rule = '- \u0E01\u0E15\u0E34\u0E01\u0E32\u0E15\u0E2D\u0E1A: \u0E16\u0E49\u0E32 sameDayOpen = false \u2192 \u0E2B\u0E49\u0E32\u0E21\u0E1A\u0E2D\u0E01\u0E27\u0E48\u0E32 "\u0E2A\u0E31\u0E48\u0E07\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49\u0E44\u0E14\u0E49 / \u0E40\u0E1B\u0E34\u0E14\u0E16\u0E36\u0E07\u0E40\u0E27\u0E25\u0E32\u0E1B\u0E34\u0E14\u0E23\u0E49\u0E32\u0E19" \u0E43\u0E2B\u0E49\u0E0A\u0E27\u0E19\u0E2A\u0E31\u0E48\u0E07\u0E1E\u0E23\u0E35\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E41\u0E25\u0E30\u0E1A\u0E2D\u0E01\u0E23\u0E2D\u0E1A\u0E16\u0E31\u0E14\u0E44\u0E1B (\u0E0A\u0E37\u0E48\u0E2D\u0E23\u0E2D\u0E1A + \u0E27\u0E31\u0E19 + \u0E1B\u0E34\u0E14\u0E23\u0E31\u0E1A HH:MM) \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19 \xB7 \u0E16\u0E49\u0E32\u0E17\u0E38\u0E01\u0E2D\u0E22\u0E48\u0E32\u0E07\u0E1B\u0E34\u0E14 = \u0E1A\u0E2D\u0E01\u0E1B\u0E34\u0E14\u0E15\u0E32\u0E21\u0E08\u0E23\u0E34\u0E07';
  const catalogRule = "- \u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32/\u0E40\u0E21\u0E19\u0E39\u0E17\u0E35\u0E48\u0E1E\u0E39\u0E14\u0E16\u0E36\u0E07 \u0E15\u0E49\u0E2D\u0E07\u0E21\u0E32\u0E08\u0E32\u0E01\u0E1A\u0E23\u0E23\u0E17\u0E31\u0E14 MENU \u0E14\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E07\u0E40\u0E1B\u0E4A\u0E30 \u2014 \u0E2B\u0E49\u0E32\u0E21\u0E41\u0E15\u0E48\u0E07\u0E0A\u0E37\u0E48\u0E2D\u0E2A\u0E34\u0E19\u0E04\u0E49\u0E32\u0E43\u0E2B\u0E21\u0E48 (\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E43\u0E19\u0E23\u0E32\u0E22\u0E01\u0E32\u0E23 = \u0E1A\u0E2D\u0E01\u0E27\u0E48\u0E32\u0E44\u0E21\u0E48\u0E1E\u0E1A\u0E43\u0E19\u0E40\u0E21\u0E19\u0E39\u0E1B\u0E31\u0E08\u0E08\u0E38\u0E1A\u0E31\u0E19\u0E15\u0E32\u0E21\u0E08\u0E23\u0E34\u0E07)";
  if (!rounds) {
    return [
      head,
      "- \u0E14\u0E36\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E23\u0E2D\u0E1A\u0E08\u0E31\u0E14\u0E2A\u0E48\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E43\u0E19\u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49 \u2014 \u0E2B\u0E49\u0E32\u0E21\u0E40\u0E14\u0E32\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E40\u0E1B\u0E34\u0E14/\u0E1B\u0E34\u0E14 \u0E43\u0E2B\u0E49\u0E15\u0E2D\u0E1A\u0E27\u0E48\u0E32\u0E40\u0E0A\u0E47\u0E04\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E40\u0E1B\u0E34\u0E14\u0E23\u0E49\u0E32\u0E19\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E43\u0E19\u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49 \u0E41\u0E25\u0E30\u0E0A\u0E27\u0E19\u0E14\u0E39\u0E40\u0E21\u0E19\u0E39\u0E17\u0E35\u0E48 biteme-baby.com/shop",
      rule,
      catalogRule
    ];
  }
  let hours = null;
  let operating = null;
  for (const row of settings || []) {
    try {
      const v = typeof row.value === "string" ? JSON.parse(row.value) : row.value;
      if (row.key === "hours" && v && typeof v.open === "string" && typeof v.close === "string") {
        hours = { open: String(v.open), close: String(v.close) };
      }
      if (row.key === "operating_hours" && v && typeof v === "object") {
        const op = {};
        for (const [k, val] of Object.entries(v)) {
          if (typeof val === "boolean") op[k] = val;
        }
        operating = op;
      }
    } catch {
    }
  }
  const openMs = hours ? msOfDayOf(hours.open) : null;
  const closeMs = hours ? msOfDayOf(hours.close) : null;
  const shopHoursMs = openMs !== null && closeMs !== null ? { openMs, closeMs } : null;
  const live = rounds.filter((r) => {
    const s = String(r.status || "").toLowerCase();
    return s === "active" || s === "open";
  });
  const utcMs = now.getTime();
  const bkk = new Date(utcMs + 7 * 36e5);
  const today = bkk.toISOString().slice(0, 10);
  const nowMs = bkkMsOfDay(utcMs);
  const nowHm = bkk.toISOString().slice(11, 16);
  if (live.length === 0) {
    return [
      head,
      `- \u0E2A\u0E16\u0E32\u0E19\u0E30 ${nowHm} \u0E19.: \u0E1B\u0E34\u0E14\u0E23\u0E31\u0E1A\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C (\u0E44\u0E21\u0E48\u0E21\u0E35\u0E23\u0E2D\u0E1A\u0E08\u0E31\u0E14\u0E2A\u0E48\u0E07\u0E17\u0E35\u0E48\u0E40\u0E1B\u0E34\u0E14\u0E23\u0E31\u0E1A\u0E2D\u0E22\u0E39\u0E48)`,
      "- sameDayOpen: false",
      rule,
      catalogRule
    ];
  }
  const todayRows = live.filter((r) => {
    const d = r.scheduled_date ? String(r.scheduled_date).slice(0, 10) : null;
    return d === null || d === today;
  });
  const bookableToday = todayRows.filter((r) => {
    const cap = Number(r.max_capacity);
    const used = Number(r.current_count);
    if (Number.isFinite(cap) && Number.isFinite(used) && cap > 0 && used >= cap) return false;
    if (operating) {
      if (operating.same_day_open === false) return false;
      const rk = String(r.round_key || "").trim();
      if (rk && operating[`${rk}_open`] === false) return false;
    }
    if (shopHoursMs && !withinShopHours(nowMs, shopHoursMs)) return false;
    return true;
  });
  const sameDayOpen = bookableToday.length > 0;
  const cutoffAtUtc = (r) => {
    const day = r.scheduled_date ? String(r.scheduled_date).slice(0, 10) : "";
    if (!day) return null;
    const base = Date.parse(`${day}T00:00:00+07:00`);
    if (Number.isNaN(base)) return null;
    const pre = msOfDayOf(r.pre_order_cutoff);
    if (pre !== null) return base + pre;
    const start = msOfDayOf(r.delivery_start);
    if (start !== null) return base + start - 2 * 36e5;
    return null;
  };
  const preOpen = !operating || operating.pre_order_open !== false;
  const nextPre = preOpen ? live.filter((r) => {
    if (operating) {
      const rk = String(r.round_key || "").trim();
      if (rk && operating[`${rk}_open`] === false) return false;
    }
    const t = cutoffAtUtc(r);
    return t === null || utcMs < t;
  }).sort(
    (a, b) => String(a.scheduled_date ?? "").localeCompare(String(b.scheduled_date ?? "")) || String(a.delivery_start ?? "").localeCompare(String(b.delivery_start ?? ""))
  )[0] ?? null : null;
  const futureRows = live.filter((r) => {
    const d = r.scheduled_date ? String(r.scheduled_date).slice(0, 10) : null;
    return d !== null && d > today;
  });
  const stateText = sameDayOpen ? "\u0E40\u0E1B\u0E34\u0E14\u0E23\u0E31\u0E1A\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C Same-Day (\u0E2A\u0E48\u0E07\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49) \u0E44\u0E14\u0E49" : futureRows.length > 0 || nextPre ? "\u0E23\u0E2D\u0E1A\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49\u0E1B\u0E34\u0E14\u0E23\u0E31\u0E1A\u0E41\u0E25\u0E49\u0E27 \u2014 \u0E40\u0E1B\u0E34\u0E14\u0E23\u0E31\u0E1A\u0E1E\u0E23\u0E35\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19" : "\u0E1B\u0E34\u0E14\u0E23\u0E31\u0E1A\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C (\u0E44\u0E21\u0E48\u0E21\u0E35\u0E23\u0E2D\u0E1A\u0E17\u0E35\u0E48\u0E40\u0E1B\u0E34\u0E14\u0E23\u0E31\u0E1A\u0E2D\u0E22\u0E39\u0E48)";
  const hoursLabel = hours ? `${hours.open}-${hours.close} \u0E19.` : "\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E15\u0E31\u0E49\u0E07\u0E04\u0E48\u0E32 (\u0E2B\u0E49\u0E32\u0E21\u0E40\u0E14\u0E32\u0E40\u0E27\u0E25\u0E32\u0E40\u0E1B\u0E34\u0E14\u0E23\u0E49\u0E32\u0E19)";
  const todayList = todayRows.length > 0 ? todayRows.map((r) => {
    const ok = bookableToday.includes(r);
    return `  \xB7 ${r.display_name || r.round_key || "\u0E23\u0E2D\u0E1A"} ${r.delivery_start || "\u2014"}-${r.delivery_end || "\u2014"} \u0E19. (\u0E2A\u0E16\u0E32\u0E19\u0E30 ${r.status}${ok ? " \u2014 \u0E2A\u0E31\u0E48\u0E07\u0E44\u0E14\u0E49" : " \u2014 \u0E1B\u0E34\u0E14\u0E23\u0E31\u0E1A/\u0E40\u0E15\u0E47\u0E21/\u0E19\u0E2D\u0E01\u0E40\u0E27\u0E25\u0E32\u0E40\u0E1B\u0E34\u0E14\u0E23\u0E49\u0E32\u0E19"})`;
  }).join("\n") : "  \xB7 \u0E44\u0E21\u0E48\u0E21\u0E35\u0E23\u0E2D\u0E1A\u0E08\u0E31\u0E14\u0E2A\u0E48\u0E07\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49";
  const preLabel = (() => {
    if (!nextPre) return "\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E40\u0E1B\u0E34\u0E14\u0E23\u0E31\u0E1A\u0E23\u0E2D\u0E1A\u0E16\u0E31\u0E14\u0E44\u0E1B";
    const t = cutoffAtUtc(nextPre);
    const cutoffLabel = t === null ? "\u0E44\u0E21\u0E48\u0E21\u0E35\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1B\u0E34\u0E14\u0E23\u0E31\u0E1A" : `${new Date(t + 7 * 36e5).toISOString().slice(11, 16)} \u0E19.`;
    const day = nextPre.scheduled_date ? String(nextPre.scheduled_date).slice(0, 10) : "";
    return `${nextPre.display_name || "\u0E23\u0E2D\u0E1A\u0E16\u0E31\u0E14\u0E44\u0E1B"}${day ? ` ${day}` : ""} (\u0E1B\u0E34\u0E14\u0E23\u0E31\u0E1A ${cutoffLabel})`;
  })();
  return [
    head,
    `- \u0E2A\u0E16\u0E32\u0E19\u0E30 ${nowHm} \u0E19.: ${stateText}`,
    `- sameDayOpen: ${sameDayOpen ? "true" : "false"} \xB7 \u0E40\u0E27\u0E25\u0E32\u0E40\u0E1B\u0E34\u0E14\u0E23\u0E49\u0E32\u0E19\u0E17\u0E35\u0E48\u0E15\u0E31\u0E49\u0E07\u0E44\u0E27\u0E49: ${hoursLabel}`,
    `- \u0E23\u0E2D\u0E1A\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49:
${todayList}`,
    `- \u0E23\u0E2D\u0E1A\u0E16\u0E31\u0E14\u0E44\u0E1B (\u0E1E\u0E23\u0E35\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C): ${preLabel}`,
    rule,
    catalogRule
  ];
}
function buildMenuCalendarLines(rows, _now = /* @__PURE__ */ new Date()) {
  const head = "MENU CALENDAR (\u0E1B\u0E0E\u0E34\u0E17\u0E34\u0E19\u0E40\u0E21\u0E19\u0E39\u0E08\u0E23\u0E34\u0E07\u0E08\u0E32\u0E01 menu_schedule \u2014 \u0E27\u0E31\u0E19\u0E08\u0E2D\u0E07\u0E25\u0E48\u0E27\u0E07\u0E2B\u0E19\u0E49\u0E32/\u0E1E\u0E23\u0E35\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E15\u0E49\u0E2D\u0E07\u0E2D\u0E49\u0E32\u0E07\u0E08\u0E32\u0E01\u0E19\u0E35\u0E49\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19):";
  const rule = [
    "PRE-ORDER DATE RULES (\u0E01\u0E15\u0E34\u0E01\u0E32\u0E27\u0E31\u0E19\u0E08\u0E2D\u0E07\u0E25\u0E48\u0E27\u0E07\u0E2B\u0E19\u0E49\u0E32):",
    "- \u0E27\u0E31\u0E19/\u0E40\u0E14\u0E37\u0E2D\u0E19\u0E02\u0E2D\u0E07\u0E1E\u0E23\u0E35\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E15\u0E49\u0E2D\u0E07\u0E21\u0E32\u0E08\u0E32\u0E01 MENU CALENDAR \u0E02\u0E49\u0E32\u0E07\u0E1A\u0E19\u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19 \u2014 \u0E2B\u0E49\u0E32\u0E21\u0E40\u0E14\u0E32\u0E27\u0E31\u0E19\u0E40\u0E2D\u0E07 \u0E2B\u0E49\u0E32\u0E21\u0E40\u0E14\u0E32\u0E40\u0E14\u0E37\u0E2D\u0E19\u0E17\u0E35\u0E48\u0E44\u0E21\u0E48\u0E21\u0E35\u0E43\u0E19\u0E1B\u0E0E\u0E34\u0E17\u0E34\u0E19",
    '- \u0E40\u0E21\u0E19\u0E39\u0E17\u0E35\u0E48\u0E0A\u0E37\u0E48\u0E2D\u0E44\u0E21\u0E48\u0E2D\u0E22\u0E39\u0E48\u0E43\u0E19 MENU CALENDAR = \u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E25\u0E07\u0E1B\u0E0E\u0E34\u0E17\u0E34\u0E19 \u2192 \u0E43\u0E2B\u0E49\u0E1E\u0E39\u0E14\u0E27\u0E48\u0E32 "\u0E40\u0E1B\u0E34\u0E14\u0E08\u0E2D\u0E07\u0E25\u0E48\u0E27\u0E07\u0E2B\u0E19\u0E49\u0E32\u0E40\u0E23\u0E47\u0E27 \u0E46 \u0E19\u0E35\u0E49" \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19 \u2014 \u0E2B\u0E49\u0E32\u0E21\u0E1A\u0E2D\u0E01\u0E27\u0E31\u0E19\u0E17\u0E35\u0E48 \u0E2B\u0E49\u0E32\u0E21\u0E1A\u0E2D\u0E01\u0E27\u0E48\u0E32\u0E08\u0E2D\u0E07\u0E44\u0E14\u0E49\u0E41\u0E25\u0E49\u0E27\u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49',
    "- \u0E16\u0E49\u0E32\u0E1B\u0E0E\u0E34\u0E17\u0E34\u0E19\u0E14\u0E36\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49 = \u0E2B\u0E49\u0E32\u0E21\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E27\u0E31\u0E19\u0E1E\u0E23\u0E35\u0E2D\u0E2D\u0E40\u0E14\u0E2D\u0E23\u0E4C\u0E43\u0E14 \u0E46 \u0E43\u0E2B\u0E49\u0E1A\u0E2D\u0E01\u0E15\u0E32\u0E21\u0E08\u0E23\u0E34\u0E07\u0E27\u0E48\u0E32\u0E40\u0E0A\u0E47\u0E04\u0E1B\u0E0E\u0E34\u0E17\u0E34\u0E19\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E43\u0E19\u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49 \u0E41\u0E25\u0E49\u0E27\u0E0A\u0E27\u0E19\u0E14\u0E39\u0E17\u0E35\u0E48 biteme-baby.com/shop"
  ].join("\n");
  if (rows === null) {
    return [head, "  - \u0E14\u0E36\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E1B\u0E0E\u0E34\u0E17\u0E34\u0E19\u0E40\u0E21\u0E19\u0E39\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E43\u0E19\u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49", rule];
  }
  const byDate = /* @__PURE__ */ new Map();
  for (const r of rows) {
    const day = String(r.scheduled_date || "").slice(0, 10);
    const name = String(r.product_name || "").trim();
    if (!day || !name) continue;
    if (!byDate.has(day)) byDate.set(day, []);
    byDate.get(day).push(name);
  }
  const lines = [head];
  if (byDate.size === 0) {
    lines.push("  - (\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E21\u0E35\u0E40\u0E21\u0E19\u0E39\u0E25\u0E07\u0E1B\u0E0E\u0E34\u0E17\u0E34\u0E19 \u2014 \u0E40\u0E21\u0E19\u0E39\u0E17\u0E31\u0E49\u0E07\u0E2B\u0E21\u0E14\u0E22\u0E31\u0E07\u0E44\u0E21\u0E48\u0E25\u0E07\u0E1B\u0E0E\u0E34\u0E17\u0E34\u0E19)");
  } else {
    for (const day of [...byDate.keys()].sort()) {
      lines.push(`  - ${day}: ${byDate.get(day).join(", ")}`);
    }
  }
  return [lines.join("\n"), rule];
}
async function getShopContext(deps, opts = {}) {
  if (!opts.force && cache && Date.now() - cache.at < CACHE_MS) return cache.text;
  const bkkToday = new Date(Date.now() + 7 * 36e5).toISOString().slice(0, 10);
  const [products, categories, promotions, settings, rounds, schedule] = await Promise.all([
    restGet(
      deps.sbUrl,
      deps.serviceKey,
      "/rest/v1/products?select=id,name,price,category_id,is_available,is_featured&order=sort_order.asc&limit=120"
    ),
    restGet(
      deps.sbUrl,
      deps.serviceKey,
      "/rest/v1/product_categories?select=id,name&order=sort_order.asc&limit=40"
    ),
    restGet(
      deps.sbUrl,
      deps.serviceKey,
      "/rest/v1/promotions?select=name,description,discount_type,discount_value,min_order_amount,end_date&limit=20"
    ),
    restGet(
      deps.sbUrl,
      deps.serviceKey,
      "/rest/v1/business_settings?select=key,value&limit=40"
    ),
    // R43 B4: รอบจัดส่งจริง → คำนวณ STORE STATUS (สด) (mirror เว็บ · ห้ามตอบจากเวลา static)
    restGet(
      deps.sbUrl,
      deps.serviceKey,
      "/rest/v1/delivery_rounds?select=status,display_name,cutoff_time,pre_order_cutoff,delivery_start,delivery_end,max_capacity,current_count,scheduled_date,round_key&order=scheduled_date.asc&limit=40"
    ),
    // R58: ปฎิทินเมนูจริง (published, วันนี้เป็นต้นไป) → วันพรีออเดอร์ต้องผูกวันจริง
    restGet(
      deps.sbUrl,
      deps.serviceKey,
      `/rest/v1/menu_schedule?select=scheduled_date,product_id&is_published=eq.true&scheduled_date=gte.${bkkToday}&order=scheduled_date.asc&limit=200`
    )
  ]);
  const anyData = products || categories || promotions || settings || rounds || schedule;
  if (!anyData) {
    cache = { at: Date.now(), text: "" };
    return "";
  }
  const catName = /* @__PURE__ */ new Map();
  for (const c of categories || []) catName.set(String(c.id), String(c.name));
  const lines = ["SHOP FACTS (\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E23\u0E49\u0E32\u0E19\u0E08\u0E23\u0E34\u0E07):", SHOP_FACTS_TH];
  lines.push(
    rounds ? buildStoreStatusLines(rounds, settings, /* @__PURE__ */ new Date()).join("\n") : [
      "STORE STATUS (\u0E2A\u0E14):",
      "- \u0E14\u0E36\u0E07\u0E02\u0E49\u0E2D\u0E21\u0E39\u0E25\u0E23\u0E2D\u0E1A\u0E08\u0E31\u0E14\u0E2A\u0E48\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E43\u0E19\u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49 \u2014 \u0E2B\u0E49\u0E32\u0E21\u0E40\u0E14\u0E32\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E40\u0E1B\u0E34\u0E14/\u0E1B\u0E34\u0E14 \u0E43\u0E2B\u0E49\u0E15\u0E2D\u0E1A\u0E27\u0E48\u0E32\u0E40\u0E0A\u0E47\u0E04\u0E2A\u0E16\u0E32\u0E19\u0E30\u0E40\u0E1B\u0E34\u0E14\u0E23\u0E49\u0E32\u0E19\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E43\u0E19\u0E15\u0E2D\u0E19\u0E19\u0E35\u0E49 \u0E41\u0E25\u0E30\u0E0A\u0E27\u0E19\u0E14\u0E39\u0E40\u0E21\u0E19\u0E39\u0E17\u0E35\u0E48 biteme-baby.com/shop"
    ].join("\n")
  );
  const available = (products || []).filter((p) => p.is_available);
  const unavailable = (products || []).filter((p) => !p.is_available);
  if (available.length > 0) {
    lines.push("MENU (\u0E02\u0E32\u0E22\u0E44\u0E14\u0E49\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49 \u2014 \u0E23\u0E32\u0E04\u0E32\u0E08\u0E32\u0E01 DB \u0E40\u0E17\u0E48\u0E32\u0E19\u0E31\u0E49\u0E19):");
    const byCat = /* @__PURE__ */ new Map();
    for (const p of available) {
      const key = String(p.category_id || "\u0E2D\u0E37\u0E48\u0E19 \u0E46");
      if (!byCat.has(key)) byCat.set(key, []);
      byCat.get(key).push(p);
    }
    for (const [catId, items] of byCat) {
      lines.push(
        `  [${catName.get(catId) || catId}]: ` + items.map((p) => `${p.name} ${p.price}\u0E3F${p.is_featured ? "\u2605\u0E41\u0E19\u0E30\u0E19\u0E33" : ""}`).join(", ")
      );
    }
  }
  if (unavailable.length > 0) {
    lines.push("MENU \u0E2B\u0E21\u0E14\u0E27\u0E31\u0E19\u0E19\u0E35\u0E49 (\u0E2B\u0E49\u0E32\u0E21\u0E1A\u0E2D\u0E01\u0E27\u0E48\u0E32\u0E2A\u0E31\u0E48\u0E07\u0E44\u0E14\u0E49): " + unavailable.map((p) => p.name).join(", "));
  }
  {
    const nameById = /* @__PURE__ */ new Map();
    for (const p of products || []) nameById.set(String(p.id), String(p.name));
    const rowsWithNames = schedule === null ? null : schedule.map((r) => ({
      scheduled_date: r.scheduled_date,
      product_name: nameById.get(String(r.product_id || "")) || null
    }));
    lines.push(...buildMenuCalendarLines(rowsWithNames, /* @__PURE__ */ new Date()));
  }
  if (promotions && promotions.length > 0) {
    lines.push("PROMOTIONS (active):");
    for (const promo of promotions) {
      const parts = [String(promo.name)];
      if (promo.discount_type === "percentage" && promo.discount_value != null) parts.push(`\u0E25\u0E14 ${promo.discount_value}%`);
      else if (promo.discount_type === "fixed_amount" && promo.discount_value != null) parts.push(`\u0E25\u0E14 ${promo.discount_value}\u0E3F`);
      if (promo.min_order_amount) parts.push(`\u0E02\u0E31\u0E49\u0E19\u0E15\u0E48\u0E33 ${promo.min_order_amount}\u0E3F`);
      if (promo.end_date) parts.push(`\u0E16\u0E36\u0E07 ${promo.end_date}`);
      lines.push("  - " + parts.join(" "));
    }
  }
  if (settings && settings.length > 0) {
    lines.push("STORE SETTINGS:");
    for (const s of settings) {
      const brief = JSON.stringify(s.value);
      if (brief && brief.length <= 200) lines.push(`  - ${s.key}: ${brief}`);
    }
  }
  let text = lines.join("\n");
  if (text.length > MAX_CHARS) text = text.slice(0, MAX_CHARS - 3) + "...";
  cache = { at: Date.now(), text };
  return text;
}
function resetShopContextCache() {
  cache = null;
}
export {
  BITE_PERSONA_SEGMENT,
  REPLY_CONTINUITY_RULES,
  SHOP_FACTS_TH,
  buildMenuCalendarLines,
  buildStoreStatusLines,
  getShopContext,
  resetShopContextCache
};
