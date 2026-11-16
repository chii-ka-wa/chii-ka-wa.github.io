// 번역 점검 — 실행: node test/i18n.cjs   (설치할 것 없음)
//   game.js 의 tr`…` 열쇠(한국어 원문 · ${} 자리는 {0} {1} …)를 모두 찾아, i18n/<언어>.js 마다 빠진 것 · {n} 자리가 다른 것(아이템 설명은 첫 숫자도) · 안 쓰는 것을 알려 준다
//   --keys <파일> 이면 열쇠 목록(쓰인 줄 · 그 줄 글)을 JSON 으로 써 준다(번역할 때 참고)
const fs = require('fs'), path = require('path')
const ROOT = path.join(__dirname, '..'), src = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8')

/** 주석 · 문자열 · 정규식은 건너뛰며 tr`…` 을 찾는다(${} 안의 tr`…` 도) */
function scan(s) {
  const keys = new Map(), lines = s.split('\n'), lineAt = i => s.slice(0, i).split('\n').length
  let i = 0
  const regexOk = () => { let j = i - 1; while (j >= 0 && /\s/.test(s[j])) j--; const c = s[j]; if (j < 0 || '(,=:[!&|?{};+-*%<>~^'.includes(c)) return true; return /\b(return|typeof|case|in|of|delete|void|new)$/.test(s.slice(Math.max(0, j - 7), j + 1)) }
  function skipStr(q) { i++; while (i < s.length && s[i] !== q) { if (s[i] === '\\') i++; i++ } i++ }
  function skipRegex() { i++; let cls = false; while (i < s.length) { const c = s[i]; if (c === '\\') i += 2; else { if (c === '[') cls = true; else if (c === ']') cls = false; else if (c === '/' && !cls) break; i++ } } i++; while (/[a-z]/i.test(s[i])) i++ }
  function template(tagged) {   // s[i] === '`'
    const start = i, parts = [['']]; i++
    while (i < s.length && s[i] !== '`') {
      if (s[i] === '\\') { parts[parts.length - 1][0] += cook(s[i + 1]); i += 2 }
      else if (s[i] === '$' && s[i + 1] === '{') { i += 2; code('}'); i++; parts.push(['']) }
      else parts[parts.length - 1][0] += s[i++]
    }
    i++
    if (tagged) { let k = parts[0][0]; for (let n = 1; n < parts.length; n++) k += `{${n - 1}}` + parts[n][0]; if (!keys.has(k)) { const ln = lineAt(start); keys.set(k, { line: ln, ctx: lines[ln - 1].trim().slice(0, 160) }) } }
  }
  const cook = c => ({ n: '\n', t: '\t', '`': '`', '\\': '\\', $: '$' })[c] ?? c
  function code(end) {   // end 를 만나면 멈춘다(그 자리에)
    let depth = 0
    while (i < s.length) {
      const c = s[i], d = s[i + 1]
      if (end && c === end && depth === 0) return
      if (c === '/' && d === '/') { while (i < s.length && s[i] !== '\n') i++ }
      else if (c === '/' && d === '*') { i = s.indexOf('*/', i + 2) + 2 }
      else if (c === "'" || c === '"') skipStr(c)
      else if (c === '`') template(false)
      else if (c === 't' && d === 'r' && s[i + 2] === '`' && !/[\w$]/.test(s[i - 1] || '')) { i += 2; template(true) }
      else if (c === '/' && regexOk()) skipRegex()
      else { if (c === '{') depth++; else if (c === '}') depth--; i++ }
    }
  }
  code(null)
  return keys
}

const keys = scan(src), want = [...keys.keys()]
const args = process.argv.slice(2), ki = args.indexOf('--keys')
if (ki >= 0) { fs.writeFileSync(args[ki + 1], JSON.stringify(want.map(k => ({ k, ...keys.get(k) })), null, 1)); console.log(`열쇠 ${want.length}개 → ${args[ki + 1]}`) }

const holes = k => (k.match(/\{\d+\}/g) || []).sort().join('')
// 아이템 설명(PASS 의 note)은 첫 숫자에 레벨을 곱해 「지금」을 보여 준다 — 번역에서도 같은 숫자가 맨 처음에 와야 한다
const firstNum = x => (x.match(/[\d.]+/) || [])[0], pa = src.indexOf('const PASS = {')
const passNotes = pa < 0 ? [] : [...src.slice(pa, src.indexOf('\n}', pa)).matchAll(/note: tr`([^`]*)`/g)].map(m => m[1])
let bad = 0
for (const f of fs.readdirSync(path.join(ROOT, 'i18n')).filter(f => f.endsWith('.js')).sort()) {
  const text = fs.readFileSync(path.join(ROOT, 'i18n', f), 'utf8'), m = text.match(/export default\s*(\{[\s\S]*\})\s*;?\s*$/)
  if (!m) { console.log(`${f}: export default { … } 를 못 찾음`); bad++; continue }
  let tr; try { tr = Function(`return (${m[1]})`)() } catch (e) { console.log(`${f}: 읽기 실패 — ${e.message}`); bad++; continue }
  const miss = want.filter(k => typeof tr[k] !== 'string'), wrong = want.filter(k => typeof tr[k] === 'string' && (holes(tr[k]) !== holes(k) || passNotes.includes(k) && firstNum(tr[k]) !== firstNum(k))), extra = Object.keys(tr).filter(k => !keys.has(k))
  console.log(`${f}: ${want.length - miss.length}/${want.length}${miss.length ? ` · 빠짐 ${miss.length}` : ''}${wrong.length ? ` · {n} · 첫 숫자 다름 ${wrong.length}` : ''}${extra.length ? ` · 안 씀 ${extra.length}` : ''}`)
  for (const k of [...miss.slice(0, 5)]) console.log('   빠짐:', k.slice(0, 80))
  for (const k of wrong.slice(0, 5)) console.log('   {n} · 첫 숫자 다름:', k.slice(0, 60), '→', tr[k].slice(0, 60))
  for (const k of extra.slice(0, 3)) console.log('   안 씀:', k.slice(0, 80))
  bad += miss.length + wrong.length
}
if (bad) { console.log('번역 점검 실패'); process.exit(1) }
console.log('번역 점검 통과')
