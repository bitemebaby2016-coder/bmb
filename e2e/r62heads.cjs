// helper: list markdown headings with line numbers
const fs = require('fs');
const [,, file, filter] = process.argv;
const L = fs.readFileSync(file, 'utf8').split(/\r?\n/);
L.forEach((s, i) => {
  if (/^#{1,4} /.test(s) && (!filter || s.toLowerCase().includes(filter.toLowerCase()))) {
    console.log((i + 1) + ': ' + s.slice(0, 110));
  }
});
