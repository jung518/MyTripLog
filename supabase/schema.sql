-- =========================================================
-- 나의 여행 지도 - Supabase 설정 SQL
-- Supabase 대시보드 → SQL Editor → New query 에 전체를 붙여 넣고 Run 하세요. (한 번만)
--
-- 여러 사람이 쓰는 설정 (대시보드 → Authentication)
--   · Sign In / Providers → Email
--       Allow new users to sign up : 켜기   (누구나 이메일·비밀번호로 가입)
--       Confirm email              : 켜기   (가입 인증 메일의 링크를 눌러야 가입 완료)
--   · Emails → SMTP Settings       : 메일 서비스(Resend, Brevo, Gmail 등) 연결 필수
--       Supabase 기본 메일은 내 팀 주소로만 가서 다른 사람은 인증·비밀번호 재설정 메일을 못 받음
--   · URL Configuration
--       Site URL      : https://mytriplog-nu.vercel.app
--       Redirect URLs : https://mytriplog-nu.vercel.app/**  ,  http://localhost:5173/**
-- 각자 자기 기록만 보고 고칠 수 있게 하는 건 아래 2) 보안 규칙(RLS)이 맡습니다.
-- =========================================================

-- 1) 여행 기록 / 가고 싶은 곳 테이블
create table if not exists public.trips (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.wishes (
  id          text primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists trips_user_id_idx  on public.trips(user_id);
create index if not exists wishes_user_id_idx on public.wishes(user_id);

-- 2) 보안 규칙(RLS): 로그인한 본인 행만 읽기/쓰기
alter table public.trips  enable row level security;
alter table public.wishes enable row level security;

drop policy if exists "trips: own rows"  on public.trips;
drop policy if exists "wishes: own rows" on public.wishes;

create policy "trips: own rows" on public.trips
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "wishes: own rows" on public.wishes
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

grant select, insert, update, delete on public.trips  to authenticated;
grant select, insert, update, delete on public.wishes to authenticated;

-- 3) 정리: 예전 버전(사진 기능)에서 만든 보안 규칙 삭제 (없으면 그냥 넘어감)
--    사진 기능은 제거됐습니다. 'photos' 버킷이 남아 있다면 대시보드 → Storage 에서 직접 지우세요.
drop policy if exists "photos: read own"   on storage.objects;
drop policy if exists "photos: insert own" on storage.objects;
drop policy if exists "photos: update own" on storage.objects;
drop policy if exists "photos: delete own" on storage.objects;

-- 4) 회원 탈퇴: 로그인한 "본인" 계정만 지움 (앱의 계정 메뉴 → 회원 탈퇴)
--    trips·wishes 는 user_id 가 on delete cascade 라 계정과 함께 지워집니다.
--    이미 위 1)~3)을 실행했다면 이 4)만 따로 실행해도 됩니다.
create or replace function public.delete_my_account()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from auth.users where id = auth.uid();
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
