-- 무한 랭킹 초기화 — ⚠ 한 번만 Run 한다(account.sql 에 넣지 않는다: account.sql 은 여러 번 다시 돌리는 파일이라, 넣으면 돌릴 때마다 랭킹이 지워진다)
-- 2026-11-19 사용자 결정 — 무한 모드가 바뀌어(처음 25분 보스 강화 · 냄비뚜껑 방패) 랭킹을 겨울 · 풀밭으로 나누고 처음부터 새로 시작한다
-- 순서: ① 부정행위 조사 SQL(최근 7일 bans · cheat_log · 정지된 계정의 ranks)의 결과를 먼저 확인하고 남겨 둔다 — 세 번째가 ranks 를 본다
--       ② 이 파일을 SQL Editor 에서 Run  ③ 게임 푸시(패치노트 「… 처음부터 새로 시작해요」)
-- 지우는 것: ranks(무한 랭킹 기록)만. 계정 저장 · 업적 · 의상 · 닉네임 · cheat_log · bans 는 그대로
select count(*) as "지울 랭킹 기록 수" from public.ranks;
delete from public.ranks;
select count(*) as "남은 기록(0 이어야 한다)" from public.ranks;
