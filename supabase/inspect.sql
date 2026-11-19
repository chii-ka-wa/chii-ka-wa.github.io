-- 부정 플레이 살펴보기 — Supabase 대시보드 SQL Editor 에서 하나씩 Run(읽기만 한다 · 지우기 · 차단은 맨 아래 주석을 직접 고쳐서)
-- 표: cheat_log(게임 · 서버가 남긴 부정 신호) · bans(차단) · ranks(랭킹 기록) · players(닉네임). 규칙은 account.sql 의 submit_rank 와 같다

-- 1) 의심 목록 — 계정 · IP 마다 걸린 횟수와 이유(한 대도 안 맞은 긴 판이 맨 위)
select * from suspects limit 50;

-- 2) 최근 부정 신호 — 이유: save(저장 조작 — 바로 정지) · ck(체크섬 어긋남) · seal(게임 봉인 깨짐 — 메모리 고치기) · spd(자격 없는 3배속) · rank(말이 안 되는 기록 → 자동 정지) · nohit(한 대도 안 맞은 긴 판) · coin(보상금 급증)
select l.at, (select p.nick from players p where p.uid = l.uid) as nick, l.uid, l.reason, l.detail, left(l.ip_h, 8) as ip
from cheat_log l order by l.at desc limit 100;

-- 3) 랭킹 기록 점검 — 지금 규칙(새 서버 검사)으로 다시 보면 걸리는 기록. bad 칸에 이유가 나온다(비어 있으면 통과)
--    winter = 겨울 맵 기록(true) · 풀밭(false) — 한 사람이 캐릭터마다 맵별로 하나씩 가진다
--    real = 판 시작 → 올리기까지 실제 초(새로 생긴 칸 — 예전 기록은 비어 있다). real 이 t ÷ 3 에 가까우면 내내 3배속이거나 만든 기록일 수 있다
with x as (
  select p.nick, r.*, (select coalesce(sum((regexp_match(s, '(\d+)$'))[1]::int), 0) from unnest(string_to_array(coalesce(r.slain, ''), ' ')) s where s <> '') as slain_sum
  from ranks r join players p using (uid)
)
select nick, ch, winter, lv, bosses, t, kills, round(kills::numeric / greatest(t, 1), 1) as kps, lvl, real, weapons, slain, at, uid,
  concat_ws(', ',
    case when bosses > case when lv = 0 then 6 else 4 + 15 * lv end + 2 then '보스가 너무 많음' end,
    case when bosses < slain_sum then '보스 < 종류별 합' end,
    case when bosses < lv then '보스 < 단계' end,
    case when lv > 0 and t < 1500 + case when lv <= 1 then 0 else 132 + 72 * least(lv - 2, 3) + 12 * greatest(lv - 5, 0) end then '단계에 비해 시간이 짧음' end,
    case when kills > 100 * t + 100 then '처치가 너무 많음' end,
    case when lvl > t / 4 + 20 then '레벨이 너무 높음' end,
    case when bt > t then '마지막 보스 시각 > 버틴 시간' end,
    case when split_part(weapons, ' ', 1) !~ ('^' || coalesce((json_build_object('chiikawa', 'sasu', 'hachiware', 'guitar', 'usagi', 'stick', 'momonga', 'momo', 'kurimanju', 'kanpai', 'rakko', 'sword', 'kani', 'book', 'shisa', 'ramen') ->> ch), '[a-z]{2,12}') || '[1-9]$') then '첫 스킬이 캐릭터 무기가 아님' end,
    case when real is not null and real < t / 3.0 - 30 then '실제 시간이 너무 짧음' end
  ) as bad
from x order by (concat_ws('', case when bosses > case when lv = 0 then 6 else 4 + 15 * lv end + 2 then 1 end) <> '') desc, lv desc, bosses desc;

-- 4) 지금 차단 중
select b.id, b.at, b.until, b.stop, b.reason, (select p.nick from players p where p.uid = b.uid) as nick, b.uid, left(b.ip_h, 8) as ip from bans b where b.until is null or b.until > now() order by b.at desc;

-- 5) 저장 조작 — 상점 강화가 칸 수를 넘는 계정 저장(save_bad). 이런 계정은 다음에 저장이 올라가는 순간 자동으로 정지 + IP 7일이 된다(account.sql saves_check)
--    지금 바로 막으려면 아래 주석을 풀어 Run(계정만 정지 — IP 는 저장을 올릴 때만 알 수 있어서 못 막는다)
select p.nick, s.uid, s.data->'up' as up, s.updated_at from saves s left join players p using (uid) where save_bad(s.data) order by s.updated_at desc;
--   insert into bans (uid, stop, reason) select s.uid, true, 'save' from saves s where save_bad(s.data) and not exists (select 1 from bans b where b.uid = s.uid and b.stop and b.until is null);

-- 6) 걸린 기록 정리(직접 고쳐서 Run) — 기록만 지우기 / 계정 정지(랭킹 제외 · 로그인 막기)
--   delete from ranks where uid = '<uid>';
--   insert into bans (uid, stop, reason) values ('<uid>', true, '<이유>');
--   잘못 막았으면:  delete from bans where id = <번호> or uid = (select uid from bans where id = <번호>);
