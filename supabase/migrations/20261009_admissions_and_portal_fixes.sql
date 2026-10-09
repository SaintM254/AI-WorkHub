begin;
-- Run this entire migration AFTER the existing schema.sql on an existing project.
-- No client may manage this allowlist. Bootstrap administrators using SQL Editor.
create table if not exists public.app_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon,authenticated;
create or replace function public.is_admin() returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.app_admins where user_id=(select auth.uid()))
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

-- Fix progress writes and prevent unpublished/unapproved assignment access.
grant insert (user_id,module_id,completed), update (user_id,module_id,completed) on public.course_progress to authenticated;
create or replace function public.touch_progress() returns trigger language plpgsql set search_path='' as $$begin new.updated_at=now(); return new; end$$;
drop trigger if exists touch_progress on public.course_progress;
create trigger touch_progress before update on public.course_progress for each row execute function public.touch_progress();
drop policy if exists progress_owner_insert on public.course_progress;
create policy progress_owner_insert on public.course_progress for insert to authenticated with check (
 user_id=(select auth.uid()) and module_id in ('m1','m2','m3','m4') and exists(select 1 from public.applications a where a.user_id=(select auth.uid()) and a.status='approved')
);
drop policy if exists progress_owner_update on public.course_progress;
create policy progress_owner_update on public.course_progress for update to authenticated using (
 user_id=(select auth.uid()) and exists(select 1 from public.applications a where a.user_id=(select auth.uid()) and a.status='approved')
) with check (user_id=(select auth.uid()) and module_id in ('m1','m2','m3','m4'));
drop policy if exists published_assignments on public.assignments;
create policy published_assignments on public.assignments for select to authenticated using (
 public.is_admin() or (published and exists(select 1 from public.applications a where a.user_id=(select auth.uid()) and a.status='approved'))
);
insert into public.assignments(id,title,sort_order) values
 ('a1000000-0000-4000-8000-000000000001','Module 1: Prompt Engineering & Tool Matrix',1),
 ('a1000000-0000-4000-8000-000000000002','Module 2: Automation Workflow',2),
 ('a1000000-0000-4000-8000-000000000003','Module 3: AI Content Strategy',3),
 ('a1000000-0000-4000-8000-000000000004','Module 4: Applied AI Capstone',4)
on conflict(id) do nothing;
drop policy if exists student_assignment_upload on storage.objects;
create policy student_assignment_upload on storage.objects for insert to authenticated with check (
 bucket_id='assignments' and split_part(name,'/',1)=(select auth.uid())::text
 and exists(select 1 from public.applications a where a.user_id=(select auth.uid()) and a.status='approved')
);
drop policy if exists student_assignment_read on storage.objects;
-- Folder ownership is authoritative; a forged submission row cannot grant access.
create policy student_assignment_read on storage.objects for select to authenticated using (
 bucket_id='assignments' and (split_part(name,'/',1)=(select auth.uid())::text or public.is_admin())
);
drop policy if exists student_assignment_cleanup on storage.objects;
create policy student_assignment_cleanup on storage.objects for delete to authenticated using (
 bucket_id='assignments' and split_part(name,'/',1)=(select auth.uid())::text
 and not exists(select 1 from public.assignment_submissions s where s.file_path=name)
);
drop policy if exists submission_owner_insert on public.assignment_submissions;
create policy submission_owner_insert on public.assignment_submissions for insert to authenticated with check (
 user_id=(select auth.uid()) and status='submitted' and split_part(file_path,'/',1)=(select auth.uid())::text
 and length(notes)<=4000 and length(file_name)<=250
 and exists(select 1 from public.applications a where a.user_id=(select auth.uid()) and a.status='approved')
 and exists(select 1 from public.assignments a where a.id=assignment_id and a.published)
 and exists(select 1 from storage.objects o where o.bucket_id='assignments' and o.name=file_path)
);
-- Submission rows may be reviewed by admins, but student status writes remain forbidden.
drop policy if exists submission_admin_read on public.assignment_submissions;
create policy submission_admin_read on public.assignment_submissions for select to authenticated using (public.is_admin());
update storage.buckets set allowed_mime_types=array['application/pdf','image/jpeg','image/png','text/plain','application/zip','application/x-zip-compressed','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document'] where id='assignments';

alter table public.applications add column if not exists admission_no text unique;
alter table public.applications add column if not exists admitted_at timestamptz;
alter table public.applications add column if not exists admitted_by uuid references auth.users(id);
create table if not exists public.admission_counters(year integer primary key,last_number integer not null check(last_number>0));
create table if not exists public.admin_audit (
 id uuid primary key default gen_random_uuid(),actor uuid references auth.users(id),application_id uuid references public.applications(id),action text not null,created_at timestamptz not null default now()
);
alter table public.admission_counters enable row level security;
alter table public.admin_audit enable row level security;
revoke all on public.admission_counters,public.admin_audit from anon,authenticated;

create or replace function public.admin_list_applications() returns table (
 id uuid,user_id uuid,full_name text,email text,phone text,payment_plan text,status text,created_at timestamptz,admission_no text,admitted_at timestamptz,paid_kes bigint
) language plpgsql security definer set search_path='' as $$
begin
 if not public.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 return query select a.id,a.user_id,a.full_name,u.email::text,a.phone,a.payment_plan,a.status,a.created_at,a.admission_no,a.admitted_at,coalesce((select sum(p.amount_kes) from public.payments p where p.user_id=a.user_id),0)
 from public.applications a join auth.users u on u.id=a.user_id order by a.created_at desc;
end$$;
create or replace function public.admin_set_admission(p_id uuid,p_status text) returns public.applications language plpgsql security definer set search_path='' as $$
declare a public.applications; y integer; n integer;
begin
 if not public.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 if p_status not in ('approved','declined','pending') then raise exception 'Invalid status'; end if;
 select * into a from public.applications where id=p_id for update;
 if not found then raise exception 'Application not found'; end if;
 if p_status='approved' and a.admission_no is null then
   y=extract(year from now() at time zone 'Africa/Nairobi')::integer;
   insert into public.admission_counters(year,last_number) values(y,1) on conflict(year) do update set last_number=public.admission_counters.last_number+1 returning last_number into n;
   a.admission_no='AIWH/ESS/'||lpad(n::text,greatest(4,length(n::text)),'0')||'/'||y::text;
   a.admitted_at=now(); a.admitted_by=auth.uid();
 end if;
 update public.applications set status=p_status,admission_no=a.admission_no,admitted_at=a.admitted_at,admitted_by=a.admitted_by where applications.id=p_id returning * into a;
 insert into public.admin_audit(actor,application_id,action) values(auth.uid(),p_id,'status:'||p_status);
 return a;
end$$;
create or replace function public.admin_record_payment(p_id uuid,p_amount integer,p_reference text) returns void language plpgsql security definer set search_path='' as $$
declare a public.applications; paid bigint;
begin
 if not public.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 select * into a from public.applications where id=p_id for update;
 if not found then raise exception 'Application not found'; end if;
 select coalesce(sum(amount_kes),0) into paid from public.payments where user_id=a.user_id;
 if p_amount is null or p_amount<=0 or paid+p_amount>10000 or length(trim(p_reference)) not between 1 and 120 then raise exception 'Invalid amount or reference'; end if;
 insert into public.payments(user_id,amount_kes,reference) values(a.user_id,p_amount,trim(p_reference));
 insert into public.admin_audit(actor,application_id,action) values(auth.uid(),p_id,'payment:'||p_amount::text);
end$$;

create table if not exists public.admission_letters (
 id uuid primary key default gen_random_uuid(),application_id uuid not null references public.applications(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,file_path text not null unique,
 created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 email_status text not null default 'not_sent' check(email_status in ('not_sent','sending','sent','failed','uncertain')),
 email_attempt_at timestamptz,email_sent_at timestamptz,email_provider_id text
);
alter table public.admission_letters enable row level security;
revoke all on public.admission_letters from anon,authenticated;
grant select on public.admission_letters to authenticated;
drop policy if exists letters_read on public.admission_letters;
create policy letters_read on public.admission_letters for select to authenticated using (
 public.is_admin() or (user_id=(select auth.uid()) and exists(select 1 from public.applications a where a.id=application_id and a.status='approved'))
);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('admission-letters','admission-letters',false,5242880,array['application/pdf'])
on conflict(id) do update set public=false;
drop policy if exists letter_admin_upload on storage.objects;
create policy letter_admin_upload on storage.objects for insert to authenticated with check (bucket_id='admission-letters' and public.is_admin());
drop policy if exists letter_read on storage.objects;
create policy letter_read on storage.objects for select to authenticated using (
 bucket_id='admission-letters' and (public.is_admin() or exists(select 1 from public.admission_letters l where l.file_path=name))
);
drop policy if exists letter_cleanup on storage.objects;
create policy letter_cleanup on storage.objects for delete to authenticated using (
 bucket_id='admission-letters' and public.is_admin() and not exists(select 1 from public.admission_letters l where l.file_path=name)
);
create or replace function public.admin_register_letter(p_id uuid,p_path text) returns uuid language plpgsql security definer set search_path='' as $$
declare a public.applications; result uuid;
begin
 if not public.is_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
 select * into a from public.applications where id=p_id for update;
 if not found or a.status<>'approved' or a.admission_no is null then raise exception 'Approve admission first'; end if;
 if split_part(p_path,'/',1)<>a.user_id::text or not exists(select 1 from storage.objects o where o.bucket_id='admission-letters' and o.name=p_path) then raise exception 'Invalid letter file'; end if;
 insert into public.admission_letters(application_id,user_id,file_path,created_by) values(a.id,a.user_id,p_path,auth.uid()) returning id into result;
 insert into public.admin_audit(actor,application_id,action) values(auth.uid(),p_id,'letter_created');
 return result;
end$$;
revoke all on function public.admin_list_applications(),public.admin_set_admission(uuid,text),public.admin_record_payment(uuid,integer,text),public.admin_register_letter(uuid,text) from public;
grant execute on function public.admin_list_applications(),public.admin_set_admission(uuid,text),public.admin_record_payment(uuid,integer,text),public.admin_register_letter(uuid,text) to authenticated;
do $$begin
 if exists(select 1 from pg_roles where rolname='service_role') then
   grant select on public.app_admins,public.applications to service_role;
   grant select,update on public.admission_letters to service_role;
 end if;
end$$;
commit;
