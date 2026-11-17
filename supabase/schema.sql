-- 먼작귀 서바이버즈 — 익명 플레이 통계 표. Supabase 대시보드 › SQL Editor 에 붙여 넣고 Run 한 번
-- 게임(공개 키)은 report_run 함수로 「넣기」만 할 수 있고(검사 · 횟수 제한) 표 읽기 · 고치기 · 지우기 · 바로 넣기는 못 한다. 보는 것은 대시보드(Table Editor · SQL Editor)에서만 — supabase/stats.sql
create table if not exists public.runs (
  id         bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  v          text not null check (char_length(v) <= 40),                          -- 게임 버전(패치노트 날짜#항목 수)
  ch         text not null check (char_length(ch) <= 20),                         -- 캐릭터 id(chiikawa · hachiware …)
  diff       text not null check (diff in ('easy', 'normal', 'hard')),            -- 난이도
  result     text not null check (result in ('dead', 'clear', 'survive', 'quit')), -- 쓰러짐 · 세이렌 격파 · 30분 생존 · 그만두기
  t          int  not null check (t between 0 and 2000),                          -- 버틴 시간(초)
  lvl        int  not null check (lvl between 1 and 1000),
  kills      int  not null check (kills between 0 and 2000000),
  killer     text check (char_length(killer) <= 40),                              -- 쓰러뜨린 것(쓰러졌을 때만)
  boss       text check (char_length(boss) <= 40),                                -- 그때 나와 있던 보스
  weapons    text check (char_length(weapons) <= 300),                            -- 스킬 id + 레벨(예: sasu8 ramen9 — 9 는 각성)
  touch      boolean not null default false,                                      -- 휴대폰 · 태블릿(손가락)
  up         int  not null default 0 check (up between 0 and 100)                 -- 상점에서 산 영구 강화 칸 수(0 = 강화 없이)
);
-- 예전에 만든 표에 강화 칸 수 열 더하기(이미 있으면 그냥 넘어간다) — 그 전 판은 상점이 없던 때라 0
alter table public.runs add column if not exists up int not null default 0 check (up between 0 and 100);
alter table public.runs enable row level security;
-- 익명은 표를 아예 못 만진다(넣기도) — 넣는 것은 아래 report_run 함수로만. 예전엔 with check (true) 로 바로 넣게 열어 두어 created_at 까지 마음대로 넣을 수 있었다
drop policy if exists "game inserts only" on public.runs;
revoke all on public.runs from anon, authenticated;
create index if not exists runs_created_at on public.runs (created_at);

-- 저장 전 검사 — 집계(stats.sql)가 이상한 줄 하나에 통째로 실패하지 않게. not valid = 이미 있는 줄은 그대로 두고 새 줄만 검사
--   스킬 · 캐릭터 id 는 소문자 이름 모양만 본다(새 스킬을 더해도 SQL 을 안 고쳐도 되게). 스킬은 6개까지 · 레벨 1~9(9 = 각성)
--   말이 안 되는 판: 세이렌 격파(clear)는 25분, 30분 생존(survive)은 30분 전에 못 끝난다 · 처치 · 레벨이 버틴 시간에 비해 터무니없이 많으면
alter table public.runs drop constraint if exists runs_v, drop constraint if exists runs_ch, drop constraint if exists runs_weapons, drop constraint if exists runs_sane;
alter table public.runs add constraint runs_v check (v ~ '^\d{4}-\d{2}-\d{2}#\d{1,3}$') not valid,
  add constraint runs_ch check (ch ~ '^[a-z]{2,12}$') not valid,
  add constraint runs_weapons check (weapons ~ '^[a-z]{2,12}[1-9]( [a-z]{2,12}[1-9]){0,5}$') not valid,
  add constraint runs_sane check ((result <> 'clear' or t >= 1500) and (result <> 'survive' or t >= 1790) and kills <= 100 * t + 100 and lvl <= t / 4 + 20) not valid;

-- 넣는 문 — 게임은 POST /rest/v1/rpc/report_run 만 부른다. 시각(created_at)은 서버가 찍는다(인자에 없다)
--   요청 횟수 제한: 같은 IP 한 시간 30판 · 모두 합쳐 한 시간 3000판까지(넘으면 조용히 버린다). IP 는 md5 로만 한 시간 들고 있다가 지운다
--   IP 를 못 읽으면(헤더 없음) IP 제한은 건너뛰고 전체 제한만 — 확인: select count(*) filter (where h is null), count(*) from run_gate;
create table if not exists public.run_gate (h text, at timestamptz not null default now());
create index if not exists run_gate_at on public.run_gate (at);
alter table public.run_gate enable row level security;   -- 정책 없음 = 함수 말고는 아무도 못 본다
revoke all on public.run_gate from anon, authenticated;
create or replace function public.report_run(v text, ch text, diff text, result text, t int, lvl int, kills int,
  killer text default null, boss text default null, weapons text default null, touch boolean default false, up int default 0)
returns void language plpgsql security definer set search_path = public as $$
declare
  hd json := coalesce(nullif(current_setting('request.headers', true), '')::json, '{}');
  ip text := coalesce(hd->>'cf-connecting-ip', nullif(trim(split_part(hd->>'x-forwarded-for', ',', 1)), ''));
  ipk text := md5(ip);
begin
  delete from run_gate where at < now() - interval '1 hour';
  if ipk is not null and (select count(*) from run_gate where h = ipk) >= 30 then return; end if;
  if (select count(*) from run_gate) >= 3000 then return; end if;
  insert into run_gate (h) values (ipk);
  insert into runs (v, ch, diff, result, t, lvl, kills, killer, boss, weapons, touch, up) values (v, ch, diff, result, t, lvl, kills, killer, boss, weapons, touch, up);
end $$;
revoke all on function public.report_run from public;
grant execute on function public.report_run to anon;
notify pgrst, 'reload schema';
-- 시각을 한국 시간으로 보기: created_at 은 그 순간을 그대로 저장하지만 Supabase 는 UTC(한국 −9시간)로 보여 준다 — 이 줄을 Run 하면 대시보드 · SQL 결과가 한국 시간(+09)으로 나온다(저장된 값은 그대로)
alter database postgres set timezone to 'Asia/Seoul';
