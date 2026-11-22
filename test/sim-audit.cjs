// 모의 토벌 랭킹 2단계 재현 확인 — GitHub Actions(.github/workflows/sim-audit.yml)가 하루 한 번 돌린다(기획 2026-11-22)
//   서버 sim_audit 로 이번 주 판마다 상위 10 중 아직 확인 안 한 기록을 받아, 그 기록의 판 번호(v = PATCH_ID)와 같은 game.js 를 저장소 기록에서 찾아
//   같은 작전 · 전장으로 다시 계산(simRun — 그리지 않는 길, 엔진 · 화면 크기와 상관없이 같은 결과)하고, sim_flag 로 같음 / 다름을 넣는다
//   SIM_AUDIT — 비밀 값(GitHub 비밀 · 서버 sim_audit_key 와 같은 값). 없으면 아무것도 안 하고 끝난다
//   로컬 시험: ROWS=<기록 JSON 파일> DRY=1 node test/sim-audit.cjs — 서버를 부르지 않고 결과만 찍는다
const fs = require('fs'), path = require('path'), http = require('http'), { execFileSync } = require('child_process')
const ROOT = path.join(__dirname, '..'), git = (...a) => execFileSync('git', a, { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 })
const src = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8')
const URL = src.match(/url: '(https:\/\/[^']+\.supabase\.co)'/)?.[1], KEY = src.match(/sb_publishable_[A-Za-z0-9_-]+/)?.[0]
const SECRET = process.env.SIM_AUDIT, DRY = !!process.env.DRY
const rpc = async (fn, body) => { const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, { method: 'POST', headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); if (!r.ok) throw new Error(`${fn} ${r.status} ${await r.text()}`); return r.json() }
/** 판 번호 — game.js 의 PATCH_ID(`${PATCH[0][0]}#${PATCH[0][1].length}`)를 글에서 그대로 센다 */
const patchId = s => { const a = s.indexOf('const PATCH = ['); if (a < 0) return null; const m = s.slice(a).match(/\[\s*'(\d{4}-\d{2}-\d{2})',\s*\[([\s\S]*?)\n  \]\],/); return m ? `${m[1]}#${(m[2].match(/^\s*\['(?:new|up|down|fix)'/gm) || []).length}` : null }
/** 그 판 번호를 가진 커밋들 — 기록 시각(at) 이전 것(나중 것부터) → 그 뒤 것. 판 번호를 안 올리고 계산이 바뀐 커밋이 끼어도 그때 배포본으로 맞춰 보게(하나라도 같으면 같음 · QC) */
let LOG = null
function commitsOf(v, at) {
  LOG ||= git('log', '--format=%H %ct', '--', 'game.js').split('\n').filter(Boolean).map(l => { const [c, t] = l.split(' '); return { c, t: +t * 1000, v: patchId(git('show', `${c}:game.js`)) } })
  const hit = LOG.filter(x => x.v === v), t = Date.parse(at) || Infinity
  return [...hit.filter(x => x.t <= t), ...hit.filter(x => x.t > t)].map(x => x.c)
}
const MIME = { '.js': 'text/javascript', '.html': 'text/html', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.webp': 'image/webp', '.ico': 'image/x-icon' }
const serve = dir => new Promise(ok => { const s = http.createServer((q, r) => { const f = path.join(dir, decodeURIComponent(q.url.split('?')[0]).replace(/\/$/, '/index.html')); if (!f.startsWith(dir) || !fs.existsSync(f)) { r.writeHead(404); return r.end() } r.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); fs.createReadStream(f).pipe(r) }).listen(0, '127.0.0.1', () => ok(s)) })
const same = (r, e) => r.kind === e.kind && r.t === e.t && r.kills === e.kills && r.bosses === e.bosses && (r.lv || 0) === (e.lv || 0) && r.lvl === e.lvl
;(async () => {
  if (!SECRET && !process.env.ROWS) return console.log('SIM_AUDIT 없음 — 건너뜀')
  if (!process.env.ROWS && patchId(src) == null) throw new Error('PATCH_ID 를 못 셈')
  const rows = process.env.ROWS ? JSON.parse(fs.readFileSync(process.env.ROWS, 'utf8')) : await rpc('sim_audit', { key: SECRET })
  console.log(`확인할 기록 ${rows.length}개`)
  if (!rows.length) return
  const { chromium } = require('playwright'), b = await chromium.launch(), tally = { same: 0, diff: 0, skip: 0 }, pages = new Map()
  const pageOf = async c => {   // 커밋마다 한 번 꺼내 띄운다(worktree + 작은 서버 + 창)
    if (pages.has(c)) return pages.get(c).p
    const dir = fs.mkdtempSync('/tmp/sim-audit-'); git('worktree', 'add', '--detach', dir, c)
    const srv = await serve(dir), p = await b.newPage({ viewport: { width: 1280, height: 800 } }); pages.set(c, { dir, srv, p })
    await p.goto(`http://127.0.0.1:${srv.address().port}/`); await p.evaluate(() => localStorage.setItem('mjg.v1', JSON.stringify({ noStats: true, seen: 1, diff: 'normal', theme: 'winter' }))); await p.reload(); await p.waitForFunction(() => window.__mjg?.simRun, null, { timeout: 30000 })
    return p
  }
  try {
    for (const r of rows) {
      const cs = commitsOf(r.v, r.at)
      if (!cs.length) { console.log(`판 번호 ${r.v} 커밋 없음 — 건너뜀`); tally.skip++; continue }
      let ok = false, got = ''
      for (const c of cs) {
        const e = await (await pageOf(c)).evaluate(async plan => { const e = await window.__mjg.simRun(plan); return { kind: e.kind, t: Math.floor(e.t), kills: e.kills, bosses: e.bosses, lv: e.lv || 0, lvl: e.lvl } },
          { ch: r.ch, diff: r.diff, winter: r.winter, s: r.s, w: r.w.split(' '), p: r.p ? r.p.split(' ') : [], seed: r.field })
        got = JSON.stringify(e); if ((ok = same(r, e))) break
      }
      tally[ok ? 'same' : 'diff']++; console.log(`${ok ? '같음' : '다름'} ${r.v} ${r.diff}/${r.winter ? '겨울' : '풀밭'} ${r.ch} ${r.w} — 올린 ${JSON.stringify({ kind: r.kind, t: r.t, kills: r.kills, bosses: r.bosses, lv: r.lv, lvl: r.lvl })} · 다시 ${got}${cs.length > 1 ? ` (커밋 ${cs.length}개 중)` : ''}`)
      if (!DRY) console.log('  →', await rpc('sim_flag', { key: SECRET, u: r.uid, wk: r.wk, diff: r.diff, winter: r.winter, at: r.at, same: ok, got }))
    }
  } finally { for (const { dir, srv, p } of pages.values()) { await p.close(); srv.close(); git('worktree', 'remove', '--force', dir) } }
  await b.close(); console.log('끝', JSON.stringify(tally))
})().catch(e => { console.error(e); process.exit(1) })
