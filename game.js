// 먼작귀 서바이버즈 — 뱀파이어 서바이버즈류 비공식 팬게임.
//   덩크 서바이버(nba-kor.github.io/survive)의 게임 규칙만 가져와 먼작귀 세계로 옮겼다(그림 · 캐릭터는 새로).
//   몰려오는 토벌 대상(고블린 · 키메라)을 피해 다니면 스킬은 알아서 나간다. FINAL_T 에 최종보스 세이렌(+인어 셋) — 쓰러뜨리면 클리어.
//   레벨 업마다 랜덤 상자(셋 중 하나 · 리롤 · 스킵 · 제외 · 1% 잭팟), 스킬 Lv 8 · 아이템 Lv 5, 짝 스킬을 모으면 시너지.
//   그림은 캔버스 하나에 코드로(처음에 한 번 그려 두고 옮겨 그린다). 메뉴 · 상자는 캔버스 위에 겹친 HTML(#ui). 기록은 이 브라우저(localStorage)에만.

// 언어 — 처음 화면 오른쪽 위에서 고르면 이 브라우저(save.lang)에 기억하고 다시 불러온다. 한국어가 원문이고 다른 말은 i18n/<언어>.js(열쇠 = 한국어 원문)
//   글은 모두 tr`…` 로 감싼다 — ${} 자리는 열쇠에서 {0} {1} …(번역에서 순서를 바꿀 수 있다). 번역이 없으면 한국어 그대로. 빠진 번역 찾기: node test/i18n.cjs
const LANGS = [['ko', '한국어', 'kr'], ['ja', '日本語', 'jp'], ['en', 'English', 'us'], ['zh-CN', '简体中文', 'cn'], ['zh-TW', '繁體中文', 'tw']]   // 코드 · 그 말로 쓴 이름 · 국기
const LANG = (() => {   // ?lang=en(홍보 링크 chii-ka-wa.github.io/en/ 이 여기로 보낸다)은 그 방문만 — 저장하지 않는다(링크는 고른 게 아니다 · 기획). 언어 단추로 고른 것(save.lang)은 고정, 없으면 브라우저 언어
  const q = new URLSearchParams(location.search).get('lang')?.toLowerCase(), hit = LANGS.find(x => x[0].toLowerCase() === q)?.[0]
  if (hit) { const u = new URLSearchParams(location.search); u.delete('lang'); history.replaceState(null, '', location.pathname + (u.size ? '?' + u : '') + location.hash); return hit }   // 주소에서는 지운다(언어 단추와 같은 동작)
  let s = {}; try { s = JSON.parse(localStorage.getItem('mjg.v1')) || {} } catch {}
  if (LANGS.some(x => x[0] === s.lang)) return s.lang
  for (const l of navigator.languages?.length ? navigator.languages : [navigator.language || '']) {   // 브라우저 언어 — 첫 맞는 것. 자동으로 고른 말은 저장하지 않는다
    const v = l.toLowerCase()
    if (v.startsWith('ko')) return 'ko'; if (v.startsWith('ja')) return 'ja'; if (/^zh-(tw|hk|mo)|^zh-hant/.test(v)) return 'zh-TW'; if (v.startsWith('zh')) return 'zh-CN'; if (v.startsWith('en')) return 'en'
  }
  return 'en'   // 다섯 말에 없으면 영어(기획)
})()
const TR = LANG === 'ko' ? null : await import(`./i18n/${LANG}.js${new URL(import.meta.url).search}`).then(m => m.default, () => null)   // ?v= — index.html 이 붙인 판 번호를 번역 파일에도(새 판이면 새로 받는다)
function tr(s, ...v) {
  let k = s[0]; for (let i = 1; i < s.length; i++) k += `{${i - 1}}` + s[i]
  const r = TR?.[k]
  return r == null ? s.reduce((a, x, i) => a + v[i - 1] + x) : r.replace(/\{(\d+)\}/g, (_, i) => v[i])
}
const KO = TR && Object.fromEntries(Object.entries(TR).map(([k, v]) => [v, k]))
const ko = s => KO?.[s] ?? s   // 번역된 이름 → 한국어(익명 통계는 어느 말로 해도 한국어로 모은다)
document.documentElement.lang = LANG
const CJK = { ja: 'Zen Maru Gothic', 'zh-CN': 'Noto Sans SC', 'zh-TW': 'Noto Sans TC' }[LANG]   // Jua 에 없는 일본 · 중국 글자는 이 글꼴로(index.html 의 :lang 규칙)
if (CJK) document.head.append(Object.assign(document.createElement('link'), { rel: 'stylesheet', href: `https://fonts.googleapis.com/css2?family=${CJK.replace(/ /g, '+')}:wght@700&display=swap` }))

const TAU = Math.PI * 2
let SIM = null   // 모의 토벌을 돌리는 중(아래 「모의 토벌」)
/** 섞기(Fisher–Yates · rnd) — 비교 함수에 rnd 를 쓰는 정렬은 엔진마다 비교 횟수가 달라 모의 토벌 결과가 브라우저마다 갈렸다(QA 2026-11-22) */
const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]] } return a }
let rnd = Math.random   // 모의 토벌은 고정 시드로 바꿔 끼운다(simRun) — 게임 결과에 닿는 무작위는 모두 rnd 를 거친다(Math.random 은 소리뿐)
const clamp = (v, a, b) => v < a ? a : v > b ? b : v
const fmt = s => `${String(s / 60 | 0).padStart(2, '0')}:${String(s % 60 | 0).padStart(2, '0')}`
const pickOf = a => a[rnd() * a.length | 0]
const VIEW = 500          // 화면의 짧은 쪽에 보이는 월드 크기(캐릭터가 작아 보이지 않게) — 휴대폰을 세워도 눕혀도 둘레가 이만큼은 보인다
const MAX_FOES = 240      // 한 화면 적 수 한도 — 휴대폰 그리기 비용(예전 320, 넘친 몫은 crowd 로 피 · 경험치에)
const FINAL_T = 25 * 60   // 최종보스 세이렌이 나오는 때
const DARK_T = 29 * 60, END_T = 30 * 60   // 세이렌을 못 쓰러뜨리면 29분에 검은 별똥별(쓰러뜨릴 수 없다) — 30분까지 도망치면 생존 클리어

// ---------------------------------------------------------------- 표

// 캐릭터 — w 시작 스킬, mod 고유 특성
const CHARS = [
  { id: 'chiikawa', name: tr`치이카와`, w: 'sasu', hp: 100, trait: tr`울보 근성`, note: tr`체력이 절반 이하면 공격력 +30% — 레벨업마다 기준 체력 +1%(Lv 2면 51% 이하), Lv 50부터는 늘 · 경험치 +5%`, mod: { clutch: 0.3, growth: 0.05 } },
  { id: 'hachiware', name: tr`하치와레`, w: 'guitar', hp: 110, trait: tr`어떻게든 돼라!`, note: tr`행운 +20% · 잭팟 확률 2배 · 리롤 · 스킵 · 제외 +1`, mod: { luck: 0.2, jackpot: 1, boxes: 1 } },
  { id: 'usagi', name: tr`우사기`, w: 'stick', hp: 100, trait: tr`야하!`, note: tr`이동 속도 +20% · 공격력 +10%`, mod: { move: 0.2, might: 0.1 } },
  { id: 'momonga', name: tr`모몽가`, w: 'momo', hp: 90, trait: tr`내 거야!`, note: tr`보스 · 정예에게 주는 피해 +30% · 이동 속도 +15%`, mod: { bossX: 0.3, move: 0.15 } },
  { id: 'kurimanju', name: tr`쿠리만쥬`, w: 'kanpai', hp: 130, trait: tr`캬아~`, note: tr`받는 피해 -2 · 초당 체력 0.5 회복 · 경험치 줍는 거리 +30%`, mod: { armor: 2, regen: 0.5, magnet: 0.3 } },
  { id: 'rakko', name: tr`랏코`, w: 'sword', hp: 120, trait: tr`토벌 랭킹 1위`, note: tr`치명타 확률 +10% · 치명타 피해 2.2배`, mod: { crit: 0.1, critX: 0.2 } },   // 밸런스 2026-11-22 — +15% · 2.5배는 평균 피해 ×1.56(다른 캐릭터 ×1.19)이었다
  { id: 'kani', name: tr`카니`, w: 'book', hp: 110, trait: tr`헌책방 주인`, note: tr`범위 +20% · 투사체 속도 +20%`, mod: { area: 0.2, speed: 0.2 } },
  { id: 'shisa', name: tr`시사`, w: 'ramen', hp: 110, trait: tr`라멘집 수행 중`, note: tr`경험치 +15% · 쿨타임 -5% · 지속 시간 +15%`, mod: { growth: 0.15, cdr: 0.05, dur: 0.15 } },
]

// 스킬 — cd 쿨타임(초) · dmg 피해 · n 개수 · area 크기 배수 · spd 속도 배수 · dur 지속(초) · pierce 꿰뚫는 수. ups[i] = 레벨 i+2 가 될 때 더하는 것(최고 Lv 8)
const WEAP = {
  book: { name: tr`헌책 날리기`, note: tr`헌책을 펼치면 책장이 가까운 적 쪽으로 부채꼴을 그리며 차례로 날아간다 — 몰려 있는 적에게 좋다`, how: tr`앞쪽 부채꼴로 책장 날리기`, cd: 1.2, dmg: 20, n: 3, pierce: 4, ups: [{ n: 1 }, { dmg: 8 }, { pierce: 1 }, { n: 1 }, { cd: -0.3 }, { dmg: 10 }, { n: 1, pierce: 2 }] },   // 카니 시작 스킬
  pile: { name: tr`헌책 더미`, note: tr`지나온 자리에 헌책을 쌓아 둔다 — 적이 닿으면 기우뚱하다 와르르 무너져 둘레에 피해. 쫓아오는 적에게 좋다`, how: tr`지나온 자리에 무너지는 덫`, cd: 2.2, dmg: 24, dur: 8, ups: [{ dmg: 8 }, { n: 1 }, { area: 0.2 }, { cd: -0.4 }, { dmg: 10 }, { n: 1 }, { area: 0.2, dmg: 12 }] },
  sasu: { name: tr`사스마타 찌르기`, note: tr`가장 가까운 적에게 사스마타를 찔러 넣는다 — 꿰뚫는다`, how: tr`가까운 적을 꿰뚫어 찌르기`, cd: 1, dmg: 16, pierce: 3, ups: [{ n: 1 }, { dmg: 8 }, { cd: -0.2 }, { n: 1 }, { dmg: 10 }, { pierce: 3 }, { n: 1, dmg: 14, pierce: 2 }] },
  stick: { name: tr`토벌봉`, note: tr`가장 가까운 적 쪽으로 봉을 휘두르면 양 끝에서 폭발이 일어난다(두 번째는 그와 직각으로)`, how: tr`가까운 적 쪽으로 휘둘러 양 끝이 폭발`, cd: 1.3, dmg: 15, ups: [{ dmg: 6 }, { area: 0.15 }, { cd: -0.25 }, { dmg: 7 }, { area: 0.2 }, { n: 1 }, { dmg: 12 }] },
  yaha: { name: tr`야하!`, note: tr`높이 뛰어올라 내려찍으면 둘레에 충격파 — 밀쳐 낸다`, how: tr`뛰어올라 내 둘레 충격파`, cd: 3.2, dmg: 26, ups: [{ area: 0.15 }, { dmg: 10 }, { cd: -0.5 }, { area: 0.15 }, { dmg: 12 }, { n: 1 }, { dmg: 18, area: 0.15 }] },
  ura: { name: tr`우라!`, note: tr`기합을 계속 질러 둘레의 적에게 피해를 준다`, how: tr`내 둘레에 계속 피해`, cd: 0.45, dmg: 4, ups: [{ area: 0.1 }, { dmg: 1 }, { area: 0.1 }, { cd: -0.08 }, { dmg: 2 }, { area: 0.1 }, { dmg: 2 }] },
  weed: { name: tr`풀뽑기`, note: tr`풀뽑기 검정 5급의 솜씨 — 가까운 적 발밑의 풀을 뽑아 터뜨린다`, how: tr`적 발밑이 터짐`, cd: 2.6, dmg: 18, n: 2, ups: [{ n: 1 }, { dmg: 6 }, { area: 0.2 }, { n: 1 }, { cd: -0.5 }, { n: 1 }, { dmg: 12 }] },
  tears: { name: tr`와아… (울음)`, note: tr`눈물이 높이 튀어 떨어진 자리를 적신다 — 멀리 있는 적과 가장 가까운 적을 번갈아`, how: tr`멀리 · 가까운 적에게 번갈아 물폭탄`, cd: 2.2, dmg: 22, ups: [{ n: 1 }, { area: 0.2 }, { dmg: 10 }, { n: 1 }, { cd: -0.4 }, { dmg: 12 }, { n: 1, area: 0.2 }] },
  guitar: { name: tr`하치와레의 기타`, note: tr`음표가 몸 둘레를 돌며 적을 쳐 낸다 — 연주하는 동안 몸에 붙은 적을 살짝 밀쳐 낸다`, how: tr`음표가 내 둘레를 돎 · 붙은 적 밀쳐 내기`, cd: 1.6, dmg: 12, n: 2, dur: 3.2, ups: [{ n: 1 }, { area: 0.15, spd: 0.25 }, { dmg: 4 }, { n: 1 }, { dur: 1 }, { n: 1 }, { dmg: 5, dur: 1 }] },
  nantoka: { name: tr`어떻게든 돼라!`, note: tr`가까운 적부터 별이 번개처럼 꽂힌다`, how: tr`가까운 적에게 번개`, cd: 2.8, dmg: 20, n: 2, ups: [{ n: 1 }, { dmg: 8 }, { area: 0.25 }, { n: 1 }, { cd: -0.5 }, { n: 1 }, { dmg: 14 }] },
  ramen: { name: tr`라멘 국물`, note: tr`가까운 적 발밑에 뜨거운 국물을 쏟아 밟은 적을 느리게 하고 데운다`, how: tr`가까운 적 발밑 장판 · 느리게`, cd: 3.5, dmg: 8, dur: 3, ups: [{ n: 1 }, { dmg: 2 }, { dur: 0.5 }, { area: 0.15 }, { n: 1 }, { dmg: 1 }, { dur: 0.5, area: 0.15 }] },   // 11-17 버프 — 초반 · 중반 세게(Lv 8 피해는 그대로 11)
  curry: { name: tr`극매운 카레`, note: tr`적이 몰린 곳에 카레 냄비 — 1초 뒤 매운 폭발. 인어 · 세이렌에게 1.5배`, how: tr`적이 몰린 곳에 큰 폭발`, cd: 3.2, dmg: 22, ups: [{ dmg: 7 }, { area: 0.15 }, { n: 1 }, { cd: -0.4 }, { dmg: 9 }, { area: 0.15 }, { n: 1, dmg: 10 }] },
  pochette: { name: tr`포셰트 부메랑`, note: tr`던지면 되돌아오는 포셰트 — 오가며 계속 맞힌다`, how: tr`갔다 돌아오는 부메랑`, cd: 1.8, dmg: 10, ups: [{ dmg: 4 }, { n: 1 }, { area: 0.25 }, { dmg: 5 }, { n: 1 }, { spd: 0.3 }, { n: 1 }] },
  momo: { name: tr`내놔!`, note: tr`보스 · 정예 먼저, 없으면 가장 가까운 적에게 달려들어 낚아채는 큰 한 방 — 둘레도 조금 할퀸다`, how: tr`보스 · 가까운 적에게 큰 한 방`, cd: 1.9, dmg: 38, ups: [{ dmg: 14 }, { n: 1 }, { cd: -0.3 }, { dmg: 18 }, { n: 1 }, { cd: -0.3 }, { dmg: 30 }] },
  kanpai: { name: tr`건배!`, note: tr`잔이 맞은 적에서 옆 적으로 튕겨 가며 부딪친다`, how: tr`적 사이를 튕겨 다니기`, cd: 1.4, dmg: 15, pierce: 1, bounce: 2, ups: [{ bounce: 1 }, { dmg: 6 }, { n: 1 }, { bounce: 2 }, { dmg: 8 }, { cd: -0.2 }, { n: 1, bounce: 3, dmg: 8 }] },   // 11-17 너프 — 섞어 들면 피해의 30~45% 를 가져갔다
  sword: { name: tr`랏코 선생의 일섬`, note: tr`화면을 가로지르는 칼바람 — 줄 위의 적을 모두 벤다`, how: tr`화면을 가로지르는 베기`, cd: 2.4, dmg: 20, ups: [{ dmg: 6 }, { area: 0.25 }, { n: 1 }, { cd: -0.3 }, { dmg: 7 }, { area: 0.25 }, { n: 1, dmg: 8 }] },   // 11-17 너프 — 후반(Lv 8)이 가장 셌다
}
/** 투사체 스킬 — 「둘이서 같이」가 개수 +1 하는 것(장판 · 범위 · 둘레는 빼고 · 사용자 · 기획 2026-11-22). 도감 · 레벨업 카드에 「투사체」 꼬리표 */
const PROJ = new Set(['sasu', 'book', 'pochette', 'kanpai', 'tears', 'nantoka', 'momo', 'sword', 'guitar'])
const UP = { n: v => tr`개수 +${v}`, dmg: v => tr`피해 +${v}`, cd: v => tr`쿨타임 ${v}초`, area: v => tr`범위 +${Math.round(v * 100)}%`, spd: v => tr`속도 +${Math.round(v * 100)}%`, dur: v => tr`지속 +${v}초`, pierce: v => tr`관통 +${v}`, bounce: v => tr`튕김 +${v}` }
// 시너지 — 짝인 두 스킬을 다 가지면 둘 다 세진다(wstat). 스킬마다 짝은 하나
const SYN = [
  [tr`랏코 선생의 수련`, { sasu: { pierce: 2, dmg: 8, cd: -0.15 }, sword: { n: 1, dmg: 8, area: 0.2 } }],   // 11-13 버프
  [tr`우사기 폭주`, { stick: { area: 0.2, dmg: 5 }, yaha: { area: 0.2, dmg: 10 } }],
  [tr`기합 폭발`, { ura: { area: 0.2 }, nantoka: { n: 1 } }],
  [tr`울면서 풀뽑기`, { weed: { n: 1 }, tears: { n: 1 } }],
  [tr`섬 맛집 투어`, { ramen: { n: 1, dur: 1 }, curry: { area: 0.2 } }],
  [tr`하치와레의 꿈`, { guitar: { n: 1, dmg: 4, dur: 1 }, pochette: { n: 1, dmg: 5, area: 0.2 } }],   // 11-13 버프
  [tr`안주 내놔!`, { momo: { n: 1 }, kanpai: { bounce: 2, dmg: 3 } }],
  [tr`카니의 헌책방`, { book: { n: 1, pierce: 1 }, pile: { n: 1, area: 0.2 } }],
]
const synOf = id => SYN.find(s => id in s[1])
// 각성 — Lv 8 스킬이 있을 때 보스(중간보스 빼고)를 쓰러뜨리면 「각성의 별」. 수치는 한 레벨 몫쯤만 오르고(up), 모두 날아오는 것(적 탄)을 p 확률로 막는다 — 탄 하나에 스킬마다 한 번 굴린다(parry)
const AW = {
  book: { name: tr`헌책방 대방출`, note: tr`날아가는 책장이 날아오는 것에 닿으면 40% 확률로 막는다`, up: { n: 1, dmg: 4 }, p: 0.4 },
  pile: { name: tr`헌책 성벽`, note: tr`세워 둔 헌책 더미가 날아오는 것을 60% 확률로 막는 벽이 된다`, up: { dmg: 10 }, p: 0.6 },
  sasu: { name: tr`사스마타 쳐 내기`, note: tr`찌르는 사스마타가 날아오는 것에 닿으면 50% 확률로 쳐 낸다`, up: { dmg: 8, pierce: 2 }, p: 0.5 },
  stick: { name: tr`토벌봉 회오리`, note: tr`휘두를 때 둘레의 날아오는 것을 50% 확률로 쳐 낸다`, up: { dmg: 8, area: 0.1 }, p: 0.5 },
  yaha: { name: tr`야하야하!`, note: tr`충격파가 퍼지며 날아오는 것을 45% 확률로 날려 버린다`, up: { dmg: 12 }, p: 0.45 },
  ura: { name: tr`우라라라!`, note: tr`기합이 닿는 둘레로 날아온 것을 30% 확률로 튕겨 낸다`, up: { dmg: 2, area: 0.1 }, p: 0.3 },
  weed: { name: tr`풀뽑기 검정 3급`, note: tr`풀이 뽑혀 터지는 자리의 날아오는 것을 50% 확률로 덮친다`, up: { n: 1, dmg: 6 }, p: 0.5 },
  tears: { name: tr`엉엉 대홍수`, note: tr`눈물이 떨어진 자리(멀리서 쏘는 적 둘레)의 날아오는 것을 60% 확률로 씻어 낸다`, up: { n: 1, dmg: 8 }, p: 0.6 },
  guitar: { name: tr`하치와레 라이브`, note: tr`도는 음표가 날아오는 것에 닿으면 50% 확률로 막는다`, up: { n: 1, dmg: 3 }, p: 0.5 },
  nantoka: { name: tr`어떻게든 됐다!`, note: tr`별 번개가 칠 때마다 가까이 날아오는 것 하나를 40% 확률로 떨어뜨린다`, up: { n: 1, dmg: 8 }, p: 0.4 },
  ramen: { name: tr`특제 진한 국물`, note: tr`국물 장판 위로 날아오는 것을 35% 확률로 녹인다`, up: { dmg: 3, area: 0.15 }, p: 0.35 },
  curry: { name: tr`지옥의 카레`, note: tr`매운 폭발이 둘레의 날아오는 것을 60% 확률로 태운다`, up: { dmg: 12, area: 0.1 }, p: 0.6 },
  pochette: { name: tr`포셰트 방패`, note: tr`오가는 포셰트가 날아오는 것에 닿으면 50% 확률로 막는다`, up: { n: 1, dmg: 5 }, p: 0.5 },
  momo: { name: tr`다 내놔!`, note: tr`낚아챌 때마다 가까이 날아오는 것 하나를 45% 확률로 같이 낚아챈다`, up: { dmg: 30 }, p: 0.45 },
  kanpai: { name: tr`모두 건배!`, note: tr`잔이 날아오는 것에 부딪치면 50% 확률로 깨뜨린다`, up: { bounce: 2, dmg: 6 }, p: 0.5 },
  sword: { name: tr`진 · 일섬`, note: tr`칼바람이 줄 위의 날아오는 것도 60% 확률로 벤다`, up: { dmg: 10, area: 0.2 }, p: 0.6 },
}
const upText = up => Object.entries(up).map(([k, v]) => UP[k](v)).join(' · ')
// 패치노트 — 유치원 · 초등학생도 읽기 쉽게: 한 줄에 그림 하나(ic) · 꼬리표 하나 · 짧은 문장 하나. 새 항목을 맨 위에.
//   꼬리표 new 새로워요 · up 세졌어요 · down 약해졌어요 · fix 바뀌었어요. 처음 화면 「패치노트」에 NEW(본 것은 save.seen — 날짜 + 항목 수)
const PATCH = [
  ['2026-11-23', [
    ['fix', 'inf', tr`밸런스 패치로 보스 · 회복이 바뀌고 보석 문제도 고쳐서, 무한 모드 랭킹을 처음부터 새로 시작해요`],   // 랭킹 초기화(supabase/reset-ranks.sql — 한 번만 · 기획 권고 · 사용자가 맡김 2026-11-23)
  ]],
  ['2026-11-22', [
    ['fix', 'inf', tr`밸런스 패치! 랏코 치명타 조금 약하게(+10% · 2.2배) · 어려움 · 무한 보스 체력 1.5배 · 오니기리 회복 20%(쉬움은 그대로) · 「둘이서 같이」는 투사체 스킬만 +1 · 무한 보스가 처음부터 새 패턴(1단계부터 기술 하나 더)`],   // 사용자 · 기획 2026-11-22
    ['fix', 'magnet', tr`고침: 바닥에 보석이 많으면 새 보석이 멀리 쌓여 안 보이던 문제(경험치는 사라지지 않았어요)`],
    ['fix', 'chest', tr`모의 토벌 랭킹은 무한 모드만 — 무한 작전 짜기의 전장 기본이 「이번 주」예요`],
  ]],
  ['2026-11-21', [
    ['new', 'inf', tr`「모의 토벌 랭킹」이 생겼어요! 매주 같은 전장에서 누구의 작전이 무한 모드를 가장 오래 버티는지 겨뤄요(겨울 · 풀밭 따로). 1등의 작전을 그대로 불러와 써 볼 수도 있어요.`],   // 사용자 · 기획 · 디자인
    ['up', 'parry', tr`무한 모드에서도 각성 스킬이 날아오는 것을 원래 확률대로 막아요(1단계부터 절반이던 것을 되돌렸어요)`],   // 무한 각성 막기 원복(사용자)
  ]],
  ['2026-11-20', [
    ['new', 'book', tr`레벨업을 작전대로 자동으로 고를 수 있어요! 캐릭터 고르기에서 「작전대로 자동 선택」을 켜면 작전 짜기에서 정한 순서대로 골라 줘요. 작전에 있는 게 안 나오면 리롤 · 제외 · 스킵을 쓰고, 그래도 없으면 직접 고르게 물어봐요.`],   // 진짜 판 작전대로 자동 선택(사용자 결정 · 기획)
    ['up', 'onigiri', tr`AI 대원이 똑똑해졌어요 — 보스 기술과 날아오는 것을 더 잘 피하고, 체력이 낮으면 오니기리를 먹으러 가요. 각성의 별은 꼭 줍고, 폭죽 · 자석 같은 아이템은 쓸모 있을 때 주워요`],   // 모의 토벌 AI · 무한 · 아이콘 밑 글(사용자 · 기획)
    ['new', 'inf', tr`모의 토벌을 무한 모드에서도 볼 수 있어요(강화 최대 기준)`],
    ['fix', 'wind', tr`무한 모드는 배속이 2배까지예요(모의 토벌 관전은 그대로 3배속)`],   // 무한 진짜 판 배속 — 사용자   // 모의 토벌 AI · 무한 · 아이콘 밑 글(사용자 · 기획)
    ['new', 'book', tr`작전 짜기 아이콘 밑에 어떤 스킬인지 짧게 적어 두었어요`],   // 모의 토벌 AI · 무한 · 아이콘 밑 글(사용자 · 기획)
    ['new', 'chest', tr`「모의 토벌」이 생겼어요! 작전(캐릭터 · 스킬 순서 · 이동형/정착형)을 짜 두면 AI 대원이 대신 싸우는 모습을 3배속으로 볼 수 있어요. 끝까지 보면 토벌 보상금도 조금(하루 3번)!`],   // 캐릭터 고르기 → 모의 토벌(기획 · 디자인)
    ['fix', 'inf', tr`랭킹 순서를 바꿨어요 — 단계와 잡은 보스 수가 같으면 더 오래 버틴 기록이 위예요`],   // 단계 ↓ → 보스 ↓ → 버틴 시간 ↓ → 마지막 보스 잡은 때 ↑(account.sql — 기획)
    ['fix', 'shirt', tr`휴대폰 랭킹에서 기록이 많으면 겨울 · 풀밭 탭이 눌려 아래가 잘리던 것을 고쳤어요`],
  ]],
  ['2026-11-19', [
    ['fix', 'inf', tr`무한 모드가 바뀌어(처음 25분 보스 강화 · 냄비뚜껑 방패) 랭킹을 겨울 · 풀밭으로 나누고 처음부터 새로 시작해요`],   // 랭킹 초기화(supabase/reset-ranks.sql — 한 번만 · 사용자 결정)
    ['new', 'guard', tr`무한 모드 1단계부터 보스와 세이렌을 쓰러뜨리면 「냄비뚜껑 방패」를 떨어뜨려요. 주울수록 적에게 닿아 받는 피해가 줄어들어요(이번 판만 · 화면에 −N%). 오래 버틸수록 세지는 적을 막아 줘요.`],
    ['new', 'coin', tr`출시 기념 쿠폰! 로그인한 뒤 계정 메뉴 → 쿠폰 입력에 「먼작귀서바이버즈」를 넣으면 토벌 보상금 1,000을 드려요 (한 계정 한 번 · 12월 20일까지)`],   // 날짜 = COUPON.ends · account.sql coupons.ends, 쿠폰 이름은 말마다 자기 이름(기획)
    ['fix', 'shirt', tr`쉬움 · 보통 토벌대 망토가 한눈에 달라 보여요 — 쉬움은 짧은 어깨 망토 · 동색 걸쇠, 보통은 땅까지 닿는 긴 망토 · 금 띠 · 금 고리 걸쇠`],
  ]],
  ['2026-11-18', [
    ['new', 'siren', tr`무한 세이렌은 3페이즈! 노래하는 세이렌 → 화난 세이렌(음표 울타리 — 초록 빈틈으로 빠져나가요) → 폭풍의 세이렌(큰 파도 — 초록 줄에 서요). 페이즈를 넘길 때마다 오니기리가 떨어지고 검은 별똥별 시계가 3분으로 돌아가요`],
    ['new', 'anoko', tr`무한 1단계부터 보스마다 새 기술 — 아노코 세 갈래 꼬리 · 데카츠요 쿵쿵 충격파 · 고블린 대장 돌격대 출동 · 거대 키메라 눈물 웅덩이 · 가위바위보 승부(이기는 손 원으로!) · 요리사 괴물 빙글빙글 소스`],
    ['up', 'inf', tr`무한 1단계부터 보스가 더 세져요 — 데카츠요 · 거대 키메라는 2연속, 고블린 대장 돌 2겹 · 부하 12, 가위바위보 바위 3연속 · 종이 2겹, 요리사 후추 14 · 큰 토르티야, 아노코 꼬리 뒤 바로 돌진 · 체력 2배`],
    ['up', 'parry', tr`무한 1단계부터는 각성 스킬로 날아오는 것을 막는 확률이 절반이에요`],
    ['new', 'inf', tr`로그인(카카오 · 구글)하면 기록을 계정에 저장하고 무한 랭킹에 올라가요 — 처음 화면 오른쪽 위`],
    ['fix', 'coin', tr`기록 고르기에서 「이 기기」를 골라도 한 번 더 묻던 것 · 마지막으로 한 때를 시 · 분 · 초까지`],
    ['fix', 'book', tr`카니가 다른 친구들처럼 책을 앞손에 들어요`],
    ['up', 'coinbox', tr`떠돌이 보물상자가 훨씬 자주 나와요 — 멀리 돌아다니면 10초마다 나올 수 있어요`],
    ['up', 'inf', tr`랭킹 화면이 보기 쉬워졌어요 — 그 판에 입은 의상 · 무기 스킨으로 나오고, 넓은 화면에선 표처럼 · 0단계는 「세이렌 전」`],
    ['fix', 'clock', tr`무한 모드 후반에 구형 기기에서 느려지던 것 — 느려지면 눈 · 반짝이 · 작은 숫자를 알아서 줄여요(게임 내용은 그대로)`],
    ['fix', 'license', tr`이용약관을 고쳤어요: 닉네임을 하루에 한 번 바꿀 수 있어요(7일 → 하루) · 약관 변경 알림 규칙을 정리했어요`],
    ['new', 'license', tr`이용약관이 생겼어요 — 처음 로그인할 때 동의를 받아요(처음 화면 맨 아래)`],
    ['new', LANGS.find(x => x[0] === LANG)[2], tr`처음 들어오면 브라우저 언어로 보여요 — 오른쪽 위 언어 단추로 고른 말은 계속 그 말로 열려요`],
    ['up', 'inf', tr`랭킹에 그 판을 플레이한 언어가 국기로 나와요 · 휴대폰에서 랭킹 줄이 두 줄로 넉넉해졌어요`],
    ['new', 'slipper', tr`PC로 처음 하면 첫 판에 키보드 · 마우스 조작법을 15초 동안 보여 줘요`],
    ['up', 'anoko', tr`어려움 · 무한: 아노코와 세이렌이 훨씬 단단해졌어요(아노코 약 6배 · 세이렌 약 10배)`],
    ['fix', 'onigiri', tr`같은 아이템은 맵에 2개(무한 1개)까지만 떨어져요 — 오니기리는 5개(무한 3개)`],
    ['up', 'coinbox', tr`떠돌이 보물상자가 멀리 움직일 때마다 반드시 나와요(10초마다) — 상자 표시가 다 차면 등장! 대신 12초 뒤 사라져요`],
    ['fix', 'shirt', tr`의상 · 스킨 값이 10분의 1이 됐어요 — 일반 의상 500 · 고급 2,000(게 머리띠 · 밤 · 딸기 찹쌀떡 · 신데렐라 · 왕자님은 1,000) · 무기 스킨 · 스킬 스킨 1,000`],
    ['new', 'shirt', tr`쉬움 · 보통 클리어 보상 — 캐릭터마다 토벌대 망토 넷(쉬움 · 쉬움 겨울 · 보통 · 보통 겨울)과 새싹 · 털실 감기 무기 스킨. 망토마다 그 캐릭터 능력치 +0.5% 보유 효과`],
    ['fix', 'sword', tr`랏코 섬 화관의 보유 효과가 치명타 확률로 바뀌었어요(우사기와 겹치지 않게)`],
    ['new', 'inf', tr`무한 랭킹을 겨울 · 풀밭 따로 봐요(처음엔 겨울) — 맵마다 한 사람당 최고 기록 하나`],
    ['fix', 'shirt', tr`휴대폰 상점에서 단추 · 탭 글자가 넘쳐 잘리던 것을 고쳤어요 — 단추는 글 밑으로 내려가요`],
    ['fix', 'inf', tr`무한 모드를 깨도 캐릭터 업적 의상을 받아요(어려움 클리어와 같게). 전에 무한만 깨서 알림만 뜨고 못 받았다면 이제 열려 있어요`],
  ]],
  ['2026-11-17', [
    ['new', 'cheer', tr`응원 카드에 지금 몇 단계인지 보여요 — 더 올릴 게 없으면 오니기리 · 응원 중에 하나를 골라요. 무한 모드는 응원이 끝없이 쌓이고, 일반 적도 단계마다 세져요`],
    ['fix', 'coin', tr`상점 값이 내려갔어요 — 고급 의상 20,000(게 머리띠 · 밤 · 딸기 찹쌀떡 · 신데렐라 · 왕자님은 10,000), 무기 스킨 · 스킬 스킨 10,000`],
    ['new', 'wind', tr`어려움을 클리어하면 3배속이 열려요 — 오른쪽 위 ×2 단추를 한 번 더 누르면 ×3`],
    ['new', 'inf', tr`무한 모드가 생겼어요! 어려움보다 1.5배 어렵고 25분 세이렌을 쓰러뜨려도 끝나지 않아요 — 강해진 보스가 둘 · 셋씩, 세이렌도 둘 · 셋!`],
    ['new', 'shirt', tr`고급 · 업적 의상을 모으면 입지 않아도 아주 작은 보유 효과가 생겨요 — 상점 「의상」 탭 맨 위에서 볼 수 있어요`],
    ['up', 'coinbox', tr`떠돌이 보물상자 잭팟이 500에서 5,000으로 커졌어요!`],
    ['new', 'snow', tr`겨울이 왔어요! 눈이 내리고 토벌 대상들이 산타 모자를 썼어요 — 처음 화면 왼쪽 위에서 풀밭으로 바꿀 수 있어요`],
    ['new', 'wind', tr`겨울 맵에 눈보라가 와요! 1분마다 반반 확률 — 쌓인 눈은 미끄럽고 받는 피해가 조금 늘어요(5초 넘게 계속 움직이면 몸에 열이 나서 괜찮아요)`],
    ['new', 'snow', tr`겨울 맵에서 5초 넘게 가만히 있으면 몸이 꽁꽁 얼어 체력이 조금씩 줄어요 — 계속 움직여요!`],
    ['new', 'hard', tr`새 업적 「눈보라를 이겨 냈다」 · 「겨울 토벌」 — 겨울 맵을 어려움으로 클리어하면 불꽃 옷을 받아요(눈보라에 끄떡없어요)`],
    ['new', 'sasu', tr`겨울 무기 스킨이 생겼어요! 겨울 맵을 보통 이상으로 클리어하면 그 캐릭터의 겨울 무기를 받아요`],
    ['new', 'shirt', tr`의상이 생겼어요! 상점 「의상」 탭에서 사요 — 한 번 사면 모든 캐릭터가 입어요`],
    ['new', 'hard', tr`어려움을 클리어하면 그 캐릭터의 특별한 업적 의상을 받아요`],
    ['new', 'sasu', tr`무기 스킨이 생겼어요! 손에 든 무기 모양이 바뀌어요`],
    ['new', 'awaken', tr`스킬 스킨이 생겼어요! 스킬 색이 바뀌고 반짝반짝 — 각성해 본 스킬은 그냥 받아요`],
    ['fix', 'magnet', tr`자석을 먹으면 멀리 있는 경험치까지 정말 다 모아요`],
    ['down', 'kanpai', tr`건배! — 잔이 덜 튕기고 조금 약해졌어요`],
    ['down', 'sword', tr`랏코 선생의 일섬 — 레벨이 오를 때 조금 덜 세져요`],
    ['up', 'ramen', tr`라멘 국물이 더 자주, 더 뜨겁게 끓고 밟은 적이 더 느려져요!`],
    ['fix', 'zoom', tr`PC에서 Esc 키를 누르면 처음 화면으로 돌아가요(상점 · 도감 · 결과 화면 등)`],
  ]],
  ['2026-11-16', [
    ['new', 'globe', tr`이제 다른 나라 말로도 놀 수 있어요! 처음 화면 오른쪽 위에서 골라요 — 한국어 · 日本語 · English · 简体中文 · 繁體中文`],
    ['fix', 'party', tr`패치노트를 그림과 쉬운 말로 바꿨어요`],
    ['fix', 'awaken', tr`각성 상자에서도 Enter · Space 키로 받을 수 있어요`],
    ['up', 'coinbox', tr`떠돌이 보물상자가 더 자주 나와요`],
    ['fix', 'coin', tr`판이 끝나면 토벌 보상금 · 보물상자 돈 · 합계를 따로따로 보여 줘요`],
    ['fix', 'syn', tr`도감을 읽기 쉽게 바꿨어요 — 짝꿍은 초록, 각성은 분홍!`],
    ['up', 'tears', tr`「와아… (울음)」이 멀리 있는 적과 가까이 온 적을 번갈아 맞혀요`],
    ['up', 'guitar', tr`하치와레의 기타 — 연주하는 동안 몸에 붙은 적을 살짝 밀쳐 내요. 더 자주, 더 세게!`],
    ['up', 'ramen', tr`라멘 국물을 적 발밑에 쏟아요`],
    ['up', 'stick', tr`우사기의 토벌봉 — 가까운 적 쪽으로 휘둘러요. 더 빠르고 더 세졌어요!`],
    ['down', 'wage', tr`치이카와 · 시사가 받는 경험치가 조금 줄었어요`],
    ['fix', 'zoom', tr`마우스로 할 때 동그라미가 누른 자리에 가만히 있어서 움직이기 쉬워요`],
    ['new', 'wind', tr`오른쪽 위 ×2 단추를 누르면 게임이 2배 빨라져요`],
    ['new', 'coinbox', tr`여기저기 돌아다니면 가끔 보물상자가 나와요! 열면 보상금이 들어 있어요`],
    ['new', 'stone', tr`상점에서 부활석을 살 수 있어요. 쓰러져도 다시 일어나요!`],
    ['fix', 'siren', tr`20~25분은 조금 쉬워지고, 세이렌이 나오면 더 어려워져요`],
    ['fix', 'anoko', tr`아노코 · 세이렌 · 인어의 꼬리가 등 쪽에 붙었어요`],
  ]],
  ['2026-11-15', [
    ['new', 'awaken', tr`각성! Lv 8 스킬이 있을 때 보스를 쓰러뜨리면 별이 떨어져요. 먹으면 스킬이 더 세지고 날아오는 공격도 막아요`],
    ['new', 'a_goblin', tr`각성 업적 3개가 생겼어요`],
    ['up', 'sasu', tr`사스마타 찌르기 · 건배! · 헌책 날리기가 더 세졌어요`],
    ['up', 'momo', tr`「내놔!」가 옆에 있는 적도 할퀴어요`],
    ['up', 'chiikawa', tr`치이카와의 울보 근성이 더 자주 켜져요. Lv 50부터는 늘 켜져요!`],
    ['fix', 'nantoka', tr`「어떻게든 돼라!」 · 풀뽑기 · 「내놔!」가 가까운 적부터 노려요`],
    ['fix', 'easy', tr`쉬움 · 보통에서는 적에게 맞아도 덜 아파요`],
    ['fix', 'hard', tr`어려움에서 멀리서 쏘는 몬스터가 조금 줄었어요`],
    ['fix', 'dekatsuyo', tr`첫 보스 데카츠요가 덜 무섭게 생겼어요 — 반짝반짝 큰 눈!`],
    ['fix', 'bigChimera', tr`거대 키메라가 쿵 내려찍기 전에 피할 시간이 더 생겼어요`],
    ['fix', 'a_siren', tr`세이렌을 쓰러뜨리면 둥실둥실 떠오르며 사라져요`],
    ['fix', 'chest', tr`레벨 업 상자에서 이미 가진 스킬은 뺄 수 없어요`],
  ]],
  ['2026-11-14', [
    ['new', 'book', tr`카니만의 스킬 「헌책 날리기」가 생겼어요`],
    ['new', 'pile', tr`새 스킬 「헌책 더미」 — 지나간 자리에 책을 쌓아요. 적이 닿으면 와르르!`],
    ['new', 'a_chiikawa', tr`업적이 생겼어요! 동 · 은 · 금메달을 모아 보세요`],
    ['new', 'coin', tr`판이 끝나면 보상금을 받아요. 상점에서 캐릭터를 조금씩 세게 만들 수 있어요`],
    ['new', 'goblinKing', tr`보스를 1분 넘게 두면 화를 내요! 얼른 쓰러뜨려요`],
    ['new', 'cheer', tr`보스를 쓰러뜨리면 잠깐 쉬어 가요. 어떤 스킬이 얼마나 때렸는지도 보여 줘요`],
    ['new', 'zoom', tr`일시정지에서 화면을 크게 · 작게 볼 수 있어요`],
    ['fix', 'manju', tr`맞으면 잠깐 무적! 레벨 업 하면 체력이 조금 차요`],
    ['fix', 'battery', tr`한잎이 · 두잎이가 날아오는 공격 쪽으로 돌아서 막아요`],
    ['fix', 'goblin', tr`피해야 하는 바닥에는 빨간 점선과 ! 표시가 있어요`],
    ['fix', 'pudding', tr`체력이 적으면 화면 가장자리가 빨개져요(번쩍이지 않아요)`],
    ['fix', 'mermaid', tr`세이렌 · 아노코 · 인어 그림이 원작에 더 가까워졌어요`],
    ['fix', 'normal', tr`적이 아주 많아도 게임이 느려지지 않게 했어요`],
  ]],
  ['2026-11-13', [
    ['new', 'easy', tr`난이도 쉬움 · 보통 · 어려움이 생겼어요`],
    ['new', 'bgm', tr`새 배경음악! 캐릭터마다 다른 악기로 연주해요`],
    ['up', 'pajama', tr`파자마 파티즈 · 한잎이 두잎이가 더 세졌어요`],
    ['up', 'syn', tr`시너지 「랏코 선생의 수련」 · 「하치와레의 꿈」이 더 세졌어요`],
    ['fix', 'hard', tr`멀리서 쏘는 몬스터는 어려움에서만 나와요`],
    ['fix', 'parry', tr`날아오는 공격에 빨간 테두리가 생겨서 보석이랑 헷갈리지 않아요`],
    ['new', 'party', tr`그림 아이콘이 생겼어요 — 휴대폰에서도 컴퓨터에서도 똑같이 보여요`],
    ['fix', 'zoom', tr`휴대폰에서 화면이 겹치거나 커지지 않게 고쳤어요`],
    ['new', 'sfx', tr`게임을 고치려고 어떤 캐릭터로 몇 분 버텼는지 모아요(이름 같은 건 안 모아요)`],
  ]],
  ['2026-11-12', [
    ['new', 'party', tr`먼작귀 서바이버즈가 처음 나왔어요! 캐릭터 8명 · 스킬 14개 · 최종보스 세이렌`],
    ['new', 'snd', tr`소리가 생겼어요 — 배경음악 · 효과음 · 캐릭터 목소리`],
    ['new', 'pajama', tr`카니 · 아노코 · 도와주는 친구들이 생겼어요`],
    ['new', 'a_darkstar', tr`29분이 되면 검은 별똥별이 와요. 30분까지 도망치면 클리어!`],
    ['fix', 'a_dekatsuyo', tr`캐릭터 · 적 그림을 원작에 가깝게 여러 번 다시 그렸어요`],
  ]],
]
const TAG = { new: [tr`새로워요`, '#3fae5a'], up: [tr`세졌어요`, '#ff5b7f'], down: [tr`약해졌어요`, '#5b8fd5'], fix: [tr`바뀌었어요`, '#f0a030'] }
const PATCH_ID = `${PATCH[0][0]}#${PATCH[0][1].length}`
const mateOf = id => Object.keys(synOf(id)[1]).find(k => k !== id)
const synText = ([, u]) => Object.entries(u).map(([id, up]) => `${WEAP[id].name} ${Object.entries(up).map(([k, v]) => UP[k](v)).join(' · ')}`).join(' / ')

// 아이템(지니면 계속 듣는 것) — 레벨마다 note 만큼
const PASS = {
  license: { name: tr`토벌 자격증`, note: tr`공격력 +10%`, max: 5 },
  armor: { name: tr`갑옷씨의 갑옷`, note: tr`받는 피해 -1`, max: 5 },
  manju: { name: tr`군고구마`, note: tr`최대 체력 +20%`, max: 5 },
  pudding: { name: tr`푸딩`, note: tr`초당 체력 +0.2 회복`, max: 5 },
  clock: { name: tr`알람 시계`, note: tr`쿨타임 -8%`, max: 5 },
  mega: { name: tr`메가폰`, note: tr`범위 +10%`, max: 5 },
  slipper: { name: tr`잠옷 슬리퍼`, note: tr`이동 속도 +10%`, max: 5 },
  wind: { name: tr`모몽가의 날갯짓`, note: tr`투사체 속도 +10%`, max: 5 },
  bento: { name: tr`도시락`, note: tr`지속 시간 +10%`, max: 5 },
  double: { name: tr`둘이서 같이`, note: tr`투사체 스킬 +1`, max: 2 },
  pouch: { name: tr`큰 주머니`, note: tr`경험치 줍는 거리 +30%`, max: 5 },
  clover: { name: tr`네잎클로버`, note: tr`행운 +10% (잭팟 · 치명타 · 떨어지는 것)`, max: 5 },
  wage: { name: tr`토벌 보수`, note: tr`경험치 +8%`, max: 5 },
}
const ONI = () => G?.diff === 'easy' ? [0.4, 0.3] : [0.2, 0.2]   // 오니기리 회복 [레벨업 채움, 맵 줍기] — 쉬움은 그대로(아이 · 처음 하는 사람), 그 밖 20%(사용자 · 기획 2026-11-22)
const FILL = { onigiri: { name: tr`오니기리`, note: tr`체력 20% 회복(쉬움 40%)` }, cheer: { name: tr`응원`, note: tr`이번 판 공격력 +2% (최대 +50%, 무한 모드는 끝없이)` } }   // 더 올릴 게 없을 때
// 줍는 것 — 적이 떨어뜨린다(USE)
const ITEMS = {
  onigiri: { name: tr`오니기리`, note: tr`체력 20% 회복(쉬움 30%)` },
  magnet: { name: tr`자석`, note: tr`흩어진 경험치를 모두 끌어온다` },
  momonga: { name: tr`모몽가의 귀여운 척`, note: tr`모두가 넋을 잃어 6초 동안 적이 멈춘다` },
  firework: { name: tr`폭죽`, note: tr`화면 안의 적을 모두 쓰러뜨린다(보스는 큰 피해)` },
  earplug: { name: tr`귀마개`, note: tr`상태이상을 모두 푼다(걸린 게 없으면 체력 15%) — 10분부터` },
  pajama: { name: tr`꿀맛 페스티벌 티켓`, note: tr`파자마 파티즈가 10초 동안 넓게 돌며 공연 — 가까운 적에게 음표를 쏘고, 0.6초마다 음표 충격파로 밀쳐 낸다. 응원으로 쿨타임 -25%` },
  battery: { name: tr`건전지`, note: tr`한잎이 · 두잎이가 6초 동안 가장 가까운 날아오는 것(없으면 가까운 적) 쪽으로 돌아 서서 막고, 닿은 적을 세게 밀쳐 낸다` },
  chest: { name: tr`보물상자`, note: tr`보스가 떨어뜨린다 — 잭팟 확률 50%` },
  guard: { name: tr`냄비뚜껑 방패`, note: tr`무한 1단계부터 보스 · 세이렌이 떨어뜨린다 — 주울수록 적에게 닿아 받는 피해가 줄어든다(이번 판만)` },
  coinbox: { name: tr`떠돌이 보물상자`, note: tr`한자리에 머물지 않고 멀리 움직이면 반드시 나타난다(오른쪽 위 상자 표시가 다 차면 · 10초에 한 번까지 · 12초 뒤 사라진다) — 토벌 보상금 10 ~ 200(클수록 드물게), 0.2% 잭팟 5000, 0.3% 확률로 이번 판에서만 쓰는 부활석` },
  awaken: { name: tr`각성의 별`, note: tr`Lv 8 스킬이 있을 때 보스(중간보스 빼고)가 떨어뜨린다 — Lv 8 스킬 하나를 각성(조금 세지고 날아오는 것을 가끔 막는다)` },
}

// 떠돌이 보물상자 — 처음 자리(앵커)에서 d 만큼 멀어질 때마다 앵커를 옮기고 p 확률로 가는 쪽 앞에. 바닥에 하나만 · 앞 상자에서 gap 초 뒤부터 · life 초 뒤 사라진다
const WANDER = { d: 1500, gap: 10, life: 12 }   // 떠돌이 보물상자 — 앵커에서 1500 + 10초가 지나면 반드시(기획 2026-11-18: 확률이면 「표시가 다 찼는데 왜 안 나와?」), 12초 뒤 사라짐 · 바닥에 하나만. 판마다 약 90~180개라 LOOT 의 부활석 · 잭팟을 0.3 · 0.2% 로(가끔 그대로)
// 떠돌이 보물상자에서 나오는 것 — [토벌 보상금(또는 'stone' 부활석), 확률 %]. 합 100. 잭팟(LOOT_JACK) 말고는 200 을 넘지 않는다
const LOOT_JACK = 5000, LOOT = [['stone', 0.3], [LOOT_JACK, 0.2], [10, 31.5], [20, 21], [30, 15], [50, 11], [70, 8], [100, 6], [130, 3.5], [160, 2], [200, 1.5]]

// 토벌 대상 — r 몸 반지름 · hp(시간이 갈수록 세진다) · spd 이동 · dmg 닿으면 · xp 떨어뜨리는 경험치 · col 터질 때 색
const FOES = {
  goblin: { name: tr`고블린`, note: tr`가장 흔한 토벌 대상 — 줄지어 다가온다`, r: 12, hp: 9, spd: 62, dmg: 7, xp: 1, col: '#8fc46e' },
  chimera: { name: tr`꼬마 키메라`, note: tr`1분부터 — 하얀 날개 · 보랏빛 꼬리의 분홍 키메라. 울면서 다가온다 · 빠르고, 가끔 떼로 둘러싼다`, r: 10, hp: 5, spd: 95, dmg: 5, xp: 1, col: '#f9cdd6' },
  dekatsu: { name: tr`분홍 키메라`, note: tr`4분부터 — 네 발로 걷는 어른 키메라. 느리지만 단단하고 아프다 · 밀리지 않는다`, r: 18, hp: 52, spd: 47, dmg: 10, xp: 3, col: '#efb3c8' },
  spiker: { name: tr`가면 키메라`, note: tr`6분부터(어려움만) — 곤충 날개 · 기괴한 가면. 멀리서 독침을 쏜다`, r: 12, hp: 18, spd: 57, dmg: 7, xp: 2, col: '#8d9a77', shot: { k: 'spike', spd: 210, cd: 2.6, range: 330, r: 5 } },
  golden: { name: tr`황금 고블린`, note: tr`가끔 나오는 정예 — 쓰러뜨리면 가끔 아이템`, r: 22, hp: 420, spd: 55, dmg: 16, xp: 25, col: '#ffd34d' },
  bug: { name: tr`초록 벌레`, note: tr`처음부터 — 초록 털모자를 쓴 벌레. 입을 동그랗게 벌리고 걸어온다 · 약하고 느리다`, r: 10, hp: 7, spd: 55, dmg: 6, xp: 1, col: '#c3e6a4' },
  beetle: { name: tr`꼬마 풍뎅이`, note: tr`3분부터 — 밤색 탈을 쓴 것 같은 풍뎅이(머리 위 뿔). 단단해서 밀리지 않는다`, r: 13, hp: 30, spd: 58, dmg: 9, xp: 2, col: '#a47b63' },
  star: { name: tr`별똥별`, note: tr`5분부터 — 셋이 같이 다닌다. 맞으면 「흐아아악!」`, r: 10, hp: 12, spd: 90, dmg: 7, xp: 1, col: '#ffe066' },
  fugu: { name: tr`복어`, note: tr`8분부터(어려움만) — 기름 그물을 뿌린다(맞으면 잠깐 느려진다) · 「블링블링 마블링」`, r: 14, hp: 30, spd: 45, dmg: 8, xp: 2, col: '#f6dc98', shot: { k: 'net', spd: 170, cd: 3.2, range: 300, r: 9, slow: 1.6 } },
  octo: { name: tr`문어 괴물`, note: tr`12분부터(어려움만) — 간장을 뱉는다`, r: 15, hp: 45, spd: 50, dmg: 10, xp: 3, col: '#f29a9a', shot: { k: 'soy', spd: 220, cd: 2.6, range: 320, r: 6 } },
  parttimer: { name: tr`아르바이트생 괴물`, note: tr`14분부터 — 카페 앞치마를 두른 분홍 코끼리 같은 괴물(뿔 여럿 · 점 눈 다섯). 아주 단단하다`, r: 20, hp: 160, spd: 42, dmg: 14, xp: 6, col: '#e9bcc8' },
  rusher: { name: tr`고블린 돌격대`, note: tr`10분부터 — 줄지어 화면을 가로지른다. 스킬에 안 맞으니 빈 줄로 피하기`, r: 11, hp: 14, spd: 0, dmg: 14, xp: 1, col: '#c9e29a' },
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
  dekatsuyo: { name: tr`데카츠요`, line: tr`쿵… 쿵…!`, note: tr`「뭔가 크고 강한 녀석」 — 멈칫(갈 길이 붉게)한 뒤 그 방향으로 돌진. 옆으로 피하기` },
  goblinKing: { name: tr`고블린 대장`, line: tr`쳐라, 쳐!`, note: tr`돌을 부채꼴로 던지고 부하를 불러 에워싼다 · 약화를 건다`, st: 'weak', stCd: 30 },
  bigChimera: { name: tr`거대 키메라`, line: tr`헤헤… 흑…`, note: tr`웃으면서 우는 거대한 키메라 — 뛰어올라 내 자리에 내려찍는다. 붉은 원에서 벗어나기` },
  rps: { name: tr`가위바위보`, line: tr`가위바위보로 무얼 만들까~♪`, note: tr`「바위!」 쇠공 팔로 내 자리를 내려찍고(회색 원) · 「가위!」 바퀴 발로 돌진 · 「보!」 종이를 사방으로 뿌린다` },
  chef: { name: tr`요리사 괴물`, line: tr`잘 먹겠습니다람쥐!`, note: tr`후추를 흩뿌리고(작은 원 여럿) · 토르티야로 돌돌 말고(큰 노란 원 — 밖으로 피하기) · 돌진한다` },
  anoko: { name: tr`아노코`, line: '…!!', note: tr`「커다란 토벌」의 대상 — 돌진하고 · 용 같은 꼬리로 둘레를 휩쓸고(청록 원) · 꼬깔콘 같은 주황 발톱을 던진다` },
  mermaid: { name: tr`인어`, line: tr`라~♪`, note: tr`세이렌의 코러스 — 곁을 돌다가 날카로운 이빨로 달려들어 문다. 살아 있는 동안 세이렌은 받는 피해 -50%` },
  siren: { name: tr`세이렌`, line: tr`내 노래를 들어 봐…`, note: tr`노래(매혹)로 끌어당기고 · 음표를 사방으로 · 땅에서 덩굴 · 큰 꼬리로 내려치기. 체력이 절반 아래면 눈이 붉어지고 더 빨라진다`, st: 'charm', stCd: 14 },
}
const BOSS_HP = 1.5   // 보스 · 중간보스 체력 배수(세이렌 · 인어는 그대로) — 어려움 · 무한은 ×1.5 더(2.25 · 사용자 · 기획 2026-11-22)
const HARD_HP = { anoko: 4, siren: 10 }   // 아노코 6 → 4: 보스 ×1.5(어려움 · 무한)와 곱해 예전과 같은 9배(기획 2026-11-22 — 이틀 전 따로 올렸으니 더 얹지 않는다) · 어려움 · 무한 0단계(25분까지 어려움과 같은 진행)의 후반 보스 체력 배수 — 센 판 기준 아노코 약 50초(60초 「화남」 전) · 세이렌 약 90초(기획 2026-11-18). 무한 1단계부터는 단계 보정이 따로 있어 곱하지 않는다
const RAGE_T = 60   // 보스 · 중간보스가 이만큼(초) 살아 있으면 화낸다 — 빨라지고(×1.5) 기술 간격 60% · 몸통 피해 ×1.4
// 보스가 나오는 때 — [초, 종류, 중간보스면 1]. FINAL_T 에 세이렌 + 인어 셋(finale)
// 무한 — 세이렌을 쓰러뜨리면 단계(lv)가 오른다. 단계마다 강해진 보스가 lv+1 마리씩 INF.gap 초마다(종류는 섞어서 BOSS 여섯이 다 나올 때까지), 다 쓰러뜨리면 세이렌 lv+1 명(인어 셋씩). INF.dark 초 안에 못 쓰러뜨리면 검은 별똥별
const INF = { gap: 60, rest: 12, dark: 180, foe: 0.2, kinds: ['dekatsuyo', 'goblinKing', 'bigChimera', 'rps', 'chef', 'anoko'], hp: 0.6, dmg: 0.25, spd: 0.04, anoko: 2 }   // dark — 진행 시계(세이렌이 나오거나 페이즈를 넘긴 뒤 이만큼 못 넘기면 검은 별똥별). anoko — 무한 아노코 체력 배수, parry — 각성 스킬로 막는 확률 배수(무한 1단계부터). hp · dmg · spd — 단계마다 보스가 그만큼씩 세진다(1 + 값 × 단계, 선형). foe — 일반 적 체력도 단계마다(보스의 1/3)
// 무한 세이렌(1단계부터) — 한 명 한 명이 3페이즈. hp · dmg 는 단계 보정한 체력 · 기술 피해에 곱한다. col — 페이즈 색(HUD 점 · 링 · 외침)
const SIREN_PH = [{ hp: 1.5, dmg: 1, col: '#ff8fb1' }, { hp: 1.5, dmg: 1.2, col: '#a94fd0', line: tr`…용서 못 해!`, name: tr`화난 세이렌!` }, { hp: 2, dmg: 1.4, col: '#3f68b3', line: tr`바다여, 나에게 힘을!`, name: tr`폭풍의 세이렌!` }]
const PLAN = [[300, 'dekatsuyo'], [450, 'goblinKing', 1], [600, 'goblinKing'], [720, 'rps', 1], [840, 'bigChimera'], [960, 'rps'], [1080, 'chef', 1], [1200, 'anoko'],
  [1320, 'chef'], [1410, 'bigChimera', 1]]   // 20~25분은 보스 셋(예전 넷 — 24분 중간보스 데카츠요는 뺐다)
// 영구 강화(처음 화면 「상점」) — 판마다 받는 토벌 보상금으로 산다. 한 칸이 같은 아이템 한 레벨의 1/5쯤, 다 사도 아이템 한 레벨 몫이라 판의 밸런스가 무너지지 않는다
//   id = 같은 일을 하는 아이템(아이콘) · per = 한 칸 · max = 칸 수 · cost = 첫 칸 값(n 번째 칸은 cost × n)
//   ⚠ max 를 늘리거나 새 강화를 넣을 때는 supabase/account.sql 의 save_bad(서버 칸 수 검사 — 넘으면 바로 정지 · IP 차단)를 먼저 올려 Run 하고, game.js 는 그다음에 올린다. 거꾸로 하면 정직한 사람이 모두 정지된다(기획)
const SHOP = {
  manju: { name: tr`체력`, lab: tr`최대 체력`, per: 0.04, max: 5, cost: 40 },
  license: { name: tr`힘`, lab: tr`주는 피해`, per: 0.03, max: 5, cost: 50 },
  pudding: { name: tr`회복`, lab: tr`1초에 체력`, per: 0.04, max: 5, cost: 40, val: v => `+${+v.toFixed(2)}` },
  slipper: { name: tr`발걸음`, lab: tr`이동 속도`, per: 0.02, max: 5, cost: 30 },
  wage: { name: tr`경험치`, lab: tr`경험치`, per: 0.03, max: 5, cost: 40 },
  pouch: { name: tr`줍기`, lab: tr`줍는 거리`, per: 0.06, max: 5, cost: 25 },
  clover: { name: tr`행운`, lab: tr`행운`, per: 0.03, max: 5, cost: 30 },
  armor: { name: tr`단단함`, lab: tr`받는 피해`, per: 1, max: 1, cost: 400, val: v => `-${v}` },
}
for (const u of Object.values(SHOP)) u.val ||= v => `+${Math.round(v * 100)}%`   // 보여 주는 값 — 따로 없으면 %
const perm = id => SIM ? (SIM.max ? SHOP[id].per * SHOP[id].max : 0) : SHOP[id].per * (save.up[id] || 0) + (BONUS_ORDER.includes(id) ? coll(id) : 0)   // 모의 토벌은 기준 조건(강화 · 보유 효과 없이 — 무한은 상점 강화 최대 · 보유 효과 없이 · 기획)   // 상점 강화 + 의상 보유 효과(판 중에만 불린다 — 의상 표는 아래에)
// 업적 — 동 · 은 · 금. 쉬운 것은 횟수를 많이, 어려운 것은 적게. 금메달 하나마다 토벌 보상금 +1%. ico = 메달 가운데 그림(아이콘 id, a_ 는 캐릭터 그림)
const ACH = {
  runs: { name: tr`토벌 대원`, note: tr`토벌에 나간 판`, ico: 'sasu', tiers: [10, 50, 200] },
  goblin: { name: tr`고블린 퇴치`, note: tr`쓰러뜨린 고블린(돌격대 · 황금 고블린 포함)`, ico: 'a_goblin', tiers: [2000, 20000, 100000] },
  pajama: { name: tr`파자마 파티즈 팬클럽`, note: tr`꿀맛 페스티벌 공연을 본 횟수`, ico: 'pajama', tiers: [10, 50, 200] },
  lv8: { name: tr`토벌 달인`, note: tr`판이 끝날 때 Lv 8 이던 스킬(판마다 더한다)`, ico: 'license', tiers: [10, 60, 250] },
  aw: { name: tr`각성한 토벌대`, note: tr`각성시킨 스킬(판마다 더한다)`, ico: 'awaken', tiers: [5, 30, 100] },
  awdex: { name: tr`각성 도감`, note: tr`각성해 본 스킬(종류 — 모두 ${Object.keys(WEAP).length})`, ico: 'book', tiers: [3, 8, Object.keys(WEAP).length] },
  parry: { name: tr`다 막아 냈다`, note: tr`각성 스킬로 막은 날아오는 것`, ico: 'parry', tiers: [50, 500, 3000] },
  coin: { name: tr`부자 토벌대`, note: tr`번 토벌 보상금`, ico: 'coin', tiers: [1000, 10000, 50000] },
  jackpot: { name: tr`복권 당첨`, note: tr`터진 잭팟`, ico: 'clover', tiers: [5, 25, 100] },
  boss: { name: tr`커다란 토벌`, note: tr`쓰러뜨린 보스(세이렌 포함 · 중간보스 빼고)`, ico: 'a_dekatsuyo', tiers: [10, 50, 150] },
  friends: { name: tr`모두 함께`, note: tr`클리어해 본 캐릭터(종류)`, ico: 'a_chiikawa', tiers: [2, 5, 8] },
  clear: { name: tr`세이렌 토벌`, note: tr`세이렌을 쓰러뜨린 판`, ico: 'a_siren', tiers: [1, 3, 10] },
  survive: { name: tr`끝까지 도망`, note: tr`검은 별똥별에게서 30분 생존한 판`, ico: 'a_darkstar', tiers: [1, 3, 10] },
  hard: { name: tr`진짜 토벌`, note: tr`어려움으로 클리어한 판`, ico: 'hard', tiers: [1, 3, 7] },
  nohit: { name: tr`스치지도 않았다`, note: tr`처음 5분을 한 번도 안 맞고 버틴 판`, ico: 'armor', tiers: [1, 3, 10] },
  storm: { name: tr`눈보라를 이겨 냈다`, note: tr`겨울 맵에서 버텨 낸 눈보라`, ico: 'wind', tiers: [5, 30, 150] },
  winter: { name: tr`겨울 토벌`, note: tr`겨울 맵에서 어려움으로 클리어한 판 — 처음이면 불꽃 옷`, ico: 'snow', tiers: [1, 3, 7] },
}
const TIER = ['', tr`동메달`, tr`은메달`, tr`금메달`]
const achVal = id => id === 'runs' ? save.runs : id === 'awdex' ? (save.awSeen || []).length : id === 'friends' ? new Set(Object.entries(save.best).filter(([, b]) => b.clears).map(([k]) => k.split('.')[0])).size : save.ach[id] || 0
const tierOf = id => ACH[id].tiers.filter(n => achVal(id) >= n).length
const golds = () => Object.keys(ACH).filter(id => tierOf(id) === 3).length
const STATUS = {
  weak: { name: tr`약화`, note: tr`주는 피해 -40%`, col: '#ff9f43' },
  charm: { name: tr`매혹`, note: tr`이동 속도 -40% · 세이렌 쪽으로 끌려간다`, col: '#ff6fd0' },
}
const ST_T = 8   // 상태이상 지속(초)
// 난이도 — 어려움이 원래 토벌(배수 1). 쉬움 · 보통은 적 체력 ↓ · 경험치 ↑ · 줍는 것 ↑ · 멀리서 쏘는 일반 몬스터가 안 나온다(보스는 쏜다)
const DIFF = {
  easy: { name: tr`쉬움`, hp: 0.6, xp: 1.5, drop: 2, shot: false, coin: 1, dmg: 0.6, revive: 3 },
  normal: { name: tr`보통`, hp: 0.8, xp: 1.25, drop: 1.5, shot: false, coin: 1.25, dmg: 0.8, revive: 2 },
  hard: { name: tr`어려움`, hp: 1, xp: 1, drop: 1, shot: true, coin: 1.5, dmg: 1, revive: 1 },   // coin = 토벌 보상금 배수 · dmg = 받는 피해 배수 · revive = 한 판에 부활석을 쓸 수 있는 횟수
  inf: { name: tr`무한`, hp: 1.5, xp: 1, drop: 1, shot: true, coin: 2, dmg: 1.5, revive: 1, inf: true },   // 무한 — 어려움보다 적 체력 · 받는 피해 1.5배. 25분까지는 어려움과 같은 진행, 세이렌 뒤로 끝없이(INF)
}
{ const E = DIFF.easy, pc = v => `${v > 0 ? '+' : ''}${Math.round(v * 100)}%`   // 설명은 쉬움 기준 — 배수를 바꾸면 글도 따라 바뀐다
  for (const d of Object.values(DIFF)) d.note = (d === E ? tr`기준 난이도 — 처음이라면 여기서` : tr`쉬움보다 적 체력 ${pc(d.hp / E.hp - 1)} · 경험치 ${pc(d.xp / E.xp - 1)} · 줍는 것 ${pc(d.drop / E.drop - 1)} · 받는 피해 ${pc(d.dmg / E.dmg - 1)} · 보상금 ${pc(d.coin / E.coin - 1)}`) + (d.shot ? tr` · 멀리서 쏘는 몬스터도 나온다` : tr` · 멀리서 쏘는 몬스터 없음`) }
  DIFF.inf.note = tr`어려움보다 적 1.5배 · 보상금 2배 — 세이렌을 쓰러뜨려도 더 센 단계가 계속돼요`
const bestKey = (id, d) => d === 'hard' ? id : `${id}.${d}`   // 어려움 기록은 예전 기록 그대로

// ---------------------------------------------------------------- 저장 — 이 브라우저(localStorage)에만
const LS = 'mjg.v1'
const save = { runs: 0, kills: 0, clears: 0, best: {} }   // best[캐릭터] = { t 가장 오래 버틴 초, kills, lvl, clears }
// 저장 지키기 — 진짜 주소에서만(SECURE, 로컬 점검은 ?secure 로 켠다). 값진 칸(보상금 · 산 것 · 기록 …)에 서명(_s)을 붙여 저장하고 바로 전 저장도 따로 둔다(.bak).
//   개발자 도구로 저장을 고치면 서명이 안 맞는다 → 바로 전 저장으로 되돌린다. 둘 다 고쳤으면 기록을 처음부터(설정만 남긴다).
//   ※ 브라우저 게임이라 완벽히 막을 수는 없다 — 손쉬운 고치기를 막는 정도(서명 방법도 이 파일에 있다)
const SECURE = location.hostname === 'chii-ka-wa.github.io' || /[?&]secure\b/.test(location.search)
const FREE = new Set(['lang', 'theme', 'noStats', 'seen', 'diff', 'wear', 'skin', 'devCoin', '_s'])   // 고쳐도 상관없는 칸 — 설정 · 고른 것(입은 것은 가졌는지 따로 본다)
const canon = v => v && typeof v === 'object' ? Array.isArray(v) ? `[${v.map(canon)}]` : `{${Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k]))}}` : JSON.stringify(v ?? null)
const sign = o => { const t = canon(Object.fromEntries(Object.entries(o).filter(([k]) => !FREE.has(k)))) + '|mjg·7Q2'; let a = 0x811c9dc5, b = t.length ^ 0x5bd1e995; for (let i = 0; i < t.length; i++) { const c = t.charCodeAt(i); a = Math.imul(a ^ c, 0x01000193); b = Math.imul(b ^ c, 0x5bd1e995); b ^= b >>> 13 } return (a >>> 0).toString(36) + (b >>> 0).toString(36) }
const TAMPER = (() => {
  const read = k => { try { return JSON.parse(localStorage.getItem(k)) } catch { return null } }, ok = o => o && o._s === sign(o), prefs = o => Object.fromEntries(Object.entries(o || {}).filter(([k]) => FREE.has(k) && k !== '_s'))
  const cur = read(LS) || {}
  if (!SECURE || ok(cur) || (!cur._s && !localStorage.getItem('mjg.k'))) { Object.assign(save, cur); return '' }   // 맞거나 · 서명 전 예전 저장(처음 한 번)
  const bak = read(LS + '.bak')
  if (ok(bak)) { Object.assign(save, bak, prefs(cur)); return 'bak' }   // 바로 전 저장으로
  Object.assign(save, prefs(cur)); return 'reset'   // 둘 다 고쳤다 — 처음부터
})()
if (!DIFF[save.diff]) save.diff = 'normal'
save.up ||= {}; save.coin = Math.max(0, save.coin | 0); save.stone = Math.max(0, save.stone | 0)   // 영구 강화 칸 수 · 모은 토벌 보상금 · 가진 부활석
const STONE = 1000   // 부활석 값(상점) — 쓰러졌을 때 하나 써서 다시 일어난다(판마다 DIFF.revive 번까지)
save.ach ||= { clear: save.clears || 0 }
save.owned ||= []; save.wear ||= {}; save.skin ||= {}; save.wwin ||= []; save.wlv ||= {}; for (const c of save.wwin) save.wlv[c] = Math.max(save.wlv[c] || 0, 2)   // wwin — 겨울 맵을 보통 이상으로 클리어한 캐릭터(겨울 무기 스킨)   // 의상 · 무기 스킨(wear['w:캐릭터']) — 산 것 · 입은 것, 스킬 스킨 — 켠 것   // 업적 누적(처음이면 예전 클리어를 세이렌 토벌로)
save.theme ||= 'winter'; const fieldSong = () => save.theme === 'winter' ? 'winter' : 'field'   // 처음 화면 · 토벌 배경음 — 겨울이면 겨울 곡
const pageColor = () => { const c = save.theme === 'winter' ? '#e6eff8' : '#cdeaa8'; document.documentElement.style.setProperty('--page', c); document.querySelector('meta[name=theme-color]')?.setAttribute('content', c) }   // 화면 밖 바탕 · 휴대폰 주소창 색 — 바닥 색(겨울 눈밭 · 풀밭)
pageColor()   // 테마 — winter(눈밭 · 내리는 눈 · 적은 크리스마스 의상, 기본) · grass(예전 풀밭)
let auth = (() => { try { return JSON.parse(localStorage.getItem('mjg.auth')) } catch { return null } })(), linked = false   // 로그인(아래 「계정」) — linked: 계정 저장과 맞춘 뒤에만 올린다
const persist = () => { try { if (SECURE) { save._s = sign(save); localStorage.setItem('mjg.k', '1') } const j = JSON.stringify(save); localStorage.setItem(LS, j); if (SECURE) localStorage.setItem(LS + '.bak', j) } catch {} cloudPush() }   // 진짜 주소면 서명 · 바로 전 저장도
if (TAMPER) persist()   // 되돌린 것을 바로 저장
if (SECURE) {   // 개발자 도구 단축키 · 오른쪽 클릭 메뉴 막기(메뉴로 여는 것까지는 못 막는다) · 콘솔 경고
  addEventListener('keydown', e => { const m = e.ctrlKey || e.metaKey; if (e.key === 'F12' || (m && (e.shiftKey || e.altKey) && ['KeyI', 'KeyJ', 'KeyC', 'KeyK'].includes(e.code)) || (m && e.code === 'KeyU')) { e.preventDefault(); e.stopImmediatePropagation() } }, true)
  addEventListener('contextmenu', e => { if (!e.target.closest?.('a, input, textarea')) e.preventDefault() })
  console.log('%c잠깐만요!', 'font-size:26px;font-weight:bold;color:#e8475f', '\n여기에 무언가를 붙여 넣으라는 말은 속임수일 수 있어요. 기록을 고치면 바로 전 저장으로 되돌아가요.\nAnyone asking you to paste something here may be tricking you. Edited saves are rolled back.')
  setInterval(() => Function('debugger')(), 1500)   // 개발자 도구를 메뉴로 열어도 여기서 계속 멈춘다(닫혀 있으면 아무 일 없다) — 막기만 하고 판에 표시는 안 한다(호기심에 연 아이 · 부모)
}
// ---------------------------------------------------------------- 부정 플레이 살피기 — 진짜 주소에서만(SECURE, 점검은 ?guard)
//   봉인(체크섬): 프레임마다 step 을 다 돌린 뒤 중요한 값(체력 · 무적 시간 · 능력치 · 시간 · 처치 · 레벨 · 경험치 · 스킬 · 아이템 · 응원 · 보스 · 단계 · 주운 보상금)을 해시해 두고(guardOut)
//   다음 프레임 step 전에 다시 잰다(guardIn) — 그 사이에(콘솔 · 개발자 도구 · 메모리 고치기 · 일시정지 · 상자 화면 동안) 바뀌었으면 이 판에 표시(G.bad).
//   step 밖에서 값을 바꾸는 곳(상자 고르기 take · 다음 상자 next · 부활 revive)은 바꾸기 전에 재 보고 바꾼 뒤 다시 봉인한다
//   배속: 어려움을 클리어하지 않았는데 3배속이면 표시
//   표시된 판은 랭킹에 안 올리고(결과 화면에 한 줄 — 이유는 안 쓴다) 처음 걸린 때 서버에 한 번 알린다(report_cheat — IP 는 서버가 해시로만). 게임은 그대로 한다
const GUARD = SECURE || /[?&]guard\b/.test(location.search)
const h32 = t => { let a = 0x811c9dc5; for (let i = 0; i < t.length; i++) a = Math.imul(a ^ t.charCodeAt(i), 0x01000193); return a >>> 0 }
const sealOf = () => h32([pl.hp, pl.inv, G.t, G.kills, G.lvl, G.xp, G.cheer, G.bosses, G.found, G.loop.lv, G.guardN || 0, G.weapons.map(w => w.id + w.lv), Object.entries(G.passives), Object.values(S)].join())
const spdMax = inf => inf ? 2 : (save.ach.hard || 0) > 0 ? 3 : 2   // 3배속은 어려움을 클리어한 사람만 · 무한은 2배속까지(사용자 2026-11-20 — 모의 토벌 관전 3배속과는 따로)
function foul(why) {
  if (SIM) return
  if (!GUARD || !G || G.bad?.includes(why)) return
  (G.bad ||= []).push(why)
  if (G.bad.length === 1 && auth && location.hostname === STATS.host) rpc('report_cheat', { reason: why, detail: { ch: G.ch.id, diff: G.diff, t: Math.round(G.t), v: PATCH_ID } })
}
const guardIn = () => { if (GUARD && G && !SIM) { if (G.seal != null && G.seal !== sealOf()) foul('seal'); if (spd > spdMax(G.inf)) foul('spd') } }
const guardOut = () => { if (GUARD && G && !SIM) G.seal = sealOf() }
// ---------------------------------------------------------------- 익명 플레이 통계 — 한 판이 끝나면 Supabase(runs 표)에 한 줄
//   캐릭터 · 난이도 · 결과 · 버틴 시간 · 레벨 · 처치 · 쓰러뜨린 것 · 그때의 보스 · 스킬 · 휴대폰 여부 · 버전. 이름 · 기기 정보 같은 개인을 알 수 있는 것은 보내지 않는다
//   끄기: 처음 화면 아래 「통계 보내지 않기」(save.noStats) · 브라우저의 추적 거부(GPC · DNT)도 따른다. 이 사이트 주소에서만 보낸다(로컬 · 복사본은 안 보냄). 표 만들기는 supabase/schema.sql
const STATS = { url: 'https://lvxkcaorsdicichwtcgd.supabase.co', key: 'sb_publishable_7VKkPWLzbF2043yTZ1iYRQ_Xd2lPgSD', host: 'chii-ka-wa.github.io' }   // 공개 키(publishable) — report_run 함수(검사 · 횟수 제한 · 시각은 서버)만 부를 수 있다. 표는 못 만진다. url 을 비우면 안 보낸다. secret 키는 절대 넣지 말 것
const statsOn = () => !!STATS.url && !save.noStats && location.hostname === STATS.host && !navigator.globalPrivacyControl && navigator.doNotTrack !== '1'
// ---------------------------------------------------------------- 계정 — 카카오 · 구글 로그인(Supabase Auth). 표 · 함수는 supabase/account.sql
//   로그인 → Supabase 가 카카오 · 구글을 거쳐 이 주소#access_token=… 으로 돌려보낸다. 토큰은 localStorage 'mjg.auth'
//   로그인하면 저장(save 통째)을 계정에도 두고(saves 표), 무한 모드 기록을 랭킹(ranks)에 올린다 — 닉네임은 게임 안에서 정한다
//   기기마다 「마지막으로 계정과 맞춘 때 · 그때 저장의 서명」(mjg.sync)을 둔다 → 다른 기기에서 바뀌었는지 · 이 기기에서 바뀌었는지 안다
const authSet = a => { auth = a; try { a ? localStorage.setItem('mjg.auth', JSON.stringify(a)) : localStorage.removeItem('mjg.auth') } catch {} }
const jwt = t => { try { return JSON.parse(decodeURIComponent(escape(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))))) } catch { return {} } }
const fromToken = (at, rt, ttl) => { const p = jwt(at); return { at, rt, exp: Date.now() / 1000 + +ttl, uid: p.sub, prov: p.app_metadata?.provider } }
const syncMark = at => { try { localStorage.setItem('mjg.sync', JSON.stringify({ at, h: sign(save) })) } catch {} }
let AUTH_ERR = '', AUTH_NEW = false, NICK = null, MODAL = null, SUSP = 0   // 로그인 실패 글 · 방금 로그인 · 내 닉네임({ nick, next }) · 떠 있는 창 닫기 · 정지된 계정 번호(bans.id)
{ const q = new URLSearchParams(location.hash.slice(1)), qs = new URLSearchParams(location.search), err = q.get('error_description') || qs.get('error_description')   // 로그인에서 돌아왔다
  if (q.get('access_token')) { authSet(fromToken(q.get('access_token'), q.get('refresh_token'), q.get('expires_in') || 3600)); AUTH_NEW = true }
  if (err) AUTH_ERR = err.slice(0, 120)
  if (q.get('access_token') || err) { for (const k of ['error', 'error_code', 'error_description']) qs.delete(k); history.replaceState(null, '', location.pathname + (qs.size ? '?' + qs : '')) }   // 주소의 토큰 · 오류는 지운다
}
const login = prov => { busy(prov === 'kakao' ? tr`카카오 로그인 화면으로 가는 중이에요` : tr`Google 로그인 화면으로 가는 중이에요`, { prov, going: true, retry: () => login(prov) }); location.href = `${STATS.url}/auth/v1/authorize?provider=${prov}&redirect_to=${encodeURIComponent(location.origin + location.pathname)}` }
/** Google 공식 단추(Google Identity Services) — 리디렉트는 Supabase 를 거쳐서 구글 화면에 「lvx….supabase.co(으)로 이동」이 떠 수상해 보인다. 단추 팝업은 이 사이트 주소로 보인다
 *  받은 ID 토큰을 Supabase 에 넘기면(grant_type=id_token) 같은 계정(구글 사용자 번호가 같다)으로 들어온다. nonce — 구글에는 해시, Supabase 에는 원래 값(다시 쓰기 막기)
 *  진짜 주소(또는 ?gis)에서만 — 다른 곳은 Google 콘솔의 승인된 출처가 아니다. 스크립트를 못 불러오면 예전 모양 단추 — 누르면 다시 불러 본다(리디렉트는 쓰지 않는다:
 *  구글 브랜드 인증(앱 이름 표시)은 승인된 도메인을 모두 소유 확인해야 해서 supabase.co 를 뺐다) */
const GOOGLE_ID = '259801945128-0dak7f309us5924j1e857sn29b9e1kbk.apps.googleusercontent.com'   // 공개 값(OAuth 클라이언트 ID — 비밀번호 아님)
const gisOn = () => location.hostname === STATS.host || /[?&]gis\b/.test(location.search)
let gisP = null
const gisLoad = () => gisP ||= new Promise((ok, no) => { if (window.google?.accounts?.id) return ok(); const s = document.createElement('script'); s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = ok; s.onerror = no; document.head.append(s); setTimeout(no, 6000) }).catch(e => { gisP = null; throw e })
const hex = b => [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('')
async function gisButton(el) {   // 그렸으면 true
  try {
    await gisLoad(); if (!el.isConnected) return
    const raw = hex(crypto.getRandomValues(new Uint8Array(16)).buffer), hashed = hex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw)))
    google.accounts.id.initialize({ client_id: GOOGLE_ID, nonce: hashed, callback: r => gisDone(r.credential, raw) })
    const w = Math.min(320, el.clientWidth || 280); el.replaceChildren(); google.accounts.id.renderButton(el, { theme: 'outline', size: 'large', shape: 'pill', text: 'continue_with', logo_alignment: 'left', width: w, locale: LANG })   // 로고 왼쪽 — 카카오 심볼 자리와 맞춘다
    return true
  } catch { return false }
}
async function gisDone(idt, nonce) {   // 구글 팝업에서 골랐다 — 토큰을 Supabase 세션으로 바꾸고 계정 기록을 맞춘다(「로그인 중이에요」를 띄운 채로)
  MODAL?.(); const done = busy(tr`내 기록을 불러오는 중이에요`, { prov: 'google' })
  try {
    const r = await fetch(`${STATS.url}/auth/v1/token?grant_type=id_token`, { method: 'POST', headers: { apikey: STATS.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'google', id_token: idt, nonce }) }).catch(() => null)
    const j = r?.ok ? await r.json().catch(() => null) : null
    if (!j?.access_token) { AUTH_ERR = 'google'; if (mode === 'title') title(); return }
    authSet(fromToken(j.access_token, j.refresh_token, j.expires_in)); AUTH_ERR = ''; AUTH_NEW = true; SUSP = 0
    await link(); if (mode === 'title') title()
  } finally { done() }
}
/** 로그인 중 — 카카오 · Google 로 넘어가는 동안(going) · 돌아와서 내 기록을 불러오는 동안(아무 반응이 없으면 되는지 몰라서). 세 친구가 오른쪽으로 걷고(점선 길이 흐른다) 차례로 통통
 *  바깥을 눌러도 안 닫힌다. 가는 중이면 8초 뒤 「그만두기」, 20초면 「로그인이 늦어지고 있어요」 + 닫기 · 다시 해 보기(저절로 닫지 않는다 — 말없이 닫히면 더 헷갈린다)
 *  뒤로 가기로 돌아오면(카카오 · Google 화면에서 취소 — 브라우저가 페이지를 그대로 되살린다) 닫는다 */
let BUSY = null
function busy(sub, { prov, going, retry } = {}) {
  BUSY?.()
  const pts = ['chiikawa', 'hachiware', 'usagi'].map(id => portrait(id)), head = h('p', { class: 'h' }, tr`로그인 중이에요`, h('span', { class: 'dots', 'aria-hidden': 'true' }, h('i', {}, '.'), h('i', {}, '.'), h('i', {}, '.'))), foot = h('div', {})
  const box = h('div', { class: 'busy', role: 'status', 'aria-live': 'polite' }, h('div', { class: 'panel' }, h('div', { class: 'friends' }, pts), h('div', { class: 'road' }), head,
    h('p', { class: 'sub' }, prov && svgIc(prov === 'kakao' ? KAKAO_IC : GOOGLE_IC, prov === 'kakao' ? 'brand kk' : 'brand'), sub), foot))
  const stop = () => { window.stop(); close() }
  let f = 0; const walk = setInterval(() => { f++; pts.forEach((c, i) => { if (!c._walk?.length) return; const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.drawImage(c._walk[(f + i) % c._walk.length], 0, 0) }) }, 140)
  const t8 = going && setTimeout(() => foot.replaceChildren(h('p', { class: 'fine' }, h('button', { type: 'button', class: 'linkish', onclick: stop }, tr`그만두기`))), 8000)
  const t20 = setTimeout(() => { head.replaceChildren(tr`로그인이 늦어지고 있어요`); foot.replaceChildren(h('div', { class: 'row' }, btn(tr`닫기`, stop), btn(tr`다시 해 보기`, () => retry?.(), 'main'))) }, 20000)
  const close = () => { clearInterval(walk); clearTimeout(t8); clearTimeout(t20); box.remove(); if (BUSY === close) BUSY = null }
  document.body.append(box); BUSY = close; return close
}
addEventListener('pageshow', e => { if (e.persisted) BUSY?.() })
function logout() {
  if (auth) fetch(`${STATS.url}/auth/v1/logout`, { method: 'POST', headers: { apikey: STATS.key, Authorization: `Bearer ${auth.at}` } }).catch(() => {})
  clearTimeout(cloudPush.t); cloudPush.t = 0; authSet(null); linked = false; NICK = null; try { localStorage.removeItem('mjg.sync') } catch {} title()
}
async function token() {   // 쓸 수 있는 토큰(1분 안에 끝나면 새로 받는다 — 동시에 여러 번 불러도 한 번만)
  if (!auth) return null
  if (auth.exp - 60 > Date.now() / 1000) return auth.at
  token.p ||= fetch(`${STATS.url}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', headers: { apikey: STATS.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: auth.rt }) })
    .then(async r => { if (r.ok) { const j = await r.json(); authSet(fromToken(j.access_token, j.refresh_token, j.expires_in)) } else if (r.status < 500) authSet(null) })   // 만료 · 취소 — 로그아웃
    .catch(() => {}).finally(() => { token.p = null })
  await token.p; return auth?.at ?? null
}
async function api(path, body, head = {}) {   // Supabase REST — 로그인했으면 그 토큰으로. 실패면 null
  const t = await token(), b = body && JSON.stringify(body)
  const r = await fetch(`${STATS.url}/rest/v1/${path}`, { method: body ? 'POST' : 'GET', keepalive: !!b && b.length < 60000, headers: { apikey: STATS.key, Authorization: `Bearer ${t || STATS.key}`, 'Content-Type': 'application/json', ...head }, body: b }).catch(() => null)
  return !r?.ok ? null : r.status === 204 ? true : r.json().catch(() => true)
}
const rpc = (fn, args = {}) => api('rpc/' + fn, args)
function cloudPush(now) {   // 저장할 때마다 계정에도(2초 모아서). 페이지를 닫을 때는 바로
  if (!linked || !auth) return
  clearTimeout(cloudPush.t)
  const go = () => { const at = Date.now(); return api('saves?on_conflict=uid', { uid: auth.uid, data: save, updated_at: new Date(at).toISOString() }, { Prefer: 'resolution=merge-duplicates,return=minimal' }).then(ok => ok && syncMark(at)) }
  if (now) return go(); cloudPush.t = setTimeout(go, 2000)
}
addEventListener('pagehide', () => { if (cloudPush.t) cloudPush(true) })
/** 로그인한 뒤 · 켤 때 — 계정 저장과 이 기기 저장을 맞춘다. 둘 다 바뀌었으면 고르게 한다 */
const suspendCheck = async () => { const b = auth && await rpc('suspended'); if (b?.id) { SUSP = b.id; logout(); return true } }   // 정지된 계정 — 로그아웃(로그인 없는 판은 그대로)
async function link() {
  if (!auth || await suspendCheck()) return
  const rows = await api('saves?select=data,updated_at')
  if (!rows || !auth) return   // 인터넷이 안 되면 다음에
  const cloud = rows[0], mark = (() => { try { return JSON.parse(localStorage.getItem('mjg.sync')) } catch { return null } })(), at = cloud && Date.parse(cloud.updated_at)
  const empty = !save.runs && !save.coin && !save.owned.length
  if (!cloud) { linked = true; cloudPush(true) }   // 계정에 아직 없다 — 이 기기 것을 올린다
  else if (sign(cloud.data) === sign(save) || mark?.at === at) { linked = true; syncMark(at); if (sign(cloud.data) !== sign(save)) cloudPush(true) }   // 같다 · 계정은 그대로고 이 기기만 앞섰다
  else if (empty || mark?.h === sign(save)) return adopt(cloud.data, at)   // 이 기기는 그대로고 다른 기기에서 앞섰다(또는 이 기기가 비었다) — 계정 것으로
  else return choose(cloud.data, at)   // 둘 다 바뀌었다 — 고르게
  NICK = await rpc('my_nick')
  const ok = await rpc('agreed')   // 이용약관 — 처음 로그인(새 계정) · 약관이 바뀐 뒤 첫 로그인에 묻는다. 동의하지 않으면 로그아웃(새 계정은 지운다). 서버에 아직 없으면(null) 묻지 않는다
  if (ok && typeof ok === 'object' && ok.day !== TERMS_VER && !(await termsBox(!cloud && !NICK && !ok.day))) return
  if (mode === 'title') title()
  if (AUTH_NEW && !NICK) { AUTH_NEW = false; nickBox() }   // 처음 로그인 — 랭킹에 쓸 이름부터
}
function adopt(data, at) {   // 계정 저장으로 바꾸고 다시 연다
  const d = { ...data }; if (SECURE) d._s = sign(d)
  try { const j = JSON.stringify(d); localStorage.setItem(LS, j); localStorage.setItem(LS + '.bak', j); localStorage.setItem('mjg.sync', JSON.stringify({ at, h: sign(d) })) } catch {}
  location.reload()
}
/** 떠 있는 작은 창(바깥 · Esc · 닫기로 닫힌다) — 닫는 함수를 돌려준다 */
function modal(cls, ...kids) {
  MODAL?.()
  const box = h('div', { class: 'modal', role: 'dialog' }, h('div', { class: `panel ${cls}` }, ...kids)), close = () => { box.remove(); if (MODAL === close) MODAL = null }
  if (/\bstay\b/.test(cls)) close.stay = true; else box.onpointerdown = e => { if (e.target === box) close() }   // stay — 바깥 · Esc 로 닫히지 않는다(약관 동의처럼 꼭 고르게)
  document.body.append(box); MODAL = close; return close
}
const svgIc = (s, cls = 'brand') => { const e = h('span', { class: cls, 'aria-hidden': 'true' }); e.innerHTML = s; return e }
const KAKAO_IC = '<svg viewBox="0 0 24 24"><path fill="#000" d="M12 3C6.48 3 2 6.58 2 11c0 2.83 1.88 5.32 4.72 6.74l-.96 3.53c-.08.31.27.56.54.38l4.2-2.78c.49.06.99.1 1.5.1 5.52 0 10-3.58 10-8S17.52 3 12 3z"/></svg>'
const GOOGLE_IC = '<svg viewBox="0 0 48 48"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>'
function loginBox() {   // 로그인 창 — 카카오 · 구글(진짜 주소면 Google 공식 단추로 바꿔 그린다 — gisButton)
  const gwrap = h('div', { class: 'gis' }, h('button', { type: 'button', class: 'btn sns google', onclick: async () => { if (!gisOn()) return login('google'); if (!(await gisButton(gwrap))) { AUTH_ERR = 'google'; close(); if (mode === 'title') title() } } }, svgIc(GOOGLE_IC), tr`Google로 시작하기`))   // 진짜 주소에선 리디렉트(supabase.co 를 거친다 — 구글 브랜드 인증에서 뺐다) 대신 공식 단추를 다시 불러 본다
  if (gisOn()) setTimeout(() => gisButton(gwrap))
  const close = modal('login', h('p', { class: 'h' }, tr`로그인`), h('p', { class: 'sub' }, tr`기록과 상점 구매를 계정에 저장하고 무한 랭킹에 올라가요`),
    h('button', { type: 'button', class: 'btn sns kakao', onclick: () => login('kakao') }, svgIc(KAKAO_IC), tr`카카오로 시작하기`),
    gwrap,
    h('p', { class: 'fine' }, tr`로그인하지 않아도 지금처럼 이 기기에 저장돼요`, h('br'), tr`로그인하면 랭킹 기록을 확인하려고 익명 플레이 통계를 함께 보내요`, h('br'), tr`처음 로그인할 때 이용약관 동의를 받아요`, ' · ',
      h('button', { type: 'button', class: 'linkish', onclick: () => { close(); terms() } }, tr`이용약관`), ' · ', h('button', { type: 'button', class: 'linkish', onclick: () => { close(); privacy() } }, tr`개인정보 처리방침`)),
    h('div', { class: 'row' }, btn(tr`닫기`, () => close())))
}
/** 이용약관 동의 — 개인정보는 동의가 아니라 처리방침으로 알린다(로그인 정보는 서비스에 꼭 필요한 정보 — 기획 결정, 체크박스 없이 단추 하나).
 *  fresh — 방금 생긴 계정: 동의하지 않으면 계정을 지우고 로그아웃(동의 안 한 사람의 계정이 남지 않게). 아니면 로그아웃만. 동의하면 true */
function termsBox(fresh) {
  BUSY?.()
  return new Promise(res => {
    const msg = h('p', { class: 'nmsg no' }), doc = (fn, back) => () => { close(); fn(() => { title(); termsBox(fresh).then(res) }) }
    const go = btn(tr`동의하고 시작`, async () => { go.disabled = true; if (await rpc('agree', { day: TERMS_VER }) === 'ok') { close(); res(true) } else { msg.textContent = tr`✗ 인터넷 연결을 확인해 주세요`; go.disabled = false } }, 'main')
    const close = modal('nick stay', h('p', { class: 'h' }, fresh ? tr`처음 오셨네요!` : tr`이용약관이 바뀌었어요`), h('p', { class: 'sub' }, tr`이용약관에 동의하고 시작해요`, h('br'), tr`개인정보는 개인정보 처리방침을 따라요`),
      h('p', { class: 'fine' }, h('button', { type: 'button', class: 'linkish', onclick: doc(terms) }, tr`이용약관`), ' · ', h('button', { type: 'button', class: 'linkish', onclick: doc(privacy) }, tr`개인정보 처리방침`)), msg,
      h('div', { class: 'row' }, btn(tr`동의하지 않아요`, async () => { close(); if (fresh) await rpc('delete_me'); logout(); res(false) }), go))
  })
}
/** 닉네임 창 — 입력을 멈추고 0.4초 뒤 서버에 물어본다. done(정했으면 true) */
function nickBox(done = () => {}) {
  const inp = h('input', { type: 'text', maxlength: '12', value: NICK?.nick || '', placeholder: tr`닉네임`, autocomplete: 'off', 'aria-label': tr`닉네임` }), cnt = h('small', {}), msg = h('p', { class: 'nmsg' }), ok = btn(tr`정했어요!`, async () => {
    ok.disabled = true; const r = await rpc('set_nick', { nick: inp.value })
    if (r === 'ok') { NICK = await rpc('my_nick'); close(); done(true); if (mode === 'title') title() }
    else { say2(r); ok.disabled = false }
  }, 'main')
  const say2 = r => { msg.className = 'nmsg' + (r === 'ok' ? ' ok' : ' no'); msg.textContent = r === 'ok' ? tr`✓ 쓸 수 있어요` : r === 'taken' ? tr`✗ 이미 있는 이름이에요` : r === 'wait' ? tr`✗ 닉네임은 하루에 한 번 바꿀 수 있어요 (${new Date(NICK?.next).toLocaleString(LANG, { month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' })}부터)` : r === 'bad' ? tr`✗ 쓸 수 없는 이름이에요` : tr`✗ 인터넷 연결을 확인해 주세요` }
  let t = 0
  const check = () => { const v = inp.value.trim(), len = [...v].length; cnt.textContent = `${len}/12`; ok.disabled = true; msg.textContent = ''; clearTimeout(t)
    if (len < 2) return
    t = setTimeout(async () => { const r = await rpc('nick_free', { nick: v }); if (inp.value.trim() !== v) return; say2(r); ok.disabled = r !== 'ok' }, 400) }
  inp.oninput = check; inp.onkeydown = e => { if (e.key === 'Enter' && !ok.disabled) ok.click() }
  const close = modal('nick', h('p', { class: 'h' }, tr`랭킹에 쓸 이름을 정해요`), h('label', { class: 'nick' }, inp, cnt), msg,
    h('p', { class: 'fine' }, tr`2~12자 · 한글 · 영어 · 일본어 · 중국어 · 숫자`), h('div', { class: 'row' }, btn(tr`나중에`, () => { close(); done(false) }), ok))
  check(); setTimeout(() => inp.focus(), 50)
}
/** 기록이 두 군데 — 이 기기 / 내 계정 중 하나를 고른다(되돌릴 수 없어서 한 번 더 묻는다) */
function choose(cloud, at) {
  const sum = d => { const ids = Object.keys(BONUS), best = Object.entries(d.best || {}).filter(([k]) => k.endsWith('.inf')).reduce((a, [, b]) => Math.max(a, b.lv || 0), 0)
    return [[tr`토벌`, d.runs || 0], [tr`클리어`, d.clears || 0], [tr`토벌 보상금`, d.coin || 0], [tr`의상`, (d.owned || []).filter(k => OUTFIT[k]).length], [tr`무한 최고 단계`, best]] }
  const A = sum(save), B = sum(cloud), day = ms => ms ? new Date(ms).toLocaleString(LANG) : '—'   // 시 · 분 · 초까지(같은 날이면 구분이 안 돼서)
  const card = (k, name, rows, other, when) => h('button', { type: 'button', class: 'pickrec', 'data-k': k, onclick: e => { for (const b of e.currentTarget.parentNode.children) b.classList.toggle('on', b === e.currentTarget); go.disabled = false } },
    h('b', {}, name), rows.map(([n, v], i) => h('span', { class: v > other[i][1] ? 'more' : '' }, `${n} ${v.toLocaleString()}`)), h('small', {}, tr`마지막 ${day(when)}`))
  const go = btn(tr`이걸로 할게요`, () => {
    const k = document.querySelector('.modal .pickrec.on')?.dataset.k; if (!k) return
    const name = k === 'here' ? tr`이 기기` : tr`내 계정`
    modal('choose', h('p', { class: 'h' }, tr`정말 ${name} 기록으로 할까요?`), h('p', { class: 'warn' }, tr`다른 쪽 기록은 지워져요`),
      h('div', { class: 'row' }, btn(tr`아니요`, () => choose(cloud, at)), btn(tr`네, 이걸로`, () => { MODAL?.(); if (k === 'cloud') adopt(cloud, at); else { linked = true; cloudPush(true)?.then(link) } }, 'main')))   // 올리기가 끝난 뒤에 다시 맞춘다(바로 부르면 예전 계정 기록을 읽어 또 고르라고 했다)
  }, 'main')
  go.disabled = true
  modal('choose', h('p', { class: 'h' }, tr`기록이 두 군데 있어요`), h('p', { class: 'sub' }, tr`어느 쪽으로 이어서 할까요?`),
    h('div', { class: 'pickrecs' }, card('here', tr`이 기기`, A, B, save.last), card('cloud', tr`내 계정`, B, A, at)),
    h('p', { class: 'warn' }, tr`고르지 않은 쪽 기록은 사라져요`), h('div', { class: 'row' }, btn(tr`나중에`, () => { MODAL?.(); logout() }), go))
}
/** 처음 화면 오른쪽 위 — 로그인 단추 / 로그인했으면 [로고 닉네임 ▾](닉네임 바꾸기 · 로그아웃) */
function acctPick() {
  if (!auth) return h('button', { type: 'button', class: 'acct', onclick: loginBox }, tr`로그인`)
  const dot = cpDot() && h('i', { class: 'dot', 'aria-hidden': 'true' })   // 쿠폰 기간 동안 아직 안 받았으면 작은 점(기획)
  return h('details', { class: 'acct' }, h('summary', {}, svgIc(auth.prov === 'google' ? GOOGLE_IC : KAKAO_IC, `brand ${auth.prov}`), h('span', { class: 'nm' }, NICK?.nick || tr`로그인됨`), dot),
    h('div', {}, h('button', { type: 'button', onclick: () => nickBox() }, NICK ? tr`닉네임 바꾸기` : tr`닉네임 정하기`), h('button', { type: 'button', onclick: () => ranking() }, tr`랭킹`), h('button', { type: 'button', onclick: couponBox }, tr`쿠폰 입력`, dot && dot.cloneNode()), h('button', { type: 'button', onclick: logout }, tr`로그아웃`), h('button', { type: 'button', class: 'del', onclick: delBox }, tr`계정 지우기`)))   // 하는 일 위 · 나가는 일 아래(디자인)
}
/** 쿠폰 — 서버 redeem(supabase/account.sql 8번)이 코드 · 기간 · 한 계정 한 번을 본다. 끝나는 때는 그 coupons.ends · 패치노트 날짜와 같게 */
const COUPON = { id: 'launch', ends: Date.parse('2026-12-20T23:59:59.999+09:00') }
const cpDot = () => !!auth && Date.now() < COUPON.ends && !save.cpn?.includes(COUPON.id)
/** 쿠폰 입력 — 실패는 입력 칸 위 모몽가 말풍선(없는 코드 · 연결 = .no 흔들기, 이미 받음 · 기간 끝 · 정지 = .end 차분하게), 성공은 셋이 축하하는 새 창(디자인) */
function couponBox() {
  const inp = h('input', { type: 'text', maxlength: '40', placeholder: tr`쿠폰 코드`, autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', enterkeyhint: 'done', 'aria-label': tr`쿠폰 코드` })
  const bub = h('span', { class: 'bub' }), say = h('div', { class: 'cp-say', role: 'status', 'aria-live': 'polite', hidden: '' }, portrait('momonga', null, null), bub)
  const fail = (k, s) => { say.hidden = false; bub.textContent = s; say.classList.remove('no', 'end'); void say.offsetWidth; say.classList.add(k); go.disabled = false; inp.focus(); inp.select() }   // 같은 실패여도 흔들기가 다시 돈다
  const go = btn(tr`받기`, async () => {
    go.disabled = true; const r = await rpc('redeem', { code: inp.value.trim().toUpperCase() })
    if (r?.r === 'ok' && !save.cpn?.includes(r.id)) { save.coin += r.coin; (save.cpn ||= []).push(r.id); persist(); cloudPush(true); couponOk(r.coin) }   // 그 자리에서 보상금 · 받은 표시 · 이 기기 저장을 한 번에, 그다음 계정으로(기획)
    else if (r?.r === 'ok') { cloudPush(true); fail('end', tr`한 번만이야! 나도 더 받고 싶단 말이야~`) }   // 이 기기엔 이미 더했다(계정으로 못 올렸을 뿐) — 또 더하지 않고 올리기만
    else if (r?.r === 'nologin') { close(); loginBox() }
    else if (r?.r === 'used') { if (!save.cpn?.includes(r.id)) { (save.cpn ||= []).push(r.id); persist() } fail('end', tr`한 번만이야! 나도 더 받고 싶단 말이야~`) }   // 다른 기기에서 받았다 — 점만 끈다
    else if (r?.r === 'expired') fail('end', tr`아쉽지만 이 쿠폰은 벌써 끝났어!`)
    else if (r?.r === 'ban') fail('end', tr`이 계정은 쿠폰을 쓸 수 없어요.`)
    else if (r?.r === 'bad') fail('no', tr`그런 쿠폰 없어! 글자를 다시 봐 봐.`)
    else fail('no', tr`연결이 안 돼! 인터넷을 확인하고 다시 해 봐.`)
  }, 'main')
  go.disabled = true; inp.oninput = () => { go.disabled = !inp.value.trim() }; inp.onkeydown = e => { if (e.key === 'Enter' && !go.disabled) go.click() }
  const close = modal('nick cp', h('p', { class: 'h' }, tr`쿠폰 입력`), say, h('label', { class: 'nick cp' }, inp),
    h('div', { class: 'row' }, btn(tr`닫기`, () => close()), go))
  setTimeout(() => inp.focus(), 50)
}
function couponOk(coin) {   // 하치와레 · 치이카와 · 우사기(주인공 가운데 · 키 큰 우사기 오른쪽 끝) — 기본 모습으로, 차례로 콩콩(디자인)
  if (mode === 'title') title()   // 처음 화면 보상금 · 점을 새로
  const who = [['hachiware', tr`축하해!`], ['chiikawa', tr`와아…! 받았다…!`], ['usagi', tr`야하!`]], ok = btn(tr`좋아요!`, () => close(), 'main')
  const close = modal('cp-ok', h('p', { class: 'h' }, tr`축하해요!`),
    h('div', { class: 'cp-trio' }, Array.from({ length: 6 }, () => h('i')), who.map(([id, s]) => h('div', {}, h('span', { class: 'bub' }, s), portrait(id, null, null)))),
    h('p', { class: 'cp-gain' }, ic('coin'), `+${coin.toLocaleString()}`), h('p', { class: 'sub' }, tr`토벌 보상금을 받았어요!`), h('div', { class: 'row' }, ok))
  setTimeout(() => ok.focus(), 50)
}
/** 계정 지우기 — 닉네임(없으면 「지우기」)을 그대로 써야 눌린다(아이가 잘못 누르지 않게). 서버 delete_me → 로그아웃 → 처음 화면 */
function delBox() {
  const word = NICK?.nick || tr`지우기`, inp = h('input', { type: 'text', maxlength: '12', placeholder: word, autocomplete: 'off', 'aria-label': word }), msg = h('p', { class: 'nmsg no' })
  const go = btn(tr`지우기`, async () => { go.disabled = true; if (await rpc('delete_me') === 'ok') { MODAL?.(); logout() } else { msg.textContent = tr`✗ 인터넷 연결을 확인해 주세요`; go.disabled = false } }, 'danger')
  go.disabled = true; inp.oninput = () => { go.disabled = inp.value.trim() !== word }; inp.onkeydown = e => { if (e.key === 'Enter' && !go.disabled) go.click() }
  modal('nick', h('p', { class: 'h' }, tr`계정을 지울까요?`), h('p', { class: 'warn' }, tr`계정 · 계정에 저장한 기록 · 랭킹 기록이 모두 지워지고 되돌릴 수 없어요. 이 기기의 기록은 남아요.`),
    h('p', { class: 'sub' }, tr`지우려면 아래 칸에 똑같이 써 주세요`, h('br'), h('b', {}, word)), h('label', { class: 'nick' }, inp), msg, h('div', { class: 'row' }, btn(tr`아니요`, () => MODAL?.()), go))
  setTimeout(() => inp.focus(), 50)
}
// ---- 무한 랭킹 — 판을 시작할 때 start_run(서버가 이 판의 일회용 값 tok 을 준다), 끝나면 submit_rank(서버가 실제 흐른 시간 · 그럴듯한지 · 체크섬을 본다)
//   체크섬 ck = SHA-256(tok | 기록 | 소금) — 요청을 손으로 고쳐 보내면 서버가 다시 계산한 값과 어긋난다(supabase/account.sql 의 submit_rank 와 같은 순서 · 소금)
const CK_SALT = '__CK_SALT__'   // 진짜 값은 배포할 때 GitHub Actions 비밀 CK_SALT 로 넣는다(test/build.cjs) — 저장소에 두지 않는다(공개 저장소라 예전 값이 새어 나갔다). 서버는 ck_key 표
const runCk = async (tok, a) => { try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode([tok, a.ch, a.lv, a.bosses, a.bt, a.t, a.kills, a.lvl, a.weapons, a.hit0, a.v, CK_SALT].join('|'))); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('') } catch { return '' } }
const rankArgs = () => ({ ch: G.ch.id, lv: G.loop.lv, bosses: G.bosses, bt: Math.round(G.bossT), t: Math.round(G.t), kills: G.kills, lvl: G.lvl,
  weapons: G.weapons.map(w => w.id + (G.aw.has(w.id) ? 9 : Math.min(8, w.lv))).join(' '), passives: Object.entries(G.passives).map(([k, n]) => k + n).join(' '),
  slain: Object.entries(G.slain).map(([k, n]) => k + n).join(' '), winter: !!G.winter, v: PATCH_ID, hit0: G.hit0 == null ? -1 : Math.round(G.hit0), outfit: wornId(G.ch.id), wskin: wornW(G.ch.id), lang: LANG })   // 의상 · 무기 스킨 — 랭킹 그림(체크섬엔 안 넣는다)   // hit0 — 처음 맞은 때(-1 = 한 번도 안 맞음)
function rankLine() {   // 무한 결과 화면 — 순위 / 닉네임 정하기 / 로그인 안내
  const el = h('div', { class: 'rankline' }), set = (...k) => el.replaceChildren(...k)
  if (!auth) { set(h('span', {}, tr`로그인하면 다음 판부터 랭킹에 올라가요`), btn(tr`로그인`, loginBox)); return el }
  if (G.bad) { set(h('span', {}, tr`이 판은 랭킹에 올라가지 않아요`)); return el }   // 부정 플레이 표시 — 이유는 안 쓴다
  const args = rankArgs(), tok = G.tok, send = async () => {
    if (!tok) return set(h('span', {}, tr`이 판은 랭킹에 올릴 수 없어요 — 로그인한 뒤 새로 시작한 판만 올라가요`))   // 시작할 때 서버에 못 알렸다
    set(h('span', {}, tr`랭킹에 올리는 중…`))
    const r = await rpc('submit_rank', { ...args, ck: await runCk(tok, args) })
    if (!r) set(h('span', {}, tr`랭킹에 올리지 못했어요 — 인터넷 연결을 확인해 주세요`))
    else if (r.r === 'nonick') set(h('span', {}, tr`닉네임을 정하면 이 기록이 랭킹에 올라가요`), btn(tr`닉네임 정하기`, () => nickBox(ok => ok && send())))
    else if (r.r === 'ok' || r.r === 'kept') set(h('span', {}, r.r === 'ok' ? tr`랭킹 #${r.rank} · 최고 기록 갱신!` : tr`랭킹 #${r.rank} — 예전 기록이 더 좋아요`), btn(tr`랭킹 보기`, (w => () => ranking(null, w))(!!G?.winter)))
    else if (r.r === 'stale') set(h('span', {}, tr`게임이 새로 바뀌었어요 — 새로 고침하면 다음 판부터 랭킹에 올라가요`), btn(tr`새로 고침`, () => location.reload()))   // 바뀌기 전 game.js 로 한 판
    else if (r.r === 'hold' || r.r === 'ban') { set(h('span', {}, tr`이 판은 랭킹에 올라가지 않아요`)); if (r.r === 'ban') { blockCheck(); suspendCheck() } }   // 체크섬이 안 맞음 · 차단된 계정 · 방금 자동 차단(IP 가 막혔으면 안내 화면)
    else set(h('span', {}, tr`이 판은 랭킹에 올릴 수 없어요 — 로그인한 뒤 새로 시작한 판만 올라가요`))
  }
  send(); return el
}
const RK_COL = ['', 't3', 't2', 't1']   // 1 · 2 · 3등 — 금 · 은 · 동
const icSafe = id => { try { return ic(id) } catch { return null } }   // 랭킹 기록은 서버 것 — 예전 판의 없어진 id 여도 화면이 멈추지 않게
/** 랭킹 화면 — 전체 TOP 100(사람마다 최고 하나) · 캐릭터별 TOP 10. 줄을 누르면 자세히 */
let rankW = true   // 랭킹 맵 — 겨울(기본) · 풀밭. 맵마다 따로(사람마다 맵마다 최고 하나)
let rankTab = 'inf', rankDiff = 'inf'   // 랭킹 탭(토벌 · 모의 토벌) · 모의 토벌 난이도
async function ranking(only = null, w = rankW, tab = rankTab, diff = rankDiff) {
  mode = 'rank'; G = null; rankW = w; rankTab = tab; rankDiff = diff
  const tabs = h('div', { class: 'wr-mode rk-tabs', role: 'tablist' }, [['inf', [ic('inf'), tr` 토벌 랭킹`]], ['sim', tr`모의 토벌 랭킹`]].map(([k, s]) =>
    h('button', { type: 'button', role: 'tab', 'aria-selected': String(tab === k), class: tab === k ? 'on' : '', onclick: () => tab !== k && ranking(only, w, k, diff) }, s)))   // 탭이 제목을 겸한다(디자인 — 상점 탭 모양)
  const mapPick = h('div', { class: 'theme rmap', role: 'radiogroup', 'aria-label': tr`맵` }, [[true, 'snow', tr`겨울`], [false, 'clover', tr`풀밭`]].map(([v, pic, name]) =>
    h('button', { type: 'button', role: 'radio', 'aria-checked': String(w === v), class: w === v ? 'on' : '', onclick: () => w !== v && ranking(only, v, tab, diff) }, ic(pic), ` ${name}`)))   // 처음 화면 테마 단추와 같은 모양 · 두 탭이 같이 쓴다
  if (tab === 'sim') return simRanking(w, diff, tabs, mapPick)
  const list = h('ol', { class: 'list rank scroll' }, h('li', { class: 'wait' }, tr`불러오는 중…`)), mine = h('div', { class: 'mine' })
  const head = h('li', { class: 'head', 'aria-hidden': 'true' }, h('span', {}), h('span', {}), h('span', {}, tr`닉네임`), h('span', {}, tr`단계`), h('span', {}, tr`버틴 시간`), h('span', {}, tr`보스`))   // 넓은 화면만 — 표 머리줄
  const ghost = (txt, b) => h('li', { class: 'ghost' }, h('span', {}, txt), b || h('span', {}))   // 내 기록 자리 · 빈 목록 — 목록 줄과 같은 모양의 점선 줄
  show(h('div', { class: 'panel wide pick rank' },
    tabs, mapPick, h('p', { class: 'sub' }, `${w ? tr`겨울` : tr`풀밭`} · `, only ? tr`${CHARS.find(c => c.id === only)?.name ?? only} TOP 10` : tr`전체 TOP 100 · 한 사람당 최고 기록 하나`),   // 맵이 캐릭터보다 큰 갈래 — 제목 바로 밑(디자인)
    h('div', { class: 'dex-nav' }, h('button', { type: 'button', class: only ? '' : 'on', onclick: () => ranking(null, w) }, tr`전체`),
      CHARS.map(c => h('button', { type: 'button', class: only === c.id ? 'on' : '', onclick: () => ranking(c.id, w) }, ic(c.w), ` ${c.name}`))),
    mine, list,
    h('div', { class: 'row' }, btn(tr`← 처음으로`, title))))
  const [rows, me] = await Promise.all([rpc('top_ranks', { only_ch: only, on_winter: w }), auth ? rpc('my_rank', { only_ch: only, on_winter: w }) : null])
  if (mode !== 'rank') return
  if (!rows) return list.replaceChildren(h('li', { class: 'wait' }, tr`랭킹을 불러오지 못했어요 — 인터넷 연결을 확인해 주세요`))
  list.replaceChildren(...(rows.length ? [head, ...rows.map(rankRow)] : [ghost(tr`아직 기록이 없어요 — 첫 번째가 되어 보세요!`)]))
  if (!auth) mine.replaceChildren(ghost(tr`로그인하면 내 기록도 여기에 올라가요`, btn(tr`로그인`, loginBox)))
  else if (me?.[0]) { mine.dataset.t = tr`내 기록`; mine.replaceChildren(rankRow(me[0])) }   // 위 꼬리표 「내 기록」(목록 순서와 헷갈리지 않게)
  else mine.replaceChildren(NICK ? ghost(tr`무한 모드를 해 보면 여기에 내 기록이 나와요`) : ghost(tr`닉네임을 정하면 랭킹에 올라가요`, btn(tr`닉네임 정하기`, () => nickBox())))
}
/** 모의 토벌 랭킹 — 이번 주 전장 · 판(보통 · 어려움 · 무한 × 맵)마다 TOP 100. 줄을 누르면 자세히(작전 · [이 작전 써 보기]) */
async function simRanking(w, diff, tabs, mapPick) {
  if (!SIM_RK.includes(diff)) diff = rankDiff = SIM_RK[0]
  const W = simWeek(), list = h('ol', { class: 'list rank rk-sim scroll' }, h('li', { class: 'wait' }, tr`불러오는 중…`)), mine = h('div', { class: 'mine rk-sim' })
  const ghost = (txt, b) => h('li', { class: 'ghost' }, h('span', {}, txt), b || h('span', {}))
  const dp = SIM_RK.length > 1 ? h('div', { class: 'rk-diff', role: 'radiogroup', 'aria-label': tr`난이도` }, SIM_RK.map(k => h('button', { type: 'button', role: 'radio', 'aria-checked': String(diff === k), class: `${k}${diff === k ? ' on' : ''}`, onclick: () => diff !== k && ranking(null, w, 'sim', k) }, ic(k), DIFF[k].name))) : null   // 판이 하나(무한)면 고르기 없음
  show(h('div', { class: 'panel wide pick rank' }, tabs, mapPick, dp, h('p', { class: 'sub rk-week' }, tr`이번 주 전장 #${W.field} · 새 전장까지 ${simLeft()}`), mine, list, h('div', { class: 'row' }, btn(tr`← 처음으로`, title))))
  const [rows, me] = await Promise.all([rpc('top_sims', { on_diff: diff, on_winter: w }), auth ? rpc('my_sim', { on_diff: diff, on_winter: w }) : null])
  if (mode !== 'rank' || rankTab !== 'sim') return
  if (!rows) return list.replaceChildren(h('li', { class: 'wait' }, tr`랭킹을 불러오지 못했어요 — 인터넷 연결을 확인해 주세요`))
  const one = r => ({ ...r, diff, winter: w })
  list.replaceChildren(...(rows.length ? rows.map(r => simRow(one(r))) : [ghost(tr`아직 기록이 없어요 — 이번 주 첫 번째가 되어 보세요!`)]))
  if (!auth) mine.replaceChildren(ghost(tr`로그인하면 이번 주 랭킹에 올라가요`, btn(tr`로그인`, loginBox)))
  else if (me?.[0]?.hidden) mine.replaceChildren(ghost(tr`이번 주 내 기록은 확인 중이에요`))   // 내린 기록 — 나에게만(정직하게 따라 한 사람이 이유 없이 사라진 것처럼 느끼지 않게 · 기획)
  else if (me?.[0]) { mine.dataset.t = tr`내 기록`; mine.replaceChildren(simRow(one(me[0]))) }
  else mine.replaceChildren(ghost(tr`이번 주 전장에서 끝까지 보면 여기에 내 기록이 나와요`))
}
function simScore(r) {   // 오른쪽 결과 — 무한: 단계 · 보스 / 격파: 노란 알약 「격파 18:42」 / 못 깸: 시간 · 처치
  if (r.diff === 'inf') return [h('span', { class: 'lvpill' + (r.lv ? '' : ' zero') }, r.lv ? `∞ ${tr`${r.lv}단계`}` : tr`세이렌 전`), h('small', {}, tr`보스 ${r.bosses}`)]
  if (r.kind === 'win') return [h('span', { class: 'win' }, tr`격파 ${fmt(r.t)}`)]
  return [h('b', {}, fmt(r.t)), h('small', {}, tr`처치 ${r.kills.toLocaleString()}`)]
}
function simRow(r) {
  return h('li', { class: r.me ? 'me' : '', onclick: () => simInfo(r) },
    h('span', { class: `rk n ${RK_COL[r.rank] || ''}` }, r.rank ?? '–'), h('span', { class: 'pt' }, portrait(r.ch)),
    h('div', { class: 'nm' }, h('b', {}, r.nick), h('small', {}, STYLE[r.s]?.name ?? '')), h('div', { class: 'sc' }, ...simScore(r)),
    h('div', { class: 'bd' }, h('span', { class: 'w' }, r.w.split(' ').map(id => icSafe(id))), h('i', { class: 'sep' }), h('span', { class: 'p' }, (r.p || '').split(' ').filter(Boolean).map(id => icSafe(id)))))
}
function simInfo(r) {   // 자세히 — 작전을 크게(작전 짜기 칸 모양 · 눌러지지 않게) · [이 작전 써 보기]
  const tag = id => (SIM_TAG[id] ?? '').replace(/\s?(?=[↑↓])/g, '\u2060').replace(/ (?=\+)/g, '\u00a0')
  const pal = ids => h('div', { class: 'pal ro' }, ids.filter(id => WEAP[id] || PASS[id]).map(id => h('button', { type: 'button', tabindex: '-1', 'aria-label': WEAP[id]?.name ?? PASS[id]?.name }, ic(id), h('small', { 'aria-hidden': 'true' }, tag(id)))))
  const w = r.w.split(' '), pp = (r.p || '').split(' ').filter(Boolean)
  const close = modal('rinfo simi', portrait(r.ch), h('p', { class: 'h' }, `#${r.rank ?? '–'} ${r.nick}`), h('div', { class: 'sc' }, ...simScore(r)),
    simSetRow({ ch: r.ch, diff: r.diff, winter: r.winter, s: r.s }),
    h('p', { class: 'sim-lab' }, tr`무기 순서 ${w.length}/6`), pal(w), h('p', { class: 'sim-lab' }, tr`보조 순서 ${pp.length}/6`), pal(pp),
    h('div', { class: 'row' }, btn(tr`닫기`, () => close()), btn(tr`이 작전 써 보기`, () => { close(); simPlan({ ch: r.ch, diff: r.diff, winter: r.winter, s: r.s, w, p: pp, seed: 0, week: true, pop: true }) }, 'main')))
}
/** 랭킹 그림 — 그 판에 입은 의상 · 무기 스킨으로(서버 값 — 없거나 그 캐릭터 것이 아니면 기본 모습) */
const langFlag = (code, cls = 'flag') => { const L = LANGS.find(x => x[0] === code); if (!L) return null; const f = ic(L[2]); f.classList.add(...cls.split(' ')); f.alt = f.title = L[1]; return f }   // 플레이한 언어 — 언어 단추와 같은 국기, 이름은 그 나라말(번역 안 함). 예전 기록(없음)은 안 그린다
const rankPortrait = r => { const o = OUTFIT[r.outfit], w = WSKIN[r.wskin]; return portrait(r.ch, o && (!o.ch || o.ch === r.ch) ? r.outfit : null, w && (!w.ch || w.ch === r.ch) ? r.wskin : null) }
function rankRow(r) {
  return h('li', { class: r.me ? 'me' : '', onclick: () => rankInfo(r) },
    h('span', { class: `rk ${RK_COL[r.rank] || ''}` }, r.rank),
    h('span', { class: 'av' }, rankPortrait(r), langFlag(r.lang)),
    h('div', {}, h('b', {}, r.nick), h('span', { class: 'wp' }, r.weapons.split(' ').map(w => icSafe(w.replace(/\d+$/, ''))))),
    h('div', { class: 'sc' }, h('span', { class: 'lvpill' + (r.lv ? '' : ' zero') }, r.lv ? [h('span', { class: 'long' }, `∞ ${tr`${r.lv}단계`}`), h('span', { class: 'short' }, `∞ ${r.lv}`)] : tr`세이렌 전`),   // 0단계 = 세이렌을 아직 못 쓰러뜨림
      h('span', { class: 't' }, fmt(r.t)), h('span', { class: 'bs' }, h('i', {}, tr`보스`), ' ', String(r.bosses))))   // 넓은 화면은 머리줄에 「보스」가 있어 숫자만
}
function rankInfo(r) {   // 자세히 — 작은 결과 화면처럼
  const ch = CHARS.find(c => c.id === r.ch), ws = r.weapons.split(' ').map(w => [w.replace(/\d+$/, ''), +w.match(/\d+$/)[0]]), lvOf = v => v === 9 ? '★' : `Lv${v}`
  const chip = (id, txt, w) => h('span', { class: `chip${w ? ' w' : ''}` }, icSafe(id), ` ${txt}`), stat = (k, v) => h('div', {}, h('small', {}, k), h('b', {}, v))
  const row = (k, ...kids) => kids.flat().length > 0 && h('div', { class: 'brow' }, h('small', {}, k), h('div', { class: 'build' }, ...kids))
  const close = modal('rinfo', rankPortrait(r),
    h('p', { class: 'h' }, `#${r.rank} ${r.nick}`), h('p', { class: 'sub' }, `${ch?.name ?? r.ch} · ${new Date(r.at).toLocaleDateString(LANG)} · ${r.winter ? tr`겨울` : tr`풀밭`}`, ((f = langFlag(r.lang, 'flag in')) => f ? [' · ', f, f.alt] : '')()),   // 끝에 「· [국기] 한국어」(디자인 — 국기와 이름을 한 번 짝지어 보여 준다)
    r.lv ? h('p', { class: 'lvl-badge inf' }, ic('inf'), tr` ${r.lv}단계`) : h('p', { class: 'lvl-badge inf zero' }, tr`세이렌 전`),
    h('div', { class: 'stats' }, stat(tr`버틴 시간`, fmt(r.t)), stat(tr`처치`, r.kills.toLocaleString()), stat(tr`보스`, r.bosses), stat(tr`레벨`, r.lvl)),
    row(tr`메인`, ws.slice(0, 1).map(([id, v]) => chip(id, `${WEAP[id]?.name ?? id} ${lvOf(v)}`, 1))),
    row(tr`보조`, ws.slice(1).map(([id, v]) => chip(id, `${WEAP[id]?.name ?? id} ${lvOf(v)}`, 1))),
    row(tr`각성`, ws.filter(([, v]) => v === 9).map(([id]) => chip('awaken', AW[id]?.name ?? id))),
    row(tr`아이템`, (r.passives || '').split(' ').filter(Boolean).map(p => { const [, id, n] = p.match(/^([a-z]+)(\d+)$/); return chip(id, `${PASS[id]?.name ?? id} Lv${n}`) })),
    row(tr`잡은 보스`, (r.slain || '').split(' ').filter(Boolean).map(p => { const [, id, n] = p.match(/^([a-zA-Z]+)(\d+)$/); return h('span', { class: 'chip' }, `${BOSS[id]?.name ?? id} ×${n}`) })),
    h('div', { class: 'row' }, btn(tr`닫기`, () => close())))
}
if (statsOn()) {   // 방문 통계(Google 애널리틱스) — 익명 통계와 같은 규칙(이 주소에서만 · 보내지 않기 · 추적 거부면 안 불러온다)
  window.dataLayer = window.dataLayer || []; window.gtag = function () { dataLayer.push(arguments) }
  gtag('js', new Date()); gtag('config', 'G-DZDG6FBGP0')
  document.head.append(Object.assign(document.createElement('script'), { async: true, src: 'https://www.googletagmanager.com/gtag/js?id=G-DZDG6FBGP0' }))
}
const KILLER = { sauce: tr`빙글빙글 소스`, spike: tr`가면 키메라 독침`, net: tr`복어 기름 그물`, soy: tr`문어 간장`, note: tr`세이렌 음표`, paper: tr`날아오는 종이`, shard: tr`검은 별똥별 조각`, rock: tr`던진 돌`, claw: tr`날아오는 발톱`, bomb: tr`폭발`, land: tr`내려찍기` }
const killerName = s => !s ? null : typeof s === 'string' ? s : s.kind ? BOSS[s.kind]?.name ?? s.kind : FOES[s.type]?.name ?? KILLER[s.k] ?? s.k ?? null
function statRow(result) {
  const b = G.final ? G.final.siren : G.foes.find(e => e.boss && !e.dead)
  return { v: PATCH_ID, ch: G.ch.id, diff: G.diff, result, t: Math.round(G.t), lvl: G.lvl, kills: G.kills, killer: result === 'dead' ? ko(G.killer) || null : null,
    boss: G.dark ? '검은 별똥별' : b ? ko(BOSS[b.kind]?.name) ?? null : null, weapons: G.weapons.map(w => w.id + (G.aw.has(w.id) ? 9 : w.lv)).join(' '), touch: matchMedia('(hover: none)').matches,
    up: Object.values(save.up).reduce((a, n) => a + n, 0) }   // 상점에서 산 영구 강화 칸 수(0 = 강화 없이)
}
function report(result) {   // 로그인 중이면 익명 통계는 늘 보낸다(랭킹 기록 확인 — 기획 결정. 계정은 붙이지 않는다). 방문 통계(GA)는 그대로 토글 · 추적 거부를 따른다
  if (!statsOn() && !(auth && location.hostname === STATS.host)) return
  fetch(`${STATS.url}/rest/v1/rpc/report_run`, { method: 'POST', keepalive: true, body: JSON.stringify(statRow(result)),
    headers: { 'Content-Type': 'application/json', apikey: STATS.key, Authorization: `Bearer ${STATS.key}`, Prefer: 'return=minimal' } }).catch(() => {})
}

// ---------------------------------------------------------------- 소리 — 파일 없이 웹 오디오로 직접 만든 배경음악 · 효과음 · 캐릭터 목소리(삐약 소리). 첫 클릭 · 키 · 터치에 켜진다
//   크기는 배경음(save.bgm) · 효과음(save.sfx) 따로 0~1 — 소리 단추를 누르면 나오는 작은 창에서
save.zoom = clamp(+save.zoom || 1, 0.75, 1.4)   // 화면 배율(일시정지에서) — 75%(넓게) ~ 140%(크게)
if (save.bgm == null) { save.bgm = save.mute ? 0 : 0.7; save.sfx = save.mute ? 0 : 0.8 } delete save.mute
const SND = (() => {
  let ac = null, out = null, mus = null, pump = null, sfx = null, who = '', kit = null, noise = null, theme = '', step = 0, at = 0, timer = 0, duck = 1
  const last = {}, mtof = n => 440 * 2 ** ((n - 69) / 12)
  const THEMES = {   // 직접 지은 곡
    // 처음 화면 · 토벌 — 일렉 팝. 16분음표 칸, 리드는 8분음표 한 칸(0 쉼 · 1 앞 음을 늘임), 화음은 한 마디씩
    field: { bpm: 128, vol: 0.19, chords: ['G', 'D', 'Em', 'C', 'G', 'D', 'Em', 'D', 'C', 'D', 'Bm', 'Em', 'C', 'D', 'G', 'D'], lead: [
      74, 0, 79, 0, 78, 79, 81, 83, 81, 1, 78, 74, 0, 76, 78, 0, 79, 0, 76, 0, 71, 76, 79, 83, 81, 79, 76, 79, 1, 1, 0, 0,
      74, 0, 79, 0, 78, 79, 81, 83, 86, 0, 84, 83, 81, 0, 78, 0, 79, 81, 83, 0, 76, 0, 79, 78, 76, 74, 1, 1, 1, 0, 0, 0,
      76, 0, 76, 79, 0, 76, 74, 72, 74, 0, 74, 78, 0, 81, 1, 0, 83, 81, 78, 74, 0, 71, 74, 78, 76, 1, 1, 79, 0, 83, 1, 0,
      84, 83, 81, 79, 0, 76, 79, 81, 81, 1, 78, 0, 81, 0, 86, 0, 83, 1, 1, 1, 86, 83, 79, 0, 81, 1, 78, 1, 0, 0, 0, 0] },
    // 겨울 맵 — 느긋한 D장조(직접 지은 곡). field 와 같은 틀이라 캐릭터마다 자기 악기(KIT)로 같은 악보를 연주한다. bells — 썰매 방울 · 마디 머리 글로켄 · 부드러운 킥
    winter: { bpm: 112, vol: 0.19, bells: true, chords: ['D', 'Bm', 'G', 'A', 'D', 'Bm', 'Em', 'A', 'G', 'A', 'F#m', 'Bm', 'G', 'A', 'D', 'D'], lead: [
      81, 0, 78, 81, 86, 1, 85, 83, 81, 1, 78, 0, 74, 76, 78, 0, 79, 0, 83, 81, 79, 1, 76, 78, 76, 1, 1, 0, 73, 76, 81, 0,
      81, 0, 78, 81, 86, 1, 88, 86, 83, 1, 81, 78, 74, 0, 78, 81, 79, 78, 76, 0, 79, 1, 83, 81, 81, 1, 1, 1, 0, 0, 0, 0,
      83, 0, 83, 86, 0, 83, 81, 79, 81, 1, 76, 0, 81, 0, 85, 1, 85, 83, 81, 78, 0, 81, 78, 76, 78, 1, 74, 0, 71, 74, 78, 0,
      79, 0, 83, 0, 86, 1, 83, 79, 81, 0, 85, 0, 88, 1, 85, 81, 86, 1, 85, 83, 81, 0, 78, 76, 74, 1, 1, 1, 0, 0, 0, 0] },
    // 최종보스 — 8분음표 한 칸(0 은 쉼), 베이스는 4분음표
    siren: { bpm: 136, lead: [69, 72, 76, 72, 74, 76, 77, 76, 76, 74, 72, 71, 69, 0, 64, 0, 69, 72, 76, 81, 79, 77, 76, 74, 72, 74, 71, 68, 69, 0, 0, 0], bass: [45, 45, 41, 41, 43, 43, 40, 40], vol: 0.17 },
  }
  const CH = { G: [55, 67, 71, 74], D: [50, 62, 66, 69], Em: [52, 64, 67, 71], C: [48, 60, 64, 67], Bm: [47, 59, 62, 66], A: [45, 57, 61, 64], 'F#m': [42, 54, 57, 61] }   // [베이스, 화음 셋]
  // 악기 — 같은 곡(field)을 캐릭터 성격대로 다른 소리로. o: [[파형, 높이 배수, 어긋남(센트), 크기]] · v 크기 · cut [필터 처음, 끝]Hz · dec 닫히는 시간 · q 날카로움
  //   ring 울림(초) · atk 처음 · sus 길게 끌기 · vib 떨림(센트) · drive 찌그러뜨림 · oct 옥타브. dr: [킥, 박수 높이(Hz), 하이햇, 출렁임(작을수록 크게)]
  const CRUNCH = new Float32Array(256).map((_, i) => Math.tanh((i / 127.5 - 1) * 5))
  const KIT = {
    '': {   // 처음 화면 — 일렉 신스
      lead: { o: [['sawtooth', 1, -9], ['sawtooth', 1, 9]], cut: [4800, 2400] }, bass: { o: [['sawtooth']], cut: [1400, 700] }, arp: { o: [['square']] }, dr: [1.5, 1600, 1, 0.25] },
    chiikawa: {   // 오르골 — 작고 여린 반짝임
      lead: { o: [['sine'], ['sine', 5.4, 0, 0.2]], ring: 0.8, oct: 1, v: 1.3 }, bass: { o: [['triangle']], v: 1.3 }, arp: { o: [['sine', 2]], ring: 0.3, v: 1.2 }, dr: [0.6, 7000, 0.5, 0.75] },
    hachiware: {   // 어쿠스틱 기타 — 밝게 뜯는 소리
      lead: { o: [['sawtooth'], ['triangle', 1, 0, 0.8]], cut: [5000, 600], dec: 0.15, q: 1 }, bass: { o: [['triangle']], cut: [1200, 500], v: 1.4 }, arp: { o: [['sawtooth']], cut: [3000, 500], dec: 0.08, q: 1 }, dr: [1.1, 1800, 0.9, 0.55] },
    usagi: {   // 록 기타 — 찌그러뜨린 소리 · 센 드럼
      lead: { o: [['sawtooth', 1, -12], ['square', 1, 12]], drive: 1, cut: [3200, 2200], v: 0.42 }, bass: { o: [['sawtooth']], drive: 1, cut: [900, 600], v: 0.6 }, arp: { o: [['square']], cut: [3000, 3000], v: 0.8 }, dr: [1.9, 1200, 1.3, 0.2] },
    momonga: {   // 칩튠 — 장난감 같은 네모파 · 살랑 떨림
      lead: { o: [['square']], vib: 25, sus: 1, v: 0.55 }, bass: { o: [['square']], cut: [700, 500], v: 0.8 }, arp: { o: [['square', 2]], v: 0.7 }, dr: [1.2, 2400, 1.1, 0.4] },
    kurimanju: {   // 일렉 피아노 — 느긋하게 · 살살 드럼
      lead: { o: [['sine'], ['sine', 2, 0, 0.3], ['triangle', 1, 0, 0.2]], ring: 1, atk: 0.004, cut: [3000, 1500], v: 0.8 }, bass: { o: [['sine'], ['triangle', 2, 0, 0.2]], v: 1.1 }, arp: { o: [['sine']], ring: 0.4 }, dr: [0.7, 3200, 0.5, 0.85] },
    rakko: {   // 피리 — 길게 떨리는 숨소리 · 거문고처럼 뜯는 아르페지오
      lead: { o: [['sine'], ['triangle', 2, 0, 0.1]], atk: 0.06, vib: 18, sus: 1, v: 0.9 }, bass: { o: [['sawtooth']], cut: [600, 400] }, arp: { o: [['triangle']], cut: [4000, 800], dec: 0.1, v: 1.2 }, dr: [1.4, 1500, 0.7, 0.3] },
    shisa: {   // 산신(오키나와 세 줄 악기) — 쨍하게 튕기는 소리
      lead: { o: [['square', 1, 0, 0.6], ['sawtooth', 2, 0, 0.4]], cut: [7000, 900], dec: 0.06, q: 8, v: 0.8 }, bass: { o: [['triangle']], v: 1.4 }, arp: { o: [['square']], cut: [5000, 700], dec: 0.05, q: 6, v: 0.8 }, dr: [1.1, 2600, 0.9, 0.5] },
    kani: {   // 마림바 — 바닷가처럼 통통
      lead: { o: [['sine'], ['sine', 4, 0, 0.25]], ring: 0.35, atk: 0.003, v: 1.3 }, bass: { o: [['sine'], ['sine', 2, 0, 0.3]], v: 1.6 }, arp: { o: [['sine'], ['sine', 4, 0, 0.2]], ring: 0.15, v: 1.1 }, dr: [1, 2000, 0.8, 0.5] },
  }
  function boot() {
    if (ac) return ac.state === 'suspended' && ac.resume()
    const C = window.AudioContext || window.webkitAudioContext; if (!C) return
    ac = new C(); out = ac.createGain(); out.connect(ac.destination); mus = ac.createGain(); mus.connect(out); pump = ac.createGain(); pump.connect(mus); sfx = ac.createGain(); sfx.gain.value = 0.55; sfx.connect(out)
    const b = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; noise = b
    vol(); if (theme) play(theme, true, who)
  }
  /** 음 하나 — 파형 · 길이 · 크기 · (끝 음으로 미끄러지기) · (떨림) */
  function tone(f, t, len, type = 'square', vol = 0.2, bus = sfx, f2 = 0, vib = 0) {
    const o = ac.createOscillator(), g = ac.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + len)
    if (vib) { const l = ac.createOscillator(), lg = ac.createGain(); l.frequency.value = 9; lg.gain.value = vib; l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + len) }
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + len)
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + len + 0.02)
  }
  function hiss(t, len, vol, hz = 7000, bus = sfx) { const n = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain(); n.buffer = noise; f.type = 'bandpass'; f.frequency.value = hz; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + len); n.connect(f); f.connect(g); g.connect(bus); n.start(t); n.stop(t + len) }
  /** 악기 한 음 — 파형 여럿을 겹치고(V.o) · 찌그러뜨리고(drive) · 필터를 닫으며 뜯는 소리(cut) · 떨림(vib) · 길게 끌기(sus) · 울림 길이(ring) */
  function inst(f, t, len, vol, bus, V) {
    f *= 2 ** (V.oct || 0); len = V.ring || len; vol *= V.v || 1
    const g = ac.createGain(), a = V.atk || 0.008, end = t + Math.max(len, a + 0.03); let into = g
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + a); if (V.sus) g.gain.setValueAtTime(vol, t + len * 0.8); g.gain.exponentialRampToValueAtTime(0.0001, end); g.connect(bus)
    if (V.cut) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.Q.value = V.q ?? 3; fl.frequency.setValueAtTime(V.cut[0], t); fl.frequency.exponentialRampToValueAtTime(V.cut[1], t + Math.min(len, V.dec || 0.25)); fl.connect(into); into = fl }
    if (V.drive) { const w = ac.createWaveShaper(); w.curve = CRUNCH; w.connect(into); into = w }
    let lg = null; if (V.vib) { const l = ac.createOscillator(); lg = ac.createGain(); l.frequency.value = 5.5; lg.gain.value = V.vib; l.connect(lg); l.start(t); l.stop(end + 0.03) }
    for (const [type, r = 1, det = 0, k = 1] of V.o) {
      const o = ac.createOscillator(), og = ac.createGain(); o.type = type; o.frequency.value = f * r; o.detune.value = det; og.gain.value = k
      if (lg) lg.connect(o.detune); o.connect(og); og.connect(into); o.start(t); o.stop(end + 0.03)
    }
  }
  function chip(T, i, t, dt) {   // 8분음표 한 칸 — 네모파 리드 · 세모파 베이스
    i %= 32; const n = T.lead[i]
    if (n) tone(mtof(n), t, dt * 1.6, 'square', T.vol * 0.55, mus)
    if (i % 2 === 0) { tone(mtof(T.bass[(i / 2 | 0) % 8]), t, dt * 1.8, 'triangle', T.vol * 1.1, mus); if (i % 4 === 0) tone(150, t, 0.12, 'sine', T.vol * 0.9, mus, 50) }
    hiss(t, 0.04, T.vol * (i % 2 ? 0.18 : 0.3), 8000, mus)
  }
  function electro(T, i, t, dt) {   // 16분음표 한 칸 — 4비트 킥(베이스 · 아르페지오가 출렁) · 박수 · 하이햇 · 옥타브 베이스 · 아르페지오 · 리드. 악기는 kit
    const s = i % 16, nb = T.chords.length, bar = (i >> 4) % nb, [root, ...tri] = CH[T.chords[bar]], v = T.vol, fill = bar === nb - 1 && s >= 8, [kk, clap, hh, dip] = kit.dr
    const B = T.bells   // 겨울 — 킥은 부드럽게 · 박수 대신 썰매 방울 · 마디 머리에 글로켄
    if (s % 4 === 0) { tone(160, t, 0.16, 'sine', v * kk * (B ? 0.7 : 1), mus, 42); pump.gain.setValueAtTime(B ? (1 + dip) / 2 : dip, t); pump.gain.linearRampToValueAtTime(1, t + dt * 3) }
    if (B) {
      if (s % 2 === 0) { hiss(t, 0.05, v * hh * (s % 4 ? 0.22 : 0.4), 11000, mus); hiss(t + dt * 0.35, 0.04, v * hh * 0.16, 12500, mus) }   // 짤랑 짤랑 — 8분음표마다 두 번
      if (s === 4 || s === 12) hiss(t, 0.12, v * 0.38, 6500, mus)   // 뒷박 — 살짝 흔드는 방울
      if (s === 0 && bar % 2 === 0) for (const [d, k] of [[24, 0.16], [31, 0.1]]) tone(mtof(root + d), t + (d === 31 ? dt : 0), 0.9, 'sine', v * k, mus)   // 반짝 — 글로켄
    } else {
      if (s === 4 || s === 12 || fill) hiss(t, fill ? 0.08 : 0.14, v * (fill ? 0.4 + (s - 8) * 0.07 : 0.9), clap, mus)   // 마지막 마디는 박수를 굴려 처음으로
      hiss(t, s % 4 === 2 ? 0.09 : 0.03, v * hh * (s % 4 === 2 ? 0.35 : 0.14), 9000, mus)
    }
    if (s % 2 === 0) inst(mtof(root + (s % 4 ? 12 : 0)), t, dt * 1.6, v * 0.8, pump, kit.bass)
    if (bar >= 4) inst(mtof(tri[s % 3] + ((s >> 2) % 2) * 12), t, dt * 0.9, v * 0.16, pump, kit.arp)   // 다섯째 마디부터
    if (s % 2) return
    const L = T.lead, k = (i >> 1) % L.length, n = L[k]; if (n < 2) return
    let len = 1; while (L[(k + len) % L.length] === 1) len++
    inst(mtof(n), t, dt * 2 * len * 0.92, v * 0.35, mus, kit.lead)
  }
  function tick() {   // 조금 앞서 음을 예약한다
    const T = THEMES[theme]; if (!T || !ac) return
    const dt = 60 / T.bpm / (T.chords ? 4 : 2)
    while (at < ac.currentTime + 0.15) { (T.chords ? electro : chip)(T, step, at, dt); at += dt; step++ }
  }
  function play(name, force, id = '') {   // 곡 바꾸기(같은 곡 · 같은 악기면 그대로) — id: 캐릭터(악기, KIT)
    if (SIM && !SIM.watch) return   // 모의 토벌 건너뛰기(그리지 않고 계산) — 소리 없이. 관전은 소리 그대로
    if (name === theme && id === who && !force && timer) return
    theme = name; who = id; kit = KIT[id] || KIT['']; if (!ac) return
    clearInterval(timer); timer = 0; step = 0; at = ac.currentTime + 0.05
    if (name) timer = setInterval(tick, 30)
  }
  function vol() {   // 배경음 · 효과음 크기를 따로(일시정지면 배경음을 줄인다)
    if (ac) { out.gain.value = 0.9; mus.gain.setTargetAtTime(save.bgm * duck, ac.currentTime, 0.05); sfx.gain.setTargetAtTime(save.sfx * 0.6, ac.currentTime, 0.03) }
    if (btn) btn.replaceChildren(ic(save.bgm || save.sfx ? 'snd' : 'mute'))
  }
  const ok = (k, gap) => { if (!ac || !save.sfx || (SIM && !SIM.watch)) return false; const t = ac.currentTime; if (last[k] && t - last[k] < gap) return false; last[k] = t; return true }
  // 캐릭터 목소리 — 높이 · 파형 · 떨림이 다른 짧은 삐약 소리(기쁠 때는 올라가고, 아플 때는 내려간다)
  const VOICE = { chiikawa: [880, 'triangle', 30], hachiware: [700, 'sine', 14], usagi: [1050, 'square', 8], momonga: [820, 'sawtooth', 20], kurimanju: [430, 'triangle', 16], rakko: [360, 'square', 4], shisa: [640, 'triangle', 18], kani: [560, 'sine', 12] }
  const api = {
    boot, play,
    set(k, v) { save[k] = Math.max(0, Math.min(1, v)); persist(); vol() },
    duck(on) { duck = on ? 0.35 : 1; vol() },
    voice(id, mood = 'happy') {
      if (!ok('voice', 0.35)) return; const [f, type, vib] = VOICE[id] || VOICE.chiikawa, t = ac.currentTime
      if (mood === 'happy') { tone(f, t, 0.12, type, 0.16, sfx, f * 1.35, vib); tone(f * 1.2, t + 0.13, 0.16, type, 0.15, sfx, f * 1.6, vib) }
      else if (mood === 'cry') { tone(f * 1.1, t, 0.5, type, 0.15, sfx, f * 0.6, vib * 1.6) }
      else tone(f * 1.15, t, 0.16, type, 0.15, sfx, f * 0.7, vib)
    },
    hit() { if (ok('hit', 0.07)) hiss(ac.currentTime, 0.035, 0.12, 2500) },
    kill() { if (ok('kill', 0.06)) tone(520 + Math.random() * 120, ac.currentTime, 0.08, 'sine', 0.16, sfx, 1100) },
    gem() { if (ok('gem', 0.05)) tone(1500 + Math.random() * 300, ac.currentTime, 0.06, 'sine', 0.08, sfx, 2100) },
    level() { if (!ok('level', 0.3)) return; const t = ac.currentTime; [72, 76, 79, 84].forEach((n, i) => tone(mtof(n), t + i * 0.07, 0.2, 'triangle', 0.18)) },
    chest() { if (!ok('chest', 0.3)) return; const t = ac.currentTime; [79, 84, 88, 91, 96].forEach((n, i) => tone(mtof(n), t + i * 0.05, 0.25, 'sine', 0.14)) },
    hurt(id) { if (!ok('hurt', 0.25)) return; tone(160, ac.currentTime, 0.14, 'square', 0.14, sfx, 70); api.voice(id, 'ouch') },
    boss() { if (!ok('boss', 1)) return; const t = ac.currentTime; tone(110, t, 0.45, 'sawtooth', 0.14, sfx, 82, 6); tone(98, t + 0.4, 0.6, 'sawtooth', 0.14, sfx, 70, 8); tone(55, t, 1, 'sine', 0.2, sfx) },   // 보스 — 낮은 으르렁 소리
    siren() {   // 세이렌 등장 — 낮은 울림 · 밀려오는 파도 · 하프 글리산도(가단조) · 떨리며 올라가는 「아아—」 노랫소리 두 목소리
      if (!ok('siren', 3)) return; const t = ac.currentTime, V = { o: [['sine'], ['sine', 2, 0, 0.12], ['triangle', 1, 7, 0.25]], atk: 0.22, sus: 1, vib: 24 }
      tone(55, t, 1.4, 'sine', 0.2, sfx, 38); hiss(t, 1.6, 0.14, 450); hiss(t + 0.35, 1.3, 0.09, 1300)
      ;[57, 60, 64, 69, 72, 76, 81, 84].forEach((n, i) => tone(mtof(n), t + 0.12 + i * 0.06, 1.2, 'triangle', 0.07))
      inst(mtof(76), t + 0.7, 0.55, 0.09, sfx, V); inst(mtof(81), t + 1.2, 1.4, 0.1, sfx, V); inst(mtof(72), t + 1.2, 1.4, 0.05, sfx, V)
    },
    ice() { if (!ok('ice', 0.3)) return; const t = ac.currentTime; tone(2600, t, 0.14, 'triangle', 0.09, sfx, 1500); tone(3700, t + 0.03, 0.12, 'sine', 0.07, sfx, 2400); tone(1900, t + 0.06, 0.16, 'triangle', 0.05, sfx, 1200); hiss(t, 0.22, 0.14, 5200) },   // 얼음 깨짐 — 쨍그랑
    dark() { if (!ok('dark', 1)) return; const t = ac.currentTime; tone(70, t, 1.6, 'sawtooth', 0.16, sfx, 40, 3); hiss(t, 1.2, 0.18, 400) },
    end(win) { play(''); if (!ac || !save.sfx) return; const t = ac.currentTime; (win ? [72, 76, 79, 84, 88] : [72, 67, 64, 60]).forEach((n, i) => tone(mtof(n), t + i * (win ? 0.11 : 0.18), win ? 0.3 : 0.4, 'triangle', 0.18)) },
  }
  let btn = null
  api.button = b => {   // 소리 단추 — 가운데 창에서 배경음 · 효과음 크기를 따로. 게임 중에 열면 멈추고, 닫으면 이어서
    btn = b; vol()
    const row = (k, pic, name) => { const v = h('b', {}, Math.round(save[k] * 100)), r = h('input', { type: 'range', min: 0, max: 100, step: 5, value: Math.round(save[k] * 100), name: k, 'aria-label': tr`${name} 크기` })
      r.oninput = () => { api.set(k, r.value / 100); v.textContent = r.value; if (k === 'sfx') api.kill() }; return h('label', {}, h('span', {}, pic, ' ', name), r, v) }
    const close = () => { if (box.hidden) return; box.hidden = true; if (mode === 'sound') { mode = 'play'; pauseBtn.hidden = false } }
    const box = h('div', { id: 'sndm', hidden: true, role: 'dialog', 'aria-label': tr`소리 크기` }, h('div', { class: 'panel snd' }, h('p', { class: 'h' }, ic('snd'), tr` 소리 크기`), row('bgm', ic('bgm'), tr`배경음`), row('sfx', ic('sfx'), tr`효과음`), h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn main', onclick: close }, tr`닫기`))))
    box.onpointerdown = e => { if (e.target === box) close() }   // 바깥(어두운 곳)을 눌러도 닫힌다
    document.body.append(box)
    b.onclick = e => { e.stopPropagation(); boot(); if (!box.hidden) return close(); box.hidden = false; if (mode === 'play') { mode = 'sound'; calm(); pauseBtn.hidden = true } }
    api.open = () => !box.hidden; api.close = close
  }
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) addEventListener(ev, boot, { passive: true })
  return api
})()

function h(tag, props, ...kids) {
  const e = document.createElement(tag)
  for (const k in props || {}) { const v = props[k]; if (v == null || v === false) continue; if (k.startsWith('on')) e[k] = v; else if (k === 'class') e.className = v; else e.setAttribute(k, v) }
  for (const k of kids.flat(9)) if (k != null && k !== false) e.append(k instanceof Node ? k : String(k))
  return e
}

// ---------------------------------------------------------------- 그림 — 코드로 그린 캐릭터(발밑이 0, 0)
// 생김새는 공식 디자인(아래가 넓은 찹쌀떡 몸 · 몸 실루엣에 이어진 귀와 팔 · 가는 선 · 작게 모인 얼굴 · 빗금 볼터치)과 나무위키 「먼작귀/등장인물」 설명을 참고해 새로 그렸다.
// 그리는 함수는 모두 (g, p) — p = 자세 { foot 발(-1 · 0 · 1), arm 팔, bob 몸 들썩임, blink 눈 감기, hurt 아픈 얼굴, look 얼굴을 보는 쪽으로 }. 걷기 · 숨 · 아픈 얼굴은 이 자세로 미리 따로 그려 둔다
const OUT = '#3d302b', FONT = `"Jua", ${CJK ? `"${CJK}", ` : ''}system-ui, sans-serif`
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
      g.lineWidth = 0.85; g.beginPath(); g.moveTo(x + s * 1.2, y - 1.1); g.lineTo(x - s * 0.9, y); g.lineTo(x + s * 1.2, y + 1.1); g.stroke()   // > < — 꼭짓점이 코 쪽
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
/** 칠하는 색만 바꾼 붓(테두리는 그대로) — 의상을 입으면 귀를 옷 색으로 그릴 때 */
const tintCtx = (g, col) => new Proxy(g, { get: (t, k) => { const v = t[k]; return typeof v === 'function' ? v.bind(t) : v }, set: (t, k, v) => { t[k] = k === 'fillStyle' && v !== OUT ? col : v; return true } })
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
  const hd = p.wskin?.hold || o.hold, hold = thin && hd && !p.bare, hx = thin ? ax + 1.7 : ax, hy = thin ? ay + 1.8 - arm * 0.6 : ay - arm * 1.1   // 쥔 손 자리
  const legs = edge => { for (const s of [-1, 1]) { const ph = s * foot, up = Math.max(0, ph) * 0.9, dx = ph * 0.8; tube([s * 3.1, -2.6 - bob, s * 3.1 + dx * 0.5, L - 1.2 - bob - up * 0.5, s * 3.1 + dx, L - 0.95 - up - bob], 1.9, limb, edge) } }   // 짧은 두 다리 — 걸을 때 번갈아 들어 가는 쪽으로 내딛는다
  const arms = edge => {
    for (const s of [-1, 1]) {
      if (s > 0 && hold) { tube([ax, ay, ax + 1.4, ay + 0.5, hx, hy], 1.35, af, edge); continue }   // 든 손 쪽 팔
      if (o.arms === 'none') continue
      const sw = -s * arm; tube([s * ax, ay, s * (ax + 1.1) + sw * 0.5, ay + 0.6, s * (ax + 1.5) + sw * 1.1, ay + 1.8 - Math.abs(sw) * 0.3], 1.35, af, edge)   // 늘어뜨린 팔 — 발과 엇갈려 흔든다
    }
  }
  const O = p.outfit, q = O && { W, H, hw, t, y: f => t + H * f, mid, ay, ax, P, look: p.look || 0, neck: ay - 0.5, fur: o.fur }   // neck — 목(팔이 붙는 높이), 옷은 여기서부터   // 의상 — 몸 크기를 넘겨 몸에 맞게 그린다
  g.save(); g.translate(0, -L)
  if (!thin) { if (O?.backFirst) O.back(g, q, p); o.back?.(g, p); if (!O?.backFirst) O?.back?.(g, q, p) }
  if (!thin && o.feet !== false) for (const s of [-1, 1]) { const lift = Math.max(0, s * foot); blob(g, s * (3.3 + lift * 0.5), -0.9 - lift * 1.4, 2.3, 1.35, limb, LW) }   // 작은 발 — 걸을 때 번갈아 든다
  g.save(); g.translate(0, bob)
  if (thin) { if (O?.backFirst) O.back(g, q, p); o.back?.(g, p); if (!O?.backFirst) O?.back?.(g, q, p); legs(true); arms(true) }   // 주인공은 뒤(꼬리 · 갈기 · 집게)도 몸과 함께 오르내린다
  g.fillStyle = o.fur; g.fill(P)
  if (o.cap) { g.save(); g.clip(P); o.cap(g, p, P); g.restore() }
  if (O?.body) { g.save(); g.clip(P); O.body(g, q, p); g.restore() }   // 옷 — 몸 테두리 안에(테두리는 위에 다시 긋는다)
  g.lineWidth = LW; g.strokeStyle = OUT; g.lineJoin = 'round'; g.stroke(P)
  if (o.fluffy) fluff(g, S, t + H / 2)
  if (thin) legs(false)
  const ears = () => o.ears?.(O?.earCol ? tintCtx(g, O.earCol) : g, p, P)   // 의상을 입어도 그 친구의 귀 모양 그대로 — 후드면 옷 색으로(earCol)
  if (!O?.noEars && !O?.earsOver) ears()
  if (thin) arms(false)
  else if (o.arms === 'cheek') for (const s of [-1, 1]) blob(g, s * 7.6, t + H * 0.62 - s * arm * 0.5, 1.7, 2.1, af, 0.6)   // 볼 아래에 댄 두 손
  else if (o.arms !== 'none') for (const s of [-1, 1]) bump(g, s * ax, ay - s * arm * 1.1, 1.7, 2.4, s * 0.45, af, s > 0 ? -1.7 : Math.PI - 1.9, s > 0 ? 1.9 : Math.PI + 1.7)   // 팔 — 몸 옆에 붙은 작은 혹, 발과 엇갈려 오르내린다
  g.save(); g.translate(p.look || 0, 0); o.face(g, p); g.restore()
  O?.head?.(g, q, p)   // 모자 · 머리띠 — 귀 · 얼굴 위에
  if (O?.earsOver && !O.noEars) ears()   // 모자는 귀가 뚫고 나온다
  if (p.wskin && o.frontHold && !p.wskin.over) p.wskin.front?.(g, p); else { o.front?.(g, p); if (p.wskin?.over) p.wskin.front?.(g, p) }   // over — 원래 무기 위에 덧그리는 스킨(쉬움 감기)   // 무기 스킨을 끼우면 원래 든 것(앞에 그린 잔 · 책) 자리에 스킨을
  if (hd && !p.bare) { hd(g, hx, hy); thin ? blob(g, hx + 0.1, hy + 0.1, 1.15, 1.25, af, 0.6) : blob(g, hx + 0.3, hy + 0.4, 1.7, 2.1, af, 0.6) }   // 든 것 — 쥔 손을 위에
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
function guitar(g, bodyCol = '#f0a75a', neckCol = '#8a5a3c') {   // (0, 0) 이 몸통, 목은 +x(무기 스킨은 색만 바꾼다)
  for (const [c, lw] of [[OUT, 2.8], [neckCol, 1.4]]) { g.strokeStyle = c; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath(); g.moveTo(2.6, 0); g.lineTo(12, 0); g.stroke() }
  blob(g, 13, 0, 1.5, 1.2, neckCol, 0.8)
  const body = () => { g.beginPath(); g.ellipse(-2.4, 0, 3.7, 3.4, 0, 0, TAU); g.ellipse(1.4, 0, 2.8, 2.5, 0, 0, TAU) }
  g.strokeStyle = OUT; g.lineWidth = 1.8; body(); g.stroke(); g.fillStyle = bodyCol; body(); g.fill()
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
    back: (g, p) => {   // 하얀 망토 — 몸 뒤에서 양옆과 아래로 살짝 보이고, 뒤쪽 자락이 펄럭인다(의상을 입으면 뺀다)
      if (p.outfit) return
      const v = (p.foot || 0) * 0.4, C = new Path2D(); C.moveTo(-8, y(0.66)); C.lineTo(-11.2 - v, y(1.03)); C.quadraticCurveTo(-5.6, y(1.07), 0, y(1.04)); C.quadraticCurveTo(5.6, y(1.07), 11.2 - v, y(1.03)); C.lineTo(8, y(0.66)); C.closePath()
      g.fillStyle = '#fff'; g.fill(C); g.lineWidth = 0.6; g.strokeStyle = OUT; g.lineJoin = 'round'; g.stroke(C)
      const w = (p.foot || 0) * 0.6; g.beginPath(); g.moveTo(-7.6, y(0.66)); g.quadraticCurveTo(-15.6, y(0.66) + w, -16.4, y(1) - w); g.lineTo(-14, y(0.92)); g.lineTo(-12.6, y(1.02) + w * 0.5); g.quadraticCurveTo(-10.4, y(0.9), -8.4, y(0.98)); g.closePath(); g.fillStyle = '#fff'; g.fill(); g.lineWidth = 0.65; g.strokeStyle = OUT; g.stroke() },   // 크게 펄럭이는 망토   // 망토 자락
    cap: (g, p) => { if (p.outfit) return; const P = new Path2D(); P.moveTo(-14, y(0.58)); P.quadraticCurveTo(0, y(0.7), 14, y(0.58)); P.lineTo(14, y(0.74)); P.quadraticCurveTo(0, y(0.86), -14, y(0.74)); P.closePath(); g.fillStyle = '#fff'; g.fill(P); g.strokeStyle = OUT; g.lineWidth = 0.6; g.stroke(P) },   // 하얀 목도리
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
    front: (g, p) => { if (!p.outfit) blob(g, 0, y(0.79), 1.3, 0.95, black, 0.5) },   // 목도리 매듭 — 목도리 · 망토 · 매듭은 의상을 입으면 숨긴다
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
    frontHold: true,   // 앞에 그린 것이 든 무기(무기 스킨이면 뺀다)
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
        g.save(); g.translate(s * 6.8, y(0.06) + 2.4); g.rotate(s * 0.35 + (p.foot || 0) * 0.1 - s * (p.bob || 0) * 0.06)   // 머리 위 집게 — 잇는 막대 없이 머리에 바로 붙어 있다(원작처럼) · 걸을 때 흔들린다(밑동은 머리 뒤로 숨는다)
        g.beginPath(); g.moveTo(0, -1.2); g.bezierCurveTo(-3.9, -2, -3.9, -7.6, -0.5, -8); g.lineTo(-0.2, -5); g.lineTo(0.7, -7.8); g.bezierCurveTo(3.9, -7.2, 3.7, -2, 0, -1.2); g.closePath(); g.fillStyle = pink; g.fill(); g.lineWidth = 0.7; g.strokeStyle = OUT; g.stroke()
        g.restore()
      }
    },
    cap: g => { g.fillStyle = pink; g.beginPath(); g.moveTo(-14, y(0.27)); g.quadraticCurveTo(0, y(0.18), 14, y(0.27)); g.lineTo(14, y(-0.1)); g.lineTo(-14, y(-0.1)); g.fill() },
    face: (g, p) => {
      if (!p.hurt) { g.strokeStyle = OUT; g.lineWidth = 0.5; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 3, y(0.3)); g.lineTo(s * 5, y(0.27)); g.stroke() } }
      dotEyes(g, y(0.4), 4.2, 1.4, p); hatch(g, y(0.48), 7.6, 0.9); catMouth(g, y(0.49), p.hurt ? 1.1 : 0.55)
    },
    frontHold: true,   // 앞에 그린 것이 든 무기(무기 스킨이면 뺀다)
    front: g => { g.save(); bookAt(g); g.fillStyle = '#8fd14f'; g.fillRect(-2, -2.8, 4, 5.6); g.fillStyle = '#fff'; g.fillRect(1.1, -2.3, 0.7, 4.6); g.strokeStyle = OUT; g.lineWidth = 0.6; g.strokeRect(-2, -2.8, 4, 5.6); g.restore() },   // 초록 헌책
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
    back: (g, p) => blob(g, -10.3 - (p.foot || 0) * 0.15, -3.8, 1.3, 1.15, '#fff', LW),   // 아주 작은 동그란 꼬리 — 사스마타 반대쪽(왼쪽)
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
    back: (g, p) => {   // 파란 고양이 꼬리 — 기타 반대쪽(왼쪽)으로 뻗어 끝이 위로 휘고, 걸을 때 살랑
      const sw = (p.foot || 0) * 0.8; g.lineCap = 'round'
      for (const [c, lw] of [[OUT, 1.9 + LW * 2], [blue, 1.9]]) { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); g.moveTo(-8, -3.2); g.quadraticCurveTo(-13.4, -3, -13.4 + sw * 0.4, -5.6); g.stroke() }
    },
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
// 데카츠요 — 「뭔가 크고 강한 녀석」. 복슬복슬한 노란 털뭉치 · 몽실한 하얀 얼굴(끝이 둥근 줄무늬 뿔 둘 · 몽실 눈썹 · 반짝이는 큰 눈 · 발그레 볼 · 밤색 코 · 작은 송곳니 둘이 보이는 벌린 웃음) · 끝이 동그란 까만 팔 넷 · 짧은 까만 다리(노란 빛은 그릴 때 뒤에)
// 처음 만나는 보스라 무섭지 않게 — 뾰족한 이빨 줄 · 길게 늘어진 혀 · 세 손가락 팔 대신 둥글둥글하게
function dekatsuyo(g, p = {}) {
  const H = 23, y = f => at(H, f), f = p.foot || 0, yel = '#fbf0b2', ink = '#231a1e'
  const line = (q, w = 0.9) => { g.strokeStyle = ink; g.lineWidth = w; g.lineCap = g.lineJoin = 'round'; g.beginPath(); g.moveTo(q[0], q[1]); for (let i = 2; i < q.length; i += 2) g.lineTo(q[i], q[i + 1]); g.stroke() }
  for (const s of [-1, 1]) { const up = Math.max(0, s * f) * 1.4; line([s * 4, -6, s * 4.3, -1.6 - up], 1.6); blob(g, s * 5, -1.1 - up, 1.7, 1, ink, 0.4) }   // 짧은 까만 다리 · 동그란 발
  g.save(); g.translate(0, -4.2)
  mochi(g, {
    fur: yel, W: 27, H, mid: 0.48, arms: 'none', fluffy: true, feet: false,
    back: g => {
      for (const [yy, a] of [[0.44, -0.5], [0.66, 0.15]]) for (const s of [-1, 1]) { const w = (yy > 0.5 ? -1 : 1) * s * f * 0.6, ex = s * 16.4, ey = y(yy) - 1.6 + w; line([s * 11, y(yy), ex, ey], 1.5); blob(g, ex, ey, 1.25, 1.15, ink, 0.4) }   // 끝이 동그란 까만 팔 넷 — 번갈아 흔든다
    },
    face: (g, p) => {
      for (const s of [-1, 1]) {   // 줄무늬 뿔 — 얼굴 위에
        const P = new Path2D(); P.moveTo(s * 3.2, y(0.25)); P.quadraticCurveTo(s * 3.8, y(0.08), s * 5.6, y(0.03)); P.quadraticCurveTo(s * 6.9, y(0.01), s * 6.6, y(0.13)); P.quadraticCurveTo(s * 6.4, y(0.22), s * 5.8, y(0.27)); P.closePath()   // 끝이 둥근 뿔
        g.fillStyle = '#fdfcf8'; g.fill(P); g.save(); g.clip(P); g.strokeStyle = '#8a8f98'; g.lineWidth = 0.55; for (let k = 0; k < 3; k++) { const ff = 0.04 + k * 0.07; g.beginPath(); g.moveTo(s * 2.4, y(ff + 0.05)); g.lineTo(s * 8, y(ff - 0.03)); g.stroke() } g.restore()
        g.lineWidth = 0.6; g.strokeStyle = OUT; g.stroke(P)
      }
      const F = new Path2D(); for (let i = 0; i <= 72; i++) { const a = i / 72 * TAU, r = 1 + 0.06 * Math.cos(a * 7); F.lineTo(Math.cos(a) * 8.4 * r, y(0.46) + Math.sin(a) * 6.8 * r) } F.closePath()
      g.fillStyle = '#fffefb'; g.fill(F); g.lineWidth = 0.5; g.strokeStyle = 'rgba(61,48,43,.55)'; g.stroke(F)   // 몽실한 하얀 얼굴
      for (const s of [-1, 1]) { g.fillStyle = 'rgba(255,140,160,.5)'; g.beginPath(); g.ellipse(s * 5.9, y(0.54), 1.7, 0.95, 0, 0, TAU); g.fill() }   // 발그레 볼
      hatch(g, y(0.54), 5.9, 0.75)
      for (const s of [-1, 1]) {
        const ex = s * 3.6, ey = y(0.39)
        for (const k of [-1, 0, 1]) blob(g, ex + k * 1.1, ey - 3 - (k ? 0 : 0.4), 0.75, 0.7, '#fff', 0.4)   // 몽실 눈썹
        if (p.hurt) { blob(g, ex, ey, 2.3, 2.4, '#fff', 0.6); dotEyes(g, ey, ex, 1.2, p); continue }
        const ig = g.createLinearGradient(0, ey - 1.9, 0, ey + 1.9); ig.addColorStop(0, '#2c1d21'); ig.addColorStop(1, '#9a4656')
        blob(g, ex, ey, 2.1, 2.3, ig, 0.6)   // 반짝이는 큰 눈 — 아래로 붉은 기
        g.fillStyle = '#fff'; g.beginPath(); g.arc(ex - 0.6, ey - 0.75, 0.75, 0, TAU); g.fill(); g.beginPath(); g.arc(ex + 0.6, ey + 0.8, 0.35, 0, TAU); g.fill()
      }
      g.beginPath(); g.moveTo(-0.9, y(0.49)); g.quadraticCurveTo(0, y(0.47), 0.9, y(0.49)); g.quadraticCurveTo(0, y(0.545), -0.9, y(0.49)); g.fillStyle = '#8a5a44'; g.fill(); g.lineWidth = 0.4; g.strokeStyle = OUT; g.stroke()   // 작은 밤색 코
      const M = new Path2D(); M.moveTo(-2.6, y(0.57)); M.quadraticCurveTo(0, y(0.595), 2.6, y(0.57)); M.quadraticCurveTo(2.2, y(0.76), 0, y(0.77)); M.quadraticCurveTo(-2.2, y(0.76), -2.6, y(0.57)); M.closePath()
      g.fillStyle = '#5b2a33'; g.fill(M); g.save(); g.clip(M)
      g.fillStyle = '#f19aac'; g.beginPath(); g.ellipse(0, y(0.76), 1.8, 1.2, 0, 0, TAU); g.fill()   // 혀
      g.fillStyle = '#fff'; for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 0.8, y(0.578)); g.lineTo(s * 1.7, y(0.58)); g.quadraticCurveTo(s * 1.5, y(0.625), s * 1.25, y(0.627)); g.quadraticCurveTo(s * 0.95, y(0.62), s * 0.8, y(0.578)); g.fill() }   // 작은 송곳니 둘(끝이 둥글다)
      g.restore(); g.lineWidth = 0.55; g.strokeStyle = OUT; g.lineJoin = 'round'; g.stroke(M)   // 벌린 웃음
    },
  }, p)
  g.restore()
}
// 아노코 — 「커다란 토벌」의 대상(원래는 공장에서 일하던 작은 아이). 원작 · 팬아트 참고 — 크고 복슬한 하얀 몸(볼 옆 삐죽한 털 · 가슴 털 뭉치) · 아랫몸 갈색 · 머리 위 둥근 귀 ·
// 이마 가운데 주황 뿔(손발의 발톱 넷과 같은 색) · 큰 눈 — 하얀 눈에 옅은 회색 큰 눈동자가 코 쪽 아래로 치우치고 그 안에 「の」 같은 말림 한 줄 · 혀를 살짝 내민 ω 입 ·
// 올리브색 용 꼬리(아랫면은 마디진 흰 비늘). 덩치는 크지만 뚱뚱하지 않게 — 키가 크고 옆이 날씬한 몸
const AN = '#f29a4a'   // 아노코 뿔 · 발톱 주황
function cone(g, x, y, rot, k = 1) { g.save(); g.translate(x, y); g.rotate(rot); g.scale(k, k); g.beginPath(); g.moveTo(0, -1); g.quadraticCurveTo(2.4, -0.5, 3, 0); g.quadraticCurveTo(2.4, 0.5, 0, 1); g.closePath(); g.fillStyle = AN; g.fill(); g.lineWidth = 0.4; g.strokeStyle = OUT; g.stroke(); g.restore() }
function anoko(g, p = {}) {
  const H = 31, y = f => at(H, f), f = p.foot || 0, brown = '#b4865f', white = '#fffdfa'
  const fur = g.createRadialGradient(-3, y(0.25), 2, 0, y(0.45), 18); fur.addColorStop(0, '#ffffff'); fur.addColorStop(0.7, white); fur.addColorStop(1, '#ece5dc')
  g.rotate(f * 0.04)   // 걸을 때 살짝 좌우로 — 「파파 파야이야」 춤처럼
  mochi(g, {
    fur, limb: brown, W: 23, H, mid: 0.4, arms: 'none',
    back: g => {   // 올리브색 용 꼬리 — 등 쪽(보는 쪽 반대 · 왼쪽) 아래에서 위로 휘며 가늘어지고, 아랫면(안쪽)은 마디진 흰 비늘. 걸음마다 끝이 흔들린다(오른쪽 그림을 거울로)
      g.save(); g.translate(-8, y(0.86)); g.scale(-1, 1); g.rotate(f * 0.07)
      const T = new Path2D(); T.moveTo(-3, -5.4); T.bezierCurveTo(4, -6.4, 8.6, -9.4, 10.6, -16.6); T.quadraticCurveTo(12.6, -9.6, 9.4, -3.6); T.bezierCurveTo(6.6, 0.6, 1, 2, -3, 2.2); T.closePath()
      const U = new Path2D(); U.moveTo(-3, -5.4); U.bezierCurveTo(4, -6.4, 8.6, -9.4, 10.6, -16.6); U.bezierCurveTo(10.4, -11, 8, -6.2, 3, -3.6); U.quadraticCurveTo(0, -2.4, -3, -2.2); U.closePath()   // 안쪽(몸 쪽) 흰 비늘 띠
      g.lineJoin = 'round'; g.lineWidth = LW * 2; g.strokeStyle = OUT; g.stroke(T); g.fillStyle = '#7d9466'; g.fill(T); g.fillStyle = '#f6f2ea'; g.fill(U)
      g.strokeStyle = 'rgba(61,48,43,.6)'; g.lineWidth = 0.45; g.beginPath(); for (const [x0, y0, x1, y1] of [[0.4, -5.8, 0.4, -2.8], [3.4, -6.4, 3.4, -3.6], [6, -7.6, 5.6, -4.8], [8, -9.6, 7.4, -7], [9.4, -12.4, 8.8, -10]]) { g.moveTo(x0, y0); g.lineTo(x1, y1) } g.stroke()   // 비늘 마디
      g.strokeStyle = OUT; g.lineWidth = 0.5; g.stroke(U)
      g.restore()
    },
    cap: g => {   // 아랫몸 갈색 — 복슬한 경계
      const edge = () => { g.moveTo(-13, y(0.6)); for (let x = -13; x < 13; x += 2.6) g.quadraticCurveTo(x + 1.3, y(0.66), x + 2.6, y(0.6)) }
      g.fillStyle = brown; g.beginPath(); edge(); g.lineTo(13, 1); g.lineTo(-13, 1); g.fill()
      g.strokeStyle = 'rgba(61,48,43,.55)'; g.lineWidth = 0.5; g.beginPath(); edge(); g.stroke()
    },
    ears: g => {
      for (const s of [-1, 1]) topEar(g, s * 7.4, y(0.05), 2.7, white, s * 0.7)   // 머리 위 둥근 귀
      for (const s of [-1, 1]) {   // 볼 옆 삐죽한 털 — 뾰족한 털 끝 셋
        const pts = [[10.9, 0.2], [13.4, 0.25], [12.1, 0.29], [14.2, 0.34], [12.5, 0.38], [13.8, 0.44], [11.4, 0.5]].map(([x, f]) => [s * x, y(f)])
        g.beginPath(); pts.forEach(q => g.lineTo(...q)); g.closePath(); g.fillStyle = white; g.fill(); g.beginPath(); pts.forEach(q => g.lineTo(...q)); g.lineWidth = LW; g.strokeStyle = OUT; g.lineJoin = 'round'; g.stroke()
      }
      g.beginPath(); g.moveTo(-1.5, y(0.09)); g.quadraticCurveTo(-0.7, y(0.0), 0, y(-0.06)); g.quadraticCurveTo(0.7, y(0.0), 1.5, y(0.09)); g.closePath(); g.fillStyle = AN; g.fill(); g.lineWidth = 0.55; g.strokeStyle = OUT; g.stroke()   // 이마 가운데 주황 뿔
      g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.ellipse(-0.45, y(0.05), 0.28, 0.6, 0.2, 0, TAU); g.fill()
    },
    face: (g, p) => {
      if (p.hurt) dotEyes(g, y(0.31), 4.2, 1.5, p)
      else for (const s of [-1, 1]) {   // 큰 눈 — 하얀 눈 · 코 쪽 아래로 치우친 옅은 회색 큰 눈동자 · 그 안에 「の」 같은 말림 한 줄
        const ex = s * 4.4, ey = y(0.31), ix = ex - s * 0.6, iy = ey + 0.5
        blob(g, ex, ey, 2.9, 2.9, '#fff', 0.7)
        g.save(); g.beginPath(); g.ellipse(ex, ey, 2.9, 2.9, 0, 0, TAU); g.clip(); const ig = g.createRadialGradient(ix, iy + 0.8, 0.2, ix, iy, 2.2); ig.addColorStop(0, '#efe8df'); ig.addColorStop(1, '#cfc4b8'); blob(g, ix, iy, 2.15, 2.15, ig, 0.55); g.restore()
        const cx = ix - s * 0.55, cy = iy + 0.45; g.strokeStyle = 'rgba(61,48,43,.8)'; g.lineWidth = 0.42; g.lineCap = 'round'; g.beginPath(); for (let t = 0; t <= TAU * 0.95; t += 0.2) { const r = 0.12 + t * 0.1; g.lineTo(cx - s * Math.sin(t) * r, cy - Math.cos(t) * r) } g.stroke()   // 눈동자 코 쪽 아래의 작은 말림
        g.fillStyle = '#fff'; g.beginPath(); g.arc(ix + s * 0.75, iy - 0.85, 0.62, 0, TAU); g.fill(); g.beginPath(); g.arc(ix - s * 0.2, iy + 1.25, 0.28, 0, TAU); g.fill()   // 반짝임 둘
      }
      hatch(g, y(0.4), 8.4, 0.85); catMouth(g, y(0.4), p.hurt ? 1 : 0.75)
    },
    front: g => {
      const puffs = [[-5.6, 0.6, 2.1], [-2.8, 0.63, 2.3], [0, 0.64, 2.4], [2.8, 0.63, 2.3], [5.6, 0.6, 2.1], [-4, 0.53, 2.1], [-1.3, 0.55, 2.3], [1.3, 0.55, 2.3], [4, 0.53, 2.1], [0, 0.515, 2]].map(([x, f, r]) => ell(x, y(f), r, r * 0.9))
      g.strokeStyle = 'rgba(61,48,43,.38)'; g.lineWidth = 0.9; for (const P of puffs) g.stroke(P); g.fillStyle = '#fff'; for (const P of puffs) g.fill(P)   // 가슴의 특히 복슬한 털 뭉치 — 몽글몽글 겹친 털(바깥 테두리만)
      g.strokeStyle = 'rgba(61,48,43,.22)'; g.lineWidth = 0.4; g.beginPath(); for (const [x, f] of [[-3.6, 0.58], [0, 0.6], [3.6, 0.58], [-1.6, 0.51], [1.8, 0.51]]) { g.moveTo(x - 0.8, y(f)); g.quadraticCurveTo(x, y(f) + 0.7, x + 0.8, y(f)) } g.stroke()   // 털결
      for (const s of [-1, 1]) {   // 옆으로 내린 손 — 주황 발톱 넷
        const hx = s * 11.6, hy = y(0.6) + (s * f) * 0.4
        for (let k = 0; k < 4; k++) cone(g, hx + s * 0.6 + (k - 1.5) * 0.85, hy + 2, Math.PI / 2 + (k - 1.5) * 0.2, 0.55)
        blob(g, hx, hy, 2, 2.6, '#fff', LW)
      }
      for (const s of [-1, 1]) { const lift = Math.max(0, s * f) * 1.4; for (let k = 0; k < 4; k++) cone(g, s * (3.4 + lift * 0.35) + (k - 1.5) * 0.9, -0.8 - lift * 1.4, Math.PI / 2 + (k - 1.5) * 0.22, 0.6) }   // 발 — 주황 발톱 넷
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
// 최종보스라 다른 적보다 공들여 — 위로 길쭉한 몸(높은 상체), 몸 · 비늘에 은은한 명암, 진주 허리띠, 인어와 같은 짧은 꼬리, 인어 지느러미처럼 뻗은 팔 끝에 손가락 넷이 나뉜 손, 머리 윤기, 반짝이는 눈
function siren(g, angry = false, p = {}) {   // p.storm — 무한 3페이즈 「폭풍의 세이렌」(꼬리 · 비늘 바다색, 차가운 흰 몸, 머리 하트 → 번개)
  const st = p.storm, f = p.foot || 0, red = st ? '#4f7fc9' : '#d46a6a', deep = '#9c4040', black = '#1f1715', px = g.getTransform().a
  const CY = -17.2, RX = 14.6, RY = 16.2   // 몸 — 위로 길쭉(상체가 높다)
  const wave = x => -8.6 + 1.3 * (1 - (x / RX) ** 2)   // 아랫몸 경계 — 가운데가 앞으로 볼록
  // 꼬리 — 인어와 같은 모양으로 짧게: 등 쪽(보는 쪽 반대 · 왼쪽) 아래 몸 속에서 가늘게 이어져 나와 지느러미로 벌어진다(걸음마다 살랑) — 오른쪽 그림을 거울로
  g.save(); g.scale(-1.45, 1.45)
  g.beginPath(); g.moveTo(3, -5.2); g.quadraticCurveTo(6.4, -3.6, 8.2, -3.5); g.quadraticCurveTo(9.4, -4.2, 10.6, -5.6 + f * 0.6); g.quadraticCurveTo(10.4, -2.6, 11.4, -0.2 + f * 0.3); g.quadraticCurveTo(9.4, -1.2, 8.2, -2.3); g.quadraticCurveTo(5.4, -2, 2.4, -1.4); g.closePath()
  g.fillStyle = red; g.fill(); g.lineWidth = LW / 1.45; g.strokeStyle = OUT; g.stroke()
  g.strokeStyle = st ? 'rgba(30,50,110,.45)' : 'rgba(120,40,40,.45)'; g.lineWidth = 0.3; g.beginPath(); for (const [x, y] of [[10.2, -4.6], [10.4, -2.8], [10.6, -1]]) { g.moveTo(8.6, -2.9); g.lineTo(x, y) } g.stroke()   // 지느러미 결
  g.restore()
  // 나무 숟가락(오른손) — 손 뒤로 자루가 지나간다
  g.lineCap = 'round'; for (const [c, lw] of [[OUT, 1.9], ['#d8b48e', 1]]) { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); g.moveTo(15.2, -9.6); g.lineTo(19.4, -17); g.stroke() }
  { const sg = g.createRadialGradient(19.6, -19, 0.2, 20, -18.4, 2.2); sg.addColorStop(0, '#f3dcbc'); sg.addColorStop(1, '#cfa77c'); g.save(); g.translate(20, -18.4); g.rotate(0.5); blob(g, 0, 0, 1.5, 2.1, sg, 0.6); g.restore() }
  // 팔과 손 — 인어 지느러미처럼 몸 옆에서 바깥 아래로 뻗고, 끝은 손가락 넷이 나뉜 하얀 손(몸 뒤에 그려 이음새가 몸 테두리에 묻힌다)
  for (const s of [-1, 1]) {
    const cx = s * 15.8, cy = -10.6, arm = new Path2D(); arm.moveTo(s * 12.6, -15.8); arm.quadraticCurveTo(s * 16, -15.4, s * 16.8, -12.4); arm.lineTo(s * 14.4, -9); arm.quadraticCurveTo(s * 12.6, -9.4, s * 11.4, -10.2); arm.closePath()
    const palm = ell(cx, cy, 2.5, 2.2), fingers = [12, 46, 80, 114].map(d => { const a = d * Math.PI / 180; return ell(cx + s * Math.cos(a) * 2.15, cy + Math.sin(a) * 2, 1, 0.95) })
    union(g, [arm, palm, ...fingers], '#fff')
    g.strokeStyle = OUT; g.lineWidth = 0.45; g.lineCap = 'round'; g.beginPath(); for (const d of [29, 63, 97]) { const a = d * Math.PI / 180; g.moveTo(cx + s * Math.cos(a) * 1.3, cy + Math.sin(a) * 1.2); g.lineTo(cx + s * Math.cos(a) * 2.75, cy + Math.sin(a) * 2.6) } g.stroke()   // 손가락 사이 세 줄
  }
  // 머리 덩이 — 윤기 · 하트 장식
  for (const s of [-1, 1]) {
    blob(g, s * 7.8, -35.6, 5.1, 4.5, black, LW)
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 0.8; g.beginPath(); g.ellipse(s * 7.8, -35.6, 3.4, 2.8, 0, Math.PI * (s > 0 ? 1.15 : 1.25), Math.PI * (s > 0 ? 1.6 : 1.7)); g.stroke()
    if (st) { const x = s * 8.9; g.beginPath(); for (const [dx, dy] of [[0.9, -2.6], [-0.9, -0.2], [0.4, -0.2], [-0.9, 2.6], [0.9, 0.2], [-0.4, 0.2]]) g.lineTo(x + dx, -37 + dy); g.closePath(); g.fillStyle = '#ffd23f'; g.fill(); g.lineWidth = 0.5; g.strokeStyle = OUT; g.stroke() }   // 번개
    else { heart(g, s * 8.9, -37, 1.75, '#e0606c'); g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(s * 8.9 - 0.6, -37.6, 0.4, 0, TAU); g.fill() }
  }
  // 주인공처럼 머리와 몸이 나뉜다 — 볼 높이가 가장 넓은 큰 머리, 팔이 붙는 목에서 들어가고, 아랫몸은 꼬리 쪽으로 점점 좁아진다(주인공 몸 아래쪽만 더 갸름하게)
  const S = mochiSegs(RX * 2, RY * 2, 0.46, 0, true, 0.74, 0.66, 0.76), { jx, yj } = headJoin(RX * 2, RY * 2, 0.66, 0.76), be = RX * 0.26, my = yj + (-1 - yj) * 0.4
  S.splice(4, 3, [jx, yj, jx * 0.96, my, be * 1.4, -1, be, -1], [be, -1, be * 0.35, -0.7, -be * 0.35, -0.7, -be, -1], [-be, -1, -be * 1.7, -1, -jx * 1.02, my, -jx, yj])
  const B = segPath(S)
  g.lineWidth = LW * 2; g.strokeStyle = OUT; g.stroke(B)
  const bg = g.createRadialGradient(-4, -25, 1, 0, CY, 18); bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.62, st ? '#f3f6fb' : '#fbf8f5'); bg.addColorStop(1, st ? '#d9e0ec' : '#e6ddd6')
  g.fillStyle = bg; g.fill(B)
  g.save(); g.clip(B)
  // 앞머리 — 이마로 뾰족, 윤기 한 줄 · 볼을 따라 내려오는 짧은 옆머리
  g.fillStyle = black; g.beginPath(); g.moveTo(-15, -24.8); g.quadraticCurveTo(-8, -28.8, -1.6, -27.2); g.lineTo(0, -22.2); g.lineTo(1.6, -27.2); g.quadraticCurveTo(8, -28.8, 15, -24.8); g.lineTo(15, -35); g.lineTo(-15, -35); g.fill()
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 15, -26.2); g.quadraticCurveTo(s * 11.8, -24.4, s * 12.4, -18.6); g.quadraticCurveTo(s * 13.6, -20.6, s * 15.2, -20); g.fill() }
  g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(-9, -29.8); g.quadraticCurveTo(-4, -31.4, 1, -30.6); g.moveTo(4, -30.4); g.quadraticCurveTo(7, -30.6, 9.4, -29.6); g.stroke()
  // 붉은 비늘 아랫몸 — 아래로 짙어지고, 겹친 비늘마다 위쪽이 밝다
  const rg = g.createLinearGradient(0, -9, 0, 0); rg.addColorStop(0, st ? '#5b8ad6' : '#dd7676'); rg.addColorStop(1, st ? '#2f4f99' : '#a84a4a')
  g.fillStyle = rg; g.beginPath(); g.moveTo(-15, wave(-15)); for (let x = -15; x <= 15; x += 1) g.lineTo(x, wave(x)); g.lineTo(15, 2); g.lineTo(-15, 2); g.fill()
  for (let r = 3; r >= 0; r--) {
    const yy = -6.4 + r * 2.3, o = r % 2 ? 1.6 : 0
    for (let x = -16 + o; x < 16; x += 3.2) {
      g.beginPath(); g.arc(x, yy, 1.75, 0, Math.PI); g.fillStyle = r < 2 ? (st ? '#5583cf' : '#cf6363') : (st ? '#3f68b3' : '#b85252'); g.fill()
      g.strokeStyle = st ? 'rgba(20,35,90,.55)' : 'rgba(110,30,30,.55)'; g.lineWidth = 0.45; g.stroke()
      g.strokeStyle = st ? 'rgba(220,235,255,.5)' : 'rgba(255,220,220,.5)'; g.lineWidth = 0.35; g.beginPath(); g.arc(x, yy + 0.2, 1.1, Math.PI * 0.25, Math.PI * 0.6); g.stroke()
    }
  }
  if (angry) {   // 얼굴 그늘 — 위에서 내려오는 어둠 · 세로 줄
    const sg = g.createLinearGradient(0, -33, 0, -16); sg.addColorStop(0, st ? 'rgba(25,35,80,.62)' : 'rgba(50,15,60,.62)'); sg.addColorStop(1, st ? 'rgba(25,35,80,0)' : 'rgba(50,15,60,0)')
    g.fillStyle = sg; g.fillRect(-15, -34, 30, 18)
    g.strokeStyle = 'rgba(40,10,50,.4)'; g.lineWidth = 0.55; g.beginPath(); for (const x of [-7.6, -5, 5, 7.6]) { g.moveTo(x, -26.4); g.lineTo(x, -24) } g.stroke()
  }
  g.restore()
  // 진주 허리띠 — 몸을 따라 감기게(가장자리 진주는 몸 테두리에 묻힌다)
  g.save(); g.clip(B)
  for (let x = -12.6; x <= 12.7; x += 1.8) {
    const y = wave(x) - 0.2, r = 0.82
    const pg = g.createRadialGradient(x - 0.3, y - 0.3, 0.1, x, y, r); pg.addColorStop(0, '#fff'); pg.addColorStop(1, '#efd9d4')
    g.beginPath(); g.arc(x, y, r, 0, TAU); g.fillStyle = pg; g.fill(); g.strokeStyle = 'rgba(61,48,43,.6)'; g.lineWidth = 0.35; g.stroke()
  }
  g.restore()
  g.lineWidth = LW; g.strokeStyle = OUT; g.stroke(B)
  for (const s of [-1, 1]) { g.fillStyle = angry ? 'rgba(200,60,80,.25)' : 'rgba(255,140,160,.45)'; g.beginPath(); g.ellipse(s * 8.8, -15.6, 2.4, 1.3, 0, 0, TAU); g.fill() }   // 볼 발그레
  hatch(g, -15.6, 8.8, 0.75)
  for (const s of [-1, 1]) {   // 붉은 테 큰 눈 — 진한 윗눈꺼풀 · 바깥 속눈썹 · 반짝임 둘 · 화난 눈썹
    const ex = s * 5.2, ey = -20, ix = ex - s * 0.4
    blob(g, ex, ey, 3.4, 2.9, '#fff', 0.7)
    if (angry) { g.save(); g.shadowColor = '#ff2a2a'; g.shadowBlur = 2.2 * px }
    const ig = g.createRadialGradient(ix, ey + 1.2, 0.2, ix, ey + 0.4, 2.2); ig.addColorStop(0, angry ? '#ff9a7a' : '#e89a8a'); ig.addColorStop(1, angry ? '#ff1e1e' : '#a84848')
    g.fillStyle = ig; g.beginPath(); g.ellipse(ix, ey + 0.4, 2, 2.2, 0, 0, TAU); g.fill()
    if (angry) g.restore()
    g.fillStyle = '#2b1714'; g.beginPath(); g.ellipse(ix, ey + 0.5, 0.95, 1.35, 0, 0, TAU); g.fill()
    g.fillStyle = '#fff'; g.beginPath(); g.arc(ex - s * 1, ey - 0.4, 0.55, 0, TAU); g.fill(); g.beginPath(); g.arc(ex + s * 0.3, ey + 1.4, 0.28, 0, TAU); g.fill()
    g.strokeStyle = OUT; g.lineCap = 'round'; g.lineWidth = 1; g.beginPath(); g.ellipse(ex, ey, 3.4, 2.9, 0, Math.PI * 1.08, Math.PI * 1.92); g.stroke()   // 윗눈꺼풀
    g.lineWidth = 0.5; g.beginPath(); g.moveTo(ex + s * 3.1, ey - 1.4); g.lineTo(ex + s * 4.3, ey - 2.4); g.moveTo(ex + s * 3.4, ey - 0.4); g.lineTo(ex + s * 4.6, ey - 0.9); g.stroke()   // 속눈썹
    g.lineWidth = 0.75; g.beginPath(); g.moveTo(ex - s * 2.4, ey - (angry ? 3.4 : 3.9)); g.lineTo(ex + s * 0.9, ey - (angry ? 4.6 : 3.4)); g.stroke()   // 눈썹 — 화나면 가운데로 더 내려간다
    g.lineWidth = 0.45; g.beginPath(); for (let k = 0; k < 2; k++) { g.moveTo(s * 9.8, -14.8 + k * 1.6); g.lineTo(s * 12.8, -15.6 + k * 2) } g.stroke()   // 수염
  }
  catMouth(g, -15.6, angry ? 1.1 : 0.8)
  if (!angry) for (const [x, y, r] of [[-15.4, -37.6, 1.5], [16, -32.6, 1.1]]) { starP(g, x, y, r, r * 0.32, 4, 0); g.fillStyle = '#fff3b0'; g.fill(); g.strokeStyle = 'rgba(200,150,40,.7)'; g.lineWidth = 0.3; g.stroke() }   // 반짝
}
// 인어 — 세이렌의 코러스(원작 참고). 하얀 동그란 몸 · 이마 위 빨간 무늬와 작은 더듬이 둘 · 눈썹 없는 작은 점 눈 · 크게 벌린 「오」 입(윗니) · 팔 대신 양옆 작은 흰 지느러미 · 붉은 비늘 아랫몸 · 꼬리지느러미
const MER = [{ red: '#d86868' }, { red: '#e07a8e' }, { red: '#d9785a' }]
function mermaid(g, o, p = {}) {
  const f = p.foot || 0, red = o.red
  g.save(); g.scale(-1, 1)   // 꼬리는 등 쪽(보는 쪽 반대 · 왼쪽) — 오른쪽 그림을 거울로
  g.beginPath(); g.moveTo(3, -5.2); g.quadraticCurveTo(6.4, -3.6, 8.2, -3.5); g.quadraticCurveTo(9.4, -4.2, 10.6, -5.6 + f); g.quadraticCurveTo(10.4, -2.6, 11.4, -0.2 + f * 0.5); g.quadraticCurveTo(9.4, -1.2, 8.2, -2.3); g.quadraticCurveTo(5.4, -2, 2.4, -1.4); g.closePath(); g.fillStyle = red; g.fill(); g.lineWidth = LW; g.strokeStyle = OUT; g.stroke()   // 꼬리 — 몸 속에서 가늘게 이어져 나와 지느러미로 벌어진다(이음새가 뜨지 않게)
  g.restore()
  const S = mochiSegs(16.4, 17.4, 0.5, 0, true, 0.54), hw = 8.2, m = -9.7, be = hw * 0.22, cy = m + (-1 - m) * 0.35   // 가운데(m)가 가장 넓고 아래로 점점 좁아지는 몸
  S.splice(1, 3, [hw, m, hw, cy, hw * 0.5, -1, be, -1], [be, -1, be * 0.35, -0.7, -be * 0.35, -0.7, -be, -1], [-be, -1, -hw * 0.5, -1, -hw, cy, -hw, m])
  const B = segPath(S)
  g.fillStyle = '#fbfaf8'; g.fill(B); g.save(); g.clip(B)
  g.fillStyle = '#efa1a1'; g.fillRect(-9, -7.8, 18, 1.4); g.fillStyle = red; g.fillRect(-9, -6.4, 18, 7)
  g.strokeStyle = 'rgba(70,20,20,.6)'; g.lineWidth = 0.5; for (const [yy, ox] of [[-4.6, 0], [-2, 1.4]]) { g.beginPath(); for (let x = -8 + ox; x < 8; x += 2.8) { g.moveTo(x, yy); g.arc(x + 1.4, yy, 1.4, Math.PI, 0, true) } g.stroke() }
  g.restore(); g.lineWidth = LW; g.strokeStyle = OUT; g.stroke(B)
  g.save(); g.clip(B); const cap = new Path2D(); cap.ellipse(0, -17.4, 3.9, 3.2, 0, 0, TAU); g.fillStyle = red; g.fill(cap); g.restore()   // 이마 위 빨간 무늬
  g.save(); g.clip(B); g.lineWidth = 0.6; g.strokeStyle = OUT; g.stroke(cap); g.restore(); g.lineWidth = LW; g.strokeStyle = OUT; g.stroke(B)
  g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 0.45; g.lineCap = 'round'; g.beginPath(); g.moveTo(-2, -16.2); g.quadraticCurveTo(-1.6, -17.4, -0.6, -17.9); g.stroke()   // 무늬 윤기
  g.strokeStyle = OUT; g.lineWidth = 0.5; g.beginPath(); for (const s of [-1, 1]) { g.moveTo(s * 0.7, -18.3); g.quadraticCurveTo(s * 0.8, -19.3, s * 1.3, -19.8) } g.stroke()   // 작은 더듬이 둘
  g.fillStyle = '#2b211d'; for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 2.4, -13.4, 0.55, 0, TAU); g.fill() }   // 눈썹 없는 작은 점 눈
  g.beginPath(); g.ellipse(0, -10.6, 1.35, 2, 0, 0, TAU); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.ellipse(0, -12.1, 0.8, 0.42, 0, 0, Math.PI); g.fill()   // 크게 벌린 「오」 입 · 윗니
  for (const s of [-1, 1]) {   // 팔 대신 양옆 작은 흰 지느러미 — 몸에서 바깥 아래로 뻗어 끝이 둥글다, 결 한 줄
    g.beginPath(); g.moveTo(s * 7, -8.6); g.quadraticCurveTo(s * 9.4, -9.6, s * 10.4, -8.2); g.quadraticCurveTo(s * 10.6, -6.4, s * 9.2, -5.8); g.quadraticCurveTo(s * 8.4, -6.8, s * 6.4, -6.2)
    g.fillStyle = '#fff'; g.fill(); g.lineWidth = LW; g.strokeStyle = OUT; g.stroke()
    g.lineWidth = 0.35; g.beginPath(); g.moveTo(s * 8, -7.6); g.quadraticCurveTo(s * 9, -7.8, s * 9.6, -7.2); g.stroke()
  }
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
  anoko: [112, 96, (g, p) => { big(g, 2.4); anoko(g, p) }],
  darkstar: [90, 58, (g, p) => { big(g, 1.6); darkStar(g, p) }],
  mermaid: [40, 36, (g, p) => { big(g, 1.4); mermaid(g, MER[0], p) }],
  mermaid1: [40, 36, (g, p) => { big(g, 1.4); mermaid(g, MER[1], p) }],
  mermaid2: [40, 36, (g, p) => { big(g, 1.4); mermaid(g, MER[2], p) }],
  siren: [124, 112, (g, p) => { big(g, 2.4); siren(g, false, p) }],
  sirenAngry: [124, 112, (g, p) => { big(g, 2.4); siren(g, true, p) }],
  sirenStorm: [124, 112, (g, p) => { big(g, 2.4); siren(g, true, { ...p, storm: true }) }],
}
// 캐릭터 움직임 — 걷기 넷(발을 번갈아 들고 팔을 엇갈려 흔들고, 발을 모을 때 몸이 들썩) · 서 있기(숨 · 눈 깜빡) · 아픈 얼굴. 얼굴은 보는 쪽으로 조금
const WALK = [{ foot: 1, arm: 1 }, { bob: -1.3 }, { foot: -1, arm: -1 }, { bob: -1.3 }], LOOK = 1.2

function mk(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c }
/** w × h(월드 단위) 그림을 단위당 k 픽셀로 한 번 그려 둔다. ox, oy = 기준점(발밑) */
function sprite(w, h, ox, oy, paint, k = K) {
  const c = mk(w * k, h * k), g = c.getContext('2d'); g.scale(k, k); g.translate(ox, oy); g.lineJoin = g.lineCap = 'round'; paint(g)
  return { c, w, h, ox, oy }
}
const artSprite = (id, k = K, p = {}) => {   // p.outfit · p.wskin — 의상 날개 · 고리가 잘리지 않게 둘레를 넓힌다. p.xmas — 크리스마스 의상(XMAS)을 머리 위에(모자가 잘리지 않게 위로 칸을 늘린다)
  const [w0, h0, paint] = ART[id], d = p.outfit || p.wskin ? 16 : 0, w = w0 + d, h = h0 + d, X = p.xmas && XMAS[id], pad = X ? Math.round(h0 * 0.35) : 0
  return sprite(w, h + pad, w / 2, h - 3 + pad, g => { paint(g, p); if (X) { const [kind, x, y, cw, a] = X; xmas(g, kind, x, y, cw * (BOSS[id.replace(/Angry$/, '')] && !id.startsWith('mermaid') ? 0.65 : 0.9), a) } }, k)   // 모자 크기 — 일반 몬스터 90% · 보스는 크게 그려지니 65%
}
// 크리스마스 의상(겨울 테마) — [종류, 챙 가운데 x, y, 챙 너비, 기울기]. 그 그림 함수의 좌표(big 으로 키우기 전)라 보스도 같은 값. 늘어지는 끝은 보는 쪽(오른쪽) 반대로
const XMAS = {
  goblin: ['hat', 0, -20.8, 15, -0.08], rusher: ['hat', 0, -20.8, 15, -0.08], golden: ['hat', -4.6, -28.2, 8.5, -0.5], goblinKing: ['hat', -4.6, -28.2, 12, -0.5],   // 황금 고블린 · 고블린 대장 — 왕관 맨 뒤(보는 쪽 반대) 뾰족한 끝에 작은 모자를 뒤로 기울여 걸친다
  chimera: ['antler', 0, -19.4, 12], dekatsu: ['antler', 0, -19.4, 12], bigChimera: ['antler', 0, -19.4, 12],
  spiker: ['hat', 2.8, -19.6, 11, -0.1], bug: ['hat', 0, -21, 13], beetle: ['hat', 0, -19.6, 13, -0.06], star: ['hat', -1.8, -18.4, 10, -0.22],
  fugu: ['hat', 0, -18.4, 12, -0.1], octo: ['hat', 0, -19.2, 12, -0.1], parttimer: ['hat', 0, -24.4, 16, -0.06],
  rps: ['hat', 0, -25.4, 14, -0.06], chef: ['holly', 3.4, -24.9, 10], dekatsuyo: ['hat', 0, -26, 14, -0.06], anoko: ['hat', 0, -28.8, 12, -0.06],
  mermaid: ['hat', 0, -16.6, 10, -0.1], mermaid1: ['hat', 0, -16.6, 10, -0.1], mermaid2: ['hat', 0, -16.6, 10, -0.1], siren: ['hat', 0, -31, 16, -0.08], sirenAngry: ['hat', 0, -31, 16, -0.08], sirenStorm: ['hat', 0, -31, 16, -0.08],
}
function xmas(g, kind, x, y, w, a = 0) {   // 산타 모자 · 루돌프 뿔(가운데 호랑가시) · 호랑가시 잎과 열매 — 12 너비로 그려 w 에 맞춘다
  const s = w / 12, lw = LW / s
  const holly = (hx, hy, k) => {
    for (const d of [-1, 1]) { el(g, hx + d * 2 * k, hy, 2.3 * k, 1.1 * k, -d * 0.35); ink(g, '#3f9a4a', lw) }
    for (const [bx, by] of [[-0.7, -0.5], [0.7, -0.5], [0, 0.4]]) blob(g, hx + bx * k, hy + by * k, 0.85 * k, 0.85 * k, '#e2383c', lw * 0.8)
  }
  g.save(); g.translate(x, y); g.rotate(a); g.scale(s, s); g.lineJoin = g.lineCap = 'round'
  if (kind === 'hat') {
    g.scale(0.8, 0.8)   // 모자만 80% — 챙이 머리 위 그 자리에 붙은 채로 줄어든다
    const C = new Path2D(); C.moveTo(-5, 0); C.quadraticCurveTo(-4.2, -7.5, -8.6, -9.4); C.quadraticCurveTo(-1.5, -13.4, 5, 0); C.closePath()
    g.fillStyle = '#e8453c'; g.fill(C); g.save(); g.clip(C); g.fillStyle = 'rgba(255,255,255,.28)'; el(g, 0.8, -5.6, 1.3, 3.8, 0.45); g.fill(); g.restore()   // 빨간 모자 · 윤기
    g.lineWidth = lw; g.strokeStyle = OUT; g.stroke(C)
    blob(g, 0, 0, 6.4, 2, '#fff', lw); blob(g, -8.6, -9.4, 1.9, 1.9, '#fff', lw)   // 하얀 털 챙 · 방울
  } else if (kind === 'antler') {
    for (const [col, k] of [[OUT, 1.6 + lw * 2], ['#b07a4a', 1.6]]) {
      g.strokeStyle = col; g.lineWidth = k; g.beginPath()
      for (const d of [-1, 1]) { g.moveTo(d * 2.4, 0.4); g.quadraticCurveTo(d * 3, -4.6, d * 6.2, -8); g.moveTo(d * 3.1, -3.8); g.lineTo(d * 6.6, -4.2); g.moveTo(d * 4.4, -6.2); g.lineTo(d * 3.8, -9.4) }
      g.stroke()
    }
    holly(0, 0.2, 0.8)
  } else holly(0, 0, 1.2)
  g.restore()
}
const charSprites = (id, outfit = outfitOf(wornId(id), id), wskin = WSKIN[wornW(id)]) => ({ walk: WALK.map(p => artSprite(id, K, { ...p, look: LOOK, outfit, wskin })), idle: [artSprite(id, K, { look: LOOK, outfit, wskin }), artSprite(id, K, { look: LOOK, blink: true, outfit, wskin })], hurt: artSprite(id, K, { look: LOOK, hurt: true, outfit, wskin }) })   // 입은 의상 · 무기 스킨까지
function flip(s) { const c = mk(s.c.width, s.c.height), g = c.getContext('2d'); g.scale(-1, 1); g.drawImage(s.c, -c.width, 0); return { ...s, c, ox: s.w - s.ox } }
function white(s) { const c = mk(s.c.width, s.c.height), g = c.getContext('2d'); g.drawImage(s.c, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); return { ...s, c } }
const put = (c, s, x, y, k = 1) => c.drawImage(s.c, x - s.ox * k, y - s.oy * k, s.w * k, s.h * k)
// ---- 아이콘 — 이모지 대신 직접 그린 그림(기기마다 다르게 보이지 않게). 24 × 24 칸 가운데가 (0, 0). 문자열이면 그 캐릭터 그림을 줄여서
const FLAG = {   // 국기 그림(테두리 없이 22 × 15) — 언어 고르기 단추(ICO) · 머리띠 수건(동그랗게 오려서)
  kr: g => {
    g.fillStyle = '#fff'; g.fillRect(-11, -7.5, 22, 15)
    g.save(); g.rotate(0.59); g.fillStyle = '#cd2e3a'; g.beginPath(); g.arc(0, 0, 3.9, Math.PI, 0); g.fill(); g.fillStyle = '#0047a0'; g.beginPath(); g.arc(0, 0, 3.9, 0, Math.PI); g.fill()
    g.fillStyle = '#cd2e3a'; el(g, -1.95, 0, 1.95); g.fill(); g.fillStyle = '#0047a0'; el(g, 1.95, 0, 1.95); g.fill(); g.restore()
    g.lineWidth = 0.9; g.strokeStyle = '#222'
    for (const [x, y] of [[-7.4, -4.6], [7.4, -4.6], [-7.4, 4.6], [7.4, 4.6]]) { g.save(); g.translate(x, y); g.rotate(Math.atan2(y, x) + Math.PI / 2); for (const o of [-1.1, 0, 1.1]) { g.beginPath(); g.moveTo(-1.6, o); g.lineTo(1.6, o); g.stroke() } g.restore() }
  },
  jp: g => { g.fillStyle = '#fff'; g.fillRect(-11, -7.5, 22, 15); g.fillStyle = '#e60026'; el(g, 0, 0, 4.6); g.fill()
  },
  us: g => {
    for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? '#fff' : '#d22f3c'; g.fillRect(-11, -7.5 + i * 15 / 7, 22, 15 / 7 + 0.1) }
    g.fillStyle = '#3c3b6e'; g.fillRect(-11, -7.5, 10, 8.6); g.fillStyle = '#fff'
    for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) { el(g, -9 + x * 3, -5.6 + y * 2.4, 0.55); g.fill() }
  },
  cn: g => {
    g.fillStyle = '#de2910'; g.fillRect(-11, -7.5, 22, 15); g.fillStyle = '#ffde00'; starP(g, -6.6, -3.2, 2.8, 1.1); g.fill()
    for (const [x, y] of [[-3.2, -5.8], [-1.8, -3.9], [-1.8, -1.5], [-3.2, 0.4]]) { starP(g, x, y, 0.95, 0.38); g.fill() }
  },
  tw: g => {
    g.fillStyle = '#fe0000'; g.fillRect(-11, -7.5, 22, 15); g.fillStyle = '#000095'; g.fillRect(-11, -7.5, 11, 7.5)
    g.fillStyle = '#fff'; starP(g, -5.5, -3.75, 2.9, 1.6, 12); g.fill(); g.fillStyle = '#000095'; el(g, -5.5, -3.75, 1.55); g.fill(); g.fillStyle = '#fff'; el(g, -5.5, -3.75, 1.2); g.fill()
  },
}
const FLAG_MID = { kr: [0, 0], jp: [0, 0], us: [-3, -1.2], cn: [-4.4, -2.6], tw: [-3.6, -2.4] }   // 동그랗게 오릴 때 가운데 — 그 나라 국기다운 곳(태극 · 붉은 해 · 별 · 큰 별 · 흰 해)
const flag = (g, paint) => { g.save(); g.beginPath(); g.roundRect(-11, -7.5, 22, 15, 2.5); g.clip(); paint(); g.restore(); g.beginPath(); g.roundRect(-11, -7.5, 22, 15, 2.5); g.lineWidth = 1.4; g.strokeStyle = OUT; g.stroke() }   // 국기 — 둥근 네모 안에 그리고 테두리
const ink = (g, fill, lw = 1.4) => { if (fill) { g.fillStyle = fill; g.fill() } g.lineWidth = lw; g.strokeStyle = OUT; g.stroke() }
const el = (g, x, y, rx, ry = rx, rot = 0) => { g.beginPath(); g.ellipse(x, y, rx, ry, rot, 0, TAU) }
const rr = (g, x, y, w, h, r) => { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath() }
const starP = (g, x, y, R, r, n = 5, rot = -Math.PI / 2) => { g.beginPath(); for (let i = 0; i < n * 2; i++) { const a = rot + i * Math.PI / n, q = i % 2 ? r : R; g.lineTo(x + Math.cos(a) * q, y + Math.sin(a) * q) } g.closePath() }
const line2 = (g, col, w, path) => { g.lineCap = 'round'; g.lineJoin = 'round'; path(); g.lineWidth = w + 2.4; g.strokeStyle = OUT; g.stroke(); g.lineWidth = w; g.strokeStyle = col; g.stroke() }   // 테두리 있는 굵은 선
const both = (g, fill, ...shapes) => { g.lineWidth = 2.8; g.strokeStyle = OUT; for (const f of shapes) { f(); g.stroke() } g.fillStyle = fill; for (const f of shapes) { f(); g.fill() } }   // 겹친 모양을 한 덩어리로(안쪽 선 없이)
function pochetteArt(g) {   // 치이카와의 분홍 곰 포셰트
  g.strokeStyle = OUT; g.lineWidth = 1.2; g.beginPath(); g.arc(0, -2, 7.5, Math.PI * 1.1, Math.PI * 1.9); g.stroke()
  for (const s of [-1, 1]) blob(g, s * 5, -3.6, 2.2, 2.2, '#ffb3c8', 1.1)
  blob(g, 0, 1.5, 7.5, 6.5, '#ffb3c8', 1.3)
  g.fillStyle = '#2b211d'; for (const s of [-1, 1]) { g.beginPath(); g.arc(s * 2.4, 0.8, 0.8, 0, TAU); g.fill() }
  blob(g, 0, 3.2, 2, 1.4, '#ffe3ec', 0.8)
}
const sprout = g => {
  el(g, 0, 8.5, 9, 3.2); ink(g, '#a8784c')
  line2(g, '#5fae4a', 1.4, () => { g.beginPath(); g.moveTo(0, 7.5); g.quadraticCurveTo(0.6, 1, 0, -3) })
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(0, -3); g.quadraticCurveTo(s * 2.5, -11, s * 10, -8.5); g.quadraticCurveTo(s * 7, -1.5, 0, -3); ink(g, '#7cc860') }
}
const bigStar = g => { starP(g, 0, 1, 11.5, 5.2); ink(g, '#ffd23f', 1.5); el(g, -2.4, -1.5, 1.4, 2, 0.4); g.fillStyle = '#fff6c2'; g.fill() }
const speaker = g => { g.beginPath(); g.moveTo(-10, -3.5); g.lineTo(-5.5, -3.5); g.lineTo(0.5, -9); g.lineTo(0.5, 9); g.lineTo(-5.5, 3.5); g.lineTo(-10, 3.5); g.closePath(); ink(g, '#fff', 1.6) }
const shieldP = (g, k) => { g.beginPath(); g.moveTo(0, -11.5 * k); g.quadraticCurveTo(6 * k, -8.5 * k, 10 * k, -9 * k); g.quadraticCurveTo(10.5 * k, 5 * k, 0, 11.5 * k); g.quadraticCurveTo(-10.5 * k, 5 * k, -10 * k, -9 * k); g.quadraticCurveTo(-6 * k, -8.5 * k, 0, -11.5 * k); g.closePath() }
const party = g => {   // 폭죽 콘 · 색종이
  g.beginPath(); g.moveTo(-10.5, 10.5); g.lineTo(-5.5, -3); g.lineTo(3, 5.5); g.closePath(); ink(g, '#ffd23f')
  g.save(); g.clip(); g.strokeStyle = '#ff6b6b'; g.lineWidth = 1.8; for (const d of [-3, 2]) { g.beginPath(); g.moveTo(-12 + d, -1 + d); g.lineTo(2 + d, 13 + d); g.stroke() } g.restore()
  g.beginPath(); g.moveTo(-10.5, 10.5); g.lineTo(-5.5, -3); g.lineTo(3, 5.5); g.closePath(); ink(g)
  line2(g, '#6cc4ff', 1.3, () => { g.beginPath(); g.moveTo(-1, 0); g.quadraticCurveTo(1, -6, 5, -6); g.quadraticCurveTo(8, -6, 9, -10) })
  line2(g, '#ff9be0', 1.3, () => { g.beginPath(); g.moveTo(1, 3); g.quadraticCurveTo(6, 2, 7.5, 5); g.quadraticCurveTo(9, 7.5, 11, 6) })
  for (const [x, y, c] of [[-3, -9, '#8be07a'], [4, -11, '#ff6b6b'], [10.5, -2, '#ffd23f'], [7.5, 10.5, '#b58cff']]) { el(g, x, y, 1.6); ink(g, c, 1) }
}
const tearP = g => { g.beginPath(); g.moveTo(0, -11); g.bezierCurveTo(4, -5, 8, -1, 8, 3.5); g.arc(0, 3.5, 8, 0, Math.PI); g.bezierCurveTo(-8, -1, -4, -5, 0, -11) }   // 눈물 한 방울(30칸 기준)
/** 가위바위보 손(30칸 기준) — 가위바위보 보스 피부색, 굵은 손가락(작게 그려도 모양이 바로 보이게). 테두리를 먼저 굵게 칠하고 살색을 덮는다 */
function hand(g, kind) {
  const caps = kind === 'scissors' ? [[-2, 1, -6.5, -11], [2, 1, 5.5, -11.5]] : kind === 'paper' ? [[-6, 1, -8.5, -9], [-2.2, 0, -2.8, -12], [2, 0, 2.6, -12], [6, 1, 8, -9.5], [-7, 6, -12, 1]] : []
  g.lineCap = 'round'
  for (const pass of [0, 1]) {
    const o = pass ? 0 : 1.4, col = pass ? '#f2c9a8' : OUT; g.strokeStyle = g.fillStyle = col
    for (const [x0, y0, x1, y1] of caps) { g.lineWidth = (kind === 'paper' ? 4.6 : 5.4) + o * 2; g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke() }
    el(g, 0, 5, 8.5 + o, 7 + o); g.fill()   // 손바닥 · 주먹
    if (kind !== 'paper') for (const x of [-5.6, -1.9, 1.9, 5.6]) if (kind === 'rock' || Math.abs(x) > 3) { el(g, x, -1.5, 2.7 + o); g.fill() }   // 접은 손가락 마디
  }
  if (kind !== 'paper') { g.strokeStyle = OUT; g.lineWidth = 1.3; g.beginPath(); g.moveTo(-7, 6); g.quadraticCurveTo(-2, 8, 3.5, 4); g.stroke() }   // 엄지
}
const ICO = {
  // 스킬
  pile: g => { for (const [y, w, x, col] of [[3.6, 21, 0, '#b07a4a'], [-2.2, 18, 1.4, '#8fd14f'], [-7.8, 15, -1, '#e07a6a']]) { rr(g, x - w / 2, y, w, 5.6, 1.2); ink(g, col, 1.3); g.fillStyle = '#fffaf0'; g.fillRect(x + w / 2 - 4, y + 1.3, 2.8, 3) } },   // 헌책 더미
  book: g => {   // 펼친 초록 헌책(카니)
    g.beginPath(); g.moveTo(0, -6); g.quadraticCurveTo(-6, -9, -11.5, -7); g.lineTo(-11.5, 8); g.quadraticCurveTo(-6, 6, 0, 9); g.quadraticCurveTo(6, 6, 11.5, 8); g.lineTo(11.5, -7); g.quadraticCurveTo(6, -9, 0, -6); g.closePath(); ink(g, '#8fd14f', 1.5)
    g.beginPath(); g.moveTo(0, -4.4); g.quadraticCurveTo(-5, -7.4, -9.8, -5.6); g.lineTo(-9.8, 6.2); g.quadraticCurveTo(-5, 4.6, 0, 7.2); g.quadraticCurveTo(5, 4.6, 9.8, 6.2); g.lineTo(9.8, -5.6); g.quadraticCurveTo(5, -7.4, 0, -4.4); g.closePath(); ink(g, '#fffaf0', 1)
    g.beginPath(); g.moveTo(0, -4.4); g.lineTo(0, 7.2); g.stroke()
    g.strokeStyle = 'rgba(61,48,43,.5)'; g.lineWidth = 0.9; g.beginPath(); for (const s of [-1, 1]) for (const y of [-2, 0.9, 3.8]) { g.moveTo(s * 2.4, y); g.quadraticCurveTo(s * 5, y - 1, s * 7.6, y - 0.6) } g.stroke()
  },
  sasu: g => { g.rotate(-Math.PI / 4); rr(g, -1.4, -2.5, 2.8, 15, 1.4); ink(g, '#b07a4a'); line2(g, '#c9ced6', 2, () => { g.beginPath(); g.moveTo(-4.8, -10); g.lineTo(-4.8, -6); g.quadraticCurveTo(-4.8, -2, 0, -2); g.quadraticCurveTo(4.8, -2, 4.8, -6); g.lineTo(4.8, -10) }) },
  stick: g => { starP(g, 0, 0, 11.5, 6, 8, 0.2); ink(g, '#ff9a3c', 1.5); starP(g, 0, 0, 6.5, 3.4, 8, 0.6); g.fillStyle = '#ffe36b'; g.fill() },
  yaha: 'usagi',
  ura: g => { starP(g, 0, 0, 11.5, 8.3, 10, 0); ink(g, '#fff', 1.5); g.fillStyle = '#e8473b'; rr(g, -1.6, -7, 3.2, 8.5, 1.6); g.fill(); el(g, 0, 4.8, 1.8); g.fill() },
  weed: sprout,
  tears: g => { tearP(g); ink(g, '#7cc6ff', 1.5); el(g, -3, 3, 1.6, 2.6, 0.3); g.fillStyle = '#fff'; g.fill() },
  rock: g => hand(g, 'rock'), scissors: g => hand(g, 'scissors'), paper: g => hand(g, 'paper'),
  guitar: g => {
    g.rotate(Math.PI / 5); rr(g, -1.6, -11.5, 3.2, 12, 1); ink(g, '#8a5a3a'); rr(g, -2.6, -13, 5.2, 3.4, 1); ink(g, '#5b3b28')
    both(g, '#f29b45', () => el(g, 0, 1.6, 5, 4.4), () => el(g, 0, 7, 6.6, 5))
    el(g, 0, 3.4, 1.9); g.fillStyle = OUT; g.fill(); rr(g, -2.6, 8, 5.2, 1.6, 0.6); g.fill()
  },
  nantoka: bigStar,
  ramen: g => {
    el(g, 0, -0.5, 10.5, 3.2); ink(g, '#ffe08a')
    for (const d of [0, 2.6]) line2(g, '#d9a066', 1.3, () => { g.beginPath(); g.moveTo(1 + d, -11.5); g.lineTo(-4 + d, 0) })
    g.beginPath(); g.moveTo(-11, -0.5); g.quadraticCurveTo(-10.5, 10, 0, 10); g.quadraticCurveTo(10.5, 10, 11, -0.5); g.closePath(); ink(g, '#e8473b', 1.5)
    g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.setLineDash([2, 1.6]); g.beginPath(); g.moveTo(-8, 4); g.quadraticCurveTo(0, 5.4, 8, 4); g.stroke(); g.setLineDash([])
  },
  curry: g => {
    el(g, 0, 2, 11.5, 7.5); ink(g, '#fff', 1.5)
    el(g, -3.4, 1, 5.6, 4.2); ink(g, '#fffaf0', 1)
    el(g, 3, 2.6, 6, 4.2); ink(g, '#c9762c', 1.2)
    for (const [x, y, c] of [[1.5, 1.5, '#ff8c3a'], [4.8, 3.6, '#ffe08a'], [3.6, 0.4, '#ffe08a']]) { rr(g, x - 1, y - 1, 2, 2, 0.5); ink(g, c, 0.7) }
  },
  pochette: g => { g.translate(0, 1.2); g.scale(1.25, 1.25); pochetteArt(g) },
  momo: g => {
    for (const s of [-1, 1]) {
      g.save(); g.translate(s * 5.4, 1.5); g.rotate(s * 0.35)
      both(g, '#fff', () => el(g, -3, -4.4, 1.9), () => el(g, 0, -5.6, 1.9), () => el(g, 3, -4.4, 1.9), () => el(g, 0, 1.5, 4.6, 5.6))
      el(g, 0, 2.4, 2, 1.6); g.fillStyle = '#ffc2d6'; g.fill(); g.restore()
    }
  },
  kanpai: g => {
    line2(g, '#e9f3ff', 2, () => { g.beginPath(); g.arc(6.6, 2, 4, -Math.PI / 2, Math.PI / 2) })
    rr(g, -8.5, -5.5, 15, 16.5, 2.5); ink(g, '#ffc23a', 1.5)
    g.fillStyle = '#fff3c4'; for (const [x, y] of [[-4, 4], [0, 7], [2, 1]]) { el(g, x, y, 1); g.fill() }
    both(g, '#fff', () => el(g, -5.5, -6.5, 3.4, 3), () => el(g, -0.8, -8.2, 3.8, 3.4), () => el(g, 4, -6.5, 3.2, 3))
  },
  sword: g => {
    g.rotate(-Math.PI / 4)
    g.beginPath(); g.moveTo(-1.6, 3); g.lineTo(-1.6, -8.5); g.quadraticCurveTo(-1.2, -12.5, 1.8, -13); g.lineTo(1.6, 3); g.closePath(); ink(g, '#e6edf5', 1.3)
    el(g, 0, 3.8, 3.8, 1.4); ink(g, '#d8a93a', 1.1); rr(g, -1.5, 5, 3, 7.5, 1); ink(g, '#3b3540', 1.1)
    g.strokeStyle = '#fff'; g.lineWidth = 0.7; g.beginPath(); for (const y of [7, 9.5]) { g.moveTo(-1.2, y - 1); g.lineTo(1.2, y + 1); g.moveTo(1.2, y - 1); g.lineTo(-1.2, y + 1) } g.stroke()
  },
  // 아이템
  license: g => {
    rr(g, -11, -8, 22, 16, 2); ink(g, '#fff4d6', 1.5)
    g.strokeStyle = '#c9b48a'; g.lineWidth = 1.3; g.beginPath(); for (const [y, w] of [[-4, 12], [-0.5, 9], [3, 10]]) { g.moveTo(-8, y); g.lineTo(-8 + w, y) } g.stroke()
    el(g, 6.4, 3, 3.3); ink(g, '#e8473b', 1.1); starP(g, 6.4, 3.1, 1.9, 0.8); g.fillStyle = '#fff'; g.fill()
  },
  armor: g => { shieldP(g, 1); ink(g, '#8fb3d9', 1.5); shieldP(g, 0.6); ink(g, '#d6e6f5', 1); starP(g, 0, 0.5, 3.4, 1.5); g.fillStyle = '#8fb3d9'; g.fill() },
  manju: g => {
    g.rotate(-0.4); el(g, 0, 0, 11, 6.2); ink(g, '#a8455f', 1.5)
    el(g, 6.2, 0, 3.2, 4.6); ink(g, '#ffd25a', 1); el(g, 6.2, 0, 1.4, 2.2); g.fillStyle = '#ffe9a0'; g.fill()
    g.strokeStyle = '#7d2f45'; g.lineWidth = 0.9; g.beginPath(); for (const x of [-6, -2.5]) { g.moveTo(x, -2.5); g.lineTo(x + 1.4, -2) } g.moveTo(-4.5, 2.2); g.lineTo(-3, 2.6); g.stroke()
  },
  pudding: g => {
    el(g, 0, 8.6, 11, 2.8); ink(g, '#fff', 1.3)
    g.beginPath(); g.moveTo(-8, 7.6); g.lineTo(-5.5, -5); g.quadraticCurveTo(0, -7.5, 5.5, -5); g.lineTo(8, 7.6); g.quadraticCurveTo(0, 10, -8, 7.6); ink(g, '#ffd86b', 1.5)
    g.beginPath(); g.moveTo(-5.6, -5); g.quadraticCurveTo(0, -7.6, 5.6, -5); g.lineTo(6, -2.6); g.quadraticCurveTo(4.6, -1.2, 3.6, -2.4); g.quadraticCurveTo(2.6, 0.4, 1.2, -2); g.quadraticCurveTo(-1.5, -1, -3, -2.2); g.quadraticCurveTo(-5, -0.8, -6.1, -2.6); g.closePath(); ink(g, '#8a4b23', 1.2)
  },
  clock: g => {
    for (const s of [-1, 1]) { line2(g, '#8d8d8d', 1, () => { g.beginPath(); g.moveTo(s * 4.5, 8); g.lineTo(s * 7, 11.5) }); el(g, s * 6.5, -8.4, 3.6, 2.8, s * 0.6); ink(g, '#ffd23f', 1.2) }
    el(g, 0, 1.4, 9.4); ink(g, '#ff6b6b', 1.5); el(g, 0, 1.4, 6.8); ink(g, '#fff', 1)
    line2(g, OUT, 0.4, () => { g.beginPath(); g.moveTo(0, -3.5); g.lineTo(0, 1.4); g.lineTo(3.6, 1.4) })
  },
  mega: g => {
    g.rotate(-0.25)
    rr(g, -12, -2.4, 3.4, 4.8, 1); ink(g, '#d8dde5', 1.1)
    g.beginPath(); g.moveTo(-9, -3.2); g.lineTo(4.5, -9.2); g.lineTo(4.5, 9.2); g.lineTo(-9, 3.2); g.closePath(); ink(g, '#ff6b6b', 1.5)
    el(g, 4.5, 0, 2.6, 9.2); ink(g, '#ffd0d0', 1.3)
    g.lineCap = 'round'; g.lineWidth = 1.6; g.strokeStyle = OUT; for (const r of [3.4, 6]) { g.beginPath(); g.arc(5.5, 0, r, -0.5, 0.5); g.stroke() }
  },
  slipper: g => {
    g.rotate(-0.3); el(g, 0, 3.6, 11.4, 4); ink(g, '#fff6ee', 1.4)
    g.beginPath(); g.moveTo(-11, 3.2); g.quadraticCurveTo(-10, -7, 0, -5.4); g.quadraticCurveTo(2.6, -5, 2.6, 3.2); g.closePath(); ink(g, '#ff9ec0', 1.4)
    el(g, -4, -5.2, 2.6); ink(g, '#fff', 1.1)
  },
  wind: g => { for (const [y, x, r] of [[-4.5, 3, 3], [2, 6.5, 2.6], [8, 0, 2.4]]) line2(g, '#bfe6ff', 2, () => { g.beginPath(); g.moveTo(-11, y); g.lineTo(x, y); g.arc(x, y - r, r, Math.PI / 2, -Math.PI * 0.85, true) }) },
  bento: g => {
    rr(g, -11.5, -8.5, 23, 17, 2.5); ink(g, '#e05a4a', 1.5); rr(g, -9.5, -6.5, 19, 13, 1.5); ink(g, '#fff', 1)
    g.beginPath(); g.moveTo(1, -6.5); g.lineTo(1, 6.5); g.moveTo(1, 0); g.lineTo(9.5, 0); g.lineWidth = 1; g.stroke()
    el(g, -4.2, 0, 1.8); ink(g, '#e8473b', 0.8)
    rr(g, 2.8, -5, 5, 3.8, 1); ink(g, '#ffd23f', 0.9); el(g, 5.4, 3.2, 2.8, 1.7); ink(g, '#ff7b6b', 0.9)
  },
  double: g => {   // 둘이서 같이 — 둥근 귀 · 뾰족 귀 두 친구
    for (const s of [-1, 1]) {
      const x = s * 5
      if (s < 0) for (const e of [-1, 1]) { el(g, x + e * 4.2, -4.2, 2, 1.8); ink(g, '#fff', 1.1) }
      else for (const e of [-1, 1]) { g.beginPath(); g.moveTo(x + e * 2, -4); g.lineTo(x + e * 5.4, -8); g.lineTo(x + e * 5.6, -2); g.closePath(); ink(g, '#fff', 1.1) }
      el(g, x, 2, 6.6, 6); ink(g, '#fff', 1.4)
      if (s > 0) { g.save(); el(g, x, 2, 6.6, 6); g.clip(); g.beginPath(); g.moveTo(x - 7, -4); g.lineTo(x + 7, -4); g.lineTo(x + 7, 1); g.lineTo(x + 2, 1); g.lineTo(x, -2); g.lineTo(x - 2, 1); g.lineTo(x - 7, 1); g.closePath(); g.fillStyle = '#7aa7d9'; g.fill(); g.restore(); el(g, x, 2, 6.6, 6); ink(g) }
      g.fillStyle = OUT; for (const e of [-1, 1]) { el(g, x + e * 2.2, 2.6, 0.9, 1.1); g.fill() }
      g.fillStyle = 'rgba(255,140,170,.6)'; for (const e of [-1, 1]) { el(g, x + e * 4, 4.8, 1.3, 0.8); g.fill() }
    }
  },
  pouch: g => {
    g.beginPath(); g.moveTo(-4, -5); g.quadraticCurveTo(-11, 0, -9.4, 7); g.quadraticCurveTo(-8.4, 11, 0, 11); g.quadraticCurveTo(8.4, 11, 9.4, 7); g.quadraticCurveTo(11, 0, 4, -5); g.closePath(); ink(g, '#c79a6e', 1.5)
    g.beginPath(); g.moveTo(-4, -5); g.lineTo(-6.5, -10.5); g.lineTo(-2, -8.6); g.lineTo(0, -11.5); g.lineTo(2, -8.6); g.lineTo(6.5, -10.5); g.lineTo(4, -5); g.closePath(); ink(g, '#d9b083', 1.3)
    line2(g, '#e8473b', 1.2, () => { g.beginPath(); g.moveTo(-5, -5); g.quadraticCurveTo(0, -3.2, 5, -5) })
  },
  clover: g => {
    line2(g, '#4c9a46', 1.4, () => { g.beginPath(); g.moveTo(0, 1); g.quadraticCurveTo(2, 7.5, 6.5, 11) })
    for (let k = 0; k < 4; k++) {
      g.save(); g.translate(0, -1); g.rotate(k * TAU / 4 + Math.PI / 4); g.scale(0.92, 0.92)
      g.beginPath(); g.moveTo(0, -1); g.bezierCurveTo(-7, -3, -6, -11, -2.5, -10.5); g.quadraticCurveTo(-0.5, -10.2, 0, -8.5); g.quadraticCurveTo(0.5, -10.2, 2.5, -10.5); g.bezierCurveTo(6, -11, 7, -3, 0, -1); ink(g, '#5fbf5a', 1.5); g.restore()
    }
  },
  wage: g => {
    for (let i = 0; i < 3; i++) { el(g, -3.5, 8 - i * 3.4, 7, 2.6); ink(g, '#ffcf3f', 1.3) }
    el(g, 5.6, -3, 5.6); ink(g, '#ffd84d', 1.5); el(g, 5.6, -3, 3.4); g.lineWidth = 0.9; g.strokeStyle = '#c9962a'; g.stroke()
  },
  // 떨어지는 것
  onigiri: g => {
    const P = new Path2D(); P.moveTo(0, -10.5); P.quadraticCurveTo(3, -10.5, 10, 4); P.quadraticCurveTo(11.5, 9.5, 6, 9.5); P.lineTo(-6, 9.5); P.quadraticCurveTo(-11.5, 9.5, -10, 4); P.quadraticCurveTo(-3, -10.5, 0, -10.5); P.closePath()
    g.fillStyle = '#fff'; g.fill(P); g.save(); g.clip(P); g.fillStyle = '#2f3b2f'; g.fillRect(-4.4, 2, 8.8, 9); g.restore(); g.lineWidth = 1.5; g.strokeStyle = OUT; g.stroke(P); g.lineWidth = 1; g.strokeRect(-4.4, 2, 8.8, 7.5)
  },
  magnet: g => {
    g.rotate(0.5); g.scale(0.88, 0.88); g.lineCap = 'butt'
    const U = () => { g.beginPath(); g.moveTo(-6, 6); g.lineTo(-6, -1.5); g.arc(0, -1.5, 6, Math.PI, 0); g.lineTo(6, 6) }
    U(); g.lineWidth = 7.6; g.strokeStyle = OUT; g.stroke(); U(); g.lineWidth = 5; g.strokeStyle = '#e8473b'; g.stroke()
    for (const s of [-1, 1]) { rr(g, s * 6 - 3.3, 5, 6.6, 5, 0.8); ink(g, '#d8dde5', 1.2) }
  },
  momonga: 'momonga',
  firework: g => {
    const cols = ['#ff6b6b', '#ffd23f', '#6cc4ff', '#8be07a', '#ff9be0', '#b58cff']
    for (let k = 0; k < 12; k++) { const a = k * TAU / 12, c = cols[k % 6], co = Math.cos(a), si = Math.sin(a); line2(g, c, 1.6, () => { g.beginPath(); g.moveTo(co * 3.8, si * 3.8); g.lineTo(co * 8.4, si * 8.4) }); el(g, co * 11, si * 11, 1.2); g.fillStyle = c; g.fill() }
    el(g, 0, 0, 2.4); ink(g, '#fff', 1.1)
  },
  earplug: g => { line2(g, '#6cc4ff', 2, () => { g.beginPath(); g.arc(0, 2.5, 8.2, Math.PI, 0) }); for (const s of [-1, 1]) { el(g, s * 8.2, 4.5, 3.6, 5.2); ink(g, '#ff9ec0', 1.4); el(g, s * 8.2, 4.5, 1.7, 3); g.fillStyle = '#ffd6e4'; g.fill() } },
  pajama: g => {
    g.rotate(-0.2); g.beginPath(); g.moveTo(-11, -7); g.lineTo(11, -7); g.lineTo(11, -2.6); g.arc(11, 0, 2.6, -Math.PI / 2, Math.PI / 2, true); g.lineTo(11, 7); g.lineTo(-11, 7); g.lineTo(-11, 2.6); g.arc(-11, 0, 2.6, Math.PI / 2, -Math.PI / 2, true); g.closePath(); ink(g, '#ffb3d1', 1.5)
    g.setLineDash([1.6, 1.6]); g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(5, -6); g.lineTo(5, 6); g.stroke(); g.setLineDash([])
    starP(g, -3, 0.4, 4.6, 2); ink(g, '#ffd23f', 1)
  },
  battery: g => {
    g.rotate(-0.3); rr(g, 8.6, -2.8, 3, 5.6, 1); ink(g, '#c9ced6', 1.1); rr(g, -11, -6, 20, 12, 2.2); ink(g, '#fff', 1.5)
    g.fillStyle = '#7cd35a'; for (let i = 0; i < 3; i++) { rr(g, -9 + i * 5.8, -4, 4.8, 8, 1); g.fill() }
  },
  guard: g => {   // 냄비뚜껑 방패 — 은색 뚜껑 · 빨간 손잡이(보조 스킬 갑옷씨의 갑옷 = 방패와 헷갈리지 않게 · 디자인)
    g.rotate(-0.25)
    el(g, 0, 0.5, 11.5, 10.5); ink(g, '#d8dde5', 1.5)
    el(g, 0, 0.5, 7.8, 7); g.lineWidth = 1; g.strokeStyle = 'rgba(61,48,43,.35)'; g.stroke()
    rr(g, -4.2, -1.7, 8.4, 4.4, 2.2); ink(g, '#e8473b', 1.3)
    g.fillStyle = 'rgba(255,255,255,.85)'; el(g, -5.8, -4.2, 1.4, 2.6, 0.7); g.fill()
  },
  chest: g => {
    rr(g, -11, -2, 22, 12, 1.5); ink(g, '#c27a3a', 1.5)
    g.beginPath(); g.moveTo(-11, -1); g.lineTo(-11, -5); g.quadraticCurveTo(0, -12.5, 11, -5); g.lineTo(11, -1); g.closePath(); ink(g, '#d98c45', 1.5)
    g.fillStyle = '#ffd23f'; for (const x of [-8, 6]) { rr(g, x, -8.4, 2.2, 18.4, 0.6); g.fill() }
    rr(g, -2.6, -3.4, 5.2, 5.6, 1); ink(g, '#ffd23f', 1.1); el(g, 0, -0.8, 0.8); g.fillStyle = OUT; g.fill()
  },
  coinbox: g => { g.save(); g.translate(-1.5, 1.5); g.scale(0.85, 0.85); ICO.chest(g); g.restore(); g.save(); g.translate(7, -6.5); g.scale(0.55, 0.55); ICO.coin(g); g.restore() },   // 떠돌이 보물상자 — 작은 보물상자 + 동전
  awaken: g => {   // 각성의 별 — 분홍 빛살 · 금별
    g.lineCap = 'round'; g.lineWidth = 1.6; g.strokeStyle = '#ff9be0'
    for (let k = 0; k < 8; k++) { const a = k * TAU / 8 + 0.2; g.beginPath(); g.moveTo(Math.cos(a) * 10, Math.sin(a) * 10 + 0.5); g.lineTo(Math.cos(a) * 13, Math.sin(a) * 13 + 0.5); g.stroke() }
    starP(g, 0, 0.5, 10, 4.4); ink(g, '#ffd23f', 1.5); starP(g, 0, 0.5, 4.6, 2); g.fillStyle = '#fff6c2'; g.fill()
  },
  stone: g => {   // 부활석 — 하늘색 보석 · 가운데 분홍 하트
    g.beginPath(); g.moveTo(0, -11.5); g.lineTo(9.4, -3.6); g.lineTo(6, 10.5); g.lineTo(-6, 10.5); g.lineTo(-9.4, -3.6); g.closePath(); ink(g, '#9fe3ff', 1.5)
    g.strokeStyle = 'rgba(61,48,43,.3)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(-9.4, -3.6); g.lineTo(9.4, -3.6); g.moveTo(0, -11.5); g.lineTo(-3.4, -3.6); g.lineTo(-2.4, 10.5); g.moveTo(0, -11.5); g.lineTo(3.4, -3.6); g.lineTo(2.4, 10.5); g.stroke()
    g.beginPath(); g.moveTo(0, 6.6); g.bezierCurveTo(-5.6, 2.6, -4, -2.4, 0, 0.2); g.bezierCurveTo(4, -2.4, 5.6, 2.6, 0, 6.6); ink(g, '#ff7aa8', 1)
    g.fillStyle = 'rgba(255,255,255,.8)'; el(g, -4.6, -5.6, 1.2, 2, 0.6); g.fill()
  },
  parry: g => { starP(g, 0, 0, 12, 6, 8, 0); ink(g, '#ffd23f', 1.4); el(g, 0, 0, 4.2); ink(g, '#9aa3ad', 1.3); g.lineCap = 'round'; g.lineWidth = 1.3; g.strokeStyle = OUT; g.beginPath(); g.moveTo(-1.6, -3); g.lineTo(0.6, -0.4); g.lineTo(-0.6, 1.2); g.lineTo(1.4, 3.2); g.stroke() },   // 막았다 — 금빛 불꽃 속 금 간 탄
  cheer: party,
  // 난이도
  easy: sprout, normal: bigStar,
  hard: g => {
    g.beginPath(); g.moveTo(0, -11.5); g.bezierCurveTo(4, -6, 9.5, -2, 9, 4); g.bezierCurveTo(8.5, 9, 4.5, 11.5, 0, 11.5); g.bezierCurveTo(-4.5, 11.5, -8.5, 9, -9, 4); g.bezierCurveTo(-9.2, -1, -5.5, -3, -4.5, -7); g.bezierCurveTo(-2.5, -5, -1, -6, 0, -11.5); g.closePath(); ink(g, '#ff6a3d', 1.5)
    g.beginPath(); g.moveTo(0, -2); g.bezierCurveTo(3, 1, 5, 4, 4.5, 6.5); g.bezierCurveTo(4, 9.5, -4, 9.5, -4.5, 6.5); g.bezierCurveTo(-5, 4, -2, 2, 0, -2); g.fillStyle = '#ffd23f'; g.fill()
  },
  inf: g => { g.lineCap = g.lineJoin = 'round'; const P = () => { g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(4, -7, 11, -7, 11, 0); g.bezierCurveTo(11, 7, 4, 7, 0, 0); g.bezierCurveTo(-4, -7, -11, -7, -11, 0); g.bezierCurveTo(-11, 7, -4, 7, 0, 0) }; for (const [c, w] of [[OUT, 6], ['#b98cff', 3.2]]) { P(); g.strokeStyle = c; g.lineWidth = w; g.stroke() } },   // 무한 — 보랏빛 ∞
  a_goblin: 'goblin', a_dekatsuyo: 'dekatsuyo', a_chiikawa: 'chiikawa', a_siren: 'siren', a_darkstar: 'darkstar',   // 업적 메달 가운데 그림
  // 그 밖
  coin: g => { el(g, 0, 0, 10.5); ink(g, '#ffd23f', 1.6); el(g, 0, 0, 7); g.lineWidth = 1.2; g.strokeStyle = '#d99a00'; g.stroke(); g.lineCap = 'round'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(0, -3.6); g.lineTo(0, 3.6); g.stroke(); el(g, -4.4, -5, 1.5, 2.3, 0.6); g.fillStyle = '#fffbe0'; g.fill() },   // 토벌 보상금
  zoom: g => { g.lineCap = 'round'; g.lineWidth = 3.4; g.strokeStyle = OUT; g.beginPath(); g.moveTo(4, 4); g.lineTo(10.5, 10.5); g.stroke(); el(g, -2, -2, 7.6); ink(g, '#cfeeff', 1.7); g.lineWidth = 1.8; g.beginPath(); g.moveTo(-5.6, -2); g.lineTo(1.6, -2); g.moveTo(-2, -5.6); g.lineTo(-2, 1.6); g.stroke() },   // 돋보기
  snd: g => { speaker(g); g.lineCap = 'round'; g.lineWidth = 2; g.strokeStyle = OUT; for (const r of [4.5, 8.5]) { g.beginPath(); g.arc(1, 0, r, -0.85, 0.85); g.stroke() } },
  mute: g => { speaker(g); g.lineCap = 'round'; g.lineWidth = 2.2; g.strokeStyle = '#e8473b'; g.beginPath(); g.moveTo(4, -4); g.lineTo(11, 4); g.moveTo(11, -4); g.lineTo(4, 4); g.stroke() },
  bgm: g => {
    for (const [x, y] of [[-6, 7], [6, 4.5]]) { el(g, x, y, 3.6, 2.8, -0.4); ink(g, '#ff7ad9', 1.3) }
    g.lineCap = 'round'; g.lineWidth = 1.8; g.strokeStyle = OUT; g.beginPath(); g.moveTo(-2.7, 6); g.lineTo(-2.7, -7); g.moveTo(9.3, 3.5); g.lineTo(9.3, -9.5); g.stroke()
    g.beginPath(); g.moveTo(-3.6, -7.5); g.lineTo(10.2, -10.2); g.lineTo(10.2, -6.6); g.lineTo(-3.6, -3.9); g.closePath(); g.fillStyle = OUT; g.fill()
  },
  sfx: g => {
    el(g, 0, 8.2, 2.4); ink(g, '#ffd23f', 1.2); el(g, 0, -10, 1.6); ink(g, '#ffd23f', 1)
    g.beginPath(); g.moveTo(-9.5, 6); g.quadraticCurveTo(-7, 4, -7, -1); g.quadraticCurveTo(-7, -8.6, 0, -8.6); g.quadraticCurveTo(7, -8.6, 7, -1); g.quadraticCurveTo(7, 4, 9.5, 6); g.closePath(); ink(g, '#ffd23f', 1.5)
    el(g, -3, -3, 1.2, 2.4, 0.3); g.fillStyle = '#fff6c2'; g.fill()
  },
  shirt: g => {   // 의상 — 분홍 티셔츠 · 노란 별
    g.beginPath(); g.moveTo(-4, -9); g.quadraticCurveTo(0, -6.4, 4, -9); g.lineTo(10.5, -5.2); g.lineTo(7.6, 0.2); g.lineTo(5.4, -1.2); g.lineTo(5.4, 9.5); g.lineTo(-5.4, 9.5); g.lineTo(-5.4, -1.2); g.lineTo(-7.6, 0.2); g.lineTo(-10.5, -5.2); g.closePath(); ink(g, '#ffb3cf', 1.5)
    starP(g, 0, 2.4, 3.6, 1.6); ink(g, '#ffd23f', 1)
  },
  snow: g => {   // 겨울 테마 — 하늘색 눈송이
    for (const [col, lw] of [[OUT, 4.4], ['#bfe6ff', 2]]) {
      g.strokeStyle = col; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath()
      for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3 - Math.PI / 2, x = Math.cos(a), y = Math.sin(a); g.moveTo(0, 0); g.lineTo(x * 10, y * 10); for (const d of [-1, 1]) { g.moveTo(x * 5.6, y * 5.6); g.lineTo(x * 5.6 + Math.cos(a + d * 0.8) * 3.6, y * 5.6 + Math.sin(a + d * 0.8) * 3.6) } }
      g.stroke()
    }
  },
  globe: g => {   // 다른 나라 말 — 하늘색 지구 · 초록 땅
    el(g, 0, 0, 10.5); ink(g, '#9fdcff', 1.5); g.save(); el(g, 0, 0, 10.5); g.clip(); g.fillStyle = '#8cd47e'
    el(g, -4, -3.5, 4.6, 3.4, 0.5); g.fill(); el(g, 4.6, 4.2, 3.8, 2.6, -0.4); g.fill(); el(g, 6, -6, 2, 1.4); g.fill(); g.restore()
    g.lineWidth = 1; g.strokeStyle = 'rgba(61,48,43,.45)'; el(g, 0, 0, 4.6, 10.5); g.stroke(); g.beginPath(); g.moveTo(-10.5, 0); g.lineTo(10.5, 0); g.stroke()
    el(g, 0, 0, 10.5); g.lineWidth = 1.5; g.strokeStyle = OUT; g.stroke()
  },
  // 언어 고르기 국기(LANGS 의 셋째 칸) — 22 × 15 둥근 네모
  kr: g => flag(g, () => FLAG.kr(g)),

  jp: g => flag(g, () => FLAG.jp(g)),
  us: g => flag(g, () => FLAG.us(g)),

  cn: g => flag(g, () => FLAG.cn(g)),

  tw: g => flag(g, () => FLAG.tw(g)),

  syn: g => { for (const [x, y, R, c] of [[-2.5, 1.5, 9.5, '#ffd23f'], [7, -6.5, 4.6, '#ff9be0'], [7.5, 7, 3.4, '#9fd8ff']]) { starP(g, x, y, R, R * 0.34, 4); ink(g, c, 1.2) } },
  party,
}
/** 아이콘 그림(30 × 30, 가운데 기준) — 캔버스에는 put / drawImage, 메뉴에는 ic(id) */
const icoSpr = (id, k = K) => sprite(30, 30, 15, 15, g => {
  const P = ICO[id] ?? id; if (typeof P !== 'string') { g.scale(1.15, 1.15); return P(g) }   // ICO 에 없으면 그 이름의 그림(ART — 아노코 · 세이렌 …)
  const s = artSprite(P, 4), c = crop(s.c, trimRect([s.c])), f = 27 / Math.max(c.width, c.height); g.drawImage(c, -c.width * f / 2, -c.height * f / 2, c.width * f, c.height * f)
}, k)
const ICU = {}
/** 업적 메달 — 리본 두 갈래 · 동 · 은 · 금(아직이면 회색) 둥근 판 · 가운데 그림. 이모지 없이 직접 그린다 */
const MEDAL = [['#e6ddd3', '#b9ada1', '#cfc5ba'], ['#e0a46a', '#a8683a', '#ff9db5'], ['#dfe4ea', '#97a2ae', '#8fc4ff'], ['#ffd23f', '#d99a00', '#ff6b8a']]   // [판, 테, 리본]
const medalSpr = (id, t) => sprite(30, 30, 15, 15, g => {
  const [disc, rim, rib] = MEDAL[t]
  for (const s of [-1, 1]) { g.beginPath(); g.moveTo(s * 8.5, -14.5); g.lineTo(s * 3, -14.5); g.lineTo(s * -1.5, -4); g.lineTo(s * 4, -4); g.closePath(); ink(g, rib, 1.3) }
  el(g, 0, 4, 10.6); ink(g, disc, 1.6); el(g, 0, 4, 8.4); g.lineWidth = 1.1; g.strokeStyle = rim; g.stroke()
  if (t === 3) { g.fillStyle = 'rgba(255,255,255,.75)'; el(g, -5, -0.5, 1.6, 2.6, 0.7); g.fill() }   // 금은 반짝
  g.globalAlpha = t ? 1 : 0.35; g.drawImage(icoSpr(ACH[id].ico, 2.4).c, -6.8, -2.8, 13.6, 13.6); g.globalAlpha = 1
}, 2.4)
const medal = (id, t) => h('img', { class: 'ico medal', alt: TIER[t] || tr`아직`, draggable: 'false', src: ICU[`m.${id}.${t}`] ||= medalSpr(id, t).c.toDataURL() })
const ic = id => h('img', { class: 'ico', alt: '', draggable: 'false', src: ICU[id] ||= icoSpr(id, 2.4).c.toDataURL() })
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
function portrait(id, oid = CHARS.some(c => c.id === id) ? wornId(id) : null, wid = CHARS.some(c => c.id === id) ? wornW(id) : null) {   // 캐릭터는 입은 의상 · 무기 스킨으로(주면 그것으로)
  const outfit = outfitOf(oid, id), wskin = wid ? WSKIN[wid] : undefined
  const P = PORT[id + (oid ? ':' + oid : '') + (wid ? ':' + wid : '')] ||= (() => {
    const m = id === 'momonga' ? x => { const o = mk(x.width, x.height), g = o.getContext('2d'); g.scale(-1, 1); g.drawImage(x, -x.width, 0); return o } : x => x   // 모몽가는 꼬리가 오른쪽에 보이게(게임에선 보는 쪽 반대)
    const idle = artSprite(id, 3, { outfit, wskin }).c, walk = CHARS.some(c => c.id === id) ? WALK.map(p => artSprite(id, 3, { ...p, outfit, wskin }).c) : [], r = trimRect([idle, ...walk])
    return { idle: m(crop(idle, r)), walk: walk.map(w => m(crop(w, r))) }
  })()
  const c = mk(P.idle.width, P.idle.height); c.getContext('2d').drawImage(P.idle, 0, 0); c.className = 'pt'; c._idle = P.idle; c._walk = P.walk; return c
}

const TILE = 256
function seeded(s) { return () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296 } }
function groundTile() {   // 풀밭(겨울 테마면 눈밭) — 이어 붙여도 이음매가 안 보이게 가장자리는 아홉 칸에 같이 그린다
  const c = mk(TILE * K, TILE * K), g = c.getContext('2d'), r = seeded(7), W = save.theme === 'winter'
  g.scale(K, K); g.fillStyle = W ? '#e6eff8' : '#cdeaa8'; g.fillRect(0, 0, TILE, TILE)
  const wrap = fn => { for (const ox of [-TILE, 0, TILE]) for (const oy of [-TILE, 0, TILE]) fn(ox, oy) }
  for (let i = 0; i < 16; i++) { const x = r() * TILE, y = r() * TILE, R = 14 + r() * 30, col = r() < 0.5 ? (W ? 'rgba(200,218,240,.5)' : 'rgba(165,212,125,.5)') : (W ? 'rgba(255,255,255,.85)' : 'rgba(228,246,196,.55)'); wrap((ox, oy) => { g.fillStyle = col; g.beginPath(); g.ellipse(x + ox, y + oy, R, R * 0.6, 0, 0, TAU); g.fill() }) }
  if (W) for (let i = 0; i < 3; i++) { const x = 30 + r() * (TILE - 60), y = 40 + r() * (TILE - 60), k = 0.42 + r() * 0.14, sc = pickOfR(r, ['#e2383c', '#3f9a4a', '#5f8fd8']); wrap((ox, oy) => snowman(g, x + ox, y + oy, k, sc)) }   // 겨울 — 풀 대신 눈사람
  g.strokeStyle = W ? '#9dbf8e' : '#93c870'; g.lineWidth = 1.5; g.lineCap = 'round'
  for (let i = 0; i < (W ? 0 : 70); i++) { const x = r() * TILE, y = r() * TILE; wrap((ox, oy) => { g.beginPath(); g.moveTo(x + ox - 3, y + oy); g.lineTo(x + ox - 4, y + oy - 5); g.moveTo(x + ox, y + oy); g.lineTo(x + ox, y + oy - 7); g.moveTo(x + ox + 3, y + oy); g.lineTo(x + ox + 4.5, y + oy - 5); g.stroke() }) }
  if (W) { g.fillStyle = 'rgba(160,190,225,.6)'; for (let i = 0; i < 40; i++) { const x = r() * TILE, y = r() * TILE, R = 0.7 + r() * 1.1; wrap((ox, oy) => { g.beginPath(); g.arc(x + ox, y + oy, R, 0, TAU); g.fill() }) } return c }   // 눈밭 — 눈 밖으로 나온 풀 몇 포기 · 눈 알갱이
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
function snowman(g, x, y, k, scarf) {   // 겨울 바닥의 눈사람 — 그림자 · 나뭇가지 팔 · 목도리 · 숯 눈 · 당근 코 · 단추
  g.save(); g.translate(x, y); g.scale(k, k); g.lineCap = g.lineJoin = 'round'
  g.fillStyle = 'rgba(110,145,195,.25)'; g.beginPath(); g.ellipse(1.5, 0.5, 10, 3.2, 0, 0, TAU); g.fill()
  g.strokeStyle = '#7a5434'; g.lineWidth = 1.1; g.beginPath(); g.moveTo(-5, -10); g.lineTo(-10.5, -14); g.moveTo(-8.6, -12.6); g.lineTo(-9.6, -15.4); g.moveTo(5, -10); g.lineTo(10.5, -13.5); g.stroke()
  g.fillStyle = '#ffffff'; g.strokeStyle = 'rgba(95,115,150,.85)'; g.lineWidth = 1.3   // 배경이니 테두리를 옅게(적과 헷갈리지 않게)
  g.beginPath(); g.arc(0, -5.6, 6.4, 0, TAU); g.fill(); g.stroke(); g.beginPath(); g.arc(0, -14.6, 4.5, 0, TAU); g.fill(); g.stroke()
  g.fillStyle = 'rgba(160,195,235,.45)'; g.beginPath(); g.arc(1.2, -4.4, 4.6, 0.1, Math.PI * 0.95); g.fill()   // 아래쪽 푸른 그늘
  g.fillStyle = scarf; g.beginPath(); g.roundRect(-4.6, -11.2, 9.2, 2.3, 1.1); g.fill(); g.stroke(); g.beginPath(); g.roundRect(1.6, -10.4, 2.3, 4.4, 1); g.fill(); g.stroke()   // 목도리
  g.fillStyle = '#4a5468'; for (const ex of [-1.5, 1.5]) { g.beginPath(); g.arc(ex, -15.4, 0.6, 0, TAU); g.fill() } for (const by of [-6.6, -3.8]) { g.beginPath(); g.arc(0, by, 0.6, 0, TAU); g.fill() }
  g.fillStyle = '#ff8a2a'; g.beginPath(); g.moveTo(0.2, -14.6); g.lineTo(3.6, -13.9); g.lineTo(0.2, -13.6); g.closePath(); g.fill()   // 당근 코
  g.restore()
}

let SPR = null, K = 2   // K = 그려 두는 그림의 단위당 픽셀 — 화면 배율에 맞춘다
function sprites() {
  const xm = save.theme === 'winter', enemy = id => { const R = [artSprite(id, K, { foot: 1, xmas: xm }), artSprite(id, K, { foot: -1, xmas: xm })], L = R.map(flip); return { R, L, WR: R.map(white), WL: L.map(white) } }   // 걷기 두 장 · 왼쪽 · 맞았을 때 하양
  SPR = { E: {}, sasu: {}, ground: groundTile() }
  for (const ch of CHARS) SPR[ch.id] = charSprites(ch.id)
  for (const id in FOES) if (id !== 'mermaid') SPR[id] = enemy(id)
  SPR.mermaid = ['mermaid', 'mermaid1', 'mermaid2'].map(enemy); SPR.sirenAngry = enemy('sirenAngry'); SPR.sirenStorm = enemy('sirenStorm'); SPR.dark = [{ foot: 1 }, { foot: -1 }].map(p => artSprite('darkstar', K, p))
  SPR.pj = PJ.map((o, i) => [{ arm: 1, bob: -1.2 }, { arm: -1 }].map(p => artSprite('pj' + i, K, p)))   // 파자마 파티즈 — 춤 두 장
  const lp = [{ foot: 1 }, { foot: -1 }].map(p => artSprite('leafpair', K, p)); SPR.leaf = { R: lp, L: lp.map(flip) }
  SPR.pochette = sprite(24, 24, 12, 12, pochetteArt)
  SPR.pile = sprite(26, 26, 13, 22, g => { for (const [y, w, x, col] of [[-5, 20, 0, '#b07a4a'], [-10, 17, 1.2, '#8fd14f'], [-14.6, 15, -0.8, '#e07a6a']]) { rr(g, x - w / 2, y, w, 4.6, 1); ink(g, col, 1.1); g.fillStyle = '#fffaf0'; g.fillRect(x + w / 2 - 3.4, y + 1, 2.4, 2.6) } })   // 헌책 더미 — 갈색 · 초록 · 빨간 책 셋, 옆에 책장 단면
  SPR.page = sprite(20, 18, 10, 9, g => { rr(g, -7.5, -6, 15, 12, 1.2); ink(g, '#fffaf0', 1.1); g.fillStyle = '#8fd14f'; g.fillRect(-7, -5.5, 2, 11); g.strokeStyle = 'rgba(61,48,43,.45)'; g.lineWidth = 0.9; g.beginPath(); for (const y of [-2.8, 0, 2.8]) { g.moveTo(-3.6, y); g.lineTo(5, y) } g.stroke() })   // 헌책 날리기 책장 — 초록 책등 자국
  for (const id of [...Object.keys(WEAP), ...Object.keys(PASS), ...Object.keys(ITEMS)]) SPR.E[id] = icoSpr(id)
  SPR.note = icoSpr('bgm')
  SPR.pinkNote = sprite(18, 20, 9, 10, g => { g.font = `18px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineWidth = 3; g.strokeStyle = OUT; g.strokeText('♪', 0, 0); g.fillStyle = '#ff7ad9'; g.fillText('♪', 0, 0) })
  SPR.shadow = sprite(40, 14, 20, 7, g => { g.fillStyle = xm ? 'rgba(70,100,150,.22)' : 'rgba(60,90,40,.28)'; g.beginPath(); g.ellipse(0, 0, 18, 6, 0, 0, TAU); g.fill() })
  const gem = col => sprite(12, 14, 6, 7, g => { g.beginPath(); g.moveTo(0, -6); g.lineTo(5, 0); g.lineTo(0, 6); g.lineTo(-5, 0); g.closePath(); g.fillStyle = col; g.fill(); g.lineWidth = 1.2; g.strokeStyle = OUT; g.stroke(); g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.moveTo(0, -4); g.lineTo(2, -1); g.lineTo(0, 0); g.lineTo(-1.5, -1); g.fill() })
  SPR.gem = [gem('#7fd3ff'), gem('#8cf28a'), gem('#ff8fd0')]
}

// ---------------------------------------------------------------- 의상 — 꾸미기만(능력치는 그대로). 캐릭터마다 셋: 저가(상점 · 수수한 그림) · 고가(상점 · 원작 의상 + 이펙트) · 업적(어려움 클리어 · 원작 의상 + 화려한 이펙트)
//   그림은 mochi() 가 몸을 그리는 차례에 끼워 그린다 — back(몸 뒤 · 망토) · body(몸 안에 오려 그림 · 옷) · head(얼굴 뒤에 · 모자). q = 몸 크기(W · H · hw · t 머리 끝 · y(f) 위에서 f 만큼 · mid 머리와 몸 경계 · P 몸 테두리)
//   save.owned = 산 의상 id, save.wear[캐릭터] = 입은 의상 id(없으면 기본). 업적 의상은 그 캐릭터로 어려움을 클리어하면(save.best[id].clears)
const OUTFIT_COST = { cheap: 500, rich: 2000 }, priceOf = oid => OUTFIT[oid].cost ?? OUTFIT_COST[OUTFIT[oid].tier] ?? 0   // priceOf — 상점 줄 순서(싼 것부터)   // 등급 값 — 의상에 cost 가 있으면 그 값(게 머리띠 · 밤 · 딸기 찹쌀떡 · 신데렐라 · 왕자님은 10,000)
const crude = (g, fill, lw = 1.15) => { g.fillStyle = fill; g.fill(); g.lineJoin = 'round'; g.lineWidth = lw; g.strokeStyle = OUT; g.stroke() }   // 저가 — 칠만 하고 굵은 선(수수하게)
const inHead = (g, q, fn) => { g.save(); g.clip(q.P); fn(); g.restore() }   // 머리 · 몸 테두리 안에만
// 고가 · 업적 의상 그리기 도우미
const suit = (g, q, col) => { g.fillStyle = col; g.fillRect(-20, q.neck - 0.4, 40, 40) }   // 목 아래 몸 전체 옷
const faceHole = (q, oy = 0.41, round) => { if (round) return [q.look, q.y(0.47), q.hw * 0.77, q.H * 0.355]; const fy = q.y(oy); return [q.look, fy, q.hw * 0.88, Math.min(q.H * 0.25, q.neck - 0.1 - fy)] }   // 후드 얼굴 구멍 — 눈썹부터 턱까지 · 볼터치까지 크게. round = 동그란 구멍(한 벌 옷 — 아래가 목 밑까지 내려온다)
const chin = q => { const [, fy, , ry] = faceHole(q, 0, true); return fy + ry }   // 동그란 구멍의 아래 끝 — 단추 · 배 무늬는 그 밑에
function hoodRing(g, q, col, oy, round) {   // 얼굴만 뚫린 후드(가발) — 머리를 덮고 얼굴은 보이게. 머리 테두리는 다시 긋는다
  const [fx, fy, rx, ry] = faceHole(q, oy, round), bot = q.neck + 0.2, box = new Path2D()
  box.rect(-q.hw - 3, q.t - 3, q.W + 6, bot - q.t + 3)
  const R = new Path2D(); R.rect(-q.hw - 3, q.t - 3, q.W + 6, 60); R.ellipse(fx, fy, rx, ry, 0, 0, TAU)   // 칠할 판은 크게 — 머리 상자(box) 경계가 구멍 안을 지나며 선이 생기지 않게
  g.save(); g.clip(q.P); g.clip(box); g.fillStyle = col; g.fill(R, 'evenodd'); g.restore()   // 목 밑으로 내려온 구멍은 몸 쪽(옷)에서 살색으로 채운다
  g.save(); g.clip(box); g.lineWidth = LW; g.strokeStyle = OUT; g.stroke(q.P); g.restore()
  g.beginPath(); g.ellipse(fx, fy, rx, ry, 0, 0, TAU); g.lineWidth = 0.7; g.strokeStyle = OUT; g.stroke()
}
const heartP = (g, x, y, r) => { g.beginPath(); g.moveTo(x, y + r); g.bezierCurveTo(x - r * 1.6, y - r * 0.1, x - r, y - r * 1.4, x, y - r * 0.6); g.bezierCurveTo(x + r, y - r * 1.4, x + r * 1.6, y - r * 0.1, x, y + r); g.closePath() }
const bow = (g, x, y, col) => { for (const s of [-1, 1]) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + s * 3.2, y - 1.8); g.lineTo(x + s * 3.2, y + 1.8); g.closePath(); ink(g, col, 0.6) } blob(g, x, y, 0.9, 0.9, col, 0.6) }
const ginkgo = (g, x, y) => { g.save(); g.translate(x, y); g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 4.4, Math.PI * 1.15, Math.PI * 1.85); g.closePath(); ink(g, '#f2c94c', 0.6); g.strokeStyle = '#b8902a'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 2.2); g.stroke(); g.restore() }
const pincer = (g, x, y, s, col, hi) => { g.save(); g.translate(x, y); g.scale(s, 1); g.beginPath(); g.arc(0, 0, 2.6, 0.9, Math.PI * 2 - 0.2); g.lineTo(0.6, -0.4); g.closePath(); ink(g, col, 0.7); g.fillStyle = hi; g.beginPath(); g.arc(-0.8, -0.8, 0.8, 0, TAU); g.fill(); g.restore() }
const flower = (g, x, y, col, mid) => { for (let k = 0; k < 5; k++) { const a = k / 5 * TAU; blob(g, x + Math.cos(a) * 1.2, y + Math.sin(a) * 1.2, 1, 1, col, 0.35) } blob(g, x, y, 0.75, 0.75, mid, 0.3) }
function wings(g, q, fill, edge, kind = 'feather') {   // 등 뒤 날개 둘 — 깃털(천사) · 둥근 잎(요정)
  for (const s of [-1, 1]) {
    g.save(); g.translate(s * 5.6, q.y(q.mid + 0.12)); g.scale(s, 1); g.beginPath(); g.moveTo(0, 0); g.bezierCurveTo(8, -10, 17, -9, 16, -3)
    if (kind === 'feather') for (let i = 0; i < 4; i++) g.quadraticCurveTo(15.6 - i * 3.4, 4.6 - i * 0.4, 12.6 - i * 3.4, 2.6 - i * 0.3)
    else g.bezierCurveTo(15, 4, 7, 6, 0, 2)
    g.closePath(); g.fillStyle = fill; g.fill(); g.lineWidth = 0.75; g.strokeStyle = edge; g.stroke(); g.restore()
  }
}
const tiara = (g, q, gem, col) => { const b = q.y(0.07); g.beginPath(); g.moveTo(-5, b); g.lineTo(-5.6, b - 2.4); g.lineTo(-2.6, b - 1.4); g.lineTo(0, b - 4.4); g.lineTo(2.6, b - 1.4); g.lineTo(5.6, b - 2.4); g.lineTo(5, b); g.closePath(); ink(g, '#d9dce3', 0.7); gem === 'heart' ? heartP(g, 0, b - 2, 1.2) : starP(g, 0, b - 2, 1.5, 0.6); ink(g, col, 0.4) }
const gown = (col, hi, gem, brooch) => ({ earsOver: true,   // 신데렐라 드레스 — 퍼지는 치마 · 접힌 어깨선 · 퍼프 소매 · 브로치 · 티아라
  back: (g, q) => { const y0 = q.neck + 1; g.beginPath(); g.moveTo(-9, y0); g.quadraticCurveTo(-15.5, -2, -17, 0.6); g.quadraticCurveTo(0, 3.4, 17, 0.6); g.quadraticCurveTo(15.5, -2, 9, y0); g.closePath(); ink(g, col, LW); g.strokeStyle = hi; g.lineWidth = 0.8; for (const x of [-10, -4, 4, 10]) { g.beginPath(); g.moveTo(x * 0.6, y0 + 2); g.lineTo(x * 1.2, 0.8); g.stroke() } },
  body: (g, q) => { const y0 = q.neck - 0.4; g.fillStyle = col; g.fillRect(-20, y0, 40, 40); g.fillStyle = hi; g.fillRect(-20, y0, 40, 1.6); g.fillStyle = '#fff'; for (const [x, k] of [[-5, 0.35], [3, 0.6], [6, 0.25], [-2, 0.8]]) { starP(g, x, y0 + (-1 - y0) * k, 1.1, 0.35, 4); g.fill() } },
  head: (g, q) => { for (const s of [-1, 1]) blob(g, s * q.ax, q.ay - 0.4, 2.2, 1.9, hi, LW); const by = q.neck + 1.8; gem === 'heart' ? heartP(g, 0, by, 1.7) : starP(g, 0, by, 1.9, 0.8); ink(g, brooch, 0.5); tiara(g, q, gem, brooch) },
})
const haloRing = (g, y, col, fluffy) => { if (fluffy) { for (let i = 0; i < 10; i++) { const a = i / 10 * TAU; blob(g, Math.cos(a) * 5.6, y + Math.sin(a) * 1.7, 1.5, 1.3, col, 0.4) } return } g.beginPath(); g.ellipse(0, y, 5.8, 1.7, 0, 0, TAU); g.strokeStyle = OUT; g.lineWidth = 2.4; g.stroke(); g.strokeStyle = col; g.lineWidth = 1.2; g.stroke() }
const angel = (dress, wing, halo, white) => ({   // 천사 — 원피스 · 검은 리본 · 깃털 날개 · 고리
  back: (g, q) => wings(g, q, wing, white ? '#b9b9cc' : OUT),
  body: (g, q) => suit(g, q, dress),
  head: (g, q) => { bow(g, 0, q.neck + 0.6, '#2a2a2a'); haloRing(g, q.t - 3.6, halo, white) },
})
const island = (crown, center) => ({ earsOver: true,   // 인어의 섬 — 꽃 화관 · 풀 치마(귀는 화관 위로)
  back: (g, q) => { g.strokeStyle = '#5fa84a'; g.lineWidth = 1; g.lineCap = 'round'; for (let i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(i * 1.9, q.y(0.8)); g.lineTo(i * 2.3, 0.6); g.stroke() } },
  body: (g, q) => { const y0 = q.neck + 1.4; g.fillStyle = '#86c565'; g.fillRect(-20, y0, 40, 30); g.strokeStyle = '#5fa84a'; g.lineWidth = 0.7; for (let i = -7; i <= 7; i++) { g.beginPath(); g.moveTo(i * 2, y0); g.lineTo(i * 2 + 0.6, y0 + 7); g.stroke() } g.fillStyle = '#6fb256'; g.fillRect(-20, y0 - 0.6, 40, 1.6) },
  head: (g, q) => { for (let i = 0; i < 7; i++) { const a = Math.PI * (1.08 + i * 0.14); flower(g, Math.cos(a) * (q.hw - 1.6), q.y(0.22) + Math.sin(a) * q.H * 0.2, Array.isArray(crown) ? crown[i % crown.length] : crown, center) } },
})
// 한 벌 후드 옷(얼굴만 뚫림) — 귀는 그 친구 귀 모양 그대로 옷 색으로. o = { col, belly, ears, earCol, inner, rim, extra(g, q) 몸 장식, top(g, q) 후드 위 장식, back(g, q) }
function hoodSuit(o) {   // 귀는 그 친구의 귀 모양 그대로 옷 색으로(earCol) — 모자 위에 귀가 나와야 하면 earsOver
  return {
    earCol: o.col, earsOver: o.earsOver, back: o.back,
    body: (g, q) => {
      suit(g, q, o.col); const [fx, fy, rx, ry] = faceHole(q, 0, true)
      g.save(); g.beginPath(); g.rect(-20, q.neck - 1.6, 40, 40); g.clip(); g.beginPath(); g.ellipse(fx, fy, rx, ry, 0, 0, TAU); g.fillStyle = q.fur; g.fill(); g.restore()   // 얼굴 구멍 중 목 밑 — 살색
      if (o.belly) { g.beginPath(); g.ellipse(0, chin(q) + 2.2, 4.2, 1.9, 0, 0, TAU); g.fillStyle = o.belly; g.fill() } o.extra?.(g, q) },
    head: (g, q) => { hoodRing(g, q, o.col, 0, true); if (o.rim) { const [fx, fy, rx, ry] = faceHole(q, 0, true); g.beginPath(); g.ellipse(fx, fy, rx, ry, 0, 0, TAU); g.lineWidth = 1.3; g.strokeStyle = o.rim; g.stroke(); g.lineWidth = 0.6; g.strokeStyle = OUT; g.stroke() } o.top?.(g, q) },
  }
}
const frogEyes = (g, q) => { for (const s of [-1, 1]) { blob(g, s * 6.6, q.y(0.03), 1.7, 1.7, '#fff', 0.5); blob(g, s * 6.6, q.y(0.04), 0.75, 0.85, '#2a2a2a', 0) } }   // 개구리 레인코트 — 귀 위에 눈
const snail = (g, q, c) => { for (const s of [-1, 1]) { g.strokeStyle = OUT; g.lineWidth = 1.6; g.lineCap = 'round'; g.beginPath(); g.moveTo(s * 1.4, q.t + 1.6); g.lineTo(s * 2.6, q.t - 4.4); g.stroke(); g.strokeStyle = c; g.lineWidth = 0.7; g.stroke(); blob(g, s * 2.7, q.t - 4.8, 1.5, 1.5, c, LW) } }   // 달팽이 더듬이
const buttons = (g, q, col = '#fff') => { for (let i = 0; i < 2; i++) blob(g, 0, chin(q) + 1.1 + i * 1.7, 0.7, 0.7, col, 0.5) }
const pockets = (g, q, col) => { for (const s of [-1, 1]) { g.beginPath(); g.roundRect(s * 5.2 - 1.6, chin(q) - 0.6, 3.2, 2.6, 0.7); ink(g, col, 0.5); g.strokeStyle = OUT; g.lineWidth = 0.4; g.beginPath(); g.moveTo(s * 5.2 - 1.6, chin(q) + 0.2); g.lineTo(s * 5.2 + 1.6, chin(q) + 0.2); g.stroke() } }
const tanukiTail = (g, q) => { g.save(); g.translate(-11.5, -6.5); g.rotate(-0.5); g.beginPath(); g.ellipse(0, 0, 3.4, 5.6, 0, 0, TAU); ink(g, '#a8784f', LW); g.save(); g.clip(); g.fillStyle = '#5a3d27'; for (const y of [-2.6, 0.6, 3.6]) g.fillRect(-4, y, 8, 1.3); g.restore(); g.restore() }
const navelX = (g, q) => { const cy = chin(q) + 2.2; g.strokeStyle = '#8b5e3c'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-0.8, cy - 0.7); g.lineTo(0.8, cy + 0.7); g.moveTo(0.8, cy - 0.7); g.lineTo(-0.8, cy + 0.7); g.stroke() }
function headLeaf(g, x, y, kind) {   // 너구리 머리 위 잎 — 단풍(빨강) · 은행(노랑) · 풀잎(초록)
  g.save(); g.translate(x, y)
  if (kind === 'ginkgo') { g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 4.4, Math.PI * 1.15, Math.PI * 1.85); g.closePath(); ink(g, '#f2c94c', 0.6) }
  else if (kind === 'maple') { starP(g, 0, -2.2, 3.8, 1.8); ink(g, '#e8643c', 0.6) }
  else { g.rotate(-0.5); g.beginPath(); g.ellipse(0, -2.4, 1.9, 3.4, 0, 0, TAU); ink(g, '#7cb66a', 0.6); g.strokeStyle = '#4f8a3a'; g.lineWidth = 0.4; g.beginPath(); g.moveTo(0, -5.4); g.lineTo(0, 0.6); g.stroke() }
  g.restore()
}
const takoBand = (g, q) => {   // 문어옷 — 이마에 꼰 흰 머리띠, 오른쪽 위 매듭
  const y0 = q.y(0.1); inHead(g, q, () => { g.beginPath(); g.rect(-16, y0 - 1.7, 32, 3.4); ink(g, '#fff', 0.6); g.strokeStyle = 'rgba(61,48,43,.35)'; g.lineWidth = 0.4; for (let x = -12; x <= 12; x += 2.2) { g.beginPath(); g.moveTo(x, y0 - 1.6); g.lineTo(x + 1.4, y0 + 1.6); g.stroke() } })
  for (const [dx, dy, r] of [[q.hw - 2.6, y0 - 2.4, 0.4], [q.hw - 0.6, y0 - 3.4, -0.5], [q.hw - 3.8, y0 - 3.8, 0.9]]) { g.beginPath(); g.ellipse(dx, dy, 1.6, 1, r, 0, TAU); ink(g, '#fff', 0.55) }
}
function mushCap(g, q, col, kind) {   // 버섯 모자 — 표고(갈라진 별 무늬) · 새송이(작고 옅은) · 양송이(둥근 갈색)
  const b = q.y(0.16), w = kind === 'eringi' ? q.hw + 0.6 : q.hw + 3.2, top = kind === 'eringi' ? q.t - 3 : q.t - 6.4
  g.beginPath(); g.moveTo(-w, b); g.bezierCurveTo(-w, top, w, top, w, b); g.quadraticCurveTo(0, b + 2.4, -w, b); ink(g, col, LW)
  g.strokeStyle = 'rgba(61,48,43,.35)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(-w + 1.4, b + 0.2); g.quadraticCurveTo(0, b + 1.8, w - 1.4, b + 0.2); g.stroke()
  if (kind === 'shiitake') { g.strokeStyle = 'rgba(255,240,220,.85)'; g.lineWidth = 0.7; g.lineCap = 'round'; for (let i = 0; i < 5; i++) { const a = -Math.PI / 2 + (i - 2) * 0.55; g.beginPath(); g.moveTo(0, (b + top) / 2 + 1); g.lineTo(Math.cos(a) * 5.4, (b + top) / 2 + 1 + Math.sin(a) * 3.4); g.stroke() } }
  else { g.fillStyle = 'rgba(255,255,255,.35)'; g.beginPath(); g.ellipse(-w * 0.4, (b + top) / 2, w * 0.25, 1.4, -0.3, 0, TAU); g.fill() }
}
function beanie(g, q, col, band) {   // 털모자 — 골이 진 접단 · 커다란 흰 방울(귀는 모자를 뚫고 나온다)
  const b = q.y(0.2), top = q.t - 2.6
  g.beginPath(); g.moveTo(-q.hw + 0.4, b); g.bezierCurveTo(-q.hw + 0.4, top, q.hw - 0.4, top, q.hw - 0.4, b); g.closePath(); ink(g, col, LW)
  g.beginPath(); g.roundRect(-q.hw - 0.2, b - 2.6, q.W + 0.4, 3.6, 1.6); ink(g, band, LW); g.strokeStyle = 'rgba(61,48,43,.3)'; g.lineWidth = 0.4; for (let x = -q.hw + 1.6; x < q.hw - 1; x += 1.8) { g.beginPath(); g.moveTo(x, b - 2.2); g.lineTo(x, b + 0.6); g.stroke() }
  const py = top + 1.4; for (let i = 0; i < 7; i++) { const a = i / 7 * TAU; blob(g, Math.cos(a) * 2.4, py - 1.6 + Math.sin(a) * 2.2, 1.9, 1.9, '#fff', 0.45) } blob(g, 0, py - 1.6, 2.3, 2.3, '#fff', 0)
}
function fairy(cap, suitCol, bowCol) {   // 요정 — 꽃 모자(귀는 모자를 뚫고 나온다) · 투명한 날개 · 목 리본
  return {
    earsOver: true, back: (g, q) => wings(g, q, 'rgba(234,244,255,.7)', 'rgba(61,48,43,.55)', 'leaf'),
    body: (g, q) => suit(g, q, suitCol),
    head: (g, q) => {
      const b = q.y(0.12); g.beginPath(); g.moveTo(-9.6, b); g.quadraticCurveTo(-9.4, q.t - 4, 0, q.t - 5.2); g.quadraticCurveTo(9.4, q.t - 4, 9.6, b); for (let i = 4; i >= -4; i--) g.quadraticCurveTo(i * 2.4 + 1.2, b + 2.4, i * 2.4 - 1.2, b); g.closePath(); ink(g, cap, LW)
      g.strokeStyle = '#7cb66a'; g.lineWidth = 1.2; g.lineCap = 'round'; g.beginPath(); g.moveTo(0, q.t - 5); g.quadraticCurveTo(1.4, q.t - 7.4, 2.6, q.t - 7.8); g.stroke()
      bow(g, 0, q.neck + 0.6, bowCol)
    },
  }
}
const TONE = {   // 캐릭터마다 옷 색 [진한 · 옅은 · 리본] — 파자마 · 요정 · 신데렐라
  chiikawa: ['#f7a8c4', '#fbc4d6', '#e26a93'], hachiware: ['#7bb8e0', '#a6d8f2', '#4f8fc0'], usagi: ['#f4d94a', '#f7ee9a', '#f0a030'], momonga: ['#b9a3e3', '#d9cdf5', '#8a6fc8'],
  kurimanju: ['#a9d18e', '#cfe6b8', '#6aa84f'], rakko: ['#8fa6d8', '#c3d0ef', '#5d74b3'], shisa: ['#ffb347', '#ffd59a', '#e8862a'], kani: ['#86d6c6', '#c2ece3', '#3fa892'],
}
const LOOKS = {   // 캐릭터마다 [너구리 잎, 레인코트(색 · 귀 장식 · 주머니 · 덧붙임), 버섯(색 · 종류), 털모자(색 · 접단)]
  chiikawa: ['leaf', ['#8ccf5f', 'frog', '#f2d24c'], ['#b98962', 'button'], ['#f5b3c1', '#ef9aab']],
  hachiware: ['ginkgo', ['#f4f08a', 'snail', '#9b86e8', 'pack'], ['#d8cfc4', 'eringi'], ['#a9d3ef', '#8cbfe2']],
  usagi: ['maple', ['#f5f5f2', null, '#b9b9c4', 'bow'], ['#7a4a2e', 'shiitake'], ['#f6d880', '#efc561']],
  momonga: ['maple', ['#d9cdf5', null, '#ffffff', 'bow'], ['#b98962', 'button'], ['#d9cdf5', '#c3b2ec']],
  kurimanju: ['ginkgo', ['#8ccf5f', 'frog', '#f2d24c'], ['#7a4a2e', 'shiitake'], ['#cfe6b8', '#b5d79a']],
  rakko: ['leaf', ['#f4f08a', null, '#9fd8f0'], ['#d8cfc4', 'eringi'], ['#c3d0ef', '#a8b9e6']],
  shisa: ['maple', ['#ffb347', null, '#ffe27a'], ['#b98962', 'button'], ['#ffd59a', '#ffc277']],
  kani: ['leaf', ['#86d6c6', 'frog', '#ffffff'], ['#d8cfc4', 'eringi'], ['#c2ece3', '#a5e0d4']],
}
const KINDS = {   // 같은 종류는 한 번 사면 모든 캐릭터가 입는다 — of(캐릭터) 가 그 캐릭터에 맞춘 그림(색 · 장식)
  pj: { tier: 'cheap', name: tr`파자마`, note: tr`파자마 파티즈 대신 무대에 섰을 때 입은 파자마(포셰트 갑옷 씨가 만들어 줬어요)`, of: ch => hoodSuit({ col: TONE[ch][1], extra: buttons }) },
  tako: { tier: 'cheap', name: tr`문어옷`, note: tr`빨간 문어 옷 · 꼰 머리띠`, ...hoodSuit({ col: '#e8584f', belly: '#f6cfb0', top: takoBand }) },
  tanu: { tier: 'cheap', name: tr`너구리옷`, note: tr`포셰트 갑옷 씨가 만든 너구리 옷 — 머리 위에 잎 하나`, of: ch => hoodSuit({ col: '#a8784f', belly: '#e8ddb5', back: tanukiTail, extra: navelX, top: (g, q) => headLeaf(g, 0.6, q.t + 0.6, LOOKS[ch][0]) }) },
  rain: { tier: 'cheap', name: tr`레인코트`, note: tr`비 오는 날의 레인코트 — 후드에 귀가 달렸어요`, of: ch => { const rc = LOOKS[ch][1]; return hoodSuit({ col: rc[0], rim: '#bfe3f5', top: rc[1] === 'frog' ? frogEyes : rc[1] === 'snail' ? (g, q) => snail(g, q, '#d9d46a') : undefined,
      extra: (g, q) => { pockets(g, q, rc[2]); if (rc[3] === 'bow') bow(g, 0, chin(q) + 1.6, '#e8473b') }, back: rc[3] === 'pack' ? (g, q) => { g.beginPath(); g.roundRect(-14, q.neck - 2.6, 6.4, 8.4, 2); ink(g, '#9b86e8', LW) } : undefined }) } },
  kino: { tier: 'cheap', name: tr`버섯옷`, note: tr`버섯 갓을 쓴 하얀 버섯 옷`, of: ch => hoodSuit({ col: '#fbf3e4', earsOver: true, top: (g, q) => mushCap(g, q, ...LOOKS[ch][2]) }) },
  knit: { tier: 'cheap', name: tr`털모자`, note: tr`커다란 방울이 달린 털모자`, of: ch => ({ earsOver: true, head: (g, q) => beanie(g, q, ...LOOKS[ch][3]) }) },
  fairy: { tier: 'rich', name: tr`요정`, note: tr`나무 인형의 마법으로 요정이 됐을 때 — 꽃 모자 · 투명한 날개`, of: ch => { const t = TONE[ch]; return { fx: { k: ['spark', 'petal'], col: [t[1], '#ffffff', t[0]], rate: 5 }, ...fairy(t[0], t[1], t[2]) } } },
}
const flameTop = (g, q) => {   // 불꽃 옷 — 후드 꼭대기에 일렁이는 불꽃 셋
  for (const [x, k, col] of [[-4.2, 0.65, '#ffb347'], [4.2, 0.65, '#ffb347'], [0, 1, '#ff6a2a']]) {
    g.save(); g.translate(x, q.t + 1.6); g.scale(k, k); g.beginPath(); g.moveTo(0, -9); g.quadraticCurveTo(5.6, -3, 3.4, 1.6); g.quadraticCurveTo(0, 3.6, -3.4, 1.6); g.quadraticCurveTo(-5.6, -3, 0, -9); g.closePath(); ink(g, col, LW / k)
    g.beginPath(); g.moveTo(0, -4.4); g.quadraticCurveTo(2.4, -1, 1.4, 1.2); g.quadraticCurveTo(0, 2, -1.4, 1.2); g.quadraticCurveTo(-2.4, -1, 0, -4.4); g.fillStyle = '#ffe36e'; g.fill(); g.restore()
  }
}
function roundFlag(g, x, y, r) {   // 머리띠 수건 — 고른 말의 나라 국기를 동그랗게 오려 붙인다
  const f = LANGS.find(l => l[0] === LANG)[2], [mx, my] = FLAG_MID[f], k = r / 7
  g.save(); g.beginPath(); g.arc(x, y, r, 0, TAU); g.clip(); g.translate(x, y); g.scale(k, k); g.translate(-mx, -my); FLAG[f](g); g.restore()
  g.beginPath(); g.arc(x, y, r, 0, TAU); g.lineWidth = 0.6; g.strokeStyle = OUT; g.stroke()
}
const OUTFIT = { ...KINDS,   // 일반 · 고급 = 종류(id 하나 · 모든 캐릭터), 업적 = 캐릭터마다(ch)
  // 일반 — 집에 있는 것으로 대충 만든 것(이펙트 없음)
  paper: { tier: 'cheap', name: tr`신문지 모자`, note: tr`신문지를 접어 만든 배 모양 모자`, earsOver: true,
    head: (g, q) => { const b = q.y(0.1); g.beginPath(); g.moveTo(-9.4, b); g.lineTo(-6.4, b - 6.4); g.lineTo(0, b - 8.6); g.lineTo(6.4, b - 6.4); g.lineTo(9.4, b); g.closePath(); crude(g, '#efefea'); g.strokeStyle = '#9a9a90'; g.lineWidth = 0.55; for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(-4.6, b - 2 - i * 1.6); g.lineTo(4.6, b - 2 - i * 1.6); g.stroke() } } },
  towel: { tier: 'cheap', name: tr`머리띠 수건`, note: tr`흰 수건 가운데에 동그란 국기를 그린 머리띠(고른 말의 나라)`,
    head: (g, q) => { const y0 = q.y(0.18); inHead(g, q, () => { g.beginPath(); g.rect(-15, y0 - 1.8, 30, 3.6); crude(g, '#ffffff', 0.8) }); roundFlag(g, 0, y0, 2.1)
      g.beginPath(); g.moveTo(-q.hw + 0.6, y0); g.lineTo(-q.hw - 3, y0 + 1.4); g.lineTo(-q.hw - 2.4, y0 + 3.2); g.closePath(); crude(g, '#ffffff', 0.9) } },
  box: { tier: 'cheap', name: tr`골판지 갑옷`, note: tr`택배 상자를 잘라 만든 갑옷 — 테이프가 보여요`,
    body: (g, q) => { const y0 = q.neck - 0.4; g.beginPath(); g.rect(-15, y0, 30, 20); crude(g, '#c9a06b', 0.8); g.fillStyle = '#e9d9b0'; g.fillRect(-1.3, y0, 2.6, 20); g.strokeStyle = 'rgba(61,48,43,.55)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(-8, y0 + 2); g.lineTo(-4.5, y0 + 3.2); g.moveTo(5, y0 + 4.4); g.lineTo(8.4, y0 + 3.2); g.stroke() } },
  bag: { tier: 'cheap', name: tr`비닐봉지 망토`, note: tr`장바구니 비닐봉지를 묶어 만든 망토`,
    back: (g, q) => { const y0 = q.y(q.mid - 0.04); g.beginPath(); g.moveTo(-6, y0); g.quadraticCurveTo(-18, y0 + 5, -17, -1.2); g.quadraticCurveTo(0, 1.6, 17, -1.2); g.quadraticCurveTo(18, y0 + 5, 6, y0); g.closePath(); g.fillStyle = 'rgba(236,246,255,.92)'; g.fill(); g.lineWidth = 1; g.strokeStyle = 'rgba(61,48,43,.7)'; g.stroke()
      g.strokeStyle = 'rgba(61,48,43,.3)'; g.lineWidth = 0.55; for (const x of [-12, -6, 6, 12]) { g.beginPath(); g.moveTo(x * 0.5, y0 + 3); g.lineTo(x, -1.4); g.stroke() } },
    head: (g, q) => { const y0 = q.neck + 0.4; for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 2.2, y0, 2.3, 1.4, s * 0.5, 0, TAU); g.fillStyle = 'rgba(236,246,255,.95)'; g.fill(); g.lineWidth = 0.8; g.strokeStyle = 'rgba(61,48,43,.7)'; g.stroke() } blob(g, 0, y0, 1.1, 1.1, 'rgba(236,246,255,1)', 0.8) } },
  cup: { tier: 'cheap', name: tr`종이컵 모자`, note: tr`다 마신 종이컵을 거꾸로 얹은 모자`,
    head: (g, q) => { const b = q.y(0.06); g.save(); g.translate(1.2, b); g.rotate(0.16); g.beginPath(); g.moveTo(-4.6, 0); g.lineTo(-3.4, -6.6); g.lineTo(3.4, -6.6); g.lineTo(4.6, 0); g.closePath(); crude(g, '#ffffff'); g.fillStyle = '#ff9ab0'; g.fillRect(-4.1, -3.6, 8.2, 1.6); g.restore() } },
  // 고급 — 원작에서 입고 나온 의상 + 이펙트
  ramen: { tier: 'rich', name: tr`라멘집 일꾼`, note: tr`라멘집 「郎」에서 일할 때 — 머리를 덮은 흰 수건 · 남색 티셔츠 · 숙주가 산더미인 라멘`, earCol: '#ffffff',
    fx: { k: ['steam'], col: ['rgba(255,255,255,.95)'], rate: 4 },
    body: (g, q) => { const y0 = q.neck - 0.4, m = (q.neck - 1) / 2 + 0.6; g.fillStyle = '#2b3352'; g.fillRect(-20, y0, 40, m - y0 + 0.5); g.fillStyle = '#fafafa'; g.fillRect(-20, m, 40, 20); g.strokeStyle = 'rgba(61,48,43,.4)'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(-20, m); g.lineTo(20, m); g.stroke(); g.fillStyle = '#fff'; g.fillRect(3.4, y0 + 1.2, 1.8, 1.8) },
    head: (g, q) => {
      const edge = () => { g.moveTo(-16, q.y(0.12)); g.quadraticCurveTo(0, q.y(0.17), 16, q.y(0.12)) }   // 하트 눈썹이 보이게 이마 위까지만
      inHead(g, q, () => { g.beginPath(); edge(); g.lineTo(16, q.t - 4); g.lineTo(-16, q.t - 4); g.closePath(); g.fillStyle = '#fff'; g.fill(); g.beginPath(); edge(); g.strokeStyle = 'rgba(61,48,43,.55)'; g.lineWidth = 0.6; g.stroke(); g.beginPath(); g.moveTo(-6, q.t + 1); g.quadraticCurveTo(-2, q.y(0.05), 3, q.y(0.08)); g.strokeStyle = 'rgba(61,48,43,.25)'; g.stroke() })   // 머리를 덮은 흰 수건
      const bx = -6, by = q.neck + 5.4;   // 옆구리에 든 라멘 — 입을 가리지 않게
      for (let i = 0; i < 6; i++) blob(g, bx - 4 + i * 1.6, by - 2.2 - Math.sin(i / 5 * Math.PI) * 2.8, 1.6, 1.4, '#f6efcf', 0.45); blob(g, bx + 1.4, by - 5.6, 1.4, 1.2, '#f6efcf', 0.45)   // 숙주 산더미
      g.beginPath(); g.moveTo(bx - 5.8, by - 1.4); g.lineTo(bx + 5.8, by - 1.4); g.quadraticCurveTo(bx + 5.2, by + 3.4, bx, by + 3.6); g.quadraticCurveTo(bx - 5.2, by + 3.4, bx - 5.8, by - 1.4); ink(g, '#fff', LW); g.strokeStyle = '#e8473b'; g.lineWidth = 0.5; g.beginPath(); g.moveTo(bx - 5, by - 0.3); g.lineTo(bx + 5, by - 0.3); g.stroke()   // 라멘 그릇
    } },
  crab: { tier: 'rich', cost: 1000, name: tr`게 머리띠`, note: tr`카니와 나눠 낀 분홍 게 집게 머리띠`,
    fx: { k: ['spark'], col: ['#ff9bb0', '#ffd0d8', '#ffffff'], rate: 5 },
    head: (g, q) => { g.strokeStyle = OUT; g.lineWidth = 1.6; g.beginPath(); g.arc(0, q.y(0.2), 9.4, Math.PI * 1.2, Math.PI * 1.8); g.stroke(); g.strokeStyle = '#f08a9a'; g.lineWidth = 0.8; g.stroke(); for (const s of [-1, 1]) pincer(g, s * 4.2, q.t - 1.2, s, '#f08a9a', '#f7b0ba') } },
  chestnut: { tier: 'rich', cost: 1000, name: tr`밤`, note: tr`핼러윈에 밤으로 변신 — 반들반들한 껍질 모자`, earsOver: true,
    fx: { k: ['nut', 'leaf'], col: ['#b5673b', '#d9a441', '#86c565'], rate: 3, fall: true },
    head: (g, q) => { const b = q.y(0.3); inHead(g, q, () => { g.beginPath(); g.moveTo(-16, b + 1); g.quadraticCurveTo(0, b - 3.6, 16, b + 1); g.lineTo(16, q.t - 4); g.lineTo(-16, q.t - 4); g.closePath(); g.fillStyle = '#d98b5f'; g.fill(); g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.ellipse(-4.6, q.y(0.1), 3.4, 1.6, -0.4, 0, TAU); g.fill() })
      g.lineWidth = 0.8; g.strokeStyle = OUT; g.beginPath(); g.moveTo(-q.hw + 0.4, b + 0.6); g.quadraticCurveTo(0, b - 3.6, q.hw - 0.4, b + 0.6); g.stroke()
      g.beginPath(); g.moveTo(-2.4, q.t + 0.6); g.quadraticCurveTo(0, q.t - 4.6, 2.4, q.t + 0.6); g.closePath(); ink(g, '#c27548', LW) } },
  daifuku: { tier: 'rich', cost: 1000, name: tr`딸기 찹쌀떡`, note: tr`핼러윈 만화에서 입은 딸기 찹쌀떡 — 이마 흉터는 그대로`, earsOver: true,
    fx: { k: ['dot'], col: ['#ffffff', '#fff6ec', '#ffe3e3'], rate: 6 },
    body: (g, q) => { g.fillStyle = '#f6f0e4'; g.fillRect(-20, q.neck - 0.4, 40, 40); g.fillStyle = '#fff'; for (const [x, k] of [[-6, 0.3], [4, 0.45], [-2, 0.75], [7, 0.8]]) { g.beginPath(); g.arc(x, q.neck + (-1 - q.neck) * k, 0.7, 0, TAU); g.fill() } },
    head: (g, q) => { const b = q.y(0.13); g.beginPath(); g.moveTo(-q.hw - 1.2, b); g.quadraticCurveTo(-q.hw - 1.4, q.t - 3.6, 0, q.t - 3.8); g.quadraticCurveTo(q.hw + 1.4, q.t - 3.6, q.hw + 1.2, b); g.quadraticCurveTo(0, b + 2.4, -q.hw - 1.2, b); ink(g, '#f6f0e4', LW)
      g.beginPath(); g.moveTo(0, q.t - 9.6); g.bezierCurveTo(4.6, q.t - 9.4, 4.2, q.t - 4.4, 0, q.t - 3); g.bezierCurveTo(-4.2, q.t - 4.4, -4.6, q.t - 9.4, 0, q.t - 9.6); ink(g, '#e5322d', LW)
      g.fillStyle = '#ffe36e'; for (const [x, y] of [[-1.6, -7.6], [1.4, -7.2], [-0.4, -5.6], [1.8, -5.4], [-2, -5.8]]) { g.beginPath(); g.arc(x, q.t + y, 0.35, 0, TAU); g.fill() }
      for (const s of [-1, 0, 1]) { g.beginPath(); g.ellipse(s * 1.6, q.t - 9.8, 1.7, 0.8, s * 0.6, 0, TAU); ink(g, '#5da34a', 0.5) } } },
  // 고급 — 생일 · 핼러윈 만화의 원작 의상(반짝임만, 발밑 빛은 업적에)
  cinder: { tier: 'rich', cost: 1000, name: tr`신데렐라`, note: tr`생일 만화의 신데렐라 — 반짝이는 드레스 · 티아라`,
    of: ch => { const t = TONE[ch]; return { fx: { k: ['spark', 'note', 'heart'], col: [t[1], '#ffffff', t[0], '#fff3a1'], rate: 5 }, ...gown(t[0], t[1], ['chiikawa', 'usagi', 'momonga', 'kani'].includes(ch) ? 'heart' : 'star', t[2]) } } },
  prince: { tier: 'rich', cost: 1000, name: tr`왕자님`, note: tr`생일 만화의 왕자님 — 단발 가발 · 금빛 견장 하얀 옷`, earsOver: true,
    fx: { k: ['spark', 'star'], col: ['#ff9be0', '#9fd8ff', '#fff3a1', '#b6f0c2'], rate: 5 },
    body: (g, q) => { suit(g, q, '#ffffff'); g.fillStyle = '#2e2e48'; g.fillRect(-0.9, q.neck - 0.4, 1.8, 30); for (let i = 0; i < 3; i++) blob(g, 2.2, q.neck + 1.4 + i * 2, 0.7, 0.7, '#e2b33c', 0.4) },
    head: (g, q) => { hoodRing(g, q, '#5a3a28'); g.fillStyle = '#5a3a28'; g.beginPath(); for (let i = -3; i <= 3; i++) { const x = i * 2.4 + q.look; g.moveTo(x - 1.4, q.y(0.21)); g.quadraticCurveTo(x, q.y(0.29), x + 1.4, q.y(0.21)) } g.fill()
      for (const s of [-1, 1]) { const ex = s * (q.ax + 0.6), ey = q.ay - 0.8; g.beginPath(); g.ellipse(ex, ey, 2.8, 1.5, s * 0.25, 0, TAU); ink(g, '#e2b33c', 0.6); g.strokeStyle = '#c8952a'; g.lineWidth = 0.5; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(ex + k * 0.9, ey + 1); g.lineTo(ex + k * 0.9, ey + 2.4); g.stroke() } } } },
  dark: { tier: 'rich', name: tr`검은 천사`, note: tr`핼러윈 만화의 검은 천사 — 회색 깃털 날개 · 어두운 고리`,
    fx: { k: ['feather', 'spark'], col: ['#5e5e66', '#8a7fb0', '#d9ccff'], rate: 5, fall: true }, ...angel('#6b6b70', '#5e5e66', '#55555c') },
  // 업적 — 인어의 섬 화관— 그 캐릭터로 어려움을 클리어하면. 영화 굿즈처럼 캐릭터마다 꽃 색이 다르고 발밑 빛 · 더 많은 반짝임
  a_chiikawa: { ch: 'chiikawa', tier: 'ach', name: tr`섬 화관`, note: tr`인어의 섬에서 — 분홍 꽃 화관 · 풀 치마`,
    fx: { k: ['petal', 'spark', 'heart'], col: ['#f7c6d9', '#e8d4f2', '#ffffff'], rate: 13, aura: 'rgba(255,190,215,.9)' }, ...island(['#f7c6d9', '#e8d4f2'], '#ffffff') },
  a_hachiware: { ch: 'hachiware', tier: 'ach', name: tr`섬 화관`, note: tr`인어의 섬에서 — 파란 꽃 화관 · 풀 치마`,
    fx: { k: ['petal', 'spark', 'bubble'], col: ['#6fa8e0', '#bfe0ff', '#ffffff'], rate: 13, aura: 'rgba(160,210,255,.9)' }, ...island('#a9d4f5', '#ffffff') },   // 머리색보다 옅은 파랑(묻히지 않게)
  a_usagi: { ch: 'usagi', tier: 'ach', name: tr`섬 화관`, note: tr`인어의 섬에서 — 노란 꽃 화관 · 풀 치마`,
    fx: { k: ['petal', 'spark', 'star'], col: ['#ffe27a', '#fff6c2', '#ffffff'], rate: 13, aura: 'rgba(255,236,150,.9)' }, ...island('#ffe27a', '#ffffff') },
  a_momonga: { ch: 'momonga', tier: 'ach', name: tr`섬 화관`, note: tr`인어의 섬에서 — 보라 꽃 화관 · 풀 치마`,
    fx: { k: ['petal', 'spark'], col: ['#b9a3e3', '#e3d9ff', '#ffffff'], rate: 13, aura: 'rgba(200,180,255,.9)' }, ...island('#b9a3e3', '#ffffff'), earsOver: false },   // 모몽가는 귀가 커서 화관이 귀 앞에(귀 끝은 그대로 보인다)
  a_shisa: { ch: 'shisa', tier: 'ach', name: tr`섬 화관`, note: tr`인어의 섬에서 — 주황 꽃 화관 · 풀 치마`,
    fx: { k: ['petal', 'spark'], col: ['#ffb347', '#ffe0b0', '#ffffff'], rate: 13, aura: 'rgba(255,200,140,.9)' }, ...island('#ffb347', '#ffffff') },
  a_kani: { ch: 'kani', tier: 'ach', name: tr`섬 화관`, note: tr`인어의 섬에서 — 민트 꽃 화관 · 풀 치마`,
    fx: { k: ['petal', 'bubble', 'spark'], col: ['#bfe8e2', '#ffffff', '#bfe9ff'], rate: 13, aura: 'rgba(190,240,230,.9)' }, ...island(['#ffffff', '#bfe8e2'], '#ffffff') },
  a_kurimanju: { ch: 'kurimanju', tier: 'ach', name: tr`섬 화관`, note: tr`인어의 섬에서 — 연두 꽃 화관 · 풀 치마`,
    fx: { k: ['petal', 'spark'], col: ['#ffd6e7', '#fff3a1', '#ffffff', '#d4e27a'], rate: 13, aura: 'rgba(255,240,180,.9)' }, ...island('#d4e27a', '#fff3a1') },
  a_rakko: { ch: 'rakko', tier: 'ach', name: tr`섬 화관`, note: tr`인어의 섬에서 — 하얀 꽃 화관 · 풀 치마`,
    fx: { k: ['petal', 'bubble'], col: ['#ffffff', '#fff3a1', '#bfe9ff'], rate: 13, aura: 'rgba(190,235,255,.9)' }, ...island('#f5f0dc', '#ffd23f') },
  pantu: { tier: 'rich', name: tr`판투`, note: tr`핼러윈 만화의 판투(미야코섬의 신) — 온몸에 덩굴 · 돌 가면`,
    fx: { k: ['dot', 'leaf'], col: ['#7a5b3a', '#93c47d', '#5e9a4b'], rate: 5 },
    back: (g, q) => { g.beginPath(); const n = 26; for (let i = 0; i <= n; i++) { const a = Math.PI + i / n * Math.PI * 2, r = (i % 2 ? 1.5 : 3.2), x = Math.cos(a) * (q.hw + r), y = (q.t + -1) / 2 + Math.sin(a) * (q.H / 2 + r); i ? g.lineTo(x, y) : g.moveTo(x, y) } g.closePath(); ink(g, '#93c47d', LW) },
    body: (g, q) => { g.fillStyle = '#93c47d'; g.fillRect(-20, q.neck - 0.4, 40, 30); g.strokeStyle = '#5e9a4b'; g.lineWidth = 0.7; g.lineCap = 'round'; for (let i = -6; i <= 6; i++) { g.beginPath(); g.moveTo(i * 2.2, q.neck); g.quadraticCurveTo(i * 2.2 + 1.2, q.neck + 3.4, i * 2.2 - 0.4, -1.4); g.stroke() } },
    head: (g, q) => { g.save(); g.translate(q.hw + 0.6, q.y(0.32)); g.rotate(0.25); g.beginPath(); g.roundRect(-3.4, -4.4, 6.8, 8.8, 2.6); ink(g, '#a6a6a6', LW); g.fillStyle = '#5c5c5c'; for (const x of [-1.4, 1.4]) { g.beginPath(); g.ellipse(x, -1.2, 0.8, 1, 0, 0, TAU); g.fill() } g.fillRect(-1.6, 1.8, 3.2, 0.7); g.restore()
      for (const s of [-1, 1]) { g.beginPath(); g.ellipse(s * 1.6, q.t - 2.2, 2, 0.9, s * -0.6, 0, TAU); ink(g, '#7cb66a', 0.5) } g.strokeStyle = '#5e9a4b'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(0, q.t + 0.6); g.lineTo(0, q.t - 1.8); g.stroke() } },
  white: { tier: 'rich', name: tr`하얀 천사`, note: tr`핼러윈 만화의 하얀 천사 — 하얀 깃털 날개 · 폭신한 고리`,
    fx: { k: ['feather', 'spark'], col: ['#ffffff', '#fff6d6', '#e6e6ff'], rate: 5, fall: true }, ...angel('#ffffff', '#ffffff', '#fff8e8', true) },
  // 업적 — 겨울 맵을 어려움으로 클리어하면(캐릭터 상관없이 · 모두 입는다). 꾸미기에 더해 눈보라에도 받는 피해가 늘지 않는다(G.fire)
  fire: { tier: 'ach', name: tr`불꽃 옷`, note: tr`몸이 따끈따끈한 불꽃 옷 — 눈보라를 만나도 받는 피해가 늘지 않아요`, won: () => (save.ach.winter || 0) > 0, lock: ['snow', tr` 겨울 어려움 클리어`],
    fx: { k: ['flame', 'spark', 'flame'], col: ['#ff7a2f', '#ffd23f', '#fff3a1'], rate: 13, aura: 'rgba(255,150,60,.9)' }, ...hoodSuit({ col: '#ff8a3d', belly: '#ffd96b', top: flameTop }) },
}
// 클리어 의상 — 「토벌대 망토」(디자인 2026-11-18) 캐릭터마다 넷: 쉬움 · 쉬움 겨울 · 보통 · 보통 겨울. 한 모양을 캐릭터 색(TONE)으로, 단계는 걸쇠(동 · 은) · 금실 테두리, 겨울은 털 장식 · 눈꽃 걸쇠.
//   위 단계로 깨면 아래도 열린다(어려움 · 무한 ⊃ 보통 ⊃ 쉬움 — clearLv · winLv). 「풀밭」 칸은 맵 상관없이(겨울에서 깨도 · 기획)
const CLR = { easy: 1, normal: 2, hard: 3, inf: 3 }
const clearLv = id => Math.max(0, ...Object.keys(CLR).map(d => (save.best[bestKey(id, d)]?.clears || 0) > 0 ? CLR[d] : 0)), winLv = id => save.wlv[id] || 0
function cape(ch, lv, wn) {   // 앞에서 망토로 읽히게 — 목에서 갈라져 양옆으로 벌어지는 앞자락(∧ 트임) + 몸 밖으로 이어지는 본체(디자인 2차)
  //   쉬움(새내기) = 목과 땅 사이 반쯤에서 끝나는 어깨 망토(배 아래로 몸이 보인다) · 단색 테 · 작은 동색 걸쇠(새싹 잎은 당근처럼 보여 뺐다), 보통(토벌대) = 땅까지 · 가운데 ∧ 트임에 굵은 금 띠 · 금 고리 은색 걸쇠 — 34px 에서도 갈리게(디자인 3차)
  const [c0, c1] = TONE[ch], gold = lv > 1, GOLD = '#e8c66a', clasp = gold ? ['#dfe4ea', '#97a2ae'] : ['#e0a46a', '#a8683a']
  const low = q => gold ? -1.4 : q.neck + (-1.4 - q.neck) * 0.5   // 밑단 높이
  const hem = (g, w1, yb) => { const st = 2 * w1 / 3; for (let i = 0; i < 3; i++) g.quadraticCurveTo(-w1 + st * (i + 0.5), yb - 0.8, -w1 + st * (i + 1), yb) }   // 밑단 얕은 물결 셋
  const edge = (q, sx) => { const x0 = sx * 1.4, y0 = q.neck + 0.6, x1 = sx * q.hw * 0.62, y1 = gold ? 1 : low(q); return [[x0, y0], [x0 + (x1 - x0) * (y1 - y0) / (1 - y0), y1]] }   // 앞자락 안쪽 변(트임) — 쉬움은 밑단 높이에서 자른다
  const line = (g, [[x0, y0], [x1, y1]], col, lw, dash) => { g.strokeStyle = col; g.lineWidth = lw; if (dash) g.setLineDash(dash); g.beginPath(); g.moveTo(x0, y0); g.lineTo(x1, y1); g.stroke(); g.setLineDash([]) }
  const fur = (g, pts) => { for (const [c, d] of [[OUT, 0.4], ['#fff', 0]]) { g.fillStyle = c; g.beginPath(); pts.forEach(([x, y], i) => { const r = (i % 2 ? 1.3 : 1) + d; g.moveTo(x + r, y); g.arc(x, y, r, 0, TAU) }); g.fill() } }   // 한 덩이 털 — 테를 먼저 다 칠하고 흰 속을 위에(사이 선이 사라진다)
  const along = ([[x0, y0], [x1, y1]], st = 1.3) => { const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / st)); return Array.from({ length: n + 1 }, (_, i) => [x0 + (x1 - x0) * i / n, y0 + (y1 - y0) * i / n]) }
  const shift = ([[x0, y0], [x1, y1]], k) => [[x0 + k, y0], [x1 + k, y1]]
  return {
    backFirst: true,   // 꼬리가 망토 위로
    back: (g, q) => {
      const y0 = q.neck - 1, w0 = q.hw * 0.55, w1 = q.hw + (gold ? 2.5 : 2), yb = low(q), cx = w1 + (gold ? 1.5 : 1)
      g.beginPath(); g.moveTo(-w0, y0); g.quadraticCurveTo(-cx, q.y(q.mid + 0.2), -w1, yb); hem(g, w1, yb); g.quadraticCurveTo(cx, q.y(q.mid + 0.2), w0, y0); g.closePath()
      g.fillStyle = c0; g.fill(); g.lineWidth = LW; g.strokeStyle = OUT; g.stroke()
      if (gold) line(g, [[-w1 + 1, yb - 1.2], [w1 - 1, yb - 1.2]], GOLD, 1.2)   // 보통 — 금 띠(밑단 · 양옆 끝에서 보인다)
      if (wn) fur(g, along([[-w1 + 0.4, yb - 0.2], [w1 - 0.4, yb - 0.2]]))
    },
    body: (g, q) => {   // 앞자락 두 장(몸 테두리 안) — 가운데는 ∧ 로 트이고 양옆을 덮는다
      for (const sx of [-1, 1]) {
        const e = edge(q, sx), [[x0, y0], [x1, y1]] = e
        g.beginPath(); g.moveTo(x0, y0); g.lineTo(sx * (q.hw + 3), q.neck - 2); g.lineTo(sx * (q.hw + 3), y1); g.lineTo(x1, y1); g.closePath(); g.fillStyle = c0; g.fill()
        if (gold) { line(g, shift(e, sx * 0.7), GOLD, 1.4); line(g, shift(e, sx * 1.6), OUT, 0.4) }   // 보통 — 잉크 · 금 · 잉크로 끼운 금 띠(노랑 · 민트 망토에서도 테로 떨어져 보이게)
        else line(g, shift(e, sx * 0.55), c1, 1.1)   // 안감 띠
        line(g, e, OUT, 0.7)   // 테
      }
      if (wn) fur(g, [...along(edge(q, -1)), ...along(edge(q, 1))])
    },
    head: (g, q) => {   // 걸쇠 — ∧ 꼭짓점(깃은 작은 손처럼 보여서 뺐다 · 디자인)
      const y = q.neck + 0.8
      if (gold) { g.beginPath(); g.arc(0, y, 2.6, 0, TAU); g.lineWidth = 0.9; g.strokeStyle = GOLD; g.stroke(); g.beginPath(); g.arc(0, y, 3.1, 0, TAU); g.lineWidth = 0.4; g.strokeStyle = OUT; g.stroke() }   // 보통 — 금 고리(메달처럼)
      g.beginPath(); g.arc(0, y, 2.1, 0, TAU); g.fillStyle = clasp[0]; g.fill(); g.lineWidth = 0.6; g.strokeStyle = clasp[1]; g.stroke(); blob(g, -0.7, y - 0.7, 0.6, 0.6, '#fff', 0)
      if (wn) flake(g, 0, y, 2.4, '#ffffff')
    },
    fx: wn ? { k: ['dot', 'spark'], col: ['#ffffff', '#bfe6ff'], rate: 4 } : gold ? { k: ['spark'], col: ['#ffffff', GOLD], rate: 3 } : null,
  }
}
const CAPE = [['e', 1, false, 'easy', tr` 쉬움 클리어`], ['ew', 1, true, 'snow', tr` 겨울 쉬움 클리어`], ['n', 2, false, 'normal', tr` 보통 클리어`], ['nw', 2, true, 'snow', tr` 겨울 보통 클리어`]]
const CAPE_STAT = { chiikawa: 'manju', hachiware: 'slipper', usagi: 'license', momonga: 'wage', kurimanju: 'clover', rakko: 'crit', shisa: 'coin', kani: 'pouch' }   // 망토 보유 효과 — 캐릭터마다 서로 다른 능력치(8캐릭이 같은 걸 모아도 안 쌓이게 · 기획)
for (const { id } of CHARS) for (const [k, lv, wn, ico, lock] of CAPE) {
  const { fx, ...art } = cape(id, lv, wn)
  OUTFIT[`k_${id}_${k}`] = { ch: id, tier: 'clear', name: lv > 1 ? (wn ? tr`눈꽃 토벌대 망토` : tr`토벌대 망토`) : wn ? tr`눈꽃 새내기 토벌대 망토` : tr`새내기 토벌대 망토`,
    note: lv > 1 ? (wn ? tr`털 장식 · 금 띠를 두른 긴 망토 — 눈꽃 은색 걸쇠` : tr`가운데 금 띠를 두른 긴 망토 — 금 고리 은색 걸쇠`) : wn ? tr`털 장식을 단 새내기 어깨 망토 — 눈꽃 동색 걸쇠` : tr`토벌대에 갓 들어온 새내기 어깨 망토 — 동색 걸쇠`,
    won: wn ? () => winLv(id) >= lv : () => clearLv(id) >= lv, lock: [ico, lock], ...(fx && { fx }), ...art }
}
const TIER_ORD = { cheap: 0, rich: 1, clear: 2, ach: 3 }, OUTFITS_OF = id => Object.keys(OUTFIT).filter(k => !OUTFIT[k].ch || OUTFIT[k].ch === id).sort((a, b) => TIER_ORD[OUTFIT[a].tier] - TIER_ORD[OUTFIT[b].tier] || priceOf(a) - priceOf(b))   // 일반 → 고급 → 업적
const achWon = id => clearLv(id) >= 3   // 그 캐릭터로 어려움 또는 무한 클리어(무한은 쓰러져도 세이렌을 한 번 쓰러뜨렸으면 — 클리어 단계 3)
// 의상 보유 효과 — 고급 · 업적 의상을 가지고만 있어도(입지 않아도) 아주 작은 능력치. [SHOP 능력치 id(coin = 토벌 보상금), 비율]. 다 모아도 능력치마다 4 ~ 5%
const BONUS = {
  crab: ['slipper', 0.01], chestnut: ['manju', 0.01], daifuku: ['clover', 0.02], cinder: ['wage', 0.01], prince: ['license', 0.01],
  fairy: ['pouch', 0.02], ramen: ['manju', 0.02], dark: ['license', 0.02], pantu: ['wage', 0.02], white: ['slipper', 0.02], fire: ['coin', 0.02],
  a_chiikawa: ['manju', 0.01], a_hachiware: ['slipper', 0.01], a_usagi: ['license', 0.01], a_momonga: ['wage', 0.01], a_kurimanju: ['clover', 0.02], a_rakko: ['crit', 0.01], a_shisa: ['coin', 0.02], a_kani: ['pouch', 0.02],
}
for (const [oid, o] of Object.entries(OUTFIT)) if (o.tier === 'clear') BONUS[oid] = [CAPE_STAT[o.ch], 0.005]   // 클리어 망토 한 벌 +0.5%(한 캐릭터 넷을 다 모으면 그 능력치 +2%)
const BONUS_ORDER = ['manju', 'license', 'slipper', 'wage', 'pouch', 'clover', 'crit', 'coin']
const bpct = v => v < 0.01 ? +(v * 100).toFixed(1) : Math.round(v * 100)   // 1% 아래는 소수 한 자리(0.5%)
const bonusLab = k => k === 'coin' ? tr`토벌 보상금` : k === 'crit' ? tr`치명타 확률` : SHOP[k].lab, bonusTxt = oid => { const [k, v] = BONUS[oid]; return `${bonusLab(k)} +${bpct(v)}%` }
const coll = k => Object.entries(BONUS).reduce((a, [oid, [s, v]]) => a + (s === k && OUTFIT[oid] && owns(oid) ? v : 0), 0)   // 그 능력치에 가진 의상 보유 효과 합
const owns = oid => { const o = OUTFIT[oid]; return o.tier === 'ach' || o.tier === 'clear' ? (o.won ? o.won() : achWon(o.ch)) : save.owned.includes(oid) }   // 업적 — 그 캐릭터 어려움 클리어(won 이 있으면 그 조건)
const wornId = id => { const o = save.wear[id], k = o && OUTFIT[o]; return k && (!k.ch || k.ch === id) && owns(o) ? o : null }
const LOOK_OF = {}, outfitOf = (oid, ch) => { const o = oid && OUTFIT[oid]; return !o ? undefined : o.of ? (LOOK_OF[oid + ':' + ch] ||= { ...o, ...o.of(ch) }) : o }   // 그 캐릭터가 입은 모습(종류는 캐릭터마다 색 · 장식)
const TIER_NAME = { cheap: tr`일반`, rich: tr`고급`, clear: tr`클리어`, ach: tr`업적` }

// 의상 이펙트 — 몸 둘레에 떠오르는 작은 모양. fx = { k: [모양], col: [색], rate: 1초에 몇 개, aura: 발밑 빛(업적) }. F = { list, acc } — 게임 · 미리 보기가 따로
function cfxStep(F, fx, x, y, dt, dir = 1) {
  if (fx?.spot) { const [sx, sy, r] = fx.spot; F.acc += dt * fx.rate; while (F.acc >= 1) { F.acc--; F.list.push({ k: pickOf(fx.k), col: pickOf(fx.col), x: x + dir * (sx + (rnd() - 0.5) * r), y: y + sy + (rnd() - 0.5) * r, vx: (rnd() - 0.5) * 6, vy: -4 - rnd() * 8, t: 0, T: 0.45 + rnd() * 0.45, s: 0.5 + rnd() * 0.4, rot: rnd() * TAU }) } fx = null }   // 무기 스킨 — 든 무기 둘레에서 반짝
  if (fx) { F.acc += dt * fx.rate; while (F.acc >= 1) { F.acc--; const a = rnd() * TAU, r = 7 + rnd() * 13; F.list.push({ k: pickOf(fx.k), col: pickOf(fx.col), x: x + Math.cos(a) * r * (fx.fall ? 1.3 : 1), y: fx.fall ? y - 40 + rnd() * 8 : y - 15 + Math.sin(a) * r * 0.75, vx: (rnd() - 0.5) * 10, vy: fx.fall ? 10 + rnd() * 10 : -12 - rnd() * 14, t: 0, T: 0.9 + rnd() * 0.6, s: (fx.aura ? 1.25 : 0.95) + rnd() * 0.7, rot: rnd() * TAU }) } }   // 업적 의상은 더 크게
  for (const q of F.list) { q.t += dt; if (q.g) q.vy += q.g * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.rot += dt * (q.spin || 2.2) }   // g — 떨어지는 것(얼음 조각)
  if (F.list.length && F.list[0].t > F.list[0].T) F.list = F.list.filter(q => q.t < q.T)
}
function cfxAura(c, fx, x, y, t) {   // 업적 의상 — 발밑에서 은은하게 숨 쉬는 빛
  if (!fx?.aura) return
  const g = c.createRadialGradient(x, y - 2, 2, x, y - 2, 30), a = 0.55 + 0.18 * Math.sin(t * 3)
  g.addColorStop(0, fx.aura); g.addColorStop(1, 'rgba(255,255,255,0)'); c.globalAlpha = a; c.fillStyle = g; oval(c, x, y - 2, 30, 15); c.fill()
  const u = t % 2 / 2; c.globalAlpha = (1 - u) * 0.8; c.strokeStyle = fx.col[0]; c.lineWidth = 1.6; oval(c, x, y - 2, 10 + u * 26, (10 + u * 26) * 0.5); c.stroke(); c.globalAlpha = 1   // 2초마다 퍼지는 반짝 고리
}
function cfxDraw(c, F) {
  for (const q of F.list) {
    c.globalAlpha = Math.max(0, Math.min(1, (1 - q.t / q.T) * 2, q.t * 6)); c.save(); c.translate(q.x, q.y); c.rotate(q.k === 'note' || q.k === 'steam' || q.k === 'flame' ? 0 : q.k === 'leaf' || q.k === 'feather' ? Math.sin(q.rot) * 0.8 : q.rot); c.scale(q.s, q.s); c.fillStyle = c.strokeStyle = q.col
    switch (q.k) {
      case 'spark': starP(c, 0, 0, 3.4, 0.9, 4); c.fill(); break
      case 'star': starP(c, 0, 0, 3, 1.3); c.fill(); break
      case 'heart': c.beginPath(); c.moveTo(0, 2.4); c.bezierCurveTo(-3.6, -0.2, -2.4, -3.4, 0, -1.4); c.bezierCurveTo(2.4, -3.4, 3.6, -0.2, 0, 2.4); c.fill(); break
      case 'flame': c.beginPath(); c.moveTo(0, -3.4); c.quadraticCurveTo(2.4, -0.6, 1.4, 1.4); c.quadraticCurveTo(0, 2.4, -1.4, 1.4); c.quadraticCurveTo(-2.4, -0.6, 0, -3.4); c.fill(); break
      case 'shard': c.beginPath(); c.moveTo(0, -3.2); c.lineTo(2.3, 1.2); c.lineTo(0.4, 2.6); c.lineTo(-2, 1.4); c.closePath(); c.fill(); c.lineWidth = 0.7; c.strokeStyle = '#ffffff'; c.stroke(); c.lineWidth = 0.35; c.strokeStyle = 'rgba(90,140,200,.8)'; c.stroke(); break   // 얼음 조각
      case 'note': c.beginPath(); c.ellipse(-0.8, 1.6, 1.5, 1.1, -0.4, 0, TAU); c.fill(); c.fillRect(0.4, -3, 0.7, 4.6); c.fillRect(0.4, -3, 2.2, 0.8); break
      case 'petal': c.beginPath(); c.ellipse(0, 0, 2.6, 1.2, 0, 0, TAU); c.fill(); break
      case 'leaf': c.beginPath(); c.ellipse(0, 0, 3, 1.5, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(61,48,43,.35)'; c.lineWidth = 0.35; c.beginPath(); c.moveTo(-2.6, 0); c.lineTo(2.6, 0); c.stroke(); break
      case 'feather': c.beginPath(); c.ellipse(0, 0, 3.4, 1.3, 0, 0, TAU); c.fill(); c.strokeStyle = 'rgba(61,48,43,.4)'; c.lineWidth = 0.35; c.stroke(); c.beginPath(); c.moveTo(-3.8, 0.4); c.lineTo(3, 0); c.stroke(); break
      case 'nut': c.beginPath(); c.arc(0, 0.4, 2, 0, TAU); c.fill(); c.beginPath(); c.moveTo(-1, -1.2); c.lineTo(0, -2.8); c.lineTo(1, -1.2); c.fill(); c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.arc(-0.6, -0.2, 0.6, 0, TAU); c.fill(); break
      case 'bat': c.beginPath(); c.moveTo(0, -0.6); c.quadraticCurveTo(-2.4, -2.6, -4.4, -0.8); c.quadraticCurveTo(-3, -0.2, -2.6, 1); c.quadraticCurveTo(-1.4, 0.2, 0, 1.4); c.quadraticCurveTo(1.4, 0.2, 2.6, 1); c.quadraticCurveTo(3, -0.2, 4.4, -0.8); c.quadraticCurveTo(2.4, -2.6, 0, -0.6); c.fill(); break
      case 'steam': c.globalAlpha *= 0.5; c.beginPath(); c.arc(0, 0, 1.4 + q.t * 2.6, 0, TAU); c.fill(); break
      case 'bubble': c.lineWidth = 0.6; c.beginPath(); c.arc(0, 0, 2.2, 0, TAU); c.stroke(); c.globalAlpha *= 0.6; c.beginPath(); c.arc(-0.7, -0.7, 0.6, 0, TAU); c.fill(); break
      default: c.beginPath(); c.arc(0, 0, 1.4, 0, TAU); c.fill()
    }
    c.restore()
  }
  c.globalAlpha = 1
}
/** 옷장 미리 보기 — 입은 의상 · 무기 스킨으로 제자리걸음 + 이펙트(옷장 화면에 있는 동안) */
function dressPreview(id, oid, wid) {
  const S = 3.2, W = 190, H = 176, c = mk(W, H), o = outfitOf(oid, id), w = wid && WSKIN[wid], frames = WALK.map(p => artSprite(id, S, { ...p, look: LOOK, outfit: o, wskin: w })), F = { list: [], acc: 0 }, FW = { list: [], acc: 0 }
  c.className = 'wr-pv'; let t = 0
  c._tick = dt => {
    t += dt; cfxStep(F, o?.fx, 0, 0, dt); cfxStep(FW, w?.fx, 0, 0, dt)
    const g = c.getContext('2d'), s = frames[(t * 7 | 0) % 4]; g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.setTransform(S, 0, 0, S, W / 2, H - 14)
    g.fillStyle = 'rgba(70,90,50,.18)'; oval(g, 0, -1, 12, 3); g.fill(); cfxAura(g, o?.fx, 0, 0, t); g.drawImage(s.c, -s.ox, -s.oy, s.w, s.h); cfxDraw(g, F); cfxDraw(g, FW)
  }
  c._tick(0)
  return c
}
/** 스킬 스킨 미리 보기 — 왼쪽 원래 · 오른쪽 스킨. 같은 스킬 그림이 날아가 펑 터진다(스킨은 물든 그림 · 지나간 자리 · 터진 자리 반짝이) */
function skinPreview(id) {
  const k = SKIN[id], S = 2, W = 300, H = 130, c = mk(W, H), s0 = icoSpr(id, 4), s1 = tinted(s0, k.col), F = { list: [], acc: 0 }
  c.className = 'wr-pv sk-pv'; let t = 0, boom = -1; const T = []   // T — 스킨 쪽 꼬리
  c._tick = dt => {
    t += dt; const n = t / 1.6 | 0, u = t % 1.6 / 1.6, fly = Math.min(1, u / 0.6), g = c.getContext('2d')
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, W, H); g.fillStyle = 'rgba(70,90,50,.15)'; g.fillRect(W / 2 - 1, 10, 2, H - 20); g.setTransform(S, 0, 0, S, 0, 0)
    for (const skin of [false, true]) {
      const ox = skin ? W / S / 2 : 0, x = ox + 16 + fly * 34, y = 37 - Math.sin(fly * Math.PI) * 12
      if (skin) { if (u < 0.6) { T.push(x, y); if (T.length > 18) T.splice(0, 2); if (T.length > 5) ribbon(g, T, k) } else T.length = 0 }
      if (u < 0.6) { const s = skin ? s1 : s0; g.save(); g.translate(x, y); g.rotate(fly * TAU); g.drawImage(s.c, -s.ox * 0.9, -s.oy * 0.9, s.w * 0.9, s.h * 0.9); g.restore(); if (skin && rnd() < dt * 25) skPuff(x, y, k, 1, F.list) }
      else { const v = (u - 0.6) / 0.4; g.globalAlpha = 1 - v; g.fillStyle = skin ? k.col2 : 'rgba(255,255,255,.8)'; g.beginPath(); g.arc(ox + 50, 37, 4 + v * 17, 0, TAU); g.fill(); g.strokeStyle = skin ? k.col : 'rgba(120,110,100,.6)'; g.lineWidth = 3 * (1 - v) + 0.6; g.stroke(); g.globalAlpha = 1 }
    }
    if (u >= 0.6 && boom !== n) { boom = n; skPuff(W / S / 2 + 50, 37, k, 10, F.list) }
    cfxStep(F, null, 0, 0, dt); cfxDraw(g, F)
  }
  c._tick(0)
  return c
}
/** 상점 — 강화(영구 강화 · 부활석) · 의상 · 무기 스킨 · 스킬 스킨 탭. 사기는 두 번 눌러야(실수로 비싼 것을 사지 않게).
 *  강화는 다음 판부터 stats() 에 더해지고, 꾸미기(의상 · 스킨)는 능력치 그대로. 일반 · 고급 의상은 한 번 사면 모든 캐릭터가 입는다 */
function shop(tab = 'up', ci = 0) {
  mode = 'shop'; G = null; BOX = null; pauseBtn.hidden = true   // 결과 화면에서 와도 뒤는 처음 화면처럼
  const have = h('p', { class: 'coin' }), modes = h('div', { class: 'wr-mode' }), tabs = h('div', { class: 'wr-tabs' }), view = h('div', { class: 'wr-view' }), list = h('ul'), msg = h('p', { class: 'wr-msg' }), note = h('p', { class: 'shop-note' })
  let peek   // 입어 보기 — 줄을 누르면 미리 보기에만 입힌다(undefined = 안 함, null = 기본)
  const put = (k, v) => { if (v) save.wear[k] = v; else delete save.wear[k]; peek = undefined; persist() }
  const buy = (cost, done, label) => h('button', { type: 'button', class: 'btn buy', disabled: save.coin < cost, onclick: e => {
    const b = e.currentTarget; if (!b.dataset.sure) { b.dataset.sure = 1; b.textContent = tr`한 번 더 누르면 사요`; return setTimeout(() => { if (b.isConnected) draw() }, 2500) }
    if (save.coin < cost) return; save.coin -= cost; done(); persist(); msg.textContent = tr`「${label}」을(를) 샀어요!`; draw() } }, [ic('coin'), ` ${cost.toLocaleString()}`])
  const btnState = (on, own, wearIt, lock, cost, done, label) => on ? h('button', { type: 'button', class: 'btn buy on', disabled: true }, tr`입는 중`)
    : own ? h('button', { type: 'button', class: 'btn buy', onclick: () => { wearIt(); draw() } }, tr`입기`)
    : lock ? h('button', { type: 'button', class: 'btn buy', disabled: true }, ...lock) : buy(cost, done, label)
  const item = (cls, pic, name, mark, mcls, text, extra, act, id) => h('li', { class: cls + (id !== undefined && peek === id ? ' peek' : ''), onclick: id === undefined ? null : e => { if (e.target.closest('button')) return; peek = id; draw() } }, pic, h('div', {}, h('b', {}, name, mark && h('mark', { class: mcls }, mark)), h('span', {}, text), extra && h('em', {}, extra)), act)
  const bonusBox = () => {   // 의상 보유 효과(닫혀 있다가 펼친다) — 능력치마다 「지금 / 다 모으면」 + 막대. 벌마다 효과는 그 의상 줄에
    const ids = Object.keys(BONUS).filter(k => OUTFIT[k]), pc = v => +(v * 100).toFixed(1)
    return h('li', { class: 'wr-bonus' }, h('details', {}, h('summary', {}, ic('coin'), tr` 의상 보유 효과 — ${ids.filter(owns).length} / ${ids.length}벌`),
      h('div', { class: 'sum' }, BONUS_ORDER.map(k => { const now = coll(k), all = ids.reduce((a, oid) => a + (BONUS[oid][0] === k ? BONUS[oid][1] : 0), 0)
        return h('div', { class: now ? 'on' : '' }, h('span', {}, bonusLab(k)), h('b', {}, `+${pc(now)}%`, h('small', {}, tr` · 최대 ${pc(all)}%`)), h('i', { style: `--w:${now / all * 100}%` })) })),
      h('small', {}, tr`고급 · 업적 의상은 입지 않아도 가지고만 있으면 효과가 있어요`)))
  }
  const wearAll = oid => { for (const c of CHARS) { if (oid) save.wear[c.id] = oid; else delete save.wear[c.id] } peek = undefined; persist(); msg.textContent = tr`모두 「${oid ? OUTFIT[oid].name : tr`기본`}」을(를) 입었어요`; draw() }   // 일괄 착용 — 모든 캐릭터
  const rows = {
    up: () => [h('li', { class: 'stone' }, ic('stone'), h('div', {}, h('b', {}, tr`부활석`, h('small', {}, tr`${save.stone}개`)), h('span', {}, tr`쓰러지면 하나 써서 다시 일어나요 — 판마다 ${Object.values(DIFF).map(d => `${d.name} ${d.revive}`).join(' · ')}번까지`)),
      h('button', { type: 'button', class: 'btn buy', disabled: save.coin < STONE, onclick: () => { if (save.coin < STONE) return; save.coin -= STONE; save.stone++; persist(); draw() } }, [ic('coin'), ` ${STONE.toLocaleString()}`])),
      ...Object.entries(SHOP).map(([id, u]) => {
        const lv = save.up[id] || 0, full = lv >= u.max, cost = u.cost * (lv + 1)
        return h('li', {}, ic(id), h('div', {}, h('b', {}, u.name, h('small', { 'aria-label': tr`${lv} / ${u.max}칸` }, '●'.repeat(lv) + '○'.repeat(u.max - lv))), h('span', {}, `${u.lab} ${u.val(u.per * lv)}`, full ? tr` (끝)` : ` → ${u.val(u.per * (lv + 1))}`)),
          h('button', { type: 'button', class: 'btn buy', disabled: full || save.coin < cost, onclick: () => { if (full || save.coin < cost) return; save.coin -= cost; save.up[id] = lv + 1; persist(); draw() } }, full ? tr`다 샀어요` : [ic('coin'), ` ${cost}`]))
      })],
    outfit: ch => [null, ...OUTFITS_OF(ch.id)].map(oid => { const o = oid && OUTFIT[oid], on = wornId(ch.id) === oid, own = !o || owns(oid), fx = outfitOf(oid, ch.id)?.fx
      const act = btnState(on, own, () => put(ch.id, oid), (o?.tier === 'ach' || o?.tier === 'clear') && (o.lock ? [ic(o.lock[0]), o.lock[1]] : [ic('hard'), tr` 어려움 클리어`]), o && priceOf(oid), () => { save.owned.push(oid); put(ch.id, oid) }, o?.name)
      const fxT = fx && (o.tier === 'ach' ? tr`이펙트: 아주 화려하게 반짝반짝!` : tr`이펙트: 반짝반짝`), bon = BONUS[oid] && h('span', { class: 'bon' + (own ? ' on' : '') }, tr`보유 효과 ${bonusTxt(oid)}`)   // 가지고 있으면 금빛
      return item(`wr-${o ? o.tier : 'base'}${on ? ' on' : ''}`, portrait(ch.id, oid, wornW(ch.id)), o ? o.name : tr`기본`, o && TIER_NAME[o.tier], o?.tier, o ? o.note : tr`평소 모습`, (fxT || bon) && [fxT, fxT && bon && ' · ', bon],
        own && !o?.ch ? h('div', { class: 'acts' }, act, h('button', { type: 'button', class: 'btn buy all', onclick: () => wearAll(oid) }, tr`모두 입기`)) : act, oid) }),
    weapon: ch => [null, ...WSKINS_OF(ch.id)].map(wid => { const w = wid && WSKIN[wid], on = wornW(ch.id) === wid
      const kind = w ? (w.tier === 'shop' ? 'rich' : w.tier) : 'base'   // 줄 색 — 상점(노랑) · 업적(분홍) · 겨울(하늘)
      return item(`wr-${kind}${on ? ' on' : ''}`, portrait(ch.id, wornId(ch.id), wid), w ? w.name : tr`기본 무기`, w && (w.tier === 'ach' ? tr`업적` : w.tier === 'winter' || w.tier === 'easyw' ? tr`겨울` : w.tier === 'easy' ? tr`클리어` : tr`상점`), kind, w ? w.note : tr`원래 들고 있던 무기`, null,
        btnState(on, !w || ownsW(wid), () => put('w:' + ch.id, wid), WLOCK[w?.tier] && [ic(WLOCK[w.tier][0]), WLOCK[w.tier][1]], WSKIN_COST, () => { save.owned.push(wid); put('w:' + ch.id, wid) }, w?.name), wid) }),
    skill: () => Object.keys(SKIN).map(id => { const k = SKIN[id], own = ownsS(id), on = skOn(id)
      const act = on ? h('button', { type: 'button', class: 'btn buy on', onclick: () => { save.skin[id] = false; persist(); draw() } }, tr`끄기`) : own ? h('button', { type: 'button', class: 'btn buy', onclick: () => { save.skin[id] = true; persist(); draw() } }, tr`켜기`) : buy(SKIN_COST, () => { save.owned.push('sk:' + id); save.skin[id] = true }, k.name)
      return item(`wr-sk${on ? ' on' : ''}`, h('span', { class: 'sw', style: `--a:${k.col};--b:${k.col2}` }, ic(id)), k.name, WEAP[id].name, 'sk', k.note, !own && tr`각성해 본 스킬은 그냥 받아요`, act, id) }),
  }
  const draw = () => {
    const ch = CHARS[ci], dress = tab === 'outfit' || tab === 'weapon'
    have.replaceChildren(ic('coin'), tr` 모은 토벌 보상금 ${save.coin.toLocaleString()}`)
    modes.replaceChildren(...[['up', 'manju', tr`강화`], ['outfit', 'shirt', tr`의상`], ['weapon', ch.w, tr`무기 스킨`], ['skill', 'awaken', tr`스킬 스킨`]].map(([k, pic, s]) => h('button', { type: 'button', class: k === tab ? 'on' : '', onclick: () => { tab = k; peek = undefined; msg.textContent = ''; draw() } }, ic(pic), ` ${s}`)))
    tabs.hidden = !dress; view.hidden = tab === 'up'; view.classList.toggle('sk', tab === 'skill'); list.className = tab === 'up' ? 'list shop' : 'list wr'
    if (tab === 'skill') { const sid = peek ?? Object.keys(SKIN)[0]; view.replaceChildren(skinPreview(sid), h('p', {}, h('b', {}, SKIN[sid].name), h('small', {}, tr`${WEAP[sid].name} — 왼쪽 원래 · 오른쪽 스킨`), h('small', { class: 'tip' }, tr`줄을 누르면 미리 볼 수 있어요`))) }
    if (dress) {
      tabs.replaceChildren(...CHARS.map((c, i) => h('button', { type: 'button', class: i === ci ? 'on' : '', 'aria-label': c.name, onclick: () => { ci = i; peek = undefined; msg.textContent = ''; draw() } }, portrait(c.id))))
      const cur = tab === 'outfit' ? wornId(ch.id) : wornW(ch.id), T = tab === 'outfit' ? OUTFIT : WSKIN, nm = id => id ? T[id].name : tab === 'outfit' ? tr`기본` : tr`기본 무기`, trying = peek !== undefined && peek !== cur
      const po = tab === 'outfit' && trying ? peek : wornId(ch.id), pw = tab === 'weapon' && trying ? peek : wornW(ch.id)
      view.replaceChildren(dressPreview(ch.id, po, pw), h('p', {}, h('b', {}, ch.name), trying ? h('small', { class: 'try' }, tr`입어 보는 중: ${nm(peek)}`) : h('small', {}, tr`입는 중: ${nm(cur)}`), h('small', { class: 'tip' }, tr`줄을 누르면 입어 볼 수 있어요`)))
      requestAnimationFrame(() => tabs.querySelector('.on')?.scrollIntoView({ block: 'nearest', inline: 'center' }))   // 고른 캐릭터가 보이게
    }
    list.replaceChildren(...rows[tab](ch))
    if (tab === 'outfit') list.prepend(bonusBox())   // 보유 효과 — 눌러서 펼친다
    note.textContent = tab === 'up' ? tr`판이 끝나면 버틴 시간 · 처치 · 보스 · 클리어만큼 보상금(어려울수록 더). 강화는 조금씩 — 다 사도 같은 아이템 한 레벨 정도예요. 부활석은 쓰면 없어져요`
      : tab === 'outfit' ? tr`일반 · 고급 의상은 한 번 사면 모든 캐릭터가 입을 수 있어요(「모두 입기」로 한꺼번에). 업적 의상은 그 캐릭터로 어려움을 클리어하면 받아요. 고급 · 업적 의상은 모으면 아주 작은 보유 효과가 생겨요(입지 않아도) — 맨 위 「의상 보유 효과」를 눌러 보세요. 불꽃 옷은 눈보라에도 받는 피해가 늘지 않아요`
      : tab === 'weapon' ? tr`무기 스킨은 손에 든 무기 모양만 바꿔요. 하나는 상점에서, 하나는 그 캐릭터로 보통 이상을 클리어하면, 하나는 그 캐릭터로 겨울 맵을 보통 이상 클리어하면 받아요`
      : tr`스킬 스킨은 그 스킬의 색과 반짝이만 바꿔요 — 세기는 그대로예요. 상점에서 사거나, 그 스킬을 한 번 각성해 보면 그냥 받아요`
  }
  draw()
  show(h('div', { class: 'panel guide pick wardrobe' }, h('p', { class: 'h' }, ic('coin'), tr` 상점`), have, modes, tabs,
    h('div', { class: 'scroll' }, view, msg, list, note),
    h('div', { class: 'row' }, btn(tr`← 처음으로`, title), btn(tr`토벌 시작!`, chars, 'main'))))
}
setInterval(() => { if (mode === 'shop') ui.querySelector('.wr-pv')?._tick?.(0.06) }, 60)   // 상점 미리 보기 — 걷기 · 이펙트

// ---------------------------------------------------------------- 무기 스킨 · 스킬 스킨 — 꾸미기만(능력치는 그대로)
//   무기 스킨: 캐릭터마다 둘 — 상점(WSKIN_COST) · 업적(그 캐릭터로 보통 이상 클리어). 든 무기를 바꿔 그린다(모몽가 · 시사는 스킨을 끼우면 손에 든다)
//   스킬 스킨: 스킬마다 하나 — 상점(SKIN_COST), 그 스킬을 각성해 본 적이 있으면 그냥 받는다. 그 스킬의 색을 바꾸고 지나간 자리에 작은 반짝이를 남긴다
//   save.wskin[캐릭터] = 낀 무기 스킨 id, save.skin[스킬] = 켰는지, save.owned 에 산 것('sk:스킬')
const WSKIN_COST = 1000, SKIN_COST = 1000   // 2026-11-18 사용자: 의상 · 스킨 값 1/10
function stickSkin(g, x, y, col, stripe, ends, bolt) {   // 토벌봉 모양 막대
  g.save(); g.translate(x, y); g.rotate(-1.3)
  for (const [c, lw] of [[OUT, 2.8], [col, 1.6]]) { g.strokeStyle = c; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath(); g.moveTo(-5, 0); g.lineTo(17, 0); g.stroke() }
  if (stripe) { g.strokeStyle = stripe; g.lineWidth = 1.6; g.lineCap = 'butt'; for (let i = -4; i < 16; i += 3) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 1.4, 0); g.stroke() } }
  for (const e of [-5, 17]) { blob(g, e, 0, 1.4, 1.4, ends, 0.6); if (bolt) { const s = Math.sign(e); g.strokeStyle = '#ffd23f'; g.lineWidth = 0.8; g.lineCap = 'round'; g.beginPath(); g.moveTo(e + s * 0.6, -1.4); g.lineTo(e + s * 2.4, -3); g.lineTo(e + s * 1.6, -1.2); g.lineTo(e + s * 3.6, -2.6); g.stroke() } }
  g.restore()
}
const flake = (g, x, y, r, col = '#fff') => { g.save(); g.translate(x, y); g.lineCap = 'round'; for (const [c, lw] of [[OUT, r * 0.55], [col, r * 0.24]]) { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); for (let i = 0; i < 3; i++) { const a = i * Math.PI / 3 + Math.PI / 6; g.moveTo(Math.cos(a) * r, Math.sin(a) * r); g.lineTo(-Math.cos(a) * r, -Math.sin(a) * r) } g.stroke() } g.restore() }   // 눈꽃 — 여섯 갈래
function wand(g, x, y, col, top, topCol) {   // 끝에 하트 · 보석 · 눈꽃이 달린 지팡이
  g.save(); g.translate(x, y); g.rotate(-1.25)
  for (const [c, lw] of [[OUT, 2.4], [col, 1.2]]) { g.strokeStyle = c; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath(); g.moveTo(-1.5, 0); g.lineTo(10, 0); g.stroke() }
  g.translate(12, 0); g.rotate(1.25)
  if (top === 'heart') { heartP(g, 0, 0, 2.6); ink(g, topCol, 0.7) }
  else if (top === 'flake') flake(g, 0, 0, 3.2, topCol)
  else { g.beginPath(); g.moveTo(0, -3.4); g.lineTo(2.6, 0); g.lineTo(0, 3); g.lineTo(-2.6, 0); g.closePath(); ink(g, topCol, 0.7); g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.moveTo(0, -2.4); g.lineTo(1.1, -0.4); g.lineTo(-0.6, -0.4); g.fill() }
  g.restore()
}
function cup(g, col, top, foam) {   // 쿠리만쥬 잔 자리 그대로 — 손잡이 없는 잔
  g.lineWidth = 0.65; g.strokeStyle = OUT; g.fillStyle = col; g.beginPath(); g.rect(11, -9.8, 3.4, 4.4); g.fill(); g.stroke()
  if (foam) for (const dx of [-1, 0, 1]) blob(g, 12.7 + dx * 1.1, -10.2, 1, 0.9, top, 0.45); else blob(g, 12.7, -10, 2.1, 1, top, 0.55)
}
function blade(g, x, y, col, guard, glow) {   // 세워 든 칼(랏코 칼과 같은 모양)
  g.save(); g.translate(x, y); g.rotate(-1.35)
  if (glow) { g.strokeStyle = 'rgba(160,220,255,.65)'; g.lineWidth = 4.4; g.lineCap = 'round'; g.beginPath(); g.moveTo(2, 0); g.lineTo(15.6, 0); g.stroke() }
  g.beginPath(); g.moveTo(1.8, -1); g.lineTo(14.6, -1); g.lineTo(16.6, 0); g.lineTo(14.6, 1); g.lineTo(1.8, 1); g.closePath(); g.fillStyle = col; g.fill(); g.strokeStyle = OUT; g.lineWidth = 0.65; g.stroke()
  g.lineCap = 'round'
  for (const [c, lw] of [[OUT, 2.3], [guard, 1.1]]) { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); g.moveTo(1.4, -2.6); g.lineTo(1.4, 2.6); g.stroke() }
  for (const [c, lw] of [[OUT, 2.3], ['#6b4a2f', 1.1]]) { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); g.moveTo(-3.2, 0); g.lineTo(0.6, 0); g.stroke() }
  g.restore()
}
function ladle(g, x, y, col, shine) {   // 라멘 국자
  g.save(); g.translate(x, y); g.rotate(-1.2)
  for (const [c, lw] of [[OUT, 2.4], ['#a8784f', 1.2]]) { g.strokeStyle = c; g.lineWidth = lw; g.lineCap = 'round'; g.beginPath(); g.moveTo(-2, 0); g.lineTo(11, 0); g.stroke() }
  g.beginPath(); g.ellipse(13.2, 0.8, 2.8, 2.2, 0.3, 0, TAU); ink(g, col, 0.7); if (shine) { g.fillStyle = '#fff'; starP(g, 12.4, 0, 0.9, 0.3, 4); g.fill() }
  g.restore()
}
function bookAt(g) { g.translate(11.4, -5); g.scale(-1, 1); g.rotate(-0.15) }   // 카니 책 자리 — 다른 친구들처럼 앞손(오른쪽 · 들고 있는 무기 자리). 거울로 돌려 하얀 책장이 몸 쪽
function tome(g, col, mark, magic, snow) {   // 카니 책(무기 스킨) — 자리 · 방향은 bookAt. snow — 표지에 별 대신 눈꽃
  g.save(); bookAt(g); g.fillStyle = col; g.fillRect(-2, -2.8, 4, 5.6); g.fillStyle = '#fff'; g.fillRect(1.1, -2.3, 0.7, 4.6); g.strokeStyle = OUT; g.lineWidth = 0.6; g.strokeRect(-2, -2.8, 4, 5.6)
  if (snow) flake(g, -0.45, 0, 1.35, mark); else { starP(g, -0.45, 0, 1.25, 0.5); ink(g, mark, 0.35) }
  if (magic) { g.fillStyle = '#fff6a8'; for (const [a, b] of [[-3.2, -3.8], [2.6, -4.2]]) { starP(g, a, b, 0.9, 0.3, 4); g.fill() } }
  g.restore()
}
const sasuHold = col => (g, x, y) => { g.save(); g.translate(x, y); g.rotate(-1.2); g.translate(-5, 0); sasuShape(g, 17, col); g.restore() }
const guitarHold = (body, neck, deco) => (g, x, y) => { g.save(); g.translate(x - 4, y + 2.4); g.rotate(-0.75); guitar(g, body, neck); deco?.(g); g.restore() }
const WSKIN = {
  w_chiikawa: { ch: 'chiikawa', tier: 'shop', name: tr`민트 사스마타`, note: tr`시원한 민트색 사스마타`, hold: sasuHold('#7fe0c0') },
  v_chiikawa: { ch: 'chiikawa', tier: 'ach', name: tr`별빛 사스마타`, note: tr`금빛으로 반짝이는 사스마타`, hold: (g, x, y) => { sasuHold('#ffd23f')(g, x, y); g.save(); g.translate(x, y); g.rotate(-1.2); starP(g, 14.6, 0, 2.6, 1.1); ink(g, '#fff6a8', 0.6); g.restore() } },
  w_hachiware: { ch: 'hachiware', tier: 'shop', name: tr`하늘 기타`, note: tr`하늘색 몸통에 하얀 별 하나`, hold: guitarHold('#9fd8ff', '#5a7fa0', g => { starP(g, -2.4, 0, 1.6, 0.7); ink(g, '#fff', 0.4) }) },
  v_hachiware: { ch: 'hachiware', tier: 'ach', name: tr`반짝이 기타`, note: tr`금빛으로 빛나는 무대용 기타`, hold: guitarHold('#ffd23f', '#c8952a', g => { g.fillStyle = '#fff'; for (const [a, b] of [[-3.4, -1.4], [-1, 1.4], [2, -0.8]]) { starP(g, a, b, 0.9, 0.3, 4); g.fill() } }) },
  w_usagi: { ch: 'usagi', tier: 'shop', name: tr`사탕 지팡이`, note: tr`빨강 하양 줄무늬 사탕 막대`, hold: (g, x, y) => stickSkin(g, x, y, '#fff', '#e8473b', '#ffb3c7') },
  v_usagi: { ch: 'usagi', tier: 'ach', name: tr`번개봉`, note: tr`양 끝에서 번개가 튀는 파란 토벌봉`, hold: (g, x, y) => stickSkin(g, x, y, '#7fc8ff', null, '#fff36e', true) },
  w_momonga: { ch: 'momonga', tier: 'shop', name: tr`하트 지팡이`, note: tr`끝에 분홍 하트가 달린 작은 지팡이`, hold: (g, x, y) => wand(g, x, y, '#ffb3cf', 'heart', '#ff7aa8') },
  v_momonga: { ch: 'momonga', tier: 'ach', name: tr`보석 지팡이`, note: tr`커다란 보석이 반짝이는 지팡이`, hold: (g, x, y) => wand(g, x, y, '#d9dce3', 'gem', '#7fd8ff') },
  w_kurimanju: { ch: 'kurimanju', tier: 'shop', name: tr`녹차 잔`, note: tr`따끈한 녹차가 든 찻잔`, front: g => cup(g, '#9cc874', '#5f8f3f') },
  v_kurimanju: { ch: 'kurimanju', tier: 'ach', name: tr`황금 잔`, note: tr`거품이 넘치는 황금 잔`, front: g => cup(g, '#ffd23f', '#fffbe6', true) },
  w_rakko: { ch: 'rakko', tier: 'shop', name: tr`벚꽃 검`, note: tr`분홍 칼날의 검`, hold: (g, x, y) => blade(g, x, y, '#ffc2d6', '#ff7aa8') },
  v_rakko: { ch: 'rakko', tier: 'ach', name: tr`전설의 검`, note: tr`푸르게 빛나는 칼날 · 금빛 손잡이`, hold: (g, x, y) => blade(g, x, y, '#bfe9ff', '#ffd23f', true) },
  w_shisa: { ch: 'shisa', tier: 'shop', name: tr`국자`, note: tr`라멘집에서 쓰는 커다란 국자`, hold: (g, x, y) => ladle(g, x, y, '#d6dde6') },
  v_shisa: { ch: 'shisa', tier: 'ach', name: tr`황금 국자`, note: tr`비법 국물을 뜨는 황금 국자`, hold: (g, x, y) => ladle(g, x, y, '#ffd23f', true) },
  w_kani: { ch: 'kani', tier: 'shop', name: tr`그림책`, note: tr`별 그림이 있는 노란 그림책`, front: g => tome(g, '#ffe36e', '#e8473b') },
  v_kani: { ch: 'kani', tier: 'ach', name: tr`마법서`, note: tr`금빛 별이 박힌 보라 마법서`, front: g => tome(g, '#7a5cc8', '#ffd23f', true) },
}
Object.assign(WSKIN, {   // 겨울 — 그 캐릭터로 겨울 맵을 보통 이상 클리어하면(save.wwin)
  s_chiikawa: { ch: 'chiikawa', tier: 'winter', name: tr`눈꽃 사스마타`, note: tr`끝에 눈꽃이 달린 하늘색 사스마타`, hold: (g, x, y) => { sasuHold('#bfe6ff')(g, x, y); g.save(); g.translate(x, y); g.rotate(-1.2); flake(g, 14.6, 0, 3, '#ffffff'); g.restore() } },
  s_hachiware: { ch: 'hachiware', tier: 'winter', name: tr`호랑가시 기타`, note: tr`눈처럼 하얀 몸통에 호랑가시 장식`, hold: guitarHold('#f7f7f2', '#3f8a4a', g => { for (const d of [-1, 1]) { g.beginPath(); g.ellipse(-1.8 + d * 1.5, -0.5, 1.5, 0.7, -d * 0.45, 0, TAU); ink(g, '#3f9a4a', 0.35) } for (const [a, b] of [[-2.2, 0.3], [-1.3, 0.4]]) blob(g, a, b, 0.6, 0.6, '#e2383c', 0.3) }) },
  s_usagi: { ch: 'usagi', tier: 'winter', name: tr`고드름 봉`, note: tr`꽁꽁 언 하늘빛 고드름 토벌봉`, hold: (g, x, y) => stickSkin(g, x, y, '#e2f4ff', '#9fd8ff', '#ffffff') },
  s_momonga: { ch: 'momonga', tier: 'winter', name: tr`눈꽃 지팡이`, note: tr`끝에 커다란 눈꽃이 반짝이는 지팡이`, hold: (g, x, y) => wand(g, x, y, '#e6f4ff', 'flake', '#bfe6ff') },
  s_kurimanju: { ch: 'kurimanju', tier: 'winter', name: tr`코코아 잔`, note: tr`마시멜로가 동동 뜬 따끈한 코코아`, front: g => cup(g, '#e2383c', '#fffaf0', true) },
  s_rakko: { ch: 'rakko', tier: 'winter', name: tr`고드름 검`, note: tr`하늘빛으로 얼어붙은 칼날 · 눈꽃 손잡이`, hold: (g, x, y) => { blade(g, x, y, '#f2fbff', '#9fd8ff'); g.save(); g.translate(x, y); g.rotate(-1.35); flake(g, 8.6, 0, 2.2, '#bfe6ff'); g.restore() } },
  s_shisa: { ch: 'shisa', tier: 'winter', name: tr`눈덩이 국자`, note: tr`동그란 눈덩이를 퍼 담은 국자`, hold: (g, x, y) => { ladle(g, x, y, '#bfe6ff'); g.save(); g.translate(x, y); g.rotate(-1.2); blob(g, 13.2, -0.4, 2.3, 2.1, '#ffffff', 0.6); g.restore() } },
  s_kani: { ch: 'kani', tier: 'winter', name: tr`겨울 동화책`, note: tr`남색 표지에 눈꽃이 그려진 동화책`, front: g => tome(g, '#2f4a8a', '#ffffff', false, true) },
})
/** 쉬움 무기 스킨 — 원래 무기 그대로 + 쥐는 자리 위에 감기(디자인 2026-11-18): sprout 새싹 덩굴(쉬움) · yarn 털실(쉬움 겨울). 돌린 좌표(축 = x)의 a0 → a1 구간을 굵기 th 로 */
function wrap(g, a0, a1, th, kind, ch) {
  const L = a1 - a0, h = th / 2, d = Math.sign(L)
  if (kind === 'sprout') {
    const kn = ch === 'kani'   // 카니 — 연두 책 위라 진한 초록 + 흰 테두리(디자인)
    g.lineCap = 'round'; g.lineJoin = 'round'
    for (const [c, lw] of kn ? [['#fff', 2.5], [OUT, 1.2], ['#2f6b2a', 0.8]] : [[OUT, 1.6], ['#6fb04f', 0.9]]) { g.strokeStyle = c; g.lineWidth = lw; g.beginPath(); for (let i = 0; i < 3; i++) { g.moveTo(a0 + L * i / 3, -h); g.lineTo(a0 + L * (i + 1) / 3, h) } g.stroke() }   // 대각선 세 바퀴
    const leaf = (x, y, rx, ry, a) => { g.beginPath(); g.ellipse(x, y, rx, ry, a, 0, TAU); if (kn) { g.strokeStyle = '#fff'; g.lineWidth = 1.3; g.stroke() } g.fillStyle = kn ? '#3f8f3a' : '#9bd86f'; g.fill(); g.strokeStyle = OUT; g.lineWidth = 0.35; g.stroke() }
    leaf(a1 + d * 1.2, -0.9, 1.7, 0.9, -0.61); leaf(a1 + d * 1.2, 0.9, 1.7, 0.9, 0.61); leaf(a0 - d * 0.8, 0, 1.1, 0.6, 0)
  } else {
    for (let k = 0; k < 4; k++) { g.beginPath(); g.rect(a0 + d * k * 1.4 - (d < 0 ? 1.1 : 0), -h, 1.1, th); g.fillStyle = k % 2 ? '#fff6e6' : TONE[ch][0]; g.fill(); g.strokeStyle = OUT; g.lineWidth = 0.35; g.stroke() }   // 털실 띠 넷(색 · 크림)
    g.strokeStyle = TONE[ch][0]; g.lineWidth = 0.7; g.lineCap = 'round'; g.beginPath(); g.moveTo(a0, h); g.quadraticCurveTo(a0 - d * 0.6, h + 1.2, a0 - d * 0.3, h + 2); g.stroke(); blob(g, a0 - d * 0.3, h + 2.5, 0.75, 0.75, '#fff', 0.35)   // 실 꼬리 + 방울
  }
}
const WRAPS = {   // [원래 무기, 감는 좌표계(손 자리에서), a0, a1, th] — 모몽가 · 시사는 원래 든 게 없어서 수수한 지팡이 · 국자
  chiikawa: [sasuHold('#ff9ab8'), g => { g.rotate(-1.2); g.translate(-5, 0) }, 2, 7, 2.2],
  hachiware: [guitarHold(), g => { g.translate(-4, 2.4); g.rotate(-0.75) }, 9, 11.6, 2],
  usagi: [(g, x, y) => stickSkin(g, x, y, '#ffd54a', null, '#fff1a6'), g => g.rotate(-1.3), 0, 5, 2.4],
  momonga: [(g, x, y) => wand(g, x, y, '#d8b07a', 'gem', '#bfe6ff'), g => g.rotate(-1.25), 1, 5, 2],
  rakko: [(g, x, y) => blade(g, x, y, '#d6dde6', '#ffd23f'), g => g.rotate(-1.35), -3.2, 0.6, 2.4],
  shisa: [(g, x, y) => ladle(g, x, y, '#e8e4dc'), g => g.rotate(-1.2), 1, 6, 2],
}
for (const { id } of CHARS) for (const [k, kind, tier, name, note] of [['e', 'sprout', 'easy', tr`새싹 감기`, tr`손잡이에 새싹 덩굴을 감았어요`], ['y', 'yarn', 'easyw', tr`털실 감기`, tr`따끈한 털실을 감고 방울을 달았어요`]]) {
  const W = WRAPS[id], over = id === 'kurimanju' ? g => { g.save(); g.translate(0, -7.5); wrap(g, 11, 14.4, 1.4, kind, id); g.restore() } : id === 'kani' ? g => { g.save(); bookAt(g); g.rotate(Math.PI / 2); wrap(g, -2.8, 2.8, 1.2, kind, id); g.restore() } : null   // 잔 · 책 — 앞에 그린 원래 것 위에 띠
  WSKIN[`${k}_${id}`] = { ch: id, tier, name, note, ...(over ? { over: true, front: over } : { hold: (g, x, y) => { W[0](g, x, y); g.save(); g.translate(x, y); W[1](g); wrap(g, W[2], W[3], W[4], kind, id); g.restore() } }) }
}
const WLOCK = { ach: ['normal', tr` 보통 클리어`], winter: ['snow', tr` 겨울 보통 클리어`], easy: ['easy', tr` 쉬움 클리어`], easyw: ['snow', tr` 겨울 쉬움 클리어`] }
const WSPOT = { chiikawa: [15, -21, 13], hachiware: [10, -9, 13], usagi: [12, -14, 13], momonga: [14, -15, 11], kurimanju: [12.7, -8, 7], rakko: [14, -16, 13], shisa: [15, -14, 13], kani: [-11.6, -5.4, 7] }   // 반짝일 자리 [x, y, 퍼짐] — 든 무기 둘레
for (const w of Object.values(WSKIN)) w.fx = w.tier === 'easy' ? { k: ['spark'], col: ['#ffffff', '#c8f0a8'], rate: 3, spot: WSPOT[w.ch] } : w.tier === 'easyw' ? { k: ['spark'], col: ['#ffffff', '#ffe3ea'], rate: 3, spot: WSPOT[w.ch] } : w.tier === 'winter' ? { k: ['spark', 'spark', 'dot'], col: ['#ffffff', '#bfe6ff', '#9fd8ff'], rate: 6, spot: WSPOT[w.ch] } : w.tier === 'ach' ? { k: ['spark', 'spark', 'star'], col: ['#ffffff', '#ffd23f', '#fff6a8'], rate: 7, spot: WSPOT[w.ch] } : { k: ['spark'], col: ['#ffffff', '#fff6a8'], rate: 3.5, spot: WSPOT[w.ch] }   // 무기 스킨 반짝이 — 업적은 더 자주 · 금빛 별
const WSKINS_OF = id => Object.keys(WSKIN).filter(k => WSKIN[k].ch === id)
const ownsW = wid => { const w = WSKIN[wid]; return w.tier === 'ach' ? clearLv(w.ch) >= 2 : w.tier === 'winter' ? winLv(w.ch) >= 2 : w.tier === 'easy' ? clearLv(w.ch) >= 1 : w.tier === 'easyw' ? winLv(w.ch) >= 1 : save.owned.includes(wid) }   // 상점 · 업적(보통 이상 클리어) · 겨울(겨울 맵 보통 이상 클리어)
const wornW = id => { const w = save.wear['w:' + id]; return w && WSKIN[w] && ownsW(w) ? w : null }
// 스킬 스킨 — col 큰 색 · col2 둘째 색 · trail 지나간 자리 반짝이(cfxDraw 모양)
const SKIN = {
  sasu: { name: tr`얼음 사스마타`, note: tr`찌를 때 차가운 얼음빛 · 눈꽃 반짝`, col: '#9fd8ff', col2: '#e6f6ff', trail: { k: ['spark'], col: ['#ffffff', '#bfe9ff'] } },
  book: { name: tr`꽃잎 책장`, note: tr`분홍 책장이 꽃잎을 흩날려요`, col: '#ffb3d1', col2: '#ffe3ee', trail: { k: ['petal'], col: ['#ffb3d1', '#ffe3ee'] } },
  pile: { name: tr`보물 더미`, note: tr`금빛 책 더미 · 무너질 때 반짝`, col: '#ffd23f', col2: '#fff6c2', trail: { k: ['spark'], col: ['#ffd23f', '#ffffff'] } },
  stick: { name: tr`벚꽃 회오리`, note: tr`휘두르면 벚꽃잎이 흩날려요`, col: '#ff9bc0', col2: '#ffe3ee', trail: { k: ['petal'], col: ['#ffb3d1', '#ffffff'] } },
  yaha: { name: tr`무지개 충격파`, note: tr`무지개빛으로 퍼지는 충격파`, col: '#b98cff', col2: '#9fd8ff', trail: { k: ['star'], col: ['#ff9be0', '#9fd8ff', '#fff3a1', '#b6f0c2'] } },
  ura: { name: tr`불꽃 기합`, note: tr`주황 불꽃으로 타오르는 기합`, col: '#ff8a5c', col2: '#ffd23f', trail: { k: ['dot'], col: ['#ff8a5c', '#ffd23f'] } },
  weed: { name: tr`꽃 피우기`, note: tr`뽑힌 자리에 분홍 꽃이 펑`, col: '#ff9be0', col2: '#ffd6f0', trail: { k: ['petal'], col: ['#ff9be0', '#fff3a1'] } },
  tears: { name: tr`별 눈물`, note: tr`보랏빛 별이 반짝이는 눈물`, col: '#c9b3ff', col2: '#efe7ff', trail: { k: ['star'], col: ['#c9b3ff', '#ffffff'] } },
  guitar: { name: tr`별빛 음표`, note: tr`금빛으로 반짝이는 음표`, col: '#ffd23f', col2: '#fff6c2', trail: { k: ['spark'], col: ['#ffd23f', '#ffffff'] } },
  nantoka: { name: tr`벚꽃 번개`, note: tr`분홍빛 번개 · 꽃잎 반짝`, col: '#ff7ab8', col2: '#ffe3ee', trail: { k: ['petal', 'spark'], col: ['#ff9bc0', '#ffffff'] } },
  ramen: { name: tr`딸기 우유`, note: tr`분홍 딸기 우유 국물 · 보글보글 거품`, col: '#ffc2d6', col2: '#ff8fb0', trail: { k: ['bubble'], col: ['#ffffff', '#ffc2d6'] } },
  curry: { name: tr`보라 매운맛`, note: tr`보랏빛으로 터지는 매운맛`, col: '#b98cff', col2: '#7a5cc8', trail: { k: ['dot'], col: ['#b98cff', '#e6d9ff'] } },
  pochette: { name: tr`하트 포셰트`, note: tr`분홍 포셰트가 하트를 뿌려요`, col: '#ff7aa8', col2: '#ffd6e2', trail: { k: ['heart'], col: ['#ff7aa8', '#ffb3cf'] } },
  momo: { name: tr`황금 발톱`, note: tr`금빛으로 반짝이는 「내놔!」`, col: '#ffd23f', col2: '#fff6c2', trail: { k: ['spark'], col: ['#ffd23f', '#ffffff'] } },
  kanpai: { name: tr`우유 건배`, note: tr`하늘빛 우유 잔 · 보글보글 거품`, col: '#bfe9ff', col2: '#ffffff', trail: { k: ['bubble'], col: ['#ffffff', '#bfe9ff'] } },
  sword: { name: tr`벚꽃 일섬`, note: tr`분홍 칼바람에 벚꽃잎이 날려요`, col: '#ff9bc0', col2: '#ffffff', trail: { k: ['petal'], col: ['#ffb3d1', '#ffffff'] } },
}
const ownsS = id => save.owned.includes('sk:' + id) || (save.awSeen || []).includes(id)   // 산 것 · 각성해 본 스킬
const skOn = id => !!(SKIN[id] && save.skin[id] && ownsS(id))
const TINT = new Map()   // 스킬 스킨 그림 — 원래 그림 위에 스킨 색을 반쯤 덮는다
function tinted(s, col) {
  const k = s.c, m = TINT.get(k) || TINT.set(k, new Map()).get(k)
  if (!m.has(col)) { const c = mk(s.c.width, s.c.height), g = c.getContext('2d'); g.drawImage(s.c, 0, 0); g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.55; g.fillStyle = col; g.fillRect(0, 0, c.width, c.height); m.set(col, { ...s, c }) }
  return m.get(col)
}
const skPut = (src, s) => { const k = G.sk[src]; return k ? tinted(s, k.col) : s }   // 그 스킬에 스킨을 켰으면 물든 그림
const SKZONE = new Set(['zone', 'drop', 'pot'])   // 바닥에 깔리는 스킬(라멘 국물 · 풀뽑기 · 카레)
function skTrail(b, k, dt) {   // 스킬 스킨 — 날아가는 것은 지나간 자리(9곳)를 남겨 꼬리로 그리고 반짝이를 흘린다. 바닥 스킬은 장판 안 여기저기서 반짝이가 피어오른다
  if (SKZONE.has(b.k)) { if (rnd() < dt * Math.min(9, 3 + (b.R || 40) / 15)) { const a = rnd() * TAU, r = Math.sqrt(rnd()) * (b.R || 40); skPuff(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r * 0.8 - 4, k) } return }
  if (b.k === 'pile' || b.k === 'ring') { if (rnd() < dt * 8) skPuff(b.x, b.y - 10, k); return }
  if (LQ < 2) { const T = b.tr ||= []; T.push(b.x, b.y - (b.k === 'orb' || b.k === 'boom' ? 14 : 12)); if (T.length > 18) T.splice(0, 2) }   // 아주 느려진 기기는 꼬리를 뺀다
  if (rnd() < dt * 14) skPuff(b.x, b.y - 12, k)
}
function skBurst(o, k) {   // 스킬 스킨 — 그어진 길(일섬 · 번개 · 휘두르기 · 손)을 따라, 터진 자리는 둘레에 반짝이
  const at = (x, y) => skPuff(x, y, k, 1)
  if (o.k === 'beam') { const n = Math.min(SRC === 'sword' ? 20 : 12, 3 + o.L / 45 | 0); for (let i = 0; i <= n; i++) at(o.x + Math.cos(o.a) * o.L * i / n, o.y + Math.sin(o.a) * o.L * i / n) }
  else if (o.k === 'bolt' && o.pts) for (const [x, y] of o.pts) at(x, y)
  else if (o.k === 'swing') for (let i = -3; i <= 3; i++) at(o.x + o.ex * i / 3, o.y + o.ey * i / 3)
  else if (o.k === 'grab') for (let i = 0; i <= 5; i++) at(o.x0 + (o.x - o.x0) * i / 5, o.y0 + (o.y - o.y0) * i / 5)
  else skPuff(o.x ?? pl.x, o.y ?? pl.y, k, 8)
}
function sakura(c, x, y, r, rot, col) {   // 벚꽃 — 끝이 살짝 패인 꽃잎 다섯 · 노란 꽃술
  c.fillStyle = col; c.strokeStyle = 'rgba(214,90,140,.7)'; c.lineWidth = 0.8
  for (let i = 0; i < 5; i++) { const a = rot + i * TAU / 5; c.save(); c.translate(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5); c.rotate(a + Math.PI / 2); c.beginPath(); c.moveTo(0, r * 0.5); c.quadraticCurveTo(r * 0.6, 0, r * 0.2, -r * 0.52); c.lineTo(0, -r * 0.34); c.lineTo(-r * 0.2, -r * 0.52); c.quadraticCurveTo(-r * 0.6, 0, 0, r * 0.5); c.fill(); c.stroke(); c.restore() }
  c.fillStyle = '#fff3a1'; oval(c, x, y, r * 0.24, r * 0.24); c.fill()
}
function ribbon(c, T, k) {   // 스킬 스킨 꼬리 — 뒤로 갈수록 가늘고 옅게(세 토막) · 가운데 밝은 줄
  const n = T.length / 2, line = (from, w, a, col) => { c.globalAlpha = a; c.strokeStyle = col; c.lineWidth = w; c.beginPath(); c.moveTo(T[from * 2], T[from * 2 + 1]); for (let i = from + 1; i < n; i++) c.lineTo(T[i * 2], T[i * 2 + 1]); c.stroke() }
  c.lineCap = c.lineJoin = 'round'; line(0, 5, 0.22, k.col); line(n / 3 | 0, 9, 0.4, k.col); line(2 * n / 3 | 0, 13, 0.6, k.col); line(n / 2 | 0, 3.5, 0.9, k.col2); c.globalAlpha = 1
}
function skZone(c, x, y, R, k, t, a = 1) {   // 스킬 스킨 장판 — 둘레에 은은한 빛 · 천천히 도는 점선 고리 · 테두리를 도는 별 셋(반짝이는 shots 에서)
  c.globalAlpha = 0.22 * a; c.fillStyle = k.col2; oval(c, x, y, R * 1.12, R * 0.9); c.fill()
  c.globalAlpha = 0.85 * a; c.strokeStyle = k.col2; c.lineWidth = 2.5; c.setLineDash([10, 8]); c.lineDashOffset = -t * 30; oval(c, x, y, R * 0.88, R * 0.7); c.stroke(); c.setLineDash([]); c.lineDashOffset = 0
  for (let i = 0; i < 3; i++) { const q = t * 1.6 + i * TAU / 3, r = 3.4 + Math.sin(t * 6 + i) * 1.2; c.globalAlpha = a; c.fillStyle = '#fff'; starP(c, x + Math.cos(q) * R, y + Math.sin(q) * R * 0.8, r * 1.6, r * 0.5, 4); c.fill(); c.strokeStyle = k.col; c.lineWidth = 1; c.stroke() }
  c.globalAlpha = 1
}
function skPuff(x, y, k, n = 1, L = G.sfx.list) {   // 스킬 스킨 반짝이 — 지나간 자리 · 터진 자리(가벼운 화질이면 안 만든다)
  if (LQ) return
  for (let i = 0; i < n; i++) L.push({ k: pickOf(k.trail.k), col: pickOf(k.trail.col), x: x + (rnd() - 0.5) * 12, y: y + (rnd() - 0.5) * 10, vx: (rnd() - 0.5) * 30, vy: -10 - rnd() * 20, t: 0, T: 0.5 + rnd() * 0.4, s: 0.9 + rnd() * 0.6, rot: rnd() * TAU })
  if (L.length > 170) L.splice(0, L.length - 170)   // 반짝이는 많아도 170개까지(느려지지 않게)
}

// ---------------------------------------------------------------- 화면 · 입력
const cv = document.getElementById('cv'), ctx = cv.getContext('2d'), ui = document.getElementById('ui'), pauseBtn = document.getElementById('pause')
SND.button(document.getElementById('snd'))
if (TR) {   // index.html 의 한국어 이름표 · 탭 제목도 그 말로(검색 엔진용 글은 한국어 그대로)
  cv.setAttribute('aria-label', `${tr`먼작귀`} ${tr`서바이버즈`}`)   // 탭 제목(document.title)은 index.html 의 한국어 그대로 — 검색 결과 제목 · 구글 동의 화면 이름과 늘 맞게(기획)
  pauseBtn.setAttribute('aria-label', tr`일시정지`); document.getElementById('snd').setAttribute('aria-label', tr`소리 크기`); document.getElementById('spd').setAttribute('aria-label', '×2')
}
let PB = null   // 일시정지 단추 자리(떠돌이 보물상자 표시) — size() 가 비운다
let SC = 1, VW = VIEW, VH = VIEW, DPR = 1, still = 2, LQ = 0   // LQ = 자동 화질 단계(0 · 1 · 2) — 느려지면 내려간다
function size(drag) {
  PB = null   // drag === true — 배율 막대를 끄는 중: 배율만 바꾸고 그림은 놓을 때(change) 다시 그린다(다시 그리기는 0.3~0.6초)
  const r = cv.getBoundingClientRect(), d0 = Math.min(devicePixelRatio || 1, 2, Math.sqrt(2.4e6 / Math.max(1, r.width * r.height))), d = Math.max(Math.min(1, d0), d0 * [1, 0.75, 0.5][LQ])   // 자동 화질이 내려가면 픽셀을 줄인다(화면 1배보다는 안 낮춘다)
  cv.width = Math.max(1, Math.round(r.width * d)); cv.height = Math.max(1, Math.round(r.height * d)); DPR = cv.width / Math.max(1, r.width)
  SC = Math.max(Math.min(cv.width, cv.height), Math.sqrt(cv.width * cv.height) / 1.15) / VIEW * save.zoom; VW = cv.width / SC; VH = cv.height / SC   // 짧은 쪽 또는 넓이 기준 중 큰 배율 — 세운 휴대폰에서도 캐릭터가 너무 작지 않게
  const k = clamp(Math.round(SC * 2) / 2, 1, 4)   // 그림을 화면 배율에 맞는 크기로 다시 그린다 — 확대해도 흐려지지 않게
  if ((k !== K || !SPR) && drag !== true) { K = k; sprites() }
  still = 2
}
new ResizeObserver(size).observe(cv)

const key = { u: 0, d: 0, l: 0, r: 0 }, joy = { on: false, id: null, x: 0, y: 0, ox: 0, oy: 0, px: 0, py: 0 }
const KEYS = { ArrowUp: 'u', KeyW: 'u', ArrowDown: 'd', KeyS: 'd', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r' }
let tabbed = false   // Tab 으로 단추를 골랐으면 Enter · Space 는 그 단추(마우스 · 터치하면 풀린다)
addEventListener('pointerdown', () => { tabbed = false }, true)
addEventListener('keydown', e => {
  const k = KEYS[e.code]
  if (e.code === 'Tab') tabbed = true
  if (k) key[k] = 1
  if ((k || e.code === 'Space') && mode === 'play') e.preventDefault()
  if (MODAL) { if (e.code === 'Escape' && !MODAL.stay) MODAL(); return }   // 떠 있는 작은 창(로그인 · 닉네임 · 랭킹 자세히)
  if (SND.open?.()) { if (e.code === 'Escape') SND.close(); return }   // 소리 창이 떠 있으면 Esc 로 닫기만
  if (e.code === 'Escape' || e.code === 'KeyP') { if (mode === 'play') pause(); else if (mode === 'pause') resume() }
  if (e.code === 'Escape' && !e.repeat && !['play', 'pause', 'sound', 'box', 'revive'].includes(mode)) { const home = [...ui.querySelectorAll('button')].find(b => b.onclick === title); if (home) { e.preventDefault(); return home.click() } }   // PC — 메뉴 화면에서 Esc = 「처음으로」
  if ((e.code === 'Enter' || e.code === 'Space') && !e.repeat && (mode === 'pause' || mode === 'revive' || (mode === 'box' && BOX?.jack)) && !(tabbed && e.target.closest?.('#ui button'))) {   // 쉬는 창 · 일시정지 → 계속하기, 부활할까요 → 부활하기, 잭팟 → 셋 다 받기(Tab 으로 고른 단추는 그 단추)
    e.preventDefault(); return mode === 'pause' ? resume() : mode === 'revive' ? revive() : BOX.act('take')
  }
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
// 손가락 스틱 — 화면 아무 데나 누른 자리가 가운데. 멀리 끌면 원이 손가락을 따라온다(마우스 · 펜은 누른 자리에 고정 — 따라오면 방향이 마음대로 안 잡힌다)
cv.addEventListener('pointerdown', e => {
  if (mode !== 'play' || SIM) return   // 모의 토벌 관전 — 조이스틱 없이
  cv.setPointerCapture(e.pointerId)
  Object.assign(joy, { on: true, id: e.pointerId, ox: e.clientX, oy: e.clientY, px: e.clientX, py: e.clientY, x: 0, y: 0 })
})
cv.addEventListener('pointermove', e => {
  if (e.pointerId !== joy.id) return
  const R = 46
  let dx = e.clientX - joy.ox, dy = e.clientY - joy.oy
  const d = Math.hypot(dx, dy)
  if (d > R) { if (e.pointerType === 'touch') { joy.ox += dx * (1 - R / d); joy.oy += dy * (1 - R / d) } dx *= R / d; dy *= R / d }
  joy.px = joy.ox + dx; joy.py = joy.oy + dy
  joy.x = d > 6 ? dx / R : 0; joy.y = d > 6 ? dy / R : 0
})
const lift = e => { if (e.pointerId === joy.id) { joy.on = false; joy.id = null; joy.x = joy.y = 0 } }
cv.addEventListener('pointerup', lift); cv.addEventListener('pointercancel', lift)
pauseBtn.addEventListener('click', () => { pauseBtn.blur(); pause() })
let spd = 1   // 게임 배속(1 · 2 · 3) — 오른쪽 위 단추로 1 → 2 → 3 → 1. 3배속은 어려움을 클리어한 사람만(무한에서 세이렌을 잡아도)
document.getElementById('spd').addEventListener('click', e => { const b = e.currentTarget; spd = spd >= spdMax(G && (mode === 'play' || mode === 'pause') ? G.inf : !!DIFF[save.diff]?.inf) ? 1 : spd + 1; b.textContent = `×${Math.max(2, spd)}`; b.setAttribute('aria-pressed', spd > 1); b.setAttribute('aria-label', `×${Math.max(2, spd)}`); b.blur() })

// ---------------------------------------------------------------- 한 판
let mode = 'title', G = null, pl = null, S = null, shake = 0, pickCi = 0, SRC = null   // SRC — 지금 피해를 주는 스킬 · 친구(스킬별 피해 표)
const cam = { x: 0, y: 0 }
const need = lv => Math.round((1 + 0.2 * Math.min(1, (lv - 1) / 15)) * (lv < 20 ? 5 + (lv - 1) * 7 : 138 + (lv - 20) * 12 + (lv - 20) ** 2))   // 다음 레벨까지 경험치

/** 첫 판 조작법(처음 1번, 기존 이용자도 · startGame 이 부른다) — PC(hover + 고운 포인터: save.ctrlSeen) 키보드 · 마우스 4칸(아래 가운데) / 휴대폰 · 태블릿(save.touchSeen — 계정 저장이 기기끼리 맞춰져서 따로) 손가락 3칸(위쪽 · 엄지에 안 가리게). 끝 칸 아래 작게 화면 배율(기획 · 디자인). 15초(실제 시간 · 판(play)일 때만 흐르고 그 밖엔 숨김), 13~15초에 흐려지며 내려간다.
 *  눌리지 않는다(pointer-events: none — 마우스 「누른 채로 끌기」가 곧 움직이기라 닫기 단추 없음 · 기획) */
let CTRL = null
const TRI = r => { const s = h('span', { class: 'tri' }); s.innerHTML = `<svg viewBox="0 0 10 10" width="10" height="10" aria-hidden="true" style="transform: rotate(${r}deg)"><path d="M5 1.5 9.2 8.5H.8z" fill="currentColor"/></svg>`; return s }
function ctrlShow(pc) {
  const tee = ks => h('span', { class: 'tee' }, ks.map((t, i) => h('span', { class: `kc k${i + 1}` }, t))), trail = h('span', { class: 'trail' })   // 거꾸로 된 T — ↑ ← ↓ → 차례로 눌린다(WASD 와 짝으로)
  trail.innerHTML = '<svg viewBox="0 0 34 34" width="34" height="34" aria-hidden="true"><path d="M2 32 23 11" stroke="currentColor" stroke-width="2.5" stroke-dasharray="3.5 3.5" stroke-linecap="round" fill="none"/><path d="M29 5 21.6 7.5 26.5 12.4z" fill="currentColor"/></svg>'
  const col = (pic, txt) => h('div', { class: 'cc' }, h('div', { class: 'pic' }, pic), h('p', {}, txt))   // txt 가 [글, 작은 글]이면 작은 글은 줄을 바꿔
  const zoom = h('small', { class: 'zm' }, ic('zoom'), tr`멈춤 화면에서 화면 배율도 바꿀 수 있어요`), auto = col(h('span', { class: 'auto' }, h('i', { class: 'ring' }), ic(G.ch.w), h('i', { class: 'spark' })), tr`스킬은 저절로 나가요`)
  const pz = h('span', { class: 'pz' }); pz.innerHTML = pauseBtn.innerHTML   // 오른쪽 위 ⏸ 단추와 같은 그림
  const el = h('div', { id: 'ctrl', class: pc ? '' : 'touch', role: 'note' }, pc ? [
    col([tee([TRI(0), TRI(-90), TRI(180), TRI(90)]), tee(['W', 'A', 'S', 'D'])], tr`방향키 · WASD로 움직여요`),
    col(h('span', { class: 'mw' }, trail, h('span', { class: 'ms' }, h('i', { class: 'lb' }))), tr`마우스는 누른 채로 끌어요`),
    auto, col([h('span', { class: 'kc esc' }, 'Esc'), h('span', { class: 'sl' }, '/'), h('span', { class: 'kc pk' }, 'P')], [tr`Esc · P로 잠깐 멈춰요`, zoom])
  ] : [   // 휴대폰 3칸(세로는 그림 왼쪽 · 글 오른쪽 목록): 스틱 · 스킬 · 멈춤 단추 — 글 속 ⏸ 자리엔 단추 그림(이모지는 기기마다 달라서)
    col(h('span', { class: 'fw' }, h('i', { class: 'tip' })), tr`화면을 누른 채로 끌어서 움직여요`),
    auto, col(pz, [...tr`오른쪽 위 ${'\0'}로 잠깐 멈춰요`.split('\0').flatMap((t, i) => i ? [Object.assign(h('span', { class: 'pzi' }), { innerHTML: pauseBtn.innerHTML }), t] : [t]), zoom])
  ], h('i', { class: 'bar' }))
  const up = !pc && !matchMedia('(max-width: 1120px) and (max-height: 500px)').matches   // 세로 휴대폰은 위쪽 — 「토벌 시작!」 큰 글(약 2.5초)이 사라진 뒤에 나온다
  CTRL?.el.remove(); document.body.append(el); CTRL = { el, g: G, c: 0, d: up ? 2.5 : 0.5, up, push: 0, still: matchMedia('(prefers-reduced-motion: reduce)').matches }
}
addEventListener('resize', () => { if (CTRL) CTRL.bot = undefined })   // 화면을 돌리면 카드 아래 끝을 다시 잰다
function ctrlTick(dt) {
  const C = CTRL, on = mode === 'play' && C.g === G
  if (C.g !== G || C.c >= C.d + 14.8) { C.el.remove(); CTRL = null; return }   // 다른 판 · 처음 화면으로 갔거나 다 보여 줬다(카드는 15초에 다 흐려지고, 0.3초 더 — 밀어 둔 상태 글이 돌아오게)
  C.el.classList.toggle('off', !on); if (!on) return   // 일시정지 · 레벨 업 상자 · 결과 — 숨기고 시계도 멈춤(움직임은 paused) · 상태 글 자리(push)는 그대로 둬서 돌아와도 튀지 않게
  C.c += dt; const c = C.c - C.d + 0.5, a = c < 0.5 ? 0 : c < 0.8 ? (c - 0.5) / 0.3 : c > 13 ? Math.max(0, (15 - c) / 2) : 1   // c: PC 는 판 시작부터 — 0.5초 뒤 0.3초 동안 올라오며 · 13~15초 흐려지며(세로 휴대폰은 2초 늦게)
  if (C.up) { C.bot ??= a > 0 ? C.el.getBoundingClientRect().bottom - (parseFloat(C.el.style.getPropertyValue('--y')) || 0) : undefined; C.push = c < 0.5 ? 0 : c < 0.8 ? (c - 0.5) / 0.3 : c > 15 ? Math.max(0, 1 - (c - 15) / 0.3) : 1 }   // 세로 휴대폰 — HUD 상태 글(얼어붙는 중 등)을 카드 아래로, 카드가 다 사라진 뒤(15초) 0.3초에 걸쳐 제자리로(흐려지는 카드 글과 섞이지 않게 · QA)
  C.el.style.opacity = a; C.el.style.setProperty('--y', C.still ? '0px' : `${c < 1 ? 12 * (1 - a) : 8 * (1 - a)}px`); C.el.style.setProperty('--p', clamp(1 - c / 15, 0, 1))
}
function newGame(ch, o = {}) {   // o — 모의 토벌: { diff, winter } (save 를 읽거나 바꾸지 않는다)
  pl = { x: 0, y: 0, r: 12, hp: 1, inv: 0, hurtT: 0, slowT: 0, face: [1, 0], fx: 1, jump: 0, moving: false, vx: 0, vy: 0, idleT: 0, iced: false }   // vx · vy — 지금 속도(눈 위에서 미끄러질 때), idleT — 가만히 있은 시간(겨울엔 얼어붙는다)
  const b = 2 + (ch.mod.boxes || 0)
  G = {
    ch, diff: o.diff || save.diff, D: DIFF[o.diff || save.diff], t: 0, foes: [], shots: [], eshots: [], gems: [], items: [], fx: [], parts: [], nums: [], haz: [], help: [], weapons: [], passives: {},
    kills: 0, lvl: 1, xp: 0, next: need(1), queue: [], dmg: {}, rest: null, gob: 0, pj: 0, hit0: null, cheer: 0, jackpots: 0, bosses: 0, freeze: 0, spawnT: 0.5,
    nextElite: 140, nextSwarm: 100, nextEvt: 600, pi: 0, dying: 0, won: 0, banner: null, sts: {}, final: null,
    rr: b, skips: b, bans: b, banned: new Set(),   // 상자에서 쓰는 리롤 · 스킵 · 제외 · 제외한 카드(t + id)
    bossT: 0, slain: {},
    inf: !!DIFF[o.diff || save.diff].inf, loop: { lv: 0, queue: [], next: 0, spawned: [], sirens: 0 },   // 무한 — 단계 · 남은 보스 종류 · 다음 무리 때 · 이번 단계에 나온 보스 · 쓰러뜨린 세이렌
    winter: o.winter ?? save.theme === 'winter', storm: { next: STORM.every, warned: false, on: 0, k: 0, hot: 0, warm: false, piles: [], spawn: 0, fade: 0 }, storms: 0, tip: null, slip: false,   // 겨울 맵 — 눈보라 · 버텨 낸 눈보라 · 작은 안내 · 눈 위에서 미끄러지는 중
    aw: new Set(), arr: b, parried: 0, revives: 0, anchor: [0, 0], lastBox: -99, found: 0, runStones: 0, gotRunStone: false,   // … · 떠돌이 보물상자(앵커 · 마지막 때 · 받은 보상금) · 주운 부활석(이번 판만)
      // 각성한 스킬 · 각성 상자 리롤(따로 센다) · 각성 스킬로 막은 탄(업적)
  }
  S = null; addWeapon(ch.w); stats(); pl.hp = S.maxHp
  G.cfx = { list: [], acc: 0 }; G.ofx = SIM ? null : outfitOf(wornId(ch.id), ch.id)?.fx   // 의상 이펙트(모의 토벌은 기본 옷)
  G.fire = !SIM && wornId(ch.id) === 'fire'   // 불꽃 옷 — 눈보라에도 받는 피해가 늘지 않는다
  G.wfx = { list: [], acc: 0 }; G.wsx = SIM ? null : WSKIN[wornW(ch.id)]?.fx   // 무기 스킨 반짝이
  G.sfx = { list: [], acc: 0 }; G.sk = SIM ? {} : Object.fromEntries(Object.keys(SKIN).filter(skOn).map(id => [id, SKIN[id]]))   // 켠 스킬 스킨
  cam.x = cam.y = 0; shake = 0; calm()
  say(tr`토벌 시작! ${FINAL_T / 60}분 뒤 세이렌이 온다`, 2.6)
}
function statsAsk(i) {   // 무한 모드는 통계를 켜야 한다(랭킹 기록 확인) — 「토벌 시작!」을 누를 때만 묻는다. 아니요 = 창만 닫고 그 화면 그대로
  modal('nick', h('p', { class: 'h' }, tr`통계를 켤까요?`), h('p', { class: 'sub' }, tr`무한 모드는 게임을 고치고 랭킹을 확인하려고 통계(익명 플레이 통계 · 방문 통계)를 함께 보내요`),
    h('p', { class: 'fine' }, tr`보내는 것: 캐릭터 · 난이도 · 버틴 시간 · 쓰러진 원인 · 방문 통계(Google 애널리틱스) — 처음 화면에서 언제든 다시 끌 수 있어요`),
    h('div', { class: 'row' }, btn(tr`아니요`, () => MODAL?.()), btn(tr`켜고 시작`, () => { MODAL?.(); save.noStats = false; persist(); startGame(i) }, 'main')))
}
function startGame(i) { if (DIFF[save.diff]?.inf && save.noStats && !auth) return statsAsk(i)   // 로그인 중이면 익명 통계를 늘 보내니 묻지 않는다
  if (LQ) { LQ = 0; size() } if (SPR) SPR[CHARS[i].id] = charSprites(CHARS[i].id)   // 입은 의상으로 다시 그린다
  if (spd > spdMax(!!DIFF[save.diff]?.inf)) { spd = spdMax(!!DIFF[save.diff]?.inf); const b = document.getElementById('spd'); b.textContent = `×${spd}`; b.setAttribute('aria-label', `×${spd}`) }   // 보험 — 지금은 저장이 바뀌면 늘 다시 연다(reload). 나중에 안 그러는 길이 생겨도 정직한 사람이 spd 로 걸리지 않게(기획)
  dmOff(); Object.assign(AQ, { ema: 0, base: 1e9, at: 0 }); pickCi = i; newGame(CHARS[i]); const pc = matchMedia('(hover: hover) and (pointer: fine)').matches, seen = pc ? 'ctrlSeen' : 'touchSeen'; if (!save[seen]) { save[seen] = 1; persist(); ctrlShow(pc) } if (G.inf && auth) { const g = G; rpc('start_run').then(t => { if (typeof t === 'string') g.tok = t }) } mode = 'play'; ui.hidden = true; pauseBtn.hidden = false; still = 2; SND.play(fieldSong(), false, CHARS[i].id); SND.voice(CHARS[i].id, 'happy') }

function stats() {
  const m = G.ch.mod, L = id => G.passives[id] || 0, old = S?.maxHp
  S = {
    might: 1 + 0.1 * L('license') + perm('license') + 0.02 * G.cheer + (m.might || 0),
    armor: L('armor') + perm('armor') + (m.armor || 0),
    maxHp: Math.round(G.ch.hp * (1 + 0.2 * L('manju') + perm('manju') + (m.hp || 0))),
    regen: 0.2 * L('pudding') + perm('pudding') + (m.regen || 0),
    cdr: Math.max(0.45, 1 - 0.08 * L('clock') - (m.cdr || 0)),
    area: 1 + 0.1 * L('mega') + (m.area || 0),
    move: 1 + 0.1 * L('slipper') + perm('slipper') + (m.move || 0),
    speed: 1 + 0.1 * L('wind') + (m.speed || 0),
    dur: 1 + 0.1 * L('bento') + (m.dur || 0),
    amount: L('double') + (m.amount || 0),
    magnet: 80 * (1 + 0.3 * L('pouch') + perm('pouch') + (m.magnet || 0)),
    luck: 1 + 0.1 * L('clover') + perm('clover') + (m.luck || 0),
    growth: 0.8 * (1 + 0.08 * L('wage') + perm('wage') + (m.growth || 0)),   // 줍는 경험치 — 기본 0.8배
    crit: 0.03 + 0.02 * L('clover') + (m.crit || 0) + (SIM ? 0 : coll('crit')),   // 의상 보유 효과(랏코 섬 화관 · 망토)
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
  if (G.aw.has(w.id)) for (const k in AW[w.id].up) st[k] += AW[w.id].up[k]
  return st
}
function addWeapon(id) {
  const w = { id, lv: 1, t: 0.3, q: 0, qt: 0, n: 0, ang: 0, on: 0, list: [] }
  G.weapons.push(w); w.st = wstat(w)
  const m = G.weapons.find(x => x.id === mateOf(id))
  if (m) { m.st = wstat(m); say(tr`시너지 — ${synOf(id)[0]}`, 2.4, '#ffb366') }
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
const SKFX = new Set(['boom', 'bolt', 'beam', 'grab', 'swing'])
const FX_KEEP = new Set(['hand', 'shout', 'wave', 'duel'])   // 꼭 보여야 하는 것 — 효과가 많아도 늘 넣는다(피하는 데 필요한 정보)
const fx = o => { if (G.fx.length < (LQ > 1 ? 110 : 220) || FX_KEEP.has(o.k)) G.fx.push({ t: 0, src: SRC, ...o }); const k = SRC && SKFX.has(o.k) && G.sk[SRC]; if (k) skBurst(o, k) }   // 스킬 스킨 — 터진 자리에 반짝이
const part = (x, y, vx, vy, col, T, r) => { if (G.parts.length < (LQ > 1 ? 180 : 360)) G.parts.push({ x, y, vx, vy, col, t: 0, T, r }) }
const num = (x, y, v, kind) => { if (LQ > 1 && !kind) return   // 가장 가벼운 화질이면 적에게 준 보통 피해 숫자만 빼기(치명타 · 내가 맞은 양 · 회복은 그대로 — QC)
  if (G.nums.length > (LQ ? 30 : 60)) G.nums.shift(); G.nums.push({ x: x + (rnd() - 0.5) * 10, y, v, kind, t: 0 }) }
const say = (s, T = 1.6, col = '#fff') => { G.banner = { s, t: 0, T, col } }
const tip = (s, col = '#fff', T = 2.8) => { G.tip = { s, t: 0, T, col } }   // 작은 안내 — 가운데 글자 아래(눈보라 등)
/** 각성 스킬(SRC)이 날아오는 것 b 를 AW.p 확률로 막는다 — 탄 하나에 스킬마다 한 번만 굴린다. 막으면 true */
function parry(b) {
  if (b.dead || !G.aw.has(SRC) || (b.tried ||= new Set()).has(SRC)) return false
  b.tried.add(SRC); if (rnd() >= AW[SRC].p) return false   // 무한도 같은 확률(1단계부터 절반이던 것을 되돌림 — 사용자 2026-11-21)
  b.dead = true; G.parried++; fx({ k: 'ring', x: b.x, y: b.y, R: 18, T: 0.3, col: '#ffd23f' })
  if (G.fx.length < 150 && rnd() < 0.35) fx({ k: 'text', x: b.x, y: b.y - 22, s: tr`막았다!`, col: '#ffd23f', T: 0.6 })
  return true
}
const parryIn = (x, y, R) => { if (G.aw.has(SRC)) for (const b of G.eshots) if ((b.x - x) ** 2 + (b.y - y) ** 2 < (R + b.r) ** 2) parry(b) }
/** R 안에서 나에게 다가오는 가장 가까운 날아오는 것 */
function incoming(R) { let T = null, bd = R * R; for (const b of G.eshots) { const d = (b.x - pl.x) ** 2 + (b.y - pl.y) ** 2; if (!b.dead && d < bd && (pl.x - b.x) * b.vx + (pl.y - b.y) * b.vy > 0) { bd = d; T = b } } return T }
function splash(x, y, R, dmg, col, sea = 1) { near(x, y, R, e => { hurt(e, dmg, x, y, 60, sea) }); fx({ k: 'boom', x, y, R, col, T: 0.35 }) }

// ---- 스킬 — 한 발씩(여러 개면 0.12초 간격으로)
const SASU = { chiikawa: '#ff9ab8', hachiware: '#7fa6dc', kani: '#a9b1bc' }   // 사스마타 색 — 치이카와 분홍 · 하치와레 파랑 · 카니 회색
const SHOT = {
  pile(w, st, i, A, D) {   // 발 뒤에 헌책 더미. 안 무너진 것이 12개를 넘으면 가장 오래된 것을 치운다
    const old = G.shots.filter(b => b.k === 'pile' && !b.fall), o = (i - (w.n - 1) / 2) * 26; if (old.length >= 12) old[0].dead = true   // 여러 개면 지나온 길을 가로질러 나란히
    G.shots.push({ src: SRC, k: 'pile', x: pl.x - pl.face[0] * 14 - pl.face[1] * o, y: pl.y + 4 + pl.face[0] * o * 0.8, R: 52 * A, dmg: D, t: 0, life: st.dur * S.dur, fall: 0 })
  },
  book(w, st, i, A, D) {   // 첫 장을 날릴 때 가까운 적 쪽을 정하고, 장마다 부채꼴로 조금씩 돌려 차례로
    if (i === 0) { const e = closest(1)[0]; w.aim = e ? Math.atan2(e.y - pl.y, e.x - pl.x) : Math.atan2(pl.face[1], pl.face[0]) }
    const a = w.aim + (i - (w.n - 1) / 2) * 0.26, v = 460 * st.spd * S.speed
    G.shots.push({ src: SRC, k: 'ball', look: 'page', x: pl.x, y: pl.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, r: 10 * Math.sqrt(A), sc: Math.sqrt(A), dmg: D, pierce: st.pierce, kb: 50, life: 0.8, t: 0, hit: new Set() })
  },
  sasu(w, st, i, A, D) {
    const e = alive(w.list[i % (w.list.length || 1)]) || closest(1)[0], [dx, dy] = e ? toward(e) : pl.face, v = 520 * st.spd * S.speed
    G.shots.push({ src: SRC, k: 'ball', col: G.sk.sasu?.col || SASU[G.ch.id] || '#d6dde6', x: pl.x, y: pl.y, vx: dx * v, vy: dy * v, r: 13 * Math.sqrt(A), dmg: D, pierce: st.pierce, kb: 70, life: 0.75, t: 0, hit: new Set() })
  },
  stick(w, st, i, A, D) {   // 가까운 적 쪽(첫 번째) · 그와 직각(두 번째, 조금 짧게)으로 휘두르고 양 끝이 터진다 — 예전엔 늘 양옆이라 위아래 적 · 보스를 거의 못 때렸다
    const cy = pl.y - 8
    if (i === 0) { const e = closest(1)[0]; w.aim = e ? Math.atan2(e.y - cy, e.x - pl.x) : Math.atan2(pl.face[1], pl.face[0]) }
    const a = w.aim + (i % 2) * Math.PI / 2, ca = Math.cos(a), sa = Math.sin(a), L = 92 * A * (i % 2 ? 0.8 : 1), Wd = 24 * A
    near(pl.x, cy, L + Wd, e => { const dx = e.x - pl.x, dy = e.y - cy; if (Math.abs(dx * sa - dy * ca) < Wd + e.r && Math.abs(dx * ca + dy * sa) < L + e.r) hurt(e, D, pl.x, cy, 120) })
    for (const s of [-1, 1]) splash(pl.x + s * ca * L, cy + s * sa * L, 34 * A, D * 0.7, '#ff8a3d')
    parryIn(pl.x, cy, L)
    fx({ k: 'swing', x: pl.x, y: cy, ex: ca * L, ey: sa * L, T: 0.22 }); shake = Math.max(shake, 1.5)
  },
  yaha(w, st, i, A, D) { pl.jump = 0.3; G.shots.push({ src: SRC, k: 'ring', x: pl.x, y: pl.y, t: -0.26, T: 0.32, R: 92 * A, dmg: D, hit: new Set() }) },
  weed(w, st, i, A, D) { const e = alive(w.list[i]) || closest(1)[0]; G.shots.push({ src: SRC, k: 'drop', x: e ? e.x : pl.x + (rnd() - 0.5) * 320, y: e ? e.y : pl.y + (rnd() - 0.5) * 320, t: 0, T: 0.5, R: 46 * A, dmg: D }) },
  tears(w, st, i, A, D) {   // 번갈아 — 멀리(150 밖) 있는 화면 안 적 한 번, 가장 가까운 적 한 번(예전엔 멀리만 던져 붙은 적을 못 떼어 냈다). 움직이는 쪽을 미리 겨눈다
    const far = (w.k = (w.k || 0) + 1) % 2 ? visible().filter(e => (e.x - pl.x) ** 2 + (e.y - pl.y) ** 2 > 150 * 150) : [], e = far.length ? pickOf(far) : closest(1)[0], T = 0.6 / Math.sqrt(st.spd * S.speed)
    const x1 = e ? e.x + e.vx * T : pl.x + pl.face[0] * 260, y1 = e ? e.y + e.vy * T : pl.y + pl.face[1] * 260
    G.shots.push({ src: SRC, k: 'arc', x0: pl.x, y0: pl.y, x1, y1, x: pl.x, y: pl.y, t: 0, T, H: 120, R: 54 * A, dmg: D, u: 0 })
  },
  nantoka(w, st, i, A, D) {   // 가까운 적부터(화면 안) 하늘에서 지그재그로
    const e = alive(w.list[i]) || closest(1)[0]; if (!e || !onScreen(e, 20)) return
    const R = 32 * A, { x, y } = e
    near(x, y, R, f => { hurt(f, D, x, y, 80) })
    fx({ k: 'bolt', x, y, R, pts: zig(x + (rnd() - 0.5) * 60, y - 440, x, y - 6), T: 0.3 }); fx({ k: 'boom', x, y, R, col: '#ffe066', T: 0.3 })
    const b = G.aw.has(SRC) && incoming(260); if (b && parry(b)) fx({ k: 'bolt', x: b.x, y: b.y, R: 14, pts: zig(b.x + (rnd() - 0.5) * 40, b.y - 300, b.x, b.y), T: 0.25 })
    shake = Math.max(shake, 2)
  },
  ramen(w, st, i, A, D) { const e = pickOf(closest(4)), a = rnd() * TAU, d = 50 + rnd() * 90; G.shots.push({ src: SRC, k: 'zone', x: e ? e.x : pl.x + Math.cos(a) * d, y: e ? e.y : pl.y + Math.sin(a) * d, R: 45 * A, dmg: D, tick: 0, t: 0, life: st.dur * S.dur }) },
  curry(w, st, i, A, D) {   // 가까운 적 12 중 둘레에 적이 가장 많은 자리(이미 냄비가 있는 자리는 빼고)
    const R = 62 * A
    let best = null, bn = 0
    for (const e of closest(12, pl.x, pl.y, null, 420)) {
      if (G.shots.some(b => b.k === 'pot' && (b.x - e.x) ** 2 + (b.y - e.y) ** 2 < R * R)) continue
      let n = 0; near(e.x, e.y, R, () => { n++ })
      if (n > bn) { bn = n; best = e }
    }
    G.shots.push({ src: SRC, k: 'pot', x: best ? best.x : pl.x + pl.face[0] * 140, y: best ? best.y : pl.y + pl.face[1] * 140, t: 0, T: 1, R, dmg: D })
  },
  pochette(w, st, i, A, D) { const e = closest(i + 1)[i] || closest(1)[0], [dx, dy] = e ? toward(e) : pl.face, s = st.spd * S.speed; G.shots.push({ src: SRC, k: 'boom', x: pl.x, y: pl.y, dx, dy, v: 600 * s, acc: -800 * s, r: 11 * A, dmg: D, hit: new Map(), t: 0, life: 2.4, a: 0 }) },
  momo(w, st, i, A, D) {   // 보스 · 정예 먼저, 없으면 가까운 적에게 달려들어 낚아챈다(둘레도 조금)
    const e = alive(w.list[i]) || strongest(1)[0]; if (!e) return
    hurt(e, D, pl.x, pl.y, 60); near(e.x, e.y, 40 * A, f => { if (f !== e) hurt(f, D * 0.3, e.x, e.y, 90) }); fx({ k: 'boom', x: e.x, y: e.y, R: 40 * A, col: '#ffc2e0', T: 0.25 }); fx({ k: 'grab', x0: pl.x, y0: pl.y - 16, x: e.x, y: e.y - e.r * 1.4, T: 0.3 })
    const b = G.aw.has(SRC) && incoming(220); if (b && parry(b)) fx({ k: 'grab', x0: pl.x, y0: pl.y - 16, x: b.x, y: b.y, T: 0.25 })
  },
  kanpai(w, st, i, A, D) { const e = alive(w.list[i % (w.list.length || 1)]) || closest(1)[0], [dx, dy] = e ? toward(e) : pl.face, v = 650 * st.spd * S.speed; G.shots.push({ src: SRC, k: 'ball', look: 'cup', x: pl.x, y: pl.y, vx: dx * v, vy: dy * v, r: 8 * Math.sqrt(A), dmg: D, pierce: 1, bounce: st.bounce, kb: 40, life: 1.3, t: 0, hit: new Set() }) },
  sword(w, st, i, A, D) {   // 화면 안 아무 적 쪽으로 화면을 가로지르는 칼바람
    const c = visible(), e = c.length ? pickOf(c) : null, a = e ? Math.atan2(e.y - pl.y, e.x - pl.x) : Math.atan2(pl.face[1], pl.face[0])
    const x = pl.x, y = pl.y - 14, dx = Math.cos(a), dy = Math.sin(a), L = Math.max(VW, VH) * 0.9, W = 15 * A
    for (const f of G.foes) { if (f.dead) continue; const ex = f.x - x, ey = f.y - f.r - y, u = ex * dx + ey * dy; if (u > 0 && u < L && Math.abs(ex * dy - ey * dx) < W + f.r) hurt(f, D, x, y, 50) }
    if (G.aw.has(SRC)) for (const b of G.eshots) { const ex = b.x - x, ey = b.y - y, u = ex * dx + ey * dy; if (u > 0 && u < L && Math.abs(ex * dy - ey * dx) < W + b.r) parry(b) }
    fx({ k: 'beam', x, y, a, L, W, T: 0.3 })
  },
}
/** 화면 안 n — 보스 > 정예 > 가까운 순 */
function strongest(n) { const v = e => (e.boss ? 2e9 : e.elite ? 1e9 : 0) - (e.x - pl.x) ** 2 - (e.y - pl.y) ** 2; return visible().sort((a, b) => v(b) - v(a)).slice(0, n) }
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
    SRC = w.id
    const st = w.st, A = st.area * S.area, D = st.dmg * S.might * (G.ch.mod.clutch && (G.lvl >= 50 || pl.hp <= S.maxHp * (0.49 + 0.01 * G.lvl)) ? 1 + G.ch.mod.clutch : 1)   // 치이카와 — 체력 50% 이하면(레벨업마다 기준 +1%, Lv 50부터는 늘) 공격력 +30%
    if (w.id === 'ura') {   // 쿨타임마다 둘레 전부
      w.R = 70 * A; w.pulse = Math.max(0, (w.pulse || 0) - dt)
      if ((w.t -= dt) <= 0) {
        w.t = Math.max(0.2, st.cd * CD); w.pulse = 0.2; w.fire = G.t; near(pl.x, pl.y, w.R, e => { hurt(e, D, pl.x, pl.y, 30) }); parryIn(pl.x, pl.y, w.R)
        if (rnd() < 0.08) fx({ k: 'text', x: pl.x + (rnd() - 0.5) * 30, y: pl.y - 50, s: tr`우라!`, col: '#ffd23f', T: 0.7 })
      }
      continue
    }
    if (w.id === 'guitar') {   // 켜져 있는 동안 음표가 돈다
      w.ang += dt * 3.4 * st.spd * S.speed
      if (w.on > 0) {
        if ((w.pt -= dt) <= 0) { w.pt = 0.8; near(pl.x, pl.y, 58 * A, e => { hurt(e, D * 0.5, pl.x, pl.y, 150) }); fx({ k: 'ring', x: pl.x, y: pl.y, R: 58 * A, T: 0.3, col: '#ffc2e0' }) }   // 연주하는 동안 0.8초마다 몸에 붙은 적을 살짝 밀쳐 낸다(음표 원 안쪽은 음표가 못 닿으니)
        if ((w.on -= dt) <= 0) w.t = st.cd * CD
      } else if ((w.t -= dt) <= 0) {
        const n = st.n + (PROJ.has(w.id) ? S.amount : 0); w.on = st.dur * S.dur; w.fire = G.t; w.pt = 0
        for (let i = 0; i < n; i++) G.shots.push({ src: SRC, k: 'orb', w, i, n, R: 80 * A, r: 10 * Math.sqrt(A), dmg: D, life: w.on, hit: new Map(), x: pl.x, y: pl.y, t: 0 })
      }
      continue
    }
    if (w.q > 0) { if ((w.qt -= dt) <= 0) { SHOT[w.id](w, st, w.n - w.q, A, D); w.q--; w.qt = 0.12; w.fire = G.t } }
    else if ((w.t -= dt) <= 0) { w.n = w.q = st.n + (PROJ.has(w.id) ? S.amount : 0); w.qt = 0; w.t = st.cd * CD; w.list = ['sasu', 'kanpai', 'nantoka', 'weed'].includes(w.id) ? closest(w.n) : w.id === 'momo' ? strongest(w.n) : [] }
  }
}

// ---- 적
const HPK = [1, 1.4, 1.8, 2.3, 4.3, 8, 34]   // 보통 적 피 배수 — 0 · 5 · 10 … 30분, 사이는 잇는다. 20~25분은 완만하게(예전 4.3 → 13), 세이렌이 나오는 25분부터 가파르게
const dmgK = m => 1 + 0.055 * Math.min(m, 20) + 0.02 * clamp(m - 20, 0, 5) + 0.12 * Math.max(0, m - 25)   // 닿으면 아픈 정도 — 20분까지 분마다 +5.5%, 20~25분 +2%, 25분부터 +12%
const hpK = m => { const i = Math.min(5, m / 5 | 0); return HPK[i] + (HPK[i + 1] - HPK[i]) * Math.min(1, m / 5 - i) }
function spawn(type, x, y) {
  const F = FOES[type], m = G.t / 60, mm = Math.min(m, 30), big = type in BOSS
  const hp = F.hp * (big ? (1 + mm * 0.25) * (type === 'siren' || type === 'mermaid' ? 1 : BOSS_HP * (G.diff === 'hard' || G.inf ? 1.5 : 1)) * (HARD_HP[type] && (G.diff === 'hard' || (G.inf && !G.loop.lv)) ? HARD_HP[type] : 1) : hpK(mm) * (G.inf ? 1 + INF.foe * G.loop.lv : 1)) * G.D.hp * (big ? 1 : G.crowd || 1)
  const e = {
    type, v: 0, x: 0, y: 0, r: F.r, hp, max: hp, spd: F.spd * (0.9 + rnd() * 0.2), dmg: F.dmg * dmgK(m), xp: F.xp * (big ? 1 : G.crowd || 1),
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
  if (G.inf && kind !== 'siren' && kind !== 'mermaid') e.loop = 0.5   // 무한 — 0단계부터 변형 기술(참). 단계 무리는 infStep 이 단계 수(1 ~)로 덮는다 — 1단계부터 기술 하나 더(e.loop ≥ 1 · 사용자 · 기획 2026-11-22)
  bubble(e, B.line, '#fff'); kind === 'siren' ? SND.siren() : SND.boss()   // 세이렌은 따로 — 파도 · 하프 · 노랫소리
  say(mid ? tr`중간보스 — ${B.name}` : tr`${B.name} 등장!`, 2.2, mid ? '#ffb35e' : '#ff6b6b'); shake = Math.max(shake, mid ? 4 : 8)
  return e
}
const bubble = (e, s, col) => fx({ k: 'shout', e, s, col, T: 1.8 })
const newMove = (e, s) => { if (e.newSk?.has(s)) return; (e.newSk ||= new Set()).add(s); fx({ k: 'shout', e, s, col: 'new', T: 2.2 }) }   // 무한 새 기술 — 처음 쓸 때 머리 위에 이름(처음 보는 기술에 억울하게 맞지 않게)
/** 최종보스 — 세이렌 + 둘레를 도는 인어 셋. 인어가 살아 있는 동안 세이렌은 받는 피해 -50% */
function infStep() {   // 무한 — 보스 무리(일정 시간마다) → 다 쓰러뜨리면 세이렌 여럿
  const L = G.loop
  if (G.final) return
  const n = Math.min(INF.kinds.length, L.lv + 1)
  if (L.queue.length && G.t >= L.next) {   // 강해진 보스 n 마리 — 서로 다른 종류
    const kinds = L.queue.splice(0, n)
    kinds.forEach((k, i) => { const e = summon(k); e.max *= (1 + INF.hp * L.lv) * (k === 'anoko' ? INF.anoko : 1); e.hp = e.max; e.dmg *= 1 + INF.dmg * L.lv; e.spd *= 1 + INF.spd * L.lv; e.loop = L.lv; e.castT = G.t + 4 + i * 2.5; L.spawned.push(e) })
    say(tr`무한 ${L.lv}단계 — 강해진 보스 ${kinds.length}마리!`, 2.4, '#ff8a5c'); L.next = G.t + INF.gap
  }
  if (!L.queue.length && L.spawned.every(e => e.dead)) sirens(Math.min(3, n))   // 이번 단계 보스를 다 쓰러뜨렸다 — 세이렌 n 명
}
function sirens(n) {   // 무한 — 세이렌 여럿(각각 인어 셋이 둘레를 돈다). 단계만큼 세다
  const L = G.loop, list = [], mermaids = []
  for (let k = 0; k < n; k++) {
    const s = summon('siren'); s.sea = true; s.loop = L.lv; s.ph = 1; s.dmgK = 1; s.base = s.max * (1 + INF.hp * L.lv); s.max = s.base * SIREN_PH[0].hp; s.hp = s.max; s.dmg *= 1 + INF.dmg * L.lv; list.push(s)
    for (let i = 0; i < 3; i++) { const a = i / 3 * TAU, m = spawn('mermaid', s.x + Math.cos(a) * 130, s.y + Math.sin(a) * 100); Object.assign(m, { v: i, sea: true, orb: a, patT: 2 + i, pat: 0, castT: Infinity, host: s }); mermaids.push(m) }
  }
  G.final = { siren: list[0], sirens: list, mermaids, at: G.t }; SND.play('siren')
  say(tr`세이렌 ${n}명! ${INF.dark / 60}분 동안 페이즈를 못 넘기면 검은 별똥별이 와요`, 3.2, '#ff7ad9'); shake = 10
}
/** 무한 세이렌 — 쓰러지지 않고 다음 페이즈로: 2초 무적(방울 방패) · 화면 번쩍 · 날아오던 적 탄 지우기 · 오니기리 · 새 체력. 넘긴 페이즈도 잡은 보스로 센다(랭킹) */
function phaseUp(e) {
  const P = SIREN_PH[e.ph]; e.ph++; e.phT = G.t; e.shield = G.t + 2
  Object.assign(e, { max: e.base * P.hp, dmgK: P.dmg, act: null, spray: null, st: 'walk', patT: 2.2, pat: 0 }); e.hp = e.max
  if (e.ph === 2) { e.angry = true; for (const m of G.final.mermaids) if (m.host === e && !m.dead) kill(m, true) }   // 화난 세이렌 — 인어 없이
  if (e.ph === 3) e.storm = true
  for (const b of G.eshots) b.dead = true
  item(e.x, e.y, 'onigiri', true); G.bosses++; G.bossT = G.t; progress()
  fx({ k: 'white', T: 0.3, a: 0.45 }); fx({ k: 'ring', x: e.x, y: e.y, R: 220, T: 0.5, col: P.col }); shake = Math.max(shake, 6); bubble(e, P.line, P.col); say(P.name, 2, P.col)
}
function progress() {   // 진행 시계 — 어느 세이렌이든 페이즈를 넘기면(쓰러뜨려도) 다시 3분, 와 있던 검은 별똥별은 물러난다
  G.final.at = G.t
  if (G.dark) { fx({ k: 'bye', s: SPR.dark[0], x: G.dark.x, y: G.dark.y, T: 1.2 }); G.dark = null }
}
function stageClear(e) {   // 무한 — 세이렌을 모두 쓰러뜨렸다 → 다음 단계(보스 무리부터)
  const L = G.loop
  L.lv++; L.queue = shuffle([...INF.kinds]); L.spawned = []; L.next = G.t + INF.rest
  G.final = null; SND.play(fieldSong(), false, G.ch.id)
  for (const f of G.foes) if (!f.dead) kill(f, true)   // 잠깐 숨 돌리게 — 남은 적은 모두 도망친다
  item(e.x, e.y, 'chest'); fx({ k: 'pillar', T: 1 })
  say(tr`무한 ${L.lv}단계! 보스가 ${Math.min(INF.kinds.length, L.lv + 1)}마리씩 와요`, 3.2, '#ffd23f')
}
function finale() {
  const s = summon('siren'); s.sea = true
  G.final = { siren: s, sirens: [s], mermaids: [], at: G.t }; SND.play('siren')
  for (let i = 0; i < 3; i++) {
    const a = i / 3 * TAU, m = spawn('mermaid', s.x + Math.cos(a) * 130, s.y + Math.sin(a) * 100)
    Object.assign(m, { v: i, sea: true, orb: a, patT: 2 + i, pat: 0, castT: Infinity, host: s })
    G.final.mermaids.push(m)
  }
  say(tr`최종보스 — 세이렌! 인어부터 쓰러뜨리자`, 3.2, '#ff7ad9'); shake = 10
}
const guarded = s => G.final?.mermaids.some(m => !m.dead && (!s || !m.host || m.host === s))   // 그 세이렌의 인어가 살아 있나(무한 — 세이렌마다 따로)
/** 화면 바로 바깥 — ahead 면 가는 쪽 앞에 */
function ring(e, ahead = false) {
  const hw = VW / 2 + 40, hh = VH / 2 + 50
  const a = ahead ? Math.atan2(pl.face[1], pl.face[0]) + (rnd() - 0.5) * 2.2 : rnd() * TAU, c = Math.cos(a), s = Math.sin(a)
  const t = Math.min(hw / Math.max(1e-6, Math.abs(c)), hh / Math.max(1e-6, Math.abs(s)))
  e.x = pl.x + c * t; e.y = pl.y + s * t
}
function spawner(dt) {
  const m = G.t / 60, full = 22 + m * 10 + m * m * 0.45, raw = full * (G.final ? 0.5 : 1), want = Math.min(MAX_FOES, raw)
  G.crowd = clamp(full / MAX_FOES, 1, 320 / MAX_FOES)   // 세이렌 때 나오는 수는 반이어도 남은 적의 피 몫은 그대로(예전엔 25분에 적이 갑자기 약해졌다)   // 예전 한도 320 만큼의 피 · 경험치를 남은 적이 나눠 든다
  if ((G.spawnT -= dt) <= 0) {
    G.spawnT = Math.max(0.09, 0.55 - m * 0.02)
    const n = Math.min(want - G.foes.length, 1 + (m / 1.8 | 0))
    for (let i = 0; i < n; i++) {
      const far = G.D.shot ? 0.75 : 0   // 원거리 일반 몬스터(가면 키메라 · 복어 · 문어)는 어려움에서만 — 비중 3/4
      const w = [['goblin', 1], ['bug', m < 6 ? 0.7 : 0.3], ['chimera', m >= 1 ? 0.5 + m * 0.03 : 0], ['beetle', m >= 3 ? 0.15 + m * 0.02 : 0], ['star', m >= 5 ? 0.12 + (m - 5) * 0.01 : 0], ['dekatsu', m >= 4 ? 0.1 + m * 0.03 : 0],
        ['spiker', far * (m >= 6 ? 0.1 + (m - 6) * 0.035 : 0)], ['fugu', far * (m >= 8 ? 0.08 + (m - 8) * 0.03 : 0)], ['octo', far * (m >= 12 ? 0.08 + (m - 12) * 0.03 : 0)], ['parttimer', m >= 14 ? 0.05 + (m - 14) * 0.02 : 0]]
      let q = rnd() * w.reduce((s, x) => s + x[1], 0), type = 'goblin'
      for (const [k, v] of w) if ((q -= v) < 0) { type = k; break }
      if (type === 'star') { const e = spawn('star'); for (let k = 0; k < 2; k++) spawn('star', e.x + (rnd() - 0.5) * 34, e.y + (rnd() - 0.5) * 34) }   // 별똥별은 셋이 같이
      else spawn(type)
    }
  }
  while (G.pi < PLAN.length && G.t >= PLAN[G.pi][0]) { const [, kind, mid] = PLAN[G.pi++]; summon(kind, !!mid) }
  if (!G.final && G.t >= FINAL_T && !G.loop.lv) finale()
  if (G.inf && G.loop.lv) infStep()
  if (G.t >= G.nextElite) { spawn('golden'); G.nextElite += m < 10 ? 60 : 40 }
  if (G.t >= G.nextSwarm) {   // 꼬마 키메라가 사방에서 둘러싼다
    const n = 18 + (m * 2.5 | 0), R = Math.max(VW, VH) * 0.62
    for (let i = 0; i < n; i++) { const a = i / n * TAU; spawn('chimera', pl.x + Math.cos(a) * R, pl.y + Math.sin(a) * R) }
    G.nextSwarm += 120; say(tr`키메라 떼가 몰려온다!`, 1.8)
  }
  if (!G.final && G.t >= G.nextEvt) { event(m); G.nextEvt = G.t + (m < 15 ? 30 + rnd() * 12 : m < 20 ? 22 + rnd() * 8 : 20 + rnd() * 6) }
}
// ---- 변수 기술 — 10분부터. 스킬로 못 막는다 — 보고 피해야 한다. 피해는 최대 체력의 f
const pct = f => S.maxHp * f
function event(m) {
  if (m < 12 || rnd() < 0.55) {   // 고블린 폭탄 — 붉은 원이 다 차면 터진다. 첫 원은 내 발밑
    const n = Math.min(14, 5 + ((m - 10) / 2 | 0)), dmg = pct(0.13 + clamp((m - 10) / 12, 0, 1) * 0.07)
    for (let i = 0; i < n; i++) { const a = rnd() * TAU, d = i ? 40 + rnd() * 220 : 0; G.haz.push({ k: 'bomb', x: pl.x + Math.cos(a) * d, y: pl.y + Math.sin(a) * d, R: 60, t: -i * 0.1, T: 1.3, dmg, col: '#ff4d4d' }) }
    say(tr`고블린 폭탄!`, 1.2, '#ff6b6b')
  } else {   // 고블린 돌격대 — 한쪽에서 줄지어 달려온다. 초록 줄(빈자리)로 피하기
    const horiz = rnd() < 0.5
    G.haz.push({ k: 'rush', t: 0, T: 1.2, horiz, dir: rnd() < 0.5 ? 1 : -1, gap: (horiz ? cam.y : cam.x) + (rnd() - 0.5) * (horiz ? VH : VW) * 0.6, dmg: pct(0.14) })
    say(tr`고블린 돌격대!`, 1.2, '#ff6b6b')
  }
}
function bandNow(z) {   // 띠가 다 찼다 — 안에 있으면 맞는다(그림과 판정이 같다 — 납작하게 누르지 않음). 돌격대 줄은 돌격대를 내보낸다
  const c = Math.cos(z.a), s = Math.sin(z.a)
  if (z.lane) { for (let i = 0; i < z.lane; i++) { const e = spawn('rusher', z.x - c * i * 44, z.y - s * i * 44); e.rush = [c * 420, s * 420]; e.dmg = z.dmg } return }
  const dx = pl.x - z.x, dy = pl.y - z.y, along = dx * c + dy * s, side = -dx * s + dy * c
  if (along > -pl.r && along < z.L + pl.r && Math.abs(side) < z.W / 2 + pl.r * 0.5) ouch(z.dmg, z)
  fx({ k: 'beam', x: z.x, y: z.y, a: z.a, L: z.L, W: z.W, T: 0.25, cols: [[z.col, 1, 0.6], ['#fff', 0.7, 0.85]] })
  const ex = z.x + c * z.L, ey = z.y + s * z.L
  for (let i = 0; i < 4; i++) { const a = rnd() * TAU; part(ex, ey, Math.cos(a) * 160, Math.sin(a) * 90 - 80, i % 2 ? z.col : '#fff', 0.35, 2.6) }
  shake = Math.max(shake, 4)
}
/** 음표 울타리 — 초록 빈틈 호(음표와 함께 좁혀진다, 깜빡이지 않게) · 처음 0.9초는 빨간 점선 고리(빈틈은 끊는다) + 나 → 빈틈 화살표 셋 */
function fenceDraw(c, z) {
  const r = z.t < 0.9 ? 260 : Math.max(0, 260 - 150 * (z.t - 0.9)), h = TAU / 10
  c.beginPath(); c.arc(z.x, z.y, r + 18, z.a - h, z.a + h); c.arc(z.x, z.y, Math.max(0, r - 18), z.a + h, z.a - h, true); c.closePath(); c.fillStyle = 'rgba(120,230,120,.55)'; c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke()
  if (z.t >= 0.9) return
  c.globalAlpha = 0.6; c.strokeStyle = '#ff2e2e'; c.lineWidth = 2.5; c.setLineDash([10, 7]); c.beginPath(); c.arc(z.x, z.y, 260, z.a + h, z.a - h + TAU); c.stroke(); c.setLineDash([]); c.globalAlpha = 1
  const q = Math.atan2(z.y + Math.sin(z.a) * 260 - pl.y, z.x + Math.cos(z.a) * 260 - pl.x)
  c.font = `22px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 4; c.strokeStyle = '#fff'; c.fillStyle = '#3fae5a'
  for (const d of [120, 170, 220]) { c.save(); c.translate(pl.x + Math.cos(q) * d, pl.y + Math.sin(q) * d); c.rotate(q); c.strokeText('›', 0, 0); c.fillText('›', 0, 0); c.restore() }
  c.textBaseline = 'alphabetic'
}
/** 큰 파도 — top 이 아니면 바닥(예고: 출발 끝 파란 빛 · 화살표, 처음부터 끝까지 초록 빈 줄), top 이면 몸 위 물결 띠(뒤는 파란 그라데이션 · 앞머리 흰 거품 · 빈틈 끝은 둥근 거품)
 *  세로로 가는 파도는 x · y 를 바꿔 같은 그림으로(c.transform(0, 1, 1, 0)) — 좌표는 (가는 방향, 가로지르는 방향) */
function tideDraw(c, z, top) {
  c.save(); if (!z.horiz) c.transform(0, 1, 1, 0, 0, 0)
  const lo = z.c0 - z.half, hi = z.c0 + z.half
  if (!top) {
    c.fillStyle = 'rgba(120,230,120,.55)'; c.fillRect(z.from - 3e4, z.gap - 70, 6e4, 140)   // 빈틈 — 맞는 판정과 똑같이 ±70
    if (z.t < 1.2) {
      const e0 = z.from + z.dir * 40, g = c.createLinearGradient(e0, 0, e0 + z.dir * 120, 0); g.addColorStop(0, 'rgba(79,160,255,.7)'); g.addColorStop(1, 'rgba(79,160,255,0)')
      c.globalAlpha = 0.5 + 0.3 * Math.sin(G.t * 14); c.fillStyle = g; c.fillRect(Math.min(e0, e0 + z.dir * 120), lo, 120, hi - lo); c.globalAlpha = 1
    }
    c.restore()
    if (z.t < 1.2) txt(c, z.horiz ? (z.dir > 0 ? '→→→' : '←←←') : (z.dir > 0 ? '↓ ↓ ↓' : '↑ ↑ ↑'), cam.x, cam.y - 80, 34, '#2f7fe0')
    return
  }
  const p = z.from + z.dir * 240 * (z.t - 1.2), back = p - z.dir * 80, g = c.createLinearGradient(back, 0, p, 0); g.addColorStop(0, '#2f6fd0'); g.addColorStop(1, '#4fa0ff')
  for (const [a, b] of [[lo, z.gap - 70], [z.gap + 70, hi]]) {
    if (b <= a) continue
    c.globalAlpha = 0.85; c.fillStyle = g; c.fillRect(Math.min(back, p), a, 80, b - a); c.globalAlpha = 1
    c.fillStyle = '#fff'; c.fillRect(Math.min(p, p - z.dir * 12), a, 12, b - a)   // 앞머리 흰 거품
    c.beginPath(); for (let y = a + ((G.t * 30) % 24); y < b; y += 24) { c.moveTo(p, y); c.arc(p, y, 10, -Math.PI / 2, Math.PI / 2, z.dir < 0) } c.fill()   // 반원 물결 — 옆으로 흐른다
  }
  for (const y of [z.gap - 78, z.gap + 70]) if (y > lo && y < hi) c.fillRect(Math.min(back, p), y, 80, 8)   // 빈틈 가장자리 — 물 쪽으로 흰 거품 줄(빈틈 안으로 들어오지 않게)
  c.restore()
}
/** 바닥에 손 하나 — 동그라미(반지름 R, 0.8 납작은 RX 가 있을 때만) 안에 손 그림 */
function handAt(c, x, y, kind, R, line, fill, RX) {
  c.fillStyle = fill; c.strokeStyle = line; c.lineWidth = 3; if (RX) oval(c, x, y, RX, RX * 0.8); else oval(c, x, y, R, R); c.fill(); c.stroke()
  c.save(); c.translate(x, y); c.scale(R / 17, R / 17); hand(c, kind); c.restore()
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
      else if (!frozen && d < e.r + pl.r - 2) ouch(e.dmg, e, true)
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
    if (!frozen && SH && d < SH.range && (e.cd -= dt) <= 0) { e.cd = SH.cd + rnd(); G.eshots.push({ k: SH.k, x: e.x, y: e.y, vx: dx * SH.spd, vy: dy * SH.spd, t: 0, life: 2.6, dmg: e.dmg + 1, grow: 1, r: SH.r, slow: SH.slow }) }
    if (!frozen && d < e.r + pl.r - 2 && e.z < 20) ouch((e.boss ? Math.max(e.dmg, pct(e.mid ? 0.08 : 0.1)) * (e.rage ? 1.4 : 1) : e.dmg) * (e.st === 'dash' ? 1.5 : 1), e, true)   // 뛰어오른 보스는 안 닿는다
  }
}
// 돌진 — 걷다가 멈칫(붉게) 하고 그 방향으로
//   무한(e.loop — 무한 단계에 나온 보스) 데카츠요: 돌진이 끝나면 0.5초 쉬고 한 번 더(rest), 그다음은 충격파 — [돌진 2연속 → 충격파] 반복
function charge(e, dt, dx, dy) {
  e.stT -= dt
  const deka = e.kind === 'dekatsuyo' && e.loop
  if (e.st === 'walk') { e.vx = dx * e.spd; e.vy = dy * e.spd; if (e.stT <= 0) {
    if (deka && e.pat++ % 2) { e.stT = 2.6 + rnd() * 1.4; e.act = { k: 'quake', t: 0.4 }; bubble(e, tr`쿵! 쿵!`, '#ff6b6b'); return }
    e.st = 'wind'; e.stT = 0.7; e.dx = dx; e.dy = dy } }
  else if (e.st === 'wind') { e.vx = e.vy = 0; e.flash = 0.05 * ((G.t * 12 | 0) % 2); if (e.stT <= 0) { e.st = 'dash'; e.stT = 0.75 } }
  else if (e.st === 'rest') { e.vx = e.vy = 0; if (e.stT <= 0) { e.st = 'wind'; e.stT = 0.7; e.dx = dx; e.dy = dy } }
  else { e.vx = e.dx * e.spd * 4; e.vy = e.dy * e.spd * 4; if (e.stT <= 0) { if (deka && !e.again) { e.again = true; e.st = 'rest'; e.stT = 0.5 } else { e.again = false; e.st = 'walk'; e.stT = 2.6 + rnd() * 1.4 } } }
}
// 보스 — 종류마다 다른 기술. 기술 전에는 멈춰 깜빡인다(act) — 보고 피할 수 있게
function bossAI(e, dt, dx, dy, d) {
  if (e.leap) return leapStep(e, dt)
  if (e.shield && G.t >= e.shield) { e.shield = 0; fx({ k: 'ring', x: e.x, y: e.y - e.r * 1.1, R: e.r + 40, T: 0.4, col: '#fff' }) }
  if (e.storm && !LQ && (e.boltT = (e.boltT ?? 0.8) - dt) <= 0) { e.boltT = 0.8; const x = e.x + (rnd() - 0.5) * 120, y = e.y - e.r + (rnd() - 0.5) * 120; fx({ k: 'bolt', x, y, pts: zig(x + (rnd() - 0.5) * 30, y - 70, x, y), T: 0.25 }) }   // 폭풍 — 둘레 짧은 번개(보이기만)
  if (e.kind === 'siren' && !e.ph && !e.angry && e.hp < e.max / 2) { e.angry = true; bubble(e, tr`…용서 못 해!`, '#ff4d4d'); say(tr`세이렌이 화났다! 눈이 붉어졌다`, 2, '#ff4d4d') }
  if (e.spray) spray(e, dt)
  if (e.act) { e.vx = e.vy = 0; e.flash = 0.05 * ((G.t * 12 | 0) % 2); if ((e.act.t -= dt) <= 0) { const a = e.act; e.act = null; ACT[a.k](e, a) } return }
  const B = BOSS[e.kind]
  if (!e.rage && e.kind !== 'mermaid' && e.kind !== 'siren' && e.age > RAGE_T) { e.rage = true; e.spd *= 1.5; bubble(e, tr`화났다!`, '#ff4d4d'); say(tr`${B.name}이(가) 화났다! 빨라지고 더 자주 공격해요`, 2.2, '#ff4d4d') }   // 피해 다니기만 하면 화낸다
  if (e.st !== 'walk') return charge(e, dt, dx, dy)
  if (B.st && !e.mid && G.t >= e.castT) {   // 상태이상 — 이름을 외치고 0.8초 뒤 물결이 퍼진다
    e.castT = G.t + B.stCd
    e.act = { k: 'wave', id: B.st, t: 0.8 }; bubble(e, `${STATUS[B.st].name}!`, STATUS[B.st].col)
    return
  }
  if (e.kind === 'dekatsuyo') return charge(e, dt, dx, dy)
  const sp = e.spd
  if (e.kind === 'mermaid') {   // 세이렌 둘레를 돈다
    const s = alive(e.host) || alive(G.final?.siren), cx = s ? s.x : pl.x, cy = s ? s.y : pl.y   // 자기 세이렌 둘레(무한 — 세이렌이 여럿)
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
    case 'goblinKing': {
      const p = e.mid ? 0 : e.pat++ % (e.loop ? 4 : 3)
      if (p === 2) { e.patT = 2.6; e.act = { k: 'squad', t: 0.6 }; bubble(e, tr`모여라!`, '#fff') }
      else if (p === 3) { e.patT = 2.6; e.act = { k: 'lane', t: 0.6 }; bubble(e, tr`돌격대 출동!`, '#ff8a2b') }   // 무한 — 새 기술
      else { e.patT = e.mid ? 3.2 : 2.3; e.act = { k: 'volley', n: e.mid ? 3 : 5, t: 0.45, shot: 'rock' } }
      break
    }
    case 'bigChimera': e.patT = e.mid ? 5.5 : 4; if (e.loop && e.pat++ % 2) { e.act = { k: 'tears', t: 0.3 }; bubble(e, tr`흐에엥…`, '#4a86e8') } else leap(e); break   // 무한 — [점프 2연속 ↔ 눈물]
    case 'mermaid': e.patT = 3 + rnd() * 1.5; Object.assign(e, { st: 'wind', stT: 0.55, dx, dy }); break   // 날카로운 이빨로 달려들어 문다(charge)
    case 'anoko': e.patT = 2.4; [() => Object.assign(e, { st: 'wind', stT: 0.7, dx, dy }), () => { e.act = { k: 'sweep', t: 0.5 }; bubble(e, tr`꼬리!`, '#4f9a8c') }, () => { e.act = { k: 'volley', n: 5, t: 0.45, shot: 'claw' } },
      () => { e.act = { k: 'trident', t: 0.3 }; bubble(e, tr`세 갈래!`, '#4f9a8c') }][e.pat++ % (e.loop ? 4 : 3)](); break
    case 'rps': e.patT = 2.4; [() => { e.act = { k: 'slamAt', t: 0.4 }; bubble(e, tr`바위!`, '#fff') }, () => { Object.assign(e, { st: 'wind', stT: 0.6, dx, dy }); bubble(e, tr`가위!`, '#fff') }, () => { e.act = { k: 'papers', t: 0.4 }; bubble(e, tr`보!`, '#fff') },
      () => { e.act = { k: 'duel', t: 0.3 }; bubble(e, tr`가위바위보!`, '#fff') }][e.pat++ % (e.loop ? 4 : 3)](); break
    case 'chef': e.patT = 2.6; [() => { e.act = { k: 'pepper', t: 0.4 }; bubble(e, tr`후추 톡톡!`, '#fff') }, () => { e.act = { k: 'wrap', t: 0.4 }; bubble(e, tr`돌돌 말아서…`, '#fff') }, () => Object.assign(e, { st: 'wind', stT: 0.7, dx, dy }),
      () => { e.patT = 4; e.act = { k: 'sauce', t: 0.9, dir: rnd() < 0.5 ? 1 : -1 }; bubble(e, tr`소스 듬뿍!`, '#ff6b3d') }][e.pat++ % (e.loop ? 4 : 3)](); break
    case 'siren': {   // 무한 세이렌(ph) — 1 [음표 · 덩굴 · 꼬리치기] → 2 + 음표 울타리 → 3 + 큰 파도(간격 1.8초)
      const ph = e.ph || 1; e.patT = ph >= 3 ? 1.8 : e.angry ? 2 : 2.6
      let k = e.pat++ % (ph + 2)
      if (k >= 3 && (sick('charm') || G.t < (G.final?.bigT || 0))) k = 0   // 울타리 · 파도는 세이렌 전체에서 한 번에 하나(8초) · 매혹 중엔 안 쓴다(끌려가는 중엔 빈틈으로 못 간다)
      if (k >= 3) G.final.bigT = G.t + 8
      ;[() => { e.act = { k: 'notes', t: 0.5 } }, () => { e.act = { k: 'vines', t: 0.3 }; bubble(e, tr`덩굴아!`, '#58b947') }, () => { e.act = { k: 'slam', t: 0.35 }; bubble(e, tr`꼬리치기!`, '#ff8a8a') },
        () => { e.act = { k: 'fence', t: 0.3 }; bubble(e, tr`도망칠 수 없어~♪`, SIREN_PH[1].col) }, () => { e.act = { k: 'tide', t: 0.3 }; bubble(e, tr`파도야!`, SIREN_PH[2].col) }][k]()
      break
    }
  }
  if (e.rage) e.patT *= 0.6
}
const ACT = {
  volley(e, a) {   // 부채꼴로 던진다
    const q0 = a.q0 ?? Math.atan2(pl.y - e.y, pl.x - e.x), v = e.mid ? 230 : 265
    for (let i = 0; i < a.n; i++) { const q = q0 + (i - (a.n - 1) / 2) * 0.17; G.eshots.push({ k: a.shot, x: e.x, y: e.y, vx: Math.cos(q) * v, vy: Math.sin(q) * v, t: 0, life: 3.2, dmg: pct(e.mid || e.kind === 'mermaid' ? 0.07 : 0.09), r: 8 }) }
    if (e.loop && e.kind === 'goblinKing' && a.q0 == null) e.act = { k: 'volley', n: a.n - 1, t: 0.3, shot: a.shot, q0 }   // 무한 — 0.3초 뒤 사이사이 한 겹 더
  },
  notes(e, a) {   // 음표를 사방으로 — 매번 반 칸씩 돌려서(무한 2페이즈부터 0.4초 뒤 반 칸 돌려 한 겹 더)
    const n = 16, o = ((e.pat + (a.second ? 1 : 0)) % 2) * Math.PI / n
    for (let i = 0; i < n; i++) { const q = o + i / n * TAU; G.eshots.push({ k: 'note', x: e.x, y: e.y, vx: Math.cos(q) * 170, vy: Math.sin(q) * 170, t: 0, life: 3.4, dmg: pct(0.06) * (e.dmgK || 1), r: 7 }) }
    if (e.ph >= 2 && !a.second) e.act = { k: 'notes', t: 0.4, second: true }
  },
  squad(e) { const n = e.loop ? 12 : 8; for (let i = 0; i < n; i++) { const q = i / n * TAU; spawn('goblin', pl.x + Math.cos(q) * 230, pl.y + Math.sin(q) * 230) } },   // 부하를 불러 나를 에워싼다(무한 12)
  slamAt(e, a) { G.haz.push({ k: 'land', x: pl.x, y: pl.y, R: 95, t: 0, T: 0.9, dmg: pct(0.18), col: '#8a8f99' }); if (e.loop && (a.n ?? 3) > 1) e.act = { k: 'slamAt', t: 0.35, n: (a.n ?? 3) - 1 } },   // 쇠공 팔로 내 자리를 내려찍는다(무한 3연속)
  papers(e, a) { const n = 12, o = ((e.pat + (a.second ? 1 : 0)) % 2) * Math.PI / n; for (let i = 0; i < n; i++) { const q = o + i / n * TAU; G.eshots.push({ k: 'paper', x: e.x, y: e.y, vx: Math.cos(q) * 180, vy: Math.sin(q) * 180, t: 0, life: 3.2, dmg: pct(0.06), r: 7 }) }
    if (e.loop && !a.second) e.act = { k: 'papers', t: 0.35, second: true } },   // 무한 — 0.35초 뒤 반 칸 돌려 한 겹 더
  pepper(e, a = {}) {   // 요리사 「후추 톡톡」 — 나 둘레에 작은 후추 장판. 무한 1단계부터 0.6초 뒤 토르티야(돌돌)가 이어진다
    for (let i = 0, n = e.loop ? 14 : 9; i < n; i++) { const q = rnd() * TAU, d = i ? 40 + rnd() * 160 : 0; G.haz.push({ k: 'bomb', x: pl.x + Math.cos(q) * d, y: pl.y + Math.sin(q) * d, R: 38, t: -i * 0.07, T: 1, dmg: pct(0.08), col: '#5b4a42' }) }
    if (e.loop >= 1 && !a.combo) { newMove(e, tr`후추 다음엔 돌돌!`); e.act = { k: 'wrap', t: 0.6, combo: true } }
  },
  wrap(e) { G.haz.push({ k: 'bomb', x: pl.x, y: pl.y, R: e.loop ? 140 : 115, t: 0, T: 1.25, dmg: pct(0.2), col: '#e9b949' }) },   // 토르티야로 돌돌 — 밖으로 피하기
  sweep(e) { G.haz.push({ k: 'bomb', x: e.x, y: e.y, R: 150, t: 0, T: 1, dmg: pct(0.18), col: '#4f9a8c' }); if (e.loop) e.act = { k: 'lunge', t: 1 } },   // 용 꼬리로 둘레를 휩쓴다 — 멀리 벗어나기(무한 — 터지면 바로 돌진)
  lunge(e) { const dx = pl.x - e.x, dy = pl.y - e.y, d = Math.hypot(dx, dy) || 1; Object.assign(e, { st: 'wind', stT: 0.7, dx: dx / d, dy: dy / d }) },
  hold() {},   // 제자리에서 기다리기(띠가 터질 때까지)
  tears(e) {   // 거대 키메라 「눈물 웅덩이」 — 내 둘레 파란 원 다섯(하나는 내 자리) → 눈물이 떨어지고 그 자리에 4초 웅덩이(밟으면 느려진다)
    for (let i = 0; i < 5; i++) { const a = rnd() * TAU, d = i ? 70 + rnd() * 150 : 0; G.haz.push({ k: 'bomb', x: pl.x + Math.cos(a) * d, y: pl.y + Math.sin(a) * d, R: 55, t: 0, T: 0.9, dmg: pct(0.06), col: '#4a86e8', tear: true, kind: e.kind }) }
  },
  duel(e) {   // 가위바위보 「가위바위보 승부!」 — 보스 손을 이기는 손 원에 2초 안에 들어가기. 그 원만 안전, 둘레 320 은 쾅. 원 셋은 똑같이(정답을 미리 티 내지 않게), 땅에 고정
    const H = ['rock', 'scissors', 'paper'], hand = H[rnd() * 3 | 0], win = { rock: 'paper', scissors: 'rock', paper: 'scissors' }[hand], o = rnd() * TAU, order = shuffle([...H])
    if (e.loop >= 1) newMove(e, tr`자리 바꾸기!`)
    G.haz.push({ k: 'duel', swap: e.loop >= 1, x: pl.x, y: pl.y, R: 320, t: 0, T: e.loop >= 1 ? 2.6 : 2, dmg: pct(0.25), col: '#ff4d4d', hand, win, kind: e.kind, opts: order.map((k, i) => ({ hand: k, x: pl.x + Math.cos(o + i * TAU / 3) * 150, y: pl.y + Math.sin(o + i * TAU / 3) * 150 * 0.8 })) })
    fx({ k: 'hand', e, hand, T: e.loop >= 1 ? 2.6 : 2 }); e.act = { k: 'hold', t: e.loop >= 1 ? 2.6 : 2 }
  },
  sauce(e, a) { e.spray = { t: 0, acc: 0, a: Math.atan2(pl.y - e.y, pl.x - e.x), dir: a.dir }; e.act = { k: 'hold', t: 2.4 } },   // 요리사 괴물 「빙글빙글 소스」 — 0.9초 국자를 돌린 뒤 2.4초
  // ---- 무한 새 기술 — 띠(band): 몸에서 뻗는 긴 띠가 차오른 뒤 쾅. 겨눈 뒤로는 따라오지 않는다
  trident(e) {   // 아노코 「세 갈래 꼬리」 — 나를 겨눈 청록 띠 셋(가운데 · 좌우 25°). 무한 1단계부터 넷(사이로 피하기)
    const q = Math.atan2(pl.y - e.y, pl.x - e.x)
    if (e.loop >= 1) newMove(e, tr`네 갈래!`)
    for (const o of e.loop >= 1 ? [-36, -12, 12, 36] : [-25, 0, 25]) G.haz.push({ k: 'band', x: e.x, y: e.y, a: q + o * Math.PI / 180, L: 450, W: 70, t: 0, T: 1, dmg: pct(0.22), col: '#4f9a8c', kind: e.kind })
    e.act = { k: 'hold', t: 1 }
  },
  quake(e, a = {}) {   // 데카츠요 「쿵쿵 충격파」 — 제자리에서 세 번, 몸에서 붉은 띠 넷(+ → × → +), 사이 0.5초. 무한 1단계부터 한 번 더(반 칸 돌려)
    for (let k = 0; k < 3; k++) for (let j = 0; j < 4; j++) G.haz.push({ k: 'band', x: e.x, y: e.y, a: ((k + (a.second ? 1 : 0)) % 2) * Math.PI / 4 + j * Math.PI / 2, L: 500, W: 60, t: -k * 1.4, T: 0.9, dmg: pct(0.18), col: '#ff3c3c', kind: e.kind })
    if (e.loop >= 1 && !a.second) { newMove(e, tr`충격파 두 번!`); e.act = { k: 'quake', t: 2 * 1.4 + 0.9 + 0.4, second: true } }
    else e.act = { k: 'hold', t: 2 * 1.4 + 0.9 }
  },
  lane(e) {   // 고블린 대장 「돌격대 출동!」 — 화면 끝에서 나를 지나는 주황 줄 → 1초 뒤 돌격대 6마리가 그 줄로 달려 지나간다. 무한 1단계부터 줄 둘(엇갈려)
    const a0 = rnd() * TAU
    for (const a of e.loop >= 1 ? [a0, a0 + Math.PI / 2] : [a0]) {
      const c = Math.cos(a), s = Math.sin(a), d = Math.min(VW / 2 / Math.max(0.01, Math.abs(c)), VH / 2 / Math.max(0.01, Math.abs(s))) + 40
      G.haz.push({ k: 'band', x: pl.x - c * d, y: pl.y - s * d, a, L: d * 2, W: 80, t: a === a0 ? 0 : -0.4, T: 1, dmg: pct(0.14), col: '#ff8a2b', lane: 6 })
    }
    if (e.loop >= 1) newMove(e, tr`돌격대 두 줄!`)
  },
  vines(e) { for (let i = 0, n = e.ph >= 2 ? 10 : 7; i < n; i++) { const a = rnd() * TAU, d = i ? 50 + rnd() * 180 : 0; G.haz.push({ k: 'bomb', x: pl.x + Math.cos(a) * d, y: pl.y + Math.sin(a) * d, R: 55, t: -i * 0.12, T: 1.15, dmg: pct(0.12) * (e.dmgK || 1), col: '#58b947' }) } },   // 노래로 땅에서 덩굴을 솟게 한다(무한 2페이즈부터 10)
  slam(e) { G.haz.push({ k: 'land', x: pl.x, y: pl.y, R: 100, t: 0, T: 1, dmg: pct(0.2) * (e.dmgK || 1), col: '#ff4d4d' }) },   // 큰 꼬리로 내려친다
  fence(e) {   // 세이렌 「음표 울타리」 — 내 둘레 260 원 위 20칸에 음표(한 군데 4칸은 비움 — 초록 빈틈), 0.9초 멈췄다가 안쪽으로 모인다(150)
    const cx = pl.x, cy = pl.y, g0 = rnd() * 20 | 0, dmg = pct(0.08) * (e.dmgK || 1)
    for (let i = 0; i < 20; i++) { if ((i - g0 + 20) % 20 < 4) continue; const q = i / 20 * TAU; G.eshots.push({ k: 'note', x: cx + Math.cos(q) * 260, y: cy + Math.sin(q) * 260, vx: -Math.cos(q) * 150, vy: -Math.sin(q) * 150, wait: 0.9, t: 0, life: 0.9 + 260 / 150, dmg, r: 7 }) }
    G.haz.push({ k: 'fence', x: cx, y: cy, a: (g0 + 1.5) / 20 * TAU, t: 0, T: 0.9 + 260 / 150 })
  },
  tide(e) {   // 세이렌 「큰 파도」 — 화면 한쪽 끝이 1.2초 파랗게 빛난 뒤 화면 폭 물결 띠(두께 80)가 반대쪽으로(240). 초록 빈틈(폭 140)에 서면 안 맞는다
    const horiz = rnd() < 0.5, dir = rnd() < 0.5 ? 1 : -1, span = horiz ? VW : VH, cross = horiz ? VH : VW
    G.haz.push({ k: 'tide', kind: 'siren', horiz, dir, t: 0, T: 1.2 + (span + 160) / 240, from: (horiz ? cam.x : cam.y) - dir * (span / 2 + 40), c0: horiz ? cam.y : cam.x, half: cross / 2 + 60,
      gap: (horiz ? pl.y : pl.x) + (rnd() - 0.5) * cross * 0.5, dmg: pct(0.25) * (e.dmgK || 1) })
  },
  wave(e, a) { fx({ k: 'wave', x: e.x, y: e.y, R: 360, T: 0.8, st: a.id, col: STATUS[a.id].col }) },
}
function spray(e, dt) {   // 빙글빙글 소스 — 두 갈래 소용돌이(갈래마다 1초에 10발, 속도 140)
  const s = e.spray; s.t += dt; s.acc += dt * 10
  while (s.acc >= 1) { s.acc--; const q = s.a + s.dir * s.t * 2.4; for (const o of [0, Math.PI]) G.eshots.push({ k: 'sauce', x: e.x, y: e.y, vx: Math.cos(q + o) * 140, vy: Math.sin(q + o) * 140, t: 0, life: 3.6, dmg: pct(0.06), r: 7 }) }
  if (s.t >= 2.4) e.spray = null
}
/** 거대 키메라 — 내 자리(움직이면 조금 앞)에 뛰어내린다. 바닥의 붉은 원이 다 차면 쿵 */
function leap(e) {
  const x = pl.x + (pl.moving ? pl.face[0] * 50 : 0), y = pl.y + (pl.moving ? pl.face[1] * 50 : 0), T = e.mid ? 1.3 : 1.2
  e.leap = { x0: e.x, y0: e.y, x1: x, y1: y, t: 0, T }
  G.haz.push({ k: 'land', x, y, R: e.mid ? 85 : 110, t: 0, T, dmg: pct(e.mid ? 0.18 : 0.26), col: '#ff9f43' })
}
function leapStep(e, dt) {
  const L = e.leap, u = Math.min(1, (L.t += dt) / L.T)
  e.vx = e.vy = 0; e.x = L.x0 + (L.x1 - L.x0) * u; e.y = L.y0 + (L.y1 - L.y0) * u; e.z = Math.sin(u * Math.PI) * 140
  if (u >= 1) { e.leap = null; e.z = 0
    if (e.loop >= 1) { newMove(e, tr`파편 조심!`); const o = rnd() * TAU; for (let i = 0; i < 3; i++) G.haz.push({ k: 'bomb', x: e.x + Math.cos(o + i * TAU / 3) * 140, y: e.y + Math.sin(o + i * TAU / 3) * 112, R: 60, t: 0, T: 0.9, dmg: pct(0.14), col: '#c9b8e0' }) }   // 무한 1단계부터 — 내려앉은 자리 둘레에 파편 장판 셋
    if (e.loop && !e.again) { e.again = true; leap(e) } else e.again = false }   // 무한 — 내려앉자마자 한 번 더
}
const sick = id => G.sts[id] > G.t
function afflict(id) {
  G.sts[id] = G.t + ST_T
  fx({ k: 'text', x: pl.x, y: pl.y - 70, s: STATUS[id].name, col: STATUS[id].col, T: 1.6 }); fx({ k: 'flash', x: pl.x, y: pl.y - 20, R: 70, col: STATUS[id].col, T: 0.5 })
}
/** sea — 인어 · 세이렌에게 곱하는 배수(극매운 카레) */
function hurt(e, dmg, ox, oy, kb = 0, sea = 1) {
  SND.hit()
  if (e.dead || e.rush || e.shield > G.t) return   // 돌격대는 스킬에 안 맞는다 — 피하는 수밖에. 페이즈가 바뀌는 세이렌은 2초 무적(숫자도 안 띄운다)
  if (e.type === 'star' && rnd() < 0.05 && G.fx.length < 150) fx({ k: 'text', x: e.x, y: e.y - 26, s: tr`흐아아악!`, col: '#ffe066', T: 0.6 })
  const crit = rnd() < S.crit
  dmg *= (sick('weak') ? 0.6 : 1) * (e.boss || e.elite ? S.bossX : 1) * (e.sea ? sea : 1) * (e.kind === 'siren' && guarded(e) ? 0.5 : 1)
  dmg = Math.max(1, Math.round(dmg * (crit ? S.critX : 1) * (0.9 + rnd() * 0.2)))
  if (SRC) G.dmg[SRC] = (G.dmg[SRC] || 0) + Math.min(dmg, e.hp)
  e.hp -= dmg; e.flash = 0.1
  if (kb && !e.heavy && !e.boss) { const dx = e.x - ox, dy = e.y - oy, d = Math.hypot(dx, dy) || 1; e.kx += dx / d * kb; e.ky += dy / d * kb }   // 밀리는 건 작은 적만
  num(e.x, e.y - e.r * 2.6, dmg, crit ? 'crit' : '')
  if (e.hp <= 0) kill(e)
}
function kill(e, quiet = false) {
  if (!quiet && e.ph) { if (e.shield > G.t) return; if (e.ph < 3) return phaseUp(e) }   // 무한 세이렌 — 마지막 페이즈까지
  e.dead = true
  if (!quiet) { G.kills++; gem(e.x, e.y, e.xp); SND.kill(); if (e.type === 'goblin' || e.type === 'rusher' || e.type === 'golden') G.gob++ }
  const col = FOES[e.type].col
  if (G.fx.length < 180) fx({ k: 'puff', x: e.x, y: e.y - e.r, R: e.r * 1.4, T: 0.4 })
  for (let i = 0; i < (e.boss ? 36 : e.elite ? 14 : 3); i++) { const a = rnd() * TAU, s = 40 + rnd() * (e.boss ? 240 : 110); part(e.x, e.y - e.r, Math.cos(a) * s, Math.sin(a) * s - 60, i % 3 ? col : '#fff', 0.35 + rnd() * 0.35, 2 + rnd() * (e.boss ? 4 : 2.5)) }
  if (quiet) return
  if (e.elite || e.mid) { if (rnd() < 0.33 * S.luck * G.D.drop) item(e.x, e.y); for (let i = 0; i < 3; i++) gem(e.x + (rnd() - 0.5) * 40, e.y + (rnd() - 0.5) * 40, e.mid ? 10 : 5) }
  else if (!e.boss && rnd() < 0.0013 * S.luck * G.D.drop) item(e.x, e.y, { onigiri: 6, magnet: 4 })
  else if (!e.boss && G.t >= 600 && rnd() < 0.0005 * S.luck * G.D.drop) item(e.x, e.y, 'earplug')
  else if (!e.boss && G.t >= 180 && rnd() < 0.0004 * S.luck * G.D.drop) item(e.x, e.y, { pajama: 1, battery: 1 })
  if (!e.boss) return
  const B = BOSS[e.kind]
  if (!e.mid && e.kind !== 'mermaid') { G.bossT = G.t; G.slain[e.kind] = (G.slain[e.kind] || 0) + 1 }   // 랭킹 — 마지막 보스를 잡은 때 · 종류별 마리 수
  shake = e.mid ? 6 : 10; fx({ k: 'ring', x: e.x, y: e.y, R: e.mid ? 120 : 180, T: 0.6, col: '#ffd23f' }); fx({ k: 'flash', x: e.x, y: e.y - 40, R: e.mid ? 110 : 160, col: '#ffd23f', T: 0.6 })   // 먼저 — 세이렌이 떠오르며 사라지는 그림이 빛 위에 보이게
  if (e.kind === 'mermaid') say(guarded() ? tr`인어 격파!` : tr`세이렌의 보호막이 사라졌다!`, 2, '#7fd8ff')
  else if (e.kind === 'siren' && G.inf) {   // 무한 — 세이렌을 다 쓰러뜨려야 다음 단계(판은 이어진다)
    if (G.loop.lv) item(e.x + 26, e.y, 'guard', true)   // 냄비뚜껑 방패 — 한 명에 하나(0단계 첫 세이렌은 없음 · 기획)
    G.bosses++; G.loop.sirens++; const rest = (G.final?.sirens || []).filter(s => !s.dead)
    if (rest.length) { G.final.siren = rest[0]; progress(); say(tr`세이렌 격파! 남은 세이렌 ${rest.length}`, 2, '#ff9be0') }
    else { if (G.dark) fx({ k: 'bye', s: SPR.dark[0], x: G.dark.x, y: G.dark.y, T: 1.2 }); G.dark = null; stageClear(e) }
  } else if (e.kind === 'siren') {   // 클리어 — 남은 적은 모두 도망친다
    G.bosses++; G.won = 2.8; G.endKind = 'siren'; const v = e.angry ? SPR.sirenAngry : SPR[e.type]; fx({ k: 'bye', s: (e.fx < 0 ? v.L : v.R)[0], x: e.x, y: e.y, T: 1.6 }); if (G.dark) fx({ k: 'bye', s: SPR.dark[0], x: G.dark.x, y: G.dark.y, T: 1.2 }); G.dark = null; say(tr`세이렌 격파! 토벌 성공!`, 3, '#ffd23f')
    for (const f of G.foes) if (!f.dead) kill(f, true)
  } else if (e.mid) { say(tr`${B.name} 격파!`, 1.6, '#ffb35e'); G.rest = { name: tr`중간보스 ${B.name}`, at: G.t + 1.2 } }
  // 보통 보스 — 각성의 별(다 각성했으면 대신 보물상자) · 보물상자 · 잠옷이나 전지
  else { G.bosses++; if (G.inf && G.loop.lv) item(e.x + 26, e.y, 'guard', true); if (awCan().length > G.items.filter(i => i.k === 'awaken').length + G.queue.filter(q => q === 'awaken').length) item(e.x - 26, e.y, 'awaken'); else if (G.weapons.length >= 6 && G.weapons.every(w => G.aw.has(w.id))) item(e.x - 26, e.y, 'chest'); item(e.x, e.y, 'chest'); item(e.x + 26, e.y, rnd() < 0.5 ? 'pajama' : 'battery', true); say(tr`${B.name} 격파!`, 2.2, '#ffd23f'); G.rest = { name: B.name, at: G.t + 1.2 } }
}
/** 둘레 R 안 작은 적(보스 · 돌격대 빼고)을 밀쳐 낸다 — 세기 kb(밀리는 거리 ≈ kb / 9) */
function shove(R, kb) { near(pl.x, pl.y, R, e => { if (e.boss || e.rush) return; const [dx, dy] = toward(e); e.kx += dx * kb; e.ky += dy * kb }) }
/** 다침 — src: 때린 것(적 · 보스 · 날아온 것 · 장판, 또는 이름). 쓰러지면 G.killer 에 이름(익명 통계) */
function ouch(d, src, grow) {   // grow — 단계 · 시간마다 세지는 피해(냄비뚜껑 방패가 줄인다)
  if (pl.inv > 0 || G.dying || G.won) return
  G.hit0 ??= G.t   // 처음 맞은 때(업적 「스치지도 않았다」)
  d = Math.max(1, Math.round(d * (grow ? 1 - guardCut() : 1) * G.D.dmg * (stormHurts() ? STORM.hurt : 1) - S.armor)); pl.hp -= d; pl.inv = 0.8; pl.hurtT = 0.35; shake = Math.max(shake, 4); SND.hurt(G.ch.id)
  shove(80, 380)   // 맞으면 0.8초 무적 + 둘레를 밀쳐 빠져나갈 틈
  num(pl.x, pl.y - 48, d, 'hurt')
  if (pl.hp <= 0) fall(src)
}
function fall(src) { pl.hp = 0; G.dying = 1.2; G.killer = killerName(src); G.killerT = src?.kind || src?.type || null; say(tr`와아…`, 1.5, '#ff6b6b'); SND.voice(G.ch.id, 'cry') }   // 쓰러짐 — 맞아서 · 얼어서

// ---- 경험치 · 줍는 것
const GEM_MAX = 150
function gem(x, y, v) {
  if (G.gems.length >= GEM_MAX) {   // 바닥에 너무 많으면(그리기가 무거워서) 새로 만들지 않는다 — 가까운(60px) 보석에 더하고, 없으면 나에게서 가장 먼 보석을 이 자리로 옮겨 더한다(개수 · 경험치 그대로, 늘 처치한 자리에 보석)
    let near = null, nd = 3600, far = null, fd = -1   // 예전엔 「가장 가까운 보석」이 화면 밖이어도 거기에 더해서, 150개가 찬 뒤로 보석이 안 떨어지는 것처럼 보였다(사용자 · 2026-11-22). 끌려오는 것(자석)은 빼고
    for (const g of G.gems) { if (g.pull || g.dead) continue; const d = (g.x - x) ** 2 + (g.y - y) ** 2; if (d < nd) { nd = d; near = g } const q = (g.x - pl.x) ** 2 + (g.y - pl.y) ** 2; if (q > fd) { fd = q; far = g } }
    if (near) { near.v += v; return }
    if (far) { far.x = x + (rnd() - 0.5) * 8; far.y = y + (rnd() - 0.5) * 8; far.v += v; return }
  }
  G.gems.push({ x: x + (rnd() - 0.5) * 8, y: y + (rnd() - 0.5) * 8, v, pull: false, sp: 0 })
}
/** 줍는 것 — k: 종류 · 후보 { 종류: 무게 } · 없으면 정예 무작위(합 100). 소모 7종(ITEM_CAP)은 맵에 같은 종류 오니기리 5개(무한 3) · 그 밖 2개(무한 1)까지 —
 *  다 찼으면 후보 안 다른 것, 그것도 없으면 안 떨어뜨린다(맵 전체로 센다 — 화면 밖에 쌓아 두는 「주먹밥 저금」 막기 · 기획). force: 보스 보상(셈에는 들어가도 늘 떨어뜨림) */
// 냄비뚜껑 방패(무한 1단계부터 보스 · 세이렌 보상 — 기획) — 받는 피해 × 1 / (1 + LID × 주운 개수). 단계마다 세지는 피해(닿기 · 보스 몸 · 일반 적 탄)에만, 최대 체력 % 기술(pct)엔 안 건다
const LID = 0.03, guardCut = () => 1 - 1 / (1 + LID * (G.guardN || 0))
const ITEM_CAP = ['earplug', 'onigiri', 'magnet', 'momonga', 'firework', 'pajama', 'battery']
const itemFull = k => ITEM_CAP.includes(k) && G.items.reduce((n, i) => n + (i.k === k), 0) >= (k === 'onigiri' ? (G.inf ? 3 : 5) : G.inf ? 1 : 2)   // 오니기리 5(무한 3) · 그 밖 2(무한 1) — 사용자
function item(x, y, k = { earplug: G.t >= 600 ? 15 : 0, onigiri: G.t >= 600 ? 17 : 32, magnet: 16, momonga: 12, firework: 12, pajama: 14, battery: 14 }, force = false) {
  if (typeof k === 'object') { const ok = Object.entries(k).filter(([n, w]) => w > 0 && !itemFull(n)); let q = rnd() * ok.reduce((a, [, w]) => a + w, 0); k = (ok.find(([, w]) => (q -= w) < 0) || ok.at(-1))?.[0]; if (!k) return }
  else if (!force && itemFull(k)) return
  G.items.push({ x, y, k, t: 0 })
}
const USE = {
  onigiri: () => { const v = Math.round(S.maxHp * ONI()[1]); pl.hp = Math.min(S.maxHp, pl.hp + v); num(pl.x, pl.y - 48, `+${v}`, 'heal') },
  magnet: () => { for (const g of G.gems) g.pull = true; say(tr`자석 — 경험치를 다 모은다`, 1.2) },
  momonga: () => { G.freeze = 6; say(tr`모몽가의 귀여운 척! — 적이 멈췄다`, 1.6, '#ffc2e0') },
  firework: () => {
    fx({ k: 'white', T: 0.4 }); shake = 8; say(tr`펑! 펑!`, 1.2, '#ff6b6b'); SRC = 'firework'
    for (const e of G.foes) if (!e.dead && !e.rush && onScreen(e, 40)) { if (e.boss) hurt(e, 300 * S.might, pl.x, pl.y); else kill(e) }
  },
  chest: () => G.queue.push('chest'),
  guard: () => { G.guardN = (G.guardN || 0) + 1; G.guardT = G.t; fx({ k: 'ring', x: pl.x, y: pl.y - 20, R: 60, T: 0.4, col: '#9fd0ff' }); fx({ k: 'guard', T: 0.9 }) },   // 머리 위로 뚜껑 + 「받는 피해 −N%」(쌓인 합 · 배너는 안 띄운다 — 디자인)
  awaken: () => G.queue.push('awaken'),
  coinbox: () => {   // 떠돌이 보물상자 — LOOT 표대로
    let q = rnd() * 100, v = LOOT.at(-1)[0]
    for (const [k, w] of LOOT) if ((q -= w) < 0) { v = k; break }
    SND.chest()
    if (v === 'stone') { G.runStones++; G.gotRunStone = true; return say(tr`부활석 획득! (이번 판만)`, 2.8, '#9fe3ff') }
    G.found += v
    if (v < LOOT_JACK) return say(tr`보물상자 — 보상금 +${v}`, 1.8, '#ffd23f')
    SND.level(); shake = 10; fx({ k: 'white', T: 0.5 }); fx({ k: 'pillar', T: 1 }); fx({ k: 'ring', x: pl.x, y: pl.y, R: 240, T: 0.9, col: '#ffd23f' }); fx({ k: 'ring', x: pl.x, y: pl.y, R: 150, T: 0.6, col: '#ff9be0' })   // 잭팟 — 화려하게
    for (let i = 0; i < 48; i++) { const a = rnd() * TAU, sp = 120 + rnd() * 260; part(pl.x, pl.y - 20, Math.cos(a) * sp, Math.sin(a) * sp - 160, ['#ffd23f', '#ff9be0', '#ffffff', '#9fe3ff'][i % 4], 0.9 + rnd() * 0.5, 2.5 + rnd() * 2.5) }
    say(tr`대박!! 보상금 +${v.toLocaleString()}!`, 3.2, '#ffd23f')
  },
  pajama: () => summonHelp('pajama'),
  battery: () => summonHelp('leaf'),
  earplug: () => {
    if (Object.values(G.sts).some(t => t > G.t)) { G.sts = {}; say(tr`상태이상 해제!`, 1.4, '#7fd8ff') }
    else { const v = Math.round(S.maxHp * 0.15); pl.hp = Math.min(S.maxHp, pl.hp + v); num(pl.x, pl.y - 48, `+${v}`, 'heal') }
  },
}
// ---- 도와주는 친구들 — 아이템을 먹으면 잠깐 나타난다
/** 파자마 파티즈(10초 · 곁을 돌며 공연) · 한잎이와 두잎이(6초 · 손잡고 곁을 돌며 지켜 준다). 이미 있으면 시간만 다시 */
function summonHelp(k) {
  if (k === 'pajama') G.pj++
  const h = G.help.find(x => x.k === k)
  if (h) { h.t = 0; return }
  G.help.push(k === 'pajama' ? { k, t: 0, T: 10, a: 0, tick: 0.3, shot: 0, n: 0 } : { k, t: 0, T: 6, a: 0, hit: new Map() })
  say(k === 'pajama' ? tr`파자마 파티즈의 응원 공연! ♪` : tr`한잎이 · 두잎이가 지켜 줄게요!`, 2.2, k === 'pajama' ? '#ff9be0' : '#a6e07a')
}
const helpPos = (h, i) => { const a = h.k === 'pajama' ? h.a + i / 4 * TAU : h.a, r = h.k === 'pajama' ? 92 : 64; return [pl.x + Math.cos(a) * r, pl.y + Math.sin(a) * r * 0.8] }
function helpers(dt) {
  for (const h of G.help) {
    if ((h.t += dt) > h.T) { h.dead = true; continue }
    SRC = h.k === 'pajama' ? 'pajama' : 'battery'
    if (h.k === 'pajama') {   // 넓게 돌며 — 0.6초마다 넷이 음표 충격파(때리고 밀쳐 낸다), 돌아가며 가까운 적에게 음표를 쏜다
      h.a += dt * 2.6
      const D = (16 + G.t / 6) * S.might
      if ((h.tick -= dt) <= 0) {
        h.tick = 0.6
        for (let i = 0; i < 4; i++) { const [x, y] = helpPos(h, i); near(x, y, 64, e => { hurt(e, D, x, y, 180) }); fx({ k: 'ring', x, y, R: 64, T: 0.4, col: PJ[i].col }) }
      }
      if ((h.shot -= dt) <= 0) {   // 0.25초마다 한 명씩(한 명은 1초마다) — 2마리 꿰뚫는 음표
        h.shot = 0.25; const i = h.n = (h.n + 1) % 4, [x, y] = helpPos(h, i), e = closest(1, x, y, null, 380)[0], [dx, dy] = e ? toward(e, x, y) : [Math.cos(h.a + i / 4 * TAU), Math.sin(h.a + i / 4 * TAU)]
        G.shots.push({ src: SRC, k: 'ball', look: 'note', x, y, vx: dx * 430, vy: dy * 430, r: 11, dmg: D * 0.6, pierce: 2, kb: 90, life: 0.9, t: 0, hit: new Set() })
      }
    } else {   // 가장 가까운 다가오는 것(없으면 가까운 적) 쪽으로 빠르게 돌아 서서 막고, 닿은 적은 세게 밀쳐 낸다
      const T = incoming(450) || closest(1, pl.x, pl.y, null, 450)[0]
      if (T) { const da = ((Math.atan2((T.y - pl.y) / 0.8, T.x - pl.x) - h.a) % TAU + TAU * 1.5) % TAU - Math.PI; h.a += Math.sign(da) * Math.min(Math.abs(da), dt * 12) }
      else h.a += dt * 2
      const [x, y] = helpPos(h, 0), D = (18 + G.t / 6) * S.might
      near(x, y, 36, e => { const t = h.hit.get(e); if (t === undefined || G.t - t > 0.25) { h.hit.set(e, G.t); hurt(e, D, x, y, 320) } })
      for (const b of G.eshots) if (!b.dead && (b.x - x) ** 2 + (b.y - y) ** 2 < 40 * 40) { b.dead = true; fx({ k: 'flash', x: b.x, y: b.y - 14, R: 18, col: '#c8f0a8', T: 0.25 }) }
    }
  }
  prune(G.help)
}
// ---- 검은 별똥별 — 29분까지 세이렌을 못 쓰러뜨리면 나타나 끝까지 쫓아온다. G.foes 밖이라 스킬 · 폭죽에 안 맞는다(쓰러뜨릴 수 없다)
function darkStep(dt) {
  if (!G.dark) {
    if (G.inf ? !(G.final && G.t - G.final.at >= INF.dark) : G.t < DARK_T) return   // 무한 — 세이렌이 나온 뒤 · 페이즈를 넘긴 뒤 3분 동안 못 넘기면(progress)
    const a = rnd() * TAU, R = Math.max(VW, VH) * 0.6
    G.dark = { x: pl.x + Math.cos(a) * R, y: pl.y + Math.sin(a) * R, t: 0, cd: 3 }
    say(G.inf ? tr`검은 별똥별! 세이렌 페이즈를 넘기면 물러나요` : tr`검은 별똥별! 쓰러뜨릴 수 없어요 — 30:00까지 도망쳐!`, 3.2, '#c9b3ff'); shake = 10; SND.dark()
    return
  }
  const D = G.dark, [dx, dy] = toward(pl, D.x, D.y), sp = 118 + D.t * 0.6   // 점점 빨라진다(30분엔 거의 내 속도) — 무한도 끝없이(못 잡으면 결국 따라잡힌다 · 판이 끝나는 자리)
  D.t += dt
  if (G.freeze <= 0) { D.x += dx * sp * dt; D.y += dy * sp * dt }
  if ((D.x - pl.x) ** 2 + (D.y - pl.y) ** 2 < (pl.r + 16) ** 2) ouch(pct(0.3), tr`검은 별똥별`)
  if ((D.cd -= dt) <= 0) {   // 3초마다 별 조각을 사방으로
    D.cd = 3
    for (let i = 0; i < 10; i++) { const q = i / 10 * TAU + rnd() * 0.3; G.eshots.push({ k: 'shard', x: D.x, y: D.y, vx: Math.cos(q) * 160, vy: Math.sin(q) * 160, t: 0, life: 3, dmg: pct(0.08), r: 6 }) }
    fx({ k: 'ring', x: D.x, y: D.y, R: 60, T: 0.5, col: '#8f6bdc' })
  }
}
function gainXp(v) {
  SND.gem(); G.xp += v * S.growth * G.D.xp
  while (G.xp >= G.next) { G.xp -= G.next; G.lvl++; G.next = need(G.lvl); G.queue.push('level') }
}

// ---- 한 프레임
function step(dt) {
  G.t += dt
  const dead = G.dying > 0
  if (dead && (G.dying -= dt / 0.3) <= 0) return canRevive() ? askRevive() : finish(false)   // 쓰러지는 동안은 느린 화면(dt 는 0.3배로 들어온다)
  if (G.won && (G.won -= dt) <= 0) return finish(true)
  if (G.t >= END_T && !dead && !G.won && !G.inf) { G.endKind = 'time'; return finish(true) }   // 30분 — 검은 별똥별에게서 끝까지 도망쳤다
  // 나
  let mx = key.r - key.l + joy.x, my = key.d - key.u + joy.y
  const m = Math.hypot(mx, my)
  pl.moving = m > 0.12 && !dead
  let vx = 0, vy = 0
  if (pl.moving) {
    pl.face = [mx / m, my / m]
    if (m > 1) { mx /= m; my /= m }
    if (Math.abs(mx) > 0.2) pl.fx = mx > 0 ? 1 : -1
    const sp = 150 * S.move * (sick('charm') ? 0.6 : 1) * (pl.slowT > 0 ? 0.65 : 1)   // 매혹 · 기름 그물
    vx = mx * sp; vy = my * sp
  }
  G.slip = !dead && onIce()   // 눈보라에 쌓인 눈 위 — 손을 늦게 먹고, 손을 떼도 주르륵 미끄러진다
  if (G.slip) { const a = Math.min(1, dt * 1.6); pl.vx += (vx - pl.vx) * a; pl.vy += (vy - pl.vy) * a } else { pl.vx = vx; pl.vy = vy }
  pl.x += pl.vx * dt; pl.y += pl.vy * dt
  if (G.winter) winter(dt, dead)
  const siren = alive(G.final?.siren)
  if (siren && sick('charm') && !dead) { const [dx, dy] = toward(siren); pl.x += dx * 55 * dt; pl.y += dy * 55 * dt }   // 매혹 — 세이렌 쪽으로 끌려간다
  if (!dead && !G.won && Math.hypot(pl.x - G.anchor[0], pl.y - G.anchor[1]) > WANDER.d && G.t - G.lastBox > WANDER.gap && !G.items.some(i => i.k === 'coinbox')) {   // 떠돌이 보물상자 — 멀리 돌아다닐 때만(제자리 · 작은 원으로 맴돌면 안 나온다). 다 찼는데 쿨타임 · 바닥에 있으면 찬 채로 기다린다(HUD 고리)
    G.anchor = [pl.x, pl.y]
    {
      const R = Math.min(VW, VH) * 0.36, x = pl.x + pl.face[0] * R, y = pl.y + pl.face[1] * R
      G.lastBox = G.t; item(x, y, 'coinbox'); fx({ k: 'ring', x, y, R: 40, T: 0.6, col: '#ffd23f' }); fx({ k: 'text', x, y: y - 40, s: tr`보물상자!`, col: '#ffd23f', T: 1.2 })
    }
  }
  pl.inv -= dt; pl.hurtT -= dt; pl.slowT -= dt; pl.jump = Math.max(0, pl.jump - dt)
  if (!dead) pl.hp = Math.min(S.maxHp, pl.hp + S.regen * dt)
  G.freeze = Math.max(0, G.freeze - dt)
  cam.x += (pl.x - cam.x) * Math.min(1, dt * 8); cam.y += (pl.y - cam.y) * Math.min(1, dt * 8)
  regrid()
  if (!dead && !G.won) { spawner(dt); weapons(dt) }
  SRC = null; foes(dt)   // 적이 만든 효과에 스킬 스킨이 묻지 않게
  shots(dt); SRC = null
  if (!dead && !G.won) { helpers(dt); darkStep(dt) }
  // 바닥 경고 — 원이 다 차면 터지고(안에 있으면 맞는다), 돌격대는 줄지어 나온다
  for (const z of G.haz) {
    if (z.k === 'pool') {   // 눈물 웅덩이 — 아프지 않고 느려지기만(복어 그물과 같은 느려짐)
      if ((z.t += dt) >= z.T) z.dead = true
      else if (((pl.x - z.x) / z.R) ** 2 + ((pl.y - z.y) / (z.R * 0.8)) ** 2 < 1) { if (pl.slowT <= 0) fx({ k: 'text', x: pl.x, y: pl.y - 50, s: tr`첨벙!`, col: '#4a86e8', T: 0.6 }); pl.slowT = Math.max(pl.slowT, 0.2) }
      continue
    }
    if (z.k === 'fence') { if ((z.t += dt) >= z.T) z.dead = true; continue }   // 음표 울타리 — 빈틈 그림만(맞는 것은 음표)
    if (z.k === 'tide') {   // 큰 파도 — 앞머리가 지나가는 동안 띠 안이고 빈틈 밖이면 한 번 맞는다(빈틈은 그린 초록 줄과 똑같이)
      if ((z.t += dt) >= z.T) z.dead = true
      else if (z.t > 1.2 && !z.hit) { const p = z.from + z.dir * 240 * (z.t - 1.2), q = ((z.horiz ? pl.x : pl.y) - p) * z.dir; if (q <= 0 && q > -80 && Math.abs((z.horiz ? pl.y : pl.x) - z.gap) >= 70) { z.hit = true; ouch(z.dmg, z) } }
      continue
    }
    if (z.k === 'duel' && z.swap && !z.swapped && z.t + dt >= 1.1) {   // 무한 1단계부터 — 정답 자리가 한 번 바뀐다(원 셋이 한 칸씩 돌아 다시 표시)
      const P = z.opts.map(o => [o.x, o.y]); z.opts.forEach((o, i) => { [o.x, o.y] = P[(i + 1) % P.length] }); z.swapped = true
      for (const o of z.opts) fx({ k: 'puff', x: o.x, y: o.y, R: 62, T: 0.4 })   // 옮긴 자리를 하얗게 번쩍
    }
    if ((z.t += dt) < z.T) continue
    z.dead = true
    if (z.k === 'rush') { rushNow(z); continue }
    if (z.k === 'band') { bandNow(z); continue }
    const safe = z.k === 'duel' && z.opts.some(o => o.hand === z.win && ((pl.x - o.x) / 70) ** 2 + ((pl.y - o.y) / 56) ** 2 < 1)
    if (!safe && ((pl.x - z.x) / (z.R + 4)) ** 2 + ((pl.y - z.y) / ((z.R + 4) * 0.8)) ** 2 < 1) ouch(z.dmg, z)
    if (z.k === 'duel') fx({ k: 'duel', opts: z.opts, win: z.win, T: 0.4 })   // 정답 원은 초록, 나머지는 빨강으로 번쩍 — 다음에 배울 수 있게
    if (z.tear) G.haz.push({ k: 'pool', x: z.x, y: z.y, R: z.R, t: 0, T: 4 })
    fx({ k: 'ring', x: z.x, y: z.y, R: z.R, T: 0.4, col: z.col }); fx({ k: 'boom', x: z.x, y: z.y, R: z.R * 0.9, col: z.col, T: 0.35 })
    for (let i = 0; i < 8; i++) { const a = rnd() * TAU; part(z.x, z.y, Math.cos(a) * 160, Math.sin(a) * 90 - 80, i % 2 ? z.col : '#fff', 0.35, 2.6) }
    shake = Math.max(shake, z.k === 'land' ? 8 : 4)
  }
  for (const b of G.eshots) {   // 날아오는 것 — 피하거나 각성 스킬 · 한잎이 두잎이로 막기
    if (b.dead) continue
    b.t += dt
    if (G.freeze <= 0) { if (b.wait > 0) b.wait -= dt; else { b.x += b.vx * dt; b.y += b.vy * dt } }   // wait — 음표 울타리: 멈춰 반짝이다가 모인다
    if ((b.x - pl.x) ** 2 + (b.y - pl.y) ** 2 < (pl.r + b.r) ** 2) { ouch(b.dmg, b, b.grow); b.dead = true; if (b.slow) { pl.slowT = Math.max(pl.slowT, b.slow); fx({ k: 'text', x: pl.x, y: pl.y - 50, s: tr`끈적!`, col: '#f2c94c', T: 0.6 }) } }
    if (b.t > b.life) b.dead = true
  }
  for (const g of G.gems) {   // 경험치 · 아이템 줍기
    const dx = pl.x - g.x, dy = pl.y - g.y, d = Math.hypot(dx, dy) || 1
    if (g.pull || d < S.magnet) { g.pull = true; g.sp = Math.min(1000, g.sp + 1620 * dt); const s = Math.min(d, g.sp * dt); g.x += dx / d * s; g.y += dy / d * s }
    if (d < pl.r + 8 && !dead) { g.dead = true; gainXp(g.v) }
  }
  for (const it of G.items) { it.t += dt; if (it.k === 'coinbox' && it.t > WANDER.life) { it.dead = true; continue } if (!dead && (it.x - pl.x) ** 2 + (it.y - pl.y) ** 2 < (pl.r + 16) ** 2) { it.dead = true; USE[it.k](); fx({ k: 'flash', x: pl.x, y: pl.y - 20, R: 70, col: '#ffffff', T: 0.35 }) } }
  // 효과
  for (const p of G.parts) { p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 260 * dt; p.vx *= 0.97; if (p.t > p.T) p.dead = true }
  if (!LQ) { cfxStep(G.cfx, G.dying ? null : G.ofx, pl.x, pl.y, dt); cfxStep(G.wfx, G.dying ? null : G.wsx, pl.x, pl.y, dt, pl.fx) }   // 의상 이펙트 · 무기 스킨 반짝이(가벼운 화질이면 빼기 — 보이기만)
  cfxStep(G.sfx, null, 0, 0, dt)   // 스킬 스킨 반짝이
  for (const f of G.fx) {
    f.t += dt; if (f.t > f.T) f.dead = true
    if (f.k === 'wave' && !f.done && !dead && Math.hypot(pl.x - f.x, (pl.y - f.y) / 0.8) <= f.R * Math.min(1, f.t / f.T)) { f.done = true; afflict(f.st) }   // 상태이상 물결이 나에게 닿으면
  }
  for (const n of G.nums) { n.t += dt; if (n.t > 0.7) n.dead = true }
  if (G.banner && (G.banner.t += dt) > G.banner.T) G.banner = null
  if (G.tip && (G.tip.t += dt) > G.tip.T) G.tip = null
  shake = Math.max(0, shake - dt * 30)
  for (const a of [G.foes, G.shots, G.eshots, G.gems, G.items, G.parts, G.fx, G.nums, G.haz]) prune(a)
  sortY(G.foes)
  if (G.queue.length && !dead && !G.won) openBox()
  else if (G.rest && G.t >= G.rest.at && !dead && !G.won) rest()
}
function prune(a) { let j = 0; for (const x of a) if (!x.dead) a[j++] = x; a.length = j }
function sortY(a) { for (let i = 1; i < a.length; i++) { const e = a[i]; let j = i - 1; while (j >= 0 && a[j].y > e.y) { a[j + 1] = a[j]; j-- } a[j + 1] = e } }

function shots(dt) {
  for (const b of G.shots) {
    b.t += dt; SRC = b.src
    if (G.sk[b.src]) skTrail(b, G.sk[b.src], dt)   // 스킬 스킨 — 날아가는 것은 꼬리 · 반짝이, 바닥 스킬은 장판 안에서 반짝이
    switch (b.k) {
      case 'ball':   // 사스마타(꿰뚫는다) · 건배(옆 적에게 튕겨 간다)
        b.x += b.vx * dt; b.y += b.vy * dt
        if (b.t > b.life) { b.dead = true; break }
        parryIn(b.x, b.y, b.r)
        near(b.x, b.y, b.r, e => {
          if (b.hit.has(e)) return
          b.hit.add(e); hurt(e, b.dmg, b.x - b.vx * 0.05, b.y - b.vy * 0.05, b.kb)
          if (b.bounce > 0) {
            const n = closest(1, e.x, e.y, b.hit, 300)[0]
            if (n) { b.bounce--; const v = Math.hypot(b.vx, b.vy), [dx, dy] = toward(n, b.x, b.y); b.vx = dx * v; b.vy = dy * v; b.t = 0; b.life = 0.8; return true }
          }
          if (--b.pierce <= 0) { b.dead = true; return true }
        })
        break
      case 'arc': {   // 눈물 — 포물선, 떨어진 자리 스플래시
        const u = b.u = Math.min(1, b.t / b.T); b.x = b.x0 + (b.x1 - b.x0) * u; b.y = b.y0 + (b.y1 - b.y0) * u
        if (u >= 1) { splash(b.x1, b.y1, b.R, b.dmg, '#7cc8ff'); parryIn(b.x1, b.y1, b.R); b.dead = true }
        break
      }
      case 'drop':   // 풀뽑기 — 표시가 다 차면 뽑힌다
        if (b.t >= b.T) { splash(b.x, b.y, b.R, b.dmg, '#8fd16a'); parryIn(b.x, b.y, b.R); fx({ k: 'sprout', x: b.x, y: b.y, R: b.R, T: 0.5 }); shake = Math.max(shake, 3); b.dead = true }
        break
      case 'pile':   // 헌책 더미 — 적이 닿으면 기우뚱, 0.25초 뒤 와르르(둘레 피해)
        if (!b.fall) { if (b.t > b.life) { b.dead = true; break } parryIn(b.x, b.y - 10, 24); near(b.x, b.y, 14, () => { b.fall = b.t; return true }) }
        else if (b.t - b.fall >= 0.25) { splash(b.x, b.y, b.R, b.dmg, '#8fd14f'); fx({ k: 'text', x: b.x, y: b.y - 34, s: tr`와르르!`, col: '#c9f08a', T: 0.6 }); shake = Math.max(shake, 2); b.dead = true }
        break
      case 'pot':   // 카레 냄비 — 1초 뒤 매운 폭발(인어 · 세이렌에게 1.5배)
        if (b.t >= b.T) { splash(b.x, b.y, b.R, b.dmg, '#e8b02a', 1.5); parryIn(b.x, b.y, b.R); fx({ k: 'text', x: b.x, y: b.y - 34, s: tr`맵다!`, col: '#ffcf4a', T: 0.6 }); shake = Math.max(shake, 3); b.dead = true }
        break
      case 'ring': {   // 야하! 충격파 — 반지름이 커지며 닿은 적을 한 번씩
        if (b.t < 0) { b.x = pl.x; b.y = pl.y; break }
        if (!b.boom) {
          b.boom = true; shake = Math.max(shake, 6)
          for (let i = 0; i < 14; i++) { const a = i / 14 * TAU; part(b.x, b.y, Math.cos(a) * 220, Math.sin(a) * 120 - 40, '#d9c4a0', 0.4, 3) }
          fx({ k: 'text', x: b.x, y: b.y - 60, s: tr`야하!`, col: '#ffd23f', T: 0.8 })
        }
        const R = b.R * Math.min(1, b.t / b.T)
        parryIn(b.x, b.y, R)
        near(b.x, b.y, R, e => { if (!b.hit.has(e)) { b.hit.add(e); hurt(e, b.dmg, b.x, b.y, 220) } })
        if (b.t > b.T + 0.18) b.dead = true
        break
      }
      case 'orb': {   // 기타 음표
        const a = b.w.ang + b.i / b.n * TAU
        b.x = pl.x + Math.cos(a) * b.R; b.y = pl.y + Math.sin(a) * b.R * 0.85
        if ((b.life -= dt) <= 0) { b.dead = true; break }
        parryIn(b.x, b.y, b.r + 4)
        near(b.x, b.y, b.r, e => { const t = b.hit.get(e); if (t === undefined || G.t - t > 0.45) { b.hit.set(e, G.t); hurt(e, b.dmg, pl.x, pl.y, 190) } })
        break
      }
      case 'boom':   // 포셰트 — 갔다가 돌아온다
        b.v += b.acc * dt; b.x += b.dx * b.v * dt; b.y += b.dy * b.v * dt; b.a += dt * 12
        if (b.t > b.life) { b.dead = true; break }
        parryIn(b.x, b.y, b.r)
        near(b.x, b.y, b.r, e => { const t = b.hit.get(e); if (t === undefined || G.t - t > 0.5) { b.hit.set(e, G.t); hurt(e, b.dmg, b.x - b.dx * Math.sign(b.v), b.y - b.dy * Math.sign(b.v), 70) } })
        break
      case 'zone':   // 라멘 국물 — 밟은 적을 느리게 하고 데운다
        if ((b.tick -= dt) <= 0) { b.tick = 0.3; near(b.x, b.y, b.R, e => { hurt(e, b.dmg, b.x, b.y, 0); slow(e, 0.4, 0.5) }) }
        parryIn(b.x, b.y, b.R)
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
  const fill = id => out.length < 3 && !out.some(o => o.id === id) && out.push({ t: 'f', id })   // 더 올릴 게 없으면 갈림길 — 오니기리 · 응원 한 장씩(같은 카드 두 장은 안 준다)
  fill('onigiri'); if (G.cheer < cheerMax()) fill('cheer')
  return out
}
const cheerMax = () => G.inf ? Infinity : 25   // 응원 한도(번) — 무한은 끝없이(적도 단계마다 세진다)
function label(o) {
  if (o.t === 'a') { const a = AW[o.id]; return { name: a.name, lv: tr`각성 · ${WEAP[o.id].name} Lv 8 → ★`, note: `${upText(a.up)} · ${a.note}` } }
  if (o.t === 'f' && o.id === 'cheer') return { name: FILL.cheer.name, lv: tr`Lv ${G.cheer} → ${G.cheer + 1} · 보너스`, note: G.inf ? tr`공격력 +${G.cheer * 2}% → +${G.cheer * 2 + 2}%` : tr`공격력 +${G.cheer * 2}% → +${G.cheer * 2 + 2}% · 최대 +50%` }   // 지금 단계 → 다음(무한은 한도 없음)
  if (o.t === 'f') { const p = Math.round(pl.hp / S.maxHp * 100); return { name: FILL.onigiri.name, lv: tr`보너스`, note: [tr`체력 ${Math.round(ONI()[0] * 100)}% 회복 · `, h('span', { class: p <= 40 ? 'low' : '' }, tr`지금 ${p}%`)] } }   // 지금 체력 — 40% 이하면 빨강
  if (o.t === 'w') { const w = G.weapons.find(x => x.id === o.id), d = WEAP[o.id]; return { name: d.name, ...(w ? { lv: `Lv ${w.lv} → ${w.lv + 1} · ${d.how}`, note: Object.entries(d.ups[w.lv - 1]).map(([k, v]) => UP[k](v)).join(' · ') } : { lv: tr`새 스킬 · ${d.how}`, note: d.note }) } }
  const lv = G.passives[o.id], p = PASS[o.id]; return { name: p.name, lv: lv ? `Lv ${lv} → ${lv + 1}` : tr`새 아이템`, note: p.note }
}
function take(o) {
  guardIn()
  if (o.t === 'a') awaken(o.id)
  else if (o.t === 'w') { const w = G.weapons.find(x => x.id === o.id); if (w) { w.lv++; w.st = wstat(w) } else addWeapon(o.id) }
  else if (o.t === 'p') { G.passives[o.id] = (G.passives[o.id] || 0) + 1; stats() }
  else if (o.id === 'onigiri') pl.hp = Math.min(S.maxHp, pl.hp + S.maxHp * ONI()[0])
  else { G.cheer++; stats() }
  guardOut()
}
/** 새 스킬 카드 아래 — 내가 가진 스킬의 짝일 때만 시너지 이름 · 효과(짝이 없으면 아무것도 안 붙인다) */
function synCard(o) {
  if (o.t !== 'w' || G.weapons.some(w => w.id === o.id)) return null
  const m = mateOf(o.id)
  if (!G.weapons.some(w => w.id === m)) return null
  const s = synOf(o.id)
  return h('div', { class: 'syn' }, h('mark', {}, tr`시너지`), tr` 「${s[0]}」 · 내 `, ic(m), tr` ${WEAP[m].name}의 짝`, h('br'), synText(s))
}
function awaken(id) { const w = G.weapons.find(x => x.id === id); G.aw.add(id); w.st = wstat(w); say(tr`각성 — 「${AW[id].name}」!`, 2.6, '#ff9be0') }
/** 아직 각성 안 한 Lv 8 스킬 · 각성 상자 카드(그중 셋까지 무작위) */
const awCan = () => G.weapons.filter(w => w.lv >= 8 && !G.aw.has(w.id))
function awOffers() { const c = awCan(), out = []; while (out.length < 3 && c.length) out.push({ t: 'a', id: c.splice(rnd() * c.length | 0, 1)[0].id }); return out }
const owned = o => o.t === 'w' && G.weapons.some(w => w.id === o.id)   // 가진 스킬 — 제외 못 한다
let BOX = null
const ACTS = [['rr', tr`리롤`], ['skips', tr`스킵`], ['bans', tr`제외`]]
/** 작전대로 자동 선택(진짜 판 · 사용자 결정 · 기획 2026-11-20) — 캐릭터 고르기 · 일시정지의 토글(기기에 기억 — mjg.sim auto). 그 캐릭터의 작전(모의 토벌 작전 짜기)이 있어야 켜진다
 *  목록 = 작전 무기 · 보조 순서 + 이미 가진 것(작전 밖은 목록 끝 — 직접 골랐거나 상자에서 받은 것). 목록에 있는 것을 순서대로 → 없으면 리롤 → 제외(목록 밖 새 카드 하나) → 스킵
 *  셋 다 없으면 멈추고 평소 창(위에 한 줄 — 직접 고른 것은 가진 것이 되어 다음부터 목록 끝). 목록 밖 새 스킬은 자동으로 받지 않는다(작전 밖은 늘 사람이)
 *  각성 상자는 목록 순서, 보물상자 · 잭팟은 다 받기, 다 키운 뒤 채움(오니기리 · 응원)은 체력으로. 창 없이 이어 가고 짧게 알린다(autoSay). 랭킹 · 업적 · 보상금은 평소와 같다 */
const autoPlan = id => { const p = simStore().plans?.[id]; return p && (p.w?.length || p.p?.length) ? p : null }
const autoOn = () => !!(G && !SIM && simStore().auto && autoPlan(G.ch.id))
function autoList() {   // 'w' / 'p' + id — 작전 순서, 그 뒤에 가진 것(작전 밖)
  const p = autoPlan(G.ch.id), L = [G.ch.w, ...(p.w || [])].filter(id => WEAP[id]).map(id => 'w' + id).concat((p.p || []).filter(id => PASS[id]).map(id => 'p' + id))
  for (const w of G.weapons) if (!L.includes('w' + w.id)) L.push('w' + w.id)
  for (const id in G.passives) if (!L.includes('p' + id)) L.push('p' + id)
  return [...new Set(L)]
}
function autoBox(box, aw, jack) {   // true — 골랐다(창 없이). false — 못 골라 평소 창(box.why)
  guardOut()   // step 안 — 지금을 봉인해 두고 take 가 재 보고 바꾼다(봉인 어긋남 신고가 나지 않게)
  const nm = o => o.t === 'w' ? `${WEAP[o.id].name} Lv ${(G.weapons.find(w => w.id === o.id)?.lv || 0) + 1}` : o.t === 'p' ? `${PASS[o.id].name} Lv ${(G.passives[o.id] || 0) + 1}` : o.t === 'a' ? AW[o.id].name : FILL[o.id].name, say1 = o => autoSay(nm(o), o.t === 'a' ? 'awaken' : o.id)
  if (jack) { box.opts.forEach(take); autoSay(tr`잭팟 — 다 받기`, 'chest'); return true }
  const L = autoList(), at = o => L.indexOf(o.t + o.id)
  for (;;) {
    const inList = box.opts.filter(o => at(o) >= 0).sort((a, b) => at(a) - at(b))
    if (inList.length) { const o = inList[0]; say1(o); take(o); return true }
    if (aw) { say1(box.opts[0]); take(box.opts[0]); return true }   // 각성은 가진 스킬뿐이라 늘 목록 안 — 안전망
    const left = L.some(k => { const t = k[0], id = k.slice(1); return t === 'w' ? (G.weapons.find(w => w.id === id)?.lv ?? 0) < 8 && (G.weapons.some(w => w.id === id) || G.weapons.length < 6) && !G.banned.has(k) : (G.passives[id] ?? 0) < PASS[id].max && (id in G.passives || Object.keys(G.passives).length < 6) && !G.banned.has(k) })
    const fill = box.opts.filter(o => o.t === 'f')
    if (!left && fill.length) { const o = fill.find(o => o.id === 'onigiri' && pl.hp < S.maxHp * 0.6) || fill.find(o => o.id !== 'onigiri') || fill[0]; say1(o); take(o); return true }   // 다 키웠다 — 채움
    if (G.rr > 0) { G.rr--; box.opts = offers(); autoSay(tr`리롤`); continue }
    const off = box.opts.findIndex(o => o.t !== 'f' && !owned(o))
    if (G.bans > 0 && off >= 0) { const o = box.opts[off]; G.bans--; G.banned.add(o.t + o.id); box.opts = offers(box.opts.filter(x => x !== o)); box.opts.splice(off, 0, box.opts.pop()); autoSay(tr`제외`); continue }
    if (G.skips > 0) { G.skips--; autoSay(tr`스킵`); return true }
    box.why = true; return false
  }
}
/** 자동 알림 — 배너 말고 아래 작은 띠(모의 토벌 관전 띠와 같은 모양 · 꼬리표 「자동」). 몰리면 마지막 것으로 바꿔 끼우고, 1.5초(실제 시간) 뒤 사라진다. 판이 아닐 때는 숨김(frame) */
const AUTOB = h('div', { class: 'spec auto-band', hidden: true }, h('div', { class: 'spec-pick', 'aria-live': 'polite' }))
document.body.append(AUTOB)
function autoSay(s, id) {
  const el = AUTOB.firstChild; el.replaceChildren(h('span', { class: 'ai' }, tr`자동`), (id && icSafe(id)) || '', h('span', { class: 'what' }, s))
  el.classList.remove('new'); void el.offsetWidth; el.classList.add('new'); AUTOB.at = performance.now()
}
/** 스위치 — 캐릭터 고르기(chars: 지금 고른 캐릭터) · 일시정지(그 판 캐릭터). 작전이 없으면 흐리게: 고르기에서는 눌렀을 때 난이도 설명 줄을 3초 바꾸고, 일시정지는 밑에 늘 작은 글 */
function autoSwitch(chars) {
  const inp = h('input', { type: 'checkbox', role: 'switch', onchange: () => simKeep({ ...simStore(), auto: inp.checked ? 1 : 0 }) })
  const lab = h('label', { class: 'sw', onclick: () => { if (!inp.disabled || !chars) return; const n = ui.querySelector('.diff-note span.on'); if (!n || n.dataset.was) return; n.dataset.was = n.textContent; n.textContent = tr`작전 짜기에서 순서를 먼저 정해 주세요`; n.classList.add('warn'); setTimeout(() => { n.textContent = n.dataset.was; delete n.dataset.was; n.classList.remove('warn') }, 3000) } }, inp, h('span', {}, tr`작전대로 자동 선택`))
  const sync = () => { const ok = !!autoPlan(chars ? CHARS[pickCi].id : G.ch.id); inp.disabled = !ok; inp.checked = ok && !!simStore().auto }
  sync(); if (chars) AUTOSYNC = sync
  return chars ? lab : h('div', { class: 'sw-row' }, lab, !autoPlan(G.ch.id) && h('p', { class: 'sw-hint' }, tr`작전 짜기에서 순서를 먼저 정해 주세요`))
}
let AUTOSYNC = null
const autoSync = () => AUTOSYNC?.()
function openBox() {
  if (SIM) return simBox()
  const kind = G.queue.shift(), chest = kind === 'chest', aw = kind === 'awaken'   // aw — 각성 상자: 잭팟 · 스킵 · 제외 없이 리롤만(G.arr, 레벨 업 상자와 따로)
  if (aw && !awCan().length) return next()
  if (kind === 'level') { const v = Math.round(S.maxHp * 0.1); pl.hp = Math.min(S.maxHp, pl.hp + v); num(pl.x, pl.y - 48, `+${v}`, 'heal'); guardOut() }   // 레벨 업 — 체력 10% 회복
  chest || aw ? SND.chest() : SND.level(); SND.voice(G.ch.id, 'happy')
  const jack = !aw && rnd() < (chest ? 0.5 : 0.01 * S.luck * (G.ch.mod.jackpot ? 2 : 1))   // 잭팟 — 셋 다 받는다. 레벨 업 1%(행운 배수 · 하치와레 2배), 보물상자 50%
  const box = BOX = { opts: aw ? awOffers() : offers(), jack, ready: false, ban: false }, acts = aw ? ACTS.slice(0, 1) : ACTS, cnt = k => aw ? 'arr' : k
  if (jack) G.jackpots++
  if (autoOn() && autoBox(box, aw, jack)) return next()   // 작전대로 자동 — 창 없이 이어 간다
  mode = 'box'; calm(); pauseBtn.hidden = true; still = 2
  const cards = h('div', { class: 'cards' }), hint = h('p', { class: 'hint' })
  const btns = acts.map(([k, s], j) => h('button', { type: 'button', class: 'btn act', onclick: () => act(k) }, s, h('em'), h('kbd', {}, j + 4)))
  const takeBtn = jack && h('button', { type: 'button', class: 'btn main', onclick: () => act('take') }, h('span'), h('kbd', {}, 'Enter'))
  const root = h('div', { class: `panel box${jack ? ' jackpot' : ''}${aw ? ' awaken' : ''}` },
    h('p', { class: 'box-title' }, aw ? [ic('awaken'), tr` 각성!`] : chest ? [ic('chest'), tr` 보물상자!`] : `LEVEL UP! Lv ${G.lvl - G.queue.filter(q => q === 'level').length}`),
    jack && h('p', { class: 'jack' }, 'JACKPOT!!'), box.why && h('p', { class: 'lvl-note' }, h('b', {}, tr`작전에 있는 스킬이 나오지 않았어요`), tr`새로 나온 것 중에서 직접 골라 주세요`), cards, hint, h('div', { class: 'row' }, takeBtn, btns))
  const card = (o, i) => { const L = label(o), syn = synCard(o); return h('button', { type: 'button', class: `card ${o.t}${syn ? ' synergy' : ''}${box.ban && owned(o) ? ' keep' : ''}`, style: `--i:${i}`, onclick: () => pick(i) }, h('span', { class: 'ic' }, ic(o.id)), h('small', {}, o.t === 'w' && PROJ.has(o.id) && h('mark', { class: 'proj lead' }, tr`투사체`), L.lv), h('b', {}, L.name), h('span', { class: 'note' }, o.id === 'double' && o.t === 'p' ? [h('mark', { class: 'proj' }, tr`투사체`), ' ', tr`스킬 개수 +1`] : L.note), syn, h('kbd', {}, i + 1)) }
  const sync = () => {
    cards.replaceChildren(...box.opts.map(card)); root.classList.toggle('banning', box.ban)
    hint.textContent = aw ? tr`Lv 8 스킬 하나를 각성시켜요 — 스킵 · 제외는 없어요${awCan().length > 3 ? tr` (리롤로 다른 스킬도)` : ''}` : box.ban ? tr`이번 판에서 뺄 카드를 고르세요 — 가진 스킬은 못 빼요 (제외를 다시 누르면 취소)` : jack ? (box.opts.length === 3 ? tr`셋 다 가져요!` : tr`다 가져요!`) : tr`하나를 고르세요`
    if (takeBtn) takeBtn.firstChild.textContent = box.opts.length === 3 ? tr`셋 다 받기` : tr`다 받기`   // 갈림길(두 장 · 한 장)이면 「다」
    btns.forEach((b, j) => { const k = cnt(acts[j][0]); b.querySelector('em').textContent = G[k]; b.disabled = !G[k] || aw && awCan().length <= 3; b.classList.toggle('on', box.ban && k === 'bans') })
  }
  function pick(i) {
    const o = box.opts[i]
    if (!o || !box.ready || BOX !== box) return
    if (box.ban) {   // 제외 — 이번 판에서 안 나오고, 그 자리에 새 카드
      if (o.t === 'f' || owned(o)) return
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
    if (aw) { if (k !== 'rr' || !G.arr || awCan().length <= 3) return; G.arr--; box.opts = awOffers(); sync(); return aim() }
    if (!G[k]) return
    if (k === 'bans') { box.ban = !box.ban; return sync() }
    G[k]--
    if (k === 'skips') return next()
    box.opts = offers(); box.ban = false; sync()   // 리롤 — 셋 다 새로
  }
  const aim = () => aw && cards.querySelector('.card')?.focus({ preventScroll: true })   // 각성 상자 — 첫 카드를 골라 두어 Enter · Space 로 받는다(Tab 으로 옮기기 · 숫자 키로 바로 고르기)
  box.pick = pick; box.act = act
  sync(); ui.replaceChildren(root); ui.hidden = false; ui.scrollTop = 0
  setTimeout(() => { if (BOX === box) { box.ready = true; root.classList.add('ready'); aim() } }, 450)   // 움직이던 손가락이 바로 카드를 누르지 않게
}
function next() {
  guardIn(); BOX = null
  if (G.queue.length) return openBox()
  ui.hidden = true; mode = 'play'; pauseBtn.hidden = false; breather(); guardOut()
}
/** 레벨 업 빛기둥 — 둘레를 비우고 1.2초 무적(고르자마자 몰려 맞지 않게). 부활할 때도 */
function breather() {
  fx({ k: 'pillar', T: 0.7 }); fx({ k: 'ring', x: pl.x, y: pl.y, R: 170, T: 0.5, col: '#7ff3ff' })
  regrid(); shove(170, 700); near(pl.x, pl.y, 170, e => { slow(e, 1, 0.4) }); pl.inv = Math.max(pl.inv, 1.2)
}
/** 부활할 수 있나 — 이번 판 횟수(난이도)가 남고, 이번 판에 부활석을 주웠으면 주운 것이, 아니면 상점 부활석이 있어야. 주운 것과 상점 것을 섞어 쓰지 않는다(주웠으면 상점 것은 이번 판엔 못 쓴다) */
const canRevive = () => G.revives < G.D.revive && (G.gotRunStone ? G.runStones > 0 : save.stone > 0)
/** 쓰러졌을 때 — 부활할 수 있으면 물어본다 */
function askRevive() {
  mode = 'revive'; calm(); pauseBtn.hidden = true; SND.duck(true)
  show(h('div', { class: 'panel revive' }, h('p', { class: 'h' }, ic('stone'), tr` 부활할까요?`),
    h('p', { class: 'sub' }, tr`${G.gotRunStone ? tr`이번 판에서 주운 부활석 ${G.runStones}개` : tr`부활석 ${save.stone}개`} — 이번 판 ${G.revives} / ${G.D.revive}번 썼어요(${G.D.name})`),
    G.gotRunStone && save.stone > 0 && h('p', { class: 'hint' }, tr`주운 부활석을 먼저 써요 — 상점 부활석 ${save.stone}개는 이번 판엔 못 써요`),
    h('p', { class: 'hint' }, tr`부활하면 체력이 가득 차고, 화면 안의 몬스터를 모두 쓰러뜨려요(보스 빼고)`),
    h('div', { class: 'row' }, btn(tr`그만두기`, () => finish(false)), btn([ic('stone'), tr` 부활하기`], revive, 'main', 'Enter'))))
}
function revive() {
  if (mode !== 'revive' || !canRevive()) return
  guardIn()
  if (G.gotRunStone) G.runStones--; else { save.stone--; persist() }
  G.revives++
  G.dying = 0; G.killer = null; pl.hp = S.maxHp; G.eshots.length = 0
  mode = 'play'; ui.hidden = true; pauseBtn.hidden = false; SND.duck(false); SND.level(); SND.voice(G.ch.id, 'happy')
  for (const e of G.foes) if (!e.dead && !e.boss && !e.rush && onScreen(e, 40)) kill(e)   // 폭탄 — 화면 안 일반 몬스터 토벌
  fx({ k: 'white', T: 0.4 }); shake = 8; breather(); guardOut()
  say(G.gotRunStone ? tr`부활! — 주운 부활석을 썼어요` : tr`부활! — 부활석 ${save.stone}개 남았어요`, 2.2, '#9fe3ff')
}
function boxKey(e) {
  if (!BOX || e.repeat) return
  if (/^Digit[1-6]$/.test(e.code)) { const i = +e.code.slice(5) - 1; i < 3 ? BOX.pick(i) : BOX.act(ACTS[i - 3][0]); e.preventDefault() }
}

// ---------------------------------------------------------------- 그리기
function txt(c, s, x, y, size, col = '#fff', mw) { c.font = `${size}px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.lineJoin = 'round'; c.lineWidth = size * 0.24; c.strokeStyle = OUT; c.strokeText(s, x, y, mw); c.fillStyle = col; c.fillText(s, x, y, mw) }   // mw — 이보다 넓으면 가로로 줄인다(다른 나라 말은 길 수 있다)
function oval(c, x, y, rx, ry) { c.beginPath(); c.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, TAU) }
function groundLite(c, ox, oy) {   // 바닥 색 + 칸마다 큰 얼룩 셋(움직이는 게 보이게 — 자리는 칸 번호로 정해져 있다)
  const W = save.theme === 'winter'; c.fillStyle = W ? '#e6eff8' : '#cdeaa8'; c.fillRect(ox, oy, VW, VH)
  c.fillStyle = W ? '#d6e3f1' : '#bde094'; c.beginPath()
  for (let tx = Math.floor(ox / TILE); tx * TILE < ox + VW; tx++) for (let ty = Math.floor(oy / TILE); ty * TILE < oy + VH; ty++)
    for (let i = 0; i < 3; i++) { const h = Math.sin(tx * 12.9 + ty * 78.2 + i * 37.7) * 43758.5, u = h - Math.floor(h), v = (h * 7.3) - Math.floor(h * 7.3), x = tx * TILE + u * TILE, y = ty * TILE + v * TILE; c.moveTo(x + 46, y); c.ellipse(x, y, 46, 22, 0, 0, TAU) }
  c.fill()
}
function render() {
  const c = ctx
  if (!SPR) return
  c.setTransform(1, 0, 0, 1, 0, 0)
  const sx = shake ? (rnd() - 0.5) * shake : 0, sy = shake ? (rnd() - 0.5) * shake : 0, ox = cam.x + sx - VW / 2, oy = cam.y + sy - VH / 2
  c.setTransform(SC, 0, 0, SC, -ox * SC, -oy * SC)
  if (LQ) groundLite(c, ox, oy)   // 가벼운 화질 — 바닥은 색 + 큰 무늬만(무늬 그림을 화면 가득 늘려 그리는 게 구형 폰에서 무겁다)
  else for (let tx = Math.floor(ox / TILE); tx * TILE < ox + VW; tx++) for (let ty = Math.floor(oy / TILE); ty * TILE < oy + VH; ty++) c.drawImage(SPR.ground, tx * TILE, ty * TILE, TILE + 0.6, TILE + 0.6)
  if (G) world(c, ox, oy)
  else parade(c, ox, oy)
  c.setTransform(DPR, 0, 0, DPR, 0, 0)
  if (save.theme === 'winter') snow(c, ox, oy)
  if (G) hud(c)
}
// ---------------------------------------------------------------- 겨울 맵 — 눈보라 · 얼어붙기
//   눈보라: STORM.every 초마다 STORM.p 확률. 오기 STORM.warn 초 전엔 오든 안 오든 「곧 눈보라가 와요!」. 오면 STORM.dur 초 — 눈이 거세지고 바닥에 쌓인 눈(밟으면 미끄럽다),
//   받는 피해 × STORM.hurt(불꽃 옷이면 그대로 · STORM.warm 초 넘게 계속 움직이면 몸에 열이 나서 그대로). 그치면 쌓인 눈은 녹는다
//   얼어붙기: ICE.after 초 넘게 가만히 있으면 최대 체력 × ICE.drain 씩 1초마다 줄고(무적일 땐 안 줄어든다) 몸이 눈에 덮인다
const STORM = { every: 60, p: 0.5, warn: 5, dur: 15, hurt: 1.2, warm: 5, piles: 16 }, ICE = { after: 5, drain: 0.015 }
const stormHurts = () => G.storm.on > 0 && !G.storm.warm && !G.fire
const onIce = () => G.storm.piles.some(p => { const dx = (pl.x - p.x) / p.r, dy = (pl.y - p.y) / (p.r * 0.6); return dx * dx + dy * dy < 1 })
function winter(dt, dead) {
  const W = G.storm
  W.k += ((W.on > 0 ? 1 : 0) - W.k) * Math.min(1, dt * 1.5)   // 눈보라 세기(그림)
  for (const p of W.piles) p.t += dt
  if (W.fade > 0 && (W.fade -= dt) <= 0) W.piles = []
  if (dead || G.won) return
  if (!W.warned && G.t >= W.next - STORM.warn) { W.warned = true; tip(tr`곧 눈보라가 와요!`, '#bfe6ff') }
  if (G.t >= W.next) {
    W.next += STORM.every; W.warned = false
    if (rnd() < STORM.p) { Object.assign(W, { on: STORM.dur, hot: 0, warm: false, piles: [], spawn: 0, fade: 0 }); tip(G.fire ? tr`눈보라가 몰아쳐요! 불꽃 옷 덕분에 받는 피해는 그대로예요` : tr`눈보라가 몰아쳐요! 받는 피해가 조금 늘어나요`, G.fire ? '#ffb36b' : '#ff9b9b') }
    else tip(tr`눈보라가 그냥 지나갔어요`, '#d6f0ff')
  }
  if (W.on > 0) {
    W.on -= dt
    if ((W.spawn -= dt) <= 0 && W.piles.length < STORM.piles) { W.spawn = 0.45; const a = rnd() * TAU, d = 40 + rnd() * Math.min(VW, VH) * 0.5; W.piles.push({ x: pl.x + Math.cos(a) * d, y: pl.y + Math.sin(a) * d * 0.8, r: 26 + rnd() * 22, t: 0 }) }
    if (!G.fire && !W.warm) { W.hot = pl.moving ? W.hot + dt : 0; if (W.hot >= STORM.warm) { W.warm = true; tip(tr`몸에 열이 나서 받는 피해가 원래대로 줄었어요!`, '#ffb36b') } }
    if (W.on <= 0) { W.on = 0; W.fade = 0.6; G.storms++; tip(tr`눈보라가 그쳤어요 — 쌓인 눈도 녹아요`, '#d6f0ff') }
  }
  if (pl.moving) {   // 움직이면 쌓인 눈을 털어 내고(눈 조각), 얼어 있었으면 얼음이 깨진다(얼음 조각 · 금 · 쨍그랑)
    const it = pl.idleT, deep = it >= ICE.after
    if (it > 2) for (let i = 0, n = Math.min(14, 4 + it * 1.5 | 0); i < n; i++) G.cfx.list.push({ k: i % 3 ? 'bubble' : 'spark', col: i % 3 ? '#9fc4ea' : '#ffffff', x: pl.x + (rnd() - 0.5) * 22, y: pl.y - 4 - rnd() * 24, vx: (rnd() - 0.5) * 110, vy: -20 - rnd() * 60, t: 0, T: 0.35 + rnd() * 0.3, s: 0.8 + rnd() * 0.6, rot: rnd() * TAU })
    if (it > 3) for (let i = 0, n = deep ? 16 : 5; i < n; i++) { const a = rnd() * TAU, v = (deep ? 90 : 60) + rnd() * 110; G.cfx.list.push({ k: 'shard', col: ['rgba(200,232,255,.95)', 'rgba(160,210,255,.95)', 'rgba(235,248,255,.95)'][i % 3], x: pl.x + Math.cos(a) * 8, y: pl.y - 14 + Math.sin(a) * 9, vx: Math.cos(a) * v, vy: Math.sin(a) * v * 0.6 - 90 - rnd() * 70, g: 520, t: 0, T: 0.55 + rnd() * 0.35, s: (deep ? 1.3 : 1) + rnd() * 0.9, rot: rnd() * TAU, spin: (rnd() - 0.5) * 18 }) }
    if (deep) { fx({ k: 'crack', x: pl.x, y: pl.y - 14, T: 0.4 }); SND.ice(); shake = Math.max(shake, 3) }
    pl.idleT = 0; pl.iced = false
  }
  else pl.idleT += dt
  if (pl.idleT >= ICE.after && Math.floor(G.t / 1.6) !== pl.shiver) {   // 부르르 할 때마다 머리 위 눈이 조금 떨어진다
    pl.shiver = Math.floor(G.t / 1.6)
    for (let i = 0; i < 3; i++) G.cfx.list.push({ k: 'bubble', col: '#9fc4ea', x: pl.x + (rnd() - 0.5) * 16, y: pl.y - 26 - rnd() * 4, vx: (rnd() - 0.5) * 40, vy: 25 + rnd() * 30, t: 0, T: 0.45 + rnd() * 0.2, s: 0.8 + rnd() * 0.5, rot: 0 })
  }
  if (pl.idleT >= ICE.after && pl.inv <= 0) {
    if (!pl.iced) { pl.iced = true; tip(tr`몸이 얼어붙고 있어요! 움직여요!`, '#9fd8ff') }
    pl.hp -= S.maxHp * ICE.drain * dt; if (pl.hp <= 0) fall(tr`꽁꽁 얼어붙음`)
  }
}
function piles(c) {   // 눈보라에 쌓인 눈 — 밟으면 미끄럽다. 그칠 때는 0.6초 동안 녹아 없어진다
  const W = G.storm, fade = W.fade > 0 ? W.fade / 0.6 : 1
  for (const p of W.piles) {
    const g = Math.min(1, p.t * 2), r = p.r * (0.6 + 0.4 * g)
    c.globalAlpha = g * fade * 0.35; c.fillStyle = '#7fa6d6'; oval(c, p.x + r * 0.06, p.y + r * 0.16, r * 1.04, r * 0.5); c.fill()   // 아래 그림자 — 소복하게 솟아 보이게
    c.globalAlpha = g * fade; c.fillStyle = '#ffffff'; c.beginPath(); c.ellipse(p.x, p.y, r, r * 0.55, 0, Math.PI, 0); c.quadraticCurveTo(p.x + r * 0.4, p.y + r * 0.34, p.x, p.y + r * 0.3); c.quadraticCurveTo(p.x - r * 0.4, p.y + r * 0.34, p.x - r, p.y); c.fill()
    c.strokeStyle = 'rgba(120,160,210,.8)'; c.lineWidth = 1.6; c.stroke()
    c.fillStyle = 'rgba(190,220,250,.55)'; c.beginPath(); c.ellipse(p.x, p.y + r * 0.08, r * 0.82, r * 0.2, 0, 0, Math.PI); c.fill()   // 아래쪽 푸른 기
    c.fillStyle = '#eaf6ff'; oval(c, p.x - r * 0.34, p.y - r * 0.26, r * 0.22, r * 0.08); c.fill()   // 반짝
  }
  c.globalAlpha = 1
}
let snowX = 0, snowY = 0, snowLast = 0
function snow(c, ox, oy) {   // 겨울 테마 — 내리는 눈(옆바람에 비스듬히). 눈보라면 훨씬 많고 빠르게 · 눈발 줄 · 하얀 안개. 위치는 시간 · 카메라로만(흐른 양만 쌓아 두어 세기가 바뀌어도 튀지 않는다)
  const w = cv.width / DPR + 20, h = cv.height / DPR + 20, k = SC / DPR, fr = v => v - Math.floor(v), st = G?.winter ? G.storm.k : 0, dt = Math.min(0.1, Math.max(0, tnow - snowLast))
  snowLast = tnow; snowX += dt * (16 + 150 * st); snowY += dt * (1 + 1.7 * st)
  const n = LQ ? 0 : Math.round(130 * (1 + 1.4 * st)), P = []   // 가벼운 화질(LQ)이면 눈송이 · 눈발은 빼고 눈보라 안개만(기획 — 보이는 것만 기기마다 다르게)
  c.beginPath()
  for (let i = 0; i < n; i++) {
    const u = fr(Math.sin(i * 12.99) * 43758.5), v = fr(Math.sin(i * 78.23) * 24634.6), z = 0.4 + 0.6 * fr(Math.sin(i * 39.35) * 9631.7), r = 1.2 + z * 2.6
    const pz = k * (1 + 0.1 * z), x = fr((u * w + Math.sin(tnow * 0.9 + i) * 14 * z + snowX * z - ox * pz) / w) * w - 10, y = fr((v * h + snowY * (20 + 38 * z) - oy * pz) / h) * h - 10   // 눈은 바닥 바로 위 — 바닥과 같이(가까운 눈은 10% 더) 밀린다. 바닥보다 덜 밀리면 걸을 때 바닥에 비해 눈이 거꾸로 날아가 보인다
    c.moveTo(x + r, y); c.arc(x, y, r, 0, TAU); if (st > 0.05 && i % 2) P.push(x, y, z)
  }
  if (n) { c.fillStyle = '#fff'; c.fill(); c.lineWidth = 1; c.strokeStyle = 'rgba(100,135,190,.6)'; c.stroke() }
  if (st > 0.05) {
    if (P.length) c.beginPath(); for (let i = 0; i < P.length; i += 3) { const L = (10 + 18 * P[i + 2]) * st; c.moveTo(P[i], P[i + 1]); c.lineTo(P[i] - L * 0.8, P[i + 1] - L * 0.55) }
    c.strokeStyle = `rgba(255,255,255,${0.75 * st})`; c.lineWidth = 1.4; c.lineCap = 'round'; c.stroke()
    c.fillStyle = `rgba(232,243,255,${0.2 * st})`; c.fillRect(0, 0, w, h)   // 하얀 안개
  }
}
function parade(c, ox, oy) {   // 처음 화면 — 일곱 명이 줄지어 풀밭을 걸어간다
  const gap = 46, span = VW + CHARS.length * gap + 120, y = oy + VH - 30
  CHARS.forEach((ch, i) => { const x = ox - 60 + ((tnow * 34 - i * gap) % span + span) % span, C = SPR[ch.id]; put(c, SPR.shadow, x, y, 0.8); put(c, C.walk[(tnow * 8 + i * 1.5 | 0) % 4], x, y) })
}
function world(c, ox, oy) {
  if (G.winter && G.storm.piles.length) piles(c)   // 바닥에 쌓인 눈
  if (G.final) { c.fillStyle = `rgba(80,150,230,${Math.min(0.18, (G.t - FINAL_T) / 25)})`; c.fillRect(ox, oy, VW, VH) }   // 세이렌이 오면 바다 빛
  // 바닥 — 라멘 국물 · 우라! · 경고 원 · 돌진 길 · 풀뽑기 표시 · 카레 냄비
  for (const b of G.shots) if (b.k === 'zone') {
    const a = Math.min(1, (b.life - b.t) * 2)
    const k = G.sk.ramen; c.globalAlpha = 0.42 * a; c.fillStyle = k?.col || '#f5d36a'; oval(c, b.x, b.y, b.R, b.R * 0.8); c.fill()
    c.globalAlpha = 0.8 * a; c.strokeStyle = k?.col2 || '#c9a03a'; c.lineWidth = 2; c.stroke(); if (k) skZone(c, b.x, b.y, b.R, k, b.t, a); c.globalAlpha = 0.6 * a; put(c, SPR.E.ramen, b.x, b.y)
    c.fillStyle = '#fff6d8'; for (let i = 0; i < 3; i++) { const q = (b.t * 0.7 + i / 3) % 1; c.globalAlpha = (1 - q) * 0.7 * a; oval(c, b.x + Math.sin(i * 2.1 + b.t * 2) * b.R * 0.4, b.y - q * 30, 3 + q * 4, 3 + q * 4); c.fill() }
    c.globalAlpha = 1
  }
  for (const w of G.weapons) if (w.id === 'ura' && w.R) {
    const k = G.sk.ura; c.globalAlpha = 0.12 + w.pulse * 1.2; c.fillStyle = k?.col || '#ffd23f'; oval(c, pl.x, pl.y, w.R, w.R * 0.8); c.fill()
    c.globalAlpha = 0.5; c.strokeStyle = k?.col2 || '#ffb400'; c.lineWidth = 2; c.setLineDash([6, 6]); c.stroke(); c.setLineDash([]); c.globalAlpha = 1
    if (k) { skZone(c, pl.x, pl.y, w.R, k, G.t, 0.8); if (rnd() < 0.1) { const q = rnd() * TAU, r = Math.sqrt(rnd()) * w.R; skPuff(pl.x + Math.cos(q) * r, pl.y + Math.sin(q) * r * 0.8 - 4, k) } }   // 우라! 기합 장판
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
    if (z.k === 'fence') { fenceDraw(c, z); continue }
    if (z.k === 'tide') { tideDraw(c, z, false); continue }
    if (z.k === 'pool') {   // 눈물 웅덩이 — 빨간 점선 없이(아프지 않다). 물결 고리가 0.8초마다, 마지막 0.6초에 말라 없어진다
      const k = clamp((z.T - z.t) / 0.6, 0, 1), R = z.R * (0.6 + 0.4 * k), w = (z.t % 0.8) / 0.8
      c.globalAlpha = k; c.fillStyle = 'rgba(74,134,232,.35)'; oval(c, z.x, z.y, R, R * 0.8); c.fill(); c.globalAlpha = 0.7 * k; c.strokeStyle = '#4a86e8'; c.lineWidth = 2; c.stroke()
      c.globalAlpha = 0.5 * (1 - w) * k; oval(c, z.x, z.y, R * (0.3 + 0.7 * w), R * (0.3 + 0.7 * w) * 0.8); c.stroke(); c.globalAlpha = 1
      continue
    }
    if (z.k === 'band') {   // 띠 — 옅은 전체 · 몸 쪽에서 끝으로 차오름 · 안쪽 테두리 · 빨간 점선(적 공격) · 60% 자리에 !
      c.save(); c.translate(z.x, z.y); c.rotate(z.a); c.fillStyle = z.col
      c.globalAlpha = 0.18; c.fillRect(0, -z.W / 2, z.L, z.W); c.globalAlpha = 0.45; c.fillRect(0, -z.W / 2, z.L * u, z.W)
      c.globalAlpha = 0.9; c.strokeStyle = z.col; c.lineWidth = 2; c.strokeRect(2, -z.W / 2 + 2, z.L - 4, z.W - 4)
      c.strokeStyle = '#ff2e2e'; c.lineWidth = 3.5; c.setLineDash([10, 7]); c.lineDashOffset = -G.t * 40; c.strokeRect(0, -z.W / 2, z.L, z.W); c.setLineDash([]); c.lineDashOffset = 0; c.restore(); c.globalAlpha = 1
      txt(c, '!', z.x + Math.cos(z.a) * z.L * 0.6, z.y + Math.sin(z.a) * z.L * 0.6 + 8, 24, '#ff3b3b')
      continue
    }
    c.fillStyle = z.col; c.globalAlpha = 0.18; oval(c, z.x, z.y, z.R, z.R * 0.8); c.fill()
    c.globalAlpha = 0.45; oval(c, z.x, z.y, z.R * u, z.R * 0.8 * u); c.fill()
    c.globalAlpha = 0.9; c.strokeStyle = z.col; c.lineWidth = 2; oval(c, z.x, z.y, z.R - 3, z.R * 0.8 - 3); c.stroke()
    c.strokeStyle = '#ff2e2e'; c.lineWidth = 3.5; c.setLineDash([10, 7]); c.lineDashOffset = -G.t * 40; oval(c, z.x, z.y, z.R, z.R * 0.8); c.stroke(); c.setLineDash([]); c.lineDashOffset = 0; c.globalAlpha = 1   // 적 공격은 늘 빨간 점선 + ! — 내 스킬 장판과 헷갈리지 않게
    if (z.k !== 'duel') txt(c, '!', z.x, z.y + Math.min(10, z.R * 0.25), Math.min(30, 12 + z.R * 0.15), '#ff3b3b')   // 결투는 가운데에 상대 손이 있다
    if (z.tear && u > 0.667) { const p = (u - 0.667) / 0.333; c.save(); c.translate(z.x, z.y - 260 * (1 - p) - 8); c.scale(1.8, 1.8); tearP(c); c.fillStyle = '#4a86e8'; c.fill(); c.strokeStyle = '#2c5aa8'; c.lineWidth = 1.5; c.stroke(); c.restore() }   // 눈물이 떨어진다(진한 파랑 — 내 스킬 눈물과 다르게)
    if (z.k === 'duel') {   // 손 원 셋(똑같이) — 상대 손은 몸 위 층에서 나를 따라다닌다
      for (const o of z.opts) handAt(c, o.x, o.y, o.hand, 42, '#4a3b35', 'rgba(255,255,255,.55)', 70)
    }
  }
  for (const e of G.foes) if (e.act?.k === 'sauce' && !e.dead) {
    const R = e.r + 30, d = e.act.dir; c.strokeStyle = '#ff2e2e'; c.lineWidth = 3; c.setLineDash([10, 7]); c.lineDashOffset = -d * G.t * 120; oval(c, e.x, e.y, R, R * 0.8); c.stroke(); c.setLineDash([]); c.lineDashOffset = 0
    for (const o of [0, Math.PI]) { const q = G.t * 3 * d + o, x = e.x + Math.cos(q) * R, y = e.y + Math.sin(q) * R * 0.8, t = q + d * Math.PI / 2; c.fillStyle = '#ff2e2e'; c.beginPath(); c.moveTo(x + Math.cos(t) * 9, y + Math.sin(t) * 9); c.lineTo(x + Math.cos(t + 2.4) * 7, y + Math.sin(t + 2.4) * 7); c.lineTo(x + Math.cos(t - 2.4) * 7, y + Math.sin(t - 2.4) * 7); c.closePath(); c.fill() }
  }
  for (const e of G.foes) if (e.boss && e.st === 'wind') { const L = e.spd * 4 * 0.75, a = Math.atan2(e.dy, e.dx); c.save(); c.translate(e.x, e.y); c.rotate(a); c.fillStyle = 'rgba(255,60,60,.3)'; c.fillRect(0, -e.r, L, e.r * 2); c.restore() }
  for (const b of G.shots) {
    if (b.k === 'pile') {   // 무너질 범위는 옅은 초록 점선, 기울면서 쓰러진다 · 사라질 때 흐려진다
      c.globalAlpha = Math.min(1, (b.life - b.t) / 0.5 + (b.fall ? 1 : 0))
      c.strokeStyle = 'rgba(110,170,60,.25)'; c.lineWidth = 1.5; c.setLineDash([3, 5]); oval(c, b.x, b.y, b.R, b.R * 0.8); c.stroke(); c.setLineDash([])
      c.save(); c.translate(b.x, b.y); if (b.fall) c.rotate(Math.min(1, (b.t - b.fall) / 0.25) * 0.8); put(c, skPut('pile', SPR.pile), 0, 0); c.restore(); c.globalAlpha = 1
    }
    else if (b.k === 'drop') { const u = b.t / b.T, k = G.sk.weed; if (k) skZone(c, b.x, b.y, b.R, k, b.t); c.strokeStyle = k?.col || '#4f9a35'; c.lineWidth = 2; c.setLineDash([4, 4]); oval(c, b.x, b.y, b.R, b.R * 0.8); c.stroke(); c.setLineDash([]); c.fillStyle = k?.col || 'rgba(110,190,80,.35)'; if (k) c.globalAlpha = 0.35; oval(c, b.x, b.y, b.R * u, b.R * 0.8 * u); c.fill(); c.globalAlpha = 1 }
    else if (b.k === 'pot') { const u = b.t / b.T, k = G.sk.curry; if (k) skZone(c, b.x, b.y, b.R, k, b.t); c.strokeStyle = k?.col || 'rgba(200,140,30,.85)'; c.lineWidth = 2.5; oval(c, b.x, b.y, b.R, b.R * 0.8); c.stroke(); c.fillStyle = k ? k.col2 + '33' : 'rgba(235,185,60,.2)'; c.fill(); c.strokeStyle = k?.col2 || '#a8701c'; c.lineWidth = 4; c.beginPath(); c.arc(b.x, b.y - 12, 16, -Math.PI / 2, -Math.PI / 2 + u * TAU); c.stroke(); put(c, SPR.E.curry, b.x + Math.sin(b.t * 40) * u * 1.5, b.y - 12) }
  }
  // 보석 · 줍는 것
  for (const g of G.gems) if (Math.abs(g.x - cam.x) < VW / 2 + 20 && Math.abs(g.y - cam.y) < VH / 2 + 20) put(c, SPR.gem[g.v >= 20 ? 2 : g.v >= 3 ? 1 : 0], g.x, g.y)   // 화면 안만(바닥에 쌓인 것까지 매 프레임 그리면 구형 폰이 느려진다)
  for (const it of G.items) { put(c, SPR.shadow, it.x, it.y, 0.5); c.globalAlpha = 0.35 + 0.2 * Math.sin(it.t * 5); c.fillStyle = it.k === 'guard' ? '#ffe27a' : '#fff'; oval(c, it.x, it.y - 12, 16, 16); c.fill(); c.globalAlpha = 1; put(c, SPR.E[it.k], it.x, it.y - 12 + Math.sin(it.t * 4) * 2)
    if (it.k === 'guard') { const k = LQ || RM.matches ? 1 : Math.max(0, Math.sin(it.t * TAU / 1.2)); if (k) { starP(c, it.x + 10, it.y - 26, 4.5 * k, 1.4 * k, 4); c.fillStyle = '#ffd23f'; c.fill(); c.lineWidth = 1; c.strokeStyle = OUT; c.stroke() } } }   // 냄비뚜껑 — 눈밭에서도 보이게 노란 빛 + 1.2초에 한 번 반짝(디자인)
  // 그림자 → 몸(y 순, 화면 안만)
  const vis = e => Math.abs(e.x - cam.x) < VW / 2 + 90 && Math.abs(e.y - cam.y) < VH / 2 + 140
  for (const e of G.foes) if (e.storm && vis(e)) { c.fillStyle = 'rgba(30,40,80,.28)'; oval(c, e.x, e.y, e.r * 1.4, e.r * 0.5); c.fill() }   // 폭풍의 세이렌 — 그림자 밑 먹구름
  for (const e of G.foes) if (vis(e) && (!LQ || e.boss)) put(c, SPR.shadow, e.x, e.y, e.r / 16 * (e.z ? Math.max(0.4, 1 - e.z / 200) : 1))
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
    if (b.tr?.length > 5 && G.sk[b.src]) ribbon(c, b.tr, G.sk[b.src])   // 스킬 스킨 꼬리
    if (b.k === 'ball' && b.look === 'note') put(c, SPR.note, b.x, b.y - 14 + Math.sin(b.t * 18) * 2, 0.75)
    else if (b.k === 'ball' && b.look === 'page') { c.save(); c.translate(b.x, b.y - 12); c.rotate(Math.atan2(b.vy, b.vx) + Math.sin(b.t * 16) * 0.35); c.scale(b.sc, b.sc * (0.45 + 0.55 * Math.abs(Math.cos(b.t * 13)))); put(c, skPut('book', SPR.page), 0, 0, 1.25); c.restore() }   // 팔랑이는 책장
    else if (b.k === 'ball' && b.look === 'cup') { c.save(); c.translate(b.x, b.y - 12); c.rotate(Math.sin(b.t * 14) * 0.5); put(c, skPut('kanpai', SPR.E.kanpai), 0, 0, 0.8); c.restore() }
    else if (b.k === 'ball') { c.save(); c.translate(b.x, b.y - 12); c.rotate(Math.atan2(b.vy, b.vx)); put(c, SPR.sasu[b.col] ||= sprite(34, 18, 16, 9, g => { g.translate(-13.4, 0); sasuShape(g, 18, b.col) }), 0, 0, 1.2); c.restore() }   // 사스마타 — 캐릭터 색 else if (b.k === 'arc') { const u = b.u, hh = b.H * 4 * u * (1 - u); put(c, SPR.shadow, b.x, b.y, 0.35); tear(c, b.x, b.y - hh - 10, 6) }
    else if (b.k === 'orb') put(c, skPut('guitar', SPR.note), b.x, b.y - 14, 0.8)
    else if (b.k === 'boom') { c.save(); c.translate(b.x, b.y - 14); c.rotate(Math.sin(b.a) * 0.6); put(c, skPut('pochette', SPR.pochette), 0, 0, b.r / 10); c.restore() }
    else if (b.k === 'ring' && b.t >= 0) { const u = Math.min(1, b.t / b.T); c.globalAlpha = 1 - Math.max(0, b.t - b.T) / 0.18; c.strokeStyle = G.sk.yaha?.col || '#ffd23f'; c.lineWidth = 6; oval(c, b.x, b.y, b.R * u, b.R * u * 0.8); c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); c.globalAlpha = 1 }
  }
  cfxDraw(c, G.sfx)   // 스킬 스킨 반짝이 — 지나간 자리 · 터진 자리
  for (const b of G.eshots) {
    const y = b.y - 14, R = b.k === 'sauce' ? b.r + 5 : b.r * 2.2 + 8, pu = 0.5 + 0.5 * Math.sin(b.t * 16), v = Math.hypot(b.vx, b.vy) || 1   // 소스는 많이 뿌려서 테를 작게(틈이 보이게)   // 잘 보이게 — 꼬리 · 깜빡이는 빨간 테
    if (b.k !== 'sauce') { c.lineCap = 'round'; c.strokeStyle = 'rgba(255,70,90,.35)'; c.lineWidth = R * 1.2; c.beginPath(); c.moveTo(b.x - b.vx / v * R * 2.2, y - b.vy / v * R * 2.2); c.lineTo(b.x, y); c.stroke() }
    oval(c, b.x, y, R, R); c.fillStyle = `rgba(255,60,90,${0.3 + 0.2 * pu})`; c.fill(); c.lineWidth = 2.2; c.strokeStyle = pu > 0.5 ? '#fff' : '#ff3355'; c.stroke()
    c.save(); c.translate(b.x, y); c.scale(1.7, 1.7); c.translate(-b.x, -y)
    if (b.k === 'spike' || b.k === 'claw') { c.save(); c.translate(b.x, y); c.rotate(Math.atan2(b.vy, b.vx)); c.beginPath(); c.moveTo(8, 0); c.lineTo(-6, -4); c.lineTo(-6, 4); c.closePath(); c.fillStyle = b.k === 'claw' ? '#b7793f' : '#3f7f74'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke(); c.restore() }
    else if (b.k === 'note') put(c, SPR.pinkNote, b.x, y)
    else if (b.k === 'shard') { c.save(); c.translate(b.x, y); c.rotate(b.t * 8); c.beginPath(); for (let i = 0; i < 8; i++) { const a = i / 8 * TAU, r = i % 2 ? 2.2 : 6; c.lineTo(Math.cos(a) * r, Math.sin(a) * r) } c.closePath(); c.fillStyle = '#2a2038'; c.fill(); c.strokeStyle = '#a78bfa'; c.lineWidth = 1.2; c.stroke(); c.restore() }
    else if (b.k === 'sauce') { const v = Math.hypot(b.vx, b.vy) || 1; c.globalAlpha = 0.5; c.strokeStyle = '#ff6b3d'; c.lineWidth = b.r * 1.3; c.beginPath(); c.moveTo(b.x, y); c.lineTo(b.x - b.vx / v * b.r * 1.5, y - b.vy / v * b.r * 1.5); c.stroke(); c.globalAlpha = 1
      oval(c, b.x, y, b.r, b.r); c.fillStyle = '#ff6b3d'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke(); c.fillStyle = 'rgba(255,255,255,.7)'; oval(c, b.x - b.r * 0.3, y - b.r * 0.35, b.r * 0.3, b.r * 0.25); c.fill() }
    else if (b.k === 'paper') { c.save(); c.translate(b.x, y); c.rotate(b.t * 6); c.fillStyle = '#fff'; c.fillRect(-4.5, -5.5, 9, 11); c.strokeStyle = OUT; c.lineWidth = 1; c.strokeRect(-4.5, -5.5, 9, 11); c.restore() }
    else if (b.k === 'net') { oval(c, b.x, y, b.r, b.r); c.fillStyle = 'rgba(255,236,160,.6)'; c.fill(); c.strokeStyle = '#d9a93a'; c.lineWidth = 1; c.stroke(); c.beginPath(); for (let k = -1; k <= 1; k++) { c.moveTo(b.x + k * b.r * 0.5, y - b.r * 0.85); c.lineTo(b.x + k * b.r * 0.5, y + b.r * 0.85); c.moveTo(b.x - b.r * 0.85, y + k * b.r * 0.5); c.lineTo(b.x + b.r * 0.85, y + k * b.r * 0.5) } c.stroke() }
    else { oval(c, b.x, y, b.r, b.r); c.fillStyle = b.k === 'rock' ? '#9a8f86' : b.k === 'soy' ? '#5a3a26' : '#6fc3ff'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke(); c.fillStyle = 'rgba(255,255,255,.7)'; oval(c, b.x - b.r * 0.3, y - b.r * 0.35, b.r * 0.3, b.r * 0.25); c.fill() }
    c.restore()
  }
  for (const p of G.parts) { c.globalAlpha = 1 - p.t / p.T; c.fillStyle = p.col; c.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r, p.r) }
  c.globalAlpha = 1
  for (const z of G.haz) if (z.k === 'tide' && z.t > 1.2) tideDraw(c, z, true)   // 큰 파도는 몸 위로 덮고 지나간다
  for (const z of G.haz) if (z.k === 'duel' && z.t >= 0) handAt(c, pl.x, pl.y - 80, z.hand, 28, '#ff2e2e', 'rgba(255,255,255,.9)')   // 가위바위보 상대 손(빨간 테두리) — 내 머리 위, 원으로 달려가는 동안에도 보이게
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
  const v = e.type === 'mermaid' ? SPR.mermaid[e.v % 3] : e.storm ? SPR.sirenStorm : e.angry ? SPR.sirenAngry : SPR[e.type]
  const L = e.fx < 0, k = e.sc || 1, f = G.freeze > 0 || e.act ? 0 : (e.age * (e.boss ? 3 : 6) + e.seed | 0) & 1, y = e.y - e.z - (e.boss ? Math.sin(e.age * 3) * 1.5 : Math.abs(Math.sin(e.age * 6 * Math.PI + e.seed)) * 1.2)
  if (e.type === 'dekatsuyo') {   // 데카츠요의 노란 빛 — 둥근 빛과 빛살
    const cy = y - e.r * 1.1 * k, R = e.r * 2 * k
    c.globalAlpha = 0.45 + 0.1 * Math.sin(G.t * 5); c.fillStyle = '#fff3a0'; oval(c, e.x, cy, R, R * 0.9); c.fill()
    c.globalAlpha = 0.7; c.strokeStyle = '#e8d24a'; c.lineWidth = 1.4; c.beginPath(); for (let i = 0; i < 18; i++) { const a = i / 18 * TAU + G.t * 0.3; c.moveTo(e.x + Math.cos(a) * R * 0.86, cy + Math.sin(a) * R * 0.78); c.lineTo(e.x + Math.cos(a) * R * 0.98, cy + Math.sin(a) * R * 0.88) } c.stroke(); c.globalAlpha = 1
  }
  if (e.kind === 'siren') {   // 세이렌의 노래 — 등 뒤 은은한 빛 · 둘레를 맴도는 음표 셋(화나면 붉게)
    const cy = y - 40, R = 80, gl = c.createRadialGradient(e.x, cy, 10, e.x, cy, R)
    gl.addColorStop(0, e.storm ? 'rgba(63,104,179,.4)' : e.angry ? 'rgba(255,50,80,.38)' : 'rgba(255,200,225,.5)'); gl.addColorStop(1, e.storm ? 'rgba(63,104,179,0)' : e.angry ? 'rgba(255,50,80,0)' : 'rgba(255,200,225,0)')
    c.fillStyle = gl; oval(c, e.x, cy, R, R); c.fill()
    c.globalAlpha = 0.8; for (let i = 0; i < 3; i++) { const a = G.t * 0.8 + i * TAU / 3; put(c, SPR.note, e.x + Math.cos(a) * 70, cy - 6 + Math.sin(a) * 34 + Math.sin(G.t * 3 + i) * 3, 0.65) } c.globalAlpha = 1
  }
  if (e.flash > 0 && !e.boss && LQ < 2) put(c, (L ? v.WL : v.WR)[f], e.x, y, k)   // 맞으면 하얗게 — 한 장만 그린다(겹쳐 그리면 적이 많을 때 무겁다)
  else { put(c, (L ? v.L : v.R)[f], e.x, y, k); if (e.flash > 0 && LQ < 2) { c.globalAlpha = 0.45; put(c, (L ? v.WL : v.WR)[f], e.x, y, k); c.globalAlpha = 1 } }   // 보스는 모양이 보이게 옅게 겹친다
  if (e.shield > G.t) { c.fillStyle = 'rgba(255,255,255,.25)'; oval(c, e.x, e.y - e.r * 1.1, e.r + 20, (e.r + 20) * 1.07); c.fill(); c.strokeStyle = '#fff'; c.lineWidth = 3; c.stroke() }   // 페이즈가 바뀌는 2초 — 방울 방패(공격이 왜 안 들어가는지 보이게)
  if (e.boss && e.kind === 'siren' && guarded(e)) { c.globalAlpha = 0.35 + 0.15 * Math.sin(G.t * 4); c.strokeStyle = '#7fd8ff'; c.lineWidth = 3; oval(c, e.x, e.y - e.r * 1.1, e.r * 1.5, e.r * 1.6); c.stroke(); c.globalAlpha = 1 }
  if (e.slow > 0 && !e.boss) { c.globalAlpha = 0.5; c.fillStyle = '#f5d36a'; oval(c, e.x, e.y, e.r, e.r * 0.4); c.fill(); c.globalAlpha = 1 }
  const SH = FOES[e.type].shot, d = Math.hypot(pl.x - e.x, pl.y - e.y)   // 쏘기 직전 경고 — 머리 위 빨간 ! (겨누는 것은 조준선도)
  if (SH ? d < SH.range && e.cd < 0.7 : e.act && FIRE.has(e.act.k)) {
    const hy = y - e.r * 2.3 * k - 10, aim = SH || e.act.k === 'volley', on = (G.t * 10 | 0) % 2
    if (aim) { c.save(); c.setLineDash([7, 6]); c.lineDashOffset = -G.t * 40; c.strokeStyle = 'rgba(255,40,70,.75)'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(e.x, e.y - 14); c.lineTo(e.x + (pl.x - e.x) / (d || 1) * Math.min(d, 260), e.y - 14 + (pl.y - e.y) / (d || 1) * Math.min(d, 260)); c.stroke(); c.restore() }
    oval(c, e.x, hy, 9, 9); c.fillStyle = on ? '#ff3355' : '#ffd23f'; c.fill(); c.lineWidth = 2; c.strokeStyle = OUT; c.stroke(); txt(c, '!', e.x, hy + 5.5, 15)
  }
}
const FIRE = new Set(['volley', 'notes', 'papers'])   // 날아오는 것을 쏘는 보스 기술
function drawMe(c) {
  const C = SPR[G.ch.id], j = pl.jump > 0 ? Math.sin(pl.jump / 0.3 * Math.PI) * 26 : 0, walking = pl.moving && !G.dying
  const it = G.winter && !G.dying ? pl.idleT : 0, cold = Math.max(0, Math.min(1, (it - 1.5) / 3.5)), ice = Math.max(0, Math.min(1, (it - 2) / 6))   // 겨울 — 가만히 있으면 덜덜 떨며 입김(cold), 발밑부터 파랗게 얼고 눈이 쌓인다(ice)
  const iced = it >= ICE.after, burst = iced && G.t % 1.6 < 0.5, heap = Math.max(0, Math.min(1, (it - 2.6) / 10))   // 꽁꽁 — 눈이 쌓이면 1.6초마다 부르르(쌓일수록 세게)
  const dx = Math.sin(G.t * 52) * (iced ? (burst ? 1.3 + heap : 0.3) : 0.8 * cold)   // 떨림 — 몸과 머리 위 눈이 같이 흔들린다
  const s = G.dying || pl.hurtT > 0 || G.slip || burst ? C.hurt : walking ? C.walk[(G.t * 9 * Math.sqrt(S.move) | 0) % 4] : C.idle[G.t % 3.4 < 0.14 ? 1 : 0]   // 아프면 > < · 걸으면 네 장 · 서 있으면 가끔 깜빡
  const br = walking ? 0 : Math.sin(G.t * 3) * 0.025   // 서 있으면 숨 쉬듯
  cfxAura(c, G.ofx, pl.x, pl.y, G.t)   // 업적 의상 — 발밑 빛
  if (pl.inv > 0) c.globalAlpha = 0.6   // 무적 — 깜빡이지 않고 반투명
  c.save(); c.translate(pl.x + dx, pl.y - j)
  if (G.dying) c.rotate(Math.min(1, (1.2 - G.dying) * 2) * 1.4 * pl.fx)
  c.scale(pl.fx * (1 + br * 0.6), 1 - br)
  c.drawImage(s.c, -s.ox, -s.oy, s.w, s.h)
  if (ice) frostOn(c, s, ice)
  c.restore(); c.globalAlpha = 1
  if (cold || ice) frostAround(c, s, it, cold, ice, dx, burst)
  if (!LQ) { cfxDraw(c, G.cfx); cfxDraw(c, G.wfx) }   // 의상 이펙트 — 몸 둘레에 떠오르는 모양 · 무기 반짝이
  if (sick('charm')) txt(c, '♥', pl.x + Math.sin(G.t * 6) * 8, pl.y - 50, 16, '#ff6fd0')
}
const FROST = mk(8, 8)   // 얼어붙기 그림판 — 한 장을 다시 쓴다
const FLAKES = [[-9, -4], [8, -5], [-10, -12], [10, -11], [-6, -22], [6, -23], [0, -4], [-9, -18], [9, -18], [0, -26], [-4, -2], [4, -2]]   // 몸에 달라붙는 눈송이 자리(발밑 0 기준 · 얼굴은 비켜서 · 그림 안에만 찍힌다)
function headTop(s) {   // 그림 가운데 줄의 가장 위 칠해진 곳(발밑 기준 단위) — 머리 위에 눈을 얹을 자리. 그림마다 한 번
  if (s.top != null) return s.top
  const x = Math.round(s.ox * s.c.width / s.w), d = s.c.getContext('2d').getImageData(x, 0, 1, s.c.height).data
  let y = 0; while (y < s.c.height - 1 && d[y * 4 + 3] < 128) y++
  return s.top = y * s.h / s.c.height - s.oy
}
function frostOn(c, s, ice) {   // 몸 위 — 발밑부터 차오르는 푸른 서리 · 하나둘 달라붙는 눈송이(둘 다 몸 그림 안에서만)
  const F = FROST, sc = s.c.width / s.w
  if (F.width !== s.c.width || F.height !== s.c.height) { F.width = s.c.width; F.height = s.c.height }
  const g = F.getContext('2d'); g.globalCompositeOperation = 'source-over'; g.clearRect(0, 0, F.width, F.height); g.drawImage(s.c, 0, 0); g.globalCompositeOperation = 'source-atop'
  const lv = s.oy - 34 * ice, gr = g.createLinearGradient(0, lv * sc, 0, (lv + 8) * sc)
  gr.addColorStop(0, 'rgba(150,205,255,0)'); gr.addColorStop(1, 'rgba(150,205,255,.5)'); g.fillStyle = gr; g.fillRect(0, 0, F.width, F.height)
  g.fillStyle = '#fbfdff'; g.strokeStyle = 'rgba(110,150,205,.5)'; g.lineWidth = 0.4 * sc
  FLAKES.forEach(([x, y], i) => { const k = Math.min(1, (ice - i / FLAKES.length * 0.85) * 4); if (k > 0) { g.beginPath(); g.arc((s.ox + x) * sc, (s.oy + y) * sc, (0.5 + 0.7 * k) * sc, 0, TAU); g.fill(); g.stroke() } })
  c.drawImage(F, -s.ox, -s.oy, s.w, s.h)
}
function frostAround(c, s, it, cold, ice, dx = 0, burst = false) {   // 몸 밖 — 하얀 입김 · 발밑에 소복이 쌓이는 눈 · 머리 위 눈(몸과 같이 흔들린다) · 부르르 떨림 표시 · 꽁꽁 얼면 반짝
  const x = pl.x, y = pl.y, f = pl.fx
  const lumps = P => { c.lineWidth = 1.6; c.strokeStyle = 'rgba(110,150,205,.8)'; for (const [px, py, r] of P) { oval(c, px, py, r, r); c.stroke() } c.fillStyle = '#fbfdff'; for (const [px, py, r] of P) { oval(c, px, py, r, r); c.fill() } }   // 겹친 동그라미 — 테두리를 먼저 다 긋고 속을 칠해 울퉁불퉁한 눈 덩이 하나로
  if (cold > 0.15) {
    c.fillStyle = '#ffffff'; c.strokeStyle = 'rgba(120,160,210,.55)'; c.lineWidth = 1
    for (let i = 0; i < 2; i++) { const p = (G.t * 0.8 + i * 0.5) % 1; c.globalAlpha = (1 - p) * 0.55 * cold; oval(c, x + f * (11 + 9 * p), y - 13 - 8 * p, 0.9 + 2 * p, 0.8 + 1.6 * p); c.fill(); c.stroke() }   // 입 옆에서 피어올라 흩어진다
    c.globalAlpha = 1
  }
  if (ice) { const P = []; for (let i = -4; i <= 4; i++) { const r = (1.4 + 3.6 * ice) * (0.75 + 0.25 * Math.sin(i * 1.9 + 1)); P.push([x + i * 3.2, y - r * 0.35, r]) } lumps(P) }
  const cap = Math.max(0, Math.min(1, (it - 2.6) / 10))   // 머리 위 눈 — 처음엔 살짝, 오래 서 있을수록 두툼하게(10초에 걸쳐)
  if (cap) snowCap(c, x + dx, y + headTop(s), cap, f)
  if (burst) { c.strokeStyle = 'rgba(90,120,170,.85)'; c.lineWidth = 1.4; c.lineCap = 'round'; for (const k of [-1, 1]) for (const r of [7, 10.5]) { c.beginPath(); c.arc(x + dx + k * 6, y - 13, r, k > 0 ? -0.55 : Math.PI - 0.55, k > 0 ? 0.55 : Math.PI + 0.55); c.stroke() } }   // 부르르 — 양옆에 (( ))
  if (it >= ICE.after) for (const [dx, dy, ph] of [[-8, -20, 0], [7, -9, 0.6]]) { const a = Math.max(0, Math.sin((G.t + ph) * 4)); if (a > 0.2) { c.globalAlpha = a; c.fillStyle = '#ffffff'; c.strokeStyle = 'rgba(110,150,205,.7)'; c.lineWidth = 0.8; starP(c, x + dx * f, y + dy, 3 * a, 0.8, 4); c.fill(); c.stroke(); c.globalAlpha = 1 } }
}
function snowCap(c, x, top, a, f) {   // 머리 위에 쌓이는 눈 — 동글동글한 눈 덩이가 머리 꼭대기를 따라 한 줄, 쌓일수록 그 위로 줄이 늘어 소복한 무더기가 된다(아래는 푸르스름)
  const yb = u => top + 1.4 + (u / 10) ** 2 * 6, P = new Path2D(), L = []
  const rows = [[0, 1, 0], [0.3, 0.68, 1], [0.58, 0.38, 2], [0.84, 0, 3]]   // [나타나는 때, 너비 비율, 줄]
  const wB = 5 + 6 * Math.min(1, a * 1.5), rb = 1.5 + 1.3 * a
  for (const [th, k, n] of rows) {
    const p = Math.max(0, Math.min(1, (a - th) / 0.22)); if (!p) continue
    const w = wB * k, m = Math.max(1, Math.round(w / 2.3) * 2 + (k ? 1 : 0))
    for (let i = 0; i < m; i++) { const u = m > 1 ? -w + 2 * w * i / (m - 1) : 0, r = rb * (0.85 + 0.25 * Math.abs(Math.sin(i * 2.1 + n))) * p * (n ? 1.05 : 1); L.push([x + u * f, yb(u) - rb * 0.35 - n * rb * 1.05 * p, r]) }
  }
  for (const [px, py, r] of L) { P.moveTo(px + r, py); P.arc(px, py, r, 0, TAU) }
  c.lineWidth = 1.4; c.strokeStyle = 'rgba(110,150,205,.85)'; for (const [px, py, r] of L) { oval(c, px, py, r, r); c.stroke() }   // 테두리를 먼저 다 긋고
  c.fillStyle = '#fbfdff'; c.fill(P)   // 속을 칠해 하나의 무더기로
  c.save(); c.clip(P); c.fillStyle = 'rgba(165,200,240,.5)'; c.beginPath(); for (let i = 0; i <= 12; i++) { const u = -wB - 2 + (2 * wB + 4) * i / 12; i ? c.lineTo(x + u, yb(u) - 1.2) : c.moveTo(x + u, yb(u) - 1.2) } c.lineTo(x + wB + 4, top + 12); c.lineTo(x - wB - 4, top + 12); c.closePath(); c.fill(); c.restore()   // 머리에 닿은 아래쪽은 푸르스름하게
}
function effect(c, f, ox, oy) {
  const u = Math.min(1, f.t / f.T)
  switch (f.k) {
    case 'crack': {   // 얼음 깨짐 — 몸에서 사방으로 뻗는 하얀 금 · 퍼지는 푸른 고리
      c.globalAlpha = 1 - u; c.lineCap = c.lineJoin = 'round'
      for (const [col, lw] of [['rgba(90,140,200,.9)', 3.6], ['#ffffff', 1.8]]) { c.strokeStyle = col; c.lineWidth = lw * (1 - u * 0.6); for (let i = 0; i < 7; i++) { const a = i / 7 * TAU + 0.4, L = (18 + (i % 3) * 8) * (0.7 + u * 0.6), k = 0.8; c.beginPath(); c.moveTo(f.x, f.y); c.lineTo(f.x + Math.cos(a) * L * 0.45 + Math.cos(a + 1.2) * 3, f.y + (Math.sin(a) * L * 0.45 + Math.sin(a + 1.2) * 3) * k); c.lineTo(f.x + Math.cos(a) * L, f.y + Math.sin(a) * L * k); c.stroke() } }
      c.strokeStyle = 'rgba(160,210,255,.9)'; c.lineWidth = 3 * (1 - u) + 0.5; oval(c, f.x, f.y, 12 + u * 34, (12 + u * 34) * 0.75); c.stroke(); break
    }
    case 'ring': c.globalAlpha = 1 - u; c.strokeStyle = f.col; c.lineWidth = 4; oval(c, f.x, f.y, f.R * u, f.R * u * 0.8); c.stroke(); break
    case 'boom': c.globalAlpha = (1 - u) * 0.75; c.fillStyle = G.sk[f.src]?.col || f.col; oval(c, f.x, f.y - 4, f.R * (0.5 + 0.5 * u), f.R * (0.5 + 0.5 * u) * 0.8); c.fill(); c.globalAlpha = 1 - u; c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke(); if (G.sk[f.src]) { c.strokeStyle = G.sk[f.src].col2; c.lineWidth = 3; oval(c, f.x, f.y - 4, f.R * (0.7 + 0.6 * u), f.R * (0.7 + 0.6 * u) * 0.8); c.stroke() } break   // 스킨 — 바깥으로 퍼지는 고리 하나 더
    case 'flash': c.globalCompositeOperation = 'lighter'; c.globalAlpha = (1 - u) * 0.5; c.fillStyle = f.col; oval(c, f.x, f.y, f.R, f.R); c.fill(); c.globalCompositeOperation = 'source-over'; break
    case 'white': c.globalAlpha = (1 - u) * (f.a || 0.8); c.fillStyle = '#fff'; c.fillRect(ox, oy, VW, VH); break
    case 'text': c.globalAlpha = 1 - Math.max(0, u - 0.6) / 0.4; txt(c, f.s, f.x, f.y - u * 18, 17, f.col); break
    case 'guard': {   // 냄비뚜껑 방패를 주웠다 — 뚜껑이 머리 위로 떠오르고(처음 0.2초 톡) 밑에 「받는 피해 −N%」, 마지막 0.3초에 사라진다. 움직임 줄이기면 그 자리에서 보였다 사라지기만
      const still = LQ || RM.matches, y = pl.y - (still ? 72 : 72 + 36 * u),   // 글자(뚜껑 밑 26)가 처음부터 머리(발에서 약 40) 위에(디자인)
      k = still ? 1 : u < 0.2 / 0.9 ? (u < 0.1 / 0.9 ? 1.2 * u / (0.1 / 0.9) : 1.2 - 0.2 * (u - 0.1 / 0.9) / (0.1 / 0.9)) : 1
      c.globalAlpha = 1 - Math.max(0, u - 0.6 / 0.9) / (0.3 / 0.9); c.drawImage(SPR.E.guard.c, pl.x - 14 * k, y - 14 * k, 28 * k, 28 * k); txt(c, tr`받는 피해 −${Math.floor(guardCut() * 100)}%`, pl.x, y + 26, 13, '#9fd0ff'); break
    }
    case 'bolt': {   // 어떻게든 돼라! — 노란 별 번개
      c.globalAlpha = 1 - u; c.lineJoin = 'round'
      const k = G.sk[f.src]; for (const [col, lw] of k ? [[k.col + '55', 18], [k.col, 8], [k.col2, 3.5]] : [['#ffb400', 7], ['#fff7b0', 3]]) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); f.pts.forEach(([x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke() }
      star(c, f.x, f.y - 14, 12 * (1 + u * 0.5), k?.col || '#ffe066'); break
    }
    case 'beam': {   // 랏코 선생의 일섬
      const x1 = f.x + Math.cos(f.a) * f.L, y1 = f.y + Math.sin(f.a) * f.L
      c.globalAlpha = 1 - u; c.lineCap = 'round'
      const sk = G.sk[f.src]
      for (const [col, k, al] of sk ? [[sk.col, 3.6, 0.28], [sk.col + '99', 2.2, 1], [sk.col2, 1.3, 1], ['#fff', 0.6, 1]] : f.cols || [['rgba(127,200,255,.6)', 2, 1], ['#fff', 0.8, 1]]) { c.globalAlpha = (1 - u) * al; c.strokeStyle = col; c.lineWidth = f.W * k * (1 - u * 0.6); c.beginPath(); c.moveTo(f.x, f.y); c.lineTo(x1, y1); c.stroke() }   // 스킨이면 넓은 빛 · 두 겹 색
      if (sk && f.src === 'sword') {   // 벚꽃 일섬 — 칼끝이 화면을 가르며 달려가고(빛나는 끝 · 하얀 칼자국), 지나간 자리에 초승달 칼자국 셋 · 벚꽃이 피어 양옆으로 흩날린다
        const p = Math.min(1, u / 0.45), dx = Math.cos(f.a), dy = Math.sin(f.a), nx = -dy, ny = dx, hx = f.x + dx * f.L * p, hy = f.y + dy * f.L * p
        c.globalAlpha = 1 - u * 0.5; c.strokeStyle = '#fff'; c.lineWidth = f.W * 0.9; c.beginPath(); c.moveTo(f.x, f.y); c.lineTo(hx, hy); c.stroke()
        if (p < 1) { c.globalAlpha = 0.5; c.fillStyle = sk.col; oval(c, hx, hy, f.W * 2.4, f.W * 2.4); c.fill(); c.globalAlpha = 1; c.fillStyle = '#fff'; oval(c, hx, hy, f.W * 1.1, f.W * 1.1); c.fill() }
        for (const q of [0.24, 0.5, 0.76]) {
          if (q > p) continue; const R = f.W * 2.6, cx = f.x + dx * (f.L * q - R * 0.7), cy = f.y + dy * (f.L * q - R * 0.7)
          c.beginPath(); c.arc(cx, cy, R, f.a - 1.05, f.a + 1.05); c.globalAlpha = (1 - u) * 0.85; c.strokeStyle = sk.col; c.lineWidth = 7 * (1 - u) + 1; c.stroke(); c.strokeStyle = '#fff'; c.lineWidth = 2.6 * (1 - u) + 0.6; c.stroke()
        }
        for (let i = 0; i < 6; i++) { const q = (i + 0.5) / 6; if (q > p) continue; const side = i % 2 ? 1 : -1, d = f.W * (1.3 + u * 3.4); c.globalAlpha = 1 - u; sakura(c, f.x + dx * f.L * q + nx * side * d, f.y + dy * f.L * q + ny * side * d, 6 + 5 * Math.min(1, u * 4), f.a + i + u * 3, i % 3 ? '#ffc2d9' : '#ff9bc0') }
        c.globalAlpha = 1
      }
      break
    }
    case 'grab': {   // 내놔! — 쭉 뻗은 손
      c.globalAlpha = 1 - u; c.lineCap = 'round'
      const gk = G.sk[f.src]; for (const [col, lw] of gk ? [[gk.col + '55', 16], [OUT, 7], [gk.col, 4]] : [[OUT, 7], ['#fff', 4]]) { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.moveTo(f.x0, f.y0); c.lineTo(f.x, f.y); c.stroke() }
      oval(c, f.x, f.y, 7, 7); c.fillStyle = gk?.col || '#fff'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.6; c.stroke()
      txt(c, tr`내놔!`, f.x, f.y - 14, 13, '#ffb3d1'); break
    }
    case 'swing': {   // 토벌봉 — 노란 봉, 양 끝에 불꽃
      const { ex, ey } = f
      const sk = G.sk[f.src]; c.lineCap = 'round'; c.beginPath(); c.moveTo(f.x - ex, f.y - ey); c.lineTo(f.x + ex, f.y + ey)
      if (sk) { c.globalAlpha = (1 - u) * 0.35; c.strokeStyle = sk.col; c.lineWidth = 24 * (1 - u) + 4; c.stroke() }   // 스킨 — 넓은 빛
      c.globalAlpha = (1 - u) * 0.6; c.strokeStyle = sk?.col2 || '#fff3c4'; c.lineWidth = 10 * (1 - u) + 2; c.stroke()
      c.globalAlpha = 1 - u; c.strokeStyle = OUT; c.lineWidth = 5; c.stroke(); c.strokeStyle = sk?.col || '#ffd54a'; c.lineWidth = 3; c.stroke()
      for (const s of [-1, 1]) flame(c, f.x + s * ex, f.y + s * ey, 6 + 4 * (1 - u))
      break
    }
    case 'wave': c.globalAlpha = 1 - u * 0.6; c.strokeStyle = f.col; c.lineWidth = 6; oval(c, f.x, f.y, f.R * u, f.R * u * 0.8); c.stroke(); c.globalAlpha = 0.12; c.fillStyle = f.col; c.fill(); break
    case 'hand': {   // 가위바위보 승부 — 보스 머리 위 손(흰 동그라미, 살짝 위아래로). 보스가 쓰러지면 지운다
      if (f.e.dead) break
      handAt(c, f.e.x, f.e.y - f.e.r * 2.6 * (f.e.sc || 1) - 78 + Math.sin(G.t * 6) * 3, f.hand, 32, OUT, '#fff'); break
    }
    case 'duel': for (const o of f.opts) { c.globalAlpha = 1 - u; c.fillStyle = o.hand === f.win ? '#3fae5a' : '#ff4d4d'; oval(c, o.x, o.y, 70, 56); c.fill() } c.globalAlpha = 1; break   // 쾅 — 정답 원 초록 · 나머지 빨강
    case 'shout': {   // 말풍선
      if (f.e.dead) break
      c.globalAlpha = 1 - Math.max(0, u - 0.8) / 0.2
      c.font = `14px ${FONT}`; const tw = c.measureText(f.s).width + 16, x = Math.max(cam.x - VW / 2 + tw / 2 + 8, Math.min(cam.x + VW / 2 - tw / 2 - 8, f.e.x)), y = f.e.y - f.e.r * 2.6 * (f.e.sc || 1) - 30, hot = f.col === 'new'   // 화면 끝에서 안 잘리게 · 무한 새 기술은 노란 풍선(디자인)
      c.fillStyle = hot ? '#ffd23f' : '#fff'; c.strokeStyle = OUT; c.lineWidth = hot ? 2.5 : 2; c.beginPath(); c.roundRect ? c.roundRect(x - tw / 2, y - 14, tw, 24, 10) : c.rect(x - tw / 2, y - 14, tw, 24); c.fill(); c.stroke()
      c.fillStyle = hot || f.col === '#fff' ? OUT : f.col; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(f.s, x, y - 2); c.textBaseline = 'alphabetic'
      break
    }
    case 'bye': c.globalAlpha = 1 - u; put(c, f.s, f.x, f.y - 6 - u * 90); break   // 세이렌이 쓰러지면 세이렌 · 검은 별똥별이 떠오르며 사라진다
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
  if (G.inf && G.loop.lv) {   // 무한 — 단계는 타이머 왼쪽 보라 알약에, 여기는 남은 것만
    const L = G.loop
    if (G.dark) return [tr`검은 별똥별! 세이렌을 쓰러뜨려요`, '#ff6b6b']
    if (G.final) { const left = INF.dark - (G.t - G.final.at); return [tr`검은 별똥별 ${fmt(Math.max(0, left))}`, left <= 60 ? '#ff6b6b' : '#fff'] }   // 1분 남으면 빨강
    const left = L.queue.length + L.spawned.filter(e => !e.dead).length
    return [L.queue.length ? tr`남은 보스 ${left} · 다음 무리 ${fmt(Math.max(0, L.next - G.t))}` : tr`남은 보스 ${left} — 다 쓰러뜨리면 세이렌!`, '#fff']
  }
  if (G.dark) return [tr`검은 별똥별! 쓰러뜨릴 수 없어요 — 30:00까지 ${fmt(Math.max(0, END_T - G.t))}`, '#c9b3ff']
  if (G.final) return [tr`최종보스! · 검은 별똥별까지 ${fmt(Math.max(0, DARK_T - G.t))}`, '#ff9be0']
  const nx = PLAN[G.pi]
  if (nx && nx[0] < FINAL_T) return [tr`다음 보스 ${BOSS[nx[1]].name}${nx[2] ? tr`(중간)` : ''} ${fmt(nx[0] - G.t)}`, '#fff']
  return [tr`최종보스 세이렌까지 ${fmt(Math.max(0, FINAL_T - G.t))}`, '#ff9be0']
}
/** 떠돌이 보물상자 표시(디자인 2026-11-18) — 일시정지 단추 바로 밑(모든 화면 같은 곳). 고리 = 앵커에서 1500 중 얼마나 왔나(금색 + 잉크 테),
 *  다 찼는데 기다리면 고리가 숨 쉬고, 쿨타임 중엔 아이콘을 흐리게 + 남은 초, 바닥에 상자가 있으면 통통 · 퍼지는 흰 고리 · 반짝 · 상자 쪽 화살촉(LQ · 움직임 줄이기면 멈춘 흰 고리 하나) */
const RM = matchMedia('(prefers-reduced-motion: reduce)')
function boxHud(c) {
  const b = PB ||= pauseBtn.getBoundingClientRect(); if (!b.width) { PB = null; return }
  const x = b.left + b.width / 2, y = b.bottom + 34, u = Math.min(1, Math.hypot(pl.x - G.anchor[0], pl.y - G.anchor[1]) / WANDER.d), cd = WANDER.gap - (G.t - G.lastBox), box = G.items.find(i => i.k === 'coinbox'), calm = LQ || RM.matches
  const ring = (r, col, lw, a0 = 0, a1 = TAU) => { c.strokeStyle = col; c.lineWidth = lw; c.beginPath(); c.arc(x, y, r, a0, a1); c.stroke() }
  c.save(); c.lineCap = 'round'
  c.globalAlpha = 0.85; c.fillStyle = '#fff'; oval(c, x, y, 15, 15); c.fill(); c.globalAlpha = 1
  ring(17, 'rgba(74,59,53,.22)', 4)
  if (u > 0) { const lw = u >= 1 && (cd > 0 || box) && !calm ? 4.5 + 0.5 * Math.sin(tnow * TAU / 1.2) : 4, a0 = -Math.PI / 2; ring(17, OUT, lw + 2.5, a0, a0 + u * TAU); ring(17, '#ffc93c', lw, a0, a0 + u * TAU) }
  if (box) {
    if (calm) ring(21, '#fff', 2.5)
    else { const f = tnow % 1; c.globalAlpha = 0.9 * (1 - f); ring(17 + 9 * f, '#fff', 2.5); c.globalAlpha = 1 }
    const a = Math.atan2(box.y - pl.y, box.x - pl.x), tip = (r, d) => [x + Math.cos(a + d) * r, y + Math.sin(a + d) * r]   // 상자 쪽 화살촉(고리 바깥)
    c.fillStyle = '#ffc93c'; c.strokeStyle = OUT; c.lineWidth = 1.5; c.beginPath(); c.moveTo(...tip(28, 0)); c.lineTo(...tip(22, 0.2)); c.lineTo(...tip(22, -0.2)); c.closePath(); c.fill(); c.stroke()
  }
  const sc = box && !calm ? 1 + 0.12 * Math.sin(Math.min(1, (tnow % 0.6) / 0.3) * Math.PI) : 1, cool = !box && cd > 0.5
  c.globalAlpha = cool ? 0.35 : 1; c.drawImage(SPR.E.coinbox.c, x - 11 * sc, y - 11 * sc, 22 * sc, 22 * sc); c.globalAlpha = 1
  if (cool) txt(c, String(Math.ceil(cd)), x, y + 5.5, 15)
  if (box) { const k = calm ? 1 : Math.abs(Math.sin(tnow * Math.PI)), sx = x + 11, sy = y - 11, R = 5 * k   // 네 갈래 반짝
    if (R > 0.5) { c.fillStyle = '#ffd23f'; c.strokeStyle = OUT; c.lineWidth = 1.5; c.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? R * 0.35 : R, aa = i * Math.PI / 4; c[i ? 'lineTo' : 'moveTo'](sx + Math.cos(aa) * rr, sy + Math.sin(aa) * rr) } c.closePath(); c.fill(); c.stroke() } }
  c.restore()
}
function hud(c) {
  const W = cv.width / DPR, H = cv.height / DPR
  c.fillStyle = 'rgba(74,59,53,.45)'; c.fillRect(0, 0, W, 10)
  c.fillStyle = '#7fd3ff'; c.fillRect(0, 0, W * Math.min(1, G.xp / G.next), 10)
  txt(c, `Lv ${G.lvl}`, 34, 32, 17)
  let [nl, nc] = nextLine(); c.font = `14px ${FONT}`
  const place = () => { const half = c.measureText(nl).width / 2 + 4; return Math.max(half, Math.min(W / 2, W - 172 - half)) }   // 좁은 화면 — 가운데 글자를 왼쪽으로 비켜 오른쪽 위 단추 셋(배속 · 소리 · 일시정지)과 안 겹치게
  let cx = place(), pill = null
  if (G.inf && G.loop.lv) {   // 무한 — 타이머 왼쪽 보라 알약 「∞ N단계」. 자리가 없으면(좁은 폰) 아래 줄 앞에 붙인다
    const ps = `∞ ${tr`${G.loop.lv}단계`}`; c.font = `15px ${FONT}`; const w = c.measureText(ps).width + 18; c.font = `26px ${FONT}`
    const x = cx - c.measureText(fmt(G.t)).width / 2 - 8 - w; c.font = `14px ${FONT}`
    if (x >= 74) pill = [ps, x, w]; else { nl = `${ps} · ${nl}`; cx = place() }
  }
  txt(c, fmt(G.t), cx, 38, 26); txt(c, nl, cx, 57, 14, nc); txt(c, tr`처치 ${G.kills}`, cx, 74, 12)
  if (pill) { const [ps, x, w] = pill; c.fillStyle = '#9b6bff'; c.strokeStyle = OUT; c.lineWidth = 2.5; c.beginPath(); c.roundRect(x, 20, w, 24, 12); c.fill(); c.stroke(); txt(c, ps, x + w / 2, 37.5, 15) }
  const top = W < 700 ? 84 : 44   // 좁은 화면(휴대폰)은 스킬 줄을 타이머 · 다음 보스 · 처치 글자 아래로 — 안 겹치게
  let x = 10
  for (const w of G.weapons) { const p = Math.max(0, 1 - (G.t - (w.fire ?? -9)) / 0.25); if (p) { c.globalAlpha = p * 0.7; c.fillStyle = '#fff'; oval(c, x + 13, top + 13, 17, 17); c.fill(); c.globalAlpha = 1 } c.drawImage(SPR.E[w.id].c, x - 3 * p, top - 3 * p, 26 + 6 * p, 26 + 6 * p); txt(c, G.aw.has(w.id) ? '★' : String(w.lv), x + 22, top + 26, 11, G.aw.has(w.id) ? '#ff9be0' : w.lv === 8 ? '#ffd23f' : '#fff'); x += 28 }
  x = 10
  for (const id in G.passives) { c.drawImage(SPR.E[id].c, x, top + 32, 20, 20); txt(c, String(G.passives[id]), x + 17, top + 52, 10); x += 22 }
  if (G.guardN) {   // 냄비뚜껑 방패 — 이번 판에 쌓인 피해 감소(디자인 — 보조 스킬 줄 끝 · 강철색, 주운 순간 0.3초 톡)
    const s = `−${Math.floor(guardCut() * 100)}%`; c.font = `12px ${FONT}`; const tw = c.measureText(s).width, gx = x + (x > 10 ? 4 : 0), gy = top + 31, w = 22 + tw + 8
    const k = LQ || RM.matches ? 1 : 1 + 0.25 * Math.max(0, 1 - (G.t - (G.guardT ?? -9)) / 0.3)
    c.save(); c.translate(gx + w / 2, gy + 11); c.scale(k, k); c.translate(-(gx + w / 2), -(gy + 11))
    c.fillStyle = '#6f8fb3'; c.strokeStyle = OUT; c.lineWidth = 2; c.beginPath(); c.roundRect(gx, gy, w, 22, 11); c.fill(); c.stroke()
    c.drawImage(SPR.E.guard.c, gx + 2, gy + 2, 18, 18); txt(c, s, gx + 22 + tw / 2, gy + 15.5, 12); c.restore()
  }
  let sy = top + 72
  if (CTRL?.push && CTRL.bot) sy += Math.max(0, CTRL.bot + 16 - sy) * CTRL.push   // 조작법 카드가 덮는 동안은 카드 밑으로
  for (const id in G.sts) { const left = G.sts[id] - G.t; if (left > 0) { txt(c, tr`${STATUS[id].name} ${Math.ceil(left)}초 — ${STATUS[id].note}`, W / 2, sy + 2, 13, STATUS[id].col, W - 16); sy += 18 } }
  if (G.storm.on > 0) { const n = Math.ceil(G.storm.on); txt(c, G.fire ? tr`눈보라 ${n}초 — 불꽃 옷: 받는 피해 그대로` : G.storm.warm ? tr`눈보라 ${n}초 — 몸이 따뜻해서 받는 피해 그대로` : tr`눈보라 ${n}초 — 받는 피해 +${Math.round((STORM.hurt - 1) * 100)}%`, W / 2, sy + 2, 13, G.fire || G.storm.warm ? '#ffb36b' : '#bfe6ff', W - 16); sy += 18 }
  if (G.winter && pl.idleT >= 3 && !G.dying) { txt(c, pl.idleT >= ICE.after ? tr`꽁꽁 얼어붙는 중 — 움직이면 풀려요` : tr`몸이 차가워져요 — 움직여요!`, W / 2, sy + 2, 13, '#9fd8ff', W - 16); sy += 18 }
  for (const h of G.help) { txt(c, tr`${h.k === 'pajama' ? tr`♪ 파자마 파티즈 공연` : tr`한잎이 · 두잎이가 지키는 중`} ${Math.ceil(h.T - h.t)}초`, W / 2, sy + 2, 13, h.k === 'pajama' ? '#ffb3e6' : '#b9f09a', W - 16); sy += 18 }
  boxHud(c)
  const boss = G.final ? alive(G.final.siren) : G.foes.find(e => e.boss && !e.dead)   // 보스 체력 — 아래에
  if (boss) {
    const bw = Math.min(420, W - 40), bx = (W - bw) / 2, by = H - 34
    c.fillStyle = OUT; c.fillRect(bx - 3, by - 3, bw + 6, 16)
    c.fillStyle = '#ff6b8b'; c.fillRect(bx, by, bw * Math.max(0, boss.hp / boss.max), 10)
    const g = boss.kind === 'siren' ? G.final.mermaids.filter(m => !m.dead && (!boss.ph || m.host === boss)).length : 0
    const ss = boss.ph ? G.final.sirens.filter(s => !s.dead) : [], dw = ss.length ? ss.length * 38 + (ss.length - 1) * 10 + 8 : 0
    const label = `${boss.mid ? tr`중간보스 ` : ''}${BOSS[boss.kind].name}${g ? tr` — 인어 ${g}마리가 지키는 중 (받는 피해 -50%)` : boss.rage ? tr` — 화남! 빨라졌어요` : boss.kind !== 'siren' && boss.kind !== 'mermaid' && boss.age > RAGE_T - 15 ? tr` — ${Math.ceil(RAGE_T - boss.age)}초 뒤 화내요` : ''}`
    c.font = `14px ${FONT}`; const lw = Math.min(c.measureText(label).width, W - 16 - dw), x0 = W / 2 - (dw + lw) / 2
    ss.forEach((s, j) => { for (let i = 0; i < 3; i++) {   // 페이즈 점 — 채운 점은 지금 페이즈 색, 새 점은 0.3초 톡 튄다
      const on = i < s.ph, r = 5 * (on && i === s.ph - 1 ? 1 + 0.6 * Math.max(0, 1 - (G.t - (s.phT ?? -9)) / 0.3) : 1)
      oval(c, x0 + j * 48 + i * 14 + 5, by - 13, r, r); c.fillStyle = on ? SIREN_PH[s.ph - 1].col : 'rgba(255,255,255,.5)'; c.fill(); c.strokeStyle = OUT; c.lineWidth = 1.5; c.stroke() } })
    txt(c, label, x0 + dw + lw / 2, by - 8, 14, g ? '#7fd8ff' : boss.rage ? '#ff6b6b' : '#fff', lw)
  }
  if (G.banner) { const b = G.banner; c.globalAlpha = Math.min(1, (b.T - b.t) * 3, b.t * 6); const fs = Math.min(30, W / 15); c.font = `${fs}px ${FONT}`; txt(c, b.s, W / 2, H * 0.3, fs * Math.min(1, (W - 24) / c.measureText(b.s).width), b.col); c.globalAlpha = 1 }   // 화면보다 길면 글자를 줄인다
  if (G.freeze > 0) txt(c, tr`멈춤 ${Math.ceil(G.freeze)}`, W / 2, H * 0.3 + 34, 16, '#ffc2e0')
  if (G.tip) { const b = G.tip; c.globalAlpha = Math.min(1, (b.T - b.t) * 3, b.t * 6); txt(c, b.s, W / 2, H * 0.3 + 40, 15, b.col, W - 24); c.globalAlpha = 1 }   // 작은 안내
  if (joy.on) {
    c.globalAlpha = 0.35; c.fillStyle = '#fff'; oval(c, joy.ox, joy.oy, 46, 46); c.fill(); c.strokeStyle = OUT; c.lineWidth = 2; c.stroke()
    c.globalAlpha = 0.75; oval(c, joy.px, joy.py, 20, 20); c.fill(); c.stroke(); c.globalAlpha = 1
  }
  if (pl.hp / S.maxHp < 0.3 && !G.won) {   // 체력이 낮으면 가장자리만 붉게 — 깜빡이지 않는다(눈 피로), 낮을수록 진하게
    const k = 1 - pl.hp / S.maxHp / 0.3, g = c.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.hypot(W, H) / 2)
    g.addColorStop(0, 'rgba(255,60,60,0)'); g.addColorStop(1, `rgba(255,60,60,${0.22 + 0.2 * k})`); c.fillStyle = g; c.fillRect(0, 0, W, H)
  }
}

// ---------------------------------------------------------------- 메뉴(HTML)
const btn = (s, fn, cls = '', key) => h('button', { type: 'button', class: `btn ${cls}`, onclick: fn }, s, key && h('kbd', {}, key))
function show(...kids) { ui.replaceChildren(...kids); ui.hidden = false; ui.scrollTop = 0; still = 2 }
/** 언어 고르기 — 처음 화면 오른쪽 위. 고르면 기억하고 다시 불러온다(모든 글 · 스킬이 그 말로) */
addEventListener('pointerdown', e => { const d = document.querySelector('.lang[open]'); if (d && !d.contains(e.target)) d.open = false })   // 바깥을 누르면 닫힌다
function langPick() {
  const [, name, fl] = LANGS.find(l => l[0] === LANG)
  return h('details', { class: 'lang' }, h('summary', { 'aria-label': 'Language' }, ic(fl), h('span', { class: 'lnm' }, ` ${name}`)),
    h('div', {}, LANGS.map(([code, nm, f]) => h('button', { type: 'button', lang: code, class: code === LANG ? 'on' : '', onclick: e => { save.lang = code; persist(); if (code !== LANG) location.reload(); else e.currentTarget.closest('details').open = false } }, ic(f), ` ${nm}`))))
}
function themePick() {   // 테마 — 처음 화면 왼쪽 위. 겨울(기본) · 풀밭(예전). 고르면 기억하고 바닥 · 적 그림만 다시 그린다
  return h('div', { class: 'theme', role: 'radiogroup', 'aria-label': tr`테마` }, [['winter', 'snow', tr`겨울`], ['grass', 'clover', tr`풀밭`]].map(([k, pic, name]) =>
    h('button', { type: 'button', role: 'radio', 'aria-checked': String(save.theme === k), class: save.theme === k ? 'on' : '', onclick: e => {
      if (save.theme === k) return
      save.theme = k; persist(); sprites(); SND.play(fieldSong()); pageColor()
      for (const b of e.currentTarget.parentNode.children) { const on = b === e.currentTarget; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)) }
    } }, ic(pic), ` ${name}`)))
}
function title() {
  if (mode === 'blocked') return
  if (SIM) simClose()   // 모의 토벌 중 다른 화면으로 — Math · 띠를 되돌린다
  SND.play(fieldSong())
  const again = !ui.hidden && !!ui.querySelector(':scope > .panel.home')   // 이미 처음 화면 — 계정을 불러온 뒤 · 로그인 · 닉네임 뒤 다시 그릴 때는 나타나는 연출(pop)을 빼서 두 번 번쩍이지 않게
  mode = 'title'; G = null; BOX = null; pauseBtn.hidden = true
  show(h('div', { class: 'panel home' + (again ? ' again' : '') }, themePick(), h('div', { class: 'corner' }, acctPick(), langPick()),
    h('div', { class: 'trio' }, CHARS.map(ch => portrait(ch.id))),
    h('h1', { class: 'logo' }, tr`먼작귀`, ' ', h('span', {}, tr`서바이버즈`)),   // 사이 띄어쓰기 — 글자로는 「먼작귀 서바이버즈」(구글 브랜드 인증이 홈페이지의 앱 이름과 맞춰 본다)
    LANG !== 'ko' && h('p', { class: 'appname', lang: 'ko' }, '먼작귀 서바이버즈'),   // 다른 말 화면도 앱 이름이 늘 보이게(기획 — 인증 · 검색)
    h('p', { class: 'sub' }, tr`먼가 작고 귀여운 녀석들의 토벌 생존기`),
    AUTH_ERR && h('p', { class: 'hint' }, tr`로그인하지 못했어요 — 잠시 뒤 다시 해 보세요`),
    SUSP ? h('p', { class: 'hint' }, tr`이 계정은 이용이 정지됐어요(번호 ${SUSP}) · 잘못 막혔다면 문의 메일로 알려 주세요`) : null,   // SUSP 는 숫자 — && 로 쓰면 0 이 글자로 찍힌다
    TAMPER && h('p', { class: 'hint' }, TAMPER === 'bak' ? tr`저장 기록이 게임 밖에서 바뀌어 바로 전 저장으로 되돌렸어요` : tr`저장 기록이 게임 밖에서 바뀌어 기록을 처음부터 시작해요`),
    h('div', { class: 'row' }, btn(tr`도감`, guide), btn(save.seen === PATCH_ID ? tr`패치노트` : h('span', {}, tr`패치노트`, h('mark', { class: 'new' }, 'NEW')), notes), btn(h('span', {}, tr`상점 `, ic('coin'), ` ${save.coin.toLocaleString()}`), () => shop()), btn(h('span', {}, tr`업적 `, medal('runs', 3), ` ${golds()}/${Object.keys(ACH).length}`), achs), btn(h('span', {}, ic('inf'), tr` 랭킹`), () => ranking()), btn(tr`토벌 시작!`, chars, 'main')),
    h('p', { class: 'rec' }, save.runs ? tr`토벌 ${save.runs}번 · 클리어 ${save.clears}번 · 쓰러뜨린 적 ${save.kills.toLocaleString()}` : tr`몰려오는 토벌 대상을 피해 다니면 스킬은 알아서 나가요. ${FINAL_T / 60}분 뒤 나타나는 세이렌을 쓰러뜨리면 클리어!`),
    h('p', { class: 'fine' }, tr`비공식 · 비영리 팬게임 — 원작 「ちいかわ」 © ナガノ`),
    STATS.url && h('p', { class: 'fine' }, tr`게임을 고치는 데 쓰려고 판마다 익명 통계(캐릭터 · 난이도 · 버틴 시간 · 쓰러진 원인)와 방문 통계(Google 애널리틱스)를 모아요 · `,
      auth ? tr`로그인 중에는 통계를 보내요` : h('button', { type: 'button', class: 'linkish', onclick: e => { save.noStats = !save.noStats; persist(); e.currentTarget.textContent = save.noStats ? tr`다시 보내기` : tr`보내지 않기` } }, save.noStats ? tr`다시 보내기` : tr`보내지 않기`)),
    h('p', { class: 'fine' }, tr`문의 `, h('a', { href: 'mailto:super.godbono@gmail.com' }, 'super.godbono@gmail.com'), ' · ', h('a', { href: '?terms', class: 'linkish', onclick: e => { e.preventDefault(); terms() } }, tr`이용약관`), ' · ', h('a', { href: '?privacy', class: 'linkish', onclick: e => { e.preventDefault(); privacy() } }, tr`개인정보 처리방침`))))
}
/** 캐릭터 고르기 — 화면을 다시 그리지 않고 고른 표시만 옮긴다(누를 때마다 깜빡이지 않게). 놓은 캐릭터는 서 있는 그림으로 */
function pickChar(i) {
  const cards = ui.querySelectorAll('.char'), old = cards[pickCi], c = old?.querySelector('canvas')
  if (old) old.classList.remove('on')
  if (c?._idle) { const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); g.drawImage(c._idle, 0, 0) }
  pickCi = i; cards[i]?.classList.add('on'); autoSync()
}
const bestText = id => { const b = save.best[bestKey(id, save.diff)]; return b ? tr`최고 ${fmt(b.t)} · 레벨 ${b.lvl}${b.clears ? tr` · 클리어 ${b.clears}번` : ''}` : tr`아직 기록 없음` }
function pickDiff(k) {   // 다시 그리지 않고 단추 · 설명 · 기록 글자만 바꾼다(깜빡임 없이)
  save.diff = k; persist()
  for (const b of ui.querySelectorAll('.diff button')) { const on = b.dataset.k === k; b.classList.toggle('on', on); b.setAttribute('aria-checked', String(on)) }
  for (const n of ui.querySelectorAll('.diff-note span')) n.classList.toggle('on', n.dataset.k === k)
  ui.querySelectorAll('.char .best').forEach((el, i) => { el.textContent = bestText(CHARS[i].id) })
}
function chars() {
  if (SIM) simClose()
  mode = 'chars'; G = null
  show(h('div', { class: 'panel wide pick charpick' },
    h('p', { class: 'h' }, tr`누구랑 토벌할까?`),
    h('div', { class: 'chars scroll' }, CHARS.map((ch, i) => {
      const W = WEAP[ch.w]
      return h('button', { type: 'button', class: `char${i === pickCi ? ' on' : ''}`, onclick: () => pickCi === i ? startGame(i) : pickChar(i) },
        portrait(ch.id), h('b', {}, ch.name), h('small', {}, ic(ch.w), ` ${W.name}`), h('span', { class: 'trait' }, ch.trait), h('span', { class: 'note' }, ch.note),
        h('span', { class: 'best' }, bestText(ch.id)))
    })),
    h('div', { class: 'diff', role: 'radiogroup', 'aria-label': tr`난이도` }, Object.entries(DIFF).map(([k, d]) => h('button', { type: 'button', role: 'radio', 'aria-checked': String(k === save.diff), class: k === save.diff ? 'on' : '', 'data-k': k, onclick: () => pickDiff(k) }, [ic(k), ` ${d.name}`]))),
    h('p', { class: 'diff-note' }, Object.entries(DIFF).map(([k, d]) => h('span', { class: k === save.diff ? 'on' : '', 'data-k': k }, d.note, d.inf && save.noStats && !auth && tr` · 통계를 켜야 해요`))),   // 설명을 겹쳐 두고 고른 것만 — 높이가 그대로라 아래 단추가 출렁이지 않는다
    h('div', { class: 'pick-sub' }, h('button', { type: 'button', class: 'btn sim', onclick: simOpen }, tr`모의 토벌`), autoSwitch(true)),   // AI 대원이 대신(무한도) · 작전대로 자동 선택(사용자 2026-11-20)
    h('div', { class: 'row' }, btn(tr`← 처음으로`, title), btn(tr`토벌 시작!`, () => startGame(pickCi), 'main'))))
}
// ---------------------------------------------------------------- 모의 토벌(사용자 · 기획 · 디자인 2026-11-20)
//   작전(캐릭터 · 난이도 · 맵 · 무기 · 보조 순서 · 성향)대로 AI 대원이 싸우는 한 판을 3배속으로 지켜본다(frame → simWatch). 1/20초 고정 걸음 — 기기가 느리면 결과는 그대로 · 느리게만
//   전장(시드) — 판마다 무작위, 「같은 전장에서 다시」면 그대로(같은 작전 · 같은 전장 = 같은 결과). 기준 조건(상점 강화 · 의상 보유 효과 · 스킨 없이 · 기본 옷)
//   보상금: 끝까지 지켜본 판만 — 진짜 판 정산식(버틴 시간 · 처치 · 보스 · 클리어 × 난이도)의 20%, 한 판 150 · 하루 3판(기기 날짜). 건너뛰기 · 그만두기는 0
//   그 밖은 없음: 업적 · 클리어 의상 · 랭킹 · 통계 · 서버 요청 — finish 를 타지 않는다(보상금은 보통 저장으로만). 부정 신호(foul · guard)는 끈다(보상은 한 판 · 하루 상한으로 막는다)
//   고르기: 목록에서 가장 앞 → 가진 것 레벨업 → 목록 밖 새 것은 예약하지 않은 빈칸이 있을 때만 → 리롤 → 스킵 → 그래도 없으면 받기(「목록 밖」). 각성 · 상자는 늘 받는다
const SIM_DT = 1 / 20, SIM_AI = 0.1, SIM_X = 3, SIM_INF_T = 60 * 60, SIM_PAY = { cut: 0.2, max: 150, day: 3 }, SIM_KEY = 'mjg.sim'
/** 엔진마다 같은 값 — 모의 토벌 계산 동안만 Math 의 sin · cos · atan2 · hypot · exp 를 + − × ÷ · sqrt 로만 짠 것(fdlibm 계수)으로 바꿔 끼운다.
 *  크롬(V8) · 사파리(JSC) · 파이어폭스는 이 함수들의 마지막 자리가 달라 몇만 걸음 뒤 결과가 갈렸다(모의 토벌 랭킹 「같은 작전 · 전장 = 같은 결과」 · 기획) */
const DM = (() => {
  const P1 = 1.57079632673412561417, P1T = 6.07710050650619224932e-11, I2P = 6.36619772367581382433e-01, sq = Math.sqrt, rd = Math.round
  const ks = x => { const z = x * x; return x + x * z * (-1.66666666666666324348e-01 + z * (8.33333333332248946124e-03 + z * (-1.98412698298579493134e-04 + z * (2.75573137070700676789e-06 + z * (-2.50507602534068634195e-08 + z * 1.58969099521155010221e-10))))) }
  const kc = x => { const z = x * x; return 1 - 0.5 * z + z * z * (4.16666666666666019037e-02 + z * (-1.38888888888741095749e-03 + z * (2.48015872894767294178e-05 + z * (-2.75573143513906633035e-07 + z * (2.08757232129817482790e-09 + z * -1.13596475577881948265e-11))))) }
  const sin = x => { const n = rd(x * I2P), y = x - n * P1 - n * P1T, q = n & 3; return q === 0 ? ks(y) : q === 1 ? kc(y) : q === 2 ? -ks(y) : -kc(y) }
  const cos = x => { const n = rd(x * I2P), y = x - n * P1 - n * P1T, q = n & 3; return q === 0 ? kc(y) : q === 1 ? -ks(y) : q === 2 ? -kc(y) : ks(y) }
  const AH = [4.63647609000806093515e-01, 7.85398163397448278999e-01, 9.82793723247329054082e-01, 1.57079632679489655800e+00], AL = [2.26987774529616870924e-17, 3.06161699786838301793e-17, 1.39033110312309984516e-17, 6.12323399573676603587e-17]
  const T = [3.33333333333329318027e-01, -1.99999999998764832476e-01, 1.42857142725034663711e-01, -1.11111104054623557880e-01, 9.09088713343650656196e-02, -7.69187620504482999495e-02, 6.66107313738753120669e-02, -5.83357013379057348645e-02, 4.97687799461593236017e-02, -3.65315727442169155270e-02, 1.62858201153657823623e-02]
  const atan = x => { const neg = x < 0; let a = neg ? -x : x, id = -1
    if (a >= 0.4375) { if (a < 1.1875) { if (a < 0.6875) { id = 0; a = (2 * a - 1) / (2 + a) } else { id = 1; a = (a - 1) / (a + 1) } } else if (a < 2.4375) { id = 2; a = (a - 1.5) / (1 + 1.5 * a) } else { id = 3; a = -1 / a } }
    const z = a * a, w = z * z, s1 = z * (T[0] + w * (T[2] + w * (T[4] + w * (T[6] + w * (T[8] + w * T[10]))))), s2 = w * (T[1] + w * (T[3] + w * (T[5] + w * (T[7] + w * T[9]))))
    const r = id < 0 ? a - a * (s1 + s2) : AH[id] - ((a * (s1 + s2) - AL[id]) - a); return neg ? -r : r }
  const atan2 = (y, x) => x > 0 ? atan(y / x) : x < 0 ? (y >= 0 ? atan(y / x) + Math.PI : atan(y / x) - Math.PI) : y > 0 ? Math.PI / 2 : y < 0 ? -Math.PI / 2 : 0
  const hypot = (a, b, c) => c === undefined ? sq(a * a + b * b) : sq(a * a + b * b + c * c)
  const exp = x => { let k = 0; while (x > 0.5 || x < -0.5) { x /= 2; k++ } let t = 1, s = 1; for (let i = 1; i < 18; i++) { t *= x / i; s += t } while (k--) s *= s; return s }
  return { sin, cos, atan2, hypot, exp }
})()
const MATH0 = { sin: Math.sin, cos: Math.cos, atan2: Math.atan2, hypot: Math.hypot, exp: Math.exp }
const dmOn = () => Object.assign(Math, DM), dmOff = () => Object.assign(Math, MATH0)
/** 계산용 화면 크기 — 스폰 반지름 · 화면 안(onScreen) · 돌격대 줄 · 멀리 간 적 지우기 등이 VW · VH 를 쓴다. 모의 토벌 계산 동안만 고정(1280×800 · 배율 1 기준)해 휴대폰 · PC · 확대가 달라도 같은 결과(QA). 관전 그리기는 진짜 화면 그대로 */
const SIM_VIEW = [728, 455]
function simCalc(f) { const vw = VW, vh = VH, keep = rnd; VW = SIM_VIEW[0]; VH = SIM_VIEW[1]; rnd = SIM.rng; try { return f() } finally { VW = vw; VH = vh; rnd = keep } }   // 모의 토벌 판 동안만(simNew → simClose). 진짜 판은 늘 원래 Math(startGame 에서 한 번 더 되돌림)
/** 이번 주 전장(모의 토벌 랭킹) — 2026-11-16(월) 0시 KST 부터 몇째 주 · 전장 = 1 + (주 × 617 + 211) % 999(서버 sim_wk · sim_field 와 같은 식). 월요일 0시 KST 에 바뀐다 */
const SIM_W0 = Date.UTC(2026, 10, 16) - 9 * 3600e3, SIM_RK = ['inf']   // 랭킹 판 — 무한만(사용자 2026-11-22)
const simWeek = (now = Date.now()) => { const wk = Math.floor((now - SIM_W0) / (7 * 864e5)); return { wk, field: 1 + ((wk * 617 + 211) % 999 + 999) % 999, ends: SIM_W0 + (wk + 1) * 7 * 864e5 } }
const simLeft = () => { const m = Math.max(0, (simWeek().ends - Date.now()) / 6e4 | 0), d = m / 1440 | 0, hh = (m % 1440) / 60 | 0; return d ? tr`${d}일 ${hh}시간` : tr`${hh}시간 ${m % 60}분` }   // 새 전장까지 — 시간대와 상관없이 남은 시간으로(디자인)
const simStore = () => { try { return JSON.parse(localStorage.getItem(SIM_KEY)) || {} } catch { return {} } }
const simKeep = d => { try { localStorage.setItem(SIM_KEY, JSON.stringify(d)) } catch {} }   // 작전 · 최근 결과 · 첫 안내 — save 와 따로(서명 · 계정 동기화에 안 섞인다)
const simLog = (k, id) => SIM.log.push({ t: G.t, k, id })
const simHas = o => o.t === 'w' ? G.weapons.some(w => w.id === o.id) : o.t === 'p' ? o.id in G.passives : false
const simInList = o => (o.t === 'w' ? SIM.plan.w : SIM.plan.p).includes(o.id)
const simDay = () => new Date().toLocaleDateString('sv')   // 기기 날짜 YYYY-MM-DD
const simPaid = () => save.simPay?.d === simDay() ? save.simPay.n : 0   // 오늘 받은 판 수
const SIM_TAG = { book: tr`부채꼴`, pile: tr`덫`, sasu: tr`꿰뚫기`, stick: tr`양끝 폭발`, yaha: tr`충격파`, ura: tr`둘레 피해`, weed: tr`발밑 폭발`, tears: tr`물폭탄`, guitar: tr`도는 음표`, nantoka: tr`번개`, ramen: tr`느린 장판`, curry: tr`큰 폭발`, pochette: tr`부메랑`, momo: tr`보스 한 방`, kanpai: tr`튕기기`, sword: tr`일직선 베기`, license: tr`힘↑`, armor: tr`받는 피해↓`, manju: tr`체력↑`, pudding: tr`회복↑`, clock: tr`더 자주`, mega: tr`범위↑`, slipper: tr`이동↑`, wind: tr`탄 속도↑`, bento: tr`더 오래`, double: tr`개수 +1`, pouch: tr`줍기↑`, clover: tr`행운↑`, wage: tr`경험치↑` }   // 작전 짜기 아이콘 밑 짧은 글 — 그 스킬만의 특징 · 서로 안 헷갈리게 · 아이가 읽게(사용자 · 기획 · 디자인 — ko · ja · zh 한 줄 4자 · en 8자, 두 줄까지)
const STYLE = { move: { name: tr`이동형`, note: tr`넓게 돌며 보석과 아이템을 줍고, 적 떼를 끌고 다녀요.` }, stay: { name: tr`정착형`, note: tr`한자리를 지키며 다가오는 것만 피해요. 줍기 범위 · 자석 빌드와 잘 맞아요.` } }
function simFree(t) { const list = t === 'w' ? SIM.plan.w : SIM.plan.p, own = t === 'w' ? G.weapons.map(w => w.id) : Object.keys(G.passives); return 6 - own.length - list.filter(id => !own.includes(id)).length > 0 }   // 목록이 예약하지 않은 빈칸
function simChoose(opts) {
  const order = [...SIM.plan.w.map(id => 'w' + id), ...SIM.plan.p.map(id => 'p' + id)]
  let best = null, bi = 1e9
  for (const o of opts) { const i = order.indexOf(o.t + o.id); if (i >= 0 && i < bi) { bi = i; best = o } }
  if (best) return best
  const up = opts.find(o => (o.t === 'w' || o.t === 'p') && simHas(o)); if (up) return up
  const mates = new Set(G.weapons.map(w => mateOf(w.id))), fresh = opts.filter(o => (o.t === 'w' || o.t === 'p') && !simHas(o) && simFree(o.t))
  if (fresh.length) return fresh.find(o => mates.has(o.id)) || fresh[0]   // 작전에 없는 빈칸 — 짝꿍부터
  const f = opts.filter(o => o.t === 'f'); if (f.length) return f.find(o => o.id === 'onigiri' && pl.hp < S.maxHp * 0.6) || f.find(o => o.id !== 'onigiri') || f[0]
  return null
}
function simTake(o) {
  const fresh = (o.t === 'w' || o.t === 'p') && !simHas(o), free = fresh && simFree(o.t)   // free — 작전이 예약하지 않은 빈칸을 채움(「빈칸은 AI 대원이 알아서」 — 목록 밖이 아니다 · 디자인)
  take(o)
  if (o.t === 'a') simLog('aw', o.id)
  else if (fresh) { simLog(simInList(o) || free ? 'new' : 'off', o.id); if (o.t === 'w' && G.weapons.some(w => w.id === mateOf(o.id))) simLog('mate', o.id) }
  else if (o.t === 'w' || o.t === 'p') simLog('up', o.id)
  if (SIM.watch && SIM.spec.firstChild && (o.t === 'w' || o.t === 'p' || o.t === 'a')) simShow(o)   // 관전 띠가 있을 때만(시험 · 건너뛰기는 그냥)
}
function simShow(o) {   // 관전 띠 1줄 — 방금 고른 것 하나만 바꿔 끼우고 pop(디자인 — 창 · 머리 위 효과 없이)
  const aw = o.t === 'a', lv = o.t === 'w' ? G.weapons.find(w => w.id === o.id)?.lv : G.passives[o.id]
  const name = aw ? AW[o.id]?.name ?? o.id : `${o.t === 'w' ? WEAP[o.id].name : PASS[o.id].name} Lv ${lv}`
  const el = SIM.spec.firstChild; el.replaceChildren(h('span', { class: `ai${aw ? ' aw' : ''}` }, aw ? tr`각성` : tr`AI 대원`), icSafe(aw ? 'awaken' : o.id) || '', h('span', { class: 'what' }, name))
  el.classList.remove('new'); void el.offsetWidth; el.classList.add('new')
}
function simBox() {   // 상자 창 대신 — 작전대로 고르고 이어 간다(창이 닫힐 때처럼 숨 돌릴 틈도)
  while (G.queue.length) {
    const kind = G.queue.shift()
    if (kind === 'awaken') { const o = awOffers()[0]; if (o) simTake(o); continue }
    if (kind === 'level') pl.hp = Math.min(S.maxHp, pl.hp + Math.round(S.maxHp * 0.1))
    const jack = rnd() < (kind === 'chest' ? 0.5 : 0.01 * S.luck * (G.ch.mod.jackpot ? 2 : 1))
    let opts = offers()
    if (jack) { G.jackpots++; opts.forEach(simTake); continue }
    for (;;) {
      const o = simChoose(opts); if (o) { simTake(o); break }
      if (G.rr > 0) { G.rr--; opts = offers(); continue }
      if (G.skips > 0) { G.skips--; break }
      if (opts[0]) simTake(opts[0]); break   // 드물게 — 목록 밖이어도 받는다
    }
  }
  breather()
}
/** AI 대원(사용자 「대폭 똑똑하게」 2026-11-20) — 0.1초마다 방향 24개(+ 멈춤)마다 1초 앞까지 내 길을 그려 보고 고른다
 *  위험(맞으면 지금 체력에 비해 아플수록 · 체력이 낮을수록 더 조심, 무적 0.8초 동안은 덜): 날아오는 것은 직선 — 내 길과 가장 가까워지는 때를 바로 계산(사이로 빠져나가지 않게),
 *  장판(폭탄 · 내려찍기 · 가위바위보 · 띠 · 돌격대 · 큰 파도)은 터지는 때 내가 어디 있을지, 적은 쫓아오는 · 돌진(멈칫 → 직선) · 뛰어오르기 · 돌격대 직선을 따라 앞날 자리, 상태이상 물결, 적 떼 사이(빈 곳 쪽)
 *  보상: 체력이 낮으면 오니기리(멀리도 · 길이 안전하면), 보석 · 아이템, 하던 방향. 이동형은 넓게 · 정착형은 집 둘레 */
function simAI() {
  const stay = SIM.plan.s === 'stay', hpF = pl.hp / S.maxHp, risk = 1 + (1 - hpF) * 2.5
  const v = 150 * S.move * (sick('charm') ? 0.6 : 1) * (pl.slowT > 0 ? 0.65 : 1), TS = [0.1, 0.2, 0.35, 0.5, 0.7, 1]
  const hurt = (d, t) => pl.inv > t ? 0 : (8 + 320 * d * G.D.dmg / Math.max(1, pl.hp)) * risk   // 그때 무적이면 0
  const by = (a, R) => a.filter(o => !o.dead && Math.abs(o.x - pl.x) < R && Math.abs(o.y - pl.y) < R)
  const foes = by(G.foes, 480).map(e => [e, (e.x - pl.x) ** 2 + (e.y - pl.y) ** 2]).sort((a, b) => a[1] - b[1]).slice(0, 70).map(q => q[0])
  const shots = by(G.eshots, 700), haz = G.haz.filter(z => !z.dead && z.k !== 'pool' && z.k !== 'fence'), waves = G.fx.filter(f => f.k === 'wave' && !f.done)
  const items = by(G.items, 2000), gems = by(G.gems, stay ? 160 : 560).slice(0, 150), home = SIM.home
  // 아이템 — 줍는 순간 쓰이니 「언제 줍나」가 쓰는 법(사용자 「주변 아이템도 잘 응용」): 지금 쓸모 있으면 가치, 아니면 아껴 두고 밟지 않게 돌아간다(음수)
  const crowd = foes.filter(e => !e.rush && (e.x - pl.x) ** 2 + (e.y - pl.y) ** 2 < 300 * 300).length, bossNear = foes.some(e => e.boss && (e.x - pl.x) ** 2 + (e.y - pl.y) ** 2 < 420 * 420)
  const ill = sick('charm') || sick('weak'), danger = hpF < 0.4 || crowd >= 25 || bossNear && hpF < 0.7, farGems = G.gems.filter(o => (o.x - pl.x) ** 2 + (o.y - pl.y) ** 2 > S.magnet * S.magnet * 4).length
  const ITEM_W = { awaken: 12, chest: 8, guard: 8, coinbox: 3,   // 각성의 별 · 상자 · 방패는 멀리서도 늘
    onigiri: hpF < 0.35 ? 30 : hpF < 0.6 ? 14 : hpF < 0.85 ? 2 : -1,   // 체력이 꽉 차면 아껴 둔다
    magnet: farGems >= 40 ? 6 : -1, firework: crowd >= 25 || bossNear ? 9 : -1, momonga: danger ? 9 : -1, pajama: crowd >= 15 ? 6 : -1,
    battery: shots.length >= 4 || bossNear ? 6 : -1, earplug: ill ? 12 : hpF < 0.85 ? 3 : -1 }
  const fetch = items.some(it => (ITEM_W[it.k] ?? 0) >= 8)   // 정착형도 각성의 별 · 상자 · 방패 · 급한 것은 주우러 간다
  const foeAt = (e, t, tx, ty) => {   // 적의 t 초 뒤 자리 — 멈춘 동안(얼음 · 귀여운 척)은 그대로
    if (G.freeze > t && !e.rush) return [e.x, e.y]
    if (e.leap) { const L = e.leap, r = L.T - L.t; return t < r ? null : [L.x1, L.y1] }   // 뛰어오른 동안은 안 닿는다
    if (e.rush) return [e.x + e.rush[0] * t, e.y + e.rush[1] * t]
    if (e.act) return [e.x, e.y]
    if (e.st === 'wind' || e.st === 'dash') { const w = e.st === 'wind' ? e.stT : 0, m = Math.max(0, Math.min(t - w, e.st === 'dash' ? e.stT : 0.75)) * e.spd * 4; return [e.x + e.dx * m, e.y + e.dy * m] }
    const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1, m = Math.min(d, e.spd * t); return [e.x + dx / d * m, e.y + dy / d * m]
  }
  const sir = sick('charm') && alive(G.final?.siren), drag = sir ? toward(sir).map(q => q * 55) : [0, 0]
  if (stay) { const d = Math.hypot(pl.x - home[0], pl.y - home[1]); if (d > 160) { const k = 0.02 * (d - 160) / d; home[0] += (pl.x - home[0]) * k; home[1] += (pl.y - home[1]) * k } }   // 크게 밀려나면 집도 조금씩 따라온다
  const score = (cx, cy) => {
    const vx = cx * v + drag[0], vy = cy * v + drag[1], P = t => [pl.x + vx * t, pl.y + vy * t]   // 매혹이면 세이렌 쪽으로 끌려가는 것까지
    let c = 0
    for (const b of shots) {   // 날아오는 것 — 둘 다 직선이니 1초 안에 가장 가까워지는 때를 바로
      const w = G.freeze > 0 ? 1 : Math.min(1, b.wait || 0), life = b.life - b.t; if (life <= 0) continue
      const x0 = b.x - pl.x - vx * w, y0 = b.y - pl.y - vy * w, rx = b.vx - vx, ry = b.vy - vy, rr = rx * rx + ry * ry, T = Math.min(1, life) - w
      if (T <= 0) continue
      const t = rr ? Math.max(0, Math.min(T, -(x0 * rx + y0 * ry) / rr)) : 0, dx = x0 + rx * t, dy = y0 + ry * t, R = pl.r + (b.r || 6) + 6
      if (dx * dx + dy * dy < R * R) c += hurt(b.dmg, w + t) * (1.3 - 0.5 * (w + t))
    }
    for (const z of haz) {
      const rem = z.T - z.t
      if (z.k === 'tide') { if (z.hit) continue; for (const t of TS) { const tt = z.t + t; if (tt <= 1.2) continue; const [x, y] = P(t), p = z.from + z.dir * 240 * (tt - 1.2), q = ((z.horiz ? x : y) - p) * z.dir; if (q <= 0 && q > -95 && Math.abs((z.horiz ? y : x) - z.gap) >= 58) { c += hurt(z.dmg, t); break } } continue }
      if (rem < -0.05) continue
      const soon = rem <= 1, k = soon ? 1 : 0.4, [x, y] = P(Math.max(0, Math.min(rem, 1)))
      if (z.k === 'rush') { for (const t of TS) { if (t < rem - 0.05 && soon) continue; const [x, y] = P(soon ? t : 1), off = Math.abs((z.horiz ? y : x) - z.gap); if (off > 30) { c += hurt(z.dmg, Math.max(t, rem)) * k + off / 40; break } } continue }   // 빈 줄에 들어가 있기
      if (z.k === 'band') {
        const cs = Math.cos(z.a), sn = Math.sin(z.a)
        for (const t of z.lane ? TS : [Math.max(0, Math.min(rem, 1))]) {
          if (z.lane && t < rem - 0.05 && soon) continue
          const [x, y] = P(z.lane && !soon ? 1 : t), dx = x - z.x, dy = y - z.y, al = dx * cs + dy * sn, sd = Math.abs(-dx * sn + dy * cs)
          if (z.lane ? al > -z.lane * 44 - 30 && sd < 11 + pl.r + 10 : al > -pl.r - 8 && al < z.L + pl.r + 8 && sd < z.W / 2 + pl.r * 0.5 + 8) { c += hurt(z.dmg, Math.max(t, rem)) * k + (z.lane ? 0 : (z.W / 2 - sd) / 20); break }
        }
        continue
      }
      const left = soon ? 0 : v * (rem - 1) + 1   // 1초 뒤 남은 시간에 더 갈 수 있는 거리
      let deep
      if (z.k === 'duel') { const o = z.opts.find(o => o.hand === z.win); if (!o) continue; deep = (Math.sqrt(((x - o.x) / 60) ** 2 + ((y - o.y) / 46) ** 2) - 1) * 46 }   // 이기는 손 원까지 남은 거리
      else { const R = (z.R || 60) + 4 + 10; deep = (1 - Math.sqrt(((x - z.x) / R) ** 2 + ((y - z.y) / (R * 0.8)) ** 2)) * R * 0.8 }   // 장판 안쪽 깊이(짧은 쪽 반지름으로)
      if (deep > 0) c += soon ? hurt(z.dmg, rem) + deep / 8 : hurt(z.dmg, rem) * Math.min(1, deep / left) * 0.8   // 터질 때 안 — 늦으면 아프게, 아직 시간이 있으면 빠져나갈 길이 짧은 쪽
    }
    for (const f of waves) for (const t of TS) { const [x, y] = P(t); if (Math.hypot(x - f.x, (y - f.y) / 0.8) <= f.R * Math.min(1, (f.t + t) / f.T)) { c += (f.st === 'charm' ? 30 : 12) * risk; break } }   // 상태이상 물결(매혹은 끌려가 떼에 갇힌다)
    for (const e of foes) {   // 닿기 — 앞날 자리는 보스 · 돌격대만(보통 적은 아래 「적 떼 사이」 — 스킬에 금방 쓰러지니 겁먹지 않게)
      if (!e.boss && !e.rush) continue
      const R = e.r + pl.r + 4, dm = e.boss ? Math.max(e.dmg, S.maxHp * (e.mid ? 0.08 : 0.1)) * (e.rage ? 1.4 : 1) * (e.st === 'dash' ? 1.5 : 1) : e.dmg
      for (const t of TS) { const [x, y] = P(t), q = foeAt(e, t, x, y); if (q && (x - q[0]) ** 2 + (y - q[1]) ** 2 < R * R) { c += hurt(dm, t) * (1.3 - 0.5 * t); break } }
    }
    const [mx, my] = P(0.4), calm = 1 + (1 - hpF)
    for (const e of foes) {   // 적 떼 사이 — 가까운 적, 아픈 적일수록(지금 체력에 비해) 더 멀리. 약한 적에게는 용감하게(보석)
      if (e.rush) continue
      const dk = e.boss ? 3 : Math.min(3, 0.5 + 3 * e.dmg * G.D.dmg / Math.max(1, pl.hp))
      for (const [t, k] of [[0.3, 1], [0.63, 0.6]]) { const [x, y] = P(t), d = Math.hypot(x - e.x, y - e.y) - (e.r || 14) - pl.r; c += k * calm * dk * (d < 6 ? 60 : 900 / (d * d + 120)) }   // 지금 자리(쫓아오는 앞날 자리로 재면 겁이 많아져 보석을 못 줍는다 — 시험)
    }
    if (stay && !fetch) { const [x, y] = P(1), d = Math.hypot(x - home[0], y - home[1]); if (d > 70) c += ((d - 70) / 60) ** 2 }
    let g = 0
    for (const o of gems) { const d = Math.hypot(mx - o.x, my - o.y); g += 0.6 / (1 + d / 70) }
    for (const it of items) {
      const w = ITEM_W[it.k] ?? 1.5, [x, y] = P(1), d = Math.hypot(x - it.x, y - it.y), d0 = Math.hypot(pl.x - it.x, pl.y - it.y)
      if (w < 0) { if (d0 < 200) for (const t of TS) { const [x, y] = P(t); if (Math.hypot(x - it.x, y - it.y) < pl.r + 22) { c += 4; break } } continue }   // 아껴 두는 것 — 밟지 않게
      if (d0 < (w >= 8 ? 2000 : stay ? 260 : 900)) g += w / (1 + d / 120)
    }
    return g - c
  }
  let ux = 0, uy = 0, local = 0   // 이동형 — 가까이 보석이 없으면 보석이 쌓인 쪽으로(떨어진 보석 수에 한도가 있어 두고 가면 더 안 생긴다)
  if (!stay) { for (const o of G.gems) { const dx = o.x - pl.x, dy = o.y - pl.y, d = Math.hypot(dx, dy) || 1; if (d < 250) local++; ux += dx / d / (1 + d / 400); uy += dy / d / (1 + d / 400) } const n = Math.hypot(ux, uy) || 1; ux /= n; uy /= n }
  const pull = stay || local >= 6 ? 0 : 1.4
  let best = -1e9, bx = 0, by2 = 0, ba = SIM.a || 0
  for (let i = 0; i < 24; i++) {
    const a = i / 24 * TAU, cx = Math.cos(a), cy = Math.sin(a), sc = score(cx, cy) + (stay ? 0.25 : 0.6) * Math.cos(a - (SIM.a || 0)) + pull * (cx * ux + cy * uy)   // 떨지 않게 — 하던 방향 유지
    if (sc > best) { best = sc; bx = cx; by2 = cy; ba = a }
  }
  if (!G.winter || pl.idleT < 3) { const sc = score(0, 0) + (stay ? 0.6 : 0); if (sc > best) return [0, 0] }   // 멈춤도 한 가지 길(겨울은 3초 넘게 서 있으면 언다)
  SIM.a = ba; return [bx, by2]
}
function simStep() {
  if (G.t >= SIM.aiT) { [SIM.dx, SIM.dy] = simCalc(simAI); SIM.aiT = G.t + SIM_AI }
  joy.x = SIM.dx; joy.y = SIM.dy; key.u = key.d = key.l = key.r = 0   // 그동안 누른 키가 끼어들지 않게(같은 전장 = 같은 결과)
  if (G.t + SIM_DT >= (G.inf ? SIM_INF_T : END_T)) return simEnd('time')   // 30분 — 검은 별똥별에게서 끝까지 버팀(finish 를 타지 않게 먼저). 무한은 쓰러질 때까지(안전 상한 SIM_INF_T)
  const b0 = G.bosses, sl = { ...G.slain }
  simCalc(() => step(SIM_DT))   // 시드 무작위 · 계산용 화면 크기는 계산 안에서만 — 화면 그리기 · 다른 타이머가 끼어들지 않게(던져도 되돌린다 · QA)
  if (G.bosses > b0) simLog('boss', Object.keys(G.slain).find(k => (G.slain[k] || 0) > (sl[k] || 0)) || 'siren')
  if (G.dying > 0) return simEnd('dead')
  if (G.t >= SIM.hpT) { SIM.hp.push([G.t, pl.hp / S.maxHp]); SIM.hpT = G.t + 0.5 }   // 체력 — 0.5초마다(가장 낮은 때를 고르려고)
  if (G.won) return simEnd('win')
}
function simEnd(kind) {
  const low = SIM.hp.filter(([t]) => t > 2 && (kind !== 'dead' || t < G.t - 10)).sort((a, b) => a[1] - b[1])[0]   // 쓰러진 판은 마지막 10초를 빼고 — 위험했지만 버틴 순간
  if (low) SIM.log.push({ t: low[0], k: 'low', v: Math.max(0, Math.round(low[1] * 100)) })
  if (kind === 'dead') SIM.log.push({ t: G.t, k: 'dead', id: G.killerT, s: G.killer })
  SIM.log.sort((a, b) => a.t - b.t)
  SIM.end = { kind, seed: SIM.seed, s: SIM.plan.s, lv: G.inf ? G.loop.lv : null, t: G.t, lvl: G.lvl, kills: G.kills, bosses: G.bosses, killer: G.killer, killerT: G.killerT, dmg: { ...G.dmg }, w: G.weapons.map(w => w.id), log: SIM.log, pay: null }
  simPay()
}
/** 보상금 — 끝까지 지켜본 판(SIM.watch 그대로)만, 정산식 기본 네 줄(금메달 · 의상 보너스 · 떠돌이 보물상자 없이) × 20%, 한 판 150 · 오늘 3판까지. save.coin 에만 더한다(업적 「번 보상금」에는 안 센다) */
function simPay() {
  const e = SIM.end, n = simPaid()
  if (!SIM.watch || n >= SIM_PAY.day) return e.pay = { coin: 0, n, why: SIM.watch ? 'full' : 'skip' }
  const coin = Math.min(SIM_PAY.max, Math.floor(bounty(e.kind !== 'dead').parts.slice(0, 4).reduce((a, p) => a + p[1], 0) * SIM_PAY.cut))
  save.simPay = { d: simDay(), n: n + 1 }; save.coin += coin; persist()
  e.pay = { coin, n: n + 1 }
}
function simNew(plan, watch) {   // 새 판 — 화질 단계는 0으로(관전 중엔 안 바꾼다 — fx · 숫자 칸 수가 시드 무작위에 닿는다)
  const ch = CHARS.find(c => c.id === plan.ch), seed = plan.seed || 1 + (Math.random() * 999 | 0)
  if (LQ) { LQ = 0; size() }
  dmOn()
  SIM = { plan, seed, max: !!DIFF[plan.diff].inf, rng: seeded(seed), log: [], aiT: 0, dx: 0, dy: 0, a: 0, home: [0, 0], hp: [], hpT: 0, end: null, watch, acc: 0, spec: h('div', { class: 'spec', hidden: true }) }
  simCalc(() => { calm(); newGame(ch, { diff: plan.diff, winter: plan.winter }) })
}
function simFail(e) { console.error(e); simClose(); chars() }   // 모의 토벌이 오류로 끊김 — Math · 띠 · 단추를 되돌리고 캐릭터 고르기로(진짜 판은 원래 Math)
addEventListener('pagehide', () => { if (SIM) dmOff() })   // 탭을 닫거나 다른 데로 갈 때도
function simClose() {   // 판 정리 — 띠 · ×3 단추 되돌리기
  SIM?.spec.remove(); SIM = null; G = null; calm(); pauseBtn.hidden = true; dmOff()
  const b = document.getElementById('spd'); b.disabled = false; b.textContent = `×${Math.max(2, spd)}`; b.setAttribute('aria-pressed', spd > 1)
}
/** 그리지 않고 끝까지(건너뛰기 · 시험) — 조각(28ms)씩 돌려 화면이 멈추지 않게. ctl.stop 이면 null */
const simFast = (ctl = {}) => new Promise(done => {
  const tick = () => {
    if (ctl.stop) return done(null)
    try { const t0 = performance.now(); while (!SIM.end && performance.now() - t0 < 28) simStep() } catch (e) { simFail(e); return done(null) }   // 끊기면 Math 를 되돌리고 나간다
    ctl.prog?.(G.t); SIM.end ? done(SIM.end) : setTimeout(tick, 0)
  }
  tick()
})
/** 시험용 — 그리지 않고 한 판(seed). watch 면 끝까지 본 것으로(보상금까지) → 결과 */
function simRun(plan, watch = false) { simNew(plan, watch); return simFast().then(e => { simClose(); return e }) }
function simWatch(dt) {   // frame 이 부른다 — 실제 시간 × 3 만큼 1/20초 걸음(한 프레임 최대 3걸음 — 못 따라가면 느리게만)
  if (!SIM.end) { SIM.acc += dt * SIM_X; try { while (SIM.acc >= SIM_DT && !SIM.end && mode === 'play') { SIM.acc -= SIM_DT; simStep() } } catch (e) { return simFail(e) } }
  if (SIM.end && !SIM.shown) { SIM.shown = 1; const plan = SIM.plan, e = SIM.end; SIM.spec.remove(); setTimeout(() => { if (SIM?.end === e) { simClose(); simResult(plan, e) } }, 1000) }   // 1초 멈춘 화면을 보여 주고 결과로
}
// ---- 화면 — 캐릭터 고르기의 「모의 토벌」 단추 → (처음 한 번 안내) → 작전 짜기 → 관전(3배속) → 결과 · 비교
function simOpen() {
  const d = simStore(), ch = CHARS[pickCi]
  if (d.seen2) return simPlan()
  const close = modal('sim-intro stay', portrait(ch.id), h('p', { class: 'h' }, tr`모의 토벌`), h('p', {}, tr`AI 대원이 대신 싸우는 모습을 3배속으로 지켜봐요.`), h('p', {}, tr`끝까지 보면 토벌 보상금을 조금 받아요(하루 ${SIM_PAY.day}번까지).`), h('p', { class: 'pk' }, tr`직접 하면 더 잘할 수 있어요!`),
    h('p', { class: 'fine' }, tr`업적 · 랭킹에는 들어가지 않아요.`), h('div', { class: 'row' }, btn(tr`알겠어요`, () => { simKeep({ ...simStore(), seen2: 1 }); close(); simPlan() }, 'main')))
}
const simSetRow = plan => h('div', { class: 'sim-set' }, h('span', {}, portrait(plan.ch), CHARS.find(c => c.id === plan.ch).name), h('span', {}, ic(plan.diff), DIFF[plan.diff].name), h('span', {}, ic(plan.winter ? 'snow' : 'clover'), plan.winter ? tr`겨울` : tr`풀밭`),
  plan.s ? h('span', { class: 'txt' }, STYLE[plan.s].name) : null, plan.seed ? h('span', { class: 'txt' }, tr`전장 ${plan.seed}`) : null)
/** 작전 짜기 — again: 「같은 전장에서 다시」(그 판의 작전 · 전장 그대로, 작전만 바꿔서) */
function simPlan(again) {
  mode = 'simplan'; G = null
  const ch = again ? CHARS.find(c => c.id === again.ch) : CHARS[pickCi], d = simStore(), keep = d.plans?.[ch.id]
  const plan = again ? { ...again, w: [...again.w], p: [...again.p] } : { ch: ch.id, diff: save.diff, winter: save.theme === 'winter', s: STYLE[keep?.s] ? keep.s : 'move', seed: 0, week: SIM_RK.includes(save.diff),   // 랭킹 판이면 이번 주 전장이 기본(새 전장은 골라야 — 「새 전장」 기본이라 아무도 못 올렸다)
    w: [ch.w, ...(keep?.w || []).filter(id => id !== ch.w && WEAP[id])].slice(0, 6), p: (keep?.p || []).filter(id => PASS[id]).slice(0, 6) }   // 기본 무기는 1번 칸에 고정
  let info = tr`빈칸은 AI 대원이 알아서 골라요`
  const box = h('div', { class: 'scroll' }), say2 = s => { info = s; draw() }
  const toggle = (t, id) => {
    const list = plan[t], at = list.indexOf(id)
    if (t === 'w' && id === ch.w) return say2(tr`기본 무기는 빼지 못해요`)
    if (at >= 0) { list.splice(at, 1); keepPlan(); return say2(t === 'w' ? `${WEAP[id].name} — ${tr`뺐어요`}` : `${PASS[id].name} — ${tr`뺐어요`}`) }
    if (list.length >= 6) return say2(t === 'w' ? tr`무기 칸이 가득 찼어요 — 칸을 눌러 빼요` : tr`보조 칸이 가득 찼어요 — 칸을 눌러 빼요`)
    list.push(id); keepPlan(); say2(t === 'w' ? tr`${WEAP[id].name} — 짝꿍: ${WEAP[mateOf(id)].name}` : `${PASS[id].name} — ${PASS[id].note}`)
  }
  const keepPlan = () => { const s = simStore(); simKeep({ ...s, plans: { ...s.plans, [ch.id]: { w: plan.w.slice(1), p: plan.p, s: plan.s } } }) }   // 바꿀 때마다 — 진짜 판 「작전대로 자동 선택」이 바로 쓴다
  const draw = () => {
    const mated = id => plan.w.includes(mateOf(id))
    const slots = (t, list) => h('div', { class: 'slots' }, Array.from({ length: 6 }, (_, i) => { const id = list[i]
      return id ? h('button', { type: 'button', class: `on${t === 'w' && id === ch.w ? ' fixed' : ''}${t === 'w' && mated(id) ? ' mate' : ''}`, 'aria-label': t === 'w' ? WEAP[id].name : PASS[id].name, onclick: () => toggle(t, id) }, ic(id))
        : h('button', { type: 'button', disabled: true, 'aria-label': tr`빈칸` }, String(i + 1)) }))
    const pal = (t, ids) => h('div', { class: 'pal' }, ids.map(id => { const list = plan[t], used = list.includes(id)
      return h('button', { type: 'button', class: `${used ? 'used' : ''}${t === 'w' && !used && mated(id) ? ' want' : ''}${!used && list.length >= 6 ? ' full' : ''}`, 'aria-label': t === 'w' ? WEAP[id].name : PASS[id].name, onclick: () => toggle(t, id) }, ic(id), h('small', { 'aria-hidden': 'true' }, (SIM_TAG[id] ?? '').replace(/\s?(?=[↑↓])/g, '\u2060').replace(/ (?=\+)/g, '\u00a0'))) }))   // 아이콘 밑 글 — 화살표 · +1 이 혼자 줄을 내려가지 않게(디자인)
    box.replaceChildren(
      h('div', { class: 'sim-opt' }, h('span', {}, tr`성향`), h('div', { class: 'theme sim-style', role: 'radiogroup', 'aria-label': tr`토벌 성향` }, Object.keys(STYLE).map(k => h('button', { type: 'button', role: 'radio', class: plan.s === k ? 'on' : '', 'aria-checked': String(plan.s === k), onclick: () => { plan.s = k; keepPlan(); draw() } }, STYLE[k].name))),
        h('span', {}, tr`전장`), h('div', { class: 'theme sim-style', role: 'radiogroup', 'aria-label': tr`전장` }, [[false, plan.seed && !plan.week ? tr`전장 ${plan.seed}` : tr`새 전장`], [true, tr`이번 주 #${simWeek().field}`]].map(([v, name]) => h('button', { type: 'button', role: 'radio', class: `${!!plan.week === v ? 'on' : ''}${v && plan.pop ? ' new' : ''}`, 'aria-checked': String(!!plan.week === v), onclick: () => { plan.week = v; plan.pop = false; draw() } }, name)))),
      h('p', { class: 'sim-style-note' }, STYLE[plan.s].note, h('br'), h('span', { class: 'fld' }, !SIM_RK.includes(plan.diff) ? tr`모의 토벌 랭킹은 무한만 있어요` : plan.week ? tr`끝까지 보면 이번 주 랭킹에 올라가요` : tr`랭킹은 이번 주 전장에서만 올라가요`)),
      h('p', { class: 'sim-lab' }, tr`무기 순서 ${plan.w.length}/6`), slots('w', plan.w),
      h('p', { class: 'sim-lab' }, tr`보조 순서 ${plan.p.length}/6`), slots('p', plan.p),
      h('p', { class: 'sim-info', 'aria-live': 'polite' }, info),
      h('p', { class: 'legend' }, h('span', { class: 'tag mate' }, ic('syn'), tr` 짝꿍`), ' ', tr`초록 테 — 같이 넣으면 강해져요`),
      h('p', { class: 'sim-lab' }, tr`무기`), pal('w', Object.keys(WEAP)), h('p', { class: 'sim-lab' }, tr`보조`), pal('p', Object.keys(PASS)))
  }
  draw()
  show(h('div', { class: 'panel wide pick simplan' }, h('p', { class: 'h' }, tr`작전 짜기`), simSetRow({ ...plan, s: null, seed: 0 }), box,
    h('div', { class: 'row' }, btn(tr`← 뒤로`, chars), btn(tr`시작!`, () => { const s = simStore(); simKeep({ ...s, plans: { ...s.plans, [ch.id]: { w: plan.w.slice(1), p: plan.p, s: plan.s } } }); simGo(plan) }, 'main'))))
}
async function simGo(plan) {   // 관전 — 진짜 판 화면 그대로(HUD · 일시정지 단추), ×3 단추는 눌린 채 흐리게, 아래 띠(방금 고른 것 · 그만두기 · 결과로 건너뛰기)
  if (plan.week) {   // 이번 주 전장 — 로그인 · 랭킹 판이면 서버 시작 표(그 주 · 전장을 서버 시계로). 못 받으면 이 기기 시계로(올리기는 안 됨)
    const loc = simWeek(); plan = { ...plan, seed: loc.field, wk: loc.wk, ticket: false }
    if (auth && SIM_RK.includes(plan.diff)) { const r = await rpc('sim_start'); if (r?.field) plan = { ...plan, seed: r.field, wk: r.wk, ticket: true } }
  }
  simNew(plan, true)
  const b = document.getElementById('spd'); b.textContent = '×3'; b.setAttribute('aria-pressed', 'true'); b.disabled = true
  SIM.spec.append(h('div', { class: 'spec-pick', 'aria-live': 'polite' }, h('span', { class: 'ai' }, tr`AI 대원`), h('span', { class: 'what' }, tr`싸우는 중…`)),
    h('div', { class: 'spec-btns' }, btn(tr`그만두기`, () => simAsk(simQuit, tr`그만둘까요?`, tr`그만두기`)), btn(tr`결과로 건너뛰기`, () => simAsk(simSkip, tr`결과로 건너뛸까요?`, tr`건너뛰기`))))
  document.body.append(SIM.spec)
  mode = 'play'; ui.hidden = true; pauseBtn.hidden = false; still = 2; SND.play(fieldSong(), false, plan.ch)
}
function simAsk(go, q, yes) {   // 오늘 보상금을 아직 받을 수 있으면 한 번 묻는다(끝까지 보지 않으면 0) — 묻는 동안 멈춤
  if (simPaid() >= SIM_PAY.day) return go()
  mode = 'pause'; calm()
  const close = modal('sim-ask stay', h('p', { class: 'h' }, q), h('p', {}, tr`끝까지 보지 않으면 토벌 보상금을 받지 못해요.`),
    h('div', { class: 'row' }, btn(yes, () => { close(); mode = 'play'; go() }), btn(tr`계속 보기`, () => { close(); mode = 'play' }, 'main')))
}
function simQuit() { const plan = SIM.plan; SND.play(null); simClose(); simPlan({ ...plan, seed: 0 }) }   // 보상 · 결과 없이 작전 짜기로(일시정지 창의 그만두기도)
function simSkip() {   // 남은 부분은 그리지 않고 계산 — 지난번 진행 화면(막대). 보상금 0
  const plan = SIM.plan; SND.play(null); SIM.watch = false; SIM.spec.hidden = true; mode = 'sim'
  const txt = h('p', { class: 'sim-t' }), bar = h('div', { class: 'simbar' }), ctl = { prog: t => { txt.textContent = fmt(t); bar.style.setProperty('--p', `${Math.min(G?.inf ? 95 : 100, t / (G?.inf ? 2400 : FINAL_T) * 100).toFixed(1)}%`) } }
  show(h('div', { class: 'panel wide pick sim' }, h('p', { class: 'h' }, tr`모의 토벌`), simSetRow(plan), h('div', { class: 'sim-hop' }, portrait(plan.ch)), txt, bar, h('div', { class: 'row' }, btn(tr`취소`, () => { ctl.stop = true }))))
  ctl.prog(G.t)
  simFast(ctl).then(e => { simClose(); e ? simResult(plan, e) : simPlan({ ...plan, seed: 0 }) })
}
/** 결과 화면 랭킹 줄 — 끝까지 본 이번 주 전장 판만 올린다(서버 submit_sim). 올랐으면 연보라 칸, 아니면 작은 글 한 줄(디자인) */
function simRankLine(plan, r) {
  const soft = s => h('p', { class: 'rk-soft' }, s)
  if (!SIM_RK.includes(plan.diff)) return null
  if (!plan.week) return soft(tr`랭킹은 이번 주 전장에서만 올라가요`)
  if (r.pay.why === 'skip') return soft(tr`끝까지 본 판만 랭킹에 올라가요`)
  if (!auth) return h('div', { class: 'rk-login' }, h('span', {}, tr`로그인하면 다음 판부터 이번 주 랭킹에 올라가요`), btn(tr`로그인`, loginBox))
  if (!NICK) return h('div', { class: 'rk-login' }, h('span', {}, tr`닉네임을 정하면 랭킹에 올라가요`), btn(tr`닉네임 정하기`, () => nickBox()))
  const box = h('div', {}, soft(tr`랭킹에 올리는 중…`))
  if (!plan.ticket) { box.replaceChildren(soft(tr`랭킹에 올리지 못했어요 — 인터넷 연결을 확인해 주세요`)); return box }
  rpc('submit_sim', { diff: plan.diff, winter: plan.winter, ch: plan.ch, s: plan.s, w: plan.w.join(' '), p: plan.p.join(' '), kind: r.kind, t: Math.floor(r.t), kills: r.kills, bosses: r.bosses, lv: r.lv || 0, lvl: r.lvl, v: PATCH_ID }).then(x => {
    if (x?.r === 'ok' && x.rank) box.replaceChildren(h('div', { class: 'rk-up' }, h('span', { class: `rk n ${RK_COL[x.rank] || ''}` }, x.rank), h('span', {}, h('b', {}, tr`이번 주 ${x.rank}위`), h('small', {}, tr`랭킹에 올렸어요`)), btn(tr`랭킹 보기`, () => ranking(null, plan.winter, 'sim', plan.diff))))
    else if (x?.r === 'kept') box.replaceChildren(soft(x.rank ? tr`이번 주 내 최고는 ${x.rank}위예요` : tr`이번 주 내 기록이 더 좋아요`))
    else if (x?.r === 'odd') box.replaceChildren(soft(tr`랭킹 기록을 확인 중이에요`))   // 같은 작전 다른 결과 — 다수 · 먼저와 달라 내려감(서버 sim_vote)
    else box.replaceChildren(soft(tr`랭킹에 올리지 못했어요 — 인터넷 연결을 확인해 주세요`))
  })
  return box
}
function simResult(plan, r) {
  mode = 'simres'
  const sum = { v: PATCH_ID, at: Date.now(), ch: plan.ch, diff: plan.diff, winter: plan.winter, s: plan.s, seed: r.seed, w: plan.w, t: r.t, kind: r.kind, lv: r.lv }
  const d = simStore(), hist = [sum, ...(d.hist || []).filter(x => x.s)].slice(0, 5); simKeep({ ...d, hist })   // 예전(성향 없던 3판 평균) 기록은 버린다
  const stat = (k, v) => h('div', {}, h('small', {}, k), h('b', {}, v))
  const rows = Object.entries(r.dmg).sort((a, b) => b[1] - a[1]), all = rows.reduce((q, x) => q + x[1], 0)
  const dmgBox = h('div', { class: 'dmg' }, h('p', { class: 'dt' }, tr`스킬별 준 피해`), h('ul', {}, rows.map(([id, v]) => h('li', {}, ic(id), h('span', {}, WEAP[id]?.name ?? DMG_NAME[id] ?? id), h('i', { style: `--w:${(v / rows[0][1] * 100).toFixed(1)}%` }), h('b', {}, `${Math.round(v).toLocaleString()} · ${Math.round(v / all * 100)}%`)))))
  const why = r.kind === 'win' ? tr`세이렌 격파!` : r.kind === 'time' ? tr`${Math.round(r.t / 60)}분 버팀!` : tr`쓰러짐 — ${r.killer || '?'}`
  const nameOf = id => WEAP[id]?.name ?? PASS[id]?.name ?? BOSS[id]?.name ?? id
  const main = [], ups = []
  for (const e of r.log) {
    const row = (pic, cls, s) => h('li', {}, h('time', {}, fmt(e.t)), pic || h('span'), h('span', { class: cls }, s))
    if (e.k === 'new') main.push(row(icSafe(e.id), '', tr`새 스킬 — ${nameOf(e.id)}`))
    else if (e.k === 'off') main.push(row(icSafe(e.id), 'off', tr`목록 밖 — ${nameOf(e.id)}`))
    else if (e.k === 'boss') main.push(row(icSafe(e.id), 'boss', tr`${nameOf(e.id)} 격파`))
    else if (e.k === 'aw') main.push(row(ic('awaken'), 'aw', tr`각성 — ${AW[e.id]?.name ?? nameOf(e.id)}`))
    else if (e.k === 'mate') main.push(row(ic('syn'), 'mate', tr`짝꿍 완성 — ${synOf(e.id)[0]}`))
    else if (e.k === 'low') main.push(row(ic('onigiri'), 'low', tr`가장 낮은 체력 ${e.v}%`))
    else if (e.k === 'dead') main.push(row(icSafe(e.id), 'dead', tr`쓰러짐 — ${e.s || '?'}`))
    else if (e.k === 'up') ups.push(row(icSafe(e.id), '', tr`레벨업 — ${nameOf(e.id)}`))
  }
  const p = r.pay, paySub = p.coin ? tr`오늘 ${p.n}/${SIM_PAY.day}${DIFF[plan.diff].coin !== 1 ? ` · ${DIFF[plan.diff].name} ×${DIFF[plan.diff].coin}` : ''}` : p.why === 'skip' ? tr`끝까지 보면 받을 수 있어요` : tr`오늘 보상은 다 받았어요 — 내일 또 만나요!`
  const cmp = h('ul', { class: 'cmp' }, hist.map((x, i) => h('li', { class: `${i ? '' : 'now'}${x.v !== PATCH_ID ? ' old' : ''}`, 'data-old': tr`예전 밸런스` }, portrait(x.ch), h('span', { class: 'ws' }, x.w.map(id => icSafe(id))), h('span', { class: 'sc' }, fmt(x.t), h('small', {}, `${x.lv != null ? `∞ ${x.lv} · ` : ''}${STYLE[x.s]?.name ?? ''} · ${tr`전장 ${x.seed}`}`)))))
  show(h('div', { class: 'panel wide pick sim' },
    h('p', { class: 'fine top' }, r.lv != null ? tr`AI 대원 · 강화 최대 기준 · 전장 ${r.seed}` : tr`AI 대원 · 강화 없이 · 전장 ${r.seed}`), h('p', { class: 'h' }, tr`모의 토벌 결과`), simSetRow({ ...plan, seed: 0 }),
    h('div', { class: 'scroll' },
      h('div', { class: 'stats' }, r.lv != null ? stat(tr`도달 단계`, `∞ ${r.lv}`) : stat(tr`레벨`, r.lvl), stat(tr`버틴 시간`, fmt(r.t)), stat(tr`처치`, r.kills.toLocaleString()), stat(tr`보스`, r.bosses)),   // 무한은 진짜 판 결과처럼 도달 단계부터
      h('div', { class: 'coin pay' }, h('p', {}, ic('coin'), h('span', {}, tr`모의 토벌 보상금`, h('small', {}, paySub)), h('b', {}, `+${p.coin}`))),
      simRankLine(plan, r),
      h('p', { class: `sim-why ${r.kind === 'dead' ? '' : 'win'}` }, (r.kind === 'dead' ? icSafe(r.killerT) : icSafe('siren')) || '', why),
      dmgBox, h('p', { class: 'dt' }, tr`주요 로그`), h('ul', { class: 'log' }, main), ups.length ? h('details', {}, h('summary', {}, tr`레벨업 전부 보기`), h('ul', { class: 'log' }, ups)) : null,
      h('p', { class: 'dt' }, tr`이 기기 최근 5번`), cmp),
    h('div', { class: 'row two' }, btn(tr`닫기`, chars), btn(tr`한 번 더!`, () => simPlan({ ...plan, seed: r.seed, ticket: false }), 'main'))))
}
setInterval(() => {   // 캐릭터 고르기 — 고른 캐릭터가 제자리걸음
  if (mode !== 'chars') return
  const cv = ui.querySelector('.char.on canvas')
  if (!cv?._walk?.length) return
  const g = cv.getContext('2d'); g.clearRect(0, 0, cv.width, cv.height); g.drawImage(cv._walk[(tnow * 8 | 0) % 4], 0, 0)
}, 60)
/** IP 차단 — 열 때 서버(blocked)에 묻는다. 기다리지 않고 뒤에서, 서버가 안 되면 그냥 연다. 막혔으면 게임 대신 이 화면(꾸짖지 않게 — IP 를 같이 쓰는 다른 아이일 수도)
 *  GitHub Pages 라 진짜 네트워크 차단이 아니라 게임이 스스로 멈춘다(랭킹 · 통계는 서버도 막는다). 번호 = bans.id(문의 받으면 supabase/account.sql 의 bans) */
const blockCheck = () => rpc('blocked').then(b => b?.id && blockScreen(b))
function blockScreen(b) {
  MODAL?.(); SND.play(null); mode = 'blocked'; G = null; BOX = null; pauseBtn.hidden = true
  const end = b.until && new Date(b.until)
  show(h('div', { class: 'panel home ban' }, h('div', { class: 'corner' }, langPick()), h('p', { class: 'h' }, tr`이용이 잠시 제한됐어요`),
    h('p', { class: 'sub' }, tr`이 인터넷 주소(IP)에서 이상한 기록이 확인돼서 잠시 멈췄어요`),
    h('p', { class: 'until' }, h('b', {}, end ? tr`${end.toLocaleString(LANG, { month: 'long', day: 'numeric', weekday: 'short', hour: 'numeric', minute: '2-digit' })}에 풀려요` : tr`기한 없이 제한돼요`)),
    h('p', {}, tr`학교나 휴대폰 데이터처럼 여러 사람이 같이 쓰는 인터넷이라 잘못 막혔을 수 있어요. 그럴 땐 문의 메일로 알려 주세요.`),
    h('p', { class: 'fine' }, tr`문의할 때 이 번호를 알려 주세요: ${b.id}`, h('br'), tr`문의 `, h('a', { href: 'mailto:super.godbono@gmail.com' }, 'super.godbono@gmail.com'))))
}
/** 이용약관 — 처음 화면 맨 아래 링크 · 주소 ?terms · 로그인 창 · 처음 로그인 때 동의(termsBox). 바꾸면 TERMS_DAY(시행일)를, 이용자에게 불리한 변경이면 TERMS_VER(동의 버전 — 7일 전부터 알리고 다음 로그인에 다시 묻는다)도
 *  문안은 기획 세션(2026-11-18). 9번 「고의 또는 중대한 과실이 없는 한」은 남길 것(책임을 통째로 빼면 약관규제법상 무효가 될 수 있다) */
const TERMS_DAY = '2026-11-18'   // 시행일(화면에 보이는 날짜)
const TERMS_VER = '2026-11-18'   // 동의 버전 — 이용자에게 불리하게 바꿀 때만 올린다(그때만 다음 로그인에 다시 묻는다). 유리하거나 글만 다듬는 변경은 TERMS_DAY 만 바꾼다
function terms(back = title) {
  mode = 'terms'
  const sec = (t, ...li) => [h('h3', { class: 'day' }, t), h('ul', { class: 'pv' }, li.map(s => h('li', {}, s)))]
  show(h('div', { class: 'panel guide pick' }, h('p', { class: 'h' }, tr`이용약관`), h('p', { class: 'sub' }, tr`시행일 ${new Date(TERMS_DAY + 'T12:00').toLocaleDateString(LANG, { year: 'numeric', month: 'long', day: 'numeric' })}`),
    h('div', { class: 'scroll' },
      sec(tr`1. 이 게임은`, tr`「먼작귀 서바이버즈」는 「치이카와(ちいかわ)」를 좋아하는 팬이 만든 비공식 · 비영리 팬게임입니다. 원작자 나가노(ナガノ)와 권리자와는 관계가 없으며, 원작의 저작권은 원작자와 권리자에게 있습니다.`,
        tr`게임은 무료이며, 돈을 내는 아이템이나 광고가 없습니다.`, tr`권리자가 요청하면 게임을 바로 고치거나 닫을 수 있습니다.`),
      sec(tr`2. 이용과 로그인`, tr`로그인 없이 누구나 할 수 있습니다. 로그인(카카오 · Google)은 선택이며, 기록을 계정에 저장하고 무한 모드 랭킹에 오를 때 씁니다.`, tr`처음 로그인할 때 이 약관에 동의해야 계정을 쓸 수 있습니다.`,
        tr`만 14세 미만은 보호자와 함께 로그인해 주세요.`, tr`개인정보는 「개인정보 처리방침」을 따릅니다.`),
      sec(tr`3. 닉네임`, tr`2~12자, 한글 · 영어 · 일본어 · 중국어 · 숫자로 정하며, 다른 사람과 같은 이름은 쓸 수 없습니다.`, tr`욕설, 남을 놀리거나 상처 주는 말, 운영자 · 관리자인 척하는 이름은 쓸 수 없습니다.`,
        tr`처음 정할 때는 바로, 그다음부터는 하루에 한 번 바꿀 수 있습니다.`, tr`규칙에 맞지 않는 닉네임은 운영자가 바꾸거나 지울 수 있습니다.`),
      sec(tr`4. 랭킹`, tr`무한 모드 기록이 오릅니다. 전체 순위는 계정마다 가장 좋은 기록 하나, 캐릭터별 순위는 캐릭터마다 하나입니다.`, tr`기록은 서버가 확인하며, 확인을 통과하지 못한 기록은 오르지 않습니다.`, tr`운영자는 잘못된 기록을 지울 수 있습니다.`),
      sec(tr`5. 하면 안 되는 것`, tr`게임 코드 · 저장 · 메모리를 고치거나, 게임 속도를 바꾸는 프로그램을 쓰는 것`, tr`자동으로 플레이하는 프로그램(매크로 · 봇)을 쓰는 것`, tr`서버로 가는 요청을 고치거나 만들어 보내는 것`,
        tr`버그를 알면서 이용하는 것(버그를 찾으면 문의 메일로 알려 주세요)`, tr`서버에 무리를 주거나 다른 사람의 이용을 방해하는 것`),
      sec(tr`6. 제재`, h('span', {}, tr`정직한 게임으로는 나올 수 없는 기록이나 5번의 행동이 확인되면`, h('ul', { class: 'pv' }, [tr`계정을 영구 정지합니다.`, tr`접속 IP 를 7일 동안 막으며, 그동안 이 사이트를 쓸 수 없습니다.`, tr`랭킹 기록을 지웁니다.`].map(x => h('li', {}, x)))),
        tr`정지된 계정도 「계정 지우기」로 탈퇴할 수 있으며, 탈퇴하면 정지 · 차단 기록도 함께 지워집니다.`,
        tr`보상금이 비정상적으로 빨리 늘어난 계정은 랭킹에서 뺄 수 있습니다.`, tr`학교 · 휴대폰 데이터처럼 여러 사람이 같이 쓰는 인터넷에서는 IP 차단이 다른 사람에게도 걸릴 수 있습니다.`,
        tr`잘못 막혔다고 생각되면 화면에 나온 번호와 함께 문의 메일로 알려 주세요. 확인한 뒤 풀어 드립니다.`),
      sec(tr`7. 저장`, tr`기록은 이 기기의 브라우저에 저장되고, 로그인하면 계정에도 저장됩니다.`, tr`브라우저 정보를 지우거나 기기를 바꾸면 기기의 기록은 사라질 수 있습니다. 소중한 기록은 로그인해서 계정에 두세요.`,
        tr`게임 안의 보상금 · 의상 등은 게임 안에서만 쓰는 것으로 돈의 가치가 없으며, 사고팔거나 바꿀 수 없습니다.`, tr`「계정 지우기」로 언제든 직접 탈퇴할 수 있습니다.`),
      sec(tr`8. 게임의 변경과 중단`, tr`게임은 더 좋아지기 위해 예고 없이 바뀔 수 있고(밸런스 · 기능 · 랭킹 초기화 포함), 사정에 따라 끝날 수 있습니다. 무료 게임이라 이에 따른 보상은 없습니다.`,
        tr`약관을 이용자에게 불리하게 바꿀 때는 시행 7일 전부터 게임 안에 알리고, 다음 로그인 때 다시 동의를 받습니다. 이용자에게 유리하거나 글만 다듬는 변경은 바로 적용합니다.`),
      sec(tr`9. 책임`, tr`게임은 지금 있는 그대로 제공됩니다. 운영자의 고의 또는 중대한 과실이 없는 한, 게임을 쓰다 생긴 손해(기록이 사라짐 · 서비스 중단 등)에 책임지지 않습니다.`, tr`카카오 · Google · Supabase · GitHub 같은 외부 서비스의 장애에는 책임지지 않습니다.`),
      sec(tr`10. 문의`, h('a', { href: 'mailto:super.godbono@gmail.com' }, 'super.godbono@gmail.com'), tr`이 약관은 대한민국 법을 따릅니다.`)),
    h('div', { class: 'row' }, btn(tr`← 처음으로`, back, 'main'))))
}
/** 개인정보 처리방침 — 처음 화면 맨 아래 링크 · 주소 ?privacy 로 바로(카카오 · 구글 로그인 설정에 넣는 주소: https://chii-ka-wa.github.io/?privacy)
 *  고치면 PRIVACY_DAY(시행일)도. 실제와 같아야 한다 — 보관 기간은 supabase/account.sql 의 gc() · 비우기(scrub) · delete_me 와 맞춘다 */
const PRIVACY_DAY = '2026-11-21'
function privacy(back = title) {
  mode = 'privacy'
  const sec = (t, ...li) => [h('h3', { class: 'day' }, t), h('ul', { class: 'pv' }, li.map(s => h('li', {}, s)))]
  show(h('div', { class: 'panel guide pick' }, h('p', { class: 'h' }, tr`개인정보 처리방침`), h('p', { class: 'sub' }, tr`시행일 ${new Date(PRIVACY_DAY + 'T12:00').toLocaleDateString(LANG, { year: 'numeric', month: 'long', day: 'numeric' })}`),
    h('div', { class: 'scroll' },
      sec(tr`1. 로그인하지 않으면`, tr`게임 기록은 이 기기 브라우저에만 저장되고 서버로 보내지 않습니다.`,
        tr`게임을 고치려고 익명 플레이 통계(캐릭터 · 난이도 · 버틴 시간 · 쓰러진 원인 등 개인을 알 수 없는 정보)와 방문 통계(Google 애널리틱스, 쿠키 사용)를 모읍니다. 처음 화면의 「보내지 않기」나 브라우저의 추적 거부 설정으로 끌 수 있습니다.`, tr`무한 모드를 하려면 통계 보내기를 켜야 합니다.`,
        tr`통계를 너무 자주 보내는 것을 막으려고 접속 IP 를 되돌릴 수 없게 변환한 값을 잠깐 보관하고 2시간 안에 지웁니다.`),
      sec(tr`2. 로그인하면 (카카오 · 구글, 선택)`, tr`저장: 로그인 서비스의 사용자 고유 번호, 직접 정한 닉네임, 게임 저장(보상금 · 의상 · 업적), 무한 모드 랭킹 기록(플레이한 언어 포함), 이용약관 동의 기록(약관 시행일 · 동의한 시각)`,
        tr`쿠폰 사용 기록(계정 번호 · 쿠폰 · 받은 때): 쿠폰을 한 계정에 한 번만 드리려고 보관하며, 쿠폰 기간이 끝나고 7일 뒤 또는 계정을 지우면 지웁니다.`,
        tr`모의 토벌 랭킹(무한) 기록(계정 번호 · 닉네임 · 작전 · 결과 · 판 번호): 랭킹을 보여 주려고 보관하며, 그 주가 끝나고 2주 뒤 또는 계정을 지우면 지웁니다.`,
        tr`저장하지 않음: 이메일 · 이름 · 프로필 사진. 로그인 과정에서 받더라도 바로 지웁니다.`, tr`랭킹에는 닉네임과 게임 기록만 보입니다.`,
        tr`로그인 중에는 랭킹 기록 확인을 위해 익명 플레이 통계를 항상 보냅니다(끌 수 없습니다).`),
      sec(tr`3. 부정 이용 방지`, tr`부정 플레이가 의심되는 판의 기록과, 접속 IP 를 되돌릴 수 없게 변환한 값을 남기며 90일 뒤 지웁니다.`,
        tr`말이 안 되는 기록이나 부정 플레이가 확인되면 계정은 영구 정지되고, 접속 IP(변환한 값)는 7일 동안 차단되며 그동안 이 사이트를 이용할 수 없습니다.`,
        tr`정지 기록은 탈퇴할 때까지, IP 차단 기록은 7일이 지날 때까지 보관하며, 탈퇴하면 그 계정의 정지 · 차단 · 부정 이용 기록을 바로 지웁니다.`, tr`잘못 막혔다면 문의 메일로 알려 주세요.`),
      sec(tr`4. 보관과 삭제`, tr`계정 정보는 탈퇴할 때까지 보관합니다.`, tr`「계정 지우기」로 언제든 직접 탈퇴할 수 있고, 계정 · 게임 저장 · 랭킹 기록이 바로 지워집니다. 이 기기 브라우저의 기록은 남습니다.`),
      sec(tr`5. 처리를 맡기는 곳`, tr`Supabase — 계정 · 저장 · 랭킹 · 통계 보관(서버 위치 호주 시드니)`, tr`Google — 방문 통계, 구글 로그인`, tr`Kakao — 카카오 로그인`, tr`GitHub — 사이트 호스팅`,
        tr`국외 이전 — 위 정보는 서비스를 쓸 때 네트워크로 호주의 Supabase 서버와 미국의 Google · GitHub 로 전송됩니다. 목적: 게임 서비스 · 통계 / 보관: 위 기간 / 거부: 로그인과 통계를 쓰지 않으면 게임 기록은 전송되지 않습니다. 사이트를 열 때 차단 여부를 확인하고, 랭킹 화면을 열 때 랭킹을 받아 오려고 Supabase 에 접속합니다(사이트를 여는 접속 정보는 GitHub 로 갑니다).`,
        tr`Supabase · Google · GitHub 는 접속할 때의 IP 등 접속 기록을 각자의 방침에 따라 잠깐 보관합니다(Supabase 는 약 1일).`),
      sec(tr`6. 만 14세 미만`, tr`로그인은 선택입니다. 만 14세 미만은 보호자와 함께 로그인해 주세요.`),
      sec(tr`7. 문의`, h('a', { href: 'mailto:super.godbono@gmail.com' }, 'super.godbono@gmail.com'))),
    h('div', { class: 'row' }, btn(tr`← 처음으로`, back, 'main'))))
}
function notes() {   // 패치노트 — 위 · 아래 고정, 가운데만 스크롤
  mode = 'notes'; save.seen = PATCH_ID; persist()
  show(h('div', { class: 'panel guide pick' },
    h('p', { class: 'h' }, tr`패치노트`),
    h('div', { class: 'scroll' }, PATCH.map(([d, list]) => [h('h3', { class: 'day' }, new Date(d + 'T12:00').toLocaleDateString(LANG, { month: 'long', day: 'numeric' })),
      h('ul', { class: 'kid' }, list.map(([k, pic, s]) => h('li', {}, ic(pic), h('div', {}, h('mark', { style: `background:${TAG[k][1]}` }, TAG[k][0]), h('p', {}, s)))))])),
    h('div', { class: 'row' }, btn(tr`← 처음으로`, title, 'main'))))
}
/** 도감 — 초등학생도 읽기 쉽게: 위에 바로 가기 단추, 줄마다 그림 하나 · 짧은 문장. 스킬 카드에는 짝꿍(초록) · 각성(분홍) 꼬리표를 따로 */
function guide() {
  mode = 'guide'
  const li = (pic, name, note, extra) => h('li', {}, typeof pic === 'string' ? h('i', {}, pic) : pic, h('div', {}, h('b', {}, name), h('span', {}, note), extra && h('em', {}, extra)))
  const when = kind => [...PLAN.filter(p => p[1] === kind).map(p => `${fmt(p[0])}${p[2] ? tr`(중간)` : ''}`), ...(kind === 'siren' || kind === 'mermaid' ? [fmt(FINAL_T)] : [])].join(' · ')
  const sec = (id, pic, title) => h('h3', { class: 'sec', id: `dex-${id}` }, ic(pic), ` ${title}`)
  const step = (pic, s, small) => h('li', {}, ic(pic), h('p', {}, s, small && h('small', {}, small)))   // 그림 하나 · 짧은 문장
  const mate = id => h('div', { class: 'tag mate' }, h('i', {}, ic('syn'), tr` 짝꿍`), ic(mateOf(id)), ` ${WEAP[mateOf(id)].name}`, h('small', {}, ` → 「${synOf(id)[0]}」`))
  const awk = id => h('div', { class: 'tag aw' }, h('i', {}, ic('awaken'), tr` 각성`), ` ${AW[id].name}`)
  const NAV = [['play', 'chest', tr`놀이 방법`], ['chars', 'a_chiikawa', tr`캐릭터`], ['skills', 'sasu', tr`스킬`], ['syn', 'syn', tr`짝꿍 시너지`], ['awaken', 'awaken', tr`각성`], ['items', 'manju', tr`아이템`], ['foes', 'goblin', tr`토벌 대상`], ['boss', 'dekatsuyo', tr`보스`]]
  const scroll = h('div', { class: 'scroll' },
    sec('ctrl', 'slipper', tr`조작`),
    h('ul', { class: 'steps' },
      step('slipper', tr`방향키 · WASD로 움직여요. 휴대폰은 화면을 누른 채로 끌어요`),
      step('sasu', tr`공격은 알아서 나가요!`),
      step('clock', tr`Esc · P · 오른쪽 위 단추 — 잠깐 멈춰요`),
      step('wind', tr`×2 단추 — 게임이 2배 빨라져요(어려움을 클리어하면 한 번 더 눌러 3배)`)),
    sec('play', 'chest', tr`놀이 방법`),
    h('ul', { class: 'steps' },
      step('wage', tr`적을 쓰러뜨리면 보석이 떨어져요. 주우면 경험치가 차고 레벨 업!`),
      step('chest', tr`레벨 업 하면 카드 3장 중 1장을 골라요 — 새 스킬 · 스킬 레벨 업 · 아이템`),
      step('pouch', tr`스킬 · 아이템은 6개씩 가질 수 있어요. 스킬은 Lv 8, 아이템은 Lv 5까지 올라가요`),
      step('party', tr`아주 가끔(1%) 잭팟! 카드 3장을 모두 가져요`),
      step('clover', tr`카드가 마음에 안 들면 — 리롤(새 카드) · 스킵(안 고르기) · 제외(이번 판에서 빼기). 한 판에 2번씩`),
      step('syn', tr`짝꿍 스킬 2개를 모두 가지면 시너지! 둘 다 세져요`),
      step('awaken', tr`Lv 8 스킬이 있을 때 보스를 쓰러뜨리면 각성의 별이 떨어져요. 먹으면 스킬 하나가 각성!`),
      step('coinbox', tr`멀리 돌아다니면 가끔 떠돌이 보물상자가 나와요. 열면 보상금!`),
      step('snow', tr`겨울 맵 — 가만히 있으면 몸이 얼어요! 눈보라가 오면 쌓인 눈에 미끄러지고 받는 피해가 늘어요. 계속 움직이면 몸에 열이 나서 괜찮아요`),
      step('coin', tr`판이 끝나면 보상금을 받아요. 상점에서 조금씩 세게 만들 수 있어요`),
      step('shirt', tr`상점 「의상」 탭에서 옷을 사서 입어요 — 한 번 사면 모든 캐릭터가! 어려움을 클리어하면 특별한 업적 의상`),
      step('sasu', tr`상점에서 무기 스킨 · 스킬 스킨도 바꿀 수 있어요 — 모양과 색만 바뀌어요`),
      step('stone', tr`부활석이 있으면 쓰러져도 다시 일어나요`, tr`한 판에 ${Object.values(DIFF).map(d => `${d.name} ${d.revive}`).join(' · ')}번까지`),
      step('a_goblin', tr`업적 메달을 모아요. 금메달 하나마다 보상금 +1%`),
      step('normal', tr`난이도 — 처음이라면 쉬움부터!`, Object.entries(DIFF).map(([k, d]) => h('span', { class: 'df' }, ic(k), ` ${d.name}: ${d.note}`))),
      step('rusher', tr`10분부터 고블린 폭탄 · 돌격대가 와요. 스킬로 못 막으니 피해요!`),
      step('dekatsuyo', tr`보스는 기술을 쓰기 전에 멈추고 깜빡여요. 그때 피해요!`),
      step('a_siren', tr`${FINAL_T / 60}분에 세이렌이 나와요. 쓰러뜨리면 토벌 성공!`),
      step('a_darkstar', tr`${DARK_T / 60}분까지 못 쓰러뜨리면 검은 별똥별이 와요. ${END_T / 60}:00까지 도망치면 클리어!`),
      step('zoom', tr`기록은 이 브라우저에만 저장돼요`)),
    sec('chars', 'a_chiikawa', tr`캐릭터`),
    h('ul', { class: 'list' }, CHARS.map(ch => li(portrait(ch.id), `${ch.name} — ${ch.trait}`, ch.note, [tr`시작 스킬: `, ic(ch.w), ` ${WEAP[ch.w].name}`]))),
    sec('skills', 'sasu', tr`스킬 (최고 Lv 8)`),
    h('p', { class: 'legend' }, h('span', { class: 'tag mate' }, h('i', {}, ic('syn'), tr` 짝꿍`)), tr`함께 가지면 둘 다 세져요`, h('span', { class: 'tag aw' }, h('i', {}, ic('awaken'), tr` 각성`)), tr`Lv 8 + 보스 → 더 세져요`),
    h('ul', { class: 'list' }, Object.keys(WEAP).map(id => h('li', {}, ic(id), h('div', {}, h('b', {}, WEAP[id].name, PROJ.has(id) && h('mark', { class: 'proj' }, tr`투사체`)), h('span', {}, WEAP[id].note), mate(id), awk(id))))),   // 투사체 꼬리표 — 「둘이서 같이」가 +1 하는 스킬
    sec('syn', 'syn', tr`짝꿍 시너지`),
    h('p', { class: 'lead' }, tr`두 스킬을 함께 가지면 둘 다 세져요`),
    h('ul', { class: 'list' }, SYN.map(s => { const [a, b] = Object.keys(s[1]); return h('li', { class: 'pair' }, h('div', { class: 'duo' }, ic(a), h('i', {}, '+'), ic(b)), h('div', {}, h('b', {}, `「${s[0]}」`), h('span', {}, `${WEAP[a].name} + ${WEAP[b].name}`), h('em', {}, synText(s)))) })),
    sec('awaken', 'awaken', tr`각성`),
    h('p', { class: 'lead' }, tr`Lv 8 스킬이 있을 때 보스(중간보스 빼고)를 쓰러뜨리면 각성의 별! 먹으면 고른 스킬이 각성해요 — 조금 세지고, 날아오는 공격을 막기도 해요`),
    h('ul', { class: 'list' }, Object.keys(AW).map(id => h('li', { class: 'awk' }, ic(id), h('div', {}, h('b', {}, AW[id].name), h('span', {}, tr`${WEAP[id].name} Lv 8 → 각성`), h('em', {}, `${upText(AW[id].up)} · ${AW[id].note}`))))),
    sec('items', 'manju', tr`아이템 (최고 Lv 5)`),
    h('ul', { class: 'list' }, Object.entries(PASS).map(([id, p]) => li(ic(id), p.name, tr`레벨마다 ${p.note}${p.max !== 5 ? tr` · 최고 Lv ${p.max}` : ''}`))),
    sec('pick', 'magnet', tr`줍는 것`),
    h('ul', { class: 'list' }, Object.entries(ITEMS).map(([id, p]) => li(ic(id), p.name, p.note))),
    sec('help', 'pajama', tr`도와주는 친구들 (선택은 못 해요 — 아이템을 먹으면 잠깐 나타나요)`),
    h('ul', { class: 'list' }, li(portrait('pj1'), tr`파자마 파티즈`, tr`잠옷 아이돌 그룹(초록 · 분홍 · 하양 · 보라). 꿀맛 페스티벌 티켓을 먹으면 10초 동안 넓게 돌며 공연 — 가까운 적에게 음표를 쏘고, 0.6초마다 음표 충격파로 밀쳐 낸다. 응원으로 쿨타임 -25%`, [ic('pajama'), tr` 꿀맛 페스티벌 티켓`]), li(portrait('leafpair'), tr`한잎이 · 두잎이`, tr`늘 손을 잡고 다니는 섬 주민 둘(얼굴은 드러나지 않는다). 건전지를 먹으면 6초 동안 손을 잡고 가장 가까운 날아오는 것(없으면 가까운 적) 쪽으로 돌아 서서 막고, 닿은 적을 세게 밀쳐 낸다`, [ic('battery'), tr` 건전지`])),
    sec('foes', 'goblin', tr`토벌 대상`),
    h('ul', { class: 'list' }, Object.entries(FOES).filter(([id]) => !(id in BOSS)).map(([id, f]) => li(portrait(id), f.name, f.note))),
    sec('boss', 'dekatsuyo', tr`보스`),
    h('ul', { class: 'list' }, Object.entries(BOSS).map(([id, b]) => li(portrait(id), b.name, b.note, tr`나오는 때: ${when(id)}${b.st ? tr` · 상태이상: ${STATUS[b.st].name}(${STATUS[b.st].note})` : ''}`)), li(portrait('darkstar'), tr`검은 별똥별`, tr`쓰러뜨릴 수 없다 — 끝까지 쫓아오며(점점 빨라진다) 3초마다 별 조각을 사방으로 뿌린다. 30:00까지 도망치기`, tr`나오는 때: ${fmt(DARK_T)}(세이렌을 못 쓰러뜨렸을 때)`)))
  show(h('div', { class: 'panel guide pick dex' },
    h('p', { class: 'h' }, tr`토벌 도감`),
    h('div', { class: 'dex-nav' }, NAV.map(([id, pic, s]) => h('button', { type: 'button', onclick: () => scroll.querySelector(`#dex-${id}`).scrollIntoView({ behavior: 'smooth', block: 'start' }) }, ic(pic), ` ${s}`))),   // 바로 가기
    scroll,
    h('div', { class: 'row' }, btn(tr`← 처음으로`, title, 'main'))))
}
/** 지금 가진 스킬 · 아이템 — pick 을 주면 눌러서 자세히 볼 수 있는 단추로 */
const chips = pick => {
  const chip = (kind, id, txt) => pick ? h('button', { type: 'button', class: `chip${kind === 'w' ? ' w' : ''}`, onclick: e => pick(kind, id, e.currentTarget) }, txt) : h('span', { class: `chip${kind === 'w' ? ' w' : ''}` }, txt)
  return h('div', { class: 'build' }, G.weapons.map(w => chip('w', w.id, [ic(w.id), G.aw.has(w.id) ? ` ★ ${AW[w.id].name}` : ` ${WEAP[w.id].name} Lv${w.lv}`])), Object.entries(G.passives).map(([id, lv]) => chip('p', id, [ic(id), ` ${PASS[id].name} Lv${lv}`])))
}
/** 스킬 · 아이템 자세히 — 지금 수치(아이템 · 캐릭터 보정까지), 다음 레벨, 시너지 */
function skillInfo(kind, id) {
  const r1 = v => +(+v).toFixed(1), kv = (rows, wide) => h('div', { class: `kv${wide ? ' wide' : ''}` }, rows.map(([k, v]) => h('div', {}, h('small', {}, k), h('b', {}, v))))
  if (kind === 'p') {
    const d = PASS[id], lv = G.passives[id]
    return [h('p', { class: 't' }, ic(id), ` ${d.name}`, h('small', {}, ` Lv${lv}/${d.max}`)), h('p', {}, tr`레벨마다 ${d.note}`), kv([[tr`지금`, d.note.replace(/[\d.]+/, x => r1(x * lv))]], true), h('p', { class: 'next' }, lv < d.max ? tr`다음 Lv${lv + 1} — ${d.note.replace(/[\d.]+/, x => r1(x * (lv + 1)))}` : tr`최대 레벨이에요`)]
  }
  const w = G.weapons.find(x => x.id === id), d = WEAP[id], st = w.st, max = d.ups.length + 1
  const rows = [[tr`피해`, r1(st.dmg * S.might)], [tr`쿨타임`, tr`${r1(st.cd * S.cdr)}초`], [tr`개수`, st.n + (PROJ.has(w.id) ? S.amount : 0)], [tr`범위`, `${Math.round(st.area * S.area * 100)}%`]]
  if (st.dur) rows.push([tr`지속`, tr`${r1(st.dur * S.dur)}초`])
  if (st.pierce) rows.push([tr`관통`, st.pierce])
  if (st.bounce) rows.push([tr`튕김`, st.bounce])
  if (st.spd !== 1) rows.push([tr`속도`, `${Math.round(st.spd * S.speed * 100)}%`])
  rows.push([tr`이번 판 피해`, Math.round(G.dmg[id] || 0).toLocaleString()])
  const sy = synOf(id), mate = mateOf(id), on = G.weapons.some(x => x.id === mate)
  return [
    h('p', { class: 't' }, ic(id), ` ${d.name}`, h('small', {}, ` Lv${w.lv}/${max}`)), h('p', {}, `${d.how} — ${d.note}`), kv(rows),
    h('p', { class: 'next' }, w.lv < max ? tr`다음 Lv${w.lv + 1} — ${Object.entries(d.ups[w.lv - 1]).map(([k, v]) => UP[k](v)).join(' · ')}` : G.aw.has(id) ? tr`각성했어요` : tr`최대 레벨 — 보스를 쓰러뜨리면 각성의 별이 떨어져요`),
    h('p', { class: `syn${G.aw.has(id) ? ' on' : ''}` }, ic('awaken'), tr` 각성 「${AW[id].name}」 — ${upText(AW[id].up)} · ${AW[id].note}`),
    h('p', { class: `syn${on ? ' on' : ''}` }, on ? [ic('syn'), tr` 시너지 「${sy[0]}」 켜짐 — ${synText(sy)}`] : [tr`시너지 「${sy[0]}」 — `, ic(mate), tr` ${WEAP[mate].name}을(를) 얻으면 ${synText(sy)}`]),
  ]
}
function pause() {
  if (mode !== 'play') return
  mode = 'pause'; calm(); pauseBtn.hidden = true; SND.duck(true)
  const det = h('div', { class: 'skill-detail' }, h('p', { class: 'hint' }, tr`스킬 · 아이템을 누르면 자세히 볼 수 있어요`))
  const pick = (kind, id, el) => { for (const c of ui.querySelectorAll('.build .chip')) c.classList.toggle('on', c === el); det.replaceChildren(...skillInfo(kind, id)) }
  show(h('div', { class: 'panel' }, h('p', { class: 'h' }, tr`일시정지`, h('span', { class: 'pill' }, ic(G.diff), ` ${DIFF[G.diff].name}`)), zoomRow(), autoSwitch(false), chips(pick), det, dmgTable(), h('div', { class: 'row' }, btn(tr`그만두기`, () => SIM ? simQuit() : finish(false, true)), btn(tr`계속하기`, resume, 'main', 'Enter'))))
}
/** 화면 배율 — 움직이면 바로 바뀐다(뒤 화면에서 보며). 그림은 size() 에서 배율에 맞게 다시 그려 깨지지 않는다 */
function zoomRow() {
  const v = h('b', {}, `${Math.round(save.zoom * 100)}%`), r = h('input', { type: 'range', min: 75, max: 140, step: 5, value: Math.round(save.zoom * 100), 'aria-label': tr`화면 배율` })
  r.oninput = () => { save.zoom = r.value / 100; v.textContent = `${r.value}%`; size(true) }
  r.onchange = () => { persist(); size() }
  return h('label', { class: 'zoom' }, h('span', {}, ic('zoom'), tr` 화면 배율`), r, v)
}
const DMG_NAME = { pajama: tr`파자마 파티즈`, battery: tr`한잎이 · 두잎이`, firework: tr`폭죽` }
/** 이번 판 스킬(· 친구 · 폭죽)별 준 피해 — 많은 순, 막대 · 몫 */
function dmgTable() {
  const rows = Object.entries(G.dmg).sort((a, b) => b[1] - a[1]), sum = rows.reduce((q, r) => q + r[1], 0)
  return h('div', { class: 'dmg' }, h('p', { class: 'dt' }, tr`스킬별 준 피해`), rows.length ? h('ul', {}, rows.map(([id, v]) => h('li', {}, ic(id), h('span', {}, WEAP[id]?.name ?? DMG_NAME[id]), h('i', { style: `--w:${(v / rows[0][1] * 100).toFixed(1)}%` }), h('b', {}, `${Math.round(v).toLocaleString()} · ${Math.round(v / sum * 100)}%`)))) : h('p', { class: 'hint' }, tr`아직 준 피해가 없어요`))
}
/** 보스 · 중간보스를 쓰러뜨리면 — 멈추고 쉬어 가는 창(지금까지 · 스킬별 피해 · 다음 보스) */
function rest() {
  const r = G.rest; G.rest = null
  if (SIM) return   // 모의 토벌 — 쉬어 가는 창 없이 이어 간다
  mode = 'pause'; calm(); pauseBtn.hidden = true; SND.duck(true)
  show(h('div', { class: 'panel' }, h('p', { class: 'h' }, tr`${r.name} 토벌!`), h('p', { class: 'sub' }, tr`${fmt(G.t)} · Lv ${G.lvl} · 처치 ${G.kills.toLocaleString()} — ${nextLine()[0]}`),
    dmgTable(), h('p', { class: 'hint' }, tr`잠깐 쉬어 가요. 준비되면 계속!`), h('div', { class: 'row' }, btn(tr`계속하기`, resume, 'main', 'Enter'))))
}
function resume() { if (mode !== 'pause') return; mode = 'play'; ui.hidden = true; pauseBtn.hidden = false; SND.duck(false) }
function finish(win, quit = false) {
  mode = 'over'; BOX = null; calm(); pauseBtn.hidden = true; SND.duck(false); SND.end(win)
  const b = save.best[bestKey(G.ch.id, G.diff)] ||= { t: 0, kills: 0, lvl: 0, clears: 0 }, rec = !quit && G.t > b.t
  save.runs++; save.kills += G.kills
  report(quit ? 'quit' : !win ? 'dead' : G.endKind === 'time' ? 'survive' : 'clear')
  const hardish = G.diff === 'hard' || G.inf; win ||= G.inf && G.loop.lv > 0   // 무한 — 쓰러져도 세이렌을 한 번 쓰러뜨렸으면 클리어(업적 · 의상 · 보상금)
  const crown = OUTFITS_OF(G.ch.id).find(k => OUTFIT[k].tier === 'ach' && OUTFIT[k].ch), crown0 = !!crown && owns(crown)   // 업적 의상(섬 화관 등) — 판 전에 없고 판 뒤에 생겼을 때만 알림(어려움 뒤 무한 · 무한 뒤 어려움에 또 뜨지 않게)
  const fire = win && hardish && G.winter && !OUTFIT.fire.won()   // 겨울 맵을 처음 어려움으로 클리어 — 불꽃 옷(모두)
  const id = G.ch.id, had = [...OUTFITS_OF(id).filter(k => OUTFIT[k].tier === 'clear' && owns(k)), ...WSKINS_OF(id).filter(ownsW)]   // 클리어 보상(망토 · 무기 스킨) — 이번 판으로 새로 열린 것을 결과 화면에
  if (win) { save.clears++; b.clears++ }
  const dress = !crown0 && !!crown && owns(crown) && crown
  if (win && G.winter) { save.wlv[id] = Math.max(winLv(id), CLR[G.diff] || 0); if (G.diff !== 'easy' && !save.wwin.includes(id)) save.wwin.push(id) }   // 겨울 — 난이도별(wlv) · 예전 칸(wwin)
  const newO = OUTFITS_OF(id).filter(k => OUTFIT[k].tier === 'clear' && owns(k) && !had.includes(k)), newW = WSKINS_OF(id).filter(k => WSKIN[k].tier !== 'shop' && ownsW(k) && !had.includes(k))
  const pay = bounty(win); save.coin += pay.sum
  const got = achieve(win, pay.sum)
  if (G.inf) b.lv = Math.max(b.lv || 0, G.loop.lv); save.last = Date.now()   // 무한 최고 단계 · 마지막으로 한 때(기록 고르기 창)
  b.t = Math.max(b.t, G.t); b.kills = Math.max(b.kills, G.kills); b.lvl = Math.max(b.lvl, G.lvl)
  persist()
  const stat = (k, v, n) => h('div', {}, h('small', {}, k), h('b', {}, v), n && h('span', { class: 'new' }, 'NEW'))
  show(h('div', { class: `panel result${win ? ' win' : ''}` },
    portrait(G.ch.id),
    h('p', { class: 'h' }, G.inf && G.loop.lv ? [tr`무한 ${G.loop.lv}단계! `, ic('party')] : win ? [G.endKind === 'time' ? tr`30분 생존! ` : tr`토벌 성공! `, ic('party')] : quit ? tr`토벌 중단` : tr`쓰러졌다… 와아…`),
    h('p', { class: 'sub' }, G.inf && G.loop.lv ? tr`세이렌을 ${G.loop.sirens}명 쫓아냈어요! 더 멀리 가 봐요` : win ? (G.endKind === 'time' ? tr`검은 별똥별에게서 끝까지 도망쳤어요!` : tr`세이렌을 쫓아냈어요!`) : G.final ? tr`세이렌까지 왔어요! 조금만 더` : tr`세이렌까지 ${fmt(Math.max(0, FINAL_T - G.t))} 남았어요`),
    h('p', { class: `lvl-badge ${G.diff}` }, ic(G.diff), ` ${G.D.name}`),
    G.inf && rankLine(),   // 무한 — 랭킹 #순위(로그인) / 로그인 안내
    h('div', { class: 'stats' }, G.inf ? [stat(tr`도달 단계`, `∞ ${G.loop.lv}`), stat(tr`버틴 시간`, fmt(G.t), rec), stat(tr`처치`, G.kills.toLocaleString()), stat(tr`보스`, G.bosses)]   // 무한은 랭킹 순서대로
      : [stat(tr`버틴 시간`, fmt(G.t), rec), stat(tr`레벨`, G.lvl), stat(tr`처치`, G.kills.toLocaleString()), stat(tr`보스`, G.bosses)]),
    h('div', { class: 'coin pay' },   // 토벌 보상금 · 떠돌이 보물상자 · 합계를 줄마다
      h('p', {}, ic('coin'), h('span', {}, tr`토벌 보상금`, h('small', {}, `${pay.parts.filter(p => p[1]).map(p => `${p[0]} ${p[1]}`).join(' · ') || tr`조금 더 버텨 봐요`}${G.D.coin > 1 ? ` (${G.D.name} ×${G.D.coin})` : ''}`)), h('b', {}, `+${pay.base.toLocaleString()}`)),
      h('p', { class: 'found' }, ic('coinbox'), h('span', {}, tr`떠돌이 보물상자`, h('small', {}, tr`멀리 움직이면 10초마다 나와요`)), h('b', {}, `+${pay.found.toLocaleString()}`)),
      h('p', { class: 'sum' }, h('span', {}, tr`합계`), h('b', {}, `+${pay.sum.toLocaleString()}`))),
    (dress || fire) && h('div', { class: 'ach-new dress' }, h('p', { class: 'dt' }, tr`업적 의상을 받았어요!`), [dress, fire && 'fire'].filter(Boolean).map(oid => h('span', {}, portrait(G.ch.id, oid), ` ${OUTFIT[oid].name}`)), h('small', {}, tr`상점 「의상」 탭에서 입을 수 있어요`)),   // 여러 벌이어도 제목 · 안내는 한 번
    (newO.length || newW.length) > 0 && h('div', { class: 'ach-new dress' }, h('p', { class: 'dt' }, tr`클리어 보상을 받았어요!`), newO.map(oid => h('span', {}, portrait(id, oid), ` ${OUTFIT[oid].name}`)), newW.map(wid => h('span', {}, portrait(id, wornId(id), wid), ` ${WSKIN[wid].name}`)), h('small', {}, tr`상점 「의상」 · 「무기 스킨」 탭에서 바꿀 수 있어요`)),
    got.length > 0 && h('div', { class: 'ach-new' }, h('p', { class: 'dt' }, tr`업적 달성!`), got.map(([id, t]) => h('span', {}, medal(id, t), ` ${ACH[id].name} ${TIER[t]}${t === 3 ? tr` — 보상금 +1%` : ''}`))),
    chips(), dmgTable(),
    h('div', { class: 'row' }, btn(tr`처음으로`, title), btn(tr`상점`, () => shop()), btn(tr`캐릭터 바꾸기`, chars), btn(tr`다시 하기`, () => startGame(pickCi), 'main'))))
}
/** 토벌 보상금 — 버틴 시간(10초에 1) · 처치(200에 1 — 뒤로 갈수록 처치가 크게 늘어서) · 보스 15 · 클리어 60, 난이도 배수(DIFF.coin) */
function bounty(win) {
  const parts = [[tr`버틴 시간`, G.t / 10], [tr`처치`, G.kills / 200], [tr`보스`, G.bosses * 15], [tr`클리어`, win ? 60 : 0]].map(([k, v]) => [k, Math.floor(v * G.D.coin)])
  const base = parts.reduce((a, p) => a + p[1], 0), g = golds(), bonus = Math.ceil(base * g / 100)   // 업적 금메달 하나마다 +1%(올림 — 금메달이 있으면 적어도 1)
  if (bonus) parts.push([tr`금메달 ${g}개 보너스`, bonus])
  const cb = coll('coin') && Math.ceil(base * coll('coin')); if (cb) parts.push([tr`의상 보유 효과`, cb])   // 의상 보유 효과 — 토벌 보상금 +%
  return { parts, base: base + bonus + cb, found: G.found, sum: base + bonus + cb + G.found }   // 떠돌이 보물상자에서 받은 것은 그대로(난이도 배수 · 금메달 보너스 없이) — 결과 화면에서 따로 한 줄
}
/** 판이 끝나면 업적 누적을 더하고, 새로 딴 메달 [id, 단계] 를 돌려준다 */
function achieve(win, coin) {
  const A = save.ach, before = Object.fromEntries(Object.keys(ACH).map(id => [id, tierOf(id)])), add = (k, n) => { A[k] = (A[k] || 0) + n }
  add('goblin', G.gob); add('pajama', G.pj); add('lv8', G.weapons.filter(w => w.lv >= 8).length); add('aw', G.aw.size); add('parry', G.parried); save.awSeen = [...new Set([...(save.awSeen || []), ...G.aw])]; add('coin', coin); add('jackpot', G.jackpots); add('boss', G.bosses)
  if (win) { add(G.endKind === 'time' ? 'survive' : 'clear', 1); if (G.diff === 'hard' || G.inf) add('hard', 1); if ((G.diff === 'hard' || G.inf) && G.winter) add('winter', 1) }   // 무한도 세이렌을 쓰러뜨렸으면 어려움 클리어로
  add('storm', G.storms)
  if (G.t >= 300 && (G.hit0 ?? G.t) >= 300) add('nohit', 1)
  return Object.keys(ACH).filter(id => tierOf(id) > before[id]).map(id => [id, tierOf(id)])
}
/** 업적 — 메달 · 다음 메달까지 막대. 금메달 하나마다 토벌 보상금 +1% */
function achs() {
  mode = 'ach'; G = null; BOX = null; pauseBtn.hidden = true
  const g = golds(), n = Object.keys(ACH).length
  show(h('div', { class: 'panel guide pick' }, h('p', { class: 'h' }, tr`업적`), h('p', { class: 'coin' }, medal('runs', 3), tr` 금메달 ${g} / ${n} — 토벌 보상금 +${g}%`),
    h('div', { class: 'scroll' }, h('p', { class: 'shop-note' }, tr`동 · 은 · 금메달을 차례로 따요. 쉬운 업적은 많이, 어려운 업적은 적게 해도 돼요. 금메달 하나마다 토벌 보상금 +1%`),
      h('ul', { class: 'list ach' }, Object.entries(ACH).map(([id, a]) => {
        const t = tierOf(id), v = achVal(id), next = a.tiers[t]
        return h('li', {}, medal(id, t), h('div', {}, h('b', {}, a.name, h('small', { class: 'pips', 'aria-label': TIER[t] || tr`아직` }, [1, 2, 3].map(i => h('i', { class: i <= t ? `t${i}` : '' })))),
          h('span', {}, `${a.note} — ${a.tiers.map((x, i) => `${TIER[i + 1][0]} ${x.toLocaleString()}`).join(' · ')}`),
          t < 3 ? h('span', { class: 'prog' }, h('i', { style: `--w:${(Math.min(1, v / next) * 100).toFixed(1)}%` }), `${v.toLocaleString()} / ${next.toLocaleString()} → ${TIER[t + 1]}`) : h('em', {}, tr`금메달 — 토벌 보상금 +1%`)))
      }))),
    h('div', { class: 'row' }, btn(tr`← 처음으로`, title, 'main'))))
}
// ---------------------------------------------------------------- 돌리기
let last = 0, lastMode = '', tnow = 0
/** 자동 화질 — 판 처음(5~90초)의 가장 빠른 프레임 시간을 기준으로, 나중에 그보다 1.6배(적어도 26ms) 넘게 느려지면 한 단계씩(4초 간격) 픽셀을 줄이고 작은 적 그림자를 뺀다.
 *  그림만 바뀌고 게임은 그대로. 판마다 다시 0. 30fps 로 묶인 기기(절전)는 기준이 33ms 라 괜히 내려가지 않는다 */
const AQ = { ema: 0, base: 1e9, at: 0 }
function autoQ(raw) {
  if (mode !== 'play' || !G || raw > 250) return   // 탭을 다녀오면 한 번 크게 튄다 — 빼고
  AQ.ema = AQ.ema ? AQ.ema + (raw - AQ.ema) * 0.03 : raw
  if (G.t > 5 && G.t < 90) AQ.base = Math.min(AQ.base, AQ.ema)   // 처음 프레임 — 30fps 로 묶인 기기를 알아보려고
  const lock = AQ.base > 30 && AQ.base < 37, th = LQ ? Math.max(40, lock ? AQ.base * 1.6 : 0) : Math.max(25, lock ? AQ.base * 1.25 : 0)
  if (LQ < 2 && G.t > 5 && G.t - AQ.at > 3 && AQ.ema > th) { LQ++; AQ.at = G.t; size(true) }   // 평균 프레임이 25ms(LQ1) · 40ms(LQ2)를 넘으면 — 절대값(기획: 처음부터 느린 구형 폰도 켜지게). 30fps 로 묶인 기기(처음부터 33ms)는 그만큼 올려서 괜히 안 내린다 — 그래서 기준(5초부터)이 잡히기 전엔 안 내린다(QC). 내려가기만 · 그림은 다시 그리지 않는다
}
function frame(ts) {
  if (SIM && !SIM.watch) { last = ts; return requestAnimationFrame(frame) }   // 모의 토벌 건너뛰기 — 그리지 않는다(뒤는 멈춘 화면 그대로)
  if (SIM) SIM.spec.hidden = mode !== 'play' || !!MODAL
  if (AUTOB.at) { const age = performance.now() - AUTOB.at; AUTOB.hidden = mode !== 'play' || !!MODAL || age > 1800; AUTOB.classList.toggle('out', age > 1500) }   // 자동 알림 띠
  if (last && !SIM) autoQ(ts - last)   // 관전 중엔 화질 단계를 바꾸지 않는다(fx · 숫자 칸 수가 시드 무작위에 닿는다)
  let dt = Math.min(0.05, last ? (ts - last) / 1000 : 0.016)
  if (CTRL) ctrlTick(Math.min(0.25, last ? (ts - last) / 1000 : 0))   // 조작법 시계 — 실제 시간(배속 · 느린 기기의 0.05 묶음과 상관없이)
  last = ts; tnow += dt
  if (mode === 'play' && G && SIM) simWatch(dt)
  else if (mode === 'play' && G) { guardIn(); if (G.dying > 0) dt *= 0.3; for (let i = 0; i < spd && mode === 'play'; i++) step(dt); guardOut() }   // 2배속은 한 프레임에 두 번(한 번에 길게 돌리면 빠른 탄이 적을 지나친다)
  else if (!G) cam.x += dt * 24
  if (mode !== lastMode) { lastMode = mode; still = 2 }
  if (mode === 'play' || !G || still-- > 0) render()   // 상자 · 일시정지 · 결과 동안은 다시 그리지 않는다 — 메뉴 연출이 부드럽게
  requestAnimationFrame(frame)
}
size()
if (/[?&]privacy\b/.test(location.search)) privacy(); else if (/[?&]terms\b/.test(location.search)) terms(); else title()
if (GUARD) blockCheck()
requestAnimationFrame(frame)
if (auth) {   // 로그인해 둔 기기 — 계정 저장과 맞춘다(방금 로그인했으면 0.3초 넘게 걸릴 때만 「로그인 중이에요」 — 금방 끝나면 번쩍이지 않게 · 닉네임부터)
  let done = null; const t = AUTH_NEW && setTimeout(() => { done = busy(tr`내 기록을 불러오는 중이에요`, { prov: auth.prov, retry: () => location.reload() }) }, 300)
  link().finally(() => { clearTimeout(t); done?.() })
}
// 점검용 — 브라우저 콘솔 · 자동 테스트에서 판을 빨리 돌려 본다
if (!SECURE) window.__mjg = { adv: dt => { tnow += dt }, busy, item, ITEM_CAP, portrait, ranking, owns, ownsW, get S() { return S }, ctrlTick: dt => CTRL && ctrlTick(dt), get CTRL() { return CTRL }, OUTFIT, WSKIN, SKIN, wornId, outfitOf, shop, stormHurts, charSprites, render, autoQ, addWeapon, WEAP, PLAN, wstat, spawn, LOOT, WANDER, SND, get LQ() { return LQ }, set LQ(v) { LQ = v; size(true) }, get SPR() { return SPR }, get K() { return K }, FINAL_T, DARK_T, END_T, sasu: sasuShape, ICO, ico: icoSpr, statRow, STATS, step, startGame, resume, summon, art: artSprite, WALK, CHARS, get G() { return G }, INF, finish, kill, ouch, guardCut, simRun, simNew, simClose, simOpen, simPlan, simGo, simSkip, simQuit, simStep, get SIM() { return SIM }, get pl() { return pl }, get mode() { return mode }, pick0() { if (BOX) { take(BOX.opts[0]); next() } } }
