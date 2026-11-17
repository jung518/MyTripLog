-- =========================================================
-- 나의 여행 지도 - Supabase 설정 SQL
-- Supabase 대시보드 → SQL Editor → New query 에 전체를 붙여 넣고 Run 하세요. (한 번만)
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

-- 3) 사진 저장소 (비공개 버킷)
insert into storage.buckets (id, name, public)
values ('photos', 'photos', false)
on conflict (id) do nothing;

-- 4) 사진 보안 규칙: photos/<내 사용자 ID>/... 폴더만 접근
drop policy if exists "photos: read own"   on storage.objects;
drop policy if exists "photos: insert own" on storage.objects;
drop policy if exists "photos: update own" on storage.objects;
drop policy if exists "photos: delete own" on storage.objects;

create policy "photos: read own" on storage.objects
  for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "photos: insert own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "photos: update own" on storage.objects
  for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "photos: delete own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
