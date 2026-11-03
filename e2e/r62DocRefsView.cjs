// summarize r62DocRefs-result.json: which root/docs md are referenced from code
const r = require('./r62DocRefs-result.json');
const refRoot = Object.keys(r.referenced).filter(k => k.indexOf('/') < 0);
const refDocs = Object.keys(r.referenced).filter(k => k.indexOf('docs/') === 0);
console.log('REFERENCED_ROOT(' + refRoot.length + '):');
for (const k of refRoot) console.log('  ' + k + ' <- ' + r.referenced[k].slice(0, 5).join(', ') + (r.referenced[k].length > 5 ? ' +' + (r.referenced[k].length - 5) : ''));
console.log('REFERENCED_DOCS(' + refDocs.length + '):');
for (const k of refDocs) console.log('  ' + k + ' <- ' + r.referenced[k].slice(0, 5).join(', ') + (r.referenced[k].length > 5 ? ' +' + (r.referenced[k].length - 5) : ''));
