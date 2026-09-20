-- Fresh, isolated Supabase project ONLY. Never apply to the existing CAPAi database.
-- Supabase supplies auth.users, auth.uid(), anon, authenticated and service_role.
-- This migration intentionally fails if these application tables already exist.
begin;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (length(btrim(display_name)) between 1 and 100),
  preferred_language text not null default 'en' check (preferred_language in ('en', 'ms')),
  onboarding_completed boolean not null default false,
  account_status text not null default 'active' check (account_status in ('active', 'suspended', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  title text not null check (length(btrim(title)) between 1 and 200),
  short_description text not null check (length(btrim(short_description)) between 1 and 2000),
  experience_style text not null default 'mission',
  access_type text not null default 'free' check (access_type in ('free', 'paid', 'membership', 'sponsored', 'private', 'invite_only')),
  status text not null default 'draft' check (status in ('draft', 'in_review', 'published', 'archived')),
  sort_order integer not null default 0,
  mission_count integer not null check (mission_count between 1 and 128)
);

create table public.module_enrolments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete restrict,
  enrolled_at timestamptz not null default now(),
  status text not null default 'active' check (status in ('active', 'suspended', 'withdrawn')),
  unique (user_id, course_id)
);
create index module_enrolments_course_idx on public.module_enrolments(course_id);

create table public.module_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  course_id uuid not null,
  -- The current API deliberately stores the one-based next incomplete topic as TEXT.
  current_mission text not null default '1' check (current_mission ~ '^[1-9][0-9]{0,2}$'),
  progress_percentage integer not null default 0 check (progress_percentage between 0 and 100),
  last_activity_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (user_id, course_id),
  foreign key (user_id, course_id) references public.module_enrolments(user_id, course_id) on delete cascade,
  check ((progress_percentage < 100 and completed_at is null) or (progress_percentage = 100 and completed_at is not null))
);

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.module_enrolments enable row level security;
alter table public.module_progress enable row level security;

-- Column grants are part of the authorization boundary, not just UI validation.
revoke all on public.profiles, public.courses, public.module_enrolments, public.module_progress from public, anon, authenticated;
grant usage on schema public to anon, authenticated, service_role;
grant select on public.courses to anon, authenticated;
grant select on public.profiles, public.module_enrolments, public.module_progress to authenticated;
grant insert (user_id, display_name, preferred_language, onboarding_completed) on public.profiles to authenticated;
grant update (display_name, preferred_language, onboarding_completed) on public.profiles to authenticated;
grant insert (user_id, course_id, status) on public.module_enrolments to authenticated;
grant insert (user_id, course_id, current_mission, progress_percentage, last_activity_at, completed_at) on public.module_progress to authenticated;
grant update (current_mission, progress_percentage, last_activity_at, completed_at) on public.module_progress to authenticated;
grant all on public.profiles, public.courses, public.module_enrolments, public.module_progress to service_role;

create policy catalogue_published_read on public.courses for select to anon, authenticated
  using (status = 'published');
create policy profile_own_read on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));
create policy profile_own_insert on public.profiles for insert to authenticated
  with check (user_id = (select auth.uid()) and account_status = 'active');
create policy profile_own_update on public.profiles for update to authenticated
  using (user_id = (select auth.uid()) and account_status = 'active')
  with check (user_id = (select auth.uid()) and account_status = 'active');

create policy enrolment_own_read on public.module_enrolments for select to authenticated
  using (user_id = (select auth.uid()) and exists (
    select 1 from public.profiles p where p.user_id = (select auth.uid())
      and p.account_status = 'active' and p.onboarding_completed));
create policy enrolment_own_insert on public.module_enrolments for insert to authenticated
  with check (user_id = (select auth.uid()) and status = 'active' and exists (
    select 1 from public.profiles p where p.user_id = (select auth.uid())
      and p.account_status = 'active' and p.onboarding_completed) and exists (
    select 1 from public.courses c where c.id = course_id and c.status = 'published' and c.access_type = 'free'));

create policy progress_own_read on public.module_progress for select to authenticated
  using (user_id = (select auth.uid()) and exists (
    select 1 from public.profiles p where p.user_id = (select auth.uid())
      and p.account_status = 'active' and p.onboarding_completed));
create policy progress_own_insert on public.module_progress for insert to authenticated
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.profiles p where p.user_id = (select auth.uid())
      and p.account_status = 'active' and p.onboarding_completed));
create policy progress_own_update on public.module_progress for update to authenticated
  using (user_id = (select auth.uid()) and exists (
    select 1 from public.profiles p where p.user_id = (select auth.uid())
      and p.account_status = 'active' and p.onboarding_completed))
  with check (user_id = (select auth.uid()) and exists (
    select 1 from public.profiles p where p.user_id = (select auth.uid())
      and p.account_status = 'active' and p.onboarding_completed));

create function public.ksda_profile_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.onboarding_completed and not new.onboarding_completed then
    raise exception 'ONBOARDING_CANNOT_RESET';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger ksda_profile_before_update before update on public.profiles
  for each row execute function public.ksda_profile_guard();

-- SECURITY DEFINER permits the row locks without granting learners UPDATE on
-- courses/enrolments. RLS and column grants still constrain the caller's mutation.
create function public.ksda_progress_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  n integer; next_mission integer; previous_mission integer;
  enrolment_status text; course_status text; course_access text;
begin
  if tg_op = 'UPDATE' and (new.id, new.user_id, new.course_id) is distinct from (old.id, old.user_id, old.course_id) then
    raise exception 'PROGRESS_IDENTITY_IMMUTABLE';
  end if;
  select c.mission_count, c.status, c.access_type into n, course_status, course_access
    from public.courses c where c.id = new.course_id for share;
  if not found or course_status <> 'published' or course_access <> 'free' then
    raise exception 'COURSE_UNAVAILABLE';
  end if;
  select e.status into enrolment_status from public.module_enrolments e
    where e.user_id = new.user_id and e.course_id = new.course_id for share;
  if not found or enrolment_status <> 'active' then raise exception 'ACTIVE_ENROLMENT_REQUIRED'; end if;
  if new.current_mission is null or new.current_mission !~ '^[1-9][0-9]{0,2}$' then
    raise exception 'INVALID_MISSION';
  end if;
  next_mission := new.current_mission::integer;
  if next_mission > n + 1 or new.progress_percentage is distinct from ((100 * (next_mission - 1)) / n) then
    raise exception 'INVALID_PROGRESS';
  end if;
  if tg_op = 'INSERT' then
    if next_mission <> 1 or new.completed_at is not null then raise exception 'PROGRESS_MUST_START_AT_ZERO'; end if;
  else
    previous_mission := old.current_mission::integer;
    if next_mission = previous_mission then
      if new.progress_percentage is distinct from old.progress_percentage or new.completed_at is distinct from old.completed_at then
        raise exception 'PROGRESS_NO_RESET';
      end if;
      -- Exact retries do not manufacture a new activity/completion timestamp.
      new.last_activity_at := old.last_activity_at;
      return new;
    end if;
    if old.completed_at is not null or next_mission <> previous_mission + 1 then
      raise exception 'PROGRESS_ONE_STEP_REQUIRED';
    end if;
  end if;
  if next_mission = n + 1 then
    if new.completed_at is null then raise exception 'COMPLETION_TIMESTAMP_REQUIRED'; end if;
    new.completed_at := now();
  elsif new.completed_at is not null then
    raise exception 'PREMATURE_COMPLETION';
  end if;
  new.last_activity_at := now();
  return new;
end;
$$;
create trigger ksda_progress_before_write before insert or update on public.module_progress
  for each row execute function public.ksda_progress_guard();

create function public.ksda_course_guard() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (new.slug, new.mission_count) is distinct from (old.slug, old.mission_count)
    and exists (select 1 from public.module_enrolments e where e.course_id = old.id) then
    raise exception 'ENROLLED_COURSE_STRUCTURE_IMMUTABLE';
  end if;
  return new;
end;
$$;
create trigger ksda_course_before_update before update on public.courses
  for each row execute function public.ksda_course_guard();

revoke all on function public.ksda_profile_guard(), public.ksda_progress_guard(), public.ksda_course_guard() from public, anon, authenticated;
commit;
