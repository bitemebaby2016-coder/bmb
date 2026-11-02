// R52: list test files that reference any source file edited by R52 codemods (dependency-driven test selection)
// Run: node e2e\r52_grep_tests.cjs
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
const TESTS = path.join(ROOT, 'src', '__tests__');
const PATTERNS = [
  'CategorySections', 'HomePage', 'ReviewCarouselSection', 'ReviewGallerySection',
  'VerifiedReviewsSection', 'PromotionStrip', 'MenuPage', 'ReviewPage',
  'LoginPage', 'RegisterPage', 'ResetPasswordPage', 'socialLinks',
  'Footer', 'MascotBadge', 'index.css',
];
const hits = [];
for (const f of fs.readdirSync(TESTS)) {
  if (!f.endsWith('.ts')) continue;
  const txt = fs.readFileSync(path.join(TESTS, f), 'utf8');
  if (PATTERNS.some((p) => txt.includes(p))) hits.push(f);
}
console.log(hits.join('\n'));
console.log('--- total: ' + hits.length);