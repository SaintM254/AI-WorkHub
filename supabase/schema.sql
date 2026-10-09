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

-- Course Progress tracking table
create table if not exists public.course_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.applications(user_id) on delete cascade,
  module_id text not null check (length(trim(module_id)) between 1 and 50),
  completed boolean not null default false,
  updated_at timestamptz not null default now(),
  unique(user_id, module_id)
);

-- Assignments table
create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(trim(title)) between 1 and 200),
  description text not null default '',
  due_date text not null default '',
  sort_order integer not null default 0,
  published boolean not null default true
);

-- Assignment Submissions table
create table if not exists public.assignment_submissions (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.assignments(id) on delete cascade,
  user_id uuid not null references public.applications(user_id) on delete cascade,
  file_name text not null check (length(trim(file_name)) > 0),
  file_path text not null default '',
  notes text not null default '',
  status text not null default 'submitted' check (status in ('submitted','under_review','graded')),
  submitted_at timestamptz not null default now()
);

create index if not exists payments_user_id_idx on public.payments(user_id);
create index if not exists progress_user_id_idx on public.course_progress(user_id);
create index if not exists submissions_user_id_idx on public.assignment_submissions(user_id);

alter table public.applications enable row level security;
alter table public.payments enable row level security;
alter table public.course_resources enable row level security;
alter table public.certificates enable row level security;
alter table public.course_progress enable row level security;
alter table public.assignments enable row level security;
alter table public.assignment_submissions enable row level security;

revoke all on public.applications, public.payments, public.course_resources, public.certificates, public.course_progress, public.assignments, public.assignment_submissions from anon, authenticated;
grant select on public.applications, public.payments, public.course_resources, public.certificates, public.course_progress, public.assignments, public.assignment_submissions to authenticated;

-- Explicit column grants: students cannot set approval, timestamps or IDs.
grant insert (user_id,full_name,phone,payment_plan) on public.applications to authenticated;
grant insert (user_id,module_id,completed) on public.course_progress to authenticated;
grant update (completed) on public.course_progress to authenticated;
grant insert (assignment_id,user_id,file_name,file_path,notes) on public.assignment_submissions to authenticated;

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

-- Course Progress Policies
drop policy if exists progress_owner_read on public.course_progress;
create policy progress_owner_read on public.course_progress for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists progress_owner_insert on public.course_progress;
create policy progress_owner_insert on public.course_progress for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists progress_owner_update on public.course_progress;
create policy progress_owner_update on public.course_progress for update to authenticated using ((select auth.uid()) = user_id);

-- Assignments & Submissions Policies
drop policy if exists published_assignments on public.assignments;
create policy published_assignments on public.assignments for select to authenticated using (published);

drop policy if exists submission_owner_read on public.assignment_submissions;
create policy submission_owner_read on public.assignment_submissions for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists submission_owner_insert on public.assignment_submissions;
create policy submission_owner_insert on public.assignment_submissions for insert to authenticated with check ((select auth.uid()) = user_id);

-- Private buckets. Never place course files/certificates in the public Git repo.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('course-materials','course-materials',false,10485760,array['application/pdf','image/jpeg','image/png','text/plain']),
       ('certificates','certificates',false,10485760,array['application/pdf','image/jpeg','image/png']),
       ('assignments','assignments',false,10485760,array['application/pdf','image/jpeg','image/png','text/plain','application/zip'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists student_resource_files on storage.objects;
create policy student_resource_files on storage.objects for select to authenticated using (
  bucket_id = 'course-materials' and exists (select 1 from public.course_resources r where r.file_path = name)
);

drop policy if exists student_certificate_files on storage.objects;
create policy student_certificate_files on storage.objects for select to authenticated using (
  bucket_id = 'certificates' and exists (select 1 from public.certificates c where c.file_path = name)
);

drop policy if exists student_assignment_upload on storage.objects;
create policy student_assignment_upload on storage.objects for insert to authenticated with check (
  bucket_id = 'assignments' and owner = (select auth.uid())
);

drop policy if exists student_assignment_read on storage.objects;
create policy student_assignment_read on storage.objects for select to authenticated using (
  bucket_id = 'assignments' and owner = (select auth.uid())
);
