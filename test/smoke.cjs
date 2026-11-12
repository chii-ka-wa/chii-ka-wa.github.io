// 스모크 테스트 — 실행: python3 -m http.server 8765 를 띄우고 NODE_PATH=<playwright 가 있는 node_modules> node test/smoke.cjs (그림은 test/shots/).
//   처음 화면 → 캐릭터 → 판 → 상자 → 15분 빨리 돌리기(무적) → 세이렌 → 클리어. 콘솔 에러가 하나라도 있으면 실패
const { chromium } = require('playwright')
const OUT = __dirname + '/shots/'; require('fs').mkdirSync(OUT, { recursive: true })
const URL = process.env.URL || 'http://127.0.0.1:8765/'

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
    await page.getByRole('button', { name: '도감' }).click(); await page.waitForTimeout(300)
    await page.screenshot({ path: OUT + '2-guide.png', fullPage: true })
    await page.getByRole('button', { name: '← 처음으로' }).click()
    await page.getByRole('button', { name: '토벌 시작!' }).click(); await page.waitForTimeout(300)
    await page.screenshot({ path: OUT + '3-chars.png' })
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
    r = await sim(page, 905, { god: true, walk: true }); console.log('15:05', r)
    await page.screenshot({ path: OUT + '7-siren.png' })
    r = await sim(page, 960, { god: true, walk: true }); console.log('16:00', r)
    const fin = await page.evaluate(() => { const F = window.__mjg.G.final; return F && { siren: Math.round(F.siren.hp), max: Math.round(F.siren.max), dead: F.siren.dead, mer: F.mermaids.map(m => m.dead ? 'x' : Math.round(m.hp)) } })
    console.log('final', fin)
    await page.screenshot({ path: OUT + '8-siren2.png' })
    // 남은 피를 줄여 클리어까지
    await page.evaluate(() => { const F = window.__mjg.G.final; for (const m of F.mermaids) m.hp = Math.min(m.hp, 1); F.siren.hp = Math.min(F.siren.hp, 50) })
    r = await sim(page, 1100, { god: true }); console.log('clear', r)
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

  await browser.close()
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO ERRORS')
  process.exit(errors.length ? 1 : 0)
})()
