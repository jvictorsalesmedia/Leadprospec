create extension if not exists pgcrypto;

create table if not exists public.app_admins (
  email text primary key,
  created_at timestamptz not null default now()
);

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  portal_email text unique,
  contact_name text,
  contact text,
  status text not null default 'Ativo' check (status in ('Ativo', 'Pausado', 'Concluido')),
  niche text,
  package text,
  notes text,
  created_by uuid default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.scripts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  format text,
  status text not null default 'Ideia' check (status in ('Ideia', 'Escrevendo', 'Revisao', 'Aprovado')),
  hook text,
  outline text,
  cta text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.recordings (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  date date,
  location text,
  status text not null default 'Planejada' check (status in ('Planejada', 'Pre-producao', 'Gravando', 'Edicao', 'Finalizada')),
  equipment text,
  shots text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  script_id uuid references public.scripts(id) on delete set null,
  recording_id uuid references public.recordings(id) on delete set null,
  title text not null,
  channel text,
  format text,
  stage text not null default 'Ideia' check (stage in ('Ideia', 'Roteiro', 'Gravacao', 'Edicao', 'Agendado', 'Publicado')),
  due_date date,
  priority text not null default 'Media' check (priority in ('Baixa', 'Media', 'Alta')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.agenda_items (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  title text not null,
  type text not null default 'Publicacao' check (type in ('Publicacao', 'Gravacao', 'Reuniao', 'Edicao', 'Revisao')),
  starts_at timestamptz,
  duration_minutes integer not null default 60 check (duration_minutes between 15 and 1440),
  location text,
  status text not null default 'Pendente' check (status in ('Pendente', 'Confirmado', 'Concluido')),
  related text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.app_admins enable row level security;
alter table public.clients enable row level security;
alter table public.scripts enable row level security;
alter table public.recordings enable row level security;
alter table public.posts enable row level security;
alter table public.agenda_items enable row level security;
