// helper: find lines containing a literal substring in a file
const fs = require('fs');
const [,, file, needle] = process.argv;
const L = fs.readFileSync(file, 'utf8').split(/\r?\n/);
L.forEach((s, i) => {
  if (s.includes(needle)) console.log((i + 1) + ': ' + s.slice(0, 200));
});
