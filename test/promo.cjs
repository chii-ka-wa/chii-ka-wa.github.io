// SNS 홍보 — 이미지 3장(정사각 1080 · 세로 1080×1920 · 가로 1600×900)과 숏츠 영상(세로 1080×1920 · 30fps · 약 30초, 게임 배경음 포함)
//   게임을 한 프레임씩 직접 돌리며 찍는다(기기 속도와 상관없이 매끄럽게). 그림은 모두 게임 속 직접 그린 그림
//   실행: 로컬 서버(8765) + NODE_PATH=<playwright 가 있는 node_modules> FFMPEG=<libx264 가 있는 ffmpeg> node test/promo.cjs → promo/(git 에 안 올린다)
//   PROMO_LANG=en · ja · zh-CN · zh-TW 이면 그 나라 판 → promo/<언어>/(게임도 그 말로, 주소는 chii-ka-wa.github.io/<언어>)
const { chromium } = require('playwright'), fs = require('fs'), path = require('path'), { execFileSync } = require('child_process')
const LANG = process.env.PROMO_LANG || 'ko'   // ko(기본) · en · ja · zh-CN · zh-TW — 게임도 그 말로
// 다른 나라 말 홍보 글 — 한국어 → 그 말(없으면 한국어 그대로). 주소는 그 말로 바로 들어가는 링크(/en/ · /ja/ …)
const PT = {
  en: {
  '비공식 팬게임 · 무료': 'Unofficial fan game · Free', '먼작귀': 'Chiikawa', '서바이버즈': 'Survivors', '먼가 작고 귀여운 녀석들의': 'Something small and cute', '살벌한 토벌 생존기!': 'fights to survive the swarm!',
  '지금 바로 무료로 플레이!': 'Play free right now!', 'chii-ka-wa.github.io': 'chii-ka-wa.github.io/en', '설치 없이 브라우저에서 · PC · 휴대폰': 'No install · In your browser · PC & mobile',
  '원작 「ちいかわ」 © ナガノ · 비공식 · 비영리 팬게임': 'Original work "Chiikawa" © Nagano · Unofficial, non-profit fan game',
  '돌아다니면 「떠돌이 보물상자」!': 'Wander far for a Treasure Chest!', '토벌 보상금 — 운이 좋으면 500!': 'Bounty coins — 500 if you\'re lucky!',
  '몰려오는 몬스터를 스킬로 싹!': 'Sweep the horde with your skills!', '레벨 업마다 스킬 · 아이템을 골라 키워요': 'Pick a skill or item every level-up',
  '보스를 쓰러뜨리면 「각성의 별」!': 'Beat a boss for an Awakening Star!', 'Lv 8 스킬 하나가 각성해요': 'One Lv 8 skill awakens',
  '각성하면 날아오는 것도 막아요!': 'Awakened skills block bullets!', '사스마타가 탄을 쳐 내요 — 스킬마다 다른 막기': 'The Sasumata swats shots away — every skill blocks its own way',
  '20분 — 커다란 토벌!': '20 min — a big Subjugation!', '보스 「아노코」 등장': 'Boss "Anoko" appears', '25분 — 최종보스 「세이렌」': '25 min — final boss "Siren"', '인어 셋이 지키고 있어요…': 'Three Mermaids guard her…',
  '29분 — 검은 별똥별까지!': '29 min — the Black Shooting Star!', '쓰러뜨릴 수 없어요… 그 전에 세이렌을!': 'It can\'t be beaten… defeat Siren first!',
  '먼가 작고 귀여운 녀석들의 토벌 생존기': 'A Subjugation Survival Tale of Something Small and Cute', '돌아다니면 보물상자!': 'Wander for treasure!',
  '비공식 팬게임 · 무료 · 설치 없이 브라우저에서': 'Unofficial fan game · Free · No install', '무료': 'Free', '설치 없이 브라우저에서': 'No install · Browser', 'PC · 휴대폰': 'PC · Mobile', '비공식 팬게임': 'Unofficial fan game',
},
  ja: {
    '비공식 팬게임 · 무료': '非公式ファンゲーム・無料', '먼작귀': 'ちいかわ', '서바이버즈': 'サバイバーズ', '먼가 작고 귀여운 녀석들의': 'なんか小さくてかわいいやつらの', '살벌한 토벌 생존기!': 'ハラハラ討伐サバイバル！',
    '지금 바로 무료로 플레이!': 'いますぐ無料でプレイ！', 'chii-ka-wa.github.io': 'chii-ka-wa.github.io/ja', '설치 없이 브라우저에서 · PC · 휴대폰': 'インストール不要・ブラウザで・PC・スマホ',
    '원작 「ちいかわ」 © ナガノ · 비공식 · 비영리 팬게임': '原作「ちいかわ」© ナガノ・非公式・非営利のファンゲーム',
    '돌아다니면 「떠돌이 보물상자」!': '歩きまわると「さすらいの宝箱」！', '토벌 보상금 — 운이 좋으면 500!': '討伐報酬金 — 運がよければ500！',
    '몰려오는 몬스터를 스킬로 싹!': 'おしよせるモンスターをスキルで一掃！', '레벨 업마다 스킬 · 아이템을 골라 키워요': 'レベルアップごとにスキル・アイテムを選んで育てよう',
    '보스를 쓰러뜨리면 「각성의 별」!': 'ボスをたおすと「覚醒の星」！', 'Lv 8 스킬 하나가 각성해요': 'Lv 8のスキルがひとつ覚醒するよ',
    '각성하면 날아오는 것도 막아요!': '覚醒すると飛んでくる攻撃もふせぐ！', '사스마타가 탄을 쳐 내요 — 스킬마다 다른 막기': 'さすまたが弾をはじく — スキルごとにちがうふせぎ方',
    '20분 — 커다란 토벌!': '20分 — でっかい討伐！', '보스 「아노코」 등장': 'ボス「あのこ」登場', '25분 — 최종보스 「세이렌」': '25分 — 最終ボス「セイレーン」', '인어 셋이 지키고 있어요…': '人魚3体が守っている…',
    '29분 — 검은 별똥별까지!': '29分 — 黒い流れ星まで！', '쓰러뜨릴 수 없어요… 그 전에 세이렌을!': 'たおせない… その前にセイレーンを！',
    '먼가 작고 귀여운 녀석들의 토벌 생존기': 'なんか小さくてかわいいやつらの討伐サバイバル', '돌아다니면 보물상자!': '歩けば宝箱！',
    '비공식 팬게임 · 무료 · 설치 없이 브라우저에서': '非公式ファンゲーム・無料・インストール不要', '무료': '無料', '설치 없이 브라우저에서': 'ブラウザですぐ遊べる', 'PC · 휴대폰': 'PC・スマホ', '비공식 팬게임': '非公式ファンゲーム',
  },
  'zh-CN': {
    '비공식 팬게임 · 무료': '非官方粉丝游戏 · 免费', '먼작귀': '吉伊卡哇', '서바이버즈': '幸存者', '먼가 작고 귀여운 녀석들의': '小小可爱的家伙们', '살벌한 토벌 생존기!': '惊险的讨伐生存记！',
    '지금 바로 무료로 플레이!': '现在就免费开玩！', 'chii-ka-wa.github.io': 'chii-ka-wa.github.io/zh-cn', '설치 없이 브라우저에서 · PC · 휴대폰': '无需安装 · 浏览器直接玩 · 电脑 · 手机',
    '원작 「ちいかわ」 © ナガノ · 비공식 · 비영리 팬게임': '原作「ちいかわ」© ナガノ · 非官方 · 非营利粉丝游戏',
    '돌아다니면 「떠돌이 보물상자」!': '到处走走会遇到「流浪宝箱」！', '토벌 보상금 — 운이 좋으면 500!': '讨伐报酬 — 运气好能拿500！',
    '몰려오는 몬스터를 스킬로 싹!': '用技能横扫蜂拥而来的怪物！', '레벨 업마다 스킬 · 아이템을 골라 키워요': '每次升级挑选技能和道具来培养',
    '보스를 쓰러뜨리면 「각성의 별」!': '打倒BOSS掉落「觉醒之星」！', 'Lv 8 스킬 하나가 각성해요': '让一个 Lv 8 技能觉醒',
    '각성하면 날아오는 것도 막아요!': '觉醒后还能挡住飞来的攻击！', '사스마타가 탄을 쳐 내요 — 스킬마다 다른 막기': '刺叉会把子弹弹开 — 每个技能挡法都不同',
    '20분 — 커다란 토벌!': '20分钟 — 超大讨伐！', '보스 「아노코」 등장': 'BOSS「那孩子」登场', '25분 — 최종보스 「세이렌」': '25分钟 — 最终BOSS「塞壬」', '인어 셋이 지키고 있어요…': '三条人鱼守护着她…',
    '29분 — 검은 별똥별까지!': '29分钟 — 黑色流星来袭！', '쓰러뜨릴 수 없어요… 그 전에 세이렌을!': '打不倒它… 在那之前打倒塞壬！',
    '먼가 작고 귀여운 녀석들의 토벌 생존기': '小小可爱的家伙们的讨伐生存记', '돌아다니면 보물상자!': '走走就有宝箱！',
    '비공식 팬게임 · 무료 · 설치 없이 브라우저에서': '非官方粉丝游戏 · 免费 · 无需安装', '무료': '免费', '설치 없이 브라우저에서': '无需安装 · 浏览器', 'PC · 휴대폰': '电脑 · 手机', '비공식 팬게임': '非官方粉丝游戏',
  },
  'zh-TW': {
    '비공식 팬게임 · 무료': '非官方同人遊戲 · 免費', '먼작귀': '吉伊卡哇', '서바이버즈': '倖存者', '먼가 작고 귀여운 녀석들의': '又小又可愛的傢伙們', '살벌한 토벌 생존기!': '驚險的討伐求生記！',
    '지금 바로 무료로 플레이!': '現在就免費玩！', 'chii-ka-wa.github.io': 'chii-ka-wa.github.io/zh-tw', '설치 없이 브라우저에서 · PC · 휴대폰': '免安裝 · 瀏覽器直接玩 · 電腦 · 手機',
    '원작 「ちいかわ」 © ナガノ · 비공식 · 비영리 팬게임': '原作「ちいかわ」© ナガノ · 非官方 · 非營利同人遊戲',
    '돌아다니면 「떠돌이 보물상자」!': '到處走走會遇到「流浪寶箱」！', '토벌 보상금 — 운이 좋으면 500!': '討伐獎金 — 運氣好能拿500！',
    '몰려오는 몬스터를 스킬로 싹!': '用技能掃光湧過來的怪物！', '레벨 업마다 스킬 · 아이템을 골라 키워요': '每次升級挑選技能和道具來養成',
    '보스를 쓰러뜨리면 「각성의 별」!': '打倒頭目掉落「覺醒之星」！', 'Lv 8 스킬 하나가 각성해요': '讓一個 Lv 8 技能覺醒',
    '각성하면 날아오는 것도 막아요!': '覺醒後還能擋下飛來的攻擊！', '사스마타가 탄을 쳐 내요 — 스킬마다 다른 막기': '刺股會把子彈彈開 — 每個技能擋法都不一樣',
    '20분 — 커다란 토벌!': '20分鐘 — 超大討伐！', '보스 「아노코」 등장': '頭目「那孩子」登場', '25분 — 최종보스 「세이렌」': '25分鐘 — 最終頭目「賽蓮」', '인어 셋이 지키고 있어요…': '三隻人魚守護著她…',
    '29분 — 검은 별똥별까지!': '29分鐘 — 黑色流星來襲！', '쓰러뜨릴 수 없어요… 그 전에 세이렌을!': '打不倒它… 在那之前打倒賽蓮！',
    '먼가 작고 귀여운 녀석들의 토벌 생존기': '又小又可愛的傢伙們的討伐求生記', '돌아다니면 보물상자!': '走走就有寶箱！',
    '비공식 팬게임 · 무료 · 설치 없이 브라우저에서': '非官方同人遊戲 · 免費 · 免安裝', '무료': '免費', '설치 없이 브라우저에서': '免安裝 · 瀏覽器', 'PC · 휴대폰': '電腦 · 手機', '비공식 팬게임': '非官方同人遊戲',
  },
}
const T = PT[LANG] || {}, L = s => T[s] ?? s
const PICK = { en: 'Sasumata', ja: 'さすまた', 'zh-CN': '刺叉', 'zh-TW': '刺股' }[LANG] || '사스마타'   // 각성 상자에서 고를 카드(그 말로 쓴 이름)
const FAM = { ja: 'Jua, "Zen Maru Gothic"', 'zh-CN': 'Jua, "Noto Sans SC"', 'zh-TW': 'Jua, "Noto Sans TC"' }[LANG] || 'Jua'   // 일본 · 중국 글자는 게임이 불러오는 글꼴로
const ROOT = path.join(__dirname, '..'), OUT = path.join(ROOT, 'promo', LANG === 'ko' ? '' : LANG.toLowerCase()), FR = path.join(OUT, 'frames'), FPS = 30, HOME = 'http://127.0.0.1:8765/'
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
  if (process.env.FFMPEG) { await music(b, 'field', 'chiikawa', 32); await music(b, 'siren', '', 16) }
  const p = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 2 })
  p.on('pageerror', e => console.log('pageerror', e.message))
  await p.addInitScript(l => { window.__lang = l }, LANG === 'ko' ? undefined : LANG)
  await p.addInitScript(() => { window.requestAnimationFrame = () => 0; localStorage.setItem('mjg.v1', JSON.stringify({ diff: 'normal', bgm: 0, sfx: 0, noStats: true, zoom: 0.85, lang: window.__lang })) })   // 게임 루프를 멈추고 직접 한 프레임씩 · 조금 넓게 보기
  await p.goto(HOME); await p.waitForTimeout(800)
  await p.evaluate(async ({ T, FAM, LANG }) => {
    await document.fonts.load(`80px ${FAM}`, LANG === 'ko' ? '가' : Object.values(T).join('') + await fetch(`i18n/${LANG}.js`).then(r => r.text()))   // 그 말의 글자를 미리 다 불러 둔다(캔버스가 빈 네모로 그리지 않게)
    window.__FAM = FAM
    const L = window.__L = s => T[s] ?? s   // 영어판이면 영어로
    const M = window.__mjg, ink = '#4a3b35', W = window
    const st = document.createElement('style')
    st.textContent = '#pcap{position:fixed;left:0;right:0;top:150px;padding:0 14px;text-align:center;white-space:nowrap;z-index:50;font:36px ' + FAM + ';color:#fff;-webkit-text-stroke:8px #4a3b35;paint-order:stroke fill;pointer-events:none;line-height:1.2}#pcap small{display:block;margin-top:6px;font-size:.64em;-webkit-text-stroke:6px #4a3b35}#pcard{position:fixed;left:0;top:0;width:540px;height:960px;z-index:60;display:none}'
    document.head.append(st)
    const cap = document.createElement('div'); cap.id = 'pcap'; document.body.append(cap)
    const card = document.createElement('canvas'); card.id = 'pcard'; card.width = 1080; card.height = 1920; document.body.append(card)
    W.__cap = (a, s) => { cap.innerHTML = a ? `${a}${s ? `<small>${s}</small>` : ''}` : ''; let f = 36; cap.style.fontSize = f + 'px'; while (cap.scrollWidth > cap.clientWidth && f > 18) cap.style.fontSize = --f + 'px' }   // 한 줄에 들어가게 줄인다(긴 말이 두 줄로 넘어가 게임 알림과 겹치지 않게)
    // 그림 도구 — og.cjs 와 같은 풀밭 · 로고
    const field = (g, w, h, seed) => {
      let s = seed; const r = () => (s = (s * 16807) % 2147483647) / 2147483647
      g.fillStyle = '#cdeaa8'; g.fillRect(0, 0, w, h)
      for (let i = 0; i < w * h / 9000; i++) { g.fillStyle = r() < 0.5 ? 'rgba(160,205,120,.45)' : 'rgba(235,250,210,.5)'; g.beginPath(); g.ellipse(r() * w, r() * h, 40 + r() * 80, 18 + r() * 34, 0, 0, Math.PI * 2); g.fill() }
      for (let i = 0; i < w * h / 6000; i++) { const x = r() * w, y = r() * h; g.strokeStyle = 'rgba(110,160,80,.55)'; g.lineWidth = 2; g.lineCap = 'round'; for (const d of [-5, 0, 5]) { g.beginPath(); g.moveTo(x + d, y); g.lineTo(x + d * 1.4, y - 10 - r() * 6); g.stroke() } }
      for (let i = 0; i < w * h / 14000; i++) { const x = r() * w, y = r() * h; g.fillStyle = ['#fff', '#ffe07a', '#e3c8ff'][i % 3]; for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2; g.beginPath(); g.arc(x + Math.cos(a) * 4, y + Math.sin(a) * 4, 3.4, 0, Math.PI * 2); g.fill() } g.fillStyle = '#f2b13a'; g.beginPath(); g.arc(x, y, 2.6, 0, Math.PI * 2); g.fill() }
    }
    const logo = (g, txt, x, y, size, fill, mw = 980) => { g.font = `${size}px ${FAM}`; const w0 = g.measureText(txt).width; if (w0 > mw) { size *= mw / w0; g.font = `${size}px ${FAM}` }   // 넓으면 줄인다(영어판)
      g.textAlign = 'center'; g.textBaseline = 'alphabetic'; g.lineJoin = 'round'; g.fillStyle = ink; g.fillText(txt, x, y + size * 0.1); g.strokeStyle = ink; g.lineWidth = size * 0.16; g.strokeText(txt, x, y); g.fillStyle = fill; g.fillText(txt, x, y) }
    const text = (g, s, x, y, size, fill = ink, stroke = 0, align = 'center', mw = 1000) => { g.font = `${size}px ${FAM}`; const w0 = g.measureText(s).width; if (w0 > mw) { size *= mw / w0; g.font = `${size}px ${FAM}` } g.textAlign = align; g.lineJoin = 'round'; if (stroke) { g.strokeStyle = ink; g.lineWidth = stroke; g.strokeText(s, x, y) } g.fillStyle = fill; g.fillText(s, x, y) }
    const chip = (g, s, x, y, size, bg, fg = ink) => { g.font = `${size}px ${FAM}`; const w = g.measureText(s).width + size * 1.4, h = size * 1.7; g.beginPath(); g.roundRect(x - w / 2, y - h / 2, w, h, h / 2); g.fillStyle = bg; g.fill(); g.lineWidth = size * 0.16; g.strokeStyle = ink; g.stroke(); g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, x, y + size * 0.04); g.textBaseline = 'alphabetic' }
    const ART = {}, put = (g, id, x, y, u, pose = {}) => { const k = id + JSON.stringify(pose), a = ART[k] ||= M.art(id, 8, { look: 1.2, ...pose }), s = u / 8; g.drawImage(a.c, x - a.ox * u, y - a.oy * u, a.c.width * s, a.c.height * s) }   // 발끝이 y
    const IDS = ['chiikawa', 'hachiware', 'usagi', 'momonga', 'kurimanju', 'rakko', 'shisa', 'kani'], WALK = [{}, ...M.WALK]
    const lineup = (g, ids, cx, y, gap, u, f = 0) => ids.forEach((id, i) => { const x = cx + (i - (ids.length - 1) / 2) * gap; g.fillStyle = 'rgba(70,90,50,.22)'; g.beginPath(); g.ellipse(x, y - 3, u * 9, u * 2, 0, 0, Math.PI * 2); g.fill(); put(g, id, x, y - 4, u, WALK[((f / 5 | 0) + i) % 5]) })
    const frame = (g, img, x, y, w, h, r, sx, sy, sw, sh) => { g.save(); g.beginPath(); g.roundRect(x, y, w, h, r); g.clip(); g.drawImage(img, sx, sy, sw, sh, x, y, w, h); g.restore(); g.beginPath(); g.roundRect(x, y, w, h, r); g.lineWidth = 9; g.strokeStyle = ink; g.stroke() }
    W.__promo = { field, logo, text, chip, put, lineup, frame, IDS, ink }
    // 처음 · 끝 카드(f = 카드 안 프레임 번호 — 캐릭터가 제자리걸음)
    W.__card = (kind, f) => {
      const g = card.getContext('2d'); card.style.display = kind ? 'block' : 'none'; if (!kind) return
      field(g, 1080, 1920, 11)
      text(g, L('비공식 팬게임 · 무료'), 540, 150, 40, '#fff', 10)
      logo(g, L('먼작귀'), 540, kind === 'end' ? 560 : 640, 220, '#fff'); logo(g, L('서바이버즈'), 540, kind === 'end' ? 720 : 800, 130, '#ff8fab')
      if (kind === 'title') { text(g, L('먼가 작고 귀여운 녀석들의'), 540, 960, 54, ink); text(g, L('살벌한 토벌 생존기!'), 540, 1040, 64, '#e8475f'); lineup(g, IDS, 540, 1560, 126, 5.2, f) }
      else {
        text(g, L('지금 바로 무료로 플레이!'), 540, 880, 62, ink)
        chip(g, L('chii-ka-wa.github.io'), 540, 1030, 64, '#fff')
        text(g, L('설치 없이 브라우저에서 · PC · 휴대폰'), 540, 1170, 40, ink)
        lineup(g, IDS, 540, 1640, 126, 5.2, f)
        text(g, L('원작 「ちいかわ」 © ナガノ · 비공식 · 비영리 팬게임'), 540, 1840, 30, 'rgba(74,59,53,.85)')
      }
    }
    // 게임 한 프레임 — 둥글게 걸어 다니고(방향키), 체력이 줄면 채워 주고, 레벨 업 상자 · 쉬는 창은 잠깐 보여 준 뒤 넘긴다
    const held = {}, keys = (dx, dy) => { const want = { KeyW: dy < -0.38, KeyS: dy > 0.38, KeyA: dx < -0.38, KeyD: dx > 0.38 }; for (const c in want) if (!!held[c] !== want[c]) { dispatchEvent(new KeyboardEvent(want[c] ? 'keydown' : 'keyup', { code: c })); held[c] = want[c] } }
    const steer = () => { if (W.__still) return keys(0, 0); const a = M.G.t * 0.45; keys(Math.cos(a), Math.sin(a)) }   // 크게 원을 그리며 걷는다(__still 이면 멈춰 선다)
    const hover = () => {   // 보스 장면 — 세로 화면에 보스가 잘리지 않게 보스를 캐릭터 조금 위로 천천히 끌어 둔다(세이렌은 원래 멀찍이 떨어져 있으려 해서)
      const e = W.__follow && M.G.foes.find(f => f.kind === W.__follow && !f.dead); if (!e) return
      e.x += (M.pl.x + Math.cos(M.G.t * 0.7) * 60 - e.x) * 0.1; e.y += (M.pl.y - 100 - e.y) * 0.1
      const D = M.G.dark, a = Math.PI / 2 + Math.sin(M.G.t * 0.9) * 1.9; if (D) { D.x += (M.pl.x + Math.cos(a) * 170 - D.x) * 0.15; D.y += (M.pl.y + Math.sin(a) * 140 - D.y) * 0.15 }   // 검은 별똥별도 화면 안에서 나를 둘러 막 돌아다니게 — 닿지 않을 만큼 떨어져, 위(세이렌 자리)는 빼고 옆 · 아래로 오간다
    }
    let top = 0, hold = 0
    W.__seg = (calm = 0, follow = null) => { top = 0; hold = 0; W.__still = 0; M.G.items.length = 0;   // 장면마다 바닥에 쌓인 줍는 것은 치운다
      W.__shown = follow ? 1 : 0; W.__calm = calm; W.__follow = follow; M.pl.inv = 0; if (calm) for (const e of M.G.foes) if (!e.boss && Math.random() > calm) e.dead = true }   // calm — 보스가 잘 보이게 일반 적을 덜어 내고 더 나오지 않게
    W.__frame = () => {
      const aw = M.mode === 'box' && document.querySelector('#ui .box.awaken'); document.getElementById('pcap').style.opacity = aw ? 0 : 1   // 각성 상자 — 1.5초 보여 주고 W.__pick 카드를 눌러 고른다(자막은 상자를 가리지 않게 잠깐 숨김)
      if (aw) { if (++hold > 45) { ([...aw.querySelectorAll('.card')].find(c => c.textContent.includes(W.__pick)) || aw.querySelector('.card')).click(); hold = 0 } return M.mode }
      if (M.mode === 'box') { if (W.__shown || ++hold > 28) { M.pick0(); hold = 0; W.__shown = 1 } return M.mode }
      if (M.mode === 'pause') { if (++hold > 36) { M.resume(); hold = 0 } return M.mode }
      if (M.mode !== 'play') return M.mode
      top = Math.max(top, M.pl.hp); if (M.pl.hp < top * 0.6) M.pl.hp = top
      if (W.__calm) { M.G.spawnT = 9; M.G.nextSwarm = M.G.nextEvt = M.G.t + 99 }
      steer(); M.step(1 / 30); hover(); M.render(); return M.mode
    }
    W.__ff = (T, keep) => { while (M.G.t < T) { M.pl.inv = 1e9; const s = keep && M.G.final?.siren; if (s && s.hp < s.max * 0.3) s.hp = s.max * 0.3; if (M.mode === 'box') M.pick0(); else if (M.mode === 'pause') M.resume(); else if (M.mode === 'play') { steer(); M.step(1 / 30) } else break } M.pl.inv = 0; M.render() }
    W.__near = kind => { const e = M.G.foes.find(f => f.kind === kind && !f.dead); if (e) { e.x = M.pl.x + 40; e.y = M.pl.y - 200 } return !!e }

  }, { T, FAM, LANG })
  let fi = 0
  const shot = () => p.screenshot({ path: path.join(FR, `f${String(fi++).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 92 })
  const still = (name, all) => p.evaluate(all => {   // 이미지용 — 피해 숫자 · 적 탄 · 효과 · 알림 글을 잠깐 치우고 그린 캔버스(다음 프레임은 그대로). all 이면 효과 · 알림 글은 남긴다(격파 장면)
    const M = window.__mjg, G = M.G, keep = [G.nums, G.eshots, G.fx, G.banner, G.haz]; G.nums = []; G.haz = []
    if (all) { G.eshots = G.eshots.filter(b => b.k === 'shard'); G.fx = G.fx.filter(f => f.k !== 'white') } else { G.eshots = []; G.fx = []; G.banner = null }   // 격파 장면 — 경고 원 · 다른 탄은 치우고 검은 별똥별 조각만
    M.pl.inv = 0; M.render()
    const u = document.getElementById('cv').toDataURL('image/png'); [G.nums, G.eshots, G.fx, G.banner, G.haz] = keep; M.render(); return u
  }, all).then(u => fs.writeFileSync(path.join(OUT, name), Buffer.from(u.split(',')[1], 'base64')))
  const play = async (n, cap, sub, at, on, calm = 0, follow = null) => { let best = 0, won = 0; await p.evaluate(([a, s, c, f]) => { window.__cap(a, s); window.__seg(c, f) }, [cap, sub, calm, follow]); for (let i = 0; i < n; i++) { const m = await p.evaluate(() => window.__frame()); if (m === 'over') break; if (on) await on(i); if (follow && i === 54) await p.evaluate(() => window.__cap('')); await shot()
    if (at[1] === 'crowd') { const k = await p.evaluate(() => { const M = window.__mjg, v = M.G.foes.filter(e => !e.dead && Math.abs(e.x - M.pl.x) < 260 && Math.abs(e.y - M.pl.y) < 420).length; return M.mode === 'play' ? v : 0 }); if (i > 20 && k > best) { best = k; await still(at[0]) } }   // 화면에 적이 가장 많을 때
    else if (at[1] === 'won') { if (!won && await p.evaluate(() => { const w = window.__mjg.G.won; return w > 0 && w < 2.7 })) { won = 1; await still(at[0], true) } }   // 세이렌이 쓰러진 직후
    else if (at[1] === 'jackpot') { if (!won && await p.evaluate(() => window.__mjg.G.found >= 500)) won = i; if (won && i === won + 8) await still(at[0], true) }   // 500 을 주운 0.27초 뒤(흰 섬광은 빼고)
    else if (i === at[1]) await still(at[0]) } }
  const card = async (kind, n) => { for (let f = 0; f < n; f++) { await p.evaluate(([k, f]) => window.__card(k, f), [kind, f]); await shot() } await p.evaluate(() => window.__card(null)) }

  await p.evaluate(() => { window.__mjg.startGame(0); window.__card('title', 0) })
  await card('title', 75)                                                                                                       // 0 ~ 2.5초 — 제목
  await p.evaluate(() => window.__ff(180))
  await play(120, L('돌아다니면 「떠돌이 보물상자」!'), L('토벌 보상금 — 운이 좋으면 500!'), ['shot-a.png', 'jackpot'], i => p.evaluate(i => {   // 3분 — 멀리 걸어가면 앞에 보물상자, 주우면 500(이 장면만 꼭 나오게 · 꼭 500 이 나오게)
    const M = window.__mjg, G = M.G, W = window
    if (i === 0) { W.__loot = M.LOOT.map(x => [...x]); M.LOOT.splice(0, M.LOOT.length, [500, 100]); W.__wp = M.WANDER.p; M.WANDER.p = 1; G.lastBox = -1e9; G.items = G.items.filter(it => it.k !== 'coinbox') }
    if (i === 12) G.anchor = [M.pl.x - 1e4, M.pl.y]   // 조금 걸은 뒤 — 다음 프레임에 가는 쪽 앞에 나온다
    const it = G.items.find(x => x.k === 'coinbox'); if (it && i > 50) { it.x += (M.pl.x - it.x) * 0.3; it.y += (M.pl.y - it.y) * 0.3 }
  }, i))
  await p.evaluate(() => { const M = window.__mjg; M.LOOT.splice(0, M.LOOT.length, ...window.__loot); M.WANDER.p = window.__wp })
  await p.evaluate(() => window.__ff(600))
  await play(150, L('몰려오는 몬스터를 스킬로 싹!'), L('레벨 업마다 스킬 · 아이템을 골라 키워요'), ['shot-b.png', 'crowd'])            // 10분 — 스킬 난무 · 레벨 업 상자
  await p.evaluate(s => { window.__pick = s }, PICK)   // 각성 상자에서 고를 카드(그 말로 쓴 이름)
  await play(150, L('보스를 쓰러뜨리면 「각성의 별」!'), L('Lv 8 스킬 하나가 각성해요'), [], i => p.evaluate(i => {   // 10분 — 고블린 대장을 쓰러뜨리면 각성의 별 → 각성 상자에서 사스마타 각성
    const M = window.__mjg, G = M.G, W = window
    if (i === 0) { const w = G.weapons.find(x => x.id === 'sasu'); G.aw.delete('sasu'); w.lv = 8; w.st = M.wstat(w); const e = W.__king = G.foes.find(f => f.kind === 'goblinKing' && !f.mid && !f.dead) || M.summon('goblinKing'); for (const f of G.foes) if (f.boss && f !== e) f.dead = true; e.x = M.pl.x + 40; e.y = M.pl.y - 180; e.hp = Math.min(e.hp, e.max * 0.3) }   // 이 장면의 보스 하나만(남은 중간보스는 조용히 치운다)
    const e = W.__king; if (!e.dead && i >= 20) e.hp = Math.min(e.hp, 1)
    G.rest = null; G.items = G.items.filter(it => it.k === 'awaken')   // 쉬는 창 · 보물상자는 건너뛰고 각성의 별만
    const it = G.items[0]; if (it && i > 50) { it.x += (M.pl.x - it.x) * 0.35; it.y += (M.pl.y - it.y) * 0.35 }   // 걸어가는 나에게 날아와 먹힌다
  }, i), 0, 'goblinKing')
  await play(120, L('각성하면 날아오는 것도 막아요!'), L('사스마타가 탄을 쳐 내요 — 스킬마다 다른 막기'), [], i => p.evaluate(i => {   // 멀리서 쏘는 적에게 둘러싸여도 각성한 사스마타가 탄을 쳐 낸다
    const M = window.__mjg, G = M.G, W = window
    if (i === 0) { W.__still = 1; W.__shown = 1; for (const f of G.foes) if (!f.boss) f.dead = true; W.__ring = [...'sososo'].map((k, j) => { const a = j / 6 * Math.PI * 2 + 0.3, e = M.spawn(k === 's' ? 'spiker' : 'octo', M.pl.x + Math.cos(a) * 210, M.pl.y + Math.sin(a) * 190); e.hp = e.max = 1e6; e.cd = 0.15 + j * 0.2; return [e, a] }) }
    for (const [e, a] of W.__ring) { e.x = M.pl.x + Math.cos(a) * 210; e.y = M.pl.y + Math.sin(a) * 190 }   // 제자리에서 쏘기만
  }, i), 1)
  console.log('awakened', await p.evaluate(() => { for (const [e] of window.__ring) e.dead = true; window.__mjg.G.eshots.length = 0; return [...window.__mjg.G.aw].join(',') }))   // 쏘던 적은 치운다
  await p.evaluate(() => { window.__ff(1203); window.__near('anoko') })
  await play(165, L('20분 — 커다란 토벌!'), L('보스 「아노코」 등장'), ['shot-c.png', 80], () => p.evaluate(() => { const e = window.__mjg.G.foes.find(f => f.kind === 'anoko' && !f.dead); if (e && e.hp < e.max * 0.4) e.hp = e.max * 0.4 }), 0.45, 'anoko')   // 아노코가 장면 안에 쓰러지지 않게                                                        // 20분 — 아노코
  await p.evaluate(() => { window.__ff(window.__mjg.FINAL_T + 1.5); window.__near('siren') })
  const split = fi / FPS
  await play(90, L('25분 — 최종보스 「세이렌」'), L('인어 셋이 지키고 있어요…'), [], null, 0.3, 'siren')                                     // 25분 — 세이렌 등장
  await p.evaluate(() => window.__ff(window.__mjg.DARK_T - 1.5, true))
  await play(240, L('29분 — 검은 별똥별까지!'), L('쓰러뜨릴 수 없어요… 그 전에 세이렌을!'), ['shot-d.png', 'won'], i => p.evaluate(i => { const s = window.__mjg.G.final?.siren; if (s) s.hp = i < 140 ? Math.max(s.hp, s.max * 0.3) : Math.min(s.hp, 1) }, i), 0.3, 'siren')   // 29분 — 검은 별똥별이 돌아다니는 사이 세이렌 격파 · 토벌 성공
  await card('end', 105)                                                                                                         // 끝 — 주소
  const total = fi / FPS
  console.log('frames', fi, 'seconds', total.toFixed(1), 'siren at', split.toFixed(1))

  // 홍보 이미지 — 위에서 찍은 게임 화면(캔버스만)을 액자에 넣는다
  const shots = ['shot-a.png', 'shot-b.png', 'shot-c.png', 'shot-d.png'].map(f => 'data:image/png;base64,' + fs.readFileSync(path.join(OUT, f)).toString('base64'))
  const imgs = await p.evaluate(async shots => {
    const L = window.__L, P = window.__promo, mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')] }
    const im = await Promise.all(shots.map(s => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = s })))
    const [A, B, C, D] = im, out = {}
    const pop = (g, cx, cy, s, rot, cap, size) => { g.save(); g.translate(cx, cy); g.rotate(rot); g.beginPath(); g.roundRect(-s / 2 - 14, -s / 2 - 14, s + 28, s + 28, 34); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 9; g.strokeStyle = P.ink; g.stroke(); P.frame(g, A, -s / 2, -s / 2, s, s, 24, 210, 430, 660, 660); P.chip(g, cap, 0, s / 2 + 12, size, '#fff3a8'); g.translate(s / 2 - 4, -s / 2 + 4); g.rotate(0.2); g.scale(s / 62, s / 62); window.__mjg.ICO.coinbox(g); g.restore() }   // 떠돌이 보물상자 500 대박 — 기울인 작은 사진 + 귀퉁이에 보물상자
    { // 정사각 1080 — 인스타 피드 · 카카오
      const [c, g] = mk(1080, 1080); P.field(g, 1080, 1080, 5)
      P.text(g, L('비공식 팬게임 · 무료'), 1050, 56, 30, '#fff', 8, 'right')
      P.logo(g, L('먼작귀'), 540, 200, 150, '#fff'); P.logo(g, L('서바이버즈'), 540, 305, 88, '#ff8fab')
      P.text(g, L('먼가 작고 귀여운 녀석들의 토벌 생존기'), 540, 362, 34)
      P.frame(g, B, 90, 392, 900, 560, 40, 0, 640, 1080, 672)
      P.put(g, 'chiikawa', 120, 1040, 4.6, { look: 1.2 }); P.put(g, 'hachiware', 965, 1040, 4.6, { look: 1.2 })
      pop(g, 830, 560, 270, 0.08, L('돌아다니면 보물상자!'), 30)
      P.chip(g, L('chii-ka-wa.github.io'), 540, 1010, 40, '#fff')
      out.square = c.toDataURL('image/png')
    }
    { // 세로 1080×1920 — 스토리 · 릴스 · 숏츠 표지
      const [c, g] = mk(1080, 1920); P.field(g, 1080, 1920, 9)
      P.text(g, L('비공식 팬게임 · 무료 · 설치 없이 브라우저에서'), 540, 100, 36, '#fff', 9)
      P.logo(g, L('먼작귀'), 540, 330, 200, '#fff'); P.logo(g, L('서바이버즈'), 540, 470, 118, '#ff8fab')
      P.text(g, L('먼가 작고 귀여운 녀석들의 토벌 생존기'), 540, 552, 44)
      P.frame(g, D, 70, 600, 940, 1040, 48, 0, 380, 1080, 1195)
      pop(g, 265, 1420, 300, -0.08, L('돌아다니면 보물상자!'), 34)
      P.lineup(g, P.IDS, 540, 1800, 124, 4.4)
      P.chip(g, L('chii-ka-wa.github.io'), 540, 1862, 40, '#fff')
      out.story = c.toDataURL('image/png')
    }
    { // 가로 1600×900 — X · 페이스북 · 블로그
      const [c, g] = mk(1600, 900); P.field(g, 1600, 900, 13)
      P.logo(g, L('먼작귀'), 560, 240, 170, '#fff'); P.logo(g, L('서바이버즈'), 560, 360, 100, '#ff8fab')
      P.text(g, L('먼가 작고 귀여운 녀석들의 토벌 생존기'), 560, 432, 38)
      { const tags = [[L('무료'), '#fff3a8'], [L('설치 없이 브라우저에서'), '#ffd6e2'], [L('PC · 휴대폰'), '#d6ecff']], gap = 16; g.font = `32px ${window.__FAM}`; const ws = tags.map(([s]) => g.measureText(s).width + 32 * 1.4); let x = 560 - (ws.reduce((a, w) => a + w, 0) + gap * (tags.length - 1)) / 2; tags.forEach(([s, bg], i) => { P.chip(g, s, x + ws[i] / 2, 515, 32, bg); x += ws[i] + gap }) }   // 글자 폭대로 나란히
      P.chip(g, L('chii-ka-wa.github.io'), 560, 615, 48, '#fff')
      P.lineup(g, ['chiikawa', 'hachiware', 'usagi', 'momonga', 'kani'], 560, 860, 150, 4.2)
      g.beginPath(); g.roundRect(1110, 50, 400, 800, 64); g.fillStyle = P.ink; g.fill()   // 휴대폰 속 게임 화면
      P.frame(g, B, 1128, 68, 364, 764, 48, 150, 190, 780, 1637)   // 가운데를 조금 당겨 크게
      pop(g, 1075, 680, 230, -0.1, L('돌아다니면 보물상자!'), 26)
      P.text(g, L('비공식 팬게임'), 1580, 40, 26, '#fff', 7, 'right')
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
    console.log(path.relative(ROOT, path.join(OUT, 'shorts.mp4')))
  }
  console.log(path.relative(ROOT, OUT) + '/promo-square.png · promo-story.png · promo-wide.png')
})()
