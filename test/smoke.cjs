// 스모크 테스트 — 실행: python3 -m http.server 8765 를 띄우고 NODE_PATH=<playwright 가 있는 node_modules> node test/smoke.cjs (그림은 test/shots/).
//   처음 화면 → 캐릭터 → 판 → 상자 → 최종보스까지 빨리 돌리기(무적) → 세이렌 → 클리어. 콘솔 에러가 하나라도 있으면 실패
const { chromium } = require('playwright')
const OUT = __dirname + '/shots/'; require('fs').mkdirSync(OUT, { recursive: true })
const TERMS_VER = /const TERMS_VER = '([\d-]+)'/.exec(require('fs').readFileSync(require('path').join(__dirname, '..', 'game.js'), 'utf8'))[1]   // 이용약관 동의 버전 — 흉낸 서버가 「이미 동의함」으로 답할 때
const URL = process.env.URL || 'http://127.0.0.1:8765/', M_DARK = 29 * 60, M_END = 30 * 60, M_INF = { rest: 12, gap: 60, dark: 180 }   // 무한 — game.js INF 와 같게

;(async () => {
  const browser = await chromium.launch()
  const errors = []
  if (/sort\([^)]*\)\s*=>[^)]*rnd\(\)/.test(require('fs').readFileSync(require('path').join(__dirname, '..', 'game.js'), 'utf8'))) errors.push('[shuffle] 비교 함수에 rnd 를 쓰는 sort — 엔진마다 모의 토벌 결과가 갈림, shuffle() 을 쓸 것')   // QA 2026-11-22
  const run = async (name, viewport, fn) => {
    if (process.env.ONLY && !process.env.ONLY.split(',').includes(name)) return   // ONLY=sync,ban — 그것만
    const page = await browser.newPage({ viewport, deviceScaleFactor: 2, locale: 'ko-KR' })   // 고른 말이 없으면 브라우저 언어 — 점검은 한국어 브라우저로
    page.on('pageerror', e => errors.push(`[${name}] ${e.message}`))
    page.on('request', q => { if (q.url().includes('.supabase.co') && !['acct', 'sync', 'susp', 'login', 'gis', 'terms', 'coupon', 'simrank'].includes(name) && !q.url().includes('rpc/blocked')) errors.push(`[${name}] 점검 중에 진짜 통계 서버로 보냄 ${q.url()}`) })   // 로컬에서는 안 보내야 한다(acct 는 page.route 로 흉내 낸 서버에만)
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

  await run('gemcap', { width: 1280, height: 800 }, async page => {   // 보석 150개(가득) — 새 경험치는 가까운(60px) 보석에 더하거나, 없으면 가장 먼 보석을 처치 자리로 옮긴다(예전엔 먼 곳에 쌓여 안 보였다 · 사용자 2026-11-22)
    const v = await page.evaluate(() => { const M = window.__mjg; M.startGame(0); const G = M.G; G.gems.length = 0
      for (let i = 0; i < 150; i++) G.gems.push({ x: M.pl.x + 2000 + i, y: M.pl.y, v: 1, pull: false, sp: 0 })
      const e = M.spawn('goblin', M.pl.x + 300, M.pl.y + 200); M.kill(e); const at = G.gems.filter(g => Math.hypot(g.x - e.x, g.y - e.y) < 10)
      const e2 = M.spawn('goblin', e.x + 20, e.y); M.kill(e2)
      return { n: G.gems.length, at: at.length, sum: G.gems.reduce((a, g) => a + g.v, 0), xp: e.xp + e2.xp, near: G.gems.filter(g => Math.hypot(g.x - e.x, g.y - e.y) < 10).map(g => g.v) } })
    if (v.n !== 150 || v.at !== 1 || v.sum !== 150 + v.xp || v.near.length !== 1 || v.near[0] !== 1 + v.xp) errors.push('[gemcap] 가득 찬 보석 ' + JSON.stringify(v))
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
      const real = ms => { M.startGame(0); for (let i = 0; i < 12 * 30; i++) { M.G.t = i / 30; M.autoQ(ms) } return M.LQ }   // 판 처음부터 그 프레임으로 12초 — 30fps 묶임은 그대로, 느린 기기는 내려간다(기준이 잡히기 전 3~5초에 내려가던 것 — QC)
      const lock30 = real(33.3), slow45 = real(45)
      return { w0, l1, w1, l2, w2, back, cap30, lock30, slow45 }
    })
    console.log('perf', q)
    if (q.l1 !== 1 || q.l2 !== 2 || !(q.w1 < q.w0 && q.w2 < q.w1) || q.back[0] !== 0 || q.back[1] !== q.w0 || q.cap30 !== 0 || q.lock30 !== 0 || !(q.slow45 >= 1)) errors.push('[perf] 자동 화질 ' + JSON.stringify(q))
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

  await run('wander', { width: 390, height: 844 }, async page => {   // 떠돌이 보물상자 — 1500 + 10초면 반드시(쿨타임 · 바닥에 있으면 찬 채로 기다림 · 12초 뒤 사라짐), 연 결과가 표(평균 보상금 ≈ 50 · 부활석 ≈ 0.3%)대로, 주운 부활석이 있으면 그것부터 쓰고 상점 것은 못 쓴다, 결과 화면 보상금에 더해진다
    await page.evaluate(() => localStorage.setItem('mjg.v1', JSON.stringify({ diff: 'easy', stone: 2, noStats: true }))); await page.reload(); await page.waitForTimeout(500)
    const r = await page.evaluate(() => {
      const M = window.__mjg, out = {}; M.startGame(0); const G = M.G, pl = M.pl
      const step = () => { G.queue.length = 0; pl.inv = 9; pl.hp = Math.max(pl.hp, 50); M.step(1 / 30) }
      G.lastBox = -1e9; let n = 0
      while (!G.items.some(i => i.k === 'coinbox') && n++ < 150) { pl.x += 1600; step() }
      out.spawned = G.items.some(i => i.k === 'coinbox'); out.tries = n
      G.items.length = 0; pl.x += 1600; step(); out.cool = G.items.some(i => i.k === 'coinbox')   // 방금 나왔다 — 쿨타임 10초(멀리 와도 안 나옴, 찬 채로 기다림)
      G.t += 10.1; step(); out.after = G.items.some(i => i.k === 'coinbox')   // 쿨타임이 풀리면 더 안 움직여도 바로
      G.items[0].t = 12.1; step(); out.gone = !G.items.some(i => i.k === 'coinbox')   // 12초 뒤 사라짐
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
    if (!r.spawned || r.tries > 2 || r.cool || !r.after || !r.gone || !(r.avg > 36 && r.avg < 70) || !(r.stone > 0.05 && r.stone < 0.9) || m1 !== 'revive' || !/상점 부활석 2개는 이번 판엔 못 써요/.test(hint) || a.shop !== 2 || a.run !== 0 || m2 !== 'over' || !/떠돌이 보물상자[\s\S]*\+123/.test(coin)) errors.push('[wander] 떠돌이 보물상자 ' + JSON.stringify({ r, m1, a, m2, coin }))
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

  await run('outfit', { width: 420, height: 900 }, async page => {   // 의상 — 일반은 두 번 눌러 산다(500) · 업적 의상은 어려움 클리어 전엔 잠김 · 입고 시작하면 이펙트
    await page.evaluate(() => { localStorage.setItem('mjg.v1', JSON.stringify({ coin: 600, noStats: true })) }); await page.reload(); await page.waitForTimeout(500)
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
    if (a.coin !== 100 || a.wear !== 'pj' || !a.richOff || !a.achOff || b.wear !== 'a_chiikawa' || !(b.fx > 0)) errors.push('[outfit] 의상 ' + JSON.stringify({ a, b }))
  })

  await run('skins', { width: 420, height: 900 }, async page => {   // 무기 스킨(상점 1,000 · 업적은 보통 클리어) · 스킬 스킨(상점 1,000 · 각성해 본 스킬은 그냥) — 켜면 게임에서 G.sk 에
    await page.evaluate(() => { localStorage.setItem('mjg.v1', JSON.stringify({ coin: 2500, noStats: true, awSeen: ['yaha'] })) }); await page.reload(); await page.waitForTimeout(500)
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
    if (w.wear !== 'w_chiikawa' || !w.achOff || !w.winterOff || k.coin !== 500 || !k.sk.includes('sasu') || k.sk.includes('yaha') || !(k.wfx > 0)) errors.push('[skins] 스킨 ' + JSON.stringify({ w, k, yaha }))
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

  await run('awaken-key', { width: 1280, height: 800 }, async page => {   // 각성 상자 — 첫 카드가 골라져 있어 Enter · Space(넘버패드 Enter 도) 로 받는다
    for (const key of ['Enter', 'Space', 'NumpadEnter']) {
      await page.evaluate(() => { const M = window.__mjg; M.startGame(1); const w = M.G.weapons[0]; w.lv = 8; w.st = M.wstat(w); M.G.queue.push('awaken'); M.pl.inv = 9; M.step(1 / 30) })
      await page.waitForSelector('#ui .panel.box.ready', { timeout: 8000 }); await page.keyboard.press(key)   // 준비된 뒤에 누른다(숫자 기다리기 대신 상태 — QC)
      await page.waitForFunction(() => window.__mjg.mode === 'play', null, { timeout: 5000 }).catch(() => {})
      const r = await page.evaluate(() => ({ mode: window.__mjg.mode, aw: [...window.__mjg.G.aw] }))
      if (r.mode !== 'play' || r.aw[0] !== 'guitar') errors.push(`[awaken-key] ${key} ${JSON.stringify(r)}`)
    }
  })

  await run('autopick', { width: 1280, height: 720 }, async page => {   // 작전대로 자동 선택 — 끄면 평소 창 · 켜면 창 없이 작전 순서대로(리롤 · 제외 · 스킵을 쓰고) · 다 쓰면 노란 멈춤 알림 창 · 봉인 신고 없음(?guard)
    await page.goto(URL + (URL.includes('?') ? '&' : '?') + 'guard'); await page.waitForTimeout(400)
    const prep = auto => page.evaluate(a => { localStorage.setItem('mjg.v1', JSON.stringify({ noStats: true, seen: 1, ctrlSeen: 1, touchSeen: 1, diff: 'easy', theme: 'winter', ach: { hard: 1 } })); localStorage.setItem('mjg.sim', JSON.stringify({ seen2: 1, auto: a, plans: { chiikawa: { w: [], p: ['manju'], s: 'move' } } })) }, auto)
    const play = () => page.evaluate(async () => { const M = window.__mjg, b = document.getElementById('spd'), wait = ms => new Promise(r => setTimeout(r, ms)); M.startGame(0); await wait(100); b.click(); b.click()
      const t0 = performance.now(); let lv = 1, picks = 0
      while (performance.now() - t0 < 60000 && M.mode !== 'box' && M.mode !== 'over' && M.mode !== 'revive') { await wait(100); const k = (M.G.t | 0) % 6 < 3; dispatchEvent(new KeyboardEvent('keydown', { code: k ? 'ArrowRight' : 'ArrowLeft' })); dispatchEvent(new KeyboardEvent('keyup', { code: k ? 'ArrowLeft' : 'ArrowRight' })); if (M.G.lvl > lv) { picks += M.G.lvl - lv; lv = M.G.lvl } }
      return { mode: M.mode, t: Math.round(M.G.t), lvl: M.G.lvl, note: !!document.querySelector('#ui .lvl-note'), used: [M.G.rr, M.G.skips, M.G.bans].join(','), w: M.G.weapons.map(w => w.id + w.lv).join(' '), bad: M.G.bad || null } })
    await prep(0); await page.reload(); await page.waitForTimeout(400); const off = await play()
    let on; for (let i = 0; i < 3; i++) { await prep(1); await page.reload(); await page.waitForTimeout(400); on = await play(); if (on.mode === 'box') break }   // 진짜 판이라 무작위 — 멈춤 알림 전에 쓰러지면 다시(시험 흔들림)
    console.log('autopick off', JSON.stringify(off), 'on', JSON.stringify(on))
    if (off.mode !== 'box' || off.note || off.lvl !== 2) errors.push('[autopick] 끄면 평소 창 ' + JSON.stringify(off))
    if (on.mode !== 'box' || !on.note || on.used !== '0,0,0' || on.lvl < 3 || on.bad) errors.push('[autopick] 켜면 자동 → 멈춤 알림 ' + JSON.stringify(on))
  })

  await run('simrank', { width: 360, height: 740 }, async page => {   // 모의 토벌 랭킹 — 탭 · 난이도 · 두 줄 카드 · 자세히 → 이 작전 써 보기(이번 주 전장) · 끝까지 본 판 올리기 · Math 되돌림
    const sent = []
    await page.route(/supabase\.co/, r => { const u = r.request().url(), body = r.request().postDataJSON?.() || {}, j = x => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(x) })
      if (u.includes('rpc/')) sent.push(u.split('rpc/')[1].split('?')[0] + (body.on_diff ? ':' + body.on_diff : ''))
      if (u.includes('agreed')) return j({ day: '2026-11-18' }); if (u.includes('my_nick')) return j({ nick: '치이카와팬', next: '2026-11-24' })
      if (u.includes('top_sims')) return j(body.on_diff === 'inf' ? [{ rank: 1, nick: '하치팬', ch: 'hachiware', s: 'stay', w: 'guitar pochette', p: 'manju', kind: 'dead', t: 1700, kills: 40000, bosses: 9, lv: 1, lvl: 80, v: 'x', me: false }] : [])
      if (u.includes('my_sim')) return j([]); if (u.includes('sim_start')) return j({ wk: 0, field: 212 }); if (u.includes('submit_sim')) { sent.push('submit:' + JSON.stringify(body)); return j({ r: 'ok', rank: 1 }) }
      if (u.includes('saves?select')) return j([]); if (u.includes('top_ranks') || u.includes('my_rank')) return j([]); return r.fulfill({ status: 204 }) })
    await page.evaluate(() => { localStorage.setItem('mjg.v1', JSON.stringify({ noStats: false, seen: 1, ctrlSeen: 1, touchSeen: 1, diff: 'inf', theme: 'winter' })); localStorage.setItem('mjg.sim', JSON.stringify({ seen2: 1 })); localStorage.setItem('mjg.auth', JSON.stringify({ at: 'a.e30.b', rt: 'r', exp: Date.now() / 1000 + 9999, uid: 'u1', prov: 'google' })) })
    await page.reload(); await page.waitForTimeout(900)
    await page.locator('#ui .row .btn', { hasText: '랭킹' }).click(); await page.waitForTimeout(400); await page.locator('.rk-tabs button').nth(1).click(); await page.waitForTimeout(500)
    const v = await page.evaluate(() => { const li = document.querySelector('.list.rk-sim li'), r = n => li.querySelector(n)?.getBoundingClientRect(); return { rows: document.querySelectorAll('.list.rk-sim li').length, pills: document.querySelectorAll('.rk-diff button').length, sub: document.querySelector('.panel.rank .sub').textContent, two: r('.bd').top > r('.nm').bottom - 2, lv: li.querySelector('.lvpill')?.textContent } })
    await page.locator('.list.rk-sim li').first().click(); await page.waitForTimeout(300); await page.locator('.modal .btn.main').click(); await page.waitForTimeout(400)
    const plan = await page.evaluate(() => ({ mode: window.__mjg.mode, on: [...document.querySelectorAll('.sim-opt .theme button.on')].map(b => b.textContent).join('|'), w: document.querySelectorAll('.slots')[0].querySelectorAll('button.on').length }))
    await page.locator('#ui .row .btn.main').click(); await page.waitForTimeout(600)
    const run = await page.evaluate(async () => { const M = window.__mjg, sin0 = Math.sin; const during = String(Math.sin).includes('native'); let n = 0; while (M.SIM && !M.SIM.end && n++ < 80000) M.simStep(); await new Promise(r => setTimeout(r, 1800)); return { during, after: String(Math.sin).includes('native'), seed: M.SIM?.seed, rk: document.querySelector('.rk-up')?.textContent || null } })
    console.log('simrank', JSON.stringify(v), JSON.stringify(plan), JSON.stringify(run), sent.filter(x => !x.startsWith('submit')).join(' '))
    const sub = sent.find(x => x.startsWith('submit:')), body = sub && JSON.parse(sub.slice(7))
    if (v.rows !== 1 || v.pills !== 0 || !/#\d+/.test(v.sub) || !v.two || !/1단계/.test(v.lv || '')) errors.push('[simrank] 랭킹 줄(무한만 · 난이도 고르기 없음) ' + JSON.stringify(v))
    if (plan.mode !== 'simplan' || !plan.on.includes('이번 주') || plan.on.split('|')[0] !== '정착형' || plan.w !== 2) errors.push('[simrank] 이 작전 써 보기 ' + JSON.stringify(plan))
    if (run.during || !run.after || !/1위/.test(run.rk || '') || !body || body.ch !== 'hachiware' || body.w !== 'guitar pochette' || body.s !== 'stay' || body.diff !== 'inf' || !sent.includes('sim_start')) errors.push('[simrank] 올리기 · Math ' + JSON.stringify(run) + ' ' + sub)
  })

  await run('autobox', { width: 1280, height: 720 }, async page => {   // 작전대로 자동 선택 — 각성 상자(목록 순서) · 보물상자 · 잭팟(다 받기)도 창 없이(QC)
    await page.evaluate(() => { localStorage.setItem('mjg.v1', JSON.stringify({ noStats: true, seen: 1, ctrlSeen: 1, touchSeen: 1, diff: 'easy', theme: 'winter' })); localStorage.setItem('mjg.sim', JSON.stringify({ seen2: 1, auto: 1, plans: { chiikawa: { w: ['guitar', 'pochette', 'ramen'], p: ['manju', 'armor'], s: 'move' } } })) }); await page.reload(); await page.waitForTimeout(400)
    const r = await page.evaluate(async () => { const M = window.__mjg, wait = ms => new Promise(r => setTimeout(r, ms)), until = async f => { for (let i = 0; i < 60 && !f(); i++) await wait(50) }
      M.startGame(0); await wait(200); const G = M.G
      G.weapons[0].lv = 8; G.queue.push('awaken'); await until(() => !G.queue.length && M.mode === 'play'); await wait(100)
      const aw = { has: G.aw.has('sasu'), mode: M.mode }
      let n = 0; while (G.jackpots < 1 && n < 20) { G.queue.push('chest'); n++; await until(() => !G.queue.length); await wait(80); if (M.mode === 'box') break }
      return { aw, chests: n, jackpots: G.jackpots, mode: M.mode, note: !!document.querySelector('#ui .lvl-note'), w: G.weapons.map(w => w.id + w.lv).join(' '), p: Object.keys(G.passives).join(' '), band: document.querySelector('.auto-band .what')?.textContent } })
    console.log('autobox', JSON.stringify(r))
    if (!r.aw.has || r.aw.mode !== 'play') errors.push('[autobox] 각성 자동 ' + JSON.stringify(r.aw))
    if (r.jackpots < 1 || !(r.mode === 'play' || r.note) || r.w.split(' ').length + r.p.split(' ').filter(Boolean).length < 3) errors.push('[autobox] 보물상자 · 잭팟 자동 ' + JSON.stringify(r))
  })

  await run('spdinf', { width: 1280, height: 720 }, async page => {   // 무한 진짜 판은 2배속까지(사용자) — 어려움을 깬 사람이 3배속으로 두었어도 무한을 시작하면 2로 · 무한 판 중 단추는 1 → 2 → 1, 다른 난이도는 3까지
    await page.evaluate(() => localStorage.setItem('mjg.v1', JSON.stringify({ noStats: false, seen: 1, ctrlSeen: 1, touchSeen: 1, diff: 'normal', theme: 'winter', ach: { hard: 1 } }))); await page.reload(); await page.waitForTimeout(400)
    const r = await page.evaluate(async () => { const M = window.__mjg, b = document.getElementById('spd'), wait = ms => new Promise(r => setTimeout(r, ms)), out = {}
      M.startGame(0); await wait(100); b.click(); b.click(); out.normal = b.textContent
      M.finish(false, true); await wait(100)
      ;[...document.querySelectorAll('#ui .btn')].find(x => x.textContent.includes('캐릭터 바꾸기')).click(); await wait(200)   // 같은 탭 · 3배속 그대로 무한을 고르고 시작 → 2배속으로(정직한 사람이 spd 로 걸리지 않게)
      document.querySelector('#ui .diff button[data-k="inf"]').click(); await wait(100); M.startGame(0); await wait(100)
      out.clamp = b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '+' : '-') + (M.G.inf ? ' inf' : '')
      M.finish(false, true); await wait(100)
      return out })
    await page.reload(); await page.waitForTimeout(400)
    const r2 = await page.evaluate(async () => { const M = window.__mjg, b = document.getElementById('spd'), wait = ms => new Promise(r => setTimeout(r, ms))
      b.click(); b.click(); const pre = b.textContent   // 무한 고른 처음 화면 — 1 → 2 → 1(3 없음)
      M.startGame(0); await wait(100); const start = b.textContent; const seq = []; for (let i = 0; i < 3; i++) { b.click(); seq.push(b.textContent + (b.getAttribute('aria-pressed') === 'true' ? '+' : '-')) }
      return { pre, start, inf: M.G.inf, seq } })
    console.log('spdinf', JSON.stringify(r), JSON.stringify(r2))
    if (r.normal !== '×3' || r.clamp !== '×2+ inf' || r2.pre !== '×2' || r2.start !== '×2' || !r2.inf || r2.seq.join() !== '×2+,×2-,×2+') errors.push('[spdinf] ' + JSON.stringify([r, r2]))
  })

  await run('simpin', { width: 1280, height: 800 }, async page => {   // 모의 토벌 고정 값 — 계산에 닿는 game.js 변경은 PATCH_ID(패치노트 줄)를 꼭 올린다(재현 확인이 판 번호로 커밋을 찾음 · QC 2026-11-22). 바뀌면: 패치노트 줄을 더하고 아래 v · r 을 새 값으로
    const PIN = { v: '2026-11-27#2', r: ['dead|10136|42|822|1|0', 'dead|57484|77|1682|6|0'] }   // kind|kills|lvl|t|bosses|lv — 엔진 셋 같음
    const PLANS = [{ ch: 'chiikawa', diff: 'inf', winter: true, s: 'stay', w: ['sasu', 'pochette', 'yaha'], p: ['clover', 'magnet'], seed: 212 },   // 치이카와 · 정착형 · 겨울 · 무한 · 전장 212
      { ch: 'rakko', diff: 'inf', winter: false, s: 'move', w: ['sword', 'sasu', 'curry', 'guitar', 'ura', 'nantoka'], p: ['license', 'manju', 'clock', 'mega', 'armor', 'double'], seed: 77 }]   // 25분 넘게 가는 판 — 15분 뒤 체력 표 · 16 · 22분 새 보스 · 짧은 일섬 · 먼 곳 피해(farK — 카레 · 어떻게든)까지 지난다(인프라 2026-11-26)
    const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'game.js'), 'utf8'), m = src.slice(src.indexOf('const PATCH = [')).match(/\[\s*'(\d{4}-\d{2}-\d{2})',\s*\[([\s\S]*?)\n  \]\],/)
    const v = m && `${m[1]}#${(m[2].match(/^\s*\['(?:new|up|down|fix)'/gm) || []).length}`
    const r = await page.evaluate(async P => { const o = []; for (const plan of P) { const e = await window.__mjg.simRun(plan); o.push([e.kind, e.kills, e.lvl, Math.floor(e.t), e.bosses, e.lv || 0].join('|')) } return o }, PLANS)
    if (v === PIN.v && r.join() !== PIN.r.join()) errors.push(`[simpin] 모의 토벌 결과가 바뀌었는데 PATCH_ID(${v})는 그대로 — 패치노트 줄을 더하고 PIN 을 고칠 것 (${PIN.r} → ${r})`)
    if (v !== PIN.v) errors.push(`[simpin] PATCH_ID 가 ${v} 로 바뀜 — PIN 을 { v: '${v}', r: ${JSON.stringify(r).replace(/"/g, "'")} } 로 고칠 것`)
  })

  await run('sim', { width: 360, height: 740 }, async page => {   // 모의 토벌 — 같은 전장 = 같은 결과 · 보상금(끝까지 본 판만 · 한 판 150 · 하루 3판) · 서버 안 부름 · 관전 3배속 · 그만두기 · 무한에서도
    const net = []; page.on('request', r => { if (/supabase|google-analytics|googletagmanager/.test(r.url())) net.push(r.url()) })
    await page.evaluate(() => localStorage.setItem('mjg.v1', JSON.stringify({ noStats: true, seen: 1, ctrlSeen: 1, touchSeen: 1, diff: 'normal', theme: 'winter', coin: 77, up: { manju: 5 } }))); await page.reload(); await page.waitForTimeout(500); net.length = 0
    const r = await page.evaluate(async () => { const M = window.__mjg, save = () => JSON.parse(localStorage.getItem('mjg.v1')), before = localStorage.getItem('mjg.v1')
      const plan = { ch: 'chiikawa', diff: 'normal', winter: true, s: 'stay', seed: 11, w: ['sasu', 'sword', 'guitar'], p: ['manju', 'armor'] }   // 시드 11 — 예전에 AI 가 목록 밖 새 무기로 칸을 막던 판. 막는 카드는 받지 않아서(simBlock) 작전 무기는 늘 칸이 남는다(okW)
      const key = e => [e.kind, Math.round(e.t * 20), e.lvl, e.bosses, e.w.join(' '), e.log.length].join('|')
      const a = await M.simRun(plan), b = await M.simRun(plan), same = localStorage.getItem('mjg.v1') === before, c = await M.simRun({ ...plan, s: 'move' })
      const pays = []; for (let i = 0; i < 4; i++) { const c0 = save().coin, e = await M.simRun({ ...plan, seed: 0 }, true); pays.push([e.pay.coin, save().coin - c0, e.pay.n, e.pay.why || '']) }
      const inf = await M.simRun({ ...plan, diff: 'inf', seed: 22 })   // 무한 — 쓰러질 때까지(30분에 끊지 않는다) · 도달 단계 · 상점 강화 최대 기준
      return { inf: [inf.kind, Math.round(inf.t), inf.lv], a: key(a), b: key(b), c: key(c), same, pays, day: save().simPay, up: save().up.manju, ach: save().ach?.coin || 0, sim: M.SIM, G: !!M.G, okW: plan.w.every(id => a.w.includes(id)) } })
    await page.setViewportSize({ width: 1280, height: 800 }); await page.waitForTimeout(300)   // 창 크기가 달라도 같은 결과(계산용 화면 크기 고정 — QA)
    r.wide = await page.evaluate(async () => { const e = await window.__mjg.simRun({ ch: 'chiikawa', diff: 'normal', winter: true, s: 'stay', seed: 11, w: ['sasu', 'sword', 'guitar'], p: ['manju', 'armor'] }); return [e.kind, Math.round(e.t * 20), e.lvl, e.bosses, e.w.join(' '), e.log.length].join('|') })
    await page.setViewportSize({ width: 360, height: 740 }); await page.waitForTimeout(300)
    if (r.wide !== r.a) errors.push('[sim] 창 크기에 따라 결과가 다름 ' + r.a + ' / ' + r.wide)
    console.log('sim', JSON.stringify(r))
    if (r.inf[0] !== 'dead' && r.inf[1] < 1800 || typeof r.inf[2] !== 'number') errors.push('[sim] 무한 ' + JSON.stringify(r.inf))
    if (r.a !== r.b || r.a === r.c || !r.same || r.sim || r.G || !r.okW) errors.push('[sim] 같은 전장 · 성향 · save · 정리 ' + JSON.stringify(r))
    if (!r.pays.slice(0, 3).every((x, i) => x[0] > 0 && x[0] <= 150 && x[1] === x[0] && x[2] === i + 1) || r.pays[3][0] !== 0 || r.pays[3][1] !== 0 || r.pays[3][3] !== 'full' || r.day?.n !== 3 || r.up !== 5 || r.ach) errors.push('[sim] 보상금 ' + JSON.stringify(r.pays))
    // 관전 — 화면 흐름 · 3배속 · ×3 단추 · 띠 · 그만두기(오늘 다 받았으니 묻지 않는다) → 작전 짜기, 단추 되돌림
    const w = await page.evaluate(async () => { const M = window.__mjg, q = s => document.querySelector(s), wait = ms => new Promise(r => setTimeout(r, ms))
      q('#ui .btn.main').click(); await wait(300); q('#ui .btn.sim').click(); await wait(300); q('.modal .btn.main')?.click(); await wait(300)
      const style = q('.sim-style button:not(.on)'); style.click(); await wait(100)
      q('#ui .row .btn.main').click(); await wait(400)
      const t0 = M.G.t, at = performance.now(); await wait(1500); const rate = (M.G.t - t0) / ((performance.now() - at) / 1000)
      const spd = q('#spd'), o = { mode: M.mode, watch: M.SIM?.watch, s: M.SIM?.plan.s, spd: [spd.textContent, spd.disabled, spd.getAttribute('aria-pressed')], spec: !q('.spec:not(.auto-band)').hidden, rate: +rate.toFixed(2) }
      q('.spec-btns .btn').click(); await wait(300)
      return { ...o, after: { mode: M.mode, sim: M.SIM, spd: [spd.textContent, spd.disabled], spec: !!q('.spec:not(.auto-band)') } } })
    const btn = await page.evaluate(() => new Promise(res => { document.querySelector('#ui .row .btn').click(); setTimeout(() => { const b0 = document.querySelector('#ui .btn.sim').disabled; document.querySelector('#ui .diff button[data-k="inf"]').click(); res({ b0, b1: document.querySelector('#ui .btn.sim').disabled }) }, 300) }))
    console.log('sim watch', JSON.stringify(w), JSON.stringify(btn), 'net', net.length)
    if (w.mode !== 'play' || !w.watch || w.s !== 'stay' || w.spd.join() !== '×3,true,true' || !w.spec || w.rate < 1.5 || w.rate > 3.3) errors.push('[sim] 관전 ' + JSON.stringify(w))
    if (w.after.mode !== 'simplan' || w.after.sim || w.after.spd[1] || w.after.spec) errors.push('[sim] 그만두기 ' + JSON.stringify(w.after))
    if (net.length) errors.push('[sim] 서버 요청 ' + net.slice(0, 2).join(' '))
    if (btn.b0 || btn.b1) errors.push('[sim] 무한에서도 단추 ' + JSON.stringify(btn))
  })

  // 언어 — 처음 화면 오른쪽 위에서 고르면 기억하고 다시 불러온다. 다른 말에서는 처음 화면 · 도감 · 패치노트 · 캐릭터 고르기 · 레벨 업 상자 · 일시정지에 한국어가 남지 않는다(언어 이름 「한국어」 빼고)
  await run('inf', { width: 1280, height: 800 }, async page => {   // 무한 — 세이렌을 쓰러뜨려도 판이 이어지고, 보스 둘씩 → 세이렌 둘 → 4분 넘으면 검은 별똥별
    await page.evaluate(() => localStorage.setItem('mjg.v1', JSON.stringify({ noStats: true, diff: 'inf', seen: 1 }))); await page.reload(); await page.waitForTimeout(400)
    const go = (sec, who = '') => page.evaluate(([sec, who]) => { const M = window.__mjg, G = M.G
      for (let i = 0; i < sec * 20; i++) { M.pl.inv = 9; G.next = 1e12; G.rest = null; M.step(0.05)
        for (const e of G.foes) if (e.boss && !e.dead && (who === 'boss' ? e.kind !== 'siren' && e.kind !== 'mermaid' : e.kind === who)) M.kill(e) }
      return { lv: G.loop.lv, q: G.loop.queue.length, n: G.foes.filter(e => e.loop && !e.dead).length, sirens: G.final?.sirens?.filter(s => !s.dead).length || 0, dark: !!G.dark, mode: M.mode, ph: (G.final?.sirens || []).filter(s => !s.dead).map(s => s.ph).join(), bosses: G.bosses, guard: G.items.filter(i => i.k === 'guard').length + (G.guardN || 0) } }, [sec, who])   // guard — 떨어진 냄비뚜껑 방패(무한 1단계부터 보스 · 세이렌)
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
    if (a.guard !== 0 || c.guard !== 6 || p.guard !== 6 || e.guard !== 8) errors.push('[inf] 냄비뚜껑 방패 — 0단계 없음 · 1단계 보스 여섯 · 세이렌은 세 페이즈 다 쓰러뜨려야 하나씩 ' + JSON.stringify([a.guard, c.guard, p.guard, e.guard]))
    const guard = await page.evaluate(() => { const M = window.__mjg, G = M.G, pl = M.pl
      for (const it of G.items) if (it.k === 'guard') { it.x = pl.x; it.y = pl.y } pl.inv = 0; M.step(0.02)   // 주우면 이번 판 피해 감소 1 / (1 + 0.03 n)
      const hit = grow => { pl.inv = 0; pl.hp = 1e6; G.dying = 0; G.won = 0; M.ouch(1000, null, grow); return 1e6 - pl.hp }
      return { n: G.guardN, cut: Math.floor(M.guardCut() * 100), grow: hit(true), plain: hit(false) } })
    if (guard.n !== 8 || guard.cut !== 19 || Math.abs(guard.grow / guard.plain - 1 / 1.24) > 0.01) errors.push('[inf] 방패 줍기 · 피해 감소 ' + JSON.stringify(guard))
  })

  await run('guard', { width: 900, height: 700 }, async page => {   // 부정 플레이 봉인(?guard) — 진짜 프레임으로 돌리며 상자 고르기 · 일시정지엔 표시가 없고, 프레임 사이에 체력을 고치면 표시
    await page.goto(URL + '?guard'); await page.waitForTimeout(600)
    await page.evaluate(() => { localStorage.setItem('mjg.v1', JSON.stringify({ noStats: true, seen: 1 })) }); await page.reload(); await page.waitForTimeout(600)
    await page.evaluate(() => window.__mjg.startGame(0)); await page.waitForTimeout(1500)
    await page.evaluate(() => { window.__mjg.G.queue.push('level', 'level') })   // 상자 둘 — 다음 step 이 연다
    for (let i = 0; i < 2; i++) { await page.waitForSelector('#ui .panel.box.ready', { timeout: 8000 }); await page.keyboard.press('Digit1'); await page.waitForFunction(n => window.__mjg.mode === 'play' || document.querySelectorAll('#ui .panel.box.ready').length === 0, i, { timeout: 5000 }).catch(() => {}) }
    await page.waitForFunction(() => window.__mjg.mode === 'play', null, { timeout: 5000 }).catch(() => {})
    await page.keyboard.press('KeyP'); await page.waitForTimeout(200); await page.keyboard.press('KeyP'); await page.waitForTimeout(800)
    const ok = await page.evaluate(() => ({ bad: window.__mjg.G.bad || null, mode: window.__mjg.mode, lvl: window.__mjg.G.weapons.map(w => w.lv).join() }))
    await page.evaluate(() => { window.__mjg.pl.hp = 99999 }); await page.waitForFunction(() => window.__mjg.G.bad, null, { timeout: 5000 }).catch(() => {})   // 다음 프레임이 잡을 때까지
    const bad = await page.evaluate(() => window.__mjg.G.bad)
    console.log('guard', { ok, bad })
    if (ok.bad || ok.mode !== 'play' || !bad?.includes('seal')) errors.push('[guard] ' + JSON.stringify({ ok, bad }))
  })
  await run('ctrl', { width: 1280, height: 800 }, async page => {   // PC 첫 판 조작법 — 처음 1번(save.ctrlSeen) · 아래 가운데 카드 4칸 · 눌리지 않음 · 일시정지엔 숨김 · 15초 뒤 사라짐 · 휴대폰은 안 보임
    await page.evaluate(() => localStorage.setItem('mjg.v1', JSON.stringify({ noStats: true }))); await page.reload(); await page.waitForTimeout(400)
    await page.evaluate(() => window.__mjg.startGame(0)); await page.waitForFunction(() => +getComputedStyle(document.getElementById('ctrl') || document.body).opacity >= 0.9 && document.getElementById('ctrl'), null, { timeout: 8000 }).catch(() => {})   // 다 나타날 때까지(고정 1.2초 대신 — 부하에 흔들리지 않게)
    const a = await page.evaluate(() => { const c = document.getElementById('ctrl'), r = c?.getBoundingClientRect(); return c && { n: c.querySelectorAll('.cc').length, zrow: !!c.querySelector('.cc:last-of-type .zm .ico'), op: +getComputedStyle(c).opacity, pe: getComputedStyle(c).pointerEvents, bottom: innerHeight - r.bottom, mid: Math.abs(r.left + r.width / 2 - innerWidth / 2), seen: JSON.parse(localStorage.getItem('mjg.v1')).ctrlSeen, txt: c.innerText.replace(/\s+/g, ' ') } })
    await page.screenshot({ path: OUT + 'ctrl.png' })
    await page.keyboard.press('Escape'); await page.waitForTimeout(150); const paused = await page.evaluate(() => getComputedStyle(document.getElementById('ctrl')).visibility)
    await page.keyboard.press('Escape'); await page.waitForTimeout(150)
    await page.evaluate(() => window.__mjg.ctrlTick(14)); await page.waitForTimeout(100); const gone = await page.evaluate(() => !document.getElementById('ctrl'))
    await page.evaluate(() => { window.__mjg.title?.(); window.__mjg.startGame(1) }); await page.waitForTimeout(300); const again = await page.evaluate(() => !!document.getElementById('ctrl'))
    console.log('ctrl', { a, paused, gone, again })
    if (!a || a.n !== 4 || !a.zrow || a.op < 0.9 || a.pe !== 'none' || a.bottom < 20 || a.mid > 2 || a.seen !== 1 || !a.txt.includes('스킬은 저절로 나가요') || paused !== 'hidden' || !gone || again) errors.push('[ctrl] ' + JSON.stringify({ a, paused, gone, again }))
    const m = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, locale: 'ko-KR' }); await m.goto(URL); await m.evaluate(() => localStorage.setItem('mjg.v1', JSON.stringify({ noStats: true }))); await m.reload(); await m.waitForTimeout(400)
    await m.evaluate(() => window.__mjg.startGame(0)); await m.waitForTimeout(1500); const p0 = await m.evaluate(() => +getComputedStyle(document.getElementById('ctrl')).opacity)   // 세로 휴대폰은 「토벌 시작!」 글이 사라진 뒤(2.5초)
    await m.waitForFunction(() => +getComputedStyle(document.getElementById('ctrl') || document.body).opacity >= 0.9 && document.getElementById('ctrl'), null, { timeout: 8000 }).catch(() => {}); const phone = await m.evaluate(() => { const c = document.getElementById('ctrl'), r = c?.getBoundingClientRect(), s = JSON.parse(localStorage.getItem('mjg.v1')); return c && { touch: c.classList.contains('touch'), n: c.querySelectorAll('.cc').length, op: +getComputedStyle(c).opacity, top: Math.round(r.top), w: Math.round(r.width), pzi: !!c.querySelector('p .pzi svg'), mid: r.bottom < innerHeight / 2 - 30, right: innerWidth - r.right, seen: [s.ctrlSeen ?? null, s.touchSeen ?? null], txt: c.innerText.replace(/\s+/g, ' ') } })
    await m.screenshot({ path: OUT + 'ctrl-phone.png' }); await m.close()
    console.log('ctrl phone', { p0, phone })
    if (p0 > 0.05 || !phone?.touch || phone.n !== 3 || !phone.pzi || phone.op < 0.9 || phone.top < 140 || phone.top > 160 || phone.right < 10 || phone.seen.join() !== ',1' || !phone.mid || !phone.txt.includes('화면 배율')) errors.push('[ctrl] 휴대폰 ' + JSON.stringify({ p0, phone }))
  })
  await run('cap', { width: 800, height: 600 }, async page => {   // 같은 소모 아이템은 맵에 5개(무한 3개)까지 · 보스 주먹밥은 늘 · 상자는 한도 없음 / 어려움 · 무한 0단계 아노코 ×6 · 세이렌 ×10(무한 1단계 · 보통은 그대로)
    const go = async diff => { await page.evaluate(d => localStorage.setItem('mjg.v1', JSON.stringify({ noStats: false, diff: d, seen: 1, ctrlSeen: 1 })), diff); await page.reload(); await page.waitForTimeout(300); await page.evaluate(() => window.__mjg.startGame(0)) }
    const cap = () => page.evaluate(() => { const M = window.__mjg, G = M.G, n = k => G.items.filter(i => i.k === k).length; G.items.length = 0
      for (let i = 0; i < 9; i++) M.item(0, 0, 'onigiri'); const one = n('onigiri'); M.item(0, 0, { onigiri: 1, magnet: 1 }); const swap = n('magnet')
      for (let i = 0; i < 9; i++) M.item(0, 0, { onigiri: 1, magnet: 1 }); const both = [n('onigiri'), n('magnet')]; M.item(0, 0, 'onigiri', true); const boss = n('onigiri')
      for (let i = 0; i < 9; i++) { M.item(0, 0, 'pajama'); M.item(0, 0, 'battery') } const pj = n('pajama'), bt = n('battery'); { const b = M.summon('dekatsuyo'); M.kill(b) } const pjBoss = n('pajama') + n('battery') - pj - bt   // 진짜 보스를 잡으면 잠옷/건전지 보상은 한도라도 하나 떨어진다(force)
      for (let i = 0; i < 60; i++) M.item(0, 0); const rand = Math.max(...M.ITEM_CAP.filter(k => k !== 'onigiri').map(n)); const ch0 = n('chest'); for (let i = 0; i < 7; i++) M.item(0, 0, 'chest'); return { one, swap, both, boss, pj, pjBoss, rand, chest: n('chest') - ch0 } })
    const hp = () => page.evaluate(() => { const M = window.__mjg, G = M.G; G.t = 1200; const a = M.spawn('anoko', 0, 0).max; G.t = 1500; const s = M.spawn('siren', 0, 0).max; G.foes.length = 0; return [Math.round(a), Math.round(s)] })
    await go('normal'); const nm = { cap: await cap(), hp: await hp() }
    await go('hard'); const hd = { hp: await hp() }
    await go('inf'); const inf = { cap: await cap(), hp: await hp() }; await page.evaluate(() => { window.__mjg.G.loop.lv = 1 }); inf.hp1 = await hp()
    console.log('cap', JSON.stringify({ nm, hd, inf }))
    const c5 = nm.cap, c3 = inf.cap
    if (c5.one !== 5 || c5.swap !== 1 || c5.both.join() !== '5,2' || c5.boss !== 6 || c5.pj !== 2 || c5.pjBoss !== 1 || c5.rand > 3 || c5.chest !== 7) errors.push('[cap] 한도 오니기리 5 · 그 밖 2 ' + JSON.stringify(c5))
    if (c3.one !== 3 || c3.swap !== 1 || c3.both.join() !== '3,1' || c3.boss !== 4 || c3.pj !== 1 || c3.pjBoss !== 1 || c3.rand > 2 || c3.chest !== 7) errors.push('[cap] 무한 한도 오니기리 3 · 그 밖 1 ' + JSON.stringify(c3))
    if (Math.abs(hd.hp[0] / nm.hp[0] / (1 / 0.8) - 3.4 * 1.5) > 0.01 || Math.abs(hd.hp[1] / nm.hp[1] / (1 / 0.8) - 10) > 0.01) errors.push('[cap] 어려움 보스 체력(아노코 ×3.4 × 어려움 ×1.5 — 2026-11-26 · 세이렌 ×10 그대로) ' + JSON.stringify({ nm: nm.hp, hd: hd.hp }))
    if (Math.abs(inf.hp[0] / hd.hp[0] - 1.5) > 0.01 || Math.abs(inf.hp[1] / hd.hp[1] - 1.5) > 0.01 || Math.abs(inf.hp1[0] / inf.hp[0] - 1 / 3.4) > 0.01 || Math.abs(inf.hp1[1] / inf.hp[1] - 0.1) > 0.01) errors.push('[cap] 무한 보스 체력 ' + JSON.stringify(inf))
  })
  await run('clear', { width: 420, height: 900 }, async page => {   // 쉬움 · 보통 클리어 보상 — 망토 넷 · 감기 무기 스킨 둘(위 단계로 깨면 아래도 · 「풀밭」 칸은 맵 상관없이 · 겨울 칸은 그 단계 이상 겨울), 보유 효과 +0.5% · 랏코 치명타, 결과 화면 알림
    const own = () => page.evaluate(() => { const M = window.__mjg, o = k => +M.owns(k), w = k => +M.ownsW(k); return ['e', 'ew', 'n', 'nw'].map(k => o('k_chiikawa_' + k)).join('') + '|' + ['e_chiikawa', 'y_chiikawa', 'v_chiikawa', 's_chiikawa'].map(w).join('') })
    const set = async sv => { await page.evaluate(v => localStorage.setItem('mjg.v1', JSON.stringify({ noStats: true, seen: 1, ctrlSeen: 1, touchSeen: 1, ...v })), sv); await page.reload(); await page.waitForTimeout(400) }
    await set({}); const none = await own()
    await set({ best: { 'chiikawa.easy': { t: 1, kills: 1, lvl: 1, clears: 1 } } }); const easy = await own()
    await set({ best: { chiikawa: { t: 1, kills: 1, lvl: 1, clears: 1 } } }); const hard = await own()   // 어려움 ⊃ 보통 ⊃ 쉬움
    await set({ wwin: ['chiikawa'] }); const oldWin = await own()   // 예전 저장(겨울 보통 이상) → 겨울 칸 둘 · 겨울 무기 스킨
    await set({ wlv: { chiikawa: 1 } }); const easyWin = await own()
    await set({ best: { rakko: { t: 1, kills: 1, lvl: 1, clears: 1 } }, wlv: { rakko: 3 } })
    const crit = await page.evaluate(() => { const M = window.__mjg; M.startGame(5); return +M.S.crit.toFixed(3) })   // 랏코 0.03 + 0.10 + 섬 화관 0.01 + 망토 넷 0.02
    await set({}); await page.evaluate(() => { const M = window.__mjg; M.startGame(0); M.G.diff = 'easy'; M.G.D = { ...M.G.D }; M.G.winter = true; M.finish(true) }); await page.waitForTimeout(300)
    const res = await page.evaluate(() => ({ txt: document.querySelector('#ui .ach-new.dress')?.innerText.replace(/\s+/g, ' ') || '', wlv: JSON.parse(localStorage.getItem('mjg.v1')).wlv }))
    await page.evaluate(() => window.__mjg.shop('outfit', 0)); await page.waitForTimeout(200)
    const bon = await page.evaluate(() => [...document.querySelectorAll('.list.wr li.wr-clear .bon')].map(b => b.textContent))
    console.log('clear', { none, easy, hard, oldWin, easyWin, crit, res, bon: bon.slice(0, 2) })
    if (none !== '0000|0000' || easy !== '1000|1000' || hard !== '1010|1010' || oldWin !== '0101|0101' || easyWin !== '0100|0100' || crit !== 0.16 || !/클리어 보상을 받았어요/.test(res.txt) || !res.txt.includes('새내기 토벌대 망토') || !res.txt.includes('털실 감기') || res.wlv?.chiikawa !== 1 || bon.length !== 4 || !bon.every(b => b.includes('+0.5%'))) errors.push('[clear] ' + JSON.stringify({ none, easy, hard, oldWin, easyWin, crit, res, bon }))
    const crownRun = (diff, lv, win) => page.evaluate(([diff, lv, win]) => { const M = window.__mjg; M.startGame(0); const g = M.G; g.diff = diff; g.inf = diff === 'inf'; g.winter = false; g.loop.lv = lv; M.finish(win)   // 업적 의상(섬 화관) — 무한 1단계 이상 클리어도 어려움 이상(기획), 알림은 판 뒤에 새로 생겼을 때만
      return { note: !!document.querySelector('#ui .ach-new.dress')?.innerText.includes('업적 의상을 받았어요'), own: M.owns('a_chiikawa') } }, [diff, lv, win])
    await set({}); const inf1 = await crownRun('inf', 1, false); await page.reload(); await page.waitForTimeout(300); inf1.kept = await page.evaluate(() => window.__mjg.owns('a_chiikawa'))
    await set({}); const hard1 = await crownRun('hard', 0, true), infAfter = await crownRun('inf', 1, false)
    await set({}); const inf0 = await crownRun('inf', 0, false)   // 무한 0단계에서 짐 — 클리어 아님
    console.log('clear crown', { inf1, hard1, infAfter, inf0 })
    if (!inf1.note || !inf1.own || !inf1.kept || !hard1.note || !hard1.own || infAfter.note || !infAfter.own || inf0.note || inf0.own) errors.push('[clear] 업적 의상 · 알림 ' + JSON.stringify({ inf1, hard1, infAfter, inf0 }))
  })
  await run('coupon', { width: 360, height: 740 }, async page => {   // 쿠폰 — 계정 단추 점 · 빈칸이면 못 누름 · 실패는 모몽가(.no 흔들기 / .end 차분) · 성공은 셋이 축하 + 그 자리에서 보상금 · 받은 표시 · 저장 · 계정으로
    const answers = [{ r: 'bad' }, 'net', { r: 'expired', id: 'launch' }, { r: 'ban' }, { r: 'ok', id: 'launch', coin: 10000 }, { r: 'ok', id: 'launch', coin: 10000 }], codes = []; let saved = null   // 마지막 ok — 계정 저장엔 아직 없어 서버가 다시 준 것(이 기기엔 이미 더했으니 또 더하면 안 된다)
    await page.route('**/*.supabase.co/**', r => { const q = r.request(), u = q.url(), j = v => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(v) })
      if (u.includes('rpc/redeem')) { codes.push(q.postDataJSON()?.code); const a = answers.shift(); return j(a === 'net' ? null : a) }   // net — api() 가 연결 실패 때 돌려주는 null 과 같다(abort 는 콘솔 오류라)
      if (u.includes('agreed')) return j({ day: TERMS_VER }); if (u.includes('my_nick')) return j({ nick: '치이카와팬', next: '2026-11-24' }); if (u.includes('saves?select')) return j([])
      if (u.includes('saves?on_conflict')) saved = q.postDataJSON()
      return r.fulfill({ status: 204 }) })
    await page.evaluate(() => { localStorage.setItem('mjg.v1', JSON.stringify({ noStats: false, seen: 1, coin: 100 })); localStorage.setItem('mjg.auth', JSON.stringify({ at: 'a.e30.b', rt: 'r', exp: Date.now() / 1000 + 9999, uid: 'u1', prov: 'kakao' })) })
    await page.reload(); await page.waitForTimeout(800)
    const live = Date.now() < Date.parse('2026-12-20T23:59:59.999+09:00'), dot0 = await page.locator('.acct summary .dot').count()   // 기간이 끝나면 점이 없어야 한다
    if (dot0 !== (live ? 1 : 0)) errors.push('[coupon] 계정 단추 점 ' + dot0)
    await page.locator('.acct summary').click(); await page.locator('.acct div button', { hasText: '쿠폰 입력' }).click(); await page.waitForTimeout(150)
    const go = page.locator('.modal .btn.main'), say = page.locator('.modal .cp-say'), off = await go.isDisabled(), hid = await say.isHidden()
    await page.locator('.modal input').fill(' 먼작귀 서바이버즈 ')
    const look = async () => { await go.click(); await page.waitForTimeout(300); return { cls: await say.getAttribute('class'), txt: await say.innerText(), pt: await say.locator('canvas.pt').count(), val: await page.locator('.modal input').inputValue() } }
    const fails = [await look(), await look(), await look(), await look()]
    const want = [['no', '그런 쿠폰 없어'], ['no', '연결이 안 돼'], ['end', '벌써 끝났어'], ['end', '쿠폰을 쓸 수 없어요']]
    if (!off || !hid || fails.some((f, i) => !f.cls.split(' ').includes(want[i][0]) || !f.txt.includes(want[i][1]) || f.pt !== 1 || f.val !== ' 먼작귀 서바이버즈 ')) errors.push('[coupon] 실패 ' + JSON.stringify({ off, hid, fails }))
    await go.click(); await page.waitForTimeout(600)
    const ok = await page.evaluate(() => { const s = JSON.parse(localStorage.getItem('mjg.v1')); return { trio: document.querySelectorAll('.modal .cp-ok .cp-trio canvas.pt').length, gain: document.querySelector('.modal .cp-gain')?.textContent, coin: s.coin, cpn: s.cpn, input: document.querySelectorAll('.modal input').length, dot: document.querySelectorAll('.acct .dot').length } })
    console.log('coupon', { codes, fails: fails.map(f => f.cls), ok, saved: saved && { coin: saved.data?.coin, cpn: saved.data?.cpn } })
    if (codes.length !== 5 || codes.some(c => c !== '먼작귀 서바이버즈')) errors.push('[coupon] 보낸 코드 ' + JSON.stringify(codes))
    if (ok.trio !== 3 || ok.gain !== '+10,000' || ok.coin !== 10100 || ok.cpn?.join() !== 'launch' || ok.input || ok.dot) errors.push('[coupon] 성공 ' + JSON.stringify(ok))
    if (saved?.data?.coin !== 10100 || saved?.data?.cpn?.join() !== 'launch') errors.push('[coupon] 계정으로 바로 저장 ' + JSON.stringify(saved?.data && { coin: saved.data.coin, cpn: saved.data.cpn }))
    await page.keyboard.press('Escape'); await page.locator('.modal').evaluate(m => m.remove()).catch(() => {}); saved = null
    await page.locator('.acct summary').click(); await page.locator('.acct div button', { hasText: '쿠폰 입력' }).click(); await page.waitForTimeout(150)
    await page.locator('.modal input').fill('먼작귀서바이버즈'); await page.locator('.modal .btn.main').click(); await page.waitForTimeout(500)
    const twice = await page.evaluate(() => ({ cls: document.querySelector('.modal .cp-say')?.className, ok: document.querySelectorAll('.cp-ok').length, coin: JSON.parse(localStorage.getItem('mjg.v1')).coin }))
    if (twice.cls !== 'cp-say end' || twice.ok || twice.coin !== 10100 || saved?.data?.coin !== 10100) errors.push('[coupon] 이미 더한 기기에 ok 가 또 오면 ' + JSON.stringify({ twice, saved: saved?.data?.coin }))
  })
  await run('acct', { width: 390, height: 844 }, async page => {   // 계정 · 랭킹 — Supabase 를 흉내 낸다(로그인 토큰 · 랭킹 · 닉네임 · 기록 올리기)
    const row = (rank, nick, ch, me) => ({ rank, nick, ch, lv: 9 - rank, bosses: 30 - rank, bt: 2000, t: 2400, kills: 9000, lvl: 300, weapons: 'sasu9 ramen8', passives: 'manju5', slain: 'siren3 chef2', winter: true, at: '2026-11-17T10:00:00Z', me, lang: me ? null : 'ja' })   // 플레이한 언어 — 예전 기록(null)은 국기 없음
    const sent = [], maps = []; let body = null
    await page.route('**/*.supabase.co/**', r => { const u = r.request().url(), j = v => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(v) }); sent.push(u.split('/').pop())
      if (u.includes('top_ranks')) { maps.push(r.request().postDataJSON()?.on_winter); return j([row(1, 'A', 'usagi'), row(2, '치이카와팬', 'chiikawa', true)]) } if (u.includes('my_rank')) return j([row(2, '치이카와팬', 'chiikawa', true)])
      if (u.includes('agreed')) return j({ day: TERMS_VER }); if (u.includes('my_nick')) return j({ nick: '치이카와팬', next: '2026-11-24' }); if (u.includes('submit_rank')) { body = r.request().postDataJSON(); return j({ r: 'ok', rank: 2 }) } if (u.includes('start_run')) return j('tok-1'); if (u.includes('delete_me')) return j('ok'); if (u.includes('saves?select')) return j([])
      return r.fulfill({ status: 204 }) })
    await page.evaluate(() => { localStorage.setItem('mjg.v1', JSON.stringify({ noStats: false, diff: 'inf', seen: 1, theme: 'grass' })); localStorage.setItem('mjg.auth', JSON.stringify({ at: 'a.e30.b', rt: 'r', exp: Date.now() / 1000 + 9999, uid: 'u1', prov: 'google' })) })
    await page.reload(); await page.waitForTimeout(800)
    const pill = await page.locator('.acct .nm').textContent(), onStats = await page.locator('#ui .fine', { hasText: '로그인 중에는 통계를 보내요' }).count()
    if (onStats !== 1) errors.push('[acct] 로그인 중 통계 글 ' + onStats)
    const again = await page.evaluate(() => { const p = document.querySelector('#ui > .panel.home'); return { again: p?.classList.contains('again'), anim: getComputedStyle(p).animationName } })   // 계정을 불러온 뒤 다시 그린 처음 화면 — 나타나는 연출(pop)을 다시 하지 않는다(두 번 번쩍임)
    if (!again.again || again.anim !== 'none') errors.push('[acct] 처음 화면 다시 그릴 때 pop ' + JSON.stringify(again))
    await page.locator('#ui .row .btn', { hasText: '랭킹' }).click(); await page.waitForTimeout(400)
    const rows = await page.locator('.list.rank li:not(.head)').count(), mine = await page.locator('.panel.rank .mine li.me').count()
    const sub0 = await page.locator('.panel.rank .sub').innerText(); await page.locator('.panel.rank .rmap button').nth(1).click(); await page.waitForTimeout(300)   // 맵마다 랭킹 — 처음엔 겨울, 풀밭을 누르면 on_winter: false
    const map = { maps: [...maps], sub0, sub1: await page.locator('.panel.rank .sub').innerText(), on: await page.locator('.panel.rank .rmap button.on').innerText() }
    if (map.maps[0] !== true || map.maps.at(-1) !== false || !map.sub0.startsWith('겨울 · ') || !map.sub1.startsWith('풀밭 · ') || !map.on.includes('풀밭')) errors.push('[acct] 맵별 랭킹 ' + JSON.stringify(map))
    await page.locator('.panel.rank .rmap button').nth(0).click(); await page.waitForTimeout(300)
    const flags = await page.evaluate(() => [...document.querySelectorAll('.list.rank li:not(.head)')].map(li => li.querySelector('.av > img.flag')?.alt ?? null))   // ja 기록 → 「日本語」, 예전 기록 → 없음
    if (flags.join() !== '日本語,') errors.push('[acct] 랭킹 국기 ' + JSON.stringify(flags))
    await page.locator('.list.rank li:not(.head)').first().click(); await page.waitForTimeout(150); const info = await page.locator('.modal .lvl-badge').textContent()
    const sub = await page.locator('.modal .sub').innerText(); if (!sub.endsWith('· 日本語') || !(await page.locator('.modal .sub img.flag').count())) errors.push('[acct] 자세히 창 언어 ' + sub)
    await page.keyboard.press('Escape'); await page.waitForTimeout(100); const closed = await page.locator('.modal').count(), still = await page.evaluate(() => window.__mjg.mode)
    await page.evaluate(() => window.__mjg.startGame(0)); await page.waitForTimeout(300)   // start_run 이 tok 을 돌려줄 때까지
    await page.evaluate(() => { const M = window.__mjg; M.G.loop.lv = 2; M.finish(false) }); await page.waitForTimeout(500)
    const line = await page.locator('.rankline').textContent()
    const ck = body && require('crypto').createHash('sha256').update(['tok-1', body.ch, body.lv, body.bosses, body.bt, body.t, body.kills, body.lvl, body.weapons, body.hit0, body.v, /const CK_SALT = '([^']*)'/.exec(require('fs').readFileSync(require('path').join(__dirname, '..', 'game.js'), 'utf8'))[1]].join('|')).digest('hex')   // 체크섬 — SQL(submit_rank)과 같은 순서
    if (!body || body.ck !== ck || body.lang !== 'ko') errors.push('[acct] 체크섬 · 언어 ' + JSON.stringify({ body, ck }))
    const n0 = maps.length; await page.locator('.rankline button', { hasText: '랭킹 보기' }).click(); await page.waitForTimeout(400)   // 결과 화면 랭킹 — 마지막에 본 건 겨울이지만 방금 판은 풀밭 → 풀밭 랭킹
    const resMap = { winter: body?.winter, sent: maps.slice(n0), sub: await page.locator('.panel.rank .sub').innerText().catch(() => '') }
    if (resMap.winter !== false || resMap.sent[0] !== false || !resMap.sub.startsWith('풀밭 · ')) errors.push('[acct] 결과 화면 랭킹 보기 — 그 판 맵으로 ' + JSON.stringify(resMap))
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
      if (u.includes('my_nick')) return j({ nick: '치이카와팬', next: '2026-11-24' }); if (u.includes('agreed')) return j({ day: TERMS_VER })
      return r.fulfill({ status: 204 }) })
    await page.evaluate(() => { localStorage.setItem('mjg.v1', JSON.stringify({ runs: 17, seen: 1, last: Date.parse('2026-11-18T09:08:07Z') })); localStorage.setItem('mjg.auth', JSON.stringify({ at: 'a.e30.b', rt: 'r', exp: Date.now() / 1000 + 9999, uid: 'u1', prov: 'kakao' })) })
    await page.reload(); await page.waitForTimeout(800)
    const o = { h: await page.locator('.modal .h').textContent(), when: await page.locator('.modal .pickrec small').allTextContents() }
    await page.locator('.modal .pickrec[data-k=here]').click(); await page.locator('.modal .btn.main').click(); await page.waitForTimeout(100); await page.locator('.modal .btn.main').click(); await page.waitForTimeout(1200)
    Object.assign(o, { modal: await page.locator('.modal').count(), mode: await page.evaluate(() => window.__mjg.mode), reads, runs: cloud[0].data.runs })
    console.log('sync', o)
    if (o.h !== '기록이 두 군데 있어요' || !o.when.every(t => /\d:\d\d:\d\d/.test(t)) || o.modal || o.mode !== 'title' || reads !== 2 || o.runs !== 17) errors.push('[sync] ' + JSON.stringify(o))
  })
  await run('gis', { width: 390, height: 844 }, async page => {   // Google 공식 단추(?gis — 진짜 주소 흉내) — 구글 스크립트 대신 흉내, 받은 ID 토큰을 Supabase 세션으로(nonce 는 구글엔 해시 · Supabase 엔 원래 값)
    let tokenBody = null
    await page.route(/\/auth\/v1\/token/, r => { tokenBody = r.request().postDataJSON(); r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ access_token: 'a.eyJzdWIiOiJ1MiIsImFwcF9tZXRhZGF0YSI6eyJwcm92aWRlciI6Imdvb2dsZSJ9fQ.b', refresh_token: 'r2', expires_in: 3600 }) }) })
    await page.route('**/rest/v1/**', r => { const u = r.request().url(), j = v => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(v) }); return u.includes('saves?select') ? j([]) : u.includes('my_nick') ? j({ nick: '구글팬', next: '2026-11-25' }) : u.includes('suspended') ? j(null) : u.includes('agreed') ? j({ day: TERMS_VER }) : r.fulfill({ status: 204 }) })
    await page.goto(new globalThis.URL('?gis', URL).href); await page.waitForTimeout(600)
    await page.evaluate(() => { window.google = { accounts: { id: { initialize: o => { window.__gis = o }, renderButton: (el, o) => { const b = document.createElement('button'); b.className = 'gis-btn'; b.textContent = 'G ' + o.text; el.append(b) } } } } })
    await page.locator('button.acct').click(); await page.waitForTimeout(300)
    const o = { btn: await page.locator('.modal .gis .gis-btn').count(), old: await page.locator('.modal .btn.sns.google').count(), cid: await page.evaluate(() => /\.apps\.googleusercontent\.com$/.test(window.__gis?.client_id)), hashed: await page.evaluate(() => window.__gis?.nonce) }
    await page.evaluate(() => window.__gis.callback({ credential: 'h.e30.s' })); await page.waitForTimeout(800)
    const sha = tokenBody && require('crypto').createHash('sha256').update(tokenBody.nonce).digest('hex')
    Object.assign(o, { provider: tokenBody?.provider, idt: tokenBody?.id_token, nonceOk: sha === o.hashed, auth: await page.evaluate(() => JSON.parse(localStorage.getItem('mjg.auth') || 'null')?.prov), nick: await page.locator('.acct .nm').textContent().catch(() => null), busy: await page.locator('.busy').count() })
    await page.evaluate(() => localStorage.removeItem('mjg.auth'))
    console.log('gis', o)
    if (o.btn !== 1 || o.old || !o.cid || !/^[0-9a-f]{64}$/.test(o.hashed || '') || o.provider !== 'google' || o.idt !== 'h.e30.s' || !o.nonceOk || o.auth !== 'google' || o.nick !== '구글팬' || o.busy) errors.push('[gis] ' + JSON.stringify(o))
  })
  await run('login', { width: 390, height: 844 }, async page => {   // 로그인 중 — 카카오로 가는 동안 · 돌아와서 기록을 불러오는 동안(0.3초 넘으면) 세 친구가 걷는 창
    await page.route('**/rest/v1/**', async r => { await new Promise(f => setTimeout(f, 400)); r.fulfill({ status: 200, contentType: 'application/json', body: r.request().url().includes('saves?select') ? '[]' : r.request().url().includes('agreed') ? JSON.stringify({ day: TERMS_VER }) : 'null' }) })   // 기록 불러오기는 조금 걸린다(정지 확인 · 저장 · 닉네임 — 하나에 0.4초)
    await page.evaluate(() => { window.__close = window.__mjg.busy('카카오 로그인 화면으로 가는 중이에요', { prov: 'kakao', going: true }) }); await page.waitForTimeout(300)   // 카카오로 넘어가는 동안(넘어가기 시작하면 점검이 페이지를 못 읽어서 직접 띄운다)
    const go = { sub: await page.locator('.busy .sub').textContent(), friends: await page.locator('.busy .friends canvas').count(), logo: await page.locator('.busy .sub .brand svg').count() }
    await page.screenshot({ path: OUT + 'busy.png' }); await page.mouse.click(10, 10); go.stays = await page.locator('.busy').count(); await page.evaluate(() => window.__close())
    await page.goto(new globalThis.URL('#access_token=a.e30.b&refresh_token=r&expires_in=3600', URL).href); await page.reload(); await page.waitForTimeout(150)
    const back = { mid: await page.locator('.busy .sub').textContent({ timeout: 2000 }).catch(() => null) }; await page.waitForTimeout(2500); back.end = await page.locator('.busy').count()
    await page.evaluate(() => localStorage.removeItem('mjg.auth'))
    console.log('login', { go, back })
    if (!go.sub?.includes('카카오 로그인 화면으로') || go.friends !== 3 || go.logo !== 1 || go.stays !== 1 || !back.mid?.includes('내 기록을 불러오는') || back.end) errors.push('[login] ' + JSON.stringify({ go, back }))
  })
  await run('terms', { width: 390, height: 844 }, async page => {   // 이용약관 — 처음 화면 링크 · ?lang=en&terms, 처음 로그인(새 계정)은 동의를 묻고 「동의하지 않아요」면 계정을 지우고 로그아웃, 약관이 바뀐 기존 계정은 동의하면 그대로
    await page.locator('.fine .linkish', { hasText: '이용약관' }).click(); await page.waitForTimeout(200)
    const doc = { h: await page.locator('#ui .panel .h').textContent(), n: await page.locator('#ui ul.pv li').count(), mode: await page.evaluate(() => window.__mjg.mode) }
    await page.screenshot({ path: OUT + 'terms.png' }); await page.keyboard.press('Escape'); await page.waitForTimeout(150); doc.back = await page.evaluate(() => window.__mjg.mode)
    await page.goto(new globalThis.URL('?lang=en&terms', URL).href); await page.waitForTimeout(800)
    doc.en = await page.locator('#ui .panel .h').textContent(); doc.han = await page.evaluate(() => (document.querySelector('#ui').innerText.match(/[가-힣]+/g) || []).slice(0, 4))
    const sent = [], state = { day: null, nick: null }
    await page.route('**/*.supabase.co/**', r => { const u = r.request().url(), j = v => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(v) }); sent.push(u.split('/').pop().split('?')[0])
      if (u.includes('saves?select')) return j(state.nick ? [{ data: { runs: 0 }, updated_at: '2026-11-18T00:00:00Z' }] : []); if (u.includes('agreed')) return j({ day: state.day }); if (u.includes('my_nick')) return j(state.nick)
      if (u.includes('rpc/agree')) { state.agreeBody = r.request().postDataJSON(); return j('ok') } if (u.includes('delete_me')) return j('ok'); if (u.includes('suspended')) return j(null); return r.fulfill({ status: 204 }) })
    const login = async () => { await page.evaluate(() => { localStorage.setItem('mjg.v1', JSON.stringify({ seen: 1, lang: 'ko' })); localStorage.setItem('mjg.auth', JSON.stringify({ at: 'a.e30.b', rt: 'r', exp: Date.now() / 1000 + 9999, uid: 'u1', prov: 'kakao' })) }); await page.goto(URL); await page.waitForTimeout(900) }
    await login()   // 새 계정 — 닉네임도 동의 기록도 없다
    await page.screenshot({ path: OUT + 'terms-agree.png' }); const fresh = { h: await page.locator('.modal .h').textContent() }; await page.keyboard.press('Escape'); await page.waitForTimeout(100); fresh.stays = await page.locator('.modal').count()
    await page.locator('.modal .btn', { hasText: '동의하지 않아요' }).click(); await page.waitForTimeout(500)
    Object.assign(fresh, { deleted: sent.includes('delete_me'), auth: await page.evaluate(() => localStorage.getItem('mjg.auth')), modal: await page.locator('.modal').count() })
    state.day = '2000-01-01'; state.nick = { nick: '치이카와팬', next: '2026-11-24' }; sent.length = 0; await login()   // 기존 계정 — 예전 약관에 동의했다
    const old = { h: await page.locator('.modal .h').textContent() }; await page.locator('.modal .btn.main', { hasText: '동의하고 시작' }).click(); await page.waitForTimeout(500)
    Object.assign(old, { day: state.agreeBody?.day, auth: !!(await page.evaluate(() => localStorage.getItem('mjg.auth'))), modal: await page.locator('.modal').count(), deleted: sent.includes('delete_me') })
    await page.evaluate(() => localStorage.removeItem('mjg.auth'))
    console.log('terms', { doc, fresh, old })
    if (doc.h !== '이용약관' || doc.n < 30 || doc.mode !== 'terms' || doc.back !== 'title' || doc.en !== 'Terms of Service' || doc.han.length) errors.push('[terms] 화면 ' + JSON.stringify(doc))
    if (fresh.h !== '처음 오셨네요!' || fresh.stays !== 1 || !fresh.deleted || fresh.auth || fresh.modal) errors.push('[terms] 새 계정 ' + JSON.stringify(fresh))
    if (old.h !== '이용약관이 바뀌었어요' || old.day !== TERMS_VER || !old.auth || old.modal || old.deleted) errors.push('[terms] 기존 계정 ' + JSON.stringify(old))
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
    const han = () => page.evaluate(() => (document.querySelector('#ui').innerText.replace(/한국어|먼작귀 서바이버즈/g, '').match(/[가-힣]+/g) || []).slice(0, 6))
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
    // 나라별 홍보 링크 /en/ · /ja/ · /zh-cn/ · /zh-tw/ — 게임(/?lang=…)으로 넘어가 그 말로 보이되 기억하지는 않는다(링크는 고른 게 아니다 · 기획), 주소의 ?lang= 은 지운다
    for (const [dir, code] of [['en', 'en'], ['ja', 'ja'], ['zh-cn', 'zh-CN'], ['zh-tw', 'zh-TW']]) {
      await page.evaluate(() => localStorage.clear()); await page.goto(URL + dir + '/'); await page.waitForURL(u => u.pathname === new globalThis.URL(URL).pathname); await page.waitForTimeout(600)
      const via = await page.evaluate(() => ({ lang: document.documentElement.lang, saved: JSON.parse(localStorage.getItem('mjg.v1') || '{}').lang, search: location.search, han: (document.querySelector('#ui').innerText.replace(/한국어|먼작귀 서바이버즈/g, '').match(/[가-힣]+/g) || []).length }))
      if (via.lang !== code || via.saved || via.search || via.han) errors.push(`[lang] /${dir}/ ` + JSON.stringify(via))
    }
    { const p = await browser.newPage({ locale: 'ja-JP' }); await p.goto(URL); await p.evaluate(() => localStorage.clear()); await p.reload(); await p.waitForTimeout(500)   // 지금 보이는 말(브라우저 언어)을 언어 단추에서 눌러도 고정된다
      await p.click('.lang summary'); await p.click('.lang button[lang="ja"]'); await p.waitForTimeout(200)
      const r = await p.evaluate(() => ({ saved: JSON.parse(localStorage.getItem('mjg.v1') || '{}').lang, open: document.querySelector('.lang').open }))
      if (r.saved !== 'ja' || r.open) errors.push('[lang] 같은 말을 눌러도 고정 ' + JSON.stringify(r))
      await p.close() }
    // 고른 말이 없으면 브라우저 언어(navigator.languages 첫 맞는 것 · 다섯 말에 없으면 영어) — 저장은 안 한다. 언어 단추로 고른 말은 브라우저보다 앞선다
    for (const [loc, want, saved] of [['ja-JP', 'ja'], ['zh-HK', 'zh-TW'], ['zh-SG', 'zh-CN'], ['en-GB', 'en'], ['fr-FR', 'en'], ['ko-KR', 'ko'], ['fr-FR', 'ko', 'ko'], ['en-US', 'zh-TW', 'zh-TW']]) {
      const p = await browser.newPage({ locale: loc }); await p.goto(URL); await p.evaluate(s => { localStorage.clear(); if (s) localStorage.setItem('mjg.v1', JSON.stringify({ lang: s })) }, saved); await p.reload(); await p.waitForTimeout(500)
      const r = await p.evaluate(() => ({ lang: document.documentElement.lang, saved: JSON.parse(localStorage.getItem('mjg.v1') || '{}').lang, name: document.querySelector('#ui .appname')?.textContent ?? null, title: document.title }))
      if (r.lang !== want || r.saved !== saved || (r.name !== (want === 'ko' ? null : '먼작귀 서바이버즈')) || !r.title.startsWith('먼작귀 서바이버즈 — ')) errors.push(`[lang] 브라우저 ${loc} 저장 ${saved} → ` + JSON.stringify(r))   // 탭 제목은 어느 말이든 한국어(검색 제목)
      await p.close()
    }
  })

  await browser.close()
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'NO ERRORS')
  process.exit(errors.length ? 1 : 0)
})()
