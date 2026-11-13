-- 먼작귀 서바이버즈 — 통계 보기. SQL Editor 에서 보고 싶은 것 하나를 골라 Run(맨 아래 where 로 기간 · 버전을 좁힐 수 있다)

-- 1. 어떤 캐릭터 · 난이도를 많이 하나
select ch as 캐릭터, diff as 난이도, count(*) as 판, round(avg(t) / 60.0, 1) as 평균_버틴_분,
       round(100.0 * count(*) filter (where result in ('clear', 'survive')) / count(*), 1) as 클리어율
from runs group by 1, 2 order by 판 desc;

-- 2. 몇 분에 많이 쓰러지나(난이도별)
select t / 60 as 분, count(*) filter (where diff = 'easy') as 쉬움, count(*) filter (where diff = 'normal') as 보통,
       count(*) filter (where diff = 'hard') as 어려움, count(*) as 모두
from runs where result = 'dead' group by 1 order by 1;

-- 3. 무엇에 많이 쓰러지나(그때 나와 있던 보스 · 쓰러뜨린 것)
select coalesce(boss, '(보스 없음)') as 보스, coalesce(killer, '?') as 쓰러뜨린_것, count(*) as 판
from runs where result = 'dead' group by 1, 2 order by 판 desc limit 40;

-- 4. 캐릭터별로 가장 많이 쓰러진 시간대 · 원인
select ch as 캐릭터, count(*) as 쓰러짐, round(avg(t) / 60.0, 1) as 평균_분, mode() within group (order by killer) as 가장_많은_원인
from runs where result = 'dead' group by 1 order by 쓰러짐 desc;

-- 5. 많이 쓴 스킬(끝났을 때 가진 것)
select regexp_replace(w, '\d+$', '') as 스킬, count(*) as 판, round(avg(regexp_replace(w, '^\D+', '')::int), 1) as 평균_레벨
from runs, unnest(string_to_array(weapons, ' ')) as w where w <> '' group by 1 order by 판 desc;

-- 6. 날마다 판 수 · 휴대폰 비율
select created_at::date as 날짜, count(*) as 판, round(100.0 * count(*) filter (where touch) / count(*), 1) as 휴대폰_비율
from runs group by 1 order by 1 desc;

-- 7. 강화한 판 · 안 한 판(상점에서 산 칸 수 — 다 사면 36). 상점이 생긴 2026-11-14 판부터
select diff as 난이도, case when up = 0 then '① 강화 없음' when up <= 10 then '② 1~10칸' when up <= 25 then '③ 11~25칸' else '④ 26칸 이상' end as 강화,
       count(*) as 판, round(avg(t) / 60.0, 1) as 평균_버틴_분, round(avg(lvl), 1) as 평균_레벨,
       round(100.0 * count(*) filter (where result in ('clear', 'survive')) / count(*), 1) as 클리어율
from runs where v >= '2026-11-14' and result <> 'quit' group by 1, 2 order by 1, 2;
