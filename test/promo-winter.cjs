// 겨울 업데이트 홍보 숏츠 — 세로 1080×1920 · 30fps · 약 32초 · 겨울 배경음(치이카와 오르골)
//   눈보라 · 얼어붙기 · 의상 21종(한 번 사면 모두) · 불꽃 옷 · 겨울 무기 스킨 · 스킬 스킨(벚꽃 일섬)을 장면마다 자막과 함께. 게임을 한 프레임씩 직접 돌리며 찍는다
//   실행: 로컬 서버(8765) + NODE_PATH=<playwright 가 있는 node_modules> FFMPEG=<libx264 가 있는 ffmpeg> node test/promo-winter.cjs → promo/winter/shorts.mp4(git 에 안 올린다)
const { chromium } = require('playwright'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process')
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'promo', 'winter'), FR = path.join(OUT, 'frames'), FPS = 30, HOME = 'http://127.0.0.1:8765/'
fs.rmSync(FR, { recursive: true, force: true }); fs.mkdirSync(FR, { recursive: true })
const IDS = ['chiikawa', 'hachiware', 'usagi', 'momonga', 'kurimanju', 'rakko', 'shisa', 'kani']
const LOOK = { chiikawa: 'knit', hachiware: 'tako', usagi: 'rain', momonga: 'pj', kurimanju: 'tanu', rakko: 'fire', shisa: 'kino', kani: 'fairy' }   // 카드에 선 여덟 — 저마다 다른 의상
const PARADE = ['pj', 'tako', 'tanu', 'rain', 'kino', 'knit', 'fairy', 'cinder', 'prince', 'crab', 'white', 'fire']   // 의상 장면 — 여덟이 다 같이 갈아입는 순서

// 배경음 — 게임 곡을 OfflineAudioContext 로 미리 그려 WAV 로(promo.cjs 와 같은 방법)
async function music(b, name, id, dur) {
  const p = await b.newPage()
  await p.addInitScript(dur => {
    const Off = window.OfflineAudioContext
    window.AudioContext = function () { const c = new Off(2, Math.ceil(44100 * dur), 44100); let t = 0; Object.defineProperty(c, 'currentTime', { get: () => t }); Object.defineProperty(c, 'state', { get: () => 'running' }); c.resume = async () => {}; c.go = v => { t = v }; window.__off = c; return c }
    localStorage.setItem('mjg.v1', JSON.stringify({ diff: 'normal', noStats: true }))
  }, dur)
  await p.goto(HOME); await p.waitForTimeout(500)
  const b64 = await p.evaluate(async ([name, id, dur]) => {
    dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX' }))
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
  if (process.env.FFMPEG) await music(b, 'winter', 'chiikawa', 34)
  const p = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 })
  p.on('pageerror', e => console.log('pageerror', e.message))
  await p.addInitScript(() => {   // 게임 루프는 멈추고 직접 한 프레임씩. 겨울 · 스킬 스킨 모두 켬 · 의상 · 무기 스킨(겨울)은 입은 채로
    window.requestAnimationFrame = () => 0
    const sk = ['sasu', 'book', 'pile', 'stick', 'yaha', 'ura', 'weed', 'tears', 'guitar', 'nantoka', 'ramen', 'curry', 'pochette', 'momo', 'kanpai', 'sword']
    localStorage.setItem('mjg.v1', JSON.stringify({ diff: 'normal', bgm: 0, sfx: 0, noStats: true, zoom: 1.4, theme: 'winter', owned: ['tako', ...sk.map(k => 'sk:' + k)], skin: Object.fromEntries(sk.map(k => [k, true])),
      wear: { chiikawa: 'tako', 'w:chiikawa': 's_chiikawa', rakko: 'fire', 'w:rakko': 's_rakko' }, wwin: ['chiikawa', 'rakko'], ach: { winter: 1 } }))
  })
  await p.goto(HOME); await p.waitForTimeout(900)
  await p.evaluate(async ({ IDS, LOOK, PARADE }) => {
    await document.fonts.load('80px Jua', '가')
    const M = window.__mjg, ink = '#4a3b35', W = window
    const st = document.createElement('style')
    st.textContent = '#pcap{position:fixed;left:0;right:0;top:150px;padding:0 14px;text-align:center;white-space:nowrap;z-index:50;font:36px Jua;color:#fff;-webkit-text-stroke:8px #4a3b35;paint-order:stroke fill;pointer-events:none;line-height:1.2}#pcap small{display:block;margin-top:8px;font-size:22px;-webkit-text-stroke:6px #4a3b35}#pcard{position:fixed;inset:0;width:100%;height:100%;z-index:60;display:none}'
    document.head.append(st)
    const cap = document.createElement('div'); cap.id = 'pcap'; document.body.append(cap)
    const card = document.createElement('canvas'); card.id = 'pcard'; card.width = 1080; card.height = 1920; document.body.append(card)
    W.__cap = (a, s) => { cap.innerHTML = a ? `${a}${s ? `<small>${s}</small>` : ''}` : ''; let f = 36; cap.style.fontSize = f + 'px'; while (cap.scrollWidth > cap.clientWidth && f > 18) cap.style.fontSize = --f + 'px' }
    // 카드 그림 — 눈밭 · 작은 눈사람 · 내리는 눈(f 프레임마다 떨어진다)
    const snowfield = (g, w, h, seed, f) => {
      let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647
      g.fillStyle = '#e6eff8'; g.fillRect(0, 0, w, h)
      for (let i = 0; i < w * h / 9000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(200,218,240,.5)' : 'rgba(255,255,255,.85)'; g.beginPath(); g.ellipse(r() * w, r() * h, 40 + r() * 80, 18 + r() * 34, 0, 0, Math.PI * 2); g.fill() }
      for (let i = 0; i < 160; i++) { const z = 0.4 + 0.6 * r(), x = (r() * w + Math.sin(f * 0.05 + i) * 18 * z + f * 1.5 * z) % w, y = (r() * h + f * (3 + 5 * z)) % h, rr = 3 + z * 6; g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 2; g.strokeStyle = 'rgba(100,135,190,.55)'; g.stroke() }
    }
    const logo = (g, txt, x, y, size, fill) => { g.font = `${size}px Jua`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round'; g.fillStyle = ink; g.fillText(txt, x, y + size * 0.1); g.strokeStyle = ink; g.lineWidth = size * 0.16; g.strokeText(txt, x, y); g.fillStyle = fill; g.fillText(txt, x, y) }
    const text = (g, s, x, y, size, fill = ink, stroke = 0) => { g.font = `${size}px Jua`; g.textAlign = 'center'; g.lineJoin = 'round'; if (stroke) { g.strokeStyle = ink; g.lineWidth = stroke; g.strokeText(s, x, y) } g.fillStyle = fill; g.fillText(s, x, y) }
    const chip = (g, s, x, y, size, bg, fg = ink) => { g.font = `${size}px Jua`; const w = g.measureText(s).width + size * 1.4, h = size * 1.7; g.beginPath(); g.roundRect(x - w / 2, y - h / 2, w, h, h / 2); g.fillStyle = bg; g.fill(); g.lineWidth = size * 0.12; g.strokeStyle = ink; g.stroke(); g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, x, y + size * 0.05); g.textBaseline = 'alphabetic' }
    const ART = {}, put = (g, id, oid, x, y, u, pose = {}) => { const k = id + oid + JSON.stringify(pose), a = ART[k] ||= M.art(id, 8, { look: 1.2, ...pose, outfit: oid ? M.outfitOf(oid, id) : undefined }), s = u / 8; g.drawImage(a.c, x - a.ox * u, y - a.oy * u, a.c.width * s, a.c.height * s) }   // 발끝이 y
    const WALK = [{}, ...M.WALK]
    const lineup = (g, cx, y, gap, u, f, pick) => IDS.forEach((id, i) => { const x = cx + (i - (IDS.length - 1) / 2) * gap; g.fillStyle = 'rgba(70,90,120,.2)'; g.beginPath(); g.ellipse(x, y - 3, u * 9, u * 2, 0, 0, Math.PI * 2); g.fill(); put(g, id, pick(id), x, y, u, WALK[((f / 4 | 0) + i) % WALK.length]) })
    W.__card = (kind, f) => {
      const g = card.getContext('2d'); card.style.display = kind ? 'block' : 'none'; if (!kind) return
      snowfield(g, 1080, 1920, 21, f)
      if (kind === 'title') {
        chip(g, '❄ 겨울 업데이트 ❄', 540, 190, 52, '#bfe6ff')
        logo(g, '먼작귀', 540, 560, 220, '#fff'); logo(g, '서바이버즈', 540, 720, 130, '#ff8fab')
        text(g, '눈보라 · 의상 · 스킨 · 겨울 노래', 540, 860, 54, ink); text(g, '전부 새로 왔어요!', 540, 940, 62, '#e8475f')
        lineup(g, 540, 1560, 126, 5.2, f, id => LOOK[id])
      } else if (kind === 'wear') {   // 의상 — 여덟이 다 같이 갈아입는다(15프레임마다)
        const oid = PARADE[(f / 15 | 0) % PARADE.length], o = M.OUTFIT[oid]
        chip(g, `${o.name}  ${o.tier === 'ach' ? '업적' : (o.cost ?? { cheap: 5000, rich: 50000 }[o.tier]).toLocaleString() + '원'}`, 540, 520, 56, o.tier === 'ach' ? '#ffd6e7' : o.tier === 'rich' ? '#fff0b3' : '#fff')
        IDS.forEach((id, i) => { const x = 175 + (i % 4) * 243, y = 860 + (i / 4 | 0) * 420; g.fillStyle = 'rgba(70,90,120,.2)'; g.beginPath(); g.ellipse(x, y - 3, 70, 16, 0, 0, Math.PI * 2); g.fill(); put(g, id, oid, x, y, 7.4, WALK[((f / 4 | 0) + i) % WALK.length]) })
        chip(g, '모두 입기', 540, 1560, 50, '#ff8fab', '#fff')
      } else {
        text(g, '지금 바로 무료로 플레이!', 540, 640, 66, ink)
        logo(g, '먼작귀', 540, 420, 180, '#fff')
        chip(g, 'chii-ka-wa.github.io', 540, 800, 64, '#fff')
        text(g, '설치 없이 브라우저에서 · PC · 휴대폰', 540, 940, 40, ink)
        lineup(g, 540, 1560, 126, 5.2, f, id => LOOK[id])
        text(g, '원작 「ちいかわ」 © ナガノ · 비공식 · 비영리 팬게임', 540, 1840, 30, 'rgba(74,59,53,.85)')
      }
    }
    // 게임 한 프레임 — 걷기(방향키) · 상자 · 쉬는 창은 넘기고 · 체력은 채우고 · 화면 시계(내리는 눈)도 같이
    const held = {}, keys = (dx, dy) => { const want = { KeyW: dy < -0.38, KeyS: dy > 0.38, KeyA: dx < -0.38, KeyD: dx > 0.38 }; for (const c in want) if (!!held[c] !== want[c]) { dispatchEvent(new KeyboardEvent(want[c] ? 'keydown' : 'keyup', { code: c })); held[c] = want[c] } }
    W.__frame = () => {
      if (M.mode === 'box') { M.pick0(); return }
      if (M.mode === 'pause') { M.resume(); return }
      if (W.__still) keys(0, 0); else { const a = M.G.t * 0.45; keys(Math.cos(a), Math.sin(a)) }
      if (M.pl.hp < 30) M.pl.hp = 60; M.G.queue.length = 0   // 쓰러지지 않게
      M.step(1 / 30); M.adv(1 / 30); M.render()
    }
    W.__ff = T => { while (M.G.t < T) { M.pl.inv = 1e9; M.G.queue.length = 0; if (M.mode === 'box') M.pick0(); else if (M.mode === 'pause') M.resume(); M.G.storm.next = Math.max(M.G.storm.next, M.G.t + 30); M.step(1 / 30) } M.pl.inv = 0 }   // 빨리 감기(눈보라는 미뤄 둔다)
  }, { IDS, LOOK, PARADE })
  let fi = 0
  const shot = () => p.screenshot({ path: path.join(FR, `f${String(fi++).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 })
  const card = async (kind, n) => { for (let f = 0; f < n; f++) { await p.evaluate(([k, f]) => window.__card(k, f), [kind, f]); await shot() } await p.evaluate(() => window.__card(null)) }
  // 게임 장면 — 자막을 달고 n 프레임. 시작할 때 바닥에 쌓인 보석은 치운다
  const play = async (n, a, s, on) => { await p.evaluate(([a, s]) => { window.__cap(a, s); window.__mjg.G.gems.length = 0 }, [a, s]); for (let i = 0; i < n; i++) { if (on) await p.evaluate(on, i); await p.evaluate(() => window.__frame()); await shot() } await p.evaluate(() => window.__cap('')) }

  await card('title', 75)                                                                                                     // 1 — 제목(2.5초)
  await p.evaluate(() => { window.__mjg.startGame(0); window.__ff(100) })
  await play(90, '새 겨울 맵!', '눈밭 · 눈사람 · 산타 모자 몬스터')                                                                  // 2 — 겨울 맵(3초)
  await play(150, '1분마다 눈보라!', '쌓인 눈은 미끌미끌 · 받는 피해 UP', i => {                                                     // 3 — 예고 → 눈보라(5초)
    const M = window.__mjg, G = M.G, W = G.storm
    if (i === 0) { W.warned = false; W.next = G.t + 5.2 }   // 바로 「곧 눈보라가 와요!」
    if (i === 40) { Object.assign(W, { on: 15, hot: 0, warm: false, piles: [], spawn: 0, fade: 0, next: G.t + 999 }); G.tip = { s: '눈보라가 몰아쳐요! 받는 피해가 조금 늘어나요', t: 0, T: 2.8, col: '#ff9b9b' } }
    M.pl.inv = 0
  })
  await play(120, '가만히 있으면 꽁꽁!', '덜덜 · 눈이 소복이 · 움직이면 털어 내요', i => {                                            // 4 — 얼어붙기(4초)
    const M = window.__mjg, G = M.G, W = window
    if (i === 0) { W.__still = 1; G.storm.on = 0.01; G.weapons.length = 0; G.shots.length = 0; for (const e of G.foes) if (!e.boss) e.dead = true }   // 내 공격이 얼굴을 가리지 않게 이 장면만 빼 둔다(다음 장면은 새 판)
    G.spawnT = 9; G.foes.forEach(e => { if (Math.hypot(e.x - M.pl.x, e.y - M.pl.y) < 220) e.dead = true })
    if (i < 100) M.pl.idleT = 1.5 + i * 0.11; else W.__still = 0   // 마지막 20프레임 — 걸어 나가며 눈을 털어 낸다
    M.pl.inv = 0; M.pl.hp = Math.max(M.pl.hp, 50)
  })
  await card('wear', 150)                                                                                                     // 5 — 의상(5초)
  await p.evaluate(() => {   // 6 · 7 — 랏코(불꽃 옷 · 고드름 검) · 벚꽃 일섬 등 스킬 스킨이 잘 보이게 스킬을 더해 둔다
    const M = window.__mjg; M.startGame(5); for (const id of ['ramen', 'pochette', 'guitar']) M.addWeapon(id)
    for (const w of M.G.weapons) { w.lv = 8; w.st = M.wstat(w) }
    window.__ff(240)
  })
  await play(120, '겨울 어려움 클리어 → 불꽃 옷!', '눈보라에도 끄떡없어요 · 겨울 무기 스킨도', i => {                                // 6 — 불꽃 옷(4초)
    const M = window.__mjg; if (i === 0) { window.__still = 0; Object.assign(M.G.storm, { on: 15, hot: 0, warm: false, piles: [], spawn: 0, fade: 0, next: M.G.t + 999 }) }
    M.pl.inv = 0
  })
  await play(150, '스킬 스킨 — 벚꽃 일섬!', '꼬리 · 장판까지 화려하게', i => { const M = window.__mjg; if (i === 0) M.G.storm.on = 0.01; M.pl.inv = 0 })   // 7 — 스킬 스킨(5초)
  await card('end', 105)                                                                                                      // 8 — 끝 · 주소(3.5초)
  const total = fi / FPS
  console.log('frames', fi, 'seconds', total.toFixed(1))
  await b.close()

  if (process.env.FFMPEG) {   // 영상 — 겨울 곡 하나로, 끝에서 줄어든다 · SNS 음량(-16 LUFS)
    execFileSync(process.env.FFMPEG, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(FR, 'f%05d.jpg'), '-i', path.join(OUT, 'winter.wav'),
      '-filter_complex', `[1:a]atrim=0:${total.toFixed(2)},afade=t=in:d=0.3,afade=t=out:st=${(total - 1.4).toFixed(2)}:d=1.4,loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100[ao]`,
      '-map', '0:v', '-map', '[ao]', '-c:v', 'libx264', '-vf', 'scale=in_range=pc:out_range=tv,format=yuv420p', '-crf', '22', '-preset', 'slow', '-r', String(FPS), '-c:a', 'aac', '-b:a', '160k', '-shortest', '-movflags', '+faststart', path.join(OUT, 'shorts.mp4')])
    fs.rmSync(path.join(OUT, 'winter.wav')); fs.rmSync(FR, { recursive: true })   // 다 만들었으면 프레임 · 소리 조각은 치운다
    console.log(path.relative(ROOT, path.join(OUT, 'shorts.mp4')))
  }
})()
