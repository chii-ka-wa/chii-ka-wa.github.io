-- 먼작귀 서바이버즈 — 익명 플레이 통계 표. Supabase 대시보드 › SQL Editor 에 붙여 넣고 Run 한 번
-- 게임(공개 키)은 「넣기」만 할 수 있고 읽기 · 고치기 · 지우기는 못 한다. 보는 것은 대시보드(Table Editor · SQL Editor)에서만 — supabase/stats.sql
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
  weapons    text check (char_length(weapons) <= 300),                            -- 스킬 id + 레벨(예: sasu8 ramen8)
  touch      boolean not null default false                                       -- 휴대폰 · 태블릿(손가락)
);
alter table public.runs enable row level security;
drop policy if exists "game inserts only" on public.runs;
create policy "game inserts only" on public.runs for insert to anon with check (true);
revoke select, update, delete on public.runs from anon, authenticated;
grant insert on public.runs to anon;
create index if not exists runs_created_at on public.runs (created_at);
