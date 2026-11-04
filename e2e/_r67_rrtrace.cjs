'use strict'
// _r67_rrtrace — diagnostic build: dump every react-router module in the graph
// (+ its importers) to find what pulls the SECOND (CJS) copy.
const fs = require('fs')
const path = require('path')

const PROJ = 'D:/A PROJECT/Bite Me Baby'
const LOG = path.join(PROJ, 'e2e', '_r67_rr_modules.log')

const tracePlugin = {
  name: 'r67-rr-trace',
  moduleParsed(info) {
    const id = String(info.id || '')
    if (!id.includes('react-router')) return
    const importers = (info.importers || []).map((s) => String(s).split(/[\\/]/).slice(-3).join('/'))
    const line = 'MODULE ' + id + '\n    FROM: ' + (importers.join(' | ') || '(entry)') + '\n'
    fs.appendFileSync(LOG, line, 'utf8')
  },
  resolveId: {
    order: 'pre',
    handler(id) {
      if (id.includes('react-router')) fs.appendFileSync(LOG, 'RESOLVE ' + id + '\n', 'utf8')
      return null
    },
  },
}

;(async () => {
  fs.writeFileSync(LOG, '# r67 react-router module trace\n', 'utf8')
  const vite = await import('vite')
  const loaded = await vite.loadConfigFromFile({ command: 'build', mode: 'production' }, path.join(PROJ, 'vite.config.ts'), PROJ)
  if (!loaded) throw new Error('vite.config.ts could not be loaded')
  const cfg = loaded.config || {}
  const plugins = Array.isArray(cfg.plugins) ? cfg.plugins.slice() : []
  plugins.push(tracePlugin)
  await vite.build({
    ...cfg,
    configFile: false,
    root: PROJ,
    plugins,
    logLevel: 'warn',
  })
  fs.appendFileSync(LOG, 'BUILD_DONE\n', 'utf8')
  console.log('TRACE_DONE')
  process.exit(0)
})().catch((e) => {
  fs.appendFileSync(LOG, 'FATAL ' + String(e && e.stack ? e.stack : e).slice(0, 1200) + '\n', 'utf8')
  console.log('FATAL ' + String(e).slice(0, 300))
  process.exit(1)
})