-- Run this once in Supabase: Dashboard -> SQL Editor -> New query -> paste -> Run.

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  type text not null default 'other',
  status text not null default 'active',
  description text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists project_updates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid not null references projects on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table if not exists papers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null,
  authors text not null default '',
  year text not null default '',
  file_path text not null,
  status text not null default 'to-read',
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  paper_id uuid not null references papers on delete cascade,
  page int not null,
  rects jsonb not null,          -- [{x,y,w,h}] as fractions of the page size
  text text not null default '',
  color text not null default 'yellow',
  note text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists ink (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  paper_id uuid not null references papers on delete cascade,
  page int not null,
  strokes jsonb not null,        -- [{color,width,points:[[x,y,p],...]}] normalized to page size
  unique (paper_id, page)
);

-- added later: free-form project notes (safe to re-run)
alter table projects add column if not exists notes text not null default '';

-- added later: timeline entries can be quick updates or longer notes (safe to re-run)
alter table project_updates add column if not exists kind text not null default 'update';

-- added later: reading-list fields; papers may exist before a PDF is attached (safe to re-run)
alter table papers alter column file_path drop not null;
alter table papers add column if not exists doi text not null default '';
alter table papers add column if not exists category text not null default '';
alter table papers add column if not exists priority text not null default '';
alter table papers add column if not exists source text not null default '';
alter table papers add column if not exists why text not null default '';

-- added later: work vs home projects, and scheduled events (safe to re-run)
alter table projects add column if not exists area text not null default 'work';

create table if not exists project_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid not null references projects on delete cascade,
  title text not null,
  starts_at timestamptz not null,
  repeat text not null default 'none',   -- 'none' or 'weekly'
  created_at timestamptz not null default now()
);
alter table project_events enable row level security;

-- added later: pinned projects and manual ordering (safe to re-run)
alter table projects add column if not exists pinned boolean not null default false;
alter table projects add column if not exists sort_order int;

-- added later: manuscript tracker fields and paper-to-project links (safe to re-run)
alter table projects add column if not exists stage text;
alter table projects add column if not exists journal text not null default '';
alter table projects add column if not exists coauthors text not null default '';
alter table projects add column if not exists deadline date;

create table if not exists project_papers (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid not null references projects on delete cascade,
  paper_id uuid not null references papers on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, paper_id)
);
alter table project_papers enable row level security;

-- added later: when a paper was read, and standalone deadlines (safe to re-run)
alter table papers add column if not exists read_at timestamptz;

create table if not exists project_deadlines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid not null references projects on delete cascade,
  title text not null,
  due_on date not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);
alter table project_deadlines enable row level security;

-- added later: tasks, focus-time entries and tags (safe to re-run)
create table if not exists project_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid not null references projects on delete cascade,
  title text not null,
  done boolean not null default false,
  due_on date,
  done_at timestamptz,
  created_at timestamptz not null default now()
);
alter table project_tasks enable row level security;

create table if not exists time_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  project_id uuid references projects on delete set null,
  minutes int not null,
  started_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table time_entries enable row level security;

alter table projects add column if not exists tags text[] not null default '{}';
alter table papers add column if not exists tags text[] not null default '{}';

alter table projects enable row level security;
alter table project_updates enable row level security;
alter table papers enable row level security;
alter table highlights enable row level security;
alter table ink enable row level security;

do $$
declare t text;
begin
  foreach t in array array['projects','project_updates','project_events','project_papers','project_deadlines','project_tasks','time_entries','papers','highlights','ink'] loop
    execute format('drop policy if exists "own rows" on %I', t);
    execute format('create policy "own rows" on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Private bucket for PDFs; each user can only touch files under their own user-id folder.
insert into storage.buckets (id, name, public) values ('papers', 'papers', false)
on conflict (id) do nothing;

drop policy if exists "own papers" on storage.objects;
create policy "own papers" on storage.objects for all
  using (bucket_id = 'papers' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'papers' and (storage.foldername(name))[1] = auth.uid()::text);
