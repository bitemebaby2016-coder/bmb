// TEMP probe 6 (2026-10-26) — L-8 safety: tests ที่ click add/render พื้นผิวที่จะแก้
const fs = require('fs');
const p = require('path');
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(p.join(d, e.name)) : [p.join(d, e.name)]));
const testFiles = walk('src/__tests__').filter((f) => /\.tsx?$/.test(f));

function grep(name, re, limit = 60) {
  const hits = [];
  for (const f of testFiles) {
    fs.readFileSync(f, 'utf8').split(/\r?\n/).forEach((l, i) => { if (re.test(l)) hits.push(`${p.basename(f)}:${i + 1}: ${l.trim().slice(0, 130)}`); });
  }
  console.log(`\n===== ${name} (${hits.length}) =====`);
  console.log(hits.slice(0, limit).join('\n') || 'NONE');
}

grep('theater add interactions', /theater-hero-add|theater-rec-add|FoodTheater|RecommendationCard|TheaterHeroCard/);
grep('TalkToBite component interactions', /TalkToBite|ttb-product-card|confirmDraft/);
grep('CartPage render', /CartPage|go-checkout/);
grep('handlePreOrder/runOrderBuilder behavioral', /runOrderBuilder|handlePreOrder/);
grep('menuTabItems name collision', /menuTabItems/);
grep('handleReviewCta/deriveOrderMode in tests', /handleReviewCta|deriveOrderMode/);
