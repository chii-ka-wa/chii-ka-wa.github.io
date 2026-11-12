// 먼작귀 서바이버즈 — 뱀파이어 서바이버즈류 비공식 팬게임.
//   덩크 서바이버(nba-kor.github.io/survive)의 게임 규칙만 가져와 먼작귀 세계로 옮겼다(그림 · 캐릭터는 새로).
//   몰려오는 토벌 대상(고블린 · 키메라)을 피해 다니면 스킬은 알아서 나간다. FINAL_T 에 최종보스 세이렌(+인어 셋) — 쓰러뜨리면 클리어.
//   레벨 업마다 랜덤 상자(셋 중 하나 · 리롤 · 스킵 · 제외 · 1% 잭팟), 스킬 Lv 8 · 아이템 Lv 5, 짝 스킬을 모으면 시너지.
//   그림은 캔버스 하나에 코드로(처음에 한 번 그려 두고 옮겨 그린다). 메뉴 · 상자는 캔버스 위에 겹친 HTML(#ui). 기록은 이 브라우저(localStorage)에만.

const TAU = Math.PI * 2, rnd = Math.random
const clamp = (v, a, b) => v < a ? a : v > b ? b : v
const fmt = s => `${String(s / 60 | 0).padStart(2, '0')}:${String(s % 60 | 0).padStart(2, '0')}`
const pickOf = a => a[rnd() * a.length | 0]
const VIEW = 560          // 화면의 짧은 쪽에 보이는 월드 크기 — 휴대폰을 세워도 눕혀도 둘레가 이만큼은 보인다
const MAX_FOES = 320      // 한 화면 적 수 한도 — 휴대폰 그리기 비용
const FINAL_T = 25 * 60   // 최종보스 세이렌이 나오는 때

// ---------------------------------------------------------------- 표

// 캐릭터 — w 시작 스킬, mod 고유 특성
const CHARS = [
  { id: 'chiikawa', name: '치이카와', w: 'sasu', hp: 100, trait: '울보 근성', note: '체력이 절반 아래면 공격력 +30% · 경험치 +10%', mod: { clutch: 0.3, growth: 0.1 } },
  { id: 'hachiware', name: '하치와레', w: 'guitar', hp: 110, trait: '어떻게든 되라!', note: '행운 +20% · 잭팟 확률 2배 · 리롤 · 스킵 · 제외 +1', mod: { luck: 0.2, jackpot: 1, boxes: 1 } },
  { id: 'usagi', name: '우사기', w: 'stick', hp: 100, trait: '야하!', note: '이동 속도 +20% · 공격력 +10%', mod: { move: 0.2, might: 0.1 } },
  { id: 'momonga', name: '모몽가', w: 'momo', hp: 90, trait: '내 거야!', note: '보스 · 정예에게 주는 피해 +30% · 이동 속도 +15%', mod: { bossX: 0.3, move: 0.15 } },
  { id: 'kurimanju', name: '쿠리만쥬', w: 'kanpai', hp: 130, trait: '캬아~', note: '받는 피해 -2 · 초당 체력 0.5 회복 · 경험치 줍는 거리 +30%', mod: { armor: 2, regen: 0.5, magnet: 0.3 } },
  { id: 'rakko', name: '랏코', w: 'sword', hp: 120, trait: '토벌 랭킹 1위', note: '치명타 확률 +15% · 치명타 피해 2.5배', mod: { crit: 0.15, critX: 0.5 } },
  { id: 'kani', name: '카니', w: 'sasu', hp: 110, trait: '헌책방 주인', note: '범위 +20% · 투사체 속도 +20%', mod: { area: 0.2, speed: 0.2 } },
  { id: 'shisa', name: '시사', w: 'ramen', hp: 110, trait: '라멘집 수행 중', note: '경험치 +25% · 쿨타임 -5% · 지속 시간 +15%', mod: { growth: 0.25, cdr: 0.05, dur: 0.15 } },
]

// 스킬 — cd 쿨타임(초) · dmg 피해 · n 개수 · area 크기 배수 · spd 속도 배수 · dur 지속(초) · pierce 꿰뚫는 수. ups[i] = 레벨 i+2 가 될 때 더하는 것(최고 Lv 8)
const WEAP = {
  sasu: { name: '사스마타 찌르기', icon: '🔱', note: '가장 가까운 적에게 사스마타를 찔러 넣는다 — 꿰뚫는다', cd: 1.1, dmg: 11, pierce: 2, ups: [{ n: 1 }, { dmg: 5 }, { cd: -0.2 }, { n: 1 }, { dmg: 6 }, { pierce: 2 }, { dmg: 10 }] },
  stick: { name: '토벌봉', icon: '💥', note: '봉을 휘두르면 양 끝에서 폭발이 일어난다(두 번째는 위아래로)', cd: 1.5, dmg: 13, ups: [{ dmg: 5 }, { area: 0.15 }, { cd: -0.25 }, { dmg: 6 }, { area: 0.2 }, { n: 1 }, { dmg: 10 }] },
  yaha: { name: '야하!', icon: '🐰', note: '높이 뛰어올라 내려찍으면 둘레에 충격파 — 밀쳐 낸다', cd: 3.2, dmg: 26, ups: [{ area: 0.15 }, { dmg: 10 }, { cd: -0.5 }, { area: 0.15 }, { dmg: 12 }, { n: 1 }, { dmg: 18, area: 0.15 }] },
  ura: { name: '우라!', icon: '📢', note: '기합을 계속 질러 둘레의 적에게 피해를 준다', cd: 0.45, dmg: 4, ups: [{ area: 0.1 }, { dmg: 1 }, { area: 0.1 }, { cd: -0.08 }, { dmg: 2 }, { area: 0.1 }, { dmg: 2 }] },
  weed: { name: '풀뽑기', icon: '🌱', note: '풀뽑기 검정 5급의 솜씨 — 적 발밑의 풀을 뽑아 터뜨린다', cd: 2.6, dmg: 18, n: 2, ups: [{ n: 1 }, { dmg: 6 }, { area: 0.2 }, { n: 1 }, { cd: -0.5 }, { n: 1 }, { dmg: 12 }] },
  tears: { name: '와아… (울음)', icon: '💧', note: '눈물이 높이 튀어 멀리 떨어진 자리를 적신다', cd: 2.2, dmg: 22, ups: [{ n: 1 }, { area: 0.2 }, { dmg: 10 }, { n: 1 }, { cd: -0.4 }, { dmg: 12 }, { n: 1, area: 0.2 }] },
  guitar: { name: '하치와레의 기타', icon: '🎸', note: '음표가 몸 둘레를 돌며 적을 쳐 낸다', cd: 2.2, dmg: 9, n: 2, dur: 3.2, ups: [{ n: 1 }, { area: 0.15, spd: 0.25 }, { dmg: 3 }, { n: 1 }, { dur: 1 }, { n: 1 }, { dmg: 4, dur: 1 }] },
  nantoka: { name: '어떻게든 되라!', icon: '⭐', note: '화면 안 적에게 별이 번개처럼 꽂힌다', cd: 2.8, dmg: 20, n: 2, ups: [{ n: 1 }, { dmg: 8 }, { area: 0.25 }, { n: 1 }, { cd: -0.5 }, { n: 1 }, { dmg: 14 }] },
  ramen: { name: '라멘 국물', icon: '🍜', note: '근처 바닥에 뜨거운 국물을 쏟아 밟은 적을 느리게 하고 데운다', cd: 4, dmg: 6, dur: 2.5, ups: [{ n: 1 }, { dmg: 2 }, { dur: 1 }, { area: 0.15 }, { n: 1 }, { dmg: 3 }, { dur: 1, area: 0.15 }] },
  curry: { name: '극매운 카레', icon: '🍛', note: '적이 몰린 곳에 카레 냄비 — 1초 뒤 매운 폭발. 인어 · 세이렌에게 1.5배', cd: 3.2, dmg: 22, ups: [{ dmg: 7 }, { area: 0.15 }, { n: 1 }, { cd: -0.4 }, { dmg: 9 }, { area: 0.15 }, { n: 1, dmg: 10 }] },
  pochette: { name: '포셰트 부메랑', icon: '👜', note: '던지면 되돌아오는 포셰트 — 오가며 계속 맞힌다', cd: 1.8, dmg: 10, ups: [{ dmg: 4 }, { n: 1 }, { area: 0.25 }, { dmg: 5 }, { n: 1 }, { spd: 0.3 }, { n: 1 }] },
  momo: { name: '내놔!', icon: '🤲', note: '가장 강한 적(보스 · 정예 먼저)에게 달려들어 낚아채는 큰 한 방', cd: 1.9, dmg: 38, ups: [{ dmg: 14 }, { n: 1 }, { cd: -0.3 }, { dmg: 18 }, { n: 1 }, { cd: -0.3 }, { dmg: 30 }] },
  kanpai: { name: '건배!', icon: '🍻', note: '잔이 맞은 적에서 옆 적으로 튕겨 가며 부딪친다', cd: 1.6, dmg: 9, pierce: 1, bounce: 3, ups: [{ bounce: 1 }, { dmg: 4 }, { n: 1 }, { bounce: 2 }, { dmg: 5 }, { cd: -0.3 }, { bounce: 2, dmg: 6 }] },
  sword: { name: '랏코 선생의 일섬', icon: '⚔️', note: '화면을 가로지르는 칼바람 — 줄 위의 적을 모두 벤다', cd: 2.4, dmg: 20, ups: [{ dmg: 7 }, { area: 0.25 }, { n: 1 }, { cd: -0.4 }, { dmg: 9 }, { area: 0.25 }, { n: 1, dmg: 10 }] },
}
const UP = { n: v => `개수 +${v}`, dmg: v => `피해 +${v}`, cd: v => `쿨타임 ${v}초`, area: v => `범위 +${Math.round(v * 100)}%`, spd: v => `속도 +${Math.round(v * 100)}%`, dur: v => `지속 +${v}초`, pierce: v => `관통 +${v}`, bounce: v => `튕김 +${v}` }
// 시너지 — 짝인 두 스킬을 다 가지면 둘 다 세진다(wstat). 스킬마다 짝은 하나
const SYN = [
  ['랏코 선생의 수련', { sasu: { pierce: 1, dmg: 5 }, sword: { n: 1 } }],
  ['우사기 폭주', { stick: { area: 0.2, dmg: 5 }, yaha: { area: 0.2, dmg: 10 } }],
  ['기합 폭발', { ura: { area: 0.2 }, nantoka: { n: 1 } }],
  ['울면서 풀뽑기', { weed: { n: 1 }, tears: { n: 1 } }],
  ['섬 맛집 투어', { ramen: { n: 1, dur: 1 }, curry: { area: 0.2 } }],
  ['하치와레의 꿈', { guitar: { n: 1 }, pochette: { n: 1 } }],
  ['안주 내놔!', { momo: { n: 1 }, kanpai: { bounce: 2, dmg: 3 } }],
]
const synOf = id => SYN.find(s => id in s[1])
const mateOf = id => Object.keys(synOf(id)[1]).find(k => k !== id)
const synText = ([, u]) => Object.entries(u).map(([id, up]) => `${WEAP[id].name} ${Object.entries(up).map(([k, v]) => UP[k](v)).join(' · ')}`).join(' / ')

// 아이템(지니면 계속 듣는 것) — 레벨마다 note 만큼
const PASS = {
  license: { name: '토벌 자격증', icon: '📜', note: '공격력 +10%', max: 5 },
  armor: { name: '갑옷씨의 갑옷', icon: '🛡️', note: '받는 피해 -1', max: 5 },
  manju: { name: '군고구마', icon: '🍠', note: '최대 체력 +20%', max: 5 },
  pudding: { name: '푸딩', icon: '🍮', note: '초당 체력 +0.2 회복', max: 5 },
  clock: { name: '알람 시계', icon: '⏰', note: '쿨타임 -8%', max: 5 },
  mega: { name: '메가폰', icon: '📣', note: '범위 +10%', max: 5 },
  slipper: { name: '잠옷 슬리퍼', icon: '🥿', note: '이동 속도 +10%', max: 5 },
  wind: { name: '모몽가의 날갯짓', icon: '💨', note: '투사체 속도 +10%', max: 5 },
  bento: { name: '도시락', icon: '🍱', note: '지속 시간 +10%', max: 5 },
  double: { name: '둘이서 같이', icon: '🤝', note: '모든 스킬 투사체 +1', max: 2 },
  pouch: { name: '큰 주머니', icon: '👝', note: '경험치 줍는 거리 +30%', max: 5 },
  clover: { name: '네잎클로버', icon: '🍀', note: '행운 +10% (잭팟 · 치명타 · 떨어지는 것)', max: 5 },
  wage: { name: '토벌 보수', icon: '💰', note: '경험치 +8%', max: 5 },
}
const FILL = { onigiri: { name: '오니기리', icon: '🍙', note: '체력 40% 회복' }, cheer: { name: '응원', icon: '🎉', note: '이번 판 공격력 +2% (최대 +50%)' } }   // 더 올릴 게 없을 때
// 줍는 것 — 적이 떨어뜨린다(USE)
const ITEMS = {
  onigiri: { name: '오니기리', icon: '🍙', note: '체력 30% 회복' },
  magnet: { name: '자석', icon: '🧲', note: '흩어진 경험치를 모두 끌어온다' },
  momonga: { name: '모몽가의 귀여운 척', icon: '🐿️', note: '모두가 넋을 잃어 6초 동안 적이 멈춘다' },
  firework: { name: '폭죽', icon: '🎆', note: '화면 안의 적을 모두 쓰러뜨린다(보스는 큰 피해)' },
  earplug: { name: '귀마개', icon: '🎧', note: '상태이상을 모두 푼다(걸린 게 없으면 체력 15%) — 10분부터' },
  chest: { name: '보물상자', icon: '🎁', note: '보스가 떨어뜨린다 — 잭팟 확률 50%' },
}

// 토벌 대상 — r 몸 반지름 · hp(시간이 갈수록 세진다) · spd 이동 · dmg 닿으면 · xp 떨어뜨리는 경험치 · col 터질 때 색
const FOES = {
  goblin: { name: '고블린', note: '가장 흔한 토벌 대상 — 줄지어 다가온다', r: 12, hp: 9, spd: 62, dmg: 7, xp: 1, col: '#8fc46e' },
  chimera: { name: '꼬마 키메라', note: '1분부터 — 웃으면서 우는 작은 키메라(붉은 발톱). 빠르고, 가끔 떼로 둘러싼다', r: 10, hp: 5, spd: 95, dmg: 5, xp: 1, col: '#ddd5ea' },
  dekatsu: { name: '분홍 키메라', note: '4분부터 — 네 발로 걷는 어른 키메라. 느리지만 단단하고 아프다 · 밀리지 않는다', r: 18, hp: 52, spd: 47, dmg: 10, xp: 3, col: '#efb3c8' },
  spiker: { name: '가면 키메라', note: '6분부터 — 곤충 날개 · 기괴한 가면. 멀리서 독침을 쏜다', r: 12, hp: 18, spd: 57, dmg: 7, xp: 2, col: '#7d8a6a' },
  golden: { name: '황금 고블린', note: '가끔 나오는 정예 — 쓰러뜨리면 가끔 아이템', r: 22, hp: 420, spd: 55, dmg: 16, xp: 25, col: '#ffd34d' },
  rusher: { name: '고블린 돌격대', note: '10분부터 — 줄지어 화면을 가로지른다. 스킬에 안 맞으니 빈 줄로 피하기', r: 11, hp: 14, spd: 0, dmg: 14, xp: 1, col: '#c9e29a' },
  // 보스(BOSS) — 피는 시간에 따라 완만하게, 대신 서 있으면 맞는 기술을 쓴다
  dekatsuyo: { r: 32, hp: 1300, spd: 66, dmg: 22, xp: 120, col: '#5e5068' },
  goblinKing: { r: 30, hp: 1100, spd: 60, dmg: 18, xp: 120, col: '#86b85f' },
  bigChimera: { r: 36, hp: 1400, spd: 50, dmg: 24, xp: 120, col: '#c9b8e0' },
  mermaid: { r: 14, hp: 500, spd: 70, dmg: 14, xp: 60, col: '#ff9fb5' },
  anoko: { r: 34, hp: 1500, spd: 62, dmg: 22, xp: 150, col: '#f3ece4' },
  siren: { r: 40, hp: 2800, spd: 55, dmg: 26, xp: 400, col: '#ee4a3c' },
}
// line = 나올 때 외치는 말, st = 거는 상태이상(stCd 초마다, 중간보스는 안 건다)
const BOSS = {
  dekatsuyo: { name: '데카츠요', line: '쿵… 쿵…!', note: '「뭔가 크고 강한 녀석」 — 멈칫(갈 길이 붉게)한 뒤 그 방향으로 돌진. 옆으로 피하기' },
  goblinKing: { name: '고블린 대장', line: '쳐라, 쳐!', note: '돌을 부채꼴로 던지고 부하를 불러 에워싼다 · 약화를 건다', st: 'weak', stCd: 30 },
  bigChimera: { name: '거대 키메라', line: '헤헤… 흑…', note: '웃으면서 우는 거대한 키메라 — 뛰어올라 내 자리에 내려찍는다. 붉은 원에서 벗어나기' },
  anoko: { name: '아노코', line: '…!!', note: '「커다란 토벌」의 대상 — 돌진하고 · 용 같은 꼬리로 둘레를 휩쓸고(청록 원) · 꼬깔콘 같은 발톱을 던진다' },
  mermaid: { name: '인어', line: '라~♪', note: '세이렌의 코러스 — 곁을 돌다가 날카로운 이빨로 달려들어 문다. 살아 있는 동안 세이렌은 받는 피해 -50%' },
  siren: { name: '세이렌', line: '내 노래를 들어 봐…', note: '노래(매혹)로 끌어당기고 · 음표를 사방으로 · 땅에서 덩굴 · 큰 꼬리로 내려치기. 체력이 절반 아래면 눈이 붉어지고 더 빨라진다', st: 'charm', stCd: 14 },
}
// 보스가 나오는 때 — [초, 종류, 중간보스면 1]. FINAL_T 에 세이렌 + 인어 셋(finale)
const PLAN = [[300, 'dekatsuyo'], [450, 'goblinKing', 1], [600, 'goblinKing'], [750, 'bigChimera', 1], [900, 'bigChimera'], [1020, 'dekatsuyo', 1], [1140, 'goblinKing', 1], [1200, 'anoko'],
  [1320, 'bigChimera', 1], [1380, 'goblinKing'], [1440, 'bigChimera']]
const STATUS = {
  weak: { name: '약화', note: '주는 피해 -40%', col: '#ff9f43' },
  charm: { name: '매혹', note: '이동 속도 -40% · 세이렌 쪽으로 끌려간다', col: '#ff6fd0' },
}
const ST_T = 8   // 상태이상 지속(초)

// ---------------------------------------------------------------- 저장 — 이 브라우저(localStorage)에만
const LS = 'mjg.v1'
const save = { runs: 0, kills: 0, clears: 0, best: {} }   // best[캐릭터] = { t 가장 오래 버틴 초, kills, lvl, clears }
try { Object.assign(save, JSON.parse(localStorage.getItem(LS)) || {}) } catch {}
const persist = () => { try { localStorage.setItem(LS, JSON.stringify(save)) } catch {} }

function h(tag, props, ...kids) {
  const e = document.createElement(tag)
  for (const k in props || {}) { const v = props[k]; if (v == null || v === false) continue; if (k.startsWith('on')) e[k] = v; else if (k === 'class') e.className = v; else e.setAttribute(k, v) }
  for (const k of kids.flat(9)) if (k != null && k !== false) e.append(k instanceof Node ? k : String(k))
  return e
}

// ---------------------------------------------------------------- 그림 — 코드로 그린 캐릭터(발밑이 0, 0)
// 생김새는 공식 일러스트(찹쌀떡 같은 한 덩어리 몸 · 뭉툭한 팔다리 · 점 눈 · 빗금 볼터치 · 작은 고양이 입)와 나무위키 「먼작귀/등장인물」 설명을 따랐다.
// 그리는 함수는 모두 (g, p) — p = 자세 { foot 발(-1 · 0 · 1), arm 팔, bob 몸 들썩임, blink 눈 감기, hurt 아픈 얼굴, look 얼굴을 보는 쪽으로 }. 걷기 · 숨 · 아픈 얼굴은 이 자세로 미리 따로 그려 둔다
const OUT = '#4a3b35', FONT = '"Jua", system-ui, sans-serif', EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'
function blob(g, x, y, rx, ry, fill, lw = 1.4) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fillStyle = fill; g.fill(); g.lineWidth = lw; g.strokeStyle = OUT; g.stroke() }
function eyes(g, y, gap = 4.6, r = 1.8, shine = true) {   // 적 · 보스용 점 눈
  for (const s of [-1, 1]) {
    g.fillStyle = '#2b211d'; g.beginPath(); g.ellipse(s * gap, y, r * 0.9, r * 1.15, 0, 0, TAU); g.fill()
    if (shine) { g.fillStyle = '#fff'; g.beginPath(); g.arc(s * gap - r * 0.3, y - r * 0.4, r * 0.38, 0, TAU); g.fill() }
  }
}
function blush(g, y, gap = 8, k = 1) { g.fillStyle = 'rgba(255,130,155,.6)'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * gap, y, 2.4 * k, 1.3 * k, 0, 0, TAU); g.fill() } }
function smile(g, y) { g.strokeStyle = OUT; g.lineWidth = 1; g.beginPath(); g.moveTo(-1.8, y); g.quadraticCurveTo(-0.9, y + 1, 0, y); g.quadraticCurveTo(0.9, y + 1, 1.8, y); g.stroke() }
/** 먼작귀 눈 — 점(하이라이트) · 깜빡이면 감은 눈 · 아프면 > < 와 눈물 */
function dotEyes(g, y, gap, r, p, shine = true) {
  g.strokeStyle = OUT; g.lineCap = 'round'
  for (const s of [-1, 1]) {
    const x = s * gap
    if (p.hurt) {
      g.lineWidth = 1.1; g.beginPath(); g.moveTo(x - s * 1.4, y - 1.3); g.lineTo(x + s * 1.1, y); g.lineTo(x - s * 1.4, y + 1.3); g.stroke()
      g.fillStyle = '#8fd0ff'; g.beginPath(); g.ellipse(x + s * 2, y + 2, 0.8, 1.3, 0, 0, TAU); g.fill()
    } else if (p.blink) { g.lineWidth = 1; g.beginPath(); g.moveTo(x - r, y); g.quadraticCurveTo(x, y + r, x + r, y); g.stroke() }
    else {
      g.fillStyle = '#2b211d'; g.beginPath(); g.ellipse(x, y, r * 0.85, r * 1.05, 0, 0, TAU); g.fill()
      if (shine) { g.fillStyle = '#fff'; g.beginPath(); g.arc(x - r * 0.28, y - r * 0.38, r * 0.36, 0, TAU); g.fill() }
    }
  }
}
/** 빗금 볼터치 — 분홍 타원에 /// */
function hatch(g, y, gap, k = 1) {
  for (const s of [-1, 1]) {
    g.fillStyle = 'rgba(255,140,165,.5)'; g.beginPath(); g.ellipse(s * gap, y, 2.8 * k, 1.5 * k, 0, 0, TAU); g.fill()
    g.strokeStyle = 'rgba(225,85,115,.8)'; g.lineWidth = 0.5; g.beginPath()
    for (let i = -1; i <= 1; i++) { const x = s * gap + i * 1.15 * k; g.moveTo(x - 0.45 * k, y + 0.75 * k); g.lineTo(x + 0.45 * k, y - 0.75 * k) }
    g.stroke()
  }
}
/** 작은 고양이 입 — ω 아래로 조금 벌린 입(open 이 크면 크게) */
function catMouth(g, y, open = 1) {
  g.strokeStyle = OUT; g.lineWidth = 0.9; g.lineCap = 'round'
  g.beginPath(); g.moveTo(-1.7, y); g.quadraticCurveTo(-0.85, y + 0.9, 0, y); g.quadraticCurveTo(0.85, y + 0.9, 1.7, y); g.stroke()
  if (!open) return
  const P = new Path2D(); P.moveTo(-open, y + 0.55); P.quadraticCurveTo(0, y + 0.35, open, y + 0.55); P.quadraticCurveTo(0.6 * open, y + 2.4 * open, 0, y + 2.4 * open); P.quadraticCurveTo(-0.6 * open, y + 2.4 * open, -open, y + 0.55)
  g.fillStyle = '#e66a7a'; g.fill(P); g.stroke(P)
}
function heart(g, x, y, r, col) { g.beginPath(); g.moveTo(x, y + r * 1.1); g.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.8, y - r * 1.3, x, y - r * 0.5); g.bezierCurveTo(x + r * 0.8, y - r * 1.3, x + r * 1.6, y - r * 0.2, x, y + r * 1.1); g.fillStyle = col; g.fill() }
function fluffOval(g, cx, cy, rx, ry, rot, fill, n = 28) {   // 복슬한 타원(꼬리)
  g.save(); g.translate(cx, cy); g.rotate(rot); blob(g, 0, 0, rx, ry, fill, 1.2)
  g.strokeStyle = 'rgba(74,59,53,.55)'; g.lineWidth = 0.8; g.beginPath()
  for (let i = 0; i < n; i++) { const a = i / n * TAU, x = Math.cos(a) * rx, y = Math.sin(a) * ry, L = i % 2 ? 1.5 : 0.9; g.moveTo(x, y); g.lineTo(x * (1 + L / rx), y * (1 + L / ry)) }
  g.stroke(); g.restore()
}
// 찹쌀떡 몸 — 위가 둥글고 넓고 아래로 살짝 좁아지는 한 덩어리(베지에 넷)
function mochiSegs(W, H) { const hw = W / 2, b = -2.5, t = b - H, m = t + H * 0.46; return [[0, t, hw * 0.78, t, hw, t + H * 0.17, hw, m], [hw, m, hw, m + H * 0.4, hw * 0.7, b, 0, b], [0, b, -hw * 0.7, b, -hw, m + H * 0.4, -hw, m], [-hw, m, -hw, t + H * 0.17, -hw * 0.78, t, 0, t]] }
function segPath(S) { const P = new Path2D(); P.moveTo(S[0][0], S[0][1]); for (const s of S) P.bezierCurveTo(s[2], s[3], s[4], s[5], s[6], s[7]); P.closePath(); return P }
function fluff(g, S, cy, n = 46) {   // 복슬복슬한 테두리 — 바깥으로 짧은 털(옅게)
  g.strokeStyle = 'rgba(74,59,53,.45)'; g.lineWidth = 0.8; g.beginPath()
  for (let i = 0; i < n; i++) {
    const u = i / n * 4, k = u | 0, t = u - k, q = 1 - t, [x0, y0, x1, y1, x2, y2, x3, y3] = S[k]
    const x = q * q * q * x0 + 3 * q * q * t * x1 + 3 * q * t * t * x2 + t * t * t * x3, y = q * q * q * y0 + 3 * q * q * t * y1 + 3 * q * t * t * y2 + t * t * t * y3
    const dx = x, dy = y - cy, d = Math.hypot(dx, dy) || 1, L = i % 2 ? 1.6 : 1
    g.moveTo(x, y); g.lineTo(x + dx / d * L, y + dy / d * L)
  }
  g.stroke()
}
/** o: W · H 몸 크기, fur 털, limb 발(· 팔) 색, armFill 팔 색, arms 'cheek'(볼에 손) | 'none', fluffy 복슬 테두리, back 몸 뒤(귀 · 꼬리), cap 몸 안 무늬(몸 밖으로 안 나간다), face, front 몸 앞 */
function mochi(g, o, p = {}) {
  const W = o.W || 27, H = o.H || 24, S = mochiSegs(W, H), P = segPath(S), foot = p.foot || 0, arm = p.arm || 0, limb = o.limb || o.fur
  for (const s of [-1, 1]) { const lift = Math.max(0, s * foot); blob(g, s * (4.6 + lift * 0.4), -1.4 - lift * 1.8, 3, 2, limb, 1.2) }   // 발 — 걸을 때 번갈아 든다
  g.save(); g.translate(0, p.bob || 0)
  o.back?.(g, p)
  g.fillStyle = o.fur; g.fill(P)
  if (o.cap) { g.save(); g.clip(P); o.cap(g, p); g.restore() }
  g.lineWidth = 1.4; g.strokeStyle = OUT; g.stroke(P)
  if (o.fluffy) fluff(g, S, -2.5 - H / 2)
  const af = o.armFill || limb
  if (o.arms === 'cheek') for (const s of [-1, 1]) { g.save(); g.translate(s * 9.6, -10.6 - s * arm * 0.6); g.rotate(s * -0.6); blob(g, 0, 0, 2, 2.6, af, 1.2); g.restore() }   // 볼 아래에 댄 두 손
  else if (o.arms !== 'none') for (const s of [-1, 1]) { g.save(); g.translate(s * (W / 2 - 0.8), -2.5 - H * 0.32 - s * arm * 1.5); g.rotate(s * (0.55 + s * arm * 0.25)); blob(g, 0, 0, 2.1, 3, af, 1.2); g.restore() }   // 팔 — 발과 엇갈려 흔든다
  g.save(); g.translate(p.look || 0, 0); o.face(g, p); g.restore()
  o.front?.(g, p)
  g.restore()
}
// 치이카와 — 하얀 찹쌀떡 · 둥근 귀 · 짧은 눈썹
function chiikawa(g, p) {
  mochi(g, {
    fur: '#fff',
    back: g => { for (const s of [-1, 1]) blob(g, s * 7.6, -25, 3.4, 3.4, '#fff') },
    face: (g, p) => {
      if (!p.hurt) { g.strokeStyle = OUT; g.lineWidth = 0.9; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 4, -20); g.lineTo(s * 6.5, -19.4); g.stroke() } }
      dotEyes(g, -16, 5.2, 1.5, p); hatch(g, -12.6, 8.6); catMouth(g, -13.4, p.hurt ? 1.4 : 0.8)
    },
  }, p)
}
// 하치와레 — 하양 · 파란 고양이 귀와 머리 무늬(가운데가 八 모양으로 갈라진 5대5 가르마) · 아래로 말려 올라간 파란 꼬리
function hachiware(g, p) {
  const blue = '#7aa3d6'
  mochi(g, {
    fur: '#fff',
    back: g => {
      g.beginPath(); g.moveTo(8, -4.6); g.quadraticCurveTo(14.2, -5.4, 13.6, -10.6); g.quadraticCurveTo(12, -8.4, 9, -8.4); g.closePath(); g.fillStyle = blue; g.fill(); g.lineWidth = 1.2; g.strokeStyle = OUT; g.stroke()
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 3.8, -25.6); g.lineTo(s * 11.8, -30.8); g.lineTo(s * 12.8, -20.4); g.closePath(); g.fillStyle = blue; g.fill(); g.lineWidth = 1.4; g.strokeStyle = OUT; g.stroke() }
    },
    cap: g => { g.fillStyle = blue; g.beginPath(); g.moveTo(-15, -17.4); g.quadraticCurveTo(-8, -19.4, -3.2, -19.8); g.lineTo(0, -26); g.lineTo(3.2, -19.8); g.quadraticCurveTo(8, -19.4, 15, -17.4); g.lineTo(15, -30); g.lineTo(-15, -30); g.fill() },
    face: (g, p) => { dotEyes(g, -15.4, 5.2, 1.7, p); hatch(g, -12.2, 8.6); catMouth(g, -12.8, p.hurt ? 1.4 : 1.1) },
  }, p)
}
// 우사기 — 크림 노랑 · 달걀처럼 조금 긴 몸 · 붙어 선 긴 귀(안쪽 분홍) · 길게 둥근 눈썹 · 아래 왼쪽의 흰 복슬 꼬리
function usagi(g, p) {
  const fur = '#f8e6a6'
  mochi(g, {
    fur, W: 24, H: 27,
    back: g => {
      fluffOval(g, -10.6, -5.4, 2.6, 2.4, 0, '#fff', 12)
      for (const s of [-1, 1]) { g.save(); g.translate(s * 2.8, -35); g.rotate(s * 0.08); blob(g, 0, 0, 2.2, 9.5, fur); g.fillStyle = '#f9b8c4'; g.beginPath(); g.ellipse(0, 0.6, 1, 7, 0, 0, TAU); g.fill(); g.restore() }
    },
    face: (g, p) => {
      if (!p.hurt) { g.strokeStyle = OUT; g.lineWidth = 0.9; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 1.6, -22.8); g.quadraticCurveTo(s * 6.8, -24.2, s * 8.6, -17.6); g.stroke() } }
      dotEyes(g, -16, 4.6, 1.5, p); hatch(g, -12.6, 8); catMouth(g, -13.6, p.hurt ? 1.5 : 1.2)
    },
  }, p)
}
// 시사 — 크림색 · 둥근 귀 · 옆에만 난 곱슬 갈기 · 하트 모양 눈썹 · 빨간 알로하 셔츠 · 아래로 말린 꼬리
function shisa(g, p) {
  const fur = '#fcefd6', mane = '#d9937a', shirt = '#e0504a'
  mochi(g, {
    fur, H: 25, armFill: shirt,
    back: g => {
      g.strokeStyle = OUT; g.lineWidth = 1.2; g.beginPath(); g.arc(1.6, 0.4, 1.8, Math.PI, Math.PI * 2.6); g.fillStyle = mane; g.fill(); g.stroke()
      for (const s of [-1, 1]) { blob(g, s * 7.6, -26.6, 3.2, 3, fur); g.strokeStyle = OUT; g.lineWidth = 0.7; g.beginPath(); g.arc(s * 7.6, -26.2, 1.4, Math.PI * 1.1, Math.PI * 1.9); g.stroke() }
      for (const s of [-1, 1]) for (let k = 0; k < 5; k++) blob(g, s * (12.8 - Math.abs(k - 1.5) * 0.6), -24.5 + k * 3.4, 3, 2.8, mane, 1.1)
    },
    cap: g => {   // 알로하 셔츠 — 가운데가 열린 깃 · 흰 꽃무늬
      g.fillStyle = shirt; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 15, -10.8); g.lineTo(s * 3.2, -10.8); g.lineTo(s * 1.2, -2); g.lineTo(s * 15, -2); g.fill() }
      g.fillStyle = '#fff'; for (const [x, y] of [[-9, -7.5], [-5, -4.5], [6.5, -7], [9.5, -4]]) for (let i = 0; i < 4; i++) { const a = i / 4 * TAU; g.beginPath(); g.arc(x + Math.cos(a) * 0.9, y + Math.sin(a) * 0.9, 0.6, 0, TAU); g.fill() }
      g.strokeStyle = OUT; g.lineWidth = 0.9; g.beginPath(); for (const s of [-1, 1]) { g.moveTo(s * 15, -10.8); g.lineTo(s * 3.2, -10.8); g.lineTo(s * 1.2, -2) } g.stroke()
    },
    face: (g, p) => { if (!p.hurt) for (const s of [-1, 1]) heart(g, s * 5.4, -20.4, 1.6, '#a8664e'); dotEyes(g, -16.4, 5.4, 1.6, p); hatch(g, -13, 8.8); catMouth(g, -13.8, p.hurt ? 1.4 : 1) },
  }, p)
}
// 모몽가 — 하얀 복슬 · 큰 귀 · 머리 위까지 솟은 큰 하늘색 꼬리 · 긴 볼털 · 볼에 댄 두 손 · 무거운 눈꺼풀의 큰 눈
function momonga(g, p) {
  const sky = '#c2e2f6'
  mochi(g, {
    fur: '#fff', W: 26, H: 23, fluffy: true, arms: 'cheek',
    back: g => {
      fluffOval(g, 9.5, -18, 7.5, 14, 0.25, sky)
      for (const s of [-1, 1]) { blob(g, s * 7.8, -25.6, 4, 4.4, '#fff'); g.strokeStyle = OUT; g.lineWidth = 0.7; g.beginPath(); g.moveTo(s * 7.2, -27.6); g.lineTo(s * 7.6, -24.4); g.moveTo(s * 8.8, -27); g.lineTo(s * 8.5, -25); g.stroke() }
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 11, -16); g.lineTo(s * 16, -14.6); g.lineTo(s * 12.6, -13.2); g.lineTo(s * 15.6, -11); g.lineTo(s * 11, -10.6); g.closePath(); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 1.1; g.strokeStyle = OUT; g.stroke() }
    },
    face: (g, p) => {
      g.fillStyle = sky; g.beginPath(); g.ellipse(0, -14.4, 1.5, 1, 0, 0, TAU); g.fill()
      if (p.hurt || p.blink) dotEyes(g, -15.6, 5, 2, p)
      else for (const s of [-1, 1]) {
        g.fillStyle = '#2b211d'; g.beginPath(); g.ellipse(s * 5, -15.4, 2.2, 2.5, 0, 0, TAU); g.fill()
        g.fillStyle = '#fff'; g.beginPath(); g.arc(s * 5 - 0.7, -16.2, 0.9, 0, TAU); g.fill(); g.beginPath(); g.arc(s * 5 + 0.7, -14.4, 0.4, 0, TAU); g.fill()
        g.strokeStyle = OUT; g.lineWidth = 1.4; g.beginPath(); g.ellipse(s * 5, -15.3, 2.6, 2.9, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke()   // 무거운 눈꺼풀
      }
      hatch(g, -12, 8.2); catMouth(g, -12.6, p.hurt ? 1.3 : 0.8)
    },
  }, p)
}
// 랏코 — 크림색 복슬 · 작은 검은 귀 · 검은 발 · 이마의 별 모양 흉터 · 하얀 목도리 망토(검은 매듭) · 진지한 눈 · 어깨 위 칼자루
function rakko(g, p) {
  const fur = '#fbefcf', black = '#2f2a2a'
  mochi(g, {
    fur, H: 25, fluffy: true, limb: black, arms: 'none',
    back: g => {
      g.lineCap = 'round'
      for (const [col, lw] of [[OUT, 3.8], ['#6b4a2f', 2]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(-8.6, -22); g.lineTo(-12.6, -31.4); g.stroke() }
      for (const [col, lw] of [[OUT, 3.6], ['#ffd23f', 1.8]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(-12.6, -23.6); g.lineTo(-7, -26.4); g.stroke() }
      g.beginPath(); g.moveTo(9, -12); g.quadraticCurveTo(15.6, -9, 15.4, -3.4); g.quadraticCurveTo(13, -5, 10.6, -3); g.closePath(); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 1.1; g.strokeStyle = OUT; g.stroke()   // 망토 자락
      for (const s of [-1, 1]) blob(g, s * 9.4, -25.6, 1.9, 1.9, black, 1)
    },
    cap: g => { const P = new Path2D(); P.moveTo(-15, -14.4); P.quadraticCurveTo(0, -9.6, 15, -14.4); P.lineTo(15, -9.2); P.quadraticCurveTo(0, -4.4, -15, -9.2); P.closePath(); g.fillStyle = '#fff'; g.fill(P); g.strokeStyle = OUT; g.lineWidth = 0.9; g.stroke(P) },
    face: (g, p) => {
      g.save(); g.translate(-7, -20.6); g.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU - Math.PI / 2, R = i % 2 ? 0.7 : 2.2; g.lineTo(Math.cos(a) * R, Math.sin(a) * R) } g.closePath(); g.strokeStyle = '#8c6a55'; g.lineWidth = 0.8; g.stroke(); g.restore()   // 별 모양 흉터
      dotEyes(g, -16, 5, 1.7, p)
      if (!p.hurt && !p.blink) { g.strokeStyle = OUT; g.lineWidth = 1.2; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 3.2, -17.2); g.lineTo(s * 6.8, -17.6); g.stroke() } }   // 진지한 눈꺼풀
      hatch(g, -12.4, 8.4, 0.9); catMouth(g, -13, p.hurt ? 1.3 : 0.6)
    },
    front: g => blob(g, 0, -7.6, 1.7, 1.2, black, 0.8),   // 망토 매듭
  }, p)
}
// 쿠리만쥬 — 살구 베이지 · 조금 넓은 몸 · 머리 위에 납작한 밤색 뚜껑(머리) · 작은 귀 · 눈썹 없음 · 한 잔
function kurimanju(g, p) {
  const fur = '#f9dfbd', brown = '#8b5a3c'
  mochi(g, {
    fur, W: 28, H: 23,
    back: g => { for (const s of [-1, 1]) blob(g, s * 10.8, -22.4, 2.2, 2, fur, 1.2) },
    cap: g => { g.fillStyle = brown; g.beginPath(); g.ellipse(0, -25, 10, 4.6, 0, 0, TAU); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1; g.beginPath(); g.ellipse(0, -25, 10, 4.6, 0, 0, Math.PI); g.stroke() },
    face: (g, p) => { dotEyes(g, -15, 5.4, 1.5, p); hatch(g, -11.8, 9); catMouth(g, -12.6, p.hurt ? 1.3 : 0.8) },
    front: g => {
      g.lineWidth = 1.1; g.strokeStyle = OUT; g.beginPath(); g.arc(15, -8.6, 1.7, -Math.PI / 2, Math.PI / 2); g.stroke()
      g.fillStyle = '#ffc93d'; g.beginPath(); g.rect(10.6, -11.4, 4.4, 5.6); g.fill(); g.stroke()
      blob(g, 12.8, -11.6, 2.7, 1.4, '#fff', 0.9)
    },
  }, p)
}
// 카니 — 헌책방. 복숭앗빛 동그란 몸 · 분홍 머리 · 게 집게 머리띠 · 짧은 눈썹 · 초록 헌책
function kani(g, p) {
  const fur = '#fde8de', pink = '#f5a3a6'
  mochi(g, {
    fur, H: 25,
    back: g => {
      for (const s of [-1, 1]) {
        g.save(); g.translate(s * 8.4, -27.6); g.rotate(s * 0.35)
        for (const [col, lw] of [[OUT, 3.2], [pink, 1.6]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(0, 3); g.lineTo(0, -1); g.stroke() }
        g.beginPath(); g.moveTo(0, -1); g.bezierCurveTo(-4.5, -2, -4.5, -8.5, -0.6, -9); g.lineTo(-0.2, -5.6); g.lineTo(0.8, -8.8); g.bezierCurveTo(4.5, -8, 4.2, -2, 0, -1); g.closePath(); g.fillStyle = pink; g.fill(); g.lineWidth = 1.2; g.strokeStyle = OUT; g.stroke()
        g.restore()
      }
    },
    cap: g => { g.fillStyle = pink; g.beginPath(); g.moveTo(-15, -22.2); g.quadraticCurveTo(0, -19.4, 15, -22.2); g.lineTo(15, -30); g.lineTo(-15, -30); g.fill() },
    face: (g, p) => {
      if (!p.hurt) { g.strokeStyle = OUT; g.lineWidth = 0.8; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 3.8, -19.6); g.lineTo(s * 6.2, -20.4); g.stroke() } }
      dotEyes(g, -16, 5.2, 1.6, p); hatch(g, -12.6, 8.6); catMouth(g, -13.4, p.hurt ? 1.4 : 0.8)
    },
    front: g => { g.save(); g.translate(-12.6, -6.4); g.rotate(-0.15); g.fillStyle = '#8fd14f'; g.fillRect(-2.6, -3.6, 5.2, 7); g.fillStyle = '#fff'; g.fillRect(1.4, -3, 0.9, 5.8); g.strokeStyle = OUT; g.lineWidth = 1; g.strokeRect(-2.6, -3.6, 5.2, 7); g.restore() },   // 초록 헌책
  }, p)
}
// 고블린 — 연두색 · 머리 꼭지 · 뾰족 귀 · 아래 단이 들쭉날쭉한 가죽옷 · 몽둥이
function goblin(g, p = {}, o = {}) {
  const col = o.col || '#a9d083'
  mochi(g, {
    fur: col, W: 24, H: 21,
    back: g => {
      if (o.cape) { g.beginPath(); g.moveTo(-9, -17); g.lineTo(-14.5, 0); g.lineTo(14.5, 0); g.lineTo(9, -17); g.closePath(); g.fillStyle = '#c0392b'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = OUT; g.stroke() }
      for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 9.4, -16.6); g.lineTo(s * 15.6, -18); g.lineTo(s * 11, -12); g.closePath(); g.fillStyle = col; g.fill(); g.lineWidth = 1.2; g.strokeStyle = OUT; g.stroke() }
      if (!o.crown) { g.beginPath(); g.moveTo(-3.4, -22.6); g.quadraticCurveTo(-0.4, -24.8, 0.6, -28); g.quadraticCurveTo(2, -24.6, 3.4, -22.6); g.closePath(); g.fillStyle = col; g.fill(); g.lineWidth = 1.2; g.strokeStyle = OUT; g.stroke() }
    },
    cap: g => {
      g.fillStyle = o.cloth || '#a8835f'; g.beginPath(); g.moveTo(-14, -10.2); g.lineTo(14, -10.2); g.lineTo(14, -3.4)
      for (let x = 14; x > -14; x -= 3.5) { g.lineTo(x - 1.75, -1.6); g.lineTo(x - 3.5, -3.6) }
      g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 0.9; g.stroke()
    },
    face: (g, p) => {
      if (o.band) { g.fillStyle = '#e5534b'; g.fillRect(-12, -20.6, 24, 2.8); g.strokeStyle = OUT; g.lineWidth = 0.8; g.strokeRect(-12, -20.6, 24, 2.8) }
      dotEyes(g, -14.6, 4.6, 1.4, p); hatch(g, -11.6, 7.6, 0.85); catMouth(g, -12.2, 0.6)
    },
    front: g => {
      for (const [c, lw] of [[OUT, 4.6], ['#8a6142', 2.8]]) { g.strokeStyle = c; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath(); g.moveTo(10.2, -3); g.lineTo(13.2, -11); g.stroke() }   // 몽둥이
      blob(g, 13.6, -12, 2.4, 2.6, '#8a6142', 1.1)
      if (o.crown) { g.beginPath(); g.moveTo(-5.6, -22.8); g.lineTo(-5.6, -28.6); g.lineTo(-2.8, -25.4); g.lineTo(0, -29.6); g.lineTo(2.8, -25.4); g.lineTo(5.6, -28.6); g.lineTo(5.6, -22.8); g.closePath(); g.fillStyle = '#ffd23f'; g.fill(); g.lineWidth = 1.1; g.strokeStyle = OUT; g.stroke() }
    },
  }, p)
}
// 키메라 — 웃으면서 우는 얼굴(검은 눈 · 흐르는 눈물) · 길고 붉은 발톱. legs 면 네 발(분홍 어른 키메라)
function chimera(g, p = {}, o = {}) {
  const col = o.col || '#ddd5ea', f = p.foot || 0
  if (o.horns) for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 3, -16); g.quadraticCurveTo(s * 7, -21, s * 6, -24); g.quadraticCurveTo(s * 5, -19.5, s * 6.5, -15); g.closePath(); g.fillStyle = '#f2e6c9'; g.fill(); g.lineWidth = 1; g.strokeStyle = OUT; g.stroke() }
  if (o.legs) [-6.5, -2.4, 2.4, 6.5].forEach((x, i) => blob(g, x, -1.4 - Math.max(0, (i % 2 ? 1 : -1) * f) * 1.4, 2.2, 2.2, col, 1.1))
  else for (const s of [-1, 1]) blob(g, s * 4.2, -1.3 - Math.max(0, s * f) * 1.6, 3, 2, col, 1.1)
  g.strokeStyle = '#d63a3a'; g.lineWidth = 1.3; g.lineCap = 'round'
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(s * 8, -7 + k * 1.6); g.lineTo(s * (12.5 + k * 0.3), -5.5 + k * 2.4 - s * f * 0.8); g.stroke() }
  blob(g, 0, -9, 9.5, 8.5, col)
  g.beginPath(); g.moveTo(-3.6, -16.8); g.lineTo(-2, -20.2); g.lineTo(-0.4, -17.2); g.lineTo(1.2, -20.4); g.lineTo(2.9, -16.9); g.closePath(); g.fillStyle = col; g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.1; g.stroke()
  for (const s of [-1, 1]) { g.fillStyle = '#231a1e'; g.beginPath(); g.ellipse(s * 3.6, -11.4, 1.9, 2.4, 0, 0, TAU); g.fill(); g.fillStyle = '#8fd0ff'; g.beginPath(); g.ellipse(s * 5.9, -8.4, 0.9, 1.5, 0, 0, TAU); g.fill() }
  g.beginPath(); g.moveTo(-4.2, -7.6); g.quadraticCurveTo(0, -2, 4.2, -7.6); g.quadraticCurveTo(0, -5.2, -4.2, -7.6); g.closePath(); g.fillStyle = '#3a1f2a'; g.fill()
}
// 가면 키메라 — 곤충 날개 · 기괴한 가면 얼굴 · 네 발
function maskChimera(g, p = {}) {
  const f = p.foot || 0
  for (const s of [-1, 1]) { g.save(); g.translate(s * 6, -15.5); g.rotate(s * (-0.7 + f * 0.15)); g.globalAlpha = 0.8; blob(g, 0, 0, 3, 7, '#dff5ea', 1); g.restore() }
  ;[-6.5, -2.4, 2.4, 6.5].forEach((x, i) => blob(g, x, -1.4 - Math.max(0, (i % 2 ? 1 : -1) * f) * 1.4, 2, 2.2, '#5f6b4e', 1.1))
  blob(g, 0, -7.5, 10, 6.8, '#7d8a6a')
  blob(g, 0, -10.5, 6.2, 6.6, '#f5efe0', 1.3)
  for (const s of [-1, 1]) { g.fillStyle = '#231a1e'; g.beginPath(); g.ellipse(s * 2.4, -11.6, 1.4, 1.9, s * 0.3, 0, TAU); g.fill(); g.strokeStyle = '#d63a3a'; g.lineWidth = 0.9; g.beginPath(); g.moveTo(s * 2.4, -9.4); g.lineTo(s * 2.9, -7.6); g.stroke() }
  g.strokeStyle = OUT; g.lineWidth = 1; g.beginPath(); g.moveTo(-2.6, -7); for (let i = 1; i <= 4; i++) g.lineTo(-2.6 + i * 1.3, i % 2 ? -6 : -7); g.stroke()
}
// 데카츠요 — 「뭔가 크고 강한 녀석」. 해태 같은 얼굴 · 규키(소뿔 · 거미 다리 — 번갈아 든다)
function dekatsuyo(g, p = {}) {
  const f = p.foot || 0
  g.lineCap = 'round'
  for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { const lift = Math.max(0, (k % 2 ? 1 : -1) * s * f) * 2.2; for (const [c, lw] of [[OUT, 3.6], ['#3e3446', 2]]) { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); g.moveTo(s * 8, -9 + k * 3); g.lineTo(s * (15 + k), -14 + k * 4 - lift); g.lineTo(s * (17 + k * 1.5), -lift); g.stroke() } }
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 5, -20); g.quadraticCurveTo(s * 15, -22, s * 13, -30); g.quadraticCurveTo(s * 11, -24, s * 7.5, -16.5); g.closePath(); g.fillStyle = '#efe2c2'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = OUT; g.stroke() }
  for (let i = 0; i < 9; i++) { const a = Math.PI * (0.85 + i / 8 * 1.3); blob(g, Math.cos(a) * 11, -12 + Math.sin(a) * 9.6, 3, 3, '#3e3446', 1.1) }
  blob(g, 0, -11.5, 11, 10, '#5e5068')
  for (const s of [-1, 1]) { blob(g, s * 4.4, -14, 2, 1.8, '#ffd23f', 0.9); g.fillStyle = '#231a1e'; g.beginPath(); g.arc(s * 4.4, -14, 0.8, 0, TAU); g.fill(); g.strokeStyle = OUT; g.lineWidth = 1.4; g.beginPath(); g.moveTo(s * 7, -17.4); g.lineTo(s * 2, -15.8); g.stroke() }
  blob(g, 0, -9.2, 4.4, 2.6, '#7a6a86', 1.1); g.fillStyle = '#231a1e'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 1.5, -9.6, 0.8, 0.6, 0, 0, TAU); g.fill() }
  g.fillStyle = '#3a1f2a'; g.beginPath(); g.ellipse(0, -5.4, 6, 2.6, 0, 0, Math.PI); g.closePath(); g.fill()
  g.fillStyle = '#fff'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 4.4, -5.4); g.lineTo(s * 3, -5.4); g.lineTo(s * 3.7, -2.8); g.fill() }
}
// 아노코 — 「커다란 토벌」의 대상. 이마의 작은 뿔 · 하얀 복슬 윗몸 · 짧은 크림색 아랫몸 · 청록 용 꼬리 · 꼬깔콘 같은 발톱 · 소용돌이 눈(오른쪽을 본다)
function anoko(g, p = {}) {
  const f = p.foot || 0, cream = '#f2dccb', teal = '#4f9a8c', claw = '#b7793f'
  g.beginPath(); g.moveTo(-10, -11); g.bezierCurveTo(-18, -12.5, -21.5, -4, -16, -1); g.bezierCurveTo(-13, 0.8, -10, -1, -9, -4.5); g.closePath(); g.fillStyle = teal; g.fill(); g.lineWidth = 1.3; g.strokeStyle = OUT; g.stroke()   // 용 꼬리
  g.strokeStyle = 'rgba(255,255,255,.45)'; g.lineWidth = 0.7; for (const [x, y] of [[-15, -8], [-17.5, -4.5], [-14, -3]]) { g.beginPath(); g.arc(x, y, 1.2, 0.3, Math.PI - 0.3); g.stroke() }
  ;[-9, -3.4].forEach((x, i) => blob(g, x, -1.6 - Math.max(0, (i ? 1 : -1) * f) * 1.6, 2.6, 2.2, cream, 1.1))   // 뒷발
  blob(g, -4.5, -8, 9, 6.8, cream)   // 짧은 털 아랫몸
  ;[4.6, 10].forEach((x, i) => {   // 앞발 · 꼬깔콘 발톱
    const y = -1.6 - Math.max(0, (i ? -1 : 1) * f) * 1.6
    for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(x + 1.4 + k * 0.4, y + 0.2 + k * 0.9); g.lineTo(x + 4.2, y + k * 1.1); g.lineTo(x + 1.4 + k * 0.4, y - 0.8 + k * 0.9); g.closePath(); g.fillStyle = claw; g.fill() }
    blob(g, x, y, 2.6, 2.2, '#fdfbf7', 1.1)
  })
  for (const s of [-1, 1]) blob(g, 6.6 + s * 5.4, -22.2, 2.4, 2.2, '#fdfbf7', 1.1)   // 귀
  fluffOval(g, 6.6, -13.6, 9.6, 10, 0, '#fdfbf7', 34)   // 복슬 윗몸 · 머리
  g.beginPath(); g.moveTo(5.4, -22.4); g.lineTo(6.6, -26.2); g.lineTo(7.8, -22.4); g.closePath(); g.fillStyle = '#f2e6c9'; g.fill(); g.lineWidth = 1; g.strokeStyle = OUT; g.stroke()   // 작은 뿔
  g.strokeStyle = '#6b6f8a'; g.lineWidth = 0.8; for (const x of [3.6, 9.6]) { g.beginPath(); for (let t = 0; t < TAU * 1.6; t += 0.3) { const r = 0.25 + t * 0.2; g.lineTo(x + Math.cos(t) * r, -15.6 + Math.sin(t) * r) } g.stroke() }   // 소용돌이 눈
  g.strokeStyle = OUT; g.lineWidth = 0.8; g.beginPath(); g.moveTo(5.4, -11.8); g.quadraticCurveTo(6, -11.1, 6.6, -11.8); g.quadraticCurveTo(7.2, -11.1, 7.8, -11.8); g.stroke()
}
// 세이렌 — 이누하리코(종이 개 인형) 머리 · 포유류 같은 복슬한 윗몸 · 붉은 금붕어 아랫몸과 큰 꼬리지느러미. 화나면 얼굴에 그늘이 지고 눈이 붉어진다
function siren(g, angry = false, p = {}) {
  const white = '#fffaf2', red = '#e8453a', f = p.foot || 0
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0, -4); g.quadraticCurveTo(s * 12, -9 - s * f, s * 16, -s * f * 1.4); g.quadraticCurveTo(s * 9, -1, s * 4, 1.5); g.closePath(); g.fillStyle = 'rgba(255,120,95,.85)'; g.fill(); g.lineWidth = 1.2; g.strokeStyle = OUT; g.stroke() }
  blob(g, 0, -8, 8.5, 7.5, '#ee4a3c')
  g.strokeStyle = 'rgba(255,220,200,.75)'; g.lineWidth = 0.8; for (const [x, y] of [[-3, -9], [2, -10], [-1, -6], [4, -6.5]]) { g.beginPath(); g.arc(x, y, 1.6, 0.2, Math.PI - 0.2); g.stroke() }
  blob(g, 0, -17.5, 9.5, 7, white)
  for (const s of [-1, 1]) blob(g, s * 9, -15.5, 2.6, 3.4, white, 1.2)
  for (const s of [-1, 1]) { g.save(); g.translate(s * 8.6, -29.5); g.rotate(s * 0.5); blob(g, 0, 0, 2.8, 4.2, red, 1.2); g.restore() }
  blob(g, 0, -29, 10, 8.6, white)
  g.fillStyle = red; g.beginPath(); g.ellipse(0, -35.4, 4.5, 2, 0, 0, TAU); g.fill()
  for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 6.6, -33, 1.4, 0, TAU); g.fill() }
  g.beginPath(); g.moveTo(-6.5, -21.6); g.quadraticCurveTo(0, -17.6, 6.5, -21.6); g.lineTo(5, -19.8); g.quadraticCurveTo(0, -16, -5, -19.8); g.closePath(); g.fill()
  if (angry) { g.save(); g.beginPath(); g.ellipse(0, -29, 10, 8.6, 0, 0, TAU); g.clip(); g.fillStyle = 'rgba(40,20,60,.45)'; g.fillRect(-11, -38, 22, 9.5); g.restore() }
  for (const s of [-1, 1]) { g.fillStyle = angry ? '#ff3b3b' : '#2b211d'; g.beginPath(); g.ellipse(s * 4, -28.6, 1.5, 1.9, 0, 0, TAU); g.fill(); if (!angry) { g.fillStyle = '#fff'; g.beginPath(); g.arc(s * 4 - 0.5, -29.3, 0.55, 0, TAU); g.fill() } }
  blob(g, 0, -25.4, 3.2, 2.2, white, 1); g.fillStyle = '#2b211d'; g.beginPath(); g.ellipse(0, -26.2, 1.1, 0.8, 0, 0, TAU); g.fill()
  if (angry) { g.strokeStyle = OUT; g.lineWidth = 1; g.beginPath(); g.moveTo(-1.8, -22.6); g.quadraticCurveTo(0, -23.6, 1.8, -22.6); g.stroke() } else { smile(g, -23.3); blush(g, -25.6, 6.6, 0.8) }
}
// 인어 — 세이렌의 코러스. 치이카와 일행만 한 크기 · 날카로운 이빨(생김새 설명이 없어 색 · 모양은 짐작)
const MER = [{ skin: '#ffe9e0', tail: '#ff9fb5', fin: '#ffd1dc' }, { skin: '#eaf8ff', tail: '#7fc8e8', fin: '#bfe8f7' }, { skin: '#f3ecff', tail: '#b89be8', fin: '#e0d3fb' }]
function mermaid(g, o, p = {}) {
  const f = p.foot || 0
  g.beginPath(); g.moveTo(5, -3.5); g.lineTo(11, -7.5 + f * 1.4); g.quadraticCurveTo(9, -3, 11, 1 + f * 1.4); g.closePath(); g.fillStyle = o.fin; g.fill(); g.lineWidth = 1.2; g.strokeStyle = OUT; g.stroke()
  blob(g, 0, -5, 6.5, 5, o.tail)
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 7, -17); g.lineTo(s * 12, -21); g.lineTo(s * 10.5, -13.5); g.closePath(); g.fillStyle = o.fin; g.fill(); g.lineWidth = 1.1; g.strokeStyle = OUT; g.stroke() }
  blob(g, 0, -15, 8.5, 7.8, o.skin)
  eyes(g, -16, 3.4, 1.3)
  g.fillStyle = '#3a1f2a'; g.beginPath(); g.moveTo(-3.6, -12); g.quadraticCurveTo(0, -8, 3.6, -12); g.closePath(); g.fill()
  g.fillStyle = '#fff'; g.beginPath(); for (let i = 0; i < 4; i++) { const x = -3 + i * 2; g.moveTo(x - 0.9, -12); g.lineTo(x + 0.9, -12); g.lineTo(x, -10.3) } g.fill()
  blush(g, -12.6, 6, 0.7)
}
// [가로, 세로, 그리기(g, 자세)] — 발밑이 아래에서 3 위
const ART = {
  kani: [34, 42, kani], anoko: [96, 70, (g, p) => { g.scale(2.4, 2.4); anoko(g, p) }],
  chiikawa: [34, 35, chiikawa], hachiware: [34, 37, hachiware], usagi: [32, 50, usagi], shisa: [36, 35, shisa], momonga: [42, 38, momonga], rakko: [36, 38, rakko], kurimanju: [38, 32, kurimanju],
  goblin: [36, 33, (g, p) => goblin(g, p)],
  rusher: [36, 33, (g, p) => goblin(g, p, { col: '#c7df9a', band: true })],
  chimera: [30, 26, (g, p) => chimera(g, p)],
  spiker: [30, 28, maskChimera],
  dekatsu: [48, 40, (g, p) => { g.scale(1.6, 1.6); chimera(g, p, { col: '#efb3c8', legs: true }) }],
  golden: [62, 58, (g, p) => { g.scale(1.7, 1.7); goblin(g, p, { col: '#ffd34d', cloth: '#b8863b', crown: true }) }],
  dekatsuyo: [112, 86, (g, p) => { g.scale(2.6, 2.6); dekatsuyo(g, p) }],
  goblinKing: [92, 84, (g, p) => { g.scale(2.6, 2.6); goblin(g, p, { col: '#9cc874', crown: true, cape: true }) }],
  bigChimera: [96, 84, (g, p) => { g.scale(3.2, 3.2); chimera(g, p, { col: '#c9b8e0', legs: true, horns: true }) }],
  mermaid: [36, 36, (g, p) => { g.scale(1.4, 1.4); mermaid(g, MER[0], p) }],
  mermaid1: [36, 36, (g, p) => { g.scale(1.4, 1.4); mermaid(g, MER[1], p) }],
  mermaid2: [36, 36, (g, p) => { g.scale(1.4, 1.4); mermaid(g, MER[2], p) }],
  siren: [88, 96, (g, p) => { g.scale(2.4, 2.4); siren(g, false, p) }],
  sirenAngry: [88, 96, (g, p) => { g.scale(2.4, 2.4); siren(g, true, p) }],
}
// 캐릭터 움직임 — 걷기 넷(발을 번갈아 들고 팔을 엇갈려 흔들고, 발을 모을 때 몸이 들썩) · 서 있기(숨 · 눈 깜빡) · 아픈 얼굴. 얼굴은 보는 쪽으로 조금
const WALK = [{ foot: 1, arm: 1 }, { bob: -1.3 }, { foot: -1, arm: -1 }, { bob: -1.3 }], LOOK = 1.2

function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c }
/** w × h(월드 단위) 그림을 단위당 k 픽셀로 한 번 그려 둔다. ox, oy = 기준점(발밑) */
function sprite(w, h, ox, oy, paint, k = K) {
  const c = mk(w * k, h * k), g = c.getContext('2d'); g.scale(k, k); g.translate(ox, oy); g.lineJoin = g.lineCap = 'round'; paint(g)
  return { c, w, h, ox, oy }
}
const artSprite = (id, k = K, p = {}) => { const [w, h, paint] = ART[id]; return sprite(w, h, w / 2, h - 3, g => paint(g, p), k) }
const charSprites = id => ({ walk: WALK.map(p => artSprite(id, K, { ...p, look: LOOK })), idle: [artSprite(id, K, { look: LOOK }), artSprite(id, K, { look: LOOK, blink: true })], hurt: artSprite(id, K, { look: LOOK, hurt: true }) })
function flip(s) { const c = mk(s.c.width, s.c.height), g = c.getContext('2d'); g.scale(-1, 1); g.drawImage(s.c, -c.width, 0); return { ...s, c, ox: s.w - s.ox } }
function white(s) { const c = mk(s.c.width, s.c.height), g = c.getContext('2d'); g.drawImage(s.c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); return { ...s, c } }
const put = (c, s, x, y, k = 1) => c.drawImage(s.c, x - s.ox * k, y - s.oy * k, s.w * k, s.h * k)
const emo = (ch, size) => sprite(size * 1.4, size * 1.4, size * 0.7, size * 0.7, g => { g.font = `${size}px ${EMOJI}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(ch, 0, size * 0.05) })
/** 메뉴 · 도감에 쓰는 그림(크게 그린 캔버스) */
function portrait(id) { const c = artSprite(id, 3).c; c.className = 'pt'; return c }

const TILE = 256
function seeded(s) { return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
function groundTile() {   // 풀밭 — 이어 붙여도 이음매가 안 보이게 가장자리는 아홉 칸에 같이 그린다
  const c = mk(TILE * K, TILE * K), g = c.getContext('2d'), r = seeded(7)
  g.scale(K, K); g.fillStyle = '#cdeaa8'; g.fillRect(0, 0, TILE, TILE)
  const wrap = fn => { for (const ox of [-TILE, 0, TILE]) for (const oy of [-TILE, 0, TILE]) fn(ox, oy) }
  for (let i = 0; i < 16; i++) { const x = r() * TILE, y = r() * TILE, R = 14 + r() * 30, col = r() < 0.5 ? 'rgba(165,212,125,.5)' : 'rgba(228,246,196,.55)'; wrap((ox, oy) => { g.fillStyle = col; g.beginPath(); g.ellipse(x + ox, y + oy, R, R * 0.6, 0, 0, TAU); g.fill() }) }
  g.strokeStyle = '#93c870'; g.lineWidth = 1.5; g.lineCap = 'round'
  for (let i = 0; i < 70; i++) { const x = r() * TILE, y = r() * TILE; wrap((ox, oy) => { g.beginPath(); g.moveTo(x + ox - 3, y + oy); g.lineTo(x + ox - 4, y + oy - 5); g.moveTo(x + ox, y + oy); g.lineTo(x + ox, y + oy - 7); g.moveTo(x + ox + 3, y + oy); g.lineTo(x + ox + 4.5, y + oy - 5); g.stroke() }) }
  for (let i = 0; i < 14; i++) {
    const x = r() * TILE, y = r() * TILE, col = pickOfR(r, ['#ffffff', '#ffd1dc', '#fff1a1'])
    wrap((ox, oy) => { g.fillStyle = col; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; g.beginPath(); g.arc(x + ox + Math.cos(a) * 2.6, y + oy + Math.sin(a) * 2.6, 2, 0, TAU); g.fill() } g.fillStyle = '#ffc94d'; g.beginPath(); g.arc(x + ox, y + oy, 1.6, 0, TAU); g.fill() })
  }
  return c
}
const pickOfR = (r, a) => a[r() * a.length | 0]

let SPR = null, K = 2   // K = 그려 두는 그림의 단위당 픽셀 — 화면 배율에 맞춘다
function sprites() {
  const enemy = id => { const R = [artSprite(id, K, { foot: 1 }), artSprite(id, K, { foot: -1 })], L = R.map(flip); return { R, L, WR: R.map(white), WL: L.map(white) } }   // 걷기 두 장 · 왼쪽 · 맞았을 때 하양
  SPR = { E: {}, ground: groundTile() }
  for (const ch of CHARS) SPR[ch.id] = charSprites(ch.id)
  for (const id in FOES) if (id !== 'mermaid') SPR[id] = enemy(id)
  SPR.mermaid = ['mermaid', 'mermaid1', 'mermaid2'].map(enemy); SPR.sirenAngry = enemy('sirenAngry')
  SPR.pochette = sprite(24, 24, 12, 12, g => {   // 치이카와의 분홍 곰 포셰트
    g.strokeStyle = OUT; g.lineWidth = 1.2; g.beginPath(); g.arc(0, -2, 7.5, Math.PI * 1.1, Math.PI * 1.9); g.stroke()
    for (const s of [-1, 1]) blob(g, s * 5, -3.6, 2.2, 2.2, '#ffb3c8', 1.1)
    blob(g, 0, 1.5, 7.5, 6.5, '#ffb3c8', 1.3)
    g.fillStyle = '#2b211d'; for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 2.4, 0.8, 0.8, 0, TAU); g.fill() }
    blob(g, 0, 3.2, 2, 1.4, '#ffe3ec', 0.8)
  })
  for (const id in WEAP) SPR.E[id] = emo(WEAP[id].icon, 22)
  for (const id in PASS) SPR.E[id] = emo(PASS[id].icon, 22)
  for (const id in ITEMS) SPR.E[id] = emo(ITEMS[id].icon, 22)
  SPR.note = emo('🎵', 18)
  SPR.pinkNote = sprite(18, 20, 9, 10, g => { g.font = `18px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 3; g.strokeStyle = OUT; g.strokeText('♪', 0, 0); g.fillStyle = '#ff7ad9'; g.fillText('♪', 0, 0) })
  SPR.shadow = sprite(40, 14, 20, 7, g => { g.fillStyle = 'rgba(60,90,40,.28)'; g.beginPath(); g.ellipse(0, 0, 18, 6, 0, 0, TAU); g.fill() })
  const gem = col => sprite(12, 14, 6, 7, g => { g.beginPath(); g.moveTo(0, -6); g.lineTo(5, 0); g.lineTo(0, 6); g.lineTo(-5, 0); g.closePath(); g.fillStyle = col; g.fill(); g.lineWidth = 1.2; g.strokeStyle = OUT; g.stroke(); g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.moveTo(0, -4); g.lineTo(2, -1); g.lineTo(0, 0); g.lineTo(-1.5, -1); g.fill() })
  SPR.gem = [gem('#7fd3ff'), gem('#8cf28a'), gem('#ff8fd0')]
}

// ---------------------------------------------------------------- 화면 · 입력
const cv = document.getElementById('cv'), ctx = cv.getContext('2d'), ui = document.getElementById('ui'), pauseBtn = document.getElementById('pause')
let SC = 1, VW = VIEW, VH = VIEW, DPR = 1, still = 2
function size() {
  const r = cv.getBoundingClientRect(), d = Math.min(devicePixelRatio || 1, 2, Math.sqrt(2.4e6 / Math.max(1, r.width * r.height)))
  cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d)); DPR = cv.width / Math.max(1, r.width)
  SC = Math.min(cv.width, cv.height) / VIEW; VW = cv.width / SC; VH = cv.height / SC
  const k = clamp(Math.round(SC * 2) / 2, 1, 3)
  if (k !== K || !SPR) { K = k; sprites() }
  still = 2
}
new ResizeObserver(size).observe(cv)

const key = { u: 0, d: 0, l: 0, r: 0 }, joy = { on: false, id: null, x: 0, y: 0, ox: 0, oy: 0, px: 0, py: 0 }
const KEYS = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' }
addEventListener('keydown', e => {
  const k = KEYS[e.code]
  if (k) key[k] = 1
  if ((k || e.code === 'Space') && mode === 'play') e.preventDefault()
  if (e.code === 'Escape' || e.code === 'KeyP') { if (mode === 'play') pause(); else if (mode === 'pause') resume() }
  if (mode === 'box') boxKey(e)
  if (mode === 'chars' && !e.repeat) {
    if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') { pickCi = (pickCi + CHARS.length - 1) % CHARS.length; chars() }
    if (e.code === 'ArrowRight' || e.code === 'ArrowDown') { pickCi = (pickCi + 1) % CHARS.length; chars() }
    if (e.code === 'Enter' && !e.target.closest?.('button')) startGame(pickCi)
  }
})
addEventListener('keyup', e => { const k = KEYS[e.code]; if (k) key[k] = 0 })
const calm = () => { for (const k in key) key[k] = 0; joy.on = false; joy.id = null; joy.x = joy.y = 0 }
addEventListener('blur', () => { calm(); pause() })
document.addEventListener('visibilitychange', () => { if (document.hidden) pause() })
// 손가락 스틱 — 화면 아무 데나 누른 자리가 가운데. 멀리 끌면 원이 손가락을 따라온다
cv.addEventListener('pointerdown', e => {
  if (mode !== 'play') return
  cv.setPointerCapture(e.pointerId)
  Object.assign(joy, { on: true, id: e.pointerId, ox: e.clientX, oy: e.clientY, px: e.clientX, py: e.clientY, x: 0, y: 0 })
})
cv.addEventListener('pointermove', e => {
  if (e.pointerId !== joy.id) return
  const R = 46
  let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy
  const d = Math.hypot(dx, dy)
  if (d > R) { joy.ox += dx * (1 - R / d); joy.oy += dy * (1 - R / d); dx *= R / d; dy *= R / d }
  joy.px = joy.ox + dx; joy.py = joy.oy + dy
  joy.x = d > 6 ? dx / R : 0; joy.y = d > 6 ? dy / R : 0
})
const lift = e => { if (e.pointerId === joy.id) { joy.on = false; joy.id = null; joy.x = joy.y = 0 } }
cv.addEventListener('pointerup', lift); cv.addEventListener('pointercancel', lift)
pauseBtn.addEventListener('click', () => { pauseBtn.blur(); pause() })

// ---------------------------------------------------------------- 한 판
let mode = 'title', G = null, pl = null, S = null, shake = 0, pickCi = 0
const cam = { x: 0, y: 0 }
const need = lv => Math.round((1 + 0.2 * Math.min(1, (lv - 1) / 15)) * (lv < 20 ? 5 + (lv - 1) * 7 : 138 + (lv - 20) * 12 + (lv - 20) ** 2))   // 다음 레벨까지 경험치

function newGame(ch) {
  pl = { x: 0, y: 0, r: 12, hp: 1, inv: 0, hurtT: 0, face: [1, 0], fx: 1, jump: 0, moving: false }
  const b = 2 + (ch.mod.boxes || 0)
  G = {
    ch, t: 0, foes: [], shots: [], eshots: [], gems: [], items: [], fx: [], parts: [], nums: [], haz: [], weapons: [], passives: {},
    kills: 0, lvl: 1, xp: 0, next: need(1), queue: [], cheer: 0, jackpots: 0, bosses: 0, freeze: 0, spawnT: 0.5,
    nextElite: 140, nextSwarm: 100, nextEvt: 600, pi: 0, dying: 0, won: 0, banner: null, sts: {}, final: null,
    rr: b, skips: b, bans: b, banned: new Set(),   // 상자에서 쓰는 리롤 · 스킵 · 제외 · 제외한 카드(t + id)
  }
  S = null; addWeapon(ch.w); stats(); pl.hp = S.maxHp
  cam.x = cam.y = 0; shake = 0; calm()
  say(`토벌 시작! ${FINAL_T / 60}분 뒤 세이렌이 온다`, 2.6)
}
function startGame(i) { pickCi = i; newGame(CHARS[i]); mode = 'play'; ui.hidden = true; pauseBtn.hidden = false; still = 2 }

function stats() {
  const m = G.ch.mod, L = id => G.passives[id] || 0, old = S?.maxHp
  S = {
    might: 1 + 0.1 * L('license') + 0.02 * Math.min(25, G.cheer) + (m.might || 0),
    armor: L('armor') + (m.armor || 0),
    maxHp: Math.round(G.ch.hp * (1 + 0.2 * L('manju') + (m.hp || 0))),
    regen: 0.2 * L('pudding') + (m.regen || 0),
    cdr: Math.max(0.45, 1 - 0.08 * L('clock') - (m.cdr || 0)),
    area: 1 + 0.1 * L('mega') + (m.area || 0),
    move: 1 + 0.1 * L('slipper') + (m.move || 0),
    speed: 1 + 0.1 * L('wind') + (m.speed || 0),
    dur: 1 + 0.1 * L('bento') + (m.dur || 0),
    amount: L('double') + (m.amount || 0),
    magnet: 80 * (1 + 0.3 * L('pouch') + (m.magnet || 0)),
    luck: 1 + 0.1 * L('clover') + (m.luck || 0),
    growth: 0.8 * (1 + 0.08 * L('wage') + (m.growth || 0)),   // 줍는 경험치 — 기본 0.8배
    crit: 0.03 + 0.02 * L('clover') + (m.crit || 0),
    critX: 2 + (m.critX || 0),
    bossX: 1 + (m.bossX || 0),   // 보스 · 정예에게
  }
  if (old && S.maxHp > old) pl.hp += S.maxHp - old
}
function wstat(w) {
  const d = WEAP[w.id], st = { cd: d.cd, dmg: d.dmg, n: d.n || 1, area: 1, spd: 1, dur: d.dur || 0, pierce: d.pierce || 0, bounce: d.bounce || 0 }
  for (const up of d.ups.slice(0, w.lv - 1)) for (const k in up) st[k] += up[k]
  const s = synOf(w.id)
  if (G.weapons.some(x => x.id === mateOf(w.id))) for (const k in s[1][w.id]) st[k] += s[1][w.id][k]
  return st
}
function addWeapon(id) {
  const w = { id, lv: 1, t: 0.3, q: 0, qt: 0, n: 0, ang: 0, on: 0, list: [] }
  G.weapons.push(w); w.st = wstat(w)
  const m = G.weapons.find(x => x.id === mateOf(id))
  if (m) { m.st = wstat(m); say(`시너지 — ${synOf(id)[0]}`, 2.4, '#ffb366') }
}

// 적 찾기 — 72 칸 격자(매 프레임 다시). near = 몸이 원에 닿는 적마다(fn 이 true 면 그만)
const CELL = 72, grid = new Map(), gk = (gx, gy) => (gx + 32768) * 65536 + gy + 32768
function regrid() {
  grid.clear()
  for (const e of G.foes) { if (e.dead) continue; const k = gk(Math.floor(e.x / CELL), Math.floor(e.y / CELL)); const a = grid.get(k); a ? a.push(e) : grid.set(k, [e]) }
}
function near(x, y, r, fn) {
  const R = r + 40, x0 = Math.floor((x - R) / CELL), x1 = Math.floor((x + R) / CELL), y0 = Math.floor((y - R) / CELL), y1 = Math.floor((y + R) / CELL)
  for (let gx = x0; gx <= x1; gx++) for (let gy = y0; gy <= y1; gy++) {
    const a = grid.get(gk(gx, gy)); if (!a) continue
    for (const e of a) { if (e.dead) continue; const dx = e.x - x, dy = e.y - y, q = r + e.r; if (dx * dx + dy * dy < q * q && fn(e)) return }
  }
}
function closest(n, x = pl.x, y = pl.y, skip = null, max = 1e9) {
  const out = []
  for (const e of G.foes) {
    if (e.dead || e.rush || skip?.has(e)) continue
    const d = (e.x - x) ** 2 + (e.y - y) ** 2
    if (d > max * max || (out.length >= n && d >= out[out.length - 1][1])) continue
    out.push([e, d]); out.sort((a, b) => a[1] - b[1]); if (out.length > n) out.pop()
  }
  return out.map(o => o[0])
}
const onScreen = (e, m = 0) => Math.abs(e.x - cam.x) < VW / 2 + m && Math.abs(e.y - cam.y) < VH / 2 + m
const toward = (e, x = pl.x, y = pl.y) => { const dx = e.x - x, dy = e.y - y, d = Math.hypot(dx, dy) || 1; return [dx / d, dy / d] }
const alive = e => e && !e.dead ? e : null
const visible = () => G.foes.filter(e => !e.dead && !e.rush && onScreen(e))
const slow = (e, T, k) => { if (e.boss) return; if (e.slow <= 0 || k <= e.sk) { e.sk = k; e.slow = Math.max(e.slow, T) } }   // T 초 동안 속도 k 배(보스는 안 걸린다)
const fx = o => { if (G.fx.length < 220) G.fx.push({ t: 0, ...o }) }
const part = (x, y, vx, vy, col, T, r) => { if (G.parts.length < 360) G.parts.push({ x, y, vx, vy, col, t: 0, T, r }) }
const num = (x, y, v, kind) => { if (G.nums.length > 60) G.nums.shift(); G.nums.push({ x: x + (rnd() - 0.5) * 10, y, v, kind, t: 0 }) }
const say = (s, T = 1.6, col = '#fff') => { G.banner = { s, t: 0, T, col } }
function splash(x, y, R, dmg, col, sea = 1) { near(x, y, R, e => { hurt(e, dmg, x, y, 60, sea) }); fx({ k: 'boom', x, y, R, col, T: 0.35 }) }

// ---- 스킬 — 한 발씩(여러 개면 0.12초 간격으로)
const SASU = { chiikawa: '#ff9ab8', hachiware: '#7fa6dc', kani: '#a9b1bc' }   // 사스마타 색 — 치이카와 분홍 · 하치와레 파랑 · 카니 회색
const SHOT = {
  sasu(w, st, i, A, D) {
    const e = alive(w.list[i % (w.list.length || 1)]) || closest(1)[0], [dx, dy] = e ? toward(e) : pl.face, v = 520 * st.spd * S.speed
    G.shots.push({ k: 'ball', col: SASU[G.ch.id] || '#d6dde6', x: pl.x, y: pl.y, vx: dx * v, vy: dy * v, r: 9 * Math.sqrt(A), dmg: D, pierce: st.pierce, kb: 70, life: 0.75, t: 0, hit: new Set() })
  },
  stick(w, st, i, A, D) {   // 양옆(첫 번째) · 위아래(두 번째)로 휘두르고 양 끝이 터진다
    const vert = i % 2 === 1, L = 92 * A, Wd = 24 * A, cy = pl.y - 8
    near(pl.x, cy, L + Wd, e => { const ex = Math.abs(e.x - pl.x), ey = Math.abs(e.y - cy); if (vert ? ex < Wd + e.r && ey < L * 0.8 + e.r : ey < Wd + e.r && ex < L + e.r) hurt(e, D, pl.x, cy, 120) })
    for (const s of [-1, 1]) splash(pl.x + (vert ? 0 : s * L), cy + (vert ? s * L * 0.8 : 0), 34 * A, D * 0.7, '#ff8a3d')
    fx({ k: 'swing', x: pl.x, y: cy, L, vert, T: 0.22 }); shake = Math.max(shake, 1.5)
  },
  yaha(w, st, i, A, D) { pl.jump = 0.3; G.shots.push({ k: 'ring', x: pl.x, y: pl.y, t: -0.26, T: 0.32, R: 92 * A, dmg: D, hit: new Set() }) },
  weed(w, st, i, A, D) { const c = closest(10), e = c.length ? pickOf(c) : null; G.shots.push({ k: 'drop', x: e ? e.x : pl.x + (rnd() - 0.5) * 320, y: e ? e.y : pl.y + (rnd() - 0.5) * 320, t: 0, T: 0.5, R: 46 * A, dmg: D }) },
  tears(w, st, i, A, D) {   // 멀리(150 밖) 있는 화면 안 적 — 움직이는 쪽을 미리 겨눈다
    const far = visible().filter(e => (e.x - pl.x) ** 2 + (e.y - pl.y) ** 2 > 150 * 150), e = far.length ? pickOf(far) : closest(1)[0], T = 0.6 / Math.sqrt(st.spd * S.speed)
    const x1 = e ? e.x + e.vx * T : pl.x + pl.face[0] * 260, y1 = e ? e.y + e.vy * T : pl.y + pl.face[1] * 260
    G.shots.push({ k: 'arc', x0: pl.x, y0: pl.y, x1, y1, x: pl.x, y: pl.y, t: 0, T, H: 120, R: 54 * A, dmg: D, u: 0 })
  },
  nantoka(w, st, i, A, D) {   // 화면 안 아무 적에게 하늘에서 지그재그로
    const c = visible(); if (!c.length) return
    const e = pickOf(c), R = 32 * A, { x, y } = e
    near(x, y, R, f => { hurt(f, D, x, y, 80) })
    fx({ k: 'bolt', x, y, R, pts: zig(x + (rnd() - 0.5) * 60, y - 440, x, y - 6), T: 0.3 }); fx({ k: 'boom', x, y, R, col: '#ffe066', T: 0.3 })
    shake = Math.max(shake, 2)
  },
  ramen(w, st, i, A, D) { const a = rnd() * TAU, d = 50 + rnd() * 90; G.shots.push({ k: 'zone', x: pl.x + Math.cos(a) * d, y: pl.y + Math.sin(a) * d, R: 45 * A, dmg: D, tick: 0, t: 0, life: st.dur * S.dur }) },
  curry(w, st, i, A, D) {   // 가까운 적 12 중 둘레에 적이 가장 많은 자리(이미 냄비가 있는 자리는 빼고)
    const R = 62 * A
    let best = null, bn = 0
    for (const e of closest(12, pl.x, pl.y, null, 420)) {
      if (G.shots.some(b => b.k === 'pot' && (b.x - e.x) ** 2 + (b.y - e.y) ** 2 < R * R)) continue
      let n = 0; near(e.x, e.y, R, () => { n++ })
      if (n > bn) { bn = n; best = e }
    }
    G.shots.push({ k: 'pot', x: best ? best.x : pl.x + pl.face[0] * 140, y: best ? best.y : pl.y + pl.face[1] * 140, t: 0, T: 1, R, dmg: D })
  },
  pochette(w, st, i, A, D) { const e = closest(i + 1)[i] || closest(1)[0], [dx, dy] = e ? toward(e) : pl.face, s = st.spd * S.speed; G.shots.push({ k: 'boom', x: pl.x, y: pl.y, dx, dy, v: 600 * s, acc: -800 * s, r: 11 * A, dmg: D, hit: new Map(), t: 0, life: 2.4, a: 0 }) },
  momo(w, st, i, A, D) {   // 가장 강한 적에게 달려들어 낚아챈다
    const e = alive(w.list[i]) || strongest(1)[0]; if (!e) return
    hurt(e, D, pl.x, pl.y, 60); fx({ k: 'grab', x0: pl.x, y0: pl.y - 16, x: e.x, y: e.y - e.r * 1.4, T: 0.3 })
  },
  kanpai(w, st, i, A, D) { const e = alive(w.list[i % (w.list.length || 1)]) || closest(1)[0], [dx, dy] = e ? toward(e) : pl.face, v = 500 * st.spd * S.speed; G.shots.push({ k: 'ball', look: 'cup', x: pl.x, y: pl.y, vx: dx * v, vy: dy * v, r: 8 * Math.sqrt(A), dmg: D, pierce: 1, bounce: st.bounce, kb: 40, life: 1.3, t: 0, hit: new Set() }) },
  sword(w, st, i, A, D) {   // 화면 안 아무 적 쪽으로 화면을 가로지르는 칼바람
    const c = visible(), e = c.length ? pickOf(c) : null, a = e ? Math.atan2(e.y - pl.y, e.x - pl.x) : Math.atan2(pl.face[1], pl.face[0])
    const x = pl.x, y = pl.y - 14, dx = Math.cos(a), dy = Math.sin(a), L = Math.max(VW, VH) * 0.9, W = 15 * A
    for (const f of G.foes) { if (f.dead) continue; const ex = f.x - x, ey = f.y - f.r - y, u = ex * dx + ey * dy; if (u > 0 && u < L && Math.abs(ex * dy - ey * dx) < W + f.r) hurt(f, D, x, y, 50) }
    fx({ k: 'beam', x, y, a, L, W, T: 0.3 })
  },
}
/** 화면 안 강한 순 n — 보스 > 정예 > 남은 피 */
function strongest(n) { const v = e => (e.boss ? 2e9 : e.elite ? 1e9 : 0) + e.hp; return visible().sort((a, b) => v(b) - v(a)).slice(0, n) }
/** 번개 — (x0, y0) 에서 (x1, y1) 까지 지그재그 아홉 점 */
function zig(x0, y0, x1, y1) {
  const dx = x1 - x0, dy = y1 - y0, L = Math.hypot(dx, dy) || 1, pts = [[x0, y0]]
  for (let i = 1; i < 8; i++) { const u = i / 8, j = (rnd() - 0.5) * 0.08 * L * (1 - u); pts.push([x0 + dx * u - dy / L * j, y0 + dy * u + dx / L * j]) }
  pts.push([x1, y1])
  return pts
}
function weapons(dt) {
  for (const w of G.weapons) {
    const st = w.st, A = st.area * S.area, D = st.dmg * S.might * (G.ch.mod.clutch && pl.hp < S.maxHp / 2 ? 1 + G.ch.mod.clutch : 1)   // 치이카와 — 체력 절반 아래
    if (w.id === 'ura') {   // 쿨타임마다 둘레 전부
      w.R = 70 * A; w.pulse = Math.max(0, (w.pulse || 0) - dt)
      if ((w.t -= dt) <= 0) {
        w.t = Math.max(0.2, st.cd * S.cdr); w.pulse = 0.2; near(pl.x, pl.y, w.R, e => { hurt(e, D, pl.x, pl.y, 30) })
        if (rnd() < 0.08) fx({ k: 'text', x: pl.x + (rnd() - 0.5) * 30, y: pl.y - 50, s: '우라!', col: '#ffd23f', T: 0.7 })
      }
      continue
    }
    if (w.id === 'guitar') {   // 켜져 있는 동안 음표가 돈다
      w.ang += dt * 3.4 * st.spd * S.speed
      if (w.on > 0) { if ((w.on -= dt) <= 0) w.t = st.cd * S.cdr }
      else if ((w.t -= dt) <= 0) {
        const n = st.n + S.amount; w.on = st.dur * S.dur
        for (let i = 0; i < n; i++) G.shots.push({ k: 'orb', w, i, n, R: 80 * A, r: 10 * Math.sqrt(A), dmg: D, life: w.on, hit: new Map(), x: pl.x, y: pl.y, t: 0 })
      }
      continue
    }
    if (w.q > 0) { if ((w.qt -= dt) <= 0) { SHOT[w.id](w, st, w.n - w.q, A, D); w.q--; w.qt = 0.12 } }
    else if ((w.t -= dt) <= 0) { w.n = w.q = st.n + S.amount; w.qt = 0; w.t = st.cd * S.cdr; w.list = w.id === 'sasu' || w.id === 'kanpai' ? closest(w.n) : w.id === 'momo' ? strongest(w.n) : [] }
  }
}

// ---- 적
const HPK = [1, 1.4, 1.8, 2.3, 4.3, 13, 26]   // 보통 적 피 배수 — 0 · 5 · 10 … 30분, 사이는 잇는다
const hpK = m => { const i = Math.min(5, m / 5 | 0); return HPK[i] + (HPK[i + 1] - HPK[i]) * Math.min(1, m / 5 - i) }
function spawn(type, x, y) {
  const F = FOES[type], m = G.t / 60, mm = Math.min(m, 30), big = type in BOSS
  const hp = F.hp * (big ? 1 + mm * 0.25 : hpK(mm))
  const e = {
    type, v: 0, x: 0, y: 0, r: F.r, hp, max: hp, spd: F.spd * (0.9 + rnd() * 0.2), dmg: F.dmg * (1 + m * 0.055), xp: F.xp,
    vx: 0, vy: 0, kx: 0, ky: 0, flash: 0, slow: 0, fx: 1, seed: rnd() * 10, cd: 1 + rnd() * 2, st: 'walk', stT: 3, dx: 0, dy: 0, age: 0, z: 0,
    elite: type === 'golden', boss: big, kind: big ? type : null, heavy: type === 'dekatsu' || type === 'golden',
  }
  if (x === undefined) ring(e); else { e.x = x; e.y = y }
  G.foes.push(e)
  return e
}
/** 보스 · 중간보스(작고 피 40%) — 나오면서 한마디 */
function summon(kind, mid = false) {
  const e = spawn(kind), B = BOSS[kind]
  if (mid) { e.mid = true; e.max *= 0.4; e.hp = e.max; e.r *= 0.8; e.sc = 0.8; e.xp = Math.round(e.xp * 0.3) }
  Object.assign(e, { castT: G.t + 6 + rnd() * 4, patT: 2.5 + rnd(), pat: 0 })
  bubble(e, B.line, '#fff')
  say(mid ? `중간보스 — ${B.name}` : `${B.name} 등장!`, 2.2, mid ? '#ffb35e' : '#ff6b6b'); shake = Math.max(shake, mid ? 4 : 8)
  return e
}
const bubble = (e, s, col) => fx({ k: 'shout', e, s, col, T: 1.8 })
/** 최종보스 — 세이렌 + 둘레를 도는 인어 셋. 인어가 살아 있는 동안 세이렌은 받는 피해 -50% */
function finale() {
  const s = summon('siren'); s.sea = true
  G.final = { siren: s, mermaids: [] }
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * TAU, m = spawn('mermaid', s.x + Math.cos(a) * 130, s.y + Math.sin(a) * 100)
    Object.assign(m, { v: i, sea: true, orb: a, patT: 2 + i, pat: 0, castT: Infinity })
    G.final.mermaids.push(m)
  }
  say('최종보스 — 세이렌! 인어부터 쓰러뜨리자', 3.2, '#ff7ad9'); shake = 10
}
const guarded = () => G.final?.mermaids.some(m => !m.dead)
/** 화면 바로 바깥 — ahead 면 가는 쪽 앞에 */
function ring(e, ahead = false) {
  const hw = VW / 2 + 40, hh = VH / 2 + 50
  const a = ahead ? Math.atan2(pl.face[1], pl.face[0]) + (rnd() - 0.5) * 2.2 : rnd() * TAU, c = Math.cos(a), s = Math.sin(a)
  const t = Math.min(hw / Math.max(1e-6, Math.abs(c)), hh / Math.max(1e-6, Math.abs(s)))
  e.x = pl.x + c * t; e.y = pl.y + s * t
}
function spawner(dt) {
  const m = G.t / 60, want = Math.min(MAX_FOES, (22 + m * 10 + m * m * 0.45) * (G.final ? 0.5 : 1))
  if ((G.spawnT -= dt) <= 0) {
    G.spawnT = Math.max(0.09, 0.55 - m * 0.02)
    const n = Math.min(want - G.foes.length, 1 + (m / 1.8 | 0))
    for (let i = 0; i < n; i++) {
      const w = [['goblin', 1], ['chimera', m >= 1 ? 0.5 + m * 0.03 : 0], ['spiker', m >= 6 ? 0.1 + (m - 6) * 0.035 : 0], ['dekatsu', m >= 4 ? 0.1 + m * 0.03 : 0]]
      let q = rnd() * w.reduce((s, x) => s + x[1], 0), type = 'goblin'
      for (const [k, v] of w) if ((q -= v) < 0) { type = k; break }
      spawn(type)
    }
  }
  while (G.pi < PLAN.length && G.t >= PLAN[G.pi][0]) { const [, kind, mid] = PLAN[G.pi++]; summon(kind, !!mid) }
  if (!G.final && G.t >= FINAL_T) finale()
  if (G.t >= G.nextElite) { spawn('golden'); G.nextElite += m < 10 ? 60 : 40 }
  if (G.t >= G.nextSwarm) {   // 꼬마 키메라가 사방에서 둘러싼다
    const n = 18 + (m * 2.5 | 0), R = Math.max(VW, VH) * 0.62
    for (let i = 0; i < n; i++) { const a = i / n * TAU; spawn('chimera', pl.x + Math.cos(a) * R, pl.y + Math.sin(a) * R) }
    G.nextSwarm += 120; say('키메라 떼가 몰려온다!', 1.8)
  }
  if (!G.final && G.t >= G.nextEvt) { event(m); G.nextEvt = G.t + (m < 15 ? 30 + rnd() * 12 : m < 20 ? 22 + rnd() * 8 : 15 + rnd() * 4) }
}
// ---- 변수 기술 — 10분부터. 스킬로 못 막는다 — 보고 피해야 한다. 피해는 최대 체력의 f
const pct = f => S.maxHp * f
function event(m) {
  if (m < 12 || rnd() < 0.55) {   // 고블린 폭탄 — 붉은 원이 다 차면 터진다. 첫 원은 내 발밑
    const n = Math.min(14, 5 + ((m - 10) / 2 | 0)), dmg = pct(0.13 + clamp((m - 10) / 12, 0, 1) * 0.07)
    for (let i = 0; i < n; i++) { const a = rnd() * TAU, d = i ? 40 + rnd() * 220 : 0; G.haz.push({ k: 'bomb', x: pl.x + Math.cos(a) * d, y: pl.y + Math.sin(a) * d, R: 60, t: -i * 0.1, T: 1.3, dmg, col: '#ff4d4d' }) }
    say('고블린 폭탄!', 1.2, '#ff6b6b')
  } else {   // 고블린 돌격대 — 한쪽에서 줄지어 달려온다. 초록 줄(빈자리)로 피하기
    const horiz = rnd() < 0.5
    G.haz.push({ k: 'rush', t: 0, T: 1.2, horiz, dir: rnd() < 0.5 ? 1 : -1, gap: (horiz ? cam.y : cam.x) + (rnd() - 0.5) * (horiz ? VH : VW) * 0.6, dmg: pct(0.14) })
    say('고블린 돌격대!', 1.2, '#ff6b6b')
  }
}
function rushNow(z) {
  const H = z.horiz, from = H ? cam.x - z.dir * (VW / 2 + 30) : cam.y - z.dir * (VH / 2 + 30), c = H ? cam.y : cam.x, half = (H ? VH : VW) / 2 + 20
  for (let q = c - half; q <= c + half; q += 36) {
    if (Math.abs(q - z.gap) < 58) continue
    const e = spawn('rusher', H ? from - z.dir * rnd() * 16 : q, H ? q : from - z.dir * rnd() * 16)
    e.rush = [H ? z.dir * 400 : 0, H ? 0 : z.dir * 400]; e.dmg = z.dmg
  }
}
function foes(dt) {
  const far = Math.max(VW, VH) * 0.85 + 120, frozen = G.freeze > 0
  for (const e of G.foes) {
    if (e.dead) continue
    e.flash -= dt; e.age += dt
    let dx = pl.x - e.x, dy = pl.y - e.y
    const d = Math.hypot(dx, dy) || 1
    dx /= d; dy /= d
    if (e.rush) {   // 돌격대 — 곧장 가로지른다(느려지지도 밀리지도 않는다). 화면을 한참 지나면 사라진다
      if (!frozen) { e.x += e.rush[0] * dt; e.y += e.rush[1] * dt }
      e.fx = e.rush[0] < 0 ? -1 : 1
      if (Math.abs(e.x - cam.x) > VW + 200 || Math.abs(e.y - cam.y) > VH + 200) e.dead = true
      else if (!frozen && d < e.r + pl.r - 2) ouch(e.dmg)
      continue
    }
    if (!e.boss && d > far) { ring(e, true); continue }   // 너무 멀어진 적은 앞쪽으로 다시
    e.slow -= dt
    if (frozen && !e.leap) e.vx = e.vy = 0
    else if (e.boss) bossAI(e, dt, dx, dy, d)
    else { const sp = e.spd * (e.slow > 0 ? e.sk : 1); e.vx = dx * sp; e.vy = dy * sp }
    near(e.x, e.y, e.r * 0.6, o => { if (o === e || o.rush) return; const ox = e.x - o.x, oy = e.y - o.y, q = Math.hypot(ox, oy) || 0.01, push = (e.r * 0.6 + o.r - q) * 0.35; e.x += ox / q * push; e.y += oy / q * push })   // 서로 밀어 겹치지 않게
    e.x += (e.vx + e.kx) * dt; e.y += (e.vy + e.ky) * dt
    const f = Math.exp(-9 * dt); e.kx *= f; e.ky *= f
    if (Math.abs(dx) > 0.15) e.fx = dx > 0 ? 1 : -1
    if (!frozen && e.type === 'spiker' && d < 330 && (e.cd -= dt) <= 0) { e.cd = 2.6 + rnd(); G.eshots.push({ k: 'spike', x: e.x, y: e.y, vx: dx * 210, vy: dy * 210, t: 0, life: 2.6, dmg: e.dmg + 1, r: 5 }) }
    if (!frozen && d < e.r + pl.r - 2 && e.z < 20) ouch((e.boss ? Math.max(e.dmg, pct(e.mid ? 0.08 : 0.1)) : e.dmg) * (e.st === 'dash' ? 1.5 : 1))   // 뛰어오른 보스는 안 닿는다
  }
}
// 돌진 — 걷다가 멈칫(붉게) 하고 그 방향으로
function charge(e, dt, dx, dy) {
  e.stT -= dt
  if (e.st === 'walk') { e.vx = dx * e.spd; e.vy = dy * e.spd; if (e.stT <= 0) { e.st = 'wind'; e.stT = 0.7; e.dx = dx; e.dy = dy } }
  else if (e.st === 'wind') { e.vx = e.vy = 0; e.flash = 0.05 * ((G.t * 12 | 0) % 2); if (e.stT <= 0) { e.st = 'dash'; e.stT = 0.75 } }
  else { e.vx = e.dx * e.spd * 4; e.vy = e.dy * e.spd * 4; if (e.stT <= 0) { e.st = 'walk'; e.stT = 2.6 + rnd() * 1.4 } }
}
// 보스 — 종류마다 다른 기술. 기술 전에는 멈춰 깜빡인다(act) — 보고 피할 수 있게
function bossAI(e, dt, dx, dy, d) {
  if (e.leap) return leapStep(e, dt)
  if (e.kind === 'siren' && !e.angry && e.hp < e.max / 2) { e.angry = true; bubble(e, '…용서 못 해!', '#ff4d4d'); say('세이렌이 화났다! 눈이 붉어졌다', 2, '#ff4d4d') }
  if (e.act) { e.vx = e.vy = 0; e.flash = 0.05 * ((G.t * 12 | 0) % 2); if ((e.act.t -= dt) <= 0) { const a = e.act; e.act = null; ACT[a.k](e, a) } return }
  if (e.st !== 'walk') return charge(e, dt, dx, dy)
  const B = BOSS[e.kind]
  if (B.st && !e.mid && G.t >= e.castT) {   // 상태이상 — 이름을 외치고 0.8초 뒤 물결이 퍼진다
    e.castT = G.t + B.stCd
    e.act = { k: 'wave', id: B.st, t: 0.8 }; bubble(e, `${STATUS[B.st].name}!`, STATUS[B.st].col)
    return
  }
  if (e.kind === 'dekatsuyo') return charge(e, dt, dx, dy)
  const sp = e.spd
  if (e.kind === 'mermaid') {   // 세이렌 둘레를 돈다
    const s = alive(G.final?.siren), cx = s ? s.x : pl.x, cy = s ? s.y : pl.y
    e.orb += dt * 0.7
    const tx = cx + Math.cos(e.orb) * 130 - e.x, ty = cy + Math.sin(e.orb) * 100 - e.y, q = Math.hypot(tx, ty) || 1, v = Math.min(sp * 1.6, q * 4)
    e.vx = tx / q * v; e.vy = ty / q * v
  } else {   // 세이렌 · 고블린 대장은 거리를 두고 옆으로 돈다, 나머지는 다가온다
    const keep = e.kind === 'siren' ? 240 : e.kind === 'goblinKing' ? 190 : 0
    if (keep && d < keep - 40) { e.vx = -dx * sp; e.vy = -dy * sp }
    else if (keep && d < keep + 60) { const s = e.seed > 5 ? 1 : -1; e.vx = -dy * sp * s; e.vy = dx * sp * s }
    else { e.vx = dx * sp; e.vy = dy * sp }
  }
  if ((e.patT -= dt) > 0) return
  switch (e.kind) {
    case 'goblinKing':
      if (!e.mid && e.pat++ % 3 === 2) { e.patT = 2.6; e.act = { k: 'squad', t: 0.6 }; bubble(e, '모여라!', '#fff') }
      else { e.patT = e.mid ? 3.2 : 2.3; e.act = { k: 'volley', n: e.mid ? 3 : 5, t: 0.45, shot: 'rock' } }
      break
    case 'bigChimera': e.patT = e.mid ? 5.5 : 4; leap(e); break
    case 'mermaid': e.patT = 3 + rnd() * 1.5; Object.assign(e, { st: 'wind', stT: 0.55, dx, dy }); break   // 날카로운 이빨로 달려들어 문다(charge)
    case 'anoko': e.patT = 2.4; [() => Object.assign(e, { st: 'wind', stT: 0.7, dx, dy }), () => { e.act = { k: 'sweep', t: 0.5 }; bubble(e, '꼬리!', '#4f9a8c') }, () => { e.act = { k: 'volley', n: 5, t: 0.45, shot: 'claw' } }][e.pat++ % 3](); break
    case 'siren': e.patT = e.angry ? 2 : 2.6; [() => { e.act = { k: 'notes', t: 0.5 } }, () => { e.act = { k: 'vines', t: 0.3 }; bubble(e, '덩굴아!', '#58b947') }, () => { e.act = { k: 'slam', t: 0.35 }; bubble(e, '꼬리치기!', '#ff8a8a') }][e.pat++ % 3](); break
  }
}
const ACT = {
  volley(e, a) {   // 부채꼴로 던진다
    const q0 = Math.atan2(pl.y - e.y, pl.x - e.x), v = e.mid ? 230 : 265
    for (let i = 0; i < a.n; i++) { const q = q0 + (i - (a.n - 1) / 2) * 0.17; G.eshots.push({ k: a.shot, x: e.x, y: e.y, vx: Math.cos(q) * v, vy: Math.sin(q) * v, t: 0, life: 3.2, dmg: pct(e.mid || e.kind === 'mermaid' ? 0.07 : 0.09), r: 8 }) }
  },
  notes(e) {   // 음표를 사방으로 — 매번 반 칸씩 돌려서
    const n = 16, o = (e.pat % 2) * Math.PI / n
    for (let i = 0; i < n; i++) { const q = o + i / n * TAU; G.eshots.push({ k: 'note', x: e.x, y: e.y, vx: Math.cos(q) * 170, vy: Math.sin(q) * 170, t: 0, life: 3.4, dmg: pct(0.06), r: 7 }) }
  },
  squad() { for (let i = 0; i < 8; i++) { const q = i / 8 * TAU; spawn('goblin', pl.x + Math.cos(q) * 230, pl.y + Math.sin(q) * 230) } },   // 부하를 불러 나를 에워싼다
  sweep(e) { G.haz.push({ k: 'bomb', x: e.x, y: e.y, R: 150, t: 0, T: 1, dmg: pct(0.18), col: '#4f9a8c' }) },   // 용 꼬리로 둘레를 휩쓴다 — 멀리 벗어나기
  vines() { for (let i = 0; i < 7; i++) { const a = rnd() * TAU, d = i ? 50 + rnd() * 180 : 0; G.haz.push({ k: 'bomb', x: pl.x + Math.cos(a) * d, y: pl.y + Math.sin(a) * d, R: 55, t: -i * 0.12, T: 1.15, dmg: pct(0.12), col: '#58b947' }) } },   // 노래로 땅에서 덩굴을 솟게 한다
  slam() { G.haz.push({ k: 'land', x: pl.x, y: pl.y, R: 100, t: 0, T: 1, dmg: pct(0.2), col: '#ff4d4d' }) },   // 큰 꼬리로 내려친다
  wave(e, a) { fx({ k: 'wave', x: e.x, y: e.y, R: 360, T: 0.8, st: a.id, col: STATUS[a.id].col }) },
}
/** 거대 키메라 — 내 자리(움직이면 조금 앞)에 뛰어내린다. 바닥의 붉은 원이 다 차면 쿵 */
function leap(e) {
  const x = pl.x + (pl.moving ? pl.face[0] * 50 : 0), y = pl.y + (pl.moving ? pl.face[1] * 50 : 0), T = e.mid ? 1.15 : 1
  e.leap = { x0: e.x, y0: e.y, x1: x, y1: y, t: 0, T }
  G.haz.push({ k: 'land', x, y, R: e.mid ? 85 : 110, t: 0, T, dmg: pct(e.mid ? 0.18 : 0.26), col: '#ff9f43' })
}
function leapStep(e, dt) {
  const L = e.leap, u = Math.min(1, (L.t += dt) / L.T)
  e.vx = e.vy = 0; e.x = L.x0 + (L.x1 - L.x0) * u; e.y = L.y0 + (L.y1 - L.y0) * u; e.z = Math.sin(u * Math.PI) * 140
  if (u >= 1) { e.leap = null; e.z = 0 }
}
const sick = id => G.sts[id] > G.t
function afflict(id) {
  G.sts[id] = G.t + ST_T
  fx({ k: 'text', x: pl.x, y: pl.y - 70, s: STATUS[id].name, col: STATUS[id].col, T: 1.6 }); fx({ k: 'flash', x: pl.x, y: pl.y - 20, R: 70, col: STATUS[id].col, T: 0.5 })
}
/** sea — 인어 · 세이렌에게 곱하는 배수(극매운 카레) */
function hurt(e, dmg, ox, oy, kb = 0, sea = 1) {
  if (e.dead || e.rush) return   // 돌격대는 스킬에 안 맞는다 — 피하는 수밖에
  const crit = rnd() < S.crit
  dmg *= (sick('weak') ? 0.6 : 1) * (e.boss || e.elite ? S.bossX : 1) * (e.sea ? sea : 1) * (e.kind === 'siren' && guarded() ? 0.5 : 1)
  dmg = Math.max(1, Math.round(dmg * (crit ? S.critX : 1) * (0.9 + rnd() * 0.2)))
  e.hp -= dmg; e.flash = 0.1
  if (kb && !e.heavy && !e.boss) { const dx = e.x - ox, dy = e.y - oy, d = Math.hypot(dx, dy) || 1; e.kx += dx / d * kb; e.ky += dy / d * kb }   // 밀리는 건 작은 적만
  num(e.x, e.y - e.r * 2.6, dmg, crit ? 'crit' : '')
  if (e.hp <= 0) kill(e)
}
function kill(e, quiet = false) {
  e.dead = true
  if (!quiet) { G.kills++; gem(e.x, e.y, e.xp) }
  const col = FOES[e.type].col
  if (G.fx.length < 180) fx({ k: 'puff', x: e.x, y: e.y - e.r, R: e.r * 1.4, T: 0.4 })
  for (let i = 0; i < (e.boss ? 36 : e.elite ? 14 : 3); i++) { const a = rnd() * TAU, s = 40 + rnd() * (e.boss ? 240 : 110); part(e.x, e.y - e.r, Math.cos(a) * s, Math.sin(a) * s - 60, i % 3 ? col : '#fff', 0.35 + rnd() * 0.35, 2 + rnd() * (e.boss ? 4 : 2.5)) }
  if (quiet) return
  if (e.elite || e.mid) { if (rnd() < 0.33 * S.luck) item(e.x, e.y); for (let i = 0; i < 3; i++) gem(e.x + (rnd() - 0.5) * 40, e.y + (rnd() - 0.5) * 40, e.mid ? 10 : 5) }
  else if (!e.boss && rnd() < 0.0013 * S.luck) item(e.x, e.y, rnd() < 0.6 ? 'onigiri' : 'magnet')
  else if (!e.boss && G.t >= 600 && rnd() < 0.0005 * S.luck) item(e.x, e.y, 'earplug')
  if (!e.boss) return
  const B = BOSS[e.kind]
  if (e.kind === 'mermaid') say(guarded() ? '인어 격파!' : '세이렌의 보호막이 사라졌다!', 2, '#7fd8ff')
  else if (e.kind === 'siren') {   // 클리어 — 남은 적은 모두 도망친다
    G.bosses++; G.won = 2.8; say('세이렌 격파! 토벌 성공!', 3, '#ffd23f')
    for (const f of G.foes) if (!f.dead) kill(f, true)
  } else if (e.mid) say(`${B.name} 격파!`, 1.6, '#ffb35e')
  else { G.bosses++; item(e.x, e.y, 'chest'); say(`${B.name} 격파!`, 2.2, '#ffd23f') }
  shake = e.mid ? 6 : 10; fx({ k: 'ring', x: e.x, y: e.y, R: e.mid ? 120 : 180, T: 0.6, col: '#ffd23f' }); fx({ k: 'flash', x: e.x, y: e.y - 40, R: e.mid ? 110 : 160, col: '#ffd23f', T: 0.6 })
}
function ouch(d) {
  if (pl.inv > 0 || G.dying || G.won) return
  d = Math.max(1, Math.round(d - S.armor)); pl.hp -= d; pl.inv = 0.4; pl.hurtT = 0.35; shake = Math.max(shake, 4)
  num(pl.x, pl.y - 48, d, 'hurt')
  if (pl.hp <= 0) { pl.hp = 0; G.dying = 1.2; say('와아…', 1.5, '#ff6b6b') }
}

// ---- 경험치 · 줍는 것
function gem(x, y, v) {
  if (G.gems.length >= 360) {   // 너무 많으면 가장 먼(두고 온) 것을 여기로 옮겨 합친다 — 경험치는 그대로
    let far = G.gems[0], fd = -1
    for (const g of G.gems) { const d = (g.x - pl.x) ** 2 + (g.y - pl.y) ** 2; if (d > fd) { fd = d; far = g } }
    Object.assign(far, { x, y, v: far.v + v, pull: false, sp: 0 })
    return
  }
  G.gems.push({ x: x + (rnd() - 0.5) * 8, y: y + (rnd() - 0.5) * 8, v, pull: false, sp: 0 })
}
function item(x, y, k) {
  if (!k) { const q = rnd(); k = G.t >= 600 && q < 0.2 ? 'earplug' : q < 0.4 ? 'onigiri' : q < 0.65 ? 'magnet' : q < 0.8 ? 'momonga' : 'firework' }
  G.items.push({ x, y, k, t: 0 })
}
const USE = {
  onigiri: () => { const v = Math.round(S.maxHp * 0.3); pl.hp = Math.min(S.maxHp, pl.hp + v); num(pl.x, pl.y - 48, `+${v}`, 'heal') },
  magnet: () => { for (const g of G.gems) g.pull = true; say('자석 — 경험치를 다 모은다', 1.2) },
  momonga: () => { G.freeze = 6; say('모몽가의 귀여운 척! — 적이 멈췄다', 1.6, '#ffc2e0') },
  firework: () => {
    fx({ k: 'white', T: 0.4 }); shake = 8; say('펑! 펑!', 1.2, '#ff6b6b')
    for (const e of G.foes) if (!e.dead && !e.rush && onScreen(e, 40)) { if (e.boss) hurt(e, 300 * S.might, pl.x, pl.y); else kill(e) }
  },
  chest: () => G.queue.push('chest'),
  earplug: () => {
    if (Object.values(G.sts).some(t => t > G.t)) { G.sts = {}; say('상태이상 해제!', 1.4, '#7fd8ff') }
    else { const v = Math.round(S.maxHp * 0.15); pl.hp = Math.min(S.maxHp, pl.hp + v); num(pl.x, pl.y - 48, `+${v}`, 'heal') }
  },
}
function gainXp(v) {
  G.xp += v * S.growth
  while (G.xp >= G.next) { G.xp -= G.next; G.lvl++; G.next = need(G.lvl); G.queue.push('level') }
}

// ---- 한 프레임
function step(dt) {
  G.t += dt
  const dead = G.dying > 0
  if (dead && (G.dying -= dt / 0.3) <= 0) return finish(false)   // 쓰러지는 동안은 느린 화면(dt 는 0.3배로 들어온다)
  if (G.won && (G.won -= dt) <= 0) return finish(true)
  // 나
  let mx = key.r - key.l + joy.x, my = key.d - key.u + joy.y
  const m = Math.hypot(mx, my)
  pl.moving = m > 0.12 && !dead
  if (pl.moving) {
    pl.face = [mx / m, my / m]
    if (m > 1) { mx /= m; my /= m }
    if (Math.abs(mx) > 0.2) pl.fx = mx > 0 ? 1 : -1
    const sp = 150 * S.move * (sick('charm') ? 0.6 : 1)
    pl.x += mx * sp * dt; pl.y += my * sp * dt
  }
  const siren = alive(G.final?.siren)
  if (siren && sick('charm') && !dead) { const [dx, dy] = toward(siren); pl.x += dx * 55 * dt; pl.y += dy * 55 * dt }   // 매혹 — 세이렌 쪽으로 끌려간다
  pl.inv -= dt; pl.hurtT -= dt; pl.jump = Math.max(0, pl.jump - dt)
  if (!dead) pl.hp = Math.min(S.maxHp, pl.hp + S.regen * dt)
  G.freeze = Math.max(0, G.freeze - dt)
  cam.x += (pl.x - cam.x) * Math.min(1, dt * 8); cam.y += (pl.y - cam.y) * Math.min(1, dt * 8)
  regrid()
  if (!dead && !G.won) { spawner(dt); weapons(dt) }
  foes(dt)
  shots(dt)
  // 바닥 경고 — 원이 다 차면 터지고(안에 있으면 맞는다), 돌격대는 줄지어 나온다
  for (const z of G.haz) {
    if ((z.t += dt) < z.T) continue
    z.dead = true
    if (z.k === 'rush') { rushNow(z); continue }
    if (((pl.x - z.x) / (z.R + 4)) ** 2 + ((pl.y - z.y) / ((z.R + 4) * 0.8)) ** 2 < 1) ouch(z.dmg)
    fx({ k: 'ring', x: z.x, y: z.y, R: z.R, T: 0.4, col: z.col }); fx({ k: 'boom', x: z.x, y: z.y, R: z.R * 0.9, col: z.col, T: 0.35 })
    for (let i = 0; i < 8; i++) { const a = rnd() * TAU; part(z.x, z.y, Math.cos(a) * 160, Math.sin(a) * 90 - 80, i % 2 ? z.col : '#fff', 0.35, 2.6) }
    shake = Math.max(shake, z.k === 'land' ? 8 : 4)
  }
  for (const b of G.eshots) {   // 날아오는 것 — 피하는 수밖에
    b.t += dt
    if (G.freeze <= 0) { b.x += b.vx * dt; b.y += b.vy * dt }
    if ((b.x - pl.x) ** 2 + (b.y - pl.y) ** 2 < (pl.r + b.r) ** 2) { ouch(b.dmg); b.dead = true }
    if (b.t > b.life) b.dead = true
  }
  for (const g of G.gems) {   // 경험치 · 아이템 줍기
    const dx = pl.x - g.x, dy = pl.y - g.y, d = Math.hypot(dx, dy) || 1
    if (g.pull || d < S.magnet) { g.pull = true; g.sp = Math.min(1000, g.sp + 1620 * dt); const s = Math.min(d, g.sp * dt); g.x += dx / d * s; g.y += dy / d * s }
    if (d < pl.r + 8 && !dead) { g.dead = true; gainXp(g.v) }
  }
  for (const it of G.items) { it.t += dt; if (!dead && (it.x - pl.x) ** 2 + (it.y - pl.y) ** 2 < (pl.r + 16) ** 2) { it.dead = true; USE[it.k](); fx({ k: 'flash', x: pl.x, y: pl.y - 20, R: 70, col: '#ffffff', T: 0.35 }) } }
  // 효과
  for (const p of G.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.vx *= 0.97; if (p.t > p.T) p.dead = true }
  for (const f of G.fx) {
    f.t += dt; if (f.t > f.T) f.dead = true
    if (f.k === 'wave' && !f.done && !dead && Math.hypot(pl.x - f.x, (pl.y - f.y) / 0.8) <= f.R * Math.min(1, f.t / f.T)) { f.done = true; afflict(f.st) }   // 상태이상 물결이 나에게 닿으면
  }
  for (const n of G.nums) { n.t += dt; if (n.t > 0.7) n.dead = true }
  if (G.banner && (G.banner.t += dt) > G.banner.T) G.banner = null
  shake = Math.max(0, shake - dt * 30)
  for (const a of [G.foes, G.shots, G.eshots, G.gems, G.items, G.parts, G.fx, G.nums, G.haz]) prune(a)
  sortY(G.foes)
  if (G.queue.length && !dead && !G.won) openBox()
}
function prune(a) { let j = 0; for (const x of a) if (!x.dead) a[j++] = x; a.length = j }
function sortY(a) { for (let i = 1; i < a.length; i++) { const e = a[i]; let j = i - 1; while (j >= 0 && a[j].y > e.y) { a[j + 1] = a[j]; j-- } a[j + 1] = e } }

function shots(dt) {
  for (const b of G.shots) {
    b.t += dt
    switch (b.k) {
      case 'ball':   // 사스마타(꿰뚫는다) · 건배(옆 적에게 튕겨 간다)
        b.x += b.vx * dt; b.y += b.vy * dt
        if (b.t > b.life) { b.dead = true; break }
        near(b.x, b.y, b.r, e => {
          if (b.hit.has(e)) return
          b.hit.add(e); hurt(e, b.dmg, b.x - b.vx * 0.05, b.y - b.vy * 0.05, b.kb)
          if (b.bounce > 0) {
            const n = closest(1, e.x, e.y, b.hit, 230)[0]
            if (n) { b.bounce--; const v = Math.hypot(b.vx, b.vy), [dx, dy] = toward(n, b.x, b.y); b.vx = dx * v; b.vy = dy * v; b.t = 0; b.life = 0.8; return true }
          }
          if (--b.pierce <= 0) { b.dead = true; return true }
        })
        break
      case 'arc': {   // 눈물 — 포물선, 떨어진 자리 스플래시
        const u = b.u = Math.min(1, b.t / b.T); b.x = b.x0 + (b.x1 - b.x0) * u; b.y = b.y0 + (b.y1 - b.y0) * u
        if (u >= 1) { splash(b.x1, b.y1, b.R, b.dmg, '#7cc8ff'); b.dead = true }
        break
      }
      case 'drop':   // 풀뽑기 — 표시가 다 차면 뽑힌다
        if (b.t >= b.T) { splash(b.x, b.y, b.R, b.dmg, '#8fd16a'); fx({ k: 'sprout', x: b.x, y: b.y, R: b.R, T: 0.5 }); shake = Math.max(shake, 3); b.dead = true }
        break
      case 'pot':   // 카레 냄비 — 1초 뒤 매운 폭발(인어 · 세이렌에게 1.5배)
        if (b.t >= b.T) { splash(b.x, b.y, b.R, b.dmg, '#ff7a2f', 1.5); fx({ k: 'text', x: b.x, y: b.y - 34, s: '맵다!', col: '#ff7a2f', T: 0.6 }); shake = Math.max(shake, 3); b.dead = true }
        break
      case 'ring': {   // 야하! 충격파 — 반지름이 커지며 닿은 적을 한 번씩
        if (b.t < 0) { b.x = pl.x; b.y = pl.y; break }
        if (!b.boom) {
          b.boom = true; shake = Math.max(shake, 6)
          for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; part(b.x, b.y, Math.cos(a) * 220, Math.sin(a) * 120 - 40, '#d9c4a0', 0.4, 3) }
          fx({ k: 'text', x: b.x, y: b.y - 60, s: '야하!', col: '#ffd23f', T: 0.8 })
        }
        const R = b.R * Math.min(1, b.t / b.T)
        near(b.x, b.y, R, e => { if (!b.hit.has(e)) { b.hit.add(e); hurt(e, b.dmg, b.x, b.y, 220) } })
        if (b.t > b.T + 0.18) b.dead = true
        break
      }
      case 'orb': {   // 기타 음표
        const a = b.w.ang + b.i / b.n * TAU
        b.x = pl.x + Math.cos(a) * b.R; b.y = pl.y + Math.sin(a) * b.R * 0.85
        if ((b.life -= dt) <= 0) { b.dead = true; break }
        near(b.x, b.y, b.r, e => { const t = b.hit.get(e); if (t === undefined || G.t - t > 0.45) { b.hit.set(e, G.t); hurt(e, b.dmg, pl.x, pl.y, 190) } })
        break
      }
      case 'boom':   // 포셰트 — 갔다가 돌아온다
        b.v += b.acc * dt; b.x += b.dx * b.v * dt; b.y += b.dy * b.v * dt; b.a += dt * 12
        if (b.t > b.life) { b.dead = true; break }
        near(b.x, b.y, b.r, e => { const t = b.hit.get(e); if (t === undefined || G.t - t > 0.5) { b.hit.set(e, G.t); hurt(e, b.dmg, b.x - b.dx * Math.sign(b.v), b.y - b.dy * Math.sign(b.v), 70) } })
        break
      case 'zone':   // 라멘 국물 — 밟은 적을 느리게 하고 데운다
        if ((b.tick -= dt) <= 0) { b.tick = 0.3; near(b.x, b.y, b.R, e => { hurt(e, b.dmg, b.x, b.y, 0); slow(e, 0.4, 0.6) }) }
        if (b.t > b.life) b.dead = true
        break
    }
  }
}

// ---------------------------------------------------------------- 레벨 업 상자
function offers(keep = []) {
  const pool = [], has = id => G.weapons.find(w => w.id === id)
  const add = o => G.banned.has(o.t + o.id) || keep.some(k => k.t === o.t && k.id === o.id) || pool.push(o)
  let wFree = 6 - G.weapons.length - keep.filter(o => o.fresh && o.t === 'w').length, pFree = 6 - Object.keys(G.passives).length - keep.filter(o => o.fresh && o.t === 'p').length
  for (const w of G.weapons) if (w.lv < 8) add({ t: 'w', id: w.id, wt: 1.1 })
  if (wFree > 0) for (const id in WEAP) if (!has(id)) add({ t: 'w', id, wt: 0.8, fresh: true })
  for (const id in G.passives) if (G.passives[id] < PASS[id].max) add({ t: 'p', id, wt: 0.9 })
  if (pFree > 0) for (const id in PASS) if (!(id in G.passives)) add({ t: 'p', id, wt: 0.6, fresh: true })
  const out = [...keep]
  while (out.length < 3 && pool.length) {
    let q = rnd() * pool.reduce((s, o) => s + o.wt, 0), i = 0
    while ((q -= pool[i].wt) > 0 && i < pool.length - 1) i++
    const o = pool.splice(i, 1)[0]
    if (o.fresh && (o.t === 'w' ? wFree : pFree) <= 0) continue   // 빈 칸보다 많은 새것은 안 준다(잭팟이면 셋 다 받으니)
    if (o.fresh) o.t === 'w' ? wFree-- : pFree--
    out.push(o)
  }
  while (out.length < 3) out.push({ t: 'f', id: out.some(o => o.id === 'onigiri') && G.cheer < 25 ? 'cheer' : 'onigiri' })
  return out
}
function label(o) {
  if (o.t === 'f') return { icon: FILL[o.id].icon, name: FILL[o.id].name, lv: '보너스', note: FILL[o.id].note }
  if (o.t === 'w') { const w = G.weapons.find(x => x.id === o.id), d = WEAP[o.id]; return { icon: d.icon, name: d.name, ...(w ? { lv: `Lv ${w.lv} → ${w.lv + 1}`, note: Object.entries(d.ups[w.lv - 1]).map(([k, v]) => UP[k](v)).join(' · ') } : { lv: '새 스킬', note: d.note }) } }
  const lv = G.passives[o.id], p = PASS[o.id]; return { icon: p.icon, name: p.name, lv: lv ? `Lv ${lv} → ${lv + 1}` : '새 아이템', note: p.note }
}
function take(o) {
  if (o.t === 'w') { const w = G.weapons.find(x => x.id === o.id); if (w) { w.lv++; w.st = wstat(w) } else addWeapon(o.id) }
  else if (o.t === 'p') { G.passives[o.id] = (G.passives[o.id] || 0) + 1; stats() }
  else if (o.id === 'onigiri') pl.hp = Math.min(S.maxHp, pl.hp + S.maxHp * 0.4)
  else { G.cheer++; stats() }
}
/** 새 스킬 카드 아래 — 내가 가진 스킬의 짝일 때만 시너지 이름 · 효과(짝이 없으면 아무것도 안 붙인다) */
function synCard(o) {
  if (o.t !== 'w' || G.weapons.some(w => w.id === o.id)) return null
  const m = mateOf(o.id)
  if (!G.weapons.some(w => w.id === m)) return null
  const s = synOf(o.id)
  return h('div', { class: 'syn' }, h('mark', {}, '시너지'), ` 「${s[0]}」 · 내 ${WEAP[m].icon} ${WEAP[m].name}의 짝`, h('br'), synText(s))
}
let BOX = null
const ACTS = [['rr', '리롤'], ['skips', '스킵'], ['bans', '제외']]
function openBox() {
  const chest = G.queue.shift() === 'chest'
  const jack = rnd() < (chest ? 0.5 : 0.01 * S.luck * (G.ch.mod.jackpot ? 2 : 1))   // 잭팟 — 셋 다 받는다. 레벨 업 1%(행운 배수 · 하치와레 2배), 보물상자 50%
  const box = BOX = { opts: offers(), jack, ready: false, ban: false }
  if (jack) G.jackpots++
  mode = 'box'; calm(); pauseBtn.hidden = true; still = 2
  const cards = h('div', { class: 'cards' }), hint = h('p', { class: 'hint' })
  const btns = ACTS.map(([k, s], j) => h('button', { type: 'button', class: 'btn act', onclick: () => act(k) }, s, h('em'), h('kbd', {}, j + 4)))
  const takeBtn = jack && h('button', { type: 'button', class: 'btn main', onclick: () => act('take') }, '셋 다 받기')
  const root = h('div', { class: `panel box${jack ? ' jackpot' : ''}` },
    h('p', { class: 'box-title' }, chest ? '🎁 보물상자!' : `LEVEL UP! Lv ${G.lvl - G.queue.filter(q => q === 'level').length}`),
    jack && h('p', { class: 'jack' }, 'JACKPOT!!'), cards, hint, h('div', { class: 'row' }, takeBtn, btns))
  const card = (o, i) => { const L = label(o), syn = synCard(o); return h('button', { type: 'button', class: `card ${o.t}${syn ? ' synergy' : ''}`, style: `--i:${i}`, onclick: () => pick(i) }, h('span', { class: 'ic' }, L.icon), h('small', {}, L.lv), h('b', {}, L.name), h('span', { class: 'note' }, L.note), syn, h('kbd', {}, i + 1)) }
  const sync = () => {
    cards.replaceChildren(...box.opts.map(card)); root.classList.toggle('banning', box.ban)
    hint.textContent = box.ban ? '이번 판에서 뺄 카드를 고르세요 (제외를 다시 누르면 취소)' : jack ? '셋 다 가져요!' : '하나를 고르세요'
    btns.forEach((b, j) => { const k = ACTS[j][0]; b.querySelector('em').textContent = G[k]; b.disabled = !G[k]; b.classList.toggle('on', box.ban && k === 'bans') })
  }
  function pick(i) {
    const o = box.opts[i]
    if (!o || !box.ready || BOX !== box) return
    if (box.ban) {   // 제외 — 이번 판에서 안 나오고, 그 자리에 새 카드
      if (o.t === 'f') return
      G.bans--; G.banned.add(o.t + o.id); box.ban = false
      box.opts = offers(box.opts.filter(x => x !== o)); box.opts.splice(i, 0, box.opts.pop())
      return sync()
    }
    if (jack) return
    take(o); next()
  }
  function act(k) {
    if (!box.ready || BOX !== box) return
    if (k === 'take') { box.opts.forEach(take); return next() }
    if (!G[k]) return
    if (k === 'bans') { box.ban = !box.ban; return sync() }
    G[k]--
    if (k === 'skips') return next()
    box.opts = offers(); box.ban = false; sync()   // 리롤 — 셋 다 새로
  }
  box.pick = pick; box.act = act
  sync(); ui.replaceChildren(root); ui.hidden = false; ui.scrollTop = 0
  setTimeout(() => { if (BOX === box) { box.ready = true; root.classList.add('ready') } }, 450)   // 움직이던 손가락이 바로 카드를 누르지 않게
}
function next() {
  BOX = null
  if (G.queue.length) return openBox()
  ui.hidden = true; mode = 'play'; pauseBtn.hidden = false
  fx({ k: 'pillar', T: 0.7 }); fx({ k: 'ring', x: pl.x, y: pl.y, R: 90, T: 0.5, col: '#7ff3ff' })   // 레벨 업 빛기둥
}
function boxKey(e) {
  if (!BOX || e.repeat) return
  if (BOX.jack && ['Enter', 'Space'].includes(e.code) && !e.target.closest?.('button')) { BOX.act('take'); e.preventDefault() }
  else if (/^Digit[1-6]$/.test(e.code)) { const i = +e.code.slice(5) - 1; i < 3 ? BOX.pick(i) : BOX.act(ACTS[i - 3][0]); e.preventDefault() }
}

// ---------------------------------------------------------------- 그리기
function txt(c, s, x, y, size, col = '#fff') { c.font = `${size}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineJoin = 'round'; c.lineWidth = size * 0.24; c.strokeStyle = OUT; c.strokeText(s, x, y); c.fillStyle = col; c.fillText(s, x, y) }
function oval(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU) }
function render() {
  const c = ctx
  if (!SPR) return
  c.setTransform(1, 0, 0, 1, 0, 0)
  const sx = shake ? (rnd() - 0.5) * shake : 0, sy = shake ? (rnd() - 0.5) * shake : 0, ox = cam.x + sx - VW / 2, oy = cam.y + sy - VH / 2
  c.setTransform(SC, 0, 0, SC, -ox * SC, -oy * SC)
  for (let tx = Math.floor(ox / TILE); tx * TILE < ox + VW; tx++) for (let ty = Math.floor(oy / TILE); ty * TILE < oy + VH; ty++) c.drawImage(SPR.ground, tx * TILE, ty * TILE, TILE + 0.6, TILE + 0.6)
  if (G) world(c, ox, oy)
  else parade(c, ox, oy)
  c.setTransform(DPR, 0, 0, DPR, 0, 0)
  if (G) hud(c)
}
function parade(c, ox, oy) {   // 처음 화면 — 일곱 명이 줄지어 풀밭을 걸어간다
  const gap = 46, span = VW + CHARS.length * gap + 120, y = oy + VH - 30
  CHARS.forEach((ch, i) => { const x = ox - 60 + ((tnow * 34 - i * gap) % span + span) % span, C = SPR[ch.id]; put(c, SPR.shadow, x, y, 0.8); put(c, C.walk[(tnow * 8 + i * 1.5 | 0) % 4], x, y) })
}
function world(c, ox, oy) {
  if (G.final) { c.fillStyle = `rgba(80,150,230,${Math.min(0.18, (G.t - FINAL_T) / 25)})`; c.fillRect(ox, oy, VW, VH) }   // 세이렌이 오면 바다 빛
  // 바닥 — 라멘 국물 · 우라! · 경고 원 · 돌진 길 · 풀뽑기 표시 · 카레 냄비
  for (const b of G.shots) if (b.k === 'zone') {
    const a = Math.min(1, (b.life - b.t) * 2)
    c.globalAlpha = 0.45 * a; c.fillStyle = '#e8a04f'; oval(c, b.x, b.y, b.R, b.R * 0.8); c.fill()
    c.globalAlpha = 0.8 * a; c.strokeStyle = '#c4702a'; c.lineWidth = 2; c.stroke()
    c.fillStyle = '#fff6d8'; for (let i = 0; i < 3; i++) { const q = (b.t * 0.7 + i / 3) % 1; c.globalAlpha = (1 - q) * 0.7 * a; oval(c, b.x + Math.sin(i * 2.1 + b.t * 2) * b.R * 0.4, b.y - q * 30, 3 + q * 4, 3 + q * 4); c.fill() }
    c.globalAlpha = 1
  }
  for (const w of G.weapons) if (w.id === 'ura' && w.R) {
    c.globalAlpha = 0.12 + w.pulse * 1.2; c.fillStyle = '#ffd23f'; oval(c, pl.x, pl.y, w.R, w.R * 0.8); c.fill()
    c.globalAlpha = 0.5; c.strokeStyle = '#ffb400'; c.lineWidth = 2; c.setLineDash([6, 6]); c.stroke(); c.setLineDash([]); c.globalAlpha = 1
  }
  for (const z of G.haz) {
    if (z.k === 'rush') {   // 붉은 띠 · 초록 빈 줄
      const H = z.horiz, a = 0.25 + 0.2 * Math.sin(G.t * 20)
      c.fillStyle = `rgba(255,70,70,${a * 0.5})`; c.fillRect(ox, oy, VW, VH)
      c.fillStyle = 'rgba(120,230,120,.55)'; if (H) c.fillRect(ox, z.gap - 50, VW, 100); else c.fillRect(z.gap - 50, oy, 100, VH)
      txt(c, z.horiz ? (z.dir > 0 ? '→→→' : '←←←') : (z.dir > 0 ? '↓ ↓ ↓' : '↑ ↑ ↑'), cam.x, cam.y - 80, 34, '#ff6b6b')
      continue
    }
    if (z.t < 0) continue
    const u = z.t / z.T
    c.fillStyle = z.col; c.globalAlpha = 0.18; oval(c, z.x, z.y, z.R, z.R * 0.8); c.fill()
    c.globalAlpha = 0.45; oval(c, z.x, z.y, z.R * u, z.R * 0.8 * u); c.fill()
    c.globalAlpha = 0.9; c.strokeStyle = z.col; c.lineWidth = 2.5; oval(c, z.x, z.y, z.R, z.R * 0.8); c.stroke(); c.globalAlpha = 1
  }
  for (const e of G.foes) if (e.boss && e.st === 'wind') { const L = e.spd * 4 * 0.75, a = Math.atan2(e.dy, e.dx); c.save(); c.translate(e.x, e.y); c.rotate(a); c.fillStyle = 'rgba(255,60,60,.3)'; c.fillRect(0, -e.r, L, e.r * 2); c.restore() }
  for (const b of G.shots) {
    if (b.k === 'drop') { const u = b.t / b.T; c.strokeStyle = '#4f9a35'; c.lineWidth = 2; c.setLineDash([4, 4]); oval(c, b.x, b.y, b.R, b.R * 0.8); c.stroke(); c.setLineDash([]); c.fillStyle = 'rgba(110,190,80,.35)'; oval(c, b.x, b.y, b.R * u, b.R * 0.8 * u); c.fill() }
    else if (b.k === 'pot') { const u = b.t / b.T; c.strokeStyle = 'rgba(255,110,40,.8)'; c.lineWidth = 2.5; oval(c, b.x, b.y, b.R, b.R * 0.8); c.stroke(); c.fillStyle = 'rgba(255,120,40,.18)'; c.fill(); c.strokeStyle = '#ff5a1f'; c.lineWidth = 4; c.beginPath(); c.arc(b.x, b.y - 12, 16, -Math.PI / 2, -Math.PI / 2 + u * TAU); c.stroke(); put(c, SPR.E.curry, b.x + Math.sin(b.t * 40) * u * 1.5, b.y - 12) }
  }
  // 보석 · 줍는 것
  for (const g of G.gems) put(c, SPR.gem[g.v >= 20 ? 2 : g.v >= 3 ? 1 : 0], g.x, g.y)
  for (const it of G.items) { put(c, SPR.shadow, it.x, it.y, 0.5); c.globalAlpha = 0.35 + 0.2 * Math.sin(it.t * 5); c.fillStyle = '#fff'; oval(c, it.x, it.y - 12, 16, 16); c.fill(); c.globalAlpha = 1; put(c, SPR.E[it.k], it.x, it.y - 12 + Math.sin(it.t * 4) * 2) }
  // 그림자 → 몸(y 순, 화면 안만)
  const vis = e => Math.abs(e.x - cam.x) < VW / 2 + 90 && Math.abs(e.y - cam.y) < VH / 2 + 140
  for (const e of G.foes) if (vis(e)) put(c, SPR.shadow, e.x, e.y, e.r / 16 * (e.z ? Math.max(0.4, 1 - e.z / 200) : 1))
  put(c, SPR.shadow, pl.x, pl.y, 0.8)
  let me = false
  for (const e of G.foes) { if (!vis(e)) continue; if (!me && e.y > pl.y) { drawMe(c); me = true } drawFoe(c, e) }
  if (!me) drawMe(c)
  // 날아가는 것
  for (const b of G.shots) {
    if (b.k === 'ball' && b.look === 'cup') { c.save(); c.translate(b.x, b.y - 12); c.rotate(Math.sin(b.t * 14) * 0.5); put(c, SPR.E.kanpai, 0, 0, 0.8); c.restore() }
    else if (b.k === 'ball') {   // 사스마타 — 자루 + 앞이 벌어진 U 갈래
      c.save(); c.translate(b.x, b.y - 12); c.rotate(Math.atan2(b.vy, b.vx))
      c.lineCap = 'round'; c.strokeStyle = OUT; c.lineWidth = 5; c.beginPath(); c.moveTo(-24, 0); c.lineTo(4, 0); c.stroke()
      c.strokeStyle = '#b07a4f'; c.lineWidth = 3; c.stroke()
      c.strokeStyle = OUT; c.lineWidth = 4.5; c.beginPath(); c.arc(9, 0, 6, Math.PI / 2, -Math.PI / 2); c.moveTo(9, -6); c.lineTo(14, -6); c.moveTo(9, 6); c.lineTo(14, 6); c.stroke()
      c.strokeStyle = b.col; c.lineWidth = 2.4; c.stroke(); c.restore()
    } else if (b.k === 'arc') { const u = b.u, hh = b.H * 4 * u * (1 - u); put(c, SPR.shadow, b.x, b.y, 0.35); tear(c, b.x, b.y - hh - 10, 6) }
    else if (b.k === 'orb') put(c, SPR.note, b.x, b.y - 14)
    else if (b.k === 'boom') { c.save(); c.translate(b.x, b.y - 14); c.rotate(Math.sin(b.a) * 0.6); put(c, SPR.pochette, 0, 0, b.r / 10); c.restore() }
    else if (b.k === 'ring' && b.t >= 0) { const u = Math.min(1, b.t / b.T); c.globalAlpha = 1 - Math.max(0, b.t - b.T) / 0.18; c.strokeStyle = '#ffd23f'; c.lineWidth = 6; oval(c, b.x, b.y, b.R * u, b.R * u * 0.8); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); c.globalAlpha = 1 }
  }
  for (const b of G.eshots) {
    const y = b.y - 14
    if (b.k === 'spike' || b.k === 'claw') { c.save(); c.translate(b.x, y); c.rotate(Math.atan2(b.vy, b.vx)); c.beginPath(); c.moveTo(8, 0); c.lineTo(-6, -4); c.lineTo(-6, 4); c.closePath(); c.fillStyle = b.k === 'claw' ? '#b7793f' : '#3f7f74'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke(); c.restore() }
    else if (b.k === 'note') put(c, SPR.pinkNote, b.x, y)
    else { oval(c, b.x, y, b.r, b.r); c.fillStyle = b.k === 'rock' ? '#9a8f86' : '#6fc3ff'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke(); c.fillStyle = 'rgba(255,255,255,.7)'; oval(c, b.x - b.r * 0.3, y - b.r * 0.35, b.r * 0.3, b.r * 0.25); c.fill() }
  }
  for (const p of G.parts) { c.globalAlpha = 1 - p.t / p.T; c.fillStyle = p.col; c.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r) }
  c.globalAlpha = 1
  for (const f of G.fx) effect(c, f, ox, oy)
  c.globalAlpha = 1; c.globalCompositeOperation = 'source-over'
  for (const n of G.nums) { c.globalAlpha = 1 - Math.max(0, n.t - 0.45) / 0.25; txt(c, String(n.v), n.x, n.y - n.t * 26, n.kind === 'crit' ? 15 : n.kind ? 14 : 11, n.kind === 'crit' ? '#ffd23f' : n.kind === 'hurt' ? '#ff6b6b' : n.kind === 'heal' ? '#62e38a' : '#fff') }
  c.globalAlpha = 1
  // 내 체력
  const w = 30, r = pl.hp / S.maxHp
  c.fillStyle = OUT; c.fillRect(pl.x - w / 2 - 1, pl.y + 7, w + 2, 6)
  c.fillStyle = r > 0.5 ? '#62e38a' : r > 0.25 ? '#ffd23f' : '#ff6b6b'; c.fillRect(pl.x - w / 2, pl.y + 8, w * r, 4)
}
function tear(c, x, y, r) {
  c.beginPath(); c.moveTo(x, y - r * 1.8); c.bezierCurveTo(x + r * 0.4, y - r, x + r, y - r * 0.3, x + r, y + r * 0.2); c.arc(x, y + r * 0.2, r, 0, Math.PI); c.bezierCurveTo(x - r, y - r * 0.3, x - r * 0.4, y - r, x, y - r * 1.8)
  c.fillStyle = '#8fd0ff'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.4; c.stroke()
  c.fillStyle = 'rgba(255,255,255,.8)'; oval(c, x - r * 0.35, y, r * 0.25, r * 0.35); c.fill()
}
function drawFoe(c, e) {
  const v = e.type === 'mermaid' ? SPR.mermaid[e.v % 3] : e.angry ? SPR.sirenAngry : SPR[e.type]
  const L = e.fx < 0, k = e.sc || 1, f = G.freeze > 0 || e.act ? 0 : (e.age * (e.boss ? 3 : 6) + e.seed | 0) & 1, y = e.y - e.z - (e.boss ? Math.sin(e.age * 3) * 1.5 : Math.abs(Math.sin(e.age * 6 * Math.PI + e.seed)) * 1.2)
  put(c, (L ? v.L : v.R)[f], e.x, y, k)
  if (e.flash > 0) { c.globalAlpha = e.boss ? 0.45 : 0.8; put(c, (L ? v.WL : v.WR)[f], e.x, y, k); c.globalAlpha = 1 }   // 맞으면 하얗게(보스는 모양이 보이게 옅게)
  if (e.boss && e.kind === 'siren' && guarded()) { c.globalAlpha = 0.35 + 0.15 * Math.sin(G.t * 4); c.strokeStyle = '#7fd8ff'; c.lineWidth = 3; oval(c, e.x, e.y - e.r * 1.1, e.r * 1.5, e.r * 1.6); c.stroke(); c.globalAlpha = 1 }
  if (e.slow > 0 && !e.boss) { c.globalAlpha = 0.5; c.fillStyle = '#e8a04f'; oval(c, e.x, e.y, e.r, e.r * 0.4); c.fill(); c.globalAlpha = 1 }
}
function drawMe(c) {
  const C = SPR[G.ch.id], j = pl.jump > 0 ? Math.sin(pl.jump / 0.3 * Math.PI) * 26 : 0, walking = pl.moving && !G.dying
  const s = G.dying || pl.hurtT > 0 ? C.hurt : walking ? C.walk[(G.t * 9 * Math.sqrt(S.move) | 0) % 4] : C.idle[G.t % 3.4 < 0.14 ? 1 : 0]   // 아프면 > < · 걸으면 네 장 · 서 있으면 가끔 깜빡
  const br = walking ? 0 : Math.sin(G.t * 3) * 0.025   // 서 있으면 숨 쉬듯
  if (pl.inv > 0 && (G.t * 20 | 0) % 2) c.globalAlpha = 0.5
  c.save(); c.translate(pl.x, pl.y - j)
  if (G.dying) c.rotate(Math.min(1, (1.2 - G.dying) * 2) * 1.4 * pl.fx)
  c.scale(pl.fx * (1 + br * 0.6), 1 - br)
  c.drawImage(s.c, -s.ox, -s.oy, s.w, s.h); c.restore(); c.globalAlpha = 1
  if (sick('charm')) txt(c, '♥', pl.x + Math.sin(G.t * 6) * 8, pl.y - 50, 16, '#ff6fd0')
}
function effect(c, f, ox, oy) {
  const u = Math.min(1, f.t / f.T)
  switch (f.k) {
    case 'ring': c.globalAlpha = 1 - u; c.strokeStyle = f.col; c.lineWidth = 4; oval(c, f.x, f.y, f.R * u, f.R * u * 0.8); c.stroke(); break
    case 'boom': c.globalAlpha = (1 - u) * 0.75; c.fillStyle = f.col; oval(c, f.x, f.y - 4, f.R * (0.5 + 0.5 * u), f.R * (0.5 + 0.5 * u) * 0.8); c.fill(); c.globalAlpha = 1 - u; c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); break
    case 'flash': c.globalCompositeOperation = 'lighter'; c.globalAlpha = (1 - u) * 0.5; c.fillStyle = f.col; oval(c, f.x, f.y, f.R, f.R); c.fill(); c.globalCompositeOperation = 'source-over'; break
    case 'white': c.globalAlpha = (1 - u) * 0.8; c.fillStyle = '#fff'; c.fillRect(ox, oy, VW, VH); break
    case 'text': c.globalAlpha = 1 - Math.max(0, u - 0.6) / 0.4; txt(c, f.s, f.x, f.y - u * 18, 17, f.col); break
    case 'bolt': {   // 어떻게든 되라! — 노란 별 번개
      c.globalAlpha = 1 - u; c.lineJoin = 'round'
      for (const [col, lw] of [['#ffb400', 7], ['#fff7b0', 3]]) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); f.pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke() }
      star(c, f.x, f.y - 14, 12 * (1 + u * 0.5), '#ffe066'); break
    }
    case 'beam': {   // 랏코 선생의 일섬
      const x1 = f.x + Math.cos(f.a) * f.L, y1 = f.y + Math.sin(f.a) * f.L
      c.globalAlpha = 1 - u; c.lineCap = 'round'
      for (const [col, k] of [['rgba(127,200,255,.6)', 2], ['#fff', 0.8]]) { c.strokeStyle = col; c.lineWidth = f.W * k * (1 - u * 0.6); c.beginPath(); c.moveTo(f.x, f.y); c.lineTo(x1, y1); c.stroke() }
      break
    }
    case 'grab': {   // 내놔! — 쭉 뻗은 손
      c.globalAlpha = 1 - u; c.lineCap = 'round'
      for (const [col, lw] of [[OUT, 7], ['#fff', 4]]) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.moveTo(f.x0, f.y0); c.lineTo(f.x, f.y); c.stroke() }
      oval(c, f.x, f.y, 7, 7); c.fillStyle = '#fff'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke()
      txt(c, '내놔!', f.x, f.y - 14, 13, '#ffb3d1'); break
    }
    case 'swing': {   // 토벌봉 — 노란 봉, 양 끝에 불꽃
      const ex = f.vert ? 0 : f.L, ey = f.vert ? f.L * 0.8 : 0
      c.globalAlpha = (1 - u) * 0.6; c.strokeStyle = '#fff3c4'; c.lineWidth = 10 * (1 - u) + 2; c.lineCap = 'round'
      c.beginPath(); c.moveTo(f.x - ex, f.y - ey); c.lineTo(f.x + ex, f.y + ey); c.stroke()
      c.globalAlpha = 1 - u; c.strokeStyle = OUT; c.lineWidth = 5; c.stroke(); c.strokeStyle = '#ffd54a'; c.lineWidth = 3; c.stroke()
      for (const s of [-1, 1]) flame(c, f.x + s * ex, f.y + s * ey, 6 + 4 * (1 - u))
      break
    }
    case 'wave': c.globalAlpha = 1 - u * 0.6; c.strokeStyle = f.col; c.lineWidth = 6; oval(c, f.x, f.y, f.R * u, f.R * u * 0.8); c.stroke(); c.globalAlpha = 0.12; c.fillStyle = f.col; c.fill(); break
    case 'shout': {   // 말풍선
      if (f.e.dead) break
      c.globalAlpha = 1 - Math.max(0, u - 0.8) / 0.2
      c.font = `14px ${FONT}`; const tw = c.measureText(f.s).width + 16, x = f.e.x, y = f.e.y - f.e.r * 2.6 * (f.e.sc || 1) - 30
      c.fillStyle = '#fff'; c.strokeStyle = OUT; c.lineWidth = 2; c.beginPath(); c.roundRect ? c.roundRect(x - tw / 2, y - 14, tw, 24, 10) : c.rect(x - tw / 2, y - 14, tw, 24); c.fill(); c.stroke()
      c.fillStyle = f.col === '#fff' ? OUT : f.col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(f.s, x, y - 2); c.textBaseline = 'alphabetic'
      break
    }
    case 'puff': c.globalAlpha = (1 - u) * 0.6; c.fillStyle = '#fff'; oval(c, f.x, f.y, f.R * (0.6 + u * 0.6), f.R * (0.6 + u * 0.6)); c.fill(); break
    case 'pillar': c.globalCompositeOperation = 'lighter'; c.globalAlpha = (1 - u) * 0.5; c.fillStyle = '#9fe8ff'; c.fillRect(pl.x - 18 * (1 - u * 0.5), pl.y - 400, 36 * (1 - u * 0.5), 400); c.globalCompositeOperation = 'source-over'; break
    case 'sprout': {   // 풀뽑기 — 뽑힌 풀이 튄다
      c.globalAlpha = 1 - u; c.strokeStyle = '#5aa83c'; c.lineWidth = 3; c.lineCap = 'round'
      for (let i = 0; i < 7; i++) { const a = -Math.PI / 2 + (i - 3) * 0.35, L = f.R * (0.3 + u * 0.5); c.beginPath(); c.moveTo(f.x, f.y); c.lineTo(f.x + Math.cos(a) * L, f.y + Math.sin(a) * L * 1.2); c.stroke() }
      break
    }
  }
  c.globalAlpha = 1
}
function flame(c, x, y, r) { for (const [col, k] of [['#ff7a2f', 1], ['#ffd23f', 0.55]]) { c.beginPath(); c.moveTo(x, y - r * 1.8 * k); c.quadraticCurveTo(x + r * k, y - r * 0.2 * k, x, y + r * 0.6 * k); c.quadraticCurveTo(x - r * k, y - r * 0.2 * k, x, y - r * 1.8 * k); c.fillStyle = col; c.fill() } }
function star(c, x, y, r, col) {
  c.beginPath(); for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, R = i % 2 ? r * 0.45 : r; c.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R) } c.closePath()
  c.fillStyle = col; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke()
}
function hud(c) {
  const W = cv.width / DPR, H = cv.height / DPR
  c.fillStyle = 'rgba(74,59,53,.45)'; c.fillRect(0, 0, W, 10)
  c.fillStyle = '#7fd3ff'; c.fillRect(0, 0, W * Math.min(1, G.xp / G.next), 10)
  txt(c, `Lv ${G.lvl}`, 34, 32, 17)
  txt(c, fmt(G.t), W / 2, 38, 26)
  txt(c, G.final ? '최종보스!' : `세이렌까지 ${fmt(Math.max(0, FINAL_T - G.t))}`, W / 2, 56, 12, G.final ? '#ff9be0' : '#fff')
  txt(c, `처치 ${G.kills}`, W / 2, 73, 12)
  let x = 10
  for (const w of G.weapons) { c.drawImage(SPR.E[w.id].c, x, 44, 26, 26); txt(c, String(w.lv), x + 22, 70, 11, w.lv === 8 ? '#ffd23f' : '#fff'); x += 28 }
  x = 10
  for (const id in G.passives) { c.drawImage(SPR.E[id].c, x, 76, 20, 20); txt(c, String(G.passives[id]), x + 17, 96, 10); x += 22 }
  let sy = 116
  for (const id in G.sts) { const left = G.sts[id] - G.t; if (left > 0) { txt(c, `${STATUS[id].name} ${Math.ceil(left)}초 — ${STATUS[id].note}`, W / 2, sy + 2, 13, STATUS[id].col); sy += 18 } }
  const boss = G.final ? alive(G.final.siren) : G.foes.find(e => e.boss && !e.dead)   // 보스 체력 — 아래에
  if (boss) {
    const bw = Math.min(420, W - 40), bx = (W - bw) / 2, by = H - 34
    c.fillStyle = OUT; c.fillRect(bx - 3, by - 3, bw + 6, 16)
    c.fillStyle = '#ff6b8b'; c.fillRect(bx, by, bw * Math.max(0, boss.hp / boss.max), 10)
    const g = boss.kind === 'siren' ? G.final.mermaids.filter(m => !m.dead).length : 0
    txt(c, `${boss.mid ? '중간보스 ' : ''}${BOSS[boss.kind].name}${g ? ` — 인어 ${g}마리가 지키는 중 (받는 피해 -50%)` : ''}`, W / 2, by - 8, 14, g ? '#7fd8ff' : '#fff')
  }
  if (G.banner) { const b = G.banner; c.globalAlpha = Math.min(1, (b.T - b.t) * 3, b.t * 6); txt(c, b.s, W / 2, H * 0.3, Math.min(30, W / 15), b.col); c.globalAlpha = 1 }
  if (G.freeze > 0) txt(c, `멈춤 ${Math.ceil(G.freeze)}`, W / 2, H * 0.3 + 34, 16, '#ffc2e0')
  if (joy.on) {
    c.globalAlpha = 0.35; c.fillStyle = '#fff'; oval(c, joy.ox, joy.oy, 46, 46); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke()
    c.globalAlpha = 0.75; oval(c, joy.px, joy.py, 20, 20); c.fill(); c.stroke(); c.globalAlpha = 1
  }
  if (pl.hp / S.maxHp < 0.3 && !G.won) { c.fillStyle = `rgba(255,60,60,${0.12 + 0.08 * Math.sin(G.t * 8)})`; c.fillRect(0, 0, W, H) }   // 체력이 낮으면 붉게
}

// ---------------------------------------------------------------- 메뉴(HTML)
const btn = (s, fn, cls = '') => h('button', { type: 'button', class: `btn ${cls}`, onclick: fn }, s)
function show(...kids) { ui.replaceChildren(...kids); ui.hidden = false; ui.scrollTop = 0; still = 2 }
function title() {
  mode = 'title'; G = null; BOX = null; pauseBtn.hidden = true
  show(h('div', { class: 'panel' },
    h('div', { class: 'trio' }, CHARS.map(ch => portrait(ch.id))),
    h('h1', { class: 'logo' }, '먼작귀', h('span', {}, '서바이버즈')),
    h('p', { class: 'sub' }, '먼가 작고 귀여운 녀석들의 토벌 생존기'),
    h('div', { class: 'row' }, btn('도감', guide), btn('토벌 시작!', chars, 'main')),
    h('p', { class: 'rec' }, save.runs ? `토벌 ${save.runs}번 · 클리어 ${save.clears}번 · 쓰러뜨린 적 ${save.kills.toLocaleString()}` : `몰려오는 토벌 대상을 피해 다니면 스킬은 알아서 나가요. ${FINAL_T / 60}분 뒤 나타나는 세이렌을 쓰러뜨리면 클리어!`),
    h('p', { class: 'fine' }, '비공식 · 비영리 팬게임 — 원작 「ちいかわ」 © ナガノ')))
}
function chars() {
  mode = 'chars'; G = null
  show(h('div', { class: 'panel wide' },
    h('p', { class: 'h' }, '누구랑 토벌할까?'),
    h('div', { class: 'chars' }, CHARS.map((ch, i) => {
      const b = save.best[ch.id], W = WEAP[ch.w]
      return h('button', { type: 'button', class: `char${i === pickCi ? ' on' : ''}`, onclick: () => { if (pickCi === i) return startGame(i); pickCi = i; chars() } },
        portrait(ch.id), h('b', {}, ch.name), h('small', {}, `${W.icon} ${W.name}`), h('span', { class: 'trait' }, ch.trait), h('span', { class: 'note' }, ch.note),
        h('span', { class: 'best' }, b ? `최고 ${fmt(b.t)} · 레벨 ${b.lvl}${b.clears ? ` · 클리어 ${b.clears}번` : ''}` : '아직 기록 없음'))
    })),
    h('div', { class: 'row' }, btn('← 처음으로', title), btn('토벌 시작!', () => startGame(pickCi), 'main'))))
}
const PF = {}   // 캐릭터 고르기 화면의 걷는 그림(크게, 캐릭터마다 한 번)
setInterval(() => {
  if (mode !== 'chars') return
  const cv = ui.querySelector('.char.on canvas'), id = CHARS[pickCi].id
  if (!cv) return
  const f = PF[id] ||= WALK.map(p => artSprite(id, 3, p).c), g = cv.getContext('2d')
  g.clearRect(0, 0, cv.width, cv.height); g.drawImage(f[(tnow * 8 | 0) % 4], 0, 0)
}, 60)
function guide() {
  mode = 'guide'
  const li = (pic, name, note, extra) => h('li', {}, typeof pic === 'string' ? h('i', {}, pic) : pic, h('div', {}, h('b', {}, name), h('span', {}, note), extra && h('em', {}, extra)))
  const when = kind => [...PLAN.filter(p => p[1] === kind).map(p => `${fmt(p[0])}${p[2] ? '(중간)' : ''}`), ...(kind === 'siren' || kind === 'mermaid' ? [fmt(FINAL_T)] : [])].join(' · ')
  show(h('div', { class: 'panel guide' },
    h('p', { class: 'h' }, '토벌 도감'),
    h('h3', {}, '조작'),
    h('p', {}, '이동: 방향키 · WASD — 휴대폰은 화면 아무 데나 누르고 끌기. 공격은 알아서 나가요. 일시정지: Esc · P · 오른쪽 위 버튼'),
    h('h3', {}, '규칙'),
    h('ul', { class: 'rules' },
      h('li', {}, '적을 쓰러뜨리면 떨어지는 보석(경험치)을 주워 레벨을 올려요. 레벨이 오를 때마다 새 스킬 · 스킬 레벨 업 · 아이템 셋 중 하나.'),
      h('li', {}, '스킬 · 아이템은 6칸씩, 스킬은 Lv 8 · 아이템은 Lv 5 까지. 아주 가끔(1%) 잭팟이 터지면 셋 다 가져요.'),
      h('li', {}, '한 판에 두 번씩 — 리롤(카드 셋을 새로) · 스킵(이번엔 안 고르기) · 제외(카드 하나를 이번 판에서 빼기).'),
      h('li', {}, '짝인 두 스킬을 다 가지면 시너지 — 둘 다 세져요.'),
      h('li', {}, '10분부터 고블린 폭탄 · 돌격대 — 스킬로 못 막으니 보고 피하기. 보스는 기술 전에 멈춰서 깜빡여요.'),
      h('li', {}, `${FINAL_T / 60}분에 세이렌과 인어 셋이 나와요. 세이렌을 쓰러뜨리면 클리어! 기록은 이 브라우저에만 저장돼요.`)),
    h('h3', {}, '캐릭터'),
    h('ul', { class: 'list' }, CHARS.map(ch => li(portrait(ch.id), `${ch.name} — ${ch.trait}`, ch.note, `시작 스킬: ${WEAP[ch.w].icon} ${WEAP[ch.w].name}`))),
    h('h3', {}, '스킬 (최고 Lv 8)'),
    h('ul', { class: 'list' }, Object.entries(WEAP).map(([id, w]) => li(w.icon, w.name, w.note, `짝: ${WEAP[mateOf(id)].name} — 「${synOf(id)[0]}」`))),
    h('h3', {}, '시너지'),
    h('ul', { class: 'list' }, SYN.map(s => li('✨', s[0], synText(s)))),
    h('h3', {}, '아이템 (최고 Lv 5)'),
    h('ul', { class: 'list' }, Object.values(PASS).map(p => li(p.icon, p.name, `레벨마다 ${p.note}${p.max !== 5 ? ` · 최고 Lv ${p.max}` : ''}`))),
    h('h3', {}, '줍는 것'),
    h('ul', { class: 'list' }, Object.values(ITEMS).map(p => li(p.icon, p.name, p.note))),
    h('h3', {}, '토벌 대상'),
    h('ul', { class: 'list' }, Object.entries(FOES).filter(([id]) => !(id in BOSS)).map(([id, f]) => li(portrait(id), f.name, f.note))),
    h('h3', {}, '보스'),
    h('ul', { class: 'list' }, Object.entries(BOSS).map(([id, b]) => li(portrait(id), b.name, b.note, `나오는 때: ${when(id)}${b.st ? ` · 상태이상: ${STATUS[b.st].name}(${STATUS[b.st].note})` : ''}`))),
    h('div', { class: 'row' }, btn('← 처음으로', title, 'main'))))
}
const chips = () => h('div', { class: 'build' }, G.weapons.map(w => h('span', { class: 'chip w' }, `${WEAP[w.id].icon} ${WEAP[w.id].name} Lv${w.lv}`)), Object.entries(G.passives).map(([id, lv]) => h('span', { class: 'chip' }, `${PASS[id].icon} ${PASS[id].name} Lv${lv}`)))
function pause() {
  if (mode !== 'play') return
  mode = 'pause'; calm(); pauseBtn.hidden = true
  show(h('div', { class: 'panel' }, h('p', { class: 'h' }, '일시정지'), chips(), h('div', { class: 'row' }, btn('그만두기', () => finish(false, true)), btn('계속하기', resume, 'main'))))
}
function resume() { if (mode !== 'pause') return; mode = 'play'; ui.hidden = true; pauseBtn.hidden = false }
function finish(win, quit = false) {
  mode = 'over'; BOX = null; calm(); pauseBtn.hidden = true
  const b = save.best[G.ch.id] ||= { t: 0, kills: 0, lvl: 0, clears: 0 }, rec = !quit && G.t > b.t
  save.runs++; save.kills += G.kills
  if (win) { save.clears++; b.clears++ }
  b.t = Math.max(b.t, G.t); b.kills = Math.max(b.kills, G.kills); b.lvl = Math.max(b.lvl, G.lvl)
  persist()
  const stat = (k, v, n) => h('div', {}, h('small', {}, k), h('b', {}, v), n && h('span', { class: 'new' }, 'NEW'))
  show(h('div', { class: `panel result${win ? ' win' : ''}` },
    portrait(G.ch.id),
    h('p', { class: 'h' }, win ? '토벌 성공! 🎉' : quit ? '토벌 중단' : '쓰러졌다… 와아…'),
    h('p', { class: 'sub' }, win ? '세이렌을 쫓아냈어요!' : G.final ? '세이렌까지 왔어요! 조금만 더' : `세이렌까지 ${fmt(Math.max(0, FINAL_T - G.t))} 남았어요`),
    h('div', { class: 'stats' }, stat('버틴 시간', fmt(G.t), rec), stat('레벨', G.lvl), stat('처치', G.kills.toLocaleString()), stat('보스', G.bosses)),
    chips(),
    h('div', { class: 'row' }, btn('처음으로', title), btn('캐릭터 바꾸기', chars), btn('다시 하기', () => startGame(pickCi), 'main'))))
}

// ---------------------------------------------------------------- 돌리기
let last = 0, lastMode = '', tnow = 0
function frame(ts) {
  let dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016)
  last = ts; tnow += dt
  if (mode === 'play' && G) { if (G.dying > 0) dt *= 0.3; step(dt) }
  else if (!G) cam.x += dt * 24
  if (mode !== lastMode) { lastMode = mode; still = 2 }
  if (mode === 'play' || !G || still-- > 0) render()   // 상자 · 일시정지 · 결과 동안은 다시 그리지 않는다 — 메뉴 연출이 부드럽게
  requestAnimationFrame(frame)
}
size()
title()
requestAnimationFrame(frame)
// 점검용 — 브라우저 콘솔 · 자동 테스트에서 판을 빨리 돌려 본다
window.__mjg = { FINAL_T, step, startGame, art: artSprite, WALK, CHARS, get G() { return G }, get pl() { return pl }, get mode() { return mode }, pick0() { if (BOX) { take(BOX.opts[0]); next() } } }
