// 먼작귀 서바이버즈 — 뱀파이어 서바이버즈류 비공식 팬게임.
//   덩크 서바이버(nba-kor.github.io/survive)의 게임 규칙만 가져와 먼작귀 세계로 옮겼다(그림 · 캐릭터는 새로).
//   몰려오는 토벌 대상(고블린 · 키메라)을 피해 다니면 스킬은 알아서 나간다. FINAL_T 에 최종보스 세이렌(+인어 셋) — 쓰러뜨리면 클리어.
//   레벨 업마다 랜덤 상자(셋 중 하나 · 리롤 · 스킵 · 제외 · 1% 잭팟), 스킬 Lv 8 · 아이템 Lv 5, 짝 스킬을 모으면 시너지.
//   그림은 캔버스 하나에 코드로(처음에 한 번 그려 두고 옮겨 그린다). 메뉴 · 상자는 캔버스 위에 겹친 HTML(#ui). 기록은 이 브라우저(localStorage)에만.

const TAU = Math.PI * 2, rnd = Math.random
const clamp = (v, a, b) => v < a ? a : v > b ? b : v
const fmt = s => `${String(s / 60 | 0).padStart(2, '0')}:${String(s % 60 | 0).padStart(2, '0')}`
const pickOf = a => a[rnd() * a.length | 0]
const VIEW = 500          // 화면의 짧은 쪽에 보이는 월드 크기(캐릭터가 작아 보이지 않게) — 휴대폰을 세워도 눕혀도 둘레가 이만큼은 보인다
const MAX_FOES = 320      // 한 화면 적 수 한도 — 휴대폰 그리기 비용
const FINAL_T = 25 * 60   // 최종보스 세이렌이 나오는 때
const DARK_T = 29 * 60, END_T = 30 * 60   // 세이렌을 못 쓰러뜨리면 29분에 검은 별똥별(쓰러뜨릴 수 없다) — 30분까지 도망치면 생존 클리어

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
  pajama: { name: '꿀맛 페스티벌 티켓', icon: '🎫', note: '파자마 파티즈가 10초 동안 곁에서 공연 — 음표 충격파로 둘레의 적을 밀쳐 내고, 응원으로 쿨타임 -25%' },
  battery: { name: '건전지', icon: '🔋', note: '한잎이 · 두잎이가 12초 동안 손을 잡고 곁을 돈다 — 날아오는 것을 막고 닿은 적을 밀쳐 낸다' },
  chest: { name: '보물상자', icon: '🎁', note: '보스가 떨어뜨린다 — 잭팟 확률 50%' },
}

// 토벌 대상 — r 몸 반지름 · hp(시간이 갈수록 세진다) · spd 이동 · dmg 닿으면 · xp 떨어뜨리는 경험치 · col 터질 때 색
const FOES = {
  goblin: { name: '고블린', note: '가장 흔한 토벌 대상 — 줄지어 다가온다', r: 12, hp: 9, spd: 62, dmg: 7, xp: 1, col: '#8fc46e' },
  chimera: { name: '꼬마 키메라', note: '1분부터 — 하얀 날개 · 보랏빛 꼬리의 분홍 키메라. 울면서 다가온다 · 빠르고, 가끔 떼로 둘러싼다', r: 10, hp: 5, spd: 95, dmg: 5, xp: 1, col: '#f9cdd6' },
  dekatsu: { name: '분홍 키메라', note: '4분부터 — 네 발로 걷는 어른 키메라. 느리지만 단단하고 아프다 · 밀리지 않는다', r: 18, hp: 52, spd: 47, dmg: 10, xp: 3, col: '#efb3c8' },
  spiker: { name: '가면 키메라', note: '6분부터 — 곤충 날개 · 기괴한 가면. 멀리서 독침을 쏜다', r: 12, hp: 18, spd: 57, dmg: 7, xp: 2, col: '#8d9a77', shot: { k: 'spike', spd: 210, cd: 2.6, range: 330, r: 5 } },
  golden: { name: '황금 고블린', note: '가끔 나오는 정예 — 쓰러뜨리면 가끔 아이템', r: 22, hp: 420, spd: 55, dmg: 16, xp: 25, col: '#ffd34d' },
  bug: { name: '초록 벌레', note: '처음부터 — 초록 털모자를 쓴 벌레. 입을 동그랗게 벌리고 걸어온다 · 약하고 느리다', r: 10, hp: 7, spd: 55, dmg: 6, xp: 1, col: '#c3e6a4' },
  beetle: { name: '꼬마 풍뎅이', note: '3분부터 — 밤색 탈을 쓴 것 같은 풍뎅이(머리 위 뿔). 단단해서 밀리지 않는다', r: 13, hp: 30, spd: 58, dmg: 9, xp: 2, col: '#a47b63' },
  star: { name: '별똥별', note: '5분부터 — 셋이 같이 다닌다. 맞으면 「흐아아악!」', r: 10, hp: 12, spd: 90, dmg: 7, xp: 1, col: '#ffe066' },
  fugu: { name: '복어', note: '8분부터 — 기름 그물을 뿌린다(맞으면 잠깐 느려진다) · 「블링블링 마블링」', r: 14, hp: 30, spd: 45, dmg: 8, xp: 2, col: '#f6dc98', shot: { k: 'net', spd: 170, cd: 3.2, range: 300, r: 9, slow: 1.6 } },
  octo: { name: '문어 괴물', note: '12분부터 — 간장을 뱉는다', r: 15, hp: 45, spd: 50, dmg: 10, xp: 3, col: '#f29a9a', shot: { k: 'soy', spd: 220, cd: 2.6, range: 320, r: 6 } },
  parttimer: { name: '아르바이트생 괴물', note: '14분부터 — 카페 앞치마를 두른 분홍 코끼리 같은 괴물(뿔 여럿 · 점 눈 다섯). 아주 단단하다', r: 20, hp: 160, spd: 42, dmg: 14, xp: 6, col: '#e9bcc8' },
  rusher: { name: '고블린 돌격대', note: '10분부터 — 줄지어 화면을 가로지른다. 스킬에 안 맞으니 빈 줄로 피하기', r: 11, hp: 14, spd: 0, dmg: 14, xp: 1, col: '#c9e29a' },
  // 보스(BOSS) — 피는 시간에 따라 완만하게, 대신 서 있으면 맞는 기술을 쓴다
  dekatsuyo: { r: 32, hp: 1300, spd: 66, dmg: 22, xp: 120, col: '#5e5068' },
  goblinKing: { r: 30, hp: 1100, spd: 60, dmg: 18, xp: 120, col: '#86b85f' },
  bigChimera: { r: 36, hp: 1400, spd: 50, dmg: 24, xp: 120, col: '#c9b8e0' },
  mermaid: { r: 14, hp: 500, spd: 70, dmg: 14, xp: 60, col: '#ff9fb5' },
  rps: { r: 30, hp: 1300, spd: 64, dmg: 20, xp: 120, col: '#f2c9a8' },
  chef: { r: 34, hp: 1500, spd: 56, dmg: 22, xp: 140, col: '#8fc47a' },
  anoko: { r: 34, hp: 1500, spd: 62, dmg: 22, xp: 150, col: '#f3ece4' },
  siren: { r: 40, hp: 2800, spd: 55, dmg: 26, xp: 400, col: '#ee4a3c' },
}
// line = 나올 때 외치는 말, st = 거는 상태이상(stCd 초마다, 중간보스는 안 건다)
const BOSS = {
  dekatsuyo: { name: '데카츠요', line: '쿵… 쿵…!', note: '「뭔가 크고 강한 녀석」 — 멈칫(갈 길이 붉게)한 뒤 그 방향으로 돌진. 옆으로 피하기' },
  goblinKing: { name: '고블린 대장', line: '쳐라, 쳐!', note: '돌을 부채꼴로 던지고 부하를 불러 에워싼다 · 약화를 건다', st: 'weak', stCd: 30 },
  bigChimera: { name: '거대 키메라', line: '헤헤… 흑…', note: '웃으면서 우는 거대한 키메라 — 뛰어올라 내 자리에 내려찍는다. 붉은 원에서 벗어나기' },
  rps: { name: '가위바위보', line: '가위바위보로 무얼 만들까~♪', note: '「바위!」 쇠공 팔로 내 자리를 내려찍고(회색 원) · 「가위!」 바퀴 발로 돌진 · 「보!」 종이를 사방으로 뿌린다' },
  chef: { name: '요리사 괴물', line: '잘 먹겠습니다람쥐!', note: '후추를 흩뿌리고(작은 원 여럿) · 토르티야로 돌돌 말고(큰 노란 원 — 밖으로 피하기) · 돌진한다' },
  anoko: { name: '아노코', line: '…!!', note: '「커다란 토벌」의 대상 — 돌진하고 · 용 같은 꼬리로 둘레를 휩쓸고(청록 원) · 꼬깔콘 같은 발톱을 던진다' },
  mermaid: { name: '인어', line: '라~♪', note: '세이렌의 코러스 — 곁을 돌다가 날카로운 이빨로 달려들어 문다. 살아 있는 동안 세이렌은 받는 피해 -50%' },
  siren: { name: '세이렌', line: '내 노래를 들어 봐…', note: '노래(매혹)로 끌어당기고 · 음표를 사방으로 · 땅에서 덩굴 · 큰 꼬리로 내려치기. 체력이 절반 아래면 눈이 붉어지고 더 빨라진다', st: 'charm', stCd: 14 },
}
// 보스가 나오는 때 — [초, 종류, 중간보스면 1]. FINAL_T 에 세이렌 + 인어 셋(finale)
const PLAN = [[300, 'dekatsuyo'], [450, 'goblinKing', 1], [600, 'goblinKing'], [720, 'rps', 1], [840, 'bigChimera'], [960, 'rps'], [1080, 'chef', 1], [1200, 'anoko'],
  [1290, 'chef'], [1380, 'bigChimera', 1], [1440, 'dekatsuyo', 1]]
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
// 생김새는 공식 디자인(아래가 넓은 찹쌀떡 몸 · 몸 실루엣에 이어진 귀와 팔 · 가는 선 · 작게 모인 얼굴 · 빗금 볼터치)과 나무위키 「먼작귀/등장인물」 설명을 참고해 새로 그렸다.
// 그리는 함수는 모두 (g, p) — p = 자세 { foot 발(-1 · 0 · 1), arm 팔, bob 몸 들썩임, blink 눈 감기, hurt 아픈 얼굴, look 얼굴을 보는 쪽으로 }. 걷기 · 숨 · 아픈 얼굴은 이 자세로 미리 따로 그려 둔다
const OUT = '#3d302b', FONT = '"Jua", system-ui, sans-serif', EMOJI = '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'
const LW = 0.72   // 캐릭터 테두리 굵기
function blob(g, x, y, rx, ry, fill, lw = 1) { g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, TAU); g.fillStyle = fill; g.fill(); g.lineWidth = lw; g.strokeStyle = OUT; g.stroke() }
/** 몸에 이어 붙는 혹(귀 · 팔 · 갈기) — 채우고 바깥 테두리(a0 → a1)만 그어, 몸 테두리 위에 그리면 경계선 없이 이어 보인다 */
function bump(g, x, y, rx, ry, rot, fill, a0, a1, lw = LW) {
  g.save(); g.translate(x, y); g.rotate(rot)
  g.beginPath(); g.ellipse(0, 0, rx, ry, 0, 0, TAU); g.fillStyle = fill; g.fill()
  g.beginPath(); g.ellipse(0, 0, rx, ry, 0, a0, a1); g.lineWidth = lw; g.strokeStyle = OUT; g.lineCap = 'round'; g.stroke()
  g.restore()
}
/** 몸 안에서 시작해 밖으로 나가는 뾰족한 것(고양이 귀 · 고블린 귀 · 꼭지) — pts 의 처음 · 끝은 몸 안, 바깥 두 변만 긋는다 */
function spike(g, pts, fill) {
  g.beginPath(); g.moveTo(...pts[0]); for (let i = 1; i < pts.length; i += 2) g.quadraticCurveTo(...pts[i], ...pts[i + 1]); g.closePath(); g.fillStyle = fill; g.fill()
  g.beginPath(); g.moveTo(...pts[0]); for (let i = 1; i < pts.length; i += 2) g.quadraticCurveTo(...pts[i], ...pts[i + 1]); g.lineWidth = LW; g.strokeStyle = OUT; g.lineJoin = g.lineCap = 'round'; g.stroke()
}
function eyes(g, y, gap = 4.6, r = 1.8, shine = true) {   // 적 · 보스용 점 눈
  for (const s of [-1, 1]) {
    g.fillStyle = '#2b211d'; g.beginPath(); g.ellipse(s * gap, y, r * 0.9, r * 1.15, 0, 0, TAU); g.fill()
    if (shine) { g.fillStyle = '#fff'; g.beginPath(); g.arc(s * gap - r * 0.3, y - r * 0.4, r * 0.38, 0, TAU); g.fill() }
  }
}
function blush(g, y, gap = 8, k = 1) { g.fillStyle = 'rgba(255,130,155,.55)'; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * gap, y, 2.4 * k, 1.3 * k, 0, 0, TAU); g.fill() } }
function smile(g, y) { g.strokeStyle = OUT; g.lineWidth = 0.9; g.beginPath(); g.moveTo(-1.6, y); g.quadraticCurveTo(-0.8, y + 0.9, 0, y); g.quadraticCurveTo(0.8, y + 0.9, 1.6, y); g.stroke() }
/** 작은 점 눈(하이라이트) · 깜빡이면 감은 눈 · 아프면 > < 와 눈물 */
function dotEyes(g, y, gap, r, p, shine = true) {
  g.strokeStyle = OUT; g.lineCap = 'round'
  for (const s of [-1, 1]) {
    const x = s * gap
    if (p.hurt) {
      g.lineWidth = 0.85; g.beginPath(); g.moveTo(x - s * 1.2, y - 1.1); g.lineTo(x + s * 0.9, y); g.lineTo(x - s * 1.2, y + 1.1); g.stroke()
      g.fillStyle = '#9fd6ff'; g.beginPath(); g.ellipse(x + s * 1.7, y + 1.7, 0.65, 1.05, 0, 0, TAU); g.fill()
    } else if (p.blink) { g.lineWidth = 0.8; g.beginPath(); g.moveTo(x - r * 0.9, y); g.quadraticCurveTo(x, y + r * 0.9, x + r * 0.9, y); g.stroke() }
    else {
      g.fillStyle = '#2b211d'; g.beginPath(); g.ellipse(x, y, r * 0.82, r, 0, 0, TAU); g.fill()
      if (shine) { g.fillStyle = '#fff'; g.beginPath(); g.arc(x - r * 0.25, y - r * 0.38, r * 0.34, 0, TAU); g.fill() }
    }
  }
}
/** 빗금 볼터치 — 옅은 분홍 타원에 가는 /// */
function hatch(g, y, gap, k = 1) {
  for (const s of [-1, 1]) {
    g.fillStyle = 'rgba(255,150,170,.42)'; g.beginPath(); g.ellipse(s * gap, y, 2.4 * k, 1.2 * k, 0, 0, TAU); g.fill()
    g.strokeStyle = 'rgba(232,96,124,.7)'; g.lineWidth = 0.4; g.beginPath()
    for (let i = -1; i <= 1; i++) { const x = s * gap + i * 1.05 * k; g.moveTo(x - 0.4 * k, y + 0.62 * k); g.lineTo(x + 0.4 * k, y - 0.62 * k) }
    g.stroke()
  }
}
/** 작은 고양이 입 — ω, open 이면 아래로 조금 벌린 입 */
function catMouth(g, y, open = 0.7) {
  g.strokeStyle = OUT; g.lineWidth = 0.7; g.lineCap = 'round'
  g.beginPath(); g.moveTo(-1.3, y); g.quadraticCurveTo(-0.65, y + 0.75, 0, y); g.quadraticCurveTo(0.65, y + 0.75, 1.3, y); g.stroke()
  if (!open) return
  const P = new Path2D(); P.moveTo(-0.75 * open, y + 0.42); P.quadraticCurveTo(0, y + 0.28, 0.75 * open, y + 0.42); P.quadraticCurveTo(0.45 * open, y + 1.8 * open, 0, y + 1.8 * open); P.quadraticCurveTo(-0.45 * open, y + 1.8 * open, -0.75 * open, y + 0.42)
  g.fillStyle = '#ec7a88'; g.fill(P); g.lineWidth = 0.6; g.stroke(P)
}
function heart(g, x, y, r, col, lw = 0) { g.beginPath(); g.moveTo(x, y + r * 1.1); g.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.8, y - r * 1.3, x, y - r * 0.5); g.bezierCurveTo(x + r * 0.8, y - r * 1.3, x + r * 1.6, y - r * 0.2, x, y + r * 1.1); g.fillStyle = col; g.fill(); if (lw) { g.lineWidth = lw; g.strokeStyle = OUT; g.stroke() } }
function fluffOval(g, cx, cy, rx, ry, rot, fill, n = 28) {   // 복슬한 타원(꼬리)
  g.save(); g.translate(cx, cy); g.rotate(rot); blob(g, 0, 0, rx, ry, fill, LW)
  g.strokeStyle = 'rgba(79,65,59,.5)'; g.lineWidth = 0.7; g.beginPath()
  for (let i = 0; i < n; i++) { const a = i / n * TAU, x = Math.cos(a) * rx, y = Math.sin(a) * ry, L = i % 2 ? 1.3 : 0.8; g.moveTo(x, y); g.lineTo(x * (1 + L / rx), y * (1 + L / ry)) }
  g.stroke(); g.restore()
}
// 찹쌀떡 몸 — 위는 둥글고 mid(볼 높이)가 가장 넓고 아래로 조금 좁아지며 바닥은 살짝 납작(베지에 다섯)
function mochiSegs(W, H, mid = 0.42, wide = 0, thin = false, bw = 0.74, neck = 0, jw = 0.9) {   // 옆선이 곧게 서지 않고 둥글게 — 위는 사분원, 볼 아래로 둥글게 좁아지고 바닥은 살짝 볼록
  const hw = W / 2, b = -1, t = b - H, m = t + H * mid, up = m - (m - t) * 0.56, lo = m + (b - m) * 0.56
  if (thin && neck) {   // 주인공 — 볼(mid)이 가장 넓은 큰 머리가 몸으로 이어지고, 팔이 붙는 높이(neck)에서만 옆선이 살짝 들어간다(너비 jw). 아래로 둥글게 좁아진다
    const { jx, yj } = headJoin(W, H, neck, jw), rt = m - t, rb = (yj - m) / Math.sqrt(1 - jw * jw), aj = Math.acos(jw), be = hw * 0.36
    const arc = (a, c, ry) => { const k = 4 / 3 * Math.tan((c - a) / 4); return [hw * Math.cos(a), m + ry * Math.sin(a), hw * (Math.cos(a) - k * Math.sin(a)), m + ry * (Math.sin(a) + k * Math.cos(a)), hw * (Math.cos(c) + k * Math.sin(c)), m + ry * (Math.sin(c) - k * Math.cos(c)), hw * Math.cos(c), m + ry * Math.sin(c)] }   // 타원 조각(위 · 아래 반지름이 다르다)
    const P = Math.PI
    return [arc(P - aj, P, rb), arc(P, P * 1.5, rt), arc(P * 1.5, P * 2, rt), arc(P * 2, P * 2 + aj, rb), [jx, yj, jx * 1.08, yj + (b - yj) * 0.38, hw * 0.6, b, be, b], [be, b, be * 0.35, b + 0.3, -be * 0.35, b + 0.3, -be, b], [-be, b, -hw * 0.6, b, -jx * 1.08, yj + (b - yj) * 0.38, -jx, yj]]   // 팔 아래 몸은 살짝 부풀었다가(머리와의 경계) 바닥으로 점점 좁아진다
  }
  if (thin) {   // 주인공 — 볼 높이가 가장 넓고, 아래로 끊김 없이 매끄럽게 좁아지는 몸(bw 아래가 좁은 정도). 얼굴과 몸의 경계가 따로 없다
    const d = b - m, bc = hw * (bw + 0.1), be = hw * (bw - 0.32)   // 옆선이 끝까지 볼록 — 달걀처럼 아래로 둥글게 좁아진다
    return [[0, t, hw * 0.52, t, hw, up, hw, m], [hw, m, hw, m + d * 0.52, bc, b, be, b], [be, b, be * 0.35, b + 0.3, -be * 0.35, b + 0.3, -be, b], [-be, b, -bc, b, -hw, m + d * 0.52, -hw, m], [-hw, m, -hw, up, -hw * 0.52, t, 0, t]]
  }
  const bc = hw * (0.66 + 0.3 * wide), be = hw * (0.2 + 0.4 * wide)   // 아래 모서리 · 바닥 끝 — wide 면 아래가 넓다
  return [[0, t, hw * 0.56, t, hw, up, hw, m], [hw, m, hw, lo, bc, b, be, b], [be, b, be * 0.35, b + 0.3, -be * 0.35, b + 0.3, -be, b], [-be, b, -bc, b, -hw, lo, -hw, m], [-hw, m, -hw, up, -hw * 0.56, t, 0, t]]
}
/** 머리와 몸이 만나는 곳(팔 자리) — 높이 neck · 너비 jw(머리 너비 대비) */
function headJoin(W, H, neck, jw = 0.9) { return { jx: W / 2 * jw, yj: -1 - H + H * neck } }
function segPath(S) { const P = new Path2D(); P.moveTo(S[0][0], S[0][1]); for (const s of S) P.bezierCurveTo(s[2], s[3], s[4], s[5], s[6], s[7]); P.closePath(); return P }
function fluff(g, S, cy, n = 50) {   // 복슬복슬한 테두리 — 바깥으로 옅고 짧은 털
  g.strokeStyle = 'rgba(79,65,59,.42)'; g.lineWidth = 0.7; g.beginPath()
  for (let i = 0; i < n; i++) {
    const u = i / n * S.length, k = u | 0, t = u - k, q = 1 - t, [x0, y0, x1, y1, x2, y2, x3, y3] = S[k]
    const x = q * q * q * x0 + 3 * q * q * t * x1 + 3 * q * t * t * x2 + t * t * t * x3, y = q * q * q * y0 + 3 * q * q * t * y1 + 3 * q * t * t * y2 + t * t * t * y3
    if (y > -2) continue   // 바닥은 털 없이
    const dy = y - cy, d = Math.hypot(x, dy) || 1, L = i % 2 ? 1.3 : 0.8
    g.moveTo(x, y); g.lineTo(x + x / d * L, y + dy / d * L)
  }
  g.stroke()
}
/** o: W · H 몸, fur 털, limb 발 색, armFill 팔 색, arms 'cheek'(볼에 손) | 'none', fluffy 복슬 테두리,
 *     back 몸 뒤(꼬리 · 집게), cap 몸 안 무늬, ears 몸 테두리 위에 이어 붙는 것(귀 · 갈기), face, front 몸 앞, hold 보는 쪽 손에 든 것 */
function mochi(g, o, p = {}) {
  const W = o.W || 25, H = o.H || 24, hw = W / 2, t = -1 - H, mid = o.mid || 0.42, S = mochiSegs(W, H, mid, o.wide, o.thin, o.bw, o.neck, o.jw), P = segPath(S), foot = p.foot || 0, arm = p.arm || 0, limb = o.limb || o.fur, af = o.armFill || limb
  const thin = !!o.thin, L = thin ? 1 : 0, bob = p.bob || 0, J = o.neck && headJoin(W, H, o.neck, o.jw)   // 주인공 — 짧고 가는 팔다리, 몸을 다리 길이만큼 띄운다
  const ay = thin ? (J ? J.yj + 0.5 : t + H * (mid + (1 - mid) * 0.42)) : t + H * 0.66
  const side = yy => { const [x0, y0, x1, y1, x2, y2, x3, y3] = S[1]; let bx = hw, bd = 1e9; for (let i = 0; i <= 24; i++) { const u = i / 24, q = 1 - u, Y = q * q * q * y0 + 3 * q * q * u * y1 + 3 * q * u * u * y2 + u * u * u * y3; if (Math.abs(Y - yy) < bd) { bd = Math.abs(Y - yy); bx = q * q * q * x0 + 3 * q * q * u * x1 + 3 * q * u * u * x2 + u * u * u * x3 } } return bx }   // 그 높이의 몸 옆선
  const ax = thin ? (J ? J.jx - 0.2 : side(ay) - 0.6) : hw * (1 - 0.2 * (ay - t - H * mid) / (H * (1 - mid))) - 0.3   // 팔 자리 — 몸 옆 테두리 위
  const tube = (q, w, col, edge) => {   // 가는 팔다리 한 가닥 — edge 면 테두리(몸 뒤에), 아니면 몸 색(몸 위에 덮어 이음매를 지운다)
    g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = edge ? OUT : col; g.lineWidth = edge ? w + LW * 2 : w
    g.beginPath(); g.moveTo(q[0], q[1]); g.quadraticCurveTo(q[2], q[3], q[4], q[5]); g.stroke()
  }
  const hold = thin && o.hold, hx = thin ? ax + 1.7 : ax, hy = thin ? ay + 1.8 - arm * 0.6 : ay - arm * 1.1   // 쥔 손 자리
  const legs = edge => { for (const s of [-1, 1]) { const ph = s * foot, up = Math.max(0, ph) * 0.9, dx = ph * 0.8; tube([s * 3.1, -2.6 - bob, s * 3.1 + dx * 0.5, L - 1.2 - bob - up * 0.5, s * 3.1 + dx, L - 0.95 - up - bob], 1.9, limb, edge) } }   // 짧은 두 다리 — 걸을 때 번갈아 들어 가는 쪽으로 내딛는다
  const arms = edge => {
    for (const s of [-1, 1]) {
      if (s > 0 && hold) { tube([ax, ay, ax + 1.4, ay + 0.5, hx, hy], 1.35, af, edge); continue }   // 든 손 쪽 팔
      if (o.arms === 'none') continue
      const sw = -s * arm; tube([s * ax, ay, s * (ax + 1.1) + sw * 0.5, ay + 0.6, s * (ax + 1.5) + sw * 1.1, ay + 1.8 - Math.abs(sw) * 0.3], 1.35, af, edge)   // 늘어뜨린 팔 — 발과 엇갈려 흔든다
    }
  }
  g.save(); g.translate(0, -L)
  if (!thin) o.back?.(g, p)
  if (!thin && o.feet !== false) for (const s of [-1, 1]) { const lift = Math.max(0, s * foot); blob(g, s * (3.3 + lift * 0.5), -0.9 - lift * 1.4, 2.3, 1.35, limb, LW) }   // 작은 발 — 걸을 때 번갈아 든다
  g.save(); g.translate(0, bob)
  if (thin) { o.back?.(g, p); legs(true); arms(true) }   // 주인공은 뒤(꼬리 · 갈기 · 집게)도 몸과 함께 오르내린다
  g.fillStyle = o.fur; g.fill(P)
  if (o.cap) { g.save(); g.clip(P); o.cap(g, p, P); g.restore() }
  g.lineWidth = LW; g.strokeStyle = OUT; g.lineJoin = 'round'; g.stroke(P)
  if (o.fluffy) fluff(g, S, t + H / 2)
  if (thin) legs(false)
  o.ears?.(g, p, P)
  if (thin) arms(false)
  else if (o.arms === 'cheek') for (const s of [-1, 1]) blob(g, s * 7.6, t + H * 0.62 - s * arm * 0.5, 1.7, 2.1, af, 0.6)   // 볼 아래에 댄 두 손
  else if (o.arms !== 'none') for (const s of [-1, 1]) bump(g, s * ax, ay - s * arm * 1.1, 1.7, 2.4, s * 0.45, af, s > 0 ? -1.7 : Math.PI - 1.9, s > 0 ? 1.9 : Math.PI + 1.7)   // 팔 — 몸 옆에 붙은 작은 혹, 발과 엇갈려 오르내린다
  g.save(); g.translate(p.look || 0, 0); o.face(g, p); g.restore()
  o.front?.(g, p)
  if (o.hold) { o.hold(g, hx, hy); thin ? blob(g, hx + 0.1, hy + 0.1, 1.15, 1.25, af, 0.6) : blob(g, hx + 0.3, hy + 0.4, 1.7, 2.1, af, 0.6) }   // 든 것 — 쥔 손을 위에
  g.restore(); g.restore()
}
/** 사스마타 — (0, 0) 에서 +x 로 자루 L(뒤쪽은 하얀 손잡이), 끝은 Y 로 갈라져 바깥으로 휘며 가늘어지는 두 갈래 · 갈래 양옆에 하얀 가시 셋씩.
 *  동그라미를 촘촘히 찍어 굵기가 줄어드는 모양을 만든다(테두리 먼저 → 가시 → 속 색) */
function sasuShape(g, L, col) {
  const bz = (c, t) => { const q = 1 - t; return [0, 1].map(i => q * q * q * c[0][i] + 3 * q * q * t * c[1][i] + 3 * q * t * t * c[2][i] + t * t * t * c[3][i]) }
  const shaft = [], arms = []
  for (let u = 0; u <= L - 0.3; u += 0.25) shaft.push([u, 0, 0.62 + Math.max(0, (u - L + 3) / 3) ** 2 * 0.5])   // 끝으로 갈수록 부드럽게 넓어져 갈래로 이어진다
  for (const s of [-1, 1]) {   // 갈래 — 자루 끝에서 매끄럽게 갈라져(Y), 앞으로 뻗다가 끝이 바깥으로 휜다
    const B = [[L + 4.4, s * 4.4], [L + 7, s * 4.4], [L + 8.8, s * 4.8], [L + 10.2, s * 6.4]], pts = []
    for (let i = 0; i <= 30; i++) { const a = Math.PI - i / 30 * Math.PI / 2; pts.push([L + 4.4 + Math.cos(a) * 4.4, s * Math.sin(a) * 4.4, 0.95]) }   // 둥근 U 바닥
    for (let i = 1; i <= 30; i++) { const t = i / 30; pts.push([...bz(B, t), 0.88 * (1 - t * t) + 0.1 * t * t]) }
    arms.push(pts)
  }
  const discs = (D, grow, col) => { g.fillStyle = col; g.beginPath(); for (const [x, y, r] of D) { g.moveTo(x + r + grow, y); g.arc(x, y, r + grow, 0, TAU) } g.fill() }
  discs([...shaft, ...arms.flat()], 0.5, OUT)   // 테두리
  g.lineJoin = 'round'
  for (const pts of arms) for (const [i, side] of [[27, 1], [27, -1], [34, 1], [34, -1], [41, 1], [41, -1]]) {   // 하얀 가시 — 갈래 양옆에 번갈아
    const [x, y, r] = pts[i], [x1, y1] = pts[i + 1], [x0, y0] = pts[i - 1], tl = Math.hypot(x1 - x0, y1 - y0) || 1, tx = (x1 - x0) / tl, ty = (y1 - y0) / tl, nx = -ty * side, ny = tx * side
    g.beginPath(); g.moveTo(x + nx * r * 0.5 - tx * 0.75, y + ny * r * 0.5 - ty * 0.75); g.lineTo(x + nx * (r + 1.35), y + ny * (r + 1.35)); g.lineTo(x + nx * r * 0.5 + tx * 0.75, y + ny * r * 0.5 + ty * 0.75); g.closePath()
    g.fillStyle = '#fff'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 0.4; g.stroke()
  }
  const grip = L * 0.3
  discs(shaft.filter(d => d[0] >= grip - 0.3).concat(arms.flat()), 0, col)   // 분홍 자루 · 갈래
  discs(shaft.filter(d => d[0] < grip), 0, '#fbfbf8')   // 하얀 손잡이
  g.strokeStyle = OUT; g.lineWidth = 0.35; g.beginPath(); g.moveTo(grip, -0.62); g.lineTo(grip, 0.62); g.stroke()   // 손잡이 경계
  g.strokeStyle = 'rgba(255,255,255,.55)'; g.lineWidth = 0.32; g.lineCap = 'round'; g.beginPath(); g.moveTo(grip + 0.8, -0.28); g.lineTo(L - 0.5, -0.28); g.stroke()   // 자루 윤기
}
function guitar(g) {   // (0, 0) 이 몸통, 목은 +x
  for (const [c, lw] of [[OUT, 2.8], ['#8a5a3c', 1.4]]) { g.strokeStyle = c; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath(); g.moveTo(2.6, 0); g.lineTo(12, 0); g.stroke() }
  blob(g, 13, 0, 1.5, 1.2, '#8a5a3c', 0.8)
  const body = () => { g.beginPath(); g.ellipse(-2.4, 0, 3.7, 3.4, 0, 0, TAU); g.ellipse(1.4, 0, 2.8, 2.5, 0, 0, TAU) }
  g.strokeStyle = OUT; g.lineWidth = 1.8; body(); g.stroke(); g.fillStyle = '#f0a75a'; body(); g.fill()
  g.fillStyle = '#5a3a26'; g.beginPath(); g.arc(0.3, 0, 1, 0, TAU); g.fill()
}
const topEar = (g, x, y, r, fill, rot) => bump(g, x, y, r, r * 0.96, rot, fill, Math.PI * 1.02, Math.PI * 1.98)   // 머리 위 둥근 귀
const at = (H, f) => -1 - H + H * f   // 몸 위에서 f 만큼 내려온 높이
// 시사 — 크림색 · 뾰족한 고양이 귀 · 양옆에 셋씩 뻗은 꽃잎 같은 갈기 · 갈기 색 하트 눈썹(옷은 나중에)
function shisa(g, p) {
  const H = 26, y = f => at(H, f), fur = '#fdf2dc', mane = '#ec9a72'
  const tuft = (x, yy, a) => {   // 갈기 한 가닥 — 바깥으로 뾰족한 꽃잎(뿌리는 몸 뒤에 숨는다)
    g.save(); g.translate(x, yy); g.rotate(a)
    g.beginPath(); g.moveTo(-1, -2.8); g.bezierCurveTo(2.2, -4, 5, -2.4, 5, 0); g.bezierCurveTo(5, 2.4, 2.2, 4, -1, 2.8); g.closePath(); g.fillStyle = mane; g.fill(); g.lineWidth = LW; g.strokeStyle = OUT; g.stroke()
    g.strokeStyle = 'rgba(61,48,43,.5)'; g.lineWidth = 0.45; g.beginPath(); g.moveTo(1, 0); g.lineTo(2.8, 0); g.stroke()
    g.restore()
  }
  mochi(g, {
    fur, W: 25.5, H, mid: 0.42, thin: true, neck: 0.7, jw: 0.84,
    back: (g, p) => { const w = (p.foot || 0) * 0.12, lag = (p.bob || 0) * 0.07; for (const s of [-1, 1]) [[0.18, -0.8], [0.33, -0.25], [0.48, 0.3]].forEach(([f, a], k) => { const sw = w * (1 + k * 0.4) - s * lag * (k + 1); tuft(s * 10.4, y(f), s > 0 ? a + sw : Math.PI - a + sw) }) },   // 갈기 — 왼쪽 셋 · 오른쪽 셋. 걸을 때 흔들리고, 몸이 오르면 끝이 살짝 처진다
    ears: g => { for (const s of [-1, 1]) { spike(g, [[s * 9.2, y(0.12)], [s * 9.2, y(0.01)], [s * 8.2, y(-0.08)], [s * 6.6, y(0.0)], [s * 5.2, y(0.05)]], fur); g.strokeStyle = OUT; g.lineWidth = 0.45; g.beginPath(); g.moveTo(s * 8.4, y(0.0)); g.lineTo(s * 8.6, y(-0.06)); g.stroke() } },   // 뾰족한 고양이 귀
    face: (g, p) => {
      if (!p.hurt) for (const s of [-1, 1]) heart(g, s * 4.4, y(0.24), 1.6, mane, 0.6)   // 갈기 색 하트 눈썹
      dotEyes(g, y(0.36), 4.2, 1.3, p); hatch(g, y(0.45), 7.6, 0.9); catMouth(g, y(0.45), p.hurt ? 1.1 : 0.55)
    },
  }, p)
}
// 랏코 — 크림색 복슬 · 작은 검은 귀 · 검은 발 · 이마의 별 모양 흉터 · 하얀 목도리 망토(앞 검은 매듭) · 반쯤 감은 진지한 눈 · 칼
function rakko(g, p) {
  const H = 26, y = f => at(H, f), fur = '#faf0d6', black = '#2f2a2a'
  mochi(g, {
    fur, W: 26, H, mid: 0.42, thin: true, neck: 0.68, jw: 0.84, fluffy: true, limb: black, arms: 'none',
    back: (g, p) => { const w = (p.foot || 0) * 0.6; g.beginPath(); g.moveTo(-7.6, y(0.66)); g.quadraticCurveTo(-15.6, y(0.66) + w, -16.4, y(1) - w); g.lineTo(-14, y(0.92)); g.lineTo(-12.6, y(1.02) + w * 0.5); g.quadraticCurveTo(-10.4, y(0.9), -8.4, y(0.98)); g.closePath(); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 0.65; g.strokeStyle = OUT; g.stroke() },   // 크게 펄럭이는 망토   // 망토 자락
    cap: g => { const P = new Path2D(); P.moveTo(-14, y(0.58)); P.quadraticCurveTo(0, y(0.7), 14, y(0.58)); P.lineTo(14, y(0.74)); P.quadraticCurveTo(0, y(0.86), -14, y(0.74)); P.closePath(); g.fillStyle = '#fff'; g.fill(P); g.strokeStyle = OUT; g.lineWidth = 0.6; g.stroke(P) },   // 하얀 목도리
    ears: g => { for (const s of [-1, 1]) topEar(g, s * 10.4, y(0.2), 1.6, black, s * 1.05) },
    face: (g, p) => {
      g.save(); g.translate(-6.2, y(0.25)); g.rotate(0.62)   // 네 갈래 반짝이 모양 흉터 — 오른쪽 위로 긴 한 갈래
      const R = [3, 1.5, 1.9, 1.4]; g.beginPath(); for (let i = 0; i < 8; i++) { const a = -Math.PI / 2 + i * Math.PI / 4, r = i % 2 ? 0.58 : R[i / 2]; g.lineTo(Math.cos(a) * r, Math.sin(a) * r) } g.closePath()
      g.fillStyle = '#d8c19c'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 0.5; g.lineJoin = 'round'; g.stroke(); g.restore()
      if (p.hurt || p.blink) dotEyes(g, y(0.42), 4.8, 1.45, p)
      else for (const s of [-1, 1]) {   // 옆으로 넓은 까만 눈 · 위에 흰 반짝임 · 아래에 흰 초승달 줄
        const ex = s * 4.8, ey = y(0.42)
        g.fillStyle = '#1e1719'; g.beginPath(); g.ellipse(ex, ey, 2.05, 1.5, 0, 0, TAU); g.fill()
        g.fillStyle = '#fff'; g.beginPath(); g.ellipse(ex, ey - 0.35, 1.15, 0.55, 0, 0, TAU); g.fill()
        g.strokeStyle = '#fff'; g.lineWidth = 0.28; g.lineCap = 'round'; g.beginPath(); g.moveTo(ex - 0.9, ey + 0.72); g.quadraticCurveTo(ex, ey + 0.95, ex + 0.9, ey + 0.72); g.stroke()
      }
      g.strokeStyle = OUT; g.lineCap = 'round'
      if (!p.hurt) { g.lineWidth = 0.5; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 4.1, y(0.325)); g.lineTo(s * 3.3, y(0.35)); g.stroke() } }   // 눈 안쪽 위의 짧은 눈썹
      g.lineWidth = 0.4; g.beginPath(); for (const s of [-1, 1]) { g.moveTo(s * 0.45, y(0.375)); g.lineTo(s * 0.5, y(0.4)) } g.stroke()   // 미간의 짧은 두 줄
      hatch(g, y(0.5), 8.6, 0.95)
      if (p.hurt) catMouth(g, y(0.5), 1.1)
      else { catMouth(g, y(0.5), 0); g.fillStyle = OUT; g.beginPath(); g.ellipse(0, y(0.495), 0.45, 0.3, 0, 0, TAU); g.fill(); g.lineWidth = 0.45; g.beginPath(); g.moveTo(-0.55, y(0.56)); g.quadraticCurveTo(0, y(0.58), 0.55, y(0.56)); g.stroke() }   // ω 입 · 작은 코 · 아래 웃는 입
    },
    front: (g, p) => {   // 몸 앞을 치마처럼 덮는 하얀 망토 자락 · 매듭
      const w = (p.foot || 0) * 0.4, C = new Path2D(); C.moveTo(-7.4, y(0.76)); C.lineTo(-9.8 - w, y(0.99)); C.quadraticCurveTo(-5, y(1.03), 0, y(0.995)); C.quadraticCurveTo(5, y(1.03), 9.8 - w, y(0.99)); C.lineTo(7.4, y(0.76)); C.closePath()
      g.fillStyle = '#fff'; g.fill(C); g.lineWidth = 0.6; g.strokeStyle = OUT; g.lineJoin = 'round'; g.stroke(C)
      g.lineWidth = 0.35; g.beginPath(); for (let x = -8; x <= 8.1; x += 2) { g.moveTo(x, y(0.975)); g.lineTo(x * 1.02, y(0.955)) } g.stroke()
      blob(g, 0, y(0.79), 1.3, 0.95, black, 0.5)
    },
    hold: (g, x, y) => {
      g.save(); g.translate(x, y); g.rotate(-1.35)   // 칼을 세워 든다
      g.beginPath(); g.moveTo(1.8, -1); g.lineTo(14.6, -1); g.lineTo(16.6, 0); g.lineTo(14.6, 1); g.lineTo(1.8, 1); g.closePath(); g.fillStyle = '#d6dde6'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 0.65; g.stroke()
      g.lineCap = 'round'
      for (const [c, lw] of [[OUT, 2.3], ['#ffd23f', 1.1]]) { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); g.moveTo(1.4, -2.6); g.lineTo(1.4, 2.6); g.stroke() }
      for (const [c, lw] of [[OUT, 2.3], ['#6b4a2f', 1.1]]) { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); g.moveTo(-3.2, 0); g.lineTo(0.6, 0); g.stroke() }
      g.restore()
    },
  }, p)
}
// 쿠리만쥬 — 살구 베이지 · 조금 넓은 몸 · 머리 위에 얹힌 납작한 밤색 머리 · 작은 귀 · 눈썹 없음 · 한 잔
function kurimanju(g, p) {
  const H = 25.5, y = f => at(H, f), fur = '#fae3c6', brown = '#90603f'
  mochi(g, {
    fur, W: 26, H, mid: 0.5, thin: true, neck: 0.74, jw: 0.88,
    cap: g => {   // 밤색 머리 — 머리 윗부분을 모자처럼 덮는다
      const edge = () => { g.moveTo(-14, y(0.14)); g.quadraticCurveTo(0, y(0.26), 14, y(0.14)) }
      g.fillStyle = brown; g.beginPath(); edge(); g.lineTo(14, y(-0.1)); g.lineTo(-14, y(-0.1)); g.fill()
      g.fillStyle = 'rgba(255,255,255,.2)'; g.beginPath(); g.ellipse(-3.2, y(0.07), 3.2, 1, -0.12, 0, TAU); g.fill()
      g.strokeStyle = OUT; g.lineWidth = 0.6; g.beginPath(); edge(); g.stroke()
    },
    ears: g => { for (const s of [-1, 1]) topEar(g, s * 8.6, y(0.13), 1.6, fur, s * 0.9) },   // 밤색 머리 끝 옆의 작은 귀
    face: (g, p) => { dotEyes(g, y(0.44), 4.4, 1.3, p); hatch(g, y(0.52), 8.2, 0.9); catMouth(g, y(0.52), p.hurt ? 1.1 : 0.4) },
    front: g => {
      g.lineWidth = 0.65; g.strokeStyle = OUT; g.beginPath(); g.arc(14.4, -7.6, 1.3, -Math.PI / 2, Math.PI / 2); g.stroke()
      g.fillStyle = '#ffc93d'; g.beginPath(); g.rect(11, -9.8, 3.4, 4.4); g.fill(); g.stroke()
      blob(g, 12.7, -10, 2.1, 1, '#fff', 0.55)
    },
  }, p)
}
// 카니 — 헌책방. 복숭앗빛 몸 · 분홍 머리 · 게 집게 머리띠 · 짧은 눈썹 · 초록 헌책
function kani(g, p) {
  const H = 27, y = f => at(H, f), fur = '#fdeae2', pink = '#f6a9ad'
  mochi(g, {
    fur, W: 25, H, mid: 0.42, thin: true, neck: 0.7, jw: 0.84,
    back: (g, p) => {
      for (const s of [-1, 1]) {
        g.save(); g.translate(s * 6.8, y(0.06)); g.rotate(s * 0.35 + (p.foot || 0) * 0.1 - s * (p.bob || 0) * 0.06)   // 집게 머리띠 — 걸을 때 흔들린다
        for (const [col, lw] of [[OUT, 2.1], [pink, 1]]) { g.strokeStyle = col; g.lineWidth = lw; g.beginPath(); g.moveTo(0, 3); g.lineTo(0, -1.4); g.stroke() }
        g.beginPath(); g.moveTo(0, -1.2); g.bezierCurveTo(-3.9, -2, -3.9, -7.6, -0.5, -8); g.lineTo(-0.2, -5); g.lineTo(0.7, -7.8); g.bezierCurveTo(3.9, -7.2, 3.7, -2, 0, -1.2); g.closePath(); g.fillStyle = pink; g.fill(); g.lineWidth = 0.7; g.strokeStyle = OUT; g.stroke()
        g.restore()
      }
    },
    cap: g => { g.fillStyle = pink; g.beginPath(); g.moveTo(-14, y(0.27)); g.quadraticCurveTo(0, y(0.18), 14, y(0.27)); g.lineTo(14, y(-0.1)); g.lineTo(-14, y(-0.1)); g.fill() },
    face: (g, p) => {
      if (!p.hurt) { g.strokeStyle = OUT; g.lineWidth = 0.5; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 3, y(0.3)); g.lineTo(s * 5, y(0.27)); g.stroke() } }
      dotEyes(g, y(0.4), 4.2, 1.4, p); hatch(g, y(0.48), 7.6, 0.9); catMouth(g, y(0.49), p.hurt ? 1.1 : 0.55)
    },
    front: g => { g.save(); g.translate(-11.4, -5); g.rotate(-0.15); g.fillStyle = '#8fd14f'; g.fillRect(-2, -2.8, 4, 5.6); g.fillStyle = '#fff'; g.fillRect(1.1, -2.3, 0.7, 4.6); g.strokeStyle = OUT; g.lineWidth = 0.6; g.strokeRect(-2, -2.8, 4, 5.6); g.restore() },   // 초록 헌책
  }, p)
}
// 고블린 — 연두색 · 머리 꼭지 · 옆으로 뻗은 뾰족 귀 · 몸 아래만 두른 들쭉날쭉한 가죽옷 · 몽둥이
function goblin(g, p = {}, o = {}) {
  const H = 22.5, y = f => at(H, f), col = o.col || '#b3df90'
  mochi(g, {
    fur: col, W: 23, H,
    back: g => { if (o.cape) { g.beginPath(); g.moveTo(-8.6, y(0.3)); g.lineTo(-13.6, 0); g.lineTo(13.6, 0); g.lineTo(8.6, y(0.3)); g.closePath(); g.fillStyle = '#c0392b'; g.fill(); g.lineWidth = LW; g.strokeStyle = OUT; g.stroke() } },
    cap: g => {
      g.fillStyle = o.cloth || '#a8835f'; g.beginPath(); g.moveTo(-13, y(0.72)); g.lineTo(13, y(0.72)); g.lineTo(13, -2.6)
      for (let x = 13; x > -13; x -= 3.25) { g.lineTo(x - 1.6, -1.2); g.lineTo(x - 3.25, -2.8) }
      g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 0.6; g.stroke()
    },
    ears: g => {
      for (const s of [-1, 1]) spike(g, [[s * 10.6, y(0.22)], [s * 13.8, y(0.2)], [s * 15.2, y(0.26)], [s * 13.6, y(0.38)], [s * 11.2, y(0.46)]], col)
      if (!o.crown) spike(g, [[-3, y(0.04)], [-0.6, y(-0.02)], [0.4, y(-0.15)], [1.6, y(-0.02)], [3, y(0.04)]], col)   // 머리 꼭지
    },
    face: (g, p) => {
      if (o.band) { g.fillStyle = '#e5534b'; g.fillRect(-11, y(0.24), 22, 2.2); g.strokeStyle = OUT; g.lineWidth = 0.5; g.strokeRect(-11, y(0.24), 22, 2.2) }
      dotEyes(g, y(0.42), 4.2, 1.3, p); hatch(g, y(0.5), 7.4, 0.8); catMouth(g, y(0.51), 0.45)
    },
    hold: (g, x, y) => {
      g.save(); g.translate(x, y); g.rotate(-1.1)
      for (const [c, lw] of [[OUT, 3.2], ['#8a6142', 1.9]]) { g.strokeStyle = c; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath(); g.moveTo(-2, 0); g.lineTo(6.2, 0); g.stroke() }
      blob(g, 7, 0, 2.2, 1.8, '#8a6142', 0.65)
      g.restore()
    },
    front: g => { if (o.crown) { const c = y(0.02); g.beginPath(); g.moveTo(-5, c); g.lineTo(-5, c - 5.2); g.lineTo(-2.5, c - 2.4); g.lineTo(0, c - 6.2); g.lineTo(2.5, c - 2.4); g.lineTo(5, c - 5.2); g.lineTo(5, c); g.closePath(); g.fillStyle = '#ffd23f'; g.fill(); g.lineWidth = 0.7; g.strokeStyle = OUT; g.stroke() } },
  }, p)
}
/** 크게 키운 그림(정예 · 보스) — 키운 만큼 선이 두꺼워지지 않게 굵기를 √k 로 나눈다 */
function big(g, k) {
  g.scale(k, k)
  const d = Object.getOwnPropertyDescriptor(CanvasRenderingContext2D.prototype, 'lineWidth')
  Object.defineProperty(g, 'lineWidth', { configurable: true, get: () => d.get.call(g), set: v => d.set.call(g, v / Math.sqrt(k)) })
}
/** 겹친 모양을 테두리 하나로 — 모든 모양에 굵은 테두리를 긋고, 그 위를 속 색으로 채운다(동그라미 둘 날개 · 가면 등) */
function union(g, shapes, fill, lw = LW) {
  g.lineJoin = 'round'; g.strokeStyle = OUT; g.lineWidth = lw * 2; for (const P of shapes) g.stroke(P)
  g.fillStyle = fill; for (const P of shapes) g.fill(P)
}
const ell = (x, y, rx, ry, rot = 0) => { const P = new Path2D(); P.ellipse(x, y, rx, ry, rot, 0, TAU); return P }
// 키메라 — 분홍 몸 · 끝이 까만 둥근 귀 · 수염 · 감은 눈에서 흐르는 눈물 · 벌린 입 · 하얀 배 · 양옆 하얀 날개 · 보랏빛 줄무늬 꼬리. legs 면 네 발(어른 키메라), horns 면 뿔
function chimera(g, p = {}, o = {}) {
  const H = 20, y = f => at(H, f), col = o.col || '#f9cdd6', f = p.foot || 0
  mochi(g, {
    fur: col, W: 20.5, H, limb: col,
    back: g => {
      if (o.legs) for (const s of [-1, 1]) blob(g, s * 7.4, -1 - Math.max(0, -s * f) * 1.3, 2, 1.3, col, LW)   // 네 발 — 뒷발 한 쌍 더
      if (o.horns) for (const s of [-1, 1]) spike(g, [[s * 3, y(0.08)], [s * 5.6, y(-0.18)], [s * 6.4, y(-0.32)], [s * 6, y(-0.12)], [s * 6.6, y(0.12)]], '#f2e6c9')
      for (const s of [-1, 1]) union(g, [ell(s * 10.6, y(0.56) - f * 0.3, 2.5, 2.3), ell(s * 10.3, y(0.78), 2, 1.9)], '#fff')   // 하얀 날개 — 동그라미 둘
      const T = new Path2D(); T.moveTo(-5.6, -1.4); T.quadraticCurveTo(-10.4, -0.8, -14.6, -5.4); T.quadraticCurveTo(-10, -5.4, -6, -4.8); T.closePath()   // 보랏빛 꼬리(뒤쪽)
      g.fillStyle = '#a597f2'; g.fill(T); g.save(); g.clip(T); g.strokeStyle = '#6c5cc4'; g.lineWidth = 0.55; for (const x of [-8, -10, -12]) { g.beginPath(); g.moveTo(x + 0.6, -6); g.lineTo(x - 0.6, 0); g.stroke() } g.restore()
      g.lineWidth = LW; g.strokeStyle = OUT; g.stroke(T)
    },
    cap: g => blob(g, 0, y(0.83), 4.4, 3.3, '#fff', 0.65),   // 하얀 배
    ears: g => {
      for (const s of [-1, 1]) { topEar(g, s * 6.5, y(0.07), 2.5, '#2b211d', s * 0.55); g.fillStyle = col; g.beginPath(); g.ellipse(s * 5.8, y(0.13), 1.8, 1.6, 0, 0, TAU); g.fill() }   // 끝이 까만 귀
      g.strokeStyle = OUT; g.lineWidth = 0.5; g.lineCap = 'round'; g.beginPath()
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { g.moveTo(s * 9.8, y(0.4) + k * 1.1); g.lineTo(s * 13.2, y(0.36) + k * 1.6 - 0.4) }   // 수염
      g.stroke()
    },
    face: (g, p) => {
      if (p.hurt) { dotEyes(g, y(0.4), 3.6, 1.1, p); hatch(g, y(0.47), 8, 0.85); catMouth(g, y(0.47), 1.1); return }
      g.strokeStyle = OUT; g.lineCap = 'round'
      for (const s of [-1, 1]) {
        g.lineWidth = 0.5; g.beginPath(); g.moveTo(s * 2.6, y(0.27)); g.quadraticCurveTo(s * 3.6, y(0.24), s * 4.6, y(0.27)); g.stroke()   // 눈썹
        g.lineWidth = 0.7; g.beginPath(); g.moveTo(s * 2.4, y(0.4)); g.quadraticCurveTo(s * 3.6, y(0.355), s * 4.8, y(0.4)); g.stroke()   // 감은 눈
      }
      hatch(g, y(0.47), 8.2, 0.85)
      for (const s of [-1, 1]) { const T = new Path2D(); T.moveTo(s * 3.1, y(0.42)); T.lineTo(s * 3.1, y(0.58)); T.quadraticCurveTo(s * 3.6, y(0.62), s * 4.1, y(0.58)); T.lineTo(s * 4.1, y(0.42)); g.fillStyle = '#fff'; g.fill(T); g.lineWidth = 0.45; g.strokeStyle = OUT; g.stroke(T) }   // 흐르는 눈물
      catMouth(g, y(0.47), 0.75); g.lineWidth = 0.5; g.beginPath(); g.moveTo(-0.8, y(0.6)); g.quadraticCurveTo(0, y(0.63), 0.8, y(0.6)); g.stroke()
    },
  }, p)
}
// 가면 키메라 — 「그래서 어쩌라고」. 긴 귀가 달린 빨간 가면(이마의 소용돌이 · 하얀 테 큰 눈 · 송곳니 난 커다란 입) · 물결치는 하얀 갈기 · 겨자색 네 발 몸 · 하얀 곤충 날개 · 파란 꼬리(오른쪽을 본다)
function maskChimera(g, p = {}) {
  const f = p.foot || 0, red = '#e2566c', mus = '#e8c65e', ink = '#3a1520'
  g.lineCap = g.lineJoin = 'round'
  for (const [x, yy, a, l] of [[-4.6, -15, -0.75, 6.4], [-2.6, -16, -0.35, 6]]) { g.save(); g.translate(x, yy); g.rotate(a); blob(g, 0, -l, 1.9, l, 'rgba(255,255,255,.95)', 0.6); g.restore() }   // 하얀 곤충 날개
  for (const [c, w] of [[OUT, 2.6], ['#6db4df', 1.3]]) { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(-10, -8.6); g.quadraticCurveTo(-14.6, -10.4, -13.6, -14); g.moveTo(-12, -10); g.quadraticCurveTo(-14.8, -7.4, -13.6, -4.4); g.stroke() }   // 파란 꼬리
  for (const [x, ph] of [[-9.2, 1], [-5.6, -1], [-0.6, -1], [2.6, 1]]) { const up = Math.max(0, ph * f) * 1.2; const L = new Path2D(); L.roundRect(x - 1.15, -6.4, 2.3, 6 - up, 1.1); union(g, [L], mus) }   // 네 발 — 번갈아 든다
  union(g, [ell(-4.6, -8.6, 7, 4.4)], mus)   // 겨자색 몸
  const mane = new Path2D(); for (let i = 0; i < 18; i++) { const a = i / 18 * TAU; mane.moveTo(2.6 + Math.cos(a) * 8.2 + 1.7, -13 + Math.sin(a) * 8.6); mane.arc(2.6 + Math.cos(a) * 8.2, -13 + Math.sin(a) * 8.6, 1.7, 0, TAU) }
  mane.addPath(ell(2.6, -13, 8.4, 8.8)); union(g, [mane], '#fdfbf6', 0.6)   // 물결치는 하얀 갈기
  g.strokeStyle = 'rgba(61,48,43,.55)'; g.lineWidth = 0.4
  for (const R of [7.2, 5.8]) { g.beginPath(); for (let i = 0; i <= 60; i++) { const a = i / 60 * TAU, r = R + Math.sin(a * 14) * 0.35; g.lineTo(2.6 + Math.cos(a) * r, -13 + Math.sin(a) * r * 1.04) } g.stroke() }
  for (const s of [-1, 1]) { const E = new Path2D(); E.moveTo(2.6 + s * 1, -18.6); E.quadraticCurveTo(2.6 + s * 2.2, -26, 2.6 + s * 2.6, -28.4); E.quadraticCurveTo(2.6 + s * 4.4, -24, 2.6 + s * 3.8, -18.2); E.closePath(); union(g, [E], red); g.fillStyle = '#fbe7ea'; g.beginPath(); g.moveTo(2.6 + s * 2, -19.4); g.quadraticCurveTo(2.6 + s * 2.6, -24.4, 2.6 + s * 2.7, -26); g.quadraticCurveTo(2.6 + s * 3.4, -23, 2.6 + s * 3, -19.2); g.fill() }   // 긴 빨간 귀(안쪽 하양)
  union(g, [ell(3, -15.6, 5.2, 5), ell(3.4, -9.6, 6.2, 4.6)], red)   // 빨간 가면
  for (const x of [1.2, 3, 4.8]) { blob(g, x, -19.4, 0.85, 0.8, '#fff', 0.4); g.strokeStyle = OUT; g.lineWidth = 0.35; g.beginPath(); for (let t = 0; t < TAU * 1.5; t += 0.3) { const r = 0.1 + t * 0.07; g.lineTo(x + Math.cos(t) * r, -19.4 + Math.sin(t) * r) } g.stroke() }   // 이마의 소용돌이
  for (const x of [0.4, 5.8]) { blob(g, x, -15.8, 1.9, 1.9, '#fff', 0.55); g.fillStyle = '#231a1e'; g.beginPath(); g.arc(x + 0.25, -15.6, 1.25, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(x - 0.15, -16.1, 0.4, 0, TAU); g.fill() }   // 하얀 테 큰 눈
  g.strokeStyle = OUT; g.lineWidth = 0.45; for (const s of [-1, 1]) { g.beginPath(); g.arc(3.1 + s * 0.9, -13.6, 0.45, 0, Math.PI * 1.6); g.stroke() }   // 콧구멍
  const M = ell(3.4, -8.8, 5.4, 3.7); g.fillStyle = '#fff'; g.fill(M); g.lineWidth = 0.6; g.strokeStyle = OUT; g.stroke(M)   // 하얀 입술
  const I = ell(3.4, -8.7, 4.2, 2.7); g.fillStyle = ink; g.fill(I); g.save(); g.clip(I)
  g.fillStyle = '#f08a9b'; g.beginPath(); g.ellipse(3.6, -6.6, 2.4, 1.3, 0, 0, TAU); g.fill()   // 혀
  g.fillStyle = '#fff'; for (const [x, yy, d, w] of [[0.6, -11.4, 1, 0.8], [6.2, -11.4, 1, 0.8], [2.2, -11.4, 0.6, 0.5], [4.6, -11.4, 0.6, 0.5], [1, -6, -1, 0.7], [5.8, -6, -1, 0.7]]) { g.beginPath(); g.moveTo(x - w, yy); g.lineTo(x + w, yy); g.lineTo(x, yy + d * 2); g.closePath(); g.fill() }   // 송곳니
  g.restore(); g.lineWidth = 0.5; g.strokeStyle = OUT; g.stroke(I)
}
// 초록 벌레 — 하얀 얼굴 · 초록 털모자 · 끝에 하얀 방울이 달린 까만 더듬이 · 동그랗게 벌린 입 · 마디진 초록 몸 · 가는 까만 다리 · 하얀 꼬리(오른쪽을 본다)
function bug(g, p = {}) {
  const f = p.foot || 0, green = '#c3e6a4', ink = '#2b211d', seam = 'rgba(61,48,43,.6)'
  g.lineCap = g.lineJoin = 'round'
  for (const s of [-1, 1]) { const up = Math.max(0, s * f) * 1.2; g.strokeStyle = ink; g.lineWidth = 1.1; g.beginPath(); g.moveTo(s * 2.4, -3.4); g.lineTo(s * 2.5, -0.6 - up); g.lineTo(s * 4, -0.6 - up); g.stroke() }   // 가는 까만 다리 — 발끝은 바깥으로
  g.save(); g.translate(0, -Math.abs(f) * 0.3)
  g.beginPath(); g.moveTo(-7.4, -4.4); g.quadraticCurveTo(-10, -3.8, -10.4, -1.8); g.lineTo(-9, -1.6); g.quadraticCurveTo(-8.4, -3, -6.8, -3.2); g.closePath(); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 0.6; g.strokeStyle = OUT; g.stroke()   // 하얀 꼬리(뒤쪽)
  for (const s of [-1, 1]) { g.strokeStyle = ink; g.lineWidth = 0.85; g.beginPath(); g.moveTo(s * 2, -23); g.lineTo(s * 5.4, -27.4); g.lineTo(s * 8.2, -25.2); g.stroke(); blob(g, s * 8.5, -24.8, 1.25, 1.25, '#fff', 0.6) }   // 더듬이 · 하얀 방울
  blob(g, 0, -15.4, 7, 6.2, '#fffdfb', LW)   // 하얀 얼굴
  const B = new Path2D(); B.moveTo(0, -11.6); B.bezierCurveTo(5.8, -11.6, 9.6, -9.9, 9.6, -6.7); B.bezierCurveTo(9.6, -3.2, 6, -2.4, 0, -2.4); B.bezierCurveTo(-6, -2.4, -9.6, -3.2, -9.6, -6.7); B.bezierCurveTo(-9.6, -9.9, -5.8, -11.6, 0, -11.6); B.closePath()
  g.fillStyle = green; g.fill(B); g.save(); g.clip(B); g.strokeStyle = seam; g.lineWidth = 0.5; for (const yy of [-8.6, -5.6]) { g.beginPath(); g.moveTo(-10, yy - 0.7); g.quadraticCurveTo(0, yy + 0.9, 10, yy - 0.7); g.stroke() } g.restore()   // 마디진 몸
  g.lineWidth = LW; g.strokeStyle = OUT; g.stroke(B)
  blob(g, 0, -20.6, 6.6, 1.7, green, LW)   // 모자 챙
  const C = new Path2D(); C.moveTo(-4.4, -20.9); C.bezierCurveTo(-4.4, -25.4, 4.4, -25.4, 4.4, -20.9); C.closePath(); g.fillStyle = green; g.fill(C); g.lineWidth = LW; g.stroke(C)   // 모자 꼭대기
  g.strokeStyle = seam; g.lineWidth = 0.45; g.beginPath(); g.moveTo(0, -24.3); g.lineTo(0, -21.4); g.stroke()
  if (p.hurt) dotEyes(g, -16.4, 2.7, 0.9, p)
  else { g.fillStyle = ink; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 2.8, -16.8, 0.6, 0.72, 0, 0, TAU); g.fill() } }
  g.fillStyle = ink; g.beginPath(); g.ellipse(0.2, -13.9, 1.45, 1.85, 0, 0, TAU); g.fill()   // 동그랗게 벌린 입
  g.strokeStyle = '#fff'; g.lineWidth = 0.4; g.beginPath(); g.arc(0.2, -13.6, 0.9, Math.PI * 1.15, Math.PI * 1.85); g.stroke(); g.beginPath(); g.moveTo(-0.2, -12.6); g.lineTo(0.6, -12.6); g.stroke()
  g.restore()
}
// 꼬마 풍뎅이 — 밤색 탈을 쓴 것 같은 몸(하얀 얼굴과 배) · 머리 위 뼈다귀 모양 뿔 · 점 눈 · ω 입 · 아래 웃는 입
function beetle(g, p = {}) {
  const H = 20, W = 21, y = f => at(H, f), brown = '#a47b63'
  mochi(g, {
    fur: brown, W, H, mid: 0.42, limb: brown,
    cap: g => { g.save(); g.translate(0, -1.5); const I = segPath(mochiSegs(W - 3.8, H - 3.2, 0.42)); g.fillStyle = '#fdfaf5'; g.fill(I); g.lineWidth = 0.6; g.strokeStyle = OUT; g.stroke(I); g.restore() },   // 하얀 얼굴과 배
    ears: (g, p, P) => {   // 뼈다귀 모양 뿔 — 몸과 이어진 곳은 선 없이
      const t = y(0), A = new Path2D()
      A.moveTo(-1.3, t + 1.2); A.lineTo(-1.1, t - 0.9); A.bezierCurveTo(-2, t - 0.6, -4.6, t - 0.8, -4.4, t - 2.4); A.bezierCurveTo(-4.2, t - 3.8, -2, t - 3.8, -1, t - 2.9); A.quadraticCurveTo(0, t - 2.5, 1, t - 2.9)
      A.bezierCurveTo(2, t - 3.8, 4.2, t - 3.8, 4.4, t - 2.4); A.bezierCurveTo(4.6, t - 0.8, 2, t - 0.6, 1.1, t - 0.9); A.lineTo(1.3, t + 1.2); A.closePath()
      g.fillStyle = brown; g.fill(A); g.save(); const out = new Path2D(); out.rect(-40, -60, 80, 80); out.addPath(P); g.clip(out, 'evenodd'); g.lineWidth = LW; g.strokeStyle = OUT; g.stroke(A); g.restore()
    },
    face: (g, p) => { dotEyes(g, y(0.36), 3.2, 1.05, p); hatch(g, y(0.45), 7.4, 0.85); catMouth(g, y(0.45), p.hurt ? 1 : 0); g.strokeStyle = OUT; g.lineWidth = 0.55; g.beginPath(); g.moveTo(-1.6, y(0.66)); g.quadraticCurveTo(0, y(0.7), 1.6, y(0.66)); g.stroke() },
  }, p)
}
// 인형 같은 통통한 별 — 끝과 오목한 곳을 둥글린 다섯 갈래(아래 두 갈래가 다리처럼). 가운데는 밝고 가장자리는 짙게
function plushStar(g, R, r, fill, edge, out, lw, sy = 1) {
  const v = []; for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, q = i % 2 ? r : R; v.push([Math.cos(a) * q, Math.sin(a) * q * sy]) }
  const P = new Path2D(), m = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], s0 = m(v[9], v[0]); P.moveTo(s0[0], s0[1])
  for (let i = 0; i < 10; i++) { const a = v[i], b = v[(i + 1) % 10]; P.arcTo(a[0], a[1], b[0], b[1], i % 2 ? R * 0.2 : R * 0.15) }
  P.closePath()
  const G = g.createRadialGradient(-R * 0.15, -R * 0.2, R * 0.1, 0, 0, R * 1.05); G.addColorStop(0, fill); G.addColorStop(0.65, fill); G.addColorStop(1, edge)
  g.fillStyle = G; g.fill(P); g.lineJoin = 'round'; g.lineWidth = lw; g.strokeStyle = out; g.stroke(P)
  return P
}
// 별똥별 — 노란 털인형 별 · 겁먹은 눈 · 악문 이 · 덜덜 떠는 줄(셋이 같이 다니고, 맞으면 「흐아아악!」)
function starKid(g, p = {}) {
  g.save(); g.translate(0, -11); g.rotate(-0.22 + (p.foot || 0) * 0.12)
  g.fillStyle = 'rgba(255,240,170,.45)'; g.beginPath(); g.moveTo(-4, 3); g.quadraticCurveTo(-14, 7, -18, 11); g.quadraticCurveTo(-12, 3, -4, -2); g.fill()   // 옅은 꼬리 빛
  plushStar(g, 12, 6.4, '#ffe23f', '#efbd12', OUT, LW)
  const ink = '#2b211d'
  for (const s of [-1, 1]) {   // 까만 눈 · 위의 흰 동그라미 · 아래 흰 초승달
    const ex = s * 3.3, ey = -1.5
    g.fillStyle = ink; g.beginPath(); g.arc(ex, ey, 1.75, 0, TAU); g.fill()
    g.fillStyle = '#fff'; g.beginPath(); g.arc(ex - 0.1, ey - 0.6, 0.72, 0, TAU); g.fill()
    g.strokeStyle = '#fff'; g.lineWidth = 0.42; g.lineCap = 'round'; g.beginPath(); g.arc(ex, ey - 0.1, 1.05, Math.PI * 0.2, Math.PI * 0.8); g.stroke()
  }
  g.strokeStyle = ink; g.lineWidth = 0.4; g.lineCap = 'round'; g.beginPath()
  for (const s of [-1, 1]) for (let k = 0; k < 2; k++) { const x = s * (5.7 + k * 0.6); g.moveTo(x, -2.6 + k * 0.3); g.lineTo(x - s * 0.3, -1.4 + k * 0.3) }   // 눈 옆 떠는 줄
  for (let k = -1; k <= 1; k++) { g.moveTo(k * 0.7, -3.9); g.lineTo(k * 0.7 + 0.1, -3) }   // 미간 떠는 줄
  g.moveTo(-0.7, 0); g.quadraticCurveTo(0, -0.5, 0.7, 0); g.stroke()   // 찡그린 코
  g.fillStyle = ink; for (let k = -1; k <= 1; k++) { g.beginPath(); g.ellipse(k * 0.9, 5, 0.26, 0.4, 0, 0, TAU); g.fill() }   // 턱 아래 떠는 점
  const w = 3.4, hh = 1.5, M = new Path2D()   // 악문 이 — 가운데가 잘록한 땅콩 모양
  M.moveTo(-w + 0.9, 2.6 - hh); M.quadraticCurveTo(0, 2.6 - hh + 0.9, w - 0.9, 2.6 - hh); M.bezierCurveTo(w + 0.5, 2.6 - hh, w + 0.5, 2.6 + hh, w - 0.9, 2.6 + hh)
  M.quadraticCurveTo(0, 2.6 + hh - 0.9, -w + 0.9, 2.6 + hh); M.bezierCurveTo(-w - 0.5, 2.6 + hh, -w - 0.5, 2.6 - hh, -w + 0.9, 2.6 - hh); M.closePath()
  g.fillStyle = '#fbfaf4'; g.fill(M); g.save(); g.clip(M); g.strokeStyle = ink; g.lineWidth = 0.28; g.beginPath(); g.moveTo(-w, 2.6); g.lineTo(w, 2.6)
  for (const x of [-1.9, -0.65, 0.65, 1.9]) { g.moveTo(x, 0.8); g.lineTo(x, 4.4) } g.stroke(); g.restore()
  g.lineWidth = 0.5; g.strokeStyle = ink; g.stroke(M)
  g.restore()
}
// 복어 — 동글동글 · 점무늬 · 양옆 지느러미 · 오므린 입(기름 그물을 뿌린다, 「블링블링 마블링」)
function fugu(g, p = {}) {
  const f = p.foot || 0
  g.save(); g.translate(0, -11)
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 8.6, -1); g.lineTo(s * 12.6, -4 + s * f); g.lineTo(s * 12.6, 3 + s * f); g.closePath(); g.fillStyle = '#f2c96a'; g.fill(); g.lineWidth = 0.6; g.strokeStyle = OUT; g.stroke() }
  blob(g, 0, 0, 10, 9.4, '#f8e3a6', LW)
  g.fillStyle = '#fffaf0'; g.beginPath(); g.ellipse(0, 4.2, 6.4, 3.8, 0, 0, TAU); g.fill()
  g.fillStyle = '#e0b860'; for (const [x, yy] of [[-5, -5], [3, -6.4], [6.2, -1.6], [-6.6, 0.4], [-0.8, -3]]) { g.beginPath(); g.arc(x, yy, 0.9, 0, TAU); g.fill() }
  dotEyes(g, -1, 4, 1.2, p); hatch(g, 1.4, 6.6, 0.7); blob(g, 0, 3, 1.3, 1.1, '#ec7a88', 0.55)
  g.restore()
}
// 문어 괴물 — 분홍빛 붉은 머리 · 꿈틀대는 다리 넷 · 이빨(약점)(간장을 뱉는다)
function octo(g, p = {}) {
  const f = p.foot || 0, col = '#f29a9a'
  for (let i = 0; i < 4; i++) { const x = -6 + i * 4, w = (i % 2 ? 1 : -1) * f * 1.6; g.beginPath(); g.moveTo(x - 1.8, -6); g.quadraticCurveTo(x - 2 + w, -2, x + w * 1.4, 0); g.quadraticCurveTo(x + 2 + w, -2, x + 1.8, -6); g.closePath(); g.fillStyle = col; g.fill(); g.lineWidth = 0.6; g.strokeStyle = OUT; g.stroke() }
  blob(g, 0, -12, 9.6, 9, col, LW)
  g.fillStyle = 'rgba(255,255,255,.5)'; g.beginPath(); g.ellipse(-3.6, -16.4, 2.4, 1.4, -0.4, 0, TAU); g.fill()
  dotEyes(g, -12.4, 3.8, 1.25, p)
  g.fillStyle = '#7a2a35'; g.beginPath(); g.ellipse(0, -7.8, 2.4, 1.5, 0, 0, TAU); g.fill()
  g.fillStyle = '#fff'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 1.7, -8.8); g.lineTo(s * 0.5, -8.8); g.lineTo(s * 1.1, -7.6); g.fill() }
}
// 아르바이트생 괴물 — 분홍빛 코끼리 같은 몸 · 뿔 여럿 · 점 눈 다섯 · 카페 앞치마
function parttimer(g, p = {}) {
  const H = 26, y = f => at(H, f), col = '#e9bcc8'
  mochi(g, {
    fur: col, W: 30, H, mid: 0.48,
    back: g => { for (const [x, h] of [[-6, 0.18], [0, 0.26], [6, 0.18], [-10.5, 0.06], [10.5, 0.06]]) spike(g, [[x - 2, y(0.1)], [x - 1, y(0.04 - h * 0.4)], [x, y(-h)], [x + 1, y(0.04 - h * 0.4)], [x + 2, y(0.1)]], '#f5e9d8') },
    cap: g => {
      g.fillStyle = '#fffaf2'; g.beginPath(); g.moveTo(-9, y(0.62)); g.lineTo(9, y(0.62)); g.lineTo(10.6, 0); g.lineTo(-10.6, 0); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 0.6; g.stroke()
      g.strokeRect(-3, y(0.75), 6, 3); g.beginPath(); g.moveTo(-9, y(0.62)); g.lineTo(-14, y(0.5)); g.moveTo(9, y(0.62)); g.lineTo(14, y(0.5)); g.stroke()
    },
    face: () => {
      for (const [x, f] of [[-7, 0.42], [-3.6, 0.38], [0, 0.36], [3.6, 0.38], [7, 0.42]]) { g.fillStyle = '#2b211d'; g.beginPath(); g.arc(x, y(f), 0.95, 0, TAU); g.fill() }
      g.fillStyle = col; g.beginPath(); g.moveTo(-2, y(0.46)); g.quadraticCurveTo(-2.4, y(0.6), -1, y(0.64)); g.lineTo(1, y(0.64)); g.quadraticCurveTo(2.4, y(0.6), 2, y(0.46)); g.fill(); g.lineWidth = 0.6; g.strokeStyle = OUT; g.stroke()   // 짧은 코
      hatch(g, y(0.52), 10, 0.85)
    },
  }, p)
}
// 가위바위보 — 살색 몸 · 머리 위 돌기 넷 · 쇠공 팔 · 바퀴 발 · 입 안의 진짜 얼굴
function rps(g, p = {}) {
  const f = p.foot || 0, skin = '#f2c9a8'
  for (const s of [-1, 1]) {   // 바퀴 발
    blob(g, s * 6, -3.4, 3.4, 3.4, '#8a8f99', LW)
    g.save(); g.translate(s * 6, -3.4); g.rotate(f * 0.8 * s); g.strokeStyle = OUT; g.lineWidth = 0.5; g.beginPath(); for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI; g.moveTo(Math.cos(a) * 3, Math.sin(a) * 3); g.lineTo(-Math.cos(a) * 3, -Math.sin(a) * 3) } g.stroke(); g.restore()
    blob(g, s * 6, -3.4, 0.9, 0.9, '#cfd3da', 0.5)
  }
  for (const s of [-1, 1]) {   // 쇠공 팔
    g.lineCap = 'round'; for (const [c, lw] of [[OUT, 2.4], [skin, 1.2]]) { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); g.moveTo(s * 8.6, -15); g.lineTo(s * 13.4, -12 + s * f); g.stroke() }
    blob(g, s * 14.6, -11.4 + s * f, 3.4, 3.4, '#6f7480', LW); g.fillStyle = 'rgba(255,255,255,.45)'; g.beginPath(); g.arc(s * 13.6, -12.6 + s * f, 1, 0, TAU); g.fill()
  }
  for (const x of [-5.4, -1.8, 1.8, 5.4]) blob(g, x, -26.6 + Math.abs(x) * 0.3, 1.8, 2.6, skin, LW)   // 머리 위 돌기 넷
  blob(g, 0, -16, 9.6, 11.4, skin, LW)
  eyes(g, -22.4, 3.2, 0.9, false)
  g.fillStyle = '#7a2a35'; g.beginPath(); g.ellipse(0, -14.4, 6, 5.2, 0, 0, TAU); g.fill(); g.strokeStyle = OUT; g.lineWidth = 0.6; g.stroke()   // 크게 벌린 입
  blob(g, 0, -13.8, 3.2, 3, '#ffe3cf', 0.5); eyes(g, -14.2, 1.2, 0.6); g.strokeStyle = OUT; g.lineWidth = 0.4; g.beginPath(); g.arc(0, -13.2, 0.7, 0.2, Math.PI - 0.2); g.stroke()   // 입 안의 진짜 얼굴
}
// 요리사 괴물 — 초록 피부 · 하얀 요리사 모자 · 뿔 둘 · 앞치마 · 하얀 발톱(「잘 먹겠습니다람쥐」)
function chef(g, p = {}) {
  const H = 26, y = f => at(H, f), skin = '#8fc47a'
  mochi(g, {
    fur: skin, W: 28, H, mid: 0.46,
    back: g => { for (const s of [-1, 1]) spike(g, [[s * 8, y(0.12)], [s * 10.4, y(-0.02)], [s * 12, y(-0.12)], [s * 11.2, y(0.06)], [s * 11.4, y(0.2)]], '#f2e6c9') },
    cap: g => { g.fillStyle = '#fffaf2'; g.beginPath(); g.moveTo(-10, y(0.6)); g.lineTo(10, y(0.6)); g.lineTo(12, 0); g.lineTo(-12, 0); g.closePath(); g.fill(); g.strokeStyle = OUT; g.lineWidth = 0.6; g.stroke() },
    ears: g => {
      for (const [x, r] of [[-4.4, 3.6], [4.4, 3.6], [0, 4.2]]) blob(g, x, y(-0.06), r, r * 0.92, '#fff', 0.7)
      g.fillStyle = '#fff'; g.fillRect(-6, y(0.02), 12, 3.2); g.strokeStyle = OUT; g.lineWidth = 0.7; g.strokeRect(-6, y(0.02), 12, 3.2)
    },
    face: (g, p) => {
      dotEyes(g, y(0.4), 5, 1.3, p); hatch(g, y(0.48), 8.6, 0.85)
      g.fillStyle = '#7a2a35'; g.beginPath(); g.moveTo(-4.4, y(0.5)); g.quadraticCurveTo(0, y(0.63), 4.4, y(0.5)); g.closePath(); g.fill()
      g.fillStyle = '#fff'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 3.2, y(0.505)); g.lineTo(s * 2, y(0.51)); g.lineTo(s * 2.6, y(0.56)); g.fill() }
    },
    front: g => { for (const s of [-1, 1]) for (let k = -1; k <= 1; k++) { const yy = y(0.64) + k * 1.2; g.beginPath(); g.moveTo(s * 13, yy); g.lineTo(s * 15.8, yy + k * 0.5); g.lineTo(s * 13, yy + 0.8); g.closePath(); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 0.4; g.strokeStyle = OUT; g.stroke() } },
  }, p)
}
// 파자마 파티즈 — 동물 잠옷(후드)을 입은 아이돌. 후드 앞은 얼굴이 보이지 않는 커다란 짙은 회색 타원 · 색마다 다른 후드 귀(초록 작은 귀 · 분홍 둥근 귀 · 하양 꼬부랑 뿔 · 보라 곰 귀) · 잠옷 앞 단추
const PJ = [{ col: '#b6e0a4', ears: 'small' }, { col: '#f3a3bd', ears: 'round' }, { col: '#f4f3f0', ears: 'curl' }, { col: '#cbbdec', ears: 'bear' }]
function pajama(g, p, o) {
  const H = 21, y = f => at(H, f)
  mochi(g, {
    fur: o.col, W: 20, H, mid: 0.4, thin: true,
    ears: g => {
      if (o.ears === 'curl') { g.lineCap = 'round'; for (const [c, w] of [[OUT, 2.3], [o.col, 1.1]]) { g.strokeStyle = c; g.lineWidth = w; g.beginPath(); g.moveTo(4, y(0.1)); g.quadraticCurveTo(6, y(0.02), 5.8, y(-0.1)); g.quadraticCurveTo(5.4, y(-0.18), 4.7, y(-0.1)); g.stroke() } return }   // 오른쪽 위 꼬부랑 뿔
      for (const s of [-1, 1]) topEar(g, s * (o.ears === 'small' ? 4.2 : 5.8), y(0.07), o.ears === 'small' ? 1.6 : o.ears === 'bear' ? 2.6 : 2.1, o.col, s * 0.5)
    },
    face: () => {
      blob(g, 0, y(0.42), 7.4, 6.5, '#5e5b61', 0.6)   // 얼굴이 보이지 않는 후드 속
      for (const yy of [y(0.79), y(0.89)]) blob(g, 0, yy, 0.6, 0.6, '#fdfcf8', 0.4)   // 잠옷 단추
    },
  }, p)
}
// 한잎이 · 두잎이 — 회색빛 섬 주민. 크고 둥근 머리 · 머리 위 잎(한잎이 하나 · 두잎이 둘) · 아래가 퍼지는 치마 같은 몸(밑단에 술) · 한잎이만 볼에 /// . 얼굴은 드러나지 않는다
const LF = '#9e8d8d'
function leaf(g, x, y, rot) {
  g.save(); g.translate(x, y); g.rotate(rot); g.beginPath(); g.moveTo(0, 0.4); g.bezierCurveTo(-3, -1, -2.4, -4.6, 0.6, -6.2); g.bezierCurveTo(2.2, -3.6, 2.4, -1, 0, 0.4); g.closePath(); g.fillStyle = '#b1a2a2'; g.fill(); g.lineWidth = 0.65; g.strokeStyle = OUT; g.stroke()
  g.lineWidth = 0.4; g.beginPath(); g.moveTo(0, -0.2); g.quadraticCurveTo(0.2, -3, 0.5, -5.4); for (const k of [1.6, 2.8, 4]) { g.moveTo(0.15, -k); g.lineTo(-0.9, -k + 0.9); g.moveTo(0.3, -k - 0.2); g.lineTo(1.1, -k + 0.5) } g.stroke(); g.restore()
}
function leafKid(g, p, leaves) {
  const f = p.foot || 0, bob = p.bob || 0
  g.save(); g.translate(0, bob * 0.6); g.rotate(f * 0.05)
  const B = new Path2D(); B.moveTo(-6.2, -12); B.bezierCurveTo(-6.6, -7, -8.8, -3.4, -8.6, -1.2); B.quadraticCurveTo(0, 0.2, 8.6, -1.2); B.bezierCurveTo(8.8, -3.4, 6.6, -7, 6.2, -12); B.closePath()
  for (const s of [-1, 1]) bump(g, s * 6.6, -9.4, 1.3, 2, s * 0.35, LF, s > 0 ? -1.6 : Math.PI - 1.6, s > 0 ? 1.6 : Math.PI + 1.6)   // 작은 팔
  g.fillStyle = LF; g.fill(B); g.lineWidth = LW; g.strokeStyle = OUT; g.lineJoin = 'round'; g.stroke(B)   // 치마 같은 몸
  g.lineCap = 'round'; g.lineWidth = 0.5; g.beginPath(); for (let x = -6.6; x <= 6.7; x += 1.65) { g.moveTo(x, -1.2 - Math.abs(x) * 0.02); g.lineTo(x * 0.97, -3.4) } g.stroke()   // 밑단의 술
  if (leaves === 1) leaf(g, 0.8, -24.4, 0.3); else for (const s of [-1, 1]) leaf(g, s * 0.6, -24.2, s * 0.85)   // 머리 위 잎
  blob(g, 0, -17.6, 8.6, 7.4, LF, LW)   // 크고 둥근 머리
  if (leaves === 1) { g.strokeStyle = OUT; g.lineWidth = 0.45; g.beginPath(); for (const s of [-1, 1]) for (let k = -1; k <= 1; k++) { const x = s * 4.6 + k * 0.85; g.moveTo(x - 0.35, -15.8); g.lineTo(x + 0.35, -16.9) } g.stroke() }   // 한잎이 볼 ///
  g.restore()
}
function leafPair(g, p) {   // 손을 꼭 잡은 둘
  g.save(); g.translate(-9.2, 0); leafKid(g, p, 1); g.restore()
  g.save(); g.translate(9.2, 0); leafKid(g, { ...p, foot: -(p.foot || 0) }, 2); g.restore()
  g.lineCap = 'round'; for (const [c, lw] of [[OUT, 2.3], [LF, 1.1]]) { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); g.moveTo(-3, -9.4); g.quadraticCurveTo(0, -6.6, 3, -9.4); g.stroke() }   // 맞잡은 손
}
// 치이카와 — 하얀 찹쌀떡(볼이 넓다) · 따로 떨어진 둥근 귀 · 짧은 눈썹 · 반짝이는 점 눈 · 분홍 사스마타
function chiikawa(g, p) {
  const H = 26, y = f => at(H, f)
  mochi(g, {
    fur: '#fff', W: 26, H, mid: 0.42, thin: true, neck: 0.7, jw: 0.84,
    ears: g => { for (const s of [-1, 1]) topEar(g, s * 6.6, y(0.06), 2.2, '#fff', s * 0.6) },
    face: (g, p) => {
      g.strokeStyle = OUT; g.lineCap = 'round'
      if (!p.hurt) { g.lineWidth = 0.6; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 2.5, y(0.21)); g.lineTo(s * 4.7, y(0.225)); g.stroke() } }
      dotEyes(g, y(0.35), 3.8, 1.4, p)   // 반짝이는 점 눈
      hatch(g, y(0.42), 7.1, 0.85); catMouth(g, y(0.42), p.hurt ? 1.1 : 0.6)
    },
    hold: (g, x, y) => { g.save(); g.translate(x, y); g.rotate(-1.2); g.translate(-5, 0); sasuShape(g, 17, '#ff9ab8'); g.restore() },
  }, p)
}
// 하치와레 — 하양 · 머리 위만 덮는 파란 무늬(이마 가운데가 위로 뾰족 갈라진다) · 위로 선 뾰족한 귀 · 반짝이는 점 눈 · 파란 꼬리 · 기타
function hachiware(g, p) {
  const H = 25.5, y = f => at(H, f), blue = '#6f9fc4'
  mochi(g, {
    fur: '#fff', W: 26, H, mid: 0.42, thin: true, neck: 0.7, jw: 0.84,
    back: g => { g.beginPath(); g.moveTo(5.6, -2.2); g.quadraticCurveTo(12.6, -2, 12.2, -6.8); g.quadraticCurveTo(10.8, -5.4, 8.2, -5.8); g.closePath(); g.fillStyle = blue; g.fill(); g.lineWidth = LW; g.strokeStyle = OUT; g.stroke() },
    cap: g => {   // 파란 무늬 — 3을 눕혀 놓은 것처럼 둥근 두 자락이 아래로 볼록, 가운데는 위로 뾰족한 홈
      const edge = () => { g.moveTo(-14, y(0.2)); g.bezierCurveTo(-11.4, y(0.22), -9, y(0.25), -6.2, y(0.25)); g.bezierCurveTo(-3.4, y(0.25), -1.4, y(0.21), -0.45, y(0.15)); g.quadraticCurveTo(0, y(0.115), 0.45, y(0.15)); g.bezierCurveTo(1.4, y(0.21), 3.4, y(0.25), 6.2, y(0.25)); g.bezierCurveTo(9, y(0.25), 11.4, y(0.22), 14, y(0.2)) }
      g.fillStyle = blue; g.beginPath(); edge(); g.lineTo(14, y(-0.1)); g.lineTo(-14, y(-0.1)); g.fill()
      g.strokeStyle = OUT; g.lineWidth = 0.55; g.beginPath(); edge(); g.stroke()   // 무늬 경계선
    },
    ears: g => {   // 크게 선 뾰족한 귀
      for (const s of [-1, 1]) spike(g, [[s * 10.8, y(0.16)], [s * 10.4, y(0.0)], [s * 8.6, y(-0.1)], [s * 7.2, y(-0.18)], [s * 6, y(-0.11)], [s * 4, y(-0.03)], [s * 2.8, y(0.05)]], blue)   // 끝이 둥근 귀
    },
    face: (g, p) => {
      if (!p.hurt) { g.strokeStyle = OUT; g.lineWidth = 0.5; g.lineCap = 'round'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 3.4, y(0.33)); g.lineTo(s * 4.6, y(0.325)); g.stroke() } }
      dotEyes(g, y(0.41), 4.1, 1.6, p); hatch(g, y(0.49), 7.6, 0.9); catMouth(g, y(0.5), p.hurt ? 1.1 : 0.9)
    },
    hold: (g, x, y) => { g.save(); g.translate(x - 4, y + 2.4); g.rotate(-0.75); guitar(g); g.restore() },
  }, p)
}
// 우사기 — 옅은 크림 노랑 · 달걀 같은 몸 · 붙어 서서 살짝 기운 긴 귀(안쪽 분홍) · 눈 위를 덮는 긴 둥근 눈썹 · 아래 왼쪽 흰 꼬리 · 노란 토벌봉
function usagi(g, p) {
  const H = 26.5, y = f => at(H, f), fur = '#faefc6'
  mochi(g, {
    fur, W: 24.5, H, mid: 0.4, thin: true, neck: 0.7, jw: 0.76,
    back: g => fluffOval(g, -6.6, -4.4, 2.1, 1.9, 0, '#fff', 12),
    ears: g => { for (const s of [-1, 1]) { g.save(); g.translate(s * 2.3 + 0.3, y(0) - 4.4); g.rotate(0.08 + s * 0.05); bump(g, 0, 0, 1.9, 6, 0, fur, Math.PI * 0.66, Math.PI * 2.34); g.fillStyle = '#f8bcc6'; g.beginPath(); g.ellipse(0, 0.5, 0.9, 4.3, 0, 0, TAU); g.fill(); g.restore() } },
    face: (g, p) => {
      if (!p.hurt) { g.strokeStyle = OUT; g.lineWidth = 0.6; g.lineCap = 'round'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 1.8, y(0.15)); g.quadraticCurveTo(s * 7.4, y(0.1), s * 8.2, y(0.34)); g.stroke() } }   // 눈 위를 덮는 긴 둥근 눈썹
      dotEyes(g, y(0.38), 3.2, 1.35, p); hatch(g, y(0.46), 7.6, 0.9); catMouth(g, y(0.46), p.hurt ? 1.2 : 0.9)
    },
    hold: (g, x, y) => {
      g.save(); g.translate(x, y); g.rotate(-1.3)   // 토벌봉 — 옆에서 세워 든다
      for (const [c, lw] of [[OUT, 2.8], ['#ffd54a', 1.6]]) { g.strokeStyle = c; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath(); g.moveTo(-5, 0); g.lineTo(17, 0); g.stroke() }
      for (const x of [-5, 17]) blob(g, x, 0, 1.3, 1.3, '#fff1a6', 0.6)
      g.restore()
    },
  }, p)
}
// 모몽가 — 하얀 몸 · 키 큰 귀(안쪽 하늘색 · 결) · 진한 테 안에 흰 반원과 초승달이 있는 눈 · 콧등의 하늘색 점 · ω 입 · 볼털 · 보는 쪽 반대에 하늘색 꼬리
function momonga(g, p) {
  const H = 27, y = f => at(H, f), sky = '#bfe2f2'
  const fur = (x0, y0, sx, n) => { g.strokeStyle = OUT; g.lineWidth = 0.55; g.lineCap = 'round'; g.beginPath(); for (let i = 0; i < n; i++) { const yy = y0 + i * 1.3, a = (i - (n - 1) / 2) * 0.28; g.moveTo(x0 - sx * 0.6, yy); g.quadraticCurveTo(x0 + sx * 1.8, yy + a * 2 - 0.3, x0 + sx * 3.6, yy + a * 4.2) } g.stroke() }   // 풍성하게 뻗은 볼털 — 부채처럼 퍼진다
  mochi(g, {
    fur: '#fff', W: 25.5, H, mid: 0.42, thin: true, neck: 0.68, jw: 0.8,
    back: g => {   // 하늘색 꼬리 — 보는 쪽 반대(왼쪽)에, 테두리 안쪽으로 털결
      g.save(); g.translate(-9.6, y(0.46)); g.rotate(-0.15); blob(g, 0, 0, 7.8, 12.8, sky, LW)
      g.strokeStyle = OUT; g.lineWidth = 0.7; g.lineCap = 'round'; g.beginPath()
      for (let i = 0; i < 14; i++) { const a = Math.PI - 1.45 + i / 13 * 2.9, x = Math.cos(a) * 7.8, yy = Math.sin(a) * 12.8; g.moveTo(x * 0.98, yy * 0.98); g.lineTo(x * 0.74, yy * 0.74) }
      g.stroke(); g.restore()
    },
    ears: g => {
      for (const s of [-1, 1]) {
        bump(g, s * 6.8, y(0.02), 3.4, 4.8, s * 0.2, '#fff', Math.PI * 1.0, Math.PI * 2.0)
        g.fillStyle = sky; g.beginPath(); g.ellipse(s * 6.9, y(-0.02), 1.7, 2.9, s * 0.2, 0, TAU); g.fill()
        g.strokeStyle = OUT; g.lineWidth = 0.45; g.beginPath(); g.moveTo(s * 6.3, y(0.02)); g.lineTo(s * 6.7, y(0.06)); g.moveTo(s * 7.6, y(0.01)); g.lineTo(s * 7.4, y(0.05)); g.stroke()
      }
      for (const s of [-1, 1]) fur(s * 12.4, y(0.36), s, 6)   // 양쪽 볼털
    },
    face: (g, p) => {
      g.fillStyle = sky; g.beginPath(); g.ellipse(0, y(0.35), 1.8, 1.9, 0, 0, TAU); g.fill()   // 눈 사이 콧등의 하늘색 점
      if (p.hurt) dotEyes(g, y(0.36), 4.5, 1.6, p)
      else for (const s of [-1, 1]) {
        const ex = s * 4.6, ey = y(0.36)
        g.strokeStyle = OUT; g.lineWidth = 0.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(s * 2.3, ey - 3.3); g.lineTo(s * 3.1, ey - 3.5); g.stroke()   // 작은 눈썹 점
        if (p.blink) { g.lineWidth = 0.9; g.beginPath(); g.moveTo(ex - 2.2, ey); g.quadraticCurveTo(ex, ey + 1.5, ex + 2.2, ey); g.stroke(); continue }
        g.fillStyle = '#3b2a26'; g.beginPath(); g.ellipse(ex, ey, 2.7, 2.6, 0, 0, TAU); g.fill()   // 둥근 진한 테
        g.save(); g.beginPath(); g.ellipse(ex, ey, 2.05, 1.95, 0, 0, TAU); g.clip(); g.fillStyle = '#fff'
        g.beginPath(); g.moveTo(ex - 3, ey - 0.05); g.quadraticCurveTo(ex, ey + 0.35, ex + 3, ey - 0.05); g.lineTo(ex + 3, ey - 3); g.lineTo(ex - 3, ey - 3); g.fill()   // 위의 흰 반원
        g.beginPath(); g.moveTo(ex - 3, ey + 0.55); g.quadraticCurveTo(ex, ey + 1.1, ex + 3, ey + 0.55); g.lineTo(ex + 3, ey + 3); g.lineTo(ex - 3, ey + 3); g.fill()   // 아래 흰 초승달(가운데 얇게 휜 띠만 남는다)
        g.restore()
      }
      hatch(g, y(0.47), 7.6, 0.95)
      catMouth(g, y(0.46), 0); g.strokeStyle = OUT; g.lineWidth = 0.55; g.beginPath(); g.moveTo(-0.8, y(0.5)); g.quadraticCurveTo(0, y(0.515), 0.8, y(0.5)); g.stroke()   // ω 아래 입술 한 줄
    },
  }, p)
}
// 데카츠요 — 「뭔가 크고 강한 녀석」. 복슬복슬한 노란 털뭉치 · 몽실한 하얀 얼굴(줄무늬 뿔 둘 · 몽실 눈썹 · 붉은 테 눈 · 밤색 코 · 이빨 웃음과 길게 내민 혀) · 세 손가락 까만 팔 넷 · 가는 까만 다리(노란 빛은 그릴 때 뒤에)
function dekatsuyo(g, p = {}) {
  const H = 23, y = f => at(H, f), f = p.foot || 0, yel = '#fbf0b2', ink = '#231a1e'
  const line = (q, w = 0.9) => { g.strokeStyle = ink; g.lineWidth = w; g.lineCap = g.lineJoin = 'round'; g.beginPath(); g.moveTo(q[0], q[1]); for (let i = 2; i < q.length; i += 2) g.lineTo(q[i], q[i + 1]); g.stroke() }
  const hand = (x, yy, a) => { g.save(); g.translate(x, yy); g.rotate(a); for (const b of [-0.7, 0, 0.7]) line([0, 0, Math.cos(b) * 1.7, Math.sin(b) * 1.7], 0.75); g.restore() }   // 세 손가락
  for (const s of [-1, 1]) { const up = Math.max(0, s * f) * 1.4; line([s * 4, -6, s * 4.4, -1.2 - up, s * 6.6, -0.7 - up], 1) }   // 가는 까만 다리 · 발 — 몸 아래로 길게
  g.save(); g.translate(0, -4.2)
  mochi(g, {
    fur: yel, W: 27, H, mid: 0.48, arms: 'none', fluffy: true, feet: false,
    back: g => {
      for (const [yy, a] of [[0.44, -0.5], [0.66, 0.15]]) for (const s of [-1, 1]) { const w = (yy > 0.5 ? -1 : 1) * s * f * 0.6, ex = s * 15.2, ey = y(yy) - 1.2 + w; line([s * 11, y(yy), ex, ey]); hand(ex, ey, s > 0 ? a : Math.PI - a) }   // 까만 팔 넷 — 번갈아 흔든다
    },
    face: (g, p) => {
      for (const s of [-1, 1]) {   // 줄무늬 뿔 — 얼굴 위에
        const P = new Path2D(); P.moveTo(s * 3, y(0.24)); P.quadraticCurveTo(s * 4.2, y(0.06), s * 6.4, y(-0.02)); P.quadraticCurveTo(s * 6.8, y(0.14), s * 6, y(0.26)); P.closePath()
        g.fillStyle = '#fdfcf8'; g.fill(P); g.save(); g.clip(P); g.strokeStyle = '#8a8f98'; g.lineWidth = 0.55; for (let k = 0; k < 3; k++) { const ff = 0.04 + k * 0.07; g.beginPath(); g.moveTo(s * 2.4, y(ff + 0.05)); g.lineTo(s * 8, y(ff - 0.03)); g.stroke() } g.restore()
        g.lineWidth = 0.6; g.strokeStyle = OUT; g.stroke(P)
      }
      const F = new Path2D(); for (let i = 0; i <= 72; i++) { const a = i / 72 * TAU, r = 1 + 0.06 * Math.cos(a * 7); F.lineTo(Math.cos(a) * 8.4 * r, y(0.46) + Math.sin(a) * 6.8 * r) } F.closePath()
      g.fillStyle = '#fffefb'; g.fill(F); g.lineWidth = 0.5; g.strokeStyle = 'rgba(61,48,43,.55)'; g.stroke(F)   // 몽실한 하얀 얼굴
      for (const s of [-1, 1]) {
        const ex = s * 3.7, ey = y(0.36)
        for (const k of [-1, 0, 1]) blob(g, ex + k * 1.1, ey - 2.6 - (k ? 0 : 0.4), 0.75, 0.7, '#fff', 0.4)   // 몽실 눈썹
        blob(g, ex, ey, 2.1, 2.1, '#fff', 0.6)
        if (p.hurt) dotEyes(g, ey, ex, 1.2, p)
        else { g.fillStyle = '#ec7f8c'; g.beginPath(); g.arc(ex, ey, 1.55, 0, TAU); g.fill(); g.fillStyle = ink; g.beginPath(); g.arc(ex, ey, 0.95, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(ex - 0.35, ey - 0.4, 0.35, 0, TAU); g.fill() }   // 붉은 테 눈
      }
      g.beginPath(); g.moveTo(-1.3, y(0.46)); g.quadraticCurveTo(0, y(0.43), 1.3, y(0.46)); g.quadraticCurveTo(0.4, y(0.53), 0, y(0.53)); g.quadraticCurveTo(-0.4, y(0.53), -1.3, y(0.46)); g.fillStyle = '#8a5a44'; g.fill(); g.lineWidth = 0.45; g.strokeStyle = OUT; g.stroke()   // 밤색 코
      const M = new Path2D(); M.moveTo(-5.6, y(0.55)); M.quadraticCurveTo(0, y(0.6), 5.6, y(0.55)); M.quadraticCurveTo(0, y(0.8), -5.6, y(0.55)); M.closePath()
      g.fillStyle = ink; g.fill(M); g.save(); g.clip(M); g.fillStyle = '#fff'
      for (let x = -5.4; x < 5.4; x += 1.5) { g.beginPath(); g.moveTo(x, y(0.55)); g.lineTo(x + 1.5, y(0.55)); g.lineTo(x + 0.75, y(0.63)); g.fill(); g.beginPath(); g.moveTo(x + 0.75, y(0.79)); g.lineTo(x + 2.25, y(0.79)); g.lineTo(x + 1.5, y(0.71)); g.fill() }   // 뾰족한 이빨
      g.restore(); g.lineWidth = 0.55; g.strokeStyle = OUT; g.stroke(M)
      g.beginPath(); g.moveTo(1.2, y(0.7)); g.quadraticCurveTo(1.4, y(0.98), 3.4, y(0.98)); g.quadraticCurveTo(5, y(0.96), 4.6, y(0.82)); g.quadraticCurveTo(3.6, y(0.74), 3.2, y(0.66)); g.closePath(); g.fillStyle = '#f19aac'; g.fill(); g.lineWidth = 0.5; g.stroke()   // 길게 내민 혀
      g.strokeStyle = '#cf6f84'; g.lineWidth = 0.35; g.beginPath(); g.moveTo(2.6, y(0.76)); g.quadraticCurveTo(2.9, y(0.86), 3.4, y(0.92)); g.stroke()
    },
  }, p)
  g.restore()
}
// 아노코 — 「커다란 토벌」의 대상. 서서 「파파 파야이야」 춤추는 모습 — 복슬한 하얀 윗몸 · 작은 둥근 귀 · 이마의 작은 뿔 · 큰 소용돌이 눈 · 가슴 앞 두 손 · 크림색 아랫배 · 발톱 달린 발 · 초록 용 꼬리
function cone(g, x, y, rot) { g.save(); g.translate(x, y); g.rotate(rot); g.beginPath(); g.moveTo(0, -1); g.lineTo(3, 0); g.lineTo(0, 1); g.closePath(); g.fillStyle = '#f2b27a'; g.fill(); g.lineWidth = 0.4; g.strokeStyle = OUT; g.stroke(); g.restore() }
function anoko(g, p = {}) {
  const H = 29, y = f => at(H, f), f = p.foot || 0, cream = '#efe2d4', white = '#fdfcfa'
  mochi(g, {
    fur: white, limb: cream, W: 26, H, mid: 0.42, fluffy: true, arms: 'none',
    back: g => {
      g.beginPath(); g.moveTo(8, y(0.72)); g.quadraticCurveTo(15, y(0.68), 17.4, y(0.5) + f); g.quadraticCurveTo(16.6, y(0.72), 10, y(0.9)); g.closePath(); g.fillStyle = '#7fa476'; g.fill(); g.lineWidth = LW; g.strokeStyle = OUT; g.stroke()   // 초록 용 꼬리
      g.strokeStyle = '#e3ecd9'; g.lineWidth = 0.7; for (let k = 0; k < 3; k++) { g.beginPath(); g.moveTo(11 + k * 2, y(0.84) - k * 1.4); g.lineTo(12 + k * 2, y(0.8) - k * 1.4); g.stroke() }
    },
    cap: g => { g.fillStyle = cream; g.beginPath(); g.moveTo(-14, y(0.66)); for (let x = -14; x < 14; x += 2.8) g.quadraticCurveTo(x + 1.4, y(0.62), x + 2.8, y(0.66)); g.lineTo(14, 0); g.lineTo(-14, 0); g.fill(); g.strokeStyle = 'rgba(61,48,43,.5)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(-14, y(0.66)); for (let x = -14; x < 14; x += 2.8) g.quadraticCurveTo(x + 1.4, y(0.62), x + 2.8, y(0.66)); g.stroke() },   // 크림색 아랫배(복슬 경계)
    ears: g => {
      for (const s of [-1, 1]) topEar(g, s * 8.2, y(0.06), 2.6, white, s * 0.8)
      g.beginPath(); g.moveTo(-1.2, y(0.12)); g.quadraticCurveTo(0, y(0.02), 1.2, y(0.12)); g.closePath(); g.fillStyle = '#f6e7d2'; g.fill(); g.lineWidth = 0.55; g.strokeStyle = '#c79a6e'; g.stroke()   // 이마의 작은 뿔
    },
    face: (g, p) => {
      for (const s of [-1, 1]) {   // 큰 소용돌이 눈
        const ex = s * 4.4, ey = y(0.3)
        blob(g, ex, ey, 2.7, 2.7, '#f6f1ea', 0.6)
        if (p.hurt) dotEyes(g, ey, ex, 1.3, p)
        else { g.strokeStyle = '#8c8a92'; g.lineWidth = 0.6; g.beginPath(); for (let t = 0; t < TAU * 1.7; t += 0.25) { const r = 0.2 + t * 0.2; g.lineTo(ex + Math.cos(t) * r, ey + Math.sin(t) * r) } g.stroke() }
      }
      hatch(g, y(0.39), 8.2, 0.75); catMouth(g, y(0.39), 0)
    },
    front: g => {
      for (const s of [-1, 1]) { fluffOval(g, s * 3, y(0.53), 3, 2.4, s * 0.3, white, 12); g.strokeStyle = OUT; g.lineWidth = 0.4; g.beginPath(); g.moveTo(s * 2.4, y(0.55)); g.lineTo(s * 2.6, y(0.58)); g.moveTo(s * 3.6, y(0.55)); g.lineTo(s * 3.8, y(0.58)); g.stroke() }   // 가슴 앞 두 손
      for (const s of [-1, 1]) { const lift = Math.max(0, s * f) * 1.5; for (let k = -1; k <= 1; k++) cone(g, s * 3.4 + k * 1.2, -0.6 - lift, Math.PI / 2 + k * 0.25) }   // 발톱
    },
  }, p)
}
// 검은 별똥별 — 29분에 나타나 끝까지 쫓아온다. 회색 털인형 별 · 하얀 빛이 박힌 까만 눈 · 세로로 벌린 입 · 그 아래 작은 입 줄 · 다리처럼 접힌 아래 두 갈래(쓰러뜨릴 수 없다)
function darkStar(g, p = {}) {
  g.save(); g.translate(0, -14); g.rotate((p.foot || 0) * 0.06)
  g.fillStyle = 'rgba(70,60,90,.35)'; g.beginPath(); g.moveTo(-5, 3); g.quadraticCurveTo(-19, 8, -25, 14); g.quadraticCurveTo(-17, 4, -5, -3); g.fill()   // 어두운 꼬리 빛
  g.save(); g.scale(1.1, 1.1); plushStar(g, 15.6, 8.8, 'rgba(60,50,80,.3)', 'rgba(60,50,80,0)', 'rgba(0,0,0,0)', 0, 0.86); g.restore()   // 어두운 기운
  plushStar(g, 15.6, 8.8, '#6a6a6e', '#47474b', '#26262a', 1, 0.86)
  g.strokeStyle = 'rgba(38,38,42,.55)'; g.lineWidth = 0.6; g.lineCap = 'round'   // 접힌 다리 주름
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 3.4, 7.2); g.quadraticCurveTo(s * 6.6, 5.6, s * 9.4, 7.6); g.stroke() }
  g.fillStyle = 'rgba(255,255,255,.08)'; g.beginPath(); g.ellipse(-3, -5, 5, 3, -0.3, 0, TAU); g.fill()   // 털 윤기
  for (const s of [-1, 1]) {   // 까만 눈 · 하얀 빛
    g.fillStyle = '#111114'; g.beginPath(); g.arc(s * 4.3, -2.4, 1.4, 0, TAU); g.fill()
    g.fillStyle = '#f4f4f4'; g.beginPath(); g.arc(s * 4.3, -2.75, 0.58, 0, TAU); g.fill()
  }
  g.fillStyle = '#111114'; g.beginPath(); g.ellipse(0, 2.1, 1.05, 2.1, 0, 0, TAU); g.fill()   // 세로로 벌린 입
  g.fillStyle = '#f4f4f4'; g.beginPath(); g.ellipse(0, 0.85, 0.58, 0.48, 0, 0, TAU); g.fill()
  g.strokeStyle = '#111114'; g.lineWidth = 0.45; g.beginPath(); g.moveTo(-0.8, 5.4); g.quadraticCurveTo(0, 5.9, 0.8, 5.4); g.stroke()   // 작은 입 줄
  g.restore()
}
// 세이렌 — 하얀 찹쌀떡 몸 · 이마로 뾰족 내려온 까만 앞머리와 양쪽 까만 머리 덩이(빨간 하트 장식) · 붉은 테 큰 눈 · 수염 · 복슬한 하얀 손(나무 숟가락) · 붉은 비늘 아랫몸과 꼬리지느러미. 화나면 눈이 새빨갛고 얼굴에 그늘
function siren(g, angry = false, p = {}) {
  const f = p.foot || 0, red = '#c95f5f', black = '#1f1715'
  g.beginPath(); g.moveTo(11, -6); g.quadraticCurveTo(16, -6, 18.6, -10); g.lineTo(23, -15 + f); g.quadraticCurveTo(21.4, -9, 24, -4 + f); g.quadraticCurveTo(19, -5.4, 17, -4.4); g.quadraticCurveTo(14, -2, 10, -2.4); g.closePath(); g.fillStyle = red; g.fill(); g.lineWidth = LW; g.strokeStyle = OUT; g.stroke()   // 꼬리지느러미
  g.strokeStyle = OUT; g.lineWidth = 0.5; g.beginPath(); g.moveTo(19.6, -9); g.lineTo(21.4, -11.4); g.moveTo(20, -6.6); g.lineTo(22, -6.4); g.stroke()
  for (const s of [-1, 1]) blob(g, s * 7.6, -32.6, 5, 4.4, black, 0.6)   // 머리 덩이
  for (const s of [-1, 1]) heart(g, s * 8.6, -34.4, 1.7, '#d8606a')
  const B = new Path2D(); B.ellipse(0, -15.4, 14.6, 14.4, 0, 0, TAU)
  g.fillStyle = '#fbfaf8'; g.fill(B)
  g.save(); g.clip(B)
  g.fillStyle = black; g.beginPath(); g.moveTo(-15, -22); g.quadraticCurveTo(-8, -25.4, -1.6, -24); g.lineTo(0, -19.2); g.lineTo(1.6, -24); g.quadraticCurveTo(8, -25.4, 15, -22); g.lineTo(15, -31); g.lineTo(-15, -31); g.fill()   // 이마로 뾰족 내려온 앞머리
  g.fillStyle = '#ec9a9a'; g.fillRect(-15, -8.6, 30, 1.8); g.fillStyle = red; g.fillRect(-15, -6.8, 30, 8)   // 분홍 띠 · 붉은 아랫몸
  g.strokeStyle = 'rgba(70,20,20,.6)'; g.lineWidth = 0.6; for (const [yy, o] of [[-5, 0], [-2, 1.6]]) { g.beginPath(); for (let x = -14 + o; x < 14; x += 3.2) { g.moveTo(x, yy); g.arc(x + 1.6, yy, 1.6, Math.PI, 0, true) } g.stroke() }   // 비늘
  if (angry) { g.fillStyle = 'rgba(40,20,50,.35)'; g.fillRect(-15, -24, 30, 9) }
  g.restore(); g.lineWidth = LW; g.strokeStyle = OUT; g.stroke(B)
  for (const s of [-1, 1]) {   // 붉은 테 큰 눈 · 화난 눈썹
    const ex = s * 5.2, ey = -17
    blob(g, ex, ey, 3.2, 2.7, '#fff', 0.7)
    g.fillStyle = angry ? '#ff3b3b' : '#b85656'; g.beginPath(); g.ellipse(ex - s * 0.4, ey + 0.4, 1.9, 2, 0, 0, TAU); g.fill()
    g.fillStyle = '#2b1714'; g.beginPath(); g.ellipse(ex - s * 0.4, ey + 0.5, 0.9, 1.3, 0, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(ex - s * 0.9, ey - 0.2, 0.45, 0, TAU); g.fill()
    g.strokeStyle = OUT; g.lineWidth = 0.7; g.lineCap = 'round'; g.beginPath(); g.moveTo(ex - s * 2.4, ey - 3.6); g.lineTo(ex + s * 0.8, ey - 3); g.stroke()   // 눈썹 — 가운데로 내려간
    g.lineWidth = 0.45; g.beginPath(); for (let k = 0; k < 2; k++) { g.moveTo(s * 9.6, -12.4 + k * 1.6); g.lineTo(s * 13.2, -13.2 + k * 2) } g.stroke()   // 수염
  }
  catMouth(g, -12.6, 0.8)
  for (const s of [-1, 1]) {   // 복슬한 하얀 손 — 오른손엔 나무 숟가락
    const hx = s * 14.2, hy = -12.4
    if (s > 0) { g.lineCap = 'round'; for (const [c, lw] of [[OUT, 1.8], ['#d8b48e', 0.9]]) { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); g.moveTo(hx - 0.6, hy + 0.6); g.lineTo(hx + 3.2, hy - 6); g.stroke() } blob(g, hx + 3.8, hy - 7.4, 1.4, 2, '#e3c39c', 0.6) }
    fluffOval(g, hx, hy, 2.8, 2.6, 0, '#fff', 10)
  }
}
// 인어 — 세이렌의 코러스. 하얀 동그란 몸 · 머리 위 빨간 볏 · 짧은 눈썹 · 놀란 「오」 입 · 양옆 작은 흰 지느러미 · 붉은 비늘 아랫몸 · 꼬리지느러미
const MER = [{ red: '#d86868' }, { red: '#e07a8e' }, { red: '#d9785a' }]
function mermaid(g, o, p = {}) {
  const f = p.foot || 0, red = o.red
  g.beginPath(); g.moveTo(5, -3.4); g.quadraticCurveTo(9, -2.6, 10.6, -5.4 + f); g.quadraticCurveTo(12.4, -1.8, 10.4, 0.6 + f * 0.5); g.quadraticCurveTo(7.6, 0, 4.4, -0.8); g.closePath(); g.fillStyle = red; g.fill(); g.lineWidth = LW; g.strokeStyle = OUT; g.stroke()   // 꼬리지느러미
  for (const s of [-1, 1]) { blob(g, s * 8.4, -9.4, 1.9, 2.4, '#fff', LW); g.strokeStyle = OUT; g.lineWidth = 0.4; g.beginPath(); g.moveTo(s * 8, -10.2); g.lineTo(s * 9.2, -10.4); g.moveTo(s * 8, -8.8); g.lineTo(s * 9.2, -8.6); g.stroke() }   // 양옆 지느러미
  const B = new Path2D(); B.ellipse(0, -9.6, 8.2, 8.8, 0, 0, TAU)
  g.fillStyle = '#fbfaf8'; g.fill(B); g.save(); g.clip(B)
  g.fillStyle = '#efa1a1'; g.fillRect(-9, -7.8, 18, 1.4); g.fillStyle = red; g.fillRect(-9, -6.4, 18, 7)
  g.strokeStyle = 'rgba(70,20,20,.6)'; g.lineWidth = 0.5; for (const [yy, ox] of [[-4.6, 0], [-2, 1.4]]) { g.beginPath(); for (let x = -8 + ox; x < 8; x += 2.8) { g.moveTo(x, yy); g.arc(x + 1.4, yy, 1.4, Math.PI, 0, true) } g.stroke() }
  g.restore(); g.lineWidth = LW; g.strokeStyle = OUT; g.stroke(B)
  g.beginPath(); g.moveTo(-2.2, -17.8); g.lineTo(-1.6, -20.6); g.lineTo(-0.6, -18.9); g.lineTo(0, -21.2); g.lineTo(0.6, -18.9); g.lineTo(1.6, -20.6); g.lineTo(2.2, -17.8); g.quadraticCurveTo(0, -16.6, -2.2, -17.8); g.fillStyle = red; g.fill(); g.lineWidth = 0.6; g.strokeStyle = OUT; g.stroke()   // 빨간 볏
  g.strokeStyle = OUT; g.lineWidth = 0.45; g.lineCap = 'round'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 1.4, -15.4); g.lineTo(s * 2.8, -15); g.stroke() }   // 짧은 눈썹
  g.fillStyle = '#2b211d'; for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 2.2, -13.6, 0.55, 0, TAU); g.fill() }
  g.beginPath(); g.ellipse(0, -10.8, 1.3, 1.9, 0, 0, TAU); g.fill(); g.fillStyle = '#e66a7a'; g.beginPath(); g.ellipse(0, -9.8, 0.8, 0.6, 0, 0, TAU); g.fill()   // 놀란 「오」 입
}
// [가로, 세로, 그리기(g, 자세)] — 발밑이 아래에서 3 위. 크게 키운 정예 · 보스는 big(선이 덜 두꺼워지게)
const ART = {
  chiikawa: [58, 47, chiikawa], hachiware: [44, 41, hachiware], usagi: [40, 51, usagi], shisa: [38, 37, shisa], momonga: [42, 41, momonga], rakko: [44, 41, rakko], kurimanju: [38, 35, kurimanju], kani: [36, 43, kani],
  goblin: [38, 32, (g, p) => goblin(g, p)],
  rusher: [38, 32, (g, p) => goblin(g, p, { col: '#cbe7a2', band: true })],
  chimera: [34, 29, (g, p) => chimera(g, p)],
  spiker: [34, 34, maskChimera],
  bug: [28, 32, bug], beetle: [26, 32, beetle], star: [42, 30, starKid], fugu: [32, 28, fugu], octo: [26, 28, octo], parttimer: [36, 40, parttimer],
  rps: [96, 82, (g, p) => { big(g, 2.4); rps(g, p) }], chef: [88, 86, (g, p) => { big(g, 2.4); chef(g, p) }],
  pj0: [30, 34, (g, p) => pajama(g, p, PJ[0])], pj1: [30, 34, (g, p) => pajama(g, p, PJ[1])], pj2: [30, 34, (g, p) => pajama(g, p, PJ[2])], pj3: [30, 34, (g, p) => pajama(g, p, PJ[3])], leafpair: [46, 37, leafPair],
  dekatsu: [56, 45, (g, p) => { big(g, 1.6); chimera(g, p, { col: '#f0aac0', legs: true }) }],
  golden: [66, 56, (g, p) => { big(g, 1.7); goblin(g, p, { col: '#ffd34d', cloth: '#b8863b', crown: true }) }],
  dekatsuyo: [100, 90, (g, p) => { big(g, 2.6); dekatsuyo(g, p) }],
  goblinKing: [100, 84, (g, p) => { big(g, 2.6); goblin(g, p, { col: '#9cc874', crown: true, cape: true }) }],
  bigChimera: [96, 98, (g, p) => { big(g, 3.2); chimera(g, p, { col: '#c9b8e0', legs: true, horns: true }) }],
  anoko: [100, 90, (g, p) => { big(g, 2.4); anoko(g, p) }],
  darkstar: [90, 58, (g, p) => { big(g, 1.6); darkStar(g, p) }],
  mermaid: [40, 36, (g, p) => { big(g, 1.4); mermaid(g, MER[0], p) }],
  mermaid1: [40, 36, (g, p) => { big(g, 1.4); mermaid(g, MER[1], p) }],
  mermaid2: [40, 36, (g, p) => { big(g, 1.4); mermaid(g, MER[2], p) }],
  siren: [124, 100, (g, p) => { big(g, 2.4); siren(g, false, p) }],
  sirenAngry: [124, 100, (g, p) => { big(g, 2.4); siren(g, true, p) }],
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
/** 그림의 빈 둘레를 잘라 낸 사각형(여러 장이면 합친 것) */
function trimRect(cs) {
  let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1
  for (const c of cs) {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data, w = c.width
    for (let i = 3; i < d.length; i += 4) if (d[i] > 8) { const q = (i - 3) / 4, x = q % w, y = q / w | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y }
  }
  return x1 < 0 ? { x: 0, y: 0, w: cs[0].width, h: cs[0].height } : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 }
}
const crop = (c, r) => { const o = mk(r.w, r.h); o.getContext('2d').drawImage(c, -r.x, -r.y); return o }
const PORT = {}   // 메뉴 · 도감 그림 — 크게 그려 빈 둘레를 자른 것(캐릭터는 같은 틀의 걷는 그림 _walk 도)
function portrait(id) {
  const P = PORT[id] ||= (() => {
    const m = id === 'momonga' ? x => { const o = mk(x.width, x.height), g = o.getContext('2d'); g.scale(-1, 1); g.drawImage(x, -x.width, 0); return o } : x => x   // 모몽가는 꼬리가 오른쪽에 보이게(게임에선 보는 쪽 반대)
    const idle = artSprite(id, 3).c, walk = CHARS.some(c => c.id === id) ? WALK.map(p => artSprite(id, 3, p).c) : [], r = trimRect([idle, ...walk])
    return { idle: m(crop(idle, r)), walk: walk.map(w => m(crop(w, r))) }
  })()
  const c = mk(P.idle.width, P.idle.height); c.getContext('2d').drawImage(P.idle, 0, 0); c.className = 'pt'; c._idle = P.idle; c._walk = P.walk; return c
}

const TILE = 256
function seeded(s) { return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
function groundTile() {   // 풀밭 — 이어 붙여도 이음매가 안 보이게 가장자리는 아홉 칸에 같이 그린다
  const c = mk(TILE * K, TILE * K), g = c.getContext('2d'), r = seeded(7)
  g.scale(K, K); g.fillStyle = '#cdeaa8'; g.fillRect(0, 0, TILE, TILE)
  const wrap = fn => { for (const ox of [-TILE, 0, TILE]) for (const oy of [-TILE, 0, TILE]) fn(ox, oy) }
  for (let i = 0; i < 16; i++) { const x = r() * TILE, y = r() * TILE, R = 14 + r() * 30, col = r() < 0.5 ? 'rgba(165,212,125,.5)' : 'rgba(228,246,196,.55)'; wrap((ox, oy) => { g.fillStyle = col; g.beginPath(); g.ellipse(x + ox, y + oy, R, R * 0.6, 0, 0, TAU); g.fill() }) }
  g.strokeStyle = '#93c870'; g.lineWidth = 1.5; g.lineCap = 'round'
  for (let i = 0; i < 70; i++) { const x = r() * TILE, y = r() * TILE; wrap((ox, oy) => { g.beginPath(); g.moveTo(x + ox - 3, y + oy); g.lineTo(x + ox - 4, y + oy - 5); g.moveTo(x + ox, y + oy); g.lineTo(x + ox, y + oy - 7); g.moveTo(x + ox + 3, y + oy); g.lineTo(x + ox + 4.5, y + oy - 5); g.stroke() }) }
  for (let i = 0; i < 18; i++) {   // 흰 데이지(많이) · 분홍 · 노랑 · 보라 작은 꽃
    const x = r() * TILE, y = r() * TILE, daisy = r() < 0.6, col = pickOfR(r, ['#ffd1dc', '#fff1a1', '#d9c8ff'])
    wrap((ox, oy) => {
      if (daisy) { g.fillStyle = '#fff'; for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; g.beginPath(); g.ellipse(x + ox + Math.cos(a) * 2.8, y + oy + Math.sin(a) * 1.9, 2.2, 1.3, a, 0, TAU); g.fill() } g.fillStyle = '#ffcf3d'; g.beginPath(); g.ellipse(x + ox, y + oy, 1.7, 1.2, 0, 0, TAU); g.fill() }
      else { g.fillStyle = col; for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; g.beginPath(); g.arc(x + ox + Math.cos(a) * 2.6, y + oy + Math.sin(a) * 2.6, 2, 0, TAU); g.fill() } g.fillStyle = '#ffc94d'; g.beginPath(); g.arc(x + ox, y + oy, 1.6, 0, TAU); g.fill() }
    })
  }
  return c
}
const pickOfR = (r, a) => a[r() * a.length | 0]

let SPR = null, K = 2   // K = 그려 두는 그림의 단위당 픽셀 — 화면 배율에 맞춘다
function sprites() {
  const enemy = id => { const R = [artSprite(id, K, { foot: 1 }), artSprite(id, K, { foot: -1 })], L = R.map(flip); return { R, L, WR: R.map(white), WL: L.map(white) } }   // 걷기 두 장 · 왼쪽 · 맞았을 때 하양
  SPR = { E: {}, sasu: {}, ground: groundTile() }
  for (const ch of CHARS) SPR[ch.id] = charSprites(ch.id)
  for (const id in FOES) if (id !== 'mermaid') SPR[id] = enemy(id)
  SPR.mermaid = ['mermaid', 'mermaid1', 'mermaid2'].map(enemy); SPR.sirenAngry = enemy('sirenAngry'); SPR.dark = [{ foot: 1 }, { foot: -1 }].map(p => artSprite('darkstar', K, p))
  SPR.pj = PJ.map((o, i) => [{ arm: 1, bob: -1.2 }, { arm: -1 }].map(p => artSprite('pj' + i, K, p)))   // 파자마 파티즈 — 춤 두 장
  const lp = [{ foot: 1 }, { foot: -1 }].map(p => artSprite('leafpair', K, p)); SPR.leaf = { R: lp, L: lp.map(flip) }
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
  SC = Math.max(Math.min(cv.width, cv.height), Math.sqrt(cv.width * cv.height) / 1.15) / VIEW; VW = cv.width / SC; VH = cv.height / SC   // 짧은 쪽 또는 넓이 기준 중 큰 배율 — 세운 휴대폰에서도 캐릭터가 너무 작지 않게
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
    if (e.code === 'ArrowLeft' || e.code === 'ArrowUp') pickChar((pickCi + CHARS.length - 1) % CHARS.length)
    if (e.code === 'ArrowRight' || e.code === 'ArrowDown') pickChar((pickCi + 1) % CHARS.length)
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
  pl = { x: 0, y: 0, r: 12, hp: 1, inv: 0, hurtT: 0, slowT: 0, face: [1, 0], fx: 1, jump: 0, moving: false }
  const b = 2 + (ch.mod.boxes || 0)
  G = {
    ch, t: 0, foes: [], shots: [], eshots: [], gems: [], items: [], fx: [], parts: [], nums: [], haz: [], help: [], weapons: [], passives: {},
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
  const CD = S.cdr * (G.help.some(h => h.k === 'pajama') ? 0.75 : 1)   // 파자마 파티즈 응원 — 쿨타임 -25%
  for (const w of G.weapons) {
    const st = w.st, A = st.area * S.area, D = st.dmg * S.might * (G.ch.mod.clutch && pl.hp < S.maxHp / 2 ? 1 + G.ch.mod.clutch : 1)   // 치이카와 — 체력 절반 아래
    if (w.id === 'ura') {   // 쿨타임마다 둘레 전부
      w.R = 70 * A; w.pulse = Math.max(0, (w.pulse || 0) - dt)
      if ((w.t -= dt) <= 0) {
        w.t = Math.max(0.2, st.cd * CD); w.pulse = 0.2; near(pl.x, pl.y, w.R, e => { hurt(e, D, pl.x, pl.y, 30) })
        if (rnd() < 0.08) fx({ k: 'text', x: pl.x + (rnd() - 0.5) * 30, y: pl.y - 50, s: '우라!', col: '#ffd23f', T: 0.7 })
      }
      continue
    }
    if (w.id === 'guitar') {   // 켜져 있는 동안 음표가 돈다
      w.ang += dt * 3.4 * st.spd * S.speed
      if (w.on > 0) { if ((w.on -= dt) <= 0) w.t = st.cd * CD }
      else if ((w.t -= dt) <= 0) {
        const n = st.n + S.amount; w.on = st.dur * S.dur
        for (let i = 0; i < n; i++) G.shots.push({ k: 'orb', w, i, n, R: 80 * A, r: 10 * Math.sqrt(A), dmg: D, life: w.on, hit: new Map(), x: pl.x, y: pl.y, t: 0 })
      }
      continue
    }
    if (w.q > 0) { if ((w.qt -= dt) <= 0) { SHOT[w.id](w, st, w.n - w.q, A, D); w.q--; w.qt = 0.12 } }
    else if ((w.t -= dt) <= 0) { w.n = w.q = st.n + S.amount; w.qt = 0; w.t = st.cd * CD; w.list = w.id === 'sasu' || w.id === 'kanpai' ? closest(w.n) : w.id === 'momo' ? strongest(w.n) : [] }
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
    elite: type === 'golden', boss: big, kind: big ? type : null, heavy: ['dekatsu', 'golden', 'beetle', 'parttimer'].includes(type),
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
      const w = [['goblin', 1], ['bug', m < 6 ? 0.7 : 0.3], ['chimera', m >= 1 ? 0.5 + m * 0.03 : 0], ['beetle', m >= 3 ? 0.15 + m * 0.02 : 0], ['star', m >= 5 ? 0.12 + (m - 5) * 0.01 : 0], ['dekatsu', m >= 4 ? 0.1 + m * 0.03 : 0],
        ['spiker', m >= 6 ? 0.1 + (m - 6) * 0.035 : 0], ['fugu', m >= 8 ? 0.08 + (m - 8) * 0.03 : 0], ['octo', m >= 12 ? 0.08 + (m - 12) * 0.03 : 0], ['parttimer', m >= 14 ? 0.05 + (m - 14) * 0.02 : 0]]
      let q = rnd() * w.reduce((s, x) => s + x[1], 0), type = 'goblin'
      for (const [k, v] of w) if ((q -= v) < 0) { type = k; break }
      if (type === 'star') { const e = spawn('star'); for (let k = 0; k < 2; k++) spawn('star', e.x + (rnd() - 0.5) * 34, e.y + (rnd() - 0.5) * 34) }   // 별똥별은 셋이 같이
      else spawn(type)
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
    const SH = FOES[e.type].shot   // 멀리서 쏘는 적 — 가면 키메라 독침 · 복어 기름 그물 · 문어 간장
    if (!frozen && SH && d < SH.range && (e.cd -= dt) <= 0) { e.cd = SH.cd + rnd(); G.eshots.push({ k: SH.k, x: e.x, y: e.y, vx: dx * SH.spd, vy: dy * SH.spd, t: 0, life: 2.6, dmg: e.dmg + 1, r: SH.r, slow: SH.slow }) }
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
    case 'rps': e.patT = 2.4; [() => { e.act = { k: 'slamAt', t: 0.4 }; bubble(e, '바위!', '#fff') }, () => { Object.assign(e, { st: 'wind', stT: 0.6, dx, dy }); bubble(e, '가위!', '#fff') }, () => { e.act = { k: 'papers', t: 0.4 }; bubble(e, '보!', '#fff') }][e.pat++ % 3](); break
    case 'chef': e.patT = 2.6; [() => { e.act = { k: 'pepper', t: 0.4 }; bubble(e, '후추 톡톡!', '#fff') }, () => { e.act = { k: 'wrap', t: 0.4 }; bubble(e, '돌돌 말아서…', '#fff') }, () => Object.assign(e, { st: 'wind', stT: 0.7, dx, dy })][e.pat++ % 3](); break
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
  slamAt() { G.haz.push({ k: 'land', x: pl.x, y: pl.y, R: 95, t: 0, T: 0.9, dmg: pct(0.18), col: '#8a8f99' }) },   // 쇠공 팔로 내 자리를 내려찍는다
  papers(e) { const n = 12, o = (e.pat % 2) * Math.PI / n; for (let i = 0; i < n; i++) { const q = o + i / n * TAU; G.eshots.push({ k: 'paper', x: e.x, y: e.y, vx: Math.cos(q) * 180, vy: Math.sin(q) * 180, t: 0, life: 3.2, dmg: pct(0.06), r: 7 }) } },
  pepper() { for (let i = 0; i < 9; i++) { const a = rnd() * TAU, d = i ? 40 + rnd() * 160 : 0; G.haz.push({ k: 'bomb', x: pl.x + Math.cos(a) * d, y: pl.y + Math.sin(a) * d, R: 38, t: -i * 0.07, T: 1, dmg: pct(0.08), col: '#5b4a42' }) } },
  wrap() { G.haz.push({ k: 'bomb', x: pl.x, y: pl.y, R: 115, t: 0, T: 1.25, dmg: pct(0.2), col: '#e9b949' }) },   // 토르티야로 돌돌 — 밖으로 피하기
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
  if (e.type === 'star' && rnd() < 0.05 && G.fx.length < 150) fx({ k: 'text', x: e.x, y: e.y - 26, s: '흐아아악!', col: '#ffe066', T: 0.6 })
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
  else if (!e.boss && G.t >= 180 && rnd() < 0.0004 * S.luck) item(e.x, e.y, rnd() < 0.5 ? 'pajama' : 'battery')
  if (!e.boss) return
  const B = BOSS[e.kind]
  if (e.kind === 'mermaid') say(guarded() ? '인어 격파!' : '세이렌의 보호막이 사라졌다!', 2, '#7fd8ff')
  else if (e.kind === 'siren') {   // 클리어 — 남은 적은 모두 도망친다
    G.bosses++; G.won = 2.8; G.endKind = 'siren'; G.dark = null; say('세이렌 격파! 토벌 성공!', 3, '#ffd23f')
    for (const f of G.foes) if (!f.dead) kill(f, true)
  } else if (e.mid) say(`${B.name} 격파!`, 1.6, '#ffb35e')
  else { G.bosses++; item(e.x, e.y, 'chest'); item(e.x + 26, e.y, rnd() < 0.5 ? 'pajama' : 'battery'); say(`${B.name} 격파!`, 2.2, '#ffd23f') }
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
  if (!k) { const q = rnd(); k = G.t >= 600 && q < 0.15 ? 'earplug' : q < 0.32 ? 'onigiri' : q < 0.48 ? 'magnet' : q < 0.6 ? 'momonga' : q < 0.72 ? 'firework' : q < 0.86 ? 'pajama' : 'battery' }
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
  pajama: () => summonHelp('pajama'),
  battery: () => summonHelp('leaf'),
  earplug: () => {
    if (Object.values(G.sts).some(t => t > G.t)) { G.sts = {}; say('상태이상 해제!', 1.4, '#7fd8ff') }
    else { const v = Math.round(S.maxHp * 0.15); pl.hp = Math.min(S.maxHp, pl.hp + v); num(pl.x, pl.y - 48, `+${v}`, 'heal') }
  },
}
// ---- 도와주는 친구들 — 아이템을 먹으면 잠깐 나타난다
/** 파자마 파티즈(10초 · 곁을 돌며 공연) · 한잎이와 두잎이(12초 · 손잡고 곁을 돌며 지켜 준다). 이미 있으면 시간만 다시 */
function summonHelp(k) {
  const h = G.help.find(x => x.k === k)
  if (h) { h.t = 0; return }
  G.help.push(k === 'pajama' ? { k, t: 0, T: 10, a: 0, tick: 0.3 } : { k, t: 0, T: 12, a: 0, hit: new Map() })
  say(k === 'pajama' ? '파자마 파티즈의 응원 공연! ♪' : '한잎이 · 두잎이가 지켜 줄게요!', 2.2, k === 'pajama' ? '#ff9be0' : '#a6e07a')
}
const helpPos = (h, i) => h.k === 'pajama' ? [pl.x + Math.cos(h.a + i / 4 * TAU) * 60, pl.y + Math.sin(h.a + i / 4 * TAU) * 48] : [pl.x + Math.cos(h.a) * 46, pl.y + Math.sin(h.a) * 38]
function helpers(dt) {
  for (const h of G.help) {
    if ((h.t += dt) > h.T) { h.dead = true; continue }
    if (h.k === 'pajama') {   // 1초마다 넷이 음표 충격파 — 둘레의 적을 때리고 밀쳐 낸다
      h.a += dt * 1.5
      if ((h.tick -= dt) <= 0) {
        h.tick = 1; const D = (10 + G.t / 10) * S.might
        for (let i = 0; i < 4; i++) { const [x, y] = helpPos(h, i); near(x, y, 46, e => { hurt(e, D, x, y, 140) }); fx({ k: 'ring', x, y, R: 46, T: 0.4, col: PJ[i].col }) }
        const [x, y] = helpPos(h, rnd() * 4 | 0); fx({ k: 'text', x, y: y - 30, s: '♪', col: '#ff9be0', T: 0.7 })
      }
    } else {   // 닿은 적을 밀쳐 내고 날아오는 것을 막는다
      h.a += dt * 2.4
      const [x, y] = helpPos(h, 0), D = (8 + G.t / 15) * S.might
      near(x, y, 20, e => { const t = h.hit.get(e); if (t === undefined || G.t - t > 0.35) { h.hit.set(e, G.t); hurt(e, D, x, y, 260) } })
      for (const b of G.eshots) if (!b.dead && (b.x - x) ** 2 + (b.y - y) ** 2 < 24 * 24) { b.dead = true; fx({ k: 'flash', x: b.x, y: b.y - 14, R: 18, col: '#c8f0a8', T: 0.25 }) }
    }
  }
  prune(G.help)
}
// ---- 검은 별똥별 — 29분까지 세이렌을 못 쓰러뜨리면 나타나 끝까지 쫓아온다. G.foes 밖이라 스킬 · 폭죽에 안 맞는다(쓰러뜨릴 수 없다)
function darkStep(dt) {
  if (!G.dark) {
    if (G.t < DARK_T) return
    const a = rnd() * TAU, R = Math.max(VW, VH) * 0.6
    G.dark = { x: pl.x + Math.cos(a) * R, y: pl.y + Math.sin(a) * R, t: 0, cd: 3 }
    say('검은 별똥별! 쓰러뜨릴 수 없어요 — 30:00까지 도망쳐!', 3.2, '#c9b3ff'); shake = 10
    return
  }
  const D = G.dark, [dx, dy] = toward(pl, D.x, D.y), sp = 118 + D.t * 0.6   // 점점 빨라진다(30분엔 거의 내 속도)
  D.t += dt
  if (G.freeze <= 0) { D.x += dx * sp * dt; D.y += dy * sp * dt }
  if ((D.x - pl.x) ** 2 + (D.y - pl.y) ** 2 < (pl.r + 16) ** 2) ouch(pct(0.3))
  if ((D.cd -= dt) <= 0) {   // 3초마다 별 조각을 사방으로
    D.cd = 3
    for (let i = 0; i < 10; i++) { const q = i / 10 * TAU + rnd() * 0.3; G.eshots.push({ k: 'shard', x: D.x, y: D.y, vx: Math.cos(q) * 160, vy: Math.sin(q) * 160, t: 0, life: 3, dmg: pct(0.08), r: 6 }) }
    fx({ k: 'ring', x: D.x, y: D.y, R: 60, T: 0.5, col: '#8f6bdc' })
  }
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
  if (G.t >= END_T && !dead && !G.won) { G.endKind = 'time'; return finish(true) }   // 30분 — 검은 별똥별에게서 끝까지 도망쳤다
  // 나
  let mx = key.r - key.l + joy.x, my = key.d - key.u + joy.y
  const m = Math.hypot(mx, my)
  pl.moving = m > 0.12 && !dead
  if (pl.moving) {
    pl.face = [mx / m, my / m]
    if (m > 1) { mx /= m; my /= m }
    if (Math.abs(mx) > 0.2) pl.fx = mx > 0 ? 1 : -1
    const sp = 150 * S.move * (sick('charm') ? 0.6 : 1) * (pl.slowT > 0 ? 0.65 : 1)   // 매혹 · 기름 그물
    pl.x += mx * sp * dt; pl.y += my * sp * dt
  }
  const siren = alive(G.final?.siren)
  if (siren && sick('charm') && !dead) { const [dx, dy] = toward(siren); pl.x += dx * 55 * dt; pl.y += dy * 55 * dt }   // 매혹 — 세이렌 쪽으로 끌려간다
  pl.inv -= dt; pl.hurtT -= dt; pl.slowT -= dt; pl.jump = Math.max(0, pl.jump - dt)
  if (!dead) pl.hp = Math.min(S.maxHp, pl.hp + S.regen * dt)
  G.freeze = Math.max(0, G.freeze - dt)
  cam.x += (pl.x - cam.x) * Math.min(1, dt * 8); cam.y += (pl.y - cam.y) * Math.min(1, dt * 8)
  regrid()
  if (!dead && !G.won) { spawner(dt); weapons(dt) }
  foes(dt)
  shots(dt)
  if (!dead && !G.won) { helpers(dt); darkStep(dt) }
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
    if ((b.x - pl.x) ** 2 + (b.y - pl.y) ** 2 < (pl.r + b.r) ** 2) { ouch(b.dmg); b.dead = true; if (b.slow) { pl.slowT = Math.max(pl.slowT, b.slow); fx({ k: 'text', x: pl.x, y: pl.y - 50, s: '끈적!', col: '#f2c94c', T: 0.6 }) } }
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
  if (G.dark) {
    const D = G.dark
    c.globalAlpha = 0.3 + 0.1 * Math.sin(G.t * 6); c.fillStyle = '#8f6bdc'; oval(c, D.x, D.y - 22, 34, 30); c.fill(); c.globalAlpha = 1
    put(c, SPR.shadow, D.x, D.y, 1.1); put(c, SPR.dark[(G.t * 6 | 0) % 2], D.x, D.y - 6 + Math.sin(G.t * 3) * 3)
    const hx = VW / 2 - 24, hy = VH / 2 - 30, ex = D.x - cam.x, ey = D.y - cam.y
    if (Math.abs(ex) > hx || Math.abs(ey) > hy) {   // 화면 밖 — 가장자리에 다가오는 쪽 화살표
      const k = Math.min(hx / Math.max(1e-6, Math.abs(ex)), hy / Math.max(1e-6, Math.abs(ey))), ax = cam.x + ex * k, ay = cam.y + ey * k, a = Math.atan2(ey, ex)
      c.save(); c.translate(ax, ay); c.rotate(a); c.beginPath(); c.moveTo(12, 0); c.lineTo(-6, -8); c.lineTo(-6, 8); c.closePath(); c.fillStyle = '#5b3fa8'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); c.restore()
    }
  }
  for (const h of G.help) {   // 도와주는 친구들 — 끝나기 2초 전부터 깜빡
    if (h.T - h.t < 2 && (G.t * 10 | 0) % 2) continue
    if (h.k === 'pajama') for (let i = 0; i < 4; i++) { const [x, y] = helpPos(h, i); put(c, SPR.shadow, x, y, 0.6); put(c, SPR.pj[i][(G.t * 4 + i | 0) % 2], x, y) }
    else { const [x, y] = helpPos(h, 0); put(c, SPR.shadow, x, y, 0.9); put(c, (Math.sin(h.a) > 0 ? SPR.leaf.L : SPR.leaf.R)[(G.t * 6 | 0) % 2], x, y) }
  }
  // 날아가는 것
  for (const b of G.shots) {
    if (b.k === 'ball' && b.look === 'cup') { c.save(); c.translate(b.x, b.y - 12); c.rotate(Math.sin(b.t * 14) * 0.5); put(c, SPR.E.kanpai, 0, 0, 0.8); c.restore() }
    else if (b.k === 'ball') { c.save(); c.translate(b.x, b.y - 12); c.rotate(Math.atan2(b.vy, b.vx)); put(c, SPR.sasu[b.col] ||= sprite(34, 18, 16, 9, g => { g.translate(-13.4, 0); sasuShape(g, 18, b.col) }), 0, 0, 1.2); c.restore() }   // 사스마타 — 캐릭터 색 else if (b.k === 'arc') { const u = b.u, hh = b.H * 4 * u * (1 - u); put(c, SPR.shadow, b.x, b.y, 0.35); tear(c, b.x, b.y - hh - 10, 6) }
    else if (b.k === 'orb') put(c, SPR.note, b.x, b.y - 14)
    else if (b.k === 'boom') { c.save(); c.translate(b.x, b.y - 14); c.rotate(Math.sin(b.a) * 0.6); put(c, SPR.pochette, 0, 0, b.r / 10); c.restore() }
    else if (b.k === 'ring' && b.t >= 0) { const u = Math.min(1, b.t / b.T); c.globalAlpha = 1 - Math.max(0, b.t - b.T) / 0.18; c.strokeStyle = '#ffd23f'; c.lineWidth = 6; oval(c, b.x, b.y, b.R * u, b.R * u * 0.8); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); c.globalAlpha = 1 }
  }
  for (const b of G.eshots) {
    const y = b.y - 14
    if (b.k === 'spike' || b.k === 'claw') { c.save(); c.translate(b.x, y); c.rotate(Math.atan2(b.vy, b.vx)); c.beginPath(); c.moveTo(8, 0); c.lineTo(-6, -4); c.lineTo(-6, 4); c.closePath(); c.fillStyle = b.k === 'claw' ? '#b7793f' : '#3f7f74'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke(); c.restore() }
    else if (b.k === 'note') put(c, SPR.pinkNote, b.x, y)
    else if (b.k === 'shard') { c.save(); c.translate(b.x, y); c.rotate(b.t * 8); c.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, r = i % 2 ? 2.2 : 6; c.lineTo(Math.cos(a) * r, Math.sin(a) * r) } c.closePath(); c.fillStyle = '#2a2038'; c.fill(); c.strokeStyle = '#a78bfa'; c.lineWidth = 1.2; c.stroke(); c.restore() }
    else if (b.k === 'paper') { c.save(); c.translate(b.x, y); c.rotate(b.t * 6); c.fillStyle = '#fff'; c.fillRect(-4.5, -5.5, 9, 11); c.strokeStyle = OUT; c.lineWidth = 1; c.strokeRect(-4.5, -5.5, 9, 11); c.restore() }
    else if (b.k === 'net') { oval(c, b.x, y, b.r, b.r); c.fillStyle = 'rgba(255,236,160,.6)'; c.fill(); c.strokeStyle = '#d9a93a'; c.lineWidth = 1; c.stroke(); c.beginPath(); for (let k = -1; k <= 1; k++) { c.moveTo(b.x + k * b.r * 0.5, y - b.r * 0.85); c.lineTo(b.x + k * b.r * 0.5, y + b.r * 0.85); c.moveTo(b.x - b.r * 0.85, y + k * b.r * 0.5); c.lineTo(b.x + b.r * 0.85, y + k * b.r * 0.5) } c.stroke() }
    else { oval(c, b.x, y, b.r, b.r); c.fillStyle = b.k === 'rock' ? '#9a8f86' : b.k === 'soy' ? '#5a3a26' : '#6fc3ff'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke(); c.fillStyle = 'rgba(255,255,255,.7)'; oval(c, b.x - b.r * 0.3, y - b.r * 0.35, b.r * 0.3, b.r * 0.25); c.fill() }
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
  if (e.type === 'dekatsuyo') {   // 데카츠요의 노란 빛 — 둥근 빛과 빛살
    const cy = y - e.r * 1.1 * k, R = e.r * 2 * k
    c.globalAlpha = 0.45 + 0.1 * Math.sin(G.t * 5); c.fillStyle = '#fff3a0'; oval(c, e.x, cy, R, R * 0.9); c.fill()
    c.globalAlpha = 0.7; c.strokeStyle = '#e8d24a'; c.lineWidth = 1.4; c.beginPath(); for (let i = 0; i < 18; i++) { const a = i / 18 * TAU + G.t * 0.3; c.moveTo(e.x + Math.cos(a) * R * 0.86, cy + Math.sin(a) * R * 0.78); c.lineTo(e.x + Math.cos(a) * R * 0.98, cy + Math.sin(a) * R * 0.88) } c.stroke(); c.globalAlpha = 1
  }
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
/** 타이머 아래 한 줄 — 다음 보스까지 · 세이렌전 중엔 검은 별똥별까지 · 나오면 30:00까지 */
function nextLine() {
  if (G.dark) return [`검은 별똥별! 쓰러뜨릴 수 없어요 — 30:00까지 ${fmt(Math.max(0, END_T - G.t))}`, '#c9b3ff']
  if (G.final) return [`최종보스! · 검은 별똥별까지 ${fmt(Math.max(0, DARK_T - G.t))}`, '#ff9be0']
  const nx = PLAN[G.pi]
  if (nx && nx[0] < FINAL_T) return [`다음 보스 ${BOSS[nx[1]].name}${nx[2] ? '(중간)' : ''} ${fmt(nx[0] - G.t)}`, '#fff']
  return [`최종보스 세이렌까지 ${fmt(Math.max(0, FINAL_T - G.t))}`, '#ff9be0']
}
function hud(c) {
  const W = cv.width / DPR, H = cv.height / DPR
  c.fillStyle = 'rgba(74,59,53,.45)'; c.fillRect(0, 0, W, 10)
  c.fillStyle = '#7fd3ff'; c.fillRect(0, 0, W * Math.min(1, G.xp / G.next), 10)
  txt(c, `Lv ${G.lvl}`, 34, 32, 17)
  txt(c, fmt(G.t), W / 2, 38, 26)
  const [nl, nc] = nextLine(); txt(c, nl, W / 2, 56, 12, nc)
  txt(c, `처치 ${G.kills}`, W / 2, 73, 12)
  let x = 10
  for (const w of G.weapons) { c.drawImage(SPR.E[w.id].c, x, 44, 26, 26); txt(c, String(w.lv), x + 22, 70, 11, w.lv === 8 ? '#ffd23f' : '#fff'); x += 28 }
  x = 10
  for (const id in G.passives) { c.drawImage(SPR.E[id].c, x, 76, 20, 20); txt(c, String(G.passives[id]), x + 17, 96, 10); x += 22 }
  let sy = 116
  for (const id in G.sts) { const left = G.sts[id] - G.t; if (left > 0) { txt(c, `${STATUS[id].name} ${Math.ceil(left)}초 — ${STATUS[id].note}`, W / 2, sy + 2, 13, STATUS[id].col); sy += 18 } }
  for (const h of G.help) { txt(c, `${h.k === 'pajama' ? '♪ 파자마 파티즈 공연' : '한잎이 · 두잎이가 지키는 중'} ${Math.ceil(h.T - h.t)}초`, W / 2, sy + 2, 13, h.k === 'pajama' ? '#ffb3e6' : '#b9f09a'); sy += 18 }
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
    h('p', { class: 'fine' }, '비공식 · 비영리 팬게임 — 원작 「ちいかわ」 © ナガノ'),
    h('p', { class: 'fine' }, '문의 ', h('a', { href: 'mailto:super.godbono@gmail.com' }, 'super.godbono@gmail.com'))))
}
/** 캐릭터 고르기 — 화면을 다시 그리지 않고 고른 표시만 옮긴다(누를 때마다 깜빡이지 않게). 놓은 캐릭터는 서 있는 그림으로 */
function pickChar(i) {
  const cards = ui.querySelectorAll('.char'), old = cards[pickCi], c = old?.querySelector('canvas')
  if (old) old.classList.remove('on')
  if (c?._idle) { const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.drawImage(c._idle, 0, 0) }
  pickCi = i; cards[i]?.classList.add('on')
}
function chars() {
  mode = 'chars'; G = null
  show(h('div', { class: 'panel wide' },
    h('p', { class: 'h' }, '누구랑 토벌할까?'),
    h('div', { class: 'chars' }, CHARS.map((ch, i) => {
      const b = save.best[ch.id], W = WEAP[ch.w]
      return h('button', { type: 'button', class: `char${i === pickCi ? ' on' : ''}`, onclick: () => pickCi === i ? startGame(i) : pickChar(i) },
        portrait(ch.id), h('b', {}, ch.name), h('small', {}, `${W.icon} ${W.name}`), h('span', { class: 'trait' }, ch.trait), h('span', { class: 'note' }, ch.note),
        h('span', { class: 'best' }, b ? `최고 ${fmt(b.t)} · 레벨 ${b.lvl}${b.clears ? ` · 클리어 ${b.clears}번` : ''}` : '아직 기록 없음'))
    })),
    h('div', { class: 'row' }, btn('← 처음으로', title), btn('토벌 시작!', () => startGame(pickCi), 'main'))))
}
setInterval(() => {   // 캐릭터 고르기 — 고른 캐릭터가 제자리걸음
  if (mode !== 'chars') return
  const cv = ui.querySelector('.char.on canvas')
  if (!cv?._walk?.length) return
  const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); g.drawImage(cv._walk[(tnow * 8 | 0) % 4], 0, 0)
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
      h('li', {}, `${FINAL_T / 60}분에 세이렌과 인어 셋이 나와요. 세이렌을 쓰러뜨리면 토벌 성공!`),
      h('li', {}, `${DARK_T / 60}분까지 세이렌을 못 쓰러뜨리면 검은 별똥별이 나타나요 — 쓰러뜨릴 수 없으니 ${END_T / 60}:00까지 도망치면 생존 클리어. 기록은 이 브라우저에만 저장돼요.`)),
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
    h('h3', {}, '도와주는 친구들 (선택은 못 해요 — 아이템을 먹으면 잠깐 나타나요)'),
    h('ul', { class: 'list' }, li(portrait('pj1'), '파자마 파티즈', '잠옷 아이돌 그룹(초록 · 분홍 · 하양 · 보라). 꿀맛 페스티벌 티켓을 먹으면 10초 동안 곁을 돌며 공연 — 1초마다 음표 충격파로 둘레의 적을 밀쳐 내고, 응원으로 쿨타임 -25%', '🎫 꿀맛 페스티벌 티켓'), li(portrait('leafpair'), '한잎이 · 두잎이', '늘 손을 잡고 다니는 섬 주민 둘(얼굴은 드러나지 않는다). 건전지를 먹으면 12초 동안 곁을 돌며 날아오는 것을 막고 닿은 적을 밀쳐 낸다', '🔋 건전지')),
    h('h3', {}, '토벌 대상'),
    h('ul', { class: 'list' }, Object.entries(FOES).filter(([id]) => !(id in BOSS)).map(([id, f]) => li(portrait(id), f.name, f.note))),
    h('h3', {}, '보스'),
    h('ul', { class: 'list' }, Object.entries(BOSS).map(([id, b]) => li(portrait(id), b.name, b.note, `나오는 때: ${when(id)}${b.st ? ` · 상태이상: ${STATUS[b.st].name}(${STATUS[b.st].note})` : ''}`)), li(portrait('darkstar'), '검은 별똥별', '쓰러뜨릴 수 없다 — 끝까지 쫓아오며(점점 빨라진다) 3초마다 별 조각을 사방으로 뿌린다. 30:00까지 도망치기', `나오는 때: ${fmt(DARK_T)}(세이렌을 못 쓰러뜨렸을 때)`)),
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
    h('p', { class: 'h' }, win ? (G.endKind === 'time' ? '30분 생존! 🎉' : '토벌 성공! 🎉') : quit ? '토벌 중단' : '쓰러졌다… 와아…'),
    h('p', { class: 'sub' }, win ? (G.endKind === 'time' ? '검은 별똥별에게서 끝까지 도망쳤어요!' : '세이렌을 쫓아냈어요!') : G.final ? '세이렌까지 왔어요! 조금만 더' : `세이렌까지 ${fmt(Math.max(0, FINAL_T - G.t))} 남았어요`),
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
window.__mjg = { FINAL_T, DARK_T, END_T, sasu: sasuShape, step, startGame, art: artSprite, WALK, CHARS, get G() { return G }, get pl() { return pl }, get mode() { return mode }, pick0() { if (BOX) { take(BOX.opts[0]); next() } } }
