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
    if (await page.locator('a.kofi[href="https://ko-fi.com/godbono"]').count() !== 1) errors.push('[desktop] 후원 단추(Ko-fi) 없음')
    await page.click('#snd'); await page.waitForTimeout(100)   // 소리 크기 — 배경음 · 효과음 따로
    const vol = await page.evaluate(() => { const r = document.querySelector('#sndm input[name=bgm]'), f = document.querySelector('#sndm input[name=sfx]'); r.value = 30; r.dispatchEvent(new Event('input')); f.value = 0; f.dispatchEvent(new Event('input')); const s = JSON.parse(localStorage.getItem('mjg.v1')); return { open: !document.getElementById('sndm').hidden, bgm: s.bgm, sfx: s.sfx, icon: document.getElementById('snd').textContent } })
    if (!vol.open || vol.bgm !== 0.3 || vol.sfx !== 0) errors.push('[desktop] 소리 크기 ' + JSON.stringify(vol))
    await page.mouse.click(40, 40); await page.waitForTimeout(100)
    if (!(await page.evaluate(() => document.getElementById('sndm').hidden))) errors.push('[desktop] 소리 창이 바깥을 눌러도 안 닫힘')
    const nb = page.getByRole('button', { name: /패치노트/ })   // 패치노트 — 처음엔 NEW, 보고 나면 사라진다
    if (!/NEW/.test(await nb.innerText())) errors.push('[desktop] 패치노트에 NEW 없음')
    await nb.click(); await page.waitForTimeout(200)
    const pn = await page.evaluate(() => ({ h: document.querySelector('.panel .h').textContent, n: document.querySelectorAll('.scroll li').length }))
    if (pn.h !== '패치노트' || pn.n < 5) errors.push('[desktop] 패치노트 ' + JSON.stringify(pn))
    await page.screenshot({ path: OUT + '1-notes.png' })
    await page.getByRole('button', { name: '← 처음으로' }).click(); await page.waitForTimeout(100)
    if (/NEW/.test(await nb.innerText())) errors.push('[desktop] 패치노트을 봐도 NEW가 남음')
    await page.getByRole('button', { name: '도감' }).click(); await page.waitForTimeout(300)
    await page.screenshot({ path: OUT + '2-guide.png', fullPage: true })
    const dock = await page.evaluate(() => { const g = document.querySelector('.guide > .scroll'); g.scrollTop = 900; const r = s => document.querySelector(s).getBoundingClientRect(); return g.scrollTop > 0 && r('.guide > .h').top >= 0 && r('.guide > .row').bottom <= innerHeight })   // 도감 — 제목 · 「처음으로」 고정, 가운데만 스크롤
    if (!dock) errors.push('[desktop] 도감 위 · 아래가 고정되지 않음')
    await page.getByRole('button', { name: '← 처음으로' }).click()
    await page.getByRole('button', { name: '토벌 시작!' }).click(); await page.waitForTimeout(300)
    await page.screenshot({ path: OUT + '3-chars.png' })
    const same = await page.evaluate(async () => { const before = document.querySelector('.panel'); document.querySelectorAll('.char')[3].click(); await new Promise(r => setTimeout(r, 50)); const on = document.querySelectorAll('.char.on').length; document.querySelectorAll('.char')[0].click(); return before === document.querySelector('.panel') && on === 1 })
    if (!same) errors.push('[desktop] 캐릭터를 고를 때 화면을 새로 그린다(깜빡임)')
    const dif = await page.evaluate(async () => { const before = document.querySelector('.panel'), B = k => document.querySelector(`.diff [data-k="${k}"]`); B('easy').click(); const note = document.querySelector('.diff-note').textContent; B('hard').click(); return { same: before === document.querySelector('.panel'), note, on: document.querySelector('.diff .on').dataset.k } })
    if (!dif.same || !/기준/.test(dif.note) || dif.on !== 'hard') errors.push('[desktop] 난이도 고르기 ' + JSON.stringify(dif))
    await page.getByRole('button', { name: '토벌 시작!' }).click(); await page.waitForTimeout(200)
    if (await page.evaluate(() => window.__mjg.G.diff) !== 'hard') errors.push('[desktop] 어려움으로 시작 안 됨')
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(2500); await page.keyboard.up('ArrowRight')
    await page.screenshot({ path: OUT + '4-play.png' })
    await page.click('#snd'); const t0 = await page.evaluate(() => window.__mjg.G.t); await page.waitForTimeout(400)   // 게임 중 소리 창 — 멈췄다가 닫으면 이어서
    const sm = await page.evaluate(() => ({ mode: window.__mjg.mode, t: window.__mjg.G.t }))
    if (sm.mode !== 'sound' || sm.t !== t0) errors.push('[desktop] 소리 창에서 게임이 안 멈춤 ' + JSON.stringify(sm))
    await page.getByRole('button', { name: '닫기' }).click(); await page.waitForTimeout(100)
    if (await page.evaluate(() => window.__mjg.mode) !== 'play') errors.push('[desktop] 소리 창을 닫아도 이어지지 않음')
    await page.keyboard.press('Escape'); await page.waitForTimeout(200)   // 일시정지 — 스킬을 누르면 자세히
    await page.locator('.build .chip').first().click(); await page.waitForTimeout(100)
    const det = await page.locator('.skill-detail').innerText(); if (!/피해/.test(det) || !/시너지/.test(det)) errors.push('[desktop] 일시정지 스킬 자세히: ' + det.slice(0, 60))
    await page.screenshot({ path: OUT + '4-pause.png' })
    await page.keyboard.press('Escape'); await page.waitForTimeout(100)
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
    await page.getByRole('button', { name: /패치노트/ }).click(); await page.waitForTimeout(200)   // 패치노트 — 휴대폰에서도 위 · 아래 고정
    const pm = await page.evaluate(() => { const g = document.querySelector('.panel.pick > .scroll'); g.scrollTop = 400; const r = s => document.querySelector(s).getBoundingClientRect(); return { h: document.querySelector('.panel .h').textContent, top: r('.panel.pick > .h').top >= 0, bottom: r('.panel.pick > .row').bottom <= innerHeight, scrolls: g.scrollTop > 0, wide: document.documentElement.scrollWidth <= innerWidth } })
    if (pm.h !== '패치노트' || !pm.top || !pm.bottom || !pm.scrolls || !pm.wide) errors.push('[phone] 패치노트 ' + JSON.stringify(pm))
    await page.screenshot({ path: OUT + 'm1-notes.png' })
    await page.getByRole('button', { name: '← 처음으로' }).click(); await page.waitForTimeout(100)
    await page.getByRole('button', { name: '토벌 시작!' }).click(); await page.waitForTimeout(300)
    await page.screenshot({ path: OUT + 'm2-chars.png', fullPage: true })
    const fix = await page.evaluate(() => { const g = document.querySelector('.panel.pick .chars'); g.scrollTop = 300; const r = s => document.querySelector(s).getBoundingClientRect(); return { top: r('.panel.pick > .h').top >= 0, bottom: r('.panel.pick > .row').bottom <= innerHeight, scrolls: g.scrollTop > 0 } })   // 캐릭터만 스크롤 — 제목 · 난이도 아래는 고정
    if (!fix.top || !fix.bottom || !fix.scrolls) errors.push('[phone] 캐릭터 고르기 위 · 아래 고정 ' + JSON.stringify(fix))
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
    const ns = await page.evaluate(() => { const G = window.__mjg.G; return { diff: G.diff, shots: G.eshots.filter(b => ['spike', 'net', 'soy'].includes(b.k)).length, far: G.foes.filter(e => ['spiker', 'fugu', 'octo'].includes(e.type)).length } })   // 보통 — 멀리서 쏘는 몬스터가 안 나온다
    if (ns.diff !== 'normal' || ns.shots || ns.far) errors.push('[phone] 보통인데 멀리서 쏘는 몬스터가 있다 ' + JSON.stringify(ns))
    await page.screenshot({ path: OUT + 'm5-late.png' })
    // 맞으면 죽는지 — 무적을 풀고 체력을 1로
    await page.evaluate(() => { const M = window.__mjg; M.pl.inv = 0; M.pl.hp = 1; let n = 0; while (M.mode !== 'over' && n++ < 3000) { if (M.mode === 'box') M.pick0(); M.step(1 / 30) } })
    await page.waitForTimeout(300)
    await page.screenshot({ path: OUT + 'm6-dead.png' })
    const badge = await page.locator('.result .lvl-badge').innerText().catch(() => ''); if (!/보통/.test(badge)) errors.push('[phone] 결과에 난이도가 없다 ' + badge)
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
