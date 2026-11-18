// 배포 빌드 — 사이트에 필요한 파일만 dist/ 에, game.js 는 읽기 어렵게(난독화) 바꿔서. GitHub Actions(.github/workflows/deploy.yml)가 푸시마다 돌린다
//   실행: npm i --no-save terser@5.51.0 javascript-obfuscator@5.9.1 && node test/build.cjs   (KEEP_HOOK=1 이면 점검용 window.__mjg 를 남긴다 — dist 로 스모크 테스트를 돌릴 때)
//   game.js: 점검용 줄(window.__mjg) 빼기 → terser(이름 줄이기 · 압축) → javascript-obfuscator(문자열 묶음 · 이름 바꾸기 · 고쳐 쓰면 멈추기). 판이 느려지지 않게 흐름 꼬기 · 가짜 코드는 끈다
//   넣지 않는 것: README · supabase · test · .github · 숨김 파일(git 에 있는 파일 중에서 고른다)
const fs = require('fs'), path = require('path'), { execSync } = require('child_process')
const { minify } = require('terser'), JO = require('javascript-obfuscator')
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'dist'), SKIP = /^(README\.md|supabase\/|test\/|\.github\/|\.)/

;(async () => {
  fs.rmSync(OUT, { recursive: true, force: true })
  const files = execSync('git ls-files', { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(f => f && !SKIP.test(f))
  for (const f of files) { fs.mkdirSync(path.dirname(path.join(OUT, f)), { recursive: true }); fs.copyFileSync(path.join(ROOT, f), path.join(OUT, f)) }

  let src = fs.readFileSync(path.join(ROOT, 'game.js'), 'utf8')
  const hook = /^if \(!SECURE\) window\.__mjg = .*$/m
  if (!hook.test(src)) throw new Error('window.__mjg 줄을 못 찾음 — build.cjs 의 hook 을 고칠 것')
  if (!process.env.KEEP_HOOK) src = src.replace(hook, '')
  // 랭킹 체크섬 소금 — GitHub 비밀 CK_SALT(서버 ck_key 와 같은 값). 글자 그대로 남지 않게 XOR 로 섞어 넣는다(풀 수는 있지만 검색으로는 안 나온다). CI 에서 없으면 멈춘다(틀린 값으로 배포하면 모든 기록이 막힌다)
  const SALT = "const CK_SALT = '__CK_SALT__'"
  if (!src.includes(SALT)) throw new Error('CK_SALT 자리를 못 찾음 — build.cjs 를 고칠 것')
  if (process.env.CK_SALT) { const k = 1 + (Math.random() * 200 | 0); src = src.replace(SALT, `const CK_SALT = [${[...process.env.CK_SALT].map(c => c.charCodeAt(0) ^ k)}].map(c => String.fromCharCode(c ^ ${k})).join('')`) }
  else if (process.env.CI) throw new Error('GitHub 비밀 CK_SALT 가 없음 — Settings › Secrets and variables › Actions 에 넣을 것')
  const min = await minify(src, { module: true, compress: { passes: 2 }, mangle: { toplevel: true }, format: { comments: false } })
  const ob = JO.obfuscate(min.code, {
    target: 'browser', compact: true, simplify: true, identifierNamesGenerator: 'hexadecimal', renameGlobals: false,
    stringArray: true, stringArrayThreshold: 0.3, stringArrayEncoding: [], stringArrayRotate: true, stringArrayShuffle: true, stringArrayIndexShift: true,   // 문자열 30% 만 묶음으로 —
    stringArrayWrappersCount: 0, stringArrayCallsTransform: false, splitStrings: false,   //   24분 판 잰 값: step 0.182ms(원본) → 0.195(이 설정) · 0.298(75% + base64 + 감싸기). 그리기 12ms 는 그대로
    controlFlowFlattening: false, deadCodeInjection: false, numbersToExpressions: false, transformObjectKeys: false,   // 느려지는 것은 끈다(프레임마다 도는 코드)
    selfDefending: true, debugProtection: false, disableConsoleOutput: false, unicodeEscapeSequence: false,   // 개발자 도구 막기는 game.js 가 직접(SECURE)
  }).getObfuscatedCode()
  fs.writeFileSync(path.join(OUT, 'game.js'), ob)
  console.log(`dist/ — 파일 ${files.length}개 · game.js ${(src.length / 1024) | 0}KB → ${(ob.length / 1024) | 0}KB${process.env.KEEP_HOOK ? ' (점검용 __mjg 남김)' : ''}`)
})().catch(e => { console.error(e); process.exit(1) })
