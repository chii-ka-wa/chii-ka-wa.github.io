// 공유 썸네일 · 아이콘 만들기 — 게임 속 그림(직접 그린 캐릭터)으로 og.png(1200×630) · icon-512.png · apple-touch-icon.png(180) · favicon.png(64)
//   실행: 로컬 서버(8765)를 띄우고 NODE_PATH=<playwright 가 있는 node_modules> node test/og.cjs
const { chromium } = require('playwright'), fs = require('fs'), path = require('path')
const ROOT = path.join(__dirname, '..')
;(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1200, height: 630 } })
  await p.goto('http://127.0.0.1:8765/'); await p.waitForTimeout(800)
  const out = await p.evaluate(async () => {
    await document.fonts.load('80px Jua')
    const M = window.__mjg, ink = '#4a3b35', mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c }
    const field = (g, w, h, seed) => {   // 풀밭 — 옅은 풀 무더기 · 데이지
      let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647
      g.fillStyle = '#cdeaa8'; g.fillRect(0, 0, w, h)
      for (let i = 0; i < w * h / 9000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(160,205,120,.45)' : 'rgba(235,250,210,.5)'; g.beginPath(); g.ellipse(r() * w, r() * h, 40 + r() * 80, 18 + r() * 34, 0, 0, Math.PI * 2); g.fill() }
      for (let i = 0; i < w * h / 6000; i++) { const x = r() * w, y = r() * h; g.strokeStyle = 'rgba(110,160,80,.55)'; g.lineWidth = 2; g.lineCap = 'round'; for (const d of [-5, 0, 5]) { g.beginPath(); g.moveTo(x + d, y); g.lineTo(x + d * 1.4, y - 10 - r() * 6); g.stroke() } }
      for (let i = 0; i < w * h / 14000; i++) { const x = r() * w, y = r() * h; g.fillStyle = ['#fff', '#ffe07a', '#e3c8ff'][i % 3]; for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 3.4, 0, Math.PI * 2); g.fill() } g.fillStyle = '#f2b13a'; g.beginPath(); g.arc(x, y, 2.6, 0, Math.PI * 2); g.fill() }
    }
    const logo = (g, txt, x, y, size, fill) => {   // 진한 테두리 글씨(게임 로고처럼)
      g.font = `${size}px Jua`; g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round'
      g.fillStyle = ink; g.fillText(txt, x, y + size * 0.1); g.strokeStyle = ink; g.lineWidth = size * 0.16; g.strokeText(txt, x, y); g.fillStyle = fill; g.fillText(txt, x, y)
    }
    const put = (g, id, x, y, u, pose = {}) => { const a = M.art(id, 8, { look: 1.2, ...pose }), k = u / 8; g.drawImage(a.c, x - a.ox * u, y - a.oy * u, a.c.width * k, a.c.height * k) }   // 모두 같은 배율(u = 1 단위당 px), 발끝이 y
    const res = {}
    { // og.png
      const c = mk(1200, 630), g = c.getContext('2d'); field(g, 1200, 630, 7)
      g.fillStyle = 'rgba(255,253,248,.82)'; g.beginPath(); g.roundRect(170, 46, 860, 300, 44); g.fill(); g.lineWidth = 6; g.strokeStyle = ink; g.stroke()
      logo(g, '먼작귀', 600, 178, 128, '#fff'); logo(g, '서바이버즈', 600, 268, 78, '#ff8fab')
      g.font = '30px Jua'; g.fillStyle = ink; g.textAlign = 'center'; g.fillText('먼가 작고 귀여운 녀석들의 토벌 생존기', 600, 318)
      const ids = ['chiikawa', 'hachiware', 'usagi', 'momonga', 'kurimanju', 'rakko', 'shisa', 'kani'], walk = [{}, ...M.WALK]
      ids.forEach((id, i) => { const x = 105 + i * 141, y = 598; g.fillStyle = 'rgba(70,90,50,.22)'; g.beginPath(); g.ellipse(x, y - 4, 50, 11, 0, 0, Math.PI * 2); g.fill(); put(g, id, x, y - 6, 5.3, walk[i % 5]) })
      g.font = '24px Jua'; g.fillStyle = '#fff'; g.strokeStyle = ink; g.lineWidth = 6; g.textAlign = 'right'; g.strokeText('비공식 팬게임 · 무료 · 브라우저에서 바로', 1180, 34); g.fillText('비공식 팬게임 · 무료 · 브라우저에서 바로', 1180, 34)
      res.og = c.toDataURL('image/png')
    }
    const icon = n => {   // 둥근 네모 풀색 바탕에 치이카와 얼굴
      const c = mk(n, n), g = c.getContext('2d'), r = n * 0.22; g.beginPath(); g.roundRect(0, 0, n, n, r); g.clip(); field(g, n, n, 3)
      const a = M.art('chiikawa', 24, { bare: true }), u = 24, side = 34 * u, sx = (a.ox - 17) * u, sy = (a.oy - 33.5) * u   // 든 것 없이, 머리 · 귀가 다 보이게 — 34단위 정사각형
      g.drawImage(a.c, sx, sy, side, side, 0, n * 0.1, n, n)
      return c.toDataURL('image/png')
    }
    res.icon512 = icon(512); res.apple = icon(180); res.fav = icon(64)
    return res
  })
  const save = (name, url) => fs.writeFileSync(path.join(ROOT, name), Buffer.from(url.split(',')[1], 'base64'))
  save('og.png', out.og); save('icon-512.png', out.icon512); save('apple-touch-icon.png', out.apple); save('favicon.png', out.fav)
  await b.close(); console.log('og.png · icon-512.png · apple-touch-icon.png · favicon.png')
})()
