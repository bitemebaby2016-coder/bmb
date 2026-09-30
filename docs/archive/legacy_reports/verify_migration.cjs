const https = require("https");

const key = "sb_publishable_Q7AHrjSYOrysDjxS9_ZB-g_NMmytLOH";
const host = "ivkdfognyiwjcmrhcnwz.supabase.co";

// 1. Check migration history for 078
const opts1 = {
  hostname: host,
  path: "/rest/v1/migration_history?select=version%2Cstatement&order=version.asc",
  headers: { "apikey": key, "Authorization": "Bearer " + key }
};

const req1 = https.request(opts1, (res) => {
  let data = "";
  res.on("data", c => data += c);
  res.on("end", () => {
    const migrations = JSON.parse(data);
    console.log("=== MIGRATION HISTORY ===");
    migrations.forEach(m => {
      if (m.version >= "074") {
        const stmtLen = m.statement ? m.statement.length : 0;
        console.log(`Migration ${m.version}: ${stmtLen > 0 ? stmtLen + " bytes" : "empty"} — statement starts with "${(m.statement||'').substring(0,60)}..."`);
      }
    });
    
    // 2. Check RLS policies on mascot_overrides
    checkPolicies();
  });
});

req1.on("error", e => console.error("Error:", e.message));
req1.end();

function checkPolicies() {
  const opts2 = {
    hostname: host,
    path: "/rest/v1/pg_policies?select=policyname%2Ctablename%2Ccmd%2Cqual",
    headers: { "apikey": key, "Authorization": "Bearer " + key }
  };

  const req2 = https.request(opts2, (res) => {
    let data = "";
    res.on("data", c => data += c);
    res.on("end", () => {
      try {
        const policies = JSON.parse(data);
        console.log("\n=== MASCOT POLICIES ===");
        policies.filter(p => p.tablename === "mascot_overrides").forEach(p => {
          console.log(`Policy: ${p.policyname} | Cmd: ${p.cmd} | Qual: ${(p.qual||'N/A').substring(0,120)}`);
        });
      } catch(e) { console.error("Parse error:", e.message); }
      
      // 3. Check brands count
      checkBrands();
    });
  });
  req2.on("error", e => console.error("Error:", e.message));
  req2.end();
}

function checkBrands() {
  const opts3 = {
    hostname: host,
    path: "/rest/v1/brands?select=id%2Cslug%2Cstatus%2Cis_published&count=exact",
    headers: { "apikey": key, "Authorization": "Bearer " + key }
  };

  const req3 = https.request(opts3, (res) => {
    let d = ""; res.on("data", c => d += c);
    res.on("end", () => {
      const data = JSON.parse(d);
      const count = res.headers["content-range"] ? parseInt(res.headers["content-range"].split("/")[1]) : data.length;
      console.log(`\n=== BRANDS COUNT: ${count} ===`);
      data.forEach(b => console.log(`  ${b.slug} ? status=${b.status}, published=${b.is_published}`));
      
      // 4. Check tenants
      const opts4 = { ...opts3, path: "/rest/v1/tenants?select=id%2Cname%2Cdefault_brand_id&count=exact" };
      const req4 = https.request(opts4, (res) => {
        let d = ""; res.on("data", c => d += c);
        res.on("end", () => {
          const tData = JSON.parse(d);
          const tCount = res.headers["content-range"] ? parseInt(res.headers["content-range"].split("/")[1]) : tData.length;
          console.log(`\n=== TENANTS COUNT: ${tCount} ===`);
          tData.forEach(t => console.log(`  ${t.id} ? name=${t.name}, default_brand=${t.default_brand_id}`));
          
          console.log("\nDONE");
        });
      });
      req4.on("error", e => console.error(e.message));
      req4.end();
    });
  });
  req3.on("error", e => console.error(e.message));
  req3.end();
}
