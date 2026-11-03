// helper: print last N lines of a file (default 30)
const fs = require('fs');
const [,, file, n] = process.argv;
const L = fs.readFileSync(file, 'utf8').split(/\r?\n/);
const k = parseInt(n || '30', 10);
console.log('TOTAL_LINES=' + L.length);
console.log(L.slice(-k).join('\n'));
