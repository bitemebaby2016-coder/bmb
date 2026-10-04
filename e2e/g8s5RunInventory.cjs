// G8-S5 diagnostic - unauthenticated GitHub API, read-only run inventory
const OWNER = 'bitemebaby2016-coder'
const REPO = 'bmb'
;(async () => {
  const runs = await (await fetch('https://api.github.com/repos/' + OWNER + '/' + REPO + '/actions/runs?per_page=30')).json()
  console.log('TOTAL_COUNT=' + runs.total_count)
  for (const r of runs.workflow_runs || []) {
    console.log('run=' + r.id + ' ev=' + r.event + ' st=' + r.status + ' cc=' + r.conclusion + ' created=' + r.created_at + ' wf=' + r.name + ' sha=' + r.head_sha.slice(0, 7) + ' br=' + r.head_branch)
  }
  console.log('--- run 37128641566 detail ---')
  const d = await (await fetch('https://api.github.com/repos/' + OWNER + '/' + REPO + '/actions/runs/37128641566')).json()
  console.log(JSON.stringify({ id: d.id, event: d.event, status: d.status, conclusion: d.conclusion, created_at: d.created_at, updated_at: d.updated_at, head_sha: d.head_sha, path: d.path, name: d.name, head_branch: d.head_branch }))
  console.log('--- repo ---')
  const repo = await (await fetch('https://api.github.com/repos/' + OWNER + '/' + REPO)).json()
  console.log(JSON.stringify({ full_name: repo.full_name, default_branch: repo.default_branch, private: repo.private }))
})().catch((e) => console.log('FATAL ' + String(e).slice(0, 300)))