// PHASE 7 pre-commit gate: staged summary + secret scan (read-only)
const { execSync } = require('child_process');
const stat = execSync('git diff --cached --stat', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
const names = execSync('git diff --cached --name-status', { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split(/\r?\n/).filter(Boolean);
const counts = {};
for (const l of names) { const k = l.split('\t')[0][0]; counts[k] = (counts[k] || 0) + 1; }

const diff = execSync('git diff --cached', { encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 });
const patterns = [
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'PRIVATE_KEY'],
  [/AKIA[0-9A-Z]{16}/, 'AWS_KEY'],
  [/gh[pousr]_[A-Za-z0-9]{36}/, 'GH_TOKEN'],
  [/sk-[A-Za-z0-9]{20,}/, 'SK_KEY'],
  [/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/, 'JWT'],
  [/service_role[_ ]?key["'\s:=]+[A-Za-z0-9._-]{30,}/i, 'SERVICE_ROLE'],
  [/SUPABASE_ACCESS_TOKEN\s*=\s*[A-Za-z0-9._-]{20,}/, 'SUPABASE_TOKEN'],
  [/password\s*[:=]\s*["'][^"']{8,}["']/i, 'PASSWORD_LIT'],
];
const hits = [];
for (const m of patterns) {
  const found = diff.match(new RegExp(m[0], 'g'));
  if (found) hits.push({ type: m[1], count: found.length, sample: found[0].slice(0, 25) });
}
console.log(JSON.stringify({
  stagedNameStatus: counts,
  totalFiles: names.length,
  statTail: stat.split('\n').slice(-3).join('\n'),
  SECRET_HITS: hits,
  head: execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim(),
}, null, 1));
