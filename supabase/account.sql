-- 계정(카카오 · 구글 로그인) — 저장 기록 동기화 · 닉네임 · 무한 모드 랭킹. Supabase 대시보드 SQL Editor 에 통째로 붙여 Run(여러 번 돌려도 된다)
--   게임은 공개 키(publishable) + 로그인 토큰으로 부른다. 표는 RLS 로 막고, 남의 것은 아래 함수로만 본다
--   ponytail: 랭킹 기록은 게임(브라우저)이 보낸 값 — 서버는 「판 시작 시각 → 실제 흐른 시간」 · 그럴듯한지 · 체크섬 · 횟수까지만 막는다. 이상한 기록은 대시보드에서 지운다(delete from ranks where …)
--   부정 플레이: 걸린 것은 cheat_log 에 남고(IP 는 해시로만, 90일 보관) 의심 목록(suspects)으로 본다. 차단되면 랭킹 · 익명 통계에서 빠지고, IP 가 막히면 사이트도 못 연다(blocked — 게임이 스스로 멈춘다)
--   자동 정지(ban_me — 계정 영구 · IP 7일): 정직한 게임이 못 내는 랭킹 기록(submit_rank) · 같은 계정에서 7일 안에 체크섬 어긋남 · 봉인 깨짐 · 자격 없는 3배속 3번(report_cheat)
--   정지된 계정은 게임이 알아서 로그아웃시킨다(suspended — 로그인 없는 판은 그대로). 탈퇴하면(delete_me) 정지 · 그 계정 때문에 걸린 IP 차단 · 부정 플레이 기록도 바로 지운다(사용자 결정 — 재가입 막기는 없다)

-- 0) 부정 플레이 기록 · 차단 ------------------------------------------------------------------------------------------------
create table if not exists public.cheat_log (
  id     bigint generated always as identity primary key,
  at     timestamptz not null default now(),
  uid    uuid,                                                        -- 로그인했으면 계정
  ip_h   text,                                                        -- IP 해시(md5 + 서버 비밀값 — 원래 IP 는 남기지 않는다)
  reason text not null check (reason ~ '^[a-z]{2,12}$'),              -- seal(프레임 봉인 깨짐) · spd(3배속 자격 없음) · ck(랭킹 체크섬 어긋남) · nohit(한 대도 안 맞은 긴 무한 판) · coin(보상금이 너무 빨리 늚) · save(저장 조작 — 상점 강화가 칸 수를 넘음 → 바로 정지)
  detail jsonb check (detail is null or pg_column_size(detail) < 2000)
);
create index if not exists cheat_log_at on public.cheat_log (at);
create index if not exists cheat_log_ip on public.cheat_log (ip_h);
alter table public.cheat_log enable row level security;   -- 정책 없음 = 함수 · 대시보드만
revoke all on public.cheat_log from anon, authenticated;

-- 차단 — 계정(uid) 또는 IP(ip_h). until 이 지나면 풀린다(null = 직접 풀 때까지). 계정 차단 = 랭킹 · 통계에서 빠짐, IP 차단 = 거기에 더해 사이트를 못 연다
--   계정 정지 = stop 인 계정 차단(로그인을 막는다 — 게임이 로그아웃). ban_me 가 건 IP 차단 줄에도 계정(uid)을 적어 두어 탈퇴하면 같이 지운다
--   자동: ban_me(계정 정지 영구 · IP 7일) · 보상금 급증 coin(계정 차단만 — 랭킹에서만 빼 두고 확인을 기다린다). 안내 화면 · 처음 화면의 번호 = bans.id
--   ★ 잘못 막혔다는 문의를 받으면(번호를 알려 준다) — 풀기(같이 걸린 계정 · IP 줄까지):  delete from bans where id = <번호> or uid = (select uid from bans where id = <번호>);
--   직접 정지:  insert into bans (uid, stop, reason) values ('<uid>', true, '<이유>');
--   계정 차단(먼저 쓰기를 권함):  insert into bans (uid, reason) values ('<uid>', '무적');
--   IP 차단(기간제를 권함 — 통신사 · 학교는 여러 사람이 IP 하나를 같이 쓴다):  insert into bans (ip_h, reason, until) values ('<ip_h>', '무적', now() + interval '7 days');
--   원래 IP 를 알면:  insert into bans (ip_h, reason, until) values (public.ip_hash('1.2.3.4'), '…', now() + interval '7 days');
--   풀기:  delete from bans where id = <id>;   지금 차단:  select * from bans where until is null or until > now();
create table if not exists public.bans (
  id     bigint generated always as identity primary key,
  uid    uuid,
  ip_h   text,
  reason text,
  at     timestamptz not null default now(),
  until  timestamptz,
  check (uid is not null or ip_h is not null)
);
create index if not exists bans_uid on public.bans (uid);
create index if not exists bans_ip on public.bans (ip_h);
alter table public.bans add column if not exists stop boolean not null default false;   -- 계정 정지(로그인 막기)
do $$ begin   -- 예전 판의 재가입 막기 해시(pid_h)는 정지 표시로 바꾸고 지운다(탈퇴하면 다 지우기로 해서 필요 없다)
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'bans' and column_name = 'pid_h') then
    execute 'update public.bans set stop = true where pid_h is not null'; execute 'alter table public.bans drop column pid_h'; end if;
end $$;
alter table public.bans enable row level security;
revoke all on public.bans from anon, authenticated;

-- IP 해시(ip_hash · my_ip_h — 서버에만 있는 비밀값을 섞는다)는 schema.sql 에 있다(익명 통계 횟수 제한도 같이 쓴다)
-- 지금 요청한 계정 · IP 가 차단됐나
create or replace function public.banned() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from bans b where (b.uid = auth.uid() or b.ip_h = my_ip_h()) and (b.until is null or b.until > now()))
$$;
drop function if exists public.pid_hash(uuid);
-- 자동 정지 — 지금 요청한 계정 영구 + IP 7일(이미 막혀 있으면 그대로 · IP 줄에도 계정을 적어 탈퇴하면 같이 지운다). 잘못 걸렸으면 위 ★ 한 줄로 푼다
create or replace function public.ban_me(why text) returns void language plpgsql security definer set search_path = public as $$
declare u uuid := auth.uid(); ih text := my_ip_h();
begin
  if u is not null and not exists (select 1 from bans b where b.uid = u and b.stop and b.until is null) then
    insert into bans (uid, stop, reason) values (u, true, why); end if;
  if ih is not null and not exists (select 1 from bans b where b.ip_h = ih and (b.until is null or b.until >= now() + interval '6 days')) then
    insert into bans (uid, ip_h, reason, until) values (u, ih, why, now() + interval '7 days'); end if;
end $$;
-- 남기기 — 게임도 부른다(로그인한 판에서 봉인이 깨졌을 때). 한 IP 한 시간 30줄까지(지울 때가 된 것은 gc — 맨 아래 6번)
--   같은 계정에서 7일 안에 ck · seal · spd 가 3번이면 자동 차단(한 번은 탭 두 개 · 배포 직후처럼 정직한 경우가 있다). IP 로는 세지 않는다 — 학교 · 통신사는 여러 아이가 IP 하나를 같이 쓴다
create or replace function public.report_cheat(reason text, detail jsonb default null) returns void language plpgsql security definer set search_path = public as $$
declare ih text := my_ip_h();
begin
  if reason !~ '^[a-z]{2,12}$' or pg_column_size(detail) >= 2000 then return; end if;
  perform gc();
  if (select count(*) from cheat_log l where l.ip_h is not distinct from ih and l.at > now() - interval '1 hour') >= 30 then return; end if;
  insert into cheat_log (uid, ip_h, reason, detail) values (auth.uid(), ih, report_cheat.reason, report_cheat.detail);
  if report_cheat.reason in ('ck', 'seal', 'spd') and auth.uid() is not null
    and (select count(*) from cheat_log l where l.uid = auth.uid() and l.reason in ('ck', 'seal', 'spd') and l.at > now() - interval '7 days') >= 3 then perform ban_me(report_cheat.reason || ' x3'); end if;
end $$;
-- 내 계정이 정지됐나 — 게임이 로그인할 때 · 켤 때 묻는다(정지면 로그아웃 + 처음 화면에 번호). { id } 또는 null
create or replace function public.suspended() returns json language sql stable security definer set search_path = public as $$
  select json_build_object('id', b.id) from bans b where b.uid = auth.uid() and b.stop and (b.until is null or b.until > now()) order by b.id limit 1
$$;
do $$ begin drop trigger if exists mjg_rejoin on auth.identities; exception when others then null; end $$;   -- 예전 판의 재가입 막기(없앴다)
drop function if exists public.rejoin();
-- 이 IP 가 막혔나 — 게임이 열 때 묻는다(막혔으면 안내 화면). { id: 차단 번호(문의할 때), until: 풀리는 때(null = 기한 없음) } 또는 null
create or replace function public.blocked() returns json language sql stable security definer set search_path = public as $$
  select json_build_object('id', b.id, 'until', b.until) from bans b where b.ip_h = my_ip_h() and (b.until is null or b.until > now()) order by b.until desc nulls first limit 1
$$;

-- 1) 저장 — 내 줄만 읽고 쓴다(게임 save 통째, 200KB 까지)
create table if not exists public.saves (
  uid        uuid primary key default auth.uid() references auth.users on delete cascade,
  data       jsonb not null check (pg_column_size(data) < 200000),
  updated_at timestamptz not null default now()
);
alter table public.saves enable row level security;
drop policy if exists saves_own on public.saves;
create policy saves_own on public.saves for all to authenticated using (uid = auth.uid()) with check (uid = auth.uid());
revoke all on public.saves from anon, authenticated;
grant select, insert, update on public.saves to authenticated;   -- 지우기는 없음 — 지우고 새로 넣어 아래 보상금 검사를 건너뛰지 못하게
-- 보상금 검사 — 지난 저장(서버 시각 srv_at)부터 흐른 시간(3시간까지) × 분당 2,000 + 여유 6,000(잭팟 5,000)보다 많이 늘었으면 기록 + 랭킹에서 빼 둔다.
--   저장은 그대로 받는다(잘못 걸린 아이의 진짜 진행이 기기와 계정에서 어긋나지 않게). 처음 올리는 것(insert — 기기에 모아 둔 것)은 검사하지 않는다
--   (정직한 최대는 3배속에서 쉬지 않고 달릴 때 분당 약 1,100 — 기본 약 200 + 떠돌이 보물상자 약 900). updated_at 은 게임이 보낸 값이라 검사엔 srv_at 만 쓴다
alter table public.saves add column if not exists srv_at timestamptz not null default now();
create or replace function public.saves_guard() returns trigger language plpgsql security definer set search_path = public as $$
declare
  num  numeric := case when jsonb_typeof(new.data->'coin') = 'number' then (new.data->>'coin')::numeric else 0 end;
  was  numeric := case when jsonb_typeof(old.data->'coin') = 'number' then (old.data->>'coin')::numeric else 0 end;
  mins numeric := least(180, greatest(0, extract(epoch from now() - old.srv_at) / 60));
  gift numeric := 0;
begin
  new.srv_at := now();
  -- 쿠폰(8번) — 받은 표시(cpn)가 계정 저장에 처음 올라오면 그 쿠폰 몫을 한 번 봐주고 「반영됨」(synced)으로. 시간과 상관없이(받고 한참 뒤에 올라와도) 한 번만
  with x as (update coupon_uses u set synced = true where u.uid = new.uid and not u.synced and coalesce(new.data->'cpn' ? u.id, false)
             returning case when coalesce(old.data->'cpn' ? u.id, false) then 0 else u.coin end as c)
  select coalesce(sum(x.c), 0) into gift from x;
  if num - was > 2000 * mins + 6000 + gift then   -- 떠돌이 보물상자가 반드시 나오게 되어(2026-11-18) 3배속으로 쉬지 않고 달리면 분당 약 1,100
    perform report_cheat('coin', jsonb_build_object('got', num - was, 'mins', round(mins)));
    insert into bans (uid, reason) select new.uid, 'coin' where not exists (select 1 from bans b where b.uid = new.uid and b.reason = 'coin' and b.until is null);
  end if;
  return new;
end $$;
drop trigger if exists saves_guard on public.saves;
create trigger saves_guard before update on public.saves for each row execute function public.saves_guard();
-- 저장 조작 — 정직한 게임이 낼 수 없는 저장(상점 강화가 칸 수를 넘음 · 숫자가 아님)이면 그 자리에서 계정 영구 정지 + IP 7일(ban_me 'save'), 그 저장은 받지 않는다.
--   값이 null 이면 없음(0)으로 본다(깨진 저장이 정지되지 않게 — 기획). 새로 만들기(첫 업로드)와 고치기 둘 다. 칸 수는 game.js SHOP 의 max 와 같게(처음 판부터 바뀐 적 없다 — 늘리면 여기도). 모르는 칸은 보지 않는다(예전 판 저장이 걸리지 않게)
--   트리거는 이름 순서로 돈다 — saves_check 가 saves_guard 보다 먼저(받지 않을 저장으로 보상금 검사를 하지 않게)
create or replace function public.save_bad(d jsonb) returns boolean language sql immutable as $$
  select case when d->'up' is null or jsonb_typeof(d->'up') = 'null' then false when jsonb_typeof(d->'up') <> 'object' then true
    else exists (select 1 from jsonb_each(d->'up') e(k, v) join (values ('manju', 5), ('license', 5), ('pudding', 5), ('slipper', 5), ('wage', 5), ('pouch', 5), ('clover', 5), ('armor', 1)) m(k, mx) using (k)
                 where jsonb_typeof(e.v) <> 'null' and (jsonb_typeof(e.v) <> 'number' or (e.v::text)::numeric not between 0 and m.mx or (e.v::text)::numeric % 1 <> 0)) end   -- null 은 없음(0)과 같게(깨진 저장 · NaN — 기획)
$$;
create or replace function public.saves_check() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if save_bad(new.data) then
    perform report_cheat('save', jsonb_build_object('up', new.data->'up'));
    perform ban_me('save');
    return null;   -- 받지 않는다(계정의 예전 저장은 그대로)
  end if;
  if tg_op = 'INSERT' and coalesce(case when jsonb_typeof(new.data->'coin') = 'number' then (new.data->>'coin')::numeric end, 0) + 1000 * coalesce(case when jsonb_typeof(new.data->'stone') = 'number' then (new.data->>'stone')::numeric end, 0) > 1000000 then
    -- 첫 업로드(기기에 모아 둔 것)는 보상금 증가 검사(saves_guard)를 안 거친다 — 보상금 + 부활석 × 1,000 이 100만을 넘으면 'coin' 표시(랭킹 보류 · 정지는 아님 · 기획)
    perform report_cheat('coin', jsonb_build_object('first', new.data->'coin', 'stone', new.data->'stone'));
    insert into bans (uid, reason) select new.uid, 'coin' where not exists (select 1 from bans b where b.uid = new.uid and b.reason = 'coin' and b.until is null);
  end if;
  return new;
end $$;
revoke all on function public.save_bad, public.saves_check from public, anon, authenticated;
drop trigger if exists saves_check on public.saves;
create trigger saves_check before insert or update on public.saves for each row execute function public.saves_check();

-- 2) 닉네임 — 랭킹에 보이는 이름. NFKC 로 맞춘 뒤 2~12자(한 · 영 · 일 · 중 · 숫자 · _), 대소문자 무시하고 겹치면 안 된다. 처음 정하기는 바로, 바꾸기는 하루에 한 번(사용자 결정 2026-11-18 — 예전엔 7일). 표는 함수로만
create table if not exists public.players (
  uid        uuid primary key references auth.users on delete cascade,
  nick       text not null check (char_length(nick) between 2 and 12 and nick ~ '^[0-9A-Za-z_가-힣ぁ-んァ-ヶー一-鿿]+$'),
  changed_at timestamptz not null default now()
);
create unique index if not exists players_nick on public.players (lower(nick));
alter table public.players enable row level security;   -- 정책 없음 = 함수 말고는 아무도 못 본다
revoke all on public.players from anon, authenticated;

-- 3) 판 시작 — 무한 판을 시작할 때 시각을 남기고, 기록을 올릴 때 「실제 흐른 시간 ≥ 기록 ÷ 3」(배속 단추 — 어려움을 클리어하면 3배속)를 본다. 올리면 소진
create table if not exists public.run_starts (uid uuid primary key references auth.users on delete cascade, at timestamptz not null default now());
alter table public.run_starts add column if not exists tok uuid not null default gen_random_uuid();   -- 이 판의 일회용 값 — 랭킹 체크섬에 들어간다
alter table public.run_starts enable row level security;
revoke all on public.run_starts from anon, authenticated;

-- 랭킹 체크섬 소금 — 저장소에 두지 않는다(저장소가 공개라 예전 값 'mjg|r7Q' 은 새어 나갔다). 처음 Run 하면 아무 값이 들어가고, GitHub 비밀 CK_SALT 와 같은 값으로 직접 바꾼다:
--   update public.ck_key set v = '<GitHub 비밀 CK_SALT 와 같은 값>';      (이 줄은 저장소에 적지 말 것. 바꾸면 GitHub 비밀도 같이 바꾸고 다시 배포)
create table if not exists public.ck_key (id int primary key default 1 check (id = 1), v text not null default gen_random_uuid()::text);
insert into public.ck_key default values on conflict do nothing;
alter table public.ck_key add column if not exists old text;   -- 바로 전 소금 — 이것과 맞으면 「예전 game.js(새로 고침 전)」로 보고 받지도 신고하지도 않는다(정직한 사람이 탭을 열어 둔 채 3번 올려 정지되지 않게)
update public.ck_key set old = 'mjg|r7Q' where old is null;   -- 처음 소금(이미 공개된 값이라 적어도 된다). 소금을 다시 바꿀 때:  update public.ck_key set old = v, v = '<새 값>';
alter table public.ck_key enable row level security;
revoke all on public.ck_key from anon, authenticated;

-- 4) 랭킹 — 계정 · 캐릭터마다 가장 좋은 무한 모드 기록 하나. 순서: 단계 ↓ → 잡은 보스 ↓ → 버틴 시간 ↓ → 마지막 보스를 잡은 때 ↑ → 먼저 세운 기록(2026-11-20 기획 — 화면에 보이는 숫자 순서와 같게)
create table if not exists public.ranks (
  uid      uuid not null references auth.users on delete cascade,
  ch       text not null check (ch ~ '^[a-z]{2,12}$'),
  lv       int  not null check (lv between 0 and 500),                    -- 무한 단계(세이렌을 다 쓰러뜨린 횟수)
  bosses   int  not null check (bosses between 0 and 100000),             -- 잡은 보스(세이렌 포함, 중간보스 · 인어 빼고)
  bt       int  not null check (bt >= 0),                                 -- 마지막 보스를 잡은 때(초)
  t        int  not null check (t between 0 and 86400),                   -- 버틴 시간(초)
  kills    int  not null check (kills between 0 and 10000000),
  lvl      int  not null check (lvl between 1 and 5000),                  -- 캐릭터 레벨
  weapons  text not null check (weapons ~ '^[a-z]{2,12}[1-9]( [a-z]{2,12}[1-9]){0,5}$'),   -- 스킬 id + 레벨(9 = 각성), 첫째가 메인
  passives text check (passives is null or passives ~ '^[a-z]{2,12}[0-9]{1,2}( [a-z]{2,12}[0-9]{1,2}){0,9}$'),   -- 보조 아이템 id + 레벨
  slain    text check (slain is null or slain ~ '^[a-zA-Z]{2,16}[0-9]{1,4}( [a-zA-Z]{2,16}[0-9]{1,4}){0,15}$'),     -- 잡은 보스 종류 + 마리 수
  winter   boolean not null default false,                                -- 겨울 맵
  v        text not null check (v ~ '^\d{4}-\d{2}-\d{2}#\d{1,3}$'),       -- 게임 버전
  at       timestamptz not null default now(),
  primary key (uid, ch, winter)   -- 계정 · 캐릭터 · 맵(겨울 · 풀밭)마다 하나. 그럴듯한지는 submit_rank 가 본다(어긋나면 차단)
);
do $$ begin   -- 예전 표(계정 · 캐릭터마다 하나)를 맵마다로 — 예전 기록은 그 판의 winter 값대로 남는다
  if (select array_length(i.indkey::int2[], 1) from pg_index i where i.indrelid = 'public.ranks'::regclass and i.indisprimary) = 2 then
    alter table public.ranks drop constraint ranks_pkey; alter table public.ranks add primary key (uid, ch, winter);
  end if;
end $$;
alter table public.ranks drop constraint if exists ranks_check;   -- 예전 판의 「그럴듯한 기록만」(단계마다 60초 — 고수의 진짜 기록도 걸릴 수 있었다)
drop index if exists public.ranks_order; create index if not exists ranks_order2 on public.ranks (lv desc, bosses desc, t desc, bt, at);   -- 순서: 단계 ↓ → 보스 ↓ → 버틴 시간 ↓ → 마지막 보스 잡은 때 ↑ → 먼저(2026-11-20)
alter table public.ranks add column if not exists real int;   -- 판 시작(start_run) → 올리기까지 실제 흐른 초(살펴보기용 — 기록 ÷ 3 에 가까우면 3배속으로 내내 · 빠르게 만든 기록일 수도)
alter table public.ranks add column if not exists outfit text check (outfit is null or outfit ~ '^[a-z0-9_]{1,24}$');   -- 그 판에 입은 의상 · 무기 스킨(랭킹 그림 — 보이기만, 체크섬에 넣지 않는다)
alter table public.ranks add column if not exists wskin text check (wskin is null or wskin ~ '^[a-z0-9_]{1,24}$');
alter table public.ranks add column if not exists lang text check (lang is null or lang in ('ko', 'ja', 'en', 'zh-CN', 'zh-TW'));   -- 플레이한 언어(게임에서 고른 말 — 랭킹 국기). 그 밖의 값은 비워서 받는다
alter table public.ranks enable row level security;   -- 정책 없음 — 넣기 · 보기 모두 함수로만
revoke all on public.ranks from anon, authenticated;

-- 닉네임 정하기 · 바꾸기 → 'ok' | 'bad'(규칙 · 금지어) | 'taken'(이미 있음) | 'wait'(바꾼 지 하루가 안 됨 — 처음 정하기는 바로)
create or replace function public.set_nick(nick text) returns text language plpgsql security definer set search_path = public as $$
declare n text := btrim(normalize(nick, NFKC)); old players;
begin
  if auth.uid() is null then return 'bad'; end if;
  if char_length(n) not between 2 and 12 or n !~ '^[0-9A-Za-z_가-힣ぁ-んァ-ヶー一-鿿]+$'
    or lower(n) ~ '(운영자|관리자|운영진|개발자|공식|admin|official|moderator|씨발|시발|병신|좆|개새|fuck|shit|bitch)' or lower(n) ~ '^gm' then return 'bad'; end if;
  if exists (select 1 from players p where lower(p.nick) = lower(n) and p.uid <> auth.uid()) then return 'taken'; end if;
  select * into old from players p where p.uid = auth.uid();
  if found and old.nick = n then return 'ok'; end if;
  if found and old.changed_at > now() - interval '1 day' then return 'wait'; end if;
  insert into players (uid, nick) values (auth.uid(), n) on conflict (uid) do update set nick = excluded.nick, changed_at = now();
  return 'ok';
exception when unique_violation then return 'taken';
end $$;

-- 닉네임 검사만(정하지 않고) — 입력하는 동안 「쓸 수 있어요 / 이미 있어요」
create or replace function public.nick_free(nick text) returns text language sql stable security definer set search_path = public as $$
  select case
    when char_length(n) not between 2 and 12 or n !~ '^[0-9A-Za-z_가-힣ぁ-んァ-ヶー一-鿿]+$'
      or lower(n) ~ '(운영자|관리자|운영진|개발자|공식|admin|official|moderator|씨발|시발|병신|좆|개새|fuck|shit|bitch)' or lower(n) ~ '^gm' then 'bad'
    when exists (select 1 from players p where lower(p.nick) = lower(n) and p.uid is distinct from auth.uid()) then 'taken'
    else 'ok' end
  from (select btrim(normalize(nick, NFKC)) as n) x
$$;

-- 내 닉네임 · 바꿀 수 있는 때(없으면 null)
create or replace function public.my_nick() returns json language sql stable security definer set search_path = public as $$
  select json_build_object('nick', nick, 'next', changed_at + interval '1 day') from players where uid = auth.uid()
$$;

-- 무한 판 시작 → 이 판의 일회용 값(tok)
drop function if exists public.start_run();
create or replace function public.start_run() returns text language sql security definer set search_path = public as $$
  insert into run_starts (uid) select auth.uid() where auth.uid() is not null on conflict (uid) do update set at = now(), tok = gen_random_uuid()
  returning tok::text
$$;

-- 기록 올리기 → { r: 'ok' | 'kept'(예전 기록이 더 좋음) | 'nonick' | 'nostart' | 'bad'(범위 밖 숫자 — 대개 우리 버그라 거절만) | 'fast'(흐른 시간보다 조금 긴 기록) | 'old'(시작한 지 6시간 넘음)
--   | 'stale'(바로 전 소금 — 예전 game.js, 새로 고침하면 된다 · 신고 안 함) | 'hold'(차단 · 체크섬 어긋남) | 'ban'(정직한 게임이 못 내는 기록 — 방금 자동 정지), rank: 전체 순위(내 최고) }
--   ck = sha256(tok|ch|lv|bosses|bt|t|kills|lvl|weapons|hit0|v|소금) — game.js 의 runCk 와 같은 순서 · 소금. 어긋나면 그 판만 거절 + 기록(한 번으로는 차단 안 함 — 탭 두 개 · 배포 직후 예전 game.js. 7일 3번이면 report_cheat 가 차단)
--   차단: 실제 흐른 시간 < 기록 ÷ 3 − 30초(3배속이 상한 · start_run 이 늦게 닿는 여유) · 처치 > 초당 100 · 레벨 > 4초에 1 + 20 · 그 단계까지 정직한 최소 시간 미달(보스 무리는 시계로만 온다 — 단계 k 는 쉬는 12초 + 무리 간격 60초 × (⌈6 ÷ min(6, k+1)⌉ − 1): 1단계 132 · 2~4단계 72 · 5단계부터 12초.
--     세이렌 페이즈 전환 2초 × 2 는 넣지 않는다 — 예전 game.js 가 남은 기기의 기록을 정지시키지 않게) · 보스 < 단계 — 모두 게임 시간(t) 기준
--   hit0 = 처음 맞은 때(초, -1 = 한 번도 안 맞음). 25분 넘게 한 대도 안 맞은 판은 받되 의심 목록 맨 위로(고수의 진짜 기록을 거절하지 않게)
drop function if exists public.submit_rank(text, int, int, int, int, int, int, text, text, text, boolean, text);
drop function if exists public.submit_rank(text, int, int, int, int, int, int, text, text, text, boolean, text, int, text);
drop function if exists public.submit_rank(text, int, int, int, int, int, int, text, text, text, boolean, text, int, text, text, text);
create or replace function public.submit_rank(ch text, lv int, bosses int, bt int, t int, kills int, lvl int, weapons text, passives text, slain text, winter boolean, v text, hit0 int, ck text, outfit text default null, wskin text default null, lang text default null)
returns json language plpgsql security definer set search_path = public as $$
declare old ranks; st timestamptz; tk uuid; res text := 'ok'; my int; bd text;
begin
  if auth.uid() is null or not exists (select 1 from players where uid = auth.uid()) then return json_build_object('r', 'nonick'); end if;
  if banned() then return json_build_object('r', 'hold'); end if;
  delete from run_starts s where s.uid = auth.uid() returning s.at, s.tok into st, tk;   -- 한 판에 한 번
  if st is null then return json_build_object('r', 'nostart'); end if;
  if not coalesce(submit_rank.lv between 0 and 500 and submit_rank.bosses between 0 and 100000 and submit_rank.bt >= 0 and submit_rank.t between 0 and 86400
    and submit_rank.kills between 0 and 10000000 and submit_rank.lvl between 1 and 5000 and submit_rank.hit0 >= -1, false) then return json_build_object('r', 'bad'); end if;
  if split_part(submit_rank.weapons, ' ', 1) !~ ('^' || coalesce((json_build_object('chiikawa', 'sasu', 'hachiware', 'guitar', 'usagi', 'stick', 'momonga', 'momo', 'kurimanju', 'kanpai', 'rakko', 'sword', 'kani', 'book', 'shisa', 'ramen') ->> submit_rank.ch), '[a-z]{2,12}') || '[1-9]$') then
    return json_build_object('r', 'bad'); end if;   -- 첫 스킬은 그 캐릭터 무기(새 캐릭터면 형식만 — 거절만, 대개 우리 버그)
  bd := concat_ws('|', tk::text, submit_rank.ch, submit_rank.lv, submit_rank.bosses, submit_rank.bt, submit_rank.t, submit_rank.kills, submit_rank.lvl, submit_rank.weapons, submit_rank.hit0, submit_rank.v);
  if ck is distinct from encode(sha256(convert_to(concat_ws('|', bd, (select k.v from ck_key k)), 'UTF8')), 'hex') then
    if ck = encode(sha256(convert_to(concat_ws('|', bd, (select k.old from ck_key k)), 'UTF8')), 'hex') then return json_build_object('r', 'stale'); end if;   -- 예전 game.js — 받지 않고 신고도 안 한다(새로 고침하면 된다)
    perform report_cheat('ck', json_build_object('ch', submit_rank.ch, 'lv', submit_rank.lv, 't', submit_rank.t, 'v', submit_rank.v)::jsonb);
    return json_build_object('r', case when banned() then 'ban' else 'hold' end);
  end if;
  if not (submit_rank.bt <= submit_rank.t and submit_rank.kills <= 100 * submit_rank.t + 100 and submit_rank.lvl <= submit_rank.t / 4 + 20
      and (submit_rank.lv = 0 or submit_rank.t >= 1500 + case when submit_rank.lv <= 1 then 0 else 132 + 72 * least(submit_rank.lv - 2, 3) + 12 * greatest(submit_rank.lv - 5, 0) end) and submit_rank.bosses >= submit_rank.lv
      and submit_rank.bosses <= case when submit_rank.lv = 0 then 6 else 4 + 15 * submit_rank.lv end + 2   -- 그 단계까지 나올 수 있는 보스 수(25분 전 6 + 세이렌, 단계마다 보스 6 + 세이렌 min(3, k+1) × 3페이즈) + 여유 2
      and submit_rank.bosses >= (select coalesce(sum((regexp_match(x, '(\d+)$'))[1]::int), 0) from unnest(string_to_array(coalesce(submit_rank.slain, ''), ' ')) x where x <> ''))   -- 잡은 보스 ≥ 종류별 마리 수 합
    or now() - st < make_interval(secs => submit_rank.t / 3.0 - 30) then
    perform report_cheat('rank', json_build_object('ch', submit_rank.ch, 'lv', submit_rank.lv, 'bosses', submit_rank.bosses, 't', submit_rank.t, 'kills', submit_rank.kills, 'lvl', submit_rank.lvl,
      'real', round(extract(epoch from now() - st)), 'v', submit_rank.v)::jsonb);
    perform ban_me('rank');
    return json_build_object('r', 'ban');
  end if;
  if submit_rank.hit0 < 0 and submit_rank.t >= 1500 then perform report_cheat('nohit', json_build_object('ch', submit_rank.ch, 'lv', submit_rank.lv, 't', submit_rank.t)::jsonb); end if;
  -- 흐른 시간보다 조금 긴 기록 — 거절만(신고 · 정지 없음). 무한 진짜 판이 2배속까지가 된 판(2026-11-20#7)부터는 t/2, 그 전 game.js 는 t/3(캐시에 남은 예전 판 · 기획)
  --   v 는 '날짜#항목 수' — 문자열로 견주면 '#10' < '#7' 이 되니 나눠서(QA). 모양이 다르면 예전 규칙. 위 정지 줄(t/3 − 30)은 그대로
  if now() - st < make_interval(secs => submit_rank.t / (case when submit_rank.v !~ '^\d{4}-\d{2}-\d{2}#\d{1,6}$' then 3.0
      when split_part(submit_rank.v, '#', 1) > '2026-11-20' then 2.0 when split_part(submit_rank.v, '#', 1) = '2026-11-20' and split_part(submit_rank.v, '#', 2)::int >= 7 then 2.0 else 3.0 end) - 5) then
    return json_build_object('r', 'fast'); end if;
  if now() - st > interval '6 hours' then return json_build_object('r', 'old'); end if;   -- 시작해 두고 오래 묵힌 것
  select * into old from ranks r where r.uid = auth.uid() and r.ch = submit_rank.ch and r.winter = submit_rank.winter;
  if found and (old.lv, old.bosses, old.t, -old.bt) >= (submit_rank.lv, submit_rank.bosses, submit_rank.t, -submit_rank.bt) then res := 'kept';   -- 단계 · 보스 수가 같으면 더 오래 버틴 판, 그다음 마지막 보스를 일찍 잡은 판(기획 2026-11-20 — 화면 숫자와 같은 순서)
  else
    insert into ranks (uid, ch, lv, bosses, bt, t, kills, lvl, weapons, passives, slain, winter, v, real, outfit, wskin, lang)
      values (auth.uid(), ch, lv, bosses, bt, t, kills, lvl, weapons, nullif(passives, ''), nullif(slain, ''), winter, v, round(extract(epoch from now() - st)),
        case when submit_rank.outfit ~ '^[a-z0-9_]{1,24}$' then submit_rank.outfit end, case when submit_rank.wskin ~ '^[a-z0-9_]{1,24}$' then submit_rank.wskin end,
        case when submit_rank.lang in ('ko', 'ja', 'en', 'zh-CN', 'zh-TW') then submit_rank.lang end)
      on conflict on constraint ranks_pkey do update set lv = excluded.lv, bosses = excluded.bosses, bt = excluded.bt, t = excluded.t, kills = excluded.kills, lvl = excluded.lvl,
        weapons = excluded.weapons, passives = excluded.passives, slain = excluded.slain, winter = excluded.winter, v = excluded.v, real = excluded.real, outfit = excluded.outfit, wskin = excluded.wskin, lang = excluded.lang, at = now();
  end if;
  select x.rank into my from top_ranks(null, submit_rank.winter) x where x.me;
  return json_build_object('r', res, 'rank', my);
end $$;

drop function if exists public.top_ranks(text); drop function if exists public.my_rank(text);   -- 돌려주는 칸(의상)이 늘고 맵 인자가 생겨서 다시 만든다
-- 랭킹 보기 — only_ch 가 없으면 모두에서 사람마다 가장 좋은 기록 하나씩 TOP 100, 있으면 그 캐릭터 TOP 10. me = 내 기록인지
create or replace function public.top_ranks(only_ch text default null, on_winter boolean default true)   -- 맵마다(기본 겨울) · 사람마다 최고 하나
returns table (rank bigint, nick text, ch text, lv int, bosses int, bt int, t int, kills int, lvl int, weapons text, passives text, slain text, winter boolean, at timestamptz, me boolean, outfit text, wskin text, lang text)
language sql stable security definer set search_path = public as $$
  with best as (
    select distinct on (r.uid) r.* from ranks r where (only_ch is null or r.ch = only_ch) and r.winter = on_winter and not exists (select 1 from bans x where x.uid = r.uid and (x.until is null or x.until > now()))
    order by r.uid, r.lv desc, r.bosses desc, r.t desc, r.bt, r.at
  )
  select row_number() over (order by b.lv desc, b.bosses desc, b.t desc, b.bt, b.at), p.nick, b.ch, b.lv, b.bosses, b.bt, b.t, b.kills, b.lvl, b.weapons, b.passives, b.slain, b.winter, b.at, b.uid = auth.uid(), b.outfit, b.wskin, b.lang
  from best b join players p on p.uid = b.uid
  order by b.lv desc, b.bosses desc, b.t desc, b.bt, b.at
  limit case when only_ch is null then 100 else 10 end
$$;

-- 내 순위(TOP 밖이어도) — 랭킹 화면 위 「내 기록」 줄
create or replace function public.my_rank(only_ch text default null, on_winter boolean default true)
returns table (rank bigint, nick text, ch text, lv int, bosses int, bt int, t int, kills int, lvl int, weapons text, passives text, slain text, winter boolean, at timestamptz, me boolean, outfit text, wskin text, lang text)
language sql stable security definer set search_path = public as $$
  with best as (
    select distinct on (r.uid) r.* from ranks r where (only_ch is null or r.ch = only_ch) and r.winter = on_winter and not exists (select 1 from bans x where x.uid = r.uid and (x.until is null or x.until > now()))
    order by r.uid, r.lv desc, r.bosses desc, r.t desc, r.bt, r.at
  ), ranked as (
    select row_number() over (order by b.lv desc, b.bosses desc, b.t desc, b.bt, b.at) as rank, b.* from best b join players p on p.uid = b.uid
  )
  select x.rank, p.nick, x.ch, x.lv, x.bosses, x.bt, x.t, x.kills, x.lvl, x.weapons, x.passives, x.slain, x.winter, x.at, true, x.outfit, x.wskin, x.lang
  from ranked x join players p on p.uid = x.uid where x.uid = auth.uid()
$$;

revoke all on function public.set_nick, public.nick_free, public.my_nick, public.start_run, public.submit_rank, public.top_ranks, public.my_rank, public.report_cheat, public.banned, public.blocked, public.ban_me, public.suspended, public.my_ip_h, public.ip_hash, public.saves_guard from public, anon, authenticated;
grant execute on function public.set_nick, public.nick_free, public.my_nick, public.start_run, public.submit_rank, public.my_rank, public.suspended to authenticated;
grant execute on function public.top_ranks, public.report_cheat, public.blocked to anon, authenticated;

-- 익명 통계(runs)도 차단된 IP 는 조용히 버린다(report_run 은 그대로 두고 표 앞에서)
create or replace function public.runs_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin if banned() then return null; end if; return new; end $$;
revoke all on function public.runs_guard from public, anon, authenticated;
drop trigger if exists runs_guard on public.runs;
create trigger runs_guard before insert on public.runs for each row execute function public.runs_guard();

-- 의심 목록 — 대시보드 SQL Editor 에서: select * from suspects;  (한 대도 안 맞은 판 → 많이 걸린 순. accounts_on_ip = 그 IP 에서 걸린 계정 수)
create or replace view public.suspects with (security_invoker = true) as
  select l.uid, (select p.nick from players p where p.uid = l.uid) as nick, l.ip_h,
    count(*) as n, array_agg(distinct l.reason) as reasons, min(l.at) as first, max(l.at) as last,
    (select count(distinct x.uid) from cheat_log x where x.ip_h = l.ip_h) as accounts_on_ip,
    exists (select 1 from bans b where (b.uid = l.uid or b.ip_h = l.ip_h) and (b.until is null or b.until > now())) as banned
  from cheat_log l group by l.uid, l.ip_h
  order by bool_or(l.reason = 'nohit') desc, count(*) desc, max(l.at) desc;
revoke all on public.suspects from anon, authenticated;

-- 익명 통계(runs)에도 무한 모드가 들어가게 — 난이도 'inf' · 30분 넘는 시간
alter table public.runs drop constraint if exists runs_diff_check;
alter table public.runs add constraint runs_diff_check check (diff in ('easy', 'normal', 'hard', 'inf'));
alter table public.runs drop constraint if exists runs_t_check;
alter table public.runs add constraint runs_t_check check (t between 0 and 86400);

-- 4) 계정 지우기(계정 창 맨 아래 「계정 지우기」) — auth.users 를 지우면 저장 · 닉네임 · 랭킹 · 판 시작이 따라 지워진다(on delete cascade). 그 계정의 부정 플레이 기록도
--    정지 · 그 계정 때문에 걸린 IP 차단도 바로 지운다(사용자 결정). 이 기기의 기록(브라우저)은 그대로
create or replace function public.delete_me() returns text language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then return 'nologin'; end if;
  delete from cheat_log where uid = me;
  begin delete from sim_ranks where uid = me; delete from sim_starts where uid = me; exception when undefined_table then null; end;   -- 모의 토벌 랭킹(9번 — 계정을 지우면 cascade 로도 지워진다)
  delete from bans where uid = me;   -- 정지 · 그 계정 때문에 걸린 IP 차단까지(사용자 결정 — 탈퇴하면 보관하던 것도 지운다)
  begin delete from auth.audit_log_entries where payload->>'actor_id' = me::text; exception when others then null; end;   -- 로그인 기록(계정 번호만 남아 있다)
  delete from auth.users where id = me;
  return 'ok';
end $$;
revoke all on function public.delete_me from public, anon, authenticated;
grant execute on function public.delete_me to authenticated;

-- 5) 개인정보 — 이메일 · 이름 · 사진은 남기지 않는다. 남는 것은 로그인 식별자(auth.identities.provider_id = 제공자 사용자 번호) ↔ 계정(uid) ↔ 닉네임뿐
--    Supabase 가 로그인할 때마다 제공자 정보로 다시 채우므로 넣기 · 고치기 때마다 비운다. 로그인 기록(audit_log_entries)의 이메일 · 이름 · IP, 세션의 IP · 기기 정보도
--    이메일이 없으니 같은 이메일이어도 카카오 · 구글 계정이 저절로 합쳐지지 않는다(따로따로 계정)
--    비우다 탈이 나면 그대로 둔다(로그인은 막지 않는다). 확인: 이 파일 맨 아래 표
create or replace function public.ids_only(j jsonb) returns jsonb language sql immutable as $$
  select case when jsonb_typeof(j) = 'object' then (select coalesce(jsonb_object_agg(k, v), '{}') from jsonb_each(j) e(k, v) where k in ('iss', 'sub', 'provider_id', 'email_verified', 'phone_verified')) else '{}' end $$;
create or replace function public.scrub() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'users' then new.email := null; new.raw_user_meta_data := ids_only(new.raw_user_meta_data);
  elsif tg_table_name = 'identities' then new.identity_data := ids_only(new.identity_data);
  elsif tg_table_name = 'audit_log_entries' then new.payload := (new.payload::jsonb - 'actor_username' - 'actor_name' - 'traits')::json; new.ip_address := '';
  else new := jsonb_populate_record(new, '{"ip": null, "user_agent": null}');   -- sessions(칸이 없는 판이어도 탈 없게)
  end if;
  return new;
exception when others then return new;
end $$;
revoke all on function public.ids_only, public.scrub from public, anon, authenticated;
do $$ declare t text; begin
  foreach t in array array['users', 'identities', 'audit_log_entries', 'sessions'] loop
    begin
      execute format('drop trigger if exists mjg_scrub on auth.%I', t);
      execute format('create trigger mjg_scrub before insert or update on auth.%I for each row execute function public.scrub()', t);
    exception when others then raise warning 'auth.% — 개인정보 비우기를 못 켬: %', t, sqlerrm; continue;
    end;
    begin   -- 이미 들어온 것도 한 번 비운다
      execute format('update auth.%I set %s', t, case t when 'users' then 'email = email' when 'identities' then 'identity_data = identity_data' when 'audit_log_entries' then 'ip_address = ip_address' else 'user_id = user_id' end);
    exception when others then raise warning 'auth.% — 예전 것을 못 비움: %', t, sqlerrm;
    end;
  end loop;
end $$;

-- 6) 지울 때가 된 것 지우기 — 한 시간마다(pg_cron). 개인정보 처리방침에 적은 보관 기간 그대로
--    부정 플레이 기록 90일(진행 중인 차단에 걸린 계정 · IP 것은 차단이 끝날 때까지) · 끝난 차단 · 익명 통계 횟수 제한용 IP 해시 1시간
--    pg_cron 을 못 켜면 아래 확인 표에 false — 대시보드 Database › Extensions 에서 pg_cron 을 켜고 이 파일을 다시 Run
create or replace function public.gc() returns void language plpgsql security definer set search_path = public as $$ begin   -- plpgsql — 아래 8번 쿠폰 표보다 먼저 만들어도 되게
  delete from cheat_log l where l.at < now() - interval '90 days' and not exists (select 1 from bans b where (b.uid = l.uid or b.ip_h = l.ip_h) and (b.until is null or b.until > now()));
  delete from bans where until <= now();
  delete from run_gate where at < now() - interval '1 hour';
  delete from coupon_uses u where not exists (select 1 from coupons c where c.id = u.id and c.ends > now() - interval '7 days');
  begin perform sim_gc(); exception when undefined_function or undefined_table then null; end;   -- 모의 토벌 랭킹 — 그 주가 끝나고 2주 뒤(9번)   -- 끝난 쿠폰의 사용 기록 — 7일 뒤(8번 · 끝나기 직전에 받고 며칠 뒤 올라오는 저장도 봐주게)
end $$;
revoke all on function public.gc from public, anon, authenticated;
do $$ begin
  create extension if not exists pg_cron;
  perform cron.schedule('mjg-gc', '7 * * * *', 'select public.gc()');
exception when others then raise warning 'pg_cron 을 못 켬: %', sqlerrm;
end $$;

-- 7) 이용약관 동의 — 게임이 처음 로그인(새 계정) · 약관이 바뀐 뒤 첫 로그인에 묻는다(game.js TERMS_DAY). 동의한 약관 시행일 · 시각. 계정을 지우면 같이 지워진다
--    개인정보는 동의가 아니라 처리방침으로 알린다(로그인 정보는 서비스에 꼭 필요한 정보 — 개인정보보호법 제15조 1항 4호 구조)
create table if not exists public.terms_ok (uid uuid primary key references auth.users on delete cascade, day date not null, at timestamptz not null default now());
alter table public.terms_ok enable row level security;
revoke all on public.terms_ok from anon, authenticated;
create or replace function public.agree(day date) returns text language sql security definer set search_path = public as $$
  insert into terms_ok (uid, day) select auth.uid(), agree.day where auth.uid() is not null on conflict (uid) do update set day = excluded.day, at = now() returning 'ok'
$$;
drop function if exists public.agreed();
create or replace function public.agreed() returns json language sql stable security definer set search_path = public as $$ select json_build_object('day', (select day from terms_ok where uid = auth.uid())) $$;   -- 늘 { day } — 함수가 없을 때(이 파일을 아직 안 돌림)와 구분해 게임이 동의 창을 건너뛴다
revoke all on function public.agree, public.agreed from public, anon, authenticated;
grant execute on function public.agree, public.agreed to authenticated;

-- 8) 쿠폰 — 계정 메뉴 「쿠폰」(로그인한 사람만). 코드는 띄어쓰기 · 대소문자 무시(NFKC). 한 쿠폰(id)에 이름 여럿(다섯 말 — 기획), 받는 건 계정마다 한 번
--    그 계정 저장에 받은 표시(save.cpn)가 있어도 받은 것으로 본다(탈퇴해도 이 기기 기록은 남아 재가입하면 곧바로 새 계정에 올라간다 — 개인정보를 더 남기지 않고 또 받기 막기)
--    보상금은 게임이 저장에 더한다 — 위 보상금 검사(saves_guard)는 받은 표시가 저장에 처음 올라올 때 그 쿠폰 몫을 한 번 봐주고 synced 를 켠다. 정지 · 차단(banned)이면 못 받는다
--    응답을 못 받았으면(연결 끊김 · 탭 닫힘 — 서버엔 기록, 저장엔 아직 없음) 다시 눌러 받는다: synced 가 아니면 ok 를 또 준다(게임은 이 기기 저장에 표시가 없을 때만 더한다)
--    사용 기록은 계정을 지우면(auth.users cascade) · 쿠폰이 끝나고 7일 뒤(gc) 지운다 — 개인정보 처리방침과 같게
--    새 쿠폰: coupons 에 이름마다 한 줄(code = 띄어쓰기 없이 소문자 · NFKC, id = 저장 표시용 짧은 이름, ends = 끝나는 때 — game.js COUPON 과 패치노트 날짜도 같이)
create table if not exists public.coupons (code text primary key, id text not null check (id ~ '^[a-z0-9_]{2,24}$'), coin int not null check (coin between 1 and 100000), ends timestamptz not null);
alter table public.coupons enable row level security;
revoke all on public.coupons from anon, authenticated;
insert into public.coupons (code, id, coin, ends)   -- 출시 기념 — 한 달(game.js COUPON.ends)
  select k, 'launch', 1000, '2026-12-20 23:59:59.999+09' from unnest(array['먼작귀서바이버즈', 'chiikawasurvivors', 'ちいかわサバイバーズ', '吉伊卡哇幸存者', '吉伊卡哇倖存者']) k
  on conflict (code) do update set id = excluded.id, coin = excluded.coin, ends = excluded.ends;
create table if not exists public.coupon_uses (uid uuid not null references auth.users on delete cascade, id text not null, coin int not null, at timestamptz not null default now(), primary key (uid, id));
alter table public.coupon_uses add column if not exists synced boolean not null default false;   -- 받은 표시가 계정 저장에 올라왔다(saves_guard 가 켠다)
alter table public.coupon_uses enable row level security;
revoke all on public.coupon_uses from anon, authenticated;
-- 쿠폰 받기 → { r: 'ok' | 'used' | 'expired' | 'bad'(없는 쿠폰) | 'ban' | 'nologin', id, coin }
create or replace function public.redeem(code text) returns json language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); c coupons; u coupon_uses;
begin
  if me is null then return json_build_object('r', 'nologin'); end if;
  select * into c from coupons k where k.code = lower(regexp_replace(normalize(coalesce(redeem.code, ''), NFKC), '\s+', '', 'g'));
  if not found then return json_build_object('r', 'bad'); end if;
  if now() > c.ends then return json_build_object('r', 'expired', 'id', c.id); end if;
  if banned() then return json_build_object('r', 'ban'); end if;
  if coalesce((select s.data->'cpn' ? c.id from saves s where s.uid = me), false) then return json_build_object('r', 'used', 'id', c.id); end if;
  insert into coupon_uses (uid, id, coin) values (me, c.id, c.coin) on conflict do nothing;
  select * into u from coupon_uses x where x.uid = me and x.id = c.id;
  if u.synced then return json_build_object('r', 'used', 'id', c.id); end if;   -- 받아서 저장에도 올렸다(그 뒤 표시를 지웠어도)
  return json_build_object('r', 'ok', 'id', c.id, 'coin', u.coin);   -- 처음 · 또는 받았는데 응답을 못 받아 아직 저장에 없다 — 금액은 처음 받을 때 것(쿠폰 금액을 바꿔도 · 보상금 검사 허용치와 같게)
end $$;
revoke all on function public.redeem from public, anon, authenticated;
grant execute on function public.redeem to authenticated;

notify pgrst, 'reload schema';
-- 확인 — 다섯 줄 모두 true 여야 한다
select c.t as "확인", c.ok as "켜짐" from (
  select 'auth.' || t || ' 개인정보 비우기', exists (select 1 from pg_trigger g where g.tgname = 'mjg_scrub' and g.tgrelid = to_regclass('auth.' || t)) from unnest(array['users', 'identities', 'audit_log_entries', 'sessions']) t
  union all select 'pg_cron 오래된 기록 지우기', exists (select 1 from pg_extension where extname = 'pg_cron')
) c(t, ok);

-- 9) 모의 토벌 랭킹(사용자 · 기획 2026-11-21) — 「이번 주 전장」 하나로 작전(캐릭터 · 무기 · 보조 순서 · 성향)을 겨룬다. 보통 · 어려움 · 무한 × 겨울 · 풀밭, 한 사람당 주 · 판마다 최고 하나
--    주 = 2026-11-16(월) 0시 KST 부터 몇째 주(월요일 0시에 바뀐다) · 전장 = 1 + (주 × 617 + 211) % 999 — game.js 의 simWeek 와 같은 식
--    끝까지 관전한 판만(게임) · 관전 시작에 sim_start · 실제 흐른 시간 ≥ 기록 ÷ 3 − 30초(모자라면 거절만) · 같은 작전 · 주 · 판 번호인데 결과가 다르면 둘 다 내리고 'sim' 으로 남긴다(정지 · 자동 차단 셈에는 안 넣는다 — 기획)
create or replace function public.sim_wk(at timestamptz default now()) returns int language sql immutable as $$
  select floor(((at at time zone 'Asia/Seoul')::date - date '2026-11-16') / 7.0)::int
$$;
create or replace function public.sim_field(wk int) returns int language sql immutable as $$ select 1 + ((wk * 617 + 211) % 999 + 999) % 999 $$;
create table if not exists public.sim_starts (uid uuid primary key references auth.users on delete cascade, at timestamptz not null default now(), wk int not null);
alter table public.sim_starts enable row level security;
revoke all on public.sim_starts from anon, authenticated;
create table if not exists public.sim_ranks (
  uid    uuid not null references auth.users on delete cascade,
  wk     int  not null,                                                    -- 주(sim_wk) — 전장은 sim_field(wk)
  diff   text not null check (diff in ('normal', 'hard', 'inf')),
  winter boolean not null,
  ch     text not null check (ch ~ '^[a-z]{2,12}$'),
  s      text not null check (s in ('move', 'stay')),                      -- 성향
  w      text not null check (w ~ '^[a-z]{2,12}( [a-z]{2,12}){0,5}$'),     -- 작전 무기 순서(기본 무기부터)
  p      text not null default '' check (p ~ '^([a-z]{2,12}( [a-z]{2,12}){0,5})?$'),   -- 작전 보조 순서
  kind   text not null check (kind in ('dead', 'win', 'time')),            -- 쓰러짐 · 세이렌 격파(보통 · 어려움) · 끝까지(30분 · 무한 60분 상한)
  t      int  not null check (t between 0 and 3601),                       -- 버틴 시간(초) — 격파면 격파 시각
  kills  int  not null check (kills between 0 and 10000000),
  bosses int  not null check (bosses between 0 and 1000),
  lv     int  not null default 0 check (lv between 0 and 100),             -- 무한 단계
  lvl    int  not null check (lvl between 1 and 5000),
  v      text not null check (v ~ '^\d{4}-\d{2}-\d{2}#\d{1,3}$'),          -- 판 번호(PATCH_ID) — 판이 바뀌면 같은 작전도 결과가 다를 수 있다
  real   int,                                                              -- 관전 시작 → 올리기까지 실제 초
  hidden boolean not null default false,                                   -- 같은 답 맞추기 · 재현 확인에서 어긋나 내린 기록
  at     timestamptz not null default now(),
  primary key (uid, wk, diff, winter)
);
alter table public.sim_ranks enable row level security;
revoke all on public.sim_ranks from anon, authenticated;
create index if not exists sim_ranks_board on public.sim_ranks (wk, diff, winter);
create index if not exists sim_ranks_same on public.sim_ranks (wk, diff, winter, ch, s, w, p, v);
alter table public.sim_ranks add column if not exists ok_at timestamptz;   -- 2단계 재현 확인(Actions)에서 같은 결과가 나온 때 — 이 결과가 같은 답 맞추기에서 이긴다
alter table public.sim_ranks add column if not exists bad boolean not null default false;   -- 재현 확인에서 결과가 달랐음 — 다시 보이지 않고 다수결에도 안 센다
-- 순서 열쇠(클수록 위) — 보통 · 어려움: 격파 → 격파 시각 ↑(빠를수록) / 버틴 시간 ↓ → 처치 ↓, 무한: 단계 ↓ → 보스 ↓ → 버틴 시간 ↓. 같으면 먼저 세운 기록(at ↑)
create or replace function public.sim_key(r sim_ranks) returns numeric[] language sql immutable as $$
  select case when r.diff = 'inf' then array[r.lv, r.bosses, r.t, 0]::numeric[] else array[(r.kind = 'win')::int, case when r.kind = 'win' then -r.t else r.t end, r.kills, 0]::numeric[] end
$$;
drop function if exists public.sim_week();   -- 예전 판에서 만든 「이번 주」 알림(게임은 simWeek 로 계산 — 안 써서 지움)
-- 관전 시작 — 그 주(넘어가는 판은 시작한 주로 받는다) → { wk, field }
create or replace function public.sim_start() returns json language sql security definer set search_path = public as $$
  insert into sim_starts (uid, wk) select auth.uid(), sim_wk() where auth.uid() is not null on conflict (uid) do update set at = now(), wk = sim_wk()
  returning json_build_object('wk', wk, 'field', sim_field(wk))
$$;
-- 올리기 → { r: 'ok' | 'kept'(내 이번 주 기록이 더 좋음) | 'nonick' | 'nostart' | 'bad' | 'fast' | 'old' | 'hold'(차단) | 'odd'(같은 작전 다수 · 먼저 올라온 결과와 달라 확인 중 — 내려감), rank }
create or replace function public.submit_sim(diff text, winter boolean, ch text, s text, w text, p text, kind text, t int, kills int, bosses int, lv int, lvl int, v text)
returns json language plpgsql security definer set search_path = public as $$
declare st timestamptz; wk0 int; nw sim_ranks; old sim_ranks; had boolean;
begin
  if auth.uid() is null or not exists (select 1 from players where uid = auth.uid()) then return json_build_object('r', 'nonick'); end if;
  if banned() then return json_build_object('r', 'hold'); end if;
  delete from sim_starts x where x.uid = auth.uid() returning x.at, x.wk into st, wk0;   -- 한 판에 한 번
  if st is null then return json_build_object('r', 'nostart'); end if;
  if split_part(submit_sim.w, ' ', 1) is distinct from (json_build_object('chiikawa', 'sasu', 'hachiware', 'guitar', 'usagi', 'stick', 'momonga', 'momo', 'kurimanju', 'kanpai', 'rakko', 'sword', 'kani', 'book', 'shisa', 'ramen') ->> submit_sim.ch)   -- 첫 무기는 그 캐릭터 기본 무기
    or submit_sim.diff is distinct from 'inf' or submit_sim.kind = 'win'   -- 랭킹은 무한만(사용자 2026-11-22)
    or submit_sim.kills > 100 * submit_sim.t + 100 or submit_sim.lvl > submit_sim.t / 4 + 20 or submit_sim.lv > 0 and submit_sim.diff <> 'inf' then return json_build_object('r', 'bad'); end if;
  if now() - st < make_interval(secs => submit_sim.t / 3.0 - 30) then return json_build_object('r', 'fast'); end if;   -- 3배속 관전(건너뛰면 몇 초) — 거절만
  if now() - st > interval '3 hours' then return json_build_object('r', 'old'); end if;
  begin
    nw := row(auth.uid(), wk0, submit_sim.diff, submit_sim.winter, submit_sim.ch, submit_sim.s, submit_sim.w, coalesce(submit_sim.p, ''), submit_sim.kind, submit_sim.t, submit_sim.kills, submit_sim.bosses,
      coalesce(submit_sim.lv, 0), submit_sim.lvl, submit_sim.v, round(extract(epoch from now() - st)), false, now(), null, false)::sim_ranks;
  exception when others then return json_build_object('r', 'bad'); end;
  select * into old from sim_ranks r where r.uid = nw.uid and r.wk = nw.wk and r.diff = nw.diff and r.winter = nw.winter; had := found;
  if had and not old.hidden and sim_key(old) >= sim_key(nw) then
    return json_build_object('r', 'kept', 'rank', (select k.rank from my_sim(nw.diff, nw.winter) k));
  end if;
  insert into sim_ranks values (nw.*) on conflict on constraint sim_ranks_pkey do update set ch = excluded.ch, s = excluded.s, w = excluded.w, p = excluded.p, kind = excluded.kind, t = excluded.t, kills = excluded.kills,
    bosses = excluded.bosses, lv = excluded.lv, lvl = excluded.lvl, v = excluded.v, real = excluded.real, hidden = excluded.hidden, at = excluded.at, ok_at = null, bad = false;
  if had then perform sim_vote(old); end if;   -- 예전 작전 묶음에서 빠졌으니 그쪽도 다시 센다
  perform sim_vote(nw);
  if (select r.hidden from sim_ranks r where r.uid = nw.uid and r.wk = nw.wk and r.diff = nw.diff and r.winter = nw.winter) then return json_build_object('r', 'odd'); end if;
  return json_build_object('r', 'ok', 'rank', (select k.rank from my_sim(nw.diff, nw.winter) k));
end $$;
-- 같은 답 맞추기(다수결 + 먼저 — 기획 · QA · QC): 같은 주(= 같은 전장) · 판 · 작전 · 판 번호 기록을 결과별로 묶어 계정이 많은 묶음 → 같으면 먼저 올라온 묶음이 이긴다.
--   진 묶음은 내리고(hidden) 'sim', 다시 이긴 쪽은 보이게 하고 'sim'(restore) — 정지 · 자동 차단 셈에는 안 들어간다(살펴보기용). 한 계정 장난(나중에 다른 결과 하나)은 늘 진다. 여러 계정 장난은 2단계 재현 확인(Actions)이 가린다
create or replace function public.sim_vote(k sim_ranks) returns void language plpgsql security definer set search_path = public as $$
declare w record; r record;
begin
  select x.kind, x.t, x.kills, x.bosses, x.lv, x.lvl into w from sim_ranks x
  where x.wk = k.wk and x.diff = k.diff and x.winter = k.winter and x.ch = k.ch and x.s = k.s and x.w = k.w and x.p = k.p and x.v = k.v and not x.bad
  group by x.kind, x.t, x.kills, x.bosses, x.lv, x.lvl order by bool_or(x.ok_at is not null) desc, count(*) desc, min(x.at) limit 1;   -- 재현 확인을 통과한 결과가 먼저
  if not found then return; end if;
  for r in select * from sim_ranks x where x.wk = k.wk and x.diff = k.diff and x.winter = k.winter and x.ch = k.ch and x.s = k.s and x.w = k.w and x.p = k.p and x.v = k.v and not x.bad
    and x.hidden = ((x.kind, x.t, x.kills, x.bosses, x.lv, x.lvl) = (w.kind, w.t, w.kills, w.bosses, w.lv, w.lvl)) loop   -- 표시가 틀린 줄만(이긴 쪽인데 숨김 · 진 쪽인데 보임)
    update sim_ranks x set hidden = not r.hidden where x.uid = r.uid and x.wk = r.wk and x.diff = r.diff and x.winter = r.winter;
    insert into cheat_log (uid, ip_h, reason, detail) values (r.uid, null, 'sim', json_build_object('diff', r.diff, 'w', r.w, 'v', r.v, 't', r.t, 'kills', r.kills, 'act', case when r.hidden then 'restore' else 'hide' end)::jsonb);
  end loop;
end $$;
-- 2단계 재현 확인(GitHub Actions .github/workflows/sim-audit.yml · test/sim-audit.cjs — 하루 한 번): 이번 주 판마다 상위 10 중 아직 확인 안 한 줄을 받아,
--   그 판 번호의 game.js(저장소 기록)로 같은 작전 · 전장을 다시 계산한다. 같으면 ok_at, 다르면 bad + 내림 + 'sim'(audit) — 정지 셈 없음
--   비밀 값 — 저장소에 두지 않는다. 처음 Run 하면 아무 값이 들어가고, GitHub 비밀 SIM_AUDIT 과 같은 값으로 직접 바꾼다:
--     update public.sim_audit_key set v = '<GitHub 비밀 SIM_AUDIT 과 같은 값>';      (이 줄은 저장소에 적지 말 것)
create table if not exists public.sim_audit_key (id int primary key default 1 check (id = 1), v text not null default gen_random_uuid()::text);
insert into public.sim_audit_key default values on conflict do nothing;
alter table public.sim_audit_key enable row level security;
revoke all on public.sim_audit_key from anon, authenticated;
create or replace function public.sim_audit(key text)
returns table (uid uuid, wk int, field int, diff text, winter boolean, ch text, s text, w text, p text, kind text, t int, kills int, bosses int, lv int, lvl int, v text, at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.uid, b.wk, sim_field(b.wk), b.diff, b.winter, b.ch, b.s, b.w, b.p, b.kind, b.t, b.kills, b.bosses, b.lv, b.lvl, b.v, b.at from (
    select r.*, row_number() over (partition by r.diff, r.winter order by sim_key(r) desc, r.at) as n from sim_ranks r where r.wk = sim_wk() and not r.hidden and not r.bad
  ) b where b.n <= 10 and b.ok_at is null and key = (select k.v from sim_audit_key k)
$$;
-- 확인 결과 넣기 → 'ok' | 'gone'(그사이 기록이 바뀜) | 'no'(비밀 값 다름)
create or replace function public.sim_flag(key text, u uuid, wk int, diff text, winter boolean, at timestamptz, same boolean, got text default null)
returns text language plpgsql security definer set search_path = public as $$
declare r sim_ranks;
begin
  if key is distinct from (select k.v from sim_audit_key k) then return 'no'; end if;
  select * into r from sim_ranks x where x.uid = u and x.wk = sim_flag.wk and x.diff = sim_flag.diff and x.winter = sim_flag.winter and x.at = sim_flag.at;
  if not found then return 'gone'; end if;
  if same then update sim_ranks x set ok_at = now() where x.uid = u and x.wk = r.wk and x.diff = r.diff and x.winter = r.winter;
  else
    update sim_ranks x set bad = true, hidden = true where x.uid = u and x.wk = r.wk and x.diff = r.diff and x.winter = r.winter;
    insert into cheat_log (uid, ip_h, reason, detail) values (u, null, 'sim', json_build_object('diff', r.diff, 'w', r.w, 'v', r.v, 't', r.t, 'kills', r.kills, 'act', 'audit', 'got', left(got, 200))::jsonb);
  end if;
  perform sim_vote(r);   -- 확인된 결과가 이기도록 묶음을 다시 센다
  return 'ok';
end $$;
-- 이번 주 TOP 100(판마다) · 내 순위 — 내린 기록 · 차단된 계정 빼고
create or replace function public.top_sims(on_diff text, on_winter boolean)
returns table (rank bigint, nick text, ch text, s text, w text, p text, kind text, t int, kills int, bosses int, lv int, lvl int, v text, at timestamptz, me boolean)
language sql stable security definer set search_path = public as $$
  select row_number() over (order by sim_key(r) desc, r.at), pl.nick, r.ch, r.s, r.w, r.p, r.kind, r.t, r.kills, r.bosses, r.lv, r.lvl, r.v, r.at, r.uid = auth.uid()
  from sim_ranks r join players pl on pl.uid = r.uid
  where r.wk = sim_wk() and r.diff = on_diff and r.winter = on_winter and not r.hidden and not exists (select 1 from bans x where x.uid = r.uid and (x.until is null or x.until > now()))
  order by sim_key(r) desc, r.at limit 100
$$;
create or replace function public.my_sim(on_diff text, on_winter boolean)
returns table (rank bigint, nick text, ch text, s text, w text, p text, kind text, t int, kills int, bosses int, lv int, lvl int, v text, at timestamptz, me boolean, hidden boolean)
language sql stable security definer set search_path = public as $$
  with board as (
    select row_number() over (order by sim_key(r) desc, r.at) as rank, r.* from sim_ranks r
    where r.wk = sim_wk() and r.diff = on_diff and r.winter = on_winter and not r.hidden and not exists (select 1 from bans x where x.uid = r.uid and (x.until is null or x.until > now()))
  )
  select b.rank, pl.nick, m.ch, m.s, m.w, m.p, m.kind, m.t, m.kills, m.bosses, m.lv, m.lvl, m.v, m.at, true, m.hidden
  from sim_ranks m join players pl on pl.uid = m.uid left join board b on b.uid = m.uid
  where m.uid = auth.uid() and m.wk = sim_wk() and m.diff = on_diff and m.winter = on_winter
$$;
revoke all on function public.sim_audit, public.sim_flag, public.sim_vote, public.sim_wk, public.sim_field, public.sim_key, public.sim_start, public.submit_sim, public.top_sims, public.my_sim from public, anon, authenticated;
grant execute on function public.top_sims, public.sim_audit, public.sim_flag to anon, authenticated;   -- 재현 확인 둘은 비밀 값으로 막는다(Actions 는 공개 키로 부른다)
grant execute on function public.sim_start, public.submit_sim, public.my_sim to authenticated;
-- 지난 기록 — 그 주가 끝나고 2주 뒤 지운다(처리방침). gc 가 부른다
create or replace function public.sim_gc() returns void language sql security definer set search_path = public as $$
  delete from sim_ranks where wk < sim_wk() - 2; delete from sim_starts where at < now() - interval '1 day'
$$;
revoke all on function public.sim_gc from public, anon, authenticated;
