// temp: locate scroll helper definitions/usages in HomePage (DELETE before session end)
const fs = require('fs')
const s = fs.readFileSync('D:/A PROJECT/Bite Me Baby/src/pages/HomePage.tsx', 'utf8')
s.split('\n').forEach((l, i) => { if (l.includes('scrollToSection')) console.log(`${i + 1}: ${l}`) })
