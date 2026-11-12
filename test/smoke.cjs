// 스모크 테스트 — 실행: python3 -m http.server 8765 를 띄우고 NODE_PATH=<playwright 가 있는 node_modules> node test/smoke.cjs (그림은 test/shots/).
//   처음 화면 → 캐릭터 → 판 → 상자 → 최종보스까지 빨리 돌리기(무적) → 세이렌 → 클리어. 콘솔 에러가 하나라도 있으면 실패
const { chromium } = require('playwright')
const OUT = __dirname + '/shots/'; require('fs').mkdirSync(OUT, { recursive: true })
const URL = process.env.URL || 'http://127.0.0.1:8765/', M_DARK = 29 * 60, M_END = 30 * 60

;(async () => {
  const browser = await chromium.launch()
  const errors = []
  const run = async (name, viewport, fn) => {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 2 })
    page.on('pageerror', e => errors.push(`[${name}] ${e.message}`))
    page.on('console', m => { if (m.type() === 'error') errors.push(`[${name}] console: ${m.text()}`) })
    await page.goto(URL); await page.waitForTimeout(600)
    await fn(page)
    await page.close()
  }
  const sim = (page, until, opts = {}) => page.evaluate(([until, opts]) => {
    const M = window.__mjg, t0 = performance.now(); let n = 0
    while (M.G && M.G.t < until && M.mode !== 'over') {
      if (opts.god) M.pl.inv = 1e9
      if (M.mode === 'box') M.pick0()
      M.step(1 / 30); n++
      if (opts.walk) { M.pl.x += Math.cos(M.G.t * 0.3) * 2; M.pl.y += Math.sin(M.G.t * 0.21) * 2 }
    }
    return { ms: (performance.now() - t0) / n, t: M.G?.t, lvl: M.G?.lvl, kills: M.G?.kills, foes: M.G?.foes.length, mode: M.mode, weapons: M.G?.weapons.map(w => w.id + w.lv).join(' ') }
  }, [until, opts])

  await run('desktop', { width: 1280, height: 800 }, async page => {
    await page.screenshot({ path: OUT + '1-title.png' })
    await page.getByRole('button', { name: '☕ 후원' }).click(); await page.waitForTimeout(200)   // 후원 창 — 세 칸
    await page.screenshot({ path: OUT + '1-donate.png' })
    const dons = await page.locator('.don').count(); if (dons !== 3) errors.push(`[desktop] 후원 칸 ${dons}`)
    await page.getByRole('button', { name: '← 처음으로' }).click()
    await page.getByRole('button', { name: '도감' }).click(); await page.waitForTimeout(300)
    await page.screenshot({ path: OUT + '2-guide.png', fullPage: true })
    const dock = await page.evaluate(() => { const u = document.getElementById('ui'); u.scrollTop = 900; const r = [...document.querySelectorAll('.guide .btn')].pop().getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight })
    if (!dock) errors.push('[desktop] 도감 「처음으로」가 아래에 고정되지 않음')
    await page.getByRole('button', { name: '← 처음으로' }).click()
    await page.getByRole('button', { name: '토벌 시작!' }).click(); await page.waitForTimeout(300)
    await page.screenshot({ path: OUT + '3-chars.png' })
    const same = await page.evaluate(async () => { const before = document.querySelector('.panel'); document.querySelectorAll('.char')[3].click(); await new Promise(r => setTimeout(r, 50)); const on = document.querySelectorAll('.char.on').length; document.querySelectorAll('.char')[0].click(); return before === document.querySelector('.panel') && on === 1 })
    if (!same) errors.push('[desktop] 캐릭터를 고를 때 화면을 새로 그린다(깜빡임)')
    await page.getByRole('button', { name: '토벌 시작!' }).click(); await page.waitForTimeout(200)
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(2500); await page.keyboard.up('ArrowRight')
    await page.screenshot({ path: OUT + '4-play.png' })
    // 첫 상자가 열릴 때까지
    await page.evaluate(() => { const M = window.__mjg; while (M.mode === 'play' && M.G.t < 120) { M.pl.inv = 1e9; M.step(1 / 30) } })
    await page.waitForTimeout(700)
    await page.screenshot({ path: OUT + '5-box.png' })
    console.log('box mode:', await page.evaluate(() => window.__mjg.mode))
    await page.keyboard.press('Digit1'); await page.waitForTimeout(200)
    let r = await sim(page, 330, { god: true, walk: true }); console.log('5:30', r)
    await page.evaluate(() => { const M = window.__mjg; M.step(1 / 30) }); await page.waitForTimeout(100)
    await page.evaluate(() => window.__mjg.step(0.001))
    await page.screenshot({ path: OUT + '6-boss5.png' })
    const F = await page.evaluate(() => window.__mjg.FINAL_T)
    r = await sim(page, F + 5, { god: true, walk: true }); console.log('final+5s', r)
    await page.screenshot({ path: OUT + '7-siren.png' })
    r = await sim(page, F + 60, { god: true, walk: true }); console.log('final+60s', r)
    const fin = await page.evaluate(() => { const F = window.__mjg.G.final; return F && { siren: Math.round(F.siren.hp), max: Math.round(F.siren.max), dead: F.siren.dead, mer: F.mermaids.map(m => m.dead ? 'x' : Math.round(m.hp)) } })
    console.log('final', fin)
    await page.screenshot({ path: OUT + '8-siren2.png' })
    // 남은 피를 줄여 클리어까지
    await page.evaluate(() => { const F = window.__mjg.G.final; for (const m of F.mermaids) m.hp = Math.min(m.hp, 1); F.siren.hp = Math.min(F.siren.hp, 50) })
    r = await sim(page, F + 200, { god: true }); console.log('clear', r)
    await page.waitForTimeout(300)
    await page.screenshot({ path: OUT + '9-result.png' })
    console.log('saved', await page.evaluate(() => localStorage.getItem('mjg.v1')))
  })

  await run('phone', { width: 390, height: 844 }, async page => {
    await page.screenshot({ path: OUT + 'm1-title.png' })
    await page.getByRole('button', { name: '토벌 시작!' }).click(); await page.waitForTimeout(300)
    await page.screenshot({ path: OUT + 'm2-chars.png', fullPage: true })
    await page.locator('.char').nth(2).click(); await page.locator('.char').nth(2).click(); await page.waitForTimeout(200)
    // 손가락 스틱
    await page.mouse.move(200, 600); await page.mouse.down(); await page.mouse.move(150, 560, { steps: 5 }); await page.waitForTimeout(1500)
    await page.screenshot({ path: OUT + 'm3-play.png' })
    await page.mouse.up()
    await page.evaluate(() => { const M = window.__mjg; while (M.mode === 'play' && M.G.t < 120) { M.pl.inv = 1e9; M.step(1 / 30) } })
    await page.waitForTimeout(700)
    await page.screenshot({ path: OUT + 'm4-box.png' })
    await page.evaluate(() => window.__mjg.pick0())
    const r = await sim(page, 480, { god: true, walk: true }); console.log('phone 8:00', r)
    await page.screenshot({ path: OUT + 'm5-late.png' })
    // 맞으면 죽는지 — 무적을 풀고 체력을 1로
    await page.evaluate(() => { const M = window.__mjg; M.pl.inv = 0; M.pl.hp = 1; let n = 0; while (M.mode !== 'over' && n++ < 3000) { if (M.mode === 'box') M.pick0(); M.step(1 / 30) } })
    await page.waitForTimeout(300)
    await page.screenshot({ path: OUT + 'm6-dead.png' })
    console.log('phone end mode:', await page.evaluate(() => window.__mjg.mode))
  })

  await run('cast', { width: 1280, height: 800 }, async page => {   // 캐릭터마다 2분씩 — 시작 스킬이 다 도는지
    const n = await page.evaluate(() => document.querySelectorAll('.trio canvas').length)
    for (let i = 0; i < n; i++) {
      await page.evaluate(i => window.__mjg.startGame(i), i)
      const r = await sim(page, 120, { god: true, walk: true }); console.log('cast', i, r.weapons, 'lvl', r.lvl)
      await page.evaluate(() => window.__mjg.step(1 / 60))
      await page.screenshot({ path: OUT + `c${i}.png` })
    }
  })

  await run('help', { width: 1280, height: 800 }, async page => {   // 지원 아이템 — 파자마 파티즈 · 한잎이 두잎이가 나왔다가 사라지는지
    await page.evaluate(() => window.__mjg.startGame(0))
    await sim(page, 120, { god: true, walk: true })
    const n = await page.evaluate(() => { const M = window.__mjg; for (const k of ['pajama', 'battery']) M.G.items.push({ x: M.pl.x, y: M.pl.y, k, t: 0 }); M.step(1 / 60); return M.G.help.length })
    await sim(page, 124, { god: true })
    await page.evaluate(() => window.__mjg.step(1 / 60)); await page.screenshot({ path: OUT + 'help.png' })
    await sim(page, 140, { god: true })
    const after = await page.evaluate(() => window.__mjg.G.help.length)
    console.log('help', n, '->', after)
    if (n !== 2 || after !== 0) errors.push(`[help] 도와주는 친구들: 먹은 뒤 ${n}, 끝난 뒤 ${after}`)
  })

  await run('dark', { width: 1280, height: 800 }, async page => {   // 29분 검은 별똥별 — 나오고 · 스킬에 안 맞고 · 30분에 생존 클리어
    await page.evaluate(() => { const M = window.__mjg; M.startGame(1); M.G.t = M.DARK_T - 5 })
    await sim(page, M_DARK + 3, { god: true, walk: true })
    const seen = await page.evaluate(() => !!window.__mjg.G.dark)
    await page.evaluate(() => window.__mjg.step(1 / 60)); await page.screenshot({ path: OUT + 'dark.png' })
    const r = await sim(page, M_END + 5, { god: true, walk: true })
    const end = await page.evaluate(() => ({ mode: window.__mjg.mode, kind: window.__mjg.G.endKind, h: document.querySelector('.result .h')?.textContent }))
    console.log('dark', seen, end)
    if (!seen || end.mode !== 'over' || end.kind !== 'time') errors.push(`[dark] 검은 별똥별 ${seen} · 끝 ${JSON.stringify(end)}`)
  })

  await browser.close()
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO ERRORS')
  process.exit(errors.length ? 1 : 0)
})()
