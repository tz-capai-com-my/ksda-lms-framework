-- v0.2 additive upgrade for the independent KSDA v0.1.0 framework only.

-- Derived from verified CAPAi v57 reading semantics; new namespace and installation-owned IDs.

-- No users, progress, course identities, secrets, reviewer identities or publication approval are imported.

begin;

do $$ begin
 if to_regprocedure('public.ksda_progress_guard()') is null or to_regprocedure('public.ksda_course_guard()') is null or not exists (select 1 from information_schema.columns where table_schema='public' and table_name='courses' and column_name='mission_count') then raise exception 'FRAMEWORK_V010_PREREQUISITE_REQUIRED'; end if;
 if to_regnamespace('ksda_reading_private') is not null then raise exception 'READING_SCHEMA_ALREADY_INSTALLED'; end if;
end $$;

set local search_path=public,pg_catalog;

set local check_function_bodies=false;

create schema ksda_reading_private;

revoke all on schema ksda_reading_private from public,anon,authenticated,service_role;

alter default privileges in schema ksda_reading_private revoke all on tables from public,anon,authenticated,service_role;

alter default privileges in schema ksda_reading_private revoke execute on functions from public,anon,authenticated,service_role;

create table "ksda_reading_private"."assets" (
 "release_id" text not null,
 "asset_id" text not null,
 "mission_id" text not null,
 "locale" text not null,
 "mime" text not null,
 "width" integer not null,
 "height" integer not null,
 "asset_hash" text not null,
 "body" text not null
);

alter table "ksda_reading_private"."assets" enable row level security;

create table "ksda_reading_private"."delivery_progress" (
 "user_id" uuid not null,
 "release_id" text not null,
 "scope" text not null,
 "content_release_id" text not null,
 "mission_id" text not null,
 "revision_hash" text not null,
 "reviewed" jsonb default '{}'::jsonb not null,
 "last_block_id" text,
 "updated_at" timestamp with time zone default now() not null
);

alter table "ksda_reading_private"."delivery_progress" enable row level security;

create table "ksda_reading_private"."journey_test_progress" (
 "user_id" uuid not null,
 "release_id" text not null,
 "course_key" text not null,
 "current_mission" integer default 1 not null,
 "updated_at" timestamp with time zone default now() not null
);

alter table "ksda_reading_private"."journey_test_progress" enable row level security;

create table "ksda_reading_private"."mission_revisions" (
 "release_id" text not null,
 "mission_id" text not null,
 "course_id" uuid not null,
 "course_key" text not null,
 "revision_hash" text not null,
 "payload_text" text not null,
 "block_ids" text[] not null
);

alter table "ksda_reading_private"."mission_revisions" enable row level security;

create table "ksda_reading_private"."photos" (
 "release_id" text not null,
 "asset_id" text not null,
 "mission_id" text not null,
 "mime" text default 'image/png'::text not null,
 "width" integer not null,
 "height" integer not null,
 "asset_hash" text not null,
 "body" bytea not null
);

alter table "ksda_reading_private"."photos" enable row level security;

create table "ksda_reading_private"."preview_progress" (
 "user_id" uuid not null,
 "release_id" text not null,
 "mission_id" text not null,
 "revision_hash" text not null,
 "reviewed" jsonb default '{}'::jsonb not null,
 "last_block_id" text,
 "updated_at" timestamp with time zone default now() not null
);

alter table "ksda_reading_private"."preview_progress" enable row level security;

create table "ksda_reading_private"."publication" (
 "singleton" boolean default true not null,
 "release_id" text,
 "activated_at" timestamp with time zone
);

alter table "ksda_reading_private"."publication" enable row level security;

create table "ksda_reading_private"."release_approvals" (
 "release_id" text not null,
 "content_hash" text not null,
 "asset_hash" text not null,
 "source_hash" text not null,
 "code_hash" text not null,
 "approval_reference" text not null,
 "approved_at" timestamp with time zone default now() not null
);

alter table "ksda_reading_private"."release_approvals" enable row level security;

create table "ksda_reading_private"."release_sources" (
 "release_id" text not null,
 "content_release_id" text not null
);

alter table "ksda_reading_private"."release_sources" enable row level security;

create table "ksda_reading_private"."releases" (
 "id" text not null,
 "status" text default 'draft'::text not null,
 "baseline_commit" text not null,
 "source_hash" text not null,
 "content_hash" text not null,
 "asset_hash" text not null,
 "code_hash" text not null,
 "manifest_text" text not null,
 "created_at" timestamp with time zone default now() not null,
 "sealed_at" timestamp with time zone,
 "approved_at" timestamp with time zone,
 "published_at" timestamp with time zone
);

alter table "ksda_reading_private"."releases" enable row level security;

create table "ksda_reading_private"."reviewers" (
 "user_id" uuid not null,
 "enabled" boolean default true not null,
 "authorised_email" text not null,
 "created_at" timestamp with time zone default now() not null
);

alter table "ksda_reading_private"."reviewers" enable row level security;

create view "ksda_reading_private"."asset_delivery" as
 SELECT assets.release_id,
    assets.asset_id,
    assets.mission_id,
    assets.locale,
    assets.mime,
    assets.width,
    assets.height,
    assets.asset_hash,
    assets.body,
    'utf8'::text AS encoding
   FROM ksda_reading_private.assets
UNION ALL
 SELECT p.release_id,
    p.asset_id,
    p.mission_id,
    l.locale,
    p.mime,
    p.width,
    p.height,
    p.asset_hash,
    replace(encode(p.body, 'base64'::text), '
'::text, ''::text) AS body,
    'base64'::text AS encoding
   FROM ksda_reading_private.photos p
     CROSS JOIN ( VALUES ('en'::text), ('ms'::text)) l(locale);

CREATE OR REPLACE FUNCTION ksda_reading_private.delivery_context(p_scope text, p_release text, p_mission text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare who uuid; rid text; rel ksda_reading_private.releases; src ksda_reading_private.releases;
 rev ksda_reading_private.mission_revisions; doc jsonb; n int; total int; current_no int; pct int; en text; has_progress boolean;
begin
 if p_scope='preview' then who:=ksda_reading_private.require_reviewer();rid:=p_release;
 elsif p_scope='learner' then
  who:=ksda_reading_private.require_reading_user();
  select release_id into rid from ksda_reading_private.publication where singleton for share;
  if rid is null then
   if p_release is not null then raise exception 'RELEASE_CHANGED'; end if;
   return null;
  end if;
  if p_release is not null and p_release<>rid then raise exception 'RELEASE_CHANGED'; end if;
 else raise exception 'INVALID_SCOPE' using errcode='42501'; end if;
 select * into rel from ksda_reading_private.releases where id=rid and sealed_at is not null;
 if not found then raise exception 'RELEASE_NOT_FOUND'; end if;
 if p_scope='learner' and (rel.status not in ('approved','published') or rel.approved_at is null or not exists(
  select 1 from ksda_reading_private.release_approvals a where a.release_id=rid
  and a.content_hash=rel.content_hash and a.asset_hash=rel.asset_hash and a.source_hash=rel.source_hash and a.code_hash=rel.code_hash))
 then raise exception 'RELEASE_NOT_APPROVED' using errcode='42501'; end if;
 select r.* into src from ksda_reading_private.release_sources s join ksda_reading_private.releases r on r.id=s.content_release_id
 where s.release_id=rid and r.sealed_at is not null;
 if not found or exists(select 1 from ksda_reading_private.release_sources where release_id=src.id)
 then raise exception 'INVALID_CONTENT_SOURCE'; end if;
 doc:=rel.manifest_text::jsonb;
 if doc->>'content_release_id' is distinct from src.id or doc->>'parent_content_hash' is distinct from src.content_hash
 then raise exception 'DELIVERY_MANIFEST_MISMATCH'; end if;
 if p_mission is not null then
  select * into rev from ksda_reading_private.mission_revisions where release_id=src.id and mission_id=p_mission;
  if not found or not exists(select 1 from jsonb_array_elements(doc->'missions') m
   where m->>'mission_id'=p_mission and m->>'revision_hash'=rev.revision_hash and m->>'course_key'=rev.course_key)
  then raise exception 'MISSION_NOT_FOUND'; end if;
  if p_scope='learner' then
   if not exists(select 1 from public.courses c where c.id=rev.course_id and c.status='published' and c.access_type='free'
    and exists(select 1 from jsonb_array_elements(doc->'missions') mapping where mapping->>'mission_id'=p_mission and mapping->>'course_key'=rev.course_key and mapping->>'database_slug'=c.slug))
   then raise exception 'COURSE_UNAVAILABLE' using errcode='42501'; end if;
   select status into en from public.module_enrolments where user_id=who and course_id=rev.course_id;
   select case when current_mission::text ~ '^[1-9][0-9]{0,2}$' then current_mission::int else null end,progress_percentage
    into current_no,pct from public.module_progress where user_id=who and course_id=rev.course_id;
   has_progress:=found;
   select count(*),count(*) filter(where ord <= (select o from jsonb_array_elements(doc->'missions') with ordinality e(m,o) where m->>'mission_id'=p_mission))
    into total,n from jsonb_array_elements(doc->'missions') with ordinality e(m,ord) where m->>'course_key'=rev.course_key;
   -- First mission remains readable before normal idempotent enrolment, as in the existing journey.
   if en is null and not has_progress and n=1 then current_no:=1;pct:=0;
   elsif en is distinct from 'active' or not has_progress then raise exception 'ENROLMENT_INACTIVE' using errcode='42501';end if;
   if current_no is null or current_no<1 or current_no>total+1 or pct is distinct from floor(100.0*(current_no-1)/total)::int
   then raise exception 'PROGRESS_REVIEW_REQUIRED'; end if;
   if n>current_no then raise exception 'MISSION_LOCKED' using errcode='42501'; end if;
  end if;
 end if;
 return jsonb_build_object('release_id',rid,'content_release_id',src.id,'status',rel.status,'content_hash',rel.content_hash,
 'asset_hash',rel.asset_hash,'source_hash',rel.source_hash,'code_hash',rel.code_hash,'manifest_text',rel.manifest_text,
 'publication_active',p_scope='learner','progress_scope',p_scope);
end $function$;

CREATE OR REPLACE FUNCTION ksda_reading_private.immutable_candidate()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare rid text;
begin
 if TG_TABLE_NAME='releases' then
  if TG_OP='DELETE' or (OLD.sealed_at is not null and
    (to_jsonb(OLD)-array['status','approved_at','published_at']) is distinct from
    (to_jsonb(NEW)-array['status','approved_at','published_at'])) then
    raise exception 'SEALED_RELEASE_IMMUTABLE';
  end if;
  return NEW;
 end if;
 rid:=case when TG_OP='DELETE' then OLD.release_id else NEW.release_id end;
 if exists(select 1 from ksda_reading_private.releases where id=rid and sealed_at is not null)
 or (TG_OP='UPDATE' and exists(select 1 from ksda_reading_private.releases where id=OLD.release_id and sealed_at is not null)) then
  raise exception 'SEALED_RELEASE_IMMUTABLE';
 end if;
 if TG_OP='DELETE' then return OLD; end if;
 return NEW;
end $function$;

CREATE OR REPLACE FUNCTION ksda_reading_private.photo_uint_le(data bytea, pos integer, size integer)
 RETURNS bigint
 LANGUAGE sql
 IMMUTABLE STRICT
 SET search_path TO ''
AS $function$
 select sum(get_byte(data,pos+i)::bigint*(1::bigint<<(8*i)))::bigint from generate_series(0,size-1) i
$function$;

CREATE OR REPLACE FUNCTION ksda_reading_private.require_reading_user()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare who uuid:=auth.uid();
begin
 if who is null or not exists(select 1 from auth.users u join public.profiles p on p.user_id=u.id
 where u.id=who and u.email_confirmed_at is not null and coalesce(u.banned_until,now())<=now()
 and p.account_status='active' and p.onboarding_completed)
 then raise exception 'SIGN_IN_REQUIRED' using errcode='42501'; end if;
 return who;
end $function$;

CREATE OR REPLACE FUNCTION ksda_reading_private.require_reviewer()
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare who uuid := auth.uid();
begin
 if who is null or not exists(
  select 1 from ksda_reading_private.reviewers r join auth.users u on u.id=r.user_id
  join public.profiles p on p.user_id=u.id
  where r.user_id=who and r.enabled and lower(u.email)=r.authorised_email
  and u.email_confirmed_at is not null and coalesce(u.banned_until,now())<=now()
  and p.account_status='active' and p.onboarding_completed
 ) then raise exception 'REVIEWER_REQUIRED' using errcode='42501'; end if;
 return who;
end $function$;

CREATE OR REPLACE FUNCTION ksda_reading_private.select_publication(p_expected text, p_target text, p_code text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare prior text;rel ksda_reading_private.releases;
begin
 select release_id into prior from ksda_reading_private.publication where singleton for update;
 if prior is distinct from p_expected then raise exception 'PUBLICATION_CHANGED'; end if;
 if p_target is not null then
  select * into rel from ksda_reading_private.releases where id=p_target and sealed_at is not null and status in ('approved','published') and approved_at is not null;
  if not found or rel.code_hash is distinct from p_code or not exists(select 1 from ksda_reading_private.release_approvals a
   where a.release_id=rel.id and a.content_hash=rel.content_hash and a.asset_hash=rel.asset_hash and a.source_hash=rel.source_hash and a.code_hash=rel.code_hash)
  or not exists(select 1 from ksda_reading_private.release_sources where release_id=rel.id)
  then raise exception 'EXACT_APPROVAL_REQUIRED'; end if;
 end if;
 update ksda_reading_private.publication set release_id=p_target,activated_at=case when p_target is null then null else now() end where singleton;
end $function$;

CREATE OR REPLACE FUNCTION ksda_reading_private.valid_photo_header(data bytea, mime text, width integer, height integer)
 RETURNS boolean
 LANGUAGE plpgsql
 IMMUTABLE STRICT
 SET search_path TO ''
AS $function$
declare total integer:=octet_length(data); pos integer:=12; start integer; finish bigint; padded bigint;
 size bigint; kind text; bits bigint; seen_frame boolean:=false; seen_extended boolean:=false;
begin
 if width<1 or height<1 or width>8192 or height>8192 or total>10485760 then return false; end if;
 if mime='image/png' then
  if total<33 then return false; end if;
  return substring(data from 1 for 16)=decode('89504e470d0a1a0a0000000d49484452','hex')
   and get_byte(data,16)::bigint*16777216+get_byte(data,17)*65536+get_byte(data,18)*256+get_byte(data,19)=width
   and get_byte(data,20)::bigint*16777216+get_byte(data,21)*65536+get_byte(data,22)*256+get_byte(data,23)=height;
 end if;
 -- Single responsive delivery photograph: hard 256 KiB WebP budget, 512 KiB/pair.
 -- Historical PNG originals keep their existing 10 MiB ceiling.
 if mime<>'image/webp' or total<26 or total>262144 then return false; end if;
 if substring(data from 1 for 4)<>decode('52494646','hex') or substring(data from 9 for 4)<>decode('57454250','hex')
  or ksda_reading_private.photo_uint_le(data,4,4)<>total-8 then return false; end if;
 while pos<total loop
  if pos+8>total then return false; end if;
  kind:=encode(substring(data from pos+1 for 4),'hex');
  size:=ksda_reading_private.photo_uint_le(data,pos+4,4);start:=pos+8;finish:=start+size;padded:=finish+(size%2);
  if size=0 or padded>total then return false; end if;
  if size%2=1 and get_byte(data,finish::integer)<>0 then return false; end if;
  if kind='56503858' then -- VP8X, restricted to opaque still images without metadata.
   if pos<>12 or seen_extended or seen_frame or size<>10 then return false; end if;
   if ksda_reading_private.photo_uint_le(data,start,4)<>0
    or ksda_reading_private.photo_uint_le(data,start+4,3)+1<>width
    or ksda_reading_private.photo_uint_le(data,start+7,3)+1<>height then return false; end if;
   seen_extended:=true;
  elsif kind='56503820' then -- VP8 key frame, with exact unscaled dimensions.
   if seen_frame or size<10 then return false; end if;
   if (get_byte(data,start)&1)<>0 or ((get_byte(data,start)>>1)&7)>3 or (get_byte(data,start)&16)=0
    or ksda_reading_private.photo_uint_le(data,start+3,3)<>2752925
    or ksda_reading_private.photo_uint_le(data,start+6,2)<>width
    or ksda_reading_private.photo_uint_le(data,start+8,2)<>height
    or (ksda_reading_private.photo_uint_le(data,start,3)>>5)>size-10 then return false; end if;
   seen_frame:=true;
  elsif kind='5650384c' then -- VP8L with version zero and no alpha feature.
   if seen_frame or size<5 then return false; end if;
   if get_byte(data,start)<>47 then return false; end if;
   bits:=ksda_reading_private.photo_uint_le(data,start+1,4);
   if (bits>>28)<>0 or (bits&16383)+1<>width or ((bits>>14)&16383)+1<>height then return false; end if;
   seen_frame:=true;
  else return false; -- Reject animation, metadata, alpha and unknown chunk containers.
  end if;
  pos:=padded::integer;
 end loop;
 return pos=total and seen_frame;
end $function$;

CREATE OR REPLACE FUNCTION ksda_reading_private.validate_delivery_seal()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare src ksda_reading_private.releases; sid text; doc jsonb; original jsonb;
begin
 if NEW.sealed_at is null or OLD.sealed_at is not null then return NEW; end if;
 select content_release_id into sid from ksda_reading_private.release_sources where release_id=NEW.id;
 if sid is null then return NEW; end if;
 select * into src from ksda_reading_private.releases where id=sid and sealed_at is not null;
 if not found or exists(select 1 from ksda_reading_private.release_sources where release_id=sid)
 then raise exception 'INVALID_CONTENT_SOURCE'; end if;
 doc:=NEW.manifest_text::jsonb;original:=src.manifest_text::jsonb;
 if doc->>'release_id' is distinct from NEW.id or doc->>'content_release_id' is distinct from sid
 or doc->>'parent_content_hash' is distinct from src.content_hash
 or doc->'missions' is distinct from original->'missions' or doc->'assets' is distinct from original->'assets'
 or doc->>'code_manifest_hash' is distinct from NEW.code_hash
 or doc->>'source_manifest_hash' is distinct from NEW.source_hash
 or doc->>'asset_manifest_hash' is distinct from NEW.asset_hash or NEW.asset_hash<>src.asset_hash
 or NEW.source_hash<>src.source_hash or doc->'excluded_section_ids' is distinct from original->'excluded_section_ids'
 or doc->'authoring_inputs' is distinct from original->'authoring_inputs'
 then raise exception 'DELIVERY_MANIFEST_MISMATCH'; end if;
 if exists(select 1 from ksda_reading_private.mission_revisions where release_id=NEW.id) then raise exception 'ALIAS_HAS_PHYSICAL_ROWS'; end if;
 if (select count(*) from ksda_reading_private.mission_revisions where release_id=sid)<>jsonb_array_length(doc->'missions')
 or (select count(*) from ksda_reading_private.asset_delivery where release_id=sid)<>jsonb_array_length(doc->'assets')
 or exists(select 1 from jsonb_array_elements(doc->'missions') e left join ksda_reading_private.mission_revisions m
  on m.release_id=sid and m.mission_id=e->>'mission_id' where m.revision_hash is distinct from e->>'revision_hash')
 or exists(select 1 from jsonb_array_elements(doc->'assets') e left join ksda_reading_private.asset_delivery a
  on a.release_id=sid and a.asset_id=e->>'visual_id' and a.locale=e->>'locale'
  where a.asset_hash is distinct from e->>'sha256' or a.width is distinct from (e->>'width')::int
  or a.height is distinct from (e->>'height')::int or a.mime is distinct from e->>'format')
 or exists(select 1 from ksda_reading_private.mission_revisions m,
  lateral jsonb_array_elements(m.payload_text::jsonb->'sections') s where m.release_id=sid
  and s->>'id' in (select jsonb_array_elements_text(coalesce(doc->'excluded_section_ids','[]'::jsonb))))
 then raise exception 'CONTENT_SOURCE_MISMATCH'; end if;
 return NEW;
end $function$;

CREATE OR REPLACE FUNCTION ksda_reading_private.validate_photo_source()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare doc jsonb; m record; a jsonb; p jsonb; item ksda_reading_private.photos;
begin
 if NEW.sealed_at is null or OLD.sealed_at is not null then return NEW; end if;
 doc:=NEW.manifest_text::jsonb;
 if exists(select 1 from ksda_reading_private.release_sources where release_id=NEW.id) then return NEW; end if;
 if doc->>'presentation' is distinct from 'editorial-photos-v1' then raise exception 'UNSUPPORTED_PHYSICAL_PRESENTATION'; end if;
 if doc->>'release_id' is distinct from NEW.id or doc->>'baseline_commit' is distinct from NEW.baseline_commit or doc->>'source_manifest_hash' is distinct from NEW.source_hash
 or doc->>'asset_manifest_hash' is distinct from NEW.asset_hash or doc->>'code_manifest_hash' is distinct from NEW.code_hash
 or jsonb_typeof(doc->'missions') is distinct from 'array' or jsonb_typeof(doc->'assets') is distinct from 'array'
 or exists(select 1 from ksda_reading_private.assets where release_id=NEW.id)
 or (select count(*) from ksda_reading_private.mission_revisions where release_id=NEW.id)<>jsonb_array_length(doc->'missions')
 or (select count(*) from ksda_reading_private.photos where release_id=NEW.id)<>2*jsonb_array_length(doc->'missions')
 or (select count(*) from ksda_reading_private.asset_delivery where release_id=NEW.id)<>jsonb_array_length(doc->'assets')
 then raise exception 'PHOTO_SOURCE_MISMATCH'; end if;
 if exists(select 1 from jsonb_array_elements(doc->'assets') e left join ksda_reading_private.asset_delivery a
 on a.release_id=NEW.id and a.asset_id=e->>'visual_id' and a.locale=e->>'locale'
 where a.asset_hash is distinct from e->>'sha256' or a.mission_id is distinct from e->>'mission_id'
 or a.width is distinct from (e->>'width')::int or a.height is distinct from (e->>'height')::int or a.mime is distinct from e->>'format')
 or (select count(distinct (e->>'visual_id',e->>'locale')) from jsonb_array_elements(doc->'assets') e)<>jsonb_array_length(doc->'assets')
 then raise exception 'PHOTO_ASSET_MISMATCH'; end if;
 for m in select * from ksda_reading_private.mission_revisions where release_id=NEW.id loop
  p:=m.payload_text::jsonb;
  if not exists(select 1 from jsonb_array_elements(doc->'missions') e where e->>'mission_id'=m.mission_id and e->>'revision_hash'=m.revision_hash and e->>'course_key'=m.course_key)
   or m.block_ids is distinct from array(select b.id from jsonb_array_elements(p->'sections') with ordinality s(item,n) cross join lateral jsonb_array_elements_text(s.item->'block_ids') with ordinality b(id,n) order by s.n,b.n)
   or not exists(select 1 from public.courses c where c.id=m.course_id and exists(select 1 from jsonb_array_elements(doc->'missions') mapping where mapping->>'mission_id'=m.mission_id and mapping->>'course_key'=m.course_key and mapping->>'database_slug'=c.slug) and c.mission_count=(select count(*) from jsonb_array_elements(doc->'missions') mapping where mapping->>'course_key'=m.course_key))
   or jsonb_typeof(p->'editorial_photos') is distinct from 'object'
   or (select count(*) from jsonb_object_keys(p->'editorial_photos'))<>2
   or not exists(select 1 from jsonb_array_elements(p->'sections') s where s->>'id'=p->'editorial_photos'->'closer'->>'after_section')
   or p->'editorial_photos'->'opening'->>'asset_id' is not distinct from p->'editorial_photos'->'closer'->>'asset_id'
   or exists(select 1 from jsonb_array_elements(p->'sections') s where s->>'id' in (select jsonb_array_elements_text(coalesce(doc->'excluded_section_ids','[]'::jsonb))))
  then raise exception 'PHOTO_MISSION_MISMATCH'; end if;
  for a in select value from jsonb_each(p->'editorial_photos') loop
   select * into item from ksda_reading_private.photos where release_id=NEW.id and asset_id=a->>'asset_id' and mission_id=m.mission_id;
   if not found or item.width is distinct from (a->>'width')::int or item.height is distinct from (a->>'height')::int
    or coalesce(length(a->'alt'->>'en'),0)=0 or coalesce(length(a->'alt'->>'ms'),0)=0
    or coalesce(length(a->'caption'->>'en'),0)=0 or coalesce(length(a->'caption'->>'ms'),0)=0
   then raise exception 'PHOTO_REFERENCE_MISMATCH'; end if;
  end loop;
 end loop;
 return NEW;
end $function$;

CREATE OR REPLACE FUNCTION public.ksda_reading_completion_test(p_release text, p_mission text, p_confirmed boolean)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare ctx jsonb;course text;total int;n int;cur int;
begin
 ctx:=ksda_reading_private.delivery_context('preview',p_release,p_mission);
 if p_confirmed is distinct from true then raise exception 'CONFIRMATION_REQUIRED'; end if;
 select course_key into course from ksda_reading_private.mission_revisions where release_id=ctx->>'content_release_id' and mission_id=p_mission;
 select count(*),count(*) filter(where ord <= (select o from jsonb_array_elements((ctx->>'manifest_text')::jsonb->'missions') with ordinality e(m,o) where m->>'mission_id'=p_mission))
 into total,n from jsonb_array_elements((ctx->>'manifest_text')::jsonb->'missions') with ordinality e(m,ord) where m->>'course_key'=course;
 insert into ksda_reading_private.journey_test_progress(user_id,release_id,course_key) values(auth.uid(),p_release,course) on conflict do nothing;
 select current_mission into cur from ksda_reading_private.journey_test_progress where user_id=auth.uid() and release_id=p_release and course_key=course for update;
 if n>cur then raise exception 'MISSION_LOCKED'; end if;
 if n=cur then cur:=cur+1;update ksda_reading_private.journey_test_progress set current_mission=cur,updated_at=now() where user_id=auth.uid() and release_id=p_release and course_key=course;end if;
 return jsonb_build_object('current_mission',cur,'progress_percentage',floor(100.0*(cur-1)/total)::int,'scope','journey_test');
end $function$;

CREATE OR REPLACE FUNCTION public.ksda_reading_delivery(p_scope text, p_release text DEFAULT NULL::text, p_mission text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare ctx jsonb;rev ksda_reading_private.mission_revisions;cur int;total int;
begin
 ctx:=ksda_reading_private.delivery_context(p_scope,p_release,p_mission);
 if ctx is null or p_mission is null then return ctx; end if;
 select * into rev from ksda_reading_private.mission_revisions where release_id=ctx->>'content_release_id' and mission_id=p_mission;
 select count(*) into total from jsonb_array_elements((ctx->>'manifest_text')::jsonb->'missions') m where m->>'course_key'=rev.course_key;
 select current_mission into cur from ksda_reading_private.journey_test_progress where user_id=auth.uid() and release_id=ctx->>'release_id' and course_key=rev.course_key;
 return ctx || jsonb_build_object('revision_hash',rev.revision_hash,'payload_text',rev.payload_text,'block_ids',rev.block_ids,
 'journey_test',case when p_scope='preview' then jsonb_build_object('current_mission',coalesce(cur,1),'progress_percentage',floor(100.0*(coalesce(cur,1)-1)/total)::int) else null end,
 'progress',coalesce((select jsonb_build_object('reviewed',p.reviewed,'last_block_id',p.last_block_id,'updated_at',p.updated_at)
 from ksda_reading_private.delivery_progress p where p.user_id=auth.uid() and p.release_id=ctx->>'release_id' and p.scope=p_scope
 and p.mission_id=p_mission and p.content_release_id=rev.release_id and p.revision_hash=rev.revision_hash),
 jsonb_build_object('reviewed','{}'::jsonb,'last_block_id',null,'updated_at',null)));
end $function$;

CREATE OR REPLACE FUNCTION public.ksda_reading_delivery_asset(p_scope text, p_release text, p_asset text, p_locale text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare ctx jsonb;item ksda_reading_private.asset_delivery;expected jsonb;
begin
 if p_release is null or p_release='' then raise exception 'EXPLICIT_RELEASE_REQUIRED'; end if;
 ctx:=ksda_reading_private.delivery_context(p_scope,p_release);
 select * into item from ksda_reading_private.asset_delivery where release_id=ctx->>'content_release_id' and asset_id=p_asset and locale=p_locale;
 if not found then raise exception 'ASSET_NOT_FOUND'; end if;
 perform ksda_reading_private.delivery_context(p_scope,p_release,item.mission_id);
 select e into expected from jsonb_array_elements((ctx->>'manifest_text')::jsonb->'assets') e where e->>'visual_id'=p_asset and e->>'locale'=p_locale;
 if expected is null or expected->>'sha256' is distinct from item.asset_hash or (expected->>'width')::int is distinct from item.width
 or (expected->>'height')::int is distinct from item.height or expected->>'format' is distinct from item.mime then raise exception 'ASSET_MANIFEST_MISMATCH'; end if;
 return jsonb_build_object('body',item.body,'encoding',item.encoding,'hash',item.asset_hash,'expected_hash',expected->>'sha256','mime',item.mime,'width',item.width,'height',item.height,'code_hash',ctx->>'code_hash');
end $function$;

CREATE OR REPLACE FUNCTION public.ksda_reading_delivery_progress(p_scope text, p_release text, p_mission text, p_revision text, p_reviewed jsonb, p_last text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare ctx jsonb;rev ksda_reading_private.mission_revisions;answer jsonb;
begin
 if p_release is null or p_release='' then raise exception 'EXPLICIT_RELEASE_REQUIRED'; end if;
 ctx:=ksda_reading_private.delivery_context(p_scope,p_release,p_mission);
 select * into rev from ksda_reading_private.mission_revisions where release_id=ctx->>'content_release_id' and mission_id=p_mission;
 if not found or p_revision is distinct from rev.revision_hash then raise exception 'REVISION_MISMATCH'; end if;
 if p_reviewed is null or jsonb_typeof(p_reviewed)<>'object' or octet_length(p_reviewed::text)>12000
 or exists(select 1 from jsonb_each_text(p_reviewed) e where not(e.key=any(rev.block_ids)) or e.value is null or e.value not in ('self_confirmed','viewport_dwell'))
 or (p_last is not null and not(p_last=any(rev.block_ids))) then raise exception 'INVALID_READING_MARKERS'; end if;
 insert into ksda_reading_private.delivery_progress as p(user_id,release_id,scope,content_release_id,mission_id,revision_hash,reviewed,last_block_id)
 values(auth.uid(),ctx->>'release_id',p_scope,rev.release_id,p_mission,p_revision,p_reviewed,p_last)
 on conflict(user_id,release_id,scope,mission_id) do update set reviewed=p.reviewed||excluded.reviewed,last_block_id=coalesce(excluded.last_block_id,p.last_block_id),updated_at=now()
 returning jsonb_build_object('reviewed',reviewed,'last_block_id',last_block_id,'updated_at',updated_at) into answer;
 return answer;
end $function$;

CREATE OR REPLACE FUNCTION public.ksda_reading_preview(p_release text, p_mission text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare who uuid; rel ksda_reading_private.releases; rev ksda_reading_private.mission_revisions; result jsonb;
begin
 who:=ksda_reading_private.require_reviewer();
 select * into rel from ksda_reading_private.releases where id=p_release and sealed_at is not null;
 if not found then raise exception 'RELEASE_NOT_FOUND' using errcode='P0002'; end if;
 result:=jsonb_build_object('release_id',rel.id,'status',rel.status,'content_hash',rel.content_hash,
 'asset_hash',rel.asset_hash,'code_hash',rel.code_hash,'source_hash',rel.source_hash,'sealed_at',rel.sealed_at,
 'manifest_text',rel.manifest_text,'publication_active',false,'progress_scope','preview');
 if p_mission is null then return result; end if;
 select * into rev from ksda_reading_private.mission_revisions where release_id=p_release and mission_id=p_mission;
 if not found then raise exception 'MISSION_NOT_FOUND' using errcode='P0002'; end if;
 return result || jsonb_build_object('revision_hash',rev.revision_hash,'payload_text',rev.payload_text,
 'block_ids',rev.block_ids,'progress',coalesce((select jsonb_build_object('reviewed',p.reviewed,
 'last_block_id',p.last_block_id,'updated_at',p.updated_at) from ksda_reading_private.preview_progress p
 where p.user_id=who and p.release_id=p_release and p.mission_id=p_mission and p.revision_hash=rev.revision_hash),
 jsonb_build_object('reviewed','{}'::jsonb,'last_block_id',null,'updated_at',null)));
end $function$;

CREATE OR REPLACE FUNCTION public.ksda_reading_preview_asset(p_release text, p_asset text, p_locale text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare item ksda_reading_private.asset_delivery; expected jsonb; code text;
begin
 perform ksda_reading_private.require_reviewer();
 if exists(select 1 from ksda_reading_private.release_sources where release_id=p_release) then
  return public.ksda_reading_delivery_asset('preview',p_release,p_asset,p_locale);
 end if;
 select a.* into item from ksda_reading_private.asset_delivery a join ksda_reading_private.releases r on r.id=a.release_id
 where a.release_id=p_release and a.asset_id=p_asset and a.locale=p_locale and r.sealed_at is not null;
 if not found then raise exception 'ASSET_NOT_FOUND' using errcode='P0002'; end if;
 select e,r.code_hash into expected,code from ksda_reading_private.releases r cross join lateral jsonb_array_elements(r.manifest_text::jsonb->'assets') e
 where r.id=p_release and e->>'visual_id'=p_asset and e->>'locale'=p_locale;
 if expected is null or expected->>'sha256' is distinct from item.asset_hash
 or (expected->>'width')::integer is distinct from item.width or (expected->>'height')::integer is distinct from item.height
 or expected->>'format' is distinct from item.mime then raise exception 'ASSET_MANIFEST_MISMATCH'; end if;
 return jsonb_build_object('body',item.body,'encoding',item.encoding,'hash',item.asset_hash,'expected_hash',expected->>'sha256','mime',item.mime,'width',item.width,'height',item.height)
  || case when item.mime in ('image/png','image/webp') then jsonb_build_object('code_hash',code) else '{}'::jsonb end;
end $function$;

CREATE OR REPLACE FUNCTION public.ksda_reading_preview_progress(p_release text, p_mission text, p_revision text, p_reviewed jsonb, p_last text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare who uuid; rev ksda_reading_private.mission_revisions; answer jsonb;
begin
 who:=ksda_reading_private.require_reviewer();
 select m.* into rev from ksda_reading_private.mission_revisions m join ksda_reading_private.releases r on r.id=m.release_id
 where m.release_id=p_release and m.mission_id=p_mission and r.sealed_at is not null;
 if not found or rev.revision_hash<>p_revision then raise exception 'REVISION_MISMATCH'; end if;
 if p_reviewed is null or jsonb_typeof(p_reviewed)<>'object' or octet_length(p_reviewed::text)>12000
 or exists(select 1 from jsonb_each_text(p_reviewed) e where not(e.key=any(rev.block_ids))
    or e.value is null or e.value not in ('self_confirmed','viewport_dwell'))
 or (p_last is not null and not(p_last=any(rev.block_ids))) then raise exception 'INVALID_READING_MARKERS'; end if;
 insert into ksda_reading_private.preview_progress as p(user_id,release_id,mission_id,revision_hash,reviewed,last_block_id)
 values(who,p_release,p_mission,p_revision,p_reviewed,p_last)
 on conflict(user_id,release_id,mission_id) do update set
  reviewed=p.reviewed || excluded.reviewed,
  last_block_id=coalesce(excluded.last_block_id,p.last_block_id),updated_at=now()
 returning jsonb_build_object('reviewed',reviewed,'last_block_id',last_block_id,'updated_at',updated_at,'scope','preview') into answer;
 return answer;
end $function$;

alter table "ksda_reading_private"."assets" add constraint "assets_pkey" PRIMARY KEY (release_id, asset_id, locale);

alter table "ksda_reading_private"."delivery_progress" add constraint "delivery_progress_pkey" PRIMARY KEY (user_id, release_id, scope, mission_id);

alter table "ksda_reading_private"."journey_test_progress" add constraint "journey_test_progress_pkey" PRIMARY KEY (user_id, release_id, course_key);

alter table "ksda_reading_private"."mission_revisions" add constraint "mission_revisions_pkey" PRIMARY KEY (release_id, mission_id);

alter table "ksda_reading_private"."photos" add constraint "photos_pkey" PRIMARY KEY (release_id, asset_id);

alter table "ksda_reading_private"."preview_progress" add constraint "preview_progress_pkey" PRIMARY KEY (user_id, release_id, mission_id);

alter table "ksda_reading_private"."publication" add constraint "publication_pkey" PRIMARY KEY (singleton);

alter table "ksda_reading_private"."release_approvals" add constraint "release_approvals_pkey" PRIMARY KEY (release_id);

alter table "ksda_reading_private"."release_sources" add constraint "release_sources_pkey" PRIMARY KEY (release_id);

alter table "ksda_reading_private"."releases" add constraint "releases_pkey" PRIMARY KEY (id);

alter table "ksda_reading_private"."reviewers" add constraint "reviewers_pkey" PRIMARY KEY (user_id);

alter table "ksda_reading_private"."assets" add constraint "assets_body_check" CHECK (octet_length(body) <= 122880);

alter table "ksda_reading_private"."assets" add constraint "assets_check" CHECK (encode(sha256(convert_to(body, 'UTF8'::name)), 'hex'::text) = asset_hash);

alter table "ksda_reading_private"."assets" add constraint "assets_height_check" CHECK (height > 0);

alter table "ksda_reading_private"."assets" add constraint "assets_locale_check" CHECK (locale = ANY (ARRAY['en'::text, 'ms'::text]));

alter table "ksda_reading_private"."assets" add constraint "assets_mime_check" CHECK (mime = 'image/svg+xml'::text);

alter table "ksda_reading_private"."assets" add constraint "assets_width_check" CHECK (width > 0);

alter table "ksda_reading_private"."delivery_progress" add constraint "delivery_progress_reviewed_check" CHECK (jsonb_typeof(reviewed) = 'object'::text);

alter table "ksda_reading_private"."delivery_progress" add constraint "delivery_progress_scope_check" CHECK (scope = ANY (ARRAY['preview'::text, 'learner'::text]));

alter table "ksda_reading_private"."journey_test_progress" add constraint "journey_test_progress_current_mission_check" CHECK (current_mission > 0);

alter table "ksda_reading_private"."mission_revisions" add constraint "mission_revisions_block_ids_check" CHECK (cardinality(block_ids) > 0 AND cardinality(block_ids) <= 100);

alter table "ksda_reading_private"."mission_revisions" add constraint "mission_revisions_check" CHECK (encode(sha256(convert_to(payload_text, 'UTF8'::name)), 'hex'::text) = revision_hash);

alter table "ksda_reading_private"."mission_revisions" add constraint "mission_revisions_check1" CHECK ((payload_text::jsonb ->> 'mission_id'::text) = mission_id);

alter table "ksda_reading_private"."mission_revisions" add constraint "mission_revisions_check2" CHECK ((payload_text::jsonb ->> 'course_key'::text) = course_key);

alter table "ksda_reading_private"."mission_revisions" add constraint "mission_revisions_revision_hash_check" CHECK (revision_hash ~ '^[a-f0-9]{64}$'::text);

alter table "ksda_reading_private"."photos" add constraint "photos_asset_hash_check" CHECK (asset_hash ~ '^[a-f0-9]{64}$'::text);

alter table "ksda_reading_private"."photos" add constraint "photos_height_check" CHECK (height >= 1 AND height <= 8192);

alter table "ksda_reading_private"."photos" add constraint "photos_still_hash_check" CHECK (encode(sha256(body), 'hex'::text) = asset_hash);

alter table "ksda_reading_private"."photos" add constraint "photos_still_header_check" CHECK (ksda_reading_private.valid_photo_header(body, mime, width, height));

alter table "ksda_reading_private"."photos" add constraint "photos_still_mime_check" CHECK (mime = ANY (ARRAY['image/png'::text, 'image/webp'::text]));

alter table "ksda_reading_private"."photos" add constraint "photos_still_size_check" CHECK (octet_length(body) >= 26 AND octet_length(body) <= 10485760);

alter table "ksda_reading_private"."photos" add constraint "photos_width_check" CHECK (width >= 1 AND width <= 8192);

alter table "ksda_reading_private"."preview_progress" add constraint "preview_progress_reviewed_check" CHECK (jsonb_typeof(reviewed) = 'object'::text);

alter table "ksda_reading_private"."publication" add constraint "publication_singleton_check" CHECK (singleton);

alter table "ksda_reading_private"."release_approvals" add constraint "release_approvals_approval_reference_check" CHECK (length(approval_reference) > 0);

alter table "ksda_reading_private"."release_sources" add constraint "release_sources_check" CHECK (release_id <> content_release_id);

alter table "ksda_reading_private"."releases" add constraint "releases_asset_hash_check" CHECK (asset_hash ~ '^[a-f0-9]{64}$'::text);

alter table "ksda_reading_private"."releases" add constraint "releases_baseline_commit_check" CHECK (baseline_commit ~ '^[a-f0-9]{40}$'::text);

alter table "ksda_reading_private"."releases" add constraint "releases_check" CHECK (encode(sha256(convert_to(manifest_text, 'UTF8'::name)), 'hex'::text) = content_hash);

alter table "ksda_reading_private"."releases" add constraint "releases_check1" CHECK ((status <> ALL (ARRAY['approved'::text, 'published'::text])) OR approved_at IS NOT NULL);

alter table "ksda_reading_private"."releases" add constraint "releases_check2" CHECK (status <> 'published'::text OR published_at IS NOT NULL);

alter table "ksda_reading_private"."releases" add constraint "releases_code_hash_check" CHECK (code_hash ~ '^[a-f0-9]{64}$'::text);

alter table "ksda_reading_private"."releases" add constraint "releases_content_hash_check" CHECK (content_hash ~ '^[a-f0-9]{64}$'::text);

alter table "ksda_reading_private"."releases" add constraint "releases_id_check" CHECK (id ~ '^ksda-[a-z0-9-]{8,100}$'::text);

alter table "ksda_reading_private"."releases" add constraint "releases_source_hash_check" CHECK (source_hash ~ '^[a-f0-9]{64}$'::text);

alter table "ksda_reading_private"."releases" add constraint "releases_status_check" CHECK (status = ANY (ARRAY['draft'::text, 'in_review'::text, 'approved'::text, 'published'::text, 'superseded'::text]));

alter table "ksda_reading_private"."assets" add constraint "assets_release_id_fkey" FOREIGN KEY (release_id) REFERENCES ksda_reading_private.releases(id);

alter table "ksda_reading_private"."assets" add constraint "assets_release_id_mission_id_fkey" FOREIGN KEY (release_id, mission_id) REFERENCES ksda_reading_private.mission_revisions(release_id, mission_id);

alter table "ksda_reading_private"."delivery_progress" add constraint "delivery_progress_content_release_id_mission_id_fkey" FOREIGN KEY (content_release_id, mission_id) REFERENCES ksda_reading_private.mission_revisions(release_id, mission_id);

alter table "ksda_reading_private"."delivery_progress" add constraint "delivery_progress_release_id_fkey" FOREIGN KEY (release_id) REFERENCES ksda_reading_private.release_sources(release_id);

alter table "ksda_reading_private"."delivery_progress" add constraint "delivery_progress_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

alter table "ksda_reading_private"."journey_test_progress" add constraint "journey_test_progress_release_id_fkey" FOREIGN KEY (release_id) REFERENCES ksda_reading_private.release_sources(release_id);

alter table "ksda_reading_private"."journey_test_progress" add constraint "journey_test_progress_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

alter table "ksda_reading_private"."mission_revisions" add constraint "mission_revisions_course_id_fkey" FOREIGN KEY (course_id) REFERENCES courses(id);

alter table "ksda_reading_private"."mission_revisions" add constraint "mission_revisions_release_id_fkey" FOREIGN KEY (release_id) REFERENCES ksda_reading_private.releases(id);

alter table "ksda_reading_private"."photos" add constraint "photos_release_id_mission_id_fkey" FOREIGN KEY (release_id, mission_id) REFERENCES ksda_reading_private.mission_revisions(release_id, mission_id);

alter table "ksda_reading_private"."preview_progress" add constraint "preview_progress_release_id_mission_id_fkey" FOREIGN KEY (release_id, mission_id) REFERENCES ksda_reading_private.mission_revisions(release_id, mission_id);

alter table "ksda_reading_private"."preview_progress" add constraint "preview_progress_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

alter table "ksda_reading_private"."publication" add constraint "publication_release_id_fkey" FOREIGN KEY (release_id) REFERENCES ksda_reading_private.releases(id);

alter table "ksda_reading_private"."release_approvals" add constraint "release_approvals_release_id_fkey" FOREIGN KEY (release_id) REFERENCES ksda_reading_private.releases(id);

alter table "ksda_reading_private"."release_sources" add constraint "release_sources_content_release_id_fkey" FOREIGN KEY (content_release_id) REFERENCES ksda_reading_private.releases(id);

alter table "ksda_reading_private"."release_sources" add constraint "release_sources_release_id_fkey" FOREIGN KEY (release_id) REFERENCES ksda_reading_private.releases(id);

alter table "ksda_reading_private"."reviewers" add constraint "reviewers_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id);

CREATE TRIGGER immutable_asset BEFORE INSERT OR DELETE OR UPDATE ON ksda_reading_private.assets FOR EACH ROW EXECUTE FUNCTION ksda_reading_private.immutable_candidate();

CREATE TRIGGER immutable_mission BEFORE INSERT OR DELETE OR UPDATE ON ksda_reading_private.mission_revisions FOR EACH ROW EXECUTE FUNCTION ksda_reading_private.immutable_candidate();

CREATE TRIGGER immutable_photo BEFORE INSERT OR DELETE OR UPDATE ON ksda_reading_private.photos FOR EACH ROW EXECUTE FUNCTION ksda_reading_private.immutable_candidate();

CREATE TRIGGER immutable_source BEFORE INSERT OR DELETE OR UPDATE ON ksda_reading_private.release_sources FOR EACH ROW EXECUTE FUNCTION ksda_reading_private.immutable_candidate();

CREATE TRIGGER immutable_release BEFORE DELETE OR UPDATE ON ksda_reading_private.releases FOR EACH ROW EXECUTE FUNCTION ksda_reading_private.immutable_candidate();

CREATE TRIGGER validate_delivery_seal BEFORE UPDATE ON ksda_reading_private.releases FOR EACH ROW EXECUTE FUNCTION ksda_reading_private.validate_delivery_seal();

CREATE TRIGGER validate_photo_source BEFORE UPDATE ON ksda_reading_private.releases FOR EACH ROW EXECUTE FUNCTION ksda_reading_private.validate_photo_source();

revoke all on all tables in schema ksda_reading_private from public,anon,authenticated,service_role;

revoke all on all functions in schema ksda_reading_private from public,anon,authenticated,service_role;

revoke all on function public.ksda_reading_completion_test(p_release text, p_mission text, p_confirmed boolean) from public,anon,authenticated,service_role;

grant execute on function public.ksda_reading_completion_test(p_release text, p_mission text, p_confirmed boolean) to authenticated;

revoke all on function public.ksda_reading_delivery(p_scope text, p_release text, p_mission text) from public,anon,authenticated,service_role;

grant execute on function public.ksda_reading_delivery(p_scope text, p_release text, p_mission text) to authenticated;

revoke all on function public.ksda_reading_delivery_asset(p_scope text, p_release text, p_asset text, p_locale text) from public,anon,authenticated,service_role;

grant execute on function public.ksda_reading_delivery_asset(p_scope text, p_release text, p_asset text, p_locale text) to authenticated;

revoke all on function public.ksda_reading_delivery_progress(p_scope text, p_release text, p_mission text, p_revision text, p_reviewed jsonb, p_last text) from public,anon,authenticated,service_role;

grant execute on function public.ksda_reading_delivery_progress(p_scope text, p_release text, p_mission text, p_revision text, p_reviewed jsonb, p_last text) to authenticated;

revoke all on function public.ksda_reading_preview(p_release text, p_mission text) from public,anon,authenticated,service_role;

grant execute on function public.ksda_reading_preview(p_release text, p_mission text) to authenticated;

revoke all on function public.ksda_reading_preview_asset(p_release text, p_asset text, p_locale text) from public,anon,authenticated,service_role;

grant execute on function public.ksda_reading_preview_asset(p_release text, p_asset text, p_locale text) to authenticated;

revoke all on function public.ksda_reading_preview_progress(p_release text, p_mission text, p_revision text, p_reviewed jsonb, p_last text) from public,anon,authenticated,service_role;

grant execute on function public.ksda_reading_preview_progress(p_release text, p_mission text, p_revision text, p_reviewed jsonb, p_last text) to authenticated;

insert into ksda_reading_private.publication(singleton,release_id,activated_at) values(true,null,null);

comment on schema ksda_reading_private is 'Independent installation-owned reading releases; no default reviewer or active content.';

commit;
