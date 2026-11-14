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
    page.on('request', q => { if (q.url().includes('.supabase.co')) errors.push(`[${name}] 점검 중에 진짜 통계 서버로 보냄 ${q.url()}`) })   // 로컬에서는 안 보내야 한다
    page.on('console', m => { if (m.type() === 'error') errors.push(`[${name}] console: ${m.text()}`) })
    await page.goto(URL); await page.waitForTimeout(600)
    await fn(page)
    await page.close()
  }
  const sim = (page, until, opts = {}) => page.evaluate(([until, opts]) => {
    const M = window.__mjg, t0 = performance.now(); let n = 0, rests = 0
    while (M.G && M.G.t < until && M.mode !== 'over') {
      if (opts.god) M.pl.inv = 1e9
      if (M.mode === 'box') M.pick0()
      if (M.mode === 'pause') { if (opts.stopRest) break; rests++; M.resume() }   // 보스 격파 쉬는 창
      M.step(1 / 30); n++
      if (opts.walk) { M.pl.x += Math.cos(M.G.t * 0.3) * 2; M.pl.y += Math.sin(M.G.t * 0.21) * 2 }
    }
    return { ms: (performance.now() - t0) / n, t: M.G?.t, lvl: M.G?.lvl, kills: M.G?.kills, foes: M.G?.foes.length, mode: M.mode, rests, weapons: M.G?.weapons.map(w => w.id + w.lv).join(' ') }
  }, [until, opts])

  // 아이콘은 직접 그린 그림 — 화면 글자에 이모지가 없고, 아이콘 그림이 실제로 그려졌는지
  const noEmoji = async (page, tag) => {
    const r = await page.evaluate(() => ({ emoji: (document.body.innerText.match(/\p{Extended_Pictographic}/gu) || []).filter(c => !'♪♥'.includes(c)).join(''), ico: document.querySelectorAll('img.ico').length, bad: [...document.querySelectorAll('img.ico')].filter(i => !i.naturalWidth).length }))
    if (r.emoji || !r.ico || r.bad) errors.push(`[${tag}] 아이콘 ${JSON.stringify(r)}`)
  }

  // 오른쪽 위 소리 단추가 창(.panel)과 겹치지 않는지
  const clearSnd = async (page, tag) => {
    const r = await page.evaluate(() => { const a = document.getElementById('snd').getBoundingClientRect(), p = document.querySelector('#ui:not([hidden]) .panel')?.getBoundingClientRect(); return !p || a.bottom <= p.top || a.left >= p.right || a.right <= p.left || a.top >= p.bottom })
    if (!r) errors.push(`[${tag}] 소리 단추가 창과 겹침`)
  }

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
    const pn = await page.evaluate(() => ({ h: document.querySelector('.panel .h').textContent, n: document.querySelectorAll('.scroll li').length, buff: [...document.querySelectorAll('.buff')].map(b => b.querySelectorAll('.cmp em').length) }))
    if (pn.h !== '패치노트' || pn.n < 5 || pn.buff.join() !== '12,6,6') errors.push('[desktop] 패치노트 ' + JSON.stringify(pn))
    await page.screenshot({ path: OUT + '1-notes.png' })
    await page.getByRole('button', { name: '← 처음으로' }).click(); await page.waitForTimeout(100)
    if (/NEW/.test(await nb.innerText())) errors.push('[desktop] 패치노트을 봐도 NEW가 남음')
    await page.getByRole('button', { name: '도감' }).click(); await page.waitForTimeout(300)
    await page.screenshot({ path: OUT + '2-guide.png', fullPage: true }); await noEmoji(page, 'guide')
    const dock = await page.evaluate(() => { const g = document.querySelector('.guide > .scroll'); g.scrollTop = 900; const r = s => document.querySelector(s).getBoundingClientRect(); return g.scrollTop > 0 && r('.guide > .h').top >= 0 && r('.guide > .row').bottom <= innerHeight })   // 도감 — 제목 · 「처음으로」 고정, 가운데만 스크롤
    if (!dock) errors.push('[desktop] 도감 위 · 아래가 고정되지 않음')
    await page.getByRole('button', { name: '← 처음으로' }).click()
    await page.getByRole('button', { name: '토벌 시작!' }).click(); await page.waitForTimeout(300)
    await page.screenshot({ path: OUT + '3-chars.png' }); await noEmoji(page, 'chars')
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
    const zm = await page.evaluate(() => { const r = document.querySelector('.zoom input'), K0 = window.__mjg.K; r.value = 140; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change')); const o = { K0, K1: window.__mjg.K, z: JSON.parse(localStorage.getItem('mjg.v1')).zoom }; r.value = 100; r.dispatchEvent(new Event('input')); r.dispatchEvent(new Event('change')); return o })   // 화면 배율 — 확대하면 그림을 더 촘촘히 다시 그린다
    if (!(zm.K1 > zm.K0) || zm.z !== 1.4) errors.push('[desktop] 화면 배율 ' + JSON.stringify(zm))
    const pill = await page.locator('.h .pill').innerText(); if (!/쉬움|보통|어려움/.test(pill)) errors.push('[desktop] 일시정지 옆 난이도: ' + pill)
    await page.screenshot({ path: OUT + '4-pause.png' }); await noEmoji(page, 'pause')
    await page.keyboard.press('Enter'); await page.waitForTimeout(100)   // 칩에 초점이 있어도 Enter = 계속하기
    if (await page.evaluate(() => window.__mjg.mode) !== 'play') errors.push('[desktop] 일시정지에서 Enter 로 계속하기 안 됨')
    // 첫 상자가 열릴 때까지
    await page.evaluate(() => { const M = window.__mjg; while (M.mode === 'play' && M.G.t < 120) { M.pl.inv = 1e9; M.step(1 / 30) } })
    await page.waitForTimeout(700)
    await page.screenshot({ path: OUT + '5-box.png' }); await noEmoji(page, 'box')
    console.log('box mode:', await page.evaluate(() => window.__mjg.mode))
    await page.keyboard.press('Digit1'); await page.waitForTimeout(200)
    let r = await sim(page, 330, { god: true, walk: true }); console.log('5:30', r)
    await page.evaluate(() => { const M = window.__mjg; M.step(1 / 30) }); await page.waitForTimeout(100)
    await page.evaluate(() => window.__mjg.step(0.001))
    await page.screenshot({ path: OUT + '6-boss5.png' })
    r = await sim(page, 900, { god: true, walk: true, stopRest: true }); console.log('rest', r)   // 보스를 쓰러뜨리면 쉬는 창 — 스킬별 피해
    const rs = await page.evaluate(() => ({ mode: window.__mjg.mode, h: document.querySelector('#ui .panel .h')?.textContent, rows: document.querySelectorAll('#ui .dmg li').length }))
    if (rs.mode !== 'pause' || !/토벌!/.test(rs.h) || !rs.rows) errors.push('[desktop] 보스 격파 쉬는 창 ' + JSON.stringify(rs))
    await page.waitForTimeout(500); await page.screenshot({ path: OUT + '6-rest.png' }); await noEmoji(page, 'rest')
    await page.keyboard.press('Space'); await page.waitForTimeout(100)
    if (await page.evaluate(() => window.__mjg.mode) !== 'play') errors.push('[desktop] 쉬는 창에서 Space 로 계속하기 안 됨')
    const rage = await page.evaluate(() => { const M = window.__mjg, b = M.summon('dekatsuyo', true), s0 = b.spd; b.age = 61; M.step(1 / 30); const o = { rage: b.rage, spd: b.spd / s0 }; b.dead = true; return o })   // 보스를 오래 두면 화낸다
    if (!rage.rage || rage.spd < 1.4) errors.push('[desktop] 보스 화내기 ' + JSON.stringify(rage))
    const F = await page.evaluate(() => window.__mjg.FINAL_T)
    r = await sim(page, F + 5, { god: true, walk: true }); console.log('final+5s', r)
    await page.screenshot({ path: OUT + '7-siren.png' })
    r = await sim(page, F + 60, { god: true, walk: true }); console.log('final+60s', r)
    const fin = await page.evaluate(() => { const F = window.__mjg.G.final; return F && { siren: Math.round(F.siren.hp), max: Math.round(F.siren.max), dead: F.siren.dead, mer: F.mermaids.map(m => m.dead ? 'x' : Math.round(m.hp)) } })
    console.log('final', fin)
    await page.screenshot({ path: OUT + '8-siren2.png' })
    // 남은 피를 줄여 클리어까지
    await page.evaluate(() => { const M = window.__mjg, F = M.G.final; for (const m of F.mermaids) m.hp = Math.min(m.hp, 1); F.siren.hp = Math.min(F.siren.hp, 50); F.siren.x = M.pl.x + 70; F.siren.y = M.pl.y })   // 세이렌을 옆으로 — 멀리 가 있어 클리어가 늦는 일이 없게
    const sent = []   // 익명 통계 — 가짜 주소로 돌려 실제로 보내는 줄 · 머리말을 확인(진짜 Supabase 에는 안 간다)
    page.on('request', q => { if (q.url().startsWith('https://stats.invalid/')) sent.push({ url: q.url(), h: q.headers(), body: q.postDataJSON() }) })   // 받는 건 request 이벤트로 — keepalive 요청은 route 에 가끔 안 잡힌다
    await page.route('https://stats.invalid/**', rt => rt.fulfill({ status: 201, body: '' }))
    await page.evaluate(() => Object.assign(window.__mjg.STATS, { url: 'https://stats.invalid', key: 'sb_publishable_test', host: location.hostname }))
    r = await sim(page, F + 200, { god: true }); console.log('clear', r)
    if (r.mode !== 'over') errors.push('[desktop] 세이렌을 쓰러뜨리지 못함 ' + JSON.stringify(r))
    for (let i = 0; i < 30 && !sent.length; i++) await page.waitForTimeout(100)   // 보낼 때까지 기다린다
    const st = sent[0]; console.log('stat sent', sent.length, JSON.stringify(st?.body))
    if (sent.length !== 1 || typeof st.body.up !== 'number' || !st.url.endsWith('/rest/v1/runs') || st.h.apikey !== 'sb_publishable_test' || st.body.result !== 'clear' || st.body.killer !== null || st.body.diff !== 'hard') errors.push('[desktop] 통계 보내기 ' + JSON.stringify(st))
    await page.evaluate(() => { window.__mjg.STATS.url = '' })
    await page.waitForTimeout(300)
    await page.screenshot({ path: OUT + '9-result.png' })
    console.log('saved', await page.evaluate(() => localStorage.getItem('mjg.v1')))
  })

  await run('phone', { width: 390, height: 844 }, async page => {
    await page.screenshot({ path: OUT + 'm1-title.png' }); await clearSnd(page, 'phone m1-title')
    const ta = await page.evaluate(() => [...document.querySelectorAll('body, #ui, .panel, .btn, p')].map(e => getComputedStyle(e).touchAction).filter(v => v !== 'manipulation').concat(getComputedStyle(document.getElementById('cv')).touchAction === 'none' ? [] : ['cv']))   // 두 번 탭 확대 막기
    if (ta.length) errors.push('[phone] 두 번 탭 확대가 막히지 않은 곳 ' + ta.join())
    await page.getByRole('button', { name: /패치노트/ }).click(); await page.waitForTimeout(200)   // 패치노트 — 휴대폰에서도 위 · 아래 고정
    const pm = await page.evaluate(() => { const g = document.querySelector('.panel.pick > .scroll'); g.scrollTop = 400; const r = s => document.querySelector(s).getBoundingClientRect(); return { h: document.querySelector('.panel .h').textContent, top: r('.panel.pick > .h').top >= 0, bottom: r('.panel.pick > .row').bottom <= innerHeight, scrolls: g.scrollTop > 0, wide: document.documentElement.scrollWidth <= innerWidth } })
    if (pm.h !== '패치노트' || !pm.top || !pm.bottom || !pm.scrolls || !pm.wide) errors.push('[phone] 패치노트 ' + JSON.stringify(pm))
    await page.screenshot({ path: OUT + 'm1-notes.png' }); await clearSnd(page, 'phone m1-notes')
    await page.getByRole('button', { name: '← 처음으로' }).click(); await page.waitForTimeout(100)
    await page.getByRole('button', { name: '토벌 시작!' }).click(); await page.waitForTimeout(300)
    await page.screenshot({ path: OUT + 'm2-chars.png', fullPage: true }); await clearSnd(page, 'phone m2-chars')
    const fix = await page.evaluate(() => { const g = document.querySelector('.panel.pick .chars'); g.scrollTop = 300; const r = s => document.querySelector(s).getBoundingClientRect(); return { top: r('.panel.pick > .h').top >= 0, bottom: r('.panel.pick > .row').bottom <= innerHeight, scrolls: g.scrollTop > 0 } })   // 캐릭터만 스크롤 — 제목 · 난이도 아래는 고정
    if (!fix.top || !fix.bottom || !fix.scrolls) errors.push('[phone] 캐릭터 고르기 위 · 아래 고정 ' + JSON.stringify(fix))
    await page.locator('.char').nth(2).click(); await page.locator('.char').nth(2).click(); await page.waitForTimeout(200)
    // 손가락 스틱
    await page.mouse.move(200, 600); await page.mouse.down(); await page.mouse.move(150, 560, { steps: 5 }); await page.waitForTimeout(1500)
    await page.screenshot({ path: OUT + 'm3-play.png' })
    await page.mouse.up()
    await page.evaluate(() => { const M = window.__mjg; while (M.mode === 'play' && M.G.t < 120) { M.pl.inv = 1e9; M.step(1 / 30) } })
    await page.waitForTimeout(700)
    await page.screenshot({ path: OUT + 'm4-box.png' }); await clearSnd(page, 'phone m4-box')
    await page.evaluate(() => window.__mjg.pick0())
    const r = await sim(page, 480, { god: true, walk: true }); console.log('phone 8:00', r)
    const ns = await page.evaluate(() => { const G = window.__mjg.G; return { diff: G.diff, shots: G.eshots.filter(b => ['spike', 'net', 'soy'].includes(b.k)).length, far: G.foes.filter(e => ['spiker', 'fugu', 'octo'].includes(e.type)).length } })   // 보통 — 멀리서 쏘는 몬스터가 안 나온다
    if (ns.diff !== 'normal' || ns.shots || ns.far) errors.push('[phone] 보통인데 멀리서 쏘는 몬스터가 있다 ' + JSON.stringify(ns))
    await page.screenshot({ path: OUT + 'm5-late.png' })
    // 맞으면 죽는지 — 무적을 풀고 체력을 1로
    await page.evaluate(() => { const M = window.__mjg; let n = 0; while (M.mode !== 'over' && n++ < 6000) { if (M.mode === 'box') M.pick0(); if (M.mode === 'pause') M.resume(); M.pl.inv = 0; M.pl.hp = Math.min(M.pl.hp, 1); M.step(1 / 30) } })   // 레벨 업 회복이 있어 체력을 계속 1로
    await page.waitForTimeout(300)
    await page.screenshot({ path: OUT + 'm6-dead.png' }); await clearSnd(page, 'phone m6-dead')
    const row = await page.evaluate(() => window.__mjg.statRow('dead'))   // 익명 통계 한 줄 — 쓰러뜨린 것까지(로컬이라 실제로는 안 보낸다)
    console.log('stat row', JSON.stringify(row))
    if (!row.killer || row.ch !== 'usagi' || !row.diff || !row.t || !/^\d{4}-\d\d-\d\d#\d+$/.test(row.v)) errors.push('[phone] 통계 한 줄 ' + JSON.stringify(row))
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

  await run('shop', { width: 390, height: 844 }, async page => {   // 토벌 보상금 · 영구 강화 상점 — 판이 끝나면 돈이 쌓이고, 사면 다음 판 능력치에 더해진다
    await page.evaluate(() => { const M = window.__mjg; M.startGame(0); M.G.t = 300; M.G.kills = 1000; let n = 0; while (M.mode !== 'over' && n++ < 6000) { if (M.mode === 'box') M.pick0(); if (M.mode === 'pause') M.resume(); M.pl.inv = 0; M.pl.hp = Math.min(M.pl.hp, 1); M.step(1 / 30) } })
    const res = await page.evaluate(() => ({ txt: document.querySelector('#ui .coin')?.textContent, coin: JSON.parse(localStorage.getItem('mjg.v1')).coin }))
    if (!/토벌 보상금 \+\d+/.test(res.txt) || !(res.coin >= 40)) errors.push('[shop] 보상금 ' + JSON.stringify(res))
    await page.locator('#ui .row button', { hasText: '상점' }).click(); await page.waitForTimeout(400)
    await page.locator('.shop .buy').first().click()
    const after = await page.evaluate(() => { const sv = JSON.parse(localStorage.getItem('mjg.v1')); return { coin: sv.coin, manju: sv.up.manju } })
    if (after.manju !== 1 || after.coin !== res.coin - 40) errors.push('[shop] 사기 ' + JSON.stringify({ res, after }))
    await page.screenshot({ path: OUT + 'shop.png' }); await noEmoji(page, 'shop')
    const hp = await page.evaluate(() => { const M = window.__mjg; M.startGame(0); return { hp: M.pl.hp, want: Math.round(M.CHARS[0].hp * (1 + (M.CHARS[0].mod.hp || 0) + 0.04)) } })
    if (hp.hp !== hp.want) errors.push('[shop] 강화한 체력이 판에 안 들어감 ' + JSON.stringify(hp))
  })
  await run('ach', { width: 390, height: 844 }, async page => {   // 업적 — 판이 끝나면 쌓이고 새 메달을 보여 준다, 금메달마다 보상금 +1%
    await page.evaluate(() => localStorage.setItem('mjg.v1', JSON.stringify({ ach: { goblin: 1995, pajama: 200, jackpot: 100 } }))); await page.reload(); await page.waitForTimeout(500)   // 금메달 둘 · 고블린은 동메달 바로 앞
    await page.evaluate(() => { const M = window.__mjg; M.startGame(0); M.G.t = 300; M.G.gob = 10; M.G.kills = 20000; let n = 0; while (M.mode !== 'over' && n++ < 6000) { if (M.mode === 'box') M.pick0(); if (M.mode === 'pause') M.resume(); M.pl.inv = 0; M.pl.hp = Math.min(M.pl.hp, 1); M.step(1 / 30) } })
    const r = await page.evaluate(() => ({ got: document.querySelector('#ui .ach-new')?.textContent, coin: document.querySelector('#ui .coin small')?.textContent, ach: JSON.parse(localStorage.getItem('mjg.v1')).ach }))
    if (!/고블린 퇴치 동메달/.test(r.got) || !/금메달 2개 보너스 \d+/.test(r.coin) || !(r.ach.goblin >= 2005)) errors.push('[ach] 업적 달성 ' + JSON.stringify(r))
    await page.screenshot({ path: OUT + 'ach-result.png' }); await noEmoji(page, 'ach-result')
    await page.locator('#ui .row button', { hasText: '처음으로' }).click(); await page.waitForTimeout(300)
    await page.locator('#ui .row button', { hasText: '업적' }).click(); await page.waitForTimeout(400)
    const list = await page.evaluate(() => ({ rows: document.querySelectorAll('.ach li').length, head: document.querySelector('#ui .coin')?.textContent, bad: [...document.querySelectorAll('img.medal')].filter(i => !i.naturalWidth).length }))
    if (list.rows !== 12 || !/금메달 2 \/ 12 — 토벌 보상금 \+2%/.test(list.head) || list.bad) errors.push('[ach] 업적 화면 ' + JSON.stringify(list))
    await page.screenshot({ path: OUT + 'ach.png' }); await noEmoji(page, 'ach')
  })
  await run('perf', { width: 1280, height: 800 }, async page => {   // 자동 화질 — 처음보다 많이 느려지면 픽셀을 줄이고, 30fps 로 묶인 기기는 괜히 안 내리고, 새 판은 되돌린다
    const q = await page.evaluate(() => {
      const M = window.__mjg, cv = document.getElementById('cv'), feed = (t, ms, n) => { M.G.t = t; for (let i = 0; i < n; i++) M.autoQ(ms) }
      M.startGame(0); const w0 = cv.width
      feed(10, 16.7, 200); feed(1300, 60, 300); const l1 = M.LQ, w1 = cv.width; feed(1306, 60, 300); const l2 = M.LQ, w2 = cv.width
      M.startGame(0); const back = [M.LQ, cv.width]
      feed(10, 33.4, 200); feed(1300, 40, 400); const cap30 = M.LQ
      return { w0, l1, w1, l2, w2, back, cap30 }
    })
    console.log('perf', q)
    if (q.l1 !== 1 || q.l2 !== 2 || !(q.w1 < q.w0 && q.w2 < q.w1) || q.back[0] !== 0 || q.back[1] !== q.w0 || q.cap30 !== 0) errors.push('[perf] 자동 화질 ' + JSON.stringify(q))
  })
  await run('help', { width: 1280, height: 800 }, async page => {   // 지원 아이템 — 파자마 파티즈 · 한잎이 두잎이가 나왔다가 사라지는지
    await page.evaluate(() => window.__mjg.startGame(0))
    await sim(page, 120, { god: true, walk: true })
    const n = await page.evaluate(() => { const M = window.__mjg; for (const k of ['pajama', 'battery']) M.G.items.push({ x: M.pl.x, y: M.pl.y, k, t: 0 }); M.step(1 / 60); return M.G.help.length })
    const guard = await page.evaluate(() => { const M = window.__mjg, p = M.pl; M.G.eshots.push({ k: 'rock', x: p.x, y: p.y - 300, vx: 0, vy: 150, t: 0, life: 5, dmg: 1, r: 8 }); for (let i = 0; i < 24; i++) M.step(1 / 60); return Math.sin(M.G.help.find(h => h.k === 'leaf').a) })
    if (!(guard < -0.9)) errors.push('[help] 한잎이 · 두잎이가 위에서 오는 것 쪽으로 안 섬 ' + guard)   // 위 = -90°
    await sim(page, 124, { god: true })
    const notes = await page.evaluate(() => window.__mjg.G.shots.filter(b => b.look === 'note').length)   // 파자마 파티즈는 돌면서 음표를 쏜다
    if (!notes) errors.push('[help] 파자마 파티즈 음표가 안 나옴')
    await page.evaluate(() => window.__mjg.step(1 / 60)); await page.screenshot({ path: OUT + 'help.png' })
    await sim(page, 140, { god: true })
    const after = await page.evaluate(() => window.__mjg.G.help.length)
    console.log('help', n, '->', after)
    if (n !== 2 || after !== 0) errors.push(`[help] 도와주는 친구들: 먹은 뒤 ${n}, 끝난 뒤 ${after}`)
  })

  await run('kani', { width: 1280, height: 800 }, async page => {   // 카니 — 시작 스킬 헌책 날리기, 짝 헌책 더미와 시너지 「카니의 헌책방」, 둘 다 실제로 피해를 주는지
    const k = await page.evaluate(() => {
      const M = window.__mjg; M.startGame(M.CHARS.findIndex(c => c.id === 'kani')); const b = M.G.weapons[0], n0 = b.st.n
      M.addWeapon('pile'); return { id: b.id, n0, n1: b.st.n, pile: M.G.weapons[1].st.n }
    })
    await sim(page, 60, { god: true, walk: true })
    const d = await page.evaluate(() => ({ book: Math.round(window.__mjg.G.dmg.book || 0), pile: Math.round(window.__mjg.G.dmg.pile || 0) }))
    console.log('kani', k, d)
    if (k.id !== 'book' || k.n1 !== k.n0 + 1 || k.pile !== 2 || !d.book || !d.pile) errors.push('[kani] 헌책 날리기 · 헌책 더미 ' + JSON.stringify({ k, d }))
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
