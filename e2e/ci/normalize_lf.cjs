// Usage: node e2e/ci/normalize_lf.cjs <file> [file...]
// แปลงไฟล์ข้อความเป็น LF — บังคับก่อนรัน shell script ใน container
// (Windows checkout/editor ให้ CRLF แล้ว bash จะพัง)
const fs = require('fs');
for (const p of process.argv.slice(2)) {
  const s = fs.readFileSync(p, 'utf8');
  const out = s.replace(/\r\n/g, '\n');
  fs.writeFileSync(p, out);
  const left = (fs.readFileSync(p, 'utf8').match(/\r/g) || []).length;
  console.log(p, '->LF, CR left:', left);
  if (left > 0) process.exitCode = 1;
}