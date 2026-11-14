// SNS 홍보 — 이미지 3장(정사각 1080 · 세로 1080×1920 · 가로 1600×900)과 숏츠 영상(세로 1080×1920 · 30fps · 약 30초, 게임 배경음 포함)
//   게임을 한 프레임씩 직접 돌리며 찍는다(기기 속도와 상관없이 매끄럽게). 그림은 모두 게임 속 직접 그린 그림
//   실행: 로컬 서버(8765) + NODE_PATH=<playwright 가 있는 node_modules> FFMPEG=<libx264 가 있는 ffmpeg> node test/promo.cjs → promo/(git 에 안 올린다)
const { chromium } = require('playwright'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process')
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'promo'), FR = path.join(OUT, 'frames'), FPS = 30, HOME = 'http://127.0.0.1:8765/'
fs.rmSync(FR, { recursive: true, force: true }); fs.mkdirSync(FR, { recursive: true })

// 배경음 — 게임의 곡을 OfflineAudioContext 로 미리 그려 WAV 로(실시간 예약기는 currentTime 을 앞당겨 한 번에 다 예약하게 한다)
async function music(b, name, id, dur) {
  const p = await b.newPage()
  await p.addInitScript(dur => {
    const Off = window.OfflineAudioContext
    window.AudioContext = function () { const c = new Off(2, Math.ceil(44100 * dur), 44100); let t = 0; Object.defineProperty(c, 'currentTime', { get: () => t }); Object.defineProperty(c, 'state', { get: () => 'running' }); c.resume = async () => {}; c.go = v => { t = v }; window.__off = c; return c }
    localStorage.setItem('mjg.v1', JSON.stringify({ diff: 'normal', noStats: true }))
  }, dur)
  await p.goto(HOME); await p.waitForTimeout(500)
  const b64 = await p.evaluate(async ([name, id, dur]) => {
    dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX' }))   // 소리 켜기
    window.__mjg.SND.play(name, true, id); window.__off.go(dur); await new Promise(r => setTimeout(r, 150)); window.__mjg.SND.play('')
    const buf = await window.__off.startRendering(), n = buf.length, ch = [buf.getChannelData(0), buf.getChannelData(1)], v = new DataView(new ArrayBuffer(44 + n * 4))
    const str = (o, s) => { for (let i = 0; i < s.length; i++) v.setUint8(o + i, s.charCodeAt(i)) }
    str(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); str(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, 44100, true); v.setUint32(28, 44100 * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, n * 4, true)
    for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) v.setInt16(44 + i * 4 + c * 2, Math.max(-1, Math.min(1, ch[c][i])) * 32767, true)
    let s = ''; const u = new Uint8Array(v.buffer); for (let i = 0; i < u.length; i += 0x8000) s += String.fromCharCode(...u.subarray(i, i + 0x8000)); return btoa(s)
  }, [name, id, dur])
  fs.writeFileSync(path.join(OUT, name + '.wav'), Buffer.from(b64, 'base64')); await p.close()
}

;(async () => {
  const b = await chromium.launch()
  if (process.env.FFMPEG) { await music(b, 'field', 'chiikawa', 24); await music(b, 'siren', '', 16) }
  const p = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 })
  p.on('pageerror', e => console.log('pageerror', e.message))
  await p.addInitScript(() => { window.requestAnimationFrame = () => 0; localStorage.setItem('mjg.v1', JSON.stringify({ diff: 'normal', bgm: 0, sfx: 0, noStats: true, zoom: 0.85 })) })   // 게임 루프를 멈추고 직접 한 프레임씩 · 조금 넓게 보기
  await p.goto(HOME); await p.waitForTimeout(800)
  await p.evaluate(async () => {
    await document.fonts.load('80px Jua')
    const M = window.__mjg, ink = '#4a3b35', W = window
    const st = document.createElement('style')
    st.textContent = '#pcap{position:fixed;left:0;right:0;top:150px;text-align:center;z-index:50;font:36px Jua;color:#fff;-webkit-text-stroke:8px #4a3b35;paint-order:stroke fill;pointer-events:none;line-height:1.2}#pcap small{display:block;margin-top:6px;font-size:23px;-webkit-text-stroke:6px #4a3b35}#pcard{position:fixed;left:0;top:0;width:540px;height:960px;z-index:60;display:none}'
    document.head.append(st)
    const cap = document.createElement('div'); cap.id = 'pcap'; document.body.append(cap)
    const card = document.createElement('canvas'); card.id = 'pcard'; card.width = 1080; card.height = 1920; document.body.append(card)
    W.__cap = (a, s) => { cap.innerHTML = a ? `${a}${s ? `<small>${s}</small>` : ''}` : '' }
    // 그림 도구 — og.cjs 와 같은 풀밭 · 로고
    const field = (g, w, h, seed) => {
      let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647
      g.fillStyle = '#cdeaa8'; g.fillRect(0, 0, w, h)
      for (let i = 0; i < w * h / 9000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(160,205,120,.45)' : 'rgba(235,250,210,.5)'; g.beginPath(); g.ellipse(r() * w, r() * h, 40 + r() * 80, 18 + r() * 34, 0, 0, Math.PI * 2); g.fill() }
      for (let i = 0; i < w * h / 6000; i++) { const x = r() * w, y = r() * h; g.strokeStyle = 'rgba(110,160,80,.55)'; g.lineWidth = 2; g.lineCap = 'round'; for (const d of [-5, 0, 5]) { g.beginPath(); g.moveTo(x + d, y); g.lineTo(x + d * 1.4, y - 10 - r() * 6); g.stroke() } }
      for (let i = 0; i < w * h / 14000; i++) { const x = r() * w, y = r() * h; g.fillStyle = ['#fff', '#ffe07a', '#e3c8ff'][i % 3]; for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 3.4, 0, Math.PI * 2); g.fill() } g.fillStyle = '#f2b13a'; g.beginPath(); g.arc(x, y, 2.6, 0, Math.PI * 2); g.fill() }
    }
    const logo = (g, txt, x, y, size, fill) => { g.font = `${size}px Jua`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round'; g.fillStyle = ink; g.fillText(txt, x, y + size * 0.1); g.strokeStyle = ink; g.lineWidth = size * 0.16; g.strokeText(txt, x, y); g.fillStyle = fill; g.fillText(txt, x, y) }
    const text = (g, s, x, y, size, fill = ink, stroke = 0, align = 'center') => { g.font = `${size}px Jua`; g.textAlign = align; g.lineJoin = 'round'; if (stroke) { g.strokeStyle = ink; g.lineWidth = stroke; g.strokeText(s, x, y) } g.fillStyle = fill; g.fillText(s, x, y) }
    const chip = (g, s, x, y, size, bg, fg = ink) => { g.font = `${size}px Jua`; const w = g.measureText(s).width + size * 1.4, h = size * 1.7; g.beginPath(); g.roundRect(x - w / 2, y - h / 2, w, h, h / 2); g.fillStyle = bg; g.fill(); g.lineWidth = size * 0.16; g.strokeStyle = ink; g.stroke(); g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, x, y + size * 0.04); g.textBaseline = 'alphabetic' }
    const ART = {}, put = (g, id, x, y, u, pose = {}) => { const k = id + JSON.stringify(pose), a = ART[k] ||= M.art(id, 8, { look: 1.2, ...pose }), s = u / 8; g.drawImage(a.c, x - a.ox * u, y - a.oy * u, a.c.width * s, a.c.height * s) }   // 발끝이 y
    const IDS = ['chiikawa', 'hachiware', 'usagi', 'momonga', 'kurimanju', 'rakko', 'shisa', 'kani'], WALK = [{}, ...M.WALK]
    const lineup = (g, ids, cx, y, gap, u, f = 0) => ids.forEach((id, i) => { const x = cx + (i - (ids.length - 1) / 2) * gap; g.fillStyle = 'rgba(70,90,50,.22)'; g.beginPath(); g.ellipse(x, y - 3, u * 9, u * 2, 0, 0, Math.PI * 2); g.fill(); put(g, id, x, y - 4, u, WALK[((f / 5 | 0) + i) % 5]) })
    const frame = (g, img, x, y, w, h, r, sx, sy, sw, sh) => { g.save(); g.beginPath(); g.roundRect(x, y, w, h, r); g.clip(); g.drawImage(img, sx, sy, sw, sh, x, y, w, h); g.restore(); g.beginPath(); g.roundRect(x, y, w, h, r); g.lineWidth = 9; g.strokeStyle = ink; g.stroke() }
    W.__promo = { field, logo, text, chip, put, lineup, frame, IDS, ink }
    // 처음 · 끝 카드(f = 카드 안 프레임 번호 — 캐릭터가 제자리걸음)
    W.__card = (kind, f) => {
      const g = card.getContext('2d'); card.style.display = kind ? 'block' : 'none'; if (!kind) return
      field(g, 1080, 1920, 11)
      text(g, '비공식 팬게임 · 무료', 540, 150, 40, '#fff', 10)
      logo(g, '먼작귀', 540, kind === 'end' ? 560 : 640, 220, '#fff'); logo(g, '서바이버즈', 540, kind === 'end' ? 720 : 800, 130, '#ff8fab')
      if (kind === 'title') { text(g, '먼가 작고 귀여운 녀석들의', 540, 960, 54, ink); text(g, '살벌한 토벌 생존기!', 540, 1040, 64, '#e8475f'); lineup(g, IDS, 540, 1560, 126, 5.2, f) }
      else {
        text(g, '지금 바로 무료로 플레이!', 540, 880, 62, ink)
        chip(g, 'chii-ka-wa.github.io', 540, 1030, 64, '#fff')
        text(g, '설치 없이 브라우저에서 · PC · 휴대폰', 540, 1170, 40, ink)
        lineup(g, IDS, 540, 1640, 126, 5.2, f)
        text(g, '원작 「ちいかわ」 © ナガノ · 비공식 · 비영리 팬게임', 540, 1840, 30, 'rgba(74,59,53,.85)')
      }
    }
    // 게임 한 프레임 — 둥글게 걸어 다니고(방향키), 체력이 줄면 채워 주고, 레벨 업 상자 · 쉬는 창은 잠깐 보여 준 뒤 넘긴다
    const held = {}, keys = (dx, dy) => { const want = { KeyW: dy < -0.38, KeyS: dy > 0.38, KeyA: dx < -0.38, KeyD: dx > 0.38 }; for (const c in want) if (!!held[c] !== want[c]) { dispatchEvent(new KeyboardEvent(want[c] ? 'keydown' : 'keyup', { code: c })); held[c] = want[c] } }
    const steer = () => { const a = M.G.t * 0.45; keys(Math.cos(a), Math.sin(a)) }   // 크게 원을 그리며 걷는다
    const hover = () => {   // 보스 장면 — 세로 화면에 보스가 잘리지 않게 보스를 캐릭터 조금 위로 천천히 끌어 둔다(세이렌은 원래 멀찍이 떨어져 있으려 해서)
      const e = W.__follow && M.G.foes.find(f => f.kind === W.__follow && !f.dead); if (!e) return
      e.x += (M.pl.x + Math.cos(M.G.t * 0.7) * 60 - e.x) * 0.1; e.y += (M.pl.y - 100 - e.y) * 0.1
    }
    let top = 0, hold = 0
    W.__seg = (calm = 0, follow = null) => { top = 0; hold = 0; W.__shown = follow ? 1 : 0; W.__calm = calm; W.__follow = follow; M.pl.inv = 0; if (calm) for (const e of M.G.foes) if (!e.boss && Math.random() > calm) e.dead = true }   // calm — 보스가 잘 보이게 일반 적을 덜어 내고 더 나오지 않게
    W.__frame = () => {
      if (M.mode === 'box') { if (W.__shown || ++hold > 28) { M.pick0(); hold = 0; W.__shown = 1 } return M.mode }
      if (M.mode === 'pause') { if (++hold > 36) { M.resume(); hold = 0 } return M.mode }
      if (M.mode !== 'play') return M.mode
      top = Math.max(top, M.pl.hp); if (M.pl.hp < top * 0.6) M.pl.hp = top
      if (W.__calm) { M.G.spawnT = 9; M.G.nextSwarm = M.G.nextEvt = M.G.t + 99 }
      steer(); M.step(1 / 30); hover(); M.render(); return M.mode
    }
    W.__ff = T => { while (M.G.t < T) { M.pl.inv = 1e9; if (M.mode === 'box') M.pick0(); else if (M.mode === 'pause') M.resume(); else if (M.mode === 'play') { steer(); M.step(1 / 30) } else break } M.pl.inv = 0; M.render() }
    W.__near = kind => { const e = M.G.foes.find(f => f.kind === kind && !f.dead); if (e) { e.x = M.pl.x + 40; e.y = M.pl.y - 200 } return !!e }
  })
  let fi = 0
  const shot = () => p.screenshot({ path: path.join(FR, `f${String(fi++).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 })
  const still = name => p.evaluate(() => {   // 이미지용 — 피해 숫자 · 적 탄 · 효과 · 알림 글을 잠깐 치우고 그린 캔버스(다음 프레임은 그대로)
    const M = window.__mjg, G = M.G, keep = [G.nums, G.eshots, G.fx, G.banner]; G.nums = []; G.eshots = []; G.fx = []; G.banner = null; M.pl.inv = 0; M.render()
    const u = document.getElementById('cv').toDataURL('image/png'); [G.nums, G.eshots, G.fx, G.banner] = keep; M.render(); return u
  }).then(u => fs.writeFileSync(path.join(OUT, name), Buffer.from(u.split(',')[1], 'base64')))
  const play = async (n, cap, sub, at, on, calm = 0, follow = null) => { let best = 0; await p.evaluate(([a, s, c, f]) => { window.__cap(a, s); window.__seg(c, f) }, [cap, sub, calm, follow]); for (let i = 0; i < n; i++) { const m = await p.evaluate(() => window.__frame()); if (m === 'over') break; if (on) await on(i); if (follow && i === 54) await p.evaluate(() => window.__cap('')); await shot()
    if (at[1] === 'crowd') { const k = await p.evaluate(() => { const M = window.__mjg, v = M.G.foes.filter(e => !e.dead && Math.abs(e.x - M.pl.x) < 260 && Math.abs(e.y - M.pl.y) < 420).length; return M.mode === 'play' ? v : 0 }); if (i > 20 && k > best) { best = k; await still(at[0]) } }   // 화면에 적이 가장 많을 때
    else if (i === at[1]) await still(at[0]) } }
  const card = async (kind, n) => { for (let f = 0; f < n; f++) { await p.evaluate(([k, f]) => window.__card(k, f), [kind, f]); await shot() } await p.evaluate(() => window.__card(null)) }

  await p.evaluate(() => { window.__mjg.startGame(0); window.__card('title', 0) })
  await card('title', 75)                                                                                                       // 0 ~ 2.5초 — 제목
  await p.evaluate(() => window.__ff(600))
  await play(240, '몰려오는 몬스터를 스킬로 싹!', '레벨 업마다 스킬 · 아이템을 골라 키워요', ['shot-b.png', 'crowd'])            // 10분 — 스킬 난무 · 레벨 업 상자
  await p.evaluate(() => { window.__ff(1203); window.__near('anoko') })
  await play(165, '20분 — 커다란 토벌!', '보스 「아노코」 등장', ['shot-c.png', 80], null, 0.45, 'anoko')                                                        // 20분 — 아노코
  await p.evaluate(() => { window.__ff(window.__mjg.FINAL_T + 1.5); window.__near('siren') })
  const split = fi / FPS
  await play(240, '25분 — 최종보스 「세이렌」', '인어 셋이 지키고 있어요…', ['shot-d.png', 40], async i => { if (i === 150) await p.evaluate(() => { const s = window.__mjg.G.final?.siren; if (s) s.hp = Math.min(s.hp, 1) }); }, 0.3, 'siren')   // 25분 — 세이렌 · 토벌 성공
  await card('end', 105)                                                                                                         // 끝 — 주소
  const total = fi / FPS
  console.log('frames', fi, 'seconds', total.toFixed(1), 'siren at', split.toFixed(1))

  // 홍보 이미지 — 위에서 찍은 게임 화면(캔버스만)을 액자에 넣는다
  const shots = ['shot-b.png', 'shot-c.png', 'shot-d.png'].map(f => 'data:image/png;base64,' + fs.readFileSync(path.join(OUT, f)).toString('base64'))
  const imgs = await p.evaluate(async shots => {
    const P = window.__promo, mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')] }
    const im = await Promise.all(shots.map(s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s })))
    const [B, C, D] = im, out = {}
    { // 정사각 1080 — 인스타 피드 · 카카오
      const [c, g] = mk(1080, 1080); P.field(g, 1080, 1080, 5)
      P.text(g, '비공식 팬게임 · 무료', 1050, 56, 30, '#fff', 8, 'right')
      P.logo(g, '먼작귀', 540, 200, 150, '#fff'); P.logo(g, '서바이버즈', 540, 305, 88, '#ff8fab')
      P.text(g, '먼가 작고 귀여운 녀석들의 토벌 생존기', 540, 362, 34)
      P.frame(g, B, 90, 392, 900, 560, 40, 0, 640, 1080, 672)
      P.put(g, 'chiikawa', 120, 1040, 4.6, { look: 1.2 }); P.put(g, 'hachiware', 965, 1040, 4.6, { look: 1.2 })
      P.chip(g, 'chii-ka-wa.github.io', 540, 1010, 40, '#fff')
      out.square = c.toDataURL('image/png')
    }
    { // 세로 1080×1920 — 스토리 · 릴스 · 숏츠 표지
      const [c, g] = mk(1080, 1920); P.field(g, 1080, 1920, 9)
      P.text(g, '비공식 팬게임 · 무료 · 설치 없이 브라우저에서', 540, 100, 36, '#fff', 9)
      P.logo(g, '먼작귀', 540, 330, 200, '#fff'); P.logo(g, '서바이버즈', 540, 470, 118, '#ff8fab')
      P.text(g, '먼가 작고 귀여운 녀석들의 토벌 생존기', 540, 552, 44)
      P.frame(g, D, 70, 600, 940, 1040, 48, 0, 380, 1080, 1195)
      P.lineup(g, P.IDS, 540, 1800, 124, 4.4)
      P.chip(g, 'chii-ka-wa.github.io', 540, 1862, 40, '#fff')
      out.story = c.toDataURL('image/png')
    }
    { // 가로 1600×900 — X · 페이스북 · 블로그
      const [c, g] = mk(1600, 900); P.field(g, 1600, 900, 13)
      P.logo(g, '먼작귀', 560, 240, 170, '#fff'); P.logo(g, '서바이버즈', 560, 360, 100, '#ff8fab')
      P.text(g, '먼가 작고 귀여운 녀석들의 토벌 생존기', 560, 432, 38)
      { const tags = [['무료', '#fff3a8'], ['설치 없이 브라우저에서', '#ffd6e2'], ['PC · 휴대폰', '#d6ecff']], gap = 16; g.font = '32px Jua'; const ws = tags.map(([s]) => g.measureText(s).width + 32 * 1.4); let x = 560 - (ws.reduce((a, w) => a + w, 0) + gap * (tags.length - 1)) / 2; tags.forEach(([s, bg], i) => { P.chip(g, s, x + ws[i] / 2, 515, 32, bg); x += ws[i] + gap }) }   // 글자 폭대로 나란히
      P.chip(g, 'chii-ka-wa.github.io', 560, 615, 48, '#fff')
      P.lineup(g, ['chiikawa', 'hachiware', 'usagi', 'momonga', 'kani'], 560, 860, 150, 4.2)
      g.beginPath(); g.roundRect(1110, 50, 400, 800, 64); g.fillStyle = P.ink; g.fill()   // 휴대폰 속 게임 화면
      P.frame(g, B, 1128, 68, 364, 764, 48, 150, 190, 780, 1637)   // 가운데를 조금 당겨 크게
      P.text(g, '비공식 팬게임', 1580, 40, 26, '#fff', 7, 'right')
      out.wide = c.toDataURL('image/png')
    }
    return out
  }, shots)
  for (const [k, u] of Object.entries(imgs)) fs.writeFileSync(path.join(OUT, `promo-${k}.png`), Buffer.from(u.split(',')[1], 'base64'))
  await b.close()

  if (process.env.FFMPEG) {   // 영상 — 처음 ~ 세이렌 전은 토벌 곡, 세이렌부터 세이렌 곡(0.8초 겹쳐 바꾸기), 끝에서 줄어든다 · SNS 음량(-16 LUFS)으로
    const t1 = (split + 0.4).toFixed(2), t2 = (total - split + 0.4).toFixed(2)
    execFileSync(process.env.FFMPEG, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(FR, 'f%05d.jpg'), '-i', path.join(OUT, 'field.wav'), '-i', path.join(OUT, 'siren.wav'),
      '-filter_complex', `[1:a]atrim=0:${t1}[a1];[2:a]atrim=0:${t2}[a2];[a1][a2]acrossfade=d=0.8[a];[a]afade=t=in:d=0.3,afade=t=out:st=${(total - 1.4).toFixed(2)}:d=1.4,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100[ao]`,
      '-map', '0:v', '-map', '[ao]', '-c:v', 'libx264', '-vf', 'scale=in_range=pc:out_range=tv,format=yuv420p', '-crf', '22', '-preset', 'slow', '-r', String(FPS), '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', path.join(OUT, 'shorts.mp4')])
    for (const f of ['field.wav', 'siren.wav']) fs.rmSync(path.join(OUT, f)); fs.rmSync(FR, { recursive: true })   // 다 만들었으면 프레임(수백 MB) · 소리 조각은 치운다
    console.log('promo/shorts.mp4')
  }
  console.log('promo/promo-square.png · promo-story.png · promo-wide.png')
})()
