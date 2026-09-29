const https = require("https");
const key = "sb_publishable_Q7AHrjSYOrysDjxS9_ZB-g_NMmytLOH";
const host = "ivkdfognyiwjcmrhcnwz.supabase.co";

function query(path) {
  return new Promise((resolve, reject) => {
    https.get({ hostname: host, path: path, headers: { "apikey": key, "Authorization": "Bearer " + key } }, res => {
      let data = "";
      res.on("data", c => data += c);
      res.on("end", () => resolve(JSON.parse(data)));
    }).on("error", reject);
  });
}

query("/rest/v1/migration_history?select=version%2Cstatement&order=version.desc").then(r => {
  console.log("=== MIGRATION HISTORY (last 5) ===");
  const items = Array.isArray(r) ? r : [];
  items.slice(0, 5).forEach(m => {
    const s = m.statement || "";
    console.log(`v${m.version}: ${s.substring(0,80)}...`);
  });
  if (items.length === 0) console.log("No migrations found or API returned empty");
}).catch(e => console.error("Error:", e.message));
