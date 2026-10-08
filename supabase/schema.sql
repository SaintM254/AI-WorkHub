-- Run once in Supabase SQL Editor. Re-running safely refreshes policies/grants.
-- Students can submit one application and read their own data; only a trusted
-- operator using Supabase Dashboard can approve students or record payments.
create table if not exists public.applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 1 and 120),
  phone text not null check (length(phone) <= 30 and phone ~ '^\+?[0-9 ().-]+$' and length(regexp_replace(phone, '[^0-9]', '', 'g')) between 7 and 15),
  payment_plan text not null check (payment_plan in ('full','instalments')),
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  created_at timestamptz not null default now()
);
create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.applications(user_id) on delete cascade,
  amount_kes integer not null check (amount_kes > 0 and amount_kes <= 10000),
  reference text not null unique check (length(trim(reference)) > 0),
  verified_at timestamptz not null default now()
);
create table if not exists public.course_resources (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 200),
  description text not null default '',
  file_path text not null unique,
  sort_order integer not null default 0,
  published boolean not null default false
);
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.applications(user_id) on delete cascade,
  title text not null default 'AI WorkHub certificate',
  file_path text not null unique,
  released boolean not null default false
);
create index if not exists payments_user_id_idx on public.payments(user_id);
alter table public.applications enable row level security;
alter table public.payments enable row level security;
alter table public.course_resources enable row level security;
alter table public.certificates enable row level security;
revoke all on public.applications, public.payments, public.course_resources, public.certificates from anon, authenticated;
grant select on public.applications, public.payments, public.course_resources, public.certificates to authenticated;
-- Explicit column grants: students cannot set approval, timestamps or IDs.
grant insert (user_id,full_name,phone,payment_plan) on public.applications to authenticated;
drop policy if exists application_owner_read on public.applications;
create policy application_owner_read on public.applications for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists application_owner_insert on public.applications;
create policy application_owner_insert on public.applications for insert to authenticated with check ((select auth.uid()) = user_id and status = 'pending');
drop policy if exists payment_owner_read on public.payments;
create policy payment_owner_read on public.payments for select to authenticated using ((select auth.uid()) = user_id);
drop policy if exists approved_resources on public.course_resources;
create policy approved_resources on public.course_resources for select to authenticated using (
  published and exists (select 1 from public.applications a where a.user_id = (select auth.uid()) and a.status = 'approved')
);
drop policy if exists released_certificate on public.certificates;
create policy released_certificate on public.certificates for select to authenticated using (
  user_id = (select auth.uid()) and released
  and exists (select 1 from public.applications a where a.user_id = (select auth.uid()) and a.status = 'approved')
  and (select coalesce(sum(p.amount_kes),0) from public.payments p where p.user_id = (select auth.uid())) >= 10000
);
-- Private buckets. Never place course files/certificates in the public Git repo.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('course-materials','course-materials',false,10485760,array['application/pdf','image/jpeg','image/png','text/plain']),
       ('certificates','certificates',false,10485760,array['application/pdf','image/jpeg','image/png'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
drop policy if exists student_resource_files on storage.objects;
create policy student_resource_files on storage.objects for select to authenticated using (
  bucket_id = 'course-materials' and exists (select 1 from public.course_resources r where r.file_path = name)
);
drop policy if exists student_certificate_files on storage.objects;
create policy student_certificate_files on storage.objects for select to authenticated using (
  bucket_id = 'certificates' and exists (select 1 from public.certificates c where c.file_path = name)
);
-- Deliberately no student UPDATE/DELETE policies and no client storage uploads.
-- Review any pre-existing broad storage policies: permissive policies combine with OR.
