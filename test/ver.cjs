// 배포 전 한 번 — index.html 의 game.js?v= 를 지금 시각으로 바꾼다(브라우저가 예전 game.js · 번역 파일을 10분 동안 그대로 쓰지 않게)
//   GitHub Pages 는 모든 파일에 max-age=600 을 붙인다 — 주소가 바뀌어야 새로 받는다. 번역 파일(i18n)은 game.js 가 자기 주소의 ?v= 를 그대로 붙여 부른다
//   실행: node test/ver.cjs
const fs = require('fs'), path = require('path'), f = path.join(__dirname, '..', 'index.html'), d = new Date(), p = n => String(n).padStart(2, '0')
const v = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}`, s = fs.readFileSync(f, 'utf8')
const out = s.replace(/<script type="module" src="game\.js(\?v=\d+)?"><\/script>/, `<script type="module" src="game.js?v=${v}"></script>`)
if (out === s) throw new Error('index.html 에서 game.js 줄을 못 찾았어요')
fs.writeFileSync(f, out); console.log('game.js?v=' + v)
