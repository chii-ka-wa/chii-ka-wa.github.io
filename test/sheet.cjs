// 동작 시트 — 캐릭터마다 서 있기 · 깜빡 · 걷기 넷 · 아픈 얼굴을 한 장에(그림을 고칠 때 확인용).
//   실행: 로컬 서버(8765)를 띄우고 NODE_PATH=<playwright 가 있는 node_modules> node test/sheet.cjs test/shots/sheet.png
const { chromium } = require('playwright')
;(async () => {
  const b = await chromium.launch(), p = await b.newPage({ viewport: { width: 1500, height: 1500 }, deviceScaleFactor: 1 })
  await p.goto('http://127.0.0.1:8765/'); await p.waitForTimeout(800)
  await p.evaluate(() => {
    const M = window.__mjg, poses = [{}, { blink: true }, ...M.WALK, { hurt: true }], ids = [...M.CHARS.map(c => c.id), 'goblin', 'chimera', 'anoko']
    const cv = document.createElement('canvas'); cv.width = 1500; cv.height = ids.length * 170; cv.style.cssText = 'position:absolute;left:0;top:0;z-index:99;background:#cdeaa8'
    const g = cv.getContext('2d'); g.fillStyle = '#cdeaa8'; g.fillRect(0, 0, cv.width, cv.height)
    ids.forEach((id, r) => poses.forEach((pose, i) => { const s = M.art(id, 4, { ...pose, look: 1.2 }), k = Math.min(1, 160 / s.c.height, 190 / s.c.width); g.drawImage(s.c, 30 + i * 200, 10 + r * 170 + (160 - s.c.height * k), s.c.width * k, s.c.height * k) }))
    document.body.append(cv)
  })
  await p.screenshot({ path: process.argv[2], fullPage: true }); await b.close()
})()
