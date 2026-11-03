// helper: dump line-numbered slice of a file (R62)
const fs = require('fs');
const [,, file, start, end] = process.argv;
const L = fs.readFileSync(file, 'utf8').split(/\r?\n/);
const s = Math.max(1, parseInt(start || '1', 10)) - 1;
const e = end ? parseInt(end, 10) : L.length;
console.log(L.slice(s, e).map((x, i) => (i + s + 1) + ': ' + x).join('\n'));
