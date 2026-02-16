-- Enable role helper based on Supabase JWT app_metadata.role
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin', false);
$$;

-- Business tables: admin-only access
alter table public."Work" enable row level security;
alter table public."Connection" enable row level security;
alter table public."Evidence" enable row level security;
alter table public."EvidenceReviewLog" enable row level security;
alter table public."UploadAuditLog" enable row level security;

drop policy if exists "Admin full access Work" on public."Work";
create policy "Admin full access Work"
on public."Work"
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admin full access Connection" on public."Connection";
create policy "Admin full access Connection"
on public."Connection"
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admin full access Evidence" on public."Evidence";
create policy "Admin full access Evidence"
on public."Evidence"
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admin full access EvidenceReviewLog" on public."EvidenceReviewLog";
create policy "Admin full access EvidenceReviewLog"
on public."EvidenceReviewLog"
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admin full access UploadAuditLog" on public."UploadAuditLog";
create policy "Admin full access UploadAuditLog"
on public."UploadAuditLog"
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

-- Private evidence bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'evidences-private',
  'evidences-private',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/gif', 'application/pdf']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Admin read evidences-private objects" on storage.objects;
create policy "Admin read evidences-private objects"
on storage.objects
for select
to authenticated
using (bucket_id = 'evidences-private' and public.is_admin());

drop policy if exists "Admin upload evidences-private objects" on storage.objects;
create policy "Admin upload evidences-private objects"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'evidences-private' and public.is_admin());

drop policy if exists "Admin update evidences-private objects" on storage.objects;
create policy "Admin update evidences-private objects"
on storage.objects
for update
to authenticated
using (bucket_id = 'evidences-private' and public.is_admin())
with check (bucket_id = 'evidences-private' and public.is_admin());

drop policy if exists "Admin delete evidences-private objects" on storage.objects;
create policy "Admin delete evidences-private objects"
on storage.objects
for delete
to authenticated
using (bucket_id = 'evidences-private' and public.is_admin());
