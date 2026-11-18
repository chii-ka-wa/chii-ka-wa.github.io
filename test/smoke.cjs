// 스모크 테스트 — 실행: python3 -m http.server 8765 를 띄우고 NODE_PATH=<playwright 가 있는 node_modules> node test/smoke.cjs (그림은 test/shots/).
//   처음 화면 → 캐릭터 → 판 → 상자 → 최종보스까지 빨리 돌리기(무적) → 세이렌 → 클리어. 콘솔 에러가 하나라도 있으면 실패
const { chromium } = require('playwright')
const OUT = __dirname + '/shots/'; require('fs').mkdirSync(OUT, { recursive: true })
const URL = process.env.URL || 'http://127.0.0.1:8765/', M_DARK = 29 * 60, M_END = 30 * 60, M_INF = { rest: 12, gap: 60, dark: 180 }   // 무한 — game.js INF 와 같게

;(async () => {
  const browser = await chromium.launch()
  const errors = []
  const run = async (name, viewport, fn) => {
    if (process.env.ONLY && !process.env.ONLY.split(',').includes(name)) return   // ONLY=sync,ban — 그것만
    const page = await browser.newPage({ viewport, deviceScaleFactor: 2 })
    page.on('pageerror', e => errors.push(`[${name}] ${e.message}`))
    page.on('request', q => { if (q.url().includes('.supabase.co') && !['acct', 'sync', 'susp'].includes(name) && !q.url().includes('rpc/blocked')) errors.push(`[${name}] 점검 중에 진짜 통계 서버로 보냄 ${q.url()}`) })   // 로컬에서는 안 보내야 한다(acct 는 page.route 로 흉내 낸 서버에만)
    await page.route('**/rpc/blocked', r => r.fulfill({ status: 200, contentType: 'application/json', body: 'null' }))   // IP 차단 확인(?secure · ?guard 면 묻는다) — 진짜 서버 대신 「안 막힘」. ban 은 따로
    page.on('console', m => { if (m.type() === 'error') errors.push(`[${name}] console: ${m.text()}`) })
    await page.goto(URL); await page.waitForTimeout(600)
    await fn(page)
    await page.close()
  }
  const sim = (page, until, opts = {}) => page.evaluate(([until, opts]) => {
    const M = window.__mjg, t0 = performance.now(); let n = 0, rests = 0
    while (M.G && M.G.t < until && M.mode !== 'over') {
      if (opts.god) M.pl.inv = 1e9
      const sr = opts.keep && M.G.final?.siren; if (sr) sr.hp = Math.max(sr.hp, sr.max * 0.5)   // 세이렌 보기 — 통계 점검 전에 쓰러지지 않게(빌드가 세면 일찍 잡힌다)
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
    await page.click('#snd'); await page.waitForTimeout(100)   // 소리 크기 — 배경음 · 효과음 따로
    const vol = await page.evaluate(() => { const r = document.querySelector('#sndm input[name=bgm]'), f = document.querySelector('#sndm input[name=sfx]'); r.value = 30; r.dispatchEvent(new Event('input')); f.value = 0; f.dispatchEvent(new Event('input')); const s = JSON.parse(localStorage.getItem('mjg.v1')); return { open: !document.getElementById('sndm').hidden, bgm: s.bgm, sfx: s.sfx, icon: document.getElementById('snd').textContent } })
    if (!vol.open || vol.bgm !== 0.3 || vol.sfx !== 0) errors.push('[desktop] 소리 크기 ' + JSON.stringify(vol))
    await page.mouse.click(40, 40); await page.waitForTimeout(100)
    if (!(await page.evaluate(() => document.getElementById('sndm').hidden))) errors.push('[desktop] 소리 창이 바깥을 눌러도 안 닫힘')
    const nb = page.getByRole('button', { name: /패치노트/ })   // 패치노트 — 처음엔 NEW, 보고 나면 사라진다
    if (!/NEW/.test(await nb.innerText())) errors.push('[desktop] 패치노트에 NEW 없음')
    await nb.click(); await page.waitForTimeout(200)
    const pn = await page.evaluate(() => ({ h: document.querySelector('.panel .h').textContent, n: document.querySelectorAll('.kid li').length, days: document.querySelectorAll('.scroll h3.day').length,   // 쉬운 패치노트 — 줄마다 그림 · 꼬리표 · 문장
      bad: [...document.querySelectorAll('.kid li')].filter(li => !li.querySelector('img.ico')?.naturalWidth || !li.querySelector('mark')?.textContent || !li.querySelector('p')?.textContent).length }))
    if (pn.h !== '패치노트' || pn.n < 5 || pn.days < 5 || pn.bad) errors.push('[desktop] 패치노트 ' + JSON.stringify(pn))
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
    // 익명 통계 — 가짜 주소로 돌려 게임이 보내는 주소 · 머리말 · 내용을 확인(진짜 Supabase 에는 안 간다). keepalive 요청은 Playwright 의 route · request 이벤트에 가끔 안 잡혀서 fetch 를 감싸 받아 둔다
    //   세이렌 전에 걸어 둔다 — 스킬이 세면 25~26분 사이에 세이렌을 쓰러뜨려 판이 먼저 끝나기도 한다(그러면 보낸 것을 못 잡았다)
    await page.route('https://stats.invalid/**', rt => rt.fulfill({ status: 201, body: '' }))
    await page.evaluate(() => {
      Object.assign(window.__mjg.STATS, { url: 'https://stats.invalid', key: 'sb_publishable_test', host: location.hostname })
      const f0 = window.fetch; window.__sent = []
      window.fetch = (url, o = {}) => { if (String(url).startsWith('https://stats.invalid/')) window.__sent.push({ url: String(url), h: o.headers, body: JSON.parse(o.body) }); return f0(url, o) }
    })
    const F = await page.evaluate(() => window.__mjg.FINAL_T)
    r = await sim(page, F + 5, { god: true, walk: true, keep: true }); console.log('final+5s', r)
    await page.screenshot({ path: OUT + '7-siren.png' })
    r = await sim(page, F + 60, { god: true, walk: true, keep: true }); console.log('final+60s', r)
    const fin = await page.evaluate(() => { const F = window.__mjg.G.final; return F && { siren: Math.round(F.siren.hp), max: Math.round(F.siren.max), dead: F.siren.dead, mer: F.mermaids.map(m => m.dead ? 'x' : Math.round(m.hp)) } })
    console.log('final', fin)
    await page.screenshot({ path: OUT + '8-siren2.png' })
    // 남은 피를 줄여 클리어까지
    await page.evaluate(() => { const M = window.__mjg, F = M.G.final; for (const m of F.mermaids) m.hp = Math.min(m.hp, 1); F.siren.hp = Math.min(F.siren.hp, 50); F.siren.x = M.pl.x + 70; F.siren.y = M.pl.y })   // 세이렌을 옆으로 — 멀리 가 있어 클리어가 늦는 일이 없게
    r = await sim(page, F + 200, { god: true }); console.log('clear', r)
    if (r.mode !== 'over') errors.push('[desktop] 세이렌을 쓰러뜨리지 못함 ' + JSON.stringify(r))
    const sent = await page.evaluate(() => window.__sent)
    const st = sent[0]; console.log('stat sent', sent.length, JSON.stringify(st?.body))
    if (sent.length !== 1 || typeof st.body.up !== 'number' || !st.url.endsWith('/rest/v1/rpc/report_run') || st.h.apikey !== 'sb_publishable_test' || st.body.result !== 'clear' || st.body.killer !== null || st.body.diff !== 'hard') errors.push('[desktop] 통계 보내기 ' + JSON.stringify(st))
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

  await run('magnet', { width: 1280, height: 800 }, async page => {   // 자석 — 구슬이 360개(가득)여도 멀리 있는 것까지 다 온다(예전엔 적을 잡을 때마다 날아오던 먼 구슬이 처치 자리로 옮겨져 멈췄다)
    await page.evaluate(() => { const M = window.__mjg; M.startGame(5); M.G.t = 300; for (let i = 0; i < 360; i++) { const a = i / 360 * 6.28; M.G.gems.push({ x: M.pl.x + Math.cos(a) * 6000, y: M.pl.y + Math.sin(a) * 6000, v: 1, pull: true, sp: 0, far: 1 }) } })
    await sim(page, 312, { god: true })
    const mg = await page.evaluate(() => ({ left: window.__mjg.G.gems.filter(g => g.far).length, kills: window.__mjg.G.kills }))
    if (mg.left || !mg.kills) errors.push('[magnet] 자석으로 끌려오던 먼 구슬이 남음 ' + JSON.stringify(mg))
  })

  await run('shop', { width: 390, height: 844 }, async page => {   // 토벌 보상금 · 영구 강화 상점 — 판이 끝나면 돈이 쌓이고, 사면 다음 판 능력치에 더해진다
    await page.evaluate(() => { const M = window.__mjg; M.startGame(0); M.G.t = 300; M.G.kills = 1000; let n = 0; while (M.mode !== 'over' && n++ < 6000) { if (M.mode === 'box') M.pick0(); if (M.mode === 'pause') M.resume(); M.pl.inv = 0; M.pl.hp = Math.min(M.pl.hp, 1); M.step(1 / 30) } })
    const res = await page.evaluate(() => ({ txt: document.querySelector('#ui .coin')?.textContent, coin: JSON.parse(localStorage.getItem('mjg.v1')).coin }))
    if (!/토벌 보상금[\s\S]*\+\d+[\s\S]*합계[\s\S]*\+\d+/.test(res.txt) || !(res.coin >= 40)) errors.push('[shop] 보상금 ' + JSON.stringify(res))
    await page.locator('#ui .row button', { hasText: '상점' }).click(); await page.waitForTimeout(400)
    await page.locator('.shop li:not(.stone) .buy').first().click()   // 맨 위 부활석 말고 첫 강화(체력)
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
    if (list.rows !== 17 || !/금메달 2 \/ 17 — 토벌 보상금 \+2%/.test(list.head) || list.bad) errors.push('[ach] 업적 화면 ' + JSON.stringify(list))
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

  await run('revive', { width: 390, height: 844 }, async page => {   // 부활석 — 쓰러지면 묻고, 누르면 체력 가득 · 화면 안 일반 몬스터 토벌 · 하나 줄어든다. 어려움은 한 판에 한 번(남아도 결과 화면)
    await page.evaluate(() => localStorage.setItem('mjg.v1', JSON.stringify({ diff: 'hard', stone: 3, noStats: true }))); await page.reload(); await page.waitForTimeout(500)
    const h0 = await page.evaluate(() => { const M = window.__mjg; M.startGame(0); const h = M.pl.hp; for (let i = 0; i < 400; i++) { M.G.queue.length = 0; M.pl.inv = 9; M.step(1 / 30) } M.G.next = 1e15; return h })   // 부활 뒤 쓰러진 적의 보석으로 레벨 업 상자가 끼어들지 않게
    const die = () => page.evaluate(() => { const M = window.__mjg; M.pl.hp = 0; M.G.dying = 0.01; M.step(1 / 30); return M.mode })
    const m1 = await die(), foes0 = await page.evaluate(() => window.__mjg.G.foes.filter(e => !e.dead && !e.boss).length)
    await page.screenshot({ path: OUT + 'revive.png' }); await noEmoji(page, 'revive')
    await page.locator('#ui .revive .btn.main').click()
    const r = await page.evaluate(h0 => { const M = window.__mjg, G = M.G; return { mode: M.mode, full: M.pl.hp === h0, inv: M.pl.inv >= 1.2, stone: JSON.parse(localStorage.getItem('mjg.v1')).stone, revives: G.revives, foes: G.foes.filter(e => !e.dead && !e.boss).length } }, h0)
    const m2 = await die()
    console.log('revive', m1, foes0, r, m2)
    if (m1 !== 'revive' || r.mode !== 'play' || !r.full || !r.inv || r.stone !== 2 || r.revives !== 1 || !(r.foes < foes0) || m2 !== 'over') errors.push('[revive] 부활석 ' + JSON.stringify({ m1, foes0, r, m2 }))
  })

  await run('wander', { width: 390, height: 844 }, async page => {   // 떠돌이 보물상자 — 멀리 돌아다니면 나오고, 연 결과가 표(평균 보상금 ≈ 44 · 부활석 ≈ 3%)대로, 주운 부활석이 있으면 그것부터 쓰고 상점 것은 못 쓴다, 결과 화면 보상금에 더해진다
    await page.evaluate(() => localStorage.setItem('mjg.v1', JSON.stringify({ diff: 'easy', stone: 2, noStats: true }))); await page.reload(); await page.waitForTimeout(500)
    const r = await page.evaluate(() => {
      const M = window.__mjg, out = {}; M.startGame(0); const G = M.G, pl = M.pl
      const step = () => { G.queue.length = 0; pl.inv = 9; pl.hp = Math.max(pl.hp, 50); M.step(1 / 30) }
      G.lastBox = -1e9; let n = 0
      while (!G.items.some(i => i.k === 'coinbox') && n++ < 150) { pl.x += 1600; step() }
      out.spawned = G.items.some(i => i.k === 'coinbox'); out.tries = n
      const N = 3000; G.found = 0; G.runStones = 0
      for (let i = 0; i < N; i++) { G.items = [{ x: pl.x, y: pl.y, k: 'coinbox', t: 0 }]; step() }
      out.avg = +(G.found / N).toFixed(1); out.stone = +(G.runStones / N * 100).toFixed(1)
      G.runStones = 1; G.found = 123; return out
    })
    const die = () => page.evaluate(() => { const M = window.__mjg; M.pl.hp = 0; M.G.dying = 0.01; M.step(1 / 30); return M.mode })
    const m1 = await die(), hint = await page.locator('#ui .revive').innerText()
    await page.locator('#ui .revive .btn.main').click()
    const a = await page.evaluate(() => ({ shop: JSON.parse(localStorage.getItem('mjg.v1')).stone, run: window.__mjg.G.runStones }))
    const m2 = await die(), coin = await page.locator('#ui .pay .found').innerText()
    console.log('wander', r, m1, a, m2, coin.slice(0, 60))
    if (!r.spawned || !(r.avg > 65 && r.avg < 115) || !(r.stone > 1.5 && r.stone < 4.5) || m1 !== 'revive' || !/상점 부활석 2개는 이번 판엔 못 써요/.test(hint) || a.shop !== 2 || a.run !== 0 || m2 !== 'over' || !/떠돌이 보물상자[\s\S]*\+123/.test(coin)) errors.push('[wander] 떠돌이 보물상자 ' + JSON.stringify({ r, m1, a, m2, coin }))
  })

  await run('awaken', { width: 1280, height: 800 }, async page => {   // 각성 — Lv 8 이 있어야 보스가 각성의 별을 떨어뜨리고, 각성 상자(카드 하나 · 리롤 꺼짐)에서 고르면 세지고, 기타 음표가 적 탄을 반쯤 막는다
    const r = await page.evaluate(() => {
      const M = window.__mjg, out = {}; M.startGame(1); const G = M.G, w = G.weapons[0]
      const step = n => { for (let i = 0; i < n; i++) { M.pl.inv = 1e9; M.pl.hp = 1e6; M.step(1 / 30) } }
      const calm = () => { while (M.mode === 'box') M.pick0(); G.queue.length = 0; G.gems.length = 0; G.rest = null; if (M.mode !== 'play') M.resume() }
      const boss = () => { const e = M.summon('dekatsuyo'); e.hp = 1; for (let n = 0; !e.dead && n < 300; n++) { e.x = M.pl.x + 80; e.y = M.pl.y; step(1) } const k = G.items.map(i => i.k); calm(); return k }
      out.before = boss().includes('awaken'); G.items.length = 0
      w.lv = 8; w.st = M.wstat(w); const it = boss(); out.after = it.includes('awaken')
      G.queue.push('awaken'); step(1)
      out.cards = document.querySelectorAll('#ui .card.a').length; out.rr = document.querySelector('#ui .btn.act')?.disabled
      const n0 = w.st.n; M.pick0(); out.aw = G.aw.has('guitar') && w.st.n === n0 + 1
      G.foes.forEach(f => { f.dead = true }); let hit = 0
      for (let k = 0; k < 200; k++) {
        w.t = 0; w.on = 0; step(1); const o = G.shots.find(s => s.k === 'orb'); if (!o) continue
        const b = { k: 'spike', x: o.x, y: o.y, vx: 0, vy: 0, t: 0, life: 9, dmg: 1, r: 5 }; G.eshots = [b]; step(1); hit += b.dead ? 1 : 0; G.eshots = []
      }
      out.block = hit / 200; out.parried = G.parried; return out
    })
    console.log('awaken', r)
    if (r.before || !r.after || r.cards !== 1 || !r.rr || !r.aw || !(r.block >= 0.3 && r.block <= 0.7) || r.parried !== Math.round(r.block * 200)) errors.push('[awaken] 각성 ' + JSON.stringify(r))
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

  await run('outfit', { width: 420, height: 900 }, async page => {   // 의상 — 일반은 두 번 눌러 산다(5,000) · 업적 의상은 어려움 클리어 전엔 잠김 · 입고 시작하면 이펙트
    await page.evaluate(() => { localStorage.setItem('mjg.v1', JSON.stringify({ coin: 6000, noStats: true })) }); await page.reload(); await page.waitForTimeout(500)
    await page.evaluate(() => window.__mjg.shop('outfit', 0)); await page.waitForTimeout(200); await noEmoji(page, 'outfit')
    const buy = page.locator('.list.wr li.wr-cheap .btn.buy').first(); await buy.click(); await buy.click(); await page.waitForTimeout(200)
    await page.locator('.list.wr li.wr-rich b').first().click(); await page.waitForTimeout(100)   // 입어 보기 — 줄을 누르면 미리 보기에만(산 것 · 입은 것은 그대로)
    const peek = await page.evaluate(() => ({ try: document.querySelector('.wr-view small.try')?.textContent, dashed: !!document.querySelector('.list.wr li.wr-rich.peek'), wear: JSON.parse(localStorage.getItem('mjg.v1')).wear.chiikawa }))
    if (!peek.try || !peek.dashed || peek.wear !== 'pj') errors.push('[outfit] 입어 보기 ' + JSON.stringify(peek))
    await page.locator('.list.wr li.wr-cheap .btn.all').first().click(); await page.waitForTimeout(100)   // 일반 · 고급은 종류 하나 — 「모두 입기」면 모든 캐릭터가
    const all = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('mjg.v1')); return { wear: s.wear, worn: window.__mjg.CHARS.map(c => window.__mjg.wornId(c.id)) } })
    if (all.worn.some(w => w !== 'pj')) errors.push('[outfit] 모두 입기 ' + JSON.stringify(all))
    const a = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('mjg.v1')); return { coin: s.coin, wear: s.wear.chiikawa, richOff: document.querySelector('.list.wr li.wr-rich .btn.buy').disabled, achOff: document.querySelector('.list.wr li.wr-ach .btn.buy').disabled } })
    await page.keyboard.press('Escape'); await page.waitForTimeout(100)   // PC — 메뉴에서 Esc = 처음으로
    const esc = await page.evaluate(() => window.__mjg.mode); if (esc !== 'title') errors.push('[outfit] Esc ' + esc)
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('mjg.v1')); s.best = { chiikawa: { t: 1, kills: 1, lvl: 1, clears: 1 } }; localStorage.setItem('mjg.v1', JSON.stringify(s)) }); await page.reload(); await page.waitForTimeout(500)
    await page.evaluate(() => window.__mjg.shop('outfit', 0)); await page.locator('.list.wr li.wr-ach .btn.buy').first().click(); await page.waitForTimeout(100)
    const b = await page.evaluate(() => { const M = window.__mjg; M.startGame(0); for (let i = 0; i < 30; i++) { M.pl.inv = 9; M.step(1 / 30) } return { wear: JSON.parse(localStorage.getItem('mjg.v1')).wear.chiikawa, fx: M.G.cfx.list.length } })
    if (a.coin !== 1000 || a.wear !== 'pj' || !a.richOff || !a.achOff || b.wear !== 'a_chiikawa' || !(b.fx > 0)) errors.push('[outfit] 의상 ' + JSON.stringify({ a, b }))
  })

  await run('skins', { width: 420, height: 900 }, async page => {   // 무기 스킨(상점 10,000 · 업적은 보통 클리어) · 스킬 스킨(상점 10,000 · 각성해 본 스킬은 그냥) — 켜면 게임에서 G.sk 에
    await page.evaluate(() => { localStorage.setItem('mjg.v1', JSON.stringify({ coin: 25000, noStats: true, awSeen: ['yaha'] })) }); await page.reload(); await page.waitForTimeout(500)
    await page.evaluate(() => window.__mjg.shop('weapon', 0)); await page.waitForTimeout(150); await noEmoji(page, 'skins')
    let b = page.locator('.list.wr li.wr-rich .btn.buy'); await b.click(); await b.click(); await page.waitForTimeout(150)
    const w = await page.evaluate(() => ({ wear: JSON.parse(localStorage.getItem('mjg.v1')).wear['w:chiikawa'], achOff: document.querySelector('.list.wr li.wr-ach .btn.buy').disabled, winterOff: document.querySelector('.list.wr li.wr-winter .btn.buy').disabled }))
    const ww = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('mjg.v1')); s.wwin = ['chiikawa']; localStorage.setItem('mjg.v1', JSON.stringify(s)) })   // 겨울 맵 보통 이상 클리어 → 겨울 무기 스킨
    await page.reload(); await page.waitForTimeout(400); await page.evaluate(() => window.__mjg.shop('weapon', 0)); await page.waitForTimeout(100)
    const wOn = await page.evaluate(() => document.querySelector('.list.wr li.wr-winter .btn.buy')?.disabled === false)
    if (!wOn) errors.push('[skins] 겨울 무기 스킨이 안 열림')
    await page.evaluate(() => window.__mjg.shop('skill', 0)); await page.waitForTimeout(150)
    const yaha = await page.evaluate(() => [...document.querySelectorAll('.list.wr li')].findIndex(li => li.querySelector('img.ico')?.src) >= 0 && document.querySelectorAll('.list.wr li .btn.buy').length)
    await page.locator('.list.wr li').nth(4).locator('b').click(); await page.waitForTimeout(150)   // 스킬 스킨 미리 보기 — 줄을 누르면 그 스킬의 원래 · 스킨이 나란히
    const pv = await page.evaluate(() => ({ cv: !!document.querySelector('.wr-view.sk canvas.sk-pv'), name: document.querySelector('.wr-view.sk b')?.textContent, want: window.__mjg.SKIN.yaha.name }))
    if (!pv.cv || pv.name !== pv.want) errors.push('[skins] 스킬 미리 보기 ' + JSON.stringify(pv))
    b = page.locator('.list.wr li').first().locator('.btn.buy'); await b.click(); await b.click(); await page.waitForTimeout(150)
    const k = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('mjg.v1')); const M = window.__mjg; M.startGame(0); for (let i = 0; i < 30; i++) { M.pl.inv = 9; M.step(1 / 30) } return { coin: s.coin, skin: s.skin, sk: Object.keys(M.G.sk), wfx: M.G.wfx.list.length } })   // 무기 스킨 반짝이(wfx)
    if (w.wear !== 'w_chiikawa' || !w.achOff || !w.winterOff || k.coin !== 5000 || !k.sk.includes('sasu') || k.sk.includes('yaha') || !(k.wfx > 0)) errors.push('[skins] 스킨 ' + JSON.stringify({ w, k, yaha }))
  })

  await run('winter', { width: 1000, height: 700 }, async page => {   // 겨울 맵 — 눈보라 예고 · 쌓인 눈에 미끄러짐 · 받는 피해 증가(계속 움직이면 사라짐) · 그치면 녹음 · 가만히 있으면 얼어붙기 · 불꽃 옷
    await page.evaluate(() => { localStorage.setItem('mjg.v1', JSON.stringify({ noStats: true, theme: 'winter' })) }); await page.reload(); await page.waitForTimeout(500)
    const r = await page.evaluate(() => {
      const M = window.__mjg, o = {}, run = (n, f) => { for (let i = 0; i < n; i++) { M.G.queue.length = 0; f?.(); M.step(1 / 30) } }, key = (t, code) => window.dispatchEvent(new KeyboardEvent(t, { code }))
      M.startGame(0); const G = M.G, W = G.storm; W.next = 6; G.next = 1e12   // 레벨 업 상자가 열리면 누른 키가 풀려(calm) 「5초 계속 움직이기」가 끊긴다 — 이 점검에선 레벨 업을 막는다
      run(40, () => { M.pl.inv = 9 }); o.warn = G.tip?.s
      let n = 0; while (W.on <= 0 && n++ < 60) { W.next = G.t; run(1) }   // 반반 — 올 때까지
      o.on = W.on > 0; o.hurts = M.stormHurts(); run(60, () => { M.pl.inv = 9 }); o.piles = W.piles.length
      const P = W.piles[0]; M.pl.x = P.x; M.pl.y = P.y; M.pl.vx = 120; M.pl.vy = 0; run(1); const x0 = M.pl.x; run(5); o.slide = M.pl.x - x0   // 손을 안 대도 주르륵
      key('keydown', 'ArrowRight'); run(170, () => { M.pl.inv = 9 }); o.warm = W.warm && !M.stormHurts(); key('keyup', 'ArrowRight')   // 5초 넘게 계속 움직이면 몸에 열
      run(380, () => { M.pl.inv = 9 }); o.after = { on: W.on, piles: W.piles.length, storms: G.storms }   // 눈보라 15초 + 녹는 0.6초
      M.pl.inv = 0; const h0 = M.pl.hp; run(210, () => { G.foes.length = 0; G.eshots.length = 0; G.storm.next = G.t + 99 }); o.freeze = { idle: M.pl.idleT > 5, lost: h0 - M.pl.hp }   // 가만히 7초 — 2초째부터 조금씩
      return o
    })
    if (r.warn !== '곧 눈보라가 와요!' || !r.on || !r.hurts || !(r.piles > 0) || !(r.slide > 5) || !r.warm || r.after.on > 0 || r.after.piles || r.after.storms !== 1 || !r.freeze.idle || !(r.freeze.lost > 1)) errors.push('[winter] 눈보라 · 얼어붙기 ' + JSON.stringify(r))
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('mjg.v1')); s.ach = { winter: 1 }; s.wear = { chiikawa: 'fire' }; localStorage.setItem('mjg.v1', JSON.stringify(s)) }); await page.reload(); await page.waitForTimeout(500)
    const f = await page.evaluate(() => { const M = window.__mjg; M.startGame(0); const W = M.G.storm; W.on = 5; return { worn: M.wornId('chiikawa'), fire: M.G.fire, hurts: M.stormHurts() } })
    if (f.worn !== 'fire' || !f.fire || f.hurts) errors.push('[winter] 불꽃 옷 ' + JSON.stringify(f))
  })

  await run('secure', { width: 900, height: 800 }, async page => {   // 진짜 주소(?secure 로 흉내) — 시험 손잡이(__mjg) 숨김 · 저장을 고치면 바로 전 저장으로 · 둘 다 고치면 처음부터 · F12 막기
    const S = URL + (URL.includes('?') ? '&' : '?') + 'secure', o = {}
    await page.goto(S); await page.evaluate(() => localStorage.clear()); await page.goto(S); await page.waitForTimeout(400)
    o.hook = await page.evaluate(() => typeof window.__mjg)
    await page.evaluate(() => localStorage.setItem('mjg.v1', JSON.stringify({ coin: 3000 }))); await page.goto(S); await page.waitForTimeout(300)   // 서명 전 예전 저장은 그대로
    await page.locator('.theme button').nth(1).click(); await page.waitForTimeout(200)   // 저장 → 서명
    await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('mjg.v1')); s.coin = 999999; localStorage.setItem('mjg.v1', JSON.stringify(s)) }); await page.goto(S); await page.waitForTimeout(300)
    o.edit = await page.evaluate(() => ({ note: !!document.querySelector('.home p.hint'), coin: JSON.parse(localStorage.getItem('mjg.v1')).coin, theme: JSON.parse(localStorage.getItem('mjg.v1')).theme }))
    await page.evaluate(() => { for (const k of ['mjg.v1', 'mjg.v1.bak']) { const s = JSON.parse(localStorage.getItem(k)); s.coin = 999999; localStorage.setItem(k, JSON.stringify(s)) } }); await page.goto(S); await page.waitForTimeout(300)
    o.both = await page.evaluate(() => JSON.parse(localStorage.getItem('mjg.v1')).coin)
    o.f12 = await page.evaluate(() => { const e = new KeyboardEvent('keydown', { key: 'F12', cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented })
    if (o.hook !== 'undefined' || !o.edit.note || o.edit.coin !== 3000 || o.edit.theme !== 'grass' || o.both !== 0 || !o.f12) errors.push('[secure] 저장 지키기 ' + JSON.stringify(o))
    await page.evaluate(() => localStorage.clear())
  })

  await run('awaken-key', { width: 1280, height: 800 }, async page => {   // 각성 상자 — 첫 카드가 골라져 있어 Enter · Space 로 받는다
    for (const key of ['Enter', 'Space']) {
      await page.evaluate(() => { const M = window.__mjg; M.startGame(1); const w = M.G.weapons[0]; w.lv = 8; w.st = M.wstat(w); M.G.queue.push('awaken'); M.pl.inv = 9; M.step(1 / 30) })
      await page.waitForTimeout(600); await page.keyboard.press(key); await page.waitForTimeout(100)
      const r = await page.evaluate(() => ({ mode: window.__mjg.mode, aw: [...window.__mjg.G.aw] }))
      if (r.mode !== 'play' || r.aw[0] !== 'guitar') errors.push(`[awaken-key] ${key} ${JSON.stringify(r)}`)
    }
  })

  // 언어 — 처음 화면 오른쪽 위에서 고르면 기억하고 다시 불러온다. 다른 말에서는 처음 화면 · 도감 · 패치노트 · 캐릭터 고르기 · 레벨 업 상자 · 일시정지에 한국어가 남지 않는다(언어 이름 「한국어」 빼고)
  await run('inf', { width: 1280, height: 800 }, async page => {   // 무한 — 세이렌을 쓰러뜨려도 판이 이어지고, 보스 둘씩 → 세이렌 둘 → 4분 넘으면 검은 별똥별
    await page.evaluate(() => localStorage.setItem('mjg.v1', JSON.stringify({ noStats: true, diff: 'inf', seen: 1 }))); await page.reload(); await page.waitForTimeout(400)
    const go = (sec, who = '') => page.evaluate(([sec, who]) => { const M = window.__mjg, G = M.G
      for (let i = 0; i < sec * 20; i++) { M.pl.inv = 9; G.next = 1e12; G.rest = null; M.step(0.05)
        for (const e of G.foes) if (e.boss && !e.dead && (who === 'boss' ? e.kind !== 'siren' && e.kind !== 'mermaid' : e.kind === who)) M.kill(e) }
      return { lv: G.loop.lv, q: G.loop.queue.length, n: G.foes.filter(e => e.loop && !e.dead).length, sirens: G.final?.sirens?.filter(s => !s.dead).length || 0, dark: !!G.dark, mode: M.mode, ph: (G.final?.sirens || []).filter(s => !s.dead).map(s => s.ph).join(), bosses: G.bosses } }, [sec, who])
    await page.locator('#ui .btn.main').click(); await page.waitForTimeout(150)   // 통계를 끈 채 무한 — 설명에 미리 알리고, 「토벌 시작!」에서 묻는다
    const gate = { note: await page.locator('.diff-note span.on').textContent() }; await page.locator('#ui .row .btn.main').click(); await page.waitForTimeout(150)
    Object.assign(gate, { modal: await page.locator('.modal .h').textContent(), mode: await page.evaluate(() => window.__mjg.mode) }); await page.locator('.modal .btn.main').click(); await page.waitForTimeout(150)
    Object.assign(gate, { after: await page.evaluate(() => window.__mjg.mode), noStats: await page.evaluate(() => JSON.parse(localStorage.getItem('mjg.v1')).noStats) })
    if (!gate.note.includes('통계를 켜야 해요') || gate.modal !== '통계를 켤까요?' || gate.mode !== 'chars' || gate.after !== 'play' || gate.noStats) errors.push('[inf] 통계 ' + JSON.stringify(gate))
    await page.evaluate(() => { const M = window.__mjg; M.G.t = M.FINAL_T - 1 })
    await go(2, 'boss'); await go(0.2, 'mermaid'); const a = await go(0.2, 'siren')   // 첫 세이렌 → 1단계
    const b = await go(M_INF.rest + 1)   // 보스 둘
    await go(0.2, 'boss'); await go(M_INF.gap + 1); await go(0.2, 'boss'); await go(M_INF.gap + 1); const c = await go(0.2, 'boss')   // 여섯을 다 쓰러뜨리면 세이렌 둘
    const d = await go(M_INF.dark + 2)   // 3분 동안 페이즈를 못 넘기면 — 검은 별똥별
    await go(0.2, 'mermaid'); const p = await go(0.1, 'siren')   // 무한 세이렌은 3페이즈 — 한 번 쓰러뜨리면 2페이즈(2초 무적), 별똥별은 물러난다
    const e = await go(4.5, 'siren')   // 3페이즈까지 다 쓰러뜨리면 2단계
    if (p.ph !== '2,2' || p.dark || p.bosses !== d.bosses + 2 || p.lv !== 1) errors.push('[inf] 페이즈 ' + JSON.stringify({ d, p }))
    console.log('inf', a, b, c, d, e)
    if (a.lv !== 1 || a.mode !== 'play' || b.n !== 2 || c.sirens !== 2 || !d.dark || e.lv !== 2 || e.dark) errors.push(`[inf] ${JSON.stringify({ a, b, c, d, e })}`)
  })

  await run('guard', { width: 900, height: 700 }, async page => {   // 부정 플레이 봉인(?guard) — 진짜 프레임으로 돌리며 상자 고르기 · 일시정지엔 표시가 없고, 프레임 사이에 체력을 고치면 표시
    await page.goto(URL + '?guard'); await page.waitForTimeout(600)
    await page.evaluate(() => { localStorage.setItem('mjg.v1', JSON.stringify({ noStats: true, seen: 1 })) }); await page.reload(); await page.waitForTimeout(600)
    await page.evaluate(() => window.__mjg.startGame(0)); await page.waitForTimeout(1500)
    await page.evaluate(() => { window.__mjg.G.queue.push('level', 'level') }); await page.waitForTimeout(700)   // 상자 둘 — 다음 step 이 연다
    for (let i = 0; i < 2; i++) { await page.keyboard.press('Digit1'); await page.waitForTimeout(600) }
    await page.keyboard.press('KeyP'); await page.waitForTimeout(200); await page.keyboard.press('KeyP'); await page.waitForTimeout(800)
    const ok = await page.evaluate(() => ({ bad: window.__mjg.G.bad || null, mode: window.__mjg.mode, lvl: window.__mjg.G.weapons.map(w => w.lv).join() }))
    await page.evaluate(() => { window.__mjg.pl.hp = 99999 }); await page.waitForTimeout(300)
    const bad = await page.evaluate(() => window.__mjg.G.bad)
    console.log('guard', { ok, bad })
    if (ok.bad || ok.mode !== 'play' || !bad?.includes('seal')) errors.push('[guard] ' + JSON.stringify({ ok, bad }))
  })
  await run('acct', { width: 390, height: 844 }, async page => {   // 계정 · 랭킹 — Supabase 를 흉내 낸다(로그인 토큰 · 랭킹 · 닉네임 · 기록 올리기)
    const row = (rank, nick, ch, me) => ({ rank, nick, ch, lv: 9 - rank, bosses: 30 - rank, bt: 2000, t: 2400, kills: 9000, lvl: 300, weapons: 'sasu9 ramen8', passives: 'manju5', slain: 'siren3 chef2', winter: true, at: '2026-11-17T10:00:00Z', me })
    const sent = []; let body = null
    await page.route('**/*.supabase.co/**', r => { const u = r.request().url(), j = v => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(v) }); sent.push(u.split('/').pop())
      if (u.includes('top_ranks')) return j([row(1, 'A', 'usagi'), row(2, '치이카와팬', 'chiikawa', true)]); if (u.includes('my_rank')) return j([row(2, '치이카와팬', 'chiikawa', true)])
      if (u.includes('my_nick')) return j({ nick: '치이카와팬', next: '2026-11-24' }); if (u.includes('submit_rank')) { body = r.request().postDataJSON(); return j({ r: 'ok', rank: 2 }) } if (u.includes('start_run')) return j('tok-1'); if (u.includes('delete_me')) return j('ok'); if (u.includes('saves?select')) return j([])
      return r.fulfill({ status: 204 }) })
    await page.evaluate(() => { localStorage.setItem('mjg.v1', JSON.stringify({ noStats: false, diff: 'inf', seen: 1 })); localStorage.setItem('mjg.auth', JSON.stringify({ at: 'a.e30.b', rt: 'r', exp: Date.now() / 1000 + 9999, uid: 'u1', prov: 'google' })) })
    await page.reload(); await page.waitForTimeout(800)
    const pill = await page.locator('.acct .nm').textContent(), onStats = await page.locator('#ui .fine', { hasText: '로그인 중에는 통계를 보내요' }).count()
    if (onStats !== 1) errors.push('[acct] 로그인 중 통계 글 ' + onStats)
    await page.locator('#ui .row .btn', { hasText: '랭킹' }).click(); await page.waitForTimeout(400)
    const rows = await page.locator('.list.rank li').count(), mine = await page.locator('.panel.rank .mine li.me').count()
    await page.locator('.list.rank li').first().click(); await page.waitForTimeout(150); const info = await page.locator('.modal .lvl-badge').textContent()
    await page.keyboard.press('Escape'); await page.waitForTimeout(100); const closed = await page.locator('.modal').count(), still = await page.evaluate(() => window.__mjg.mode)
    await page.evaluate(() => window.__mjg.startGame(0)); await page.waitForTimeout(300)   // start_run 이 tok 을 돌려줄 때까지
    await page.evaluate(() => { const M = window.__mjg; M.G.loop.lv = 2; M.finish(false) }); await page.waitForTimeout(500)
    const line = await page.locator('.rankline').textContent()
    const ck = body && require('crypto').createHash('sha256').update(['tok-1', body.ch, body.lv, body.bosses, body.bt, body.t, body.kills, body.lvl, body.weapons, body.hit0, body.v, 'mjg|r7Q'].join('|')).digest('hex')   // 체크섬 — SQL(submit_rank)과 같은 순서
    if (!body || body.ck !== ck) errors.push('[acct] 체크섬 ' + JSON.stringify({ body, ck }))
    console.log('acct', { pill, rows, mine, info, closed, still, line, sent: [...new Set(sent)] })
    await page.reload(); await page.waitForTimeout(800)   // 계정 지우기 — 닉네임을 똑같이 써야 눌리고, 지우면 로그아웃
    await page.locator('.acct summary').click(); await page.locator('.acct button.del').click(); await page.waitForTimeout(100)
    const go = page.locator('.modal .btn.danger'), off0 = await go.isDisabled()
    await page.locator('.modal input').fill('치이카와'); const off1 = await go.isDisabled()
    await page.locator('.modal input').fill('치이카와팬'); const on = !(await go.isDisabled()); await go.click(); await page.waitForTimeout(400)
    const del = { off0, off1, on, sent: sent.includes('delete_me'), out: await page.locator('button.acct').count(), auth: await page.evaluate(() => localStorage.getItem('mjg.auth')), modal: await page.locator('.modal').count() }
    console.log('acct delete', del)
    if (!off0 || !off1 || !on || !del.sent || del.out !== 1 || del.auth || del.modal) errors.push('[acct] 계정 지우기 ' + JSON.stringify(del))
    if (pill !== '치이카와팬' || rows !== 2 || mine !== 1 || !/8/.test(info) || closed || still !== 'rank' || !line.includes('#2') || !sent.includes('start_run') || !sent.includes('submit_rank')) errors.push('[acct] ' + JSON.stringify({ pill, rows, mine, info, closed, still, line, sent }))
  })

  await run('sync', { width: 390, height: 844 }, async page => {   // 기기 · 계정 기록이 다르면 고르기 — 「이 기기」를 고르면 올린 뒤 다시 맞추고, 또 묻지 않는다. 마지막 때는 시 · 분 · 초까지
    let cloud = [{ data: { runs: 15 }, updated_at: '2026-11-18T01:02:03.456+00:00' }], reads = 0
    await page.route('**/*.supabase.co/**', async r => { const q = r.request(), u = q.url(), j = v => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(v) })
      if (u.includes('saves?select')) { reads++; return j(cloud) }
      if (u.includes('saves?on_conflict') && q.method() === 'POST') { const b = q.postDataJSON(); await new Promise(f => setTimeout(f, 300)); cloud = [{ data: b.data, updated_at: b.updated_at }]; return r.fulfill({ status: 201 }) }   // 올리기는 조금 걸린다
      if (u.includes('my_nick')) return j({ nick: '치이카와팬', next: '2026-11-24' })
      return r.fulfill({ status: 204 }) })
    await page.evaluate(() => { localStorage.setItem('mjg.v1', JSON.stringify({ runs: 17, seen: 1, last: Date.parse('2026-11-18T09:08:07Z') })); localStorage.setItem('mjg.auth', JSON.stringify({ at: 'a.e30.b', rt: 'r', exp: Date.now() / 1000 + 9999, uid: 'u1', prov: 'kakao' })) })
    await page.reload(); await page.waitForTimeout(800)
    const o = { h: await page.locator('.modal .h').textContent(), when: await page.locator('.modal .pickrec small').allTextContents() }
    await page.locator('.modal .pickrec[data-k=here]').click(); await page.locator('.modal .btn.main').click(); await page.waitForTimeout(100); await page.locator('.modal .btn.main').click(); await page.waitForTimeout(1200)
    Object.assign(o, { modal: await page.locator('.modal').count(), mode: await page.evaluate(() => window.__mjg.mode), reads, runs: cloud[0].data.runs })
    console.log('sync', o)
    if (o.h !== '기록이 두 군데 있어요' || !o.when.every(t => /\d:\d\d:\d\d/.test(t)) || o.modal || o.mode !== 'title' || reads !== 2 || o.runs !== 17) errors.push('[sync] ' + JSON.stringify(o))
  })
  await run('susp', { width: 390, height: 844 }, async page => {   // 정지된 계정 — 켜면 로그아웃되고 처음 화면에 번호. 로그인 중에는 「보내지 않기」 대신 글
    await page.route('**/*.supabase.co/**', r => r.request().url().includes('rpc/suspended') ? r.fulfill({ status: 200, contentType: 'application/json', body: '{"id":7}' }) : r.fulfill({ status: 204 }))
    await page.evaluate(() => { localStorage.setItem('mjg.v1', JSON.stringify({ seen: 1, noStats: true, diff: 'inf' })); localStorage.setItem('mjg.auth', JSON.stringify({ at: 'a.e30.b', rt: 'r', exp: Date.now() / 1000 + 9999, uid: 'u1', prov: 'kakao' })) })
    await page.reload(); await page.waitForTimeout(800)
    const o = { hint: await page.locator('#ui .hint').allTextContents(), auth: await page.evaluate(() => localStorage.getItem('mjg.auth')), toggle: await page.locator('#ui .fine .linkish', { hasText: '다시 보내기' }).count(), mode: await page.evaluate(() => window.__mjg.mode) }
    console.log('susp', o)
    if (!o.hint.some(t => t.includes('정지') && t.includes('7')) || o.auth || o.toggle !== 1 || o.mode !== 'title') errors.push('[susp] ' + JSON.stringify(o))
  })
  await run('ban', { width: 390, height: 844 }, async page => {   // IP 차단 — 열 때 서버에 묻고(?guard 로 이 주소에서도) 막혔으면 안내 화면만(번호 · 풀리는 때 · 언어 고르기)
    await page.route('**/*.supabase.co/**', r => r.request().url().includes('rpc/blocked') ? r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 42, until: '2026-11-25T06:07:00+00:00' }) }) : r.fulfill({ status: 204 }))
    await page.goto(new globalThis.URL('?guard', URL).href); await page.waitForTimeout(800)
    const b = { mode: await page.evaluate(() => window.__mjg.mode), text: await page.locator('#ui .panel.ban').innerText(), trio: await page.locator('#ui .trio').count(), lang: await page.locator('#ui .panel.ban .lang').count() }
    await page.screenshot({ path: OUT + 'ban.png' }); await page.keyboard.press('Escape'); await page.waitForTimeout(100); b.esc = await page.evaluate(() => window.__mjg.mode)
    console.log('ban', b)
    if (b.mode !== 'blocked' || !b.text.includes('42') || !b.text.includes('풀려요') || b.trio || b.lang !== 1 || b.esc !== 'blocked') errors.push('[ban] ' + JSON.stringify(b))
  })
  await run('privacy', { width: 390, height: 844 }, async page => {   // 개인정보 처리방침 — 처음 화면 링크 · ?lang=en&privacy 로 바로(그 말로)
    const stray = await page.evaluate(() => [...document.querySelector('#ui .home').childNodes].filter(n => n.nodeType === 3 && n.textContent.trim()).map(n => n.textContent))   // 처음 화면에 맨 글자(0 · false — 조건을 && 로 쓴 실수)가 없어야
    if (stray.length) errors.push('[privacy] 처음 화면 빈 줄 ' + JSON.stringify(stray))
    await page.locator('.fine .linkish', { hasText: '개인정보 처리방침' }).click(); await page.waitForTimeout(200)
    const ko = { h: await page.locator('#ui .panel .h').textContent(), n: await page.locator('#ui ul.pv li').count(), mode: await page.evaluate(() => window.__mjg.mode) }
    await page.screenshot({ path: OUT + 'privacy.png' }); await page.keyboard.press('Escape'); await page.waitForTimeout(150); ko.back = await page.evaluate(() => window.__mjg.mode)
    await page.goto(new globalThis.URL('?lang=en&privacy', URL).href); await page.waitForTimeout(800)
    const en = { h: await page.locator('#ui .panel .h').textContent(), q: await page.evaluate(() => location.search), han: await page.evaluate(() => (document.querySelector('#ui').innerText.match(/[가-힣]+/g) || []).slice(0, 4)) }
    await page.screenshot({ path: OUT + 'privacy-en.png' }); await page.evaluate(() => localStorage.removeItem('mjg.v1'))
    console.log('privacy', { ko, en })
    if (ko.h !== '개인정보 처리방침' || ko.n < 15 || ko.mode !== 'privacy' || ko.back !== 'title' || en.h !== 'Privacy Policy' || !/^\?privacy=?$/.test(en.q) || en.han.length) errors.push('[privacy] ' + JSON.stringify({ ko, en }))
  })

  await run('lang', { width: 1280, height: 800 }, async page => {
    const han = () => page.evaluate(() => (document.querySelector('#ui').innerText.replace(/한국어/g, '').match(/[가-힣]+/g) || []).slice(0, 6))
    for (const code of ['ja', 'en', 'zh-CN', 'zh-TW']) {
      await page.evaluate(() => localStorage.setItem('mjg.v1', JSON.stringify({ noStats: true }))); await page.reload(); await page.waitForTimeout(400)
      await page.click('.lang summary'); await Promise.all([page.waitForNavigation(), page.click(`.lang button[lang="${code}"]`)]); await page.waitForTimeout(600)
      const left = { title: await han() }
      await page.locator('#ui .row .btn').nth(0).click(); left.guide = await han(); await page.locator('#ui .btn.main').last().click()
      await page.locator('#ui .row .btn').nth(1).click(); left.notes = await han(); await page.screenshot({ path: OUT + `lang-${code}.png` }); await page.locator('#ui .btn.main').last().click()
      await page.evaluate(() => window.__mjg.shop('outfit', 0)); await page.waitForTimeout(150); left.wardrobe = await han()
      await page.evaluate(() => window.__mjg.shop()); await page.waitForTimeout(100); left.shop = await han()
      await page.evaluate(() => window.__mjg.shop('weapon', 0)); await page.waitForTimeout(100); left.wskin = await han()
      await page.evaluate(() => window.__mjg.shop('skill', 0)); await page.waitForTimeout(100); left.skin = await han()
      await page.evaluate(() => window.__mjg.startGame && document.querySelector('#ui .btn.main').click()); await page.waitForTimeout(200); left.chars = await han()
      await page.evaluate(() => { const M = window.__mjg; M.startGame(0); M.G.queue.push('level'); M.step(1 / 60) }); left.box = await han()
      await page.evaluate(() => window.__mjg.pick0()); await page.keyboard.press('Escape'); await page.waitForTimeout(100); left.pause = await han()
      const lang = await page.evaluate(() => [document.documentElement.lang, JSON.parse(localStorage.getItem('mjg.v1')).lang])
      if (lang[0] !== code || lang[1] !== code || Object.values(left).some(a => a.length)) errors.push(`[lang] ${code} ${JSON.stringify({ lang, left })}`)
    }
    // 나라별 홍보 링크 /en/ · /ja/ · /zh-cn/ · /zh-tw/ — 게임(/?lang=…)으로 넘어가 그 말로 정하고 기억, 주소의 ?lang= 은 지운다
    for (const [dir, code] of [['en', 'en'], ['ja', 'ja'], ['zh-cn', 'zh-CN'], ['zh-tw', 'zh-TW']]) {
      await page.evaluate(() => localStorage.clear()); await page.goto(URL + dir + '/'); await page.waitForURL(u => u.pathname === new globalThis.URL(URL).pathname); await page.waitForTimeout(600)
      const via = await page.evaluate(() => ({ lang: document.documentElement.lang, saved: JSON.parse(localStorage.getItem('mjg.v1') || '{}').lang, search: location.search, han: (document.querySelector('#ui').innerText.replace(/한국어/g, '').match(/[가-힣]+/g) || []).length }))
      if (via.lang !== code || via.saved !== code || via.search || via.han) errors.push(`[lang] /${dir}/ ` + JSON.stringify(via))
    }
  })

  await browser.close()
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO ERRORS')
  process.exit(errors.length ? 1 : 0)
})()
